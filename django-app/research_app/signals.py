"""Signal handlers for research_app.

Invalidates the two BrandBlacklist-derived Redis caches consumed by
`research_app.api.views`:

  - `research:official_brands`           — list of raw blacklist patterns
  - `research:blacklisted_brand_values`  — precomputed set of concrete
    AmazonProduct.brand strings that match the patterns

Without this invalidation an admin edit to BrandBlacklist would not take
effect on the product list filter until the cache expired (up to 1 hour
for the precomputed set).
"""

from django.core.cache import cache as redis_cache
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from research_app.api.views import (
    BLACKLISTED_BRAND_VALUES_CACHE_KEY,
    OFFICIAL_BRANDS_CACHE_KEY,
)


@receiver(
    [post_save, post_delete],
    sender='scraper_app.BrandBlacklist',
    dispatch_uid='research_app.invalidate_brand_blacklist_caches',
)
def invalidate_brand_blacklist_caches(sender, **kwargs):
    """Clear both BrandBlacklist-derived caches on any save/delete."""
    redis_cache.delete(OFFICIAL_BRANDS_CACHE_KEY)
    redis_cache.delete(BLACKLISTED_BRAND_VALUES_CACHE_KEY)
