import uuid

from django.conf import settings
from django.db import models


class ResearchNodeConfig(models.Model):
    """LLM config per graph node. Editable in Django Admin without redeploy."""

    class NodeName(models.TextChoices):
        VISION_ANALYZE = 'vision_analyze', 'Vision Analyze'
        EMOTIONAL_ANALYZE = 'emotional_analyze', 'Emotional Analyze'
        NICHE_PROFILE = 'niche_profile', 'Niche Profile'
        KEYWORDS = 'keywords', 'Keywords'

    node_name = models.CharField(
        max_length=50,
        choices=NodeName.choices,
        unique=True,
    )
    model_name = models.CharField(max_length=100, default='openai/gpt-4.1-mini')
    temperature = models.FloatField(default=0.3)
    max_tokens = models.IntegerField(null=True, blank=True)
    system_prompt = models.TextField(blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Research Node Config'
        verbose_name_plural = 'Research Node Configs'

    def __str__(self):
        return f"{self.get_node_name_display()} ({self.model_name})"


class NicheResearch(models.Model):
    """A single research run for a niche."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        RUNNING = 'running', 'Running'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    niche = models.ForeignKey(
        'niche_app.Niche',
        on_delete=models.CASCADE,
        related_name='research_runs',
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='triggered_research_runs',
    )
    config_snapshot = models.JSONField(
        default=dict,
        blank=True,
        help_text='Snapshot of all ResearchNodeConfig at run start (audit trail)',
    )
    completed_nodes = models.JSONField(
        default=list,
        blank=True,
        help_text='Node names that completed successfully',
    )
    current_node = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text='Currently running node name',
    )
    retry_count = models.PositiveIntegerField(
        default=0,
        help_text='Number of retries on this record',
    )
    marketplace = models.CharField(
        max_length=20,
        default='amazon_com',
        db_index=True,
        help_text='Marketplace used for scraping',
    )
    product_type = models.CharField(
        max_length=20,
        default='t_shirt',
        help_text='MBA product type filter',
    )
    rq_job_id = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text='RQ job ID for cancellation support',
    )
    cancelled = models.BooleanField(
        default=False,
        help_text='Whether this research was cancelled by user',
    )
    brand_filtered_count = models.PositiveIntegerField(
        default=0,
        help_text='Number of products filtered out by brand blacklist',
    )
    product_limit = models.PositiveSmallIntegerField(
        default=50,
        help_text=(
            'How many products this run analyzed (allowed range 10-200). '
            'Audit value: also reused on force-refresh to repeat the same '
            'depth of analysis.'
        ),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['niche', 'status'],
                name='research_niche_status_idx',
            ),
        ]

    def __str__(self):
        return f"Research {self.id} [{self.status}] for {self.niche}"


class NicheResearchProduct(models.Model):
    """Through-table linking a research run to analyzed products."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    research = models.ForeignKey(
        NicheResearch,
        on_delete=models.CASCADE,
        related_name='research_products',
        db_index=True,
    )
    product = models.ForeignKey(
        'scraper_app.AmazonProduct',
        on_delete=models.CASCADE,
        related_name='research_entries',
    )
    brand_blocked = models.BooleanField(
        default=False,
        help_text='Whether this product was blocked by brand blacklist',
    )

    class Meta:
        unique_together = ('research', 'product')

    def __str__(self):
        return f"{self.research_id} - {self.product_id}"


