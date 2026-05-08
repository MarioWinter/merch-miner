"""LangGraph StateGraph assembly for niche research workflow."""

import logging

from asgiref.sync import sync_to_async
from django.utils import timezone
from langgraph.graph import END, StateGraph

from niche_research_app.graph.nodes.emotional_analyze import emotional_analyze_node
from niche_research_app.graph.nodes.keywords import keywords_node
from niche_research_app.graph.nodes.niche_profile import niche_profile_node
from niche_research_app.graph.nodes.scrape import scrape_node
from niche_research_app.graph.nodes.vision_analyze import vision_analyze_node
from niche_research_app.graph.progress import get_completed_nodes, update_node_progress
from niche_research_app.graph.state import ResearchState

logger = logging.getLogger(__name__)


@update_node_progress('finalize')
async def finalize_node(state: ResearchState) -> dict:
    """Mark research as completed, update Niche status."""
    from niche_app.models import Niche

    from niche_research_app.models import NicheResearch

    research_id = state['research_id']

    # Skip guard
    completed = await get_completed_nodes(research_id)
    if 'finalize' in completed:
        logger.info("Skipping finalize node, already completed")
        return {}

    @sync_to_async
    def _finalize():
        research = NicheResearch.objects.select_related('niche').get(id=research_id)
        research.status = NicheResearch.Status.COMPLETED
        research.completed_at = timezone.now()
        research.save(update_fields=['status', 'completed_at'])

        niche = research.niche
        niche.status = Niche.Status.DEEP_RESEARCH
        niche.research_status = Niche.ResearchStatus.DONE
        niche.research_run_id = research.id
        niche.save(update_fields=['status', 'research_status', 'research_run_id'])
        return niche.name

    niche_name = await _finalize()
    logger.info("Research %s finalized for niche '%s'", research_id, niche_name)

    return {}


def build_research_graph() -> StateGraph:
    """Build and return the (uncompiled) research StateGraph."""
    graph = StateGraph(ResearchState)

    graph.add_node("scrape", scrape_node)
    graph.add_node("vision_analyze", vision_analyze_node)
    graph.add_node("emotional_analyze", emotional_analyze_node)
    graph.add_node("niche_profile", niche_profile_node)
    graph.add_node("keywords", keywords_node)
    graph.add_node("finalize", finalize_node)

    graph.set_entry_point("scrape")
    graph.add_edge("scrape", "vision_analyze")
    graph.add_edge("vision_analyze", "emotional_analyze")
    graph.add_edge("emotional_analyze", "niche_profile")
    graph.add_edge("niche_profile", "keywords")
    graph.add_edge("keywords", "finalize")
    graph.add_edge("finalize", END)

    return graph


async def compile_and_run(
    research_id: str,
    niche_name: str,
    marketplace: str,
    product_type: str = 't_shirt',
    product_limit: int = 50,
    retry_count: int = 0,
    checkpointer=None,
    callbacks=None,
):
    """Compile graph and invoke it."""
    graph = build_research_graph()

    compile_kwargs = {}
    if checkpointer:
        compile_kwargs['checkpointer'] = checkpointer

    # Add retry policy on LLM nodes
    try:
        from langgraph.pregel import RetryPolicy

        retry = RetryPolicy(max_attempts=3)
        compile_kwargs['retry_policy'] = retry
    except ImportError:
        logger.warning("RetryPolicy not available in this langgraph version")

    compiled = graph.compile(**compile_kwargs)

    config = {}
    if checkpointer:
        thread_id = f"{research_id}__attempt_{retry_count}"
        config['configurable'] = {'thread_id': thread_id}
    if callbacks:
        config['callbacks'] = callbacks

    initial_state = {
        'research_id': research_id,
        'niche_name': niche_name,
        'marketplace': marketplace,
        'product_type': product_type,
        'product_limit': product_limit,
    }

    result = await compiled.ainvoke(initial_state, config=config)
    return result
