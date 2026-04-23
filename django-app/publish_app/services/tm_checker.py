"""Trademark check service.

Reuses scraper_app BrandBlacklist for TM checking on listing text.
Expandable to external TM API later.
"""

import logging
import re

from scraper_app.brand_filter import get_blacklisted_brands

logger = logging.getLogger(__name__)


def check_listing_tm(listing) -> list[dict]:
    """Check listing text fields against brand blacklist.

    Args:
        listing: Listing model instance.

    Returns:
        List of dicts: [{"term": "Nike", "field": "title", "position": 5}]
    """
    blacklist = get_blacklisted_brands()
    flagged = []

    fields_to_check = {
        'title': listing.title,
        'bullet_1': listing.bullet_1,
        'bullet_2': listing.bullet_2,
        'description': listing.description,
        'brand_name': listing.brand_name,
    }

    for field_name, text in fields_to_check.items():
        if not text:
            continue
        text_lower = text.lower()
        for brand in blacklist:
            if len(brand) <= 3:
                # Exact word match for short brands
                pattern = rf'\b{re.escape(brand)}\b'
                match = re.search(pattern, text_lower)
                if match:
                    flagged.append({
                        'term': brand,
                        'field': field_name,
                        'position': match.start(),
                    })
            else:
                # Substring match for longer brands
                pos = text_lower.find(brand)
                if pos >= 0:
                    flagged.append({
                        'term': brand,
                        'field': field_name,
                        'position': pos,
                    })

    return flagged
