"""Datamuse API service for synonym/related-word lookup with DB caching.

Uses multiple Datamuse endpoints (ml + rel_trg) and filters results
to only include words that share at least one token with the query,
ensuring relevance for POD keyword research.
"""

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

from keyword_app.models import SynonymCache

logger = logging.getLogger(__name__)

DATAMUSE_API_URL = 'https://api.datamuse.com/words'
DATAMUSE_TIMEOUT = 5  # seconds
MAX_RESULTS = 20


def _fetch_datamuse(params: dict) -> list[dict]:
    """Call Datamuse with given params, return raw response list."""
    try:
        resp = requests.get(DATAMUSE_API_URL, params=params, timeout=DATAMUSE_TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except (requests.RequestException, ValueError):
        return []


def _shares_token(word: str, query_tokens: set[str]) -> bool:
    """Check if any token in word overlaps with query tokens."""
    word_tokens = set(word.lower().split())
    return bool(word_tokens & query_tokens)


def get_synonyms(query: str) -> list[str]:
    """
    Return up to 20 related words for the given query.

    Uses two Datamuse endpoints in parallel:
    - ml (meaning-like): semantically similar words
    - rel_trg (trigger): associated/trigger words

    Filters to only words sharing at least one token with the query,
    ensuring relevance. Checks SynonymCache first. Returns empty list
    on API timeout/error.
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

    # Fire two Datamuse endpoints in parallel
    all_items: list[dict] = []
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {
            pool.submit(_fetch_datamuse, {'ml': query}): 'ml',
            pool.submit(_fetch_datamuse, {'rel_trg': query}): 'rel_trg',
        }
        for future in as_completed(futures):
            try:
                all_items.extend(future.result())
            except Exception:
                logger.warning('Datamuse %s failed for query=%s', futures[future], query, exc_info=True)

    if not all_items:
        SynonymCache.objects.create(keyword=query, results=[])
        return []

    # Deduplicate by word, keep highest score
    best: dict[str, int] = {}
    for item in all_items:
        word = item.get('word', '').strip()
        score = item.get('score', 0)
        if word and word != query:
            if word not in best or score > best[word]:
                best[word] = score

    # Filter: only words sharing at least one token with the query
    query_tokens = set(query.split())
    relevant = [(w, s) for w, s in best.items() if _shares_token(w, query_tokens)]

    # Sort by score descending, take top N
    relevant.sort(key=lambda x: x[1], reverse=True)
    words = [w for w, _ in relevant[:MAX_RESULTS]]

    # Store in cache
    SynonymCache.objects.create(keyword=query, results=words)

    return words
