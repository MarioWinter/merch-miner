"""PROJ-34 Phase 13d — CustomSpatial backend tests.

Covers:
- Model: workspace-scoped, partial-unique constraint allows recreating a
  soft-deleted name; ``clean()`` rules enforce source_kind invariants
- Analyze endpoint: upload happy path, reference_id happy path,
  design_id happy path, exactly-one validator, 10 MB limit, mime gate,
  forbidden-term scrub → 422, LAYOUT_UNCLEAR → 422, cross-workspace 404,
  auth 401
- CRUD: list returns only non-deleted from current workspace, create with
  conflicting name → 400, delete sets is_deleted, cross-workspace 404
- Scrub validator: color, hex code, style word, subject noun, phrase

The vision-LLM call is always mocked at ``httpx.post`` (the transport used
by ``design_app.services.spatial_analyzer``); no real network in tests.
"""

from __future__ import annotations

import io
import uuid
from unittest.mock import MagicMock, patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from design_app.models import CustomSpatial, Design, DesignProject, ProjectReference
from design_app.services.spatial_analyzer import _scrub_forbidden

pytestmark = pytest.mark.django_db


# ─── Fixtures ─────────────────────────────────────────────────────────────


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        email='spatial@example.com', password='pw',
    )


@pytest.fixture
def workspace(user):
    from workspace_app.models import Membership, Workspace
    ws = Workspace.objects.create(name='Spatial WS', slug='spatial-ws', owner=user)
    Membership.objects.create(
        workspace=ws, user=user, role='admin', status='active',
    )
    return ws


@pytest.fixture
def other_workspace(user):
    from workspace_app.models import Membership, Workspace
    ws = Workspace.objects.create(name='Other WS', slug='other-ws-spatial', owner=user)
    Membership.objects.create(
        workspace=ws, user=user, role='admin', status='active',
    )
    return ws


