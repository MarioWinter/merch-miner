"""PROJ-34 Phase 13t-c — preset_ranker unit tests (AC-82).

Covers:
- empty niche / no research
- all brand_blocked / all is_niche_match=False → empty
- limit honored
- ordering by composite score descending
- robustness to missing BSR, zero reviews, ancient listed_date
"""

from __future__ import annotations

import datetime as _dt

import pytest
from django.utils import timezone

from design_app.services import preset_ranker
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


# ─── Fixtures ────────────────────────────────────────────────────────────


def _make_workspace_and_user(email: str = "ranker@example.com"):
    user = User.objects.create_user(email=email, password="pw", username=email)
    workspace = Workspace.objects.create(name="Ranker WS", slug="ranker-ws", owner=user)
    Membership.objects.create(
        workspace=workspace, user=user, role="admin", status="active",
    )
    return workspace, user


def _make_niche_research(name: str = "Test Niche"):
    workspace, user = _make_workspace_and_user()
    niche = Niche.objects.create(workspace=workspace, name=name, created_by=user)
    research = NicheResearch.objects.create(
        niche=niche,
        status=NicheResearch.Status.COMPLETED,
        triggered_by=user,
        completed_at=timezone.now(),
    )
    return niche, research


def _make_product(
    *,
    asin: str,
    rating: float | None = 4.5,
    reviews_count: int | None = 50,
    bsr: int | None = 100_000,
    listed_date: _dt.date | None = None,
):
    if listed_date is None:
        listed_date = _dt.date.today() - _dt.timedelta(days=30)
    return AmazonProduct.objects.create(
        asin=asin,
        marketplace="amazon_com",
        title=f"Product {asin}",
        rating=rating,
        reviews_count=reviews_count,
        bsr=bsr,
        listed_date=listed_date,
    )


def _attach_vision(
    *,
    research,
    product,
    is_niche_match: bool = True,
    brand_blocked: bool = False,
):
    NicheResearchProduct.objects.create(
        research=research, product=product, brand_blocked=brand_blocked,
    )
    return NicheProductVisionAnalysis.objects.create(
        research=research,
        product=product,
        slogan_text="Stay Bold",
        graphic_elements="bold lion head with crown",
        visual_style="vintage halftone",
        layout_composition="badge emblem centered",
        is_niche_match=is_niche_match,
    )


# ─── Tests ───────────────────────────────────────────────────────────────


def test_returns_empty_when_no_research():
    workspace, user = _make_workspace_and_user()
    niche = Niche.objects.create(workspace=workspace, name="Lonely", created_by=user)
    assert preset_ranker.rank_top_products(niche) == []


def test_returns_empty_when_research_pending_only():
    workspace, user = _make_workspace_and_user(email="pending@example.com")
    niche = Niche.objects.create(workspace=workspace, name="Pending", created_by=user)
    NicheResearch.objects.create(
        niche=niche,
        status=NicheResearch.Status.PENDING,
        triggered_by=user,
    )
    assert preset_ranker.rank_top_products(niche) == []


def test_returns_empty_when_all_brand_blocked():
    niche, research = _make_niche_research()
    for i in range(3):
        product = _make_product(asin=f"B00000000{i}")
        _attach_vision(research=research, product=product, brand_blocked=True)
    assert preset_ranker.rank_top_products(niche) == []


def test_returns_empty_when_all_not_niche_match():
    niche, research = _make_niche_research()
    for i in range(3):
        product = _make_product(asin=f"B00000000{i}")
        _attach_vision(research=research, product=product, is_niche_match=False)
    assert preset_ranker.rank_top_products(niche) == []


def test_respects_limit():
    niche, research = _make_niche_research()
    for i in range(15):
        product = _make_product(asin=f"B0000000{i:02d}")
        _attach_vision(research=research, product=product)

    result = preset_ranker.rank_top_products(niche, limit=10)
    assert len(result) == 10


def test_returns_fewer_when_less_than_limit_match():
    niche, research = _make_niche_research()
    for i in range(3):
        product = _make_product(asin=f"B0000000{i:02d}")
        _attach_vision(research=research, product=product)

    result = preset_ranker.rank_top_products(niche, limit=10)
    assert len(result) == 3


