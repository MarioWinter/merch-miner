"""PROJ-34 Phase 13t-p — Vision Backfill Service.

One-shot LLM extraction that upgrades existing `NicheProductVisionAnalysis`
rows by converting their already-stored `graphic_elements` prose into 3
distinct slogan-agnostic descriptors. Uses `openai/gpt-4.1-mini` via
OpenRouter (same model + httpx + Langfuse pattern as
`design_app/services/best_of_mix_generator.py`).

Idempotent: rows where all 3 new descriptor fields are non-empty are skipped
on subsequent runs (filtered by the QuerySet `Q` predicate).

Spec: features/PROJ-34-design-prompt-engineering.md AC-132..AC-137 + EC-50..EC-53.
Verbatim prompts: docs/tasks/PROJ-34-tasks.md Appendix Y.
"""

from __future__ import annotations

import json
import logging
import warnings
from dataclasses import dataclass
from typing import Any

import httpx
from django.conf import settings
from django.db.models import Q, QuerySet
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ─── Constants (Appendix Y.3) ──────────────────────────────────────────────

BACKFILL_MODEL = 'openai/gpt-4.1-mini'
BACKFILL_TEMPERATURE = 0.2
BACKFILL_MAX_TOKENS = 400
BACKFILL_TIMEOUT_S = 15.0
BACKFILL_LANGFUSE_TAGS = ['phase=13t-p_backfill', 'niche_research', 'proj-34']
# gpt-4.1-mini pricing (May 2026): $0.00015/1K input, $0.0006/1K output.
BACKFILL_INPUT_COST_PER_1K = 0.00015
BACKFILL_OUTPUT_COST_PER_1K = 0.00060


# ─── Prompts (Appendix Y.1 + Y.2 verbatim) ─────────────────────────────────

BACKFILL_SYSTEM_PROMPT = """\
# VISION ANALYSIS BACKFILL — TYPOGRAPHY / FONT / ACCESSORY EXTRACTION

You are upgrading existing t-shirt design analyses. You receive ONE row's existing
free-form prose description (`graphic_elements`) plus its `slogan_text`, and must
extract THREE structured slogan-agnostic descriptors.

## Your Task

Read the `graphic_elements` prose. It blends typography, font, decorative, and motif
information into one paragraph. Extract three separate slogan-agnostic descriptors:

1. **typography_descriptors:** how the text is treated visually (weight, casing,
   style, color emphasis) — using placeholders for the text itself.
2. **font_combination_descriptors:** what fonts are paired and how they relate.
3. **accessory_descriptors:** decorative non-text elements (stars, lines, borders,
   distressing, ornaments) and motif details that are NOT the main subject.

## Dimensions to Address Per Field

For typography_descriptors cover ≥3 of these dimensions:
- Weight (light/regular/medium/bold/extra-bold/black)
- Casing (all-uppercase / all-lowercase / title-case / mixed)
- Classification (serif/sans-serif/slab-serif/script/display/mono/handwritten)
- Color treatment (which colors, headline vs secondary differentiation)
- Special effects (outline/shadow/glow/distress/3D/gradient/chrome)
- Size hierarchy across primary/secondary/accent text

For font_combination_descriptors cover:
- Count of distinct fonts (1/2/3+)
- Per font: classification + role (primary headline / secondary text / accent)
- Pairing strategy (contrast vs harmony)

For accessory_descriptors cover:
- Count + name of each element (stars/lines/borders/distressing/ornaments/dot-patterns)
- Position relative to main motif (above/below/around/behind)
- Style (filled/outlined/distressed/minimal/ornate)

## Output Format

Return ONLY valid JSON matching this shape:

```json
{
  "typography_descriptors": "...",
  "font_combination_descriptors": "...",
  "accessory_descriptors": "..."
}
```

No markdown fences, no commentary, no preamble — just the JSON object.

=== SLOGAN-AGNOSTIC RULE (mandatory) ===

- Describe the VISUAL TREATMENT, not the specific words.
- Use placeholders: "primary headline", "secondary text", "accent words", "tagline".
- NEVER quote or reference the actual slogan text in any of the three fields.
- If the source prose quotes the slogan (e.g. "bold for 'SCHOOL BUS'"), rewrite it
  using placeholders (e.g. "bold for the primary headline").

GOOD typography_descriptors:
  "extra-bold uppercase slab-serif for the primary headline in bright yellow with
   subtle inner-glow; regular-weight condensed sans-serif in white for secondary
   text; cursive italic script for accent words; clear 3-tier size hierarchy with
   the headline roughly 3x the tagline size"

BAD (DO NOT DO THIS — contains literal slogan):
  "bold block letters for 'SCHOOL BUS'; cursive for 'Driver' and 'Just Like'"

GOOD font_combination_descriptors:
  "three-font system: chunky slab-serif for maximum impact on the primary headline;
   clean geometric sans-serif as a neutral counter-weight for secondary text;
   handwritten cursive script as the playful accent — high-contrast pairing
   strategy mixing rigid + organic"

BAD: "ROLLIN' in handwritten font, THEY in block"

GOOD accessory_descriptors:
  "five small filled white stars scattered above and below the central motif;
   two thin horizontal divider lines flanking the headline; light distressing
   applied to the headline text edges; subtle dot-pattern border framing the
   whole composition"

BAD: "stars and lines around 'SCHOOL BUS DRIVER'"

## If the source prose lacks information for a field

Return a brief generic descriptor based on what IS present (e.g. if no decorative
elements are mentioned, return `"no decorative accessories visible"`). NEVER invent
elements not in the source.
"""


