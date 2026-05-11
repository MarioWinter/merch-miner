"""Background tasks for research_app.

Currently hosts the proactive cache warmup for the precomputed
`research:blacklisted_brand_values` set so the cold-start compute cost
(~200ms DISTINCT scan over AmazonProduct + pattern match) never lands on
a user request.

Scheduled every 30 minutes by
`research_app.management.commands.schedule_brand_blacklist_warmup` and
also enqueued by `research_app.signals` after a BrandBlacklist save/delete
invalidates the cache.
"""

from __future__ import annotations

import logging
import time

from django.core.cache import cache as redis_cache

from research_app.api.views import (
    BLACKLISTED_BRAND_VALUES_CACHE_KEY,
    BLACKLISTED_BRAND_VALUES_CACHE_TTL,
    _compute_blacklisted_brand_values,
)

logger = logging.getLogger(__name__)


def warm_blacklisted_brand_values_cache() -> int:
    """Atomically refresh the blacklisted-brand-values cache.

    Computes the matched set via `_compute_blacklisted_brand_values()` and
    overwrites the cache key in a single `set()` call — avoids the
    delete-then-recompute race where a user request between the two steps
    would pay the full compute cost.

    Returns:
        Number of brand values matched.
    """
    start = time.monotonic()
    matched = _compute_blacklisted_brand_values()
    redis_cache.set(
        BLACKLISTED_BRAND_VALUES_CACHE_KEY,
        matched,
        BLACKLISTED_BRAND_VALUES_CACHE_TTL,
    )
    elapsed_ms = (time.monotonic() - start) * 1000.0
    logger.info(
        'warm_blacklisted_brand_values_cache: matched=%d elapsed_ms=%.1f',
        len(matched),
        elapsed_ms,
    )
    return len(matched)
