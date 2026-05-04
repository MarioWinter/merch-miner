import uuid

from django.conf import settings
from django.db import models

from .constants import DEFAULT_VISION_MODEL


def attachment_upload_path(instance: 'ChatAttachment', filename: str) -> str:
    """Workspace-scoped subfolder so cross-tenant collisions are impossible."""
    return f'chat-attachments/{instance.workspace_id}/{filename}'


class ChatAttachment(models.Model):
    """A user-uploaded image attached to a chat message.

    Resized server-side before persistence (max 2048×2048, see views). For
    Vision the resized file is base64-encoded and embedded in the LLM prompt.
    Old attachments are hard-purged after 90 days (purge_old_attachments task).
    """

    class AttachmentType(models.TextChoices):
        IMAGE = 'image', 'Image'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='chat_attachments',
        db_index=True,
    )
    # SET_NULL because attachments are uploaded BEFORE the message is created;
    # the message link is filled in once the user actually sends the request.
    message = models.ForeignKey(
        'search_app.ChatMessage',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='attachments',
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='chat_attachments',
    )
    file = models.FileField(upload_to=attachment_upload_path, max_length=512)
    original_filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=100)
    size_bytes = models.PositiveIntegerField()
    attachment_type = models.CharField(
        max_length=20,
        choices=AttachmentType.choices,
        default=AttachmentType.IMAGE,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    purged_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Set when the file is hard-deleted by purge_old_attachments.',
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['workspace', 'created_at']),
        ]

    def __str__(self) -> str:
        return f'{self.original_filename} ({self.workspace_id})'


class AppSettings(models.Model):
    """Singleton row for app-level admin-controlled toggles. The first
    `objects.first()` call returns the row; admins use the change form to
    update vision_model. Saved with pk=1 to enforce singleton behavior."""

    vision_model = models.CharField(
        max_length=120,
        default=DEFAULT_VISION_MODEL,
        help_text=(
            'OpenRouter model id used for vision fallback when the selected '
            'chat model is not vision-capable. Override at runtime by editing '
            'this row in the admin.'
        ),
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'App settings'
        verbose_name_plural = 'App settings'

    def save(self, *args, **kwargs):
        # Hard-pin pk=1 so no second row can ever exist.
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):  # pragma: no cover - safety net
        # Singleton row can't be deleted via ORM; admin "delete" is hidden.
        return

    @classmethod
    def get_solo(cls) -> 'AppSettings':
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self) -> str:
        return f'AppSettings (vision_model={self.vision_model})'
