"""PROJ-34 Phase 13b — unit tests for `build_form_prompt` + resolvers.

Covers AC-58, AC-62, AC-75 + EC-24 + task 13b.9 (1500-char cap).

The new form-based Builder composes the Architect template + 8 ordered slot
sentences. Tests pin down:

  * happy path: all slots filled → exact assembled prompt
  * fallback chain (explicit → niche-hint → style-default → omit)
  * spatial resolver (built-in id / raw text / UUID-missing-custom / hint /
    style default / omit)
  * Rule #10 anti-gradient clauses present in every output
  * 1500-char cap truncates at sentence boundary
"""

from __future__ import annotations

import pytest

from design_app.services.prompt_builder import (
    _resolve_slot,
    _resolve_spatial,
    build_form_prompt,
)
from design_app.services.style_library import (
    ARCHITECT_TEMPLATE_END,
    SLOT_SCHEMA,
    SPATIAL_OPTIONS,
    STYLE_LIBRARY,
)


# ─── Helpers ──────────────────────────────────────────────────────────────


def _all_slots_filled() -> dict:
    """8-key dict with non-overlapping values so each slot is distinguishable
    in the assembled output."""
    return {
        'spatial_configuration': 'vertical_stack',  # built-in id
        'visual_description': 'a smiling vector school bus rolling forward',
        'typography_adjectives': "'massive heavyweight cartoon-block font'",
        'accessories': 'white radiating motion-burst lines',
        'style_dna': 'Bold cartoon aesthetic with thick uniform black outlines',
        'extra_context': 'High-energy, kid-friendly mood',
    }


# ─── build_form_prompt — happy paths ──────────────────────────────────────


class TestBuildFormPromptHappyPath:
    def test_all_slots_filled_3_styles(self):
        """Each of 3 styles renders all 8 slot sentences."""
        slots = _all_slots_filled()
        for style_slug in ('cartoon', 'vintage_retro', '80s_neon'):
            out = build_form_prompt(
                slogan='SCHOOL BUS LIFE',
                style_slug=style_slug,
                slots=slots,
                background_color='light_gray',
            )

            # Architect frame
            assert out.startswith('A professional vector print design isolated on a #D3D3D3')
            assert out.endswith(ARCHITECT_TEMPLATE_END)
            # Slogan sentence (quoted text + typographic-element binding)
            assert '"SCHOOL BUS LIFE"' in out
            assert 'primary typographic element' in out

            # Spatial: built-in id resolved to prompt_text (not the raw id)
            assert 'vertical_stack' not in out
            assert 'Vertical stack layout' in out

            # Each non-spatial slot value appears verbatim
            assert 'a smiling vector school bus rolling forward' in out
            assert "'massive heavyweight cartoon-block font'" in out
            assert 'white radiating motion-burst lines' in out
            assert 'High-energy, kid-friendly mood' in out

    def test_anti_gradient_rule_present_in_every_output(self):
        """Rule #10 (anti-gradient/glow/shadow clauses) is locked in the
        ARCHITECT_TEMPLATE_END so every prompt carries it."""
        slots = _all_slots_filled()
        for style_slug in STYLE_LIBRARY.keys():
            out = build_form_prompt(
                slogan='X',
                style_slug=style_slug,
                slots=slots,
                background_color='neon_pink',
            )
            assert 'no gradients' in out
            assert 'no glow effects' in out
            assert 'no soft shadows' in out
            assert 'no drop shadows' in out
            # bg_hex injection
            assert '#FF6EC7' in out

    def test_unknown_style_slug_uses_fallback(self):
        """Defensive: an unknown slug yields a generic frame without crashing."""
        out = build_form_prompt(
            slogan='TEST',
            style_slug='nonexistent_style',
            slots={},
            background_color='light_gray',
        )
        assert '"TEST"' in out
        assert ARCHITECT_TEMPLATE_END in out


# ─── Fallback chain (explicit → niche-hint → style-default → omit) ────────