BACKFILL_USER_TEMPLATE = """\
SOURCE ROW DATA:

slogan_text:
{slogan_text}

graphic_elements (free-form prose to extract from):
{graphic_elements}

Now extract the three slogan-agnostic descriptors and return them as JSON.
"""


# ─── Pydantic output schema ────────────────────────────────────────────────


class BackfillOutputSchema(BaseModel):
    """Parsed LLM JSON response."""

    typography_descriptors: str = Field(default='')
    font_combination_descriptors: str = Field(default='')
    accessory_descriptors: str = Field(default='')


# ─── Summary dataclass ─────────────────────────────────────────────────────


@dataclass
class Summary:
    """Result of a backfill run."""

    processed: int = 0
    skipped: int = 0
    errored: int = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0

    @property
    def estimated_cost_usd(self) -> float:
        return (
            self.total_input_tokens / 1000.0 * BACKFILL_INPUT_COST_PER_1K
            + self.total_output_tokens / 1000.0 * BACKFILL_OUTPUT_COST_PER_1K
        )

    def as_dict(self) -> dict[str, Any]:
        return {
            'processed': self.processed,
            'skipped': self.skipped,
            'errored': self.errored,
            'total_input_tokens': self.total_input_tokens,
            'total_output_tokens': self.total_output_tokens,
            'estimated_cost_usd': round(self.estimated_cost_usd, 6),
        }


# ─── Public entry point ────────────────────────────────────────────────────


def _warn_if_custom_prompt_active() -> None:
    """Emit a warning per EC-52 if the DB Vision prompt is operator-customized."""
    from niche_research_app.models import ResearchNodeConfig

    try:
        row = ResearchNodeConfig.objects.get(node_name='vision_analyze')
    except ResearchNodeConfig.DoesNotExist:
        return

    if 'SLOGAN-AGNOSTIC RULE' not in row.system_prompt:
        warnings.warn(
            'vision_analyze prompt in DB does not contain the SLOGAN-AGNOSTIC '
            'RULE block. Future Vision runs will NOT populate the 3 new fields. '
            'Edit the prompt in Django Admin '
            '(/admin/niche_research_app/researchnodeconfig/) and paste the rule '
            'block from features/PROJ-34-design-prompt-engineering.md Appendix X.',
            stacklevel=2,
        )


