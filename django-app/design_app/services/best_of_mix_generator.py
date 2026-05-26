"""PROJ-34 Phase 13t-d — Best-of-Mix LLM Generator (3 synthetic preset variants).

Produces the cached `Niche.best_of_mix_cache` dict (Appendix S) by sending an
aggregate of vision + emotional + niche-level analyses to
`openai/gpt-4.1-mini` via OpenRouter with the verbatim Appendix-S system
prompt. Each generation yields three distinct variants — `most_common`,
`edgy`, `safe` — each containing 7 slot values that match
`NicheCardPreset` model fields.

The function is idempotent + cache-aware: a niche whose cache's
`_source_research_id` matches the latest research run short-circuits without
calling the LLM (pass `force=True` to bypass). On any network / HTTP / JSON
parse / validation failure it logs and returns ``None`` so the caller (the
preset-cards API in Phase 13t-g) never raises.

After a successful LLM call the 5 mappable slots
(`spatial_configuration`, `typography_adjectives`, `font_combination`,
`accessories`, `style_dna`) flow through
`preset_matcher.match_slot_to_builtin` so the cache stores resolved
``(value, is_raw)`` pairs ready for `NicheCardPreset.objects.create(**...)`.
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


# ─── Tunables (Appendix S.3) ────────────────────────────────────────────────

DEFAULT_MODEL = 'openai/gpt-4.1-mini'
TIMEOUT_SEC = 15.0
TEMPERATURE = 0.4
MAX_TOKENS = 2400
MAX_VISION_PRODUCTS = 20
MAX_EMOTIONAL_PRODUCTS = 15
SCHEMA_VERSION = 1


# Variant keys emitted by the LLM (Appendix S.1 — 3 distinct variants).
VARIANT_KEYS: tuple[str, ...] = ('most_common', 'edgy', 'safe')

# 5 mappable slots — pass through `match_slot_to_builtin` (some may resolve
# to a built-in id, others remain raw). `style_dna` has no built-in pool so
# the matcher always returns it raw — but we run it through anyway for
# uniform truncation + symmetry with the Top-Card builder.
MAPPABLE_SLOTS: tuple[str, ...] = (
    'spatial_configuration',
    'typography_adjectives',
    'font_combination',
    'accessories',
    'style_dna',
)

# All 7 slots in the rendered preset (Appendix S.1).
ALL_SLOTS: tuple[str, ...] = (
    'spatial_configuration',
    'visual_description',
    'typography_adjectives',
    'font_combination',
    'accessories',
    'style_dna',
    'extra_context',
)


# ─── Appendix S.1 — System prompt (VERBATIM, no paraphrasing per 13t-d.1) ──

SYSTEM_PROMPT = """You are a Print-on-Demand niche-research synthesizer producing three "Best-of-Mix"
prompt configurations for the Architect Prompt Builder. You receive a structured
aggregate of vision + emotional + niche-level analyses for an entire Amazon T-shirt
niche. Your job is to distill three distinct synthetic preset configurations from
the corpus — NOT to copy any single product.

# The 3 variants you produce

1. **most_common** — captures the dominant visual + emotional patterns present in the
   majority of bestsellers. Goal: maximum recognizability, lowest risk.
2. **edgy** — pushes the niche tonality + composition toward riskier, punchier choices
   that some bestsellers exhibit but most don't. Goal: stand out, willing to polarize.
3. **safe** — broadly appealing, neutral tone, conservative composition that would
   sell across the widest demographic in the niche. Goal: maximum mass-market appeal.

# Each variant produces exactly these 7 slot values (NO MORE, NO LESS)

For each variant return a JSON object containing all 7 slots:

1. `spatial_configuration` — one of the 43 spatial layout IDs, OR a free-text
   description ≤200 chars. IDs are listed in the user message below. Pick an ID when
   one fits cleanly; use raw text only when nothing fits.
2. `visual_description` — a free-form 60-120 word description of the dominant
   illustration subject. MUST contain ≥6 concrete details (perspective, color-object
   binding, line weight, pose, body parts, accessories). Start with "a [adjective]
   [SUBJECT] in [PERSPECTIVE], featuring ...". Use color-object binding ("golden yellow
   bus body") not bare colors. NEVER use the words "T-shirt", "mockup", "model wearing",
   "gradient", "glow", "soft shadow".
3. `typography_adjectives` — descriptors of the dominant typography choice for this
   variant. Free-text ≤120 chars (e.g. "bold compressed stencil with hand-cut edges").
4. `font_combination` — describes the pairing of fonts used in this variant. Free-text
   ≤120 chars (e.g. "athletic varsity serif headline + sans-serif tagline").
