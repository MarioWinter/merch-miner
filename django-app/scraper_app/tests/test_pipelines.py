import pytest
from decimal import Decimal
from unittest.mock import MagicMock

from scraper_app.models import (
    AmazonProduct,
    BSRSnapshot,
    Keyword,
    MarketplaceChoices,
    MetaKeyword,
    ProductSearchCache,
    SearchKeywordResult,
    ScrapeTier,
    ScrapeJob,
    ScheduledScrapeTarget,
)
from scraper_app.scrapy_app.items import AmazonProductItem, ScrapeErrorItem
from scraper_app.scrapy_app.pipelines import DjangoORMPipeline

pytestmark = pytest.mark.django_db


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------


def make_product_item(**overrides):
    defaults = {
        "asin": "B0TEST12345",
        "marketplace": "amazon_com",
        "title": "Test Product",
        "brand": "Test Brand",
        "bsr": 5000,
        "bsr_categories": [
            {"rank": 5000, "category": "Test Category", "category_url": "/test"},
        ],
        "category": "Test Category",
        "subcategory": "",
        "price": Decimal("19.99"),
        "rating": 4.5,
        "reviews_count": 100,
        "listed_date": None,
        "product_type": "other",
        "thumbnail_url": "https://example.com/thumb.jpg",
        "product_url": "https://www.amazon.com/dp/B0TEST12345",
        "seller_name": "Test Seller",
        "bullet_1": "Bullet 1",
        "bullet_2": "Bullet 2",
        "description": "Test description",
        "variants": {},
        "image_gallery": ["https://example.com/img1.jpg"],
        "keyword": "test keyword",
        "is_sponsored": False,
    }
    defaults.update(overrides)
    item = AmazonProductItem()
    for k, v in defaults.items():
        item[k] = v
    return item


def make_error_item(**overrides):
    defaults = {
        "failed_selector": "title",
        "url": "https://www.amazon.com/dp/B0BROKEN",
        "marketplace": "amazon_com",
        "response_status": 200,
        "error_message": "Selector returned empty after 3 retries",
    }
    defaults.update(overrides)
    item = ScrapeErrorItem()
    for k, v in defaults.items():
        item[k] = v
    return item


# ------------------------------------------------------------------
# Fixtures
# ------------------------------------------------------------------


@pytest.fixture
def scrape_tiers():
    tier1 = ScrapeTier.objects.create(name="Tier 1", bsr_min=1, bsr_max=50000, interval_days=1)
    tier2 = ScrapeTier.objects.create(name="Tier 2", bsr_min=50001, bsr_max=200000, interval_days=3)
    tier3 = ScrapeTier.objects.create(name="Tier 3", bsr_min=200001, bsr_max=None, interval_days=7)
    return tier1, tier2, tier3


@pytest.fixture
def scrape_job():
    return ScrapeJob.objects.create(
        mode=ScrapeJob.Mode.LIVE,
        marketplace=MarketplaceChoices.AMAZON_COM,
        status=ScrapeJob.Status.PENDING,
    )


@pytest.fixture
def pipeline(scrape_job):
    """Create pipeline with Django already set up (test env handles django.setup)."""
    pipe = DjangoORMPipeline()
    spider = MagicMock()
    spider.job_id = str(scrape_job.id)
    pipe.open_spider(spider)
    return pipe, spider


# ------------------------------------------------------------------
# Product create / update
# ------------------------------------------------------------------


class TestPipelineProductUpsert:
    def test_creates_new_product(self, pipeline, scrape_tiers):
        pipe, spider = pipeline
        item = make_product_item()
        pipe.process_item(item, spider)

        product = AmazonProduct.objects.get(asin="B0TEST12345", marketplace="amazon_com")
        assert product.title == "Test Product"
        assert product.brand == "Test Brand"
        assert product.bsr == 5000
        assert product.price == Decimal("19.99")
        assert product.rating == 4.5
        assert product.reviews_count == 100
        assert product.scraped_at is not None

    def test_updates_existing_product(self, pipeline, scrape_tiers):
        pipe, spider = pipeline
        # Create first
        item1 = make_product_item()
        pipe.process_item(item1, spider)

        # Update same asin+marketplace with different title
        item2 = make_product_item(title="Updated Title", brand="New Brand")
        pipe.process_item(item2, spider)

        assert AmazonProduct.objects.filter(asin="B0TEST12345").count() == 1
        product = AmazonProduct.objects.get(asin="B0TEST12345", marketplace="amazon_com")
        assert product.title == "Updated Title"
        assert product.brand == "New Brand"


