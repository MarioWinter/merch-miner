"""Tests for ``POST /api/design-assets/from-design/`` (PROJ-9 Phase O bridge).

Covers AC-160 / AC-163 / AC-164 / AC-165 / AC-166 / AC-167 / AC-171 +
EC-53..EC-60.
"""

import uuid
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from rest_framework.test import APIClient

from design_app.models import Design
from idea_app.models import Idea
from niche_app.models import Niche
from publish_app.models import DesignAsset
from workspace_app.models import Membership, Workspace

User = get_user_model()

URL = '/api/design-assets/from-design/'

# Minimal 1x1 PNG (8 bytes header is enough for FileField; pillow not required
# in tests because the view never opens the image, just copies bytes).
PNG_BYTES = (
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
    b'\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89'
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def user(db):
    return User.objects.create_user(email='o-test@example.com', password='x')


@pytest.fixture
def workspace(user):
    return Workspace.objects.create(name='WS', slug='ws', owner=user)


@pytest.fixture
def membership(workspace, user):
    return Membership.objects.create(
        workspace=workspace, user=user,
        role=Membership.Role.ADMIN, status=Membership.Status.ACTIVE,
    )


@pytest.fixture
def api_client(user, membership):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def niche(workspace, user):
    return Niche.objects.create(
        workspace=workspace, name='Cats', created_by=user,
    )


@pytest.fixture
def idea(workspace, niche, user):
    return Idea.objects.create(
        workspace=workspace, niche=niche,
        slogan_text='Cat Person', created_by=user,
    )


def _make_design(workspace, idea=None, status=Design.Status.APPROVED, with_file=True):
    d = Design(workspace=workspace, idea=idea, status=status)
    if with_file:
        d.image_file.save('source.png', ContentFile(PNG_BYTES), save=False)
    d.save()
    return d


def ws_headers(workspace):
    return {'HTTP_X_WORKSPACE_ID': str(workspace.id)}


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

class TestHappyPath:
    def test_single_approved(self, api_client, workspace, idea):
        d = _make_design(workspace, idea=idea)
        resp = api_client.post(URL, {'design_ids': [str(d.id)]}, format='json',
                               **ws_headers(workspace))
        assert resp.status_code == 200, resp.data
        assert len(resp.data['created']) == 1
        assert resp.data['skipped_duplicates'] == []
        assert resp.data['rejected_ineligible'] == []
        asset = DesignAsset.objects.get(id=resp.data['created'][0])
        assert asset.source == DesignAsset.Source.GENERATED
        assert asset.design_origin_id == d.id
        assert asset.idea_id == idea.id
        assert asset.niche_id == idea.niche_id
        assert asset.workspace_id == workspace.id
        assert asset.created_by_id == api_client.handler._force_user.id
        # File copied with the original basename + non-zero size
        assert asset.file.name.endswith('.png')
        assert asset.file_size == len(PNG_BYTES)

    def test_bulk_five(self, api_client, workspace, idea):
        designs = [_make_design(workspace, idea=idea) for _ in range(5)]
        resp = api_client.post(URL, {'design_ids': [str(d.id) for d in designs]},
                               format='json', **ws_headers(workspace))
        assert resp.status_code == 200, resp.data
        assert len(resp.data['created']) == 5
        assert DesignAsset.objects.filter(
            design_origin__in=designs).count() == 5

    def test_design_without_idea(self, api_client, workspace):
        d = _make_design(workspace, idea=None)
        resp = api_client.post(URL, {'design_ids': [str(d.id)]}, format='json',
                               **ws_headers(workspace))
        assert resp.status_code == 200
        asset = DesignAsset.objects.get(id=resp.data['created'][0])
        assert asset.idea_id is None
        assert asset.niche_id is None

    def test_idea_without_niche(self, api_client, workspace, user):
        idea_no_niche = Idea.objects.create(
            workspace=workspace, niche=None,
            slogan_text='Naked Idea', created_by=user,
        )
        d = _make_design(workspace, idea=idea_no_niche)
        resp = api_client.post(URL, {'design_ids': [str(d.id)]}, format='json',
                               **ws_headers(workspace))
        assert resp.status_code == 200
        asset = DesignAsset.objects.get(id=resp.data['created'][0])
        assert asset.idea_id == idea_no_niche.id
        assert asset.niche_id is None


# ---------------------------------------------------------------------------
# Approval gate (AC-165, EC-53)
# ---------------------------------------------------------------------------

class TestApprovalGate:
    @pytest.mark.parametrize('status', [
        Design.Status.PENDING, Design.Status.REJECTED, Design.Status.FAILED,
    ])
    def test_non_approved_rejected(self, api_client, workspace, idea, status):
        d = _make_design(workspace, idea=idea, status=status)
        resp = api_client.post(URL, {'design_ids': [str(d.id)]}, format='json',
                               **ws_headers(workspace))
        assert resp.status_code == 200
        assert resp.data['created'] == []
        assert resp.data['rejected_ineligible'] == [
            {'id': str(d.id), 'reason': 'not_approved'},
        ]
        assert not DesignAsset.objects.filter(design_origin=d).exists()


# ---------------------------------------------------------------------------
# Image presence (AC-165, EC-54)
# ---------------------------------------------------------------------------

class TestImagePresence:
    def test_design_without_image(self, api_client, workspace, idea):
        d = _make_design(workspace, idea=idea, with_file=False)
        resp = api_client.post(URL, {'design_ids': [str(d.id)]}, format='json',
                               **ws_headers(workspace))
        assert resp.status_code == 200
        assert resp.data['rejected_ineligible'] == [
            {'id': str(d.id), 'reason': 'no_image'},
        ]


# ---------------------------------------------------------------------------
# Dedup + soft-delete edge (AC-165, EC-59, EC-60)
# ---------------------------------------------------------------------------

class TestDedup:
    def test_resend_same_design_skipped(self, api_client, workspace, idea):
        d = _make_design(workspace, idea=idea)
        # First send
        api_client.post(URL, {'design_ids': [str(d.id)]}, format='json',
                        **ws_headers(workspace))
        # Second send → dedup
        resp = api_client.post(URL, {'design_ids': [str(d.id)]}, format='json',
                               **ws_headers(workspace))
        assert resp.status_code == 200
        assert resp.data['created'] == []
        assert resp.data['skipped_duplicates'] == [str(d.id)]
        assert DesignAsset.objects.filter(design_origin=d).count() == 1

    def test_hard_delete_then_resend_creates_new(self, api_client, workspace, idea):
        """EC-60: dedup is live-records only; hard-delete frees the slot."""
        d = _make_design(workspace, idea=idea)
        api_client.post(URL, {'design_ids': [str(d.id)]}, format='json',
                        **ws_headers(workspace))
        DesignAsset.objects.filter(design_origin=d).delete()

        resp = api_client.post(URL, {'design_ids': [str(d.id)]}, format='json',
                               **ws_headers(workspace))
        assert resp.status_code == 200
        assert len(resp.data['created']) == 1
        assert resp.data['skipped_duplicates'] == []


# ---------------------------------------------------------------------------
# Workspace isolation (AC-165, EC-58)
# ---------------------------------------------------------------------------

class TestWorkspaceIsolation:
    def test_foreign_workspace_design_silently_dropped(self, api_client, workspace,
                                                       idea, db):
        other_user = User.objects.create_user(email='o2@example.com', password='x')
        other_ws = Workspace.objects.create(
            name='Other', slug='other', owner=other_user,
        )
        foreign = _make_design(other_ws, idea=None)
        own = _make_design(workspace, idea=idea)

        resp = api_client.post(
            URL, {'design_ids': [str(foreign.id), str(own.id)]},
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 200
        # Foreign id is in NEITHER created, skipped, NOR rejected
        assert resp.data['created'] == [
            str(DesignAsset.objects.get(design_origin=own).id),
        ]
        assert resp.data['skipped_duplicates'] == []
        assert resp.data['rejected_ineligible'] == []
        # Foreign workspace untouched
        assert not DesignAsset.objects.filter(design_origin=foreign).exists()


# ---------------------------------------------------------------------------
# Bulk soft cap (AC-167)
# ---------------------------------------------------------------------------

class TestBulkCap:
    def test_51_ids_rejected(self, api_client, workspace):
        ids = [str(uuid.uuid4()) for _ in range(51)]
        resp = api_client.post(URL, {'design_ids': ids}, format='json',
                               **ws_headers(workspace))
        assert resp.status_code == 400
        assert resp.data == {'error': 'bulk_too_large', 'max': 50}

    def test_50_ids_accepted(self, api_client, workspace):
        # 50 random ids (all foreign-workspace -> silently dropped, no DB rows)
        ids = [str(uuid.uuid4()) for _ in range(50)]
        resp = api_client.post(URL, {'design_ids': ids}, format='json',
                               **ws_headers(workspace))
        assert resp.status_code == 200
        assert resp.data['created'] == []

    def test_empty_design_ids_rejected(self, api_client, workspace):
        resp = api_client.post(URL, {'design_ids': []}, format='json',
                               **ws_headers(workspace))
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Auth + workspace gating
# ---------------------------------------------------------------------------

class TestAuth:
    def test_anonymous_rejected(self, db, workspace):
        client = APIClient()
        resp = client.post(URL, {'design_ids': [str(uuid.uuid4())]},
                           format='json', **ws_headers(workspace))
        assert resp.status_code in (401, 403)

    def test_no_active_membership_rejected(self, db, workspace, user):
        # Authenticated user but no membership in target workspace
        outsider = User.objects.create_user(email='out@example.com', password='x')
        client = APIClient()
        client.force_authenticate(user=outsider)
        resp = client.post(URL, {'design_ids': [str(uuid.uuid4())]},
                           format='json', **ws_headers(workspace))
        assert resp.status_code in (400, 403)


# ---------------------------------------------------------------------------
# Partial failure → 207 Multi-Status (EC-55)
# ---------------------------------------------------------------------------

class TestPartialFailure:
    def test_storage_error_on_second_design_returns_207(self, api_client,
                                                        workspace, idea):
        d1 = _make_design(workspace, idea=idea)
        d2 = _make_design(workspace, idea=idea)

        original_open = None
        call_state = {'count': 0}

        def flaky_open(name, *args, **kwargs):
            call_state['count'] += 1
            if call_state['count'] == 2:
                raise IOError('simulated storage outage')
            return original_open(name, *args, **kwargs)

        from django.core.files.storage import default_storage
        original_open = default_storage.open

        with patch.object(default_storage, 'open', side_effect=flaky_open):
            resp = api_client.post(
                URL, {'design_ids': [str(d1.id), str(d2.id)]},
                format='json', **ws_headers(workspace),
            )

        assert resp.status_code == 207
        assert len(resp.data['created']) == 1
        assert len(resp.data['failed']) == 1
        assert resp.data['failed'][0]['id'] == str(d2.id)
        assert 'simulated storage outage' in resp.data['failed'][0]['error']


# ---------------------------------------------------------------------------
# has_design_asset annotation on DesignSerializer (AC-171)
# ---------------------------------------------------------------------------

class TestHasDesignAssetAnnotation:
    def test_flag_flips_after_send(self, api_client, workspace, idea):
        """The flag is exposed via the list-by-ids endpoint
        ``GET /api/designs/?ids=...``. Detail GET is not supported on
        ``/api/designs/<id>/`` (only PATCH/DELETE) so we use the list path.
        """
        d = _make_design(workspace, idea=idea)
        list_url = f'/api/designs/?ids={d.id}'

        # Before send → false
        resp = api_client.get(list_url, **ws_headers(workspace))
        assert resp.status_code == 200, resp.data
        assert resp.data[0]['has_design_asset'] is False

        # Send
        api_client.post(URL, {'design_ids': [str(d.id)]}, format='json',
                        **ws_headers(workspace))

        # After send → true
        resp = api_client.get(list_url, **ws_headers(workspace))
        assert resp.data[0]['has_design_asset'] is True
