"""PROJ-34 Phase 13t — Top-Product Ranking for Niche Preset Cards (AC-82).

Ranks `NicheProductVisionAnalysis` rows of a niche by a weighted blend of
rating, BSR and recency so the Builder's Vorschläge tab can render up to
10 Top-Cards sorted by quality.

Formula (AC-82):
    score = PRESET_WEIGHT_RATING  * rating_score
          + PRESET_WEIGHT_BSR     * bsr_score
          + PRESET_WEIGHT_RECENCY * recency_score
where
    rating_score   = rating * min(reviews_count, 100) / 500
    bsr_score      = 1 / log10(BSR + 10)
    recency_score  = exp(-days_since_pub / PRESET_RECENCY_HALF_LIFE_DAYS)

Pre-filter: `brand_blocked=False AND is_niche_match=True`. Missing values
fall through to a 0.0 sub-score (never raises). The function never raises:
empty niches / no completed research → `[]`.
"""

from __future__ import annotations

import logging
import math
from datetime import date

from django.conf import settings

logger = logging.getLogger(__name__)


def rank_top_products(niche, limit: int = 10) -> list:
    """Return up to `limit` highest-scoring vision-analyzed products for the niche.

    Pre-filter: `brand_blocked=False AND is_niche_match=True`.
    Sort: weighted score (AC-82) descending.

    Returns an empty list when the niche has no completed research or no
    matching vision rows. Never raises.
    """
    # Local imports avoid load-time cycles; matches builder_hints.py pattern.
    from niche_research_app.models import (
        NicheProductVisionAnalysis,
        NicheResearch,
        NicheResearchProduct,
    )

    latest_research = (
        NicheResearch.objects
        .filter(niche=niche, status=NicheResearch.Status.COMPLETED)
        .order_by('-created_at')
        .first()
    )
    if latest_research is None:
        return []

    vision_qs = (
        NicheProductVisionAnalysis.objects
        .filter(research=latest_research, is_niche_match=True)
        .select_related('product')
    )
    product_ids = [v.product_id for v in vision_qs]
    if not product_ids:
        return []

    blocked_ids = set(
        NicheResearchProduct.objects
        .filter(
            research=latest_research,
            product_id__in=product_ids,
            brand_blocked=True,
        )
        .values_list('product_id', flat=True),
    )

    today = date.today()
    scored: list[tuple[float, object]] = []
    for vision in vision_qs:
        if vision.product_id in blocked_ids:
            continue
        product = vision.product
        score = _composite_score(
            rating=getattr(product, 'rating', None),
            reviews_count=getattr(product, 'reviews_count', None),
            bsr=getattr(product, 'bsr', None),
            listed_date=getattr(product, 'listed_date', None),
            today=today,
        )
        scored.append((score, vision))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [vision for _, vision in scored[:limit]]


# ─── Sub-score helpers (pure, side-effect-free) ──────────────────────────


def _rating_score(rating: float | None, reviews_count: int | None) -> float:
    """`rating * min(reviews_count, 100) / 500`. Missing inputs → 0.0."""
    if rating is None:
        return 0.0
    reviews = reviews_count or 0
    return float(rating) * min(reviews, 100) / 500.0


def _bsr_score(bsr: int | None) -> float:
    """`1 / log10(BSR + 10)`. Missing BSR → 0.0 (no rank info)."""
    if bsr is None:
        return 0.0
    return 1.0 / math.log10(bsr + 10)


def _recency_score(days_since_pub: int | None) -> float:
    """`exp(-days_since_pub / HALF_LIFE)`. Missing date → 0.0."""
    if days_since_pub is None:
        return 0.0
    half_life = settings.PRESET_RECENCY_HALF_LIFE_DAYS
    return math.exp(-days_since_pub / half_life)


def _composite_score(
    *,
    rating: float | None,
    reviews_count: int | None,
    bsr: int | None,
    listed_date,
    today: date,
) -> float:
    """Blend the three sub-scores with the configured weights."""
    days_since_pub: int | None = None
    if listed_date is not None:
        delta = today - listed_date
        days_since_pub = max(delta.days, 0)
    return (
        settings.PRESET_WEIGHT_RATING * _rating_score(rating, reviews_count)
        + settings.PRESET_WEIGHT_BSR * _bsr_score(bsr)
        + settings.PRESET_WEIGHT_RECENCY * _recency_score(days_since_pub)
    )
