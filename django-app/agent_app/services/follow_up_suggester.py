"""PROJ-29 Phase 1D Round 1D-3 — follow-up suggester service.

Generates up to 3 short chips the frontend renders below an assistant answer
(AC-Lang-3 / EC-20). Each chip is enforced <= 80 characters; the caller
filters empty entries when fewer than 3 are returned.

Resolution order:

1. ``ChatNodeConfig.follow_up_suggester`` system prompt (via resolver).
2. ``DEFAULT_FOLLOW_UP_SUGGESTER_PROMPT`` fallback.
3. On any failure (timeout, malformed JSON, LLM error) -> return ``[]``.
   Frontend hides the chip row entirely (EC-20).
"""

from __future__ import annotations

import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

CHIP_MAX_CHARS = 80
TARGET_CHIP_COUNT = 3


def _parse_llm_json(raw: str) -> Optional[dict]:
    """Best-effort JSON parse with markdown-fence stripping fallback."""
    raw = (raw or '').strip()
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    # Strip ``` ```json ... ``` ``` fences.
    stripped = raw.strip('`').lstrip('json\n').strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        return None


def suggest(
    user_msg: str,
    assistant_msg: str,
    niche_name: str = '',
    language: str = 'en',
) -> list[str]:
    """Return up to 3 follow-up chips (each <= 80 chars).

    Args:
        user_msg: The user's last message (raw text).
        assistant_msg: The assistant's last message; truncated to 500 chars
            before prompt rendering.
        niche_name: Pinned niche name (context only).
        language: User language code (BCP-47, e.g. ``'en'``, ``'de'``).

    Returns:
        List of up to 3 strings, each <= 80 chars. Padded with empty strings
        to length 3 so callers receive a stable shape (frontend filters
        empties per EC-20). Returns ``[]`` (NOT padded) on hard failure so
        the caller can detect total failure and hide the chip row.
    """
    if not assistant_msg and not user_msg:
        return []

    try:
        # Late imports — avoid app-loading cycles + keep test-time light.
        from chat_node_config_app.services.resolver import (
            get_chat_prompt,
            get_node_config,
        )
        from niche_research_app.graph.llm import get_llm_for_node

        system_prompt = get_chat_prompt(
            'follow_up_suggester',
            user_language=language or 'en',
            niche_name=niche_name or '(none)',
            last_user_message=user_msg or '',
            last_assistant_message_summary=(assistant_msg or '')[:500],
        )

        llm, _ = get_llm_for_node(
            'follow_up_suggester', config_resolver=get_node_config,
        )

        response = llm.invoke([
            {'role': 'system', 'content': system_prompt},
            {
                'role': 'user',
                'content': (
                    'Generate 3 follow-up chips now. Return ONLY the JSON '
                    'object, no markdown fences.'
                ),
            },
        ])
        raw = (getattr(response, 'content', '') or '').strip()
        payload = _parse_llm_json(raw)
        if not isinstance(payload, dict):
            logger.warning(
                'follow_up_suggester: LLM returned non-JSON: %s', raw[:200],
            )
            return []

        suggestions = payload.get('suggestions') or []
        cleaned: list[str] = []
        for item in suggestions:
            if not isinstance(item, str):
                continue
            chip = item.strip()
            if not chip:
                continue
            if len(chip) > CHIP_MAX_CHARS:
                chip = chip[:CHIP_MAX_CHARS]
            cleaned.append(chip)
            if len(cleaned) == TARGET_CHIP_COUNT:
                break

        # Pad with empty strings to stable shape; caller filters empties.
        while len(cleaned) < TARGET_CHIP_COUNT:
            cleaned.append('')
        return cleaned
    except Exception as exc:
        logger.warning(
            'follow_up_suggester.suggest failed (%s); returning [].', exc,
        )
        return []


__all__ = ['suggest', 'CHIP_MAX_CHARS', 'TARGET_CHIP_COUNT']
