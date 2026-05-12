"""PROJ-29 Phase 1C — Query Rewriter for hybrid retrieval (chat-domain).

Expands the user's natural-language query for the **vector path** of
``EmbeddingService.hybrid_search``. The BM25 path keeps the original
query verbatim (intentional — see Spec AC-8).

Resolution order:
1. ``ChatNodeConfig.query_rewrite`` prompt (via resolver).
2. ``DEFAULT_QUERY_REWRITE_PROMPT`` fallback (already in ``_default_prompts``).
3. On any failure (timeout, missing API key, LLM error) -> return the
   original ``user_query`` unchanged. Hybrid retrieval must NEVER crash
   because the optional rewriter failed.

Gated by Django setting ``NICHE_RAG_QUERY_REWRITE_ENABLED`` (default True).
"""

from __future__ import annotations

import logging

from typing import Optional

from django.conf import settings

logger = logging.getLogger(__name__)


def rewrite(
    user_query: str,
    niche_name: str = '',
    user_language: str = 'en',
    marketplace_language: str = 'en',
    model_override: Optional[str] = None,
) -> str:
    """Return an expanded query for the vector retrieval path.

    Args:
        user_query: The raw user message.
        niche_name: Pinned niche name (context only — see prompt).
        user_language: Detected user language (default ``'en'``).
        marketplace_language: Slogan/product corpus language (default ``'en'``).

    Returns:
        Expanded query string on success, original ``user_query`` on any
        failure or when the rewriter is disabled. Never raises.
    """
    if not user_query:
        return ''

    if not getattr(settings, 'NICHE_RAG_QUERY_REWRITE_ENABLED', True):
        return user_query

    try:
        # Late imports keep this module light when the rewriter isn't used.
        from chat_node_config_app.services.resolver import get_chat_prompt
        from niche_research_app.graph.llm import get_llm_for_node
        from chat_node_config_app.services.resolver import get_node_config

        system_prompt = get_chat_prompt(
            'query_rewrite',
            user_query=user_query,
            niche_name=niche_name,
            user_language=user_language,
            marketplace_language=marketplace_language,
        )
        llm, _ = get_llm_for_node(
            'query_rewrite',
            config_resolver=get_node_config,
            model_override=model_override,
        )

        response = llm.invoke([
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_query},
        ])

        expanded = getattr(response, 'content', '') or ''
        expanded = expanded.strip()
        if not expanded:
            return user_query
        return expanded
    except Exception as exc:
        logger.warning('query_rewrite failed, passthrough: %s', exc)
        return user_query
