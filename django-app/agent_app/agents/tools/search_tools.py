"""Search Agent tools (AC-17).

6 tools for semantic + web search, deep crawl, save-to-niche / knowledge.
Wraps `vector_app` (PROJ-15), `search_app` (PROJ-17 — Vane + Crawl4ai),
`niche_app.NicheNote`, `agent_app.KnowledgeDoc`.
"""

from __future__ import annotations

from typing import Any, Optional

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool

from agent_app.services.permission_decorator import permission_check


# ── Helpers ──

def _get_workspace_id(config: Optional[RunnableConfig]) -> str:
    if not config:
        raise ValueError('Tool requires LangGraph config with workspace context.')
    cfg = config.get('configurable') or {}
    workspace_id = cfg.get('workspace_id')
    if not workspace_id:
        raise ValueError('Missing workspace_id in tool config.')
    return str(workspace_id)


def _get_user_id(config: Optional[RunnableConfig]) -> Any:
    if not config:
        raise ValueError('Tool requires LangGraph config with user context.')
    cfg = config.get('configurable') or {}
    user_id = cfg.get('user_id')
    if not user_id:
        raise ValueError('Missing user_id in tool config.')
    return user_id


# ── Tools ──

@tool
@permission_check('semantic_search')
def semantic_search(
    query: str,
    content_types: Optional[list[str]] = None,
    top_k: int = 10,
    config: RunnableConfig = None,
) -> list[dict[str, Any]]:
    """Workspace-scoped semantic + full-text hybrid search (PROJ-15).

    Args:
        query: Search text.
        content_types: Optional filter (e.g. ['niche', 'amazon_product',
            'web_search', 'knowledge_doc']). None = all.
        top_k: Max results.
    """
    from vector_app.services import EmbeddingService

    workspace_id = _get_workspace_id(config)
    service = EmbeddingService()
    results = service.search(
        query=query,
        workspace_id=workspace_id,
        content_types=content_types,
        top_k=top_k,
    )
    return results


@tool
@permission_check('find_similar_content')
def find_similar_content(
    query: str,
    content_type: str,
    top_k: int = 5,
    config: RunnableConfig = None,
) -> list[dict[str, Any]]:
    """Find similar content within a single content_type (e.g. only ideas).

    Convenience wrapper around `semantic_search` with a single-type filter.
    """
    from vector_app.services import EmbeddingService

    workspace_id = _get_workspace_id(config)
    service = EmbeddingService()
    return service.search(
        query=query,
        workspace_id=workspace_id,
        content_types=[content_type],
        top_k=top_k,
    )


@tool
@permission_check('web_search')
def web_search(
    query: str,
    mode: str = 'balanced',
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Web search via Vane (Perplexica) — LLM-synthesized answer + citations.

    Args:
        query: Search question.
        mode: 'speed' | 'balanced' | 'quality'.
    """
    from search_app.services.vane_service import VaneService, VaneServiceError

    _ = _get_workspace_id(config)
    service = VaneService()
    try:
        result = service.search(query=query, mode=mode)  # type: ignore[attr-defined]
        return {'query': query, 'mode': mode, 'result': result}
    except VaneServiceError as exc:
        return {'error': str(exc)[:500]}
    except AttributeError:
        # If VaneService.search signature differs, raise a clean error.
        return {
            'error': (
                'VaneService.search not callable as web_search expected. '
                'Wire integration in Phase 3.'
            ),
        }


@tool
@permission_check('deep_crawl')
def deep_crawl(
    url: str,
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Deep-crawl a URL via Crawl4ai (PROJ-17). Returns crawl job id.

    Crawled content is stored in `WebSearchResult` and embedded in Vector DB
    on completion (search_app.signals).
    """
    import django_rq

    from search_app.models import WebSearchResult
    from search_app.tasks import execute_crawl

    workspace_id = _get_workspace_id(config)
    result = WebSearchResult.objects.create(
        workspace_id=workspace_id,
        url=url,
        crawl_status=WebSearchResult.CrawlStatus.PENDING,
    )
    queue = django_rq.get_queue('default')
    job = queue.enqueue(execute_crawl, str(result.id))
    return {
        'web_search_result_id': str(result.id),
        'rq_job_id': job.id if job else '',
        'status': result.crawl_status,
    }


@tool
@permission_check('save_to_niche')
def save_to_niche(
    niche_id: str,
    text: str,
    source_url: str = '',
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Save a research snippet/note to a niche (NicheNote).

    Args:
        niche_id: Target niche.
        text: Note text (markdown OK).
        source_url: Optional URL where the snippet came from.
    """
    from niche_app.models import Niche, NicheNote

    workspace_id = _get_workspace_id(config)
    user_id = _get_user_id(config)
    try:
        niche = Niche.objects.get(id=niche_id, workspace_id=workspace_id)
    except Niche.DoesNotExist:
        return {'error': f'Niche {niche_id} not found.'}

    note = NicheNote.objects.create(
        niche=niche,
        text=text,
        source_url=source_url or None,
        created_by_id=user_id,
    )
    return {
        'note_id': str(note.id),
        'niche_id': str(niche.id),
    }


@tool
@permission_check('save_knowledge')
def save_knowledge(
    title: str,
    content: str,
    source: str = 'chat_command',
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Save a knowledge document (Layer 2 Knowledge Doc — PROJ-18 AC-7).

    Auto-embedded in Vector DB via post_save signal.

    Args:
        title: Doc title.
        content: Markdown body.
        source: 'manual' | 'chat_command' | 'auto_extracted'.
    """
    from agent_app.models import KnowledgeDoc

    workspace_id = _get_workspace_id(config)
    user_id = _get_user_id(config)

    valid_sources = {c[0] for c in KnowledgeDoc.Source.choices}
    if source not in valid_sources:
        source = KnowledgeDoc.Source.CHAT_COMMAND

    doc = KnowledgeDoc.objects.create(
        workspace_id=workspace_id,
        created_by_id=user_id,
        title=title[:200],
        content=content,
        source=source,
    )
    return {
        'knowledge_doc_id': str(doc.id),
        'title': doc.title,
        'source': doc.source,
    }


TOOLS = [
    semantic_search,
    find_similar_content,
    web_search,
    deep_crawl,
    save_to_niche,
    save_knowledge,
]


__all__ = ['TOOLS', *(t.name for t in TOOLS)]
