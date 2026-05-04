"""PROJ-20 Phase 7.4 — scheduled chat-attachment purge.

Hard-deletes attachment file blobs after PURGE_AFTER_DAYS days. Marks the
DB row with `purged_at` so chat-history rendering can show a placeholder.
The DB row itself is kept so historical messages remain auditable.
"""

from __future__ import annotations

import logging
from datetime import timedelta

from django.utils import timezone

from chat_attachments_app.constants import PURGE_AFTER_DAYS
from chat_attachments_app.models import ChatAttachment

logger = logging.getLogger(__name__)


def purge_old_attachments(now=None) -> dict[str, int]:
    """Find attachments older than PURGE_AFTER_DAYS, delete the file blob,
    set `purged_at`. Idempotent — already-purged rows are skipped.

    Args:
        now: Optional override for current time (used by tests).

    Returns:
        Stats dict with `purged_count` and `errors_count`.
    """
    now = now or timezone.now()
    cutoff = now - timedelta(days=PURGE_AFTER_DAYS)

    qs = ChatAttachment.objects.filter(
        created_at__lt=cutoff,
        purged_at__isnull=True,
    )

    purged = 0
    errors = 0
    for attachment in qs.iterator(chunk_size=200):
        try:
            if attachment.file:
                attachment.file.delete(save=False)
        except OSError as exc:
            logger.warning(
                'Could not delete file for attachment %s: %s',
                attachment.id,
                exc,
            )
            errors += 1
            continue
        attachment.purged_at = now
        attachment.save(update_fields=['purged_at'])
        purged += 1

    logger.info(
        'purge_old_attachments: cutoff=%s purged=%d errors=%d',
        cutoff.isoformat(),
        purged,
        errors,
    )
    return {'purged_count': purged, 'errors_count': errors}
