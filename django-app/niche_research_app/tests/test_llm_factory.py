"""PROJ-29 Phase 1A — get_llm_for_node config_resolver param (Phase 1A refactor).

Verifies both code paths through the same factory:
- Default resolver: ResearchNodeConfig (research workflow)
- Injected resolver: ChatNodeConfig via chat_node_config_app
"""

from unittest.mock import patch

import pytest

from niche_research_app.graph.llm import get_llm_for_node


@pytest.mark.django_db
@patch('niche_research_app.graph.llm.ChatOpenAI')
def test_default_resolver_uses_research_node_config(mock_chat):
    """Calling without `config_resolver` reads ResearchNodeConfig (existing behaviour)."""
    mock_chat.return_value = object()

    llm, system_prompt = get_llm_for_node('niche_profile')

    assert llm is not None
    assert 'NICHE IDENTITY EXTRACTION' in system_prompt


@pytest.mark.django_db
@patch('niche_research_app.graph.llm.ChatOpenAI')
def test_injected_chat_resolver_reads_chat_node_config(mock_chat):
    """Passing a custom `config_resolver` makes the factory use ChatNodeConfig."""
    mock_chat.return_value = object()

    custom_calls = []

    def fake_resolver(node_name: str):
        custom_calls.append(node_name)
        return {
            'model_name': 'mistralai/mistral-medium-3',
            'temperature': 0.7,
            'max_tokens': 3500,
            'system_prompt': 'CUSTOM SYSTEM PROMPT',
        }

    llm, system_prompt = get_llm_for_node(
        'creative_techniques',
        config_resolver=fake_resolver,
    )

    assert custom_calls == ['creative_techniques']
    assert system_prompt == 'CUSTOM SYSTEM PROMPT'
    init_kwargs = mock_chat.call_args.kwargs
    assert init_kwargs.get('temperature') == 0.7
