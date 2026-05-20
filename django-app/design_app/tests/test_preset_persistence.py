"""PROJ-34 Phase 13t-f — preset_persistence service tests.

Covers:
  * Fresh insert path
  * Dedup hit appends source_refs + bumps last_clicked_at
  * Dedup hit dedups identical refs (no infinite growth)
  * Dedup hit revives an evicted Custom row (AC-105)
  * LRU eviction at cap+1 (hard delete)
  * LRU eviction preserves Custom via flag-flip (AC-105)
  * LRU tie-break by older created_at (EC-37)
  * LRU tie-break by smallest id when (last_clicked_at, created_at) identical
  * promote_to_custom sets flag + attribution
  * promote_to_custom idempotent (does not bump custom_promoted_at)
  * promote_to_custom returns None when preset_id not found
  * unpromote_from_custom returns False when row still in History
  * unpromote_from_custom hard-deletes when row not in History either
  * unpromote_from_custom returns None when preset_id not found
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from design_app.models import NicheCardPreset
from design_app.services.preset_hash import compute_preset_hash
from design_app.services.preset_persistence import (
    promote_to_custom,
    unpromote_from_custom,
    upsert_preset,
)

pytestmark = pytest.mark.django_db


# ─── Fixtures ─────────────────────────────────────────────────────────────


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        email='persist@example.com', password='pw',
    )


@pytest.fixture
def workspace(user):
    from workspace_app.models import Membership, Workspace
    ws = Workspace.objects.create(
        name='Persist WS', slug='persist-ws', owner=user,
    )
    Membership.objects.create(
        workspace=ws, user=user, role='admin', status='active',
    )
    return ws


# ─── Helpers ──────────────────────────────────────────────────────────────


def _make_preset_dict(variant_key: str = 'default', label: str = 'Test Preset') -> dict:
    """Return a 17-key preset dict whose hash varies by `variant_key`."""
    return {
        'slot_spatial_configuration': 'center_burst',
        'slot_visual_description': f'A {variant_key} mountain scene with stars.',
        'slot_typography_adjectives': 'bold_serif',
        'slot_font_combination': 'display_plus_script',
        'slot_accessories': 'stars',
        'slot_style_dna': 'retro 70s travel poster aesthetic',
        'slot_extra_context': 'make sure the stars are 5-pointed',
        'spatial_is_raw': False,
        'visual_is_raw': True,
        'typography_is_raw': False,
        'font_combination_is_raw': False,
        'accessories_is_raw': False,
        'style_dna_is_raw': True,
        'extra_context_is_raw': True,
        'reference_thumbnail_url': 'https://example.com/thumb.jpg',
        'source_card_type': 'top',
        'preset_label': label,
    }


def _make_source_refs(niche_id: str = 'niche-1', product_ids=None) -> list[dict]:
    return [{'niche_id': niche_id, 'product_ids': list(product_ids or ['p1'])}]


def _create_preset(workspace, variant_key: str = 'seed', **overrides) -> NicheCardPreset:
    """Direct ORM-create for setup of existing-row tests (bypasses service)."""
    base = _make_preset_dict(variant_key=variant_key, label=overrides.pop('preset_label', 'Seed'))
    hash_input = {
        'spatial_configuration': base['slot_spatial_configuration'],
        'visual_description': base['slot_visual_description'],
        'typography_adjectives': base['slot_typography_adjectives'],
        'font_combination': base['slot_font_combination'],
        'accessories': base['slot_accessories'],
        'style_dna': base['slot_style_dna'],
        'extra_context': base['slot_extra_context'],
    }
    base_hash = compute_preset_hash(hash_input)
    return NicheCardPreset.objects.create(
        workspace=workspace,
        preset_hash=overrides.pop('preset_hash', base_hash),
        preset_label=base['preset_label'],
        slot_spatial_configuration=base['slot_spatial_configuration'],
        slot_visual_description=base['slot_visual_description'],
        slot_typography_adjectives=base['slot_typography_adjectives'],
        slot_font_combination=base['slot_font_combination'],
        slot_accessories=base['slot_accessories'],
        slot_style_dna=base['slot_style_dna'],
        slot_extra_context=base['slot_extra_context'],
        spatial_is_raw=base['spatial_is_raw'],
        visual_is_raw=base['visual_is_raw'],
        typography_is_raw=base['typography_is_raw'],
        font_combination_is_raw=base['font_combination_is_raw'],
        accessories_is_raw=base['accessories_is_raw'],
        style_dna_is_raw=base['style_dna_is_raw'],
        extra_context_is_raw=base['extra_context_is_raw'],
        reference_thumbnail_url=base['reference_thumbnail_url'],
        source_card_type=overrides.pop('source_card_type', 'top'),
        **overrides,
    )


# ─── upsert_preset — fresh insert ────────────────────────────────────────


def test_upsert_fresh_insert(workspace):
    """Empty workspace → new row created with all expected fields."""
    refs = _make_source_refs()
    row = upsert_preset(
        workspace_id=workspace.id,
        preset_dict=_make_preset_dict(),
        source_card_type='top',
        source_refs=refs,
    )

    assert row.pk is not None
    assert row.workspace_id == workspace.id
    assert row.is_in_history is True
    assert row.is_in_custom is False
    assert row.source_card_type == 'top'
    assert row.source_card_references == refs
    assert row.preset_label == 'Test Preset'
    assert NicheCardPreset.objects.filter(workspace=workspace).count() == 1


# ─── upsert_preset — dedup hit ───────────────────────────────────────────


def test_upsert_dedup_hit_appends_source_refs(workspace):
    """Same hash + different refs → one row, both refs present."""
    preset_dict = _make_preset_dict()
    upsert_preset(
        workspace_id=workspace.id,
        preset_dict=preset_dict,
        source_card_type='top',
        source_refs=_make_source_refs(niche_id='n-A', product_ids=['p1']),
    )
    row = upsert_preset(
        workspace_id=workspace.id,
        preset_dict=preset_dict,
        source_card_type='mix_safe',
        source_refs=_make_source_refs(niche_id='n-B', product_ids=['p2']),
    )

    assert NicheCardPreset.objects.filter(workspace=workspace).count() == 1
    assert len(row.source_card_references) == 2
    niche_ids = {ref['niche_id'] for ref in row.source_card_references}
    assert niche_ids == {'n-A', 'n-B'}


def test_upsert_dedup_hit_dedups_identical_refs(workspace):
    """Same hash + identical refs → no duplicate entries appended."""
    preset_dict = _make_preset_dict()
    refs = _make_source_refs(niche_id='n-1', product_ids=['p1', 'p2'])

    upsert_preset(
        workspace_id=workspace.id,
        preset_dict=preset_dict,
        source_card_type='top',
        source_refs=refs,
    )
    # Same refs (intentionally re-ordered product_ids → still same logical ref).
    row = upsert_preset(
        workspace_id=workspace.id,
        preset_dict=preset_dict,
        source_card_type='top',
        source_refs=[{'niche_id': 'n-1', 'product_ids': ['p2', 'p1']}],
    )

    assert NicheCardPreset.objects.filter(workspace=workspace).count() == 1
    assert len(row.source_card_references) == 1


def test_upsert_dedup_hit_updates_last_clicked_at(workspace):
    """Dedup hit bumps last_clicked_at to ~now."""
    preset_dict = _make_preset_dict()
    first = upsert_preset(
        workspace_id=workspace.id,
        preset_dict=preset_dict,
        source_card_type='top',
        source_refs=_make_source_refs(),
    )
    # Force last_clicked_at into the past.
    old_time = timezone.now() - timedelta(hours=2)
    NicheCardPreset.objects.filter(pk=first.pk).update(last_clicked_at=old_time)

    updated = upsert_preset(
        workspace_id=workspace.id,
        preset_dict=preset_dict,
        source_card_type='top',
        source_refs=_make_source_refs(niche_id='n-2'),
    )

    assert updated.last_clicked_at > old_time + timedelta(minutes=30)


def test_upsert_dedup_revives_evicted_custom(workspace):
    """Custom row previously evicted (is_in_history=False) → upsert revives history flag."""
    preset_dict = _make_preset_dict()
    # Seed with the SAME slot values the upsert will use so the hashes match.
    custom_only = _create_preset(
        workspace,
        variant_key='default',
        is_in_history=False,
        is_in_custom=True,
    )

    row = upsert_preset(
        workspace_id=workspace.id,
        preset_dict=preset_dict,
        source_card_type='top',
        source_refs=_make_source_refs(),
    )

    row.refresh_from_db()
    assert row.pk == custom_only.pk
    assert row.is_in_history is True
    assert row.is_in_custom is True


# ─── upsert_preset — LRU eviction ─────────────────────────────────────────


def _stagger_seed(workspace, count: int, custom_at_oldest: bool = False) -> list[NicheCardPreset]:
    """Create `count` history rows with strictly increasing last_clicked_at."""
    now = timezone.now()
    rows: list[NicheCardPreset] = []
    for i in range(count):
        row = _create_preset(
            workspace,
            variant_key=f'seed-{i}',
            preset_hash=f'{i:064x}',
            is_in_history=True,
            is_in_custom=(custom_at_oldest and i == 0),
        )
        # Stagger from oldest (i=0) to newest (i=count-1).
        NicheCardPreset.objects.filter(pk=row.pk).update(
            last_clicked_at=now - timedelta(hours=count - i),
        )
        row.refresh_from_db()
        rows.append(row)
    return rows


def test_upsert_lru_eviction_at_cap(workspace, settings):
    """At cap+1 → oldest non-custom row hard-deleted, total history stays at cap."""
    settings.NICHE_PRESET_HISTORY_CAP = 5
    seeded = _stagger_seed(workspace, count=5, custom_at_oldest=False)
    oldest = seeded[0]

    upsert_preset(
        workspace_id=workspace.id,
        preset_dict=_make_preset_dict(variant_key='new-distinct'),
        source_card_type='top',
        source_refs=_make_source_refs(),
    )

    assert NicheCardPreset.objects.filter(workspace=workspace, is_in_history=True).count() == 5
    assert not NicheCardPreset.objects.filter(pk=oldest.pk).exists()


def test_upsert_lru_preserves_custom_via_flag_flip(workspace, settings):
    """Oldest row is Custom → keeps row but flips is_in_history=False (AC-105)."""
    settings.NICHE_PRESET_HISTORY_CAP = 5
    seeded = _stagger_seed(workspace, count=5, custom_at_oldest=True)
    oldest = seeded[0]
    assert oldest.is_in_custom is True

    upsert_preset(
        workspace_id=workspace.id,
        preset_dict=_make_preset_dict(variant_key='new-distinct'),
        source_card_type='top',
        source_refs=_make_source_refs(),
    )

    oldest.refresh_from_db()
    assert oldest.is_in_history is False
    assert oldest.is_in_custom is True
    # Total rows in workspace = 5 surviving history + 1 flag-flipped custom = 6
    assert NicheCardPreset.objects.filter(workspace=workspace).count() == 6
    assert NicheCardPreset.objects.filter(workspace=workspace, is_in_history=True).count() == 5


def test_upsert_lru_tie_break_by_created_at(workspace, settings):
    """Identical last_clicked_at → older created_at wins eviction."""
    settings.NICHE_PRESET_HISTORY_CAP = 2
    # Build 2 rows with IDENTICAL last_clicked_at but different created_at.
    now = timezone.now()
    older = _create_preset(workspace, variant_key='older', preset_hash='1' * 64)
    newer = _create_preset(workspace, variant_key='newer', preset_hash='2' * 64)
    shared_click = now - timedelta(hours=1)
    NicheCardPreset.objects.filter(pk=older.pk).update(
        last_clicked_at=shared_click,
        created_at=now - timedelta(days=2),
    )
    NicheCardPreset.objects.filter(pk=newer.pk).update(
        last_clicked_at=shared_click,
        created_at=now - timedelta(days=1),
    )

    upsert_preset(
        workspace_id=workspace.id,
        preset_dict=_make_preset_dict(variant_key='trigger-evict'),
        source_card_type='top',
        source_refs=_make_source_refs(),
    )

    assert not NicheCardPreset.objects.filter(pk=older.pk).exists()
    assert NicheCardPreset.objects.filter(pk=newer.pk).exists()


def test_upsert_lru_tie_break_by_id(workspace, settings):
    """Identical (last_clicked_at, created_at) → smallest id wins eviction."""
    settings.NICHE_PRESET_HISTORY_CAP = 2
    now = timezone.now()
    a = _create_preset(workspace, variant_key='a', preset_hash='a' * 64)
    b = _create_preset(workspace, variant_key='b', preset_hash='b' * 64)
    NicheCardPreset.objects.filter(pk__in=[a.pk, b.pk]).update(
        last_clicked_at=now - timedelta(hours=1),
        created_at=now - timedelta(days=1),
    )

    upsert_preset(
        workspace_id=workspace.id,
        preset_dict=_make_preset_dict(variant_key='trigger-evict'),
        source_card_type='top',
        source_refs=_make_source_refs(),
    )

    # Whichever UUID sorts first ascending should be the victim.
    smaller, larger = sorted([a, b], key=lambda r: r.pk)
    assert not NicheCardPreset.objects.filter(pk=smaller.pk).exists()
    assert NicheCardPreset.objects.filter(pk=larger.pk).exists()


# ─── promote_to_custom ────────────────────────────────────────────────────


def test_promote_sets_flag_and_attribution(workspace, user):
    """First promote → is_in_custom=True + by/at populated."""
    preset = _create_preset(workspace, is_in_history=True, is_in_custom=False)
    promoted = promote_to_custom(preset.pk, user)

    assert promoted is not None
    promoted.refresh_from_db()
    assert promoted.is_in_custom is True
    assert promoted.custom_promoted_by_id == user.id
    assert promoted.custom_promoted_at is not None


def test_promote_idempotent(workspace, user):
    """Re-promoting a Custom row → same row, custom_promoted_at unchanged."""
    preset = _create_preset(workspace, is_in_history=True, is_in_custom=False)
    promote_to_custom(preset.pk, user)
    preset.refresh_from_db()
    first_promoted_at = preset.custom_promoted_at

    again = promote_to_custom(preset.pk, user)
    assert again is not None
    again.refresh_from_db()
    assert again.is_in_custom is True
    assert again.custom_promoted_at == first_promoted_at


def test_promote_returns_none_when_not_found():
    """Bogus preset_id → None (caller translates to 404)."""
    import uuid
    assert promote_to_custom(uuid.uuid4(), user=None) is None


# ─── unpromote_from_custom ────────────────────────────────────────────────


def test_unpromote_when_still_in_history_returns_false(workspace, user):
    """Row in both flags → unpromote clears Custom, returns False, row survives."""
    preset = _create_preset(
        workspace, is_in_history=True, is_in_custom=True,
        custom_promoted_by=user, custom_promoted_at=timezone.now(),
    )

    result = unpromote_from_custom(preset.pk)

    assert result is False
    preset.refresh_from_db()
    assert preset.is_in_custom is False
    assert preset.custom_promoted_by is None
    assert preset.custom_promoted_at is None
    assert preset.is_in_history is True


def test_unpromote_when_only_in_custom_hard_deletes(workspace, user):
    """Custom-only row (already evicted from History) → hard-delete on unpromote."""
    preset = _create_preset(
        workspace, is_in_history=False, is_in_custom=True,
        custom_promoted_by=user, custom_promoted_at=timezone.now(),
    )

    result = unpromote_from_custom(preset.pk)

    assert result is True
    assert not NicheCardPreset.objects.filter(pk=preset.pk).exists()


def test_unpromote_returns_none_when_not_found():
    """Bogus preset_id → None (caller translates to 404)."""
    import uuid
    assert unpromote_from_custom(uuid.uuid4()) is None
