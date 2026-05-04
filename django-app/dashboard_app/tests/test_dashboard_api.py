"""
PROJ-12 -- Dashboard & Analytics: backend tests.

Covers:
  - Main dashboard endpoint (GET /api/dashboard/) — member access, cached
  - Niche counts by status group
  - Design and listing counts
  - Stuck niches detection (>7 days unchanged)
  - Activity feed from signals
  - Analytics endpoints (admin only, date-filterable)
  - CSV exports (headers-only on empty)
  - Agent/Search placeholder when not configured
  - Workspace isolation
  - Admin-only access on analytics endpoints (member gets 403)
"""

import pytest
from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from user_auth_app.models import User
from workspace_app.models import Membership, Workspace
from niche_app.models import Niche
from design_app.models import Design, DesignGenerationRun
from idea_app.models import Idea
from publish_app.models import Listing
from dashboard_app.models import ActivityEvent


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(email, password="TestPass123!", active=True, **kwargs):
    return User.objects.create_user(
        email=email,
        password=password,
        username=email,
        is_active=active,
        **kwargs,
    )


def auth_client(user):
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.cookies["access_token"] = token
    return client


def make_workspace_with_admin(email):
    user = make_user(email)
    workspace = Workspace.objects.get(owner=user)
    membership = Membership.objects.get(
        user=user,
        workspace=workspace,
        status=Membership.Status.ACTIVE,
    )
    return user, workspace, membership


def add_member(workspace, email, role=Membership.Role.MEMBER):
    user = make_user(email)
    # Delete the auto-created personal workspace + admin membership so
    # the only active membership is the one we explicitly create below.
    Membership.objects.filter(user=user).delete()
    Workspace.objects.filter(owner=user).delete()
    membership = Membership.objects.create(
        workspace=workspace,
        user=user,
        role=role,
        status=Membership.Status.ACTIVE,
    )
    return user, membership


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def disable_dashboard_cache_bust():
    """Prevent signal-driven cache invalidation during tests.

    Note: patching handler names (on_niche_save etc.) does NOT disconnect
    @receiver signals — Django's dispatcher holds a direct reference.
    Patching _bust_dashboard_cache is sufficient to keep tests deterministic.
    """
    with patch('dashboard_app.signals._bust_dashboard_cache'):
        yield


