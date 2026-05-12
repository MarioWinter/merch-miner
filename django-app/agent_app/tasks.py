"""django-rq task entry points for agent workflow execution.

Phase 5/6 cover the orchestrator workflow run; PROJ-29 Phase 1D-3 adds the
``summarize_conversation(session_id)`` rolling-summary job consumed by the
chat-agent path (AC-Context-2, EC-21, EC-28).

Phase 5 — implements:
    - AC-36: ``run_agent_workflow(session_id)`` — main RQ entry point.
             Loads session, lazy-seeds default ToolPermissions for the
             user (AC-19), starts the orchestrator graph.
    - AC-37: AsyncPostgresSaver checkpointer auto-resumes from
             ``thread_id=session_id`` on worker crash.
    - AC-38: Resume emits an ``AgentMessage(role=system,
             content="Workflow resumed at step X")`` before re-invoking.
    - AC-26: When a ``workflow_template`` is set on the session, its
             steps are passed into the orchestrator's initial prompt as
             a structured plan; otherwise the orchestrator plans
             autonomously via ReAct.
    - AC-39: Polling-first MVP — the frontend polls
             ``GET /api/agent/sessions/<id>/`` for live updates. SSE
             streaming is deferred to PROJ-20 chat infrastructure.
    - EC-12: Catches ApprovalRequired-style payloads from sub-agents,
             pauses the session cleanly, and exits the job.

Phase 6 — adds:
    - AC-32: Sequential batch chaining via ``enqueue_next_in_batch`` at
             the tail of every workflow run (only when the session has
             a ``batch_id``).
    - AC-45: Catches OpenRouter 402-style exceptions raised by the
             orchestrator and pauses the workflow with the canonical
             "Agent budget exhausted" message instead of marking it
             FAILED.
"""

from __future__ import annotations

import logging
import os

import django_rq
from django.utils import timezone

from agent_app.constants import DEFAULT_TOOL_PERMISSIONS
from agent_app.models import (
    AgentMessage,
    AgentSession,
    MessageRole,
    SessionStatus,
    ToolPermission,
)
from agent_app.services.conversation_summarizer import summarize

logger = logging.getLogger(__name__)


# ── Helpers ────────────────────────────────────────────────────────────────


def _ensure_default_permissions(session: AgentSession) -> None:
    """AC-19: lazy-seed DEFAULT_TOOL_PERMISSIONS for the session owner."""
    existing = set(
        ToolPermission.objects.filter(
            workspace=session.workspace,
            user=session.created_by,
        ).values_list('tool_name', flat=True)
    )
    to_create = [
        ToolPermission(
            workspace=session.workspace,
            user=session.created_by,
            tool_name=tool,
            permission_level=level,
        )
        for tool, level in DEFAULT_TOOL_PERMISSIONS.items()
        if tool not in existing
    ]
    if to_create:
        ToolPermission.objects.bulk_create(to_create, ignore_conflicts=True)
        logger.info(
            "Seeded %d default ToolPermissions for user %s",
            len(to_create), session.created_by_id,
        )


def _emit_resume_message(session: AgentSession) -> None:
    """AC-38: post a 'resumed at step X' system message."""
    AgentMessage.objects.create(
        session=session,
        role=MessageRole.SYSTEM,
        agent_type='orchestrator',
        content=f"Workflow resumed at step: {session.current_step or 'start'}",
    )


def _emit_summary(session: AgentSession) -> None:
    """Post a clean-completion summary message."""
    AgentMessage.objects.create(
        session=session,
        role=MessageRole.SYSTEM,
        agent_type='orchestrator',
        content=(
            f"Workflow completed. {session.completed_steps}/{session.total_steps} "
            f"steps finished."
            if session.total_steps
            else "Workflow completed."
        ),
    )


def _is_paused_post_run(session_id: str) -> bool:
    """Re-fetch session — orchestrator may have paused it (EC-6, approval)."""
    try:
        s = AgentSession.objects.only('status').get(id=session_id)
    except AgentSession.DoesNotExist:
        return False
    return s.status == SessionStatus.PAUSED


