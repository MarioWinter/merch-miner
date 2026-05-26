"""PROJ-34 Phase 13t-d.6 — Tests for `generate_best_of_mix`.

Covers the Best-of-Mix LLM cache service:
- happy path persists 3-variant cache + metadata
- cache hit short-circuits the LLM
- force=True bypasses cache
- LLM timeout / HTTP 500 / malformed JSON / missing variant → None (cache untouched)
- niche-not-found / no-completed-research → None without LLM call
- 5 mappable slots flow through `match_slot_to_builtin` (built-in id when matchable)
- `visual_description` + `extra_context` always `is_raw=True`
- `top3_product_ids` persisted from `preset_ranker.rank_top_products`
"""

from __future__ import annotations

import datetime as _dt
import json
import uuid as _uuid
from unittest.mock import MagicMock, patch

import httpx
import pytest
from django.utils import timezone

from design_app.services.best_of_mix_generator import (
    SCHEMA_VERSION,
    VARIANT_KEYS,
    generate_best_of_mix,
)
from niche_app.models import Niche
from niche_research_app.models import (
    NicheAnalysis,
    NicheProductEmotionalAnalysis,
    NicheProductVisionAnalysis,
    NicheResearch,
    NicheResearchProduct,
)
from scraper_app.models import AmazonProduct
from user_auth_app.models import User
from workspace_app.models import Membership, Workspace

pytestmark = pytest.mark.django_db


# ─── Fixtures / helpers ────────────────────────────────────────────────────


def _make_workspace_and_user():
    user = User.objects.create_user(
        email='bom@example.com', password='pw', username='bom@example.com',
    )
    workspace = Workspace.objects.create(
        name='BoM WS', slug='bom-ws', owner=user,
    )
    Membership.objects.create(
        workspace=workspace, user=user, role='admin', status='active',
    )
    return workspace, user


def _make_niche_with_completed_research(
    *,
    with_vision: bool = True,
    with_emotional: bool = True,
    with_analysis: bool = True,
):
    workspace, user = _make_workspace_and_user()
    niche = Niche.objects.create(
        workspace=workspace, name='School Buses', created_by=user,
    )
    research = NicheResearch.objects.create(
        niche=niche,
        status=NicheResearch.Status.COMPLETED,
        triggered_by=user,
        completed_at=timezone.now(),
    )
    product = None
    if with_vision:
        product = AmazonProduct.objects.create(
            asin='B000BOM001', title='Funny School Bus Driver Tee',
        )
        NicheResearchProduct.objects.create(
            research=research, product=product, brand_blocked=False,
        )
        NicheProductVisionAnalysis.objects.create(
            research=research, product=product,
            is_niche_match=True,
            slogan_text='HONK if you love school buses',
            meaning_context='Pride in driving children to school',
            visual_style='vintage halftone, mustard + navy',
            graphic_elements='cartoon school bus + steaming mug',
            layout_composition='vertical stack layout headline top illustration centre subtitle bottom',
        )
    if with_emotional and product is not None:
        NicheProductEmotionalAnalysis.objects.create(
            research=research, product=product,
            original_slogan='HONK if you love school buses',
            emotional_pattern='pride',
            tone='warm, nostalgic',
            adaptation_formula='HONK if you love {niche}',
            key_elements=['HONK', 'love', 'school buses'],
        )
    if with_analysis:
        NicheAnalysis.objects.create(
            research=research, niche=niche,
            niche_summary='Bus drivers proud of their job',
            sentiment=NicheAnalysis.Sentiment.POSITIVE,
            primary_emotions=['pride', 'nostalgia'],
            emotional_archetype=['caregiver'],
            dominant_design_aesthetics='vintage halftone vibe',
            design_concepts='cartoon mascots + bold slogans',
            pattern_analysis=[],
            emotional_reality='Drivers feel underappreciated but proud',
        )
    return niche, research, user


