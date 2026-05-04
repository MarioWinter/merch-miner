"""LLM client factory for agent sub-graphs.

Reads model + temperature + system_prompt + max_tokens from `AgentConfig`
(per-workspace, per-agent_type). Uses `OPENROUTER_AGENT_API_KEY` for budget
isolation (AC-44) — falls back to the main `OPENROUTER_API_KEY` when the
agent-specific key is not set.

Pattern mirrors `niche_research_app.graph.llm.get_llm_for_node`.
"""

from __future__ import annotations

import logging
from typing import Tuple

from asgiref.sync import sync_to_async
from django.conf import settings
from langchain_openai import ChatOpenAI

from agent_app.models import AGENT_DEFAULTS, AgentConfig

logger = logging.getLogger(__name__)


def _agent_api_key() -> str:
    """Return the agent-scoped OpenRouter key, falling back to the main one."""
    return settings.OPENROUTER_AGENT_API_KEY or settings.OPENROUTER_API_KEY


def get_llm_for_agent(workspace, agent_type: str) -> Tuple[ChatOpenAI, str]:
    """Return `(llm, system_prompt)` for a given workspace + agent_type.

    Falls back to AGENT_DEFAULTS when no AgentConfig row exists yet.
    """
    defaults = AGENT_DEFAULTS.get(agent_type, {})
    model_name = defaults.get('model_name', 'openai/gpt-4.1-mini')
    temperature = defaults.get('temperature', 0.3)
    max_tokens = None
    system_prompt = ''

    try:
        config = AgentConfig.objects.get(
            workspace=workspace,
            agent_type=agent_type,
        )
        model_name = config.model_name or model_name
        temperature = config.temperature
        max_tokens = config.max_tokens
        # Inject personality + display_name into the prompt header
        header_parts = []
        if config.display_name or config.personality:
            header = f"Your name is {config.display_name}."
            if config.personality:
                header += f" {config.personality}"
            header_parts.append(header)
        if config.system_prompt:
            header_parts.append(config.system_prompt)
        system_prompt = '\n\n'.join(header_parts)
    except AgentConfig.DoesNotExist:
        logger.warning(
            "No AgentConfig for workspace=%s agent_type=%s; using defaults.",
            getattr(workspace, 'pk', workspace),
            agent_type,
        )

    kwargs = {
        'model': model_name,
        'temperature': temperature,
        'base_url': settings.OPENROUTER_BASE_URL,
        'api_key': _agent_api_key(),
        'default_headers': {
            'HTTP-Referer': getattr(settings, 'FRONTEND_URL', ''),
            'X-OpenRouter-Title': getattr(settings, 'COMPANY_NAME', 'Merch Miner'),
        },
    }
    if max_tokens:
        kwargs['max_tokens'] = max_tokens

    llm = ChatOpenAI(**kwargs)
    return llm, system_prompt


async def aget_llm_for_agent(workspace, agent_type: str) -> Tuple[ChatOpenAI, str]:
    """Async wrapper for use inside LangGraph node coroutines."""
    return await sync_to_async(get_llm_for_agent)(workspace, agent_type)


__all__ = ['get_llm_for_agent', 'aget_llm_for_agent']
