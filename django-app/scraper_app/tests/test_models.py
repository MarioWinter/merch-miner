import pytest
from decimal import Decimal
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from scraper_app.models import (
    AmazonProduct,
    BSRSnapshot,
    Keyword,
    MarketplaceChoices,
    MetaKeyword,
    SearchKeywordResult,
    ProductSearchCache,
    ScrapeTier,
    ScrapeJob,
    ScheduledScrapeTarget,
)

pytestmark = pytest.mark.django_db


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
def product():
    return AmazonProduct.objects.create(
        asin="B0TEST00001",
        marketplace=MarketplaceChoices.AMAZON_COM,
        title="Test Product",
        brand="Test Brand",
        bsr=5000,
        price=Decimal("19.99"),
        rating=4.5,
        reviews_count=100,
    )


@pytest.fixture
def keyword():
    return Keyword.objects.create(
        keyword="test keyword",
        marketplace=MarketplaceChoices.AMAZON_COM,
    )


# ------------------------------------------------------------------
# Unique constraints
# ------------------------------------------------------------------


class TestUniqueConstraints:
    def test_amazon_product_unique_together(self, product):
        """Same asin+marketplace raises IntegrityError; different marketplace OK."""
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                AmazonProduct.objects.create(
                    asin="B0TEST00001",
                    marketplace=MarketplaceChoices.AMAZON_COM,
                    title="Duplicate",
                )

        # Different marketplace should succeed (savepoint rolled back above)
        p2 = AmazonProduct.objects.create(
            asin="B0TEST00001",
            marketplace=MarketplaceChoices.AMAZON_DE,
            title="Same ASIN, DE",
        )
        assert p2.pk is not None

    def test_keyword_unique_together(self, keyword):
        """Same keyword+marketplace raises IntegrityError."""
        with pytest.raises(IntegrityError):
            Keyword.objects.create(
                keyword="test keyword",
                marketplace=MarketplaceChoices.AMAZON_COM,
            )


# ------------------------------------------------------------------
# ScheduledScrapeTarget next_scrape_at
# ------------------------------------------------------------------


class TestScheduledScrapeTargetNextScrapeAt:
    def test_next_scrape_at_new_target(self, scrape_tiers):
        """When last_scraped_at is None, next_scrape_at ~ now()."""
        tier1, _, _ = scrape_tiers
        before = timezone.now()
        target = ScheduledScrapeTarget.objects.create(
            asin="B0TEST00001",
            marketplace=MarketplaceChoices.AMAZON_COM,
            tier=tier1,
        )
        after = timezone.now()
        assert before <= target.next_scrape_at <= after

    def test_next_scrape_at_existing_target(self, scrape_tiers):
        """When last_scraped_at is set, next_scrape_at = last + interval."""
        tier1, _, _ = scrape_tiers
        last = timezone.now() - timedelta(hours=12)
        target = ScheduledScrapeTarget.objects.create(
            asin="B0TEST00001",
            marketplace=MarketplaceChoices.AMAZON_COM,
            tier=tier1,
            last_scraped_at=last,
        )
        expected = last + timedelta(days=tier1.interval_days)
        assert target.next_scrape_at == expected


# ------------------------------------------------------------------
# ScrapeTier.get_tier_for_bsr
# ------------------------------------------------------------------


class TestScrapeTierAssignment:
    def test_tier1(self, scrape_tiers):
        tier = ScrapeTier.get_tier_for_bsr(1)
        assert tier.name == "Tier 1"

    def test_tier2(self, scrape_tiers):
        tier = ScrapeTier.get_tier_for_bsr(50001)
        assert tier.name == "Tier 2"

    def test_tier3(self, scrape_tiers):
        tier = ScrapeTier.get_tier_for_bsr(200001)
        assert tier.name == "Tier 3"

    def test_boundary_50000_is_tier1(self, scrape_tiers):
        """BSR=50000 falls in Tier 1 (inclusive upper boundary)."""
        tier = ScrapeTier.get_tier_for_bsr(50000)
        assert tier.name == "Tier 1"

    def test_none_bsr_returns_highest_tier(self, scrape_tiers):
        """None BSR returns the tier with the highest bsr_min (fallback)."""
        tier = ScrapeTier.get_tier_for_bsr(None)
        assert tier.name == "Tier 3"


