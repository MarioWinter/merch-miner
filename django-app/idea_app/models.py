import uuid

from django.conf import settings
from django.db import models


class SloganNodeConfig(models.Model):
    """LLM config per slogan graph node. Editable in Django Admin without redeploy."""

    class NodeName(models.TextChoices):
        ANALYZE_ORIGINAL = 'analyze_original', 'Analyze Original'
        DISCOVER_NICHES = 'discover_niches', 'Discover Niches'
        VALIDATE_PRODUCTS = 'validate_products', 'Validate Products'
        ADAPT_SLOGANS = 'adapt_slogans', 'Adapt Slogans'
        QUALITY_CHECK = 'quality_check', 'Quality Check'

    NODE_DEFAULTS = {
        'analyze_original': {'model': 'openai/gpt-4.1-mini', 'temperature': 0.2},
        'discover_niches': {'model': 'mistralai/mistral-medium-3.1', 'temperature': 0.3},
        'validate_products': {'model': 'mistralai/mistral-small-3.2-24b-instruct', 'temperature': 0.2},
        'adapt_slogans': {'model': 'mistralai/mistral-small-creative', 'temperature': 0.8},
        'quality_check': {'model': 'openai/gpt-4.1-mini', 'temperature': 0.1},
    }

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
        verbose_name = 'Slogan Node Config'
        verbose_name_plural = 'Slogan Node Configs'

    def __str__(self):
        return f"{self.get_node_name_display()} ({self.model_name})"


class Idea(models.Model):
    """A slogan/idea — either manual or AI-generated."""

    class SignalType(models.TextChoices):
        SELF = 'self', 'Self'
        OTHER = 'other', 'Other'

    class MarketConfidence(models.TextChoices):
        HIGH = 'High', 'High'
        MEDIUM = 'Medium', 'Medium'
        LOW = 'Low', 'Low'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        FOR_REVIEW = 'for_review', 'For Review'
        ARCHIVED = 'archived', 'Archived'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='ideas',
        db_index=True,
    )
    niche = models.ForeignKey(
        'niche_app.Niche',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ideas',
    )
    adaptation_run = models.ForeignKey(
        'IdeaAdaptationRun',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='generated_ideas',
    )
    source_idea = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='derived_ideas',
    )
    source_product_url = models.URLField(blank=True, default='')
    slogan_text = models.TextField()
    is_manual = models.BooleanField(default=True)
    signal_type = models.CharField(
        max_length=10,
        choices=SignalType.choices,
        null=True,
        blank=True,
    )
    creative_modules_used = models.JSONField(default=list, blank=True)
    emotional_archetype = models.CharField(max_length=100, blank=True, default='')
    buyer_voice_pattern = models.TextField(blank=True, default='')
    stylistic_device = models.CharField(max_length=100, blank=True, default='')
    pattern_used = models.CharField(max_length=200, blank=True, default='')
    why_it_works = models.TextField(blank=True, default='')
    market_confidence = models.CharField(
        max_length=10,
        choices=MarketConfidence.choices,
        null=True,
        blank=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    round = models.PositiveIntegerField(default=1)
    was_changed = models.BooleanField(default=False)
    change_reason = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_ideas',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['workspace', 'niche'],
                name='idea_workspace_niche_idx',
            ),
            models.Index(
                fields=['workspace', 'status'],
                name='idea_workspace_status_idx',
            ),
        ]

    def __str__(self):
        return self.slogan_text[:80] if self.slogan_text else str(self.id)

    def get_embedding_text(self):
        """Return text to embed for vector search (PROJ-15)."""
        parts = filter(None, [self.slogan_text, self.why_it_works])
        return ' '.join(parts)


class IdeaAdaptationRun(models.Model):
    """A single adaptation run that takes a source idea and adapts it to target niches."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        RUNNING = 'running', 'Running'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='adaptation_runs',
        db_index=True,
    )
    source_idea = models.ForeignKey(
        Idea,
        on_delete=models.CASCADE,
        related_name='adaptation_runs',
    )
    target_niche_ids = models.JSONField(
        default=list,
        help_text='List of target niche UUIDs',
    )
    niche_results = models.JSONField(
        default=dict,
        blank=True,
        help_text='Per-niche approval/rejection results',
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
        related_name='triggered_adaptation_runs',
    )
    config_snapshot = models.JSONField(
        default=dict,
        blank=True,
        help_text='Snapshot of all SloganNodeConfig at run start (audit trail)',
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
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True, default='')
    rq_job_id = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text='RQ job ID for cancellation support',
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['workspace', 'status'],
                name='adapt_ws_status_idx',
            ),
        ]

    def __str__(self):
        return f"AdaptationRun {str(self.id)[:8]} [{self.status}]"


class IdeaFilterTemplate(models.Model):
    """Saved filter preset for the idea list view."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='idea_filter_templates',
        db_index=True,
    )
    name = models.CharField(max_length=100)
    filters = models.JSONField(
        default=dict,
        help_text='Saved filter state: {niche_id, status, signal_type, is_orphan, ordering}',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='idea_filter_templates',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name