# ---------------------------------------------------------------------------
# Main Dashboard
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestDashboardView:
    """GET /api/dashboard/"""

    def test_member_can_access_dashboard(self):
        user, workspace, _ = make_workspace_with_admin("admin@test.com")
        client = auth_client(user)
        resp = client.get(reverse('dashboard'))
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert 'niche_counts' in data
        assert 'design_counts' in data
        assert 'listing_counts' in data
        assert 'recent_activity' in data
        assert 'stuck_niches' in data
        assert 'agent_activity' in data
        assert 'search_activity' in data

    def test_unauthenticated_returns_401(self):
        client = APIClient()
        resp = client.get(reverse('dashboard'))
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_no_membership_returns_403(self):
        user = make_user("nomember@test.com")
        # Delete auto-created membership
        Membership.objects.filter(user=user).delete()
        client = auth_client(user)
        resp = client.get(reverse('dashboard'))
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_empty_workspace_returns_zeroes(self):
        user, workspace, _ = make_workspace_with_admin("empty@test.com")
        client = auth_client(user)
        resp = client.get(reverse('dashboard'))
        data = resp.json()
        for group in ['research', 'design', 'publish', 'live', 'done', 'archived']:
            assert data['niche_counts'][group] == 0
        assert data['design_counts']['total'] == 0
        assert data['listing_counts']['total'] == 0
        assert data['recent_activity'] == []
        assert data['stuck_niches'] == []

    def test_niche_counts_by_status_group(self):
        user, workspace, _ = make_workspace_with_admin("counts@test.com")
        Niche.objects.create(workspace=workspace, name="N1", status='data_entry', created_by=user)
        Niche.objects.create(workspace=workspace, name="N2", status='deep_research', created_by=user)
        Niche.objects.create(workspace=workspace, name="N3", status='niche_with_potential', created_by=user)
        Niche.objects.create(workspace=workspace, name="N4", status='archived', created_by=user)

        client = auth_client(user)
        resp = client.get(reverse('dashboard'))
        data = resp.json()
        assert data['niche_counts']['research'] == 2
        assert data['niche_counts']['design'] == 1
        assert data['niche_counts']['archived'] == 1

    def test_design_counts(self):
        user, workspace, _ = make_workspace_with_admin("design@test.com")
        idea = Idea.objects.create(
            workspace=workspace, slogan_text="Test", created_by=user,
        )
        Design.objects.create(
            workspace=workspace, idea=idea, status='pending',
        )
        Design.objects.create(
            workspace=workspace, idea=idea, status='approved',
        )

        client = auth_client(user)
        resp = client.get(reverse('dashboard'))
        data = resp.json()
        assert data['design_counts']['total'] == 2
        assert data['design_counts']['approved'] == 1

    def test_listing_counts(self):
        user, workspace, _ = make_workspace_with_admin("listing@test.com")
        idea = Idea.objects.create(
            workspace=workspace, slogan_text="Test", created_by=user,
        )
        Listing.objects.create(workspace=workspace, idea=idea, status='draft')
        Listing.objects.create(workspace=workspace, idea=idea, status='ready')
        Listing.objects.create(workspace=workspace, idea=idea, status='published')

        client = auth_client(user)
        resp = client.get(reverse('dashboard'))
        data = resp.json()
        assert data['listing_counts']['total'] == 3
        assert data['listing_counts']['ready'] == 2  # ready + published

    def test_stuck_niches_detected(self):
        user, workspace, _ = make_workspace_with_admin("stuck@test.com")
        niche = Niche.objects.create(
            workspace=workspace, name="Stuck Niche", status='data_entry', created_by=user,
        )
        # Manually backdate updated_at
        Niche.objects.filter(pk=niche.pk).update(
            updated_at=timezone.now() - timedelta(days=10)
        )

        client = auth_client(user)
        resp = client.get(reverse('dashboard'))
        data = resp.json()
        assert len(data['stuck_niches']) == 1
        assert data['stuck_niches'][0]['name'] == 'Stuck Niche'
        assert data['stuck_niches'][0]['days_stuck'] >= 9

    def test_archived_niches_not_stuck(self):
        user, workspace, _ = make_workspace_with_admin("notstuck@test.com")
        niche = Niche.objects.create(
            workspace=workspace, name="Archived", status='archived', created_by=user,
        )
        Niche.objects.filter(pk=niche.pk).update(
            updated_at=timezone.now() - timedelta(days=30)
        )

        client = auth_client(user)
        resp = client.get(reverse('dashboard'))
        assert len(resp.json()['stuck_niches']) == 0

    def test_agent_activity_placeholder(self):
        user, workspace, _ = make_workspace_with_admin("agent@test.com")
        client = auth_client(user)
        resp = client.get(reverse('dashboard'))
        agent = resp.json()['agent_activity']
        assert agent['configured'] is False
        assert 'not set up' in agent['message'].lower()

    def test_search_activity_placeholder(self):
        user, workspace, _ = make_workspace_with_admin("search@test.com")
        client = auth_client(user)
        resp = client.get(reverse('dashboard'))
        search = resp.json()['search_activity']
        assert search['configured'] is False
        assert 'not connected' in search['message'].lower()

    def test_dashboard_is_cached(self):
        user, workspace, _ = make_workspace_with_admin("cached@test.com")
        client = auth_client(user)

        # First call — populates cache
        resp1 = client.get(reverse('dashboard'))
        assert resp1.status_code == 200

        # Verify cache was set
        cache_key = f'dashboard:{workspace.pk}'
        cached = cache.get(cache_key)
        assert cached is not None, "Cache should be populated after first request"

        # Create a niche (signal disabled → won't bust cache)
        Niche.objects.create(workspace=workspace, name="New", status='data_entry', created_by=user)

        # Verify cache still present
        cached2 = cache.get(cache_key)
        assert cached2 is not None, "Cache should survive niche creation"
        assert cached2['niche_counts']['research'] == 0

        # Second call should return cached data (0 niches)
        resp2 = client.get(reverse('dashboard'))
        assert resp2.json()['niche_counts']['research'] == 0

    def test_workspace_isolation(self):
        user1, ws1, _ = make_workspace_with_admin("ws1@test.com")
        user2, ws2, _ = make_workspace_with_admin("ws2@test.com")

        Niche.objects.create(workspace=ws1, name="WS1 Niche", status='data_entry', created_by=user1)
        Niche.objects.create(workspace=ws2, name="WS2 Niche", status='data_entry', created_by=user2)

        client1 = auth_client(user1)
        resp = client1.get(reverse('dashboard'))
        assert resp.json()['niche_counts']['research'] == 1


