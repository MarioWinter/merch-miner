"""django-rq task entry points for agent workflow execution (AC-36)."""

import logging

from django.utils import timezone

from agent_app.models import AgentMessage, AgentSession, MessageRole, SessionStatus

logger = logging.getLogger(__name__)


def run_agent_workflow(session_id):
    """Main entry point for agent workflow execution.

    Enqueued on the 'agent' RQ queue with 60-min timeout.
    Loads session, runs Orchestrator graph, handles errors.
    """
    try:
        session = AgentSession.objects.select_related(
            'workspace', 'created_by', 'niche_context',
        ).get(id=session_id)
    except AgentSession.DoesNotExist:
        logger.error("AgentSession %s not found", session_id)
        return

    if session.status == SessionStatus.CANCELLED:
        logger.info("Session %s already cancelled, skipping", session_id)
        return

    # Mark as running
    session.status = SessionStatus.RUNNING
    session.save(update_fields=['status', 'updated_at'])

    try:
        # Import here to avoid circular imports; agents module may be heavy
        from agent_app.agents.orchestrator import run_orchestrator
        run_orchestrator(session)

        # Mark completed
        session.status = SessionStatus.COMPLETED
        session.completed_at = timezone.now()
        session.save(update_fields=['status', 'completed_at', 'updated_at'])

    except Exception as exc:
        logger.exception("Session %s failed: %s", session_id, exc)
        session.status = SessionStatus.FAILED
        session.error_message = str(exc)[:2000]
        session.save(update_fields=['status', 'error_message', 'updated_at'])

        AgentMessage.objects.create(
            session=session,
            role=MessageRole.SYSTEM,
            content=f"Workflow failed: {exc}",
        )


def run_batch_sequential(session_ids):
    """Run multiple sessions sequentially (AC-32 default)."""
    for sid in session_ids:
        run_agent_workflow(sid)


def resume_agent_workflow(session_id):
    """Resume a paused or crashed session from checkpoint (AC-37/38)."""
    try:
        session = AgentSession.objects.select_related(
            'workspace', 'created_by', 'niche_context',
        ).get(id=session_id)
    except AgentSession.DoesNotExist:
        logger.error("AgentSession %s not found for resume", session_id)
        return

    AgentMessage.objects.create(
        session=session,
        role=MessageRole.SYSTEM,
        content=f"Workflow resumed at step: {session.current_step or 'start'}",
    )

    session.status = SessionStatus.RUNNING
    session.save(update_fields=['status', 'updated_at'])

    try:
        from agent_app.agents.orchestrator import run_orchestrator
        run_orchestrator(session, resume=True)

        session.status = SessionStatus.COMPLETED
        session.completed_at = timezone.now()
        session.save(update_fields=['status', 'completed_at', 'updated_at'])

    except Exception as exc:
        logger.exception("Session %s resume failed: %s", session_id, exc)
        session.status = SessionStatus.FAILED
        session.error_message = str(exc)[:2000]
        session.save(update_fields=['status', 'error_message', 'updated_at'])
