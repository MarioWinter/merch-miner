"""PROJ-29 Phase 1A — post_save signal: cache-invalidate + version-snapshot + 10-cap purge.

Migration 0002 pre-seeds 8 ChatNodeConfig rows. Tests measure the DELTA of
ChatNodeConfigVersion counts rather than absolute counts to stay robust
against pre-existing version rows.
"""

import pytest
from django.core.cache import cache

from chat_node_config_app.models import ChatNodeConfig, ChatNodeConfigVersion
from chat_node_config_app.services.resolver import get_node_config
from chat_node_config_app.signals import VERSION_CAP_PER_NODE


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


def _version_count(node_name: str) -> int:
    return ChatNodeConfigVersion.objects.filter(node_name=node_name).count()


@pytest.mark.django_db
def test_save_creates_one_new_version():
    """Each save snapshots to ChatNodeConfigVersion exactly once."""
    row, _ = ChatNodeConfig.objects.update_or_create(
        node_name='agent_react',
        defaults={'model_name': 'openai/gpt-4.1-mini', 'temperature': 0.3, 'system_prompt': 'v1'},
    )
    baseline = _version_count('agent_react')

    row.system_prompt = 'v2'
    row.save()
    assert _version_count('agent_react') == baseline + 1

    row.system_prompt = 'v3'
    row.save()
    assert _version_count('agent_react') == baseline + 2


@pytest.mark.django_db
def test_versions_cap_at_ten_per_node():
    """11th save purges the oldest version; cap stays at 10."""
    row, _ = ChatNodeConfig.objects.update_or_create(
        node_name='agent_react',
        defaults={'model_name': 'openai/gpt-4.1-mini', 'temperature': 0.3, 'system_prompt': 'v1'},
    )
    for i in range(2, VERSION_CAP_PER_NODE + 5):
        row.system_prompt = f'v{i}'
        row.save()

    versions = ChatNodeConfigVersion.objects.filter(node_name='agent_react').order_by('-snapshot_at')
    assert versions.count() == VERSION_CAP_PER_NODE
    newest_prompts = [v.system_prompt for v in versions]
    assert newest_prompts[0] == f'v{VERSION_CAP_PER_NODE + 4}'
    assert 'v1' not in newest_prompts
    assert 'v2' not in newest_prompts
    assert 'v3' not in newest_prompts


@pytest.mark.django_db
def test_versions_cap_isolated_per_node():
    """Purging one node's versions does not affect another node."""
    row_a, _ = ChatNodeConfig.objects.update_or_create(
        node_name='agent_react',
        defaults={'model_name': 'openai/gpt-4.1-mini', 'temperature': 0.3, 'system_prompt': 'a1'},
    )
    ChatNodeConfig.objects.update_or_create(
        node_name='creative_techniques',
        defaults={'model_name': 'mistralai/mistral-small-creative', 'temperature': 0.7, 'system_prompt': 'b1'},
    )
    baseline_b = _version_count('creative_techniques')

    for i in range(2, VERSION_CAP_PER_NODE + 5):
        row_a.system_prompt = f'a{i}'
        row_a.save()

    assert _version_count('agent_react') == VERSION_CAP_PER_NODE
    # creative_techniques version count unchanged by agent_react purging.
    assert _version_count('creative_techniques') == baseline_b
    assert ChatNodeConfigVersion.objects.filter(
        node_name='creative_techniques', system_prompt='b1',
    ).exists()


@pytest.mark.django_db
def test_save_invalidates_cache():
    """post_save flushes the resolver cache for that node."""
    ChatNodeConfig.objects.update_or_create(
        node_name='agent_react',
        defaults={'model_name': 'openai/gpt-4.1-mini', 'temperature': 0.3, 'system_prompt': 'warm'},
    )
    config = get_node_config('agent_react')
    assert config['system_prompt'] == 'warm'

    # Direct SQL update bypasses signal -> cache stays stale with 'warm'.
    ChatNodeConfig.objects.filter(node_name='agent_react').update(system_prompt='direct-sql')
    # Triggering a real save() now fires the signal -> cache invalidates.
    ChatNodeConfig.objects.get(node_name='agent_react').save()

    fresh = get_node_config('agent_react')
    assert fresh['system_prompt'] == 'direct-sql'