# ------------------------------------------------------------------
# Keyword M2M
# ------------------------------------------------------------------


class TestPipelineKeywordLinking:
    def test_links_keyword_m2m(self, pipeline, scrape_tiers):
        pipe, spider = pipeline
        item = make_product_item(keyword="funny cat shirts")
        pipe.process_item(item, spider)

        kw = Keyword.objects.get(keyword="funny cat shirts", marketplace="amazon_com")
        product = AmazonProduct.objects.get(asin="B0TEST12345")
        assert kw in product.keywords.all()

    def test_links_multiple_keywords(self, pipeline, scrape_tiers):
        pipe, spider = pipeline
        item1 = make_product_item(keyword="keyword one")
        pipe.process_item(item1, spider)

        item2 = make_product_item(keyword="keyword two")
        pipe.process_item(item2, spider)

        product = AmazonProduct.objects.get(asin="B0TEST12345")
        kw_names = set(product.keywords.values_list("keyword", flat=True))
        assert kw_names == {"keyword one", "keyword two"}


# ------------------------------------------------------------------
# BSRSnapshot
# ------------------------------------------------------------------


class TestPipelineBSRSnapshot:
    def test_creates_bsr_snapshot(self, pipeline, scrape_tiers):
        pipe, spider = pipeline
        item = make_product_item(bsr=5000, rating=4.5, price=Decimal("19.99"))
        pipe.process_item(item, spider)

        product = AmazonProduct.objects.get(asin="B0TEST12345")
        snapshots = BSRSnapshot.objects.filter(product=product)
        assert snapshots.count() == 1
        snap = snapshots.first()
        assert snap.bsr == 5000
        assert snap.rating == 4.5
        assert snap.price == Decimal("19.99")

    def test_no_snapshot_when_bsr_none(self, pipeline, scrape_tiers):
        """BSRSnapshot is NOT created when BSR is None (search_page_only guard)."""
        pipe, spider = pipeline
        item = make_product_item(bsr=None, rating=3.5, price=Decimal("14.99"))
        pipe.process_item(item, spider)

        assert BSRSnapshot.objects.count() == 0


# ------------------------------------------------------------------
# ScheduledScrapeTarget auto-enrollment
# ------------------------------------------------------------------


class TestPipelineAutoEnroll:
    def test_auto_enrolls_scheduled_target(self, pipeline, scrape_tiers):
        pipe, spider = pipeline
        item = make_product_item(bsr=5000)
        pipe.process_item(item, spider)

        target = ScheduledScrapeTarget.objects.get(asin="B0TEST12345", marketplace="amazon_com")
        assert target.tier.name == "Tier 1"
        assert target.active is True

    def test_auto_enroll_tier2(self, pipeline, scrape_tiers):
        pipe, spider = pipeline
        item = make_product_item(bsr=100000)
        pipe.process_item(item, spider)

        target = ScheduledScrapeTarget.objects.get(asin="B0TEST12345")
        assert target.tier.name == "Tier 2"

    def test_enrollment_with_bsr_none_falls_back_to_tier3(self, pipeline, scrape_tiers):
        """BUG-P8-02: bsr=None (search_page_only) enrolls at Tier 3."""
        pipe, spider = pipeline
        item = make_product_item(bsr=None)
        pipe.process_item(item, spider)

        target = ScheduledScrapeTarget.objects.get(asin="B0TEST12345")
        assert target.tier.name == "Tier 3"
        assert target.active is True

    def test_search_page_only_item_enrolled_tier3(self, pipeline, scrape_tiers):
        """BUG-P8-02: search_page_only products (bsr=None) auto-enroll at Tier 3."""
        pipe, spider = pipeline
        item = _make_search_only_item()
        pipe.process_item(item, spider)

        target = ScheduledScrapeTarget.objects.get(asin="B0PATCH0001")
        assert target.tier.name == "Tier 3"
        assert target.active is True

    def test_auto_enroll_updates_tier_on_rescrape(self, pipeline, scrape_tiers):
        """Existing target gets tier updated when BSR changes on keyword re-scrape."""
        pipe, spider = pipeline
        # First scrape: BSR=100000 -> Tier 2
        item1 = make_product_item(bsr=100000)
        pipe.process_item(item1, spider)
        target = ScheduledScrapeTarget.objects.get(asin="B0TEST12345")
        assert target.tier.name == "Tier 2"

        # Re-scrape: BSR=5000 -> Tier 1
        item2 = make_product_item(bsr=5000)
        pipe.process_item(item2, spider)
        target.refresh_from_db()
        assert target.tier.name == "Tier 1"


