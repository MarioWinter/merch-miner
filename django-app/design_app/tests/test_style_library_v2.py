"""PROJ-34 Phase 13a — Style Library v2 / 36 Spatial Variants / Rule #10 tests.

Covers AC-47 … AC-52 + AC-70: Architect template scaffolding, slot schema,
36 spatial variants, the 6
fixed-option dropdown lists (J.5–J.8), per-style auto-defaults (Appendix K),
and the anti-gradient Rule #10 (Appendix N.1).
"""
from __future__ import annotations

import pytest

from design_app.services.image_generator import DESIGN_GEN_SYSTEM_PROMPT
from design_app.services.style_library import (
    ACCESSORIES_OPTIONS,
    ARCHITECT_TEMPLATE_END,
    ARCHITECT_TEMPLATE_START,
    FONT_COMBINATION_OPTIONS,
    SLOT_SCHEMA,
    SPATIAL_OPTIONS,
    STYLE_LIBRARY,
    TYPOGRAPHY_OPTIONS,
    get_font_combination_by_id,
    get_spatial_by_id,
)


# ─── Spatial options ──────────────────────────────────────────────────────


class TestSpatialOptions:
    """`SPATIAL_OPTIONS` must mirror Appendix J.4 exactly (AC-51 + AC-70)."""

    REQUIRED_KEYS = {'id', 'ui_label', 'ui_description', 'thumbnail_path', 'prompt_text'}

    def test_count_matches_appendix(self):
        # Appendix J.4 ships 43 dict entries verbatim (36 base + 7 Phase 13o
        # German POD layout-canon additions). First 6 preserve v1 wording.
        assert len(SPATIAL_OPTIONS) == 43

    def test_all_ids_unique(self):
        ids = [entry['id'] for entry in SPATIAL_OPTIONS]
        assert len(ids) == len(set(ids)), 'SPATIAL_OPTIONS ids must be unique'

    def test_every_entry_has_required_keys(self):
        for entry in SPATIAL_OPTIONS:
            missing = self.REQUIRED_KEYS - set(entry.keys())
            assert not missing, (
                f"spatial entry {entry.get('id', '<missing id>')!r} is "
                f"missing keys: {missing}"
            )

    def test_every_entry_has_non_empty_strings(self):
        for entry in SPATIAL_OPTIONS:
            for key in self.REQUIRED_KEYS:
                value = entry[key]
                assert isinstance(value, str) and value.strip(), (
                    f"spatial entry {entry['id']!r} has empty {key!r}"
                )

    def test_thumbnail_paths_under_spatial_subdir(self):
        for entry in SPATIAL_OPTIONS:
            assert entry['thumbnail_path'].startswith('thumbnails/spatial/'), (
                f"spatial entry {entry['id']!r} thumbnail_path must live "
                f"under thumbnails/spatial/ — got {entry['thumbnail_path']!r}"
            )

    def test_get_spatial_by_id_returns_known_entry(self):
        entry = get_spatial_by_id('vertical_stack')
        assert entry is not None
        assert entry['id'] == 'vertical_stack'
        assert entry['ui_label'] == 'Vertical Stack'

    def test_get_spatial_by_id_returns_none_for_unknown(self):
        assert get_spatial_by_id('does_not_exist') is None

    def test_get_spatial_by_id_handles_empty(self):
        assert get_spatial_by_id('') is None
        assert get_spatial_by_id(None) is None  # type: ignore[arg-type]


# ─── Slot schema ──────────────────────────────────────────────────────────


class TestSlotSchema:
    """`SLOT_SCHEMA` mirrors Appendix J.3 (AC-50)."""

    EXPECTED_KEYS = [
        'spatial_configuration',
        'visual_description',
        'typography_adjectives',
        'font_combination',
        'accessories',
        'style_dna',
        'extra_context',
    ]

    REQUIRED_FIELDS = {
        'key', 'label', 'render_template',
        'has_dropdown', 'has_custom_text',
        'style_auto_default', 'niche_hint_key',
    }

    def test_has_seven_entries(self):
        # Phase 13l added font_combination (9). Phase 13q removed
        # material_texture (8). Phase 13s removed text_segmentation (7).
        assert len(SLOT_SCHEMA) == 7

    def test_keys_in_expected_order(self):
        assert [s['key'] for s in SLOT_SCHEMA] == self.EXPECTED_KEYS

    def test_each_slot_has_required_fields(self):
        for slot in SLOT_SCHEMA:
            missing = self.REQUIRED_FIELDS - set(slot.keys())
            assert not missing, f"slot {slot.get('key')} missing: {missing}"

    def test_render_templates_use_value_placeholder(self):
        for slot in SLOT_SCHEMA:
            assert '{value}' in slot['render_template'], (
                f"slot {slot['key']!r} render_template must contain "
                f"a {{value}} placeholder"
            )


