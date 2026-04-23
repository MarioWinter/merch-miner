"""Tests for DesignProductConfig model + API (PROJ-11 F4 / Phase J2).

Phase J2 shape (AC-38): flat fields (product_types/fit_types/print_side/
colors/marketplaces) collapsed into a single per-design JSON list
``products_config``. Each entry:

    {
      "product_type": str,
      "enabled": bool,
      "fit_types": [str],
      "print_side": "front" | "back" | "both",
      "colors": [str],
      "marketplaces": [{"marketplace": str, "price": number>=0, "enabled": bool}],
    }

Covers AC-38..AC-44 + EC-11..EC-15:
- Model: unique constraint, cascade delete, default empty list.
- GET: default mba, explicit global, 404 missing, 400 invalid enum, workspace.
- PATCH full-replace: shape validation (including MBA color palette, price>=0).
- PATCH targeted op=upsert_product: update existing, append new, partial merge.
- Copy-from scope=all, scope=<field> with and without product_type, 404 paths.
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


def _entry(product_type='t_shirt', **overrides):
    """Build a valid ``products_config`` entry with sensible defaults."""
    base = {
        'product_type': product_type,
        'enabled': True,
        'fit_types': ['men'],
        'print_side': 'front',
        'colors': ['black'],
        'marketplaces': [
            {'marketplace': 'amazon.com', 'price': 19.99, 'enabled': True},
        ],
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# Model tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestDesignProductConfigModel:
    def test_default_products_config_is_empty_list(self, design):
        cfg = DesignProductConfig.objects.create(design=design)
        assert cfg.marketplace_type == 'mba'
        assert cfg.products_config == []

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
            design=design, marketplace_type='mba',
            products_config=[_entry()],
        )
        resp = api_client.get(
            f'/api/designs/{design.id}/product-config/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['marketplace_type'] == 'mba'
        assert len(resp.data['products_config']) == 1
        assert resp.data['products_config'][0]['product_type'] == 't_shirt'

    def test_get_explicit_global_variant(
        self, api_client, workspace, design, membership,
    ):
        DesignProductConfig.objects.create(
            design=design, marketplace_type='mba',
            products_config=[_entry()],
        )
        DesignProductConfig.objects.create(
            design=design, marketplace_type='global',
            products_config=[_entry(print_side='back')],
        )
        resp = api_client.get(
            f'/api/designs/{design.id}/product-config/?marketplace_type=global',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['marketplace_type'] == 'global'
        assert resp.data['products_config'][0]['print_side'] == 'back'

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
            products_config=[_entry()],
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
# PATCH /api/designs/{id}/product-config/ -- full replace
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestProductConfigPatchFullReplace:
    def test_patch_creates_row_on_first_call(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'products_config': [_entry()],
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        assert resp.data['marketplace_type'] == 'mba'
        assert len(resp.data['products_config']) == 1
        assert DesignProductConfig.objects.filter(
            design=design, marketplace_type='mba',
        ).count() == 1

    def test_patch_updates_row_on_second_call(
        self, api_client, workspace, design, membership,
    ):
        api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'products_config': [_entry(product_type='t_shirt')],
            },
            format='json', **ws_headers(workspace),
        )
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'products_config': [_entry(product_type='hoodie')],
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert [
            e['product_type'] for e in resp.data['products_config']
        ] == ['hoodie']
        assert DesignProductConfig.objects.filter(
            design=design, marketplace_type='mba',
        ).count() == 1

    def test_patch_rejects_invalid_mba_color_key(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'products_config': [_entry(colors=['not-a-real-color'])],
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_patch_allows_arbitrary_colors_for_non_mba(
        self, api_client, workspace, design, membership,
    ):
        """Color palette validation is scoped to MBA only (Q1=A)."""
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'global',
                'products_config': [_entry(colors=['custom-tone'])],
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['products_config'][0]['colors'] == ['custom-tone']

    def test_patch_rejects_negative_marketplace_price(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'products_config': [
                    _entry(marketplaces=[
                        {
                            'marketplace': 'amazon.com',
                            'price': -1,
                            'enabled': True,
                        },
                    ]),
                ],
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_patch_accepts_zero_price(
        self, api_client, workspace, design, membership,
    ):
        """Q1=A: price >= 0, so 0 is valid (unlike legacy > 0 rule)."""
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'products_config': [
                    _entry(marketplaces=[
                        {
                            'marketplace': 'amazon.com',
                            'price': 0,
                            'enabled': True,
                        },
                    ]),
                ],
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 200

    def test_patch_rejects_marketplace_entry_missing_enabled(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'products_config': [
                    _entry(marketplaces=[
                        {'marketplace': 'amazon.com', 'price': 19.99},
                    ]),
                ],
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_patch_rejects_entry_missing_required_keys(
        self, api_client, workspace, design, membership,
    ):
        """Full-replace requires every entry key."""
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'products_config': [
                    {'product_type': 't_shirt', 'enabled': True},
                ],
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_patch_rejects_duplicate_product_type_keys(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'products_config': [_entry(), _entry()],
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_patch_rejects_invalid_print_side(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'products_config': [_entry(print_side='diagonal')],
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_patch_rejects_unknown_entry_key(
        self, api_client, workspace, design, membership,
    ):
        entry = _entry()
        entry['bogus'] = 'value'
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'products_config': [entry],
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_patch_missing_marketplace_type_returns_400(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {'products_config': [_entry()]},
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_patch_missing_body_shape_returns_400(
        self, api_client, workspace, design, membership,
    ):
        """Neither `products_config` nor `op` -> 400."""
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {'marketplace_type': 'mba'},
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_patch_both_shapes_rejected(
        self, api_client, workspace, design, membership,
    ):
        """Full-replace and op together -> 400."""
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'products_config': [_entry()],
                'op': 'upsert_product',
                'product_type': 't_shirt',
                'patch': {'enabled': False},
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_patch_cross_workspace_returns_404(
        self, api_client, workspace, foreign_design, membership,
    ):
        resp = api_client.patch(
            f'/api/designs/{foreign_design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'products_config': [_entry()],
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 404

    def test_patch_tab_isolation_mba_does_not_leak_to_global(
        self, api_client, workspace, design, membership,
    ):
        """EC-12: tab switch refetches correct row; configs independent."""
        api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'products_config': [_entry(colors=['black'])],
            },
            format='json', **ws_headers(workspace),
        )
        api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'global',
                'products_config': [_entry(colors=['custom'])],
            },
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
        assert mba_resp.data['products_config'][0]['colors'] == ['black']
        assert global_resp.data['products_config'][0]['colors'] == ['custom']


# ---------------------------------------------------------------------------
# PATCH targeted op=upsert_product
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestProductConfigPatchTargetedOp:
    def test_upsert_existing_product_updates_only_that_entry(
        self, api_client, workspace, design, membership,
    ):
        DesignProductConfig.objects.create(
            design=design, marketplace_type='mba',
            products_config=[
                _entry(product_type='t_shirt', colors=['black']),
                _entry(product_type='hoodie', colors=['navy']),
            ],
        )
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'op': 'upsert_product',
                'product_type': 't_shirt',
                'patch': {'colors': ['white']},
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        entries = {e['product_type']: e for e in resp.data['products_config']}
        assert entries['t_shirt']['colors'] == ['white']
        # Other fields preserved.
        assert entries['t_shirt']['fit_types'] == ['men']
        # Other product untouched.
        assert entries['hoodie']['colors'] == ['navy']

    def test_upsert_new_product_appends_entry(
        self, api_client, workspace, design, membership,
    ):
        DesignProductConfig.objects.create(
            design=design, marketplace_type='mba',
            products_config=[_entry(product_type='t_shirt')],
        )
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'op': 'upsert_product',
                'product_type': 'hoodie',
                'patch': {
                    'enabled': True,
                    'fit_types': ['women'],
                    'print_side': 'back',
                    'colors': ['red'],
                    'marketplaces': [
                        {
                            'marketplace': 'amazon.com',
                            'price': 24.99,
                            'enabled': True,
                        },
                    ],
                },
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        entries = {e['product_type']: e for e in resp.data['products_config']}
        assert set(entries.keys()) == {'t_shirt', 'hoodie'}
        assert entries['hoodie']['colors'] == ['red']

    def test_upsert_creates_row_when_missing(
        self, api_client, workspace, design, membership,
    ):
        """op=upsert_product on a design with no config -> creates row."""
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'op': 'upsert_product',
                'product_type': 't_shirt',
                'patch': {'enabled': True, 'colors': ['black']},
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        assert resp.data['products_config'] == [
            {'product_type': 't_shirt', 'enabled': True, 'colors': ['black']},
        ]

    def test_upsert_invalid_patch_colors_rejected(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'op': 'upsert_product',
                'product_type': 't_shirt',
                'patch': {'colors': ['not-a-real-color']},
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_upsert_missing_product_type_returns_400(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'op': 'upsert_product',
                'patch': {'enabled': True},
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_upsert_missing_patch_returns_400(
        self, api_client, workspace, design, membership,
    ):
        resp = api_client.patch(
            f'/api/designs/{design.id}/product-config/',
            {
                'marketplace_type': 'mba',
                'op': 'upsert_product',
                'product_type': 't_shirt',
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# POST /api/designs/{id}/product-config/copy-from/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestProductConfigCopyFrom:
    def test_copy_all_copies_entire_products_config(
        self, api_client, workspace, design, other_design, membership,
    ):
        DesignProductConfig.objects.create(
            design=design, marketplace_type='mba',
            products_config=[
                _entry(product_type='t_shirt', colors=['black']),
                _entry(product_type='hoodie', colors=['navy'],
                       marketplaces=[
                           {
                               'marketplace': 'amazon.de', 'price': 25,
                               'enabled': True,
                           },
                       ]),
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
        assert resp.status_code == 200, resp.data
        keys = {e['product_type'] for e in resp.data['products_config']}
        assert keys == {'t_shirt', 'hoodie'}

    def test_copy_scalar_scope_with_product_type_copies_one_field_one_entry(
        self, api_client, workspace, design, other_design, membership,
    ):
        """AC-41: scope=colors + product_type -> just that field on that entry."""
        DesignProductConfig.objects.create(
            design=design, marketplace_type='mba',
            products_config=[
                _entry(product_type='t_shirt', colors=['red']),
                _entry(product_type='hoodie', colors=['green']),
            ],
        )
        DesignProductConfig.objects.create(
            design=other_design, marketplace_type='mba',
            products_config=[
                _entry(product_type='t_shirt', colors=['white']),
                _entry(product_type='hoodie', colors=['blue']),
            ],
        )
        resp = api_client.post(
            f'/api/designs/{other_design.id}/product-config/copy-from/',
            {
                'source_design_id': str(design.id),
                'marketplace_type': 'mba',
                'scope': 'colors',
                'product_type': 't_shirt',
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        entries = {e['product_type']: e for e in resp.data['products_config']}
        # t_shirt got 'red' (from source).
        assert entries['t_shirt']['colors'] == ['red']
        # hoodie untouched on target.
        assert entries['hoodie']['colors'] == ['blue']
        # t_shirt fit_types preserved (scalar scope did not copy fit_types).
        assert entries['t_shirt']['fit_types'] == ['men']

    def test_copy_scalar_scope_without_product_type_applies_to_all_target_entries(
        self, api_client, workspace, design, other_design, membership,
    ):
        """AC-41: scope=colors + no product_type -> apply source value across
        all target entries."""
        DesignProductConfig.objects.create(
            design=design, marketplace_type='mba',
            products_config=[
                _entry(product_type='t_shirt', colors=['black', 'white']),
            ],
        )
        DesignProductConfig.objects.create(
            design=other_design, marketplace_type='mba',
            products_config=[
                _entry(product_type='t_shirt', colors=['red']),
                _entry(product_type='hoodie', colors=['blue']),
            ],
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
        assert resp.status_code == 200, resp.data
        for entry in resp.data['products_config']:
            assert entry['colors'] == ['black', 'white']

    def test_copy_creates_target_when_target_has_no_config(
        self, api_client, workspace, design, other_design, membership,
    ):
        DesignProductConfig.objects.create(
            design=design, marketplace_type='mba',
            products_config=[_entry()],
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
        assert len(resp.data['products_config']) == 1

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

    def test_copy_404_when_scalar_scope_product_type_missing_on_source(
        self, api_client, workspace, design, other_design, membership,
    ):
        DesignProductConfig.objects.create(
            design=design, marketplace_type='mba',
            products_config=[_entry(product_type='t_shirt')],
        )
        resp = api_client.post(
            f'/api/designs/{other_design.id}/product-config/copy-from/',
            {
                'source_design_id': str(design.id),
                'marketplace_type': 'mba',
                'scope': 'colors',
                'product_type': 'hoodie',
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 404

    def test_copy_source_cross_workspace_returns_404(
        self, api_client, workspace, other_design, foreign_design, membership,
    ):
        DesignProductConfig.objects.create(
            design=foreign_design, marketplace_type='mba',
            products_config=[_entry()],
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
        DesignProductConfig.objects.create(
            design=design, marketplace_type='mba',
            products_config=[_entry()],
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

    def test_copy_legacy_scope_product_types_removed_returns_400(
        self, api_client, workspace, design, other_design, membership,
    ):
        """`product_types` was a legacy scope; no longer valid."""
        resp = api_client.post(
            f'/api/designs/{other_design.id}/product-config/copy-from/',
            {
                'source_design_id': str(design.id),
                'marketplace_type': 'mba',
                'scope': 'product_types',
            },
            format='json', **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_copy_source_equals_target_returns_400(
        self, api_client, workspace, design, membership,
    ):
        DesignProductConfig.objects.create(
            design=design, marketplace_type='mba',
            products_config=[_entry()],
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
            design=design, marketplace_type='mba',
            products_config=[_entry(colors=['black'])],
        )
        DesignProductConfig.objects.create(
            design=other_design, marketplace_type='global',
            products_config=[_entry(colors=['custom'])],
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
        assert global_resp.data['products_config'][0]['colors'] == ['custom']

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
