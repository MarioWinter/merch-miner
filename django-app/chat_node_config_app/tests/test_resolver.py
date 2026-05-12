"""PROJ-29 Phase 1A — resolver fallback chain + cache + KeyError diagnostics.

Migration 0002 pre-seeds 8 ChatNodeConfig rows (one per node) with blank
`system_prompt`. Tests use `update_or_create` to work alongside this seed
rather than collide with it.
"""

import pytest
from django.core.cache import cache

from chat_node_config_app._default_prompts import DEFAULT_PROMPTS, NODE_DEFAULTS
from chat_node_config_app.models import ChatNodeConfig
from chat_node_config_app.services.resolver import (
    get_chat_prompt,
    get_node_config,
    invalidate_cache,
)


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


def _upsert(node_name: str, **fields) -> ChatNodeConfig:
    """Set fields on the seed row (or create it if migration didn't run)."""
    defaults = {
        'model_name': 'openai/gpt-4.1-mini',
        'temperature': 0.3,
        **fields,
    }
    row, _ = ChatNodeConfig.objects.update_or_create(
        node_name=node_name, defaults=defaults,
    )
    return row


@pytest.fixture
def render_ctx_agent():
    return dict(
        niche_name='Bus Driver',
        user_language='English',
        marketplace_language='English',
        conversation_summary='(none)',
        tool_descriptions='(8 tools)',
    )


@pytest.mark.django_db
def test_resolver_returns_db_value_when_system_prompt_non_empty(render_ctx_agent):
    """When ChatNodeConfig.system_prompt is set, resolver returns the DB value."""
    custom = 'CUSTOM DB OVERRIDE — niche {niche_name} language {marketplace_language}'
    _upsert('agent_react', system_prompt=custom)

    rendered = get_chat_prompt('agent_react', **render_ctx_agent)

    assert 'CUSTOM DB OVERRIDE' in rendered
    assert 'Bus Driver' in rendered  # placeholder rendered
    assert 'NICHE = METADATA' not in rendered  # NOT the fallback


@pytest.mark.django_db
def test_resolver_falls_back_to_default_when_db_value_blank(render_ctx_agent):
    """When ChatNodeConfig.system_prompt is empty, resolver uses _DEFAULT_PROMPTS."""
    _upsert('agent_react', system_prompt='')  # blank -> fallback

    rendered = get_chat_prompt('agent_react', **render_ctx_agent)

    assert 'NICHE = METADATA' in rendered  # fallback content
    assert 'Bus Driver' in rendered


@pytest.mark.django_db
def test_resolver_falls_back_when_row_missing(render_ctx_agent):
    """When no ChatNodeConfig row exists for the node, resolver uses defaults."""
    # Migration 0002 pre-seeds the row — delete it to exercise the missing-row branch.
    ChatNodeConfig.objects.filter(node_name='agent_react').delete()
    assert not ChatNodeConfig.objects.filter(node_name='agent_react').exists()

    rendered = get_chat_prompt('agent_react', **render_ctx_agent)

    assert 'NICHE = METADATA' in rendered


@pytest.mark.django_db
def test_resolver_falls_back_when_row_inactive(render_ctx_agent):
    """is_active=False is treated as if the row didn't exist (per AC-17)."""
    _upsert(
        'agent_react',
        system_prompt='THIS SHOULD BE IGNORED',
        is_active=False,
    )

    rendered = get_chat_prompt('agent_react', **render_ctx_agent)

    assert 'THIS SHOULD BE IGNORED' not in rendered
    assert 'NICHE = METADATA' in rendered


@pytest.mark.django_db
def test_resolver_caches_result(render_ctx_agent):
    """get_node_config is Redis-cached; second call doesn't hit DB."""
    _upsert('agent_react', system_prompt='V1')

    first = get_node_config('agent_react')
    assert first['system_prompt'] == 'V1'

    # Direct SQL update -> bypasses post_save signal -> cache stays warm with V1.
    ChatNodeConfig.objects.filter(node_name='agent_react').update(system_prompt='V2')

    cached = get_node_config('agent_react')
    assert cached['system_prompt'] == 'V1'

    invalidate_cache('agent_react')
    fresh = get_node_config('agent_react')
    assert fresh['system_prompt'] == 'V2'


@pytest.mark.django_db
def test_resolver_raises_value_error_on_unknown_node():
    with pytest.raises(ValueError, match='Unknown chat node_name'):
        get_node_config('not_a_real_node')


@pytest.mark.django_db
def test_resolver_keyerror_includes_diagnostic_keys(render_ctx_agent):
    """Missing placeholder raises KeyError with provided keys listed."""
    incomplete = dict(render_ctx_agent)
    incomplete.pop('marketplace_language')  # required by guardrail 6

    with pytest.raises(KeyError) as exc_info:
        get_chat_prompt('agent_react', **incomplete)

    message = str(exc_info.value)
    assert 'marketplace_language' in message
    assert 'niche_name' in message  # one of provided keys, proves listing works


@pytest.mark.django_db
def test_node_defaults_match_eight_nodes():
    """All 8 nodes have model+temperature+max_tokens defaults."""
    expected_nodes = {
        'agent_react', 'creative_techniques', 'chat_with_niche',
        'chat_no_niche', 'query_rewrite', 'contextual_header',
        'follow_up_suggester', 'conversation_summarizer',
    }
    assert set(NODE_DEFAULTS.keys()) == expected_nodes
    assert set(DEFAULT_PROMPTS.keys()) == expected_nodes
    for node, defaults in NODE_DEFAULTS.items():
        assert 'model' in defaults
        assert 'temperature' in defaults