# ─── Fixed dropdown options ───────────────────────────────────────────────


class TestDropdownOptions:
    """6-item dropdown lists (Appendices J.5 – J.8)."""

    def test_typography_count(self):
        # Phase 13j — TYPOGRAPHY_OPTIONS expanded from 6 strings to 21 dict
        # entries (image-extracted POD font library, dict shape mirrors
        # SPATIAL_OPTIONS).
        # Phase 13j: 21. Phase 13l-followup: +1 (extruded_3d_block) → 22.
        assert len(TYPOGRAPHY_OPTIONS) == 22

    def test_accessories_count(self):
        assert len(ACCESSORIES_OPTIONS) == 6

    def test_typography_entries_have_required_keys(self):
        # Phase 13j — dict shape mirrors SPATIAL_OPTIONS.
        required = {'id', 'ui_label', 'ui_description', 'prompt_text'}
        for entry in TYPOGRAPHY_OPTIONS:
            assert set(entry.keys()) >= required, entry
            # prompt_text is still wrapped in single-quotes so it slots
            # into the Architect template cleanly.
            pt = entry['prompt_text']
            assert pt.startswith("'") and pt.endswith("'"), entry['id']

    def test_typography_ids_unique(self):
        ids = [e['id'] for e in TYPOGRAPHY_OPTIONS]
        assert len(ids) == len(set(ids)), 'TYPOGRAPHY_OPTIONS ids must be unique'

    @pytest.mark.parametrize(
        'options',
        [ACCESSORIES_OPTIONS],
    )
    def test_no_blank_entries(self, options):
        for value in options:
            assert isinstance(value, str) and value.strip()


# ─── Font Combination options (Phase 13l) ─────────────────────────────────


class TestFontCombinationOptions:
    """`FONT_COMBINATION_OPTIONS` ships 8 dict entries — Phase 13l."""

    REQUIRED_KEYS = {'id', 'ui_label', 'ui_description', 'prompt_text'}

    def test_count_is_eight(self):
        # Phase 13l: 8. Followup: +2 (vintage_slab+modern_brush_accent,
        # body_sans+extruded_emphasis) → 10.
        assert len(FONT_COMBINATION_OPTIONS) == 10

    def test_all_ids_unique(self):
        ids = [entry['id'] for entry in FONT_COMBINATION_OPTIONS]
        assert len(ids) == len(set(ids)), 'FONT_COMBINATION_OPTIONS ids must be unique'

    def test_every_entry_has_required_keys(self):
        for entry in FONT_COMBINATION_OPTIONS:
            missing = self.REQUIRED_KEYS - set(entry.keys())
            assert not missing, (
                f"font-combination entry {entry.get('id', '<missing id>')!r} "
                f"is missing keys: {missing}"
            )

    def test_every_entry_has_non_empty_strings(self):
        for entry in FONT_COMBINATION_OPTIONS:
            for key in self.REQUIRED_KEYS:
                value = entry[key]
                assert isinstance(value, str) and value.strip(), (
                    f"font-combination entry {entry['id']!r} has empty {key!r}"
                )

    def test_prompt_text_no_leading_quote(self):
        # Unlike TYPOGRAPHY_OPTIONS entries (whose prompt_text is wrapped
        # in single-quotes so it slots into
        # "The text is rendered in a {value} font style."), the
        # FONT_COMBINATION_OPTIONS prompt_text is a complete sentence that
        # slots into "{value}." — therefore it must NOT start/end with a
        # single-quote.
        for entry in FONT_COMBINATION_OPTIONS:
            pt = entry['prompt_text']
            assert not pt.startswith("'"), (
                f"font-combination {entry['id']!r} prompt_text must NOT "
                f"start with a single-quote (it's a full sentence, not a "
                f"phrase fragment)"
            )
            assert not pt.endswith("'"), (
                f"font-combination {entry['id']!r} prompt_text must NOT "
                f"end with a single-quote"
            )

    def test_get_font_combination_by_id_returns_known_entry(self):
        entry = get_font_combination_by_id('vintage_slab_plus_script_accent')
        assert entry is not None
        assert entry['id'] == 'vintage_slab_plus_script_accent'
        assert entry['ui_label'] == 'Vintage Slab + Script Accent'

    def test_get_font_combination_by_id_returns_none_for_unknown(self):
        assert get_font_combination_by_id('does_not_exist') is None

    def test_get_font_combination_by_id_handles_empty(self):
        assert get_font_combination_by_id('') is None
        assert get_font_combination_by_id(None) is None  # type: ignore[arg-type]


