"""6-layer knowledge loading for agent context (AC-27/28/29/30 + AC-74).

Layer 1: System prompt + personality from `AgentConfig` (AC-27).
Layer 2: Top-N relevant `KnowledgeDoc`s via Vector DB hybrid search (AC-28).
Layer 3: "Implicit Learning" — past approval/rejection outcomes & similar
         workflow experiences. For MVP we query `AgentActionLog` directly with
         status filters; once `AgentActionLog` rows are embedded (PROJ-15
         follow-up) this falls back to vector similarity. (AC-29)
Layer 4: WorkspaceMemory verbatim — Metis-style consolidated workspace
         memory. Hard char-limit enforced at write time. (AC-66, AC-74)
Layer 5: UserProfile verbatim — dialectic-built per-user profile in this
         workspace. (AC-67, AC-74)
Layer 6: Skills top-K via skill_manager.find_relevant_skills. (AC-68, AC-74)

Total budget cap 12k tokens (~48000 chars). Truncation order on overflow
(AC-74): Skills first, then Layer 3, then Layer 2. **Never** truncate
Layer 1 (system prompt), Layer 4 (workspace memory), or Layer 5 (user
profile) — those are load-bearing for personality + emergent prioritization.

`build_agent_context()` returns the merged 6-layer context dict and is
called by `agents.sub_agent_base.build_sub_agent` to prepend Layers 2–6
to Layer 1 before each sub-agent run (AC-30).
"""

from __future__ import annotations

import logging
from typing import Any

from agent_app.models import (
    ActionStatus,
    AgentActionLog,
    AgentConfig,
    KnowledgeDoc,
)

logger = logging.getLogger(__name__)

# ── Tuning ───────────────────────────────────────────────────────────────
KNOWLEDGE_DOC_TOP_K = 5
IMPLICIT_TOP_K = 5
SKILL_TOP_K = 3
# AC-74 — total context budget 12k tokens (~48000 chars rough estimate).
TOTAL_CHAR_BUDGET = 48000
# Content-type label used by `vector_app.services.EmbeddingService` for
# `agent_app.KnowledgeDoc` (see `EMBEDDABLE_MODELS` in vector_app/services.py).
KNOWLEDGE_DOC_LABEL = 'knowledge_doc'


def load_system_prompt(workspace, agent_type: str) -> str:
    """Layer 1: System prompt from AgentConfig with personality injection."""
    try:
        config = AgentConfig.objects.get(workspace=workspace, agent_type=agent_type)
    except AgentConfig.DoesNotExist:
        logger.debug(
            "knowledge_loader: no AgentConfig for ws=%s type=%s",
            getattr(workspace, 'pk', workspace), agent_type,
        )
        return ''

    parts: list[str] = []
    if config.display_name or config.personality:
        header = f"Your name is {config.display_name}." if config.display_name else ''
        if config.personality:
            header = (header + ' ' if header else '') + config.personality
        if header:
            parts.append(header)

    if config.system_prompt:
        parts.append(config.system_prompt)

    return '\n\n'.join(parts)


def _vector_search(workspace, query: str, content_types: list[str], limit: int):
    """Internal helper: returns a list of result dicts or empty list on failure.

    Hybrid search is workspace-scoped (PROJ-15 enforces strict isolation).
    """
    if not query or not query.strip():
        return []
    try:
        from vector_app.services import EmbeddingService
    except ImportError:
        logger.debug("vector_app not available, skipping vector search")
        return []

    try:
        service = EmbeddingService()
        return service.search(
            query=query,
            workspace_id=workspace.pk if hasattr(workspace, 'pk') else workspace,
            content_types=content_types,
            top_k=limit,
        ) or []
    except Exception as exc:  # pragma: no cover — network/service errors
        logger.warning("knowledge_loader vector search failed: %s", exc)
        return []


