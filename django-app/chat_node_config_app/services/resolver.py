"""Prompt + LLM-config resolver for PROJ-29 chat nodes.

Order of resolution (AC-18, AC-21, AC-22):
1. Redis cache `chat_node_config:<node_name>` (60s TTL)
2. DB row `ChatNodeConfig` for `node_name`
3. Fallback to `_default_prompts.DEFAULT_PROMPTS[node_name]` + `NODE_DEFAULTS[node_name]`

`get_chat_prompt(node_name, **render_context)` renders the prompt via Python
`str.format()` and is the canonical entrypoint for chat-agent code.

`get_node_config(node_name)` returns the LLM config dict suitable as a
`config_resolver` for `niche_research_app.graph.llm.get_llm_for_node`.
"""

import logging

from django.core.cache import cache

from chat_node_config_app._default_prompts import (
    DEFAULT_PROMPTS,
    NODE_DEFAULTS,
)

logger = logging.getLogger(__name__)


CACHE_TTL_SECONDS = 60


def _cache_key(node_name: str) -> str:
    return f'chat_node_config:{node_name}'


def _load_from_db(node_name: str) -> dict | None:
    """Read active ChatNodeConfig row; return dict or None on miss/inactive."""
    from chat_node_config_app.models import ChatNodeConfig

    try:
        row = ChatNodeConfig.objects.get(node_name=node_name)
    except ChatNodeConfig.DoesNotExist:
        return None
    if not row.is_active:
        return None
    return {
        'model_name': row.model_name,
        'temperature': row.temperature,
        'max_tokens': row.max_tokens,
        'system_prompt': row.system_prompt,
    }


def get_node_config(node_name: str) -> dict:
    """Return resolved LLM config (model, temperature, max_tokens, system_prompt).

    Cache-first, DB-second, hardcoded-defaults-third. Always returns a dict
    so callers can pass it straight into `ChatOpenAI(**kwargs)`. `system_prompt`
    is the DB override (may be empty) — the *rendered* prompt is produced by
    `get_chat_prompt`.
    """
    if node_name not in DEFAULT_PROMPTS:
        raise ValueError(f"Unknown chat node_name: {node_name!r}")

    cached = cache.get(_cache_key(node_name))
    if cached is not None:
        return cached

    defaults = NODE_DEFAULTS[node_name]
    config = {
        'model_name': defaults['model'],
        'temperature': defaults['temperature'],
        'max_tokens': defaults.get('max_tokens'),
        'system_prompt': '',
    }

    db_row = _load_from_db(node_name)
    if db_row is not None:
        config.update(db_row)
    else:
        logger.warning(
            "No ChatNodeConfig row for node '%s' (or inactive); using hardcoded "
            "defaults.", node_name,
        )

    cache.set(_cache_key(node_name), config, CACHE_TTL_SECONDS)
    return config


def get_chat_prompt(node_name: str, **render_context) -> str:
    """Return the rendered system prompt for `node_name`.

    Resolution order: DB `system_prompt` (if non-empty) → `DEFAULT_PROMPTS[node_name]`.
    Rendered via Python `str.format(**render_context)`.

    Raises `KeyError` with a clear message if a placeholder is missing — most
    commonly `{niche_name}` or `{marketplace_language}` which the universal
    `CHAT_GUARDRAILS_BLOCK` requires.
    """
    config = get_node_config(node_name)
    template = config['system_prompt'] or DEFAULT_PROMPTS[node_name]

    try:
        return template.format(**render_context)
    except KeyError as exc:
        missing = exc.args[0] if exc.args else '<unknown>'
        raise KeyError(
            f"Missing placeholder '{missing}' when rendering chat prompt "
            f"'{node_name}'. Provided keys: {sorted(render_context.keys())}."
        ) from exc


def invalidate_cache(node_name: str) -> None:
    cache.delete(_cache_key(node_name))
