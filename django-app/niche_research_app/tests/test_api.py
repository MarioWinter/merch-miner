"""
Task 7.3 -- API endpoint tests for PROJ-6 Niche Deep Research.

Covers:
  - POST trigger: success, 409 duplicate, 404 niche, 403 workspace
  - config_snapshot captured correctly at trigger time
  - GET latest: completed, pending, no research
  - GET list: pagination
  - Workspace scoping: can't see other workspace's research
"""

import uuid
from unittest.mock import patch, MagicMock

import pytest
from django.urls import reverse
from rest_framework import status

from niche_app.models import Niche
from niche_research_app.models import NicheResearch, ResearchNodeConfig


def _mock_rq_queue(mock_rq):
    """Configure mock django_rq so enqueue() returns a job with a string id."""
    mock_queue = MagicMock()
    mock_job = MagicMock()
    mock_job.id = 'test-job-id-123'
    mock_queue.enqueue.return_value = mock_job
    mock_rq.get_queue.return_value = mock_queue
    return mock_queue


# ---------------------------------------------------------------------------
# POST /api/niches/{id}/research/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestResearchTrigger:

    @patch('niche_research_app.api.views.django_rq')
    def test_trigger_success(self, mock_rq, niche, auth_client, research_configs):
        """POST creates NicheResearch and enqueues job."""
        mock_queue = _mock_rq_queue(mock_rq)

        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = auth_client.post(url)

        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['status'] == 'pending'
        assert NicheResearch.objects.filter(niche=niche).count() == 1
        mock_queue.enqueue.assert_called_once()

    @patch('niche_research_app.api.views.django_rq')
    def test_trigger_409_duplicate(self, mock_rq, niche, auth_client, user_with_workspace):
        """409 if pending/running research already exists."""
        user, _ = user_with_workspace
        NicheResearch.objects.create(
            niche=niche, triggered_by=user,
            status=NicheResearch.Status.PENDING,
        )

        mock_rq.get_queue.return_value = MagicMock()
        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = auth_client.post(url)

        assert resp.status_code == status.HTTP_409_CONFLICT
        assert 'already in progress' in resp.data['error'].lower()

    @patch('niche_research_app.api.views.django_rq')
    def test_trigger_409_running(self, mock_rq, niche, auth_client, user_with_workspace):
        """409 for running research too."""
        user, _ = user_with_workspace
        NicheResearch.objects.create(
            niche=niche, triggered_by=user,
            status=NicheResearch.Status.RUNNING,
        )

        mock_rq.get_queue.return_value = MagicMock()
        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = auth_client.post(url)

        assert resp.status_code == status.HTTP_409_CONFLICT

    @patch('niche_research_app.api.views.django_rq')
    def test_trigger_returns_existing_completed(self, mock_rq, niche, auth_client, user_with_workspace):
        """POST with completed research and no force_refresh returns existing (200)."""
        user, _ = user_with_workspace
        NicheResearch.objects.create(
            niche=niche, triggered_by=user,
            status=NicheResearch.Status.COMPLETED,
        )

        _mock_rq_queue(mock_rq)
        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = auth_client.post(url)

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['status'] == 'completed'

    @patch('niche_research_app.api.views.django_rq')
    def test_trigger_force_refresh_after_completed(self, mock_rq, niche, auth_client, user_with_workspace):
        """POST with force_refresh=True on completed re-triggers (201)."""
        user, _ = user_with_workspace
        NicheResearch.objects.create(
            niche=niche, triggered_by=user,
            status=NicheResearch.Status.COMPLETED,
        )

        _mock_rq_queue(mock_rq)
        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = auth_client.post(url, {'force_refresh': True})

        assert resp.status_code == status.HTTP_201_CREATED

    @patch('niche_research_app.api.views.django_rq')
    def test_trigger_allows_after_failed(self, mock_rq, niche, auth_client, user_with_workspace):
        """Can trigger new research after previous failed."""
        user, _ = user_with_workspace
        NicheResearch.objects.create(
            niche=niche, triggered_by=user,
            status=NicheResearch.Status.FAILED,
        )

        _mock_rq_queue(mock_rq)
        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = auth_client.post(url)

        assert resp.status_code == status.HTTP_201_CREATED

    def test_trigger_404_nonexistent_niche(self, auth_client):
        """404 for nonexistent niche."""
        fake_id = uuid.uuid4()
        url = reverse('niche-research', kwargs={'niche_id': fake_id})
        resp = auth_client.post(url)

        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_trigger_403_non_member(self, niche, other_auth_client):
        """403 if user is not a member of the niche's workspace."""
        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = other_auth_client.post(url)

        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_trigger_401_unauthenticated(self, niche):
        """401 for unauthenticated request."""
        from rest_framework.test import APIClient
        client = APIClient()
        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = client.post(url)

        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    @patch('niche_research_app.api.views.django_rq')
    def test_config_snapshot_captured(self, mock_rq, niche, auth_client, research_configs):
        """config_snapshot stores current ResearchNodeConfig at trigger time."""
        # Customize one config
        config = ResearchNodeConfig.objects.get(node_name='vision_analyze')
        config.model_name = 'openai/gpt-4o'
        config.temperature = 0.99
        config.save()

        _mock_rq_queue(mock_rq)
        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        auth_client.post(url)

        research = NicheResearch.objects.get(niche=niche)
        snapshot = research.config_snapshot
        assert 'vision_analyze' in snapshot
        assert snapshot['vision_analyze']['model_name'] == 'openai/gpt-4o'
        assert snapshot['vision_analyze']['temperature'] == 0.99


