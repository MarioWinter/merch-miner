"""Listing Agent tools (AC-15 + EC-7).

5 tools for MBA listing CRUD + AI generation + export. Wraps `publish_app`
(Listing, DesignAsset).

EC-7: `generate_listing` falls back to text-only when no approved design exists
for the niche. Emits an AgentMessage notifying the user.
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


def _get_session_id(config: Optional[RunnableConfig]) -> Optional[str]:
    if not config:
        return None
    cfg = config.get('configurable') or {}
    sid = cfg.get('session_id')
    return str(sid) if sid else None


def _emit_session_message(
    session_id: Optional[str], content: str, agent_type: str = 'listing',
) -> None:
    """Emit an AgentMessage on the calling session, if available (EC-7)."""
    if not session_id:
        return
    from agent_app.models import AgentMessage, AgentSession, MessageRole
    try:
        session = AgentSession.objects.get(id=session_id)
    except AgentSession.DoesNotExist:
        return
    AgentMessage.objects.create(
        session=session,
        role=MessageRole.SYSTEM,
        agent_type=agent_type,
        content=content,
    )


# ── Tools ──

@tool
@permission_check('generate_listing')
def generate_listing(
    idea_id: str,
    design_asset_id: Optional[str] = None,
    marketplace_type: str = 'mba',
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Generate an MBA listing draft for an Idea (+ optional DesignAsset).

    EC-7: If `design_asset_id` is None AND no approved design exists for the
    idea's niche, this falls back to a text-only Listing (no design link)
    and emits an AgentMessage: "No design available, created text-only listing."

    Args:
        idea_id: Idea UUID (required for slogan basis).
        design_asset_id: Optional DesignAsset UUID. If absent we look for an
            approved design on the idea's niche; if none, text-only fallback.
        marketplace_type: 'mba' (default) | 'global' | 'displate'.
    """
    from idea_app.models import Idea
    from publish_app.models import DesignAsset, Listing

    workspace_id = _get_workspace_id(config)
    session_id = _get_session_id(config)

    try:
        idea = Idea.objects.select_related('niche').get(
            id=idea_id, workspace_id=workspace_id,
        )
    except Idea.DoesNotExist:
        return {'error': f'Idea {idea_id} not found.'}

    # Resolve design (or trigger text-only fallback per EC-7).
    design = None
    text_only = False
    if design_asset_id:
        try:
            design = DesignAsset.objects.get(
                id=design_asset_id, workspace_id=workspace_id,
            )
        except DesignAsset.DoesNotExist:
            return {'error': f'DesignAsset {design_asset_id} not found.'}
    elif idea.niche_id:
        # EC-7: only treat a DesignAsset as "approved" when its linked Idea
        # carries Status.APPROVED. DesignAsset has no status of its own, so
        # the approval signal lives on the Idea side. A pending/draft design
        # alone must NOT short-circuit the text-only fallback.
        from idea_app.models import Idea as _Idea
        design = (
            DesignAsset.objects
            .filter(
                workspace_id=workspace_id,
                niche_id=idea.niche_id,
                idea__status=_Idea.Status.APPROVED,
            )
            .order_by('-created_at')
            .first()
        )
        if not design:
            text_only = True
    else:
        text_only = True

    valid_mt = {c[0] for c in Listing.MarketplaceType.choices}
    if marketplace_type not in valid_mt:
        marketplace_type = Listing.MarketplaceType.MBA

    listing = Listing.objects.create(
        workspace_id=workspace_id,
        idea=idea,
        design=design,
        marketplace_type=marketplace_type,
        title=idea.slogan_text[:60],
        bullet_1=(idea.why_it_works or idea.slogan_text)[:256],
        status=Listing.Status.DRAFT,
        generated_by=Listing.GeneratedBy.AI,
    )

    if text_only:
        _emit_session_message(
            session_id,
            'No design available, created text-only listing.',
        )

    return {
        'listing_id': str(listing.id),
        'status': listing.status,
        'marketplace_type': listing.marketplace_type,
        'design_id': str(design.id) if design else None,
        'text_only': text_only,
    }


