"""Node: scrape - triggers PROJ-16 scraper and polls for completion."""

import asyncio
import logging

from asgiref.sync import sync_to_async

from niche_research_app.graph.progress import get_completed_nodes, update_node_progress
from niche_research_app.graph.resume import load_product_asins_from_db
from niche_research_app.graph.state import ResearchState

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 5
MAX_POLL_SECONDS = 600  # 10 minutes


@update_node_progress('scrape')
async def scrape_node(state: ResearchState) -> dict:
    """Trigger Amazon search page scrape and poll until completion."""
    from niche_research_app.models import NicheResearch, NicheResearchProduct
    from scraper_app.models import (
        AmazonProduct,
        Keyword,
        ProductSearchCache,
        ScrapeJob,
        PRODUCT_TYPE_SPIDER_KWARGS,
    )
    from scraper_app.tasks import get_or_create_keyword_cache, scrape_search_page_job

    research_id = state['research_id']
    niche_name = state['niche_name']
    marketplace = state.get('marketplace', 'amazon_com')
    product_type = state.get('product_type', 't_shirt')

    # Skip guard: check DB for completed nodes
    completed = await get_completed_nodes(research_id)
    if 'scrape' in completed:
        logger.info("Skipping scrape node, already completed")
        product_asins = await load_product_asins_from_db(research_id)
        return {'product_asins': product_asins}

    # Update status to running
    await sync_to_async(
        NicheResearch.objects.filter(id=research_id).update
    )(status=NicheResearch.Status.RUNNING)

    # Check for existing cache or create new scrape job
    cache, is_new = await sync_to_async(get_or_create_keyword_cache)(
        niche_name, marketplace,
    )

    if cache and not is_new:
        # Fresh cache exists or pending job already running
        if cache.status == ProductSearchCache.Status.COMPLETED:
            logger.info("Using fresh cache for '%s'", niche_name)
        else:
            # Wait for pending job
            logger.info("Pending scrape for '%s', waiting...", niche_name)
            elapsed = 0
            while elapsed < MAX_POLL_SECONDS:
                await asyncio.sleep(POLL_INTERVAL_SECONDS)
                elapsed += POLL_INTERVAL_SECONDS
                await sync_to_async(cache.refresh_from_db)()
                if cache.status != ProductSearchCache.Status.PENDING:
                    break

            if cache.status == ProductSearchCache.Status.FAILED:
                raise RuntimeError(
                    f"Scrape failed for keyword '{niche_name}'"
                )
            if cache.status == ProductSearchCache.Status.PENDING:
                raise TimeoutError(
                    f"Scrape timed out after {MAX_POLL_SECONDS}s for '{niche_name}'"
                )
    else:
        # Need to trigger a new scrape
        keyword_obj, _ = await sync_to_async(Keyword.objects.get_or_create)(
            keyword=niche_name, marketplace=marketplace,
        )
        scrape_job = await sync_to_async(ScrapeJob.objects.create)(
            mode=ScrapeJob.Mode.SEARCH_PAGE_ONLY,
            keyword=keyword_obj,
            marketplace=marketplace,
            status=ScrapeJob.Status.PENDING,
            pages_total=2,
            product_type_filter=product_type,
        )
        cache = await sync_to_async(ProductSearchCache.objects.create)(
            keyword=keyword_obj,
            scrape_job=scrape_job,
            status=ProductSearchCache.Status.PENDING,
        )

        # Build spider kwargs for product type filter
        spider_kwargs = {}
        if product_type and product_type in PRODUCT_TYPE_SPIDER_KWARGS:
            spider_kwargs = PRODUCT_TYPE_SPIDER_KWARGS[product_type].copy()

        # Run scrape in thread pool (blocking subprocess)
        await sync_to_async(scrape_search_page_job)(
            keyword_str=niche_name,
            marketplace=marketplace,
            scrape_job_id=str(scrape_job.id),
            **spider_kwargs,
        )

        # Refresh cache status
        await sync_to_async(cache.refresh_from_db)()
        if cache.status == ProductSearchCache.Status.FAILED:
            raise RuntimeError(
                f"Scrape failed for keyword '{niche_name}'"
            )

        # Poll if still pending (shouldn't happen normally after sync scrape)
        elapsed = 0
        while cache.status == ProductSearchCache.Status.PENDING and elapsed < MAX_POLL_SECONDS:
            await asyncio.sleep(POLL_INTERVAL_SECONDS)
            elapsed += POLL_INTERVAL_SECONDS
            await sync_to_async(cache.refresh_from_db)()

    # Gather products
    keyword_obj = await sync_to_async(Keyword.objects.get)(
        keyword=niche_name, marketplace=marketplace,
    )

    @sync_to_async
    def _get_product_asins():
        return list(
            AmazonProduct.objects.filter(
                keywords=keyword_obj,
            ).values_list('asin', flat=True)
        )

    product_asins = await _get_product_asins()
    if not product_asins:
        raise RuntimeError(
            f"No products found for keyword '{niche_name}'"
        )

    # Create NicheResearchProduct entries
    @sync_to_async
    def _create_research_products():
        research = NicheResearch.objects.get(id=research_id)
        amazon_products = AmazonProduct.objects.filter(
            asin__in=product_asins, keywords=keyword_obj,
        )
        entries = [
            NicheResearchProduct(research=research, product=p)
            for p in amazon_products
        ]
        NicheResearchProduct.objects.bulk_create(entries, ignore_conflicts=True)

    await _create_research_products()

    logger.info(
        "Scrape node complete: %d products for '%s'",
        len(product_asins), niche_name,
    )

    return {'product_asins': product_asins}
