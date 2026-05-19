"""PROJ-34 Phase 13c — Niche-Vision LLM Pre-structuring.

Produces the structured `Niche.builder_form_hints` dict (Appendix L) by
sending the latest research's per-product vision analyses to
`openai/gpt-4.1-mini` via OpenRouter with the exact Appendix-M prompt.

The function is idempotent + cache-aware: a niche whose hints'
`_generated_at` is newer than the latest `NicheResearch.updated_at` short-
circuits without calling the LLM (pass `force=True` to bypass). On any
network / HTTP / JSON parse failure the function logs and returns ``None``
so the caller (PROJ-6 finalize hook) never raises (EC-27).

Output schema validation:
- `spatial` is constrained to `SPATIAL_OPTIONS` ids (Appendix J.4 — 36 ids).
  Unknown ids are dropped to ``None`` with a warning, mirroring the
  resolver's safe-fallback behavior.
- `accessories` / `material` are constrained to the verbatim 6-entry lists
  in `style_library.ACCESSORIES_OPTIONS` / `MATERIAL_OPTIONS`. Mismatches
  are dropped.
- `visual` is validated for the 60–120 word range. Out-of-range entries are
  KEPT (the LLM occasionally goes slightly over) but a warning is logged so
  we can audit drift in Langfuse without producing missing-slot UX bugs.
"""

from __future__ import annotations

import datetime as _dt
import json
import logging
import uuid as _uuid
from typing import Any

import httpx
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


# Tunables — matched to other OpenRouter calls in this codebase. The 12s
# timeout matches `spatial_analyzer.analyze_spatial_layout` (Phase 13d).
DEFAULT_MODEL = 'openai/gpt-4.1-mini'
TIMEOUT_SEC = 12.0
MAX_PRODUCTS = 10  # Appendix M: keep input <4k tokens.
SCHEMA_VERSION = 2  # Appendix L: v2 = spatial-as-id.


