"""Permission check decorator for agent tools (AC-18).

Phase 4 — wires the pass-through Phase-2 stub to the real permission flow:

1. The wrapper inspects the LangGraph `config` kwarg (`config['configurable']`)
   for `session_id` and `agent_type`.
2. Calls `permission_checker.check_tool_permission(...)`.
3. **Auto/Notify** → executes the wrapped tool, marks the action log
   `completed` (or `failed` on exception) with `error_message` populated.
4. **Approve**     → does NOT execute. Returns a structured payload
   `{'status': 'awaiting_approval', 'action_log_id': '<uuid>'}` so the
   ReAct loop emits a deterministic message and the orchestrator can
   pause via `AgentSession.status = paused`.

Conventions:
- Every wrapped tool keeps `_tool_name` + `_requires_permission` markers
  for the AC-11 isolation enforcer.
- When `config` is missing (test invocation, manual call) the wrapper
  short-circuits to direct execution and logs at WARN level. This keeps
  unit tests for individual tools simple while still defending the live
  orchestrator path.
"""

from __future__ import annotations

import functools
import logging
from typing import Any, Callable, TypeVar

from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

F = TypeVar('F', bound=Callable[..., Any])


def _extract_runtime_ctx(kwargs: dict[str, Any]) -> dict[str, Any] | None:
    """Pull `configurable` mapping out of a LangGraph `config` kwarg."""
    config = kwargs.get('config')
    if not config:
        return None
    if isinstance(config, dict):
        return config.get('configurable') or None
    # Some tools may receive a RunnableConfig-like object
    cfg = getattr(config, 'configurable', None)
    if cfg:
        return cfg
    return None


def _resolve_session_and_agent(ctx: dict[str, Any]):
    """Look up AgentSession + agent_type from runtime context. Returns (session, agent_type) or (None, None)."""
    from agent_app.models import AgentSession  # local import for app-loading safety

    session_id = ctx.get('session_id')
    if not session_id:
        return None, None
    try:
        session = AgentSession.objects.select_related(
            'workspace', 'created_by',
        ).get(id=session_id)
    except AgentSession.DoesNotExist:
        return None, None
    # `agent_type` may be set by the orchestrator delegate tool (it routes
    # `thread_id=<session>__<agent_type>`) — fall back to parsing thread_id.
    agent_type = ctx.get('agent_type')
    if not agent_type:
        thread_id = ctx.get('thread_id') or ''
        if '__' in thread_id:
            agent_type = thread_id.rsplit('__', 1)[-1]
    return session, (agent_type or 'orchestrator')


def _finalize_log(action_log, status: str, error_message: str = '') -> None:
    """Mark an action log terminal (after Auto/Notify execution)."""
    from agent_app.models import ActionStatus  # local import

    fields = ['status', 'completed_at']
    action_log.status = status
    action_log.completed_at = timezone.now()
    if error_message:
        action_log.error_message = error_message[:2000]
        fields.append('error_message')
    try:
        action_log.save(update_fields=fields)
    except Exception:  # pragma: no cover — defensive
        logger.exception("Failed to finalize action log %s", action_log.pk)
    # Touch ActionStatus to silence linter when the import is unused above.
    _ = ActionStatus


def permission_check(tool_name: str) -> Callable[[F], F]:
    """Decorator that gates a tool call with the Auto/Notify/Approve flow.

    Args:
        tool_name: Canonical tool name from `agent_app.constants.ALL_TOOLS`.

    Returns:
        A decorator that:
        - tags the function with `_tool_name` + `_requires_permission` markers
        - runs the permission check on every invocation that supplies `config`
        - falls back to direct execution when `config` is missing (test/manual)
    """

    def decorator(fn: F) -> F:
        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            from agent_app.models import ActionStatus  # local import

            # Resolve runtime context — short-circuit if missing
            ctx = _extract_runtime_ctx(kwargs)
            if not ctx:
                logger.debug(
                    "tool %s called without LangGraph config; executing without permission check",
                    tool_name,
                )
                return fn(*args, **kwargs)

            session, agent_type = _resolve_session_and_agent(ctx)
            if session is None:
                logger.warning(
                    "tool %s: could not resolve AgentSession from config; executing without permission check",
                    tool_name,
                )
                return fn(*args, **kwargs)

            # AC-40 / AC-42: graceful tool abort when session was paused
            # or cancelled mid-flight. The orchestrator's current tool was
            # already finishing (per spec — pause = "finish current tool,
            # halt"), but any subsequent delegate/sub-agent tool call sees
            # the new status and stops.
            from agent_app.models import SessionStatus  # local import
            if session.status in (SessionStatus.PAUSED, SessionStatus.CANCELLED):
                logger.info(
                    "tool %s: session %s is %s — aborting tool gracefully",
                    tool_name, session.pk, session.status,
                )
                return {
                    'status': 'aborted',
                    'reason': f'session {session.status}',
                    'tool_name': tool_name,
                }

            # Lazy import to avoid Django app-loading order issues
            from agent_app.services.permission_checker import (
                check_tool_permission,
            )

            # AC-22/23: when permission resolves to APPROVE, the action log
            # row, the approval-request message AND the session pause must
            # all hit the DB in one transaction so the frontend never sees a
            # half-paused session (action log present but session still
            # RUNNING) on a subsequent poll.
            with transaction.atomic():
                can_execute, action_log = check_tool_permission(
                    session,
                    tool_name,
                    agent_type=agent_type,
                )

                if not can_execute:
                    # APPROVE branch — flip session.status = PAUSED in the
                    # same transaction so all 3 writes commit together.
                    if session.status != SessionStatus.PAUSED:
                        session.status = SessionStatus.PAUSED
                        session.save(update_fields=['status', 'updated_at'])

            if not can_execute:
                # APPROVE → pause; orchestrator/loop must short-circuit.
                logger.info(
                    "tool %s awaiting approval (action_log=%s) — session paused",
                    tool_name, action_log.pk,
                )
                return {
                    'status': 'awaiting_approval',
                    'action_log_id': str(action_log.pk),
                    'tool_name': tool_name,
                    'message': (
                        f"Approval required for {tool_name}. "
                        "Workflow paused until user resolves."
                    ),
                }

            # AUTO / NOTIFY → execute the tool and finalize the log.
            try:
                result = fn(*args, **kwargs)
            except Exception as exc:  # noqa: BLE001 — re-raised below
                _finalize_log(action_log, ActionStatus.FAILED, str(exc))
                raise
            else:
                _finalize_log(action_log, ActionStatus.COMPLETED)
                # AC-46: emit 80%-of-threshold soft warning (de-duplicated).
                try:
                    from agent_app.services.cost_tracker import (
                        maybe_emit_budget_warning,
                    )
                    maybe_emit_budget_warning(session)
                except Exception:  # pragma: no cover — defensive
                    logger.exception(
                        'budget warning hook failed for session %s tool %s',
                        session.pk, tool_name,
                    )
                return result

        # Markers used by Phase 3 isolation enforcer (`assert_tools_belong_to_agent`).
        wrapper._tool_name = tool_name  # type: ignore[attr-defined]
        wrapper._requires_permission = True  # type: ignore[attr-defined]
        return wrapper  # type: ignore[return-value]

    return decorator


__all__ = ['permission_check']
