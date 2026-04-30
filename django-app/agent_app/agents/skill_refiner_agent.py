"""Skill Refiner Sub-Agent (Phase 14, AC-72).

When a Skill loaded into context (via ``find_relevant_skills``) results
in an error during sub-agent execution, this agent runs as a sub-agent
to produce ``patch_md``. The patch is then applied via
``skill_manager.patch_skill`` with optimistic concurrency
(``expected_version``) — see EC-19 for the conflict path.

Tools (read-only on Skill + SkillVersion; write goes through
``patch_skill`` from the service-layer caller):

- ``read_skill(skill_id)`` — fetch current Skill content + version.
- ``read_skill_versions(skill_id, limit)`` — list recent version snapshots.
- ``propose_patch(patch_md, summary)`` — terminal tool that returns the
  patch payload to the caller. The caller (skill manager / reflection
  service) is responsible for applying the patch via
  ``patch_skill(skill_id, patch_md, expected_version)``.

This is a **reasoning-only** agent — it does NOT mutate the Skill itself,
so concurrency conflicts surface deterministically at apply time.
"""

from __future__ import annotations

import json
import logging

from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

logger = logging.getLogger(__name__)

AGENT_TYPE = 'skill_refiner'


def _build_tools(workspace):
    """Construct the skill_refiner-agent tool list bound to ``workspace``."""
    from agent_app.models import Skill, SkillVersion

    @tool('read_skill')
    def read_skill(skill_id: str) -> str:
        """Return the current Skill content + version."""
        try:
            skill = Skill.objects.get(pk=skill_id, workspace=workspace)
        except Skill.DoesNotExist:
            return f'Skill {skill_id} not found in workspace.'
        return (
            f"Skill id={skill.pk} v{skill.version}\n"
            f"Name: {skill.name}\n"
            f"Description: {skill.description}\n"
            f"Trigger: {skill.trigger_type}\n"
            f"Applicable agents: {skill.applicable_agent_types}\n\n"
            f"---\n{skill.content_md}\n---\n"
        )

    @tool('read_skill_versions')
    def read_skill_versions(skill_id: str, limit: int = 5) -> str:
        """Return up to ``limit`` recent version snapshots (newest first)."""
        try:
            skill = Skill.objects.get(pk=skill_id, workspace=workspace)
        except Skill.DoesNotExist:
            return f'Skill {skill_id} not found in workspace.'
        rows = SkillVersion.objects.filter(skill=skill).order_by(
            '-version',
        )[: max(1, min(int(limit), 20))]
        if not rows:
            return '(no versions)'
        out = []
        for v in rows:
            out.append(
                f"v{v.version} @ {v.created_at:%Y-%m-%d}\n"
                f"  summary: {v.patch_summary}\n"
                f"  body[0..200]: {(v.content_md or '')[:200]}"
            )
        return '\n'.join(out)

    @tool('propose_patch')
    def propose_patch(patch_md: str, summary: str = '') -> str:
        """Emit the proposed patch as a JSON payload (terminal tool).

        The caller parses the JSON to apply via ``skill_manager.patch_skill``.
        """
        return json.dumps({
            'patch_md': patch_md,
            'summary': summary or 'Refiner-agent patch',
        })

    return [read_skill, read_skill_versions, propose_patch]


def build(workspace):
    """Compile the skill_refiner sub-agent for a workspace."""
    from agent_app.agents.llm import get_llm_for_agent

    llm, system_prompt = get_llm_for_agent(workspace, 'orchestrator')

    prompt = (
        (system_prompt or '') + '\n\n'
        + 'You are the Skill Refiner sub-agent. Inspect the failing Skill, '
        + 'review its version history, and propose a focused patch via '
        + '`propose_patch(patch_md, summary)`. Keep the patch minimal — '
        + 'fix the failure mode without rewriting the whole skill.'
    )

    return create_react_agent(
        model=llm,
        tools=_build_tools(workspace),
        prompt=prompt,
    )


__all__ = ['build', 'AGENT_TYPE']
