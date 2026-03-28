"""Cloud sync service for approved designs (AC-25, AC-26).

Placeholder — actual Drive/OneDrive upload logic depends on PROJ-11 OAuth implementation.
This module provides the interface that django-rq tasks call.
"""

import logging

logger = logging.getLogger(__name__)


def sync_design_to_cloud(design_id, workspace_id):
    """
    Upload approved design to workspace's configured cloud storage.
    Called as async django-rq job on design approval.

    TODO: Implement when PROJ-11 cloud OAuth is available.
    For now, logs intent and returns.
    """
    logger.info(
        'Cloud sync requested for design %s in workspace %s (not yet implemented)',
        design_id,
        workspace_id,
    )
    return {'status': 'skipped', 'reason': 'Cloud sync not yet configured'}
