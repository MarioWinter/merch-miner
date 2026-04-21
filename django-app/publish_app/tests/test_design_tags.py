"""Tests for DesignAsset tag PATCH validation (PROJ-11 Phase H1).

Covers AC-63, EC-25, EC-26: per-tag max length 20 chars, max 10 tags
total, whitespace-only rejection, and silent dedup on the server side.
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from publish_app.models import DesignAsset
from workspace_app.models import Membership, Workspace

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email='tags@example.com', password='testpass123',
    )


@pytest.fixture
def workspace(user):
    return Workspace.objects.create(
        name='Tag WS', slug='tag-ws', owner=user,
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
def design(workspace, user):
    return DesignAsset.objects.create(
        workspace=workspace, file_name='tag_target.png',
        source=DesignAsset.Source.UPLOAD, created_by=user,
        tags=['initial'],
    )


def ws_headers(workspace):
    return {'HTTP_X_WORKSPACE_ID': str(workspace.id)}


def _patch_url(design):
    return f'/api/designs/gallery/{design.id}/'


class TestDesignTagPatchHappyPath:
    def test_patch_tags_persists(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.patch(
            _patch_url(design),
            {'tags': ['red', 'blue', 'shirt']},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        assert resp.data['tags'] == ['red', 'blue', 'shirt']

        design.refresh_from_db()
        assert design.tags == ['red', 'blue', 'shirt']

    def test_patch_empty_list_clears_tags(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.patch(
            _patch_url(design),
            {'tags': []},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        assert resp.data['tags'] == []

    def test_patch_unrelated_field_leaves_tags_untouched(
        self, api_client, workspace, design, membership,
    ):
        # Sending a PATCH that does not include `tags` must not wipe them.
        resp = api_client.patch(
            _patch_url(design),
            {'niche': None},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        design.refresh_from_db()
        assert design.tags == ['initial']

    def test_patch_dedupes_silently(
        self, api_client, workspace, design, membership,
    ):
        # EC-25 defensive: duplicates on the wire are deduped, not rejected.
        resp = api_client.patch(
            _patch_url(design),
            {'tags': ['red', 'red', 'blue', 'red']},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        assert resp.data['tags'] == ['red', 'blue']
        design.refresh_from_db()
        assert design.tags == ['red', 'blue']

    def test_patch_strips_surrounding_whitespace(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.patch(
            _patch_url(design),
            {'tags': ['  red  ', 'blue\t']},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        assert resp.data['tags'] == ['red', 'blue']


class TestDesignTagPatchValidation:
    def test_too_many_tags_rejected(
        self, api_client, workspace, design, membership,
    ):
        # EC-26: 11 distinct tags -> 400 with clear field error.
        tags = [f'tag{i}' for i in range(11)]
        resp = api_client.patch(
            _patch_url(design),
            {'tags': tags},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400
        assert 'tags' in resp.data
        msg = ' '.join(str(m) for m in resp.data['tags'])
        assert 'Maximum 10' in msg or 'max 10' in msg.lower()

        design.refresh_from_db()
        assert design.tags == ['initial']  # unchanged

    def test_tag_too_long_rejected(
        self, api_client, workspace, design, membership,
    ):
        # 21 chars -> over the 20-char per-tag limit.
        long_tag = 'x' * 21
        resp = api_client.patch(
            _patch_url(design),
            {'tags': ['ok', long_tag]},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400
        assert 'tags' in resp.data
        msg = ' '.join(str(m) for m in resp.data['tags'])
        assert 'too long' in msg.lower()

        design.refresh_from_db()
        assert design.tags == ['initial']

    def test_tag_exactly_twenty_chars_accepted(
        self, api_client, workspace, design, membership,
    ):
        boundary = 'y' * 20
        resp = api_client.patch(
            _patch_url(design),
            {'tags': [boundary]},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        assert resp.data['tags'] == [boundary]

    def test_whitespace_only_tag_rejected(
        self, api_client, workspace, design, membership,
    ):
        # EC-25: whitespace-only should 400 (stripped -> empty -> rejected).
        resp = api_client.patch(
            _patch_url(design),
            {'tags': ['   ']},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400
        assert 'tags' in resp.data
        msg = ' '.join(str(m) for m in resp.data['tags'])
        assert 'empty' in msg.lower() or 'whitespace' in msg.lower()

        design.refresh_from_db()
        assert design.tags == ['initial']

    def test_empty_string_tag_rejected(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.patch(
            _patch_url(design),
            {'tags': ['good', '']},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400
        assert 'tags' in resp.data
        design.refresh_from_db()
        assert design.tags == ['initial']

    def test_non_string_tag_rejected(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.patch(
            _patch_url(design),
            {'tags': ['ok', 123]},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400
        assert 'tags' in resp.data

    def test_ten_tags_accepted_boundary(
        self, api_client, workspace, design, membership,
    ):
        tags = [f'tag{i}' for i in range(10)]
        resp = api_client.patch(
            _patch_url(design),
            {'tags': tags},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        assert resp.data['tags'] == tags

    def test_dedup_brings_count_under_limit(
        self, api_client, workspace, design, membership,
    ):
        # 12 items on wire but only 8 unique -> accepted.
        tags = ['a', 'b', 'c', 'd', 'a', 'b', 'e', 'f', 'g', 'h', 'a', 'b']
        resp = api_client.patch(
            _patch_url(design),
            {'tags': tags},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        assert resp.data['tags'] == ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
