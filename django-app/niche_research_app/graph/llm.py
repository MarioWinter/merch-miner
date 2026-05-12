"""LLM client factory: reads config from DB, falls back to code defaults.

PROJ-29: the factory is now config-source-agnostic via a `config_resolver`
callable. Default reads `ResearchNodeConfig` (existing behaviour, no caller
breakage). The chat agent passes
`chat_node_config_app.services.resolver.get_node_config` to read from
`ChatNodeConfig`.
"""

import logging
from typing import Callable, Optional

from django.conf import settings
from langchain_openai import ChatOpenAI

from niche_research_app.graph.prompts import (
    DEFAULT_EMOTIONAL_PROMPT,
    DEFAULT_KEYWORDS_PROMPT,
    DEFAULT_NICHE_PROFILE_PROMPT,
    DEFAULT_VISION_PROMPT,
)

logger = logging.getLogger(__name__)

_DEFAULT_PROMPTS = {
    'vision_analyze': DEFAULT_VISION_PROMPT,
    'emotional_analyze': DEFAULT_EMOTIONAL_PROMPT,
    'niche_profile': DEFAULT_NICHE_PROFILE_PROMPT,
    'keywords': DEFAULT_KEYWORDS_PROMPT,
}

_DEFAULT_MODEL = 'openai/gpt-4.1-mini'
_DEFAULT_TEMPERATURE = 0.3


def _research_resolver(node_name: str) -> Optional[dict]:
    """Default resolver: read ResearchNodeConfig + fall back to hardcoded prompt."""
    from niche_research_app.models import ResearchNodeConfig

    config = {
        'model_name': _DEFAULT_MODEL,
        'temperature': _DEFAULT_TEMPERATURE,
        'max_tokens': None,
        'system_prompt': _DEFAULT_PROMPTS.get(node_name, ''),
    }
    try:
        row = ResearchNodeConfig.objects.get(node_name=node_name)
    except ResearchNodeConfig.DoesNotExist:
        logger.warning(
            "No ResearchNodeConfig for node '%s', using defaults.", node_name,
        )
        return config

    config['model_name'] = row.model_name or _DEFAULT_MODEL
    config['temperature'] = row.temperature
    config['max_tokens'] = row.max_tokens
    if row.system_prompt:
        config['system_prompt'] = row.system_prompt
    return config


def get_llm_for_node(
    node_name: str,
    config_resolver: Optional[Callable[[str], Optional[dict]]] = None,
    model_override: Optional[str] = None,
) -> tuple[ChatOpenAI, str]:
    """Return (llm_instance, system_prompt) for the given node.

    `config_resolver` is a callable `(node_name) -> dict | None` returning
    `{model_name, temperature, max_tokens, system_prompt}`. When omitted, the
    research-domain resolver is used (existing behaviour).

    `model_override`: PROJ-29 Phase 1I follow-up — when set (e.g. from the
    ChatInputBar Model picker), it overrides `config.model_name`. Used for
    user-facing stages (`agent_react`, `creative_techniques`) so the picker
    is honored; utility stages (`query_rewrite`, `contextual_header`, etc.)
    ignore the override and keep their tuned defaults.
    """
    resolver = config_resolver or _research_resolver
    config = resolver(node_name) or {}

    model_name = model_override or config.get('model_name') or _DEFAULT_MODEL
    temperature = config.get('temperature', _DEFAULT_TEMPERATURE)
    max_tokens = config.get('max_tokens')
    system_prompt = config.get('system_prompt', '')

    kwargs = {
        'model': model_name,
        'temperature': temperature,
        'base_url': settings.OPENROUTER_BASE_URL,
        'api_key': settings.OPENROUTER_API_KEY,
        'default_headers': {
            'HTTP-Referer': settings.FRONTEND_URL,
            'X-OpenRouter-Title': settings.COMPANY_NAME,
        },
    }
    if max_tokens:
        kwargs['max_tokens'] = max_tokens

    llm = ChatOpenAI(**kwargs)
    return llm, system_prompt