# ---------------------------------------------------------------------------
# Analytics Endpoints (Admin Only)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestDesignAnalytics:
    """GET /api/dashboard/analytics/designs/"""

    def test_admin_can_access(self):
        user, workspace, _ = make_workspace_with_admin("admin_da@test.com")
        client = auth_client(user)
        resp = client.get(reverse('dashboard_design_analytics'))
        assert resp.status_code == 200
        assert 'data' in resp.json()

    def test_member_gets_403(self):
        user, workspace, _ = make_workspace_with_admin("admin_da2@test.com")
        member, _ = add_member(workspace, "member_da@test.com")
        client = auth_client(member)
        resp = client.get(reverse('dashboard_design_analytics'))
        assert resp.status_code == 403

    def test_design_analytics_with_data(self):
        user, workspace, _ = make_workspace_with_admin("da_data@test.com")
        idea = Idea.objects.create(workspace=workspace, slogan_text="T", created_by=user)
        DesignGenerationRun.objects.create(
            idea=idea, model_name='gemini_flash',
            status='completed', triggered_by=user,
        )
        DesignGenerationRun.objects.create(
            idea=idea, model_name='gpt_image',
            status='completed', triggered_by=user,
        )
        DesignGenerationRun.objects.create(
            idea=idea, model_name='gemini_flash',
            status='failed', triggered_by=user,
        )

        client = auth_client(user)
        resp = client.get(reverse('dashboard_design_analytics'))
        data = resp.json()['data']
        # Only completed runs counted
        total = sum(r['count'] for r in data)
        assert total == 2

    def test_date_range_filter(self):
        user, workspace, _ = make_workspace_with_admin("da_date@test.com")
        idea = Idea.objects.create(workspace=workspace, slogan_text="T", created_by=user)
        run = DesignGenerationRun.objects.create(
            idea=idea, model_name='gemini_flash',
            status='completed', triggered_by=user,
        )
        # Backdate
        DesignGenerationRun.objects.filter(pk=run.pk).update(
            created_at=timezone.now() - timedelta(days=60)
        )

        client = auth_client(user)
        today = timezone.now().date().isoformat()
        last_week = (timezone.now() - timedelta(days=7)).date().isoformat()
        resp = client.get(
            reverse('dashboard_design_analytics'),
            {'date_from': last_week, 'date_to': today},
        )
        assert resp.json()['data'] == []

    def test_max_52_weeks_warning(self):
        user, workspace, _ = make_workspace_with_admin("da_warn@test.com")
        client = auth_client(user)
        resp = client.get(
            reverse('dashboard_design_analytics'),
            {'date_from': '2024-01-01', 'date_to': '2026-03-27'},
        )
        assert resp.json()['warning'] is not None
        assert '52' in resp.json()['warning']


@pytest.mark.django_db
class TestListingAnalytics:
    """GET /api/dashboard/analytics/listings/"""

    def test_admin_can_access(self):
        user, workspace, _ = make_workspace_with_admin("admin_la@test.com")
        client = auth_client(user)
        resp = client.get(reverse('dashboard_listing_analytics'))
        assert resp.status_code == 200

    def test_member_gets_403(self):
        user, workspace, _ = make_workspace_with_admin("admin_la2@test.com")
        member, _ = add_member(workspace, "member_la@test.com")
        client = auth_client(member)
        resp = client.get(reverse('dashboard_listing_analytics'))
        assert resp.status_code == 403


