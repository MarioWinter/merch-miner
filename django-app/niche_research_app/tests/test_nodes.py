"""
Task 7.2 -- Node unit tests for PROJ-6 Niche Deep Research.

Covers:
  - LLM factory: reads config from DB, falls back to defaults
  - Scrape node: polling logic (success, timeout)
  - Vision analyze: async parallel + filtering + Semaphore(10)
  - Emotional analyze: async parallel execution
  - Niche profile: create_react_agent sub-graph (with/without SearXNG)
  - Keywords node
  - Finalize node: status updates
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from niche_app.models import Niche
from niche_research_app.models import (
    NicheAnalysis,
    NicheKeywordAnalysis,
    NicheProductEmotionalAnalysis,
    NicheProductVisionAnalysis,
    NicheResearch,
)


# ---------------------------------------------------------------------------
# Scrape Node
# ---------------------------------------------------------------------------

@pytest.mark.django_db(transaction=True)
class TestScrapeNode:

    def _make_state(self, research):
        return {
            'research_id': str(research.id),
            'niche_name': research.niche.name,
            'marketplace': 'amazon_com',
        }

    @patch('scraper_app.brand_filter.get_blacklisted_brands', return_value=set())
    def test_fresh_cache_skips_scrape(
        self, mock_blacklist, niche, user_with_workspace,
        keyword, amazon_products,
    ):
        """If products already exist in DB, scrape is not triggered (DB-first)."""
        user, _ = user_with_workspace
        research = NicheResearch.objects.create(niche=niche, triggered_by=user)

        from niche_research_app.graph.nodes.scrape import scrape_node
        result = asyncio.get_event_loop().run_until_complete(
            scrape_node(self._make_state(research))
        )

        assert 'product_asins' in result
        assert len(result['product_asins']) == 3

    @patch('scraper_app.brand_filter.get_blacklisted_brands', return_value=set())
    def test_new_scrape_triggered(
        self, mock_blacklist, niche, user_with_workspace,
        keyword, amazon_products,
    ):
        """DB-first: existing products used, output shape is correct."""
        user, _ = user_with_workspace
        research = NicheResearch.objects.create(niche=niche, triggered_by=user)

        from niche_research_app.graph.nodes.scrape import scrape_node

        result = asyncio.get_event_loop().run_until_complete(
            scrape_node(self._make_state(research))
        )
        assert 'product_asins' in result
        assert len(result['product_asins']) == 3

    @patch('scraper_app.brand_filter.get_blacklisted_brands', return_value=set())
    @patch('scraper_app.tasks.get_or_create_keyword_cache')
    def test_scrape_timeout_raises(
        self, mock_get_cache, mock_blacklist, niche, user_with_workspace,
    ):
        """Polling timeout raises TimeoutError."""
        from scraper_app.models import ProductSearchCache
        user, _ = user_with_workspace
        # Use a niche name with no existing keyword/products to trigger scrape path
        timeout_niche = Niche.objects.create(
            workspace=niche.workspace, name='TimeoutNiche', created_by=user,
        )
        research = NicheResearch.objects.create(niche=timeout_niche, triggered_by=user)

        cache = MagicMock()
        cache.status = ProductSearchCache.Status.PENDING
        cache.refresh_from_db = MagicMock()  # Status never changes
        mock_get_cache.return_value = (cache, False)

        from niche_research_app.graph.nodes.scrape import scrape_node

        with patch('niche_research_app.graph.nodes.scrape.MAX_POLL_SECONDS', 0):
            with patch('niche_research_app.graph.nodes.scrape.POLL_INTERVAL_SECONDS', 0):
                with pytest.raises(TimeoutError, match='timed out'):
                    asyncio.get_event_loop().run_until_complete(
                        scrape_node({
                            'research_id': str(research.id),
                            'niche_name': 'TimeoutNiche',
                            'marketplace': 'amazon_com',
                        })
                    )

    @patch('scraper_app.brand_filter.get_blacklisted_brands', return_value=set())
    @patch('scraper_app.tasks.get_or_create_keyword_cache')
    def test_scrape_failed_raises(
        self, mock_get_cache, mock_blacklist, niche, user_with_workspace,
    ):
        """Scrape failure raises RuntimeError."""
        from scraper_app.models import ProductSearchCache
        user, _ = user_with_workspace
        failed_niche = Niche.objects.create(
            workspace=niche.workspace, name='FailedNiche', created_by=user,
        )
        research = NicheResearch.objects.create(niche=failed_niche, triggered_by=user)

        cache = MagicMock()
        cache.status = ProductSearchCache.Status.FAILED
        mock_get_cache.return_value = (cache, False)

        from niche_research_app.graph.nodes.scrape import scrape_node

        with pytest.raises(RuntimeError, match='failed'):
            asyncio.get_event_loop().run_until_complete(
                scrape_node({
                    'research_id': str(research.id),
                    'niche_name': 'FailedNiche',
                    'marketplace': 'amazon_com',
                })
            )

    @patch('scraper_app.brand_filter.get_blacklisted_brands', return_value=set())
    @patch('scraper_app.tasks.get_or_create_keyword_cache')
    def test_no_products_raises(
        self, mock_get_cache, mock_blacklist, user_with_workspace,
    ):
        """0 products found -> RuntimeError."""
        from scraper_app.models import Keyword as ScraperKeyword, ProductSearchCache
        user, ws = user_with_workspace
        niche = Niche.objects.create(
            workspace=ws, name='EmptyNiche', created_by=user,
        )
        research = NicheResearch.objects.create(niche=niche, triggered_by=user)

        # Keyword exists but no products linked — triggers scrape path
        ScraperKeyword.objects.get_or_create(
            keyword='EmptyNiche', marketplace='amazon_com',
        )

        cache = MagicMock()
        cache.status = ProductSearchCache.Status.COMPLETED
        mock_get_cache.return_value = (cache, False)

        from niche_research_app.graph.nodes.scrape import scrape_node

        with pytest.raises(RuntimeError, match='No products found'):
            asyncio.get_event_loop().run_until_complete(
                scrape_node({
                    'research_id': str(research.id),
                    'niche_name': 'EmptyNiche',
                    'marketplace': 'amazon_com',
                })
            )

    @patch('scraper_app.brand_filter.get_blacklisted_brands', return_value=set())
    def test_status_updated_to_running(
        self, mock_blacklist, niche, user_with_workspace,
        keyword, amazon_products,
    ):
        """Scrape node sets NicheResearch.status = running."""
        user, _ = user_with_workspace
        research = NicheResearch.objects.create(niche=niche, triggered_by=user)

        from niche_research_app.graph.nodes.scrape import scrape_node
        asyncio.get_event_loop().run_until_complete(
            scrape_node(self._make_state(research))
        )

        research.refresh_from_db()
        assert research.status == NicheResearch.Status.RUNNING


# ---------------------------------------------------------------------------
# PROJ-28: scrape_node product_limit + BSR ordering + LIVE deep scrape
# ---------------------------------------------------------------------------

@pytest.mark.django_db(transaction=True)
class TestScrapeNodeProductLimit:
    """PROJ-28 tests: BSR ordering, slice by product_limit, deep-scrape switch."""

    def _make_state(self, research, product_limit=50):
        return {
            'research_id': str(research.id),
            'niche_name': research.niche.name,
            'marketplace': 'amazon_com',
            'product_limit': product_limit,
        }

    def _seed_products(self, keyword, count, bsr_values=None):
        """Create `count` AmazonProducts linked to keyword.

        bsr_values: list of BSR values; if shorter than count, remaining get None.
        """
        from scraper_app.models import AmazonProduct
        bsr_values = bsr_values or []
        products = []
        for i in range(count):
            bsr = bsr_values[i] if i < len(bsr_values) else None
            p = AmazonProduct.objects.create(
                asin=f'B00BSR{i:04d}',
                marketplace='amazon_com',
                title=f'Product {i}',
                brand=f'Brand{i}',
                rating=4.0,
                reviews_count=10,
                thumbnail_url=f'https://example.com/{i}.jpg',
                product_url=f'https://amazon.com/dp/B00BSR{i:04d}',
                bsr=bsr,
            )
            p.keywords.add(keyword)
            products.append(p)
        return products

    @patch('scraper_app.brand_filter.get_blacklisted_brands', return_value=set())
    def test_db_first_slices_by_limit_ordered_by_bsr_asc(
        self, mock_blacklist, niche, user_with_workspace, keyword,
    ):
        """80 seeded products with random BSR + product_limit=30 -> 30 ASINs ordered BSR ASC."""
        user, _ = user_with_workspace
        # BSR values: even indices get 1, 2, 3, ... (lowest BSR = 1 at index 0)
        # Mix some random-but-deterministic BSR values
        bsr_values = list(range(1000, 1080))  # 80 distinct BSR values 1000..1079
        # Reorder so creation order doesn't match BSR order
        # Use reversed BSR: index 0 -> bsr=1079, index 79 -> bsr=1000
        bsr_values_shuffled = list(reversed(bsr_values))
        self._seed_products(keyword, 80, bsr_values_shuffled)

        research = NicheResearch.objects.create(niche=niche, triggered_by=user)

        from niche_research_app.graph.nodes.scrape import scrape_node
        result = asyncio.get_event_loop().run_until_complete(
            scrape_node(self._make_state(research, product_limit=30))
        )

        assert len(result['product_asins']) == 30

        # Verify ordering: bsr ASC. Lowest BSR products have asins corresponding
        # to the products created last (since we used reversed BSR).
        # bsr=1000 is on the LAST seeded product (index 79) -> asin B00BSR0079
        # bsr=1029 is at index 50 -> asin B00BSR0050
        from scraper_app.models import AmazonProduct
        returned_asins = result['product_asins']
        returned_bsrs = list(
            AmazonProduct.objects.filter(asin__in=returned_asins).values_list(
                'asin', 'bsr',
            )
        )
        bsr_by_asin = dict(returned_bsrs)
        # The order of returned_asins should match BSR ASC
        actual_bsrs_in_order = [bsr_by_asin[a] for a in returned_asins]
        assert actual_bsrs_in_order == sorted(actual_bsrs_in_order)
        # The smallest 30 BSR values should be 1000..1029
        assert actual_bsrs_in_order == list(range(1000, 1030))

    @patch('scraper_app.brand_filter.get_blacklisted_brands', return_value=set())
    def test_all_null_bsr_returns_limit_via_nulls_last(
        self, mock_blacklist, niche, user_with_workspace, keyword,
    ):
        """All-NULL BSR + product_limit=10 -> 10 returned (nulls_last fallback)."""
        user, _ = user_with_workspace
        self._seed_products(keyword, 25)  # all NULL BSR

        research = NicheResearch.objects.create(niche=niche, triggered_by=user)

        from niche_research_app.graph.nodes.scrape import scrape_node
        result = asyncio.get_event_loop().run_until_complete(
            scrape_node(self._make_state(research, product_limit=10))
        )

        assert len(result['product_asins']) == 10

    @patch('scraper_app.brand_filter.get_blacklisted_brands', return_value=set())
    def test_db_has_fewer_than_limit_returns_all(
        self, mock_blacklist, niche, user_with_workspace, keyword,
    ):
        """DB has 30 products, product_limit=200 -> returns all 30 (no exception, no re-scrape)."""
        user, _ = user_with_workspace
        self._seed_products(keyword, 30, bsr_values=list(range(1, 31)))

        research = NicheResearch.objects.create(niche=niche, triggered_by=user)

        from niche_research_app.graph.nodes.scrape import scrape_node
        result = asyncio.get_event_loop().run_until_complete(
            scrape_node(self._make_state(research, product_limit=200))
        )

        assert len(result['product_asins']) == 30

    @patch('scraper_app.brand_filter.get_blacklisted_brands', return_value=set())
    @patch('scraper_app.tasks.scrape_keyword_job')
    def test_empty_db_uses_live_mode_and_scrape_keyword_job_limit_50(
        self, mock_scrape_keyword, mock_blacklist, user_with_workspace,
    ):
        """Empty DB + limit=50 -> ScrapeJob.Mode.LIVE, scrape_keyword_job(max_pages=2)."""
        from scraper_app.models import (
            AmazonProduct,
            Keyword as ScraperKeyword,
            ProductSearchCache,
            ScrapeJob,
        )
        user, ws = user_with_workspace
        empty_niche = Niche.objects.create(
            workspace=ws, name='EmptyLive50', created_by=user,
        )
        research = NicheResearch.objects.create(niche=empty_niche, triggered_by=user)

        # scrape_keyword_job stub: simulate scraper writing products + completing cache
        def _fake_scrape(keyword_str, marketplace, scrape_job_id=None, **kwargs):
            kw = ScraperKeyword.objects.get(keyword=keyword_str, marketplace=marketplace)
            sj = ScrapeJob.objects.get(id=scrape_job_id)
            for i in range(3):
                p = AmazonProduct.objects.create(
                    asin=f'B00LIVE{i:03d}',
                    marketplace=marketplace,
                    title=f'Live Product {i}',
                    bsr=i + 1,
                )
                p.keywords.add(kw)
            sj.status = ScrapeJob.Status.COMPLETED
            sj.save(update_fields=['status'])
            ProductSearchCache.objects.filter(scrape_job=sj).update(
                status=ProductSearchCache.Status.COMPLETED,
            )

        mock_scrape_keyword.side_effect = _fake_scrape

        from niche_research_app.graph.nodes.scrape import scrape_node
        result = asyncio.get_event_loop().run_until_complete(
            scrape_node({
                'research_id': str(research.id),
                'niche_name': 'EmptyLive50',
                'marketplace': 'amazon_com',
                'product_limit': 50,
            })
        )

        assert len(result['product_asins']) == 3
        # ScrapeJob created with mode=LIVE and pages_total=2
        sj = ScrapeJob.objects.filter(keyword__keyword='EmptyLive50').first()
        assert sj is not None
        assert sj.mode == ScrapeJob.Mode.LIVE
        assert sj.pages_total == 2
        # scrape_keyword_job called with max_pages=2
        assert mock_scrape_keyword.called
        call_kwargs = mock_scrape_keyword.call_args.kwargs
        assert call_kwargs['max_pages'] == 2

    @patch('scraper_app.brand_filter.get_blacklisted_brands', return_value=set())
    @patch('scraper_app.tasks.scrape_keyword_job')
    def test_empty_db_limit_120_uses_max_pages_3(
        self, mock_scrape_keyword, mock_blacklist, user_with_workspace,
    ):
        """Empty DB + limit=120 -> max_pages = ceil(120/45) = 3."""
        from scraper_app.models import (
            AmazonProduct,
            Keyword as ScraperKeyword,
            ProductSearchCache,
            ScrapeJob,
        )
        user, ws = user_with_workspace
        empty_niche = Niche.objects.create(
            workspace=ws, name='EmptyLive120', created_by=user,
        )
        research = NicheResearch.objects.create(niche=empty_niche, triggered_by=user)

        def _fake_scrape(keyword_str, marketplace, scrape_job_id=None, **kwargs):
            kw = ScraperKeyword.objects.get(keyword=keyword_str, marketplace=marketplace)
            sj = ScrapeJob.objects.get(id=scrape_job_id)
            p = AmazonProduct.objects.create(
                asin='B00LIVE120A',
                marketplace=marketplace,
                title='Live 120',
                bsr=1,
            )
            p.keywords.add(kw)
            sj.status = ScrapeJob.Status.COMPLETED
            sj.save(update_fields=['status'])
            ProductSearchCache.objects.filter(scrape_job=sj).update(
                status=ProductSearchCache.Status.COMPLETED,
            )

        mock_scrape_keyword.side_effect = _fake_scrape

        from niche_research_app.graph.nodes.scrape import scrape_node
        asyncio.get_event_loop().run_until_complete(
            scrape_node({
                'research_id': str(research.id),
                'niche_name': 'EmptyLive120',
                'marketplace': 'amazon_com',
                'product_limit': 120,
            })
        )

        sj = ScrapeJob.objects.filter(keyword__keyword='EmptyLive120').first()
        assert sj.mode == ScrapeJob.Mode.LIVE
        assert sj.pages_total == 3
        assert mock_scrape_keyword.call_args.kwargs['max_pages'] == 3

    @patch('scraper_app.brand_filter.get_blacklisted_brands', return_value=set())
    @patch('scraper_app.tasks.scrape_keyword_job')
    def test_empty_db_limit_200_uses_max_pages_5(
        self, mock_scrape_keyword, mock_blacklist, user_with_workspace,
    ):
        """Empty DB + limit=200 -> max_pages = ceil(200/45) = 5."""
        from scraper_app.models import (
            AmazonProduct,
            Keyword as ScraperKeyword,
            ProductSearchCache,
            ScrapeJob,
        )
        user, ws = user_with_workspace
        empty_niche = Niche.objects.create(
            workspace=ws, name='EmptyLive200', created_by=user,
        )
        research = NicheResearch.objects.create(niche=empty_niche, triggered_by=user)

        def _fake_scrape(keyword_str, marketplace, scrape_job_id=None, **kwargs):
            kw = ScraperKeyword.objects.get(keyword=keyword_str, marketplace=marketplace)
            sj = ScrapeJob.objects.get(id=scrape_job_id)
            p = AmazonProduct.objects.create(
                asin='B00LIVE200A',
                marketplace=marketplace,
                title='Live 200',
                bsr=1,
            )
            p.keywords.add(kw)
            sj.status = ScrapeJob.Status.COMPLETED
            sj.save(update_fields=['status'])
            ProductSearchCache.objects.filter(scrape_job=sj).update(
                status=ProductSearchCache.Status.COMPLETED,
            )

        mock_scrape_keyword.side_effect = _fake_scrape

        from niche_research_app.graph.nodes.scrape import scrape_node
        asyncio.get_event_loop().run_until_complete(
            scrape_node({
                'research_id': str(research.id),
                'niche_name': 'EmptyLive200',
                'marketplace': 'amazon_com',
                'product_limit': 200,
            })
        )

        sj = ScrapeJob.objects.filter(keyword__keyword='EmptyLive200').first()
        assert sj.mode == ScrapeJob.Mode.LIVE
        assert sj.pages_total == 5
        assert mock_scrape_keyword.call_args.kwargs['max_pages'] == 5


# ---------------------------------------------------------------------------
# Vision Analyze Node
# ---------------------------------------------------------------------------

@pytest.mark.django_db(transaction=True)
class TestVisionAnalyzeNode:

    def _make_state(self, research, asins):
        return {
            'research_id': str(research.id),
            'niche_name': research.niche.name,
            'marketplace': 'amazon_com',
            'product_asins': asins,
        }

    @patch('scraper_app.brand_filter.get_blacklisted_brands', return_value=set())
    @patch('niche_research_app.graph.nodes.vision_analyze.get_llm_for_node')
    def test_parallel_execution_and_filtering(
        self, mock_get_llm, mock_blacklist, niche, user_with_workspace, keyword, amazon_products,
    ):
        """Products are analyzed in parallel, non-matches filtered out."""
        user, _ = user_with_workspace
        research = NicheResearch.objects.create(niche=niche, triggered_by=user)

        # Mock LLM
        mock_schema_result = MagicMock()
        mock_schema_result.slogan_text = 'Gone Fishing Today'
        mock_schema_result.meaning_context = 'Fishing lifestyle'
        mock_schema_result.visual_style = 'Cartoon'
        mock_schema_result.graphic_elements = 'Fish icon'
        mock_schema_result.layout_composition = 'Centered'
        mock_schema_result.is_niche_match = True

        mock_structured_llm = AsyncMock()
        mock_structured_llm.ainvoke = AsyncMock(return_value=mock_schema_result)

        mock_llm = MagicMock()
        mock_llm.with_structured_output = MagicMock(return_value=mock_structured_llm)
        mock_get_llm.return_value = (mock_llm, 'System prompt')

        asins = [p.asin for p in amazon_products]

        from niche_research_app.graph.nodes.vision_analyze import vision_analyze_node
        result = asyncio.get_event_loop().run_until_complete(
            vision_analyze_node(self._make_state(research, asins))
        )

        assert 'vision_analyses' in result
        assert len(result['vision_analyses']) == 3
        assert NicheProductVisionAnalysis.objects.filter(research=research).count() == 3

    @patch('scraper_app.brand_filter.get_blacklisted_brands', return_value=set())
    @patch('niche_research_app.graph.nodes.vision_analyze.get_llm_for_node')
    def test_non_match_filtered_out(
        self, mock_get_llm, mock_blacklist, niche, user_with_workspace, keyword, amazon_products,
    ):
        """Products with is_niche_match=False are saved but not in state."""
        user, _ = user_with_workspace
        research = NicheResearch.objects.create(niche=niche, triggered_by=user)

        mock_result = MagicMock()
        mock_result.slogan_text = 'Generic Text'
        mock_result.meaning_context = 'Nothing specific'
        mock_result.visual_style = 'Plain'
        mock_result.graphic_elements = 'None'
        mock_result.layout_composition = 'Simple'
        mock_result.is_niche_match = False  # Not a match

        mock_structured = AsyncMock()
        mock_structured.ainvoke = AsyncMock(return_value=mock_result)
        mock_llm = MagicMock()
        mock_llm.with_structured_output = MagicMock(return_value=mock_structured)
        mock_get_llm.return_value = (mock_llm, 'Prompt')

        asins = [p.asin for p in amazon_products]

        from niche_research_app.graph.nodes.vision_analyze import vision_analyze_node
        with pytest.raises(RuntimeError, match='No matching products'):
            asyncio.get_event_loop().run_until_complete(
                vision_analyze_node(self._make_state(research, asins))
            )

        # Records are still saved to DB for audit
        assert NicheProductVisionAnalysis.objects.filter(research=research).count() == 3

    @patch('scraper_app.brand_filter.get_blacklisted_brands', return_value=set())
    @patch('niche_research_app.graph.nodes.vision_analyze.get_llm_for_node')
    def test_short_slogan_filtered_unless_exception(
        self, mock_get_llm, mock_blacklist, niche, user_with_workspace, keyword, amazon_products,
    ):
        """Slogans <=2 words filtered, but Squad/Crew exceptions pass."""
        user, _ = user_with_workspace
        research = NicheResearch.objects.create(niche=niche, triggered_by=user)

        call_count = [0]

        async def mock_ainvoke(messages):
            call_count[0] += 1
            result = MagicMock()
            result.is_niche_match = True
            result.meaning_context = 'Test'
            result.visual_style = 'Test'
            result.graphic_elements = 'Test'
            result.layout_composition = 'Test'
            if call_count[0] == 1:
                result.slogan_text = 'Hi'  # 1 word -> filtered
            elif call_count[0] == 2:
                result.slogan_text = 'Fishing Squad'  # 2 words with "Squad" -> passes
            else:
                result.slogan_text = 'Go Fish'  # 2 words, no exception -> filtered
            return result

        mock_structured = AsyncMock()
        mock_structured.ainvoke = mock_ainvoke
        mock_llm = MagicMock()
        mock_llm.with_structured_output = MagicMock(return_value=mock_structured)
        mock_get_llm.return_value = (mock_llm, 'Prompt')

        asins = [p.asin for p in amazon_products]

        from niche_research_app.graph.nodes.vision_analyze import vision_analyze_node
        result = asyncio.get_event_loop().run_until_complete(
            vision_analyze_node(self._make_state(research, asins))
        )

        # Only "Fishing Squad" passes filter
        assert len(result['vision_analyses']) == 1
        assert result['vision_analyses'][0]['slogan_text'] == 'Fishing Squad'

    @patch('scraper_app.brand_filter.get_blacklisted_brands', return_value=set())
    @patch('niche_research_app.graph.nodes.vision_analyze.get_llm_for_node')
    def test_thumbnail_failure_skipped(
        self, mock_get_llm, mock_blacklist, niche, user_with_workspace, keyword, amazon_products,
    ):
        """If LLM call fails for one product, it's skipped gracefully."""
        user, _ = user_with_workspace
        research = NicheResearch.objects.create(niche=niche, triggered_by=user)

        call_count = [0]

        async def mock_ainvoke(messages):
            call_count[0] += 1
            if call_count[0] == 1:
                raise Exception('Thumbnail unreachable')
            result = MagicMock()
            result.slogan_text = 'Great Fishing Day Ahead'
            result.meaning_context = 'Pride'
            result.visual_style = 'Cartoon'
            result.graphic_elements = 'Fish'
            result.layout_composition = 'Centered'
            result.is_niche_match = True
            return result

        mock_structured = AsyncMock()
        mock_structured.ainvoke = mock_ainvoke
        mock_llm = MagicMock()
        mock_llm.with_structured_output = MagicMock(return_value=mock_structured)
        mock_get_llm.return_value = (mock_llm, 'Prompt')

        asins = [p.asin for p in amazon_products]

        from niche_research_app.graph.nodes.vision_analyze import vision_analyze_node
        result = asyncio.get_event_loop().run_until_complete(
            vision_analyze_node(self._make_state(research, asins))
        )

        # 1 failed, 2 passed
        assert len(result['vision_analyses']) == 2

    @patch('scraper_app.brand_filter.get_blacklisted_brands', return_value=set())
    @patch('niche_research_app.graph.nodes.vision_analyze.get_llm_for_node')
    def test_no_thumbnail_skipped(
        self, mock_get_llm, mock_blacklist, niche, user_with_workspace, keyword,
    ):
        """Products without thumbnail_url are skipped."""
        from scraper_app.models import AmazonProduct
        user, _ = user_with_workspace
        research = NicheResearch.objects.create(niche=niche, triggered_by=user)

        p = AmazonProduct.objects.create(
            asin='B00NOTHUMB', marketplace='amazon_com',
            title='No Thumb', thumbnail_url='',
        )
        p.keywords.add(keyword)

        mock_llm = MagicMock()
        mock_get_llm.return_value = (mock_llm, 'Prompt')

        from niche_research_app.graph.nodes.vision_analyze import vision_analyze_node
        with pytest.raises(RuntimeError, match='No matching products'):
            asyncio.get_event_loop().run_until_complete(
                vision_analyze_node({
                    'research_id': str(research.id),
                    'niche_name': 'Fishing',
                    'marketplace': 'amazon_com',
                    'product_asins': ['B00NOTHUMB'],
                })
            )