# ------------------------------------------------------------------
# Error item handling
# ------------------------------------------------------------------


class TestPipelineErrorHandling:
    def test_handles_error_item(self, pipeline, scrape_job):
        pipe, spider = pipeline
        error = make_error_item()
        pipe.process_item(error, spider)

        # No product created
        assert AmazonProduct.objects.count() == 0

        # Error logged to job
        scrape_job.refresh_from_db()
        assert "SELECTOR_ERROR: title" in scrape_job.error_log
        assert "B0BROKEN" in scrape_job.error_log

    def test_multiple_errors_appended(self, pipeline, scrape_job):
        pipe, spider = pipeline
        pipe.process_item(make_error_item(failed_selector="title"), spider)
        pipe.process_item(make_error_item(failed_selector="bsr"), spider)

        scrape_job.refresh_from_db()
        assert "SELECTOR_ERROR: title" in scrape_job.error_log
        assert "SELECTOR_ERROR: bsr" in scrape_job.error_log


# ------------------------------------------------------------------
# Job progress tracking
# ------------------------------------------------------------------


class TestPipelineJobProgress:
    def test_updates_job_progress(self, pipeline, scrape_tiers, scrape_job):
        pipe, spider = pipeline
        for i in range(3):
            item = make_product_item(asin=f"B0TEST0000{i}")
            pipe.process_item(item, spider)

        scrape_job.refresh_from_db()
        assert scrape_job.products_scraped == 3


# ------------------------------------------------------------------
# BSR lowest rank
# ------------------------------------------------------------------


# ------------------------------------------------------------------
# Bullet fields
# ------------------------------------------------------------------


class TestPipelineBulletFields:
    def test_saves_bullet_1_and_bullet_2(self, pipeline, scrape_tiers):
        pipe, spider = pipeline
        item = make_product_item(bullet_1="Gift for nurses", bullet_2="Birthday present")
        pipe.process_item(item, spider)

        product = AmazonProduct.objects.get(asin="B0TEST12345")
        assert product.bullet_1 == "Gift for nurses"
        assert product.bullet_2 == "Birthday present"

    def test_empty_bullets_default_to_empty_string(self, pipeline, scrape_tiers):
        pipe, spider = pipeline
        item = make_product_item(bullet_1="", bullet_2="")
        pipe.process_item(item, spider)

        product = AmazonProduct.objects.get(asin="B0TEST12345")
        assert product.bullet_1 == ''
        assert product.bullet_2 == ''

    def test_none_bullets_stored_as_empty_string(self, pipeline, scrape_tiers):
        """Pipeline defaults None bullets to '' via `or ''`."""
        pipe, spider = pipeline
        item = make_product_item(bullet_1=None, bullet_2=None)
        pipe.process_item(item, spider)

        product = AmazonProduct.objects.get(asin="B0TEST12345")
        assert product.bullet_1 == ''
        assert product.bullet_2 == ''


# ------------------------------------------------------------------
# BSR lowest rank
# ------------------------------------------------------------------


class TestPipelineBSRLowestRank:
    def test_bsr_stored_as_primary(self, pipeline, scrape_tiers):
        """Item bsr=500 stored directly on product model."""
        pipe, spider = pipeline
        item = make_product_item(bsr=500)
        pipe.process_item(item, spider)

        product = AmazonProduct.objects.get(asin="B0TEST12345")
        assert product.bsr == 500



# ------------------------------------------------------------------
# close_spider finalization
# ------------------------------------------------------------------


class TestPipelineCloseSpider:
    def test_close_spider_sets_completed(self, pipeline, scrape_tiers, scrape_job):
        pipe, spider = pipeline
        item = make_product_item()
        pipe.process_item(item, spider)
        pipe.close_spider(spider)

        scrape_job.refresh_from_db()
        assert scrape_job.status == ScrapeJob.Status.COMPLETED
        assert scrape_job.finished_at is not None

    def test_close_spider_sets_failed_on_errors_only(self, pipeline, scrape_job):
        pipe, spider = pipeline
        pipe.process_item(make_error_item(), spider)
        pipe.close_spider(spider)

        scrape_job.refresh_from_db()
        assert scrape_job.status == ScrapeJob.Status.FAILED

    def test_close_spider_completed_with_errors_and_products(self, pipeline, scrape_tiers, scrape_job):
        """If there are errors but also products, status is completed (not failed)."""
        pipe, spider = pipeline
        pipe.process_item(make_product_item(), spider)
        pipe.process_item(make_error_item(), spider)
        pipe.close_spider(spider)

        scrape_job.refresh_from_db()
        assert scrape_job.status == ScrapeJob.Status.COMPLETED


