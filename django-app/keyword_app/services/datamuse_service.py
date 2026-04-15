"""Datamuse API service for synonym/related-word lookup with DB caching."""

import logging

import requests

from keyword_app.models import SynonymCache

logger = logging.getLogger(__name__)

DATAMUSE_API_URL = 'https://api.datamuse.com/words'
DATAMUSE_TIMEOUT = 5  # seconds
MAX_RESULTS = 20


def get_synonyms(query: str) -> list[str]:
    """
    Return up to 20 related words for the given query.

    Checks SynonymCache first. On cache miss, calls Datamuse API,
    stores result, and returns. Returns empty list on API timeout/error.
    """
    query = query.strip().lower()
    if not query:
        return []

    # Check cache
    try:
        cached = SynonymCache.objects.get(keyword=query)
        return cached.results
    except SynonymCache.DoesNotExist:
        pass

    # Call Datamuse API
    try:
        response = requests.get(
            DATAMUSE_API_URL,
            params={'ml': query},
            timeout=DATAMUSE_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
    except (requests.RequestException, ValueError):
        logger.warning('Datamuse API call failed for query=%s', query, exc_info=True)
        return []

    # Parse top N words
    words = [item['word'] for item in data[:MAX_RESULTS] if 'word' in item]

    # Store in cache
    SynonymCache.objects.create(keyword=query, results=words)

    return words