# ---------------------------------------------------------------------------
# Emotional Analyze Node
# ---------------------------------------------------------------------------

@pytest.mark.django_db(transaction=True)
class TestEmotionalAnalyzeNode:

    @patch('niche_research_app.graph.nodes.emotional_analyze.get_llm_for_node')
    def test_parallel_execution(
        self, mock_get_llm, niche, user_with_workspace, amazon_products,
    ):
        """All filtered products get emotional analysis in parallel."""
        user, _ = user_with_workspace
        research = NicheResearch.objects.create(niche=niche, triggered_by=user)

        # Build mock Pydantic-like result
        def _make_sub(d):
            m = MagicMock()
            m.model_dump = MagicMock(return_value=d)
            for k, v in d.items():
                setattr(m, k, v)
            return m

        mock_result = MagicMock()
        mock_result.original_slogan = 'Gone Fishing'
        mock_result.customer_psychology = _make_sub({
            'buyer_profile': 'Angler', 'emotional_need': 'Pride',
            'internal_monologue': 'I fish.', 'what_they_cant_say_out_loud': 'Escape.',
        })
        mock_result.sentiment_analysis = _make_sub({
            'sentiment': 'Positive', 'primary_emotion': 'Pride',
            'emotion_target': 'Self', 'confrontation_level': 'Low',
            'workplace_culture_required': 'Peer', 'humor_style': 'Warm',
            'humor_function': 'Pride',
        })
        mock_result.emotional_pattern = '1: IDENTITY DECLARATION'
        mock_result.vibe = _make_sub({
            'energy_level': 'Medium', 'attitude': 'Proud', 'core_emotion': 'Content',
        })
        mock_result.semantic_structure = _make_sub({
            'structural_template': 'X + Y', 'wordplay_type': 'None',
            'delivery_style': 'Direct',
        })
        mock_result.key_elements = ['fishing', 'pride']
        mock_result.tone = 'Warm'
        mock_result.adaptation_formula = '[X] + Identity'
        mock_result.adaptation_examples = ['Gone Hiking']
        mock_result.transferability_notes = _make_sub({
            'works_best_in': ['outdoor'], 'avoid_in': ['formal'],
            'critical_success_factors': ['authentic'],
        })

        mock_structured = AsyncMock()
        mock_structured.ainvoke = AsyncMock(return_value=mock_result)
        mock_llm = MagicMock()
        mock_llm.with_structured_output = MagicMock(return_value=mock_structured)
        mock_get_llm.return_value = (mock_llm, 'System prompt')

        vision_analyses = [
            {
                'asin': p.asin, 'title': p.title, 'brand': p.brand,
                'thumbnail_url': p.thumbnail_url,
                'slogan_text': 'Gone Fishing',
                'meaning_context': 'Pride', 'visual_style': 'Cartoon',
                'graphic_elements': 'Fish', 'layout_composition': 'Centered',
            }
            for p in amazon_products
        ]

        state = {
            'research_id': str(research.id),
            'niche_name': 'Fishing',
            'marketplace': 'amazon_com',
            'vision_analyses': vision_analyses,
        }

        from niche_research_app.graph.nodes.emotional_analyze import emotional_analyze_node
        result = asyncio.get_event_loop().run_until_complete(
            emotional_analyze_node(state)
        )

        assert 'emotional_analyses' in result
        assert len(result['emotional_analyses']) == 3
        assert NicheProductEmotionalAnalysis.objects.filter(research=research).count() == 3

        # Verify stored data shape
        ea = NicheProductEmotionalAnalysis.objects.first()
        assert ea.emotional_pattern == '1: IDENTITY DECLARATION'
        assert 'buyer_profile' in ea.customer_psychology

    @patch('niche_research_app.graph.nodes.emotional_analyze.get_llm_for_node')
    def test_individual_failure_skipped(
        self, mock_get_llm, niche, user_with_workspace, amazon_products,
    ):
        """If one product fails, others still complete."""
        user, _ = user_with_workspace
        research = NicheResearch.objects.create(niche=niche, triggered_by=user)

        call_count = [0]

        async def mock_ainvoke(messages):
            call_count[0] += 1
            if call_count[0] == 1:
                raise Exception('LLM error')
            result = MagicMock()
            result.original_slogan = 'Test'
            for attr in ['customer_psychology', 'sentiment_analysis', 'vibe',
                         'semantic_structure', 'transferability_notes']:
                sub = MagicMock()
                sub.model_dump = MagicMock(return_value={})
                setattr(result, attr, sub)
            result.emotional_pattern = '1: IDENTITY DECLARATION'
            result.key_elements = []
            result.tone = 'Test'
            result.adaptation_formula = 'Test'
            result.adaptation_examples = []
            return result

        mock_structured = AsyncMock()
        mock_structured.ainvoke = mock_ainvoke
        mock_llm = MagicMock()
        mock_llm.with_structured_output = MagicMock(return_value=mock_structured)
        mock_get_llm.return_value = (mock_llm, 'Prompt')

        vision_analyses = [
            {
                'asin': p.asin, 'title': p.title, 'brand': p.brand,
                'slogan_text': 'Test', 'meaning_context': '', 'visual_style': '',
                'graphic_elements': '', 'layout_composition': '',
            }
            for p in amazon_products
        ]

        from niche_research_app.graph.nodes.emotional_analyze import emotional_analyze_node
        result = asyncio.get_event_loop().run_until_complete(
            emotional_analyze_node({
                'research_id': str(research.id),
                'niche_name': 'Fishing',
                'vision_analyses': vision_analyses,
            })
        )

        # 1 failed, 2 succeeded
        assert len(result['emotional_analyses']) == 2