def backfill_vision_descriptors(
    rows: QuerySet | None = None,
    dry_run: bool = False,
    limit: int | None = None,
    force: bool = False,
) -> Summary:
    """Iterate eligible rows, call LLM per row, persist 3 new fields.

    Eligible = (`typography_descriptors='' OR font_combination_descriptors=''
    OR accessory_descriptors=''`) AND `graphic_elements != ''`.

    Idempotent: a row whose 3 new fields are already populated is excluded by
    the filter and never reaches the LLM call.

    When `dry_run=True`, logs the would-be result but does NOT save.
    `limit` (if set) caps the number of eligible rows processed.
    When `force=True`, bypasses the empty-field eligibility filter — all rows
    with non-empty `graphic_elements` are reprocessed (overwrites existing
    descriptors). Use after enriching the LLM prompt to refresh stale outputs.
    """
    from niche_research_app.models import NicheProductVisionAnalysis

    _warn_if_custom_prompt_active()

    base_qs = rows if rows is not None else NicheProductVisionAnalysis.objects.all()
    if force:
        eligible = base_qs.exclude(graphic_elements='').order_by('created_at')
    else:
        eligible = base_qs.filter(
            Q(typography_descriptors='')
            | Q(font_combination_descriptors='')
            | Q(accessory_descriptors=''),
        ).exclude(graphic_elements='').order_by('created_at')

    if limit is not None:
        eligible = eligible[:limit]

    total = eligible.count()
    logger.info('backfill_vision_descriptors: %d eligible rows (dry_run=%s)',
                total, dry_run)

    summary = Summary()
    for idx, row in enumerate(eligible.iterator(chunk_size=20), start=1):
        result, usage = _call_llm_one(
            slogan_text=row.slogan_text or '',
            graphic_elements=row.graphic_elements or '',
            row_id=str(row.id),
        )
        if result is None:
            summary.errored += 1
            continue

        summary.total_input_tokens += usage.get('input', 0) or 0
        summary.total_output_tokens += usage.get('output', 0) or 0

        if dry_run:
            logger.info(
                '[dry-run] row=%s typography=%r font=%r accessory=%r',
                row.id,
                result.typography_descriptors[:80],
                result.font_combination_descriptors[:80],
                result.accessory_descriptors[:80],
            )
        else:
            row.typography_descriptors = result.typography_descriptors
            row.font_combination_descriptors = result.font_combination_descriptors
            row.accessory_descriptors = result.accessory_descriptors
            row.save(update_fields=[
                'typography_descriptors',
                'font_combination_descriptors',
                'accessory_descriptors',
            ])
        summary.processed += 1

        if idx % 10 == 0:
            logger.info('backfill progress: %d/%d', idx, total)

    logger.info(
        'backfill_vision_descriptors done: %s', summary.as_dict(),
    )
    return summary


# ─── LLM call (one row) ────────────────────────────────────────────────────


def _call_llm_one(
    slogan_text: str,
    graphic_elements: str,
    row_id: str,
) -> tuple[BackfillOutputSchema | None, dict[str, Any]]:
    """Single OpenRouter call; returns (parsed_or_None, usage_dict)."""
    api_key = getattr(settings, 'OPENROUTER_API_KEY', '')
    base_url = getattr(settings, 'OPENROUTER_BASE_URL', '')
    if not api_key or not base_url:
        logger.warning(
            'vision_backfill: OPENROUTER not configured — skipping row=%s',
            row_id,
        )
        return None, {}

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://merchminer.com',
        'X-Title': 'Merch Miner Vision Backfill',
    }
    user_message = BACKFILL_USER_TEMPLATE.format(
        slogan_text=slogan_text,
        graphic_elements=graphic_elements,
    )
    payload = {
        'model': BACKFILL_MODEL,
        'messages': [
            {'role': 'system', 'content': BACKFILL_SYSTEM_PROMPT},
            {'role': 'user', 'content': user_message},
        ],
        'temperature': BACKFILL_TEMPERATURE,
        'max_tokens': BACKFILL_MAX_TOKENS,
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
                name='vision-backfill',
                metadata={'row_id': row_id},
                tags=BACKFILL_LANGFUSE_TAGS,
            )
            generation = trace.generation(
                name='backfill_descriptors',
                model=BACKFILL_MODEL,
                input=payload['messages'],
                model_parameters={
                    'temperature': BACKFILL_TEMPERATURE,
                    'max_tokens': BACKFILL_MAX_TOKENS,
                },
            )
        except Exception:
            langfuse_client = None
            trace = None
            generation = None

    parsed: BackfillOutputSchema | None = None
    usage_dict: dict[str, Any] = {}
    last_error: str | None = None
    try:
        with httpx.Client(timeout=BACKFILL_TIMEOUT_S) as client:
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
        if content:
            parsed = BackfillOutputSchema(**json.loads(content))
        usage = data.get('usage', {}) or {}
        usage_dict = {
            'input': usage.get('prompt_tokens'),
            'output': usage.get('completion_tokens'),
            'total': usage.get('total_tokens'),
        }
        if generation:
            try:
                generation.end(output=content[:1000], usage=usage_dict)
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
            'vision_backfill: %s (row=%s)', last_error, row_id,
        )
        if generation:
            try:
                generation.end(level='ERROR', status_message=last_error)
            except Exception:
                pass
        parsed = None

    if langfuse_client:
        try:
            langfuse_client.flush()
        except Exception:
            pass

    return parsed, usage_dict