# Appendix M — System prompt. Copy-pasted VERBATIM from
# docs/tasks/PROJ-34-tasks.md (Phase 13c.8 enforces "no paraphrasing").
SYSTEM_PROMPT = """You are a Print-on-Demand niche-research analyst preparing data for the Architect Prompt Builder. You receive a structured dump of vision-analysis records describing the top-selling T-shirt designs in a single Amazon niche. Your job is to extract the dominant patterns and express them as four pre-formatted slot suggestions that will pre-fill a downstream prompt-builder form.

# Slot definitions

You produce exactly four slot suggestions:

1. SPATIAL — how text is arranged relative to the illustration. **Return ONE id from this fixed enum.** Do NOT return a free-text description. Return `null` only if none fits remotely. Allowed ids:
   `vertical_stack`, `horizontal_row`, `badge_emblem`, `banner_top`, `headline_top_subtitle_bottom`, `text_overlay`, `stacked_word_block`, `knockout_text`, `big_word_tiny_tag`, `word_as_shape`, `diagonal_text`, `pyramid_stack`, `rectangular_frame`, `crest_coat_of_arms`, `postage_stamp`, `hexagon_medallion`, `road_sign`, `definition_entry`, `knolling_grid`, `anatomy_diagram`, `checklist`, `periodic_tile`, `recipe_card`, `vintage_postcard`, `sports_jersey`, `movie_poster`, `license_plate`, `concert_ticket`, `map_coordinates`, `off_center_text_wrap`, `diagonal_split`, `triptych_three_panel`, `concentric_circular_text`, `speech_bubble`, `quote_marks_frame`, `sunburst_layout`, `flush_aligned_block`, `full_canvas_word_block`, `vertical_pillar_text`, `illustration_only_no_text`, `unconventional_integration`, `crossed_tools_intersection`, `subject_portrait_with_caption`.
   Short reference (pick the closest semantic match — do not invent new ids):
   - Most niches → `vertical_stack` (headline + illu + sub)
   - Trade / job / role badges → `badge_emblem` or `crest_coat_of_arms`
   - Quote-driven slogans → `stacked_word_block` or `quote_marks_frame`
   - Location / city niches → `map_coordinates` or `vintage_postcard`
   - Sports / number themes → `sports_jersey`
   - Comic / character niches → `speech_bubble`
   - Subject-with-rays niches → `sunburst_layout`

2. VISUAL — a free-form description (60-120 words) of the dominant illustration subject seen across the niche's bestsellers. MUST follow the Architect rule of ≥6 concrete details (perspective, color-object binding, line weight, pose, body parts, accessories). Start with "a [adjective] [SUBJECT] in [PERSPECTIVE], featuring ..." Use color-object binding ("golden yellow bus body") not bare colors. NEVER use the words "T-shirt", "mockup", "model wearing", "gradient", "glow", or "soft shadow".

3. ACCESSORIES — pick one from this fixed list and return it verbatim:
   - "white radiating motion-burst lines around the illustration"
   - "a sparse scattering of small filled stars and tiny dots framing the design"
   - "a thin geometric border frame enclosing the entire composition"
   - "a curved banner ribbon underneath the illustration with secondary text on it"
   - "sunburst rays radiating outward from behind the illustration"
   - "halftone-dot accents in the negative space around the illustration"

4. MATERIAL — pick one from this fixed list and return it verbatim:
   - "clean digital vector with flat color regions and crisp hard edges"
   - "matte screenprint plastisol ink texture with subtle paper-grain underlay"
   - "heavily distressed and weathered ink-bleed texture with cracked color fills"
   - "halftone-dot color fills with classic comic-book printing aesthetic and a limited 2-3 color palette"
   - "gritty vintage worn-on-fabric look with faded color washes and ink-loss patches"
   - "high-contrast 2-color screenprint with bold blocky color regions and hand-cut stencil edges"

# Output format

Return ONLY a valid JSON object with this exact shape. No preamble, no markdown, no explanation:

{
  "spatial": "<one of the 43 spatial ids verbatim, or null>",
  "visual": "<your 60-120 word visual description>",
  "accessories": "<one of the 6 accessories variants verbatim>",
  "material": "<one of the 6 material variants verbatim>",
  "_alternates": {
    "spatial": ["<second-best spatial id>", "<third-best>"],
    "visual": ["<one alternate visual description, 60-120 words>"],
    "accessories": ["<second-best accessories verbatim>"],
    "material": ["<second-best material verbatim>"]
  }
}

# Forbidden patterns

- NEVER use the word "T-shirt" anywhere in the output.
- NEVER mention "on a black shirt", "yellow on a yellow shirt", or any phrase that describes the wearer/fabric.
- NEVER produce a `visual` containing gradients, glowing effects, soft shadows, or drop shadows.
- NEVER paraphrase the fixed-list slot values — return them verbatim or pick a different one.
- For `spatial`, NEVER invent ids. Return only ids from the explicit enum above OR `null`."""


def _build_user_message(niche_name: str, vision_rows: list[dict[str, Any]]) -> str:
    """Render the Appendix-M user message template.

    The template literal text (header lines, dashed separators) is copied
    verbatim from the appendix; only the per-product placeholders are
    interpolated.
    """
    blocks: list[str] = []
    for row in vision_rows:
        blocks.append(
            '---\n'
            f"TITLE: {row.get('title', '')}\n"
            f"VISUAL_STYLE: {row.get('visual_style', '')}\n"
            f"GRAPHIC_ELEMENTS: {row.get('graphic_elements', '')}\n"
            f"LAYOUT_COMPOSITION: {row.get('layout_composition', '')}\n"
            f"COLOR_PALETTE: {row.get('dominant_color_palette', '')}\n"
            '---'
        )
    body = '\n'.join(blocks) if blocks else '(no vision analyses available)'
    return (
        f'NICHE: {niche_name}\n'
        f'PRODUCT COUNT IN RESEARCH: {len(vision_rows)}\n\n'
        f'VISION ANALYSIS RECORDS (one block per top-selling product):\n\n'
        f'{body}'
    )


