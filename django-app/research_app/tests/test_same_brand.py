import pytest

from django.urls import reverse

from scraper_app.models import MarketplaceChoices
from research_app.tests.conftest import make_product

pytestmark = pytest.mark.django_db


def _url(asin):
    return reverse('research-same-brand', kwargs={'asin': asin})


class TestSameBrandAuth:
    def test_unauthenticated_returns_401(self, api_client):
        resp = api_client.get(_url('B0TEST0001'))
        assert resp.status_code == 401


class TestSameBrandValidation:
    def test_invalid_asin_returns_400(self, auth_client):
        resp = auth_client.get(_url('invalid'))
        assert resp.status_code == 400


class TestSameBrandNotFound:
    def test_unknown_asin_returns_404(self, auth_client):
        resp = auth_client.get(_url('B0NOTEXIST'))
        assert resp.status_code == 404


class TestSameBrandData:
    def test_returns_same_brand_products(self, auth_client, product):
        make_product(
            asin='B0BRAND001',
            brand=product.brand,
            marketplace=MarketplaceChoices.AMAZON_COM,
        )

        resp = auth_client.get(_url(product.asin))
        assert resp.status_code == 200
        assert len(resp.data) == 1
        assert resp.data[0]['asin'] == 'B0BRAND001'

    def test_excludes_self(self, auth_client, product):
        resp = auth_client.get(_url(product.asin))
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data]
        assert product.asin not in asins

    def test_empty_when_no_brand(self, auth_client):
        p = make_product(asin='B0NOBRAND1', brand='')
        resp = auth_client.get(_url(p.asin))
        assert resp.status_code == 200
        assert resp.data == []

    def test_only_same_marketplace(self, auth_client, product):
        make_product(
            asin='B0DEBRAND1',
            brand=product.brand,
            marketplace=MarketplaceChoices.AMAZON_DE,
        )

        resp = auth_client.get(_url(product.asin))
        assert resp.status_code == 200
        assert len(resp.data) == 0

    def test_limits_to_20(self, auth_client, product):
        for i in range(25):
            make_product(
                asin=f'B0BRAND{i:04d}',
                brand=product.brand,
                marketplace=MarketplaceChoices.AMAZON_COM,
            )

        resp = auth_client.get(_url(product.asin))
        assert resp.status_code == 200
        assert len(resp.data) == 20

    def test_ordered_by_bsr(self, auth_client, product):
        make_product(
            asin='B0BRAND001', brand=product.brand,
            marketplace=MarketplaceChoices.AMAZON_COM, bsr=100,
        )
        make_product(
            asin='B0BRAND002', brand=product.brand,
            marketplace=MarketplaceChoices.AMAZON_COM, bsr=50,
        )

        resp = auth_client.get(_url(product.asin))
        assert resp.status_code == 200
        bsr_values = [p['bsr'] for p in resp.data]
        assert bsr_values == sorted(bsr_values)
