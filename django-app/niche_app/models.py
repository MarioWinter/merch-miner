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
    position = models.PositiveIntegerField(default=0)
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
