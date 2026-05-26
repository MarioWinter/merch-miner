"""PROJ-34 Phase 13t — NicheCardPreset persistence: hash-dedup + LRU eviction + Custom promote/unpromote.

Workspace-scoped service that:
  * Upserts a preset by SHA256 hash over its 7 normalized slot values
    (`upsert_preset`). Dedup hits append the source-card reference list
    and bump `last_clicked_at`; misses INSERT and enforce an LRU cap of
    ``NICHE_PRESET_HISTORY_CAP`` history rows per workspace.
  * Promotes a History entry to Custom (`promote_to_custom`) — idempotent;
    re-promotion does not bump ``custom_promoted_at``.
  * Unpromotes from Custom (`unpromote_from_custom`) — hard-deletes the
    row only when neither flag remains set (orphan cleanup edge).

LRU tie-break is deterministic: ``last_clicked_at`` ASC, then ``created_at``
ASC, then ``id`` ASC (per spec EC-37). Custom-flagged rows survive eviction
via flag-flip (``is_in_history=False``), not hard delete (per AC-105).
"""

from __future__ import annotations

import logging

from django.conf import settings
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


# ─── upsert_preset ────────────────────────────────────────────────────────


@transaction.atomic
def upsert_preset(
    workspace_id,
    preset_dict: dict,
    source_card_type: str,
    source_refs: list[dict],
):
    """Upsert a NicheCardPreset row by (workspace, preset_hash) with LRU cap.

    Args:
      workspace_id: Workspace PK the preset belongs to.
      preset_dict: Output of ``top_card_builder.build_top_card_preset`` (or
        the per-variant builder in Phase 13t-d). Must contain the 7
        ``slot_*`` keys, the 7 ``*_is_raw`` flags, ``reference_thumbnail_url``,
        and ``preset_label``. ``source_card_type`` / ``source_card_references``
        in the dict are ignored — the explicit args take precedence.
      source_card_type: One of ``'top' | 'mix_most_common' | 'mix_edgy' | 'mix_safe'``.
      source_refs: list of ``{'niche_id': str, 'product_ids': list[str]}``.

    Returns:
      The persisted/updated NicheCardPreset instance.

    Behavior:
      1. Compute deterministic hash over the 7 slot values.
      2. SELECT FOR UPDATE existing row in workspace by hash.
      3a. Hit → append source_refs (deduped on (niche_id, product_ids)),
          set ``last_clicked_at=now()``, set ``is_in_history=True`` (revives
          previously-evicted Custom rows per AC-105), save. Return.
      3b. Miss → INSERT with ``is_in_history=True, is_in_custom=False``.
          Then enforce LRU cap.
    """
    from design_app.models import NicheCardPreset
    from design_app.services.preset_hash import compute_preset_hash

    hash_input = {
        'spatial_configuration': preset_dict.get('slot_spatial_configuration', ''),
        'visual_description': preset_dict.get('slot_visual_description', ''),
        'typography_adjectives': preset_dict.get('slot_typography_adjectives', ''),
        'font_combination': preset_dict.get('slot_font_combination', ''),
        'accessories': preset_dict.get('slot_accessories', ''),
        'style_dna': preset_dict.get('slot_style_dna', ''),
        'extra_context': preset_dict.get('slot_extra_context', ''),
    }
    preset_hash = compute_preset_hash(hash_input)

    existing = (
        NicheCardPreset.objects
        .select_for_update()
        .filter(workspace_id=workspace_id, preset_hash=preset_hash)
        .first()
    )

    now = timezone.now()

    if existing is not None:
        merged_refs = _merge_source_refs(
            existing.source_card_references or [], source_refs,
        )
        existing.source_card_references = merged_refs
        existing.last_clicked_at = now
        # Revive flag if this preset was previously evicted but kept as Custom
        # (AC-105: dedup hit on a custom-only row brings it back into History).
        if not existing.is_in_history:
            existing.is_in_history = True
        existing.save()
        return existing

    new_row = NicheCardPreset.objects.create(
        workspace_id=workspace_id,
        preset_hash=preset_hash,
        preset_label=preset_dict.get('preset_label', '')[:200],
        slot_spatial_configuration=preset_dict.get('slot_spatial_configuration', ''),
        slot_visual_description=preset_dict.get('slot_visual_description', ''),
        slot_typography_adjectives=preset_dict.get('slot_typography_adjectives', ''),
        slot_font_combination=preset_dict.get('slot_font_combination', ''),
        slot_accessories=preset_dict.get('slot_accessories', ''),
        slot_style_dna=preset_dict.get('slot_style_dna', ''),
        slot_extra_context=preset_dict.get('slot_extra_context', ''),
        spatial_is_raw=preset_dict.get('spatial_is_raw', False),
        visual_is_raw=preset_dict.get('visual_is_raw', False),
        typography_is_raw=preset_dict.get('typography_is_raw', False),
        font_combination_is_raw=preset_dict.get('font_combination_is_raw', False),
        accessories_is_raw=preset_dict.get('accessories_is_raw', False),
        style_dna_is_raw=preset_dict.get('style_dna_is_raw', False),
        extra_context_is_raw=preset_dict.get('extra_context_is_raw', False),
        reference_thumbnail_url=preset_dict.get('reference_thumbnail_url', '')[:500],
        source_card_type=source_card_type,
        source_card_references=list(source_refs or []),
        is_in_history=True,
        is_in_custom=False,
        last_clicked_at=now,
    )

    _enforce_lru_cap(workspace_id)
    return new_row


