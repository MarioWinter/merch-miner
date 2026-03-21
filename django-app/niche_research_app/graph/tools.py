"""SearXNG web search tool wrapper for LangGraph agents."""

import logging

from django.conf import settings
from langchain_core.tools import tool

logger = logging.getLogger(__name__)


@tool
def searxng_search(query: str) -> str:
    """Search the web using SearXNG. Returns search results as text.

    Use this tool to find real-world context about a niche: culture, slang,
    frustrations, memes, Reddit discussions, lifestyle terminology.
    """
    base_url = settings.SEARXNG_BASE_URL
    if not base_url:
        return "SearXNG is not configured. Proceeding without web search results."

    try:
        from langchain_community.utilities import SearxSearchWrapper

        searx = SearxSearchWrapper(
            searx_host=base_url,
            unsecure=True,
            k=5,
        )
        results = searx.run(query)
        return results if results else "No results found for this query."
    except Exception:
        logger.exception("SearXNG search failed for query: %s", query)
        return (
            "Web search temporarily unavailable. "
            "Continue analysis without web enrichment."
        )
