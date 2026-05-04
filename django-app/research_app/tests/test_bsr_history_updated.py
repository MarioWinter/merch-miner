"""Tests for BSRHistoryView updates: 90-day window + BSR summary."""
import pytest
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone

from scraper_app.models import BSRSnapshot

pytestmark = pytest.mark.django_db


def _url(asin):
    return reverse('research-bsr-history', kwargs={'asin': asin})


class TestBSRHistory90Days:
    def test_returns_snapshots_within_90_days(self, auth_client, product):
        now = timezone.now()

        # 60 days ago — should be included (was excluded under old 30-day window)
        s1 = BSRSnapshot.objects.create(product=product, bsr=8000, price='20.00')
        BSRSnapshot.objects.filter(id=s1.id).update(recorded_at=now - timedelta(days=60))

        # Recent
        BSRSnapshot.objects.create(product=product, bsr=5000, price='19.99')

        resp = auth_client.get(_url(product.asin), {'marketplace': 'amazon_com'})
        assert resp.status_code == 200
        assert len(resp.data['snapshots']) == 2

    def test_excludes_snapshots_older_than_90_days(self, auth_client, product):
        now = timezone.now()

        old = BSRSnapshot.objects.create(product=product, bsr=9000)
        BSRSnapshot.objects.filter(id=old.id).update(recorded_at=now - timedelta(days=95))

        BSRSnapshot.objects.create(product=product, bsr=5000)

        resp = auth_client.get(_url(product.asin), {'marketplace': 'amazon_com'})
        assert resp.status_code == 200
        assert len(resp.data['snapshots']) == 1


class TestBSRSummary:
    def test_summary_present_in_response(self, auth_client, product):
        BSRSnapshot.objects.create(product=product, bsr=5000)

        resp = auth_client.get(_url(product.asin), {'marketplace': 'amazon_com'})
        assert resp.status_code == 200
        summary = resp.data['summary']
        assert 'overall_trend' in summary
        assert 'current_trend' in summary
        assert 'average' in summary
        assert 'median' in summary

    def test_summary_with_no_snapshots(self, auth_client, product):
        resp = auth_client.get(_url(product.asin), {'marketplace': 'amazon_com'})
        assert resp.status_code == 200
        summary = resp.data['summary']
        assert summary['overall_trend'] == 'stable'
        assert summary['average'] is None
        assert summary['median'] is None

    def test_summary_improving_trend(self, auth_client, product):
        now = timezone.now()
        # BSR going down over time = improving
        for i, bsr in enumerate([10000, 9000, 8000, 5000, 3000, 1000]):
            s = BSRSnapshot.objects.create(product=product, bsr=bsr)
            BSRSnapshot.objects.filter(id=s.id).update(
                recorded_at=now - timedelta(days=60 - i * 10),
            )

        resp = auth_client.get(_url(product.asin), {'marketplace': 'amazon_com'})
        summary = resp.data['summary']
        assert summary['overall_trend'] == 'improving'

    def test_summary_declining_trend(self, auth_client, product):
        now = timezone.now()
        # BSR going up over time = declining
        for i, bsr in enumerate([1000, 3000, 5000, 8000, 10000, 15000]):
            s = BSRSnapshot.objects.create(product=product, bsr=bsr)
            BSRSnapshot.objects.filter(id=s.id).update(
                recorded_at=now - timedelta(days=60 - i * 10),
            )

        resp = auth_client.get(_url(product.asin), {'marketplace': 'amazon_com'})
        summary = resp.data['summary']
        assert summary['overall_trend'] == 'declining'

    def test_summary_average_and_median(self, auth_client, product):
        for bsr in [1000, 2000, 3000]:
            BSRSnapshot.objects.create(product=product, bsr=bsr)

        resp = auth_client.get(_url(product.asin), {'marketplace': 'amazon_com'})
        summary = resp.data['summary']
        assert summary['average'] == 2000.0
        assert summary['median'] == 2000.0

    def test_response_structure_changed(self, auth_client, product):
        """Verify response is now {snapshots: [...], summary: {...}} not flat list."""
        BSRSnapshot.objects.create(product=product, bsr=5000, rating=4.5, price='19.99')

        resp = auth_client.get(_url(product.asin), {'marketplace': 'amazon_com'})
        assert resp.status_code == 200
        assert 'snapshots' in resp.data
        assert 'summary' in resp.data
        assert isinstance(resp.data['snapshots'], list)
        assert isinstance(resp.data['summary'], dict)