@pytest.mark.django_db
class TestAgentAnalytics:
    """GET /api/dashboard/analytics/agent/ — placeholder response."""

    def test_returns_placeholder(self):
        user, workspace, _ = make_workspace_with_admin("admin_aa@test.com")
        client = auth_client(user)
        resp = client.get(reverse('dashboard_agent_analytics'))
        assert resp.status_code == 200
        assert resp.json()['configured'] is False


@pytest.mark.django_db
class TestSearchAnalytics:
    """GET /api/dashboard/analytics/search/ — placeholder response."""

    def test_returns_placeholder(self):
        user, workspace, _ = make_workspace_with_admin("admin_sa@test.com")
        client = auth_client(user)
        resp = client.get(reverse('dashboard_search_analytics'))
        assert resp.status_code == 200
        assert resp.json()['configured'] is False


# ---------------------------------------------------------------------------
# CSV Exports
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestCSVExports:

    def test_design_export_empty(self):
        user, workspace, _ = make_workspace_with_admin("export_d@test.com")
        client = auth_client(user)
        resp = client.get(reverse('dashboard_design_export'))
        assert resp.status_code == 200
        assert resp['Content-Type'] == 'text/csv'
        content = b''.join(resp.streaming_content).decode()
        assert 'week,model,count' in content

    def test_listing_export_empty(self):
        user, workspace, _ = make_workspace_with_admin("export_l@test.com")
        client = auth_client(user)
        resp = client.get(reverse('dashboard_listing_export'))
        assert resp.status_code == 200
        content = b''.join(resp.streaming_content).decode()
        assert 'week,listings_ready,listings_published' in content

    def test_agent_export_placeholder(self):
        user, workspace, _ = make_workspace_with_admin("export_a@test.com")
        client = auth_client(user)
        resp = client.get(reverse('dashboard_agent_export'))
        assert resp.status_code == 200
        content = b''.join(resp.streaming_content).decode()
        assert 'week,agent_type' in content

    def test_search_export_placeholder(self):
        user, workspace, _ = make_workspace_with_admin("export_s@test.com")
        client = auth_client(user)
        resp = client.get(reverse('dashboard_search_export'))
        assert resp.status_code == 200
        content = b''.join(resp.streaming_content).decode()
        assert 'week,searches' in content

    def test_member_cannot_export(self):
        user, workspace, _ = make_workspace_with_admin("export_admin@test.com")
        member, _ = add_member(workspace, "export_member@test.com")
        client = auth_client(member)
        resp = client.get(reverse('dashboard_design_export'))
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Activity Events (Signal Integration)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestActivityEventSignals:
    """Test that signals create ActivityEvent records correctly."""

    def test_niche_created_event(self):
        """Manually test the signal handler logic."""
        from dashboard_app.signals import _safe_create_event
        user, workspace, _ = make_workspace_with_admin("signal@test.com")

        _safe_create_event(
            workspace=workspace,
            event_type=ActivityEvent.EventType.NICHE_CREATED,
            target_name='Test Niche',
            user=user,
        )
        assert ActivityEvent.objects.filter(
            workspace=workspace,
            event_type='niche_created',
        ).count() == 1

    def test_activity_feed_returns_events(self):
        from dashboard_app.services.activity_feed import get_recent_activity
        from dashboard_app.signals import _safe_create_event
        user, workspace, _ = make_workspace_with_admin("feed@test.com")

        for i in range(25):
            _safe_create_event(
                workspace=workspace,
                event_type=ActivityEvent.EventType.NICHE_CREATED,
                target_name=f'Niche {i}',
                user=user,
            )

        feed = get_recent_activity(workspace.pk, limit=20)
        assert len(feed) == 20
        assert feed[0]['event'] == 'niche_created'
        assert feed[0]['user'] != ''