# ------------------------------------------------------------------
# PATCH semantics
# ------------------------------------------------------------------


def _make_search_only_item(**overrides):
    """Search-page-only item: detail fields are None."""
    defaults = {
        "asin": "B0PATCH0001",
        "marketplace": "amazon_com",
        "title": "Search Title T-Shirt",
        "brand": None,
        "bsr": None,
        "bsr_categories": None,
        "category": None,
        "subcategory": None,
        "price": Decimal("15.99"),
        "rating": 4.0,
        "reviews_count": 50,
        "listed_date": None,
        "product_type": "t_shirt",
        "thumbnail_url": "https://example.com/thumb.jpg",
        "product_url": "https://www.amazon.com/dp/B0PATCH0001",
        "seller_name": None,
        "bullet_1": None,
        "bullet_2": None,
        "description": None,
        "variants": None,
        "image_gallery": None,
        "keyword": "test keyword",
        "is_sponsored": False,
    }
    defaults.update(overrides)
    item = AmazonProductItem()
    for k, v in defaults.items():
        item[k] = v
    return item


class TestPipelinePatchSemantics:
    def test_search_page_only_after_detail_preserves_detail(self, pipeline, scrape_tiers):
        """PATCH: search_page_only after detail scrape -> detail fields preserved."""
        pipe, spider = pipeline

        # First: full detail scrape
        detail_item = make_product_item(
            asin="B0PATCH0001",
            bullet_1="Real bullet 1",
            bullet_2="Real bullet 2",
            description="Full description",
            bsr=5000,
            bsr_categories=[{"rank": 5000, "category": "Test", "category_url": ""}],
        )
        pipe.process_item(detail_item, spider)

        # Second: search_page_only (detail fields None)
        search_item = _make_search_only_item(title="Updated Search Title")
        pipe.process_item(search_item, spider)

        product = AmazonProduct.objects.get(asin="B0PATCH0001")
        # Detail fields preserved (not overwritten by None)
        assert product.bullet_1 == "Real bullet 1"
        assert product.bullet_2 == "Real bullet 2"
        assert product.description == "Full description"
        assert product.bsr == 5000
        # Search fields updated
        assert product.title == "Updated Search Title"

    def test_detail_after_search_page_only_fills_detail(self, pipeline, scrape_tiers):
        """PATCH: detail scrape after search_page_only -> detail fields filled."""
        pipe, spider = pipeline

        # First: search_page_only
        search_item = _make_search_only_item()
        pipe.process_item(search_item, spider)

        product = AmazonProduct.objects.get(asin="B0PATCH0001")
        assert product.bullet_1 == ""  # Model default
        assert product.bsr is None

        # Second: full detail scrape
        detail_item = make_product_item(
            asin="B0PATCH0001",
            bullet_1="Now with bullets",
            bsr=3000,
        )
        pipe.process_item(detail_item, spider)

        product.refresh_from_db()
        assert product.bullet_1 == "Now with bullets"
        assert product.bsr == 3000

    def test_full_scrape_writes_all_fields(self, pipeline, scrape_tiers):
        """PATCH: full scrape writes all fields correctly."""
        pipe, spider = pipeline
        item = make_product_item()
        pipe.process_item(item, spider)

        product = AmazonProduct.objects.get(asin="B0TEST12345")
        assert product.title == "Test Product"
        assert product.brand == "Test Brand"
        assert product.bsr == 5000
        assert product.bullet_1 == "Bullet 1"
        assert product.bullet_2 == "Bullet 2"
        assert product.description == "Test description"


# ------------------------------------------------------------------
# BSRSnapshot guard (Task 8.6)
# ------------------------------------------------------------------