class TestSlotFallbackChain:
    def test_empty_slots_fall_through_to_style_dna_default(self):
        """Phase 13t-u: only style_dna falls through to STYLE_LIBRARY when no
        user value + no niche hint. typography auto-default was removed."""
        style = STYLE_LIBRARY['cartoon']
        out = build_form_prompt(
            slogan='X',
            style_slug='cartoon',
            slots={},
            background_color='light_gray',
        )
        # Style picker contributes only style_dna now.
        assert style['default_style_dna'] in out

    def test_niche_hint_fills_slot_when_user_empty(self):
        """visual_description has no style default → niche hint must fill it."""
        niche_hints = {
            'visual': 'a vintage diner counter with stacked plates',
            'accessories': 'a sparse scattering of small filled stars',
        }
        out = build_form_prompt(
            slogan='X',
            style_slug='vintage_retro',
            slots={},
            background_color='light_gray',
            niche_hints=niche_hints,
        )
        assert 'a vintage diner counter with stacked plates' in out
        # accessories niche-hint beats the style default
        assert 'a sparse scattering of small filled stars' in out
        # Phase 13q — material slot removed; niche-hint no longer suggests material.

    def test_explicit_user_value_wins_over_niche_hint(self):
        niche_hints = {'visual': 'hint visual'}
        out = build_form_prompt(
            slogan='X',
            style_slug='cartoon',
            slots={'visual_description': 'user visual'},
            background_color='light_gray',
            niche_hints=niche_hints,
        )
        assert 'user visual' in out
        assert 'hint visual' not in out

    def test_explicit_style_dna_overrides_style_default(self):
        """style_dna still has a style picker default — explicit user value
        must win. Phase 13t-u: typography auto-default removed, so this test
        now exercises style_dna instead."""
        out = build_form_prompt(
            slogan='X',
            style_slug='cartoon',
            slots={'style_dna': 'EXPLICIT user-set style_dna text'},
            background_color='light_gray',
        )
        assert 'EXPLICIT user-set style_dna text' in out
        # The cartoon style default should NOT leak in.
        assert STYLE_LIBRARY['cartoon']['default_style_dna'] not in out

    def test_ec24_visual_omitted_when_no_user_no_hint_no_default(self):
        """EC-24: visual_description has no style auto-default → if user empty
        AND no niche hint → the sentence is omitted entirely."""
        out = build_form_prompt(
            slogan='X',
            style_slug='cartoon',
            slots={},
            background_color='light_gray',
            niche_hints=None,
        )
        assert 'The illustration features' not in out

    def test_extra_context_only_renders_with_explicit_value(self):
        """extra_context has no niche hint and no style default → must stay
        absent unless user supplies it."""
        slots = _all_slots_filled()
        slots['extra_context'] = ''
        out = build_form_prompt(
            slogan='X',
            style_slug='cartoon',
            slots=slots,
            background_color='light_gray',
        )
        # No fragment unique to extra_context renders.
        assert 'High-energy, kid-friendly' not in out


# ─── _resolve_spatial — Schicht 13 resolver ───────────────────────────────


class TestResolveSpatial:
    """Phase 13t-u: style-default fallback removed; resolver now takes only
    user_val + niche_hint_id + workspace_id."""

    def test_builtin_id_resolves_to_prompt_text(self):
        builtin = SPATIAL_OPTIONS[0]
        out = _resolve_spatial(
            user_val=builtin['id'],
            niche_hint_id=None,
            workspace_id=None,
        )
        assert out == builtin['prompt_text']

    def test_raw_text_passes_through(self):
        out = _resolve_spatial(
            user_val='a wildly custom layout that is not in the library',
            niche_hint_id=None,
            workspace_id=None,
        )
        assert out == 'a wildly custom layout that is not in the library'

    def test_niche_hint_id_fills_when_user_empty(self):
        builtin = SPATIAL_OPTIONS[1]
        out = _resolve_spatial(
            user_val='',
            niche_hint_id=builtin['id'],
            workspace_id=None,
        )
        assert out == builtin['prompt_text']

    def test_no_user_no_hint_omits(self):
        """Phase 13t-u: without user_val and without niche-hint, the sentence
        is omitted — style picker no longer auto-fills layout."""
        out = _resolve_spatial(
            user_val='',
            niche_hint_id=None,
            workspace_id=None,
        )
        assert out == ''

    def test_uuid_branch_skipped_when_workspace_id_none(self):
        """No workspace context → UUID lookup MUST short-circuit. Without a
        raw-text fallback the result is the empty string."""
        uuid_str = '00000000-0000-0000-0000-000000000000'
        out = _resolve_spatial(
            user_val=uuid_str,
            niche_hint_id=None,
            workspace_id=None,
        )
        assert out == ''

    @pytest.mark.django_db
    def test_uuid_branch_gracefully_skips_when_custom_spatial_missing(self):
        """Phase 13d: model exists but the UUID has no row. The resolver
        must NOT crash; it falls through to omit.
        """
        uuid_str = '11111111-2222-3333-4444-555555555555'
        ws_uuid = '22222222-2222-2222-2222-222222222222'
        out = _resolve_spatial(
            user_val=uuid_str,
            niche_hint_id=None,
            workspace_id=ws_uuid,
        )
        assert out == ''

    def test_priority_user_over_hint(self):
        builtin_a = SPATIAL_OPTIONS[0]
        builtin_b = SPATIAL_OPTIONS[1]
        out = _resolve_spatial(
            user_val=builtin_a['id'],
            niche_hint_id=builtin_b['id'],
            workspace_id=None,
        )
        assert out == builtin_a['prompt_text']


# ─── _resolve_slot smoke ──────────────────────────────────────────────────


