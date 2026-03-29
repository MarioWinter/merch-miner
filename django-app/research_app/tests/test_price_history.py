import pytest
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone

from scraper_app.models import BSRSnapshot

pytestmark = pytest.mark.django_db


def _url(asin):
    return reverse('research-price-history', kwargs={'asin': asin})


class TestPriceHistoryAuth:
    def test_unauthenticated_returns_401(self, api_client):
        resp = api_client.get(_url('B0TEST0001'), {'marketplace': 'amazon_com'})
        assert resp.status_code == 401


class TestPriceHistoryValidation:
    def test_invalid_asin_returns_400(self, auth_client):
        resp = auth_client.get(_url('invalid'), {'marketplace': 'amazon_com'})
        assert resp.status_code == 400

    def test_missing_marketplace_returns_400(self, auth_client):
        resp = auth_client.get(_url('B0TEST0001'))
        assert resp.status_code == 400

    def test_invalid_marketplace_returns_400(self, auth_client):
        resp = auth_client.get(_url('B0TEST0001'), {'marketplace': 'invalid_mp'})
        assert resp.status_code == 400


class TestPriceHistoryNotFound:
    def test_unknown_asin_returns_404(self, auth_client):
        resp = auth_client.get(_url('B0NOTEXIST'), {'marketplace': 'amazon_com'})
        assert resp.status_code == 404


class TestPriceHistoryData:
    def test_returns_price_snapshots(self, auth_client, product):
        BSRSnapshot.objects.create(
            product=product, bsr=5000, price='19.99',
        )
        BSRSnapshot.objects.create(
            product=product, bsr=4500, price='17.99',
        )

        resp = auth_client.get(_url(product.asin), {'marketplace': 'amazon_com'})
        assert resp.status_code == 200
        assert len(resp.data) == 2
        for item in resp.data:
            assert 'price' in item
            assert 'recorded_at' in item
            assert 'bsr' not in item  # PriceHistorySerializer only has price + recorded_at

    def test_excludes_null_price(self, auth_client, product):
        BSRSnapshot.objects.create(
            product=product, bsr=5000, price='19.99',
        )
        BSRSnapshot.objects.create(
            product=product, bsr=4500, price=None,
        )

        resp = auth_client.get(_url(product.asin), {'marketplace': 'amazon_com'})
        assert resp.status_code == 200
        assert len(resp.data) == 1

    def test_only_last_90_days(self, auth_client, product):
        now = timezone.now()

        old = BSRSnapshot.objects.create(product=product, bsr=9000, price='25.00')
        BSRSnapshot.objects.filter(id=old.id).update(
            recorded_at=now - timedelta(days=100),
        )

        BSRSnapshot.objects.create(product=product, bsr=5000, price='19.99')

        resp = auth_client.get(_url(product.asin), {'marketplace': 'amazon_com'})
        assert resp.status_code == 200
        assert len(resp.data) == 1

    def test_ordered_by_recorded_at(self, auth_client, product):
        now = timezone.now()

        s1 = BSRSnapshot.objects.create(product=product, bsr=5000, price='20.00')
        BSRSnapshot.objects.filter(id=s1.id).update(recorded_at=now - timedelta(days=5))

        s2 = BSRSnapshot.objects.create(product=product, bsr=4000, price='18.00')
        BSRSnapshot.objects.filter(id=s2.id).update(recorded_at=now - timedelta(days=2))

        BSRSnapshot.objects.create(product=product, bsr=3000, price='17.00')

        resp = auth_client.get(_url(product.asin), {'marketplace': 'amazon_com'})
        assert resp.status_code == 200
        prices = [s['price'] for s in resp.data]
        assert prices == ['20.00', '18.00', '17.00']

    def test_empty_list(self, auth_client, product):
        resp = auth_client.get(_url(product.asin), {'marketplace': 'amazon_com'})
        assert resp.status_code == 200
        assert resp.data == []
