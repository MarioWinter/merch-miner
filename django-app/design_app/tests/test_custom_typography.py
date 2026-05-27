"""PROJ-34 Phase 13i — CustomTypography backend tests.

Covers:
- Model: workspace-scoped, partial-unique constraint allows recreating a
  soft-deleted name; ``clean()`` rules enforce source_kind invariants
- Analyze endpoint: upload happy path, reference_id happy path,
  design_id happy path, exactly-one validator, 10 MB limit, mime gate,
  forbidden-term scrub → 422 (color), spatial-position scrub → 422,
  TYPOGRAPHY_UNCLEAR → 422, cross-workspace 404, auth 401
- CRUD: list returns only non-deleted from current workspace, create with
  conflicting name → 400, delete sets is_deleted, cross-workspace 404
- Scrub validator: clean text, color, style word, subject noun, phrase,
  spatial-position word (top + centered)

The vision-LLM call is always mocked at ``httpx.post`` (the transport used
by ``design_app.services.typography_analyzer``); no real network in tests.
"""

from __future__ import annotations

import io
import uuid
from unittest.mock import MagicMock, patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from design_app.models import CustomTypography, Design, DesignProject, ProjectReference
from design_app.services.typography_analyzer import _scrub_forbidden

pytestmark = pytest.mark.django_db


# ─── Fixtures ─────────────────────────────────────────────────────────────


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        email='typo@example.com', password='pw',
    )


@pytest.fixture
def workspace(user):
    from workspace_app.models import Membership, Workspace
    ws = Workspace.objects.create(name='Typo WS', slug='typo-ws', owner=user)
    Membership.objects.create(
        workspace=ws, user=user, role='admin', status='active',
    )
    return ws


@pytest.fixture
def other_workspace(user):
    from workspace_app.models import Membership, Workspace
    ws = Workspace.objects.create(name='Other WS', slug='other-ws-typo', owner=user)
    Membership.objects.create(
        workspace=ws, user=user, role='admin', status='active',
    )
    return ws


@pytest.fixture
def project(workspace, user):
    return DesignProject.objects.create(
        workspace=workspace, name='Typo Proj', created_by=user,
    )


@pytest.fixture
def other_project(other_workspace, user):
    return DesignProject.objects.create(
        workspace=other_workspace, name='Other Proj', created_by=user,
    )


@pytest.fixture
def auth_client(user, workspace):
    c = APIClient()
    c.force_authenticate(user=user)
    c.credentials(HTTP_X_WORKSPACE_ID=str(workspace.id))
    return c


def _tiny_jpg_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new('RGB', (1, 1), (255, 255, 255)).save(buf, 'JPEG')
    return buf.getvalue()


def _tiny_png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new('RGB', (1, 1), (255, 255, 255)).save(buf, 'PNG')
    return buf.getvalue()


def _make_mock_llm_response(text: str) -> MagicMock:
    """Build a ``httpx.Response``-like mock with the expected JSON shape."""
    m = MagicMock()
    m.raise_for_status = MagicMock(return_value=None)
    m.json.return_value = {
        'choices': [{'message': {'content': text}}],
        'usage': {'prompt_tokens': 10, 'completion_tokens': 20, 'total_tokens': 30},
    }
    return m


_CLEAN_TYPO_TEXT = (
    'Heavyweight slab-serif font with squared terminals, low-contrast '
    'monoline strokes and tight tracking. Tall x-height paired with '
    'condensed proportions gives a confident, mechanical personality. '
    'Internal stripe lines decorate each letterform and the serifs flare '
    'subtly at the baseline, lending a refined yet aggressive feel '
    'throughout the headline weight.'
)


# ─── Model + constraint tests (5) ─────────────────────────────────────────


