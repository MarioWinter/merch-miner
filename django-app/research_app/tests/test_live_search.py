import pytest
from decimal import Decimal
from unittest.mock import patch, MagicMock

from django.urls import reverse

from research_app.api.serializers import LiveSearchSerializer
from scraper_app.models import (
    ProductSearchCache,
    ScrapeJob,
)

pytestmark = pytest.mark.django_db

URL = reverse('research-live-search')


class TestLiveSearchAuth:
    def test_unauthenticated_returns_401(self, api_client):
        resp = api_client.post(URL, {'keyword': 'cat', 'marketplace': 'amazon_com'})
        assert resp.status_code == 401


class TestLiveSearchNoWorkspace:
    def test_no_membership_returns_403(self, auth_client):
        """User without active workspace membership gets 403."""
        resp = auth_client.post(
            URL,
            {'keyword': 'cat', 'marketplace': 'amazon_com'},
            format='json',
        )
        assert resp.status_code == 403
        assert 'workspace' in resp.data['error'].lower()


class TestLiveSearchDedup:
    def test_returns_existing_pending_cache(self, auth_client, membership, keyword):
        """Dedup: returns existing pending cache instead of creating new job."""
        existing_cache = ProductSearchCache.objects.create(
            keyword=keyword,
            workspace=membership.workspace,
            status=ProductSearchCache.Status.PENDING,
        )

        with patch('research_app.api.views.get_or_create_keyword_cache') as mock_get:
            mock_get.return_value = (existing_cache, False)

            resp = auth_client.post(
                URL,
                {'keyword': 'funny cats', 'marketplace': 'amazon_com'},
                format='json',
            )

        assert resp.status_code == 200
        assert resp.data['cache_id'] == str(existing_cache.id)
        assert resp.data['status'] == 'pending'


class TestLiveSearchNewJob:
    def test_creates_scrape_job_and_cache(self, auth_client, membership):
        """New search creates ScrapeJob + ProductSearchCache + enqueues RQ job."""
        mock_rq_job = MagicMock()
        mock_rq_job.id = 'rq-job-123'
        mock_queue = MagicMock()
        mock_queue.enqueue.return_value = mock_rq_job

        with patch('research_app.api.views.get_or_create_keyword_cache') as mock_get, \
             patch('research_app.api.views.django_rq.get_queue', return_value=mock_queue):
            mock_get.return_value = (None, True)

            resp = auth_client.post(
                URL,
                {'keyword': 'new keyword', 'marketplace': 'amazon_com'},
                format='json',
            )

        assert resp.status_code == 201
        assert 'cache_id' in resp.data
        assert resp.data['status'] == 'pending'

        # Verify DB objects created
        assert ScrapeJob.objects.filter(mode=ScrapeJob.Mode.LIVE).exists()
        cache = ProductSearchCache.objects.get(id=resp.data['cache_id'])
        assert cache.workspace == membership.workspace
        mock_queue.enqueue.assert_called_once()

    def test_workspace_header_selects_workspace(self, auth_client, membership, workspace):
        """X-Workspace-Id header selects specific workspace."""
        mock_rq_job = MagicMock()
        mock_rq_job.id = 'rq-123'
        mock_queue = MagicMock()
        mock_queue.enqueue.return_value = mock_rq_job

        with patch('research_app.api.views.get_or_create_keyword_cache') as mock_get, \
             patch('research_app.api.views.django_rq.get_queue', return_value=mock_queue):
            mock_get.return_value = (None, True)

            resp = auth_client.post(
                URL,
                {'keyword': 'header test', 'marketplace': 'amazon_com'},
                format='json',
                HTTP_X_WORKSPACE_ID=str(workspace.id),
            )

        assert resp.status_code == 201

    def test_invalid_workspace_header_returns_403(self, auth_client, membership):
        """X-Workspace-Id for non-member workspace returns 403."""
        import uuid
        resp = auth_client.post(
            URL,
            {'keyword': 'test', 'marketplace': 'amazon_com'},
            format='json',
            HTTP_X_WORKSPACE_ID=str(uuid.uuid4()),
        )
        assert resp.status_code == 403

    def test_missing_keyword_returns_400(self, auth_client, membership):
        resp = auth_client.post(URL, {'marketplace': 'amazon_com'}, format='json')
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# LiveSearchSerializer validation (Phase 14)
# ---------------------------------------------------------------------------


