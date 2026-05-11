"""Signal handlers for research_app.

Invalidates the two BrandBlacklist-derived Redis caches consumed by
`research_app.api.views`:

  - `research:official_brands`           — list of raw blacklist patterns
  - `research:blacklisted_brand_values`  — precomputed set of concrete
    AmazonProduct.brand strings that match the patterns

Without this invalidation an admin edit to BrandBlacklist would not take
effect on the product list filter until the cache expired (up to 1 hour
for the precomputed set).

After clearing the cache we fire-and-forget a warmup job so the cache
is repopulated within seconds and the next user request doesn't pay the
~200ms cold-start compute cost.
"""

import logging

import django_rq
from django.core.cache import cache as redis_cache
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from research_app.api.views import (
    BLACKLISTED_BRAND_VALUES_CACHE_KEY,
    OFFICIAL_BRANDS_CACHE_KEY,
)

logger = logging.getLogger(__name__)


@receiver(
    [post_save, post_delete],
    sender='scraper_app.BrandBlacklist',
    dispatch_uid='research_app.invalidate_brand_blacklist_caches',
)
def invalidate_brand_blacklist_caches(sender, **kwargs):
    """Clear both BrandBlacklist-derived caches on any save/delete.

    Then enqueue a warmup job to refill `blacklisted_brand_values` so the
    next user request doesn't pay the cold-start compute cost. The enqueue
    is wrapped in try/except so a transient redis/rq outage cannot block
    the originating model save — the cache will still rebuild lazily on
    the next request as before.
    """
    redis_cache.delete(OFFICIAL_BRANDS_CACHE_KEY)
    redis_cache.delete(BLACKLISTED_BRAND_VALUES_CACHE_KEY)

    try:
        django_rq.enqueue(
            'research_app.tasks.warm_blacklisted_brand_values_cache',
        )
    except Exception as exc:  # noqa: BLE001 — log + continue, never block save
        logger.warning(
            'Failed to enqueue brand blacklist warmup job: %s',
            exc,
        )