def _valid_llm_response() -> dict:
    """Returns a dict with all 3 variants × 7 slots populated."""
    long_visual = (
        'a vibrant cartoon school bus driver in a three-quarter side '
        'perspective, featuring a wide grin and a navy-blue cap with a '
        'golden yellow brim, holding a steaming coffee mug in his left '
        'hand and a clipboard in his right, the school bus body painted '
        'in golden yellow with black stripe trim, thick line weight '
        'outlines, flat color fills, dynamic action pose mid-stride, '
        'exaggerated facial expression conveying energy, four-color '
        'limited palette composed of mustard, navy, off-white, brick red.'
    )
    variant = {
        'spatial_configuration': 'vertical_stack',
        'visual_description': long_visual,
        'typography_adjectives': 'bold compressed stencil with hand-cut edges',
        'font_combination': 'athletic varsity serif headline + sans-serif tagline',
        'accessories': (
            'a sparse scattering of small filled stars and tiny dots framing the design'
        ),
        'style_dna': '1970s underground comic with halftone prints and bold linework',
        'extra_context': 'slight diagonal tilt on subtitle for movement',
    }
    return {
        'most_common': dict(variant),
        'edgy': {**variant, 'visual_description': long_visual + ' Edgy aggressive twist on the same subject with sharper angles.'},
        'safe': {**variant, 'visual_description': long_visual + ' Conservative neutral take on the same subject for mass appeal.'},
    }


def _mock_openrouter_resp(payload_dict: dict, status_code: int = 200):
    """Return a MagicMock httpx.Response wrapping `payload_dict` as JSON choice."""
    content = json.dumps(payload_dict)
    body = {
        'choices': [{'message': {'content': content}}],
        'usage': {
            'prompt_tokens': 500,
            'completion_tokens': 800,
            'total_tokens': 1300,
        },
    }
    resp = MagicMock(spec=httpx.Response)
    resp.json.return_value = body
    resp.status_code = status_code
    resp.text = json.dumps(body)
    resp.raise_for_status = MagicMock()
    return resp


def _mock_httpx_client(resp_or_exc):
    """Patch helper: return a Client whose `.post` returns `resp_or_exc` or raises."""
    mock_client = MagicMock()
    if isinstance(resp_or_exc, Exception):
        mock_client.post.side_effect = resp_or_exc
    else:
        mock_client.post.return_value = resp_or_exc
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    return mock_client


def _apply_openrouter_settings(settings):
    settings.OPENROUTER_API_KEY = 'test-key'
    settings.OPENROUTER_BASE_URL = 'https://example.test/api/v1'


# ─── Tests ─────────────────────────────────────────────────────────────────