def load_knowledge_docs(workspace, query_text: str = '', limit: int = KNOWLEDGE_DOC_TOP_K) -> list[dict[str, Any]]:
    """Layer 2: Top-N KnowledgeDocs by relevance.

    With query_text → hybrid vector + full-text search via PROJ-15.
    Without query_text → most recently updated docs (deterministic fallback).
    """
    results = _vector_search(workspace, query_text, [KNOWLEDGE_DOC_LABEL], limit)
    if results:
        doc_ids = [r['object_id'] for r in results]
        # Preserve search order
        docs = list(
            KnowledgeDoc.objects.filter(id__in=doc_ids, workspace=workspace)
        )
        by_id = {str(d.id): d for d in docs}
        ordered = [by_id[str(rid)] for rid in doc_ids if str(rid) in by_id]
        return [
            {'title': d.title, 'content': d.content, 'id': str(d.id)}
            for d in ordered
        ]

    # Fallback: most recently updated docs in this workspace.
    docs = KnowledgeDoc.objects.filter(workspace=workspace).order_by('-updated_at')[:limit]
    return [
        {'title': d.title, 'content': d.content, 'id': str(d.id)}
        for d in docs
    ]


def load_implicit_knowledge(workspace, query_text: str = '', limit: int = IMPLICIT_TOP_K) -> list[dict[str, Any]]:
    """Layer 3: Past agent decisions and outcomes (AC-29).

    MVP strategy: query `AgentActionLog` directly, filtered by terminal
    statuses (approved/rejected/completed/failed) and substring match on
    `action`. Vector embeddings of action logs are a PROJ-15 follow-up.
    """
    qs = AgentActionLog.objects.filter(
        workspace=workspace,
        status__in=[
            ActionStatus.APPROVED,
            ActionStatus.REJECTED,
            ActionStatus.COMPLETED,
            ActionStatus.FAILED,
        ],
    )

    if query_text and query_text.strip():
        # Cheap substring filter — surface relevant past actions.
        qs = qs.filter(action__icontains=query_text.strip()[:50])

    qs = qs.order_by('-created_at')[:limit]
    return [
        {
            'id': str(log.id),
            'agent_type': log.agent_type,
            'action': log.action,
            'status': log.status,
            'target_object_type': log.target_object_type,
            'target_object_id': str(log.target_object_id) if log.target_object_id else None,
            'created_at': log.created_at.isoformat(),
        }
        for log in qs
    ]


def load_workspace_memory(workspace) -> str:
    """Layer 4 (AC-74) — verbatim workspace memory content.

    Returns empty string when no memory row exists yet (EC-23: graceful
    absence — fresh workspaces operate without the new layers).
    """
    try:
        from agent_app.models import WorkspaceMemory
        mem = WorkspaceMemory.objects.filter(workspace=workspace).first()
        if not mem:
            return ''
        return mem.content_md or ''
    except Exception as exc:  # pragma: no cover — defensive
        logger.warning('load_workspace_memory failed: %s', exc)
        return ''


def load_user_profile(workspace, user) -> str:
    """Layer 5 (AC-74) — verbatim user profile content.

    Returns empty string when no profile row exists yet (EC-23).
    Called with the calling user; when ``user`` is None we skip Layer 5.
    """
    if user is None:
        return ''
    try:
        from agent_app.models import UserProfile
        profile = UserProfile.objects.filter(workspace=workspace, user=user).first()
        if not profile:
            return ''
        return profile.content_md or ''
    except Exception as exc:  # pragma: no cover — defensive
        logger.warning('load_user_profile failed: %s', exc)
        return ''


def load_skills(workspace, agent_type: str, query_text: str = '',
                limit: int = SKILL_TOP_K) -> list[dict[str, Any]]:
    """Layer 6 (AC-74) — top-K skills via skill_manager.

    Calls the workspace-scoped, soft-delete-aware ``find_relevant_skills``
    so we never surface deleted skills (EC-22).
    """
    try:
        from agent_app.services.skill_manager import find_relevant_skills
        return find_relevant_skills(
            workspace=workspace,
            agent_type=agent_type,
            task_description=query_text or '',
            k=limit,
        ) or []
    except Exception as exc:  # pragma: no cover — defensive
        logger.warning('load_skills failed: %s', exc)
        return []


