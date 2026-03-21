import uuid

import pytest
from django.urls import reverse

from scraper_app.models import (
    AmazonProduct,
    MarketplaceChoices,
    ProductSearchCache,
    ScrapeJob,
)

pytestmark = pytest.mark.django_db


def _url(cache_id):
    return reverse('research-search-status', kwargs={'cache_id': cache_id})


class TestPollStatusAuth:
    def test_unauthenticated_returns_401(self, api_client, search_cache):
        resp = api_client.get(_url(search_cache.id))
        assert resp.status_code == 401


class TestPollStatusNotFound:
    def test_nonexistent_cache_returns_404(self, auth_client, membership):
        resp = auth_client.get(_url(uuid.uuid4()))
        assert resp.status_code == 404


class TestPollStatusOwnership:
    def test_wrong_workspace_returns_403(
        self, auth_client, membership, other_workspace, other_membership, keyword
    ):
        """User cannot poll status of cache belonging to another workspace."""
        other_job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            keyword=keyword,
            marketplace=MarketplaceChoices.AMAZON_COM,
            status=ScrapeJob.Status.PENDING,
        )
        other_cache = ProductSearchCache.objects.create(
            keyword=keyword,
            scrape_job=other_job,
            workspace=other_workspace,
            status=ProductSearchCache.Status.PENDING,
        )
        resp = auth_client.get(_url(other_cache.id))
        assert resp.status_code == 403


class TestPollStatusFields:
    def test_returns_correct_fields(self, auth_client, membership, search_cache, scrape_job):
        resp = auth_client.get(_url(search_cache.id))
        assert resp.status_code == 200
        data = resp.data['data']
        assert 'status' in data
        assert 'pages_done' in data
        assert 'products_scraped' in data
        assert 'error_log' in data
        assert data['pages_done'] == scrape_job.pages_done
        assert data['products_scraped'] == scrape_job.products_scraped

    def test_pending_status_no_products(self, auth_client, membership, search_cache):
        resp = auth_client.get(_url(search_cache.id))
        assert resp.status_code == 200
        assert 'products' not in resp.data['data']


class TestPollStatusCompleted:
    def test_completed_includes_first_50_products(
        self, auth_client, membership, keyword, workspace
    ):
        """Completed status response includes first 50 products."""
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            keyword=keyword,
            marketplace=MarketplaceChoices.AMAZON_COM,
            status=ScrapeJob.Status.COMPLETED,
            products_scraped=60,
        )
        cache = ProductSearchCache.objects.create(
            keyword=keyword,
            scrape_job=job,
            workspace=workspace,
            status=ProductSearchCache.Status.COMPLETED,
        )

        # Create 55 products linked to keyword
        for i in range(55):
            p = AmazonProduct.objects.create(
                asin=f'B0POLL{i:04d}',
                marketplace=MarketplaceChoices.AMAZON_COM,
                title=f'Product {i}',
                bsr=i + 1,
            )
            p.keywords.add(keyword)

        resp = auth_client.get(_url(cache.id))
        assert resp.status_code == 200
        data = resp.data['data']
        assert data['status'] == 'completed'
        assert 'products' in data
        assert len(data['products']) == 50
