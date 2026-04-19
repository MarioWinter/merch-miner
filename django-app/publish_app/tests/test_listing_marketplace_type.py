"""Tests for Listing.marketplace_type (PROJ-11 F1).

Covers:
- Unique constraint on (design, marketplace_type)
- GET /api/ideas/{id}/listing/ marketplace_type filter
- POST /api/ideas/{id}/listing/generate/ 409 on duplicate
- PATCH /api/listings/{id}/ marketplace_type update
- Serializer exposes marketplace_type
"""

from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
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
        email='mp-type@example.com', password='testpass123',
    )


@pytest.fixture
def workspace(user):
    return Workspace.objects.create(
        name='MP Type WS', slug='mp-type-ws', owner=user,
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
        workspace=workspace, name='MP Niche', created_by=user,
    )


@pytest.fixture
def idea(workspace, niche, user):
    return Idea.objects.create(
        workspace=workspace, niche=niche,
        slogan_text='Marketplace Slogan', created_by=user,
    )


@pytest.fixture
def design_asset(workspace, user):
    return DesignAsset.objects.create(
        workspace=workspace, file_name='mp_design.png',
        source=DesignAsset.Source.UPLOAD, created_by=user,
    )


def ws_headers(workspace):
    return {'HTTP_X_WORKSPACE_ID': str(workspace.id)}


# ---------------------------------------------------------------------------
# Model tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestListingMarketplaceTypeModel:
    def test_default_is_mba(self, workspace, idea):
        listing = Listing.objects.create(workspace=workspace, idea=idea)
        assert listing.marketplace_type == Listing.MarketplaceType.MBA
        assert listing.marketplace_type == 'mba'

    def test_can_set_each_marketplace_type(self, workspace, idea):
        for mp in ('global', 'mba', 'displate'):
            Listing.objects.create(
                workspace=workspace, idea=idea, marketplace_type=mp,
            )
        assert Listing.objects.filter(idea=idea).count() == 3

    def test_unique_constraint_on_design_and_marketplace_type(
        self, workspace, idea, design_asset,
    ):
        Listing.objects.create(
            workspace=workspace, idea=idea, design=design_asset,
            marketplace_type=Listing.MarketplaceType.MBA,
        )
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Listing.objects.create(
                    workspace=workspace, idea=idea, design=design_asset,
                    marketplace_type=Listing.MarketplaceType.MBA,
                )

    def test_same_design_different_marketplace_types_allowed(
        self, workspace, idea, design_asset,
    ):
        Listing.objects.create(
            workspace=workspace, idea=idea, design=design_asset,
            marketplace_type=Listing.MarketplaceType.MBA,
        )
        Listing.objects.create(
            workspace=workspace, idea=idea, design=design_asset,
            marketplace_type=Listing.MarketplaceType.GLOBAL,
        )
        assert Listing.objects.filter(design=design_asset).count() == 2

    def test_multiple_listings_with_null_design_allowed(
        self, workspace, idea,
    ):
        # Postgres NULL != NULL -> unique constraint does not block NULL design
        Listing.objects.create(
            workspace=workspace, idea=idea,
            marketplace_type=Listing.MarketplaceType.MBA,
        )
        Listing.objects.create(
            workspace=workspace, idea=idea,
            marketplace_type=Listing.MarketplaceType.MBA,
        )
        assert Listing.objects.filter(
            idea=idea, design__isnull=True,
        ).count() == 2


