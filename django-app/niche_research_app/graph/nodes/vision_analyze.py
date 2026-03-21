"""Node: vision_analyze - parallel vision LLM analysis of product thumbnails."""

import asyncio
import logging

from asgiref.sync import sync_to_async
from langchain_core.messages import HumanMessage, SystemMessage

from niche_research_app.graph.llm import get_llm_for_node
from niche_research_app.graph.progress import get_completed_nodes, update_node_progress
from niche_research_app.graph.prompts import DEFAULT_VISION_USER_TEMPLATE
from niche_research_app.graph.resume import load_vision_analyses_from_db
from niche_research_app.graph.schemas import VisionAnalysisSchema
from niche_research_app.graph.state import ResearchState

logger = logging.getLogger(__name__)

MAX_CONCURRENT = 10


@update_node_progress('vision_analyze')
async def vision_analyze_node(state: ResearchState) -> dict:
    """Analyze product thumbnails via vision LLM in parallel."""
    from scraper_app.models import AmazonProduct, Keyword

    from niche_research_app.models import NicheProductVisionAnalysis, NicheResearch

    research_id = state['research_id']

    # Skip guard
    completed = await get_completed_nodes(research_id)
    if 'vision_analyze' in completed:
        logger.info("Skipping vision_analyze node, already completed")
        vision_analyses = await load_vision_analyses_from_db(research_id)
        return {'vision_analyses': vision_analyses}
    niche_name = state['niche_name']
    marketplace = state.get('marketplace', 'amazon_com')
    product_asins = state['product_asins']

    llm, system_prompt = await sync_to_async(get_llm_for_node)('vision_analyze')
    structured_llm = llm.with_structured_output(VisionAnalysisSchema)

    # Load products
    keyword_obj = await sync_to_async(Keyword.objects.get)(
        keyword=niche_name, marketplace=marketplace,
    )

    @sync_to_async
    def _load_products():
        return list(
            AmazonProduct.objects.filter(
                asin__in=product_asins, keywords=keyword_obj,
            )
        )

    products = await _load_products()

    # Brand blacklist filter — remove trademarked brands before LLM calls
    from scraper_app.brand_filter import filter_products_by_brand, get_blacklisted_brands

    blacklist = await sync_to_async(get_blacklisted_brands)()
    products, blocked = filter_products_by_brand(products, blacklist)
    logger.info("Brand filter: %d blocked, %d allowed", len(blocked), len(products))

    # Save count on research record
    research_for_count = await sync_to_async(NicheResearch.objects.get)(id=research_id)
    research_for_count.brand_filtered_count = len(blocked)
    await sync_to_async(research_for_count.save)(update_fields=['brand_filtered_count'])

    semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    results = []

    async def analyze_product(product):
        async with semaphore:
            try:
                if not product.thumbnail_url:
                    logger.warning("No thumbnail for %s, skipping", product.asin)
                    return None

                user_text = DEFAULT_VISION_USER_TEMPLATE.format(
                    niche_name=niche_name,
                    brand=product.brand or 'Unknown',
                    title=product.title or 'Unknown',
                )

                messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=[
                        {"type": "text", "text": user_text},
                        {
                            "type": "image_url",
                            "image_url": {"url": product.thumbnail_url},
                        },
                    ]),
                ]

                result = await structured_llm.ainvoke(messages)
                return (product, result)
            except Exception:
                logger.exception(
                    "Vision analysis failed for %s", product.asin,
                )
                return None

    tasks = [analyze_product(p) for p in products]
    raw_results = await asyncio.gather(*tasks)

    # Save all results and filter
    research = await sync_to_async(NicheResearch.objects.get)(id=research_id)
    vision_records = []
    filtered_analyses = []

    for item in raw_results:
        if item is None:
            continue

        product, analysis = item

        # Save to DB (all results, including filtered-out)
        record = NicheProductVisionAnalysis(
            research=research,
            product=product,
            slogan_text=analysis.slogan_text,
            meaning_context=analysis.meaning_context,
            visual_style=analysis.visual_style,
            graphic_elements=analysis.graphic_elements,
            layout_composition=analysis.layout_composition,
            is_niche_match=analysis.is_niche_match,
        )
        vision_records.append(record)

        # Apply post-filter
        if not analysis.is_niche_match:
            continue
        if not analysis.slogan_text or not analysis.slogan_text.strip():
            continue

        words = analysis.slogan_text.strip().split()
        if len(words) <= 2:
            # Exception: "Squad"/"Crew" single-word slogans
            has_exception = any(
                w.lower() in ('squad', 'crew') for w in words
            )
            if not has_exception:
                continue

        filtered_analyses.append({
            'asin': product.asin,
            'title': product.title,
            'brand': product.brand,
            'thumbnail_url': product.thumbnail_url,
            'slogan_text': analysis.slogan_text,
            'meaning_context': analysis.meaning_context,
            'visual_style': analysis.visual_style,
            'graphic_elements': analysis.graphic_elements,
            'layout_composition': analysis.layout_composition,
        })

    # Bulk save
    await sync_to_async(NicheProductVisionAnalysis.objects.bulk_create)(
        vision_records,
    )

    if not filtered_analyses:
        raise RuntimeError(
            "No matching products found for this keyword."
        )

    logger.info(
        "Vision node: %d/%d products passed filter for '%s'",
        len(filtered_analyses), len(products), niche_name,
    )

    return {'vision_analyses': filtered_analyses}