class TestResolveSlotSmoke:
    def test_slot_keys_match_schema(self):
        """Sanity: SLOT_SCHEMA ships exactly the 9 expected keys (Phase 13l
        added `font_combination`)."""
        keys = {slot['key'] for slot in SLOT_SCHEMA}
        assert keys == {
            'spatial_configuration', 'visual_description',
            'typography_adjectives', 'font_combination',
            'accessories', 'style_dna', 'extra_context',
        }

    def test_typography_omits_when_no_user_value(self):
        # Phase 13t-u: style picker no longer auto-fills typography. With
        # empty user_slots + no niche-hint the resolver returns ''.
        style = STYLE_LIBRARY['cartoon']
        typo_slot = next(s for s in SLOT_SCHEMA if s['key'] == 'typography_adjectives')
        out = _resolve_slot(
            typo_slot,
            user_slots={},
            niche_hints=None,
            style=style,
            slogan='X',
        )
        assert out == ''


# ─── No-cap / template-end preservation (PROJ-34 Phase 13t-t) ─────────────


class TestPromptCap:
    def test_always_ends_with_architect_template_end(self):
        """The anti-gradient / no-glow clauses are non-negotiable (AC-48) and
        must survive in the final prompt regardless of total length."""
        slots = _all_slots_filled()
        out = build_form_prompt(
            slogan='SCHOOL BUS LIFE',
            style_slug='cartoon',
            slots=slots,
            background_color='light_gray',
        )
        assert 'no gradients' in out
        assert 'no glow effects' in out
        assert 'no soft shadows' in out
        assert 'no drop shadows' in out
        assert out.rstrip().endswith('300 DPI.')

    def test_oversize_does_not_truncate_template_end(self):
        """Inject a huge slot value; the template end must still be there
        (Phase 13t-t removed the 1500-char truncation that was cutting it)."""
        bloat = '. '.join([f'sentence {i}' for i in range(200)])
        slots = _all_slots_filled()
        slots['extra_context'] = bloat
        out = build_form_prompt(
            slogan='X',
            style_slug='cartoon',
            slots=slots,
            background_color='light_gray',
        )
        assert len(out) > 1500
        assert 'no gradients' in out
        assert out.rstrip().endswith('300 DPI.')


# ─── Font Combination resolver (Phase 13l) ────────────────────────────────


class TestFontCombinationResolver:
    """`font_combination` slot resolution + typography-silencing override."""

    def test_typography_silenced_when_font_combination_set(self):
        """When the user explicitly sets `font_combination`, the
        `typography_adjectives` sentence is OMITTED entirely (the font
        combination prompt_text carries the typographic anatomy)."""
        from design_app.services.style_library import get_font_combination_by_id

        slots = {
            # Both set — font_combination must win and silence typography.
            'typography_adjectives': "'tiny custom override font'",
            'font_combination': 'vintage_slab_plus_script_accent',
        }
        out = build_form_prompt(
            slogan='X',
            style_slug='cartoon',
            slots=slots,
            background_color='light_gray',
        )
        # Typography sentence is omitted entirely.
        assert "'tiny custom override font'" not in out
        assert 'The text is rendered in a' not in out

        # Font-combination prompt_text appears verbatim.
        combo = get_font_combination_by_id('vintage_slab_plus_script_accent')
        assert combo['prompt_text'] in out

    def test_font_combination_id_resolves(self):
        """An id matching `FONT_COMBINATION_OPTIONS` resolves to its
        prompt_text (not the raw id string)."""
        from design_app.services.style_library import get_font_combination_by_id

        out = build_form_prompt(
            slogan='X',
            style_slug='cartoon',
            slots={'font_combination': 'vintage_slab_plus_script_accent'},
            background_color='light_gray',
        )
        combo = get_font_combination_by_id('vintage_slab_plus_script_accent')
        assert combo['prompt_text'] in out
        # The raw id is not leaked verbatim into the prompt.
        assert 'vintage_slab_plus_script_accent' not in out

    def test_font_combination_raw_text_passes_through(self):
        """A non-id user value is rendered verbatim (raw text override)."""
        raw = 'my arbitrary custom font combination description'
        out = build_form_prompt(
            slogan='X',
            style_slug='cartoon',
            slots={'font_combination': raw},
            background_color='light_gray',
        )
        assert raw in out

    def test_font_combination_empty_omits_sentence(self):
        """No font_combination set → no `{value}.` sentence rendered."""
        out = build_form_prompt(
            slogan='X',
            style_slug='cartoon',
            slots={},
            background_color='light_gray',
        )
        # None of the 8 font-combination prompt_texts should appear.
        for entry in __import__(
            'design_app.services.style_library', fromlist=['FONT_COMBINATION_OPTIONS'],
        ).FONT_COMBINATION_OPTIONS:
            assert entry['prompt_text'] not in out
        # Phase 13t-u: typography auto-default removed — no typography sentence
        # appears when user_slots are empty and no niche-hint exists.
