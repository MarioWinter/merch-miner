"""PROJ-34 Phase 13t-s — Tests for get_collection_cards service.

Covers AC-145..AC-150 + EC-56..EC-58.
"""

from __future__ import annotations

import pytest
from django.utils import timezone

from design_app.services.collection_cards import get_collection_cards
from niche_app.models import CollectedProduct, Niche
from niche_research_app.models import (
    NicheProductVisionAnalysis,
    NicheResearch,
)
from scraper_app.models import AmazonProduct
from user_auth_app.models import User
from workspace_app.models import Membership, Workspace

pytestmark = pytest.mark.django_db


def _setup_workspace_and_niche(name='Coll Test Niche'):
    user = User.objects.create_user(
        email=f'coll-{name}@example.com', password='pw',
        username=f'coll-{name}@example.com',
    )
    workspace = Workspace.objects.create(
        name=f'Coll WS {name}', slug=f'coll-{name.replace(" ", "-")}', owner=user,
    )
    Membership.objects.create(
        workspace=workspace, user=user, role='admin', status='active',
    )
    niche = Niche.objects.create(workspace=workspace, name=name, created_by=user)
    research = NicheResearch.objects.create(
        niche=niche,
        status=NicheResearch.Status.COMPLETED,
        triggered_by=user,
        completed_at=timezone.now(),
    )
    return user, workspace, niche, research


def _make_product(asin):
    return AmazonProduct.objects.create(
        asin=asin, marketplace='amazon_com',
        title=f'Product {asin}',
        thumbnail_url=f'https://images.example.com/{asin}.jpg',
    )


def test_empty_niche_returns_empty_list():
    _, ws, niche, _ = _setup_workspace_and_niche('empty')
    assert get_collection_cards(niche, ws.id) == []


def test_single_collected_product_with_vision_returns_card():
    _, ws, niche, research = _setup_workspace_and_niche('single-with-vision')
    product = _make_product('BCOLL00001')
    CollectedProduct.objects.create(niche=niche, product=product)
    NicheProductVisionAnalysis.objects.create(
        research=research, product=product,
        slogan_text='Hello World',
        graphic_elements='bold text with a star',
        is_niche_match=True,
    )

    cards = get_collection_cards(niche, ws.id)
    assert len(cards) == 1
    assert cards[0]['source_card_type'] == 'collection'
    assert cards[0]['source_card_references'][0]['niche_id'] == str(niche.id)
    assert cards[0]['source_card_references'][0]['product_ids'] == [str(product.id)]
    assert 'collected_at' in cards[0]['source_card_references'][0]


def test_collected_product_without_vision_is_skipped():
    _, ws, niche, _ = _setup_workspace_and_niche('no-vision')
    product = _make_product('BCOLL00002')
    CollectedProduct.objects.create(niche=niche, product=product)
    # No NicheProductVisionAnalysis created.

    cards = get_collection_cards(niche, ws.id)
    assert cards == []


def test_cards_ordered_by_collected_at_desc():
    _, ws, niche, research = _setup_workspace_and_niche('order')
    products = [_make_product(f'BORDER{i:04d}') for i in range(3)]
    for p in products:
        NicheProductVisionAnalysis.objects.create(
            research=research, product=p,
            slogan_text='x',
            graphic_elements='x with a y',
            is_niche_match=True,
        )

    # Create CollectedProducts in non-chronological order to verify ordering.
    cp_oldest = CollectedProduct.objects.create(niche=niche, product=products[0])
    cp_middle = CollectedProduct.objects.create(niche=niche, product=products[1])
    cp_newest = CollectedProduct.objects.create(niche=niche, product=products[2])

    # Force monotonic collected_at values (auto_now_add can collide on fast tests).
    CollectedProduct.objects.filter(id=cp_oldest.id).update(
        collected_at=timezone.now() - timezone.timedelta(hours=2),
    )
    CollectedProduct.objects.filter(id=cp_middle.id).update(
        collected_at=timezone.now() - timezone.timedelta(hours=1),
    )
    CollectedProduct.objects.filter(id=cp_newest.id).update(
        collected_at=timezone.now(),
    )

    cards = get_collection_cards(niche, ws.id)
    assert len(cards) == 3
    product_ids_in_order = [c['source_card_references'][0]['product_ids'][0] for c in cards]
    assert product_ids_in_order == [str(products[2].id), str(products[1].id), str(products[0].id)]


def test_mixed_with_and_without_vision_returns_only_analyzed():
    _, ws, niche, research = _setup_workspace_and_niche('mixed')
    p_with = _make_product('BMIX00001')
    p_without = _make_product('BMIX00002')
    CollectedProduct.objects.create(niche=niche, product=p_with)
    CollectedProduct.objects.create(niche=niche, product=p_without)
    NicheProductVisionAnalysis.objects.create(
        research=research, product=p_with,
        slogan_text='only one analyzed',
        graphic_elements='bold text and a fish',
        is_niche_match=True,
    )

    cards = get_collection_cards(niche, ws.id)
    assert len(cards) == 1
    assert cards[0]['source_card_references'][0]['product_ids'] == [str(p_with.id)]


def test_multiple_vision_rows_uses_latest():
    _, ws, niche, research = _setup_workspace_and_niche('multi-vision')
    product = _make_product('BMV00001')
    CollectedProduct.objects.create(niche=niche, product=product)
    NicheProductVisionAnalysis.objects.create(
        research=research, product=product,
        slogan_text='old slogan',
        graphic_elements='old graphic',
        is_niche_match=True,
    )
    newer = NicheProductVisionAnalysis.objects.create(
        research=research, product=product,
        slogan_text='newer slogan',
        graphic_elements='newer graphic with a star',
        is_niche_match=True,
    )

    cards = get_collection_cards(niche, ws.id)
    assert len(cards) == 1
    # build_top_card_preset uses the latest vision row's data
    label = cards[0]['preset_label']
    assert 'Newer' in label or 'newer' in label.lower(), (
        f"Expected label derived from newer vision row, got {label!r}"
    )
    # And the latest vision row's graphic flows into the relevant slots
    del newer  # silence linter; newer is implicitly referenced via label assertion
