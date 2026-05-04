"""Reflection service — AC-69, AC-71 (Phase 14, Metis Pattern).

Responsibilities:
    - ``should_reflect(workspace)`` — cadence gate driven by AgentWorkspaceConfig.
    - ``run_reflection(session_id)`` — atomic reflection job that:
        a. Summarizes the session.
        b. Updates WorkspaceMemory with hard char-limit eviction (EC-18).
        c. Extracts Skill candidates per AC-71 triggers (A/B/C).
        d. Triggers UserProfile dialectic (AC-70).
    - Signal hookup: when AgentSession transitions to ``completed``,
      enqueue ``run_reflection`` on the agent queue.
    - Retry-once-on-failure (5 minutes), then logs to AgentActionLog.
"""

from __future__ import annotations

import logging
from datetime import timedelta

import django_rq
from django.db import transaction
from django.utils import timezone

from agent_app.models import (
    ActionStatus,
    AgentActionLog,
    AgentMessage,
    AgentSession,
    AgentWorkspaceConfig,
    MessageRole,
    SessionStatus,
    Skill,
    SkillTriggerType,
    WorkspaceMemory,
)
from agent_app.services.skill_manager import create_skill
from agent_app.services.user_profile_service import (
    run_dialectic,
    should_run_dialectic,
    get_or_create_profile,
)

logger = logging.getLogger(__name__)


MEMORY_DEFAULT_LIMIT = 2200
RETRY_DELAY_SECONDS = 300  # 5 minutes


# ── Config helpers ───────────────────────────────────────────────────────────


def get_or_create_config(workspace) -> AgentWorkspaceConfig:
    cfg, _ = AgentWorkspaceConfig.objects.get_or_create(workspace=workspace)
    return cfg


def get_or_create_memory(workspace) -> WorkspaceMemory:
    mem, _ = WorkspaceMemory.objects.get_or_create(workspace=workspace)
    return mem


# ── Cadence ──────────────────────────────────────────────────────────────────


def should_reflect(workspace) -> bool:
    """Return True if the workspace has accumulated enough completed
    sessions to warrant a new reflection.
    """
    cfg = get_or_create_config(workspace)
    cadence = max(1, int(cfg.reflection_cadence_sessions or 1))

    mem = get_or_create_memory(workspace)
    last_at = mem.last_consolidated_at

    qs = AgentSession.objects.filter(
        workspace=workspace,
        status=SessionStatus.COMPLETED,
    )
    if last_at:
        qs = qs.filter(completed_at__gt=last_at)
    completed = qs.count()
    return completed >= cadence


# ── Memory helpers (EC-18) ───────────────────────────────────────────────────


def _evict_to_limit(memory_md: str, limit: int) -> str:
    """EC-18 — keep the memory under ``limit`` chars by dropping oldest blocks.

    Memory is structured as ``\n\n``-separated blocks; oldest first
    (top of file). We pop blocks from the top until total length <= limit.
    Falls back to a hard truncate if even a single block exceeds the limit.
    """
    if memory_md is None:
        return ''
    if len(memory_md) <= limit:
        return memory_md

    blocks = memory_md.split('\n\n')
    while blocks and len('\n\n'.join(blocks)) > limit:
        blocks.pop(0)
    if not blocks:
        return memory_md[-limit:]
    out = '\n\n'.join(blocks)
    if len(out) > limit:
        out = out[-limit:]
    return out


def _summarize_session(session: AgentSession) -> str:
    """Produce a 1-3 line plain-text recap of the session (no LLM call).

    Cheap deterministic recap: title, niche, completed steps, recent
    user message snippet. Vector-similar searches only need a small
    semantic anchor; a heavyweight LLM summary is reserved for
    Skill candidates (AC-71) where it pays off.
    """
    bits: list[str] = []
    bits.append(f"Session '{session.title or session.pk}'")
    if session.workflow_template:
        bits.append(f"template={session.workflow_template}")
    if session.niche_context_id:
        bits.append(f"niche={session.niche_context_id}")
    bits.append(f"steps={session.completed_steps}/{session.total_steps}")

    last_user = AgentMessage.objects.filter(
        session=session, role=MessageRole.USER,
    ).order_by('-created_at').values_list('content', flat=True).first() or ''
    if last_user:
        bits.append(f"last_request={last_user[:140]!r}")
    return ' | '.join(bits)


