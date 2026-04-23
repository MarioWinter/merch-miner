"""AI Improve service for PROJ-11 (Listing).

One-shot LLM rewrite of a Listing's user-facing copy. Vision model reads the
linked DesignAsset image plus any existing text + ``keyword_context`` hints,
returns 5 fields as JSON, which are truncated to serializer max_length before
being applied via ``ListingSerializer``.

Pure functions only -- no DB writes until ``apply_to_listing``. The view
(Phase M2) composes these: ``build_prompt`` -> ``call_llm`` ->
``validate_and_truncate`` -> ``apply_to_listing``.

See PROJ-11 AC-69..AC-72, EC-31..EC-33.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from django.conf import settings
from langchain_openai import ChatOpenAI

from publish_app.models import Listing
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

DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet'
DEFAULT_TIMEOUT_SECONDS = 60

SYSTEM_PROMPT = """You are an expert copywriter for Amazon Merch on Demand (MBA) listings.

You will receive a design image plus optional existing listing text and a free-form
``keyword_context`` hint from the seller. Your task: produce a full, high-converting
MBA listing in the requested language.

Hard rules:
1. Return ONLY valid JSON with exactly these 5 keys: "title", "bullet_1", "bullet_2",
   "description", "keyword_context".
2. Respect Amazon character limits (given below). If you go over, the server will
   truncate -- but prefer tight copy that stays within limits.
3. ``keyword_context`` is an internal AI-input field (NOT shown to shoppers).
   Return a comma-separated list of the strongest search keywords for this design,
   in English even when the listing language is not English.
4. Write the other 4 fields in the requested listing language. Preserve marketing
   tone + emotional hook. Use idioms that fit the target market.
5. If the image has visible text/slogan, feature it in the title when natural.
6. Never invent brand names, claims, or guarantees. No emoji in title/bullets.

Output shape (no prose, no markdown fence, just JSON):
{
  "title": "...",
  "bullet_1": "...",
  "bullet_2": "...",
  "description": "...",
  "keyword_context": "..."
}"""


class AIImproveError(Exception):
    """Raised when the AI Improve pipeline cannot produce a usable result.

    The view maps this to HTTP 502 so the listing is left unchanged (EC-33).
    """


# ---------------------------------------------------------------------------
# build_prompt
# ---------------------------------------------------------------------------

def build_prompt(
    listing: Listing,
    design: Any,  # publish_app.models.DesignAsset (duck-typed to avoid import cycle noise)
    keyword_context: str,
    language: str,
) -> list[dict]:
    """Return LangChain-style message list for the LLM call.

    Vision input: design image URL.
    Text input: existing listing copy + keyword_context hint + marketplace +
    target language.

    Args:
        listing: ``Listing`` instance (source of existing copy + marketplace_type).
        design: ``DesignAsset`` linked to the listing. Must not be ``None``
            (the view guards this per EC-31).
        keyword_context: Free-form seller keywords hint. May be empty.
        language: ISO language code (e.g. 'en', 'de'). Falls back to English
            name for unknown codes so the LLM gets a usable instruction.

    Returns:
        ``list[dict]`` with two messages (system + user). The user message uses
        the OpenAI multimodal content array shape so the vision model sees the
        design image plus the text hint.
    """
    lang_name = LANGUAGE_NAMES.get(language, language or 'English')

    image_url = _resolve_image_url(design)

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

    user_text = (
        f'Target listing language: {lang_name} ({language}).\n'
        f'Marketplace: {listing.marketplace_type}.\n\n'
        f'Character limits:\n{char_limits_str}\n\n'
        f'Seller keyword_context hint (may be empty):\n'
        f'{keyword_context or "(none)"}\n\n'
        f'Existing listing copy (may be empty -- treat as generation from scratch '
        f'when blank, or as a rewrite when populated):\n'
        f'{json.dumps(existing, ensure_ascii=False, indent=2)}\n\n'
        f'Return the 5-field JSON now.'
    )

    user_content: list[dict]
    if image_url:
        user_content = [
            {'type': 'text', 'text': user_text},
            {'type': 'image_url', 'image_url': {'url': image_url}},
        ]
    else:
        # Defensive: view guards against design=None, but a DesignAsset may
        # still lack a usable URL. We fall back to text-only so the LLM can
        # at least rewrite the copy.
        logger.warning(
            'AI Improve: design %s has no resolvable image URL; sending '
            'text-only prompt.', getattr(design, 'id', '?'),
        )
        user_content = [{'type': 'text', 'text': user_text}]

    return [
        {'role': 'system', 'content': SYSTEM_PROMPT},
        {'role': 'user', 'content': user_content},
    ]


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
# call_llm
# ---------------------------------------------------------------------------

def call_llm(messages: list[dict]) -> dict:
    """Invoke OpenRouter (OpenAI-compatible) with JSON response format.

    Reads model + timeout from env: ``AI_IMPROVE_MODEL`` +
    ``AI_IMPROVE_TIMEOUT_SECONDS``. Falls back to module defaults when unset.

    Traces the call to Langfuse when configured (existing PROJ-6 pattern from
    ``design_app/services/image_analyzer.py``).

    Args:
        messages: Output of ``build_prompt`` -- system + user dicts.

    Returns:
        Parsed JSON dict from the LLM response.

    Raises:
        AIImproveError: If the LLM response is not parseable JSON, or the
            upstream call fails for any reason. The view maps this to HTTP
            502 (EC-33) and leaves the listing untouched.
    """
    model_name = os.environ.get('AI_IMPROVE_MODEL', DEFAULT_MODEL)
    timeout_seconds = int(
        os.environ.get('AI_IMPROVE_TIMEOUT_SECONDS', str(DEFAULT_TIMEOUT_SECONDS)),
    )

    llm = ChatOpenAI(
        model=model_name,
        api_key=settings.OPENROUTER_API_KEY,
        base_url=settings.OPENROUTER_BASE_URL,
        temperature=0.4,
        timeout=timeout_seconds,
        # OpenRouter passes this through to providers that support JSON mode.
        model_kwargs={'response_format': {'type': 'json_object'}},
        default_headers={
            'HTTP-Referer': settings.FRONTEND_URL,
            'X-OpenRouter-Title': settings.COMPANY_NAME,
        },
    )

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
                    'temperature': 0.4,
                    'timeout': timeout_seconds,
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
