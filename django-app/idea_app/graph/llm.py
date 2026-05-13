"""LLM client factory: reads config from DB, falls back to code defaults."""
import logging

from django.conf import settings
from langchain_openai import ChatOpenAI

logger = logging.getLogger(__name__)

# Code-level defaults (used when no DB config exists)
_NODE_DEFAULTS = {
    "analyze_original": {"model": "openai/gpt-4.1-mini", "temperature": 0.2},
    "discover_niches": {"model": "mistralai/mistral-medium-3.1", "temperature": 0.3},
    "validate_products": {
        "model": "mistralai/mistral-small-3.2-24b-instruct",
        "temperature": 0.2,
    },
    # mistral-small-creative was retired by OpenRouter; switched to the
    # writing-tuned mistral-medium-3 successor. Mirrors the same fix in
    # chat_node_config_app (migration 0003 for the chat-creative node).
    "adapt_slogans": {"model": "mistralai/mistral-medium-3", "temperature": 0.8},
    "quality_check": {"model": "openai/gpt-4.1-mini", "temperature": 0.1},
}


def get_slogan_llm(node_name: str) -> tuple[ChatOpenAI, str]:
    """Return (llm_instance, system_prompt) for the given node.

    Reads SloganNodeConfig from DB. Falls back to code defaults if no record.
    """
    from idea_app.graph.prompts import DEFAULT_PROMPTS
    from idea_app.models import SloganNodeConfig

    defaults = _NODE_DEFAULTS.get(node_name, {})
    model_name = defaults.get("model", "openai/gpt-4.1-mini")
    temperature = defaults.get("temperature", 0.3)
    max_tokens = None
    system_prompt = DEFAULT_PROMPTS.get(node_name, "")

    try:
        config = SloganNodeConfig.objects.get(node_name=node_name)
        model_name = config.model_name or model_name
        temperature = config.temperature
        max_tokens = config.max_tokens
        if config.system_prompt:
            system_prompt = config.system_prompt
    except SloganNodeConfig.DoesNotExist:
        logger.warning(
            "No SloganNodeConfig for node '%s', using defaults.", node_name
        )

    kwargs = {
        "model": model_name,
        "temperature": temperature,
        "base_url": settings.OPENROUTER_BASE_URL,
        "api_key": settings.OPENROUTER_API_KEY,
        "default_headers": {
            "HTTP-Referer": settings.FRONTEND_URL,
            "X-OpenRouter-Title": settings.COMPANY_NAME,
        },
    }
    if max_tokens:
        kwargs["max_tokens"] = max_tokens

    llm = ChatOpenAI(**kwargs)
    return llm, system_prompt
