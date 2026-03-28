"""Crawl4ai API client for deep URL content extraction.

Crawl4ai opens pages in Chromium, extracts full content as Markdown.
Cannot search -- needs concrete URL(s) as input.
"""

import logging

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 120.0
MAX_CONTENT_TOKENS = 50_000  # EC-6: truncate extremely large pages


class CrawlServiceError(Exception):
    """Raised when Crawl4ai API call fails."""
    pass


class CrawlService:
    """Client for Crawl4ai REST API."""

    def __init__(self):
        self.base_url = getattr(settings, 'CRAWL4AI_API_URL', '')

    def crawl_url(self, url: str) -> dict:
        """Crawl a single URL and return Markdown content + metadata.

        Args:
            url: The URL to crawl.

        Returns:
            dict with keys: content (str), metadata (dict), success (bool).

        Raises:
            CrawlServiceError on API failure.
        """
        if not self.base_url:
            raise CrawlServiceError("CRAWL4AI_API_URL not configured.")

        api_url = f"{self.base_url.rstrip('/')}/crawl"

        payload = {
            'urls': [url],
            'priority': 5,
            'extraction_config': {
                'type': 'basic',
            },
        }

        try:
            with httpx.Client(timeout=DEFAULT_TIMEOUT) as client:
                resp = client.post(api_url, json=payload)
                resp.raise_for_status()
                data = resp.json()
        except httpx.TimeoutException:
            raise CrawlServiceError(f"Crawl4ai timed out crawling {url}")
        except httpx.HTTPStatusError as e:
            raise CrawlServiceError(
                f"Crawl4ai returned HTTP {e.response.status_code} for {url}: "
                f"{e.response.text[:500]}"
            )
        except Exception as e:
            raise CrawlServiceError(f"Crawl4ai request failed: {e}")

        # Parse Crawl4ai response
        # Response format varies; handle both task-based and direct
        result = data
        if isinstance(data, dict) and 'results' in data:
            results = data['results']
            result = results[0] if results else {}
        elif isinstance(data, list) and data:
            result = data[0]

        content = result.get('markdown', result.get('content', ''))
        metadata = result.get('metadata', {})
        success = result.get('success', bool(content))

        # EC-6: truncate extremely large content
        if content:
            from vector_app.chunking import count_tokens
            token_count = count_tokens(content)
            if token_count > MAX_CONTENT_TOKENS:
                # Rough truncation by character ratio
                ratio = MAX_CONTENT_TOKENS / token_count
                truncate_at = int(len(content) * ratio)
                content = content[:truncate_at] + '\n\n[Content truncated at 50,000 tokens]'
                metadata['truncated'] = True
                metadata['original_tokens'] = token_count

            metadata['token_count'] = min(token_count, MAX_CONTENT_TOKENS)
            metadata['word_count'] = len(content.split())

        return {
            'content': content,
            'metadata': metadata,
            'success': success,
        }

    def health_check(self) -> bool:
        """Ping Crawl4ai to check if it's online. Returns True if healthy."""
        if not self.base_url:
            return False
        try:
            with httpx.Client(timeout=5.0) as client:
                resp = client.get(f"{self.base_url.rstrip('/')}/health")
                return resp.status_code < 500
        except Exception:
            return False
