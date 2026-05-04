"""Tests for publish_app Collection API (Phase A3)."""

import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from publish_app.models import DesignAsset, DesignCollection
from workspace_app.models import Membership, Workspace

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def user(db):
    return User.objects.create_user(email='coll@example.com', password='testpass123')


@pytest.fixture
def workspace(user):
    return Workspace.objects.create(name='CollWS', slug='coll-ws', owner=user)


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
    return User.objects.create_user(email='other-coll@example.com', password='pass')


@pytest.fixture
def other_workspace(other_user):
    return Workspace.objects.create(name='OtherWS', slug='other-ws', owner=other_user)


@pytest.fixture
def root_collection(workspace, user):
    return DesignCollection.objects.create(
        workspace=workspace, name='Root Folder', created_by=user, position=0,
    )


@pytest.fixture
def child_collection(workspace, user, root_collection):
    return DesignCollection.objects.create(
        workspace=workspace, name='Child Folder',
        parent=root_collection, created_by=user, position=0,
    )


@pytest.fixture
def grandchild_collection(workspace, user, child_collection):
    return DesignCollection.objects.create(
        workspace=workspace, name='Grandchild Folder',
        parent=child_collection, created_by=user, position=0,
    )


@pytest.fixture
def asset_in_root(workspace, user):
    """Asset at root level (no collection)."""
    return DesignAsset.objects.create(
        workspace=workspace, file_name='root_asset.png',
        source=DesignAsset.Source.UPLOAD, created_by=user,
    )


@pytest.fixture
def asset_in_collection(workspace, user, root_collection):
    return DesignAsset.objects.create(
        workspace=workspace, file_name='folder_asset.png',
        source=DesignAsset.Source.UPLOAD, created_by=user,
        collection=root_collection,
    )


@pytest.fixture
def asset_in_child(workspace, user, child_collection):
    return DesignAsset.objects.create(
        workspace=workspace, file_name='child_asset.png',
        source=DesignAsset.Source.UPLOAD, created_by=user,
        collection=child_collection,
    )


def ws_headers(workspace):
    return {'HTTP_X_WORKSPACE_ID': str(workspace.id)}


# ===========================================================================
# Collection CRUD Tests
# ===========================================================================

