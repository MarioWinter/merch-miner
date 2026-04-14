import uuid

from django.conf import settings
from django.db import models


class NicheKeywordGroup(models.Model):
    """Keyword group within a niche (e.g. Primary, Long-Tail, Negative)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    niche = models.ForeignKey(
        'niche_app.Niche',
        on_delete=models.CASCADE,
        related_name='keyword_groups',
        db_index=True,
    )
    name = models.CharField(max_length=100)
    position = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_keyword_groups',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('niche', 'name')]
        ordering = ['position']

    def __str__(self):
        return f"{self.name} ({self.niche})"


class NicheKeyword(models.Model):
    """A keyword collected for a niche from various sources."""

    class Source(models.TextChoices):
        RESEARCH = 'research', 'Research'
        AMAZON_SEARCH = 'amazon_search', 'Amazon Search'
        WEB_SEARCH = 'web_search', 'Web Search'
        MANUAL = 'manual', 'Manual'
        JUNGLESCOUT = 'junglescout', 'JungleScout'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    niche = models.ForeignKey(
        'niche_app.Niche',
        on_delete=models.CASCADE,
        related_name='niche_keywords',
        db_index=True,
    )
    keyword = models.CharField(max_length=200, db_index=True)
    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.MANUAL,
        db_index=True,
    )
    group = models.ForeignKey(
        NicheKeywordGroup,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='keywords',
    )
    design_template = models.ForeignKey(
        'design_app.Design',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='keyword_templates',
        help_text='Design for PROJ-11 auto-injection',
    )
    position = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_keywords',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('niche', 'keyword')]
        ordering = ['group', 'position']
        indexes = [
            models.Index(
                fields=['niche', 'source'],
                name='nichekw_niche_source_idx',
            ),
        ]

    def __str__(self):
        return f"{self.keyword} ({self.niche})"


class KeywordJSCache(models.Model):
    """JungleScout data cache per keyword+marketplace. 30-day TTL."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    keyword = models.CharField(max_length=200, db_index=True)
    marketplace = models.CharField(max_length=20, db_index=True)
    monthly_search_volume_exact = models.IntegerField(null=True, blank=True)
    monthly_search_volume_broad = models.IntegerField(null=True, blank=True)
    monthly_trend = models.FloatField(null=True, blank=True)
    quarterly_trend = models.FloatField(null=True, blank=True)
    ppc_bid_exact = models.FloatField(null=True, blank=True)
    ppc_bid_broad = models.FloatField(null=True, blank=True)
    sp_brand_ad_bid = models.FloatField(null=True, blank=True)
    ease_of_ranking_score = models.IntegerField(null=True, blank=True)
    relevancy_score = models.IntegerField(null=True, blank=True)
    organic_product_count = models.IntegerField(null=True, blank=True)
    sponsored_product_count = models.IntegerField(null=True, blank=True)
    dominant_category = models.CharField(max_length=200, blank=True, default='')
    recommended_promotions = models.IntegerField(null=True, blank=True)
    fetched_at = models.DateTimeField(db_index=True)

    class Meta:
        unique_together = [('keyword', 'marketplace')]
        verbose_name = 'Keyword JS Cache'
        verbose_name_plural = 'Keyword JS Caches'

    def __str__(self):
        return f"{self.keyword} ({self.marketplace}) fetched {self.fetched_at}"


class KeywordHistoryCache(models.Model):
    """Cached historical search volume data from JungleScout."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    keyword = models.CharField(max_length=200, db_index=True)
    marketplace = models.CharField(max_length=20, db_index=True)
    history_data = models.JSONField(
        default=list,
        help_text='List of {date, search_volume} objects (12 months)',
    )
    fetched_at = models.DateTimeField(db_index=True)

    class Meta:
        unique_together = [('keyword', 'marketplace')]
        verbose_name = 'Keyword History Cache'
        verbose_name_plural = 'Keyword History Caches'

    def __str__(self):
        return f"History: {self.keyword} ({self.marketplace})"


class NicheJSCallTracker(models.Model):
    """Tracks whether Agent has used its 1 JS-Call per niche."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    niche = models.OneToOneField(
        'niche_app.Niche',
        on_delete=models.CASCADE,
        related_name='js_call_tracker',
    )
    keyword_used = models.CharField(max_length=200)
    called_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Niche JS Call Tracker'
        verbose_name_plural = 'Niche JS Call Trackers'

    def __str__(self):
        return f"JS Call: {self.niche} ({self.keyword_used})"


class KeywordProductCount(models.Model):
    """Amazon product count per keyword+marketplace. Refreshed on-demand only."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    keyword = models.CharField(max_length=200, db_index=True)
    marketplace = models.CharField(max_length=20, db_index=True)
    product_count = models.PositiveIntegerField()
    fetched_at = models.DateTimeField(db_index=True)

    class Meta:
        unique_together = [('keyword', 'marketplace')]
        verbose_name = 'Keyword Product Count'
        verbose_name_plural = 'Keyword Product Counts'

    def __str__(self):
        return f"{self.keyword} ({self.marketplace}): {self.product_count}"


class JSUsageLog(models.Model):
    """Tracks JungleScout API calls for cost analytics."""

    class Provider(models.TextChoices):
        JUNGLESCOUT = 'junglescout', 'JungleScout'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    provider = models.CharField(
        max_length=20,
        choices=Provider.choices,
        db_index=True,
    )
    endpoint = models.CharField(max_length=100)
    keywords_count = models.PositiveIntegerField(
        default=0,
        help_text='Number of keywords in this API call',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='js_usage_logs',
    )
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='js_usage_logs',
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'JS Usage Log'
        verbose_name_plural = 'JS Usage Logs'

    def __str__(self):
        return f"{self.provider} {self.endpoint} ({self.keywords_count} kw)"