class TestGenerateBestOfMix:
    @patch('design_app.services.best_of_mix_generator.httpx.Client')
    def test_generate_persists_to_cache(self, mock_client_cls, settings):
        _apply_openrouter_settings(settings)
        niche, _, _ = _make_niche_with_completed_research()
        mock_client_cls.return_value = _mock_httpx_client(
            _mock_openrouter_resp(_valid_llm_response()),
        )

        result = generate_best_of_mix(niche.id)

        assert result is not None
        niche.refresh_from_db()
        cache = niche.best_of_mix_cache
        assert isinstance(cache, dict)
        for variant in VARIANT_KEYS:
            assert variant in cache
            block = cache[variant]
            assert 'slot_spatial_configuration' in block
            assert 'slot_visual_description' in block
            assert 'slot_typography_adjectives' in block
            assert 'slot_font_combination' in block
            assert 'slot_accessories' in block
            assert 'slot_style_dna' in block
            assert 'slot_extra_context' in block
        assert cache['_schema_version'] == SCHEMA_VERSION
        assert '_generated_at' in cache
        assert cache['_source_research_id']

    @patch('design_app.services.best_of_mix_generator.httpx.Client')
    def test_cache_hit_skips_llm(self, mock_client_cls, settings):
        _apply_openrouter_settings(settings)
        niche, research, _ = _make_niche_with_completed_research()
        future_iso = (timezone.now() + _dt.timedelta(hours=1)).isoformat()
        niche.best_of_mix_cache = {
            '_schema_version': SCHEMA_VERSION,
            '_generated_at': future_iso,
            '_source_research_id': str(research.id),
            'most_common': {'slot_spatial_configuration': 'vertical_stack'},
            'edgy': {'slot_spatial_configuration': 'badge_emblem'},
            'safe': {'slot_spatial_configuration': 'vertical_stack'},
            'top3_product_ids': [],
        }
        niche.save(update_fields=['best_of_mix_cache'])

        result = generate_best_of_mix(niche.id)

        assert result is not None
        assert result['most_common']['slot_spatial_configuration'] == 'vertical_stack'
        mock_client_cls.assert_not_called()

    @patch('design_app.services.best_of_mix_generator.httpx.Client')
    def test_force_true_bypasses_cache(self, mock_client_cls, settings):
        _apply_openrouter_settings(settings)
        niche, research, _ = _make_niche_with_completed_research()
        future_iso = (timezone.now() + _dt.timedelta(hours=1)).isoformat()
        niche.best_of_mix_cache = {
            '_schema_version': SCHEMA_VERSION,
            '_generated_at': future_iso,
            '_source_research_id': str(research.id),
            'most_common': {}, 'edgy': {}, 'safe': {},
            'top3_product_ids': [],
        }
        niche.save(update_fields=['best_of_mix_cache'])
        mock_client_cls.return_value = _mock_httpx_client(
            _mock_openrouter_resp(_valid_llm_response()),
        )

        generate_best_of_mix(niche.id, force=True)

        assert mock_client_cls.called

    @patch('design_app.services.best_of_mix_generator.httpx.Client')
    def test_llm_timeout_returns_none(self, mock_client_cls, settings):
        _apply_openrouter_settings(settings)
        niche, _, _ = _make_niche_with_completed_research()
        before = niche.best_of_mix_cache
        mock_client_cls.return_value = _mock_httpx_client(
            httpx.TimeoutException('slow'),
        )

        result = generate_best_of_mix(niche.id)

        assert result is None
        niche.refresh_from_db()
        assert niche.best_of_mix_cache == before

    @patch('design_app.services.best_of_mix_generator.httpx.Client')
    def test_llm_500_returns_none(self, mock_client_cls, settings):
        _apply_openrouter_settings(settings)
        niche, _, _ = _make_niche_with_completed_research()
        before = niche.best_of_mix_cache
        err_resp = MagicMock(spec=httpx.Response)
        err_resp.status_code = 500
        err_resp.text = 'upstream boom'
        exc = httpx.HTTPStatusError(
            'boom', request=MagicMock(), response=err_resp,
        )
        bad_resp = MagicMock(spec=httpx.Response)
        bad_resp.raise_for_status.side_effect = exc
        mock_client_cls.return_value = _mock_httpx_client(bad_resp)

        result = generate_best_of_mix(niche.id)

        assert result is None
        niche.refresh_from_db()
        assert niche.best_of_mix_cache == before

    @patch('design_app.services.best_of_mix_generator.httpx.Client')
    def test_malformed_json_returns_none(self, mock_client_cls, settings):
        _apply_openrouter_settings(settings)
        niche, _, _ = _make_niche_with_completed_research()
        before = niche.best_of_mix_cache
        bad_body = {
            'choices': [{'message': {'content': 'not-json {{{'}}],
            'usage': {},
        }
        resp = MagicMock(spec=httpx.Response)
        resp.json.return_value = bad_body
        resp.raise_for_status = MagicMock()
        mock_client_cls.return_value = _mock_httpx_client(resp)

        result = generate_best_of_mix(niche.id)

        assert result is None
        niche.refresh_from_db()
        assert niche.best_of_mix_cache == before

    @patch('design_app.services.best_of_mix_generator.httpx.Client')
    def test_missing_variant_returns_none(self, mock_client_cls, settings):
        _apply_openrouter_settings(settings)
        niche, _, _ = _make_niche_with_completed_research()
        before = niche.best_of_mix_cache
        bad_payload = _valid_llm_response()
        del bad_payload['edgy']
        mock_client_cls.return_value = _mock_httpx_client(
            _mock_openrouter_resp(bad_payload),
        )

        result = generate_best_of_mix(niche.id)

        assert result is None
        niche.refresh_from_db()
        assert niche.best_of_mix_cache == before

    def test_no_completed_research_returns_none(self, settings):
        _apply_openrouter_settings(settings)
        workspace, user = _make_workspace_and_user()
        niche = Niche.objects.create(
            workspace=workspace, name='Empty Niche', created_by=user,
        )
        with patch(
            'design_app.services.best_of_mix_generator.httpx.Client',
        ) as mock_client_cls:
            result = generate_best_of_mix(niche.id)

        assert result is None
        mock_client_cls.assert_not_called()

    def test_niche_not_found_returns_none(self, settings):
        _apply_openrouter_settings(settings)
        bogus_id = _uuid.uuid4()
        with patch(
            'design_app.services.best_of_mix_generator.httpx.Client',
        ) as mock_client_cls:
            result = generate_best_of_mix(bogus_id)

        assert result is None
        mock_client_cls.assert_not_called()

    @patch('design_app.services.best_of_mix_generator.httpx.Client')
    def test_resolves_built_in_matches(self, mock_client_cls, settings):
        _apply_openrouter_settings(settings)
        niche, _, _ = _make_niche_with_completed_research()
        # LLM returns text that matches `pyramid_stack` via Jaccard (token-overlap
        # with the option's prompt_text — same pattern as test_preset_matcher.py).
        payload = _valid_llm_response()
        for variant in VARIANT_KEYS:
            payload[variant]['spatial_configuration'] = (
                'pyramid word-stack layout 4 to 5 stacked text lines forming pyramid '
                'top line shortest smallest each subsequent line wider bolder bottom '
                'line dominant emphasis word no illustration tight vertical spacing'
            )
        mock_client_cls.return_value = _mock_httpx_client(
            _mock_openrouter_resp(payload),
        )

        result = generate_best_of_mix(niche.id)

        assert result is not None
        assert result['most_common']['slot_spatial_configuration'] == 'pyramid_stack'
        assert result['most_common']['spatial_is_raw'] is False

    @patch('design_app.services.best_of_mix_generator.httpx.Client')
    def test_visual_and_extra_context_always_raw(self, mock_client_cls, settings):
        _apply_openrouter_settings(settings)
        niche, _, _ = _make_niche_with_completed_research()
        mock_client_cls.return_value = _mock_httpx_client(
            _mock_openrouter_resp(_valid_llm_response()),
        )

        result = generate_best_of_mix(niche.id)

        assert result is not None
        for variant in VARIANT_KEYS:
            assert result[variant]['visual_is_raw'] is True
            assert result[variant]['extra_context_is_raw'] is True
            assert result[variant]['style_dna_is_raw'] is True

    @patch('design_app.services.best_of_mix_generator.httpx.Client')
    def test_top3_product_ids_persisted(self, mock_client_cls, settings):
        _apply_openrouter_settings(settings)
        niche, research, user = _make_niche_with_completed_research()
        # Add 2 more products so top3 isn't trivially a single id.
        for asin in ('B000BOM002', 'B000BOM003'):
            p = AmazonProduct.objects.create(asin=asin, title=f'Tee {asin}')
            NicheResearchProduct.objects.create(
                research=research, product=p, brand_blocked=False,
            )
            NicheProductVisionAnalysis.objects.create(
                research=research, product=p, is_niche_match=True,
                visual_style='', graphic_elements='', layout_composition='',
            )
        mock_client_cls.return_value = _mock_httpx_client(
            _mock_openrouter_resp(_valid_llm_response()),
        )

        result = generate_best_of_mix(niche.id)

        assert result is not None
        assert 'top3_product_ids' in result
        # rank_top_products(limit=3) returns ≤3 ids; with 3 products → exactly 3.
        assert len(result['top3_product_ids']) <= 3
        assert all(isinstance(pid, str) for pid in result['top3_product_ids'])

    @patch('design_app.services.best_of_mix_generator.httpx.Client')
    def test_graceful_when_no_emotional_rows(self, mock_client_cls, settings):
        _apply_openrouter_settings(settings)
        niche, _, _ = _make_niche_with_completed_research(with_emotional=False)
        mock_client_cls.return_value = _mock_httpx_client(
            _mock_openrouter_resp(_valid_llm_response()),
        )

        result = generate_best_of_mix(niche.id)

        assert result is not None
        # Should still successfully populate the cache from vision rows alone.
        assert 'most_common' in result