@tool
@permission_check('read_listing')
def read_listing(
    listing_id: str,
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Read a listing's full state."""
    from publish_app.models import Listing

    workspace_id = _get_workspace_id(config)
    try:
        listing = Listing.objects.select_related('idea', 'design').get(
            id=listing_id, workspace_id=workspace_id,
        )
    except Listing.DoesNotExist:
        return {'error': f'Listing {listing_id} not found.'}

    return {
        'listing_id': str(listing.id),
        'idea_id': str(listing.idea_id),
        'design_id': str(listing.design_id) if listing.design_id else None,
        'marketplace_type': listing.marketplace_type,
        'status': listing.status,
        'brand_name': listing.brand_name,
        'title': listing.title,
        'bullet_1': listing.bullet_1,
        'bullet_2': listing.bullet_2,
        'description': listing.description,
        'language': listing.language,
        'translations_langs': sorted((listing.translations or {}).keys()),
    }


@tool
@permission_check('update_listing')
def update_listing(
    listing_id: str,
    fields: dict[str, Any],
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Update editable Listing fields.

    Args:
        listing_id: Listing UUID.
        fields: Subset of {brand_name, title, bullet_1, bullet_2, description,
            keyword_context, category}.
    """
    from publish_app.models import Listing

    workspace_id = _get_workspace_id(config)
    try:
        listing = Listing.objects.get(
            id=listing_id, workspace_id=workspace_id,
        )
    except Listing.DoesNotExist:
        return {'error': f'Listing {listing_id} not found.'}

    allowed = {
        'brand_name', 'title', 'bullet_1', 'bullet_2',
        'description', 'keyword_context', 'category',
    }
    updated: list[str] = []
    for k, v in fields.items():
        if k in allowed:
            setattr(listing, k, v)
            updated.append(k)
    if not updated:
        return {'error': 'No valid fields to update.'}
    updated.append('updated_at')
    listing.save(update_fields=updated)

    return {
        'listing_id': str(listing.id),
        'updated_fields': [f for f in updated if f != 'updated_at'],
    }


@tool
@permission_check('mark_listing_ready')
def mark_listing_ready(
    listing_id: str,
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Mark a listing as READY for upload."""
    from publish_app.models import Listing

    workspace_id = _get_workspace_id(config)
    try:
        listing = Listing.objects.get(
            id=listing_id, workspace_id=workspace_id,
        )
    except Listing.DoesNotExist:
        return {'error': f'Listing {listing_id} not found.'}

    listing.status = Listing.Status.READY
    listing.save(update_fields=['status', 'updated_at'])
    return {'listing_id': str(listing.id), 'status': listing.status}


@tool
@permission_check('export_listing')
def export_listing(
    listing_id: str,
    fmt: str = 'json',
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Export a single listing's flat data structure.

    Args:
        listing_id: Listing UUID.
        fmt: 'json' (default). XLSX/ZIP exports go through ExportLog +
            FlyingUpload service (see PROJ-11 Phase T) which is multi-listing.
    """
    from publish_app.models import Listing

    workspace_id = _get_workspace_id(config)
    try:
        listing = Listing.objects.select_related('idea', 'design').get(
            id=listing_id, workspace_id=workspace_id,
        )
    except Listing.DoesNotExist:
        return {'error': f'Listing {listing_id} not found.'}

    data = {
        'listing_id': str(listing.id),
        'idea_id': str(listing.idea_id),
        'design_id': str(listing.design_id) if listing.design_id else None,
        'marketplace_type': listing.marketplace_type,
        'status': listing.status,
        'brand_name': listing.brand_name,
        'title': listing.title,
        'bullet_1': listing.bullet_1,
        'bullet_2': listing.bullet_2,
        'description': listing.description,
        'language': listing.language,
        'translations': listing.translations,
    }
    return {'format': fmt, 'data': data}


TOOLS = [
    generate_listing,
    read_listing,
    update_listing,
    mark_listing_ready,
    export_listing,
]


__all__ = ['TOOLS', *(t.name for t in TOOLS)]
