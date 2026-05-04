"""Amazon product count scraper via ScraperOps proxy (AC-9b).

Scrapes Amazon Page 2 for a keyword, extracts result count from the
search results header. Uses Page 2 because Amazon shows inflated
counts on Page 1.
"""

import logging
import os
import re
from urllib.parse import quote_plus

import httpx
from django.utils import timezone

from keyword_app.models import KeywordProductCount

logger = logging.getLogger(__name__)

SCRAPEOPS_PROXY_URL = "https://proxy.scrapeops.io/v1/"

# Marketplace -> Amazon domain mapping
MARKETPLACE_DOMAINS = {
    'amazon_com': 'www.amazon.com',
    'amazon_de': 'www.amazon.de',
    'amazon_co_uk': 'www.amazon.co.uk',
    'amazon_fr': 'www.amazon.fr',
    'amazon_it': 'www.amazon.it',
    'amazon_es': 'www.amazon.es',
}

# Regex patterns to extract result count from Amazon search header.
# Matches: "1-48 of 549 results" or "1-48 of over 1,000 results"
RESULT_COUNT_PATTERNS = [
    re.compile(r'(\d[\d,]*)\s+results?\s+for', re.IGNORECASE),
    re.compile(r'of\s+(?:over\s+)?(\d[\d,]*)\s+results?', re.IGNORECASE),
    re.compile(r'(\d[\d,]*)\s+results?', re.IGNORECASE),
]


def _parse_result_count(html):
    """Extract product result count from Amazon search page HTML.

    Looks for the result count in the search header, e.g.:
    '49-96 of 549 results for "camping shirt"'
    Returns int or None if not found.
    """
    for pattern in RESULT_COUNT_PATTERNS:
        match = pattern.search(html)
        if match:
            count_str = match.group(1).replace(',', '').replace('.', '')
            try:
                return int(count_str)
            except ValueError:
                continue
    return None


def scrape_product_count(keyword, marketplace='amazon_com'):
    """Scrape Amazon Page 2 for keyword result count.

    Uses ScraperOps proxy API for anti-bot handling.
    Returns KeywordProductCount instance (upserted) or raises ValueError.
    """
    api_key = os.environ.get('SCRAPEOPS_API_KEY', '')
    if not api_key:
        raise ValueError("ScraperOps API key not configured")

    domain = MARKETPLACE_DOMAINS.get(marketplace, MARKETPLACE_DOMAINS['amazon_com'])
    encoded_keyword = quote_plus(keyword)

    # Page 2 URL (page=2) to avoid Amazon's inflated Page 1 counts
    amazon_url = f"https://{domain}/s?k={encoded_keyword}&page=2"

    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.get(
                SCRAPEOPS_PROXY_URL,
                params={
                    'api_key': api_key,
                    'url': amazon_url,
                    'render_js': 'false',
                    'country': _marketplace_to_country(marketplace),
                },
            )
            resp.raise_for_status()
            html = resp.text
    except httpx.TimeoutException:
        logger.warning("ScraperOps timeout for keyword=%s marketplace=%s", keyword, marketplace)
        raise ValueError("Amazon scrape timed out. Please try again later.")
    except httpx.HTTPStatusError as e:
        logger.warning(
            "ScraperOps HTTP error %s for keyword=%s", e.response.status_code, keyword,
        )
        raise ValueError(f"Amazon scrape failed (HTTP {e.response.status_code})")
    except Exception:
        logger.exception("ScraperOps request failed for keyword=%s", keyword)
        raise ValueError("Amazon scrape failed. Please try again later.")

    product_count = _parse_result_count(html)
    if product_count is None:
        logger.warning(
            "Could not parse result count from Amazon HTML for keyword=%s marketplace=%s",
            keyword, marketplace,
        )
        raise ValueError("Could not extract product count from Amazon results")

    # Upsert KeywordProductCount
    now = timezone.now()
    obj, _ = KeywordProductCount.objects.update_or_create(
        keyword=keyword,
        marketplace=marketplace,
        defaults={
            'product_count': product_count,
            'fetched_at': now,
        },
    )

    logger.info(
        "Scraped product count: keyword=%s marketplace=%s count=%d",
        keyword, marketplace, product_count,
    )
    return obj


def _marketplace_to_country(marketplace):
    """Map marketplace code to ScraperOps country code."""
    mapping = {
        'amazon_com': 'us',
        'amazon_de': 'de',
        'amazon_co_uk': 'gb',
        'amazon_fr': 'fr',
        'amazon_it': 'it',
        'amazon_es': 'es',
    }
    return mapping.get(marketplace, 'us')


def get_cached_product_counts(keywords, marketplace='amazon_com'):
    """Return dict of keyword -> KeywordProductCount for given keywords.

    No expiry check -- always returns existing data regardless of age.
    """
    counts = KeywordProductCount.objects.filter(
        keyword__in=keywords,
        marketplace=marketplace,
    )
    return {c.keyword: c for c in counts}
