"""Tests for the DesignAsset Duplicate endpoint (PROJ-11 Phase H6).

Covers AC-65, AC-66, EC-27, EC-30:
- Happy path copies collection + tags; clears listing/idea/niche.
- file_size + dimensions preserved.
- Cross-workspace source -> 404 (no ID enumeration).
- Non-existent id -> 404.
- Storage failure -> 500 + rollback (no new DB row).
- Unauthenticated -> 401.
- Source in a subfolder Collection -> duplicate keeps that collection.
- Source with listing + idea -> duplicate has both cleared.
"""

import uuid
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from rest_framework.test import APIClient

from idea_app.models import Idea
from niche_app.models import Niche
from publish_app.models import DesignAsset, DesignCollection, Listing
from workspace_app.models import Membership, Workspace

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def user(db):
    return User.objects.create_user(
        email='dup@example.com', password='testpass123',
    )


@pytest.fixture
def workspace(user):
    return Workspace.objects.create(
        name='Dup WS', slug='dup-ws', owner=user,
    )


@pytest.fixture
def membership(workspace, user):
    return Membership.objects.create(
        workspace=workspace, user=user,
        role=Membership.Role.ADMIN, status=Membership.Status.ACTIVE,
    )


@pytest.fixture
def api_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def other_user(db):
    return User.objects.create_user(
        email='other-dup@example.com', password='pass',
    )


@pytest.fixture
def other_workspace(other_user):
    return Workspace.objects.create(
        name='Other WS', slug='other-dup-ws', owner=other_user,
    )


@pytest.fixture
def collection(workspace, user):
    return DesignCollection.objects.create(
        workspace=workspace, name='Shirts', created_by=user, position=0,
    )


@pytest.fixture
def subfolder(workspace, user, collection):
    return DesignCollection.objects.create(
        workspace=workspace, name='Cats', created_by=user,
        parent=collection, position=0,
    )


@pytest.fixture
def niche(workspace, user):
    return Niche.objects.create(
        workspace=workspace, name='Cat Niche', created_by=user,
    )


@pytest.fixture
def idea(workspace, niche, user):
    return Idea.objects.create(
        workspace=workspace, niche=niche,
        slogan_text='Purr-fectly Weird', created_by=user,
    )


def _make_design(
    workspace, user, *, tags=None, collection=None, niche=None,
    idea=None, listing=None, with_file=True, file_name='cat.png',
):
    """Create a DesignAsset with an optional stored file payload."""
    asset = DesignAsset.objects.create(
        workspace=workspace,
        file_name=file_name,
        source=DesignAsset.Source.UPLOAD,
        dimensions={'width': 4500, 'height': 5400},
        file_size=123_456,
        tags=tags or [],
        collection=collection,
        niche=niche,
        idea=idea,
        listing=listing,
        created_by=user,
    )
    if with_file:
        asset.file.save(
            file_name, ContentFile(b'fake-png-bytes'), save=True,
        )
    return asset


@pytest.fixture
def design(workspace, user, collection):
    return _make_design(
        workspace, user,
        tags=['red', 'funny'],
        collection=collection,
    )


def ws_headers(workspace):
    return {'HTTP_X_WORKSPACE_ID': str(workspace.id)}


