"""PROJ-34 Phase 13t — Top-Card Preset Builder from Single Vision Analysis.

Converts ONE `NicheProductVisionAnalysis` row into a 7-slot preset dict
shaped to match `NicheCardPreset` model fields. The 5 mappable slots flow
through `preset_matcher.match_slot_to_builtin` so they hit a built-in id
when the freeform vision text shares enough vocabulary with a canonical
option, otherwise fall back to truncated raw text.

`visual_description`, `style_dna`, and `extra_context` slots have no
built-in pool — they are structurally always `is_raw=True`.

Labels are 2–4 words derived from `slogan_text + dominant graphic word`.
The generator is deterministic + idempotent; same input → same output.
"""

from __future__ import annotations

import logging
import re

from design_app.services.preset_matcher import (
    SLOT_MAX_RAW_LEN,
    match_slot_to_builtin,
)

logger = logging.getLogger(__name__)


# Stopwords + filler removed when deriving a short label from graphic_elements.
# Kept small + opinionated — we only need to drop the most common articles /
# prepositions / generic design nouns.
_LABEL_STOPWORDS: frozenset[str] = frozenset(
    {
        "the", "a", "an", "and", "or", "with", "of", "on", "in", "at",
        "to", "for", "from", "by", "is", "it", "as", "this", "that",
        "design", "style", "art", "graphic", "illustration", "image",
        "shirt", "tee", "t-shirt", "t",
    }
)

_LABEL_MAX_CHARS = 200  # NicheCardPreset.preset_label is CharField(200)
_LABEL_FALLBACK = "Untitled Preset"


def build_top_card_preset(vision_row, niche) -> dict:
    """Build a 7-slot preset dict from a `NicheProductVisionAnalysis` row.

    Returns dict whose keys match `NicheCardPreset` fields 1-for-1 so the
    persistence layer (Phase 13t-f) can `**unpack` it into a model
    `.objects.create(...)` call after attaching workspace + preset_hash.
    """
    spatial_text = vision_row.layout_composition or ""
    spatial_value, spatial_is_raw = match_slot_to_builtin(
        "spatial_configuration", spatial_text,
    )

    # `visual_description` has no built-in pool → always raw + truncated.
    visual_source = " ".join(
        part for part in (
            vision_row.graphic_elements or "",
            vision_row.visual_style or "",
        ) if part
    ).strip()
    visual_value, visual_is_raw = match_slot_to_builtin(
        "visual_description", visual_source,
    )

    # Typography / font_combination / accessories all draw from
    # `graphic_elements` — the only field that mentions decorative + type
    # cues in NicheProductVisionAnalysis. The matcher's Jaccard score will
    # rarely clear the threshold on freeform vision paragraphs so these
    # mostly fall back to raw truncations, which is the desired behavior
    # (preserves user-visible signal vs collapsing to a single built-in).
    graphic_text = vision_row.graphic_elements or ""
    typography_value, typography_is_raw = match_slot_to_builtin(
        "typography_adjectives", graphic_text,
    )
    font_combination_value, font_combination_is_raw = match_slot_to_builtin(
        "font_combination", graphic_text,
    )
    accessories_value, accessories_is_raw = match_slot_to_builtin(
        "accessories", graphic_text,
    )

    style_dna_value, style_dna_is_raw = match_slot_to_builtin(
        "style_dna", vision_row.visual_style or "",
    )
    extra_context_value, extra_context_is_raw = match_slot_to_builtin(
        "extra_context", vision_row.meaning_context or "",
    )

    thumbnail_url = getattr(vision_row.product, "thumbnail_url", "") or ""
    preset_label = _generate_preset_label(vision_row)

    return {
        "slot_spatial_configuration": spatial_value or "",
        "slot_visual_description": visual_value or "",
        "slot_typography_adjectives": typography_value or "",
        "slot_font_combination": font_combination_value or "",
        "slot_accessories": accessories_value or "",
        "slot_style_dna": style_dna_value or "",
        "slot_extra_context": extra_context_value or "",
        "spatial_is_raw": spatial_is_raw,
        "visual_is_raw": visual_is_raw,
        "typography_is_raw": typography_is_raw,
        "font_combination_is_raw": font_combination_is_raw,
        "accessories_is_raw": accessories_is_raw,
        "style_dna_is_raw": style_dna_is_raw,
        "extra_context_is_raw": extra_context_is_raw,
        "reference_thumbnail_url": thumbnail_url[:500],
        "source_card_type": "top",
        "source_card_references": [
            {
                "niche_id": str(niche.id),
                "product_ids": [str(vision_row.product_id)],
            },
        ],
        "preset_label": preset_label,
    }


# ─── Label generator ──────────────────────────────────────────────────────


def _generate_preset_label(vision_row) -> str:
    """Build a deterministic 2-4 word label from `slogan_text` + key element.

    Strategy:
      1. Take the first 2 meaningful words of `slogan_text` (title-cased).
      2. Append the first ≥4-char non-stopword from `graphic_elements`.
      3. Fallback: first 3 meaningful words of `graphic_elements`.
      4. Final fallback: ``"Untitled Preset"``.

    Guarantees:
      - ≤ 200 chars (model field cap)
      - Pure function (no side effects)
      - Same input → same output
    """
    slogan = (vision_row.slogan_text or "").strip()
    graphic = (vision_row.graphic_elements or "").strip()

    slogan_words = _meaningful_words(slogan)[:2]
    graphic_words = _meaningful_words(graphic)

    parts: list[str] = []
    if slogan_words:
        parts.extend(_titlecase(w) for w in slogan_words)
        # Append the first graphic word that isn't already in `parts`.
        for word in graphic_words:
            if word.lower() not in {p.lower() for p in parts}:
                parts.append(_titlecase(word))
                break
    elif graphic_words:
        parts = [_titlecase(w) for w in graphic_words[:3]]

    label = " ".join(parts).strip()
    if not label:
        label = _LABEL_FALLBACK
    return label[:_LABEL_MAX_CHARS]


def _meaningful_words(text: str) -> list[str]:
    """Tokenize `text` and drop stopwords + short fragments (<4 chars)."""
    tokens = re.findall(r"[A-Za-z][A-Za-z'-]+", text)
    return [
        t for t in tokens
        if t.lower() not in _LABEL_STOPWORDS and len(t) >= 4
    ]


def _titlecase(word: str) -> str:
    """Capitalize first letter; preserve internal apostrophes/hyphens."""
    return word[:1].upper() + word[1:].lower() if word else word


# Re-exported so callers can sanity-check slot caps without importing matcher
__all__ = [
    "build_top_card_preset",
    "SLOT_MAX_RAW_LEN",
]