def test_ordering_by_score_desc():
    """High-rating + low-BSR + recent product must outrank weak competitors."""
    niche, research = _make_niche_research()

    # Champion: high rating, lots of reviews, low BSR, brand new
    champion_product = _make_product(
        asin="BCHAMPION1",
        rating=4.9,
        reviews_count=200,
        bsr=500,
        listed_date=_dt.date.today() - _dt.timedelta(days=5),
    )
    champion = _attach_vision(research=research, product=champion_product)

    # Mid: moderate everything
    mid_product = _make_product(
        asin="BMIDDLE001",
        rating=4.0,
        reviews_count=20,
        bsr=200_000,
        listed_date=_dt.date.today() - _dt.timedelta(days=180),
    )
    mid = _attach_vision(research=research, product=mid_product)

    # Weak: low rating, few reviews, high BSR, ancient
    weak_product = _make_product(
        asin="BWEAK00001",
        rating=2.5,
        reviews_count=2,
        bsr=2_000_000,
        listed_date=_dt.date.today() - _dt.timedelta(days=1000),
    )
    weak = _attach_vision(research=research, product=weak_product)

    result = preset_ranker.rank_top_products(niche)
    assert [v.id for v in result] == [champion.id, mid.id, weak.id]


def test_handles_missing_bsr():
    niche, research = _make_niche_research()
    product = _make_product(asin="BNOBSR0001", bsr=None)
    _attach_vision(research=research, product=product)

    result = preset_ranker.rank_top_products(niche)
    assert len(result) == 1


def test_handles_zero_reviews():
    niche, research = _make_niche_research()
    product = _make_product(asin="BZEROREV01", rating=4.8, reviews_count=0)
    _attach_vision(research=research, product=product)

    result = preset_ranker.rank_top_products(niche)
    assert len(result) == 1
    assert preset_ranker._rating_score(4.8, 0) == 0.0


def test_handles_missing_rating_and_reviews():
    niche, research = _make_niche_research()
    product = _make_product(asin="BNONERAT01", rating=None, reviews_count=None)
    _attach_vision(research=research, product=product)

    result = preset_ranker.rank_top_products(niche)
    assert len(result) == 1
    assert preset_ranker._rating_score(None, None) == 0.0


def test_handles_missing_listed_date():
    niche, research = _make_niche_research()
    product = _make_product(asin="BNODATE001", listed_date=None)
    _attach_vision(research=research, product=product)

    result = preset_ranker.rank_top_products(niche)
    assert len(result) == 1
    assert preset_ranker._recency_score(None) == 0.0


def test_ancient_product_low_recency_score():
    score = preset_ranker._recency_score(5 * 365)
    assert 0.0 < score < 0.001


def test_recent_product_recency_score_near_one():
    score = preset_ranker._recency_score(0)
    assert score == pytest.approx(1.0)


def test_bsr_score_monotonic_decreasing():
    assert preset_ranker._bsr_score(100) > preset_ranker._bsr_score(10_000)
    assert preset_ranker._bsr_score(10_000) > preset_ranker._bsr_score(1_000_000)


def test_rating_score_clamps_reviews_at_100():
    """Reviews above 100 must not increase the rating sub-score further."""
    a = preset_ranker._rating_score(4.5, 100)
    b = preset_ranker._rating_score(4.5, 5000)
    assert a == b


def test_brand_blocked_product_excluded_even_with_strong_signals():
    niche, research = _make_niche_research()

    blocked = _make_product(
        asin="BBLOCKED01",
        rating=5.0,
        reviews_count=500,
        bsr=10,
        listed_date=_dt.date.today(),
    )
    _attach_vision(research=research, product=blocked, brand_blocked=True)

    ok_product = _make_product(asin="BOKAY00001", rating=3.0, reviews_count=5)
    ok_vision = _attach_vision(research=research, product=ok_product)

    result = preset_ranker.rank_top_products(niche)
    assert [v.id for v in result] == [ok_vision.id]


def test_uses_latest_completed_research_only():
    """A new completed research should supersede an older one."""
    niche, _ = _make_niche_research()

    # Create a second, newer research run owned by the same user.
    user = niche.created_by
    newer = NicheResearch.objects.create(
        niche=niche,
        status=NicheResearch.Status.COMPLETED,
        triggered_by=user,
        completed_at=timezone.now(),
    )
    newer_product = _make_product(asin="BNEWER0001")
    expected_vision = _attach_vision(research=newer, product=newer_product)

    result = preset_ranker.rank_top_products(niche)
    assert [v.id for v in result] == [expected_vision.id]