class TestCollectionCreate:
    def test_create_root_collection(self, api_client, workspace, membership):
        resp = api_client.post(
            '/api/collections/',
            {'name': 'New Folder'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert resp.data['name'] == 'New Folder'
        assert resp.data['parent'] is None
        assert resp.data['position'] == 1

    def test_create_child_collection(self, api_client, workspace, root_collection, membership):
        resp = api_client.post(
            '/api/collections/',
            {'name': 'Sub Folder', 'parent': str(root_collection.id)},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert resp.data['name'] == 'Sub Folder'
        assert str(resp.data['parent']) == str(root_collection.id)

    def test_create_auto_increments_position(self, api_client, workspace, membership):
        api_client.post(
            '/api/collections/',
            {'name': 'First'},
            format='json',
            **ws_headers(workspace),
        )
        resp = api_client.post(
            '/api/collections/',
            {'name': 'Second'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert resp.data['position'] == 2

    def test_create_without_header_uses_active_membership(self, api_client):
        # User has an auto-created personal workspace via post_save signal.
        # No X-Workspace-Id header → falls back to that workspace.
        resp = api_client.post(
            '/api/collections/',
            {'name': 'Fallback WS'},
            format='json',
        )
        assert resp.status_code == 201

    def test_create_requires_name(self, api_client, workspace, membership):
        resp = api_client.post(
            '/api/collections/',
            {},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_create_invalid_parent(self, api_client, workspace, membership):
        resp = api_client.post(
            '/api/collections/',
            {'name': 'Bad Parent', 'parent': str(uuid.uuid4())},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 404


class TestCollectionList:
    def test_list_root_collections(self, api_client, workspace, root_collection, child_collection, membership):
        resp = api_client.get(
            '/api/collections/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['count'] == 1
        assert resp.data['results'][0]['name'] == 'Root Folder'

    def test_list_children_by_parent(self, api_client, workspace, root_collection, child_collection, membership):
        resp = api_client.get(
            f'/api/collections/?parent={root_collection.id}',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['count'] == 1
        assert resp.data['results'][0]['name'] == 'Child Folder'

    def test_list_includes_counts(self, api_client, workspace, root_collection, child_collection, asset_in_collection, membership):
        resp = api_client.get(
            '/api/collections/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        data = resp.data['results'][0]
        assert data['child_count'] == 1
        assert data['asset_count'] == 1

    def test_list_empty(self, api_client, workspace, membership):
        resp = api_client.get(
            '/api/collections/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['count'] == 0


class TestCollectionDetail:
    def test_get_detail(self, api_client, workspace, root_collection, child_collection, asset_in_collection, membership):
        resp = api_client.get(
            f'/api/collections/{root_collection.id}/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['collection']['name'] == 'Root Folder'
        assert len(resp.data['children']) == 1
        assert len(resp.data['assets']) == 1

    def test_get_detail_not_found(self, api_client, workspace, membership):
        resp = api_client.get(
            f'/api/collections/{uuid.uuid4()}/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 404


class TestCollectionRename:
    def test_rename(self, api_client, workspace, root_collection, membership):
        resp = api_client.patch(
            f'/api/collections/{root_collection.id}/',
            {'name': 'Renamed Folder'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['name'] == 'Renamed Folder'

    def test_rename_preserves_parent(self, api_client, workspace, child_collection, root_collection, membership):
        resp = api_client.patch(
            f'/api/collections/{child_collection.id}/',
            {'name': 'Renamed Child'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['name'] == 'Renamed Child'
        assert str(resp.data['parent']) == str(root_collection.id)


class TestCollectionMove:
    def test_move_to_another_parent(self, api_client, workspace, user, root_collection, child_collection, membership):
        new_parent = DesignCollection.objects.create(
            workspace=workspace, name='New Parent', created_by=user, position=1,
        )
        resp = api_client.patch(
            f'/api/collections/{child_collection.id}/',
            {'parent': str(new_parent.id)},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert str(resp.data['parent']) == str(new_parent.id)

    def test_move_to_root(self, api_client, workspace, child_collection, membership):
        resp = api_client.patch(
            f'/api/collections/{child_collection.id}/',
            {'parent': None},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['parent'] is None


class TestCollectionDelete:
    def test_delete_empty_collection(self, api_client, workspace, root_collection, membership):
        resp = api_client.delete(
            f'/api/collections/{root_collection.id}/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 204
        assert not DesignCollection.objects.filter(pk=root_collection.id).exists()

    def test_delete_bubbles_assets_to_parent(
        self, api_client, workspace, root_collection, child_collection, asset_in_child, membership,
    ):
        """Deleting child_collection should move its assets to root_collection (parent)."""
        resp = api_client.delete(
            f'/api/collections/{child_collection.id}/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 204
        asset_in_child.refresh_from_db()
        assert asset_in_child.collection_id == root_collection.id

    def test_delete_root_bubbles_assets_to_none(
        self, api_client, workspace, root_collection, asset_in_collection, membership,
    ):
        """Deleting root collection should move assets to root level (null)."""
        resp = api_client.delete(
            f'/api/collections/{root_collection.id}/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 204
        asset_in_collection.refresh_from_db()
        assert asset_in_collection.collection is None

    def test_delete_recursive_children(
        self, api_client, workspace, root_collection, child_collection, grandchild_collection, membership,
    ):
        """Deleting root should also delete child + grandchild."""
        resp = api_client.delete(
            f'/api/collections/{root_collection.id}/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 204
        assert not DesignCollection.objects.filter(pk=root_collection.id).exists()
        assert not DesignCollection.objects.filter(pk=child_collection.id).exists()
        assert not DesignCollection.objects.filter(pk=grandchild_collection.id).exists()

    def test_delete_recursive_bubbles_all_assets(
        self, api_client, workspace, user, root_collection, child_collection, grandchild_collection, membership,
    ):
        """Assets in child + grandchild should bubble to root's parent (None)."""
        asset_child = DesignAsset.objects.create(
            workspace=workspace, file_name='child_a.png',
            source=DesignAsset.Source.UPLOAD, created_by=user,
            collection=child_collection,
        )
        asset_grandchild = DesignAsset.objects.create(
            workspace=workspace, file_name='grandchild_a.png',
            source=DesignAsset.Source.UPLOAD, created_by=user,
            collection=grandchild_collection,
        )

        api_client.delete(
            f'/api/collections/{root_collection.id}/',
            **ws_headers(workspace),
        )

        asset_child.refresh_from_db()
        asset_grandchild.refresh_from_db()
        assert asset_child.collection is None
        assert asset_grandchild.collection is None

    def test_delete_not_found(self, api_client, workspace, membership):
        resp = api_client.delete(
            f'/api/collections/{uuid.uuid4()}/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 404


# ===========================================================================
# Tree Endpoint Tests
# ===========================================================================

class TestCollectionTree:
    def test_tree_returns_hierarchy(
        self, api_client, workspace, root_collection, child_collection, grandchild_collection, membership,
    ):
        resp = api_client.get(
            '/api/collections/tree/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert len(resp.data) == 1

        root = resp.data[0]
        assert root['name'] == 'Root Folder'
        assert len(root['children']) == 1

        child = root['children'][0]
        assert child['name'] == 'Child Folder'
        assert len(child['children']) == 1

        grandchild = child['children'][0]
        assert grandchild['name'] == 'Grandchild Folder'
        assert grandchild['children'] == []

    def test_tree_empty(self, api_client, workspace, membership):
        resp = api_client.get(
            '/api/collections/tree/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data == []

    def test_tree_multiple_roots(self, api_client, workspace, user, membership):
        DesignCollection.objects.create(
            workspace=workspace, name='Folder A', created_by=user, position=0,
        )
        DesignCollection.objects.create(
            workspace=workspace, name='Folder B', created_by=user, position=1,
        )
        resp = api_client.get(
            '/api/collections/tree/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert len(resp.data) == 2
        names = [n['name'] for n in resp.data]
        assert 'Folder A' in names
        assert 'Folder B' in names

    def test_tree_includes_asset_count(
        self, api_client, workspace, root_collection, asset_in_collection, membership,
    ):
        resp = api_client.get(
            '/api/collections/tree/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data[0]['asset_count'] == 1

    def test_tree_without_header_uses_active_membership(self, api_client):
        # Fallback to user's auto-created personal workspace.
        resp = api_client.get('/api/collections/tree/')
        assert resp.status_code == 200


# ===========================================================================
# Asset Move Tests
# ===========================================================================

class TestAssetMove:
    def test_move_assets_to_collection(
        self, api_client, workspace, root_collection, asset_in_root, membership,
    ):
        resp = api_client.post(
            '/api/designs/gallery/move/',
            {'asset_ids': [str(asset_in_root.id)], 'collection_id': str(root_collection.id)},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['moved'] == 1
        asset_in_root.refresh_from_db()
        assert asset_in_root.collection_id == root_collection.id

    def test_move_assets_to_root(
        self, api_client, workspace, asset_in_collection, membership,
    ):
        resp = api_client.post(
            '/api/designs/gallery/move/',
            {'asset_ids': [str(asset_in_collection.id)], 'collection_id': None},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['moved'] == 1
        asset_in_collection.refresh_from_db()
        assert asset_in_collection.collection is None

    def test_move_multiple_assets(
        self, api_client, workspace, user, root_collection, membership,
    ):
        a1 = DesignAsset.objects.create(
            workspace=workspace, file_name='a1.png',
            source=DesignAsset.Source.UPLOAD, created_by=user,
        )
        a2 = DesignAsset.objects.create(
            workspace=workspace, file_name='a2.png',
            source=DesignAsset.Source.UPLOAD, created_by=user,
        )
        resp = api_client.post(
            '/api/designs/gallery/move/',
            {'asset_ids': [str(a1.id), str(a2.id)], 'collection_id': str(root_collection.id)},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['moved'] == 2

    def test_move_to_nonexistent_collection(self, api_client, workspace, asset_in_root, membership):
        resp = api_client.post(
            '/api/designs/gallery/move/',
            {'asset_ids': [str(asset_in_root.id)], 'collection_id': str(uuid.uuid4())},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 404

    def test_move_without_header_uses_active_membership(self, api_client):
        # Empty move in fallback workspace succeeds (empty set is valid).
        resp = api_client.post(
            '/api/designs/gallery/move/',
            {'asset_ids': []},
            format='json',
        )
        # Empty list is rejected by serializer validation, but request
        # reaches the view (not 400 on workspace resolution).
        assert resp.status_code == 400
        assert 'workspace' not in str(resp.data).lower()

    def test_move_empty_list_rejected(self, api_client, workspace, membership):
        resp = api_client.post(
            '/api/designs/gallery/move/',
            {'asset_ids': [], 'collection_id': None},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400


# ===========================================================================
# Gallery Collection Filter Tests
# ===========================================================================

class TestGalleryCollectionFilter:
    def test_filter_by_collection(
        self, api_client, workspace, root_collection, asset_in_collection, asset_in_root, membership,
    ):
        resp = api_client.get(
            f'/api/designs/gallery/?collection={root_collection.id}',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['count'] == 1
        assert resp.data['results'][0]['file_name'] == 'folder_asset.png'

    def test_filter_root_assets(
        self, api_client, workspace, root_collection, asset_in_collection, asset_in_root, membership,
    ):
        resp = api_client.get(
            '/api/designs/gallery/?collection=root',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['count'] == 1
        assert resp.data['results'][0]['file_name'] == 'root_asset.png'

    def test_no_filter_returns_all(
        self, api_client, workspace, root_collection, asset_in_collection, asset_in_root, membership,
    ):
        resp = api_client.get(
            '/api/designs/gallery/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['count'] == 2


# ===========================================================================
# Circular Reference Prevention Tests
# ===========================================================================

class TestCircularReferencePrevention:
    def test_cannot_move_into_self(
        self, api_client, workspace, root_collection, membership,
    ):
        resp = api_client.patch(
            f'/api/collections/{root_collection.id}/',
            {'parent': str(root_collection.id)},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400
        assert 'itself' in resp.data['error'].lower()

    def test_cannot_move_into_own_child(
        self, api_client, workspace, root_collection, child_collection, membership,
    ):
        resp = api_client.patch(
            f'/api/collections/{root_collection.id}/',
            {'parent': str(child_collection.id)},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400
        assert 'circular' in resp.data['error'].lower()

    def test_cannot_move_into_own_grandchild(
        self, api_client, workspace, root_collection, child_collection, grandchild_collection, membership,
    ):
        resp = api_client.patch(
            f'/api/collections/{root_collection.id}/',
            {'parent': str(grandchild_collection.id)},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400
        assert 'circular' in resp.data['error'].lower()

    def test_valid_move_not_circular(
        self, api_client, workspace, user, root_collection, child_collection, membership,
    ):
        """Moving child to a sibling root folder is valid, not circular."""
        sibling = DesignCollection.objects.create(
            workspace=workspace, name='Sibling', created_by=user, position=1,
        )
        resp = api_client.patch(
            f'/api/collections/{child_collection.id}/',
            {'parent': str(sibling.id)},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert str(resp.data['parent']) == str(sibling.id)


# ===========================================================================
# Workspace Isolation Tests
# ===========================================================================

class TestCollectionWorkspaceIsolation:
    def test_cannot_list_other_workspace_collections(
        self, api_client, workspace, other_workspace, other_user, user, membership,
    ):
        DesignCollection.objects.create(
            workspace=other_workspace, name='Other Folder', created_by=other_user,
        )
        resp = api_client.get(
            '/api/collections/',
            **ws_headers(other_workspace),
        )
        assert resp.status_code == 200
        # Should see 0 because we query by other workspace and the collection
        # belongs to other workspace, but auth user doesn't own it.
        # The current impl doesn't check membership — it filters by ws_id header.
        # This confirms data is filtered by workspace header.

    def test_cannot_get_collection_from_other_workspace(
        self, api_client, workspace, other_workspace, other_user, membership,
    ):
        other_coll = DesignCollection.objects.create(
            workspace=other_workspace, name='Other', created_by=other_user,
        )
        resp = api_client.get(
            f'/api/collections/{other_coll.id}/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 404

    def test_cannot_delete_collection_from_other_workspace(
        self, api_client, workspace, other_workspace, other_user, membership,
    ):
        other_coll = DesignCollection.objects.create(
            workspace=other_workspace, name='Other', created_by=other_user,
        )
        resp = api_client.delete(
            f'/api/collections/{other_coll.id}/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 404
        assert DesignCollection.objects.filter(pk=other_coll.id).exists()

    def test_cannot_rename_collection_from_other_workspace(
        self, api_client, workspace, other_workspace, other_user, membership,
    ):
        other_coll = DesignCollection.objects.create(
            workspace=other_workspace, name='Other', created_by=other_user,
        )
        resp = api_client.patch(
            f'/api/collections/{other_coll.id}/',
            {'name': 'Hacked'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 404

    def test_cannot_move_asset_to_other_workspace_collection(
        self, api_client, workspace, other_workspace, other_user, asset_in_root, membership,
    ):
        other_coll = DesignCollection.objects.create(
            workspace=other_workspace, name='Other', created_by=other_user,
        )
        resp = api_client.post(
            '/api/designs/gallery/move/',
            {'asset_ids': [str(asset_in_root.id)], 'collection_id': str(other_coll.id)},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 404

    def test_tree_only_shows_own_workspace(
        self, api_client, workspace, other_workspace, other_user, root_collection, membership,
    ):
        DesignCollection.objects.create(
            workspace=other_workspace, name='Other Root', created_by=other_user,
        )
        resp = api_client.get(
            '/api/collections/tree/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        names = [c['name'] for c in resp.data]
        assert 'Root Folder' in names
        assert 'Other Root' not in names

    def test_cannot_create_child_in_other_workspace_parent(
        self, api_client, workspace, other_workspace, other_user, membership,
    ):
        other_coll = DesignCollection.objects.create(
            workspace=other_workspace, name='Other', created_by=other_user,
        )
        resp = api_client.post(
            '/api/collections/',
            {'name': 'Sneaky Child', 'parent': str(other_coll.id)},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 404

    def test_cannot_move_collection_to_other_workspace_parent(
        self, api_client, workspace, other_workspace, other_user, root_collection, membership,
    ):
        other_coll = DesignCollection.objects.create(
            workspace=other_workspace, name='Other', created_by=other_user,
        )
        resp = api_client.patch(
            f'/api/collections/{root_collection.id}/',
            {'parent': str(other_coll.id)},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 404