# ------------------------------------------------------------------
# BSRSnapshot
# ------------------------------------------------------------------


class TestBSRSnapshot:
    def test_creation_links_to_product(self, product):
        snapshot = BSRSnapshot.objects.create(
            product=product,
            bsr=5000,
            rating=4.5,
            price=Decimal("19.99"),
        )
        assert snapshot.product == product
        assert snapshot.bsr == 5000
        assert snapshot.rating == 4.5
        assert snapshot.price == Decimal("19.99")
        assert snapshot.recorded_at is not None


# ------------------------------------------------------------------
# AmazonProduct JSONField
# ------------------------------------------------------------------


class TestAmazonProductBSRCategories:
    def test_bsr_categories_json_roundtrip(self):
        categories = [
            {"rank": 5000, "category": "Clothing", "category_url": "/clothing"},
            {"rank": 12000, "category": "Novelty", "category_url": "/novelty"},
        ]
        product = AmazonProduct.objects.create(
            asin="B0JSON00001",
            marketplace=MarketplaceChoices.AMAZON_COM,
            bsr_categories=categories,
        )
        product.refresh_from_db()
        assert product.bsr_categories == categories
        assert len(product.bsr_categories) == 2
        assert product.bsr_categories[0]["rank"] == 5000



# ------------------------------------------------------------------
# ScrapeJob.error_count
# ------------------------------------------------------------------


class TestScrapeJobErrorCount:
    def test_empty_error_log(self):
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            marketplace=MarketplaceChoices.AMAZON_COM,
        )
        assert job.error_count == 0

    def test_single_error(self):
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            marketplace=MarketplaceChoices.AMAZON_COM,
            error_log="ERROR: selector failed",
        )
        assert job.error_count == 1

    def test_multiple_errors(self):
        errors = "Error 1\n---\nError 2\n---\nError 3"
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            marketplace=MarketplaceChoices.AMAZON_COM,
            error_log=errors,
        )
        assert job.error_count == 3

    def test_whitespace_only_error_log(self):
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            marketplace=MarketplaceChoices.AMAZON_COM,
            error_log="   ",
        )
        assert job.error_count == 0


# ------------------------------------------------------------------
# ScrapeJob.product_type_filter
# ------------------------------------------------------------------


class TestScrapeJobProductTypeFilter:
    def test_default_empty(self):
        """product_type_filter defaults to '' (all products)."""
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            marketplace=MarketplaceChoices.AMAZON_COM,
        )
        assert job.product_type_filter == ''

    def test_valid_choices(self):
        """product_type_filter accepts all defined choices."""
        valid = [
            '', 't_shirt', 'premium_shirt', 'comfort_colors', 'v_neck',
            'long_sleeve', 'raglan', 'sweatshirt', 'hoodie',
            'performance_polo', 'zip_hoodie', 'popsocket', 'phone_case',
            'tote_bag', 'tumbler', 'ceramic_mug', 'tank_top',
        ]
        for choice in valid:
            job = ScrapeJob.objects.create(
                mode=ScrapeJob.Mode.LIVE,
                marketplace=MarketplaceChoices.AMAZON_COM,
                product_type_filter=choice,
            )
            assert job.product_type_filter == choice
            job.delete()

    def test_stored_and_retrieved(self):
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            marketplace=MarketplaceChoices.AMAZON_COM,
            product_type_filter='t_shirt',
        )
        job.refresh_from_db()
        assert job.product_type_filter == 't_shirt'


class TestScrapeJobSearchPageOnlyMode:
    def test_search_page_only_mode_exists(self):
        """search_page_only is a valid Mode choice."""
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.SEARCH_PAGE_ONLY,
            marketplace=MarketplaceChoices.AMAZON_COM,
        )
        job.refresh_from_db()
        assert job.mode == 'search_page_only'


# ------------------------------------------------------------------
# ScrapeJob.max_items
# ------------------------------------------------------------------


class TestScrapeJobMaxItems:
    def test_default_null(self):
        """max_items defaults to None (null=True)."""
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            marketplace=MarketplaceChoices.AMAZON_COM,
        )
        assert job.max_items is None

    def test_accepts_positive_integer(self):
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            marketplace=MarketplaceChoices.AMAZON_COM,
            max_items=50,
        )
        job.refresh_from_db()
        assert job.max_items == 50


