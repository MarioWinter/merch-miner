"""Node: keywords - generate keyword recommendations from niche analysis."""

import logging

from asgiref.sync import sync_to_async
from langchain_core.messages import HumanMessage, SystemMessage

from niche_research_app.graph.llm import get_llm_for_node
from niche_research_app.graph.progress import get_completed_nodes, update_node_progress
from niche_research_app.graph.prompts import DEFAULT_KEYWORDS_USER_TEMPLATE
from niche_research_app.graph.resume import load_keywords_result_from_db
from niche_research_app.graph.schemas import NicheKeywordSchema
from niche_research_app.graph.state import ResearchState

logger = logging.getLogger(__name__)


@update_node_progress('keywords')
async def keywords_node(state: ResearchState) -> dict:
    """Generate keyword recommendations based on niche analysis."""
    from scraper_app.models import Keyword, ProductSearchCache, SearchKeywordResult

    from niche_research_app.models import NicheKeywordAnalysis, NicheResearch

    research_id = state['research_id']

    # Skip guard
    completed = await get_completed_nodes(research_id)
    if 'keywords' in completed:
        logger.info("Skipping keywords node, already completed")
        keywords_result = await load_keywords_result_from_db(research_id)
        return {'keywords_result': keywords_result}
    niche_name = state['niche_name']
    marketplace = state.get('marketplace', 'amazon_com')
    analysis_result = state.get('analysis_result', {})
    vision_analyses = state.get('vision_analyses', [])

    llm, system_prompt = await sync_to_async(get_llm_for_node)('keywords')
    structured_llm = llm.with_structured_output(NicheKeywordSchema)

    # Collect product titles
    product_titles = "\n".join(
        f"- {v.get('title', '')}" for v in vision_analyses if v.get('title')
    )

    # Load seed keywords from SearchKeywordResult if available
    @sync_to_async
    def _load_seed_keywords():
        try:
            keyword_obj = Keyword.objects.get(
                keyword=niche_name, marketplace=marketplace,
            )
            cache = ProductSearchCache.objects.filter(
                keyword=keyword_obj,
                status=ProductSearchCache.Status.COMPLETED,
            ).order_by('-last_scraped_at').first()
            if cache:
                try:
                    skr = SearchKeywordResult.objects.get(search_cache=cache)
                    def _kw_to_str(kw):
                        if isinstance(kw, dict):
                            return kw.get('keyword', kw.get('name', str(kw)))
                        return str(kw)

                    seed_parts = []
                    if skr.top_focus_keywords:
                        seed_parts.append(
                            f"Focus keywords: {', '.join(_kw_to_str(k) for k in skr.top_focus_keywords)}"
                        )
                    if skr.top_long_tail_keywords:
                        seed_parts.append(
                            f"Long-tail: {', '.join(_kw_to_str(k) for k in skr.top_long_tail_keywords)}"
                        )
                    if skr.all_keywords_flat:
                        seed_parts.append(f"All: {skr.all_keywords_flat[:500]}")
                    return "\n".join(seed_parts)
                except SearchKeywordResult.DoesNotExist:
                    pass
        except Keyword.DoesNotExist:
            pass
        return "(no seed keywords available)"

    seed_keywords = await _load_seed_keywords()

    niche_summary = analysis_result.get('niche_summary', niche_name)

    user_text = DEFAULT_KEYWORDS_USER_TEMPLATE.format(
        niche_name=niche_name,
        product_titles=product_titles,
        niche_summary=niche_summary,
        seed_keywords=seed_keywords,
    )

    result = await structured_llm.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_text),
    ])

    # Save to DB
    @sync_to_async
    def _save_keywords():
        research = NicheResearch.objects.select_related('niche').get(id=research_id)
        NicheKeywordAnalysis.objects.create(
            research=research,
            niche=research.niche,
            main_short_tail=result.main_short_tail,
            main_long_tail=result.main_long_tail,
            all_keywords_flat=result.all_keywords_flat,
            top_focus_keywords=result.top_focus_keywords,
            top_long_tail_keywords=result.top_long_tail_keywords,
        )

    await _save_keywords()

    logger.info("Keywords node complete for '%s'", niche_name)

    return {'keywords_result': result.model_dump()}