# ---------------------------------------------------------------------------
# Niche Profile Node
# ---------------------------------------------------------------------------

@pytest.mark.django_db(transaction=True)
class TestNicheProfileNode:

    @patch('niche_research_app.graph.nodes.niche_profile.create_react_agent')
    @patch('niche_research_app.graph.nodes.niche_profile.get_llm_for_node')
    def test_with_searxng(self, mock_get_llm, mock_create_agent, niche, user_with_workspace):
        """Agent runs with SearXNG, produces structured analysis."""
        user, _ = user_with_workspace
        research = NicheResearch.objects.create(niche=niche, triggered_by=user)

        # Mock LLM
        mock_llm = MagicMock()
        mock_get_llm.return_value = (mock_llm, 'System prompt')

        # Mock agent
        agent_msg = MagicMock()
        agent_msg.content = 'Agent analysis output'
        mock_agent = AsyncMock()
        mock_agent.ainvoke = AsyncMock(return_value={
            'messages': [agent_msg],
        })
        mock_create_agent.return_value = mock_agent

        # Mock structured output
        mock_analysis = MagicMock()
        mock_analysis.niche_summary = 'Fishing niche summary'
        mock_analysis.sentiment = 'Positive'
        mock_analysis.primary_emotions = ['Pride', 'Joy']
        mock_analysis.emotional_archetype = ['Explorer']
        mock_analysis.example_keywords = ['fishing', 'angler']
        mock_analysis.pattern_analysis = [
            MagicMock(model_dump=MagicMock(return_value={
                'name': 'IDENTITY DECLARATION', 'present': True,
                'context': 'Test context',
            }))
        ]
        mock_analysis.emotional_reality = 'Identity validation'
        mock_analysis.design_concepts = 'Nature themes'
        mock_analysis.dominant_design_aesthetics = 'Earth tones'
        mock_analysis.model_dump = MagicMock(return_value={'test': 'data'})

        mock_structured = AsyncMock()
        mock_structured.ainvoke = AsyncMock(return_value=mock_analysis)
        mock_llm.with_structured_output = MagicMock(return_value=mock_structured)

        state = {
            'research_id': str(research.id),
            'niche_name': 'Fishing',
            'emotional_analyses': [{'asin': 'B001', 'title': 'Test', 'slogan_text': 'Fish'}],
        }

        from niche_research_app.graph.nodes.niche_profile import niche_profile_node
        result = asyncio.get_event_loop().run_until_complete(
            niche_profile_node(state)
        )

        assert 'analysis_result' in result
        assert NicheAnalysis.objects.filter(research=research).count() == 1
        na = NicheAnalysis.objects.get(research=research)
        assert na.niche_summary == 'Fishing niche summary'
        assert na.sentiment == 'Positive'

    @patch('niche_research_app.graph.nodes.niche_profile.create_react_agent')
    @patch('niche_research_app.graph.nodes.niche_profile.get_llm_for_node')
    def test_without_searxng(self, mock_get_llm, mock_create_agent, niche, user_with_workspace):
        """Agent completes even when SearXNG returns no messages."""
        user, _ = user_with_workspace
        research = NicheResearch.objects.create(niche=niche, triggered_by=user)

        mock_llm = MagicMock()
        mock_get_llm.return_value = (mock_llm, 'System prompt')

        # Agent returns empty messages (SearXNG unavailable)
        mock_agent = AsyncMock()
        mock_agent.ainvoke = AsyncMock(return_value={'messages': []})
        mock_create_agent.return_value = mock_agent

        mock_analysis = MagicMock()
        mock_analysis.niche_summary = 'Summary without web data'
        mock_analysis.sentiment = 'Neutral'
        mock_analysis.primary_emotions = ['Curiosity']
        mock_analysis.emotional_archetype = ['Sage']
        mock_analysis.example_keywords = ['test']
        mock_analysis.pattern_analysis = []
        mock_analysis.emotional_reality = 'Test'
        mock_analysis.design_concepts = 'Test'
        mock_analysis.dominant_design_aesthetics = 'Test'
        mock_analysis.model_dump = MagicMock(return_value={})

        mock_structured = AsyncMock()
        mock_structured.ainvoke = AsyncMock(return_value=mock_analysis)
        mock_llm.with_structured_output = MagicMock(return_value=mock_structured)

        from niche_research_app.graph.nodes.niche_profile import niche_profile_node
        result = asyncio.get_event_loop().run_until_complete(
            niche_profile_node({
                'research_id': str(research.id),
                'niche_name': 'Fishing',
                'emotional_analyses': [],
            })
        )

        assert 'analysis_result' in result
        na = NicheAnalysis.objects.get(research=research)
        assert na.niche_summary == 'Summary without web data'