def _url(pk):
    return f'/api/designs/gallery/{pk}/duplicate/'


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestDuplicateHappyPath:
    def test_duplicate_creates_new_asset(
        self, api_client, workspace, design, membership,
    ):
        before = DesignAsset.objects.count()
        resp = api_client.post(
            _url(design.id), format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 201, resp.data
        assert DesignAsset.objects.count() == before + 1

        new_id = resp.data['id']
        assert str(new_id) != str(design.id)

        # AC-66: collection + tags inherited.
        assert str(resp.data['collection']) == str(design.collection_id)
        assert resp.data['tags'] == ['red', 'funny']

        # AC-66: listing/idea/niche cleared on the duplicate.
        assert resp.data['listing'] is None
        assert resp.data['idea'] is None
        assert resp.data['niche'] is None

    def test_duplicate_copies_file_size_and_dimensions(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.post(
            _url(design.id), format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 201, resp.data
        assert resp.data['file_size'] == design.file_size
        assert resp.data['dimensions'] == design.dimensions

        new_asset = DesignAsset.objects.get(pk=resp.data['id'])
        assert new_asset.file_size == design.file_size
        assert new_asset.dimensions == design.dimensions

    def test_duplicate_preserves_subfolder_collection(
        self, api_client, workspace, user, subfolder, membership,
    ):
        src = _make_design(
            workspace, user,
            tags=['deep'],
            collection=subfolder,
        )
        resp = api_client.post(
            _url(src.id), format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 201, resp.data
        assert str(resp.data['collection']) == str(subfolder.id)

        dup = DesignAsset.objects.get(pk=resp.data['id'])
        assert dup.collection_id == subfolder.id

    def test_duplicate_clears_listing_idea_niche(
        self, api_client, workspace, user, niche, idea, design, membership,
    ):
        listing = Listing.objects.create(
            workspace=workspace, idea=idea, design=design,
            title='Original Title',
        )
        src = _make_design(
            workspace, user,
            tags=['linked'],
            niche=niche,
            idea=idea,
            listing=listing,
        )
        resp = api_client.post(
            _url(src.id), format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 201, resp.data
        # Spec: duplicate clears linking fields even if source had them.
        assert resp.data['listing'] is None
        assert resp.data['idea'] is None
        assert resp.data['niche'] is None

        dup = DesignAsset.objects.get(pk=resp.data['id'])
        assert dup.listing_id is None
        assert dup.idea_id is None
        assert dup.niche_id is None

        # Source row is unchanged — duplicate is not a move.
        src.refresh_from_db()
        assert src.listing_id == listing.id
        assert src.idea_id == idea.id
        assert src.niche_id == niche.id

    def test_duplicate_writes_to_new_storage_key(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.post(
            _url(design.id), format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 201, resp.data

        dup = DesignAsset.objects.get(pk=resp.data['id'])
        # New asset should have its own file object with a distinct storage
        # key so deleting the source never wipes the duplicate's bytes.
        assert dup.file.name
        assert dup.file.name != design.file.name


class TestDuplicateNotFound:
    def test_cross_workspace_source_returns_404(
        self, api_client, workspace, membership, other_workspace, other_user,
    ):
        # EC-27: source belongs to another workspace. Caller authenticates
        # into their OWN workspace -- lookup is scoped to request workspace
        # so the foreign id surfaces as 404 (not a leak).
        foreign = _make_design(other_workspace, other_user)

        before = DesignAsset.objects.count()
        resp = api_client.post(
            _url(foreign.id), format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 404, resp.data
        # No row created in either workspace.
        assert DesignAsset.objects.count() == before

    def test_unknown_id_returns_404(
        self, api_client, workspace, membership,
    ):
        resp = api_client.post(
            _url(uuid.uuid4()), format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 404


class TestDuplicateStorageFailure:
    def test_storage_open_failure_rolls_back(
        self, api_client, workspace, design, membership,
    ):
        # EC-30: if the file copy blows up, no DB row should be left behind.
        before = DesignAsset.objects.count()

        with patch(
            'django.core.files.storage.default_storage.open',
            side_effect=FileNotFoundError('source bytes gone'),
        ):
            resp = api_client.post(
                _url(design.id), format='json', **ws_headers(workspace),
            )

        assert resp.status_code == 500, resp.data
        assert DesignAsset.objects.count() == before


class TestDuplicateAuth:
    def test_unauthenticated_returns_401(self, workspace, design):
        client = APIClient()  # no force_authenticate
        resp = client.post(
            _url(design.id), format='json', **ws_headers(workspace),
        )
        assert resp.status_code in (401, 403)
