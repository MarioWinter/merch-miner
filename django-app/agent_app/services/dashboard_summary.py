"""Agent dashboard summary aggregator (AC-63).

Computes per-workspace agent activity summary for the dashboard widget:
  - active_count: sessions in running/paused state
  - last_completed: most recent completed session
  - weekly_actions: AgentActionLog count over last 7 days
  - budget_pct: 30-day spend as % of AGENT_BUDGET_WARNING_THRESHOLD

All queries are workspace-scoped. The dashboard endpoint caches the result
for 60s in Redis (TTL-only — no active invalidation, 60s staleness is
acceptable for a summary card).
"""
from __future__ import annotations

import os
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.utils import timezone

from agent_app.models import AgentActionLog, AgentSession, SessionStatus
from agent_app.services.cost_tracker import get_workspace_cost


WEEKLY_WINDOW_DAYS = 7
BUDGET_WINDOW_DAYS = 30


def _read_threshold():
    """Return AGENT_BUDGET_WARNING_THRESHOLD as Decimal, or None when unset/invalid."""
    raw = os.environ.get('AGENT_BUDGET_WARNING_THRESHOLD', '')
    if not raw:
        return None
    try:
        value = Decimal(raw)
    except (InvalidOperation, ValueError):
        return None
    return value if value > 0 else None


def _serialize_completed(session):
    return {
        'session_id': str(session.id),
        'title': session.title or '',
        'completed_at': (
            session.completed_at.isoformat()
            if session.completed_at
            else session.updated_at.isoformat()
        ),
    }


def get_agent_dashboard_summary(workspace):
    """Build the AC-63 summary payload for a workspace.

    Returns:
        dict with active_count, last_completed (or None), weekly_actions,
        budget_pct (float, two decimals; 0 when threshold unset).
    """
    now = timezone.now()
    week_ago = now - timedelta(days=WEEKLY_WINDOW_DAYS)
    month_ago = now - timedelta(days=BUDGET_WINDOW_DAYS)

    active_count = AgentSession.objects.filter(
        workspace=workspace,
        status__in=[SessionStatus.RUNNING, SessionStatus.PAUSED],
    ).count()

    last_completed_session = (
        AgentSession.objects
        .filter(workspace=workspace, status=SessionStatus.COMPLETED)
        .order_by('-completed_at', '-updated_at')
        .first()
    )
    last_completed = (
        _serialize_completed(last_completed_session)
        if last_completed_session
        else None
    )

    weekly_actions = AgentActionLog.objects.filter(
        workspace=workspace,
        created_at__gte=week_ago,
    ).count()

    threshold = _read_threshold()
    if threshold is None:
        budget_pct = 0.0
    else:
        spend = get_workspace_cost(workspace, since=month_ago)
        pct = (Decimal(spend) / threshold) * Decimal('100')
        # Round to 2 decimals, expose as float for JSON.
        budget_pct = float(round(pct, 2))

    return {
        'active_count': active_count,
        'last_completed': last_completed,
        'weekly_actions': weekly_actions,
        'budget_pct': budget_pct,
    }
