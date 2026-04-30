import uuid

from django.conf import settings
from django.db import models


class ActivityEvent(models.Model):
    """Simple event log for the dashboard activity feed."""

    class EventType(models.TextChoices):
        NICHE_CREATED = 'niche_created', 'Niche Created'
        NICHE_ARCHIVED = 'niche_archived', 'Niche Archived'
        NICHE_STATUS_CHANGED = 'niche_status_changed', 'Niche Status Changed'
        RESEARCH_COMPLETED = 'research_completed', 'Research Completed'
        RESEARCH_FAILED = 'research_failed', 'Research Failed'
        IDEA_CREATED = 'idea_created', 'Idea Created'
        IDEA_APPROVED = 'idea_approved', 'Idea Approved'
        IDEA_REJECTED = 'idea_rejected', 'Idea Rejected'
        DESIGN_GENERATED = 'design_generated', 'Design Generated'
        DESIGN_APPROVED = 'design_approved', 'Design Approved'
        LISTING_READY = 'listing_ready', 'Listing Ready'
        LISTING_PUBLISHED = 'listing_published', 'Listing Published'
        UPLOAD_COMPLETED = 'upload_completed', 'Upload Completed'
        UPLOAD_FAILED = 'upload_failed', 'Upload Failed'
        # PROJ-18 AC-64 — agent events
        AGENT_SESSION_STARTED = 'agent_session_started', 'Agent Session Started'
        AGENT_SESSION_COMPLETED = 'agent_session_completed', 'Agent Session Completed'
        AGENT_SESSION_FAILED = 'agent_session_failed', 'Agent Session Failed'
        AGENT_AWAITING_APPROVAL = 'agent_awaiting_approval', 'Agent Awaiting Approval'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='activity_events',
        db_index=True,
    )
    event_type = models.CharField(
        max_length=50,
        choices=EventType.choices,
        db_index=True,
    )
    target_name = models.CharField(max_length=200, default='')
    target_id = models.UUIDField(null=True, blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='activity_events',
    )
    agent_type = models.CharField(max_length=50, blank=True, default='')
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['workspace', '-created_at'],
                name='activity_ws_created_idx',
            ),
            models.Index(
                fields=['workspace', 'event_type'],
                name='activity_ws_type_idx',
            ),
        ]

    def __str__(self):
        return f"{self.event_type} - {self.target_name}"
