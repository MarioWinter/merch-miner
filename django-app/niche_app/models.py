import uuid
from django.db import models
from django.conf import settings


class Niche(models.Model):
    class Status(models.TextChoices):
        DATA_ENTRY = 'data_entry', 'Data Entry'
        DEEP_RESEARCH = 'deep_research', 'Deep Research'
        NICHE_WITH_POTENTIAL = 'niche_with_potential', 'Niche with Potential'
        TO_DESIGNER = 'to_designer', 'To Designer'
        UPLOAD = 'upload', 'Upload'
        START_ADS = 'start_ads', 'Start Ads'
        PENDING = 'pending', 'Pending'
        WINNER = 'winner', 'Winner'
        LOSER = 'loser', 'Loser'
        ARCHIVED = 'archived', 'Archived'

    class PotentialRating(models.TextChoices):
        GOOD = 'good', 'Gut'
        VERY_GOOD = 'very_good', 'Sehr gut'
        REJECTED = 'rejected', 'Rejected'

    class ResearchStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        RUNNING = 'running', 'Running'
        DONE = 'done', 'Done'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='niches',
        db_index=True,
    )
    name = models.CharField(max_length=200, db_index=True)
    notes = models.TextField(blank=True, default='')
    status = models.CharField(
        max_length=25,
        choices=Status.choices,
        default=Status.DATA_ENTRY,
        db_index=True,
    )
    potential_rating = models.CharField(
        max_length=15,
        choices=PotentialRating.choices,
        null=True,
        blank=True,
        default=None,
    )
    research_status = models.CharField(
        max_length=10,
        choices=ResearchStatus.choices,
        null=True,
        blank=True,
        default=None,
    )
    research_run_id = models.UUIDField(null=True, blank=True)
    research_retry_count = models.PositiveIntegerField(
        default=0,
        help_text='Number of research retries for this niche (max 3)',
    )
    current_round = models.PositiveIntegerField(
        default=1,
        help_text='Current active round for the niche',
    )
    position = models.PositiveIntegerField(default=0)
    # PROJ-34 Phase 13c — structured pre-fill hints for the Architect Builder
    # form, produced by `niche_app.services.builder_hints.structure_niche_for_builder`.
    # Schema documented in docs/tasks/PROJ-34-tasks.md Appendix L. Null until
    # the niche has a completed research run + the LLM call succeeded.
    builder_form_hints = models.JSONField(null=True, blank=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_niches',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_niches',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['position']
        indexes = [
            models.Index(fields=['workspace', 'status'], name='niche_ws_status_idx'),
            models.Index(fields=['workspace', 'status', 'position'], name='niche_ws_status_pos_idx'),
        ]

    def __str__(self):
        return self.name

    def get_embedding_text(self):
        """Return text to embed for vector search."""
        parts = [self.name]
        if self.notes:
            parts.append(self.notes)
        return ' '.join(parts)


class CollectedProduct(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    niche = models.ForeignKey(
        'Niche',
        on_delete=models.CASCADE,
        related_name='collected_products',
        db_index=True,
    )
    product = models.ForeignKey(
        'scraper_app.AmazonProduct',
        on_delete=models.CASCADE,
        related_name='collected_by_niches',
    )
    collected_at = models.DateTimeField(auto_now_add=True)
    extracted_keywords = models.JSONField(default=list, blank=True)
    listing_template = models.JSONField(default=dict, blank=True)

    class Meta:
        unique_together = ('niche', 'product')
        ordering = ['-collected_at']

    def __str__(self):
        return f"Collected {self.product} for {self.niche}"


class NicheNote(models.Model):
    """A free-form text snippet attached to a Niche (e.g. saved from web search results)."""

    class Source(models.TextChoices):
        USER = 'user', 'User'
        NICHE_LEGACY_NOTES = 'niche_legacy_notes', 'Niche Legacy Notes'
        WEB_SEARCH = 'web_search', 'Web Search'
        AGENT_RESEARCH = 'agent_research', 'Agent Research'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    niche = models.ForeignKey(
        'Niche',
        on_delete=models.CASCADE,
        related_name='notes_collection',
        db_index=True,
    )
    text = models.TextField()
    source = models.CharField(
        max_length=30,
        choices=Source.choices,
        default=Source.USER,
        db_index=True,
    )
    source_url = models.URLField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_niche_notes',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        preview = self.text[:50]
        return f"Note ({self.niche}): {preview}"

    def get_embedding_text(self):
        """Return text to embed for vector search (PROJ-29)."""
        return self.text or ''


class NicheFilterTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='niche_filter_templates',
        db_index=True,
    )
    name = models.CharField(max_length=100)
    filters = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name