def _merge_source_refs(existing: list[dict], incoming: list[dict]) -> list[dict]:
    """Append `incoming` to `existing`, skipping rows already present.

    Identity = ``(niche_id, sorted(product_ids))``. Append-only — order of
    existing entries is preserved.
    """
    seen: set[tuple] = set()
    merged: list[dict] = []
    for ref in list(existing) + list(incoming or []):
        key = (
            str(ref.get('niche_id', '')),
            tuple(sorted(str(p) for p in (ref.get('product_ids') or []))),
        )
        if key in seen:
            continue
        seen.add(key)
        merged.append(ref)
    return merged


def _enforce_lru_cap(workspace_id) -> None:
    """Drop the oldest history row if workspace history count exceeds cap.

    Custom-flagged victims survive via ``is_in_history=False`` (AC-105);
    non-custom victims are hard-deleted. Runs inside the caller's
    ``@transaction.atomic`` block with ``select_for_update`` on the victim.
    """
    from design_app.models import NicheCardPreset

    cap = getattr(settings, 'NICHE_PRESET_HISTORY_CAP', 50)
    count = NicheCardPreset.objects.filter(
        workspace_id=workspace_id, is_in_history=True,
    ).count()
    if count <= cap:
        return

    victim = (
        NicheCardPreset.objects
        .select_for_update()
        .filter(workspace_id=workspace_id, is_in_history=True)
        .order_by('last_clicked_at', 'created_at', 'id')
        .first()
    )
    if victim is None:
        return

    if victim.is_in_custom:
        logger.warning(
            'preset_persistence: LRU victim is in Custom — preserving row '
            '(workspace=%s preset=%s)',
            workspace_id, victim.id,
        )
        victim.is_in_history = False
        victim.save(update_fields=['is_in_history', 'updated_at'])
    else:
        logger.info(
            'preset_persistence: LRU evicting history row '
            '(workspace=%s preset=%s last_clicked_at=%s)',
            workspace_id, victim.id, victim.last_clicked_at,
        )
        victim.delete()


# ─── promote_to_custom ────────────────────────────────────────────────────


@transaction.atomic
def promote_to_custom(preset_id, user):
    """Promote a NicheCardPreset to Custom. Idempotent.

    If the preset is already ``is_in_custom=True``, the row is returned
    unchanged (``custom_promoted_at`` is NOT bumped) so attribution stays
    pinned to the first promotion.

    Returns:
      The NicheCardPreset row, or ``None`` if no row matches ``preset_id``.
    """
    from design_app.models import NicheCardPreset

    preset = (
        NicheCardPreset.objects
        .select_for_update()
        .filter(pk=preset_id)
        .first()
    )
    if preset is None:
        return None

    if preset.is_in_custom:
        return preset

    preset.is_in_custom = True
    preset.custom_promoted_by = user
    preset.custom_promoted_at = timezone.now()
    preset.save(update_fields=[
        'is_in_custom', 'custom_promoted_by', 'custom_promoted_at', 'updated_at',
    ])
    return preset


# ─── unpromote_from_custom ────────────────────────────────────────────────


@transaction.atomic
def unpromote_from_custom(preset_id):
    """Remove a NicheCardPreset from Custom; hard-delete if also out of History.

    Returns:
      ``True`` if the row was hard-deleted (orphan cleanup).
      ``False`` if the row survived (still in History).
      ``None`` if no row matches ``preset_id``.
    """
    from design_app.models import NicheCardPreset

    preset = (
        NicheCardPreset.objects
        .select_for_update()
        .filter(pk=preset_id)
        .first()
    )
    if preset is None:
        return None

    preset.is_in_custom = False
    preset.custom_promoted_by = None
    preset.custom_promoted_at = None

    if not preset.is_in_history:
        preset.delete()
        return True

    preset.save(update_fields=[
        'is_in_custom', 'custom_promoted_by', 'custom_promoted_at', 'updated_at',
    ])
    return False


__all__ = [
    'upsert_preset',
    'promote_to_custom',
    'unpromote_from_custom',
]