class TestLiveSearchSerializerValidation:
    def test_price_min_less_than_price_max_valid(self):
        s = LiveSearchSerializer(data={
            'keyword': 'test', 'marketplace': 'amazon_com',
            'price_min': '10.00', 'price_max': '30.00',
        })
        assert s.is_valid(), s.errors

    def test_price_min_greater_than_price_max_rejected(self):
        s = LiveSearchSerializer(data={
            'keyword': 'test', 'marketplace': 'amazon_com',
            'price_min': '30.00', 'price_max': '10.00',
        })
        assert not s.is_valid()
        assert 'price_min' in s.errors

    def test_price_min_equal_price_max_rejected(self):
        s = LiveSearchSerializer(data={
            'keyword': 'test', 'marketplace': 'amazon_com',
            'price_min': '20.00', 'price_max': '20.00',
        })
        assert not s.is_valid()
        assert 'price_min' in s.errors

    def test_sort_by_valid_choices_accepted(self):
        for choice in ['', 'exact-aware-popularity-rank', 'featured-rank',
                        'date-desc-rank', 'price-asc-rank', 'price-desc-rank',
                        'review-rank']:
            s = LiveSearchSerializer(data={
                'keyword': 'test', 'marketplace': 'amazon_com',
                'sort_by': choice,
            })
            assert s.is_valid(), f"Failed for sort_by={choice}: {s.errors}"

    def test_sort_by_invalid_rejected(self):
        s = LiveSearchSerializer(data={
            'keyword': 'test', 'marketplace': 'amazon_com',
            'sort_by': 'invalid-sort',
        })
        assert not s.is_valid()
        assert 'sort_by' in s.errors

    def test_pages_total_400_accepted(self):
        s = LiveSearchSerializer(data={
            'keyword': 'test', 'marketplace': 'amazon_com',
            'pages_total': 400,
        })
        assert s.is_valid(), s.errors
        assert s.validated_data['pages_total'] == 400

    def test_pages_total_401_rejected(self):
        s = LiveSearchSerializer(data={
            'keyword': 'test', 'marketplace': 'amazon_com',
            'pages_total': 401,
        })
        assert not s.is_valid()
        assert 'pages_total' in s.errors

    def test_pages_total_0_rejected(self):
        s = LiveSearchSerializer(data={
            'keyword': 'test', 'marketplace': 'amazon_com',
            'pages_total': 0,
        })
        assert not s.is_valid()
        assert 'pages_total' in s.errors

    def test_browse_node_only_valid(self):
        """browse_node without keyword is valid."""
        s = LiveSearchSerializer(data={
            'marketplace': 'amazon_com',
            'browse_node': '12035955011',
        })
        assert s.is_valid(), s.errors

    def test_no_keyword_no_browse_node_rejected(self):
        s = LiveSearchSerializer(data={'marketplace': 'amazon_com'})
        assert not s.is_valid()


# ---------------------------------------------------------------------------
# LiveSearchView — new fields in ScrapeJob + Cache (Phase 14)
# ---------------------------------------------------------------------------


class TestLiveSearchNewFields:
    def test_creates_job_and_cache_with_sort_and_filters(self, auth_client, membership):
        """New search with sort/price/browse creates ScrapeJob + Cache with those fields."""
        mock_rq_job = MagicMock()
        mock_rq_job.id = 'rq-sort-001'
        mock_queue = MagicMock()
        mock_queue.enqueue.return_value = mock_rq_job

        with patch('research_app.api.views.get_or_create_keyword_cache') as mock_get, \
             patch('research_app.api.views.django_rq.get_queue', return_value=mock_queue):
            mock_get.return_value = (None, True)

            resp = auth_client.post(URL, {
                'keyword': 'sorted search',
                'marketplace': 'amazon_com',
                'sort_by': 'date-desc-rank',
                'price_min': '10.00',
                'price_max': '30.00',
                'browse_node': '12035955011',
                'pages_total': 5,
            }, format='json')

        assert resp.status_code == 201

        job = ScrapeJob.objects.get(mode=ScrapeJob.Mode.LIVE)
        assert job.sort_by == 'date-desc-rank'
        assert job.price_min == Decimal('10.00')
        assert job.price_max == Decimal('30.00')
        assert job.browse_node == '12035955011'
        assert job.pages_total == 5

        cache = ProductSearchCache.objects.get(id=resp.data['cache_id'])
        assert cache.sort_by == 'date-desc-rank'
        assert cache.price_min == Decimal('10.00')
        assert cache.price_max == Decimal('30.00')
        assert cache.browse_node == '12035955011'

    def test_browse_node_override_takes_precedence(self, auth_client, membership):
        """Explicit browse_node overrides PRODUCT_TYPE_SPIDER_KWARGS default."""
        mock_rq_job = MagicMock()
        mock_rq_job.id = 'rq-override-001'
        mock_queue = MagicMock()
        mock_queue.enqueue.return_value = mock_rq_job

        with patch('research_app.api.views.get_or_create_keyword_cache') as mock_get, \
             patch('research_app.api.views.django_rq.get_queue', return_value=mock_queue):
            mock_get.return_value = (None, True)

            resp = auth_client.post(URL, {
                'keyword': 'override test',
                'marketplace': 'amazon_com',
                'product_type': 't_shirt',
                'browse_node': '99999999999',
            }, format='json')

        assert resp.status_code == 201
        # The enqueue call should use the explicit browse_node, not the t_shirt default
        call_kwargs = mock_queue.enqueue.call_args.kwargs
        assert call_kwargs['browse_node'] == '99999999999'
