"""Publishing Sub-Agent (AC-10)."""

from __future__ import annotations

from agent_app.agents.sub_agent_base import build_sub_agent
from agent_app.agents.tools import publishing_tools

AGENT_TYPE = 'publishing'
TOOLS = publishing_tools.TOOLS


def build(workspace):
    return build_sub_agent(workspace, AGENT_TYPE, TOOLS)


__all__ = ['build', 'AGENT_TYPE', 'TOOLS']
