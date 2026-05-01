import uuid
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.utils import timezone
from datetime import timedelta


ASIN_REGEX_VALIDATOR = RegexValidator(
    regex=r'^[A-Z0-9]{10}$',
    message='ASIN must be exactly 10 uppercase alphanumeric characters.',
)


class MarketplaceChoices(models.TextChoices):
    AMAZON_COM = 'amazon_com', 'Amazon.com (US)'
    AMAZON_DE = 'amazon_de', 'Amazon.de (DE)'
    AMAZON_CO_UK = 'amazon_co_uk', 'Amazon.co.uk (UK)'
    AMAZON_FR = 'amazon_fr', 'Amazon.fr (FR)'
    AMAZON_IT = 'amazon_it', 'Amazon.it (IT)'
    AMAZON_ES = 'amazon_es', 'Amazon.es (ES)'


class Keyword(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    keyword = models.CharField(max_length=200, db_index=True)
    marketplace = models.CharField(
        max_length=20,
        choices=MarketplaceChoices.choices,
        db_index=True,
    )

    class Meta:
        unique_together = ('keyword', 'marketplace')

    def __str__(self):
        return f"{self.keyword} ({self.marketplace})"


class AmazonProduct(models.Model):
    class ProductType(models.TextChoices):
        T_SHIRT = 't_shirt', 'T-Shirt (Standard)'
        PREMIUM_SHIRT = 'premium_shirt', 'Premium Shirt'
        COMFORT_COLORS = 'comfort_colors', 'Comfort Colors'
        V_NECK = 'v_neck', 'V-Neck'
        LONG_SLEEVE = 'long_sleeve', 'Long Sleeve'
        RAGLAN = 'raglan', 'Raglan'
        SWEATSHIRT = 'sweatshirt', 'Sweatshirt'
        HOODIE = 'hoodie', 'Hoodie'
        PERFORMANCE_POLO = 'performance_polo', 'Performance Polo'
        ZIP_HOODIE = 'zip_hoodie', 'Zip Hoodie'
        POPSOCKET = 'popsocket', 'PopSocket'
        PHONE_CASE = 'phone_case', 'Phone Case'
        TOTE_BAG = 'tote_bag', 'Tote Bag'
        TUMBLER = 'tumbler', 'Tumbler'
        CERAMIC_MUG = 'ceramic_mug', 'Ceramic Mug'
        TANK_TOP = 'tank_top', 'Tank Top'
        # NOTE: 'pullover' removed in favor of 'sweatshirt' (2026-03-29).
        # Existing DB rows with product_type='pullover' are orphaned but harmless
        # (CharField still stores the string, just no longer a valid choice).
        OTHER = 'other', 'Other'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    asin = models.CharField(max_length=20, db_index=True)
    marketplace = models.CharField(
        max_length=20,
        choices=MarketplaceChoices.choices,
        db_index=True,
    )
    title = models.TextField(blank=True, default='')
    brand = models.CharField(max_length=200, blank=True, default='')
    bsr = models.IntegerField(null=True, blank=True, db_index=True)
    bsr_categories = models.JSONField(default=list, blank=True)
    category = models.CharField(max_length=200, blank=True, default='')
    subcategory = models.CharField(max_length=200, blank=True, default='')
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    rating = models.FloatField(null=True, blank=True)
    reviews_count = models.IntegerField(null=True, blank=True)
    listed_date = models.DateField(null=True, blank=True)
    product_type = models.CharField(
        max_length=20,
        choices=ProductType.choices,
        default=ProductType.OTHER,
        db_index=True,
    )
    thumbnail_url = models.URLField(max_length=2048, blank=True, default='')
    product_url = models.URLField(max_length=2048, blank=True, default='')
    seller_name = models.CharField(max_length=200, blank=True, default='')
    bullet_1 = models.TextField(blank=True, default='')
    bullet_2 = models.TextField(blank=True, default='')
    description = models.TextField(blank=True, default='')
    variants = models.JSONField(default=dict, blank=True)
    image_gallery = models.JSONField(default=list, blank=True)
    prompt_analysis = models.JSONField(
        null=True,
        blank=True,
        default=None,
        help_text='Gemini 3 Architect 7-step image analysis output',
    )
    scraped_at = models.DateTimeField(null=True, blank=True, db_index=True)
    keywords = models.ManyToManyField(Keyword, related_name='products', blank=True)
    meta_keywords = models.ManyToManyField('MetaKeyword', related_name='products', blank=True)

    class Meta:
        unique_together = ('asin', 'marketplace')

    def __str__(self):
        return f"{self.asin} - {self.title[:50]}" if self.title else self.asin

    def get_embedding_text(self):
        """Return text to embed for vector search."""
        parts = filter(None, [
            self.title, self.brand,
            self.bullet_1, self.bullet_2,
        ])
        return ' '.join(parts)


class ScrapeTier(models.Model):
    name = models.CharField(max_length=50)
    bsr_min = models.IntegerField()
    bsr_max = models.IntegerField(null=True, blank=True)
    interval_days = models.IntegerField()

    class Meta:
        ordering = ['bsr_min']

    def __str__(self):
        max_str = str(self.bsr_max) if self.bsr_max else 'unlimited'
        return f"{self.name} (BSR {self.bsr_min}-{max_str}, every {self.interval_days}d)"

    @classmethod
    def get_tier_for_bsr(cls, bsr_value):
        """Return the ScrapeTier matching a given BSR value."""
        if bsr_value is None:
            return cls.objects.order_by('-bsr_min').first()
        return cls.objects.filter(
            bsr_min__lte=bsr_value,
        ).filter(
            models.Q(bsr_max__gte=bsr_value) | models.Q(bsr_max__isnull=True)
        ).first()


class MetaKeyword(models.Model):
    class KeywordType(models.TextChoices):
        SHORT_TAIL = 'short_tail', 'Short Tail'
        LONG_TAIL = 'long_tail', 'Long Tail'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    keyword = models.CharField(max_length=200, db_index=True)
    type = models.CharField(max_length=20, choices=KeywordType.choices, db_index=True)
    frequency = models.IntegerField(default=0)
    search_keywords = models.ManyToManyField(
        'Keyword', related_name='meta_keywords', blank=True,
    )

    class Meta:
        unique_together = ('keyword', 'type')

    def __str__(self):
        return f"{self.keyword} ({self.type}, freq={self.frequency})"


class ScrapeJob(models.Model):
    class Mode(models.TextChoices):
        LIVE = 'live', 'Live Research'
        SCHEDULED = 'scheduled', 'Scheduled Scrape'
        BSR_SNAPSHOT = 'bsr_snapshot', 'BSR Snapshot'
        SEARCH_PAGE_ONLY = 'search_page_only', 'Search Page Only'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        RUNNING = 'running', 'Running'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'
        CANCELLED = 'cancelled', 'Cancelled'

    class CancelledBy(models.TextChoices):
        ADMIN = 'admin', 'Admin'
        USER = 'user', 'User'

    class ProductTypeFilter(models.TextChoices):
        ALL = '', 'All Products (no filter)'
        T_SHIRT = 't_shirt', 'T-Shirt (Standard)'
        PREMIUM_SHIRT = 'premium_shirt', 'Premium Shirt'
        COMFORT_COLORS = 'comfort_colors', 'Comfort Colors'
        V_NECK = 'v_neck', 'V-Neck'
        LONG_SLEEVE = 'long_sleeve', 'Long Sleeve'
        RAGLAN = 'raglan', 'Raglan'
        SWEATSHIRT = 'sweatshirt', 'Sweatshirt'
        HOODIE = 'hoodie', 'Hoodie'
        PERFORMANCE_POLO = 'performance_polo', 'Performance Polo'
        ZIP_HOODIE = 'zip_hoodie', 'Zip Hoodie'
        POPSOCKET = 'popsocket', 'PopSocket'
        PHONE_CASE = 'phone_case', 'Phone Case'
        TOTE_BAG = 'tote_bag', 'Tote Bag'
        TUMBLER = 'tumbler', 'Tumbler'
        CERAMIC_MUG = 'ceramic_mug', 'Ceramic Mug'
        TANK_TOP = 'tank_top', 'Tank Top'

    class SortBy(models.TextChoices):
        RELEVANCE = '', 'Relevance'
        BEST_SELLERS = 'exact-aware-popularity-rank', 'Best Sellers'
        FEATURED = 'featured-rank', 'Featured'
        NEWEST = 'date-desc-rank', 'Newest Arrivals'
        PRICE_LOW_HIGH = 'price-asc-rank', 'Price: Low to High'
        PRICE_HIGH_LOW = 'price-desc-rank', 'Price: High to Low'
        AVG_REVIEW = 'review-rank', 'Avg. Customer Review'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mode = models.CharField(max_length=20, choices=Mode.choices, db_index=True)
    keyword = models.ForeignKey(
        Keyword,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='scrape_jobs',
    )
    asin = models.CharField(max_length=20, blank=True, default='')
    marketplace = models.CharField(
        max_length=20,
        choices=MarketplaceChoices.choices,
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    product_type_filter = models.CharField(
        max_length=20,
        choices=ProductTypeFilter.choices,
        blank=True,
        default='',
        help_text='Filter Amazon search to specific MBA product type',
    )
    sort_by = models.CharField(
        max_length=50,
        choices=SortBy.choices,
        blank=True,
        default='',
        help_text='Amazon search sort parameter',
    )
    price_min = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text='Minimum price filter (USD)',
    )
    price_max = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text='Maximum price filter (USD)',
    )
    browse_node = models.CharField(
        max_length=20, blank=True, default='',
        help_text='Amazon browse node ID for category filtering',
    )
    pages_total = models.IntegerField(
        default=2,
        validators=[MinValueValidator(1), MaxValueValidator(400)],
    )
    start_page = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        help_text='First search result page to scrape (default: 1)',
    )
    max_items = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Max products to scrape. Leave empty for all.',
    )
    pages_done = models.IntegerField(default=0)
    products_scraped = models.IntegerField(default=0)
    error_log = models.TextField(blank=True, default='')
    pid = models.IntegerField(null=True, blank=True)
    cancelled_by = models.CharField(
        max_length=10,
        choices=CancelledBy.choices,
        null=True,
        blank=True,
    )
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    rq_job_id = models.CharField(max_length=100, blank=True, default='')

    class Meta:
        ordering = ['-started_at']

    def __str__(self):
        target = str(self.keyword) if self.keyword else self.asin or 'unknown'
        return f"ScrapeJob [{self.mode}] {target} ({self.status})"

    @property
    def error_count(self):
        if not self.error_log or not self.error_log.strip():
            return 0
        return self.error_log.count('\n---\n') + 1


