"""Node: emotional_analyze - parallel emotional LLM analysis of filtered products."""

import asyncio
import logging

from asgiref.sync import sync_to_async
from langchain_core.messages import HumanMessage, SystemMessage

from niche_research_app.graph.llm import get_llm_for_node
from niche_research_app.graph.progress import get_completed_nodes, update_node_progress
from niche_research_app.graph.prompts import DEFAULT_EMOTIONAL_USER_TEMPLATE
from niche_research_app.graph.resume import load_emotional_analyses_from_db
from niche_research_app.graph.schemas import SloganEmotionalAnalysisSchema
from niche_research_app.graph.state import ResearchState

logger = logging.getLogger(__name__)

MAX_CONCURRENT = 10


@update_node_progress('emotional_analyze')
async def emotional_analyze_node(state: ResearchState) -> dict:
    """Run emotional analysis on filtered products in parallel."""
    from scraper_app.models import AmazonProduct

    from niche_research_app.models import NicheProductEmotionalAnalysis, NicheResearch

    research_id = state['research_id']

    # Skip guard
    completed = await get_completed_nodes(research_id)
    if 'emotional_analyze' in completed:
        logger.info("Skipping emotional_analyze node, already completed")
        emotional_analyses = await load_emotional_analyses_from_db(research_id)
        return {'emotional_analyses': emotional_analyses}
    niche_name = state['niche_name']
    vision_analyses = state['vision_analyses']

    llm, system_prompt = await sync_to_async(get_llm_for_node)('emotional_analyze')
    structured_llm = llm.with_structured_output(SloganEmotionalAnalysisSchema)

    semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    async def analyze_product(vision_data: dict):
        async with semaphore:
            try:
                user_text = DEFAULT_EMOTIONAL_USER_TEMPLATE.format(
                    niche_name=niche_name,
                    title=vision_data.get('title', ''),
                    brand=vision_data.get('brand', ''),
                    slogan_text=vision_data.get('slogan_text', ''),
                    meaning_context=vision_data.get('meaning_context', ''),
                    visual_style=vision_data.get('visual_style', ''),
                    graphic_elements=vision_data.get('graphic_elements', ''),
                    layout_composition=vision_data.get('layout_composition', ''),
                )

                messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_text),
                ]

                result = await structured_llm.ainvoke(messages)
                return (vision_data, result)
            except Exception:
                logger.exception(
                    "Emotional analysis failed for %s",
                    vision_data.get('asin', 'unknown'),
                )
                return None

    tasks = [analyze_product(v) for v in vision_analyses]
    raw_results = await asyncio.gather(*tasks)

    # Save results to DB
    research = await sync_to_async(NicheResearch.objects.get)(id=research_id)
    emotional_records = []
    emotional_analyses = []

    for item in raw_results:
        if item is None:
            continue

        vision_data, analysis = item
        asin = vision_data.get('asin', '')

        # Get product reference
        try:
            product = await sync_to_async(AmazonProduct.objects.get)(asin=asin)
        except AmazonProduct.DoesNotExist:
            logger.warning("Product %s not found, skipping emotional save", asin)
            continue

        record = NicheProductEmotionalAnalysis(
            research=research,
            product=product,
            original_slogan=analysis.original_slogan,
            customer_psychology=analysis.customer_psychology.model_dump(),
            sentiment_analysis=analysis.sentiment_analysis.model_dump(),
            emotional_pattern=analysis.emotional_pattern,
            vibe=analysis.vibe.model_dump(),
            semantic_structure=analysis.semantic_structure.model_dump(),
            key_elements=analysis.key_elements,
            tone=analysis.tone,
            adaptation_formula=analysis.adaptation_formula,
            adaptation_examples=analysis.adaptation_examples,
            transferability_notes=analysis.transferability_notes.model_dump(),
        )
        emotional_records.append(record)

        # Aggregate for state
        emotional_analyses.append({
            'asin': asin,
            'title': vision_data.get('title', ''),
            'brand': vision_data.get('brand', ''),
            'slogan_text': vision_data.get('slogan_text', ''),
            'original_slogan': analysis.original_slogan,
            'customer_psychology': analysis.customer_psychology.model_dump(),
            'sentiment_analysis': analysis.sentiment_analysis.model_dump(),
            'emotional_pattern': analysis.emotional_pattern,
            'vibe': analysis.vibe.model_dump(),
            'semantic_structure': analysis.semantic_structure.model_dump(),
            'key_elements': analysis.key_elements,
            'tone': analysis.tone,
            'adaptation_formula': analysis.adaptation_formula,
            'adaptation_examples': analysis.adaptation_examples,
            'transferability_notes': analysis.transferability_notes.model_dump(),
        })

    await sync_to_async(NicheProductEmotionalAnalysis.objects.bulk_create)(
        emotional_records,
    )

    logger.info(
        "Emotional node: %d analyses saved for '%s'",
        len(emotional_analyses), niche_name,
    )

    return {'emotional_analyses': emotional_analyses}
