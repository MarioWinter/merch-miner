import pytest

from django.urls import reverse

from scraper_app.models import MarketplaceChoices, MetaKeyword
from research_app.tests.conftest import make_product

pytestmark = pytest.mark.django_db


def _url(asin):
    return reverse('research-similar-products', kwargs={'asin': asin})


class TestSimilarProductsAuth:
    def test_unauthenticated_returns_401(self, api_client):
        resp = api_client.get(_url('B0TEST0001'))
        assert resp.status_code == 401


class TestSimilarProductsValidation:
    def test_invalid_asin_returns_400(self, auth_client):
        resp = auth_client.get(_url('invalid'))
        assert resp.status_code == 400


class TestSimilarProductsNotFound:
    def test_unknown_asin_returns_404(self, auth_client):
        resp = auth_client.get(_url('B0NOTEXIST'))
        assert resp.status_code == 404


class TestSimilarProductsData:
    def test_returns_products_with_shared_keywords(self, auth_client, product):
        kw1 = MetaKeyword.objects.create(
            keyword='cats', type=MetaKeyword.KeywordType.SHORT_TAIL, frequency=5,
        )
        product.meta_keywords.add(kw1)

        similar = make_product(
            asin='B0SIMILAR1',
            marketplace=MarketplaceChoices.AMAZON_COM,
            title='Similar Cat Shirt',
        )
        similar.meta_keywords.add(kw1)

        resp = auth_client.get(_url(product.asin))
        assert resp.status_code == 200
        assert len(resp.data) == 1
        assert resp.data[0]['asin'] == 'B0SIMILAR1'

    def test_excludes_self(self, auth_client, product):
        kw1 = MetaKeyword.objects.create(
            keyword='test', type=MetaKeyword.KeywordType.SHORT_TAIL,
        )
        product.meta_keywords.add(kw1)

        resp = auth_client.get(_url(product.asin))
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data]
        assert product.asin not in asins

    def test_empty_when_no_shared_keywords(self, auth_client, product):
        kw1 = MetaKeyword.objects.create(
            keyword='unique', type=MetaKeyword.KeywordType.SHORT_TAIL,
        )
        product.meta_keywords.add(kw1)

        # Another product with different keyword
        other = make_product(asin='B0OTHER001', marketplace=MarketplaceChoices.AMAZON_COM)
        kw2 = MetaKeyword.objects.create(
            keyword='dogs', type=MetaKeyword.KeywordType.SHORT_TAIL,
        )
        other.meta_keywords.add(kw2)

        resp = auth_client.get(_url(product.asin))
        assert resp.status_code == 200
        assert resp.data == []

    def test_empty_when_product_has_no_keywords(self, auth_client, product):
        resp = auth_client.get(_url(product.asin))
        assert resp.status_code == 200
        assert resp.data == []

    def test_limits_to_20(self, auth_client, product):
        kw1 = MetaKeyword.objects.create(
            keyword='popular', type=MetaKeyword.KeywordType.SHORT_TAIL,
        )
        product.meta_keywords.add(kw1)

        for i in range(25):
            p = make_product(
                asin=f'B0SIMIL{i:04d}',
                marketplace=MarketplaceChoices.AMAZON_COM,
            )
            p.meta_keywords.add(kw1)

        resp = auth_client.get(_url(product.asin))
        assert resp.status_code == 200
        assert len(resp.data) == 20

    def test_only_same_marketplace(self, auth_client, product):
        kw1 = MetaKeyword.objects.create(
            keyword='cats', type=MetaKeyword.KeywordType.SHORT_TAIL,
        )
        product.meta_keywords.add(kw1)

        # Different marketplace
        other = make_product(
            asin='B0DEPRODT1',
            marketplace=MarketplaceChoices.AMAZON_DE,
        )
        other.meta_keywords.add(kw1)

        resp = auth_client.get(_url(product.asin))
        assert resp.status_code == 200
        assert len(resp.data) == 0
