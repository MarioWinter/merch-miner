"""PROJ-29 Phase 1D Round 1D-3 — conversation summarizer service.

Compresses older conversation turns into a compact (max 300 token) rolling
summary so the agent can retain long-conversation context without exhausting
the per-turn 8000-token budget (AC-Context-1 / AC-Context-2 / EC-21 / EC-28).

The CALLER (Phase 1E view refactor) decides WHEN to enqueue the rq job in
``agent_app.tasks.summarize_conversation``; this module only knows how to
render the prompt + invoke the LLM + return the result.

Resolution order:

1. ``ChatNodeConfig.conversation_summarizer`` system prompt (via resolver).
2. ``DEFAULT_CONVERSATION_SUMMARIZER_PROMPT`` fallback.
3. On any failure (timeout, missing API key, LLM error) -> return ``''``.
   Caller keeps the stale summary (EC-21 graceful degrade).
"""

from __future__ import annotations

import json
import logging

logger = logging.getLogger(__name__)


def summarize(
    messages_to_summarize: list[dict],
    niche_name: str = '',
) -> str:
    """Return a 1-2 paragraph rolling summary of older turns.

    Args:
        messages_to_summarize: List of ``{role, content}`` dicts (typically
            turns 1..(N-5) when N > 10).
        niche_name: Pinned niche name (context only; injected into the prompt).

    Returns:
        Stripped LLM content on success. Empty string on:
          - empty ``messages_to_summarize`` (no LLM call attempted)
          - any LLM exception (caller keeps the stale summary, EC-21)
          - empty/whitespace LLM response
    """
    if not messages_to_summarize:
        return ''

    try:
        # Late imports — avoid app-loading cycles + keep test-time light.
        from chat_node_config_app.services.resolver import (
            get_chat_prompt,
            get_node_config,
        )
        from niche_research_app.graph.llm import get_llm_for_node

        system_prompt = get_chat_prompt(
            'conversation_summarizer',
            niche_name=niche_name or '(none)',
            messages_to_summarize=json.dumps(
                messages_to_summarize, ensure_ascii=False,
            ),
        )

        llm, _ = get_llm_for_node(
            'conversation_summarizer', config_resolver=get_node_config,
        )

        response = llm.invoke([
            {'role': 'system', 'content': system_prompt},
            {
                'role': 'user',
                'content': (
                    'Produce the rolling summary now. Output the summary '
                    'paragraph(s) only — no preamble.'
                ),
            },
        ])

        content = (getattr(response, 'content', '') or '').strip()
        return content
    except Exception as exc:
        logger.warning(
            'conversation_summarizer.summarize failed (%s); '
            'returning empty summary (caller keeps stale value).',
            exc,
        )
        return ''


__all__ = ['summarize']
