"""AI Improve service for PROJ-11 (Listing).

Two-step LLM rewrite of a Listing's user-facing copy:

1. ``ensure_design_vision(design_asset)`` — one-shot vision pass over the
   DesignAsset image. Result is cached in ``DesignAsset.vision_analysis`` so
   subsequent AI-Improve calls for the same design are text-only (cheaper).
2. ``build_prompt`` / ``call_llm`` — text-only completion that rewrites the
   5 Listing fields using the cached vision dict as structured context.

Model, temperature, max_tokens, and system prompt for each step are stored
in ``ListingImproveNodeConfig`` (Django Admin editable, no redeploy needed).
Code defaults are applied when a row is missing.

Pure functions -- no DB writes until ``apply_to_listing`` (writes the
listing) or ``ensure_design_vision`` (writes the design cache). The view
(Phase M2) composes these: ``ensure_design_vision`` -> ``build_prompt`` ->
``call_llm`` -> ``validate_and_truncate`` -> ``apply_to_listing``.

See PROJ-11 AC-69..AC-72, EC-31..EC-33.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from django.conf import settings
from langchain_openai import ChatOpenAI

from publish_app.models import Listing
from publish_app.services.ai_improve_prompts import (
    DEFAULT_AI_IMPROVE_PROMPT,
    DEFAULT_DESIGN_VISION_PROMPT,
)
from publish_app.services.translator import CHAR_LIMITS, LANGUAGE_NAMES

logger = logging.getLogger(__name__)

# 5 fields returned by the LLM (Phase I Listing shape).
EXPECTED_FIELDS = (
    'title',
    'bullet_1',
    'bullet_2',
    'description',
    'keyword_context',
)

# Shape keys expected on ``DesignAsset.vision_analysis`` once populated.
VISION_FIELDS = (
    'description',
    'visual_style',
    'graphic_elements',
    'layout_composition',
    'dominant_colors',
    'detected_text',
)

# Node identifiers for ``ListingImproveNodeConfig``.
NODE_AI_IMPROVE = 'ai_improve'
NODE_DESIGN_VISION = 'design_vision'

# Code-level fallbacks when the DB config row is missing. Mirrors the pattern
# in ``niche_research_app/graph/llm.py``.
_NODE_DEFAULTS: dict[str, dict[str, Any]] = {
    NODE_AI_IMPROVE: {
        'model_name': 'openai/gpt-4.1-mini',
        'temperature': 0.7,
        'max_tokens': 2000,
        'system_prompt': DEFAULT_AI_IMPROVE_PROMPT,
    },
    NODE_DESIGN_VISION: {
        'model_name': 'openai/gpt-4.1-mini',
        'temperature': 0.2,
        'max_tokens': 1500,
        'system_prompt': DEFAULT_DESIGN_VISION_PROMPT,
    },
}


class AIImproveError(Exception):
    """Raised when the AI Improve pipeline cannot produce a usable result.

    The view maps this to HTTP 502 so the listing is left unchanged (EC-33).
    """


# ---------------------------------------------------------------------------
# LLM config lookup (DB-backed, with code fallback)
# ---------------------------------------------------------------------------

def _resolve_node_config(node_name: str) -> dict[str, Any]:
    """Return resolved config dict for an AI Improve node.

    Reads ``ListingImproveNodeConfig`` from DB and falls back to
    ``_NODE_DEFAULTS[node_name]``. Never raises on missing row.
    """
    fallback = _NODE_DEFAULTS.get(node_name, {})
    # Late import so migrations/test collection don't require the app's models
    # to be loaded before AppConfig.ready runs.
    from publish_app.models import ListingImproveNodeConfig

    resolved = dict(fallback)
    try:
        row = ListingImproveNodeConfig.objects.get(node_name=node_name)
    except ListingImproveNodeConfig.DoesNotExist:
        logger.warning(
            "No ListingImproveNodeConfig for node '%s', using code defaults.",
            node_name,
        )
        return resolved

    if row.model_name:
        resolved['model_name'] = row.model_name
    resolved['temperature'] = row.temperature
    if row.max_tokens is not None:
        resolved['max_tokens'] = row.max_tokens
    if row.system_prompt:
        resolved['system_prompt'] = row.system_prompt
    return resolved


def get_ai_improve_llm() -> tuple[ChatOpenAI, str]:
    """Return ``(llm, system_prompt)`` for the text-only AI Improve rewrite.

    Reads ``ListingImproveNodeConfig(node_name='ai_improve')`` from the DB
    and falls back to the module-level defaults.
    """
    return _build_llm(NODE_AI_IMPROVE, json_mode=True)


def get_design_vision_llm() -> tuple[ChatOpenAI, str]:
    """Return ``(llm, system_prompt)`` for the one-shot design vision pass."""
    return _build_llm(NODE_DESIGN_VISION, json_mode=True)


def _safe_model_name(llm: Any) -> str:
    """Return a JSON-safe string model name (LangChain attr may be missing)."""
    raw = getattr(llm, 'model_name', '') or getattr(llm, 'model', '')
    return str(raw) if isinstance(raw, (str, bytes)) else ''


def _build_llm(node_name: str, *, json_mode: bool) -> tuple[ChatOpenAI, str]:
    cfg = _resolve_node_config(node_name)

    kwargs: dict[str, Any] = {
        'model': cfg['model_name'],
        'temperature': cfg['temperature'],
        'api_key': settings.OPENROUTER_API_KEY,
        'base_url': settings.OPENROUTER_BASE_URL,
        'default_headers': {
            'HTTP-Referer': settings.FRONTEND_URL,
            'X-OpenRouter-Title': settings.COMPANY_NAME,
        },
    }
    if cfg.get('max_tokens'):
        kwargs['max_tokens'] = cfg['max_tokens']
    if json_mode:
        kwargs['model_kwargs'] = {'response_format': {'type': 'json_object'}}

    return ChatOpenAI(**kwargs), cfg['system_prompt']


# ---------------------------------------------------------------------------
# ensure_design_vision -- cache-aware vision pass on the DesignAsset
# ---------------------------------------------------------------------------

def ensure_design_vision(design: Any) -> dict:
    """Return the cached vision dict for a design, populating it on first call.

    If ``design.vision_analysis`` is already a non-empty dict, it is returned
    as-is (no LLM call). Otherwise a vision LLM call runs against the design
    image URL, the result is persisted on the design, and the structured
    dict is returned.

    The returned dict always contains the ``VISION_FIELDS`` keys (with empty
    strings / empty lists when the model omitted one). ``analyzed_at`` + the
    model name are also included.

    Args:
        design: ``DesignAsset`` instance. Must not be ``None``.

    Returns:
        ``dict`` with the cached/just-computed analysis.

    Raises:
        AIImproveError: If the LLM call fails, returns non-JSON, or the
            design has no resolvable image URL (no fallback possible when
            we're explicitly running a vision pass).
    """
    existing = getattr(design, 'vision_analysis', None) or {}
    if isinstance(existing, dict) and existing:
        return existing

    image_url = _resolve_image_url(design)
    if not image_url:
        raise AIImproveError(
            'Cannot run vision analysis: design has no resolvable image URL',
        )

    llm, system_prompt = get_design_vision_llm()

    messages = [
        {'role': 'system', 'content': system_prompt},
        {
            'role': 'user',
            'content': [
                {
                    'type': 'text',
                    'text': 'Analyze this print-on-demand design image.',
                },
                {'type': 'image_url', 'image_url': {'url': image_url}},
            ],
        },
    ]

    langfuse = _get_langfuse()
    generation = None
    if langfuse:
        try:
            trace = langfuse.trace(
                name='listing-ai-improve-vision',
                tags=['publish_app', 'ai_improve', 'design_vision'],
            )
            generation = trace.generation(
                name='design-vision-llm-call',
                model=getattr(llm, 'model_name', ''),
                input=messages,
            )
        except Exception:
            logger.warning('Failed to init Langfuse trace for design vision')
            generation = None

    try:
        response = llm.invoke(messages)
    except Exception as exc:
        if generation:
            try:
                generation.end(level='ERROR', status_message=str(exc)[:500])
            except Exception:
                pass
        logger.exception('Design vision LLM invocation failed')
        raise AIImproveError(f'Vision LLM call failed: {exc}') from exc
    finally:
        if langfuse:
            try:
                langfuse.flush()
            except Exception:
                logger.warning('Failed to flush Langfuse client')

    content = getattr(response, 'content', '') or ''
    if not isinstance(content, str):
        content = str(content)

    parsed = _parse_json(content.strip())
    if parsed is None:
        if generation:
            try:
                generation.end(
                    output=content[:500],
                    level='ERROR',
                    status_message='Non-JSON response',
                )
            except Exception:
                pass
        raise AIImproveError('Design vision LLM returned non-JSON response')

    if generation:
        try:
            generation.end(output=parsed)
        except Exception:
            logger.warning('Failed to end Langfuse generation span')

    analysis = _normalize_vision_dict(
        parsed, model_name=_safe_model_name(llm),
    )

    design.vision_analysis = analysis
    design.save(update_fields=['vision_analysis'])
    return analysis


def _normalize_vision_dict(raw: dict, *, model_name: str) -> dict:
    """Coerce vision LLM output into the canonical cache shape."""
    normalized: dict[str, Any] = {
        'analyzed_at': datetime.now(timezone.utc).isoformat(),
        'model': model_name,
    }

    for key in VISION_FIELDS:
        value = raw.get(key, '')
        if key == 'dominant_colors':
            if isinstance(value, list):
                normalized[key] = [str(c) for c in value if c]
            elif isinstance(value, str) and value:
                normalized[key] = [value]
            else:
                normalized[key] = []
        else:
            normalized[key] = '' if value is None else str(value)

    return normalized


# ---------------------------------------------------------------------------
# build_prompt -- text-only rewrite using the cached vision context
# ---------------------------------------------------------------------------

def build_prompt(
    listing: Listing,
    vision_context: dict,
    keyword_context: str,
    language: str,
) -> list[dict]:
    """Return LangChain-style message list for the AI-Improve LLM call.

    Text-only: the design image is represented via the structured
    ``vision_context`` dict (produced by :func:`ensure_design_vision`).

    Args:
        listing: ``Listing`` instance (source of existing copy + marketplace).
        vision_context: Dict from ``ensure_design_vision``. May be empty when
            the caller chose not to run the vision pass -- the block is then
            labelled ``(none)``.
        keyword_context: Free-form seller keywords hint. May be empty.
        language: ISO language code (e.g. 'en', 'de'). Falls back to the raw
            code for unknown values so the LLM still gets a usable instruction.

    Returns:
        ``list[dict]`` with two messages (system + user), each using the
        standard OpenAI role/content shape.
    """
    _, system_prompt = get_ai_improve_llm()

    lang_name = LANGUAGE_NAMES.get(language, language or 'English')

    char_limits_str = '\n'.join(
        f'- {field}: {CHAR_LIMITS[field]} chars'
        for field in EXPECTED_FIELDS
    )

    existing = {
        'brand_name': listing.brand_name or '',
        'title': listing.title or '',
        'bullet_1': listing.bullet_1 or '',
        'bullet_2': listing.bullet_2 or '',
        'description': listing.description or '',
        'keyword_context': listing.keyword_context or '',
    }

    vision_block = _format_vision_block(vision_context)

    user_text = (
        f'Target listing language: {lang_name} ({language}).\n'
        f'Marketplace: {listing.marketplace_type}.\n\n'
        f'Character limits:\n{char_limits_str}\n\n'
        f'Design analysis (from upstream vision model):\n'
        f'{vision_block}\n\n'
        f'Seller keyword_context hint (may be empty):\n'
        f'{keyword_context or "(none)"}\n\n'
        f'Existing listing copy (may be empty -- treat as generation from '
        f'scratch when blank, or as a rewrite when populated):\n'
        f'{json.dumps(existing, ensure_ascii=False, indent=2)}\n\n'
        f'Return the 5-field JSON now.'
    )

    return [
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': user_text},
    ]


def _format_vision_block(vision_context: dict) -> str:
    """Render the vision dict as a readable key/value block for the prompt."""
    if not isinstance(vision_context, dict) or not vision_context:
        return '(none)'

    lines: list[str] = []
    for key in VISION_FIELDS:
        value = vision_context.get(key, '')
        if isinstance(value, list):
            formatted = ', '.join(str(v) for v in value) if value else '(empty)'
        else:
            formatted = str(value) if value else '(empty)'
        lines.append(f'- {key}: {formatted}')
    return '\n'.join(lines)


def _resolve_image_url(design: Any) -> str:
    """Pick the best available URL for the design image.

    Prefer explicit ``file_url`` (external sources), then the FileField URL,
    finally the thumbnail. Returns empty string if nothing is usable.
    """
    url = getattr(design, 'file_url', '') or ''
    if url:
        return url
    file_field = getattr(design, 'file', None)
    if file_field:
        try:
            return file_field.url
        except (ValueError, AttributeError):
            pass
    return getattr(design, 'thumbnail_url', '') or ''


# ---------------------------------------------------------------------------
# call_llm -- text-only rewrite (reads model + params from DB config)
# ---------------------------------------------------------------------------

def call_llm(messages: list[dict]) -> dict:
    """Invoke OpenRouter (OpenAI-compatible) for the text-only AI Improve pass.

    Reads model + temperature + max_tokens from ``ListingImproveNodeConfig``
    (node ``ai_improve``). Falls back to the module-level defaults when the
    DB row is missing.

    Traces the call to Langfuse when configured (existing PROJ-6 pattern).

    Args:
        messages: Output of ``build_prompt`` -- system + user dicts.

    Returns:
        Parsed JSON dict from the LLM response.

    Raises:
        AIImproveError: If the LLM response is not parseable JSON, or the
            upstream call fails for any reason. The view maps this to HTTP
            502 (EC-33) and leaves the listing untouched.
    """
    llm, _ = get_ai_improve_llm()
    model_name = getattr(llm, 'model_name', '')

    langfuse = _get_langfuse()
    generation = None
    if langfuse:
        try:
            trace = langfuse.trace(
                name='listing-ai-improve',
                tags=['publish_app', 'ai_improve'],
            )
            generation = trace.generation(
                name='ai-improve-llm-call',
                model=model_name,
                input=messages,
                model_parameters={
                    'temperature': getattr(llm, 'temperature', None),
                },
            )
        except Exception:
            logger.warning('Failed to init Langfuse trace for AI Improve')
            generation = None

    try:
        response = llm.invoke(messages)
    except Exception as exc:
        if generation:
            try:
                generation.end(level='ERROR', status_message=str(exc)[:500])
            except Exception:
                pass
        logger.exception('AI Improve LLM invocation failed')
        raise AIImproveError(f'LLM upstream call failed: {exc}') from exc
    finally:
        if langfuse:
            try:
                langfuse.flush()
            except Exception:
                logger.warning('Failed to flush Langfuse client')

    content = getattr(response, 'content', '') or ''
    if not isinstance(content, str):
        # LangChain may return a list for multimodal outputs -- coerce to str.
        content = str(content)

    parsed = _parse_json(content.strip())
    if parsed is None:
        if generation:
            try:
                generation.end(
                    output=content[:500],
                    level='ERROR',
                    status_message='Non-JSON response',
                )
            except Exception:
                pass
        raise AIImproveError('LLM returned non-JSON response')

    if generation:
        try:
            generation.end(output=parsed)
        except Exception:
            logger.warning('Failed to end Langfuse generation span')

    return parsed


def _parse_json(content: str) -> dict | None:
    """Best-effort JSON extraction from an LLM response."""
    if not content:
        return None
    try:
        result = json.loads(content)
    except json.JSONDecodeError:
        result = None
    if isinstance(result, dict):
        return result

    # Fallback: find the outermost {...} block.
    start = content.find('{')
    end = content.rfind('}') + 1
    if start >= 0 and end > start:
        try:
            candidate = json.loads(content[start:end])
        except json.JSONDecodeError:
            return None
        if isinstance(candidate, dict):
            return candidate
    return None


def _get_langfuse():
    """Return an initialized Langfuse client or ``None`` when not configured.

    Mirrors the helper in ``design_app/services/image_analyzer.py``.
    """
    if not getattr(settings, 'LANGFUSE_PUBLIC_KEY', '') or not getattr(
        settings, 'LANGFUSE_SECRET_KEY', '',
    ):
        return None
    try:
        from langfuse import Langfuse

        return Langfuse(
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
            base_url=settings.LANGFUSE_HOST,
        )
    except ImportError:
        logger.warning('langfuse package not installed, skipping tracing')
        return None


# ---------------------------------------------------------------------------
# validate_and_truncate
# ---------------------------------------------------------------------------

def validate_and_truncate(response_dict: dict) -> tuple[dict, list[str]]:
    """Coerce + truncate LLM output to the 5 expected fields.

    Missing fields default to empty string. Non-string values are coerced via
    ``str()``. Values longer than the serializer ``max_length`` are truncated
    and their keys collected in ``truncated_keys``.

    Args:
        response_dict: Raw dict from ``call_llm``.

    Returns:
        ``(fields_dict, truncated_keys)`` -- ``fields_dict`` is safe to pass to
        ``ListingSerializer`` via ``apply_to_listing``.
    """
    if not isinstance(response_dict, dict):
        raise AIImproveError('LLM response was not a JSON object')

    fields: dict[str, str] = {}
    truncated: list[str] = []

    for key in EXPECTED_FIELDS:
        raw = response_dict.get(key, '')
        value = '' if raw is None else str(raw)
        limit = CHAR_LIMITS.get(key)
        if limit is not None and len(value) > limit:
            value = value[:limit]
            truncated.append(key)
        fields[key] = value

    return fields, truncated


# ---------------------------------------------------------------------------
# apply_to_listing
# ---------------------------------------------------------------------------

def apply_to_listing(listing: Listing, fields: dict) -> Listing:
    """Persist AI-improved fields on the listing.

    Uses ``ListingSerializer`` for validation, then writes model attributes
    directly to control the side-effect fields (``generated_by='ai'``,
    status reverts to ``draft``) regardless of the serializer's read-only set.

    The caller (view) is responsible for wrapping this in a transaction if it
    needs atomicity with other writes. By itself this is a single ``save()``.

    Args:
        listing: The ``Listing`` instance to update.
        fields: Output of ``validate_and_truncate`` (dict of 5 string fields).

    Returns:
        The same ``Listing`` instance, refreshed from the DB after save.
    """
    # Late import to avoid circular imports at module load time.
    from publish_app.api.serializers import ListingSerializer

    # Validate shape + max_length via the serializer. We already truncated,
    # so this is a defensive check.
    serializer = ListingSerializer(
        instance=listing,
        data=fields,
        partial=True,
    )
    serializer.is_valid(raise_exception=True)

    update_fields = []
    for key in EXPECTED_FIELDS:
        if key in fields:
            setattr(listing, key, fields[key])
            update_fields.append(key)

    listing.generated_by = Listing.GeneratedBy.AI
    update_fields.append('generated_by')

    listing.status = Listing.Status.DRAFT
    update_fields.append('status')

    # updated_at is auto_now -- include explicitly so update_fields triggers it.
    update_fields.append('updated_at')

    listing.save(update_fields=list(dict.fromkeys(update_fields)))
    listing.refresh_from_db()
    return listing
