"""PROJ-34 Phase 13t-s — Collection-Card Service.

Surfaces user-curated `CollectedProduct` items as preset cards for the
Vorschläge tab. Reuses `build_top_card_preset()` for slot extraction;
only CollectedProducts with a matching `NicheProductVisionAnalysis` are
included (per Resolved Decision #31). Cards ordered by `collected_at DESC`.

Spec: features/PROJ-34-design-prompt-engineering.md AC-145..AC-150.
"""

from __future__ import annotations

import logging
from typing import Any

from design_app.services.top_card_builder import build_top_card_preset

logger = logging.getLogger(__name__)


def get_collection_cards(niche, workspace_id) -> list[dict[str, Any]]:
    """Return preset-card dicts for all CollectedProducts in this niche.

    Skips items where no matching `NicheProductVisionAnalysis` exists
    for `(niche, product)`. No max limit — returns all qualifying items
    ordered by `collected_at DESC` (newest first).

    `workspace_id` is accepted for API symmetry with sibling card builders
    (top, best_of_mix) but not yet used here — workspace scoping happens
    implicitly via the niche → workspace FK chain at the endpoint layer.
    """
    from niche_app.models import CollectedProduct
    from niche_research_app.models import NicheProductVisionAnalysis

    del workspace_id  # noqa: ARG001 — reserved for future use, see docstring

    collected_qs = (
        CollectedProduct.objects
        .filter(niche=niche)
        .select_related('product')
        .order_by('-collected_at')
    )

    cards: list[dict[str, Any]] = []
    for cp in collected_qs:
        # Find the latest Vision row for this (niche, product) pair.
        vision = (
            NicheProductVisionAnalysis.objects
            .filter(product_id=cp.product_id, research__niche_id=niche.id)
            .order_by('-created_at')
            .first()
        )
        if vision is None:
            # Skip silently per AC-145 + Resolved Decision #31.
            continue

        card = build_top_card_preset(vision, niche)
        card['source_card_type'] = 'collection'
        card['source_card_references'] = [
            {
                'niche_id': str(niche.id),
                'product_ids': [str(cp.product_id)],
                'collected_at': cp.collected_at.isoformat(),
            },
        ]
        cards.append(card)

    return cards


__all__ = ['get_collection_cards']
