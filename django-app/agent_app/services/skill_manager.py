"""Skill manager service — AC-68 (Phase 14, Metis Pattern).

Provides:
    - find_relevant_skills(): Vector DB similarity search filtered by
      ``applicable_agent_types`` and active (not soft-deleted).
    - create_skill(): persists Skill + initial SkillVersion + queues embedding.
    - patch_skill(): optimistic concurrency PATCH — bumps version,
      snapshots prior version into SkillVersion.
    - record_skill_outcome(): increments success/error counts.
    - soft_delete_skill(): sets ``deleted_at`` and removes Vector DB embedding.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.utils import timezone

from agent_app.models import (
    Skill,
    SkillTriggerType,
    SkillVersion,
)

logger = logging.getLogger(__name__)


class VersionConflict(Exception):
    """EC-19 — raised when patch_skill called with a stale expected_version."""

    def __init__(self, current_version: int, expected_version: int):
        self.current_version = current_version
        self.expected_version = expected_version
        super().__init__(
            f"Skill version conflict: expected={expected_version}, "
            f"current={current_version}",
        )


# ── find_relevant_skills ─────────────────────────────────────────────────────


def find_relevant_skills(
    workspace,
    agent_type: str,
    task_description: str,
    *,
    k: int = 3,
    max_chars_each: int = 1500,
) -> list[dict[str, Any]]:
    """AC-68 — Top-K active skills applicable to ``agent_type`` + task.

    Filters: workspace-scoped, ``deleted_at IS NULL``,
    ``agent_type in applicable_agent_types`` (or empty applicable list ==
    "applicable to all agent types").

    Falls back to most-recently-used active skills when Vector DB is
    unavailable or returns no results.
    """
    if k <= 0:
        return []

    base_qs = Skill.objects.filter(
        workspace=workspace,
        deleted_at__isnull=True,
    )

    # Vector DB hybrid similarity search (PROJ-15) — best effort.
    candidate_ids: list[str] = []
    try:
        from vector_app.services import EmbeddingService

        if task_description and task_description.strip():
            service = EmbeddingService()
            results = service.search(
                query=task_description,
                workspace_id=workspace.pk if hasattr(workspace, 'pk') else workspace,
                content_types=['skill'],
                top_k=k * 3,  # Over-fetch — applicable_agent_types filter narrows.
            ) or []
            candidate_ids = [r['object_id'] for r in results]
    except ImportError:
        logger.debug('vector_app unavailable; falling back to recency.')
    except Exception as exc:  # pragma: no cover — vector failures shouldn't crash agents
        logger.warning('skill_manager vector search failed: %s', exc)

    if candidate_ids:
        # Preserve order from vector results.
        skills = list(base_qs.filter(id__in=candidate_ids))
        by_id = {str(s.id): s for s in skills}
        ordered = [by_id[str(sid)] for sid in candidate_ids if str(sid) in by_id]
    else:
        ordered = list(base_qs.order_by('-last_used_at', '-updated_at')[:k * 3])

    # Filter by applicable_agent_types (empty list == matches any agent_type).
    filtered = [
        s for s in ordered
        if not s.applicable_agent_types or agent_type in (s.applicable_agent_types or [])
    ]

    out = []
    for s in filtered[:k]:
        content = (s.content_md or '')[:max_chars_each]
        out.append({
            'id': str(s.id),
            'name': s.name,
            'description': s.description,
            'content_md': content,
            'version': s.version,
            'trigger_type': s.trigger_type,
            'applicable_agent_types': list(s.applicable_agent_types or []),
        })
    return out


# ── create_skill ─────────────────────────────────────────────────────────────


def create_skill(
    *,
    workspace,
    name: str,
    description: str,
    content_md: str,
    trigger_type: str = SkillTriggerType.MANUAL,
    applicable_agent_types: Optional[list[str]] = None,
    created_by_session=None,
    created_by=None,
    patch_summary: str = '',
) -> Skill:
    """Create a new Skill + initial SkillVersion + Vector DB embedding."""
    with transaction.atomic():
        skill = Skill.objects.create(
            workspace=workspace,
            name=name[:200],
            description=description or '',
            content_md=content_md or '',
            version=1,
            trigger_type=trigger_type or SkillTriggerType.MANUAL,
            applicable_agent_types=list(applicable_agent_types or []),
            created_by_session=created_by_session,
            created_by=created_by,
        )
        SkillVersion.objects.create(
            skill=skill,
            version=1,
            content_md=skill.content_md,
            patch_summary=patch_summary or 'Initial version',
        )

        # Vector DB embedding via post_save signal (transaction.on_commit
        # in signals.py guards the worker race-window).
    return skill


# ── patch_skill ──────────────────────────────────────────────────────────────


def patch_skill(
    skill_id,
    patch_md: str,
    expected_version: int,
    *,
    patch_summary: str = '',
) -> Skill:
    """AC-72 — Apply a patch to an existing Skill with optimistic concurrency.

    The new ``content_md`` is frozen as a SkillVersion row at the bumped
    version number; the Skill itself is updated in place. The prior
    version's snapshot already exists from the previous create/patch
    call (append-only audit chain — Decision #30).
    Raises ``VersionConflict`` if ``expected_version`` doesn't match
    the current row (EC-19).
    """
    with transaction.atomic():
        skill = Skill.objects.select_for_update().get(pk=skill_id)
        if skill.version != expected_version:
            raise VersionConflict(skill.version, expected_version)

        new_version = skill.version + 1
        new_content = patch_md or ''

        # Apply patch + bump version on the live row.
        skill.content_md = new_content
        skill.version = new_version
        skill.save(update_fields=['content_md', 'version', 'updated_at'])

        # Append the new version to the audit chain.
        SkillVersion.objects.create(
            skill=skill,
            version=new_version,
            content_md=new_content,
            patch_summary=patch_summary or f'Patched to v{new_version}',
        )
    # post_save signal re-embeds the new content (transaction.on_commit).
    return skill


# ── record_skill_outcome ─────────────────────────────────────────────────────


def record_skill_outcome(skill_id, success: bool) -> None:
    """Increment success/error counts + bump last_used_at."""
    update = {'last_used_at': timezone.now()}
    if success:
        update['success_count'] = (
            Skill.objects.filter(pk=skill_id).values_list('success_count', flat=True).first() or 0
        ) + 1
    else:
        update['error_count'] = (
            Skill.objects.filter(pk=skill_id).values_list('error_count', flat=True).first() or 0
        ) + 1
    Skill.objects.filter(pk=skill_id).update(**update)


# ── soft_delete_skill ────────────────────────────────────────────────────────


def soft_delete_skill(skill_id) -> bool:
    """EC-22 — soft-delete: sets ``deleted_at``; signal removes embedding.

    Returns True if a row was updated (False if already deleted / missing).
    """
    skill = Skill.objects.filter(pk=skill_id, deleted_at__isnull=True).first()
    if not skill:
        return False
    with transaction.atomic():
        skill.deleted_at = timezone.now()
        skill.save(update_fields=['deleted_at', 'updated_at'])

    # Remove embedding via Vector DB (the Skill row is still present —
    # signal can't fire for a soft-delete, so do it explicitly here).
    def _drop_embedding():
        try:
            from vector_app.services import EmbeddingService
            ct = ContentType.objects.get_for_model(Skill)
            EmbeddingService().delete_embedding_by_ref(
                content_type_id=ct.id,
                object_id=str(skill.pk),
            )
        except Exception:
            logger.warning('soft_delete_skill: vector delete failed', exc_info=True)

    transaction.on_commit(_drop_embedding)
    return True


__all__ = [
    'VersionConflict',
    'find_relevant_skills',
    'create_skill',
    'patch_skill',
    'record_skill_outcome',
    'soft_delete_skill',
]
