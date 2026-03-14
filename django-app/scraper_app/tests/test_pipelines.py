import pytest
from decimal import Decimal
from unittest.mock import MagicMock

from scraper_app.models import (
    AmazonProduct,
    BSRSnapshot,
    Keyword,
    MarketplaceChoices,
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
        "feature_bullets": ["Bullet 1", "Bullet 2"],
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
        pipe, spider = pipeline
        item = make_product_item(bsr=None)
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

    def test_no_enrollment_without_bsr(self, pipeline, scrape_tiers):
        pipe, spider = pipeline
        item = make_product_item(bsr=None)
        pipe.process_item(item, spider)

        assert ScheduledScrapeTarget.objects.count() == 0


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
