"""PROJ-29 Phase 1B — Niche-helper services.

These helpers feed the `creative_techniques` prompt and various agent tools
(see Phase 1D). Each is small, side-effect-free (modulo Redis cache writes),
and Django-ORM only — no LLM calls.
"""

from __future__ import annotations

import logging
from typing import Any

from django.core.cache import cache
from django.db.models import Count

logger = logging.getLogger(__name__)


# Maps Django marketplace string to ISO-639-1 language code. Used to lock the
# `creative_techniques` prompt output language to the niche's marketplace
# (AC-Slogan-Lang-1). `amazon_uk` (DRF-facing alias) and `amazon_co_uk`
# (scraper_app.MarketplaceChoices canonical value) both map to English.
MARKETPLACE_LANGUAGE_MAP = {
    'amazon_com': 'en',
    'amazon_uk': 'en',
    'amazon_co_uk': 'en',
    'amazon_ca': 'en',
    'amazon_de': 'de',
    'amazon_fr': 'fr',
    'amazon_es': 'es',
    'amazon_it': 'it',
    'amazon_jp': 'ja',
}

_MARKETPLACE_CACHE_TTL_SECONDS = 3600
_DEFAULT_MARKETPLACE = 'amazon_com'


def _marketplace_cache_key(niche_id: Any) -> str:
    return f'niche_marketplace:{niche_id}'


def marketplace_to_language(marketplace: str) -> str:
    """Return ISO-639-1 code; fallback to ``'en'`` for any unknown marketplace."""
    if not marketplace:
        return 'en'
    return MARKETPLACE_LANGUAGE_MAP.get(marketplace, 'en')


def derive_marketplace(niche) -> str:
    """Best-effort marketplace resolver for a given niche.

    Resolution order (first match wins):

    1. Redis cache ``niche_marketplace:<niche_id>`` (1 hour TTL).
    2. Most recent ``NicheResearch.marketplace`` for this niche.
    3. Most common ``CollectedProduct.product.marketplace`` for this niche.
    4. Hard-coded default ``amazon_com``.

    The cache hides the 2-query overhead during high-frequency tool use
    (``generate_slogans`` / ``brainstorm_ideas``). Invalidation is wired in
    ``niche_app/signals.py`` on ``NicheResearch.post_save`` and
    ``CollectedProduct.post_save``.
    """
    cache_key = _marketplace_cache_key(niche.pk)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    # Local imports to avoid app-loading cycles.
    from niche_app.models import CollectedProduct
    from niche_research_app.models import NicheResearch

    resolved = _DEFAULT_MARKETPLACE
    latest_research = (
        NicheResearch.objects
        .filter(niche=niche)
        .order_by('-created_at')
        .values('marketplace')
        .first()
    )
    if latest_research and latest_research.get('marketplace'):
        resolved = latest_research['marketplace']
    else:
        top_collected = (
            CollectedProduct.objects
            .filter(niche=niche)
            .values('product__marketplace')
            .annotate(count=Count('id'))
            .order_by('-count')
            .first()
        )
        if top_collected and top_collected.get('product__marketplace'):
            resolved = top_collected['product__marketplace']

    cache.set(cache_key, resolved, _MARKETPLACE_CACHE_TTL_SECONDS)
    return resolved


def invalidate_marketplace_cache(niche_id: Any) -> None:
    """Drop the cached marketplace for ``niche_id``. Idempotent."""
    cache.delete(_marketplace_cache_key(niche_id))


def get_niche_analysis_snippet(niche) -> str:
    """Return a short formatted snippet of the most recent NicheAnalysis.

    Used as ``{niche_analysis_snippet}`` placeholder in the
    ``creative_techniques`` prompt. Returns ``''`` if no analysis exists so
    the prompt renders cleanly.
    """
    from niche_research_app.models import NicheAnalysis

    analysis = (
        NicheAnalysis.objects
        .filter(niche=niche)
        .order_by('-created_at')
        .first()
    )
    if analysis is None:
        return ''

    pattern_analysis = analysis.pattern_analysis or []
    top_patterns: list[str] = []
    for entry in pattern_analysis:
        if not isinstance(entry, dict):
            continue
        if not entry.get('present'):
            continue
        name = entry.get('name')
        if name:
            top_patterns.append(str(name))
        if len(top_patterns) >= 5:
            break

    return (
        f"summary: {analysis.niche_summary} | "
        f"emotional_reality: {analysis.emotional_reality} | "
        f"design_concepts: {analysis.design_concepts} | "
        f"top patterns: {', '.join(top_patterns)}"
    )
