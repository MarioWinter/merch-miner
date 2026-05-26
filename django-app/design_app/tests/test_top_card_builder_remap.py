"""PROJ-34 Phase 13t-p — Tests for top_card_builder source-field remap.

Covers AC-134: typography/font_combination/accessories slots draw from the new
distinct vision fields, falling back to `graphic_elements` when empty.
"""

from __future__ import annotations

import pytest
from django.utils import timezone

from design_app.services.top_card_builder import build_top_card_preset
from niche_app.models import Niche
from niche_research_app.models import (
    NicheProductVisionAnalysis,
    NicheResearch,
    NicheResearchProduct,
)
from scraper_app.models import AmazonProduct
from user_auth_app.models import User
from workspace_app.models import Membership, Workspace

pytestmark = pytest.mark.django_db


def _setup(
    *,
    graphic_elements: str = 'fallback graphic prose blob',
    typography_descriptors: str = '',
    font_combination_descriptors: str = '',
    accessory_descriptors: str = '',
):
    email = 'remap@example.com'
    user = User.objects.create_user(email=email, password='pw', username=email)
    workspace = Workspace.objects.create(
        name='Remap WS', slug='remap-ws', owner=user,
    )
    Membership.objects.create(
        workspace=workspace, user=user, role='admin', status='active',
    )
    niche = Niche.objects.create(
        workspace=workspace, name='Remap Niche', created_by=user,
    )
    research = NicheResearch.objects.create(
        niche=niche,
        status=NicheResearch.Status.COMPLETED,
        triggered_by=user,
        completed_at=timezone.now(),
    )
    product = AmazonProduct.objects.create(
        asin='BREMAPP001',
        marketplace='amazon_com',
        title='Remap Test Tee',
        thumbnail_url='https://images.example.com/remap.jpg',
    )
    NicheResearchProduct.objects.create(
        research=research, product=product, brand_blocked=False,
    )
    vision = NicheProductVisionAnalysis.objects.create(
        research=research,
        product=product,
        slogan_text='Remap Test',
        meaning_context='ctx',
        visual_style='style',
        graphic_elements=graphic_elements,
        layout_composition='layout',
        typography_descriptors=typography_descriptors,
        font_combination_descriptors=font_combination_descriptors,
        accessory_descriptors=accessory_descriptors,
        is_niche_match=True,
    )
    return niche, vision


def test_uses_typography_descriptors_when_present():
    niche, vision = _setup(
        graphic_elements='GRAPHIC ELEMENTS BLOB',
        typography_descriptors='bold uppercase block letters for primary headline',
    )
    result = build_top_card_preset(vision, niche)
    assert 'primary headline' in result['slot_typography_adjectives']
    assert 'GRAPHIC ELEMENTS BLOB' not in result['slot_typography_adjectives']


def test_falls_back_to_graphic_elements_when_typography_empty():
    niche, vision = _setup(
        graphic_elements='THIS IS THE FALLBACK SOURCE',
        typography_descriptors='',
    )
    result = build_top_card_preset(vision, niche)
    assert 'FALLBACK SOURCE' in result['slot_typography_adjectives']


def test_uses_font_combination_descriptors_when_present():
    niche, vision = _setup(
        graphic_elements='wrong fallback',
        font_combination_descriptors='Sans-serif uppercase + cursive accent',
    )
    result = build_top_card_preset(vision, niche)
    assert 'Sans-serif' in result['slot_font_combination']
    assert 'wrong fallback' not in result['slot_font_combination']


def test_falls_back_to_graphic_elements_when_font_empty():
    niche, vision = _setup(
        graphic_elements='FONT FALLBACK SOURCE',
        font_combination_descriptors='',
    )
    result = build_top_card_preset(vision, niche)
    assert 'FONT FALLBACK SOURCE' in result['slot_font_combination']


def test_uses_accessory_descriptors_when_present():
    niche, vision = _setup(
        graphic_elements='wrong fallback',
        accessory_descriptors='white stars and decorative lines',
    )
    result = build_top_card_preset(vision, niche)
    assert 'stars' in result['slot_accessories']
    assert 'wrong fallback' not in result['slot_accessories']


def test_falls_back_to_graphic_elements_when_accessory_empty():
    niche, vision = _setup(
        graphic_elements='ACCESSORY FALLBACK SOURCE',
        accessory_descriptors='',
    )
    result = build_top_card_preset(vision, niche)
    assert 'ACCESSORY FALLBACK SOURCE' in result['slot_accessories']


def test_three_slots_are_independent_when_only_one_field_set():
    """Mixed state: typography backfilled, font + accessory still empty."""
    niche, vision = _setup(
        graphic_elements='SHARED FALLBACK',
        typography_descriptors='unique typography descriptor',
        font_combination_descriptors='',
        accessory_descriptors='',
    )
    result = build_top_card_preset(vision, niche)
    assert 'unique typography' in result['slot_typography_adjectives']
    assert 'SHARED FALLBACK' in result['slot_font_combination']
    assert 'SHARED FALLBACK' in result['slot_accessories']
    # And the three are NOT identical
    typography_val = result['slot_typography_adjectives']
    font_val = result['slot_font_combination']
    assert typography_val != font_val