def _maybe_chain_batch(session: AgentSession) -> None:
    """AC-32: enqueue the next IDLE sibling when a batch session finishes.

    Called from the tail of `run_agent_workflow` for both clean
    completion and per-niche failure paths (EC-8 — batch continues on
    individual failures). When the session is paused for approval or
    budget, we explicitly do NOT chain — the user must resolve before
    the next sibling starts.
    """
    if not session.batch_id:
        return
    try:
        from agent_app.services.batch_runner import enqueue_next_in_batch
        enqueue_next_in_batch(session)
    except Exception:  # pragma: no cover — defensive
        logger.exception(
            'Failed to chain next batch sibling for session %s (batch=%s)',
            session.pk, session.batch_id,
        )


# ── Main entry point (AC-36) ───────────────────────────────────────────────


def run_agent_workflow(session_id: str) -> None:
    """Main django-rq entry point for agent workflow execution.

    Enqueued on the 'agent' RQ queue (60-min timeout, configured in settings).

    Lifecycle:
        1. Load session + workspace + niche + creator (select_related).
        2. Refuse cancelled sessions.
        3. AC-19 lazy-seed ToolPermission defaults.
        4. AC-37/38: if status was already RUNNING (worker crash mid-flight)
           or PAUSED (resume request), emit a resume message — the
           checkpointer reloads state from PG via thread_id=session_id.
        5. Status → RUNNING.
        6. Run orchestrator (template steps passed via initial prompt; AC-26).
        7. After return: re-check status — if orchestrator paused (EC-6,
           awaiting_approval), leave it PAUSED. Otherwise mark COMPLETED.
        8. Unhandled exceptions → status FAILED + system error message.
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

    # AC-19: seed defaults if user has none
    _ensure_default_permissions(session)

    # AC-37/38: resume detection. If we land here on a session that was
    # already running (crash) or paused (resume request), emit a message.
    is_resume = session.status in (SessionStatus.RUNNING, SessionStatus.PAUSED)
    if is_resume:
        _emit_resume_message(session)

    # Mark as running
    session.status = SessionStatus.RUNNING
    session.save(update_fields=['status', 'updated_at'])

    try:
        from agent_app.agents.orchestrator import run_orchestrator
        run_orchestrator(session, resume=is_resume)
    except Exception as exc:
        # AC-45: detect OpenRouter 402 / out-of-credits — pause cleanly
        # instead of marking FAILED. The session can be resumed once the
        # API key has been topped up.
        from agent_app.services.budget_guard import is_budget_error, pause_for_budget
        if is_budget_error(exc):
            logger.warning(
                'Session %s: budget exhausted (402) — pausing workflow',
                session_id,
            )
            pause_for_budget(session)
            _maybe_chain_batch(session)
            return

        logger.exception("Session %s failed: %s", session_id, exc)
        session.status = SessionStatus.FAILED
        session.error_message = str(exc)[:2000]
        session.save(update_fields=['status', 'error_message', 'updated_at'])

        AgentMessage.objects.create(
            session=session,
            role=MessageRole.SYSTEM,
            agent_type='orchestrator',
            content=f"Workflow failed: {exc}",
        )
        # AC-32: sequential batch keeps going on per-niche failure (EC-8).
        _maybe_chain_batch(session)
        return

    # Re-check status — orchestrator may have paused it (EC-6, approval)
    if _is_paused_post_run(session_id):
        logger.info(
            "Session %s ended in PAUSED state (approval/EC-6); job exits cleanly",
            session_id,
        )
        # Sequential batch waits for user resolution before chaining the
        # next sibling — explicit pause (approval / budget) does NOT
        # auto-advance.
        return

    # Clean completion
    session.refresh_from_db()
    if session.status not in (SessionStatus.FAILED, SessionStatus.CANCELLED):
        session.status = SessionStatus.COMPLETED
        session.completed_at = timezone.now()
        session.save(update_fields=['status', 'completed_at', 'updated_at'])
        _emit_summary(session)

    # AC-32: chain next sibling in a sequential batch.
    _maybe_chain_batch(session)


# ── Resume entry point (AC-41) ─────────────────────────────────────────────


def resume_agent_workflow(session_id: str) -> None:
    """Resume a paused session from checkpoint (AC-41).

    Thin wrapper around ``run_agent_workflow`` — the checkpointer in
    the orchestrator picks up where it left off via
    ``thread_id=session_id``. We delegate to keep crash-recovery and
    explicit-resume semantics identical (see AC-37 wording).
    """
    run_agent_workflow(session_id)


# ── PROJ-29 Phase 1D-3: rolling conversation summarizer (chat agent) ───────


def _summarize_after_n_turns() -> int:
    """Resolve ``NICHE_RAG_SUMMARIZE_AFTER_N_TURNS`` env -> int (default 10)."""
    raw = os.environ.get('NICHE_RAG_SUMMARIZE_AFTER_N_TURNS', '10')
    try:
        return int(raw)
    except (TypeError, ValueError):
        return 10


@django_rq.job('agent', timeout=120, result_ttl=3600, failure_ttl=86400)
def summarize_conversation(session_id: str) -> None:
    """rq job: regenerate ``ChatSession.conversation_summary``.

    PROJ-29 Phase 1G AC-Ops-RQ-4/5 — chat-domain async work runs on the
    ``agent`` queue (separate from ``default``) so embedding/backfill storms
    don't delay conversation summarization. Job timeout 120s (single LLM
    call), result TTL 1h, failure TTL 24h.

    Triggered by the Phase 1E view AFTER a new assistant turn lands on a
    session with >= ``NICHE_RAG_SUMMARIZE_AFTER_N_TURNS`` messages
    (default 10).

    Behavior:
      - Loads all messages ordered by ``created_at``.
      - Skips with a log line when message count is below threshold.
      - Summarizes ``messages[:-5]`` — leaves the newest 5 turns verbatim
        for the next-turn prompt assembler.
      - On non-empty result: writes to ``conversation_summary``.
      - On empty result (LLM failure / EC-21): logs warning, keeps stale
        summary intact (eventually consistent — EC-28).
    """
    from search_app.models import ChatMessage, ChatSession

    try:
        session = ChatSession.objects.select_related('niche_context').get(
            id=session_id,
        )
    except ChatSession.DoesNotExist:
        logger.warning(
            'summarize_conversation: ChatSession %s not found', session_id,
        )
        return

    threshold = _summarize_after_n_turns()
    messages_qs = ChatMessage.objects.filter(session=session).order_by(
        'created_at',
    ).values('role', 'content')
    messages = list(messages_qs)
    if len(messages) < threshold:
        logger.info(
            'summarize_conversation: session %s has %d messages (< %d); '
            'skipping summary.',
            session_id, len(messages), threshold,
        )
        return

    # Everything EXCEPT the newest 5 turns is summarized.
    messages_to_summarize = messages[:-5] if len(messages) > 5 else messages
    payload = [
        {'role': m['role'], 'content': m['content']}
        for m in messages_to_summarize
    ]
    niche_name = (
        session.niche_context.name if session.niche_context_id else ''
    )

    result = summarize(payload, niche_name=niche_name)
    if not result:
        logger.warning(
            'summarize_conversation: empty summary for session %s; '
            'keeping stale summary (EC-21).',
            session_id,
        )
        return

    session.conversation_summary = result
    session.save(update_fields=['conversation_summary'])
    logger.info(
        'summarize_conversation: updated session %s (%d msgs summarized -> '
        '%d chars).',
        session_id, len(messages_to_summarize), len(result),
    )


__all__ = [
    'run_agent_workflow',
    'resume_agent_workflow',
    'summarize_conversation',
]
