"""LLM client factory: reads config from DB, falls back to code defaults."""

import logging

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


def get_llm_for_node(node_name: str) -> tuple[ChatOpenAI, str]:
    """Return (llm_instance, system_prompt) for the given node.

    Reads ResearchNodeConfig from DB. Falls back to code defaults if no record.
    """
    from niche_research_app.models import ResearchNodeConfig

    model_name = _DEFAULT_MODEL
    temperature = _DEFAULT_TEMPERATURE
    max_tokens = None
    system_prompt = _DEFAULT_PROMPTS.get(node_name, '')

    try:
        config = ResearchNodeConfig.objects.get(node_name=node_name)
        model_name = config.model_name or _DEFAULT_MODEL
        temperature = config.temperature
        max_tokens = config.max_tokens
        if config.system_prompt:
            system_prompt = config.system_prompt
    except ResearchNodeConfig.DoesNotExist:
        logger.warning(
            "No ResearchNodeConfig for node '%s', using defaults.", node_name,
        )

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
