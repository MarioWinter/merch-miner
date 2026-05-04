import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


class NicheComment(models.Model):
    """Card-level or design-level comment on a niche (AC-3)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    niche = models.ForeignKey(
        'niche_app.Niche',
        on_delete=models.CASCADE,
        related_name='comments',
        db_index=True,
    )
    design = models.ForeignKey(
        'publish_app.DesignAsset',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='comments',
        help_text='Null = card-level comment; set = design-level comment',
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='niche_comments',
        help_text='Null for agent-generated comments',
    )
    agent_type = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text='Agent type for agent comments (e.g. orchestrator, research)',
    )
    content = models.TextField()
    mentions = models.JSONField(
        default=list,
        blank=True,
        help_text='List of mentioned user IDs',
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(
                fields=['niche', 'design'],
                name='comment_niche_design_idx',
            ),
        ]

    def __str__(self):
        author_str = self.author.email if self.author else f'Agent({self.agent_type})'
        return f'Comment by {author_str} on {self.niche_id}'


class Notification(models.Model):
    """In-app notification for workspace members (AC-4)."""

    class Type(models.TextChoices):
        ASSIGNMENT = 'assignment', 'Assignment'
        APPROVAL = 'approval', 'Approval'
        REJECTION = 'rejection', 'Rejection'
        MENTION = 'mention', 'Mention'
        STATUS_CHANGE = 'status_change', 'Status Change'
        AGENT_ACTION = 'agent_action', 'Agent Action'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='notifications',
        db_index=True,
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        db_index=True,
    )
    type = models.CharField(
        max_length=20,
        choices=Type.choices,
        db_index=True,
    )
    title = models.CharField(max_length=200)
    message = models.TextField(blank=True, default='')
    link = models.CharField(
        max_length=500,
        blank=True,
        default='',
        help_text='Deep link path to card/design (e.g. /kanban?card=<uuid>)',
    )
    is_read = models.BooleanField(default=False, db_index=True)
    source_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_notifications',
    )
    source_agent_type = models.CharField(
        max_length=50,
        blank=True,
        default='',
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['recipient', 'is_read', '-created_at'],
                name='notif_recipient_read_idx',
            ),
            models.Index(
                fields=['workspace', 'recipient'],
                name='notif_ws_recipient_idx',
            ),
        ]

    def __str__(self):
        return f'Notification [{self.type}] for {self.recipient_id}'


class DesignTrash(models.Model):
    """Soft-delete trash for designs with 30-day expiry (AC-5)."""

    TRASH_DAYS = 30

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    design = models.OneToOneField(
        'publish_app.DesignAsset',
        on_delete=models.CASCADE,
        related_name='trash_record',
    )
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='design_trash',
        db_index=True,
    )
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='trashed_designs',
    )
    deleted_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(db_index=True)

    class Meta:
        ordering = ['-deleted_at']
        verbose_name_plural = 'Design trash'

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = self.deleted_at + timedelta(days=self.TRASH_DAYS)
        super().save(*args, **kwargs)

    def __str__(self):
        return f'Trash: {self.design_id} (expires {self.expires_at})'