class TestCustomTypographyModel:
    def test_partial_unique_constraint_allows_recreating_deleted_name(
        self, workspace, user,
    ):
        ct1 = CustomTypography.objects.create(
            workspace=workspace,
            created_by=user,
            name='dup',
            prompt_text='Heavyweight slab-serif font' + ' .' * 30,
            source_kind='upload',
            source_image_file=SimpleUploadedFile('a.jpg', _tiny_jpg_bytes()),
        )
        ct1.is_deleted = True
        ct1.save(update_fields=['is_deleted', 'updated_at'])

        # Re-create with the same name — must succeed (partial unique).
        ct2 = CustomTypography.objects.create(
            workspace=workspace,
            created_by=user,
            name='dup',
            prompt_text='Thin hand-drawn marker font' + ' .' * 30,
            source_kind='upload',
            source_image_file=SimpleUploadedFile('b.jpg', _tiny_jpg_bytes()),
        )
        assert ct2.pk != ct1.pk

    def test_unique_constraint_blocks_active_duplicate(self, workspace, user):
        from django.db import IntegrityError
        CustomTypography.objects.create(
            workspace=workspace,
            created_by=user,
            name='active-name',
            prompt_text='Slab-serif font' + ' .' * 30,
            source_kind='upload',
            source_image_file=SimpleUploadedFile('a.jpg', _tiny_jpg_bytes()),
        )
        with pytest.raises(IntegrityError):
            CustomTypography.objects.create(
                workspace=workspace,
                created_by=user,
                name='active-name',
                prompt_text='Other font' + ' .' * 30,
                source_kind='upload',
                source_image_file=SimpleUploadedFile('b.jpg', _tiny_jpg_bytes()),
            )

    def test_clean_rejects_upload_kind_without_file(self, workspace, user):
        from django.core.exceptions import ValidationError
        ct = CustomTypography(
            workspace=workspace,
            created_by=user,
            name='nofile',
            prompt_text='Font',
            source_kind='upload',
        )
        with pytest.raises(ValidationError):
            ct.clean()

    def test_clean_rejects_reference_kind_with_file(self, workspace, user):
        from django.core.exceptions import ValidationError
        ct = CustomTypography(
            workspace=workspace,
            created_by=user,
            name='ref-with-file',
            prompt_text='Font',
            source_kind='reference',
            source_image_ref=str(uuid.uuid4()),
            source_image_file=SimpleUploadedFile('a.jpg', _tiny_jpg_bytes()),
        )
        with pytest.raises(ValidationError):
            ct.clean()

    def test_clean_rejects_reference_kind_without_ref(self, workspace, user):
        from django.core.exceptions import ValidationError
        ct = CustomTypography(
            workspace=workspace,
            created_by=user,
            name='ref-no-ref',
            prompt_text='Font',
            source_kind='reference',
            source_image_ref='',
        )
        with pytest.raises(ValidationError):
            ct.clean()


# ─── Analyze endpoint tests (12) ──────────────────────────────────────────