@pytest.fixture
def project(workspace, user):
    return DesignProject.objects.create(
        workspace=workspace, name='Spatial Proj', created_by=user,
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


_CLEAN_SPATIAL_TEXT = (
    'Badge emblem layout with a centered illustration block, the headline '
    'area arcing above and a subtitle line riding the lower arc. The outer '
    'ring frames the composition tightly while breathing room separates '
    'the inner illustration block from the headline area. The lower third '
    'remains empty to anchor the badge.'
)


# ─── Model + constraint tests (5) ─────────────────────────────────────────


class TestCustomSpatialModel:
    def test_partial_unique_constraint_allows_recreating_deleted_name(
        self, workspace, user,
    ):
        cs1 = CustomSpatial.objects.create(
            workspace=workspace,
            created_by=user,
            name='dup',
            prompt_text='Badge layout' + ' .' * 30,
            source_kind='upload',
            source_image_file=SimpleUploadedFile('a.jpg', _tiny_jpg_bytes()),
        )
        cs1.is_deleted = True
        cs1.save(update_fields=['is_deleted', 'updated_at'])

        # Re-create with the same name — must succeed (partial unique).
        cs2 = CustomSpatial.objects.create(
            workspace=workspace,
            created_by=user,
            name='dup',
            prompt_text='Stacked layout' + ' .' * 30,
            source_kind='upload',
            source_image_file=SimpleUploadedFile('b.jpg', _tiny_jpg_bytes()),
        )
        assert cs2.pk != cs1.pk

    def test_unique_constraint_blocks_active_duplicate(self, workspace, user):
        from django.db import IntegrityError
        CustomSpatial.objects.create(
            workspace=workspace,
            created_by=user,
            name='active-name',
            prompt_text='Layout' + ' .' * 30,
            source_kind='upload',
            source_image_file=SimpleUploadedFile('a.jpg', _tiny_jpg_bytes()),
        )
        with pytest.raises(IntegrityError):
            CustomSpatial.objects.create(
                workspace=workspace,
                created_by=user,
                name='active-name',
                prompt_text='Other layout' + ' .' * 30,
                source_kind='upload',
                source_image_file=SimpleUploadedFile('b.jpg', _tiny_jpg_bytes()),
            )

    def test_clean_rejects_upload_kind_without_file(self, workspace, user):
        from django.core.exceptions import ValidationError
        cs = CustomSpatial(
            workspace=workspace,
            created_by=user,
            name='nofile',
            prompt_text='Layout',
            source_kind='upload',
        )
        with pytest.raises(ValidationError):
            cs.clean()

    def test_clean_rejects_reference_kind_with_file(self, workspace, user):
        from django.core.exceptions import ValidationError
        cs = CustomSpatial(
            workspace=workspace,
            created_by=user,
            name='ref-with-file',
            prompt_text='Layout',
            source_kind='reference',
            source_image_ref=str(uuid.uuid4()),
            source_image_file=SimpleUploadedFile('a.jpg', _tiny_jpg_bytes()),
        )
        with pytest.raises(ValidationError):
            cs.clean()

    def test_clean_rejects_reference_kind_without_ref(self, workspace, user):
        from django.core.exceptions import ValidationError
        cs = CustomSpatial(
            workspace=workspace,
            created_by=user,
            name='ref-no-ref',
            prompt_text='Layout',
            source_kind='reference',
            source_image_ref='',
        )
        with pytest.raises(ValidationError):
            cs.clean()


# ─── Analyze endpoint tests (11) ──────────────────────────────────────────


@pytest.mark.django_db
class TestCustomSpatialAnalyze:
    URL = '/api/designs/spatials/custom/analyze/'

    @patch('design_app.services.spatial_analyzer.httpx.post')
    def test_analyze_upload_happy_path(self, mock_post, auth_client, settings):
        settings.OPENROUTER_API_KEY = 'test-key'
        settings.OPENROUTER_BASE_URL = 'https://test.openrouter.ai/v1'
        mock_post.return_value = _make_mock_llm_response(_CLEAN_SPATIAL_TEXT)

        upload = SimpleUploadedFile(
            'design.jpg', _tiny_jpg_bytes(), content_type='image/jpeg',
        )
        resp = auth_client.post(
            self.URL, data={'image': upload}, format='multipart',
        )
        assert resp.status_code == 200, resp.content
        body = resp.json()
        assert body['prompt_text'] == _CLEAN_SPATIAL_TEXT
        assert body['model'] == 'openai/gpt-4.1-mini'
        mock_post.assert_called_once()

    @patch('design_app.api.views.httpx.get')
    @patch('design_app.services.spatial_analyzer.httpx.post')
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

        mock_llm_post.return_value = _make_mock_llm_response(_CLEAN_SPATIAL_TEXT)

        ref = ProjectReference.objects.create(
            project=project,
            image_url='https://example.com/ref.jpg',
            title='Test ref',
        )
        resp = auth_client.post(
            self.URL, data={'reference_id': str(ref.id)}, format='json',
        )
        assert resp.status_code == 200, resp.content
        assert resp.json()['prompt_text'] == _CLEAN_SPATIAL_TEXT
        mock_url_get.assert_called_once()
        mock_llm_post.assert_called_once()

    @patch('design_app.services.spatial_analyzer.httpx.post')
    def test_analyze_design_id_happy_path(
        self, mock_post, auth_client, workspace, user, settings,
    ):
        settings.OPENROUTER_API_KEY = 'test-key'
        settings.OPENROUTER_BASE_URL = 'https://test.openrouter.ai/v1'
        mock_post.return_value = _make_mock_llm_response(_CLEAN_SPATIAL_TEXT)

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
        assert resp.json()['prompt_text'] == _CLEAN_SPATIAL_TEXT

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

    @patch('design_app.services.spatial_analyzer.httpx.post')
    def test_analyze_forbidden_term_returns_422(
        self, mock_post, auth_client, settings,
    ):
        settings.OPENROUTER_API_KEY = 'test-key'
        settings.OPENROUTER_BASE_URL = 'https://test.openrouter.ai/v1'
        # LLM mentions "red" → must be scrubbed.
        bad_text = (
            'Badge layout with a centered red illustration block, the '
            'headline area arcing above and a subtitle line below. Outer '
            'ring frames the composition tightly with generous breathing '
            'room between the headline area and the illustration block.'
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
        assert body['error'] == 'spatial_analysis_failed'
        assert 'red' in body['forbidden_terms']

    @patch('design_app.services.spatial_analyzer.httpx.post')
    def test_analyze_spatial_unclear_returns_422(
        self, mock_post, auth_client, settings,
    ):
        settings.OPENROUTER_API_KEY = 'test-key'
        settings.OPENROUTER_BASE_URL = 'https://test.openrouter.ai/v1'
        mock_post.return_value = _make_mock_llm_response('LAYOUT_UNCLEAR')

        upload = SimpleUploadedFile(
            'd.jpg', _tiny_jpg_bytes(), content_type='image/jpeg',
        )
        resp = auth_client.post(
            self.URL, data={'image': upload}, format='multipart',
        )
        assert resp.status_code == 422
        assert resp.json()['error'] == 'spatial_unclear'

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


class TestCustomSpatialCRUD:
    LIST_URL = '/api/designs/spatials/custom/'

    def _valid_payload(self, name: str = 'My Custom') -> dict:
        return {
            'name': name,
            'prompt_text': (
                'Badge emblem layout with a centered illustration block, '
                'the headline area arcing above and a subtitle line below.'
            ),
            'source_kind': 'reference',
            'source_image_ref': str(uuid.uuid4()),
        }

    def test_list_returns_only_workspace_non_deleted(
        self, auth_client, workspace, other_workspace, user,
    ):
        # Two active rows in caller's workspace
        CustomSpatial.objects.create(
            workspace=workspace, created_by=user,
            name='A',
            prompt_text='Layout A' + ' .' * 30,
            source_kind='reference',
            source_image_ref=str(uuid.uuid4()),
        )
        deleted = CustomSpatial.objects.create(
            workspace=workspace, created_by=user,
            name='B-deleted',
            prompt_text='Layout B' + ' .' * 30,
            source_kind='reference',
            source_image_ref=str(uuid.uuid4()),
        )
        deleted.is_deleted = True
        deleted.save(update_fields=['is_deleted', 'updated_at'])

        # One in another workspace (must be filtered out)
        CustomSpatial.objects.create(
            workspace=other_workspace, created_by=user,
            name='Cross',
            prompt_text='Layout Cross' + ' .' * 30,
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
        cs = CustomSpatial.objects.get(name='OwnedTest')
        assert cs.created_by_id == user.id
        assert cs.workspace_id == workspace.id

    def test_destroy_soft_deletes(self, auth_client, workspace, user):
        cs = CustomSpatial.objects.create(
            workspace=workspace, created_by=user,
            name='to-delete',
            prompt_text='Layout' + ' .' * 30,
            source_kind='reference',
            source_image_ref=str(uuid.uuid4()),
        )
        resp = auth_client.delete(f'{self.LIST_URL}{cs.id}/')
        assert resp.status_code == 204

        cs.refresh_from_db()
        assert cs.is_deleted is True

        # GET list excludes it
        resp = auth_client.get(self.LIST_URL)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_destroy_cross_workspace_404(
        self, auth_client, other_workspace, user,
    ):
        cs = CustomSpatial.objects.create(
            workspace=other_workspace, created_by=user,
            name='cross-ws',
            prompt_text='Layout' + ' .' * 30,
            source_kind='reference',
            source_image_ref=str(uuid.uuid4()),
        )
        resp = auth_client.delete(f'{self.LIST_URL}{cs.id}/')
        assert resp.status_code == 404

    def test_create_no_auth_401(self, workspace):
        c = APIClient()
        c.credentials(HTTP_X_WORKSPACE_ID=str(workspace.id))
        resp = c.post(
            self.LIST_URL,
            data={
                'name': 'NA',
                'prompt_text': 'Layout' + ' .' * 30,
                'source_kind': 'reference',
                'source_image_ref': str(uuid.uuid4()),
            },
            format='json',
        )
        assert resp.status_code == 401


# ─── Scrub validator unit tests (6) ───────────────────────────────────────


class TestScrubForbidden:
    def test_scrub_passes_clean_text(self):
        ok, hits = _scrub_forbidden(
            'Badge layout with a centered illustration block above the '
            'headline area; subtitle line rides the lower arc with '
            'generous breathing room.'
        )
        assert ok is True
        assert hits == []

    def test_scrub_catches_color(self):
        ok, hits = _scrub_forbidden(
            'A diagonal layout with the red illustration block in the '
            'upper-left and the headline arcing below it.'
        )
        assert ok is False
        assert 'red' in hits

    def test_scrub_catches_hex_code(self):
        ok, hits = _scrub_forbidden(
            'Stacked layout with the headline area #FF5A4F filling the '
            'upper third above the illustration block.'
        )
        assert ok is False
        assert 'hex_code' in hits

    def test_scrub_catches_style_word(self):
        ok, hits = _scrub_forbidden(
            'A vintage badge emblem layout with text arcing above the '
            'illustration block in the centre of the composition.'
        )
        assert ok is False
        assert 'vintage' in hits

    def test_scrub_catches_subject_noun(self):
        ok, hits = _scrub_forbidden(
            'Badge layout with a centred guitar illustration above the '
            'headline arc, subtitle line riding the lower border.'
        )
        assert ok is False
        assert 'guitar' in hits

    def test_scrub_catches_phrase(self):
        ok, hits = _scrub_forbidden(
            'Badge emblem layout with a centred illustration block sitting '
            'above the headline area with a soft shadow framing the lower '
            'subtitle line.'
        )
        assert ok is False
        assert 'soft shadow' in hits


# ─── Resolver tests (2) — Phase 13b resolver now resolves real CustomSpatials


class TestResolveSpatialWithCustomSpatial:
    """Phase 13d follow-up: now that ``CustomSpatial`` ships, the resolver
    branch must actually return the prompt_text for a saved row, and must
    fall through cleanly when the row is soft-deleted.
    """

    def test_uuid_resolves_to_custom_spatial_prompt_text(self, workspace, user):
        from design_app.services.prompt_builder import _resolve_spatial
        cs = CustomSpatial.objects.create(
            workspace=workspace, created_by=user,
            name='res1',
            prompt_text='Diagonal split layout with the illustration block '
                        'occupying the upper-left and headline arcing across.',
            source_kind='reference',
            source_image_ref=str(uuid.uuid4()),
        )
        out = _resolve_spatial(
            user_val=str(cs.id),
            niche_hint_id=None,
            workspace_id=str(workspace.id),
        )
        assert out == cs.prompt_text

    def test_uuid_for_deleted_custom_falls_through(self, workspace, user):
        from design_app.services.prompt_builder import _resolve_spatial
        cs = CustomSpatial.objects.create(
            workspace=workspace, created_by=user,
            name='res2',
            prompt_text='Vertical stack layout with the headline area above '
                        'the illustration block and subtitle line below.',
            source_kind='reference',
            source_image_ref=str(uuid.uuid4()),
        )
        cs.is_deleted = True
        cs.save(update_fields=['is_deleted', 'updated_at'])
        out = _resolve_spatial(
            user_val=str(cs.id),
            niche_hint_id=None,
            workspace_id=str(workspace.id),
        )
        # Falls through to omit when no hint/default supplied.
        assert out == ''
