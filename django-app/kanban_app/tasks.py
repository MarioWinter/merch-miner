"""Background tasks for kanban_app (django-rq)."""

import logging

from kanban_app.services.cloud_sync import sync_design_to_cloud
from kanban_app.services.trash_cleanup import cleanup_expired_trash

logger = logging.getLogger(__name__)


def cloud_sync_task(design_id, workspace_id):
    """RQ task: sync approved design to cloud storage."""
    try:
        return sync_design_to_cloud(design_id, workspace_id)
    except Exception:
        logger.exception(
            'Cloud sync failed for design %s workspace %s',
            design_id,
            workspace_id,
        )
        # Create failure notification
        try:
            from kanban_app.services.notification_service import notify_agent_action
            from publish_app.models import DesignAsset
            design = DesignAsset.objects.select_related('niche', 'workspace').get(id=design_id)
            if design.niche:
                notify_agent_action(
                    workspace=design.workspace,
                    niche=design.niche,
                    agent_type='system',
                    action_description=f'Cloud sync failed for design "{design.file_name}". Retry in Settings.',
                )
        except Exception:
            logger.exception('Failed to create cloud sync failure notification')
        raise


def trash_cleanup_task():
    """RQ task: daily cleanup of expired design trash."""
    return cleanup_expired_trash()
