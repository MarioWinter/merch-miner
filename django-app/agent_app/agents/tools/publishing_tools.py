"""Publishing Agent tools (AC-16).

4 tools for upload-job creation, status reads, and Kanban moves.
Wraps `publish_app.UploadJob` + `niche_app.Niche.status` (used as kanban
column). Note: kanban_app currently exposes only NicheComment + Notification;
the kanban "board" is derived from Niche.status grouping (PROJ-14 design).
"""

from __future__ import annotations

from typing import Any, Optional

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool

from agent_app.services.permission_decorator import permission_check


# ── Helpers ──

def _get_workspace_id(config: Optional[RunnableConfig]) -> str:
    if not config:
        raise ValueError('Tool requires LangGraph config with workspace context.')
    cfg = config.get('configurable') or {}
    workspace_id = cfg.get('workspace_id')
    if not workspace_id:
        raise ValueError('Missing workspace_id in tool config.')
    return str(workspace_id)


def _get_user_id(config: Optional[RunnableConfig]) -> Any:
    if not config:
        raise ValueError('Tool requires LangGraph config with user context.')
    cfg = config.get('configurable') or {}
    user_id = cfg.get('user_id')
    if not user_id:
        raise ValueError('Missing user_id in tool config.')
    return user_id


# ── Tools ──

@tool
@permission_check('create_upload_job')
def create_upload_job(
    listing_id: str,
    marketplace: str = 'mba_us',
    template_id: Optional[str] = None,
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Queue an UploadJob for the Desktop Upload App (PROJ-13).

    IRREVERSIBLE in spirit — this hands the listing off to MBA upload.
    Permission default = 'approve' on the Autonomous preset (AC-19).

    Args:
        listing_id: Listing UUID (must be READY).
        marketplace: Target marketplace key (e.g. 'mba_us', 'mba_de').
        template_id: Optional UploadTemplate UUID.
    """
    from publish_app.models import Listing, UploadJob, UploadTemplate

    workspace_id = _get_workspace_id(config)
    user_id = _get_user_id(config)

    try:
        listing = Listing.objects.select_related('design').get(
            id=listing_id, workspace_id=workspace_id,
        )
    except Listing.DoesNotExist:
        return {'error': f'Listing {listing_id} not found.'}

    if listing.status != Listing.Status.READY:
        return {
            'error': (
                f'Listing must be READY to upload (current: {listing.status}). '
                'Run mark_listing_ready first.'
            ),
        }

    template = None
    if template_id:
        try:
            template = UploadTemplate.objects.get(
                id=template_id, workspace_id=workspace_id,
            )
        except UploadTemplate.DoesNotExist:
            return {'error': f'UploadTemplate {template_id} not found.'}

    snapshot = {
        'title': listing.title,
        'bullet_1': listing.bullet_1,
        'bullet_2': listing.bullet_2,
        'description': listing.description,
        'brand_name': listing.brand_name,
        'language': listing.language,
        'marketplace_type': listing.marketplace_type,
    }
    job = UploadJob.objects.create(
        workspace_id=workspace_id,
        listing=listing,
        design=listing.design,
        template=template,
        listing_snapshot=snapshot,
        marketplace=marketplace,
        status=UploadJob.Status.PENDING,
        created_by_id=user_id,
    )
    return {
        'upload_job_id': str(job.id),
        'status': job.status,
        'marketplace': job.marketplace,
    }


@tool
@permission_check('read_upload_status')
def read_upload_status(
    upload_job_id: str,
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Read an UploadJob's current state."""
    from publish_app.models import UploadJob

    workspace_id = _get_workspace_id(config)
    try:
        job = UploadJob.objects.get(
            id=upload_job_id, workspace_id=workspace_id,
        )
    except UploadJob.DoesNotExist:
        return {'error': f'UploadJob {upload_job_id} not found.'}
    return {
        'upload_job_id': str(job.id),
        'status': job.status,
        'asin': job.asin,
        'marketplace': job.marketplace,
        'retry_count': job.retry_count,
        'error_message': job.error_message,
        'queued_at': job.queued_at.isoformat() if job.queued_at else None,
        'completed_at': (
            job.completed_at.isoformat() if job.completed_at else None
        ),
    }


@tool
@permission_check('update_kanban_status')
def update_kanban_status(
    niche_id: str,
    new_status: str,
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Move a niche between Kanban columns by updating its status.

    Kanban columns = Niche.Status values (data_entry, deep_research,
    niche_with_potential, to_designer, upload, start_ads, pending, winner,
    loser, archived) — see PROJ-14.
    """
    from niche_app.models import Niche

    workspace_id = _get_workspace_id(config)
    valid = {c[0] for c in Niche.Status.choices}
    if new_status not in valid:
        return {'error': f'Invalid status. Allowed: {sorted(valid)}'}

    try:
        niche = Niche.objects.get(id=niche_id, workspace_id=workspace_id)
    except Niche.DoesNotExist:
        return {'error': f'Niche {niche_id} not found.'}

    old_status = niche.status
    niche.status = new_status
    niche.save(update_fields=['status', 'updated_at'])
    return {
        'niche_id': str(niche.id),
        'old_status': old_status,
        'new_status': niche.status,
    }


@tool
@permission_check('read_kanban_board')
def read_kanban_board(
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Read the workspace Kanban board (niches grouped by status column).

    Returns: {columns: [{status, count, niches: [{id, name, position}]}]}.
    """
    from collections import OrderedDict

    from niche_app.models import Niche

    workspace_id = _get_workspace_id(config)

    columns: OrderedDict[str, list[dict[str, Any]]] = OrderedDict(
        (c[0], []) for c in Niche.Status.choices
    )

    qs = (
        Niche.objects
        .filter(workspace_id=workspace_id)
        .order_by('position')
        .values('id', 'name', 'status', 'position', 'potential_rating')
    )
    for n in qs:
        n['id'] = str(n['id'])
        columns.setdefault(n['status'], []).append(n)

    return {
        'columns': [
            {
                'status': status,
                'count': len(items),
                'niches': items[:50],  # cap per column
            }
            for status, items in columns.items()
        ],
    }


TOOLS = [
    create_upload_job,
    read_upload_status,
    update_kanban_status,
    read_kanban_board,
]


__all__ = ['TOOLS', *(t.name for t in TOOLS)]
