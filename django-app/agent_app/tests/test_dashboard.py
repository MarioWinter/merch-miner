"""PROJ-18 Phase 13 — Dashboard Integration tests (AC-63 + AC-64).

Covers:
  - AC-63 GET /api/agent/dashboard/summary/ — payload shape, aggregations,
    workspace isolation, 60s caching, auth.
  - AC-64 dashboard ActivityEvent emission on AgentSession status changes
    and on AgentActionLog AWAITING_APPROVAL writes.
"""
from __future__ import annotations

import os
from datetime import timedelta
from decimal import Decimal
from unittest import mock

import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from agent_app.models import (
    ActionStatus,
    AgentActionLog,
    AgentSession,
    AgentType,
    SessionStatus,
)
from dashboard_app.models import ActivityEvent

pytestmark = pytest.mark.django_db


# ── Fixtures ──

@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        email='dash@test.com', password='testpass123',
    )


@pytest.fixture
def workspace(user):
    from workspace_app.models import Membership
    return Membership.objects.get(user=user, status='active').workspace


@pytest.fixture
def other_user(django_user_model):
    return django_user_model.objects.create_user(
        email='dash_other@test.com', password='testpass123',
    )


@pytest.fixture
def other_workspace(other_user):
    from workspace_app.models import Membership
    return Membership.objects.get(user=other_user, status='active').workspace


@pytest.fixture
def api_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _make_session(workspace, user, *, status=SessionStatus.IDLE, title='Test',
                  workflow_template='', niche=None,
                  completed_at=None, completed_steps=0, total_steps=0):
    session = AgentSession.objects.create(
        workspace=workspace,
        created_by=user,
        title=title,
        status=status,
        workflow_template=workflow_template,
        niche_context=niche,
        completed_steps=completed_steps,
        total_steps=total_steps,
    )
    if completed_at:
        AgentSession.objects.filter(pk=session.pk).update(completed_at=completed_at)
        session.refresh_from_db()
    return session


# ══════════════════════════════════════════
#  AC-63 — Dashboard Summary endpoint
# ══════════════════════════════════════════

