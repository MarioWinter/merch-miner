"""Contextual-header generator for PROJ-29 RAG indexing.

Implements the Anthropic Contextual Retrieval pattern: an LLM produces a
short 30-80 token header that is prepended to the raw text BEFORE embedding.
The header anchors the chunk in its niche + content-type context so
retrieval correctly disambiguates similar content across niches.

Supported content_subtypes: ``slogan`` (Idea) and ``notes`` (NicheNote) —
the two new sources introduced by PROJ-29. Other content_subtypes return
``''`` so the embedding pipeline short-circuits to raw-text-only.

LLM failures (timeout, missing API key, etc.) degrade gracefully to ``''``
— the embedding pipeline must NEVER crash because the optional context
header could not be generated.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


_SUPPORTED_CONTENT_SUBTYPES = {'slogan', 'notes'}


def _resolve_niche_name(instance) -> str:
    """Return the niche name for an instance (Idea + NicheNote both have FK ``niche``)."""
    try:
        niche = getattr(instance, 'niche', None)
        if niche is not None and getattr(niche, 'name', None):
            return niche.name
    except Exception:  # pragma: no cover — defensive
        return ''
    return ''


def generate_header(instance, content_subtype: str, raw_text: str) -> str:
    """Generate a contextual header for an embedding source row.

    Returns a 30-80 token English header on success, ``''`` on any failure
    (unsupported subtype, missing niche, LLM error, missing API key).

    Args:
        instance: The source model instance (Idea or NicheNote).
        content_subtype: One of ``'slogan'`` / ``'notes'`` — others -> ``''``.
        raw_text: The raw text that would otherwise be embedded.

    Returns:
        The header string, or ``''`` if no header should be prepended.
    """
    if content_subtype not in _SUPPORTED_CONTENT_SUBTYPES:
        return ''
    if not raw_text or not raw_text.strip():
        return ''

    niche_name = _resolve_niche_name(instance)
    if not niche_name:
        return ''

    try:
        # Late imports keep this module light when LLM isn't needed (tests).
        from chat_node_config_app.services.resolver import (
            get_chat_prompt,
            get_node_config,
        )
        from niche_research_app.graph.llm import get_llm_for_node

        system_prompt = get_chat_prompt(
            'contextual_header',
            niche_name=niche_name,
            content_type=content_subtype,
            raw_text=raw_text,
        )
        llm, _ = get_llm_for_node(
            'contextual_header',
            config_resolver=get_node_config,
        )

        response = llm.invoke([
            {'role': 'system', 'content': system_prompt},
            {
                'role': 'user',
                'content': (
                    f'Niche: {niche_name}\n'
                    f'Content type: {content_subtype}\n'
                    f'Raw text:\n{raw_text}'
                ),
            },
        ])

        header = getattr(response, 'content', '') or ''
        header = header.strip()
        if not header:
            return ''
        return header
    except Exception as exc:
        logger.warning(
            'contextual_header generation failed for %s (subtype=%s): %s',
            type(instance).__name__,
            content_subtype,
            exc,
        )
        return ''
