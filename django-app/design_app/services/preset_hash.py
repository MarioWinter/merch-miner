"""PROJ-34 Phase 13t — Preset Hash Normalization (Appendix T).

Deterministic SHA256 fingerprint over the 7 normalized slot values of a
NicheCardPreset. Used to de-duplicate "essentially identical" presets across
top-card + best-of-mix producers and across niches.

Properties (see Appendix T.2):
- Order-independent over the input dict (sorted JSON serialization).
- Unicode-stable (NFKD canonical decomposition + drop combining marks).
- Whitespace-stable (collapsed runs of whitespace).
- Case-stable on raw slots (visual_description / style_dna / extra_context).
- Case-sensitive on slug slots (spatial_configuration / typography_adjectives
  / font_combination / accessories) because the IDs themselves are canonical.
"""

from __future__ import annotations

import hashlib
import json
import logging
import unicodedata

logger = logging.getLogger(__name__)


SLOT_ORDER: list[str] = [
    "spatial_configuration",
    "visual_description",
    "typography_adjectives",
    "font_combination",
    "accessories",
    "style_dna",
    "extra_context",
]

# Slots that store either a built-in slug ID (already canonical) OR raw text.
# Built-in IDs are lowercase snake_case so we deliberately do NOT lowercase
# these — that would alias a slug typed in uppercase to its lowercase form
# (e.g. "VERTICAL_STACK") which we want to keep distinct from the canonical
# "vertical_stack" hash entry.
SLUG_SLOTS: frozenset[str] = frozenset(
    {
        "spatial_configuration",
        "typography_adjectives",
        "font_combination",
        "accessories",
    }
)


def compute_preset_hash(slots: dict[str, str]) -> str:
    """Return SHA256 hex of normalized + sorted-JSON serialization of 7 slots.

    Missing keys are treated as empty strings (defensive). Order of keys in
    the input dict does not affect the result.
    """
    normalized: dict[str, str] = {}
    for slot in SLOT_ORDER:
        raw = (slots.get(slot) or "").strip()
        nfkd = unicodedata.normalize("NFKD", raw)
        # Drop combining marks so "café" == "café" after decomposition
        no_marks = "".join(c for c in nfkd if not unicodedata.combining(c))
        collapsed = " ".join(no_marks.split())
        if slot in SLUG_SLOTS:
            normalized[slot] = collapsed
        else:
            normalized[slot] = collapsed.lower()

    canonical_json = json.dumps(normalized, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()
