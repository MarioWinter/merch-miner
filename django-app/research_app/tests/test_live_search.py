import pytest
from unittest.mock import patch, MagicMock

from django.urls import reverse

from scraper_app.models import (
    Keyword,
    MarketplaceChoices,
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
        assert resp.data['data']['cache_id'] == str(existing_cache.id)
        assert resp.data['data']['status'] == 'pending'


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
        assert 'cache_id' in resp.data['data']
        assert resp.data['data']['status'] == 'pending'

        # Verify DB objects created
        assert ScrapeJob.objects.filter(mode=ScrapeJob.Mode.LIVE).exists()
        cache = ProductSearchCache.objects.get(id=resp.data['data']['cache_id'])
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