# ---------------------------------------------------------------------------
# GET /api/niches/{id}/research/latest/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestResearchLatest:

    def test_latest_completed(self, completed_research, niche, auth_client):
        """GET latest returns full nested data for completed research."""
        url = reverse('niche-research-latest', kwargs={'niche_id': niche.id})
        resp = auth_client.get(url)

        assert resp.status_code == status.HTTP_200_OK
        data = resp.data
        assert data['status'] == 'completed'
        assert data['analysis'] is not None
        assert data['keywords'] is not None
        assert len(data['products']) == 3

    def test_latest_pending(self, niche, auth_client, user_with_workspace):
        """GET latest for pending research returns no nested data."""
        user, _ = user_with_workspace
        NicheResearch.objects.create(
            niche=niche, triggered_by=user,
            status=NicheResearch.Status.PENDING,
        )

        url = reverse('niche-research-latest', kwargs={'niche_id': niche.id})
        resp = auth_client.get(url)

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['status'] == 'pending'
        assert resp.data['analysis'] is None

    def test_latest_no_research(self, auth_client, user_with_workspace):
        """404 when no research exists for the niche."""
        user, ws = user_with_workspace
        niche = Niche.objects.create(workspace=ws, name='NoResearch', created_by=user)

        url = reverse('niche-research-latest', kwargs={'niche_id': niche.id})
        resp = auth_client.get(url)

        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_latest_returns_most_recent(self, niche, auth_client, user_with_workspace):
        """Latest endpoint returns the most recently created research."""
        user, _ = user_with_workspace
        NicheResearch.objects.create(
            niche=niche, triggered_by=user, status=NicheResearch.Status.FAILED,
        )
        r2 = NicheResearch.objects.create(
            niche=niche, triggered_by=user, status=NicheResearch.Status.COMPLETED,
        )

        url = reverse('niche-research-latest', kwargs={'niche_id': niche.id})
        resp = auth_client.get(url)

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['id'] == str(r2.id)

    def test_latest_403_non_member(self, niche, other_auth_client, user_with_workspace):
        """403 if user not in workspace."""
        user, _ = user_with_workspace
        NicheResearch.objects.create(niche=niche, triggered_by=user)

        url = reverse('niche-research-latest', kwargs={'niche_id': niche.id})
        resp = other_auth_client.get(url)

        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_latest_404_nonexistent_niche(self, auth_client):
        url = reverse('niche-research-latest', kwargs={'niche_id': uuid.uuid4()})
        resp = auth_client.get(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# GET /api/niches/{id}/research/ (list, paginated)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestResearchList:

    def test_list_paginated(self, niche, auth_client, user_with_workspace):
        """List endpoint returns paginated results."""
        user, _ = user_with_workspace
        for i in range(15):
            NicheResearch.objects.create(niche=niche, triggered_by=user)

        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = auth_client.get(url)

        assert resp.status_code == status.HTTP_200_OK
        assert 'results' in resp.data
        assert 'count' in resp.data
        assert resp.data['count'] == 15
        # Default page_size is 10
        assert len(resp.data['results']) == 10

    def test_list_page_2(self, niche, auth_client, user_with_workspace):
        """Second page returns remaining items."""
        user, _ = user_with_workspace
        for i in range(15):
            NicheResearch.objects.create(niche=niche, triggered_by=user)

        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = auth_client.get(url, {'page': 2})

        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data['results']) == 5

    def test_list_empty(self, auth_client, user_with_workspace):
        """Empty list for niche with no research."""
        user, ws = user_with_workspace
        niche = Niche.objects.create(workspace=ws, name='Empty', created_by=user)

        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = auth_client.get(url)

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['count'] == 0
        assert resp.data['results'] == []

    def test_list_ordered_by_created_at_desc(self, niche, auth_client, user_with_workspace):
        """Results ordered newest first."""
        user, _ = user_with_workspace
        r1 = NicheResearch.objects.create(niche=niche, triggered_by=user)
        r2 = NicheResearch.objects.create(niche=niche, triggered_by=user)

        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = auth_client.get(url)

        ids = [r['id'] for r in resp.data['results']]
        assert ids[0] == str(r2.id)
        assert ids[1] == str(r1.id)

    def test_list_403_non_member(self, niche, other_auth_client):
        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = other_auth_client.get(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_list_404_nonexistent_niche(self, auth_client):
        url = reverse('niche-research', kwargs={'niche_id': uuid.uuid4()})
        resp = auth_client.get(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# Workspace Scoping
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestWorkspaceScoping:

    def test_cannot_trigger_other_workspace_niche(
        self, other_user_workspace, auth_client,
    ):
        """User from workspace A cannot trigger research on workspace B's niche."""
        other_user, other_ws = other_user_workspace
        other_niche = Niche.objects.create(
            workspace=other_ws, name='OtherNiche', created_by=other_user,
        )

        url = reverse('niche-research', kwargs={'niche_id': other_niche.id})
        resp = auth_client.post(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_cannot_view_other_workspace_research(
        self, other_user_workspace, auth_client,
    ):
        """User from workspace A cannot see workspace B's research."""
        other_user, other_ws = other_user_workspace
        other_niche = Niche.objects.create(
            workspace=other_ws, name='OtherNiche', created_by=other_user,
        )
        NicheResearch.objects.create(
            niche=other_niche, triggered_by=other_user,
        )

        url = reverse('niche-research-latest', kwargs={'niche_id': other_niche.id})
        resp = auth_client.get(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_cannot_list_other_workspace_research(
        self, other_user_workspace, auth_client,
    ):
        """User from workspace A cannot list workspace B's research runs."""
        other_user, other_ws = other_user_workspace
        other_niche = Niche.objects.create(
            workspace=other_ws, name='OtherNiche', created_by=other_user,
        )

        url = reverse('niche-research', kwargs={'niche_id': other_niche.id})
        resp = auth_client.get(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# Task 9.3: Retry / Force Refresh / Brand Filtered Count
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestRetryAndForceRefresh:
    """Tests for retry failed runs, force_refresh completed runs, max retries."""

    @patch('niche_research_app.api.views.django_rq')
    def test_trigger_creates_new_research(self, mock_rq, niche, auth_client, research_configs):
        """POST with no existing run creates a new NicheResearch."""
        mock_queue = _mock_rq_queue(mock_rq)

        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = auth_client.post(url, {
            'marketplace': 'amazon_com',
            'product_type': 't_shirt',
        })

        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['status'] == 'pending'
        assert resp.data['marketplace'] == 'amazon_com'
        assert resp.data['product_type'] == 't_shirt'
        mock_queue.enqueue.assert_called_once()

    @patch('niche_research_app.api.views.django_rq')
    def test_409_when_pending_exists(self, mock_rq, niche, auth_client, user_with_workspace):
        """409 when pending research already exists."""
        user, _ = user_with_workspace
        NicheResearch.objects.create(
            niche=niche, triggered_by=user,
            status=NicheResearch.Status.PENDING,
        )
        mock_rq.get_queue.return_value = MagicMock()

        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = auth_client.post(url)

        assert resp.status_code == status.HTTP_409_CONFLICT

    @patch('niche_research_app.api.views.django_rq')
    def test_409_when_running_exists(self, mock_rq, niche, auth_client, user_with_workspace):
        """409 when running research exists."""
        user, _ = user_with_workspace
        NicheResearch.objects.create(
            niche=niche, triggered_by=user,
            status=NicheResearch.Status.RUNNING,
        )
        mock_rq.get_queue.return_value = MagicMock()

        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = auth_client.post(url)

        assert resp.status_code == status.HTTP_409_CONFLICT

    @patch('niche_research_app.api.views.django_rq')
    def test_retry_failed_run_reuses_record(self, mock_rq, niche, auth_client, user_with_workspace):
        """Retrying a failed run reuses the same NicheResearch, increments retry_count."""
        user, _ = user_with_workspace
        research = NicheResearch.objects.create(
            niche=niche, triggered_by=user,
            status=NicheResearch.Status.FAILED,
            error_message='LLM timeout',
            completed_nodes=['scrape', 'vision_analyze'],
            retry_count=0,
        )
        original_id = research.id

        mock_queue = _mock_rq_queue(mock_rq)

        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = auth_client.post(url)

        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['id'] == str(original_id)  # same record reused
        assert resp.data['status'] == 'pending'
        assert resp.data['retry_count'] == 1

        # Verify DB state
        research.refresh_from_db()
        assert research.retry_count == 1
        assert research.status == NicheResearch.Status.PENDING
        assert research.error_message == ''
        assert research.completed_nodes == ['scrape', 'vision_analyze']  # kept

        niche.refresh_from_db()
        assert niche.research_retry_count == 1

        mock_queue.enqueue.assert_called_once()

    @patch('niche_research_app.api.views.django_rq')
    def test_max_retries_exceeded(self, mock_rq, niche, auth_client, user_with_workspace):
        """400 when niche.research_retry_count >= 3."""
        user, _ = user_with_workspace
        niche.research_retry_count = 3
        niche.save(update_fields=['research_retry_count'])

        NicheResearch.objects.create(
            niche=niche, triggered_by=user,
            status=NicheResearch.Status.FAILED,
        )

        mock_rq.get_queue.return_value = MagicMock()
        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = auth_client.post(url)

        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert 'max retries' in resp.data['error'].lower()

    @patch('niche_research_app.api.views.django_rq')
    def test_completed_no_force_refresh_returns_existing(
        self, mock_rq, niche, auth_client, user_with_workspace,
    ):
        """Completed + force_refresh=False returns existing research (200, no new job)."""
        user, _ = user_with_workspace
        research = NicheResearch.objects.create(
            niche=niche, triggered_by=user,
            status=NicheResearch.Status.COMPLETED,
            brand_filtered_count=5,
        )

        mock_queue = MagicMock()
        mock_rq.get_queue.return_value = mock_queue

        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = auth_client.post(url, {'force_refresh': False})

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['id'] == str(research.id)
        assert resp.data['status'] == 'completed'
        mock_queue.enqueue.assert_not_called()

    @patch('niche_research_app.api.views.django_rq')
    def test_force_refresh_completed_run(
        self, mock_rq, niche, auth_client, user_with_workspace, amazon_products,
    ):
        """force_refresh=True on completed: reuses record, deletes LLM results, keeps products."""
        user, _ = user_with_workspace
        from niche_research_app.models import (
            NicheAnalysis,
            NicheKeywordAnalysis,
            NicheProductEmotionalAnalysis,
            NicheProductVisionAnalysis,
            NicheResearchProduct,
        )

        research = NicheResearch.objects.create(
            niche=niche, triggered_by=user,
            status=NicheResearch.Status.COMPLETED,
            completed_nodes=['scrape', 'vision_analyze', 'emotional_analyze',
                             'niche_profile', 'keywords', 'finalize'],
        )
        original_id = research.id

        # Create child records
        for p in amazon_products:
            NicheResearchProduct.objects.create(research=research, product=p)
            NicheProductVisionAnalysis.objects.create(
                research=research, product=p,
                slogan_text=f'Test {p.asin}', is_niche_match=True,
            )
            NicheProductEmotionalAnalysis.objects.create(
                research=research, product=p,
                original_slogan=f'Test {p.asin}',
            )
        NicheAnalysis.objects.create(research=research, niche=niche)
        NicheKeywordAnalysis.objects.create(research=research, niche=niche)

        mock_queue = _mock_rq_queue(mock_rq)

        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = auth_client.post(url, {'force_refresh': True})

        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['id'] == str(original_id)
        assert resp.data['status'] == 'pending'
        assert resp.data['completed_nodes'] == ['scrape']

        # LLM results deleted
        assert NicheProductVisionAnalysis.objects.filter(research=research).count() == 0
        assert NicheProductEmotionalAnalysis.objects.filter(research=research).count() == 0
        assert NicheAnalysis.objects.filter(research=research).count() == 0
        assert NicheKeywordAnalysis.objects.filter(research=research).count() == 0

        # Products kept
        assert NicheResearchProduct.objects.filter(research=research).count() == 3

        mock_queue.enqueue.assert_called_once()

    @patch('niche_research_app.api.views.django_rq')
    def test_marketplace_product_type_passed(
        self, mock_rq, niche, auth_client, research_configs,
    ):
        """Marketplace + product_type stored on research record."""
        _mock_rq_queue(mock_rq)

        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = auth_client.post(url, {
            'marketplace': 'amazon_de',
            'product_type': 'hoodie',
        })

        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['marketplace'] == 'amazon_de'
        assert resp.data['product_type'] == 'hoodie'

        research = NicheResearch.objects.get(niche=niche)
        assert research.marketplace == 'amazon_de'
        assert research.product_type == 'hoodie'

    @patch('niche_research_app.api.views.django_rq')
    def test_brand_filtered_count_in_response(
        self, mock_rq, niche, auth_client, user_with_workspace,
    ):
        """brand_filtered_count is included in serializer response."""
        user, _ = user_with_workspace
        NicheResearch.objects.create(
            niche=niche, triggered_by=user,
            status=NicheResearch.Status.COMPLETED,
            brand_filtered_count=7,
        )

        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = auth_client.post(url, {'force_refresh': False})

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['brand_filtered_count'] == 7

    @patch('niche_research_app.api.views.django_rq')
    def test_brand_filtered_count_in_latest(
        self, mock_rq, completed_research, niche, auth_client,
    ):
        """brand_filtered_count appears in latest detail response."""
        completed_research.brand_filtered_count = 3
        completed_research.save(update_fields=['brand_filtered_count'])

        url = reverse('niche-research-latest', kwargs={'niche_id': niche.id})
        resp = auth_client.get(url)

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['brand_filtered_count'] == 3

    @patch('niche_research_app.api.views.django_rq')
    def test_brand_filtered_count_in_list(
        self, mock_rq, niche, auth_client, user_with_workspace,
    ):
        """brand_filtered_count appears in list response items."""
        user, _ = user_with_workspace
        NicheResearch.objects.create(
            niche=niche, triggered_by=user,
            status=NicheResearch.Status.COMPLETED,
            brand_filtered_count=2,
        )

        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = auth_client.get(url)

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['results'][0]['brand_filtered_count'] == 2