# ------------------------------------------------------------------
# AmazonProduct bullet_1 / bullet_2
# ------------------------------------------------------------------


class TestAmazonProductBullets:
    def test_bullet_fields_default_empty(self):
        product = AmazonProduct.objects.create(
            asin="B0BULLET001",
            marketplace=MarketplaceChoices.AMAZON_COM,
        )
        assert product.bullet_1 == ''
        assert product.bullet_2 == ''

    def test_bullet_fields_stored(self):
        product = AmazonProduct.objects.create(
            asin="B0BULLET002",
            marketplace=MarketplaceChoices.AMAZON_COM,
            bullet_1="Perfect gift for bus drivers",
            bullet_2="Great for birthdays and holidays",
        )
        product.refresh_from_db()
        assert product.bullet_1 == "Perfect gift for bus drivers"
        assert product.bullet_2 == "Great for birthdays and holidays"


# ------------------------------------------------------------------
# MetaKeyword (Task 8.1)
# ------------------------------------------------------------------


class TestMetaKeyword:
    def test_creation(self):
        mk = MetaKeyword.objects.create(
            keyword="cat", type=MetaKeyword.KeywordType.SHORT_TAIL, frequency=10,
        )
        assert mk.keyword == "cat"
        assert mk.type == "short_tail"
        assert mk.frequency == 10

    def test_unique_together(self):
        MetaKeyword.objects.create(
            keyword="cat", type=MetaKeyword.KeywordType.SHORT_TAIL,
        )
        with pytest.raises(IntegrityError):
            MetaKeyword.objects.create(
                keyword="cat", type=MetaKeyword.KeywordType.SHORT_TAIL,
            )

    def test_same_keyword_different_type(self):
        MetaKeyword.objects.create(
            keyword="cat lover", type=MetaKeyword.KeywordType.SHORT_TAIL,
        )
        mk2 = MetaKeyword.objects.create(
            keyword="cat lover", type=MetaKeyword.KeywordType.LONG_TAIL,
        )
        assert mk2.pk is not None

    def test_search_keywords_m2m(self, keyword):
        mk = MetaKeyword.objects.create(
            keyword="cat", type=MetaKeyword.KeywordType.SHORT_TAIL,
        )
        mk.search_keywords.add(keyword)
        assert keyword in mk.search_keywords.all()

    def test_product_m2m(self, product):
        mk = MetaKeyword.objects.create(
            keyword="cat", type=MetaKeyword.KeywordType.SHORT_TAIL,
        )
        product.meta_keywords.add(mk)
        assert mk in product.meta_keywords.all()


# ------------------------------------------------------------------
# SearchKeywordResult (Task 8.1)
# ------------------------------------------------------------------


class TestSearchKeywordResult:
    def test_creation(self, keyword):
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            keyword=keyword,
            marketplace=MarketplaceChoices.AMAZON_COM,
        )
        cache = ProductSearchCache.objects.create(
            keyword=keyword, scrape_job=job,
        )
        skr = SearchKeywordResult.objects.create(
            search_cache=cache,
            top_focus_keywords=[{"keyword": "cat", "frequency": 10}],
            top_long_tail_keywords=[{"keyword": "funny cat", "frequency": 5}],
            all_keywords_flat="cat, funny cat",
        )
        assert skr.created_at is not None
        assert skr.top_focus_keywords[0]["keyword"] == "cat"

    def test_one_to_one(self, keyword):
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            keyword=keyword,
            marketplace=MarketplaceChoices.AMAZON_COM,
        )
        cache = ProductSearchCache.objects.create(
            keyword=keyword, scrape_job=job,
        )
        SearchKeywordResult.objects.create(search_cache=cache)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                SearchKeywordResult.objects.create(search_cache=cache)


# ------------------------------------------------------------------
# ScrapeJob sort_by / price_min / price_max / browse_node (Phase 14)
# ------------------------------------------------------------------


