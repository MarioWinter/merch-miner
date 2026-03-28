"""Cost estimation and budget tracking for agent tool calls (AC-46/47)."""

import logging
import os
from decimal import Decimal

from django.db.models import Sum

from agent_app.models import AgentActionLog, AgentMessage, MessageRole, SessionStatus

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


def check_budget_warning(session):
    """Check if workspace is approaching budget threshold (AC-46).

    Returns warning message if >= 80% of threshold, else None.
    """
    threshold_str = os.environ.get('AGENT_BUDGET_WARNING_THRESHOLD', '')
    if not threshold_str:
        return None

    try:
        threshold = Decimal(threshold_str)
    except Exception:
        return None

    total_cost = get_workspace_cost(session.workspace)
    pct = (total_cost / threshold * 100) if threshold > 0 else Decimal('0')

    if pct >= 80:
        msg = f"Budget warning: {pct:.0f}% of ${threshold} threshold used (${total_cost:.2f})."
        logger.warning("Workspace %s: %s", session.workspace_id, msg)
        return msg

    return None


def handle_budget_exhausted(session):
    """Handle OpenRouter 402 — pause workflow (AC-45)."""
    session.status = SessionStatus.PAUSED
    session.error_message = 'Agent budget exhausted. Please top up the agent API key.'
    session.save(update_fields=['status', 'error_message', 'updated_at'])

    AgentMessage.objects.create(
        session=session,
        role=MessageRole.SYSTEM,
        content='Agent budget exhausted. Please top up the agent API key.',
    )
    logger.warning("Session %s paused: budget exhausted", session.id)
