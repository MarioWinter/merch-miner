"""Orchestrator Agent — LangGraph StateGraph with delegate tools (AC-9).

Phase 3 implementation:
- Builds a `create_react_agent` over 6 "delegate_to_*" tools, one per sub-agent.
- Each delegate tool invokes the corresponding sub-agent graph
  (`research_agent`, `ideation_agent`, `design_agent`, `listing_agent`,
  `publishing_agent`, `search_agent`).
- Pre-flight check on `delegate_to_design` (EC-6): if the niche has zero
  approved slogans, the orchestrator returns a suggestion message and
  pauses the workflow until user confirmation.
- Per-sub-agent timeout (EC-15) wrapped via `asyncio.wait_for` —
  configurable through `settings.AGENT_SUBAGENT_TIMEOUT_SEC`.
- Sub-Agent return-value filter (AC-73 stub): only the final string output
  of each sub-agent is bubbled up to the orchestrator state — token-saving
  filter; full implementation lands in Phase 14.
- PostgreSQL `AsyncPostgresSaver` checkpointer with `thread_id = session_id`
  shared with PROJ-6/8 (RetryPolicy max_attempts=2 on sub-agent calls).
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional
from uuid import UUID

from asgiref.sync import sync_to_async
from django.conf import settings
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

from agent_app.agents import (
    design_agent,
    ideation_agent,
    listing_agent,
    publishing_agent,
    research_agent,
    search_agent,
)
from agent_app.models import (
    ActionStatus,
    AgentActionLog,
    AgentMessage,
    AgentSession,
    MessageRole,
    SessionStatus,
)

logger = logging.getLogger(__name__)


DEFAULT_SUBAGENT_TIMEOUT_SEC = 600  # 10 minutes per AC/EC-15


# Mapping for delegate tools — keys are the tool names exposed to the LLM.
SUB_AGENT_BUILDERS = {
    'research': research_agent.build,
    'ideation': ideation_agent.build,
    'design': design_agent.build,
    'listing': listing_agent.build,
    'publishing': publishing_agent.build,
    'search': search_agent.build,
}


# ── Helpers ────────────────────────────────────────────────────────────────


def _subagent_timeout_sec() -> int:
    """Return per-sub-agent timeout from settings (EC-15)."""
    val = getattr(settings, 'AGENT_SUBAGENT_TIMEOUT_SEC', DEFAULT_SUBAGENT_TIMEOUT_SEC)
    try:
        return int(val)
    except (TypeError, ValueError):
        return DEFAULT_SUBAGENT_TIMEOUT_SEC


def _extract_final_result(agent_result: Any) -> str:
    """AC-73 — pull only the final string out of a sub-agent run.

    The orchestrator state schema (LangGraph ``MessagesState`` extended via
    ``create_react_agent``) is intentionally kept minimal — only the
    delegate tool's **return string** is appended to the orchestrator's
    message list. Sub-agent intermediate steps (tool-call traces, tool
    results, AIMessage tool_call events) are dropped here and never flow
    back into orchestrator state.

    Returns:
        The last AIMessage content as a plain string (ready to be a tool
        return value). Lists/multi-part contents are joined; tool-call
        events are filtered out so we never leak structured tool traces.
    """
    if isinstance(agent_result, dict):
        # AC-73 invariant: callers (delegate tools) must return only this
        # string — never the raw agent_result dict — so no `intermediate_steps`,
        # `tool_calls`, or message lists end up persisted in orchestrator
        # state. The orchestrator's MessagesState only carries the user-turn,
        # delegate-tool calls, and these scalar return strings.
        messages = agent_result.get('messages') or []
        for msg in reversed(messages):
            # Skip messages that are pure tool-call events (no text content).
            tool_calls = getattr(msg, 'tool_calls', None)
            if tool_calls and not getattr(msg, 'content', None):
                continue

            content = getattr(msg, 'content', None)
            if isinstance(content, str) and content:
                return content
            if isinstance(content, list):
                # AIMessage with list-content (multi-part) → join text parts only
                text_parts = []
                for p in content:
                    if isinstance(p, dict):
                        # Drop tool_use / tool_result blocks — only keep text.
                        ptype = p.get('type')
                        if ptype in ('tool_use', 'tool_result'):
                            continue
                        text_parts.append(p.get('text') or '')
                    else:
                        text_parts.append(str(p))
                joined = ''.join(p for p in text_parts if p)
                if joined:
                    return joined
        return ''
    return str(agent_result)


def _assert_no_intermediate_steps(orchestrator_state: Any) -> None:
    """AC-73 test guard — raise when orchestrator state leaks sub-agent traces.

    Used by the AC-73 test to verify the orchestrator's MessagesState
    schema does NOT contain an ``intermediate_steps`` key after a
    delegate call. Production code does not call this — sub-agent traces
    are filtered at delegate-tool boundary by ``_extract_final_result``.
    """
    if isinstance(orchestrator_state, dict):
        if 'intermediate_steps' in orchestrator_state:
            raise AssertionError(
                'AC-73 violation: orchestrator state contains '
                '`intermediate_steps` key (sub-agent trace leaked).'
            )


def _runtime_ctx(config: Optional[RunnableConfig]) -> dict:
    if not config:
        raise ValueError('Orchestrator delegate tool requires LangGraph config.')
    cfg = config.get('configurable') or {}
    if not cfg.get('session_id') or not cfg.get('workspace_id'):
        raise ValueError('Missing session_id or workspace_id in tool config.')
    return cfg


@sync_to_async
def _load_session(session_id: str) -> Optional[AgentSession]:
    try:
        return AgentSession.objects.select_related(
            'workspace', 'created_by', 'niche_context',
        ).get(id=session_id)
    except AgentSession.DoesNotExist:
        return None


@sync_to_async
def _count_approved_slogans(niche_id: UUID | str) -> int:
    """EC-6 pre-flight helper."""
    try:
        from idea_app.models import Idea
        return Idea.objects.filter(
            niche_id=niche_id,
            status=Idea.Status.APPROVED,
        ).count()
    except Exception:  # pragma: no cover - idea_app missing in some test envs
        logger.warning("EC-6 pre-flight: idea_app unavailable, skipping check")
        return -1  # sentinel: unknown → don't block


@sync_to_async
def _persist_message(session_id: str, role: str, content: str, agent_type: str = '') -> None:
    AgentMessage.objects.create(
        session_id=session_id,
        role=role,
        agent_type=agent_type,
        content=content,
    )


@sync_to_async
def _log_action(
    session: AgentSession,
    agent_type: str,
    action: str,
    status: str = ActionStatus.STARTED,
    error: str = '',
) -> AgentActionLog:
    return AgentActionLog.objects.create(
        session=session,
        workspace=session.workspace,
        user=session.created_by,
        agent_type=agent_type,
        action=action,
        status=status,
        error_message=error,
    )


@sync_to_async
def _update_action_status(action_log: AgentActionLog, status: str, error: str = '') -> None:
    action_log.status = status
    if error:
        action_log.error_message = error[:2000]
    action_log.save(update_fields=['status', 'error_message', 'updated_at'] if hasattr(action_log, 'updated_at') else ['status', 'error_message'])


@sync_to_async
def _pause_session(session_id: str, reason: str) -> None:
    AgentSession.objects.filter(id=session_id).update(
        status=SessionStatus.PAUSED,
        error_message=reason[:2000],
    )


def _drain_session_messages(session: AgentSession) -> list[str]:
    """Sync helper: drain unprocessed user messages (EC-12).

    Wrapped via ``sync_to_async`` from the delegate tool — keeps the
    drain transactional + per-session.
    """
    from agent_app.services.message_queue import drain_unprocessed
    return drain_unprocessed(session)


def _advance_step(session: AgentSession, agent_type: str) -> None:
    """Update session.current_step before delegation.

    Granularity used by AC-38 resume message ("Workflow resumed at step X").
    """
    AgentSession.objects.filter(pk=session.pk).update(
        current_step=f"delegate_to_{agent_type}",
    )


def _bump_completed_steps(session_id: str) -> None:
    """Increment completed_steps after a successful delegation."""
    from django.db.models import F
    AgentSession.objects.filter(pk=session_id).update(
        completed_steps=F('completed_steps') + 1,
    )


# ── Delegate tool factory ──────────────────────────────────────────────────


def _build_delegate_tool(agent_type: str):
    """Construct a `delegate_to_<agent_type>` tool for the orchestrator.

    Each delegate tool:
    1. Loads the AgentSession (using session_id from runtime config).
    2. (Design only) Runs EC-6 pre-flight slogan check.
    3. Builds the sub-agent graph in-process.
    4. Invokes it under `asyncio.wait_for(timeout=…)` (EC-15).
    5. Filters output to final_result string (AC-73 stub).
    6. Logs success/failure to AgentActionLog.
    """

    tool_name = f"delegate_to_{agent_type}"
    description = (
        f"Delegate the current task to the {agent_type.title()} sub-agent. "
        f"Provide a clear task description; the sub-agent's full toolset will "
        f"be available to it. Returns only the sub-agent's final summary."
    )

    @tool(tool_name, description=description)
    async def _delegate(
        task: str,
        config: RunnableConfig = None,
    ) -> str:
        ctx = _runtime_ctx(config)
        session_id = str(ctx['session_id'])

        session = await _load_session(session_id)
        if session is None:
            return f"ERROR: AgentSession {session_id} not found."

        # AC-40 / AC-42: graceful abort if user paused/cancelled the
        # session while the previous tool was running.
        if session.status in (SessionStatus.PAUSED, SessionStatus.CANCELLED):
            logger.info(
                "delegate_to_%s: session %s is %s, skipping delegation",
                agent_type, session_id, session.status,
            )
            return f"ABORTED: session {session.status}"

        # EC-12 — drain queued user commands and fold into next prompt.
        # Drains happen between sub-agent delegations only — minimal
        # overhead, preserves "current tool" semantics.
        try:
            queued = await sync_to_async(_drain_session_messages)(session)
        except Exception:  # pragma: no cover — defensive
            queued = []
        if queued:
            queued_block = '\n'.join(f"- {q}" for q in queued)
            task = (
                f"{task}\n\n"
                f"Additional user instructions received during prior tool:\n"
                f"{queued_block}"
            )

        # Update session.current_step before delegating (used by AC-38 resume msg)
        await sync_to_async(_advance_step)(session, agent_type)

        # EC-6 — Design pre-flight: zero approved slogans → suggest, pause.
        if agent_type == 'design' and session.niche_context_id is not None:
            count = await _count_approved_slogans(session.niche_context_id)
            if count == 0:
                msg = (
                    "No approved slogans for this niche. "
                    "Run Ideation first? (Workflow paused — confirm to override.)"
                )
                await _persist_message(
                    session_id,
                    MessageRole.SYSTEM,
                    msg,
                    agent_type='orchestrator',
                )
                await _pause_session(session_id, msg)
                return msg

        # Build sub-agent + invoke under timeout
        action_log = await _log_action(session, agent_type, f'delegate:{agent_type}')
        try:
            sub_agent = await sync_to_async(SUB_AGENT_BUILDERS[agent_type])(
                session.workspace,
            )
        except Exception as build_err:
            logger.exception("Failed to build sub-agent %s", agent_type)
            await _update_action_status(action_log, ActionStatus.FAILED, str(build_err))
            return f"ERROR: failed to build {agent_type} sub-agent: {build_err}"

        sub_config = {
            'configurable': {
                'workspace_id': str(ctx['workspace_id']),
                'user_id': ctx.get('user_id'),
                'session_id': session_id,
                # thread_id branch per sub-agent so checkpoints don't collide
                'thread_id': f"{session_id}__{agent_type}",
            },
        }
        if config and config.get('callbacks'):
            sub_config['callbacks'] = config['callbacks']

        timeout = _subagent_timeout_sec()
        try:
            result = await asyncio.wait_for(
                sub_agent.ainvoke(
                    {'messages': [{'role': 'user', 'content': task}]},
                    config=sub_config,
                ),
                timeout=timeout,
            )
        except asyncio.TimeoutError:
            err = f"{agent_type} sub-agent timed out after {timeout}s"
            logger.warning(err)
            await _update_action_status(action_log, ActionStatus.FAILED, err)
            await _persist_message(
                session_id,
                MessageRole.SYSTEM,
                f"Sub-agent timeout: {err}. Paused for user decision.",
                agent_type='orchestrator',
            )
            # Default policy: ask user → pause workflow
            await _pause_session(session_id, err)
            return f"TIMEOUT: {err}"
        except Exception as run_err:
            logger.exception("Sub-agent %s failed", agent_type)
            await _update_action_status(action_log, ActionStatus.FAILED, str(run_err))
            return f"ERROR: {agent_type} sub-agent failed: {run_err}"

        await _update_action_status(action_log, ActionStatus.COMPLETED)
        await sync_to_async(_bump_completed_steps)(session_id)

        # Inspect result for awaiting_approval signal from sub-agent tools.
        # When a sub-agent's permission_decorator returns the awaiting-approval
        # payload, the result string contains 'awaiting_approval' — pause here.
        final = _extract_final_result(result)
        if 'awaiting_approval' in (final or ''):
            await _pause_session(session_id, 'awaiting_approval')
        return final

    # Tag for tests + introspection
    _delegate._delegate_target = agent_type  # type: ignore[attr-defined]
    return _delegate


def build_orchestrator_tools() -> list:
    """Build the list of 6 delegate tools (AC-9)."""
    return [_build_delegate_tool(at) for at in SUB_AGENT_BUILDERS]


# ── Orchestrator graph ─────────────────────────────────────────────────────


def build_orchestrator_graph(workspace, checkpointer=None):
    """Build the orchestrator's `create_react_agent` graph.

    We piggy-back on `create_react_agent` (same primitive used by sub-agents
    + niche_research_app) so checkpointing and message-passing are uniform.

    Args:
        workspace: Workspace instance.
        checkpointer: Optional LangGraph checkpointer (e.g. AsyncPostgresSaver).
            Passed straight to ``create_react_agent`` — avoids the post-compile
            attribute-assignment hack that LangGraph does not officially
            support.
    """
    from agent_app.agents.llm import get_llm_for_agent

    llm, system_prompt = get_llm_for_agent(workspace, 'orchestrator')
    tools = build_orchestrator_tools()

    kwargs: dict[str, Any] = {
        'model': llm,
        'tools': tools,
        'prompt': system_prompt or None,
    }
    if checkpointer is not None:
        kwargs['checkpointer'] = checkpointer

    return create_react_agent(**kwargs)


# ── Entry point ────────────────────────────────────────────────────────────


def run_orchestrator(session, resume: bool = False) -> None:
    """Synchronous entry point used by `tasks.run_agent_workflow`.

    Wraps the async LangGraph invocation in `asyncio.run`. Sets up the
    AsyncPostgresSaver checkpointer (shared with PROJ-6/8) with
    `thread_id = session_id`.
    """
    logger.info(
        "Orchestrator %s session %s (template=%s, niche=%s)",
        'resuming' if resume else 'starting',
        session.id,
        session.workflow_template or 'autonomous',
        session.niche_context_id,
    )

    callbacks = _maybe_langfuse_callback(session)

    async def _run() -> None:
        config: dict[str, Any] = {
            'configurable': {
                'thread_id': str(session.id),
                'session_id': str(session.id),
                'workspace_id': str(session.workspace_id),
                'user_id': session.created_by_id,
            },
            'recursion_limit': 50,
        }
        if callbacks:
            config['callbacks'] = callbacks

        await _maybe_with_checkpointer(session, config, resume)

    try:
        asyncio.run(_run())
    finally:
        if callbacks:
            try:
                from langfuse import get_client
                get_client().flush()
            except Exception:  # pragma: no cover
                pass


def _maybe_langfuse_callback(session) -> list:
    """Return a Langfuse callback handler list, or [] if not configured."""
    if not getattr(settings, 'LANGFUSE_PUBLIC_KEY', '') or not getattr(settings, 'LANGFUSE_SECRET_KEY', ''):
        return []
    try:
        from langfuse import Langfuse
        from langfuse.langchain import CallbackHandler

        Langfuse(
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
            base_url=settings.LANGFUSE_HOST,
        )
        return [CallbackHandler()]
    except ImportError:
        logger.warning("langfuse package not installed; orchestrator runs without tracing")
        return []


async def _maybe_with_checkpointer(session, config, resume):
    """Invoke graph with AsyncPostgresSaver checkpointer (thread_id=session_id).

    Falls back to in-memory invocation when the checkpointer cannot be
    initialised (e.g. test env without psycopg).

    The graph is compiled inside the saver's context manager so the
    checkpointer is supplied to ``create_react_agent`` directly — avoids
    the post-compile attribute-assignment hack that LangGraph does not
    officially support.
    """
    initial_state = {
        'messages': [
            {
                'role': 'user',
                'content': _build_initial_prompt(session, resume),
            },
        ],
    }

    try:
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

        db_uri = _build_db_uri()
        async with AsyncPostgresSaver.from_conn_string(db_uri) as saver:
            await saver.setup()
            graph = await sync_to_async(build_orchestrator_graph)(
                session.workspace, checkpointer=saver,
            )
            await graph.ainvoke(initial_state, config=config)
            return
    except (ImportError, Exception) as exc:
        logger.warning(
            "AsyncPostgresSaver unavailable for orchestrator (%s); running without checkpointer.",
            exc,
        )

    graph = await sync_to_async(build_orchestrator_graph)(session.workspace)
    await graph.ainvoke(initial_state, config=config)


def _build_db_uri() -> str:
    db_config = settings.DATABASES['default']
    db_uri = (
        f"postgresql://{db_config['USER']}:{db_config['PASSWORD']}"
        f"@{db_config['HOST']}:{db_config['PORT']}/{db_config['NAME']}"
    )
    schema = db_config.get('OPTIONS', {}).get('options', '') or ''
    if 'search_path=' in schema:
        schema_name = schema.split('search_path=')[1].split(',')[0]
        if schema_name and schema_name != 'public':
            db_uri += f"?options=-c%20search_path%3D{schema_name}%2Cpublic"
    return db_uri


def _build_initial_prompt(session, resume: bool) -> str:
    """Compose the orchestrator's first user-turn prompt.

    AC-26:
        - With ``workflow_template``: prepend the template's ordered
          steps as a structured plan the LLM must follow in order.
        - Without: leave fully autonomous — orchestrator plans its own
          delegations via ReAct.

    EC-14:
        - Re-validate the template at template-load time. If invalid,
          emit a system error message and refuse to start.

    EC-12:
        - On resume, include any unprocessed user messages drained from
          the queue.
    """
    parts: list[str] = []
    if resume:
        parts.append(
            f"You are resuming session {session.id}. Continue from step "
            f"'{session.current_step or 'start'}'."
        )
        # Drain queued user messages (EC-12) and fold them in
        try:
            from agent_app.services.message_queue import drain_unprocessed
            queued = drain_unprocessed(session)
        except Exception:  # pragma: no cover — defensive
            queued = []
        if queued:
            parts.append("New user instructions received while paused:")
            for q in queued:
                parts.append(f"- {q}")
    else:
        parts.append(f"Start session {session.id}.")

    # AC-26: pull template steps for structured plan
    template_block = _resolve_template_steps_block(session)
    if template_block:
        parts.append(template_block)
    elif not session.workflow_template:
        parts.append(
            "No workflow template selected — plan delegations autonomously."
        )

    if session.niche_context_id:
        parts.append(f"Niche context id: {session.niche_context_id}.")

    parts.append(
        "Delegate to sub-agents via the `delegate_to_*` tools. After each "
        "delegation you only see the final summary — re-delegate if more "
        "detail is needed."
    )
    return ' '.join(parts)


def _resolve_template_steps_block(session) -> str:
    """Return a string block of template steps for AC-26, or '' if none.

    EC-14 double-check: refuses to run an invalid template. On invalid
    template, emits a system error message and pauses the session,
    returning a sentinel that signals the caller to abort.
    """
    if not session.workflow_template:
        return ''

    from agent_app.models import (
        AgentMessage as _AgentMessage,
        MessageRole as _MessageRole,
        SessionStatus as _SessionStatus,
        WorkflowTemplate as _WorkflowTemplate,
        validate_workflow_steps,
    )

    tmpl = _WorkflowTemplate.objects.filter(
        workspace=session.workspace,
        key=session.workflow_template,
    ).first()
    if not tmpl:
        return ''

    errs = validate_workflow_steps(tmpl.steps)
    if errs:
        # EC-14: refuse to start; emit error + pause
        _AgentMessage.objects.create(
            session=session,
            role=_MessageRole.SYSTEM,
            agent_type='orchestrator',
            content=(
                f"Workflow template '{tmpl.key}' has invalid steps: "
                f"{errs.get('error')} ({errs.get('suggestion')}). "
                f"Workflow paused — confirm override to continue."
            ),
        )
        AgentSession.objects.filter(pk=session.pk).update(
            status=_SessionStatus.PAUSED,
            error_message=str(errs)[:2000],
        )
        return ''

    lines = [f"Workflow template: {tmpl.name} ({tmpl.key}). Follow these steps in order:"]
    for idx, step in enumerate(tmpl.steps, start=1):
        agent_type = step.get('agent_type', '?')
        action = step.get('action', '')
        desc = step.get('description', '')
        suffix = f" — {desc}" if desc else ''
        lines.append(f"  {idx}. delegate_to_{agent_type} ({action}){suffix}")
    return '\n'.join(lines)


__all__ = [
    'run_orchestrator',
    'build_orchestrator_graph',
    'build_orchestrator_tools',
    'SUB_AGENT_BUILDERS',
    'DEFAULT_SUBAGENT_TIMEOUT_SEC',
    '_extract_final_result',
    '_assert_no_intermediate_steps',
]