class TestPipelineBSRSnapshotGuard:
    def test_no_snapshot_for_none_bsr(self, pipeline, scrape_tiers):
        """No BSRSnapshot created when BSR is None (search_page_only)."""
        pipe, spider = pipeline
        item = _make_search_only_item()
        pipe.process_item(item, spider)

        assert BSRSnapshot.objects.count() == 0

    def test_snapshot_created_with_bsr(self, pipeline, scrape_tiers):
        """BSRSnapshot created when BSR is present."""
        pipe, spider = pipeline
        item = make_product_item(bsr=1000)
        pipe.process_item(item, spider)

        assert BSRSnapshot.objects.count() == 1
        assert BSRSnapshot.objects.first().bsr == 1000


# ------------------------------------------------------------------
# MetaKeyword integration (Task 8.8)
# ------------------------------------------------------------------


class TestPipelineMetaKeywordIntegration:
    def test_meta_keywords_created_on_close_spider(self, scrape_tiers):
        """MetaKeywords are created in close_spider for scraped products."""
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            marketplace=MarketplaceChoices.AMAZON_COM,
            status=ScrapeJob.Status.PENDING,
        )
        pipe = DjangoORMPipeline()
        spider = MagicMock()
        spider.job_id = str(job.id)
        spider.keyword = "funny cat"
        pipe.open_spider(spider)

        # Process items with MBA-relevant titles
        for i in range(3):
            item = make_product_item(
                asin=f"B0META000{i}",
                title=f"Funny Cat Teacher Gift T-Shirt {i}",
                bullet_1="Perfect gift for cat lovers",
                bullet_2="Great for teachers",
            )
            pipe.process_item(item, spider)

        pipe.close_spider(spider)

        # MetaKeywords should exist
        assert MetaKeyword.objects.exists()
        # Products should have meta_keywords M2M links
        for i in range(3):
            product = AmazonProduct.objects.get(asin=f"B0META000{i}")
            assert product.meta_keywords.count() > 0

    def test_data_basis_guard_skips_when_has_bullets(self, scrape_tiers):
        """Data-basis guard: skip MetaKeyword re-calc when search_page_only and product has bullets."""
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.SEARCH_PAGE_ONLY,
            marketplace=MarketplaceChoices.AMAZON_COM,
            status=ScrapeJob.Status.PENDING,
        )
        # Pre-create product with bullets
        product = AmazonProduct.objects.create(
            asin="B0GUARD0001",
            marketplace="amazon_com",
            title="Existing Product",
            bullet_1="Existing bullet",
            description="Existing description",
        )

        pipe = DjangoORMPipeline()
        spider = MagicMock()
        spider.job_id = str(job.id)
        spider.keyword = "test"
        pipe.open_spider(spider)

        # Simulate search_page_only item for same ASIN
        item = _make_search_only_item(asin="B0GUARD0001", title="Updated Title")
        pipe.process_item(item, spider)
        pipe.close_spider(spider)

        # Product should NOT have meta_keywords updated (guard skipped it)
        product.refresh_from_db()
        assert product.meta_keywords.count() == 0

    def test_search_keyword_result_created(self, scrape_tiers):
        """SearchKeywordResult is created with global aggregation."""
        kw = Keyword.objects.create(keyword="funny cat", marketplace="amazon_com")
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            keyword=kw,
            marketplace=MarketplaceChoices.AMAZON_COM,
            status=ScrapeJob.Status.PENDING,
        )
        cache = ProductSearchCache.objects.create(
            keyword=kw, scrape_job=job, status=ProductSearchCache.Status.PENDING,
        )

        pipe = DjangoORMPipeline()
        spider = MagicMock()
        spider.job_id = str(job.id)
        spider.keyword = "funny cat"
        pipe.open_spider(spider)

        for i in range(4):
            item = make_product_item(
                asin=f"B0SKWRD00{i}",
                title=f"Funny Cat Teacher T-Shirt {i}",
                bullet_1="Perfect gift for cat lovers",
            )
            pipe.process_item(item, spider)

        pipe.close_spider(spider)

        assert SearchKeywordResult.objects.filter(search_cache=cache).exists()
        skr = SearchKeywordResult.objects.get(search_cache=cache)
        assert isinstance(skr.top_focus_keywords, list)
        assert isinstance(skr.top_long_tail_keywords, list)
        assert isinstance(skr.all_keywords_flat, str)

    def test_meta_keyword_dedup(self, scrape_tiers):
        """MetaKeyword.get_or_create prevents duplicates."""
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            marketplace=MarketplaceChoices.AMAZON_COM,
            status=ScrapeJob.Status.PENDING,
        )
        pipe = DjangoORMPipeline()
        spider = MagicMock()
        spider.job_id = str(job.id)
        spider.keyword = "cat gift"
        pipe.open_spider(spider)

        # Two products with identical keywords
        for i in range(2):
            item = make_product_item(
                asin=f"B0DEDUP00{i}",
                title="Funny Cat Teacher Gift T-Shirt",
                bullet_1="Perfect gift for cat teachers",
            )
            pipe.process_item(item, spider)

        pipe.close_spider(spider)

        # Same keyword should not create duplicates
        for mk in MetaKeyword.objects.all():
            assert MetaKeyword.objects.filter(
                keyword=mk.keyword, type=mk.type,
            ).count() == 1

    def test_product_pk_tracking(self, pipeline, scrape_tiers):
        """Pipeline tracks scraped product PKs for close_spider extraction."""
        pipe, spider = pipeline
        item = make_product_item()
        pipe.process_item(item, spider)

        assert len(pipe.scraped_product_pks) == 1
        product = AmazonProduct.objects.get(asin="B0TEST12345")
        assert product.pk in pipe.scraped_product_pks