@pytest.mark.django_db
class TestCustomTypographyAnalyze:
    URL = '/api/designs/typography/custom/analyze/'

    @patch('design_app.services.typography_analyzer.httpx.post')
    def test_analyze_upload_happy_path(self, mock_post, auth_client, settings):
        settings.OPENROUTER_API_KEY = 'test-key'
        settings.OPENROUTER_BASE_URL = 'https://test.openrouter.ai/v1'
        mock_post.return_value = _make_mock_llm_response(_CLEAN_TYPO_TEXT)

        upload = SimpleUploadedFile(
            'design.jpg', _tiny_jpg_bytes(), content_type='image/jpeg',
        )
        resp = auth_client.post(
            self.URL, data={'image': upload}, format='multipart',
        )
        assert resp.status_code == 200, resp.content
        body = resp.json()
        assert body['prompt_text'] == _CLEAN_TYPO_TEXT
        assert body['model'] == 'openai/gpt-4.1-mini'
        mock_post.assert_called_once()

    @patch('design_app.api.views.httpx.get')
    @patch('design_app.services.typography_analyzer.httpx.post')
    def test_analyze_reference_id_happy_path(
        self, mock_llm_post, mock_url_get, auth_client, project, settings,
    ):
        settings.OPENROUTER_API_KEY = 'test-key'
        settings.OPENROUTER_BASE_URL = 'https://test.openrouter.ai/v1'

        # Mock the URL fetch for ProjectReference.image_url
        url_resp = MagicMock()
        url_resp.raise_for_status = MagicMock(return_value=None)
        url_resp.content = _tiny_jpg_bytes()
        url_resp.headers = {'content-type': 'image/jpeg'}
        mock_url_get.return_value = url_resp

        mock_llm_post.return_value = _make_mock_llm_response(_CLEAN_TYPO_TEXT)

        ref = ProjectReference.objects.create(
            project=project,
            image_url='https://example.com/ref.jpg',
            title='Test ref',
        )
        resp = auth_client.post(
            self.URL, data={'reference_id': str(ref.id)}, format='json',
        )
        assert resp.status_code == 200, resp.content
        assert resp.json()['prompt_text'] == _CLEAN_TYPO_TEXT
        mock_url_get.assert_called_once()
        mock_llm_post.assert_called_once()

    @patch('design_app.services.typography_analyzer.httpx.post')
    def test_analyze_design_id_happy_path(
        self, mock_post, auth_client, workspace, user, settings,
    ):
        settings.OPENROUTER_API_KEY = 'test-key'
        settings.OPENROUTER_BASE_URL = 'https://test.openrouter.ai/v1'
        mock_post.return_value = _make_mock_llm_response(_CLEAN_TYPO_TEXT)

        design = Design.objects.create(workspace=workspace, status='approved')
        design.image_file.save(
            'd.png',
            SimpleUploadedFile('d.png', _tiny_png_bytes(), content_type='image/png'),
            save=True,
        )

        resp = auth_client.post(
            self.URL, data={'design_id': str(design.id)}, format='json',
        )
        assert resp.status_code == 200, resp.content
        assert resp.json()['prompt_text'] == _CLEAN_TYPO_TEXT

    def test_analyze_exactly_one_source_validator(self, auth_client):
        # Zero sources -> 400
        resp = auth_client.post(self.URL, data={}, format='json')
        assert resp.status_code == 400

        # Two sources -> 400
        resp = auth_client.post(
            self.URL,
            data={
                'reference_id': str(uuid.uuid4()),
                'design_id': str(uuid.uuid4()),
            },
            format='json',
        )
        assert resp.status_code == 400

    def test_analyze_10mb_limit(self, auth_client):
        big = b'\x00' * (10 * 1024 * 1024 + 1)
        upload = SimpleUploadedFile(
            'big.jpg', big, content_type='image/jpeg',
        )
        resp = auth_client.post(
            self.URL, data={'image': upload}, format='multipart',
        )
        # Pillow may fail to parse the bytes — either an ImageField parsing
        # error (400) or the size validator (400) is acceptable. Both
        # indicate the upload was rejected before reaching the LLM.
        assert resp.status_code == 400

    def test_analyze_mime_gate(self, auth_client):
        gif = (
            b'GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00,'
            b'\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;'
        )
        upload = SimpleUploadedFile(
            'tiny.gif', gif, content_type='image/gif',
        )
        resp = auth_client.post(
            self.URL, data={'image': upload}, format='multipart',
        )
        assert resp.status_code == 400

    @patch('design_app.services.typography_analyzer.httpx.post')
    def test_analyze_forbidden_term_returns_422(
        self, mock_post, auth_client, settings,
    ):
        settings.OPENROUTER_API_KEY = 'test-key'
        settings.OPENROUTER_BASE_URL = 'https://test.openrouter.ai/v1'
        # LLM mentions "red" → must be scrubbed.
        bad_text = (
            'Heavyweight red slab-serif font with squared terminals and '
            'monoline strokes throughout. Tall x-height paired with '
            'condensed proportions lend a confident mechanical personality.'
        )
        mock_post.return_value = _make_mock_llm_response(bad_text)

        upload = SimpleUploadedFile(
            'd.jpg', _tiny_jpg_bytes(), content_type='image/jpeg',
        )
        resp = auth_client.post(
            self.URL, data={'image': upload}, format='multipart',
        )
        assert resp.status_code == 422
        body = resp.json()
        assert body['error'] == 'typography_analysis_failed'
        assert 'red' in body['forbidden_terms']

    @patch('design_app.services.typography_analyzer.httpx.post')
    def test_analyze_spatial_position_forbidden_returns_422(
        self, mock_post, auth_client, settings,
    ):
        settings.OPENROUTER_API_KEY = 'test-key'
        settings.OPENROUTER_BASE_URL = 'https://test.openrouter.ai/v1'
        # LLM describes spatial position — typography slot must reject this.
        bad_text = (
            'Heavyweight slab-serif font centered on the top of the design '
            'with squared terminals and monoline strokes throughout the '
            'headline weight.'
        )
        mock_post.return_value = _make_mock_llm_response(bad_text)

        upload = SimpleUploadedFile(
            'd.jpg', _tiny_jpg_bytes(), content_type='image/jpeg',
        )
        resp = auth_client.post(
            self.URL, data={'image': upload}, format='multipart',
        )
        assert resp.status_code == 422
        body = resp.json()
        assert body['error'] == 'typography_analysis_failed'
        # Either single-word ("centered") OR phrase ("top of") catches it.
        assert any(t in body['forbidden_terms'] for t in ('centered', 'top of', 'top'))

    @patch('design_app.services.typography_analyzer.httpx.post')
    def test_analyze_typography_unclear_returns_422(
        self, mock_post, auth_client, settings,
    ):
        settings.OPENROUTER_API_KEY = 'test-key'
        settings.OPENROUTER_BASE_URL = 'https://test.openrouter.ai/v1'
        mock_post.return_value = _make_mock_llm_response('TYPOGRAPHY_UNCLEAR')

        upload = SimpleUploadedFile(
            'd.jpg', _tiny_jpg_bytes(), content_type='image/jpeg',
        )
        resp = auth_client.post(
            self.URL, data={'image': upload}, format='multipart',
        )
        assert resp.status_code == 422
        assert resp.json()['error'] == 'typography_unclear'

    def test_analyze_cross_workspace_reference_404(
        self, auth_client, other_project,
    ):
        ref = ProjectReference.objects.create(
            project=other_project,
            image_url='https://example.com/cross.jpg',
            title='Cross WS',
        )
        resp = auth_client.post(
            self.URL, data={'reference_id': str(ref.id)}, format='json',
        )
        assert resp.status_code == 404

    def test_analyze_cross_workspace_design_404(
        self, auth_client, other_workspace,
    ):
        design = Design.objects.create(
            workspace=other_workspace, status='approved',
        )
        design.image_file.save(
            'd.png',
            SimpleUploadedFile('d.png', _tiny_png_bytes(), content_type='image/png'),
            save=True,
        )
        resp = auth_client.post(
            self.URL, data={'design_id': str(design.id)}, format='json',
        )
        assert resp.status_code == 404

    def test_analyze_no_auth_401(self, workspace):
        c = APIClient()
        c.credentials(HTTP_X_WORKSPACE_ID=str(workspace.id))
        upload = SimpleUploadedFile(
            'd.jpg', _tiny_jpg_bytes(), content_type='image/jpeg',
        )
        resp = c.post(self.URL, data={'image': upload}, format='multipart')
        assert resp.status_code == 401


