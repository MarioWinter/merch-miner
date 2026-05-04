"""Reflection Sub-Agent (Phase 14, AC-69 + AC-71).

Lightweight ``create_react_agent`` graph dedicated to:

- Summarising completed AgentSession runs.
- Proposing WorkspaceMemory consolidation entries.
- Extracting Skill candidates per AC-71 (Trigger A/B/C).

The actual reflection orchestration runs in
``agent_app.services.reflection_service`` (django-rq job, atomic). This
sub-agent is the LLM-driven reasoning component used by that service when
an LLM enrichment step is desired (e.g. richer Skill content_md, narrative
memory consolidation). The deterministic recap path in
``reflection_service`` does NOT call this graph — it is gated to keep
reflection cheap on the critical path.

Tools (read-only against AgentSession + AgentMessage; write via the
service-layer helpers, never directly from the LLM):

- ``read_agent_session(session_id)`` — fetch session metadata + counts
- ``read_session_messages(session_id, limit)`` — recent message tail
- ``write_workspace_memory_block(workspace_id, content_md)`` — append +
  evict via reflection_service helpers (char-limit enforced)
- ``create_skill_candidate(...)`` — proxy to ``skill_manager.create_skill``

Tools are exempt from the AC-11 isolation registry (this is an
internal/reflection sub-agent that does not appear in TOOL_AGENT_MAP).
``build_sub_agent`` is therefore intentionally NOT used here.
"""

from __future__ import annotations

import logging
from typing import Optional

from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

logger = logging.getLogger(__name__)

AGENT_TYPE = 'reflection'


def _build_tools(workspace):
    """Construct the reflection-agent tool list bound to ``workspace``."""
    from agent_app.models import (
        AgentMessage,
        AgentSession,
        SkillTriggerType,
    )
    from agent_app.services.reflection_service import (
        get_or_create_memory,
        _evict_to_limit,
    )
    from agent_app.services.skill_manager import create_skill

    @tool('read_agent_session')
    def read_agent_session(session_id: str) -> str:
        """Return a compact summary of the AgentSession (workspace-scoped)."""
        try:
            session = AgentSession.objects.get(
                pk=session_id, workspace=workspace,
            )
        except AgentSession.DoesNotExist:
            return f'Session {session_id} not found in workspace.'
        return (
            f"Session id={session.pk}\n"
            f"Title: {session.title}\n"
            f"Workflow: {session.workflow_template or '(autonomous)'}\n"
            f"Status: {session.status}\n"
            f"Steps: {session.completed_steps}/{session.total_steps}\n"
            f"Niche: {session.niche_context_id or '(none)'}\n"
        )

    @tool('read_session_messages')
    def read_session_messages(session_id: str, limit: int = 30) -> str:
        """Return up to ``limit`` recent messages (oldest first)."""
        try:
            session = AgentSession.objects.get(
                pk=session_id, workspace=workspace,
            )
        except AgentSession.DoesNotExist:
            return f'Session {session_id} not found in workspace.'
        msgs = list(
            AgentMessage.objects.filter(session=session)
            .order_by('-created_at')[: max(1, min(int(limit), 100))]
        )[::-1]
        if not msgs:
            return '(no messages)'
        out = []
        for m in msgs:
            out.append(f"[{m.role}] {(m.content or '')[:300]}")
        return '\n'.join(out)

    @tool('write_workspace_memory_block')
    def write_workspace_memory_block(content_md: str) -> str:
        """Append ``content_md`` to WorkspaceMemory + enforce char limit."""
        from agent_app.services.reflection_service import get_or_create_config
        memory = get_or_create_memory(workspace)
        cfg = get_or_create_config(workspace)
        new_md = (
            (memory.content_md.rstrip() + '\n\n' + content_md.strip())
            if memory.content_md else content_md.strip()
        )
        memory.content_md = _evict_to_limit(new_md, cfg.memory_char_limit)
        memory.full_clean(exclude=['workspace'])
        memory.save(update_fields=['content_md', 'updated_at'])
        return f'OK: memory now {len(memory.content_md)} chars'

    @tool('create_skill_candidate')
    def create_skill_candidate(
        name: str,
        description: str,
        content_md: str,
        trigger_type: str = SkillTriggerType.MANUAL,
        applicable_agent_types: Optional[list[str]] = None,
    ) -> str:
        """Create a Skill row + initial SkillVersion (workspace-scoped)."""
        skill = create_skill(
            workspace=workspace,
            name=name,
            description=description,
            content_md=content_md,
            trigger_type=trigger_type,
            applicable_agent_types=applicable_agent_types or [],
            patch_summary='Reflection-agent enrichment',
        )
        return f'Skill {skill.pk} created (v{skill.version}).'

    return [
        read_agent_session,
        read_session_messages,
        write_workspace_memory_block,
        create_skill_candidate,
    ]


def build(workspace):
    """Compile the reflection sub-agent for a workspace."""
    from agent_app.agents.llm import get_llm_for_agent

    # Reuse orchestrator's LLM/personality slot — reflection is a
    # workspace-level meta-agent (no dedicated AgentConfig row).
    llm, system_prompt = get_llm_for_agent(workspace, 'orchestrator')

    prompt = (
        (system_prompt or '') + '\n\n'
        + 'You are the Reflection sub-agent. Summarise the completed '
        + 'session, propose a 1-3 line block to append to workspace memory, '
        + 'and (when appropriate) extract a reusable Skill. Keep memory '
        + 'blocks concise and Skills generally applicable.'
    )

    return create_react_agent(
        model=llm,
        tools=_build_tools(workspace),
        prompt=prompt,
    )


__all__ = ['build', 'AGENT_TYPE']