def _load_vision_rows(niche) -> tuple[Any | None, list[dict[str, Any]]]:
    """Return (latest_NicheResearch, vision_rows) for the niche.

    Rows are filtered to `brand_blocked=False` per Appendix M. We limit to
    `MAX_PRODUCTS` so the user message stays under the 4k-token budget.
    The product title comes from `AmazonProduct.title` (vision analysis
    only stores per-element strings); `dominant_color_palette` does not
    exist on the model — we pass empty when unset.
    """
    from niche_research_app.models import (
        NicheProductVisionAnalysis,
        NicheResearch,
    )

    latest_research = (
        NicheResearch.objects
        .filter(niche=niche, status=NicheResearch.Status.COMPLETED)
        .order_by('-created_at')
        .first()
    )
    if latest_research is None:
        return None, []

    # `NicheProductVisionAnalysis` has FKs to research + product, and we
    # need product.title + an indirect filter against `NicheResearchProduct
    # .brand_blocked`. A direct two-step query is clearest.
    visions_qs = (
        NicheProductVisionAnalysis.objects
        .filter(research=latest_research)
        .select_related('product')
        .order_by('created_at')[: MAX_PRODUCTS * 2]  # over-fetch then drop
    )

    # Look up brand_blocked flags in one query.
    from niche_research_app.models import NicheResearchProduct
    product_ids = [v.product_id for v in visions_qs]
    blocked_ids = set(
        NicheResearchProduct.objects
        .filter(research=latest_research, product_id__in=product_ids, brand_blocked=True)
        .values_list('product_id', flat=True),
    )

    rows: list[dict[str, Any]] = []
    for v in visions_qs:
        if v.product_id in blocked_ids:
            continue
        rows.append({
            'title': getattr(v.product, 'title', '') or '',
            'visual_style': v.visual_style or '',
            'graphic_elements': v.graphic_elements or '',
            'layout_composition': v.layout_composition or '',
            # NicheProductVisionAnalysis has no color_palette column yet —
            # the appendix asks for it but the field doesn't exist. Pass
            # empty so the prompt stays valid (LLM tolerates blank lines).
            'dominant_color_palette': getattr(v, 'dominant_color_palette', '') or '',
        })
        if len(rows) >= MAX_PRODUCTS:
            break

    return latest_research, rows


def _is_cache_fresh(niche, latest_research) -> bool:
    """Return True when stored hints are newer than the latest research.

    Cache hit only fires when:
    1. `builder_form_hints` is a dict with a parseable `_generated_at`
    2. Stored `_source_research_id` matches the latest run id (so a NEW
       research run always invalidates the cache regardless of timestamps)
    3. The stored timestamp is >= `latest_research.updated_at`
    """
    hints = niche.builder_form_hints
    if not isinstance(hints, dict):
        return False
    gen_at = hints.get('_generated_at')
    if not gen_at:
        return False
    try:
        parsed = _dt.datetime.fromisoformat(gen_at.replace('Z', '+00:00'))
    except (TypeError, ValueError):
        return False
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=_dt.timezone.utc)
    if str(hints.get('_source_research_id') or '') != str(latest_research.id):
        return False
    research_updated = latest_research.updated_at if hasattr(
        latest_research, 'updated_at',
    ) else None
    if research_updated is None:
        # NicheResearch has no `updated_at` — fall back to `completed_at`.
        research_updated = getattr(latest_research, 'completed_at', None)
    if research_updated is None:
        return True
    if research_updated.tzinfo is None:
        research_updated = research_updated.replace(tzinfo=_dt.timezone.utc)
    return parsed >= research_updated