def _append_to_memory(memory: WorkspaceMemory, summary: str, char_limit: int) -> None:
    """Append a new entry to memory, then enforce char limit (EC-18)."""
    when = timezone.now().strftime('%Y-%m-%d')
    block = f"- [{when}] {summary}"
    new_md = (memory.content_md.rstrip() + '\n\n' + block) if memory.content_md else block
    memory.content_md = _evict_to_limit(new_md, char_limit)


# ── AC-71 trigger detection ──────────────────────────────────────────────────


def _count_tool_calls(session: AgentSession) -> int:
    """Number of started/completed tool calls in this session."""
    return AgentActionLog.objects.filter(
        session=session,
        status__in=[ActionStatus.STARTED, ActionStatus.COMPLETED, ActionStatus.APPROVED],
    ).count()


def _had_errors(session: AgentSession) -> bool:
    return AgentActionLog.objects.filter(
        session=session,
        status=ActionStatus.FAILED,
    ).exists()


def _had_user_correction(session: AgentSession) -> bool:
    """Trigger C — user explicitly corrected via reject + follow-up content."""
    rejected = AgentActionLog.objects.filter(
        session=session,
        status=ActionStatus.REJECTED,
    ).exists()
    if not rejected:
        return False
    # Look for an approval_response message with non-empty content
    return AgentMessage.objects.filter(
        session=session,
        role=MessageRole.APPROVAL_RESPONSE,
    ).exclude(content='').exists()


def _had_recovery(session: AgentSession) -> bool:
    """Trigger B — at least one FAILED action then a final COMPLETED session.

    RetryPolicy is deferred (Phase 3 caveat); we use the AgentActionLog
    failure + session-completion proxy instead.
    """
    if session.status != SessionStatus.COMPLETED:
        return False
    return AgentActionLog.objects.filter(
        session=session,
        status=ActionStatus.FAILED,
    ).exists()


def _detect_skill_triggers(
    session: AgentSession, min_tool_calls: int,
) -> list[tuple[str, str]]:
    """Return a list of ``(trigger_type, rationale)`` tuples for AC-71."""
    triggers: list[tuple[str, str]] = []
    tool_calls = _count_tool_calls(session)
    errored = _had_errors(session)

    # Trigger A: complex task, no errors.
    if tool_calls > min_tool_calls and not errored:
        triggers.append((
            SkillTriggerType.AUTO_COMPLEX_TASK,
            f'session completed {tool_calls} tool calls without errors',
        ))
    # Trigger B: error recovery.
    if _had_recovery(session):
        triggers.append((
            SkillTriggerType.AUTO_ERROR_RECOVERY,
            'session recovered after one or more failed tool calls',
        ))
    # Trigger C: user correction.
    if _had_user_correction(session):
        triggers.append((
            SkillTriggerType.USER_CORRECTION,
            'user explicitly rejected a tool with a follow-up message',
        ))
    return triggers


def _propose_skill_for_trigger(
    session: AgentSession, trigger_type: str, rationale: str,
) -> Skill:
    """Create a skeletal Skill row for a detected trigger.

    The full LLM-generated content is intentionally light — this is a
    candidate that the user can refine. Reflection-time LLM cost is
    bounded (deterministic content), but agent feedback loops can
    later patch the skill via ``patch_skill`` (AC-72).
    """
    base_name = f"Skill from session {str(session.pk)[:8]}"
    description = (
        f"Auto-extracted skill ({trigger_type}). {rationale}. "
        f"Refine the body to make this generally applicable."
    )
    body = (
        f"# {base_name}\n\n"
        f"_Triggered by: {trigger_type}_\n\n"
        f"Session context:\n- {_summarize_session(session)}\n\n"
        f"Steps & decisions worth re-using next time:\n"
        f"_(LLM enrichment placeholder — refine via the Skill editor.)_\n"
    )
    return create_skill(
        workspace=session.workspace,
        name=base_name,
        description=description,
        content_md=body,
        trigger_type=trigger_type,
        applicable_agent_types=[],  # Empty → applies to all agent types.
        created_by_session=session,
        created_by=session.created_by,
        patch_summary=f'Auto-created via reflection ({trigger_type})',
    )


