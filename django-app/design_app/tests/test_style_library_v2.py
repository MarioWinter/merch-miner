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
    MATERIAL_OPTIONS,
    SLOT_SCHEMA,
    SPATIAL_OPTIONS,
    STYLE_LIBRARY,
    TEXT_SEGMENTATION_OPTIONS,
    TYPOGRAPHY_OPTIONS,
    get_spatial_by_id,
)


# ─── Spatial options ──────────────────────────────────────────────────────


class TestSpatialOptions:
    """`SPATIAL_OPTIONS` must mirror Appendix J.4 exactly (AC-51 + AC-70)."""

    REQUIRED_KEYS = {'id', 'ui_label', 'ui_description', 'thumbnail_path', 'prompt_text'}

    def test_count_matches_appendix(self):
        # Appendix J.4 ships 36 dict entries verbatim (Schicht-13 spec spans
        # 36 layout variants total — first 6 preserve v1 wording).
        assert len(SPATIAL_OPTIONS) == 36

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
        'text_segmentation',
        'typography_adjectives',
        'accessories',
        'material_texture',
        'style_dna',
        'extra_context',
    ]

    REQUIRED_FIELDS = {
        'key', 'label', 'render_template',
        'has_dropdown', 'has_custom_text',
        'style_auto_default', 'niche_hint_key',
    }

    def test_has_eight_entries(self):
        assert len(SLOT_SCHEMA) == 8

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

    def test_text_segmentation_count(self):
        assert len(TEXT_SEGMENTATION_OPTIONS) == 6

    def test_typography_count(self):
        # Phase 13j — TYPOGRAPHY_OPTIONS expanded from 6 strings to 21 dict
        # entries (image-extracted POD font library, dict shape mirrors
        # SPATIAL_OPTIONS).
        assert len(TYPOGRAPHY_OPTIONS) == 21

    def test_accessories_count(self):
        assert len(ACCESSORIES_OPTIONS) == 6

    def test_material_count(self):
        assert len(MATERIAL_OPTIONS) == 6

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
        [TEXT_SEGMENTATION_OPTIONS, ACCESSORIES_OPTIONS, MATERIAL_OPTIONS],
    )
    def test_no_blank_entries(self, options):
        for value in options:
            assert isinstance(value, str) and value.strip()


# ─── Per-style auto-defaults (Appendix K) ─────────────────────────────────


class TestStyleAutoDefaults:
    """Every entry in STYLE_LIBRARY has the 4 new default fields and each
    one points to a valid SPATIAL/TYPOGRAPHY/MATERIAL value (AC-52)."""

    DEFAULT_FIELDS = (
        'default_typography_id',
        'default_material',
        'default_style_dna',
        'default_spatial_id',
    )

    def test_fifteen_styles(self):
        assert len(STYLE_LIBRARY) == 15

    def test_every_style_has_all_four_default_fields(self):
        for slug, style in STYLE_LIBRARY.items():
            for field in self.DEFAULT_FIELDS:
                assert field in style, (
                    f"style {slug!r} missing default field {field!r}"
                )
                value = style[field]
                assert isinstance(value, str) and value.strip(), (
                    f"style {slug!r} has empty {field!r}"
                )

    def test_every_default_spatial_id_resolves(self):
        for slug, style in STYLE_LIBRARY.items():
            spatial_id = style['default_spatial_id']
            entry = get_spatial_by_id(spatial_id)
            assert entry is not None, (
                f"style {slug!r} default_spatial_id {spatial_id!r} "
                f"does not match any SPATIAL_OPTIONS entry"
            )

    def test_every_default_typography_id_resolves(self):
        # Phase 13j — STYLE_LIBRARY.default_typography_id is a stable id;
        # resolve via TYPOGRAPHY_OPTIONS entry lookup.
        valid_ids = {e['id'] for e in TYPOGRAPHY_OPTIONS}
        for slug, style in STYLE_LIBRARY.items():
            typo_id = style['default_typography_id']
            assert typo_id in valid_ids, (
                f"style {slug!r} default_typography_id {typo_id!r} does not "
                f"match any TYPOGRAPHY_OPTIONS id"
            )

    def test_every_default_material_in_options(self):
        for slug, style in STYLE_LIBRARY.items():
            value = style['default_material']
            assert value in MATERIAL_OPTIONS, (
                f"style {slug!r} default_material is not one of the "
                f"6 MATERIAL_OPTIONS — got {value!r}"
            )


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