class TestAgentDashboardSummary:
    URL = '/api/agent/dashboard/summary/'

    def test_auth_required(self):
        client = APIClient()
        resp = client.get(self.URL)
        assert resp.status_code in (401, 403)

    def test_no_workspace_returns_403(self, django_user_model):
        from workspace_app.models import Membership
        u = django_user_model.objects.create_user(
            email='nows@test.com', password='testpass123',
        )
        # Drop the auto-membership.
        Membership.objects.filter(user=u).delete()
        c = APIClient()
        c.force_authenticate(user=u)
        resp = c.get(self.URL)
        assert resp.status_code == 403

    def test_empty_workspace_payload(self, api_client, workspace):
        resp = api_client.get(self.URL)
        assert resp.status_code == 200
        data = resp.data
        assert data['active_count'] == 0
        assert data['last_completed'] is None
        assert data['weekly_actions'] == 0
        assert data['budget_pct'] == 0.0

    def test_active_count_includes_running_and_paused(
        self, api_client, workspace, user,
    ):
        _make_session(workspace, user, status=SessionStatus.RUNNING)
        _make_session(workspace, user, status=SessionStatus.PAUSED)
        _make_session(workspace, user, status=SessionStatus.IDLE)
        _make_session(workspace, user, status=SessionStatus.COMPLETED)

        resp = api_client.get(self.URL)
        assert resp.status_code == 200
        assert resp.data['active_count'] == 2

    def test_last_completed_returns_most_recent(
        self, api_client, workspace, user,
    ):
        now = timezone.now()
        _make_session(
            workspace, user,
            status=SessionStatus.COMPLETED,
            title='Older',
            completed_at=now - timedelta(days=2),
        )
        recent = _make_session(
            workspace, user,
            status=SessionStatus.COMPLETED,
            title='Recent',
            completed_at=now - timedelta(hours=1),
        )

        resp = api_client.get(self.URL)
        assert resp.status_code == 200
        last = resp.data['last_completed']
        assert last is not None
        assert last['session_id'] == str(recent.pk)
        assert last['title'] == 'Recent'

    def test_weekly_actions_counts_only_last_7_days(
        self, api_client, workspace, user,
    ):
        session = _make_session(workspace, user, status=SessionStatus.RUNNING)
        now = timezone.now()

        recent = AgentActionLog.objects.create(
            session=session, workspace=workspace, user=user,
            agent_type=AgentType.RESEARCH, action='deep_research',
            status=ActionStatus.COMPLETED,
        )
        old = AgentActionLog.objects.create(
            session=session, workspace=workspace, user=user,
            agent_type=AgentType.RESEARCH, action='deep_research',
            status=ActionStatus.COMPLETED,
        )
        # Backdate the old log past the 7-day window.
        AgentActionLog.objects.filter(pk=old.pk).update(
            created_at=now - timedelta(days=10),
        )
        # Refresh recent to make sure it's within the window.
        AgentActionLog.objects.filter(pk=recent.pk).update(
            created_at=now - timedelta(days=1),
        )

        resp = api_client.get(self.URL)
        assert resp.status_code == 200
        assert resp.data['weekly_actions'] == 1

    def test_budget_pct_zero_when_threshold_unset(
        self, api_client, workspace, user,
    ):
        session = _make_session(workspace, user, status=SessionStatus.RUNNING)
        AgentActionLog.objects.create(
            session=session, workspace=workspace, user=user,
            agent_type=AgentType.RESEARCH, action='deep_research',
            status=ActionStatus.COMPLETED,
            cost_estimate=Decimal('5.00'),
        )

        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop('AGENT_BUDGET_WARNING_THRESHOLD', None)
            resp = api_client.get(self.URL)

        assert resp.status_code == 200
        assert resp.data['budget_pct'] == 0.0

    def test_budget_pct_calculation(self, api_client, workspace, user):
        session = _make_session(workspace, user, status=SessionStatus.RUNNING)
        # Two cost entries within the 30-day window.
        AgentActionLog.objects.create(
            session=session, workspace=workspace, user=user,
            agent_type=AgentType.DESIGN, action='generate_design',
            status=ActionStatus.COMPLETED,
            cost_estimate=Decimal('2.00'),
        )
        AgentActionLog.objects.create(
            session=session, workspace=workspace, user=user,
            agent_type=AgentType.DESIGN, action='generate_design',
            status=ActionStatus.COMPLETED,
            cost_estimate=Decimal('3.00'),
        )

        with mock.patch.dict(
            os.environ, {'AGENT_BUDGET_WARNING_THRESHOLD': '10.00'}, clear=False,
        ):
            resp = api_client.get(self.URL)

        assert resp.status_code == 200
        # 5.00 / 10.00 * 100 = 50%
        assert resp.data['budget_pct'] == 50.0

    def test_budget_pct_excludes_costs_older_than_30_days(
        self, api_client, workspace, user,
    ):
        session = _make_session(workspace, user, status=SessionStatus.RUNNING)
        old = AgentActionLog.objects.create(
            session=session, workspace=workspace, user=user,
            agent_type=AgentType.DESIGN, action='generate_design',
            status=ActionStatus.COMPLETED,
            cost_estimate=Decimal('100.00'),
        )
        AgentActionLog.objects.filter(pk=old.pk).update(
            created_at=timezone.now() - timedelta(days=45),
        )

        with mock.patch.dict(
            os.environ, {'AGENT_BUDGET_WARNING_THRESHOLD': '10.00'}, clear=False,
        ):
            resp = api_client.get(self.URL)

        assert resp.status_code == 200
        assert resp.data['budget_pct'] == 0.0

    def test_workspace_isolation(
        self, api_client, workspace, user, other_workspace, other_user,
    ):
        # Other workspace activity must not leak into our summary.
        _make_session(other_workspace, other_user, status=SessionStatus.RUNNING)
        _make_session(other_workspace, other_user, status=SessionStatus.COMPLETED,
                      completed_at=timezone.now())

        # Our workspace has nothing.
        resp = api_client.get(self.URL)
        assert resp.status_code == 200
        assert resp.data['active_count'] == 0
        assert resp.data['last_completed'] is None
        assert resp.data['weekly_actions'] == 0

    def test_response_is_cached_for_60s(self, api_client, workspace, user):
        # First call populates cache with empty workspace state.
        resp1 = api_client.get(self.URL)
        assert resp1.status_code == 200
        assert resp1.data['active_count'] == 0

        # Add a session AFTER the first call. Without cache invalidation
        # the second call should still see the cached zero.
        _make_session(workspace, user, status=SessionStatus.RUNNING)

        resp2 = api_client.get(self.URL)
        assert resp2.status_code == 200
        # Cache hit — stale value returned.
        assert resp2.data['active_count'] == 0

        # After explicit cache.clear, the fresh value comes through.
        cache.clear()
        resp3 = api_client.get(self.URL)
        assert resp3.data['active_count'] == 1


# ══════════════════════════════════════════
#  AC-64 — Activity feed emission via signals
# ══════════════════════════════════════════

