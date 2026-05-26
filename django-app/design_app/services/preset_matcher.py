"""PROJ-34 Phase 13t — Jaccard Matching for Niche-Extracted Slot Values (Appendix U).

Maps free-text values extracted by an LLM (or any other producer) onto the
fixed built-in pool of a slot using a Jaccard token-overlap score. When the
best score meets the slot's threshold the canonical built-in id is returned;
otherwise the raw text is truncated to the slot's max length and returned as
an override.

Slots with no built-in pool (`style_dna`, `visual_description`,
`extra_context`) always return their (truncated, is_raw=True) tuple.
"""

from __future__ import annotations

import logging
import re

from design_app.services.style_library import (
    ACCESSORIES_OPTIONS,
    FONT_COMBINATION_OPTIONS,
    SPATIAL_OPTIONS,
    TYPOGRAPHY_OPTIONS,
)

logger = logging.getLogger(__name__)


# ─── Slot-level config (Appendix U.1 / U.2) ───────────────────────────────

SLOT_THRESHOLDS: dict[str, float] = {
    "spatial_configuration": 0.55,
    "typography_adjectives": 0.50,
    "font_combination": 0.55,
    "accessories": 0.65,
}

# PROJ-34 Phase 13t-r: SLOT_MAX_RAW_LEN removed. Enriched LLM outputs (3-6
# dimensions per descriptor) routinely exceed the old 100-200 char limits and
# were being cut mid-word in the UI. Slots now persist + display in full.
# Down-stream prompt budget: 7 slots × ~500 char avg ≈ 3500 chars ≈ 900 tokens
# in the final Generate prompt — well within budget.

STOPWORDS: frozenset[str] = frozenset(
    {
        "the",
        "a",
        "an",
        "with",
        "and",
        "of",
        "in",
        "on",
        "at",
        "to",
        "for",
        "from",
        "by",
        "design",
        "style",
    }
)


# ─── Slot → pool resolution ───────────────────────────────────────────────
# ACCESSORIES_OPTIONS is a list of plain strings (no `id` / `label` keys), so
# we wrap each entry as a {id, label, prompt_text} dict at module load time
# to give the matcher a uniform shape.
_ACCESSORIES_POOL: list[dict[str, str]] = [
    {"id": text, "label": text, "prompt_text": text} for text in ACCESSORIES_OPTIONS
]

_SLOT_POOLS: dict[str, list[dict[str, str]] | None] = {
    "spatial_configuration": SPATIAL_OPTIONS,
    "typography_adjectives": TYPOGRAPHY_OPTIONS,
    "font_combination": FONT_COMBINATION_OPTIONS,
    "accessories": _ACCESSORIES_POOL,
    "style_dna": None,
}


# ─── Public API ───────────────────────────────────────────────────────────


def match_slot_to_builtin(slot_key: str, raw_text: str) -> tuple[str | None, bool]:
    """Map free-text to a built-in slot id, else fall back to raw override.

    Returns:
        (matched_built_in_id, False) when best Jaccard score ≥ slot threshold.
        (truncated_raw_text, True)   when below threshold OR when the slot
                                     has no built-in pool.
    """
    raw_text = raw_text or ""

    pool = _SLOT_POOLS.get(slot_key, "__missing__")
    if pool is None or pool == "__missing__":
        # No pool to match against — style_dna, visual_description, extra_context,
        # or any unknown slot key. Always return raw.
        return (raw_text.strip(), True)

    raw_tokens = _tokenize(raw_text)
    threshold = SLOT_THRESHOLDS[slot_key]

    best_id: str | None = None
    best_score: float = 0.0
    for opt in pool:
        opt_text = f"{opt.get('label', '')} {opt.get('prompt_text', '')}"
        opt_tokens = _tokenize(opt_text)
        score = _jaccard(raw_tokens, opt_tokens)
        if score > best_score:
            best_id, best_score = opt["id"], score

    if best_id is not None and best_score >= threshold:
        return (best_id, False)

    return (raw_text.strip(), True)


# ─── Helpers ──────────────────────────────────────────────────────────────


def _tokenize(text: str) -> set[str]:
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    return {t for t in tokens if t not in STOPWORDS and len(t) >= 2}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 0.0
    union = len(a | b)
    if not union:
        return 0.0
    return len(a & b) / union
