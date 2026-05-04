"""JungleScout API wrapper with 30-day DB cache."""

import logging
import os
from datetime import timedelta

from django.utils import timezone

from keyword_app.models import (
    KeywordHistoryCache,
    KeywordJSCache,
    NicheJSCallTracker,
    JSUsageLog,
)

logger = logging.getLogger(__name__)

JS_CACHE_DAYS = 30


def _get_js_client():
    """Create JungleScout client from env vars. Returns None if not configured."""
    api_key_name = os.environ.get('JUNGLESCOUT_API_KEY_NAME', '')
    api_key = os.environ.get('JUNGLESCOUT_API_KEY', '')
    if not api_key_name or not api_key:
        return None
    try:
        from junglescout import Client
        return Client(api_key_name=api_key_name, api_key=api_key)
    except Exception:
        logger.exception("Failed to create JungleScout client")
        return None


def is_js_configured():
    """Check if JungleScout API credentials are set."""
    return bool(
        os.environ.get('JUNGLESCOUT_API_KEY_NAME')
        and os.environ.get('JUNGLESCOUT_API_KEY')
    )


def _marketplace_to_js(marketplace):
    """Convert our marketplace code to JS marketplace param."""
    mapping = {
        'amazon_com': 'us',
        'amazon_de': 'de',
        'amazon_co_uk': 'uk',
        'amazon_fr': 'fr',
        'amazon_it': 'it',
        'amazon_es': 'es',
    }
    return mapping.get(marketplace, os.environ.get('JUNGLESCOUT_DEFAULT_MARKETPLACE', 'us'))


def get_cached_js_data(keywords, marketplace):
    """Return dict of keyword -> KeywordJSCache for non-expired entries."""
    cutoff = timezone.now() - timedelta(days=JS_CACHE_DAYS)
    cached = KeywordJSCache.objects.filter(
        keyword__in=keywords,
        marketplace=marketplace,
        fetched_at__gte=cutoff,
    )
    return {c.keyword: c for c in cached}


def enrich_keywords(keywords, marketplace, user=None, workspace=None):
    """
    Enrich keywords with JungleScout data.
    Uses 30-day cache. Only calls JS for uncached/expired.
    Returns dict of keyword -> KeywordJSCache.
    """
    if not is_js_configured():
        raise ValueError("JungleScout API key not configured")

    # Check cache first
    cache_map = get_cached_js_data(keywords, marketplace)
    uncached = [kw for kw in keywords if kw not in cache_map]

    if not uncached:
        return cache_map

    # Call JungleScout for uncached keywords
    client = _get_js_client()
    if not client:
        raise ValueError("Failed to initialize JungleScout client")

    js_marketplace = _marketplace_to_js(marketplace)

    try:
        response = client.keywords_by_keyword(
            search_terms=','.join(uncached),
            marketplace=js_marketplace,
        )
    except Exception as e:
        logger.exception("JungleScout API error for keywords: %s", uncached)
        raise ValueError(f"JungleScout API error: {e}") from e

    # Log usage
    JSUsageLog.objects.create(
        provider=JSUsageLog.Provider.JUNGLESCOUT,
        endpoint='keywords_by_keyword',
        keywords_count=len(uncached),
        user=user,
        workspace=workspace,
    )

    # Parse and cache results
    now = timezone.now()
    if hasattr(response, 'data') and response.data:
        for item in response.data:
            attrs = getattr(item, 'attributes', None) or {}
            kw_name = attrs.get('name', '') or getattr(item, 'id', '')
            if not kw_name:
                continue

            defaults = {
                'monthly_search_volume_exact': attrs.get('monthly_search_volume_exact'),
                'monthly_search_volume_broad': attrs.get('monthly_search_volume_broad'),
                'monthly_trend': attrs.get('monthly_trend'),
                'quarterly_trend': attrs.get('quarterly_trend'),
                'ppc_bid_exact': attrs.get('ppc_bid_exact'),
                'ppc_bid_broad': attrs.get('ppc_bid_broad'),
                'sp_brand_ad_bid': attrs.get('sp_brand_ad_bid'),
                'ease_of_ranking_score': attrs.get('ease_of_ranking_score'),
                'relevancy_score': attrs.get('relevancy_score'),
                'organic_product_count': attrs.get('organic_product_count'),
                'sponsored_product_count': attrs.get('sponsored_product_count'),
                'dominant_category': attrs.get('dominant_category', ''),
                'recommended_promotions': attrs.get('recommended_promotions'),
                'fetched_at': now,
            }
            obj, _ = KeywordJSCache.objects.update_or_create(
                keyword=kw_name,
                marketplace=marketplace,
                defaults=defaults,
            )
            cache_map[kw_name] = obj

    return cache_map


def get_keyword_history(keyword, marketplace, user=None, workspace=None):
    """
    Get historical search volume for a keyword.
    Uses cache. Returns list of {date, search_volume} dicts.
    """
    if not is_js_configured():
        raise ValueError("JungleScout API key not configured")

    # Check cache (30-day TTL)
    cutoff = timezone.now() - timedelta(days=JS_CACHE_DAYS)
    try:
        cached = KeywordHistoryCache.objects.get(
            keyword=keyword,
            marketplace=marketplace,
            fetched_at__gte=cutoff,
        )
        return cached.history_data
    except KeywordHistoryCache.DoesNotExist:
        pass

    client = _get_js_client()
    if not client:
        raise ValueError("Failed to initialize JungleScout client")

    js_marketplace = _marketplace_to_js(marketplace)

    try:
        response = client.historical_search_volume(
            keyword=keyword,
            marketplace=js_marketplace,
        )
    except Exception as e:
        logger.exception("JungleScout history API error for: %s", keyword)
        raise ValueError(f"JungleScout API error: {e}") from e

    # Log usage
    JSUsageLog.objects.create(
        provider=JSUsageLog.Provider.JUNGLESCOUT,
        endpoint='historical_search_volume',
        keywords_count=1,
        user=user,
        workspace=workspace,
    )

    # Parse response
    history_data = []
    if hasattr(response, 'data') and response.data:
        for item in response.data:
            attrs = getattr(item, 'attributes', None) or {}
            history_data.append({
                'date': attrs.get('date', ''),
                'search_volume': attrs.get('estimated_exact_search_volume', 0),
            })

    # Cache result
    KeywordHistoryCache.objects.update_or_create(
        keyword=keyword,
        marketplace=marketplace,
        defaults={
            'history_data': history_data,
            'fetched_at': timezone.now(),
        },
    )

    return history_data


def check_agent_js_limit(niche):
    """Check if Agent has already used its JS call for this niche."""
    return NicheJSCallTracker.objects.filter(niche=niche).exists()


def record_agent_js_call(niche, keyword_used):
    """Record that Agent used its JS call for this niche."""
    NicheJSCallTracker.objects.get_or_create(
        niche=niche,
        defaults={'keyword_used': keyword_used},
    )
