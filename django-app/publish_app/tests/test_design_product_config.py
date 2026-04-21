"""Tests for DesignProductConfig model + API (PROJ-11 F4).

Covers AC-38..AC-44 and EC-11..EC-15:
- Model: unique constraint, cascade delete
- GET: default mba, explicit global, 404 missing, 400 invalid enum, workspace
- PATCH: create on first, update on second, partial fields, color validation,
  price validation, workspace isolation
- Copy-from: full scope, scalar scopes, empty value copies through, 404 missing
  source, workspace isolation, unknown scope, marketplace tab isolation
"""

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from rest_framework.test import APIClient

from publish_app.models import DesignAsset, DesignProductConfig
from workspace_app.models import Membership, Workspace

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def user(db):
    return User.objects.create_user(
        email='cfg@example.com', password='testpass123',
    )


@pytest.fixture
def other_user(db):
    return User.objects.create_user(
        email='cfg-other@example.com', password='testpass123',
    )


@pytest.fixture
def workspace(user):
    return Workspace.objects.create(
        name='Cfg WS', slug='cfg-ws', owner=user,
    )


@pytest.fixture
def other_workspace(other_user):
    return Workspace.objects.create(
        name='Other WS', slug='other-ws', owner=other_user,
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
        workspace=workspace, file_name='design_a.png',
        source=DesignAsset.Source.UPLOAD, created_by=user,
    )


@pytest.fixture
def other_design(workspace, user):
    return DesignAsset.objects.create(
        workspace=workspace, file_name='design_b.png',
        source=DesignAsset.Source.UPLOAD, created_by=user,
    )


@pytest.fixture
def foreign_design(other_workspace, other_user):
    return DesignAsset.objects.create(
        workspace=other_workspace, file_name='foreign.png',
        source=DesignAsset.Source.UPLOAD, created_by=other_user,
    )


def ws_headers(workspace):
    return {'HTTP_X_WORKSPACE_ID': str(workspace.id)}


# ---------------------------------------------------------------------------
# Model tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestDesignProductConfigModel:
    def test_defaults(self, design):
        cfg = DesignProductConfig.objects.create(design=design)
        assert cfg.marketplace_type == 'mba'
        assert cfg.print_side == 'front'
        assert cfg.product_types == []
        assert cfg.fit_types == []
        assert cfg.colors == []
        assert cfg.marketplaces == []

    def test_unique_constraint_on_design_and_marketplace_type(self, design):
        DesignProductConfig.objects.create(
            design=design, marketplace_type='mba',
        )
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                DesignProductConfig.objects.create(
                    design=design, marketplace_type='mba',
                )

    def test_same_design_different_marketplace_types_allowed(self, design):
        DesignProductConfig.objects.create(design=design, marketplace_type='mba')
        DesignProductConfig.objects.create(design=design, marketplace_type='global')
        DesignProductConfig.objects.create(design=design, marketplace_type='displate')
        assert DesignProductConfig.objects.filter(design=design).count() == 3

    def test_cascade_delete_when_design_deleted(self, design):
        """EC-11: Design deletion cascades to configs."""
        DesignProductConfig.objects.create(design=design, marketplace_type='mba')
        DesignProductConfig.objects.create(design=design, marketplace_type='global')
        design_id = design.id
        design.delete()
        assert DesignProductConfig.objects.filter(design_id=design_id).count() == 0


