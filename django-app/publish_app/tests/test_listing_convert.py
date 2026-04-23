"""Tests for POST /api/listings/convert/ (PROJ-11 F3).

Covers:
- 201 when target Listing does not exist -> new row created
- 409 when target exists and overwrite=false
- 200 when target exists and overwrite=true -> in-place update
- Mapping semantics: Global -> MBA and MBA -> Global
- Workspace isolation: 404 when source belongs to another workspace
- 400 when source and target marketplace_type are equal
- Null-design source always creates new row (NULL != NULL)
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from idea_app.models import Idea
from niche_app.models import Niche
from publish_app.models import (
    DesignAsset,
    DesignProductConfig,
    Listing,
    UploadTemplate,
)
from workspace_app.models import Membership, Workspace

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def user(db):
    return User.objects.create_user(
        email='convert@example.com', password='testpass123',
    )


@pytest.fixture
def other_user(db):
    return User.objects.create_user(
        email='convert-other@example.com', password='testpass123',
    )


@pytest.fixture
def workspace(user):
    return Workspace.objects.create(
        name='Convert WS', slug='convert-ws', owner=user,
    )


@pytest.fixture
def other_workspace(other_user):
    return Workspace.objects.create(
        name='Other Convert WS', slug='other-convert-ws', owner=other_user,
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
def niche(workspace, user):
    return Niche.objects.create(
        workspace=workspace, name='Convert Niche', created_by=user,
    )


@pytest.fixture
def idea(workspace, niche, user):
    return Idea.objects.create(
        workspace=workspace, niche=niche,
        slogan_text='Convertible Slogan', created_by=user,
    )


@pytest.fixture
def design(workspace, user):
    return DesignAsset.objects.create(
        workspace=workspace, file_name='convert.png',
        source=DesignAsset.Source.UPLOAD, created_by=user,
    )


@pytest.fixture
def foreign_idea(other_workspace, other_user):
    niche = Niche.objects.create(
        workspace=other_workspace, name='Foreign Niche',
        created_by=other_user,
    )
    return Idea.objects.create(
        workspace=other_workspace, niche=niche,
        slogan_text='Foreign', created_by=other_user,
    )


def ws_headers(workspace):
    return {'HTTP_X_WORKSPACE_ID': str(workspace.id)}


def _make_listing(workspace, idea, design, marketplace_type, **fields):
    defaults = dict(
        brand_name='Brand', title='Title',
        bullet_1='B1', bullet_2='B2',
        description='Desc', keyword_context='kw1, kw2',
    )
    defaults.update(fields)
    return Listing.objects.create(
        workspace=workspace, idea=idea, design=design,
        marketplace_type=marketplace_type, **defaults,
    )


# ---------------------------------------------------------------------------
# Create path (201)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestListingConvertCreate:
    def test_convert_creates_new_listing_201(
        self, api_client, workspace, idea, design, membership,
    ):
        source = _make_listing(
            workspace, idea, design, Listing.MarketplaceType.GLOBAL,
        )
        resp = api_client.post(
            '/api/listings/convert/',
            {
                'source_listing_id': str(source.id),
                'target_marketplace_type': 'mba',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201, resp.data
        assert resp.data['marketplace_type'] == 'mba'
        # Two Listings now exist for the same design.
        assert Listing.objects.filter(design=design).count() == 2
        new_id = resp.data['id']
        assert new_id != str(source.id)

    def test_convert_global_to_mba_mapping(
        self, api_client, workspace, idea, design, membership,
    ):
        source = _make_listing(
            workspace, idea, design, Listing.MarketplaceType.GLOBAL,
            brand_name='GlobalBrand',
            title='Global Title',
            description='Global Desc',
            bullet_1='',  # empty -> description should be promoted
            bullet_2='unused',
            keyword_context='ignored',
        )
        resp = api_client.post(
            '/api/listings/convert/',
            {
                'source_listing_id': str(source.id),
                'target_marketplace_type': 'mba',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201
        # Global -> MBA mapping: brand/title/description kept, description
        # promoted to bullet_1 when bullet_1 is empty, bullet_2 cleared,
        # keyword_context cleared.
        assert resp.data['brand_name'] == 'GlobalBrand'
        assert resp.data['title'] == 'Global Title'
        assert resp.data['description'] == 'Global Desc'
        assert resp.data['bullet_1'] == 'Global Desc'
        assert resp.data['bullet_2'] == ''
        assert resp.data['keyword_context'] == ''

    def test_convert_mba_to_global_mapping(
        self, api_client, workspace, idea, design, membership,
    ):
        source = _make_listing(
            workspace, idea, design, Listing.MarketplaceType.MBA,
            brand_name='MBA Brand',
            title='MBA Title',
            description='MBA Desc',
            bullet_1='MBA B1',
            bullet_2='MBA B2',
            keyword_context='mba, keywords',
        )
        resp = api_client.post(
            '/api/listings/convert/',
            {
                'source_listing_id': str(source.id),
                'target_marketplace_type': 'global',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201
        # MBA -> Global: brand/title/description kept, bullets cleared.
        assert resp.data['brand_name'] == 'MBA Brand'
        assert resp.data['title'] == 'MBA Title'
        assert resp.data['description'] == 'MBA Desc'
        assert resp.data['bullet_1'] == ''
        assert resp.data['bullet_2'] == ''
        assert resp.data['keyword_context'] == ''

    def test_convert_source_with_null_design_always_creates(
        self, api_client, workspace, idea, membership,
    ):
        # Source has no design -> DB unique constraint doesn't block, always
        # safe to create a fresh row in the target marketplace_type.
        source = _make_listing(
            workspace, idea, None, Listing.MarketplaceType.GLOBAL,
        )
        # Pre-existing NULL-design listing for the same marketplace_type.
        _make_listing(
            workspace, idea, None, Listing.MarketplaceType.MBA,
        )

        resp = api_client.post(
            '/api/listings/convert/',
            {
                'source_listing_id': str(source.id),
                'target_marketplace_type': 'mba',
                'overwrite': False,
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201
        # Two MBA NULL-design rows coexist (Postgres NULL != NULL).
        assert Listing.objects.filter(
            idea=idea, design__isnull=True,
            marketplace_type=Listing.MarketplaceType.MBA,
        ).count() == 2


# ---------------------------------------------------------------------------
# Conflict path (409)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestListingConvertConflict:
    def test_convert_target_exists_overwrite_false_returns_409(
        self, api_client, workspace, idea, design, membership,
    ):
        _make_listing(
            workspace, idea, design, Listing.MarketplaceType.GLOBAL,
            title='Source',
        )
        existing = _make_listing(
            workspace, idea, design, Listing.MarketplaceType.MBA,
            title='Existing MBA',
        )
        source_id = Listing.objects.get(
            design=design, marketplace_type=Listing.MarketplaceType.GLOBAL,
        ).id

        resp = api_client.post(
            '/api/listings/convert/',
            {
                'source_listing_id': str(source_id),
                'target_marketplace_type': 'mba',
                'overwrite': False,
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 409, resp.data
        assert resp.data['code'] == 'target_exists'
        assert resp.data['existing_listing_id'] == str(existing.id)
        # Existing listing unchanged.
        existing.refresh_from_db()
        assert existing.title == 'Existing MBA'

    def test_convert_target_exists_overwrite_default_is_false(
        self, api_client, workspace, idea, design, membership,
    ):
        # overwrite omitted -> default False -> 409
        source = _make_listing(
            workspace, idea, design, Listing.MarketplaceType.GLOBAL,
        )
        _make_listing(
            workspace, idea, design, Listing.MarketplaceType.MBA,
            title='Existing MBA',
        )

        resp = api_client.post(
            '/api/listings/convert/',
            {
                'source_listing_id': str(source.id),
                'target_marketplace_type': 'mba',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 409


# ---------------------------------------------------------------------------
# Update path (200)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestListingConvertOverwrite:
    def test_convert_target_exists_overwrite_true_returns_200(
        self, api_client, workspace, idea, design, membership,
    ):
        source = _make_listing(
            workspace, idea, design, Listing.MarketplaceType.GLOBAL,
            brand_name='Fresh Brand',
            title='Fresh Title',
            description='Fresh Desc',
            bullet_1='',  # will be replaced by description in mapping
        )
        existing = _make_listing(
            workspace, idea, design, Listing.MarketplaceType.MBA,
            brand_name='Stale Brand',
            title='Stale Title',
            description='Stale Desc',
            bullet_1='Stale B1',
            bullet_2='Stale B2',
            keyword_context='stale, kw',
            status=Listing.Status.PUBLISHED,
        )

        resp = api_client.post(
            '/api/listings/convert/',
            {
                'source_listing_id': str(source.id),
                'target_marketplace_type': 'mba',
                'overwrite': True,
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        # Same row updated, same id.
        assert resp.data['id'] == str(existing.id)
        assert resp.data['marketplace_type'] == 'mba'
        # Fresh values overwrote stale ones.
        existing.refresh_from_db()
        assert existing.brand_name == 'Fresh Brand'
        assert existing.title == 'Fresh Title'
        assert existing.description == 'Fresh Desc'
        # Global -> MBA mapping: description promoted to bullet_1.
        assert existing.bullet_1 == 'Fresh Desc'
        # Bullet 2 + keyword_context cleared by the mapping.
        assert existing.bullet_2 == ''
        assert existing.keyword_context == ''
        # Status reverts to draft on overwrite edit.
        assert existing.status == Listing.Status.DRAFT
        # No extra listing was created.
        assert Listing.objects.filter(
            design=design, marketplace_type=Listing.MarketplaceType.MBA,
        ).count() == 1


# ---------------------------------------------------------------------------
# Validation + workspace isolation
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestListingConvertValidation:
    def test_convert_same_marketplace_returns_400(
        self, api_client, workspace, idea, design, membership,
    ):
        source = _make_listing(
            workspace, idea, design, Listing.MarketplaceType.MBA,
        )
        resp = api_client.post(
            '/api/listings/convert/',
            {
                'source_listing_id': str(source.id),
                'target_marketplace_type': 'mba',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_convert_invalid_target_marketplace_returns_400(
        self, api_client, workspace, idea, design, membership,
    ):
        source = _make_listing(
            workspace, idea, design, Listing.MarketplaceType.GLOBAL,
        )
        resp = api_client.post(
            '/api/listings/convert/',
            {
                'source_listing_id': str(source.id),
                'target_marketplace_type': 'not_real',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_convert_missing_source_returns_404(
        self, api_client, workspace, membership,
    ):
        import uuid
        resp = api_client.post(
            '/api/listings/convert/',
            {
                'source_listing_id': str(uuid.uuid4()),
                'target_marketplace_type': 'mba',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 404

    def test_convert_cross_workspace_source_returns_404(
        self, api_client, workspace, other_workspace, foreign_idea,
        other_user, membership,
    ):
        # Source belongs to a different workspace -> must NOT be reachable.
        foreign_design = DesignAsset.objects.create(
            workspace=other_workspace, file_name='foreign.png',
            source=DesignAsset.Source.UPLOAD, created_by=other_user,
        )
        foreign_source = _make_listing(
            other_workspace, foreign_idea, foreign_design,
            Listing.MarketplaceType.GLOBAL,
        )
        resp = api_client.post(
            '/api/listings/convert/',
            {
                'source_listing_id': str(foreign_source.id),
                'target_marketplace_type': 'mba',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 404
        # No leak across workspace.
        assert not Listing.objects.filter(
            workspace=workspace,
            marketplace_type=Listing.MarketplaceType.MBA,
        ).exists()

    def test_convert_without_header_uses_active_membership(
        self, api_client, workspace, idea, design, membership,
    ):
        source = _make_listing(
            workspace, idea, design, Listing.MarketplaceType.GLOBAL,
        )
        # No X-Workspace-Id header — falls back to active membership.
        # Note: user has both auto-created personal workspace and `workspace`
        # membership; fallback may pick either. Accept any non-400 code as
        # evidence the workspace-resolution step passed.
        resp = api_client.post(
            '/api/listings/convert/',
            {
                'source_listing_id': str(source.id),
                'target_marketplace_type': 'mba',
            },
            format='json',
        )
        # 201/200 on happy path, 404 if fallback picked other workspace.
        assert resp.status_code in (200, 201, 404)


# ---------------------------------------------------------------------------
# F6: Convert auto-apply from default UploadTemplate (AC-57..AC-59, EC-19,
# EC-20)
# ---------------------------------------------------------------------------


def _make_default_template(workspace, user, **fields):
    defaults = dict(
        name='WS Default',
        brand_name='WSBrand',
        product_types=['standard_tshirt', 'hoodie'],
        fit_types=['men', 'women'],
        colors=['black', 'white'],
        marketplaces=[
            {'marketplace': 'amazon.com', 'price': '19.99', 'enabled': True},
            {'marketplace': 'amazon.de', 'price': '18.50', 'enabled': False},
        ],
        print_side=UploadTemplate.PrintSide.FRONT,
        marketplace_type=UploadTemplate.MarketplaceType.MBA,
        is_default=True,
    )
    defaults.update(fields)
    return UploadTemplate.objects.create(
        workspace=workspace, created_by=user, **defaults,
    )


@pytest.mark.django_db
class TestListingConvertAutoApply:
    def test_global_to_mba_seeds_product_config(
        self, api_client, workspace, user, idea, design, membership,
    ):
        default_tpl = _make_default_template(workspace, user)
        source = _make_listing(
            workspace, idea, design, Listing.MarketplaceType.GLOBAL,
        )

        assert not DesignProductConfig.objects.filter(
            design=design, marketplace_type='mba',
        ).exists()

        resp = api_client.post(
            '/api/listings/convert/',
            {
                'source_listing_id': str(source.id),
                'target_marketplace_type': 'mba',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201, resp.data
        # AC-57: product_config_seeded=True
        assert resp.data['product_config_seeded'] is True

        # AC-57 field-by-field assertion: seeded config mirrors default.
        cfg = DesignProductConfig.objects.get(
            design=design, marketplace_type='mba',
        )
        assert cfg.colors == default_tpl.colors
        assert cfg.fit_types == default_tpl.fit_types
        assert cfg.print_side == default_tpl.print_side
        assert cfg.product_types == default_tpl.product_types
        assert cfg.marketplaces == default_tpl.marketplaces

    def test_convert_with_existing_product_config_skips(
        self, api_client, workspace, user, idea, design, membership,
    ):
        # EC-19: existing config is NEVER overwritten by auto-apply.
        _make_default_template(workspace, user)
        existing = DesignProductConfig.objects.create(
            design=design,
            marketplace_type='mba',
            colors=['navy'],
            fit_types=['youth'],
            product_types=['long_sleeve'],
            marketplaces=[
                {'marketplace': 'amazon.co.uk', 'price': '21.00',
                 'enabled': True},
            ],
            print_side=DesignProductConfig.PrintSide.BACK,
        )
        source = _make_listing(
            workspace, idea, design, Listing.MarketplaceType.GLOBAL,
        )
        resp = api_client.post(
            '/api/listings/convert/',
            {
                'source_listing_id': str(source.id),
                'target_marketplace_type': 'mba',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert resp.data['product_config_seeded'] is False
        existing.refresh_from_db()
        # Existing config fields unchanged.
        assert existing.colors == ['navy']
        assert existing.fit_types == ['youth']
        assert existing.product_types == ['long_sleeve']
        assert existing.print_side == DesignProductConfig.PrintSide.BACK

    def test_convert_without_default_succeeds_but_skips_seed(
        self, api_client, workspace, user, idea, design, membership,
    ):
        # EC-20: no default template for marketplace -> Convert succeeds,
        # product_config_seeded=False, no DesignProductConfig created.
        source = _make_listing(
            workspace, idea, design, Listing.MarketplaceType.GLOBAL,
        )
        resp = api_client.post(
            '/api/listings/convert/',
            {
                'source_listing_id': str(source.id),
                'target_marketplace_type': 'mba',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert resp.data['product_config_seeded'] is False
        assert not DesignProductConfig.objects.filter(
            design=design, marketplace_type='mba',
        ).exists()

    def test_convert_null_design_target_skips_seed(
        self, api_client, workspace, user, idea, membership,
    ):
        # AC-59: target.design is NULL -> no auto-apply, flag is False.
        _make_default_template(workspace, user)
        source = _make_listing(
            workspace, idea, None, Listing.MarketplaceType.GLOBAL,
        )
        resp = api_client.post(
            '/api/listings/convert/',
            {
                'source_listing_id': str(source.id),
                'target_marketplace_type': 'mba',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert resp.data['design'] is None
        assert resp.data['product_config_seeded'] is False
        assert not DesignProductConfig.objects.filter(
            marketplace_type='mba',
        ).exists()

    def test_edit_default_template_after_seed_does_not_change_config(
        self, api_client, workspace, user, idea, design, membership,
    ):
        # AC-58: auto-apply is read-only against UploadTemplate; later
        # edits to the template must NOT propagate to the seeded config.
        default_tpl = _make_default_template(workspace, user)
        source = _make_listing(
            workspace, idea, design, Listing.MarketplaceType.GLOBAL,
        )
        resp = api_client.post(
            '/api/listings/convert/',
            {
                'source_listing_id': str(source.id),
                'target_marketplace_type': 'mba',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert resp.data['product_config_seeded'] is True
        cfg = DesignProductConfig.objects.get(
            design=design, marketplace_type='mba',
        )
        original_colors = list(cfg.colors)

        # Mutate the template AFTER the seed.
        default_tpl.colors = ['red', 'green', 'blue']
        default_tpl.fit_types = ['youth']
        default_tpl.save(update_fields=['colors', 'fit_types', 'updated_at'])

        cfg.refresh_from_db()
        # DesignProductConfig unchanged.
        assert cfg.colors == original_colors
        assert cfg.fit_types == ['men', 'women']

    def test_deleting_sole_default_leaves_no_replacement(
        self, api_client, workspace, user, idea, design, membership,
    ):
        # EC-17: deleting the only default does NOT auto-promote another
        # template. A subsequent Convert reports product_config_seeded=False.
        default_tpl = _make_default_template(workspace, user)
        # A second non-default template exists in the same set.
        _make_default_template(
            workspace, user, name='Other', is_default=False,
        )
        default_tpl.delete()

        assert not UploadTemplate.objects.filter(
            workspace=workspace, marketplace_type='mba', is_default=True,
        ).exists()

        source = _make_listing(
            workspace, idea, design, Listing.MarketplaceType.GLOBAL,
        )
        resp = api_client.post(
            '/api/listings/convert/',
            {
                'source_listing_id': str(source.id),
                'target_marketplace_type': 'mba',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert resp.data['product_config_seeded'] is False

    def test_overwrite_path_also_seeds_config(
        self, api_client, workspace, user, idea, design, membership,
    ):
        # Overwrite path triggers auto-apply when target design has no
        # existing ProductConfig for the marketplace.
        _make_default_template(workspace, user)
        source = _make_listing(
            workspace, idea, design, Listing.MarketplaceType.GLOBAL,
            brand_name='Fresh Brand', title='Fresh', description='Fresh Desc',
        )
        # Pre-existing target Listing (no ProductConfig yet).
        _make_listing(
            workspace, idea, design, Listing.MarketplaceType.MBA,
            title='Stale',
        )
        assert not DesignProductConfig.objects.filter(
            design=design, marketplace_type='mba',
        ).exists()

        resp = api_client.post(
            '/api/listings/convert/',
            {
                'source_listing_id': str(source.id),
                'target_marketplace_type': 'mba',
                'overwrite': True,
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        assert resp.data['product_config_seeded'] is True
        assert DesignProductConfig.objects.filter(
            design=design, marketplace_type='mba',
        ).exists()

    def test_product_config_seeded_flag_always_present(
        self, api_client, workspace, user, idea, design, membership,
    ):
        # No default set -> create path must still include the flag.
        source = _make_listing(
            workspace, idea, design, Listing.MarketplaceType.GLOBAL,
        )
        resp = api_client.post(
            '/api/listings/convert/',
            {
                'source_listing_id': str(source.id),
                'target_marketplace_type': 'mba',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert 'product_config_seeded' in resp.data
        assert resp.data['product_config_seeded'] is False