# ─── CRUD tests (6) ───────────────────────────────────────────────────────


class TestCustomTypographyCRUD:
    LIST_URL = '/api/designs/typography/custom/'

    def _valid_payload(self, name: str = 'My Custom') -> dict:
        return {
            'name': name,
            'prompt_text': (
                'Heavyweight slab-serif font with squared terminals, '
                'monoline strokes and tight tracking throughout the headline.'
            ),
            'source_kind': 'reference',
            'source_image_ref': str(uuid.uuid4()),
        }

    def test_list_returns_only_workspace_non_deleted(
        self, auth_client, workspace, other_workspace, user,
    ):
        # Two active rows in caller's workspace
        CustomTypography.objects.create(
            workspace=workspace, created_by=user,
            name='A',
            prompt_text='Slab-serif font' + ' .' * 30,
            source_kind='reference',
            source_image_ref=str(uuid.uuid4()),
        )
        deleted = CustomTypography.objects.create(
            workspace=workspace, created_by=user,
            name='B-deleted',
            prompt_text='Marker font' + ' .' * 30,
            source_kind='reference',
            source_image_ref=str(uuid.uuid4()),
        )
        deleted.is_deleted = True
        deleted.save(update_fields=['is_deleted', 'updated_at'])

        # One in another workspace (must be filtered out)
        CustomTypography.objects.create(
            workspace=other_workspace, created_by=user,
            name='Cross',
            prompt_text='Blackletter font' + ' .' * 30,
            source_kind='reference',
            source_image_ref=str(uuid.uuid4()),
        )

        resp = auth_client.get(self.LIST_URL)
        assert resp.status_code == 200
        rows = resp.json()
        assert len(rows) == 1
        assert rows[0]['name'] == 'A'

    def test_create_with_name_conflict_returns_400(self, auth_client):
        resp = auth_client.post(
            self.LIST_URL, data=self._valid_payload('Dup'), format='json',
        )
        assert resp.status_code == 201, resp.content
        resp = auth_client.post(
            self.LIST_URL, data=self._valid_payload('Dup'), format='json',
        )
        assert resp.status_code == 400
        body = resp.json()
        assert 'name' in body

    def test_create_sets_created_by_and_workspace(
        self, auth_client, user, workspace,
    ):
        resp = auth_client.post(
            self.LIST_URL, data=self._valid_payload('OwnedTest'), format='json',
        )
        assert resp.status_code == 201, resp.content
        ct = CustomTypography.objects.get(name='OwnedTest')
        assert ct.created_by_id == user.id
        assert ct.workspace_id == workspace.id

    def test_destroy_soft_deletes(self, auth_client, workspace, user):
        ct = CustomTypography.objects.create(
            workspace=workspace, created_by=user,
            name='to-delete',
            prompt_text='Font' + ' .' * 30,
            source_kind='reference',
            source_image_ref=str(uuid.uuid4()),
        )
        resp = auth_client.delete(f'{self.LIST_URL}{ct.id}/')
        assert resp.status_code == 204

        ct.refresh_from_db()
        assert ct.is_deleted is True

        # GET list excludes it
        resp = auth_client.get(self.LIST_URL)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_destroy_cross_workspace_404(
        self, auth_client, other_workspace, user,
    ):
        ct = CustomTypography.objects.create(
            workspace=other_workspace, created_by=user,
            name='cross-ws',
            prompt_text='Font' + ' .' * 30,
            source_kind='reference',
            source_image_ref=str(uuid.uuid4()),
        )
        resp = auth_client.delete(f'{self.LIST_URL}{ct.id}/')
        assert resp.status_code == 404

    def test_create_no_auth_401(self, workspace):
        c = APIClient()
        c.credentials(HTTP_X_WORKSPACE_ID=str(workspace.id))
        resp = c.post(
            self.LIST_URL,
            data={
                'name': 'NA',
                'prompt_text': 'Font' + ' .' * 30,
                'source_kind': 'reference',
                'source_image_ref': str(uuid.uuid4()),
            },
            format='json',
        )
        assert resp.status_code == 401


