import uuid

import pytest

from django.urls import reverse

from idea_app.models import Idea
from publish_app.models import Listing
from scraper_app.models import AmazonProduct, MarketplaceChoices

pytestmark = pytest.mark.django_db


def _url(asin):
    return reverse('research-use-as-template', kwargs={'asin': asin})


@pytest.fixture
def niche(workspace):
    from niche_app.models import Niche
    return Niche.objects.create(
        workspace=workspace,
        name='Test Niche',
    )


class TestUseAsTemplateAuth:
    def test_unauthenticated_returns_401(self, api_client):
        resp = api_client.post(_url('B0TEST0001'), {'niche_id': str(uuid.uuid4())})
        assert resp.status_code == 401


class TestUseAsTemplateValidation:
    def test_invalid_asin_returns_400(self, auth_client, membership):
        resp = auth_client.post(
            _url('invalid'),
            {'niche_id': str(uuid.uuid4())},
            format='json',
        )
        assert resp.status_code == 400

    def test_missing_niche_id_returns_400(self, auth_client, membership, product):
        resp = auth_client.post(_url(product.asin), {}, format='json')
        assert resp.status_code == 400

    def test_invalid_niche_id_returns_400(self, auth_client, membership, product):
        resp = auth_client.post(
            _url(product.asin),
            {'niche_id': 'not-a-uuid'},
            format='json',
        )
        assert resp.status_code == 400


class TestUseAsTemplatePermissions:
    def test_no_workspace_returns_403(self, auth_client, product):
        # user has no membership
        resp = auth_client.post(
            _url(product.asin),
            {'niche_id': str(uuid.uuid4())},
            format='json',
        )
        assert resp.status_code == 403

    def test_niche_in_other_workspace_returns_404(
        self, auth_client, membership, product, other_workspace
    ):
        from niche_app.models import Niche
        other_niche = Niche.objects.create(
            workspace=other_workspace,
            name='Other Niche',
        )
        resp = auth_client.post(
            _url(product.asin),
            {'niche_id': str(other_niche.id)},
            format='json',
        )
        assert resp.status_code == 404


class TestUseAsTemplateNotFound:
    def test_unknown_asin_returns_404(self, auth_client, membership, niche):
        resp = auth_client.post(
            _url('B0NOTEXIST'),
            {'niche_id': str(niche.id)},
            format='json',
        )
        assert resp.status_code == 404

    def test_nonexistent_niche_returns_404(self, auth_client, membership, product):
        resp = auth_client.post(
            _url(product.asin),
            {'niche_id': str(uuid.uuid4())},
            format='json',
        )
        assert resp.status_code == 404


class TestUseAsTemplateSuccess:
    def test_creates_listing_and_idea(self, auth_client, membership, product, niche):
        resp = auth_client.post(
            _url(product.asin),
            {'niche_id': str(niche.id)},
            format='json',
        )
        assert resp.status_code == 201
        assert 'listing_id' in resp.data
        assert 'idea_id' in resp.data

        # Verify Listing created
        listing = Listing.objects.get(id=resp.data['listing_id'])
        assert listing.status == Listing.Status.DRAFT
        assert listing.generated_by == Listing.GeneratedBy.MANUAL
        assert listing.title == product.title[:60]
        assert listing.bullet_1 == product.bullet_1[:256]

        # Verify Idea created
        idea = Idea.objects.get(id=resp.data['idea_id'])
        assert idea.is_manual is True
        assert idea.niche == niche
        assert idea.workspace == membership.workspace

    def test_truncates_long_fields(self, auth_client, membership, niche):
        long_product = AmazonProduct.objects.create(
            asin='B0LONGFLD1',
            marketplace=MarketplaceChoices.AMAZON_COM,
            title='X' * 200,
            brand='Y' * 200,
            bullet_1='Z' * 500,
            description='W' * 5000,
        )

        resp = auth_client.post(
            _url(long_product.asin),
            {'niche_id': str(niche.id)},
            format='json',
        )
        assert resp.status_code == 201

        listing = Listing.objects.get(id=resp.data['listing_id'])
        assert len(listing.title) <= 60
        assert len(listing.brand_name) <= 50
        assert len(listing.bullet_1) <= 256
        assert len(listing.description) <= 2000
