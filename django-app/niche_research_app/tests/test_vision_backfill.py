"""PROJ-34 Phase 13t-p — Tests for vision_backfill service.

Covers AC-137: schema parse, idempotency, empty-graphic skip, slogan-leakage smoke.
Mocks OpenRouter via patch of `httpx.Client` (pattern from
`design_app/tests/test_best_of_mix_generator.py`).
"""

import json
from unittest.mock import MagicMock, patch

import httpx
import pytest

from niche_research_app.services.vision_backfill import (
    BackfillOutputSchema,
    backfill_vision_descriptors,
)


# ─── Helpers ───────────────────────────────────────────────────────────────


def _mock_openrouter_resp(payload_dict: dict, status_code: int = 200):
    """Return a MagicMock httpx.Response wrapping `payload_dict` as JSON choice."""
    content = json.dumps(payload_dict)
    body = {
        'choices': [{'message': {'content': content}}],
        'usage': {
            'prompt_tokens': 200,
            'completion_tokens': 80,
            'total_tokens': 280,
        },
    }
    resp = MagicMock(spec=httpx.Response)
    resp.json.return_value = body
    resp.status_code = status_code
    resp.text = json.dumps(body)
    resp.raise_for_status = MagicMock()
    return resp


def _mock_httpx_client(resp):
    mock_client = MagicMock()
    mock_client.post.return_value = resp
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    return mock_client


def _apply_openrouter_settings(settings):
    settings.OPENROUTER_API_KEY = 'test-key'
    settings.OPENROUTER_BASE_URL = 'https://example.test/api/v1'


# ─── Tests ─────────────────────────────────────────────────────────────────


class TestBackfillOutputSchema:
    def test_parses_known_good_payload(self):
        schema = BackfillOutputSchema(
            typography_descriptors='bold uppercase block letters for the primary headline',
            font_combination_descriptors='Sans-serif uppercase paired with cursive accent',
            accessory_descriptors='white stars and decorative lines',
        )
        assert schema.typography_descriptors.startswith('bold')
        assert schema.font_combination_descriptors.startswith('Sans-serif')
        assert schema.accessory_descriptors.startswith('white stars')

    def test_defaults_to_empty_strings(self):
        schema = BackfillOutputSchema()
        assert schema.typography_descriptors == ''
        assert schema.font_combination_descriptors == ''
        assert schema.accessory_descriptors == ''


