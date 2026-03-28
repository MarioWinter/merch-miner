"""3-layer knowledge loading for agent context (AC-27/28/29/30)."""

import logging

from agent_app.models import AgentConfig, KnowledgeDoc

logger = logging.getLogger(__name__)


def load_system_prompt(workspace, agent_type):
    """Layer 1: Load system prompt from AgentConfig, injecting personality.

    Returns the full prompt string.
    """
    try:
        config = AgentConfig.objects.get(workspace=workspace, agent_type=agent_type)
    except AgentConfig.DoesNotExist:
        return ''

    parts = []

    # Inject personality header
    if config.display_name or config.personality:
        header = f"Your name is {config.display_name}."
        if config.personality:
            header += f" {config.personality}"
        parts.append(header)

    if config.system_prompt:
        parts.append(config.system_prompt)

    return '\n\n'.join(parts)


def load_knowledge_docs(workspace, query_text='', limit=5):
    """Layer 2: Load top-N relevant KnowledgeDocs.

    If vector_app is available and query_text is provided, uses semantic
    search. Otherwise falls back to most-recently-updated docs.
    """
    if query_text:
        try:
            from vector_app.services import semantic_search
            results = semantic_search(
                workspace_id=str(workspace.pk),
                query=query_text,
                content_types=['agent_app.KnowledgeDoc'],
                limit=limit,
            )
            if results:
                doc_ids = [r['object_id'] for r in results]
                docs = KnowledgeDoc.objects.filter(
                    id__in=doc_ids, workspace=workspace,
                )
                return [
                    {'title': d.title, 'content': d.content}
                    for d in docs
                ]
        except (ImportError, Exception):
            logger.debug("Vector search unavailable, falling back to recent docs")

    # Fallback: most recent docs
    docs = KnowledgeDoc.objects.filter(workspace=workspace).order_by('-updated_at')[:limit]
    return [{'title': d.title, 'content': d.content} for d in docs]


def load_implicit_knowledge(workspace, query_text='', limit=5):
    """Layer 3: Load past experiences (approvals/rejections) from Vector DB.

    Searches AgentActionLog embeddings for similar past decisions.
    """
    if not query_text:
        return []

    try:
        from vector_app.services import semantic_search
        results = semantic_search(
            workspace_id=str(workspace.pk),
            query=query_text,
            content_types=['agent_app.AgentActionLog'],
            limit=limit,
        )
        return results or []
    except (ImportError, Exception):
        logger.debug("Implicit knowledge search unavailable")
        return []


def build_agent_context(workspace, agent_type, query_text=''):
    """Build full 3-layer context for a sub-agent (AC-30).

    Returns dict with system_prompt, knowledge_docs, implicit_knowledge.
    """
    return {
        'system_prompt': load_system_prompt(workspace, agent_type),
        'knowledge_docs': load_knowledge_docs(workspace, query_text),
        'implicit_knowledge': load_implicit_knowledge(workspace, query_text),
    }
