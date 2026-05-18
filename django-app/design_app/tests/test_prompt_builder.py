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

from design_app.services.prompt_builder import (
    _POLISHED_PROMPT_MAX_CHARS,
    _resolve_slot,
    _resolve_spatial,
    _truncate_at_sentence_boundary,
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
        'text_segmentation': 'a single centered slogan rendered as one block of text',
        'typography_adjectives': "'massive heavyweight cartoon-block font'",
        'accessories': 'white radiating motion-burst lines',
        'material_texture': 'clean digital vector with flat color regions',
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
            assert 'single centered slogan rendered as one block of text' in out
            assert "'massive heavyweight cartoon-block font'" in out
            assert 'white radiating motion-burst lines' in out
            assert 'clean digital vector with flat color regions' in out
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
    def test_empty_slots_fall_through_to_style_defaults(self):
        """typography / material / style_dna come from STYLE_LIBRARY when no
        user value and no niche hint."""
        style = STYLE_LIBRARY['cartoon']
        out = build_form_prompt(
            slogan='X',
            style_slug='cartoon',
            slots={},
            background_color='light_gray',
        )
        assert style['default_typography'] in out
        assert style['default_material'] in out
        assert style['default_style_dna'] in out

    def test_niche_hint_fills_slot_when_user_empty(self):
        """visual_description has no style default → niche hint must fill it."""
        niche_hints = {
            'visual': 'a vintage diner counter with stacked plates',
            'accessories': 'a sparse scattering of small filled stars',
            'material': 'matte screenprint plastisol ink texture',
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
        # material niche-hint beats the style default
        assert 'matte screenprint plastisol ink texture' in out

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

    def test_explicit_value_wins_over_style_default(self):
        """typography_adjectives has a style default — user override wins."""
        out = build_form_prompt(
            slogan='X',
            style_slug='cartoon',
            slots={'typography_adjectives': "'tiny custom override font'"},
            background_color='light_gray',
        )
        assert "'tiny custom override font'" in out
        # The style default should NOT also leak in.
        assert STYLE_LIBRARY['cartoon']['default_typography'] not in out

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
    def test_builtin_id_resolves_to_prompt_text(self):
        builtin = SPATIAL_OPTIONS[0]
        out = _resolve_spatial(
            user_val=builtin['id'],
            niche_hint_id=None,
            style_default_id=None,
            workspace_id=None,
        )
        assert out == builtin['prompt_text']

    def test_raw_text_passes_through(self):
        out = _resolve_spatial(
            user_val='a wildly custom layout that is not in the library',
            niche_hint_id=None,
            style_default_id=None,
            workspace_id=None,
        )
        assert out == 'a wildly custom layout that is not in the library'

    def test_niche_hint_id_fills_when_user_empty(self):
        builtin = SPATIAL_OPTIONS[1]
        out = _resolve_spatial(
            user_val='',
            niche_hint_id=builtin['id'],
            style_default_id=None,
            workspace_id=None,
        )
        assert out == builtin['prompt_text']

    def test_style_default_fills_when_no_user_no_hint(self):
        builtin = SPATIAL_OPTIONS[2]
        out = _resolve_spatial(
            user_val='',
            niche_hint_id=None,
            style_default_id=builtin['id'],
            workspace_id=None,
        )
        assert out == builtin['prompt_text']

    def test_missing_id_returns_empty_to_omit_sentence(self):
        """Style default points to a nonexistent id → resolver omits."""
        out = _resolve_spatial(
            user_val='',
            niche_hint_id=None,
            style_default_id='not_a_real_spatial_id',
            workspace_id=None,
        )
        assert out == ''

    def test_uuid_branch_skipped_when_workspace_id_none(self):
        """No workspace context → UUID lookup MUST short-circuit. Without a
        raw-text fallback the result is the empty string."""
        # A syntactically valid UUID that isn't a CustomSpatial.
        uuid_str = '00000000-0000-0000-0000-000000000000'
        out = _resolve_spatial(
            user_val=uuid_str,
            niche_hint_id=None,
            style_default_id=None,
            workspace_id=None,
        )
        # workspace_id=None → branch skipped → no raw-text path (the
        # user_val is a UUID we already consumed) → omit.
        assert out == ''

    def test_uuid_branch_gracefully_skips_when_custom_spatial_missing(self):
        """Phase 13b ships before Phase 13d's CustomSpatial model. The
        resolver must NOT crash; it falls through (here: to omit)."""
        uuid_str = '11111111-2222-3333-4444-555555555555'
        out = _resolve_spatial(
            user_val=uuid_str,
            niche_hint_id=None,
            style_default_id=None,
            workspace_id='some-ws-id',
        )
        # Either the model doesn't exist (ImportError → skip) or
        # DoesNotExist → skip. Either way the loop falls through; with no
        # other fallback the result is '' (omit).
        assert out == ''

    def test_priority_user_over_hint_and_default(self):
        builtin_a = SPATIAL_OPTIONS[0]
        builtin_b = SPATIAL_OPTIONS[1]
        builtin_c = SPATIAL_OPTIONS[2]
        out = _resolve_spatial(
            user_val=builtin_a['id'],
            niche_hint_id=builtin_b['id'],
            style_default_id=builtin_c['id'],
            workspace_id=None,
        )
        assert out == builtin_a['prompt_text']


# ─── _resolve_slot smoke ──────────────────────────────────────────────────


class TestResolveSlotSmoke:
    def test_slot_keys_match_schema(self):
        """Sanity: SLOT_SCHEMA ships exactly the 8 expected keys."""
        keys = {slot['key'] for slot in SLOT_SCHEMA}
        assert keys == {
            'spatial_configuration', 'visual_description',
            'text_segmentation', 'typography_adjectives',
            'accessories', 'material_texture',
            'style_dna', 'extra_context',
        }

    def test_style_default_lookup_for_typography(self):
        style = STYLE_LIBRARY['cartoon']
        typo_slot = next(s for s in SLOT_SCHEMA if s['key'] == 'typography_adjectives')
        out = _resolve_slot(
            typo_slot,
            user_slots={},
            niche_hints=None,
            style=style,
            slogan='X',
        )
        assert out == style['default_typography']


# ─── 1500-char cap (task 13b.9) ───────────────────────────────────────────


class TestPromptCap:
    def test_typical_output_under_1500_chars(self):
        slots = _all_slots_filled()
        out = build_form_prompt(
            slogan='SCHOOL BUS LIFE',
            style_slug='cartoon',
            slots=slots,
            background_color='light_gray',
        )
        assert len(out) <= _POLISHED_PROMPT_MAX_CHARS

    def test_oversize_truncates_at_sentence_boundary(self):
        """Force the cap by injecting a huge slot value, then assert the
        output is trimmed at the last sentence boundary."""
        bloat = '. '.join([f'sentence {i}' for i in range(200)])
        slots = _all_slots_filled()
        slots['extra_context'] = bloat
        out = build_form_prompt(
            slogan='X',
            style_slug='cartoon',
            slots=slots,
            background_color='light_gray',
        )
        assert len(out) <= _POLISHED_PROMPT_MAX_CHARS
        # Truncated at a sentence boundary → ends in '.'
        assert out.endswith('.')

    def test_truncate_helper_prefers_sentence_boundary(self):
        text = 'First sentence. Second sentence. Third sentence.'
        out = _truncate_at_sentence_boundary(text, max_chars=25)
        # Largest prefix ending in '. ' within 25 chars → 'First sentence.'
        assert out == 'First sentence.'

    def test_truncate_helper_hard_slices_when_no_period(self):
        text = 'abcdefghijklmnopqrst'  # no '.', longer than max
        out = _truncate_at_sentence_boundary(text, max_chars=5)
        assert out == 'abcde'
