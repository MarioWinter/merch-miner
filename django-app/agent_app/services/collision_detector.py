"""Collision detection for concurrent agent/user work on same niche (AC-34/35)."""

import logging
from datetime import timedelta

from django.utils import timezone

from agent_app.models import AgentMessage, AgentSession, MessageRole, SessionStatus

logger = logging.getLogger(__name__)

# Active statuses that indicate an ongoing workflow
ACTIVE_STATUSES = [SessionStatus.RUNNING, SessionStatus.PAUSED]

# Recent manual activity threshold
MANUAL_ACTIVITY_THRESHOLD = timedelta(minutes=5)


def check_niche_collision(workspace, niche, exclude_session_id=None):
    """Check if another agent session or user is working on the same niche.

    Returns:
        list[dict]: collision warnings (empty = no collision).
        Each dict: {type, session_id, user_name, message}
    """
    if not niche:
        return []

    collisions = []

    # Check for active agent sessions on this niche
    active_sessions = AgentSession.objects.filter(
        workspace=workspace,
        niche_context=niche,
        status__in=ACTIVE_STATUSES,
    ).select_related('created_by')

    if exclude_session_id:
        active_sessions = active_sessions.exclude(id=exclude_session_id)

    for session in active_sessions:
        user_display = getattr(session.created_by, 'email', str(session.created_by))
        collisions.append({
            'type': 'agent_session',
            'session_id': str(session.id),
            'user_name': user_display,
            'message': f"User {user_display} has an active agent session on this niche.",
        })

    # Check for recent manual niche updates
    threshold = timezone.now() - MANUAL_ACTIVITY_THRESHOLD
    if hasattr(niche, 'updated_at') and niche.updated_at and niche.updated_at > threshold:
        # Check if the update was by a different user
        if hasattr(niche, 'last_updated_by') and niche.last_updated_by:
            collisions.append({
                'type': 'manual_edit',
                'session_id': None,
                'user_name': str(niche.last_updated_by),
                'message': f"Niche was manually updated {int((timezone.now() - niche.updated_at).total_seconds() // 60)} min ago.",
            })

    return collisions


def warn_and_pause(session, collisions: list[dict]) -> None:
    """Emit a collision warning message and pause the session (AC-35).

    The agent halts until the user explicitly resumes (or sends a confirmation
    message that clears the warning).
    """
    if not collisions:
        return

    summary = '\n'.join(f"- {c['message']}" for c in collisions)
    content = (
        "Collision detected on this niche:\n"
        f"{summary}\n\n"
        "Workflow paused. Please resume to continue, or stop the session."
    )

    AgentMessage.objects.create(
        session=session,
        role=MessageRole.SYSTEM,
        agent_type='orchestrator',
        content=content,
    )

    if session.status not in (SessionStatus.PAUSED, SessionStatus.CANCELLED):
        session.status = SessionStatus.PAUSED
        session.error_message = content[:2000]
        session.save(update_fields=['status', 'error_message', 'updated_at'])

    logger.info("Session %s paused due to collision: %s", session.id, summary)
