import uuid
from django.db import models
from django.utils import timezone
from datetime import timedelta


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
        T_SHIRT = 't_shirt', 'T-Shirt'
        HOODIE = 'hoodie', 'Hoodie'
        PULLOVER = 'pullover', 'Pullover'
        ZIP_HOODIE = 'zip_hoodie', 'Zip Hoodie'
        LONG_SLEEVE = 'long_sleeve', 'Long Sleeve'
        TANK_TOP = 'tank_top', 'Tank Top'
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
    feature_bullets = models.JSONField(default=list, blank=True)
    description = models.TextField(blank=True, default='')
    variants = models.JSONField(default=dict, blank=True)
    image_gallery = models.JSONField(default=list, blank=True)
    scraped_at = models.DateTimeField(null=True, blank=True, db_index=True)
    keywords = models.ManyToManyField(Keyword, related_name='products', blank=True)

    class Meta:
        unique_together = ('asin', 'marketplace')

    def __str__(self):
        return f"{self.asin} - {self.title[:50]}" if self.title else self.asin


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


class ScrapeJob(models.Model):
    class Mode(models.TextChoices):
        LIVE = 'live', 'Live Research'
        SCHEDULED = 'scheduled', 'Scheduled Scrape'
        BSR_SNAPSHOT = 'bsr_snapshot', 'BSR Snapshot'

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
        T_SHIRT = 't_shirt', 'T-Shirt'
        HOODIE = 'hoodie', 'Hoodie'
        PULLOVER = 'pullover', 'Pullover'
        ZIP_HOODIE = 'zip_hoodie', 'Zip Hoodie'
        LONG_SLEEVE = 'long_sleeve', 'Long Sleeve'
        TANK_TOP = 'tank_top', 'Tank Top'

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
    pages_total = models.IntegerField(default=4)
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


PRODUCT_TYPE_SPIDER_KWARGS = {
    't_shirt': {
        'search_index': 'fashion-novelty',
        'seller_filter': 'ATVPDKIKX0DER',
        'hidden_keywords': 'Lightweight, Classic fit, Double-needle sleeve and bottom hem -Longsleeve -Raglan -Vneck -Tanktop',
    },
    'hoodie': {
        'search_index': 'fashion-novelty',
        'seller_filter': 'ATVPDKIKX0DER',
        'hidden_keywords': 'Hoodie -Tanktop -Vneck -Longsleeve',
    },
    'pullover': {
        'search_index': 'fashion-novelty',
        'seller_filter': 'ATVPDKIKX0DER',
        'hidden_keywords': 'Pullover Sweatshirt -Hoodie -Tanktop -Vneck',
    },
    'zip_hoodie': {
        'search_index': 'fashion-novelty',
        'seller_filter': 'ATVPDKIKX0DER',
        'hidden_keywords': 'Zip Hoodie -Pullover -Tanktop',
    },
    'long_sleeve': {
        'search_index': 'fashion-novelty',
        'seller_filter': 'ATVPDKIKX0DER',
        'hidden_keywords': 'Long Sleeve -Hoodie -Tanktop -Vneck',
    },
    'tank_top': {
        'search_index': 'fashion-novelty',
        'seller_filter': 'ATVPDKIKX0DER',
        'hidden_keywords': 'Tank Top -Hoodie -Longsleeve',
    },
}


class ProductSearchCache(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

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