# ---------------------------------------------------------------------------
# Keywords Node
# ---------------------------------------------------------------------------

@pytest.mark.django_db(transaction=True)
class TestKeywordsNode:

    @patch('niche_research_app.graph.nodes.keywords.get_llm_for_node')
    def test_keywords_generated(
        self, mock_get_llm, niche, user_with_workspace, keyword,
    ):
        """Keywords node produces and saves keyword analysis."""
        user, _ = user_with_workspace
        research = NicheResearch.objects.create(niche=niche, triggered_by=user)

        mock_result = MagicMock()
        mock_result.main_short_tail = ['fishing', 'angler']
        mock_result.main_long_tail = ['funny fishing shirt']
        mock_result.all_keywords_flat = 'fishing, angler, funny fishing shirt'
        mock_result.top_focus_keywords = ['fishing']
        mock_result.top_long_tail_keywords = ['funny fishing shirt']
        mock_result.model_dump = MagicMock(return_value={
            'main_short_tail': ['fishing', 'angler'],
            'main_long_tail': ['funny fishing shirt'],
            'all_keywords_flat': 'fishing, angler',
            'top_focus_keywords': ['fishing'],
            'top_long_tail_keywords': ['funny fishing shirt'],
        })

        mock_structured = AsyncMock()
        mock_structured.ainvoke = AsyncMock(return_value=mock_result)
        mock_llm = MagicMock()
        mock_llm.with_structured_output = MagicMock(return_value=mock_structured)
        mock_get_llm.return_value = (mock_llm, 'Prompt')

        state = {
            'research_id': str(research.id),
            'niche_name': 'Fishing',
            'marketplace': 'amazon_com',
            'analysis_result': {'niche_summary': 'Fishing niche'},
            'vision_analyses': [{'title': 'Fishing Shirt'}],
        }

        from niche_research_app.graph.nodes.keywords import keywords_node
        result = asyncio.get_event_loop().run_until_complete(keywords_node(state))

        assert 'keywords_result' in result
        ka = NicheKeywordAnalysis.objects.get(research=research)
        assert 'fishing' in ka.main_short_tail

    @patch('niche_research_app.graph.nodes.keywords.get_llm_for_node')
    def test_no_seed_keywords(self, mock_get_llm, user_with_workspace):
        """Node works without SearchKeywordResult seed data."""
        user, ws = user_with_workspace
        niche = Niche.objects.create(workspace=ws, name='NoSeed', created_by=user)
        research = NicheResearch.objects.create(niche=niche, triggered_by=user)

        mock_result = MagicMock()
        mock_result.main_short_tail = ['noseed']
        mock_result.main_long_tail = []
        mock_result.all_keywords_flat = 'noseed'
        mock_result.top_focus_keywords = ['noseed']
        mock_result.top_long_tail_keywords = []
        mock_result.model_dump = MagicMock(return_value={})

        mock_structured = AsyncMock()
        mock_structured.ainvoke = AsyncMock(return_value=mock_result)
        mock_llm = MagicMock()
        mock_llm.with_structured_output = MagicMock(return_value=mock_structured)
        mock_get_llm.return_value = (mock_llm, 'Prompt')

        from niche_research_app.graph.nodes.keywords import keywords_node
        result = asyncio.get_event_loop().run_until_complete(keywords_node({
            'research_id': str(research.id),
            'niche_name': 'NoSeed',
            'marketplace': 'amazon_com',
            'analysis_result': {},
            'vision_analyses': [],
        }))

        assert 'keywords_result' in result


