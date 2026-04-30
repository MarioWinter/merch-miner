"""Research Sub-Agent (AC-10).

Wraps `create_react_agent` with research_tools.TOOLS. The agent_type is
'research' so AC-11 isolation prevents access to ideation/design/etc tools.
"""

from __future__ import annotations

from agent_app.agents.sub_agent_base import build_sub_agent
from agent_app.agents.tools import research_tools

AGENT_TYPE = 'research'
TOOLS = research_tools.TOOLS


def build(workspace):
    """Compile the research sub-agent for a workspace."""
    return build_sub_agent(workspace, AGENT_TYPE, TOOLS)


__all__ = ['build', 'AGENT_TYPE', 'TOOLS']
