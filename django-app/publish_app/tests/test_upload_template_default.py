"""Tests for Default UploadTemplate (PROJ-11 F6 / AC-52..AC-56, EC-18).

Covers:
- Model partial unique constraint: at most one is_default=True per
  (workspace, marketplace_type); multiple across marketplaces allowed.
- Flipping is_default=False clears the slot for a new default.
- POST with is_default=True clears prior default atomically (EC-18).
- PATCH with is_default=True clears prior default atomically (AC-54).
- POST/PATCH with is_default=True + no prior default -> saves cleanly.
- GET /api/upload-templates/default/: 200 happy path, 404 when none,
  workspace isolation, default marketplace_type=mba, 400 on invalid type.
- URL ordering: /default/ does not shadow the UUID detail route.
"""

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from rest_framework.test import APIClient

from publish_app.models import UploadTemplate
from workspace_app.models import Membership, Workspace

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email='uptpl@example.com', password='testpass123',
    )


@pytest.fixture
def other_user(db):
    return User.objects.create_user(
        email='uptpl-other@example.com', password='testpass123',
    )


@pytest.fixture
def workspace(user):
    return Workspace.objects.create(
        name='UpTpl WS', slug='uptpl-ws', owner=user,
    )


@pytest.fixture
def other_workspace(other_user):
    return Workspace.objects.create(
        name='Other UpTpl WS', slug='other-uptpl-ws', owner=other_user,
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


def ws_headers(workspace):
    return {'HTTP_X_WORKSPACE_ID': str(workspace.id)}


def _make_template(workspace, user, **fields):
    defaults = dict(
        name='Tpl', brand_name='Brand',
        products_config=[
            {
                'product_type': 'standard_tshirt',
                'enabled': True,
                'fit_types': ['men'],
                'print_side': 'front',
                'colors': ['black'],
                'marketplaces': [
                    {
                        'marketplace': 'amazon.com',
                        'price': '19.99',
                        'enabled': True,
                    },
                ],
            },
        ],
        marketplace_type=UploadTemplate.MarketplaceType.MBA,
        is_default=False,
    )
    defaults.update(fields)
    return UploadTemplate.objects.create(
        workspace=workspace, created_by=user, **defaults,
    )


# ---------------------------------------------------------------------------
# Model: partial unique constraint
# ---------------------------------------------------------------------------


@pytest.mark.django_db(transaction=True)
class TestUploadTemplateDefaultConstraint:
    def test_two_defaults_same_marketplace_blocked(
        self, workspace, user,
    ):
        _make_template(workspace, user, name='First', is_default=True)
        with pytest.raises(IntegrityError):
            _make_template(workspace, user, name='Second', is_default=True)

    def test_two_defaults_different_marketplace_ok(
        self, workspace, user,
    ):
        mba = _make_template(
            workspace, user, name='MBA Default',
            marketplace_type=UploadTemplate.MarketplaceType.MBA,
            is_default=True,
        )
        glob = _make_template(
            workspace, user, name='Global Default',
            marketplace_type=UploadTemplate.MarketplaceType.GLOBAL,
            is_default=True,
        )
        assert mba.is_default is True
        assert glob.is_default is True

    def test_multiple_non_default_rows_ok(self, workspace, user):
        a = _make_template(workspace, user, name='A', is_default=False)
        b = _make_template(workspace, user, name='B', is_default=False)
        c = _make_template(workspace, user, name='C', is_default=False)
        assert {a.pk, b.pk, c.pk} == {
            t.pk for t in UploadTemplate.objects.filter(workspace=workspace)
        }

    def test_flipping_default_false_unblocks_new_default(
        self, workspace, user,
    ):
        first = _make_template(workspace, user, name='First', is_default=True)
        first.is_default = False
        first.save(update_fields=['is_default', 'updated_at'])
        # Now a fresh default can be created without IntegrityError.
        second = _make_template(
            workspace, user, name='Second', is_default=True,
        )
        assert second.is_default is True


# ---------------------------------------------------------------------------
# POST /api/upload-templates/ — clear-then-set on create (AC-55, EC-18)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestUploadTemplateCreate:
    def test_create_default_with_existing_default_clears_prior(
        self, api_client, workspace, user, membership,
    ):
        prior = _make_template(
            workspace, user, name='Prior', is_default=True,
        )
        resp = api_client.post(
            '/api/upload-templates/',
            {
                'name': 'New Default',
                'marketplace_type': 'mba',
                'is_default': True,
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201, resp.data
        assert resp.data['is_default'] is True
        prior.refresh_from_db()
        # Prior default was cleared atomically.
        assert prior.is_default is False
        # Exactly one default remains.
        defaults = UploadTemplate.objects.filter(
            workspace=workspace, marketplace_type='mba', is_default=True,
        )
        assert defaults.count() == 1
        assert defaults.first().name == 'New Default'

    def test_create_default_without_prior_default_saves(
        self, api_client, workspace, membership,
    ):
        resp = api_client.post(
            '/api/upload-templates/',
            {
                'name': 'Only Default',
                'marketplace_type': 'mba',
                'is_default': True,
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert resp.data['is_default'] is True

    def test_create_non_default_does_not_touch_existing_default(
        self, api_client, workspace, user, membership,
    ):
        existing = _make_template(
            workspace, user, name='Existing', is_default=True,
        )
        resp = api_client.post(
            '/api/upload-templates/',
            {'name': 'Plain', 'is_default': False},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert resp.data['is_default'] is False
        existing.refresh_from_db()
        assert existing.is_default is True

    def test_create_default_different_marketplace_independent(
        self, api_client, workspace, user, membership,
    ):
        # A Global default must NOT be cleared when an MBA default is
        # created.
        glob = _make_template(
            workspace, user, name='Global D',
            marketplace_type=UploadTemplate.MarketplaceType.GLOBAL,
            is_default=True,
        )
        resp = api_client.post(
            '/api/upload-templates/',
            {
                'name': 'MBA D',
                'marketplace_type': 'mba',
                'is_default': True,
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201
        glob.refresh_from_db()
        assert glob.is_default is True


# ---------------------------------------------------------------------------
# PATCH /api/upload-templates/{id}/ — clear-then-set on update (AC-54)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestUploadTemplatePatch:
    def test_patch_set_default_clears_prior(
        self, api_client, workspace, user, membership,
    ):
        prior = _make_template(
            workspace, user, name='Prior', is_default=True,
        )
        other = _make_template(
            workspace, user, name='Other', is_default=False,
        )
        resp = api_client.patch(
            f'/api/upload-templates/{other.id}/',
            {'is_default': True},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        assert resp.data['is_default'] is True
        prior.refresh_from_db()
        assert prior.is_default is False
        other.refresh_from_db()
        assert other.is_default is True

    def test_patch_set_default_without_prior_default(
        self, api_client, workspace, user, membership,
    ):
        tpl = _make_template(
            workspace, user, name='Solo', is_default=False,
        )
        resp = api_client.patch(
            f'/api/upload-templates/{tpl.id}/',
            {'is_default': True},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['is_default'] is True

    def test_patch_is_default_true_on_already_default(
        self, api_client, workspace, user, membership,
    ):
        # Setting is_default=True on the existing default must not crash
        # (the clear-then-set excludes the target's own PK).
        tpl = _make_template(
            workspace, user, name='Already Default', is_default=True,
        )
        resp = api_client.patch(
            f'/api/upload-templates/{tpl.id}/',
            {'is_default': True, 'name': 'Renamed'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['is_default'] is True
        assert resp.data['name'] == 'Renamed'


# ---------------------------------------------------------------------------
# GET /api/upload-templates/default/ (AC-56)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestUploadTemplateDefaultGet:
    def test_default_returns_200_when_set(
        self, api_client, workspace, user, membership,
    ):
        default = _make_template(
            workspace, user, name='The Default', is_default=True,
        )
        resp = api_client.get(
            '/api/upload-templates/default/?marketplace_type=mba',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['id'] == str(default.id)
        assert resp.data['is_default'] is True

    def test_default_returns_404_when_none_set(
        self, api_client, workspace, user, membership,
    ):
        _make_template(workspace, user, name='Non-default', is_default=False)
        resp = api_client.get(
            '/api/upload-templates/default/?marketplace_type=mba',
            **ws_headers(workspace),
        )
        assert resp.status_code == 404

    def test_default_marketplace_type_defaults_to_mba(
        self, api_client, workspace, user, membership,
    ):
        default = _make_template(
            workspace, user, name='MBA Default',
            marketplace_type=UploadTemplate.MarketplaceType.MBA,
            is_default=True,
        )
        # Same workspace also has a Global default — must not shadow MBA
        # when the query param is omitted.
        _make_template(
            workspace, user, name='Global Default',
            marketplace_type=UploadTemplate.MarketplaceType.GLOBAL,
            is_default=True,
        )
        resp = api_client.get(
            '/api/upload-templates/default/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['id'] == str(default.id)

    def test_default_invalid_marketplace_returns_400(
        self, api_client, workspace, membership,
    ):
        resp = api_client.get(
            '/api/upload-templates/default/?marketplace_type=not_real',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_default_cross_workspace_excluded(
        self, api_client, workspace, other_workspace, other_user, membership,
    ):
        _make_template(
            other_workspace, other_user, name='Foreign Default',
            is_default=True,
        )
        resp = api_client.get(
            '/api/upload-templates/default/?marketplace_type=mba',
            **ws_headers(workspace),
        )
        # Foreign default must not leak.
        assert resp.status_code == 404

    def test_default_without_header_uses_active_membership(self, api_client):
        # Fallback to user's auto-created personal workspace → no default set → 404.
        resp = api_client.get('/api/upload-templates/default/')
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# URL ordering — /default/ must beat /<uuid:pk>/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestUploadTemplateUrlOrdering:
    def test_default_path_does_not_hit_uuid_route(
        self, api_client, workspace, membership,
    ):
        # No default set -> 404 from the default view. If the URL resolver
        # accidentally routed to the UUID detail view with `default` as the
        # pk, the path converter would reject before dispatch and also 404,
        # but the response body here must come from our default-view (code
        # field present).
        resp = api_client.get(
            '/api/upload-templates/default/?marketplace_type=mba',
            **ws_headers(workspace),
        )
        assert resp.status_code == 404
        # Default view's 404 payload includes an error key; UUID detail
        # view's 404 from get_object_or_404 emits DRF's default 'detail' key.
        assert 'error' in resp.data
