"""Ideation Agent tools (AC-13).

7 tools for slogan/idea creation, AI adaptation, keyword bank ops, vector
similarity search.

Wraps `idea_app` (Idea, IdeaAdaptationRun) + `keyword_app` (NicheKeyword).
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
@permission_check('create_manual_idea')
def create_manual_idea(
    slogan_text: str,
    niche_id: Optional[str] = None,
    why_it_works: str = '',
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Create a new manual slogan/idea, optionally linked to a niche.

    Args:
        slogan_text: The slogan / phrase / concept.
        niche_id: Optional niche to link.
        why_it_works: Optional rationale text.
    """
    from idea_app.models import Idea

    workspace_id = _get_workspace_id(config)
    user_id = _get_user_id(config)

    idea = Idea.objects.create(
        workspace_id=workspace_id,
        niche_id=niche_id,
        slogan_text=slogan_text,
        is_manual=True,
        why_it_works=why_it_works,
        status=Idea.Status.PENDING,
        created_by_id=user_id,
    )
    return {
        'idea_id': str(idea.id),
        'slogan_text': idea.slogan_text,
        'status': idea.status,
        'niche_id': str(idea.niche_id) if idea.niche_id else None,
    }


@tool
@permission_check('trigger_slogan_adaptation')
def trigger_slogan_adaptation(
    source_idea_id: str,
    target_niche_ids: list[str],
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Trigger the slogan adaptation LangGraph (PROJ-8) on a source idea.

    Costs LLM credits. Adapts the source slogan to each target niche.
    """
    import django_rq

    from idea_app.models import Idea, IdeaAdaptationRun
    from idea_app.tasks import run_idea_adaptation

    workspace_id = _get_workspace_id(config)
    user_id = _get_user_id(config)
    try:
        source = Idea.objects.get(id=source_idea_id, workspace_id=workspace_id)
    except Idea.DoesNotExist:
        return {'error': f'Source idea {source_idea_id} not found.'}

    run = IdeaAdaptationRun.objects.create(
        workspace_id=workspace_id,
        source_idea=source,
        target_niche_ids=list(target_niche_ids),
        triggered_by_id=user_id,
        status=IdeaAdaptationRun.Status.PENDING,
    )
    queue = django_rq.get_queue('slogan')
    job = queue.enqueue(run_idea_adaptation, str(run.id))
    if job:
        run.rq_job_id = job.id
        run.save(update_fields=['rq_job_id'])

    return {
        'run_id': str(run.id),
        'status': run.status,
        'target_count': len(target_niche_ids),
    }


@tool
@permission_check('read_adaptation_results')
def read_adaptation_results(
    run_id: str,
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Read results of a slogan adaptation run (status, generated ideas)."""
    from idea_app.models import IdeaAdaptationRun

    workspace_id = _get_workspace_id(config)
    try:
        run = IdeaAdaptationRun.objects.get(
            id=run_id, workspace_id=workspace_id,
        )
    except IdeaAdaptationRun.DoesNotExist:
        return {'error': f'Run {run_id} not found.'}

    ideas = list(
        run.generated_ideas.values(
            'id', 'slogan_text', 'niche_id', 'status',
            'signal_type', 'market_confidence',
        )[:50]
    )
    for i in ideas:
        i['id'] = str(i['id'])
        if i.get('niche_id'):
            i['niche_id'] = str(i['niche_id'])

    return {
        'run_id': str(run.id),
        'status': run.status,
        'completed_nodes': run.completed_nodes,
        'current_node': run.current_node,
        'niche_results': run.niche_results,
        'ideas': ideas,
        'idea_count': len(ideas),
        'error_message': run.error_message,
    }


@tool
@permission_check('approve_reject_idea')
def approve_reject_idea(
    idea_id: str,
    approved: bool,
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Approve or reject an idea.

    Args:
        idea_id: Idea UUID.
        approved: True → APPROVED, False → REJECTED.
    """
    from idea_app.models import Idea

    workspace_id = _get_workspace_id(config)
    try:
        idea = Idea.objects.get(id=idea_id, workspace_id=workspace_id)
    except Idea.DoesNotExist:
        return {'error': f'Idea {idea_id} not found.'}

    idea.status = Idea.Status.APPROVED if approved else Idea.Status.REJECTED
    idea.save(update_fields=['status'])
    return {'idea_id': str(idea.id), 'status': idea.status}


@tool
@permission_check('read_keyword_bank')
def read_keyword_bank(
    niche_id: str,
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Read all keywords for a niche, grouped by source.

    Returns: {niche_id, keywords: [{keyword, source, group}], count}.
    """
    from keyword_app.models import NicheKeyword
    from niche_app.models import Niche

    workspace_id = _get_workspace_id(config)
    try:
        niche = Niche.objects.get(id=niche_id, workspace_id=workspace_id)
    except Niche.DoesNotExist:
        return {'error': f'Niche {niche_id} not found.'}

    keywords = list(
        NicheKeyword.objects
        .filter(niche=niche)
        .select_related('group')
        .values('id', 'keyword', 'source', 'group__name')[:500]
    )
    for k in keywords:
        k['id'] = str(k['id'])
        k['group'] = k.pop('group__name', None)

    return {
        'niche_id': str(niche.id),
        'count': len(keywords),
        'keywords': keywords,
    }


@tool
@permission_check('add_keyword')
def add_keyword(
    niche_id: str,
    keyword: str,
    source: str = 'manual',
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Add a keyword to a niche's keyword bank.

    Args:
        niche_id: Target niche.
        keyword: Keyword text (max 200 chars).
        source: One of NicheKeyword.Source choices (default 'manual').
    """
    from keyword_app.models import NicheKeyword
    from niche_app.models import Niche

    workspace_id = _get_workspace_id(config)
    user_id = _get_user_id(config)
    try:
        niche = Niche.objects.get(id=niche_id, workspace_id=workspace_id)
    except Niche.DoesNotExist:
        return {'error': f'Niche {niche_id} not found.'}

    valid_sources = {c[0] for c in NicheKeyword.Source.choices}
    if source not in valid_sources:
        source = NicheKeyword.Source.MANUAL

    obj, created = NicheKeyword.objects.get_or_create(
        niche=niche,
        keyword=keyword[:200],
        defaults={'source': source, 'created_by_id': user_id},
    )
    return {
        'keyword_id': str(obj.id),
        'keyword': obj.keyword,
        'source': obj.source,
        'created': created,
    }


@tool
@permission_check('find_similar_ideas')
def find_similar_ideas(
    query: str,
    top_k: int = 5,
    config: RunnableConfig = None,
) -> list[dict[str, Any]]:
    """Find ideas/slogans similar to query (vector search).

    Phase 2 note: Idea embeddings not yet enabled in EmbeddableModels (will
    be added with PROJ-15 expansion). For now this returns an empty list and
    a hint string until 'idea' is registered in vector_app.services.
    """
    from vector_app.services import EmbeddingService

    workspace_id = _get_workspace_id(config)
    service = EmbeddingService()
    results = service.search(
        query=query,
        workspace_id=workspace_id,
        # 'idea' not yet a registered EMBEDDABLE label — falls back to none.
        content_types=['idea'],
        top_k=top_k,
    )
    return [
        {
            'idea_id': r['object_id'],
            'score': r['score'],
            'preview': r['text_preview'],
            'metadata': r['metadata'],
        }
        for r in results
    ]


TOOLS = [
    create_manual_idea,
    trigger_slogan_adaptation,
    read_adaptation_results,
    approve_reject_idea,
    read_keyword_bank,
    add_keyword,
    find_similar_ideas,
]


__all__ = ['TOOLS', *(t.name for t in TOOLS)]