# MBA product type → Amazon search URL parameters.
# Extracted from real Amazon MBA search URLs (2026-03-29).
# browse_node: '' means no &bbn= param needed.
# hidden_keywords: '' means keyword alone is sufficient (e.g. "raglan", "popsocket").
# seller_filter: ATVPDKIKX0DER = Amazon as seller (filters to MBA products).
PRODUCT_TYPE_SPIDER_KWARGS = {
    't_shirt': {
        'search_index': 'fashion-novelty',
        'browse_node': '12035955011',
        'hidden_keywords': 'Lightweight, Classic fit, Double-needle sleeve and bottom hem -Longsleeve -Raglan -Vneck -Tanktop',
        'seller_filter': 'ATVPDKIKX0DER',
    },
    'premium_shirt': {
        'search_index': 'fashion-novelty',
        'browse_node': '12035955011',
        'hidden_keywords': 'This premium t-shirt is made of lightweight fine jersey fabric Mens fit runs small size up for a looser fit',
        'seller_filter': 'ATVPDKIKX0DER',
    },
    'comfort_colors': {
        'search_index': 'fashion-mens',
        'browse_node': '',
        'hidden_keywords': 'Merch on Demand Comfort Colors Heavyweight T Shirt',
        'seller_filter': 'ATVPDKIKX0DER',
    },
    'v_neck': {
        'search_index': 'fashion-novelty',
        'browse_node': '',
        'hidden_keywords': 'v-neck Lightweight, Classic fit, Double-needle sleeve and bottom hem',
        'seller_filter': 'ATVPDKIKX0DER',
    },
    'long_sleeve': {
        'search_index': 'fashion-novelty',
        'browse_node': '12035955011',
        'hidden_keywords': '"Lightweight, Classic fit, Double-needle sleeve and bottom hem" "long sleeve"',
        'seller_filter': 'ATVPDKIKX0DER',
    },
    'raglan': {
        'search_index': 'fashion-novelty',
        'browse_node': '12035955011',
        'hidden_keywords': '',
        'seller_filter': 'ATVPDKIKX0DER',
    },
    'sweatshirt': {
        'search_index': 'fashion-novelty',
        'browse_node': '12035955011',
        'hidden_keywords': '"8.5 oz, Classic fit, Twill-taped neck" "sweatshirt" -hoodie',
        'seller_filter': 'ATVPDKIKX0DER',
    },
    'hoodie': {
        'search_index': 'fashion',
        'browse_node': '',
        'hidden_keywords': '8.5 oz, Classic fit, Twill-taped neck hoodie',
        'seller_filter': 'ATVPDKIKX0DER',
    },
    'performance_polo': {
        'search_index': 'fashion-mens',
        'browse_node': '',
        'hidden_keywords': 'Merch on Demand Performance Polo Shirt',
        'seller_filter': 'ATVPDKIKX0DER',
    },
    'zip_hoodie': {
        'search_index': 'fashion-mens',
        'browse_node': '',
        'hidden_keywords': 'Merch on Demand Performance Quarter Zip Top',
        'seller_filter': 'ATVPDKIKX0DER',
    },
    'popsocket': {
        'search_index': 'mobile',
        'browse_node': '',
        'hidden_keywords': '',
        'seller_filter': 'ATVPDKIKX0DER',
    },
    'phone_case': {
        'search_index': 'mobile',
        'browse_node': '',
        'hidden_keywords': 'Two-part protective case made from a premium scratch-resistant polycarbonate shell and shock absorbent TPU liner protects against drops',
        'seller_filter': 'ATVPDKIKX0DER',
    },
    'tote_bag': {
        'search_index': 'fashion-womens',
        'browse_node': '',
        'hidden_keywords': 'Graphic Tote',
        'seller_filter': 'ATVPDKIKX0DER',
    },
    'tumbler': {
        'search_index': 'kitchen',
        'browse_node': '',
        'hidden_keywords': 'Merch on Demand Stainless Steel Insulated Tumbler',
        'seller_filter': 'ATVPDKIKX0DER',
    },
    'ceramic_mug': {
        'search_index': 'kitchen',
        'browse_node': '',
        'hidden_keywords': 'Merch on Demand Ceramic Coffee Mug',
        'seller_filter': 'ATVPDKIKX0DER',
    },
    'tank_top': {
        'search_index': 'fashion-novelty',
        'browse_node': '',
        'hidden_keywords': 'Tank Top',
        'seller_filter': 'ATVPDKIKX0DER',
    },
}