# ---------------------------------------------------------------------------
# GET /api/designs/{id}/product-config/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestProductConfigGet:
    def test_get_default_marketplace_type_is_mba(
        self, api_client, workspace, design, membership,
    ):
        DesignProductConfig.objects.create(
            design=design, marketplace_type='mba', colors=['black'],
        )
        resp = api_client.get(
            f'/api/designs/{design.id}/product-config/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['marketplace_type'] == 'mba'
        assert resp.data['colors'] == ['black']

    def test_get_explicit_global_variant(
        self, api_client, workspace, design, membership,
    ):
        DesignProductConfig.objects.create(design=design, marketplace_type='mba')
        DesignProductConfig.objects.create(
            design=design, marketplace_type='global', print_side='back',
        )
        resp = api_client.get(
            f'/api/designs/{design.id}/product-config/?marketplace_type=global',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['marketplace_type'] == 'global'
        assert resp.data['print_side'] == 'back'

    def test_get_missing_returns_404(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.get(
            f'/api/designs/{design.id}/product-config/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 404

    def test_get_invalid_marketplace_type_returns_400(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.get(
            f'/api/designs/{design.id}/product-config/?marketplace_type=bogus',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_get_cross_workspace_returns_404(
        self, api_client, workspace, foreign_design, membership,
    ):
        """Workspace isolation: design in other workspace is not visible."""
        DesignProductConfig.objects.create(
            design=foreign_design, marketplace_type='mba',
        )
        resp = api_client.get(
            f'/api/designs/{foreign_design.id}/product-config/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 404

    def test_get_without_header_uses_active_membership(
        self, api_client, design, membership,
    ):
        # Fallback to active membership — workspace resolution succeeds,
        # response is 200 (config exists) or 404 (no config yet).
        resp = api_client.get(
            f'/api/designs/{design.id}/product-config/',
        )
        assert resp.status_code in (200, 404)

    def test_get_unauthenticated_returns_401(self, design):
        client = APIClient()
        resp = client.get(f'/api/designs/{design.id}/product-config/')
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# PATCH /api/designs/{id}/product-config/ (upsert)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestProductConfigPatchUpsert:
    def test_patch_creates_row_on_first_call(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'colors': ['black', 'white'],
                'print_side': 'back',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['marketplace_type'] == 'mba'
        assert resp.data['colors'] == ['black', 'white']
        assert resp.data['print_side'] == 'back'
        assert DesignProductConfig.objects.filter(
            design=design, marketplace_type='mba',
        ).count() == 1

    def test_patch_updates_row_on_second_call(
        self, api_client, workspace, design, membership,
    ):
        api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {'marketplace_type': 'mba', 'colors': ['black']},
            format='json', **ws_headers(workspace),
        )
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {'marketplace_type': 'mba', 'colors': ['white', 'navy']},
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['colors'] == ['white', 'navy']
        assert DesignProductConfig.objects.filter(
            design=design, marketplace_type='mba',
        ).count() == 1

    def test_patch_partial_fields_preserves_unspecified(
        self, api_client, workspace, design, membership,
    ):
        api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'colors': ['black'],
                'product_types': ['t_shirt'],
                'print_side': 'back',
            },
            format='json', **ws_headers(workspace),
        )
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {'marketplace_type': 'mba', 'colors': ['red']},
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['colors'] == ['red']
        assert resp.data['product_types'] == ['t_shirt']
        assert resp.data['print_side'] == 'back'

    def test_patch_rejects_invalid_mba_color_key(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {'marketplace_type': 'mba', 'colors': ['not-a-real-color']},
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_patch_allows_arbitrary_colors_for_non_mba(
        self, api_client, workspace, design, membership,
    ):
        """Color palette validation is scoped to MBA only."""
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {'marketplace_type': 'global', 'colors': ['custom-tone']},
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['colors'] == ['custom-tone']

    def test_patch_rejects_non_positive_marketplace_price(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'marketplaces': [
                    {'marketplace': 'amazon.com', 'price': 0, 'enabled': True},
                ],
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_patch_rejects_missing_marketplace_fields(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'marketplaces': [{'marketplace': 'amazon.com', 'price': 19.99}],
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_patch_accepts_valid_marketplace_entries(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'marketplaces': [
                    {'marketplace': 'amazon.com', 'price': 19.99, 'enabled': True},
                    {'marketplace': 'amazon.de', 'price': 17.50, 'enabled': False},
                ],
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert len(resp.data['marketplaces']) == 2

    def test_patch_missing_marketplace_type_returns_400(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {'colors': ['black']},
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_patch_cross_workspace_returns_404(
        self, api_client, workspace, foreign_design, membership,
    ):
        resp = api_client.patch(
            f'/api/designs/{foreign_design.id}/product-config/',
            {'marketplace_type': 'mba', 'colors': ['black']},
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 404

    def test_concurrent_patch_last_write_wins_ec14(
        self, api_client, workspace, design, membership,
    ):
        """EC-14: no optimistic locking — two sequential PATCHes to the same
        (design, marketplace_type) both succeed; final state = second write."""
        url = f'/api/designs/{design.id}/product-config/'
        resp1 = api_client.patch(
            url,
            {'marketplace_type': 'mba', 'colors': ['black']},
            format='json', **ws_headers(workspace),
        )
        assert resp1.status_code == 200
        resp2 = api_client.patch(
            url,
            {'marketplace_type': 'mba', 'colors': ['white']},
            format='json', **ws_headers(workspace),
        )
        assert resp2.status_code == 200

        config = DesignProductConfig.objects.get(
            design=design, marketplace_type='mba',
        )
        assert config.colors == ['white']
        assert DesignProductConfig.objects.filter(
            design=design, marketplace_type='mba',
        ).count() == 1

    def test_patch_tab_isolation_mba_does_not_leak_to_global(
        self, api_client, workspace, design, membership,
    ):
        """EC-12: tab switch refetches correct row; configs independent."""
        api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {'marketplace_type': 'mba', 'colors': ['black']},
            format='json', **ws_headers(workspace),
        )
        api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {'marketplace_type': 'global', 'colors': ['custom']},
            format='json', **ws_headers(workspace),
        )
        mba_resp = api_client.get(
            f'/api/designs/{design.id}/product-config/?marketplace_type=mba',
            **ws_headers(workspace),
        )
        global_resp = api_client.get(
            f'/api/designs/{design.id}/product-config/?marketplace_type=global',
            **ws_headers(workspace),
        )
        assert mba_resp.data['colors'] == ['black']
        assert global_resp.data['colors'] == ['custom']


# ---------------------------------------------------------------------------
# POST /api/designs/{id}/product-config/copy-from/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestProductConfigCopyFrom:
    def test_copy_all_copies_every_field(
        self, api_client, workspace, design, other_design, membership,
    ):
        DesignProductConfig.objects.create(
            design=design, marketplace_type='mba',
            colors=['black', 'white'],
            product_types=['t_shirt'],
            fit_types=['men', 'women'],
            print_side='back',
            marketplaces=[
                {'marketplace': 'amazon.com', 'price': 19.99, 'enabled': True},
            ],
        )
        resp = api_client.post(
            f'/api/designs/{other_design.id}/product-config/copy-from/',
            {
                'source_design_id': str(design.id),
                'marketplace_type': 'mba',
                'scope': 'all',
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['colors'] == ['black', 'white']
        assert resp.data['product_types'] == ['t_shirt']
        assert resp.data['fit_types'] == ['men', 'women']
        assert resp.data['print_side'] == 'back'
        assert len(resp.data['marketplaces']) == 1

    def test_copy_colors_scope_copies_only_colors(
        self, api_client, workspace, design, other_design, membership,
    ):
        DesignProductConfig.objects.create(
            design=design, marketplace_type='mba',
            colors=['black'], product_types=['t_shirt'],
        )
        DesignProductConfig.objects.create(
            design=other_design, marketplace_type='mba',
            colors=['red'], product_types=['hoodie'],
        )
        resp = api_client.post(
            f'/api/designs/{other_design.id}/product-config/copy-from/',
            {
                'source_design_id': str(design.id),
                'marketplace_type': 'mba',
                'scope': 'colors',
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['colors'] == ['black']
        # product_types preserved on target (not copied)
        assert resp.data['product_types'] == ['hoodie']

    def test_copy_empty_source_value_copies_through(
        self, api_client, workspace, design, other_design, membership,
    ):
        """EC-15: empty list is copied (not skipped)."""
        DesignProductConfig.objects.create(
            design=design, marketplace_type='mba', colors=[],
        )
        DesignProductConfig.objects.create(
            design=other_design, marketplace_type='mba',
            colors=['red', 'black'],
        )
        resp = api_client.post(
            f'/api/designs/{other_design.id}/product-config/copy-from/',
            {
                'source_design_id': str(design.id),
                'marketplace_type': 'mba',
                'scope': 'colors',
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['colors'] == []

    def test_copy_creates_target_when_target_has_no_config(
        self, api_client, workspace, design, other_design, membership,
    ):
        DesignProductConfig.objects.create(
            design=design, marketplace_type='mba',
            colors=['black'], print_side='both',
        )
        resp = api_client.post(
            f'/api/designs/{other_design.id}/product-config/copy-from/',
            {
                'source_design_id': str(design.id),
                'marketplace_type': 'mba',
                'scope': 'all',
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['colors'] == ['black']
        assert resp.data['print_side'] == 'both'

    def test_copy_404_when_source_has_no_config(
        self, api_client, workspace, design, other_design, membership,
    ):
        """EC-13: source missing config for marketplace_type -> 404."""
        resp = api_client.post(
            f'/api/designs/{other_design.id}/product-config/copy-from/',
            {
                'source_design_id': str(design.id),
                'marketplace_type': 'mba',
                'scope': 'all',
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 404

    def test_copy_source_cross_workspace_returns_404(
        self, api_client, workspace, other_design, foreign_design, membership,
    ):
        """Workspace isolation on source."""
        DesignProductConfig.objects.create(
            design=foreign_design, marketplace_type='mba', colors=['black'],
        )
        resp = api_client.post(
            f'/api/designs/{other_design.id}/product-config/copy-from/',
            {
                'source_design_id': str(foreign_design.id),
                'marketplace_type': 'mba',
                'scope': 'all',
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 404

    def test_copy_target_cross_workspace_returns_404(
        self, api_client, workspace, design, foreign_design, membership,
    ):
        """Workspace isolation on target design via URL."""
        DesignProductConfig.objects.create(
            design=design, marketplace_type='mba', colors=['black'],
        )
        resp = api_client.post(
            f'/api/designs/{foreign_design.id}/product-config/copy-from/',
            {
                'source_design_id': str(design.id),
                'marketplace_type': 'mba',
                'scope': 'all',
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 404

    def test_copy_unknown_scope_returns_400(
        self, api_client, workspace, design, other_design, membership,
    ):
        resp = api_client.post(
            f'/api/designs/{other_design.id}/product-config/copy-from/',
            {
                'source_design_id': str(design.id),
                'marketplace_type': 'mba',
                'scope': 'garbage',
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_copy_source_equals_target_returns_400(
        self, api_client, workspace, design, membership,
    ):
        DesignProductConfig.objects.create(
            design=design, marketplace_type='mba', colors=['black'],
        )
        resp = api_client.post(
            f'/api/designs/{design.id}/product-config/copy-from/',
            {
                'source_design_id': str(design.id),
                'marketplace_type': 'mba',
                'scope': 'all',
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_copy_does_not_leak_across_marketplace_types(
        self, api_client, workspace, design, other_design, membership,
    ):
        """Source mba -> target mba only; global config stays untouched."""
        DesignProductConfig.objects.create(
            design=design, marketplace_type='mba', colors=['black'],
        )
        DesignProductConfig.objects.create(
            design=other_design, marketplace_type='global', colors=['custom'],
        )
        api_client.post(
            f'/api/designs/{other_design.id}/product-config/copy-from/',
            {
                'source_design_id': str(design.id),
                'marketplace_type': 'mba',
                'scope': 'all',
            },
            format='json', **ws_headers(workspace),
        )
        global_resp = api_client.get(
            f'/api/designs/{other_design.id}/product-config/?marketplace_type=global',
            **ws_headers(workspace),
        )
        assert global_resp.status_code == 200
        assert global_resp.data['colors'] == ['custom']

    def test_copy_unauthenticated_returns_401(self, design, other_design):
        client = APIClient()
        resp = client.post(
            f'/api/designs/{other_design.id}/product-config/copy-from/',
            {
                'source_design_id': str(design.id),
                'marketplace_type': 'mba',
                'scope': 'all',
            },
            format='json',
        )
        assert resp.status_code == 401
