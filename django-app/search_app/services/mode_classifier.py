"""Mode classifier — routes user messages to web search vs. agent workflow.

Lightweight LLM call (gpt-4.1-mini, ~50 tokens) decides if a user prompt
should hit Vane (web search) or PROJ-18 Agent. Used when the user's chat
input has `mode_override='auto'`.

Returns a JSON dict: {mode: 'web_search'|'agent', confidence: 0..1, reason: str}
"""

import json
import logging
from typing import Optional

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

CLASSIFIER_TIMEOUT = 10.0
CLASSIFIER_MODEL = 'openai/gpt-4.1-mini'

SYSTEM_PROMPT = (
    "You are a router that decides if a user message should be handled by a "
    "web search engine or by an autonomous agent that can run multi-step "
    "workflows (research, design, listing generation, publishing).\n\n"
    "Return ONLY valid JSON in this exact format:\n"
    '{"mode": "web_search" | "agent", "confidence": 0.0-1.0, "reason": "brief explanation"}\n\n'
    "Choose 'web_search' for: factual questions, current events, definitions, "
    "trend lookups, single-shot queries.\n"
    "Choose 'agent' for: multi-step tasks, commands like 'do X then Y', "
    "research-and-create requests, anything that produces persistent assets "
    "(designs, listings, kanban cards), 'recherchiere und erstelle...', "
    "'create...', 'generate...', 'build a campaign for...'."
)


class ModeClassifierError(Exception):
    """Raised when the classifier fails."""


def classify_mode(
    user_message: str,
    niche_context_name: Optional[str] = None,
) -> dict:
    """Classify a user message into 'web_search' or 'agent' mode.

    Args:
        user_message: Raw user input from chat.
        niche_context_name: Optional niche name for added signal.

    Returns:
        dict with keys: mode (str), confidence (float), reason (str).

    Raises:
        ModeClassifierError on API failure or invalid response.
    """
    api_key = getattr(settings, 'OPENROUTER_API_KEY', '')
    base_url = getattr(
        settings, 'OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1',
    )
    if not api_key:
        raise ModeClassifierError("OPENROUTER_API_KEY not configured.")

    user_prompt = user_message.strip()[:1000]
    if niche_context_name:
        user_prompt = (
            f"[Niche context: {niche_context_name}]\n{user_prompt}"
        )

    payload = {
        'model': CLASSIFIER_MODEL,
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': user_prompt},
        ],
        'temperature': 0.0,
        'max_tokens': 80,
        'response_format': {'type': 'json_object'},
    }
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://merchminer.com',
        'X-Title': 'Merch Miner — Mode Classifier',
    }

    url = f"{base_url.rstrip('/')}/chat/completions"

    try:
        with httpx.Client(timeout=CLASSIFIER_TIMEOUT) as client:
            resp = client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
    except httpx.TimeoutException as e:
        raise ModeClassifierError("Classifier request timed out.") from e
    except httpx.HTTPStatusError as e:
        raise ModeClassifierError(
            f"Classifier HTTP {e.response.status_code}: "
            f"{e.response.text[:200]}"
        ) from e
    except Exception as e:
        raise ModeClassifierError(f"Classifier failed: {e}") from e

    try:
        content = data['choices'][0]['message']['content']
        parsed = json.loads(content)
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        raise ModeClassifierError(
            f"Classifier returned invalid response: {e}"
        ) from e

    mode = parsed.get('mode')
    if mode not in ('web_search', 'agent'):
        logger.warning(
            "Classifier returned unknown mode '%s', defaulting to web_search.",
            mode,
        )
        mode = 'web_search'

    return {
        'mode': mode,
        'confidence': float(parsed.get('confidence', 0.5)),
        'reason': str(parsed.get('reason', ''))[:300],
    }
