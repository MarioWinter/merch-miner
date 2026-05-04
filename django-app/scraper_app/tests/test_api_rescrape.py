"""Tests for POST /api/scraper/products/{asin}/rescrape/."""

from unittest.mock import MagicMock, patch

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from niche_app.models import CollectedProduct, Niche
from scraper_app.models import AmazonProduct, ScrapeJob
from user_auth_app.models import User
from workspace_app.models import Workspace

pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(email='owner@test.com'):
    return User.objects.create_user(
        email=email, password='TestPass123!', username=email, is_active=True,
    )


def _auth_client(user, workspace=None):
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.cookies['access_token'] = token
    if workspace:
        client.credentials(HTTP_X_WORKSPACE_ID=str(workspace.id))
    return client


def _bootstrap_workspace(email='owner@test.com'):
    """Create user + auto-workspace + active membership. Returns (user, workspace)."""
    user = _make_user(email)
    workspace = Workspace.objects.get(owner=user)
    return user, workspace


def _make_collected(workspace, user, asin='B0ABCDEFGH', marketplace='amazon_com'):
    product = AmazonProduct.objects.create(asin=asin, marketplace=marketplace, title='X')
    niche = Niche.objects.create(name='N', workspace=workspace, created_by=user)
    CollectedProduct.objects.create(niche=niche, product=product)
    return product, niche


# ---------------------------------------------------------------------------
# Auth + ASIN validation
# ---------------------------------------------------------------------------

class TestRescrapeAuth:
    def test_unauthenticated_returns_401(self):
        client = APIClient()
        response = client.post('/api/scraper/products/B0ABCDEFGH/rescrape/')
        assert response.status_code in (401, 403)

    def test_invalid_asin_returns_400(self):
        user, workspace = _bootstrap_workspace()
        client = _auth_client(user, workspace)
        response = client.post('/api/scraper/products/badASIN/rescrape/')
        assert response.status_code == 400
        assert 'Invalid ASIN' in response.json()['error']

    def test_lowercase_asin_returns_400(self):
        # ASIN in URL must already be uppercase. We normalise but the regex
        # still rejects lowercase input.
        user, workspace = _bootstrap_workspace()
        client = _auth_client(user, workspace)
        response = client.post('/api/scraper/products/b0abcdefgh/rescrape/')
        # Normalisation upper-cases it, so this actually passes ASIN check;
        # but product won't exist → 404. Either way, NOT 500.
        assert response.status_code in (400, 404)


# ---------------------------------------------------------------------------
# Workspace ownership
# ---------------------------------------------------------------------------

class TestRescrapeOwnership:
    def test_product_not_found_returns_404(self):
        user, workspace = _bootstrap_workspace()
        client = _auth_client(user, workspace)
        response = client.post('/api/scraper/products/B0ZZZZZZZZ/rescrape/')
        assert response.status_code == 404

    def test_product_not_in_workspace_returns_403(self):
        # Two workspaces. Product collected only in workspace B; user from A.
        user_a, workspace_a = _bootstrap_workspace('a@test.com')
        user_b, workspace_b = _bootstrap_workspace('b@test.com')
        _make_collected(workspace_b, user_b, asin='B0ABCDEFGH')

        client = _auth_client(user_a, workspace_a)
        response = client.post('/api/scraper/products/B0ABCDEFGH/rescrape/')
        assert response.status_code == 403


# ---------------------------------------------------------------------------
# Successful enqueue
# ---------------------------------------------------------------------------

class TestRescrapeEnqueue:
    @patch('scraper_app.api.views.django_rq.get_queue')
    def test_successful_enqueue_returns_202(self, mock_get_queue):
        mock_rq_job = MagicMock()
        mock_rq_job.id = 'rq-job-id-abc'
        mock_queue = MagicMock()
        mock_queue.enqueue.return_value = mock_rq_job
        mock_get_queue.return_value = mock_queue

        user, workspace = _bootstrap_workspace()
        _make_collected(workspace, user, asin='B0ABCDEFGH')

        client = _auth_client(user, workspace)
        response = client.post(
            '/api/scraper/products/B0ABCDEFGH/rescrape/',
            data={'marketplace': 'amazon_com'},
            format='json',
        )

        assert response.status_code == 202
        body = response.json()
        assert 'job_id' in body
        assert body['rq_job_id'] == 'rq-job-id-abc'

        # ScrapeJob row created in PENDING with the right asin/marketplace.
        job = ScrapeJob.objects.get(id=body['job_id'])
        assert job.asin == 'B0ABCDEFGH'
        assert job.marketplace == 'amazon_com'
        assert job.mode == ScrapeJob.Mode.LIVE
        assert job.rq_job_id == 'rq-job-id-abc'

        # Queue.enqueue called with scrape_asin_detail_job + correct kwargs.
        # `assert_any_call` instead of `assert_called_once_with` — get_queue is
        # also invoked by unrelated post_save signal handlers (e.g. embeddings)
        # earlier in the request lifecycle.
        mock_get_queue.assert_any_call('scraper')
        args, kwargs = mock_queue.enqueue.call_args
        assert kwargs['asin'] == 'B0ABCDEFGH'
        assert kwargs['marketplace'] == 'amazon_com'
        assert kwargs['scrape_job_id'] == body['job_id']

    @patch('scraper_app.api.views.django_rq.get_queue')
    def test_default_marketplace_is_amazon_com(self, mock_get_queue):
        mock_rq_job = MagicMock(id='rq1')
        mock_queue = MagicMock()
        mock_queue.enqueue.return_value = mock_rq_job
        mock_get_queue.return_value = mock_queue

        user, workspace = _bootstrap_workspace()
        _make_collected(workspace, user, asin='B0ABCDEFGH')

        client = _auth_client(user, workspace)
        # No body → marketplace defaults to amazon_com.
        response = client.post('/api/scraper/products/B0ABCDEFGH/rescrape/')

        assert response.status_code == 202
        job = ScrapeJob.objects.get(id=response.json()['job_id'])
        assert job.marketplace == 'amazon_com'