def _validate_and_clean(raw: dict[str, Any]) -> dict[str, Any]:
    """Apply enum + fixed-list validators per Appendix M.

    Invalid spatial / accessories / material values drop to ``None`` with a
    warning. `visual` outside 60–120 words is kept but logged.
    `_alternates` is filtered to known ids/strings only.
    """
    # Local import to avoid load-time cycles.
    from design_app.services.style_library import (
        ACCESSORIES_OPTIONS,
        MATERIAL_OPTIONS,
        get_spatial_by_id,
    )

    cleaned: dict[str, Any] = {}

    # Spatial — must be one of the 36 ids or None.
    spatial = raw.get('spatial')
    if spatial is None or spatial == 'null':
        cleaned['spatial'] = None
    elif isinstance(spatial, str) and get_spatial_by_id(spatial) is not None:
        cleaned['spatial'] = spatial
    else:
        logger.warning(
            'structure_niche_for_builder: dropping unknown spatial id %r', spatial,
        )
        cleaned['spatial'] = None

    # Visual — keep, but warn if word count is outside the 60–120 range.
    visual = raw.get('visual') or ''
    if isinstance(visual, str):
        words = len(visual.split())
        if visual and (words < 60 or words > 120):
            logger.warning(
                'structure_niche_for_builder: visual word count %d outside 60-120 range',
                words,
            )
        cleaned['visual'] = visual
    else:
        cleaned['visual'] = None

    # Accessories — must be one of the 6 verbatim strings or None.
    accessories = raw.get('accessories')
    if isinstance(accessories, str) and accessories in ACCESSORIES_OPTIONS:
        cleaned['accessories'] = accessories
    else:
        if accessories:
            logger.warning(
                'structure_niche_for_builder: dropping non-canonical accessories: %r',
                accessories[:80] if isinstance(accessories, str) else accessories,
            )
        cleaned['accessories'] = None

    # Material — same treatment.
    material = raw.get('material')
    if isinstance(material, str) and material in MATERIAL_OPTIONS:
        cleaned['material'] = material
    else:
        if material:
            logger.warning(
                'structure_niche_for_builder: dropping non-canonical material: %r',
                material[:80] if isinstance(material, str) else material,
            )
        cleaned['material'] = None

    # Alternates — same filters, but drop invalid entries silently (they're
    # backups so noise is unhelpful).
    alts_raw = raw.get('_alternates') or {}
    alts: dict[str, list[str]] = {
        'spatial': [],
        'visual': [],
        'accessories': [],
        'material': [],
    }
    if isinstance(alts_raw, dict):
        for sid in (alts_raw.get('spatial') or []):
            if isinstance(sid, str) and get_spatial_by_id(sid) is not None:
                alts['spatial'].append(sid)
        for v in (alts_raw.get('visual') or []):
            if isinstance(v, str) and v.strip():
                alts['visual'].append(v)
        for a in (alts_raw.get('accessories') or []):
            if isinstance(a, str) and a in ACCESSORIES_OPTIONS:
                alts['accessories'].append(a)
        for m in (alts_raw.get('material') or []):
            if isinstance(m, str) and m in MATERIAL_OPTIONS:
                alts['material'].append(m)
    cleaned['_alternates'] = alts

    return cleaned


