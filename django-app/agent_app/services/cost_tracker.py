"""Cost estimation and budget tracking for agent tool calls (AC-46/47).

AC-47 — every tool call writes a `cost_estimate` to `AgentActionLog` via
`permission_checker.check_tool_permission()` (Phase 4). This module
supplies the lookup table + aggregate helpers + the soft 80% warning.

AC-46 — soft warning emitted as a SYSTEM `AgentMessage` once the workspace's
total spend crosses 0.8 * `AGENT_BUDGET_WARNING_THRESHOLD`. To avoid
spamming the chat we de-duplicate via a Redis cache key with 24h TTL
keyed on (workspace_id). After 24h the warning may be re-emitted if the
workspace is still over threshold.

Persistence trade-off: the de-dup key is intentionally cache-only (Redis,
24h TTL) — sufficient for MVP. If product wants warning history (per-
session timeline), promote to a `BudgetWarningLog` model post-MVP.
"""

from __future__ import annotations

import logging
import os
from decimal import Decimal, InvalidOperation
from typing import Optional

from django.core.cache import cache
from django.db.models import Sum

from agent_app.models import AgentActionLog, AgentMessage, MessageRole

logger = logging.getLogger(__name__)

# Rough cost estimates per tool call (in USD)
TOOL_COST_ESTIMATES = {
    'trigger_deep_research': Decimal('0.05'),
    'trigger_product_research': Decimal('0.02'),
    'trigger_slogan_adaptation': Decimal('0.03'),
    'generate_design': Decimal('0.10'),
    'generate_listing': Decimal('0.02'),
    'trigger_batch_processing': Decimal('0.20'),
    'analyze_reference_image': Decimal('0.01'),
    'web_search': Decimal('0.001'),
    'deep_crawl': Decimal('0.005'),
}

WARNING_THRESHOLD_PCT = Decimal('80')
WARNING_DEDUP_TTL_SECONDS = 60 * 60 * 24  # 24 hours


def estimate_cost(tool_name):
    """Return estimated cost for a tool call."""
    return TOOL_COST_ESTIMATES.get(tool_name, Decimal('0'))


def get_session_cost(session):
    """Sum all estimated costs for a session."""
    total = AgentActionLog.objects.filter(
        session=session, cost_estimate__isnull=False,
    ).aggregate(total=Sum('cost_estimate'))['total']
    return total or Decimal('0')


def get_workspace_cost(workspace, since=None):
    """Sum all estimated costs for a workspace, optionally since a date."""
    qs = AgentActionLog.objects.filter(
        workspace=workspace, cost_estimate__isnull=False,
    )
    if since:
        qs = qs.filter(created_at__gte=since)
    total = qs.aggregate(total=Sum('cost_estimate'))['total']
    return total or Decimal('0')


def _read_threshold() -> Optional[Decimal]:
    """Read AGENT_BUDGET_WARNING_THRESHOLD from env. None when unset/invalid."""
    threshold_str = os.environ.get('AGENT_BUDGET_WARNING_THRESHOLD', '')
    if not threshold_str:
        return None
    try:
        threshold = Decimal(threshold_str)
    except (InvalidOperation, ValueError):
        return None
    return threshold if threshold > 0 else None


def _warning_dedup_key(workspace_id) -> str:
    return f'agent:budget_warning:ws:{workspace_id}'


def check_budget_warning(session):
    """Check if workspace is approaching budget threshold (AC-46).

    Returns warning message if >= 80% of threshold, else None.
    Pure read — does NOT emit any AgentMessage. Use
    `maybe_emit_budget_warning()` for the side-effecting variant.
    """
    threshold = _read_threshold()
    if threshold is None:
        return None

    total_cost = get_workspace_cost(session.workspace)
    pct = (total_cost / threshold * 100) if threshold > 0 else Decimal('0')

    if pct >= WARNING_THRESHOLD_PCT:
        msg = (
            f"Budget warning: {pct:.0f}% of ${threshold} threshold used "
            f"(${total_cost:.2f})."
        )
        logger.warning("Workspace %s: %s", session.workspace_id, msg)
        return msg

    return None


def maybe_emit_budget_warning(session) -> Optional[str]:
    """Emit a SYSTEM AgentMessage if the workspace just crossed 80% (AC-46).

    De-dups via cache key (24h TTL) so the chat is not spammed on every
    tool call. Returns the emitted message string, or None when no
    warning fires (under threshold OR already emitted within 24h OR no
    threshold configured).
    """
    threshold = _read_threshold()
    if threshold is None:
        return None

    total_cost = get_workspace_cost(session.workspace)
    if threshold <= 0:
        return None

    pct = total_cost / threshold * 100
    if pct < WARNING_THRESHOLD_PCT:
        return None

    dedup_key = _warning_dedup_key(session.workspace_id)
    # `cache.add()` is atomic-set-if-absent in django-redis. Returns False
    # when the key already exists — i.e. another tool call (or another
    # session in the same workspace) just emitted the warning.
    just_set = cache.add(dedup_key, '1', timeout=WARNING_DEDUP_TTL_SECONDS)
    if not just_set:
        return None

    msg = (
        f"Agent budget at {pct:.0f}% of threshold "
        f"(${total_cost:.2f} / ${threshold})."
    )
    AgentMessage.objects.create(
        session=session,
        role=MessageRole.SYSTEM,
        agent_type='orchestrator',
        content=msg,
    )
    logger.warning(
        'Workspace %s: emitted 80%% budget warning (cost=%s, threshold=%s)',
        session.workspace_id, total_cost, threshold,
    )
    return msg


def handle_budget_exhausted(session):
    """Handle OpenRouter 402 — pause workflow (AC-45).

    Thin wrapper around `budget_guard.pause_for_budget` for backward-
    compat with existing imports.
    """
    from agent_app.services.budget_guard import pause_for_budget
    pause_for_budget(session)


__all__ = [
    'TOOL_COST_ESTIMATES',
    'WARNING_THRESHOLD_PCT',
    'WARNING_DEDUP_TTL_SECONDS',
    'check_budget_warning',
    'estimate_cost',
    'get_session_cost',
    'get_workspace_cost',
    'handle_budget_exhausted',
    'maybe_emit_budget_warning',
]
