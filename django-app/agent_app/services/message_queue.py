"""User-message queueing for active sessions (EC-12).

When a session is RUNNING (sub-agent executing a tool), incoming user
commands are persisted as ``AgentMessage(role=user, processed=False)``
without interrupting the in-flight tool. The orchestrator drains
unprocessed messages between sub-agent delegations and folds them into
the next prompt iteration.

Helpers:
    - ``enqueue_user_message(session, content)``
    - ``drain_unprocessed(session) -> list[str]``
    - ``has_pending_user_messages(session) -> bool``

Drain timing: between sub-agent delegations only — minimal overhead +
matches "current tool" semantics from the spec.
"""

from __future__ import annotations

import logging

from django.db import transaction

from agent_app.models import AgentMessage, AgentSession, MessageRole

logger = logging.getLogger(__name__)


def enqueue_user_message(session: AgentSession, content: str) -> AgentMessage:
    """Persist a user message as processed=False for later drain.

    Used by the message endpoint when ``session.status == RUNNING`` —
    the message survives the active tool and is delivered to the
    orchestrator on the next turn.
    """
    return AgentMessage.objects.create(
        session=session,
        role=MessageRole.USER,
        content=content,
        processed=False,
    )


def has_pending_user_messages(session: AgentSession) -> bool:
    """Return True if the session has unprocessed user commands queued."""
    return AgentMessage.objects.filter(
        session=session,
        role=MessageRole.USER,
        processed=False,
    ).exists()


@transaction.atomic
def drain_unprocessed(session: AgentSession) -> list[str]:
    """Drain unprocessed user messages — returns list[content], oldest first.

    Marks each message as processed=True in the same transaction so the
    drain is at-most-once even on retry. Order is preserved by created_at.
    """
    qs = (
        AgentMessage.objects.select_for_update()
        .filter(
            session=session,
            role=MessageRole.USER,
            processed=False,
        )
        .order_by('created_at')
    )
    messages = list(qs)
    if not messages:
        return []

    contents = [msg.content for msg in messages]
    AgentMessage.objects.filter(pk__in=[m.pk for m in messages]).update(processed=True)
    logger.info(
        "Drained %d unprocessed user messages for session %s",
        len(messages), session.pk,
    )
    return contents


__all__ = [
    'enqueue_user_message',
    'has_pending_user_messages',
    'drain_unprocessed',
]