@pytest.mark.django_db
class TestBackfillIdempotency:
    def _make_eligible_row(self):
        # Build the minimal graph without invoking the heavy completed_research fixture
        from django.utils import timezone
        from niche_app.models import Niche
        from niche_research_app.models import (
            NicheProductVisionAnalysis,
            NicheResearch,
        )
        from scraper_app.models import AmazonProduct
        from user_auth_app.models import User
        from workspace_app.models import Membership, Workspace

        user = User.objects.create_user(
            email='vb@test.test', password='x', username='vb@test.test',
        )
        workspace = Workspace.objects.create(
            name='vb-ws', slug='vb-ws', owner=user,
        )
        Membership.objects.create(
            workspace=workspace, user=user, role='admin', status='active',
        )
        niche = Niche.objects.create(
            workspace=workspace, name='vb-niche', created_by=user,
        )
        research = NicheResearch.objects.create(
            niche=niche, triggered_by=user,
            status=NicheResearch.Status.COMPLETED,
            completed_at=timezone.now(),
            config_snapshot={},
        )
        product = AmazonProduct.objects.create(
            asin='B0VBIDEM01',
            marketplace='amazon_com',
            title='vb test',
            brand='vb',
        )
        row = NicheProductVisionAnalysis.objects.create(
            research=research, product=product,
            slogan_text='RETIRED SCHOOL BUS Driver',
            graphic_elements=(
                "The main motif is a simple, cartoon-style yellow school bus "
                "with 'SCHOOL BUS' written on its side. Typography is a mix "
                "of bold, block letters for emphasis (e.g., 'SCHOOL BUS') "
                "and cursive/script font for 'Driver' and 'Just Like'."
            ),
            is_niche_match=True,
        )
        return row

    @patch('niche_research_app.services.vision_backfill.httpx.Client')
    def test_skips_already_populated_rows(self, mock_client_cls, settings):
        _apply_openrouter_settings(settings)
        row = self._make_eligible_row()

        from niche_research_app.models import NicheProductVisionAnalysis
        NicheProductVisionAnalysis.objects.filter(id=row.id).update(
            typography_descriptors='already filled',
            font_combination_descriptors='already filled',
            accessory_descriptors='already filled',
        )

        summary = backfill_vision_descriptors(
            rows=NicheProductVisionAnalysis.objects.filter(id=row.id),
            dry_run=False,
        )

        assert summary.processed == 0
        assert summary.errored == 0
        mock_client_cls.assert_not_called()

    @patch('niche_research_app.services.vision_backfill.httpx.Client')
    def test_skips_rows_with_empty_graphic_elements(
        self, mock_client_cls, settings,
    ):
        _apply_openrouter_settings(settings)
        row = self._make_eligible_row()

        from niche_research_app.models import NicheProductVisionAnalysis
        NicheProductVisionAnalysis.objects.filter(id=row.id).update(
            graphic_elements='',
        )

        summary = backfill_vision_descriptors(
            rows=NicheProductVisionAnalysis.objects.filter(id=row.id),
            dry_run=False,
        )

        assert summary.processed == 0
        mock_client_cls.assert_not_called()

    @patch('niche_research_app.services.vision_backfill.httpx.Client')
    def test_force_reprocesses_already_populated_rows(
        self, mock_client_cls, settings,
    ):
        """Phase 13t-q5: --force bypasses empty-field filter."""
        _apply_openrouter_settings(settings)
        row = self._make_eligible_row()

        from niche_research_app.models import NicheProductVisionAnalysis
        NicheProductVisionAnalysis.objects.filter(id=row.id).update(
            typography_descriptors='stale old value',
            font_combination_descriptors='stale old value',
            accessory_descriptors='stale old value',
        )

        mock_client_cls.return_value = _mock_httpx_client(
            _mock_openrouter_resp({
                'typography_descriptors': 'enriched new value',
                'font_combination_descriptors': 'enriched new value',
                'accessory_descriptors': 'enriched new value',
            }),
        )

        summary = backfill_vision_descriptors(
            rows=NicheProductVisionAnalysis.objects.filter(id=row.id),
            dry_run=False,
            force=True,
        )

        assert summary.processed == 1
        row.refresh_from_db()
        assert row.typography_descriptors == 'enriched new value'
        assert row.font_combination_descriptors == 'enriched new value'
        assert row.accessory_descriptors == 'enriched new value'

    @patch('niche_research_app.services.vision_backfill.httpx.Client')
    def test_processes_eligible_row_and_persists(
        self, mock_client_cls, settings,
    ):
        _apply_openrouter_settings(settings)
        row = self._make_eligible_row()

        mock_client_cls.return_value = _mock_httpx_client(
            _mock_openrouter_resp({
                'typography_descriptors': 'bold block letters for primary headline',
                'font_combination_descriptors': 'sans-serif + cursive script accent',
                'accessory_descriptors': 'small bus motif as decorative element',
            }),
        )

        from niche_research_app.models import NicheProductVisionAnalysis
        summary = backfill_vision_descriptors(
            rows=NicheProductVisionAnalysis.objects.filter(id=row.id),
            dry_run=False,
        )

        assert summary.processed == 1
        assert summary.errored == 0
        row.refresh_from_db()
        assert 'primary headline' in row.typography_descriptors
        assert 'sans-serif' in row.font_combination_descriptors
        assert 'bus motif' in row.accessory_descriptors


@pytest.mark.django_db
class TestSloganLeakageSmoke:
    @patch('niche_research_app.services.vision_backfill.httpx.Client')
    def test_detects_slogan_leakage_when_llm_disobeys(
        self, mock_client_cls, settings,
    ):
        """AC-137 smoke check: if LLM returns literal slogan text, test detects it."""
        _apply_openrouter_settings(settings)

        # Use the fixture helper from the idempotency class
        row = TestBackfillIdempotency._make_eligible_row(
            TestBackfillIdempotency(),
        )
        slogan = row.slogan_text  # 'RETIRED SCHOOL BUS Driver'

        # Mock the LLM to MISBEHAVE — return text containing the slogan literally.
        mock_client_cls.return_value = _mock_httpx_client(
            _mock_openrouter_resp({
                'typography_descriptors': f"bold letters for '{slogan}'",
                'font_combination_descriptors': 'normal',
                'accessory_descriptors': 'none',
            }),
        )

        from niche_research_app.models import NicheProductVisionAnalysis
        backfill_vision_descriptors(
            rows=NicheProductVisionAnalysis.objects.filter(id=row.id),
            dry_run=False,
        )
        row.refresh_from_db()

        # Assert the leakage smoke check would catch it.
        # NOTE: this test demonstrates the leakage detection logic; it does NOT
        # assert the backfill cleans it (per Resolved Decision #23 — no sanitizer).
        assert slogan.lower() in row.typography_descriptors.lower(), (
            "Test setup error: mocked LLM should have written the slogan in"
        )