class TestAgentActivityFeedEmission:
    def test_session_idle_to_running_emits_started_event(
        self, workspace, user,
    ):
        session = _make_session(workspace, user, status=SessionStatus.IDLE,
                                workflow_template='full_pipeline')
        before = ActivityEvent.objects.filter(workspace=workspace).count()

        session.status = SessionStatus.RUNNING
        session.save()

        events = ActivityEvent.objects.filter(
            workspace=workspace,
            event_type=ActivityEvent.EventType.AGENT_SESSION_STARTED,
        )
        assert events.count() == 1
        assert ActivityEvent.objects.filter(workspace=workspace).count() == before + 1
        ev = events.first()
        assert 'full_pipeline' in ev.metadata.get('message', '')
        assert ev.metadata.get('session_id') == str(session.pk)

    def test_session_completed_emits_completed_event(self, workspace, user):
        session = _make_session(workspace, user, status=SessionStatus.RUNNING)
        ActivityEvent.objects.filter(workspace=workspace).delete()

        session.status = SessionStatus.COMPLETED
        session.completed_steps = 5
        session.total_steps = 5
        session.save()

        events = ActivityEvent.objects.filter(
            workspace=workspace,
            event_type=ActivityEvent.EventType.AGENT_SESSION_COMPLETED,
        )
        assert events.count() == 1
        ev = events.first()
        assert ev.metadata['completed_steps'] == 5

    def test_session_failed_emits_failed_event(self, workspace, user):
        session = _make_session(workspace, user, status=SessionStatus.RUNNING)
        ActivityEvent.objects.filter(workspace=workspace).delete()

        session.status = SessionStatus.FAILED
        session.error_message = 'OpenRouter 402 — budget exhausted'
        session.save()

        events = ActivityEvent.objects.filter(
            workspace=workspace,
            event_type=ActivityEvent.EventType.AGENT_SESSION_FAILED,
        )
        assert events.count() == 1
        ev = events.first()
        assert 'OpenRouter' in ev.metadata.get('error', '')

    def test_no_emit_on_no_op_save(self, workspace, user):
        session = _make_session(workspace, user, status=SessionStatus.RUNNING)
        ActivityEvent.objects.filter(workspace=workspace).delete()

        # Save without changing status — no activity event must be emitted.
        session.title = 'Renamed'
        session.save()

        assert ActivityEvent.objects.filter(
            workspace=workspace,
            event_type__startswith='agent_',
        ).count() == 0

    def test_no_re_emit_on_repeated_status_writes(self, workspace, user):
        session = _make_session(workspace, user, status=SessionStatus.IDLE)
        session.status = SessionStatus.RUNNING
        session.save()

        first_count = ActivityEvent.objects.filter(
            workspace=workspace,
            event_type=ActivityEvent.EventType.AGENT_SESSION_STARTED,
        ).count()
        assert first_count == 1

        # Save again with the same status — no new event.
        session.save()
        again_count = ActivityEvent.objects.filter(
            workspace=workspace,
            event_type=ActivityEvent.EventType.AGENT_SESSION_STARTED,
        ).count()
        assert again_count == 1

    def test_action_awaiting_approval_emits_event(self, workspace, user):
        session = _make_session(workspace, user, status=SessionStatus.RUNNING)
        ActivityEvent.objects.filter(workspace=workspace).delete()

        AgentActionLog.objects.create(
            session=session, workspace=workspace, user=user,
            agent_type=AgentType.DESIGN, action='generate_design',
            status=ActionStatus.AWAITING_APPROVAL,
        )

        events = ActivityEvent.objects.filter(
            workspace=workspace,
            event_type=ActivityEvent.EventType.AGENT_AWAITING_APPROVAL,
        )
        assert events.count() == 1
        ev = events.first()
        assert ev.metadata.get('action') == 'generate_design'
        assert 'generate_design' in ev.metadata.get('message', '')

    def test_action_approved_does_not_emit(self, workspace, user):
        session = _make_session(workspace, user, status=SessionStatus.RUNNING)
        ActivityEvent.objects.filter(workspace=workspace).delete()

        AgentActionLog.objects.create(
            session=session, workspace=workspace, user=user,
            agent_type=AgentType.DESIGN, action='generate_design',
            status=ActionStatus.COMPLETED,
        )

        assert ActivityEvent.objects.filter(
            workspace=workspace,
            event_type=ActivityEvent.EventType.AGENT_AWAITING_APPROVAL,
        ).count() == 0

    def test_action_repeated_save_in_pending_not_re_emitted(
        self, workspace, user,
    ):
        session = _make_session(workspace, user, status=SessionStatus.RUNNING)
        log = AgentActionLog.objects.create(
            session=session, workspace=workspace, user=user,
            agent_type=AgentType.DESIGN, action='generate_design',
            status=ActionStatus.AWAITING_APPROVAL,
        )
        first = ActivityEvent.objects.filter(
            workspace=workspace,
            event_type=ActivityEvent.EventType.AGENT_AWAITING_APPROVAL,
        ).count()
        assert first == 1

        # Save again with the same status — no new event.
        log.error_message = 'noise'
        log.save()
        again = ActivityEvent.objects.filter(
            workspace=workspace,
            event_type=ActivityEvent.EventType.AGENT_AWAITING_APPROVAL,
        ).count()
        assert again == 1

    def test_niche_name_resolved_when_session_has_niche(
        self, workspace, user,
    ):
        from niche_app.models import Niche
        niche = Niche.objects.create(
            workspace=workspace, name='Funny Cats', created_by=user,
        )
        session = _make_session(
            workspace, user, status=SessionStatus.IDLE,
            workflow_template='full_pipeline', niche=niche,
        )
        session.status = SessionStatus.RUNNING
        session.save()

        ev = ActivityEvent.objects.filter(
            workspace=workspace,
            event_type=ActivityEvent.EventType.AGENT_SESSION_STARTED,
        ).first()
        assert ev is not None
        assert ev.target_name == 'Funny Cats'
        assert 'Funny Cats' in ev.metadata.get('message', '')
