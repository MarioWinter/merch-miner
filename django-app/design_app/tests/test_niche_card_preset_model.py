"""PROJ-34 Phase 13t-a — NicheCardPreset model tests.

Covers:
- Field round-trip on save + reload
- (workspace, preset_hash) UniqueConstraint enforcement
- Default ordering by `-last_clicked_at`
- JSONField round-trip on `source_card_references`

No service / API / LLM coverage in this phase — those land in 13t-b onward.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.db.utils import IntegrityError
from django.utils import timezone

from design_app.models import NicheCardPreset

pytestmark = pytest.mark.django_db


# ─── Fixtures ─────────────────────────────────────────────────────────────


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        email='preset@example.com', password='pw',
    )


@pytest.fixture
def workspace(user):
    from workspace_app.models import Membership, Workspace
    ws = Workspace.objects.create(
        name='Preset WS', slug='preset-ws', owner=user,
    )
    Membership.objects.create(
        workspace=ws, user=user, role='admin', status='active',
    )
    return ws


# ─── Tests ────────────────────────────────────────────────────────────────


def test_save_roundtrip(workspace, user):
    """All fields persist + reload identically."""
    preset = NicheCardPreset.objects.create(
        workspace=workspace,
        preset_hash='a' * 64,
        preset_label='Vintage Mountain Vibe',
        slot_spatial_configuration='center_burst',
        slot_visual_description='A vintage mountain scene with stars.',
        slot_typography_adjectives='bold_serif',
        slot_font_combination='display_plus_script',
        slot_accessories='stars',
        slot_style_dna='retro 70s travel poster aesthetic',
        slot_extra_context='make sure the stars are 5-pointed',
        spatial_is_raw=False,
        visual_is_raw=True,
        typography_is_raw=False,
        font_combination_is_raw=False,
        accessories_is_raw=False,
        style_dna_is_raw=True,
        extra_context_is_raw=True,
        reference_thumbnail_url='https://example.com/thumb.jpg',
        source_card_type='top',
        source_card_references=[{'niche_id': 'n-1', 'product_ids': ['p-1', 'p-2']}],
        is_in_history=True,
        is_in_custom=False,
        custom_promoted_by=user,
    )

    reloaded = NicheCardPreset.objects.get(pk=preset.pk)
    assert reloaded.preset_hash == 'a' * 64
    assert reloaded.preset_label == 'Vintage Mountain Vibe'
    assert reloaded.slot_spatial_configuration == 'center_burst'
    assert reloaded.slot_visual_description == 'A vintage mountain scene with stars.'
    assert reloaded.slot_typography_adjectives == 'bold_serif'
    assert reloaded.slot_font_combination == 'display_plus_script'
    assert reloaded.slot_accessories == 'stars'
    assert reloaded.slot_style_dna == 'retro 70s travel poster aesthetic'
    assert reloaded.slot_extra_context == 'make sure the stars are 5-pointed'
    assert reloaded.spatial_is_raw is False
    assert reloaded.visual_is_raw is True
    assert reloaded.typography_is_raw is False
    assert reloaded.font_combination_is_raw is False
    assert reloaded.accessories_is_raw is False
    assert reloaded.style_dna_is_raw is True
    assert reloaded.extra_context_is_raw is True
    assert reloaded.reference_thumbnail_url == 'https://example.com/thumb.jpg'
    assert reloaded.source_card_type == 'top'
    assert reloaded.is_in_history is True
    assert reloaded.is_in_custom is False
    assert reloaded.custom_promoted_by_id == user.id
    assert reloaded.workspace_id == workspace.id


def test_unique_workspace_hash_constraint(workspace):
    """Same workspace + same preset_hash raises IntegrityError."""
    NicheCardPreset.objects.create(
        workspace=workspace,
        preset_hash='b' * 64,
        preset_label='First',
        source_card_type='top',
    )
    with pytest.raises(IntegrityError):
        NicheCardPreset.objects.create(
            workspace=workspace,
            preset_hash='b' * 64,
            preset_label='Duplicate',
            source_card_type='mix_safe',
        )


def test_default_ordering_last_clicked_desc(workspace):
    """Default queryset orders by `-last_clicked_at` (most recent first)."""
    now = timezone.now()
    p_old = NicheCardPreset.objects.create(
        workspace=workspace,
        preset_hash='c' * 64,
        preset_label='Old',
        source_card_type='top',
        last_clicked_at=now - timedelta(hours=2),
    )
    p_mid = NicheCardPreset.objects.create(
        workspace=workspace,
        preset_hash='d' * 64,
        preset_label='Mid',
        source_card_type='mix_safe',
        last_clicked_at=now - timedelta(hours=1),
    )
    p_new = NicheCardPreset.objects.create(
        workspace=workspace,
        preset_hash='e' * 64,
        preset_label='New',
        source_card_type='mix_edgy',
        last_clicked_at=now,
    )

    ordered_pks = list(
        NicheCardPreset.objects.filter(workspace=workspace).values_list('pk', flat=True),
    )
    assert ordered_pks == [p_new.pk, p_mid.pk, p_old.pk]


def test_source_card_references_jsonfield_roundtrip(workspace):
    """`source_card_references` JSONField persists list-of-dicts shape."""
    refs = [
        {'niche_id': 'niche-aaa', 'product_ids': ['p1', 'p2', 'p3']},
        {'niche_id': 'niche-bbb', 'product_ids': ['p4']},
    ]
    preset = NicheCardPreset.objects.create(
        workspace=workspace,
        preset_hash='f' * 64,
        preset_label='Refs Test',
        source_card_type='mix_most_common',
        source_card_references=refs,
    )
    reloaded = NicheCardPreset.objects.get(pk=preset.pk)
    assert reloaded.source_card_references == refs
