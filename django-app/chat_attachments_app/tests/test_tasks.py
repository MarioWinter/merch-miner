"""PROJ-20 Phase 7.4 — purge_old_attachments tests."""

from __future__ import annotations

import io
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.utils import timezone
from freezegun import freeze_time
from PIL import Image

from chat_attachments_app.constants import PURGE_AFTER_DAYS
from chat_attachments_app.models import ChatAttachment
from chat_attachments_app.tasks import purge_old_attachments
from workspace_app.models import Membership, Workspace

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email='purge@example.com', password='pw',
    )


@pytest.fixture
def workspace(db, user):
    ws = Workspace.objects.create(name='Purge WS', slug='purge-ws', owner=user)
    Membership.objects.create(
        workspace=ws, user=user, role='admin', status='active',
    )
    return ws


def _png_bytes() -> bytes:
    img = Image.new('RGB', (8, 8), (10, 20, 30))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


def _make_attachment(workspace, user, name='img.webp') -> ChatAttachment:
    return ChatAttachment.objects.create(
        workspace=workspace,
        uploaded_by=user,
        file=ContentFile(_png_bytes(), name=name),
        original_filename=name,
        mime_type='image/webp',
        size_bytes=64,
    )


@pytest.mark.django_db
class TestPurgeOldAttachments:
    def test_purges_files_older_than_cutoff(self, workspace, user):
        # Create the attachment "in the past" so freezegun + filter works.
        with freeze_time('2025-12-01T00:00:00Z'):
            old = _make_attachment(workspace, user, 'old.webp')

        with freeze_time('2026-04-28T00:00:00Z'):
            stats = purge_old_attachments()

        old.refresh_from_db()
        assert stats['purged_count'] == 1
        assert stats['errors_count'] == 0
        assert old.purged_at is not None
        # File blob is gone from storage. The DB row keeps the original path
        # for audit; the serializer's `get_thumbnail_url` returns None when
        # `purged_at` is set so consumers see a placeholder.
        from django.core.files.storage import default_storage
        assert not default_storage.exists(old.file.name)

    def test_keeps_recent_attachments(self, workspace, user):
        with freeze_time('2026-04-20T00:00:00Z'):
            recent = _make_attachment(workspace, user, 'recent.webp')

        with freeze_time('2026-04-28T00:00:00Z'):
            stats = purge_old_attachments()

        recent.refresh_from_db()
        assert stats['purged_count'] == 0
        assert recent.purged_at is None
        assert recent.file  # blob still present

    def test_idempotent_already_purged_skipped(self, workspace, user):
        with freeze_time('2025-12-01T00:00:00Z'):
            att = _make_attachment(workspace, user, 'mixed.webp')

        with freeze_time('2026-04-28T00:00:00Z'):
            first = purge_old_attachments()
            assert first['purged_count'] == 1
            second = purge_old_attachments()
            assert second['purged_count'] == 0

        att.refresh_from_db()
        assert att.purged_at is not None

    def test_cutoff_is_exactly_purge_after_days(self, workspace, user):
        # An attachment created exactly at the cutoff is NOT purged
        # (filter uses `__lt`, strict less-than).
        with freeze_time('2026-01-28T00:00:00Z'):
            boundary = _make_attachment(workspace, user, 'boundary.webp')

        # Now is exactly PURGE_AFTER_DAYS later → boundary is at cutoff,
        # NOT before it.
        now = timezone.datetime(2026, 1, 28) + timedelta(days=PURGE_AFTER_DAYS)
        now = timezone.make_aware(now, timezone=timezone.get_current_timezone())
        stats = purge_old_attachments(now=now)

        boundary.refresh_from_db()
        assert stats['purged_count'] == 0
        assert boundary.purged_at is None

    def test_handles_mixed_old_and_recent(self, workspace, user):
        with freeze_time('2025-12-01T00:00:00Z'):
            old1 = _make_attachment(workspace, user, 'old1.webp')
            old2 = _make_attachment(workspace, user, 'old2.webp')
        with freeze_time('2026-04-25T00:00:00Z'):
            recent = _make_attachment(workspace, user, 'recent.webp')

        with freeze_time('2026-04-28T00:00:00Z'):
            stats = purge_old_attachments()

        assert stats['purged_count'] == 2
        old1.refresh_from_db()
        old2.refresh_from_db()
        recent.refresh_from_db()
        assert old1.purged_at is not None
        assert old2.purged_at is not None
        assert recent.purged_at is None