5. `accessories` — one of the 6 fixed accessory variants verbatim, OR null. List in
   user message below.
6. `style_dna` — a per-variant aesthetic descriptor that captures the overall design
   philosophy. Free-text ≤200 chars (e.g. "1970s underground comic with halftone
   prints and bold linework").
7. `extra_context` — optional verbatim tail describing any final compositional or
   tonal nuance specific to this variant. Free-text ≤200 chars OR empty string.

# Forbidden patterns

- NEVER use the word "T-shirt" anywhere in any output.
- NEVER mention "on a black shirt", "model wearing", "fabric texture", or any phrase
  describing the wearer.
- NEVER produce a `visual_description` containing gradients, glowing effects, soft
  shadows, or drop shadows.
- NEVER paraphrase the 6 fixed accessory variants — return them verbatim or use null.
- NEVER invent spatial IDs — use only ones from the explicit enum in the user message
  OR free-text.
- NEVER make all 3 variants the same — each MUST be meaningfully distinct.

# Output format

Return ONLY a valid JSON object with this exact shape. No preamble, no markdown.

{
  "most_common": {
    "spatial_configuration": "<id or raw text>",
    "visual_description": "<60-120 words>",
    "typography_adjectives": "<≤120 chars>",
    "font_combination": "<≤120 chars>",
    "accessories": "<verbatim variant or null>",
    "style_dna": "<≤200 chars>",
    "extra_context": "<≤200 chars or empty>"
  },
  "edgy": { ... same shape ... },
  "safe": { ... same shape ... }
}"""


# ─── User message scaffolding (Appendix S.2) ───────────────────────────────

_ALLOWED_SPATIAL_IDS_BLOCK = (
    "vertical_stack, horizontal_row, badge_emblem, banner_top,\n"
    "headline_top_subtitle_bottom, text_overlay, stacked_word_block, knockout_text,\n"
    "big_word_tiny_tag, word_as_shape, diagonal_text, pyramid_stack, rectangular_frame,\n"
    "crest_coat_of_arms, postage_stamp, hexagon_medallion, road_sign, definition_entry,\n"
    "knolling_grid, anatomy_diagram, checklist, periodic_tile, recipe_card,\n"
    "vintage_postcard, sports_jersey, movie_poster, license_plate, concert_ticket,\n"
    "map_coordinates, off_center_text_wrap, diagonal_split, triptych_three_panel,\n"
    "concentric_circular_text, speech_bubble, quote_marks_frame, sunburst_layout,\n"
    "flush_aligned_block, full_canvas_word_block, vertical_pillar_text,\n"
    "illustration_only_no_text, unconventional_integration, crossed_tools_intersection,\n"
    "subject_portrait_with_caption"
)

_ALLOWED_ACCESSORIES_BLOCK = (
    '- "white radiating motion-burst lines around the illustration"\n'
    '- "a sparse scattering of small filled stars and tiny dots framing the design"\n'
    '- "a thin geometric border frame enclosing the entire composition"\n'
    '- "a curved banner ribbon underneath the illustration with secondary text on it"\n'
    '- "sunburst rays radiating outward from behind the illustration"\n'
    '- "halftone-dot accents in the negative space around the illustration"'
)


# ─── Public helpers ────────────────────────────────────────────────────────


def _load_research_context(niche) -> tuple[Any | None, dict[str, Any]]:
    """Return (latest_NicheResearch, context_dict) for the niche.

    The context dict contains:
        niche_analysis     — single NicheAnalysis row or None
        vision_rows        — list[NicheProductVisionAnalysis] (capped, brand
                             unblocked, includes `.product`)
        emotional_rows     — list[NicheProductEmotionalAnalysis] (capped)
        top3_product_ids   — list[str] of the top-3 ranked product UUIDs
    """
    # Local imports to avoid load-time cycles.
    from design_app.services.preset_ranker import rank_top_products
    from niche_research_app.models import (
        NicheAnalysis,
        NicheProductEmotionalAnalysis,
        NicheProductVisionAnalysis,
        NicheResearch,
        NicheResearchProduct,
    )

    latest_research = (
        NicheResearch.objects
        .filter(niche=niche, status=NicheResearch.Status.COMPLETED)
        .order_by('-created_at')
        .first()
    )
    if latest_research is None:
        return None, {}

    niche_analysis = (
        NicheAnalysis.objects
        .filter(research=latest_research)
        .order_by('-created_at')
        .first()
    )

    vision_qs = (
        NicheProductVisionAnalysis.objects
        .filter(research=latest_research)
        .select_related('product')
        .order_by('created_at')[: MAX_VISION_PRODUCTS * 2]
    )
    product_ids = [v.product_id for v in vision_qs]
    blocked_ids = set(
        NicheResearchProduct.objects
        .filter(
            research=latest_research,
            product_id__in=product_ids,
            brand_blocked=True,
        )
        .values_list('product_id', flat=True),
    )
    vision_rows: list[Any] = []
    for v in vision_qs:
        if v.product_id in blocked_ids:
            continue
        vision_rows.append(v)
        if len(vision_rows) >= MAX_VISION_PRODUCTS:
            break

    emotional_qs = (
        NicheProductEmotionalAnalysis.objects
        .filter(research=latest_research)
        .select_related('product')
        .order_by('created_at')[: MAX_EMOTIONAL_PRODUCTS]
    )
    emotional_rows: list[Any] = list(emotional_qs)

    top_visions = rank_top_products(niche, limit=3)
    top3_product_ids = [str(v.product_id) for v in top_visions]

    return latest_research, {
        'niche_analysis': niche_analysis,
        'vision_rows': vision_rows,
        'emotional_rows': emotional_rows,
        'top3_product_ids': top3_product_ids,
    }


def _build_user_message(niche, context: dict[str, Any]) -> str:
    """Render the Appendix S.2 user message template."""
    vision_rows = context.get('vision_rows', []) or []
    emotional_rows = context.get('emotional_rows', []) or []
    niche_analysis = context.get('niche_analysis')
    top3_product_ids = context.get('top3_product_ids', []) or []

    # Index emotional rows by product_id so we can attach them per vision block.
    emotional_by_product: dict[Any, Any] = {
        e.product_id: e for e in emotional_rows
    }

    # Niche-level aggregate block (graceful empties when None).
    if niche_analysis is not None:
        niche_block = (
            f'NICHE_SUMMARY: {niche_analysis.niche_summary or ""}\n'
            f'SENTIMENT: {niche_analysis.sentiment or ""}\n'
            f'PRIMARY_EMOTIONS: {niche_analysis.primary_emotions or []}\n'
            f'EMOTIONAL_ARCHETYPE: {niche_analysis.emotional_archetype or []}\n'
            f'DOMINANT_DESIGN_AESTHETICS: {niche_analysis.dominant_design_aesthetics or ""}\n'
            f'DESIGN_CONCEPTS: {niche_analysis.design_concepts or ""}\n'
            f'PATTERN_ANALYSIS: {niche_analysis.pattern_analysis or []}\n'
            f'EMOTIONAL_REALITY: {niche_analysis.emotional_reality or ""}'
        )
    else:
        niche_block = (
            'NICHE_SUMMARY: \n'
            'SENTIMENT: \n'
            'PRIMARY_EMOTIONS: []\n'
            'EMOTIONAL_ARCHETYPE: []\n'
            'DOMINANT_DESIGN_AESTHETICS: \n'
            'DESIGN_CONCEPTS: \n'
            'PATTERN_ANALYSIS: []\n'
            'EMOTIONAL_REALITY: '
        )

    # Per-product vision + emotional blocks.
    product_blocks: list[str] = []
    for vision in vision_rows:
        title = getattr(vision.product, 'title', '') or ''
        emotional = emotional_by_product.get(vision.product_id)
        block_lines = [
            '---',
            f'TITLE: {title}',
            f'SLOGAN: {vision.slogan_text or ""}',
            f'MEANING: {vision.meaning_context or ""}',
            f'VISUAL_STYLE: {vision.visual_style or ""}',
            f'GRAPHIC_ELEMENTS: {vision.graphic_elements or ""}',
            f'LAYOUT_COMPOSITION: {vision.layout_composition or ""}',
        ]
        if emotional is not None:
            block_lines.extend([
                f'EMOTIONAL.TONE: {emotional.tone or ""}',
                f'EMOTIONAL.PATTERN: {emotional.emotional_pattern or ""}',
                f'EMOTIONAL.VIBE: {emotional.vibe or {}}',
                f'EMOTIONAL.KEY_ELEMENTS: {emotional.key_elements or []}',
                f'EMOTIONAL.ADAPTATION_FORMULA: {emotional.adaptation_formula or ""}',
            ])
        block_lines.append('---')
        product_blocks.append('\n'.join(block_lines))

    products_body = (
        '\n'.join(product_blocks) if product_blocks else '(no products analyzed)'
    )

    return (
        f'NICHE: {niche.name}\n'
        f'TOTAL ANALYZED PRODUCTS: {len(vision_rows)}\n'
        f'TOP-RANKED PRODUCTS USED FOR THUMBNAIL: {top3_product_ids}\n\n'
        f'ALLOWED SPATIAL IDS (use one or null/free-text):\n'
        f'{_ALLOWED_SPATIAL_IDS_BLOCK}\n\n'
        f'ALLOWED ACCESSORIES (use one verbatim or null):\n'
        f'{_ALLOWED_ACCESSORIES_BLOCK}\n\n'
        f'=== NICHE-LEVEL AGGREGATE ===\n'
        f'{niche_block}\n\n'
        f'=== PER-PRODUCT VISION + EMOTIONAL BLOCKS ===\n'
        f'(One block per analyzed product, separated by ---)\n\n'
        f'{products_body}'
    )


def _is_cache_fresh(niche, latest_research) -> bool:
    """Return True when the stored cache matches the latest research run.

    Mirrors `builder_hints._is_cache_fresh`: matching `_source_research_id`
    AND a parseable `_generated_at` that is ≥ the research's
    `updated_at` / `completed_at`.
    """
    cache = niche.best_of_mix_cache
    if not isinstance(cache, dict) or not cache:
        return False
    gen_at = cache.get('_generated_at')
    if not gen_at:
        return False
    try:
        parsed = _dt.datetime.fromisoformat(gen_at.replace('Z', '+00:00'))
    except (TypeError, ValueError, AttributeError):
        return False
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=_dt.timezone.utc)
    if str(cache.get('_source_research_id') or '') != str(latest_research.id):
        return False
    research_updated = getattr(latest_research, 'updated_at', None)
    if research_updated is None:
        research_updated = getattr(latest_research, 'completed_at', None)
    if research_updated is None:
        return True
    if research_updated.tzinfo is None:
        research_updated = research_updated.replace(tzinfo=_dt.timezone.utc)
    return parsed >= research_updated


def _validate_and_clean(raw: Any) -> dict[str, Any] | None:
    """Verify shape per Appendix S.1. Returns cleaned dict or None.

    Rejects (returns None) when:
    - top-level is not a dict
    - any of the 3 VARIANT_KEYS is missing
    - any variant is not a dict
    - any of the 7 ALL_SLOTS is missing for any variant
    - any slot value is neither str nor None

    Per-variant normalization: None → empty string, strings stripped.
    """
    if not isinstance(raw, dict):
        return None

    cleaned: dict[str, dict[str, str]] = {}
    for variant in VARIANT_KEYS:
        if variant not in raw:
            logger.warning(
                'best_of_mix_generator: missing variant %r in LLM output',
                variant,
            )
            return None
        block = raw[variant]
        if not isinstance(block, dict):
            logger.warning(
                'best_of_mix_generator: variant %r is not a dict', variant,
            )
            return None
        variant_clean: dict[str, str] = {}
        for slot in ALL_SLOTS:
            if slot not in block:
                logger.warning(
                    'best_of_mix_generator: missing slot %r in variant %r',
                    slot, variant,
                )
                return None
            value = block[slot]
            if value is None:
                variant_clean[slot] = ''
            elif isinstance(value, str):
                variant_clean[slot] = value.strip()
            else:
                logger.warning(
                    'best_of_mix_generator: slot %r in variant %r is %s, expected str/None',
                    slot, variant, type(value).__name__,
                )
                return None
        cleaned[variant] = variant_clean

    return cleaned


def _resolve_built_in_matches(cleaned: dict[str, dict[str, str]]) -> dict[str, dict[str, Any]]:
    """Run each variant's 5 mappable slots through `match_slot_to_builtin`.

    Returns a dict keyed by variant whose values are flat dicts shaped to
    match `NicheCardPreset` model fields: `slot_<name>` + `<short>_is_raw`.
    `visual_description` + `extra_context` have no built-in pool — they are
    structurally always raw + truncated.
    """
    from design_app.services.preset_matcher import match_slot_to_builtin

    resolved: dict[str, dict[str, Any]] = {}
    for variant, slots in cleaned.items():
        spatial_value, spatial_is_raw = match_slot_to_builtin(
            'spatial_configuration', slots['spatial_configuration'],
        )
        typo_value, typo_is_raw = match_slot_to_builtin(
            'typography_adjectives', slots['typography_adjectives'],
        )
        font_value, font_is_raw = match_slot_to_builtin(
            'font_combination', slots['font_combination'],
        )
        acc_value, acc_is_raw = match_slot_to_builtin(
            'accessories', slots['accessories'],
        )
        style_value, _style_is_raw = match_slot_to_builtin(
            'style_dna', slots['style_dna'],
        )

        resolved[variant] = {
            'slot_spatial_configuration': spatial_value or '',
            'slot_visual_description': (slots['visual_description'] or '').strip(),
            'slot_typography_adjectives': typo_value or '',
            'slot_font_combination': font_value or '',
            'slot_accessories': acc_value or '',
            'slot_style_dna': style_value or '',
            'slot_extra_context': (slots['extra_context'] or '').strip(),
            'spatial_is_raw': spatial_is_raw,
            'visual_is_raw': True,
            'typography_is_raw': typo_is_raw,
            'font_is_raw': font_is_raw,
            'accessories_is_raw': acc_is_raw,
            'style_dna_is_raw': True,
            'extra_context_is_raw': True,
        }
    return resolved


def _call_openrouter(
    niche_name: str,
    user_message: str,
    *,
    workspace_id: str | None,
    niche_id: str,
) -> dict[str, Any] | None:
    """Send the Appendix-S call. Returns the parsed JSON dict or None.

    Failures return None (caller leaves cache untouched). Wraps in a Langfuse
    trace + generation when keys are configured (best-effort).
    """
    api_key = getattr(settings, 'OPENROUTER_API_KEY', '')
    base_url = getattr(settings, 'OPENROUTER_BASE_URL', '')
    if not api_key or not base_url:
        logger.warning(
            'best_of_mix_generator: OPENROUTER not configured — skipping',
        )
        return None

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://merchminer.com',
        'X-Title': 'Merch Miner Best-of-Mix Generator',
    }
    payload = {
        'model': DEFAULT_MODEL,
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': user_message},
        ],
        'temperature': TEMPERATURE,
        'max_tokens': MAX_TOKENS,
        'response_format': {'type': 'json_object'},
    }

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
                name='niche-best-of-mix',
                metadata={
                    'workspace_id': str(workspace_id) if workspace_id else None,
                    'niche_id': str(niche_id),
                    'niche_name': niche_name,
                },
                tags=['design_app', 'best_of_mix', 'proj-34'],
            )
            generation = trace.generation(
                name='generate_best_of_mix',
                model=DEFAULT_MODEL,
                input=payload['messages'],
                model_parameters={
                    'temperature': TEMPERATURE,
                    'max_tokens': MAX_TOKENS,
                },
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
    except Exception as exc:  # noqa: BLE001 — must never raise.
        last_error = f'{type(exc).__name__}: {exc}'

    if last_error:
        logger.error(
            'best_of_mix_generator: %s (niche=%s)', last_error, niche_id,
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


def generate_best_of_mix(
    niche_id: str | _uuid.UUID,
    *,
    force: bool = False,
) -> dict | None:
    """Generate or refresh `Niche.best_of_mix_cache` for one niche.

    Returns the stored cache dict on success, ``None`` on:
    - niche not found
    - no completed research run
    - OpenRouter unreachable / timeout / 5xx
    - JSON parse / validation failure
    - cache hit + `force=False` returns the cached dict (NOT None)

    NEVER raises — callers can run unwrapped.
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
            'best_of_mix_generator: niche %s not found', niche_id,
        )
        return None

    latest_research, context = _load_research_context(niche)
    if latest_research is None:
        logger.info(
            'best_of_mix_generator: niche %s has no completed research',
            niche_id,
        )
        return None

    if not force and _is_cache_fresh(niche, latest_research):
        logger.info(
            'best_of_mix_generator: niche %s cache fresh — skip LLM',
            niche_id,
        )
        return niche.best_of_mix_cache

    user_message = _build_user_message(niche, context)
    raw = _call_openrouter(
        niche_name=niche.name,
        user_message=user_message,
        workspace_id=str(niche.workspace_id),
        niche_id=str(niche.id),
    )
    if raw is None:
        return None

    cleaned = _validate_and_clean(raw)
    if cleaned is None:
        return None

    resolved = _resolve_built_in_matches(cleaned)

    cache_payload: dict[str, Any] = {
        **resolved,
        '_schema_version': SCHEMA_VERSION,
        '_generated_at': timezone.now().isoformat(),
        '_source_research_id': str(latest_research.id),
        'top3_product_ids': [str(pid) for pid in context.get('top3_product_ids', [])],
    }
    niche.best_of_mix_cache = cache_payload
    niche.save(update_fields=['best_of_mix_cache', 'updated_at'])
    logger.info(
        'best_of_mix_generator: stored cache for niche %s (research=%s)',
        niche_id, latest_research.id,
    )
    return cache_payload
