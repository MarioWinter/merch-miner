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
from publish_app.models import DesignAsset, Listing
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
        bullet_1='B1', bullet_2='B2', bullet_3='B3',
        bullet_4='B4', bullet_5='B5',
        description='Desc', backend_keywords='kw1, kw2',
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
            backend_keywords='ignored',
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
        # promoted to bullet_1 when bullet_1 is empty, bullets 2-5 cleared,
        # backend_keywords cleared.
        assert resp.data['brand_name'] == 'GlobalBrand'
        assert resp.data['title'] == 'Global Title'
        assert resp.data['description'] == 'Global Desc'
        assert resp.data['bullet_1'] == 'Global Desc'
        assert resp.data['bullet_2'] == ''
        assert resp.data['bullet_3'] == ''
        assert resp.data['bullet_4'] == ''
        assert resp.data['bullet_5'] == ''
        assert resp.data['backend_keywords'] == ''

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
            bullet_3='MBA B3',
            bullet_4='MBA B4',
            bullet_5='MBA B5',
            backend_keywords='mba, keywords',
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
        assert resp.data['bullet_5'] == ''
        assert resp.data['backend_keywords'] == ''

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
            backend_keywords='stale, kw',
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
        # Bullets 2-5 + backend_keywords cleared by the mapping.
        assert existing.bullet_2 == ''
        assert existing.backend_keywords == ''
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

    def test_convert_requires_workspace_header(
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
        )
        assert resp.status_code == 400