class NicheProductVisionAnalysis(models.Model):
    """Vision LLM analysis of a product thumbnail."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    research = models.ForeignKey(
        NicheResearch,
        on_delete=models.CASCADE,
        related_name='vision_analyses',
        db_index=True,
    )
    product = models.ForeignKey(
        'scraper_app.AmazonProduct',
        on_delete=models.CASCADE,
        related_name='vision_analyses',
    )
    slogan_text = models.TextField(blank=True, default='')
    meaning_context = models.TextField(blank=True, default='')
    visual_style = models.TextField(blank=True, default='')
    graphic_elements = models.TextField(blank=True, default='')
    layout_composition = models.TextField(blank=True, default='')
    is_niche_match = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Vision Analysis'
        verbose_name_plural = 'Vision Analyses'

    def __str__(self):
        return f"Vision: {self.product} [{self.research_id}]"

    def get_embedding_text(self):
        """Return text to embed for vector search."""
        parts = filter(None, [
            self.slogan_text, self.meaning_context, self.visual_style,
        ])
        return ' '.join(parts)


class NicheProductEmotionalAnalysis(models.Model):
    """Emotional/psychological analysis of a product slogan."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    research = models.ForeignKey(
        NicheResearch,
        on_delete=models.CASCADE,
        related_name='emotional_analyses',
        db_index=True,
    )
    product = models.ForeignKey(
        'scraper_app.AmazonProduct',
        on_delete=models.CASCADE,
        related_name='emotional_analyses',
    )
    original_slogan = models.TextField(blank=True, default='')
    customer_psychology = models.JSONField(default=dict, blank=True)
    sentiment_analysis = models.JSONField(default=dict, blank=True)
    emotional_pattern = models.CharField(max_length=100, blank=True, default='')
    vibe = models.JSONField(default=dict, blank=True)
    semantic_structure = models.JSONField(default=dict, blank=True)
    key_elements = models.JSONField(default=list, blank=True)
    tone = models.TextField(blank=True, default='')
    adaptation_formula = models.TextField(blank=True, default='')
    adaptation_examples = models.JSONField(default=list, blank=True)
    transferability_notes = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Emotional Analysis'
        verbose_name_plural = 'Emotional Analyses'

    def __str__(self):
        return f"Emotional: {self.product} [{self.research_id}]"

    def get_embedding_text(self):
        """Return text to embed for vector search."""
        parts = filter(None, [
            self.original_slogan, self.tone, self.adaptation_formula,
        ])
        return ' '.join(parts)


class NicheAnalysis(models.Model):
    """Aggregated niche identity profile from all product analyses."""

    class Sentiment(models.TextChoices):
        POSITIVE = 'Positive', 'Positive'
        NEUTRAL = 'Neutral', 'Neutral'
        NEGATIVE = 'Negative', 'Negative'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    research = models.ForeignKey(
        NicheResearch,
        on_delete=models.CASCADE,
        related_name='niche_analyses',
    )
    niche = models.ForeignKey(
        'niche_app.Niche',
        on_delete=models.CASCADE,
        related_name='niche_analyses',
        db_index=True,
    )
    niche_summary = models.TextField(blank=True, default='')
    sentiment = models.CharField(
        max_length=50,
        choices=Sentiment.choices,
        blank=True,
        default='',
    )
    primary_emotions = models.JSONField(default=list, blank=True)
    emotional_archetype = models.JSONField(default=list, blank=True)
    example_keywords = models.JSONField(default=list, blank=True)
    pattern_analysis = models.JSONField(
        default=list,
        blank=True,
        help_text='list[{name, present, context}] - all 16 patterns',
    )
    emotional_reality = models.TextField(blank=True, default='')
    design_concepts = models.TextField(blank=True, default='')
    dominant_design_aesthetics = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Niche Analysis'
        verbose_name_plural = 'Niche Analyses'

    def __str__(self):
        return f"Analysis: {self.niche} [{self.research_id}]"

    def get_embedding_text(self):
        """Return text to embed for vector search."""
        parts = filter(None, [
            self.niche_summary, self.emotional_reality,
            self.design_concepts, self.dominant_design_aesthetics,
        ])
        return ' '.join(parts)


class NicheKeywordAnalysis(models.Model):
    """Keyword recommendations from research."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    research = models.ForeignKey(
        NicheResearch,
        on_delete=models.CASCADE,
        related_name='keyword_analyses',
    )
    niche = models.ForeignKey(
        'niche_app.Niche',
        on_delete=models.CASCADE,
        related_name='keyword_analyses',
        db_index=True,
    )
    main_short_tail = models.JSONField(default=list, blank=True)
    main_long_tail = models.JSONField(default=list, blank=True)
    all_keywords_flat = models.TextField(blank=True, default='')
    top_focus_keywords = models.JSONField(default=list, blank=True)
    top_long_tail_keywords = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Keyword Analysis'
        verbose_name_plural = 'Keyword Analyses'

    def __str__(self):
        return f"Keywords: {self.niche} [{self.research_id}]"

    def get_embedding_text(self):
        """Return text to embed for vector search."""
        return self.all_keywords_flat or ''
