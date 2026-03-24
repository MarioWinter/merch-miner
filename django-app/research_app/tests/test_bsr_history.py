import pytest
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone

from scraper_app.models import BSRSnapshot

pytestmark = pytest.mark.django_db


def _url(asin):
    return reverse('research-bsr-history', kwargs={'asin': asin})


class TestBSRHistoryAuth:
    def test_unauthenticated_returns_401(self, api_client):
        resp = api_client.get(_url('B0TEST0001'), {'marketplace': 'amazon_com'})
        assert resp.status_code == 401


class TestBSRHistoryValidation:
    def test_missing_marketplace_returns_400(self, auth_client):
        resp = auth_client.get(_url('B0TEST0001'))
        assert resp.status_code == 400

    def test_invalid_marketplace_returns_400(self, auth_client):
        resp = auth_client.get(_url('B0TEST0001'), {'marketplace': 'invalid_mp'})
        assert resp.status_code == 400


class TestBSRHistoryNotFound:
    def test_unknown_asin_returns_404(self, auth_client):
        resp = auth_client.get(_url('B0NOTEXIST'), {'marketplace': 'amazon_com'})
        assert resp.status_code == 404


class TestBSRHistoryData:
    def test_returns_ordered_snapshots(self, auth_client, product):
        """Snapshots returned ordered by recorded_at ascending."""
        now = timezone.now()
        # Create snapshots at different times
        s1 = BSRSnapshot.objects.create(
            product=product, bsr=5000, rating=4.5, price='19.99',
        )
        # Override recorded_at via update to bypass auto_now_add
        BSRSnapshot.objects.filter(id=s1.id).update(recorded_at=now - timedelta(days=2))

        s2 = BSRSnapshot.objects.create(
            product=product, bsr=4500, rating=4.5, price='19.99',
        )
        BSRSnapshot.objects.filter(id=s2.id).update(recorded_at=now - timedelta(days=1))

        BSRSnapshot.objects.create(
            product=product, bsr=4000, rating=4.6, price='19.99',
        )

        resp = auth_client.get(_url(product.asin), {'marketplace': 'amazon_com'})
        assert resp.status_code == 200
        data = resp.data
        assert len(data) == 3
        # Ordered ascending by recorded_at
        bsr_values = [s['bsr'] for s in data]
        assert bsr_values == [5000, 4500, 4000]

    def test_empty_list_if_no_snapshots(self, auth_client, product):
        """Product exists but has no BSR snapshots."""
        resp = auth_client.get(_url(product.asin), {'marketplace': 'amazon_com'})
        assert resp.status_code == 200
        assert resp.data == []

    def test_only_returns_last_30_days(self, auth_client, product):
        """Snapshots older than 30 days are excluded."""
        now = timezone.now()

        old = BSRSnapshot.objects.create(
            product=product, bsr=9000,
        )
        BSRSnapshot.objects.filter(id=old.id).update(
            recorded_at=now - timedelta(days=35),
        )

        BSRSnapshot.objects.create(
            product=product, bsr=5000,
        )

        resp = auth_client.get(_url(product.asin), {'marketplace': 'amazon_com'})
        assert resp.status_code == 200
        data = resp.data
        assert len(data) == 1
        assert data[0]['bsr'] == 5000

    def test_snapshot_fields(self, auth_client, product):
        """Each snapshot has bsr, rating, price, recorded_at."""
        BSRSnapshot.objects.create(
            product=product, bsr=3000, rating=4.2, price='17.99',
        )

        resp = auth_client.get(_url(product.asin), {'marketplace': 'amazon_com'})
        snapshot = resp.data[0]
        assert 'bsr' in snapshot
        assert 'rating' in snapshot
        assert 'price' in snapshot
        assert 'recorded_at' in snapshot
