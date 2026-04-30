"""Base factory for sub-agent ReAct graphs (AC-10 + AC-11).

Each sub-agent is built via `build_sub_agent(agent_type, tools)` which:
- Loads its LLM + system prompt via `get_llm_for_agent` (AgentConfig in DB)
- Enforces tool-registry isolation (AC-11) by cross-checking every tool's
  `_tool_name` against `TOOL_AGENT_MAP[agent_type]` — raises if a tool from
  a different sub-agent leaked into the toolset.
- Returns an `AgentExecutor`-compatible LangGraph CompiledGraph
  (output of `create_react_agent`).

This is the **only** place where sub-agent graphs are instantiated — the 6
sub-agent files are thin re-exports for clarity in tests and orchestrator
delegate-tools.
"""

from __future__ import annotations

import logging
from typing import Any, Sequence

from langgraph.prebuilt import create_react_agent

from agent_app.constants import TOOL_AGENT_MAP

logger = logging.getLogger(__name__)


class ToolIsolationError(RuntimeError):
    """Raised when a tool from a different sub-agent leaks into a sub-agent's toolset."""


def _tool_canonical_name(tool: Any) -> str:
    """Best-effort extraction of a tool's canonical name.

    LangChain `@tool`-decorated functions wrapped by `@permission_check`
    expose `_tool_name`. Plain `@tool` functions expose `.name`.
    """
    name = getattr(tool, '_tool_name', None)
    if name:
        return name
    # LangChain StructuredTool / BaseTool
    name = getattr(tool, 'name', None)
    if name:
        return name
    # Fallback: function __name__
    inner = getattr(tool, 'func', None) or getattr(tool, '__wrapped__', None)
    if inner is not None and hasattr(inner, '__name__'):
        return inner.__name__
    return getattr(tool, '__name__', repr(tool))


def assert_tools_belong_to_agent(agent_type: str, tools: Sequence[Any]) -> None:
    """AC-11 enforcement: every tool must be registered to this agent_type."""
    bad: list[str] = []
    for tool in tools:
        name = _tool_canonical_name(tool)
        mapped = TOOL_AGENT_MAP.get(name)
        if mapped is None:
            bad.append(f"{name} (unregistered)")
        elif mapped != agent_type:
            bad.append(f"{name} (belongs to '{mapped}')")
    if bad:
        raise ToolIsolationError(
            f"Tool isolation violation for sub-agent '{agent_type}': {', '.join(bad)}"
        )


def build_sub_agent(
    workspace,
    agent_type: str,
    tools: Sequence[Any],
    *,
    query_text: str = '',
):
    """Build a `create_react_agent` graph for a sub-agent (AC-10 + AC-30).

    Loads all 3 knowledge layers via `services.knowledge_loader.build_agent_context`
    (Layer 1 system prompt + top 5 KnowledgeDocs + top 5 implicit experiences)
    and prepends them to the LLM prompt before constructing the graph.

    Args:
        workspace: Workspace instance — used to look up AgentConfig + knowledge.
        agent_type: One of `AgentType.values` (excluding 'orchestrator').
        tools: Sub-agent's TOOLS list (will be validated against TOOL_AGENT_MAP).
        query_text: Optional task text used to bias Layer 2/3 retrieval.

    Returns:
        A compiled LangGraph `create_react_agent` executor with `.ainvoke`.

    Raises:
        ToolIsolationError: if any tool belongs to a different sub-agent.
    """
    from agent_app.agents.llm import get_llm_for_agent
    from agent_app.services.knowledge_loader import (
        build_agent_context,
        render_context_as_prompt,
    )

    assert_tools_belong_to_agent(agent_type, tools)

    llm, _system_prompt = get_llm_for_agent(workspace, agent_type)

    # Layer 1+2+3 — load context and render as a single system prompt (AC-30).
    try:
        context = build_agent_context(workspace, agent_type, query_text=query_text)
        full_prompt = render_context_as_prompt(context)
    except Exception as exc:  # pragma: no cover — defensive
        logger.warning(
            "knowledge_loader failed for ws=%s type=%s (%s); falling back to AgentConfig prompt",
            getattr(workspace, 'pk', workspace), agent_type, exc,
        )
        full_prompt = _system_prompt

    logger.debug(
        "build_sub_agent agent_type=%s workspace=%s tool_count=%d prompt_chars=%d",
        agent_type, getattr(workspace, 'pk', workspace), len(tools),
        len(full_prompt or ''),
    )

    return create_react_agent(
        model=llm,
        tools=list(tools),
        prompt=full_prompt or None,
    )


__all__ = [
    'build_sub_agent',
    'assert_tools_belong_to_agent',
    'ToolIsolationError',
]
