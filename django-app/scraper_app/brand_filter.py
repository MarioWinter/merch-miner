"""Reusable brand blacklist filter utility.

Used by PROJ-6 (niche research vision_analyze), PROJ-7 (product research), etc.
"""

from scraper_app.models import BrandBlacklist


def get_blacklisted_brands() -> set[str]:
    """Load all blacklisted brand names as lowercase set."""
    return set(BrandBlacklist.objects.values_list('brand_name', flat=True))


SHORT_BRAND_THRESHOLD = 3


def is_brand_blocked(brand: str, blacklist: set[str] | None = None) -> bool:
    """Check if brand matches any blacklisted brand.

    - Brands >3 chars: substring match (e.g. "Nike Shoes" matches "nike")
    - Brands <=3 chars: exact match only (avoids "x" matching every brand)
    Case-insensitive.
    """
    if not brand:
        return False
    brand_lower = brand.lower().strip()
    if blacklist is None:
        blacklist = get_blacklisted_brands()
    for blocked in blacklist:
        if len(blocked) <= SHORT_BRAND_THRESHOLD:
            if brand_lower == blocked:
                return True
        else:
            if blocked in brand_lower:
                return True
    return False


def filter_products_by_brand(products, blacklist: set[str] | None = None):
    """Filter product list, return (allowed, blocked) tuple.

    Works with any object that has a .brand attribute (AmazonProduct, etc.).
    """
    if blacklist is None:
        blacklist = get_blacklisted_brands()
    allowed, blocked = [], []
    for p in products:
        if is_brand_blocked(p.brand, blacklist):
            blocked.append(p)
        else:
            allowed.append(p)
    return allowed, blocked