def _call_openrouter(
    niche_name: str,
    vision_rows: list[dict[str, Any]],
    *,
    workspace_id: str | None,
    niche_id: str,
) -> dict[str, Any] | None:
    """Send the Appendix-M call. Returns the parsed JSON dict or None.

    Failures return None (the caller logs + leaves `builder_form_hints`
    untouched). Wraps in a Langfuse trace when keys are configured.
    """
    api_key = getattr(settings, 'OPENROUTER_API_KEY', '')
    base_url = getattr(settings, 'OPENROUTER_BASE_URL', '')
    if not api_key or not base_url:
        logger.warning(
            'structure_niche_for_builder: OPENROUTER not configured — skipping',
        )
        return None

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://merchminer.com',
        'X-Title': 'Merch Miner Niche Builder Hints',
    }
    user_msg = _build_user_message(niche_name, vision_rows)
    payload = {
        'model': DEFAULT_MODEL,
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': user_msg},
        ],
        'temperature': 0.3,
        'max_tokens': 1200,
        'response_format': {'type': 'json_object'},
    }

    # Langfuse — best-effort. Mirrors the pattern in prompt_polish.py.
    langfuse_client = None
    trace = None
    generation = None
    if getattr(settings, 'LANGFUSE_PUBLIC_KEY', '') and getattr(
        settings, 'LANGFUSE_SECRET_KEY', '',
    ):
        try:
            from langfuse import Langfuse
            langfuse_client = Langfuse(
                public_key=settings.LANGFUSE_PUBLIC_KEY,
                secret_key=settings.LANGFUSE_SECRET_KEY,
                base_url=getattr(settings, 'LANGFUSE_HOST', ''),
            )
            trace = langfuse_client.trace(
                name='niche-builder-hints',
                metadata={
                    'workspace_id': str(workspace_id) if workspace_id else None,
                    'niche_id': str(niche_id),
                    'product_count': len(vision_rows),
                },
                tags=['niche_app', 'builder_hints', 'proj-34'],
            )
            generation = trace.generation(
                name='structure_niche_for_builder',
                model=DEFAULT_MODEL,
                input=payload['messages'],
                model_parameters={'temperature': 0.3, 'max_tokens': 1200},
            )
        except Exception:
            langfuse_client = None
            trace = None
            generation = None

    parsed: dict[str, Any] | None = None
    last_error: str | None = None
    try:
        with httpx.Client(timeout=TIMEOUT_SEC) as client:
            resp = client.post(
                f'{base_url}/chat/completions', headers=headers, json=payload,
            )
            resp.raise_for_status()
        data = resp.json()
        content = (
            data.get('choices', [{}])[0]
            .get('message', {})
            .get('content', '') or ''
        ).strip()
        parsed = json.loads(content) if content else None
        usage = data.get('usage', {}) or {}
        if generation:
            try:
                generation.end(
                    output=content[:1000],
                    usage={
                        'input': usage.get('prompt_tokens'),
                        'output': usage.get('completion_tokens'),
                        'total': usage.get('total_tokens'),
                    },
                )
            except Exception:
                pass
    except httpx.TimeoutException as exc:
        last_error = f'timeout: {exc}'
    except httpx.HTTPStatusError as exc:
        last_error = (
            f'http {exc.response.status_code}: {exc.response.text[:200]}'
        )
    except json.JSONDecodeError as exc:
        last_error = f'json parse: {exc}'
    except Exception as exc:  # noqa: BLE001 — must never raise (EC-27)
        last_error = f'{type(exc).__name__}: {exc}'

    if last_error:
        logger.error(
            'structure_niche_for_builder: %s (niche=%s)', last_error, niche_id,
        )
        if generation:
            try:
                generation.end(level='ERROR', status_message=last_error)
            except Exception:
                pass

    if langfuse_client:
        try:
            langfuse_client.flush()
        except Exception:
            pass

    if not isinstance(parsed, dict):
        return None
    return parsed


def structure_niche_for_builder(
    niche_id: str | _uuid.UUID,
    *,
    force: bool = False,
) -> dict | None:
    """Generate or refresh `Niche.builder_form_hints` for one niche.

    Returns the stored dict on success, ``None`` on:
    - niche not found
    - no completed research run
    - OpenRouter unreachable / timeout / 5xx (EC-27)
    - JSON parse failure
    - cache hit + `force=False` returns the cached dict (NOT None)

    The function NEVER raises — wrap callers in plain code without try/except.
    """
    from niche_app.models import Niche

    try:
        niche = (
            Niche.objects
            .select_related('workspace')
            .get(id=niche_id)
        )
    except Niche.DoesNotExist:
        logger.warning(
            'structure_niche_for_builder: niche %s not found', niche_id,
        )
        return None

    latest_research, vision_rows = _load_vision_rows(niche)
    if latest_research is None:
        logger.info(
            'structure_niche_for_builder: niche %s has no completed research',
            niche_id,
        )
        return None

    # Cache hit short-circuit (AC-54 idempotency).
    if not force and _is_cache_fresh(niche, latest_research):
        logger.info(
            'structure_niche_for_builder: niche %s cache fresh — skip LLM',
            niche_id,
        )
        return niche.builder_form_hints

    raw = _call_openrouter(
        niche_name=niche.name,
        vision_rows=vision_rows,
        workspace_id=str(niche.workspace_id),
        niche_id=str(niche.id),
    )
    if raw is None:
        # EC-27: failures keep stored hints untouched.
        return None

    cleaned = _validate_and_clean(raw)
    cleaned['_schema_version'] = SCHEMA_VERSION
    cleaned['_generated_at'] = timezone.now().isoformat()
    cleaned['_source_research_id'] = str(latest_research.id)

    niche.builder_form_hints = cleaned
    niche.save(update_fields=['builder_form_hints', 'updated_at'])
    logger.info(
        'structure_niche_for_builder: stored hints for niche %s (research=%s)',
        niche_id, latest_research.id,
    )
    return cleaned
