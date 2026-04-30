"""Resolve agent action target objects to human-readable summaries.

Used by ``AgentActionLogSerializer.target_summary`` to turn a
``(target_object_type, target_object_id)`` pair into a friendly label
like ``"Niche: Wonder Valley"`` for the Agent Log UI.

Falls back gracefully to ``"<type>: (deleted)"`` when the referenced
object no longer exists, and to ``"<type>: <id>"`` for unknown types.
"""
from __future__ import annotations

import logging
import uuid
from typing import Callable

logger = logging.getLogger(__name__)


def _resolve_niche(target_id: uuid.UUID) -> str:
    from niche_app.models import Niche

    niche = Niche.objects.filter(id=target_id).only('name').first()
    return niche.name if niche else '(deleted)'


def _resolve_idea(target_id: uuid.UUID) -> str:
    try:
        from idea_app.models import Idea
    except ImportError:
        return str(target_id)
    obj = Idea.objects.filter(id=target_id).only('slogan_text').first()
    if not obj:
        return '(deleted)'
    slogan = getattr(obj, 'slogan_text', '') or ''
    return f"'{slogan[:60]}'" if slogan else str(target_id)


def _resolve_design(target_id: uuid.UUID) -> str:
    try:
        from design_app.models import Design
    except ImportError:
        return str(target_id)
    obj = Design.objects.filter(id=target_id).only('prompt_used').first()
    if not obj:
        return '(deleted)'
    prompt = getattr(obj, 'prompt_used', '') or ''
    return f"'{prompt[:60]}'" if prompt else str(target_id)


def _resolve_listing(target_id: uuid.UUID) -> str:
    try:
        from publish_app.models import Listing
    except ImportError:
        return str(target_id)
    obj = Listing.objects.filter(id=target_id).only('title').first()
    if not obj:
        return '(deleted)'
    title = getattr(obj, 'title', '') or ''
    return f"'{title[:60]}'" if title else str(target_id)


def _resolve_keyword(target_id: uuid.UUID) -> str:
    try:
        from keyword_app.models import NicheKeyword
    except ImportError:
        return str(target_id)
    obj = NicheKeyword.objects.filter(id=target_id).only('keyword').first()
    if not obj:
        return '(deleted)'
    term = getattr(obj, 'keyword', '') or ''
    return f"'{term}'" if term else str(target_id)


def _resolve_knowledge(target_id: uuid.UUID) -> str:
    from agent_app.models import KnowledgeDoc

    obj = KnowledgeDoc.objects.filter(id=target_id).only('title').first()
    return obj.title if obj else '(deleted)'


# Dispatch: target_object_type → resolver callable.
# Keys are stored case-insensitively; lookup normalises to lowercase.
_RESOLVERS: dict[str, Callable[[uuid.UUID], str]] = {
    'niche': _resolve_niche,
    'idea': _resolve_idea,
    'slogan': _resolve_idea,
    'design': _resolve_design,
    'listing': _resolve_listing,
    'keyword': _resolve_keyword,
    'knowledgedoc': _resolve_knowledge,
    'knowledge': _resolve_knowledge,
}


def resolve_target_summary(target_object_type: str, target_object_id) -> str | None:
    """Return human-readable label for a target reference.

    Returns ``None`` if the type/id pair is empty. Returns
    ``"<Type>: (deleted)"`` if the referenced object cannot be found.
    Never raises — failures degrade to ``"<type>: <id>"``.
    """
    if not target_object_type or not target_object_id:
        return None

    type_key = target_object_type.strip().lower()
    label = target_object_type.strip()

    resolver = _RESOLVERS.get(type_key)
    if resolver is None:
        # Unknown type: render the raw reference rather than crashing.
        return f"{label}: {target_object_id}"

    try:
        summary = resolver(target_object_id)
    except Exception:  # pragma: no cover - defensive
        logger.exception(
            'target_resolver failed for %s#%s', target_object_type, target_object_id,
        )
        return f"{label}: {target_object_id}"

    return f"{label}: {summary}"