# ── Main entry point (django-rq job) ─────────────────────────────────────────


def run_reflection(session_id: str, *, retry: bool = False) -> None:
    """AC-69 — Run a reflection cycle for a completed session.

    Wrapped in a single ``transaction.atomic`` so that if any step fails
    (DB error, LLM exception), the whole cycle rolls back and we can
    retry once after RETRY_DELAY_SECONDS (EC-21).
    """
    try:
        session = AgentSession.objects.select_related(
            'workspace', 'created_by',
        ).get(pk=session_id)
    except AgentSession.DoesNotExist:
        logger.warning('reflection: session %s missing', session_id)
        return

    if session.status != SessionStatus.COMPLETED:
        logger.info('reflection: session %s not completed, skipping', session_id)
        return

    workspace = session.workspace
    cfg = get_or_create_config(workspace)
    memory = get_or_create_memory(workspace)

    try:
        with transaction.atomic():
            # Step (a) — summary + (b) memory update with EC-18 eviction.
            summary = _summarize_session(session)
            _append_to_memory(memory, summary, cfg.memory_char_limit)
            memory.last_consolidated_at = timezone.now()
            memory.last_consolidated_session = session
            memory.full_clean(exclude=['workspace'])
            memory.save(
                update_fields=[
                    'content_md', 'last_consolidated_at',
                    'last_consolidated_session', 'updated_at',
                ],
            )

            # Step (c) — Skill candidates per AC-71.
            triggers = _detect_skill_triggers(
                session, cfg.skill_creation_min_tool_calls,
            )
            for trigger_type, rationale in triggers:
                _propose_skill_for_trigger(session, trigger_type, rationale)

            # Step (d) — UserProfile dialectic (AC-70). Cadence gate
            # uses sessions-since-last-dialectic.
            profile = get_or_create_profile(workspace, session.created_by)
            sessions_since = AgentSession.objects.filter(
                workspace=workspace,
                created_by=session.created_by,
                status=SessionStatus.COMPLETED,
                completed_at__gt=(profile.last_dialectic_at or timezone.now() - timedelta(days=3650)),
            ).count()
            if should_run_dialectic(profile, sessions_since):
                run_dialectic(workspace, session.created_by, session_id=str(session_id))
    except Exception as exc:
        logger.exception('reflection failed for session %s', session_id)
        if retry:
            # EC-21 — second failure: log to AgentActionLog and give up.
            AgentActionLog.objects.create(
                session=session,
                workspace=workspace,
                user=session.created_by,
                agent_type='orchestrator',
                action='reflection',
                status=ActionStatus.FAILED,
                error_message=str(exc)[:2000],
            )
            return
        # First failure — schedule a retry.
        try:
            queue = django_rq.get_queue('agent')
            scheduler = getattr(queue, 'enqueue_in', None)
            if scheduler is not None:
                queue.enqueue_in(
                    timedelta(seconds=RETRY_DELAY_SECONDS),
                    run_reflection,
                    str(session_id),
                    retry=True,
                )
            else:  # pragma: no cover — fallback
                queue.enqueue(run_reflection, str(session_id), retry=True)
        except Exception:  # pragma: no cover — defensive
            logger.exception(
                'reflection: failed to schedule retry for session %s',
                session_id,
            )
        return


def maybe_enqueue_reflection(session: AgentSession) -> bool:
    """Public entry used from signals / orchestrator tail.

    Returns True if a reflection job was actually enqueued.
    """
    if session.status != SessionStatus.COMPLETED:
        return False
    if not should_reflect(session.workspace):
        return False
    try:
        queue = django_rq.get_queue('agent')
        queue.enqueue(run_reflection, str(session.pk))
        return True
    except Exception:  # pragma: no cover — defensive
        logger.exception('failed to enqueue reflection for session %s', session.pk)
        return False


__all__ = [
    'should_reflect',
    'run_reflection',
    'maybe_enqueue_reflection',
    'get_or_create_config',
    'get_or_create_memory',
]
