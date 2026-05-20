"""PROJ-34 Phase 13t-b — preset_hash unit tests (Appendix T.4).

Covers all 8 test vectors from the Appendix T.4 table:
- Empty slots produce stable hash A1.
- Populated slots produce stable hash A2 ≠ A1.
- Dict key order does not affect the hash.
- Unicode normalization equivalence (é vs combining é).
- Lowercase of raw slot does not change the hash.
- Case change on slug slot DOES change the hash.
- Whitespace differences do not change the hash.
- One-char diff produces a different hash.

No Django setup required — pure stdlib function under test.
"""

from __future__ import annotations

import pytest

from design_app.services.preset_hash import compute_preset_hash


# ─── Fixtures ─────────────────────────────────────────────────────────────


@pytest.fixture
def empty_slots() -> dict[str, str]:
    return {
        "spatial_configuration": "",
        "visual_description": "",
        "typography_adjectives": "",
        "font_combination": "",
        "accessories": "",
        "style_dna": "",
        "extra_context": "",
    }


@pytest.fixture
def populated_slots() -> dict[str, str]:
    return {
        "spatial_configuration": "vertical_stack",
        "visual_description": "a wild horse galloping across a desert",
        "typography_adjectives": "stencil_military_uniform",
        "font_combination": "serif_plus_sans_hierarchy",
        "accessories": "halftone-dot accents in the negative space around the illustration",
        "style_dna": "BOLD vintage western lithograph",
        "extra_context": "for a rodeo niche shirt",
    }


# ─── Tests ────────────────────────────────────────────────────────────────


def test_empty_slots_stable_hash(empty_slots):
    """Calling twice with the same empty dict must yield identical hash."""
    h1 = compute_preset_hash(empty_slots)
    h2 = compute_preset_hash(empty_slots)
    assert h1 == h2
    assert isinstance(h1, str) and len(h1) == 64  # SHA256 hex length


def test_populated_stable_hash(empty_slots, populated_slots):
    """Populated hash is deterministic and distinct from empty hash."""
    a1 = compute_preset_hash(empty_slots)
    a2 = compute_preset_hash(populated_slots)
    assert a2 == compute_preset_hash(populated_slots)
    assert a2 != a1


def test_dict_key_order_independent(populated_slots):
    """Reversing the dict key order produces the same hash (sorted JSON)."""
    a2 = compute_preset_hash(populated_slots)
    reversed_slots = dict(reversed(list(populated_slots.items())))
    assert compute_preset_hash(reversed_slots) == a2


def test_unicode_normalization(populated_slots):
    """A composed accented character and its decomposed form hash identically."""
    a2 = compute_preset_hash(populated_slots)
    # Replace plain "a" in visual_description with a combining-accent form
    # of the word "café" inside the existing sentence — the NFKD step + drop
    # of combining marks must canonicalize both forms.
    composed = dict(populated_slots)
    composed["visual_description"] = "a wild café horse galloping across a desert"
    decomposed = dict(populated_slots)
    decomposed["visual_description"] = "a wild café horse galloping across a desert"
    h_composed = compute_preset_hash(composed)
    h_decomposed = compute_preset_hash(decomposed)
    assert h_composed == h_decomposed
    # And — because we strip combining marks — both equal the plain ASCII form
    plain = dict(populated_slots)
    plain["visual_description"] = "a wild cafe horse galloping across a desert"
    assert compute_preset_hash(plain) == h_composed
    # Sanity: this should differ from the unmodified populated hash
    assert h_composed != a2


def test_lowercase_raw_slot(populated_slots):
    """Changing case in a raw (non-slug) slot does not change the hash."""
    a2 = compute_preset_hash(populated_slots)
    lowered = dict(populated_slots)
    lowered["style_dna"] = "bold vintage western lithograph"
    assert compute_preset_hash(lowered) == a2


def test_case_sensitive_slug_slot(populated_slots):
    """Changing case in a slug slot DOES change the hash (slugs are canonical)."""
    a2 = compute_preset_hash(populated_slots)
    altered = dict(populated_slots)
    altered["spatial_configuration"] = "VERTICAL_STACK"
    assert compute_preset_hash(altered) != a2


def test_whitespace_stable(populated_slots):
    """Extra whitespace (leading / trailing / interior runs) doesn't change hash."""
    a2 = compute_preset_hash(populated_slots)
    whitespacey = dict(populated_slots)
    whitespacey["extra_context"] = "   for a   rodeo  niche\t\tshirt  "
    assert compute_preset_hash(whitespacey) == a2


def test_one_char_diff_changes_hash(populated_slots):
    """SHA256 avalanche: a single-char diff in any slot changes the hash."""
    a2 = compute_preset_hash(populated_slots)
    altered = dict(populated_slots)
    altered["visual_description"] = "a wild horse galloping across a deser"  # 1 char short
    assert compute_preset_hash(altered) != a2