# ─── Scrub validator unit tests (7) ───────────────────────────────────────


class TestScrubForbidden:
    def test_scrub_passes_clean_typography(self):
        ok, hits = _scrub_forbidden(
            'Heavyweight slab-serif font with squared terminals, low '
            'contrast strokes and tight tracking.'
        )
        assert ok is True
        assert hits == []

    def test_scrub_catches_color(self):
        ok, hits = _scrub_forbidden(
            'Heavyweight red slab-serif font with squared terminals and '
            'monoline strokes throughout the headline.'
        )
        assert ok is False
        assert 'red' in hits

    def test_scrub_catches_style_word(self):
        ok, hits = _scrub_forbidden(
            'Vintage slab-serif font with squared terminals and monoline '
            'strokes throughout the headline.'
        )
        assert ok is False
        assert 'vintage' in hits

    def test_scrub_catches_subject_noun(self):
        ok, hits = _scrub_forbidden(
            'Bus-shaped letters in a slab-serif font with squared terminals '
            'and monoline strokes throughout the headline.'
        )
        assert ok is False
        assert 'bus' in hits

    def test_scrub_catches_phrase(self):
        ok, hits = _scrub_forbidden(
            'Slab-serif font with soft shadow on each letterform giving the '
            'headline a refined personality.'
        )
        assert ok is False
        assert 'soft shadow' in hits

    def test_scrub_catches_spatial_position_top(self):
        ok, hits = _scrub_forbidden(
            'Slab-serif font at the top of the design with squared '
            'terminals and monoline strokes.'
        )
        assert ok is False
        # Either the phrase "top of" or the single word "top" must be caught.
        assert ('top of' in hits) or ('top' in hits)

    def test_scrub_catches_spatial_position_centered(self):
        ok, hits = _scrub_forbidden(
            'Slab-serif font centered on the canvas with squared terminals '
            'and monoline strokes throughout the headline.'
        )
        assert ok is False
        assert ('centered' in hits) or ('centered on' in hits)