# ---------------------------------------------------------------------------
# Serializer tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestListingSerializerMarketplaceType:
    def test_serializer_includes_marketplace_type(
        self, api_client, workspace, idea, design_asset, membership,
    ):
        Listing.objects.create(
            workspace=workspace, idea=idea, design=design_asset,
            marketplace_type=Listing.MarketplaceType.GLOBAL,
            title='Global Tee',
        )
        resp = api_client.get(
            f'/api/ideas/{idea.id}/listing/?marketplace_type=global',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['marketplace_type'] == 'global'
        assert resp.data['title'] == 'Global Tee'


# ---------------------------------------------------------------------------
# GET /api/ideas/{id}/listing/ — marketplace_type filter
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestListingDetailViewMarketplaceFilter:
    def test_default_returns_mba_variant(
        self, api_client, workspace, idea, design_asset, membership,
    ):
        Listing.objects.create(
            workspace=workspace, idea=idea, design=design_asset,
            marketplace_type=Listing.MarketplaceType.MBA,
            title='MBA Title',
        )
        Listing.objects.create(
            workspace=workspace, idea=idea, design=design_asset,
            marketplace_type=Listing.MarketplaceType.GLOBAL,
            title='Global Title',
        )

        resp = api_client.get(
            f'/api/ideas/{idea.id}/listing/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['marketplace_type'] == 'mba'
        assert resp.data['title'] == 'MBA Title'

    def test_explicit_global_variant(
        self, api_client, workspace, idea, design_asset, membership,
    ):
        Listing.objects.create(
            workspace=workspace, idea=idea, design=design_asset,
            marketplace_type=Listing.MarketplaceType.MBA,
            title='MBA Title',
        )
        Listing.objects.create(
            workspace=workspace, idea=idea, design=design_asset,
            marketplace_type=Listing.MarketplaceType.GLOBAL,
            title='Global Title',
        )

        resp = api_client.get(
            f'/api/ideas/{idea.id}/listing/?marketplace_type=global',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['marketplace_type'] == 'global'
        assert resp.data['title'] == 'Global Title'

    def test_missing_variant_returns_404(
        self, api_client, workspace, idea, design_asset, membership,
    ):
        Listing.objects.create(
            workspace=workspace, idea=idea, design=design_asset,
            marketplace_type=Listing.MarketplaceType.MBA,
        )
        resp = api_client.get(
            f'/api/ideas/{idea.id}/listing/?marketplace_type=displate',
            **ws_headers(workspace),
        )
        assert resp.status_code == 404

    def test_invalid_marketplace_type_returns_400(
        self, api_client, workspace, idea, membership,
    ):
        resp = api_client.get(
            f'/api/ideas/{idea.id}/listing/?marketplace_type=bogus',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# POST /api/ideas/{id}/listing/generate/ — duplicate -> 409
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestListingGenerateMarketplaceType:
    @patch('publish_app.api.views.django_rq')
    def test_generate_with_marketplace_type_global(
        self, mock_rq, api_client, workspace, idea, design_asset, membership,
    ):
        mock_rq.get_queue.return_value = MagicMock()
        resp = api_client.post(
            f'/api/ideas/{idea.id}/listing/generate/',
            {
                'design_id': str(design_asset.id),
                'marketplace_type': 'global',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert resp.data['marketplace_type'] == 'global'
        assert Listing.objects.filter(
            design=design_asset,
            marketplace_type='global',
        ).exists()

    @patch('publish_app.api.views.django_rq')
    def test_generate_duplicate_returns_409(
        self, mock_rq, api_client, workspace, idea, design_asset, membership,
    ):
        mock_rq.get_queue.return_value = MagicMock()
        Listing.objects.create(
            workspace=workspace, idea=idea, design=design_asset,
            marketplace_type=Listing.MarketplaceType.MBA,
        )

        resp = api_client.post(
            f'/api/ideas/{idea.id}/listing/generate/',
            {
                'design_id': str(design_asset.id),
                'marketplace_type': 'mba',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 409
        assert resp.data['code'] == 'duplicate_marketplace_type'
        # No new row created
        assert Listing.objects.filter(
            design=design_asset,
            marketplace_type='mba',
        ).count() == 1

    @patch('publish_app.api.views.django_rq')
    def test_generate_default_marketplace_type_is_mba(
        self, mock_rq, api_client, workspace, idea, design_asset, membership,
    ):
        mock_rq.get_queue.return_value = MagicMock()
        resp = api_client.post(
            f'/api/ideas/{idea.id}/listing/generate/',
            {'design_id': str(design_asset.id)},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert resp.data['marketplace_type'] == 'mba'

    @patch('publish_app.api.views.django_rq')
    def test_generate_invalid_marketplace_type_returns_400(
        self, mock_rq, api_client, workspace, idea, design_asset, membership,
    ):
        mock_rq.get_queue.return_value = MagicMock()
        resp = api_client.post(
            f'/api/ideas/{idea.id}/listing/generate/',
            {
                'design_id': str(design_asset.id),
                'marketplace_type': 'not_a_real_marketplace',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# PATCH /api/listings/{id}/ — marketplace_type update + duplicate -> 409
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestListingUpdateMarketplaceType:
    def test_update_marketplace_type(
        self, api_client, workspace, idea, design_asset, membership,
    ):
        # Only one listing exists (mba) -> can change it to displate freely
        listing = Listing.objects.create(
            workspace=workspace, idea=idea, design=design_asset,
            marketplace_type=Listing.MarketplaceType.MBA,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'marketplace_type': 'displate'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['marketplace_type'] == 'displate'

    def test_update_marketplace_type_conflict_returns_409(
        self, api_client, workspace, idea, design_asset, membership,
    ):
        mba_listing = Listing.objects.create(
            workspace=workspace, idea=idea, design=design_asset,
            marketplace_type=Listing.MarketplaceType.MBA,
        )
        Listing.objects.create(
            workspace=workspace, idea=idea, design=design_asset,
            marketplace_type=Listing.MarketplaceType.GLOBAL,
        )

        resp = api_client.patch(
            f'/api/listings/{mba_listing.id}/',
            {'marketplace_type': 'global'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 409
        assert resp.data['code'] == 'duplicate_marketplace_type'
