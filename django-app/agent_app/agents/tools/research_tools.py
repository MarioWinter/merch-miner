"""Research Agent tools (AC-12).

8 tools for niche + Amazon product research. Wraps existing infrastructure
in `niche_app`, `niche_research_app`, `scraper_app`, `vector_app`.

Each tool:
- Decorated with LangChain `@tool` for ReAct agent integration
- Wrapped with `@permission_check('<name>')` so Phase 4 can plug gating in
- Resolves workspace from `config['configurable']` (LangGraph runtime ctx)
- Returns plain dicts/strings (LLM-friendly) — never ORM objects

Permissions (per AC-19 / DEFAULT_TOOL_PERMISSIONS):
- read_*  / find_*  → auto
- create_* / update_* → notify
- trigger_* (cost LLM/scraper credits) → approve
"""

from __future__ import annotations

from typing import Any, Optional

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool

from agent_app.services.permission_decorator import permission_check


# ── Helpers ──

def _get_workspace_id(config: Optional[RunnableConfig]) -> str:
    """Extract workspace_id from LangGraph runtime config.

    LangGraph passes a RunnableConfig dict — sub-agent graphs put workspace_id
    + user_id + session_id under `config['configurable']`. RunnableConfig is
    auto-injected by LangChain when a tool param is type-hinted with it; the
    LLM never sees this param in the tool's args schema.
    """
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
@permission_check('create_niche')
def create_niche(
    name: str,
    notes: str = '',
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Create a new niche in the current workspace.

    Args:
        name: Display name for the niche (max 200 chars).
        notes: Optional free-form notes.

    Returns:
        {niche_id, name, status} of the created niche.
    """
    from niche_app.models import Niche

    workspace_id = _get_workspace_id(config)
    user_id = _get_user_id(config)

    niche = Niche.objects.create(
        workspace_id=workspace_id,
        created_by_id=user_id,
        name=name[:200],
        notes=notes,
        status=Niche.Status.DATA_ENTRY,
    )
    return {
        'niche_id': str(niche.id),
        'name': niche.name,
        'status': niche.status,
    }


@tool
@permission_check('update_niche_status')
def update_niche_status(
    niche_id: str,
    status: str,
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Update a niche's lifecycle status (e.g. 'to_designer', 'upload', 'winner').

    Args:
        niche_id: UUID of the niche.
        status: One of Niche.Status choices.
    """
    from niche_app.models import Niche

    workspace_id = _get_workspace_id(config)
    valid = {c[0] for c in Niche.Status.choices}
    if status not in valid:
        return {'error': f'Invalid status. Allowed: {sorted(valid)}'}

    try:
        niche = Niche.objects.get(id=niche_id, workspace_id=workspace_id)
    except Niche.DoesNotExist:
        return {'error': f'Niche {niche_id} not found in workspace.'}

    niche.status = status
    niche.save(update_fields=['status', 'updated_at'])
    return {'niche_id': str(niche.id), 'status': niche.status}


@tool
@permission_check('read_niche_details')
def read_niche_details(
    niche_id: str,
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Read full niche details including latest research analysis.

    Returns: {id, name, status, notes, latest_research_summary?, keyword_count}.
    """
    from niche_app.models import Niche
    from niche_research_app.models import NicheAnalysis

    workspace_id = _get_workspace_id(config)
    try:
        niche = Niche.objects.get(id=niche_id, workspace_id=workspace_id)
    except Niche.DoesNotExist:
        return {'error': f'Niche {niche_id} not found.'}

    analysis = (
        NicheAnalysis.objects
        .filter(niche=niche, research__status='completed')
        .order_by('-created_at')
        .first()
    )
    return {
        'id': str(niche.id),
        'name': niche.name,
        'status': niche.status,
        'notes': niche.notes,
        'potential_rating': niche.potential_rating,
        'research_status': niche.research_status,
        'current_round': niche.current_round,
        'latest_research_summary': (
            (analysis.niche_summary[:500] if analysis else '') or ''
        ),
        'keyword_count': niche.niche_keywords.count(),
    }


@tool
@permission_check('trigger_deep_research')
def trigger_deep_research(
    niche_id: str,
    marketplace: str = 'amazon_com',
    product_type: str = 't_shirt',
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Kick off a LangGraph deep research run for a niche (PROJ-6).

    Costs API credits. Returns research_id; poll status via read_research_results.

    Args:
        niche_id: Target niche UUID.
        marketplace: e.g. 'amazon_com', 'amazon_de'.
        product_type: e.g. 't_shirt', 'hoodie'.
    """
    import django_rq

    from niche_app.models import Niche
    from niche_research_app.models import NicheResearch
    from niche_research_app.tasks import run_niche_research

    workspace_id = _get_workspace_id(config)
    user_id = _get_user_id(config)
    try:
        niche = Niche.objects.get(id=niche_id, workspace_id=workspace_id)
    except Niche.DoesNotExist:
        return {'error': f'Niche {niche_id} not found.'}

    research = NicheResearch.objects.create(
        niche=niche,
        triggered_by_id=user_id,
        marketplace=marketplace,
        product_type=product_type,
        status=NicheResearch.Status.PENDING,
    )
    queue = django_rq.get_queue('research')
    job = queue.enqueue(run_niche_research, str(research.id))
    research.rq_job_id = job.id if job else ''
    research.save(update_fields=['rq_job_id'])

    niche.research_status = Niche.ResearchStatus.RUNNING
    niche.research_run_id = research.id
    niche.save(update_fields=['research_status', 'research_run_id'])

    return {
        'research_id': str(research.id),
        'status': research.status,
        'rq_job_id': research.rq_job_id,
    }


@tool
@permission_check('read_research_results')
def read_research_results(
    research_id: str,
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Read deep-research run results (status, completed_nodes, latest analysis)."""
    from niche_research_app.models import NicheAnalysis, NicheResearch

    workspace_id = _get_workspace_id(config)
    try:
        research = (
            NicheResearch.objects
            .select_related('niche')
            .get(id=research_id, niche__workspace_id=workspace_id)
        )
    except NicheResearch.DoesNotExist:
        return {'error': f'Research {research_id} not found.'}

    analysis = (
        NicheAnalysis.objects
        .filter(research=research)
        .order_by('-created_at')
        .first()
    )
    return {
        'research_id': str(research.id),
        'niche_id': str(research.niche_id),
        'status': research.status,
        'current_node': research.current_node,
        'completed_nodes': research.completed_nodes,
        'error_message': research.error_message,
        'analysis': (
            {
                'niche_summary': analysis.niche_summary,
                'sentiment': analysis.sentiment,
                'primary_emotions': analysis.primary_emotions,
                'emotional_archetype': analysis.emotional_archetype,
                'design_concepts': analysis.design_concepts,
            }
            if analysis else None
        ),
    }


@tool
@permission_check('trigger_product_research')
def trigger_product_research(
    keyword: str,
    marketplace: str = 'amazon_com',
    product_type_filter: str = 't_shirt',
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Trigger an Amazon product scrape for a keyword (PROJ-7/PROJ-16).

    Costs ScraperOps credits. Returns scrape_job_id.
    """
    import django_rq

    from scraper_app.models import ScrapeJob
    from scraper_app.tasks import scrape_keyword_job

    _ = _get_workspace_id(config)
    job_record = ScrapeJob.objects.create(
        mode=ScrapeJob.Mode.LIVE,
        status=ScrapeJob.Status.PENDING,
    )
    queue = django_rq.get_queue('default')
    rq_job = queue.enqueue(
        scrape_keyword_job,
        keyword,
        marketplace,
        scrape_job_id=str(job_record.id),
        product_type_filter=product_type_filter,
    )
    return {
        'scrape_job_id': str(job_record.id),
        'rq_job_id': rq_job.id if rq_job else '',
        'status': job_record.status,
    }


@tool
@permission_check('read_product_results')
def read_product_results(
    scrape_job_id: str,
    limit: int = 20,
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Read scraped Amazon products from a scrape job.

    Returns top N products with title, brand, BSR, rating, reviews.
    """
    from scraper_app.models import ScrapeJob

    _ = _get_workspace_id(config)
    try:
        job = ScrapeJob.objects.get(id=scrape_job_id)
    except ScrapeJob.DoesNotExist:
        return {'error': f'ScrapeJob {scrape_job_id} not found.'}

    # ScrapeJob doesn't directly link products — products come via
    # ProductSearchCache + Keyword. For Phase 2 we expose status only and
    # leave the cache wiring to the live scraper service.
    # TODO(Phase 3): join ProductSearchCache → AmazonProduct via keyword.
    products: list[dict[str, Any]] = []
    return {
        'scrape_job_id': str(job.id),
        'status': job.status,
        'product_count': len(products),
        'products': products[:limit],
    }


@tool
@permission_check('find_similar_niches')
def find_similar_niches(
    query: str,
    top_k: int = 5,
    config: RunnableConfig = None,
) -> list[dict[str, Any]]:
    """Find niches in this workspace similar to the query via vector search (PROJ-15).

    Args:
        query: Free-text query (niche concept, theme, audience).
        top_k: Max results.
    """
    from vector_app.services import EmbeddingService

    workspace_id = _get_workspace_id(config)
    service = EmbeddingService()
    results = service.search(
        query=query,
        workspace_id=workspace_id,
        content_types=['niche'],
        top_k=top_k,
    )
    return [
        {
            'niche_id': r['object_id'],
            'score': r['score'],
            'preview': r['text_preview'],
            'metadata': r['metadata'],
        }
        for r in results
    ]


TOOLS = [
    create_niche,
    update_niche_status,
    read_niche_details,
    trigger_deep_research,
    read_research_results,
    trigger_product_research,
    read_product_results,
    find_similar_niches,
]


__all__ = ['TOOLS', *(t.name for t in TOOLS)]
