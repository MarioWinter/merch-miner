"""Batch sequential chaining (AC-32).

Sequential mode: only enqueue the *first* sibling at batch creation time.
When `run_agent_workflow` finishes a sibling (status COMPLETED / FAILED /
CANCELLED), it calls `enqueue_next_in_batch(session)` which finds the next
IDLE sibling by `batch_position` and enqueues it onto the `agent` queue.

Atomicity: status flip happens *before* the enqueue call, so even if the
worker dies between flip + enqueue the next session is left in IDLE — a
manual re-run or admin sweep can resume it. We document this as known
trade-off; full transactional outbox is post-MVP.
"""

from __future__ import annotations

import logging
from typing import Optional

import django_rq

from agent_app.models import AgentSession, SessionStatus

logger = logging.getLogger(__name__)


def find_next_in_batch(session: AgentSession) -> Optional[AgentSession]:
    """Return the next IDLE sibling in `session.batch_id`, ordered by position.

    Returns None when:
        - session has no batch_id (single-session run)
        - all siblings are already running/completed/failed/cancelled
    """
    if not session.batch_id:
        return None

    return (
        AgentSession.objects
        .filter(
            batch_id=session.batch_id,
            status=SessionStatus.IDLE,
        )
        .exclude(pk=session.pk)
        .order_by('batch_position', 'created_at')
        .first()
    )


def enqueue_next_in_batch(session: AgentSession) -> Optional[str]:
    """Find + enqueue the next IDLE sibling on the `agent` queue (AC-32).

    Returns the enqueued sibling's id (str) or None if no next sibling.
    """
    next_session = find_next_in_batch(session)
    if next_session is None:
        return None

    # Lazy import to avoid circular tasks <-> batch_runner.
    from agent_app.tasks import run_agent_workflow

    queue = django_rq.get_queue('agent')
    queue.enqueue(run_agent_workflow, str(next_session.id))
    logger.info(
        'Sequential batch %s: enqueued next session %s (position=%d)',
        session.batch_id, next_session.id, next_session.batch_position,
    )
    return str(next_session.id)


__all__ = ['find_next_in_batch', 'enqueue_next_in_batch']