def build_agent_context(
    workspace,
    agent_type: str,
    query_text: str = '',
    *,
    user=None,
) -> dict[str, Any]:
    """Build full 6-layer context for a sub-agent (AC-30 + AC-74).

    Args:
        workspace: Workspace instance.
        agent_type: One of ``AgentType.values``.
        query_text: Optional task hint used to bias retrieval layers.
        user: Optional User instance — required for Layer 5 (UserProfile).
            Pass ``None`` for orchestrator-level builds where no
            user-scoped profile is loaded.

    Returns:
        dict with keys ``system_prompt``, ``knowledge_docs``,
        ``implicit_knowledge``, ``workspace_memory``, ``user_profile``,
        ``skills``.
    """
    return {
        'system_prompt': load_system_prompt(workspace, agent_type),
        'knowledge_docs': load_knowledge_docs(workspace, query_text),
        'implicit_knowledge': load_implicit_knowledge(workspace, query_text),
        'workspace_memory': load_workspace_memory(workspace),
        'user_profile': load_user_profile(workspace, user),
        'skills': load_skills(workspace, agent_type, query_text),
    }


def _render_layer_2(docs: list[dict[str, Any]]) -> str:
    if not docs:
        return ''
    rendered = ['## Workspace Knowledge (Layer 2)']
    for d in docs:
        title = d.get('title') or '(untitled)'
        content = (d.get('content') or '')[:1500]
        rendered.append(f"### {title}\n{content}")
    return '\n\n'.join(rendered)


def _render_layer_3(implicit: list[dict[str, Any]]) -> str:
    if not implicit:
        return ''
    rendered = ['## Past Decisions (Layer 3)']
    for log in implicit:
        line = (
            f"- {log.get('agent_type', '?')}.{log.get('action', '?')}"
            f" → {log.get('status', '?')}"
        )
        if log.get('target_object_type'):
            line += f" (target={log.get('target_object_type')})"
        rendered.append(line)
    return '\n'.join(rendered)


def _render_layer_4(memory_md: str) -> str:
    if not memory_md or not memory_md.strip():
        return ''
    return f"## Workspace Memory (Layer 4)\n{memory_md.strip()}"


def _render_layer_5(profile_md: str) -> str:
    if not profile_md or not profile_md.strip():
        return ''
    return f"## User Profile (Layer 5)\n{profile_md.strip()}"


def _render_layer_6(skills: list[dict[str, Any]]) -> str:
    if not skills:
        return ''
    rendered = ['## Skills (Layer 6)']
    for s in skills:
        name = s.get('name') or '(untitled)'
        content = s.get('content_md') or ''
        rendered.append(f"### {name}\n{content}")
    return '\n\n'.join(rendered)


def _truncate_to_budget(parts: list[str], budget: int) -> list[str]:
    """AC-74 budget enforcement.

    ``parts`` order is [L1, L2, L3, L4, L5, L6]. Truncate Layer 6 first,
    then Layer 3, then Layer 2. Never touch Layer 1 / 4 / 5.
    """
    total = sum(len(p) for p in parts)
    if total <= budget:
        return parts

    drop_order = [5, 2, 1]
    out = list(parts)
    for idx in drop_order:
        if 0 <= idx < len(out) and out[idx]:
            out[idx] = ''
            total = sum(len(p) for p in out)
            if total <= budget:
                return out
    return out


def render_context_as_prompt(context: dict[str, Any]) -> str:
    """Format a context dict as a single system-prompt string.

    Used by ``build_sub_agent`` to prepend Layers 2-6 to Layer 1 before
    constructing the sub-agent graph (AC-30 + AC-74). Truncation keeps
    total length under ``TOTAL_CHAR_BUDGET`` per the precedence rules in
    ``_truncate_to_budget``.
    """
    layer_1 = context.get('system_prompt') or ''
    layer_2 = _render_layer_2(context.get('knowledge_docs') or [])
    layer_3 = _render_layer_3(context.get('implicit_knowledge') or [])
    layer_4 = _render_layer_4(context.get('workspace_memory') or '')
    layer_5 = _render_layer_5(context.get('user_profile') or '')
    layer_6 = _render_layer_6(context.get('skills') or [])

    parts = _truncate_to_budget(
        [layer_1, layer_2, layer_3, layer_4, layer_5, layer_6],
        TOTAL_CHAR_BUDGET,
    )
    return '\n\n'.join(p for p in parts if p)


__all__ = [
    'build_agent_context',
    'load_system_prompt',
    'load_knowledge_docs',
    'load_implicit_knowledge',
    'load_workspace_memory',
    'load_user_profile',
    'load_skills',
    'render_context_as_prompt',
    'KNOWLEDGE_DOC_TOP_K',
    'IMPLICIT_TOP_K',
    'SKILL_TOP_K',
    'TOTAL_CHAR_BUDGET',
]
