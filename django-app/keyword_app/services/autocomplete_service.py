"""Amazon Autocomplete integration — reuses research_app proxy logic."""

import logging

import httpx
from django.core.cache import cache as redis_cache

logger = logging.getLogger(__name__)

MARKETPLACE_MIDS = {
    'amazon_com': 'ATVPDKIKX0DER',
    'amazon_de': 'A1PA6795UKMFR9',
    'amazon_co_uk': 'A1F83G8C2ARO7P',
    'amazon_fr': 'A13V1IB3VIYZZH',
    'amazon_it': 'APJ6JRA9NG5V4',
    'amazon_es': 'A1RKKUPIHCS9HS',
}


def get_autocomplete_suggestions(query, marketplace='amazon_com'):
    """
    Fetch Amazon Autocomplete suggestions.
    Cached in Redis for 60s to avoid hammering Amazon.
    Returns list of suggestion strings.
    """
    cache_key = f"kw_autocomplete:{query}:{marketplace}"
    cached = redis_cache.get(cache_key)
    if cached is not None:
        return cached

    mid = MARKETPLACE_MIDS.get(marketplace, MARKETPLACE_MIDS['amazon_com'])
    url = "https://completion.amazon.com/api/2017/suggestions"

    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(url, params={'prefix': query, 'mid': mid, 'alias': 'aps'})
            resp.raise_for_status()
            data = resp.json()
            suggestions = [s.get('value', '') for s in data.get('suggestions', [])]
    except Exception:
        logger.warning("Amazon autocomplete failed for q=%s marketplace=%s", query, marketplace)
        suggestions = []

    redis_cache.set(cache_key, suggestions, timeout=60)
    return suggestions