class BrandBlacklist(models.Model):
    """Trademarked/blocked brands that should be filtered from research."""

    brand_name = models.CharField(max_length=200, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['brand_name']
        verbose_name = 'Brand Blacklist'
        verbose_name_plural = 'Brand Blacklist'

    def save(self, *args, **kwargs):
        self.brand_name = self.brand_name.lower().strip()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.brand_name


class ProductSearchCache(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'
        CANCELLED = 'cancelled', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    keyword = models.ForeignKey(
        Keyword,
        on_delete=models.CASCADE,
        related_name='search_caches',
    )
    scrape_job = models.ForeignKey(
        ScrapeJob,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='search_caches',
    )
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='search_caches',
    )
    sort_by = models.CharField(max_length=50, blank=True, default='')
    price_min = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
    )
    price_max = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
    )
    browse_node = models.CharField(max_length=20, blank=True, default='')
    product_type_filter = models.CharField(max_length=20, blank=True, default='')
    last_scraped_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )

    class Meta:
        verbose_name_plural = 'Product search caches'

    def __str__(self):
        return f"Cache: {self.keyword} ({self.status})"


class SearchKeywordResult(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    search_cache = models.OneToOneField(
        ProductSearchCache,
        on_delete=models.CASCADE,
        related_name='keyword_result',
    )
    top_focus_keywords = models.JSONField(default=list, blank=True)
    top_long_tail_keywords = models.JSONField(default=list, blank=True)
    all_keywords_flat = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"KeywordResult for {self.search_cache}"


class BSRSnapshot(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(
        AmazonProduct,
        on_delete=models.CASCADE,
        related_name='bsr_snapshots',
        db_index=True,
    )
    bsr = models.IntegerField(null=True, blank=True)
    rating = models.FloatField(null=True, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    recorded_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-recorded_at']

    def __str__(self):
        return f"BSR {self.bsr} for {self.product.asin} at {self.recorded_at}"


class ScheduledScrapeTarget(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    keyword = models.ForeignKey(
        Keyword,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='scrape_targets',
    )
    asin = models.CharField(max_length=20, blank=True, default='', db_index=True)
    marketplace = models.CharField(
        max_length=20,
        choices=MarketplaceChoices.choices,
        db_index=True,
    )
    tier = models.ForeignKey(
        ScrapeTier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='targets',
    )
    tier_override = models.BooleanField(default=False)
    last_scraped_at = models.DateTimeField(null=True, blank=True)
    next_scrape_at = models.DateTimeField(db_index=True)
    active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ['next_scrape_at']

    def __str__(self):
        target = str(self.keyword) if self.keyword else self.asin or 'unknown'
        return f"Target: {target} ({self.marketplace})"

    def save(self, *args, **kwargs):
        if self.last_scraped_at and self.tier:
            self.next_scrape_at = self.last_scraped_at + timedelta(days=self.tier.interval_days)
        elif not self.next_scrape_at:
            self.next_scrape_at = timezone.now()
        super().save(*args, **kwargs)

    def update_tier_from_bsr(self, bsr_value):
        """Auto-update tier based on BSR unless tier_override is True."""
        if self.tier_override:
            return
        new_tier = ScrapeTier.get_tier_for_bsr(bsr_value)
        if new_tier and new_tier != self.tier:
            self.tier = new_tier
            self.save(update_fields=['tier', 'next_scrape_at'])


# ---------------------------------------------------------------------------
# PROJ-23: Selector Health Check
# ---------------------------------------------------------------------------

class CanaryAsin(models.Model):
    """Reference Amazon product monitored periodically to detect selector drift."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    asin = models.CharField(
        max_length=10,
        validators=[ASIN_REGEX_VALIDATOR],
        help_text='10-char Amazon ASIN (uppercase alphanumeric).',
    )
    marketplace = models.CharField(
        max_length=20,
        choices=MarketplaceChoices.choices,
        db_index=True,
    )
    label = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text='Free text label, e.g. "MBA T-Shirt EN with BSR".',
    )
    active = models.BooleanField(
        default=True,
        db_index=True,
        help_text='Inactive canaries are skipped by the weekly scheduler.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('asin', 'marketplace')
        ordering = ['marketplace', 'asin']
        verbose_name = 'Canary ASIN'
        verbose_name_plural = 'Canary ASINs'

    def __str__(self):
        return f"{self.asin} ({self.marketplace}) — {self.label}" if self.label else (
            f"{self.asin} ({self.marketplace})"
        )

    def save(self, *args, **kwargs):
        if self.asin:
            self.asin = self.asin.strip().upper()
        super().save(*args, **kwargs)


class SelectorHealthCheck(models.Model):
    """One row per audit run for a CanaryAsin.

    Stores per-field selector results (OK / EMPTY / INFO) plus a snapshot of the
    raw HTML on disk. Files are pruned after RETENTION runs per (asin,marketplace);
    rows remain but `html_path` is nulled when their snapshot is deleted.
    """

    class TriggeredBy(models.TextChoices):
        SCHEDULE = 'schedule', 'Schedule'
        ADMIN = 'admin', 'Admin'
        CLI = 'cli', 'CLI'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    canary = models.ForeignKey(
        CanaryAsin,
        on_delete=models.CASCADE,
        related_name='health_checks',
        db_index=True,
    )
    run_at = models.DateTimeField(auto_now_add=True, db_index=True)
    html_path = models.TextField(
        blank=True,
        null=True,
        help_text='Path relative to MEDIA_ROOT; nulled when snapshot is pruned.',
    )
    html_size_bytes = models.IntegerField(null=True, blank=True)
    results = models.JSONField(
        default=dict,
        blank=True,
        help_text='{"title": "OK", "brand": "OK", "bsr": "INFO", ...}',
    )
    passed = models.BooleanField(
        default=False,
        db_index=True,
        help_text='True iff zero EMPTY entries in results.',
    )
    triggered_by = models.CharField(
        max_length=20,
        choices=TriggeredBy.choices,
        default=TriggeredBy.SCHEDULE,
        db_index=True,
    )
    error_message = models.TextField(
        blank=True,
        null=True,
        help_text='Populated on spider/HTTP failure.',
    )

    class Meta:
        ordering = ['-run_at']
        verbose_name = 'Selector Health Check'
        verbose_name_plural = 'Selector Health Checks'

    def __str__(self):
        status = 'PASS' if self.passed else 'FAIL'
        return f"HealthCheck[{status}] {self.canary} @ {self.run_at:%Y-%m-%d %H:%M}"

    @property
    def failed_field_count(self):
        if not isinstance(self.results, dict):
            return 0
        return sum(1 for v in self.results.values() if v == 'EMPTY')