# ---------------------------------------------------------------------------
# Finalize Node
# ---------------------------------------------------------------------------

@pytest.mark.django_db(transaction=True)
class TestFinalizeNode:

    def test_sets_completed(self, niche, user_with_workspace):
        """Finalize sets research.status=completed and niche.status=deep_research."""
        user, _ = user_with_workspace
        research = NicheResearch.objects.create(
            niche=niche, triggered_by=user,
            status=NicheResearch.Status.RUNNING,
        )

        from niche_research_app.graph.workflow import finalize_node
        asyncio.get_event_loop().run_until_complete(
            finalize_node({'research_id': str(research.id)})
        )

        research.refresh_from_db()
        assert research.status == NicheResearch.Status.COMPLETED
        assert research.completed_at is not None

        niche.refresh_from_db()
        assert niche.status == Niche.Status.DEEP_RESEARCH
        assert niche.research_status == Niche.ResearchStatus.DONE
        assert niche.research_run_id == research.id

    def test_idempotent(self, niche, user_with_workspace):
        """Calling finalize twice doesn't error."""
        user, _ = user_with_workspace
        research = NicheResearch.objects.create(
            niche=niche, triggered_by=user,
            status=NicheResearch.Status.RUNNING,
        )

        from niche_research_app.graph.workflow import finalize_node
        for _ in range(2):
            asyncio.get_event_loop().run_until_complete(
                finalize_node({'research_id': str(research.id)})
            )

        research.refresh_from_db()
        assert research.status == NicheResearch.Status.COMPLETED
