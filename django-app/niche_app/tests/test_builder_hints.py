"""PROJ-34 Phase 13c.9 / AC-54 — Tests for `structure_niche_for_builder`.

Covers the Niche-Vision LLM pre-structuring service:
- happy path stores a valid 4-slot hint dict with metadata
- unknown spatial id drops to null with warning
- cache hit short-circuits the LLM
- force=True bypasses cache
- HTTP 500 returns None gracefully
- JSON parse errors return None gracefully
- invalid accessories drop to null
"""

from __future__ import annotations

import datetime as _dt
import json
from unittest.mock import MagicMock, patch

import httpx
import pytest
from django.utils import timezone

from niche_app.models import Niche
from niche_app.services.builder_hints import (
    SCHEMA_VERSION,
    structure_niche_for_builder,
)
from niche_research_app.models import (
    NicheProductVisionAnalysis,
    NicheResearch,
    NicheResearchProduct,
)
from scraper_app.models import AmazonProduct
from user_auth_app.models import User
from workspace_app.models import Membership, Workspace

pytestmark = pytest.mark.django_db


VALID_LLM_RESPONSE = {
    'spatial': 'vertical_stack',
    'visual': (
        'a vibrant cartoon school bus driver in a three-quarter side '
        'perspective, featuring a wide grin and a navy-blue cap with a '
        'golden yellow brim, holding a steaming coffee mug in his left '
        'hand and a clipboard in his right, surrounded by floating '
        'pencils, a stack of crisp papers, and small confetti-shaped '
        'sparkles, the school bus body painted in golden yellow with '
        'black stripe trim, thick line weight outlines, flat color '
        'fills, dynamic action pose mid-stride, exaggerated facial '
        'expression conveying energy, four-color limited palette '
        'composed of mustard, navy, off-white, and brick red.'
    ),
    'accessories': (
        'a sparse scattering of small filled stars and tiny dots framing '
        'the design'
    ),
    '_alternates': {
        'spatial': ['badge_emblem'],
        'visual': [],
        'accessories': [],
    },
}


def _make_workspace_and_user():
    user = User.objects.create_user(
        email='hints@example.com', password='pw', username='hints@example.com',
    )
    workspace = Workspace.objects.create(
        name='Hints WS', slug='hints-ws', owner=user,
    )
    Membership.objects.create(
        workspace=workspace, user=user, role='admin', status='active',
    )
    return workspace, user


def _make_niche_with_completed_research(*, with_vision: bool = True):
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
    if with_vision:
        product = AmazonProduct.objects.create(
            asin='B000TEST01', title='Funny School Bus Driver Tee',
        )
        NicheResearchProduct.objects.create(
            research=research, product=product, brand_blocked=False,
        )
        NicheProductVisionAnalysis.objects.create(
            research=research, product=product,
            visual_style='vintage halftone, mustard + navy',
            graphic_elements='cartoon school bus + steaming mug',
            layout_composition='headline top, illustration centre, slogan bottom',
        )
    return niche, research, user


def _mock_openrouter_resp(payload_dict: dict, status_code: int = 200):
    """Return a MagicMock httpx.Response with `payload_dict` as the choice content."""
    content = json.dumps(payload_dict)
    body = {
        'choices': [{'message': {'content': content}}],
        'usage': {
            'prompt_tokens': 100,
            'completion_tokens': 200,
            'total_tokens': 300,
        },
    }
    resp = MagicMock(spec=httpx.Response)
    resp.json.return_value = body
    resp.status_code = status_code
    resp.text = json.dumps(body)
    resp.raise_for_status = MagicMock()
    return resp


def _mock_httpx_client(resp_or_exc):
    """Patch `httpx.Client` so its `post` returns `resp_or_exc` (or raises)."""
    mock_client = MagicMock()
    if isinstance(resp_or_exc, Exception):
        mock_client.post.side_effect = resp_or_exc
    else:
        mock_client.post.return_value = resp_or_exc
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    return mock_client