class TestScrapeJobSortAndFilterFields:
    def test_sort_by_default_empty(self):
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            marketplace=MarketplaceChoices.AMAZON_COM,
        )
        assert job.sort_by == ''

    def test_sort_by_valid_choices(self):
        valid = [
            '', 'exact-aware-popularity-rank', 'featured-rank',
            'date-desc-rank', 'price-asc-rank', 'price-desc-rank', 'review-rank',
        ]
        for choice in valid:
            job = ScrapeJob.objects.create(
                mode=ScrapeJob.Mode.LIVE,
                marketplace=MarketplaceChoices.AMAZON_COM,
                sort_by=choice,
            )
            job.refresh_from_db()
            assert job.sort_by == choice
            job.delete()

    def test_price_min_max_stored(self):
        from decimal import Decimal
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            marketplace=MarketplaceChoices.AMAZON_COM,
            price_min=Decimal('9.99'),
            price_max=Decimal('29.99'),
        )
        job.refresh_from_db()
        assert job.price_min == Decimal('9.99')
        assert job.price_max == Decimal('29.99')

    def test_price_min_max_default_null(self):
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            marketplace=MarketplaceChoices.AMAZON_COM,
        )
        assert job.price_min is None
        assert job.price_max is None

    def test_browse_node_default_empty(self):
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            marketplace=MarketplaceChoices.AMAZON_COM,
        )
        assert job.browse_node == ''

    def test_browse_node_stored(self):
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            marketplace=MarketplaceChoices.AMAZON_COM,
            browse_node='12035955011',
        )
        job.refresh_from_db()
        assert job.browse_node == '12035955011'

    def test_pages_total_default_2(self):
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            marketplace=MarketplaceChoices.AMAZON_COM,
        )
        assert job.pages_total == 2

    def test_pages_total_max_400_accepted(self):
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            marketplace=MarketplaceChoices.AMAZON_COM,
            pages_total=400,
        )
        job.refresh_from_db()
        assert job.pages_total == 400

    def test_pages_total_max_validator(self):
        from django.core.exceptions import ValidationError
        job = ScrapeJob(
            mode=ScrapeJob.Mode.LIVE,
            marketplace=MarketplaceChoices.AMAZON_COM,
            pages_total=401,
        )
        with pytest.raises(ValidationError):
            job.full_clean()

    def test_pages_total_min_validator(self):
        from django.core.exceptions import ValidationError
        job = ScrapeJob(
            mode=ScrapeJob.Mode.LIVE,
            marketplace=MarketplaceChoices.AMAZON_COM,
            pages_total=0,
        )
        with pytest.raises(ValidationError):
            job.full_clean()


# ------------------------------------------------------------------
# ProductSearchCache extended cache key fields (Phase 14)
# ------------------------------------------------------------------


class TestProductSearchCacheExtendedFields:
    def test_sort_by_default_empty(self, keyword):
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            marketplace=MarketplaceChoices.AMAZON_COM,
        )
        cache = ProductSearchCache.objects.create(
            keyword=keyword, scrape_job=job,
        )
        assert cache.sort_by == ''
        assert cache.price_min is None
        assert cache.price_max is None
        assert cache.browse_node == ''

    def test_extended_fields_stored(self, keyword):
        from decimal import Decimal
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            marketplace=MarketplaceChoices.AMAZON_COM,
        )
        cache = ProductSearchCache.objects.create(
            keyword=keyword, scrape_job=job,
            sort_by='date-desc-rank',
            price_min=Decimal('5.00'),
            price_max=Decimal('25.00'),
            browse_node='12035955011',
        )
        cache.refresh_from_db()
        assert cache.sort_by == 'date-desc-rank'
        assert cache.price_min == Decimal('5.00')
        assert cache.price_max == Decimal('25.00')
        assert cache.browse_node == '12035955011'

    def test_different_sort_creates_separate_cache(self, keyword):
        """Two caches with same keyword but different sort_by are separate rows."""
        job1 = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            marketplace=MarketplaceChoices.AMAZON_COM,
        )
        job2 = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            marketplace=MarketplaceChoices.AMAZON_COM,
        )
        c1 = ProductSearchCache.objects.create(
            keyword=keyword, scrape_job=job1, sort_by='',
        )
        c2 = ProductSearchCache.objects.create(
            keyword=keyword, scrape_job=job2, sort_by='date-desc-rank',
        )
        assert c1.pk != c2.pk
        assert ProductSearchCache.objects.filter(keyword=keyword).count() == 2
