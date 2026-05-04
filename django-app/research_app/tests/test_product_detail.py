import pytest

from django.urls import reverse

from scraper_app.models import MetaKeyword

pytestmark = pytest.mark.django_db


def _url(asin):
    return reverse('research-product-detail', kwargs={'asin': asin})


class TestProductDetailAuth:
    def test_unauthenticated_returns_401(self, api_client):
        resp = api_client.get(_url('B0TEST0001'))
        assert resp.status_code == 401


class TestProductDetailValidation:
    def test_invalid_asin_returns_400(self, auth_client):
        resp = auth_client.get(_url('invalid'))
        assert resp.status_code == 400

    def test_short_asin_returns_400(self, auth_client):
        resp = auth_client.get(_url('B0TEST'))
        assert resp.status_code == 400

    def test_lowercase_asin_returns_400(self, auth_client):
        resp = auth_client.get(_url('b0test0001'))
        assert resp.status_code == 400


class TestProductDetailNotFound:
    def test_unknown_asin_returns_404(self, auth_client):
        resp = auth_client.get(_url('B0NOTEXIST'))
        assert resp.status_code == 404


class TestProductDetailData:
    def test_returns_product_with_all_fields(self, auth_client, product):
        resp = auth_client.get(_url(product.asin))
        assert resp.status_code == 200
        data = resp.data
        assert data['asin'] == product.asin
        assert data['title'] == product.title
        assert data['brand'] == product.brand
        assert 'meta_keywords' in data
        assert 'bsr_categories' in data
        assert 'seller_name' in data
        assert 'variants' in data
        assert 'image_gallery' in data

    def test_includes_meta_keywords(self, auth_client, product):
        kw1 = MetaKeyword.objects.create(
            keyword='funny', type=MetaKeyword.KeywordType.SHORT_TAIL, frequency=10,
        )
        kw2 = MetaKeyword.objects.create(
            keyword='funny cat shirt', type=MetaKeyword.KeywordType.LONG_TAIL, frequency=3,
        )
        product.meta_keywords.add(kw1, kw2)

        resp = auth_client.get(_url(product.asin))
        assert resp.status_code == 200
        keywords = resp.data['meta_keywords']
        assert len(keywords) == 2
        kw_texts = {k['keyword'] for k in keywords}
        assert 'funny' in kw_texts
        assert 'funny cat shirt' in kw_texts

    def test_empty_meta_keywords(self, auth_client, product):
        resp = auth_client.get(_url(product.asin))
        assert resp.status_code == 200
        assert resp.data['meta_keywords'] == []

    def test_marketplace_filter(self, auth_client, product):
        resp = auth_client.get(_url(product.asin), {'marketplace': 'amazon_com'})
        assert resp.status_code == 200
        assert resp.data['asin'] == product.asin

    def test_wrong_marketplace_returns_404(self, auth_client, product):
        resp = auth_client.get(_url(product.asin), {'marketplace': 'amazon_de'})
        assert resp.status_code == 404

    def test_invalid_marketplace_returns_400(self, auth_client, product):
        resp = auth_client.get(_url(product.asin), {'marketplace': 'invalid_mp'})
        assert resp.status_code == 400