# ─── Per-style auto-defaults (Appendix K) ─────────────────────────────────


class TestStyleAutoDefaults:
    """Every entry in STYLE_LIBRARY has the style auto-default fields and
    each one points to a valid TYPOGRAPHY value. Phase 13t-u removed
    `default_spatial_id` so the style picker only contributes STYLE
    descriptors, never LAYOUT."""

    def test_sixteen_styles(self):
        # Phase 13r added comic_book (clean American comic, no shading).
        assert len(STYLE_LIBRARY) == 16

    def test_every_style_has_style_dna_default(self):
        """Phase 13t-u: only default_style_dna remains as a style auto-fill."""
        for slug, style in STYLE_LIBRARY.items():
            assert 'default_style_dna' in style, (
                f"style {slug!r} missing default_style_dna"
            )
            value = style['default_style_dna']
            assert isinstance(value, str) and value.strip(), (
                f"style {slug!r} has empty default_style_dna"
            )

    def test_no_style_carries_default_spatial_or_typography_id(self):
        """Phase 13t-u: style picker must NOT auto-fill layout or typography."""
        for slug, style in STYLE_LIBRARY.items():
            assert 'default_spatial_id' not in style, (
                f"style {slug!r} still carries default_spatial_id"
            )
            assert 'default_typography_id' not in style, (
                f"style {slug!r} still carries default_typography_id"
            )

    # Phase 13t-u: default_typography_id removed from STYLE_LIBRARY.
    # `test_no_style_carries_default_spatial_or_typography_id` above asserts
    # the absence; no per-style id-resolution test is needed any more.

# ─── Architect template scaffolding ───────────────────────────────────────


class TestArchitectTemplate:
    """ARCHITECT_TEMPLATE_START / END constants (AC-47, AC-48)."""

    def test_start_has_bg_hex_placeholder(self):
        assert '{bg_hex}' in ARCHITECT_TEMPLATE_START

    def test_start_renders_with_bg_hex(self):
        rendered = ARCHITECT_TEMPLATE_START.format(bg_hex='#D3D3D3')
        assert '#D3D3D3' in rendered
        assert 'vector print design' in rendered

    def test_end_contains_non_negotiable_clauses(self):
        # AC-48 — anti-gradient/glow/shadow phrasing must be present.
        for needle in (
            'no gradients',
            'no glow effects',
            'no soft shadows',
            'no drop shadows',
            '300 DPI',
        ):
            assert needle in ARCHITECT_TEMPLATE_END, (
                f"ARCHITECT_TEMPLATE_END missing required clause: {needle!r}"
            )

    def test_end_has_no_placeholders(self):
        # AC-48 — END has no template placeholders.
        assert '{' not in ARCHITECT_TEMPLATE_END
        assert '}' not in ARCHITECT_TEMPLATE_END


# ─── DESIGN_GEN_SYSTEM_PROMPT — Rule #10 (Appendix N.1) ───────────────────


class TestDesignGenSystemPromptRule10:
    """Rule #10 must be appended verbatim per Appendix N.1 (AC-49)."""

    def test_contains_rule_ten_lead(self):
        assert '10. NEVER produce gradient fills' in DESIGN_GEN_SYSTEM_PROMPT

    def test_contains_full_rule_ten_text(self):
        # Substring assertion — the full Rule #10 text must appear verbatim.
        expected = (
            '10. NEVER produce gradient fills, glowing effects, soft-edge '
            'shadows, drop shadows, or any blurred edge. Print on Demand '
            'requires hard edges and flat color regions even on round '
            'shapes — render rounded geometry with crisp outlined boundaries '
            'and flat fills.'
        )
        assert expected in DESIGN_GEN_SYSTEM_PROMPT