class TestStructureNicheForBuilder:
    @patch('niche_app.services.builder_hints.httpx.Client')
    def test_happy_path_stores_valid_hints(self, mock_client_cls, settings):
        settings.OPENROUTER_API_KEY = 'test-key'
        settings.OPENROUTER_BASE_URL = 'https://example.test/api/v1'
        niche, _, _ = _make_niche_with_completed_research()
        mock_client_cls.return_value = _mock_httpx_client(
            _mock_openrouter_resp(VALID_LLM_RESPONSE),
        )

        result = structure_niche_for_builder(niche.id)

        assert result is not None
        niche.refresh_from_db()
        hints = niche.builder_form_hints
        assert hints['spatial'] == 'vertical_stack'
        assert hints['accessories'] == VALID_LLM_RESPONSE['accessories']
        assert hints['visual'] == VALID_LLM_RESPONSE['visual']
        assert hints['_schema_version'] == SCHEMA_VERSION
        assert '_generated_at' in hints
        assert hints['_source_research_id']

    @patch('niche_app.services.builder_hints.httpx.Client')
    def test_unknown_spatial_id_drops_to_null(self, mock_client_cls, settings, caplog):
        settings.OPENROUTER_API_KEY = 'test-key'
        settings.OPENROUTER_BASE_URL = 'https://example.test/api/v1'
        niche, _, _ = _make_niche_with_completed_research()
        bad_payload = {**VALID_LLM_RESPONSE, 'spatial': 'nonsense_id'}
        mock_client_cls.return_value = _mock_httpx_client(
            _mock_openrouter_resp(bad_payload),
        )

        with caplog.at_level('WARNING'):
            structure_niche_for_builder(niche.id)

        niche.refresh_from_db()
        assert niche.builder_form_hints['spatial'] is None
        assert any(
            'dropping unknown spatial id' in rec.message
            for rec in caplog.records
        )

    @patch('niche_app.services.builder_hints.httpx.Client')
    def test_cache_hit_skips_llm(self, mock_client_cls, settings):
        settings.OPENROUTER_API_KEY = 'test-key'
        settings.OPENROUTER_BASE_URL = 'https://example.test/api/v1'
        niche, research, _ = _make_niche_with_completed_research()
        # Plant fresh hints whose `_generated_at` is newer than the latest
        # research's completed_at + with matching source-id.
        future_iso = (timezone.now() + _dt.timedelta(hours=1)).isoformat()
        niche.builder_form_hints = {
            '_schema_version': SCHEMA_VERSION,
            '_generated_at': future_iso,
            '_source_research_id': str(research.id),
            'spatial': 'vertical_stack',
            'visual': 'cached visual',
            'accessories': None,
            '_alternates': {
                'spatial': [], 'visual': [], 'accessories': [],
            },
        }
        niche.save(update_fields=['builder_form_hints'])

        result = structure_niche_for_builder(niche.id)

        assert result is not None
        assert result['visual'] == 'cached visual'
        mock_client_cls.assert_not_called()

    @patch('niche_app.services.builder_hints.httpx.Client')
    def test_force_bypasses_cache(self, mock_client_cls, settings):
        settings.OPENROUTER_API_KEY = 'test-key'
        settings.OPENROUTER_BASE_URL = 'https://example.test/api/v1'
        niche, research, _ = _make_niche_with_completed_research()
        future_iso = (timezone.now() + _dt.timedelta(hours=1)).isoformat()
        niche.builder_form_hints = {
            '_schema_version': SCHEMA_VERSION,
            '_generated_at': future_iso,
            '_source_research_id': str(research.id),
            'spatial': 'vertical_stack',
            'visual': 'cached',
            'accessories': None,
            '_alternates': {
                'spatial': [], 'visual': [], 'accessories': [],
            },
        }
        niche.save(update_fields=['builder_form_hints'])
        mock_client_cls.return_value = _mock_httpx_client(
            _mock_openrouter_resp(VALID_LLM_RESPONSE),
        )

        structure_niche_for_builder(niche.id, force=True)

        assert mock_client_cls.called

    @patch('niche_app.services.builder_hints.httpx.Client')
    def test_http_500_returns_none_gracefully(self, mock_client_cls, settings):
        settings.OPENROUTER_API_KEY = 'test-key'
        settings.OPENROUTER_BASE_URL = 'https://example.test/api/v1'
        niche, _, _ = _make_niche_with_completed_research()
        before = niche.builder_form_hints
        err_resp = MagicMock(spec=httpx.Response)
        err_resp.status_code = 500
        err_resp.text = 'upstream boom'
        exc = httpx.HTTPStatusError(
            'boom', request=MagicMock(), response=err_resp,
        )
        bad_resp = MagicMock(spec=httpx.Response)
        bad_resp.raise_for_status.side_effect = exc
        mock_client_cls.return_value = _mock_httpx_client(bad_resp)

        result = structure_niche_for_builder(niche.id)

        assert result is None
        niche.refresh_from_db()
        assert niche.builder_form_hints == before  # untouched

    @patch('niche_app.services.builder_hints.httpx.Client')
    def test_json_parse_error_handled(self, mock_client_cls, settings):
        settings.OPENROUTER_API_KEY = 'test-key'
        settings.OPENROUTER_BASE_URL = 'https://example.test/api/v1'
        niche, _, _ = _make_niche_with_completed_research()
        before = niche.builder_form_hints
        bad_body = {
            'choices': [{'message': {'content': 'not-json {{{'}}],
            'usage': {},
        }
        resp = MagicMock(spec=httpx.Response)
        resp.json.return_value = bad_body
        resp.raise_for_status = MagicMock()
        mock_client_cls.return_value = _mock_httpx_client(resp)

        result = structure_niche_for_builder(niche.id)

        assert result is None
        niche.refresh_from_db()
        assert niche.builder_form_hints == before

    @patch('niche_app.services.builder_hints.httpx.Client')
    def test_invalid_accessories_dropped(self, mock_client_cls, settings, caplog):
        settings.OPENROUTER_API_KEY = 'test-key'
        settings.OPENROUTER_BASE_URL = 'https://example.test/api/v1'
        niche, _, _ = _make_niche_with_completed_research()
        bad_payload = {
            **VALID_LLM_RESPONSE,
            'accessories': 'invented_accessory',
        }
        mock_client_cls.return_value = _mock_httpx_client(
            _mock_openrouter_resp(bad_payload),
        )

        with caplog.at_level('WARNING'):
            structure_niche_for_builder(niche.id)

        niche.refresh_from_db()
        # _validate_and_clean drops non-canonical accessories to None.
        assert niche.builder_form_hints['accessories'] is None
        assert any(
            'non-canonical accessories' in rec.message
            for rec in caplog.records
        )
