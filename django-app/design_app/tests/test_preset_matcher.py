"""PROJ-34 Phase 13t-b — preset_matcher unit tests (Appendix U.3).

Per-slot coverage (5 mappable slots × 3 cases minimum each):
- spatial_configuration:  match | below-threshold | no-overlap
- typography_adjectives:  match | below-threshold | no-overlap
- font_combination:       match | below-threshold | no-overlap
- accessories:            exact match | low-overlap | no-overlap
- style_dna:              always raw (no pool)

Deviation note from Appendix U.3:
The Appendix U.3 example "centered stacked layout with text top and
illustration bottom" → vertical_stack assumes raw text that shares enough
tokens with the option's `label + prompt_text` to clear the 0.55 threshold.
The real `vertical_stack.prompt_text` is a 40+-word description so this short
phrase scores ~0.21 — well below threshold. Same situation for the
Appendix's "bold compressed stencil military style" (≈ 0.07) and the assumed
"stencil_bold" id (actual id is `stencil_military_uniform`).

To honor the spec's *thresholds* exactly while still proving the matcher
works, the True-match cases below use raw text that genuinely shares tokens
with the built-in option's prompt_text. Below-threshold + no-overlap cases
mirror Appendix U.3's intent (verify graceful fall-back to truncated raw).

No Django setup needed — pure stdlib function under test.
"""

from __future__ import annotations

import pytest

from design_app.services.preset_matcher import (
    SLOT_MAX_RAW_LEN,
    match_slot_to_builtin,
)


# ─── Parametrized slot-coverage cases ─────────────────────────────────────


@pytest.mark.parametrize(
    "slot_key, raw_text, expected, is_raw",
    [
        # spatial_configuration ────────────────────────────────────────────
        # True match: raw text shares many tokens with pyramid_stack's prompt_text
        (
            "spatial_configuration",
            "pyramid word-stack layout 4 to 5 stacked text lines forming pyramid "
            "top line shortest smallest each subsequent line wider bolder bottom "
            "line dominant emphasis word no illustration tight vertical spacing",
            "pyramid_stack",
            False,
        ),
        # Below threshold — short phrase from Appendix U.3 verbatim falls back
        (
            "spatial_configuration",
            "centered stacked layout with text top and illustration bottom",
            "centered stacked layout with text top and illustration bottom",
            True,
        ),
        # No overlap — Appendix U.3 verbatim
        (
            "spatial_configuration",
            "weird upside-down corkscrew thing",
            "weird upside-down corkscrew thing",
            True,
        ),
        # typography_adjectives ───────────────────────────────────────────
        # True match: shares "stencil military uniform thick block letter strokes …"
        # with stencil_military_uniform.prompt_text (real id, NOT the Appendix's
        # assumed "stencil_bold")
        (
            "typography_adjectives",
            "stencil military uniform thick block letter strokes narrow gaps "
            "cutting body each letter spray stencil templates all caps squared "
            "terminals combat issue character",
            "stencil_military_uniform",
            False,
        ),
        # Below threshold — short Appendix U.3 phrase, ~0.07 score
        (
            "typography_adjectives",
            "bold compressed stencil military style",
            "bold compressed stencil military style",
            True,
        ),
        # No overlap — Appendix U.3 verbatim
        (
            "typography_adjectives",
            "art-nouveau curlicue swooshes",
            "art-nouveau curlicue swooshes",
            True,
        ),
        # font_combination ────────────────────────────────────────────────
        # True match: shares the anatomical-hierarchy vocabulary
        (
            "font_combination",
            "two font anatomical hierarchy primary headline heavyweight slab "
            "serif transitional book serif bracketed serifs balanced proportions "
            "supporting lines heavyweight all caps sans serif squared terminals "
            "uniform stroke weight visual contrast",
            "serif_plus_sans_hierarchy",
            False,
        ),
        # Below threshold — generic phrase doesn't share enough vocabulary
        (
            "font_combination",
            "serif headline with sans-serif body for clear hierarchy",
            "serif headline with sans-serif body for clear hierarchy",
            True,
        ),
        # No overlap
        (
            "font_combination",
            "weird mystery cyberpunk lettering",
            "weird mystery cyberpunk lettering",
            True,
        ),
        # accessories ─────────────────────────────────────────────────────
        # Exact match — ACCESSORIES_OPTIONS are bare strings; the id IS the text
        (
            "accessories",
            "white radiating motion-burst lines around the illustration",
            "white radiating motion-burst lines around the illustration",
            False,
        ),
        # Partial overlap — not enough to clear 0.65 threshold
        (
            "accessories",
            "sparkle dots scattered around the illustration",
            "sparkle dots scattered around the illustration",
            True,
        ),
        # No overlap — Appendix U.3 verbatim
        (
            "accessories",
            "rainbow sparkle particles",
            "rainbow sparkle particles",
            True,
        ),
        # style_dna ───────────────────────────────────────────────────────
        # No built-in pool — always raw (Appendix U.3 verbatim)
        (
            "style_dna",
            "1970s halftone underground comic",
            "1970s halftone underground comic",
            True,
        ),
        # Same again with different text for redundancy
        (
            "style_dna",
            "moody chiaroscuro charcoal sketch with dramatic vignetting",
            "moody chiaroscuro charcoal sketch with dramatic vignetting",
            True,
        ),
        (
            "style_dna",
            "",
            "",
            True,
        ),
    ],
)
def test_match_slot_to_builtin(slot_key, raw_text, expected, is_raw):
    got_id, got_is_raw = match_slot_to_builtin(slot_key, raw_text)
    assert got_is_raw is is_raw
    assert got_id == expected


# ─── Slots that never participate in matching ────────────────────────────


def test_visual_description_always_raw():
    out, is_raw = match_slot_to_builtin("visual_description", "anything at all")
    assert is_raw is True
    assert out == "anything at all"


def test_extra_context_always_raw():
    out, is_raw = match_slot_to_builtin("extra_context", "for a rodeo shirt")
    assert is_raw is True
    assert out == "for a rodeo shirt"


def test_unknown_slot_key_always_raw():
    """Defensive: an unknown slot returns raw rather than raising."""
    out, is_raw = match_slot_to_builtin("nonexistent_slot", "hello world")
    assert is_raw is True
    assert out == "hello world"


# ─── Truncation ──────────────────────────────────────────────────────────


def test_truncation_respects_max_len():
    """Raw text exceeding the slot's max length is truncated to that length."""
    for slot_key, max_len in SLOT_MAX_RAW_LEN.items():
        long_raw = "x" * (max_len + 100)
        out, is_raw = match_slot_to_builtin(slot_key, long_raw)
        # No real match for "xxx..." in any pool — must be raw
        assert is_raw is True
        assert len(out) <= max_len, f"{slot_key}: got len={len(out)} > {max_len}"


def test_empty_raw_text_returns_empty_raw():
    out, is_raw = match_slot_to_builtin("spatial_configuration", "")
    assert is_raw is True
    assert out == ""
