"""Trash cleanup service (AC-27). Deletes expired DesignTrash entries + files."""

import logging

from django.utils import timezone

from kanban_app.models import DesignTrash

logger = logging.getLogger(__name__)


def cleanup_expired_trash():
    """
    Delete all DesignTrash entries where expires_at < now.
    Also deletes the actual design files and the DesignAsset records.
    Returns count of deleted entries.
    """
    expired = DesignTrash.objects.filter(
        expires_at__lt=timezone.now(),
    ).select_related('design')

    count = 0
    for trash in expired:
        design = trash.design
        # Delete actual file from storage
        if design.file:
            try:
                design.file.delete(save=False)
            except Exception:
                logger.exception('Failed to delete file for design %s', design.id)

        # Delete the design record (cascades to trash via OneToOneField)
        design.delete()
        count += 1

    logger.info('Trash cleanup: deleted %d expired designs', count)
    return count
