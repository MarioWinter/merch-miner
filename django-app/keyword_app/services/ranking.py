"""PROJ-29 Phase 1B — keyword ranking service.

`rank_niche_keywords(niche, limit=20)` returns niche keywords annotated with the
JungleScout exact-match monthly search volume (or ``None`` if no cache row
exists for the niche's derived marketplace). Ranking honours JS-volume first,
falling back to manual position + recency.
"""

from __future__ import annotations

from django.db.models import F, OuterRef, Subquery

from keyword_app.models import KeywordJSCache, NicheKeyword


def rank_niche_keywords(niche, limit: int = 20):
    """Return up to ``limit`` ``NicheKeyword`` rows ordered by JS volume.

    Each row is annotated with ``.search_volume`` (int or ``None``) derived from
    ``KeywordJSCache.monthly_search_volume_exact`` joined on
    ``(keyword, marketplace == derive_marketplace(niche))``.
    """
    # Local import to avoid app-loading cycles.
    from niche_app.services import derive_marketplace

    derived_marketplace = derive_marketplace(niche)

    volume_subquery = (
        KeywordJSCache.objects
        .filter(keyword=OuterRef('keyword'), marketplace=derived_marketplace)
        .values('monthly_search_volume_exact')[:1]
    )

    queryset = (
        NicheKeyword.objects
        .filter(niche=niche)
        .annotate(search_volume=Subquery(volume_subquery))
        .order_by(
            F('search_volume').desc(nulls_last=True),
            'position',
            '-created_at',
        )
    )
    return list(queryset[:limit])
