"""FIX-dashboard-bug-report-and-polish Item 1 — feedback models.

Two models:
  * ``FeedbackScreenshot`` — optional image attached to a report, uploaded
    via a separate POST (mirrors chat_attachments_app pattern so we can show
    upload progress while the user is still filling the form).
  * ``BugFeatureReport`` — bug / feature request submitted from the topbar
    modal. Workspace-scoped read (superusers see everything); only the row
    creator + superusers can update.
"""

import uuid

from django.conf import settings
from django.db import models


def screenshot_upload_path(instance: 'FeedbackScreenshot', filename: str) -> str:
    """Per-spec AC-1-9 path: ``feedback/screenshots/<uuid>.<ext>``.

    We rely on the upload's original extension; the instance id makes the
    final filename collision-proof.
    """
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'bin'
    return f'feedback/screenshots/{instance.id}.{ext}'


class FeedbackScreenshot(models.Model):
    """Optional image referenced by a ``BugFeatureReport``.

    Uploaded BEFORE the report row via POST /api/feedback/screenshots/ so the
    frontend can show an upload-progress UI while the form is still being
    filled. The report POST then references the screenshot by id.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    image = models.ImageField(upload_to=screenshot_upload_path, max_length=512)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='feedback_screenshots',
    )
    uploaded_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self) -> str:
        return f'FeedbackScreenshot({self.id})'


class BugFeatureReport(models.Model):
    """A bug report or feature request submitted by a user.

    Workspace-scoped read for non-superusers; superusers see every workspace.
    Only superusers may PATCH ``status`` and ``admin_notes`` for triage.
    """

    class ReportType(models.TextChoices):
        BUG = 'bug', 'Bug'
        FEATURE = 'feature', 'Feature'

    class Status(models.TextChoices):
        NEW = 'new', 'New'
        TRIAGED = 'triaged', 'Triaged'
        IN_PROGRESS = 'in_progress', 'In Progress'
        DONE = 'done', 'Done'
        WONTFIX = 'wontfix', 'Won\'t Fix'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='feedback_reports',
        db_index=True,
    )
    # SET_NULL: keep the report even if the submitter deletes their account.
    # The report row stays visible to superusers as historical signal.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='feedback_reports',
    )
    type = models.CharField(
        max_length=10,
        choices=ReportType.choices,
        db_index=True,
    )
    title = models.CharField(max_length=200)
    description = models.TextField()
    screenshot = models.ForeignKey(
        FeedbackScreenshot,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reports',
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NEW,
        db_index=True,
    )
    admin_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['workspace', 'created_at'],
                name='feedback_ws_created_idx',
            ),
            models.Index(
                fields=['status', 'created_at'],
                name='feedback_status_created_idx',
            ),
        ]

    def __str__(self) -> str:
        return f'[{self.type}] {self.title} ({self.status})'