# ------------------------------------------------------------------
# product_unavailable handling (Sorry/Dogs-of-Amazon page)
# ------------------------------------------------------------------


class TestPipelineProductUnavailable:
    def test_marks_existing_product_unavailable(self, pipeline, scrape_tiers):
        """First Sorry-page detect: is_available=False + unavailable_since=now."""
        pipe, spider = pipeline
        product = AmazonProduct.objects.create(
            asin="B0DEAD12345", marketplace="amazon_com", title="Old product",
        )
        assert product.is_available is True
        assert product.unavailable_since is None

        item = make_error_item(
            failed_selector="product_unavailable",
            url="https://www.amazon.com/dp/B0DEAD12345/",
            error_message="Amazon returned Sorry-page (deleted product) for ASIN B0DEAD12345",
        )
        pipe.process_item(item, spider)

        product.refresh_from_db()
        assert product.is_available is False
        assert product.unavailable_since is not None

    def test_preserves_unavailable_since_on_redetect(self, pipeline, scrape_tiers):
        """Second Sorry-page detect must NOT overwrite unavailable_since."""
        from django.utils import timezone
        from datetime import timedelta

        pipe, spider = pipeline
        original_ts = timezone.now() - timedelta(days=5)
        product = AmazonProduct.objects.create(
            asin="B0DEAD12345",
            marketplace="amazon_com",
            is_available=False,
            unavailable_since=original_ts,
        )

        item = make_error_item(
            failed_selector="product_unavailable",
            url="https://www.amazon.com/dp/B0DEAD12345/",
        )
        pipe.process_item(item, spider)

        product.refresh_from_db()
        assert product.is_available is False
        assert product.unavailable_since == original_ts  # not overwritten

    def test_skips_when_no_existing_product(self, pipeline, scrape_tiers):
        """No stub row created for an unavailable ASIN we never scraped before."""
        pipe, spider = pipeline
        item = make_error_item(
            failed_selector="product_unavailable",
            url="https://www.amazon.com/dp/B0NEVER0000/",
        )
        pipe.process_item(item, spider)

        assert AmazonProduct.objects.filter(asin="B0NEVER0000").count() == 0

    def test_no_error_log_pollution(self, pipeline, scrape_tiers, scrape_job):
        """product_unavailable goes to flag, NOT scrape_job.error_log (selector_drift channel)."""
        pipe, spider = pipeline
        AmazonProduct.objects.create(asin="B0DEAD12345", marketplace="amazon_com")

        item = make_error_item(
            failed_selector="product_unavailable",
            url="https://www.amazon.com/dp/B0DEAD12345/",
        )
        pipe.process_item(item, spider)

        scrape_job.refresh_from_db()
        assert not (scrape_job.error_log or '').strip()

    def test_recovery_clears_flags(self, pipeline, scrape_tiers):
        """Successful re-scrape resets is_available + unavailable_since."""
        from django.utils import timezone

        pipe, spider = pipeline
        AmazonProduct.objects.create(
            asin="B0DEAD12345",
            marketplace="amazon_com",
            is_available=False,
            unavailable_since=timezone.now(),
        )

        item = make_product_item(asin="B0DEAD12345", title="Back from the dead")
        pipe.process_item(item, spider)

        product = AmazonProduct.objects.get(asin="B0DEAD12345")
        assert product.is_available is True
        assert product.unavailable_since is None
        assert product.title == "Back from the dead"
