"""PROJ-29 Phase 1C — agent_app.services.query_rewriter.rewrite.

Tests resolution order, graceful fallback on LLM failure, empty query
handling, and the ``NICHE_RAG_QUERY_REWRITE_ENABLED`` feature flag.
"""

from unittest.mock import MagicMock, patch

import pytest

from agent_app.services.query_rewriter import rewrite


@pytest.mark.django_db
def test_returns_empty_string_for_empty_user_query():
    """Empty input -> empty output (no LLM call attempted)."""
    assert rewrite('') == ''


@pytest.mark.django_db
def test_returns_expanded_query_on_success():
    """When LLM returns content, the stripped expansion is returned."""
    fake_llm = MagicMock()
    fake_llm.invoke.return_value = MagicMock(
        content='  expanded query with synonyms and HyDE  ',
    )
    with patch(
        'niche_research_app.graph.llm.get_llm_for_node',
        return_value=(fake_llm, 'SYSTEM'),
    ), patch(
        'chat_node_config_app.services.resolver.get_chat_prompt',
        return_value='RENDERED',
    ):
        result = rewrite('slogans for fishing', niche_name='Fishing Humor')

    assert result == 'expanded query with synonyms and HyDE'
    assert not result.startswith(' ')
    assert not result.endswith(' ')


@pytest.mark.django_db
def test_llm_exception_returns_original_query():
    """LLM errors must NOT crash the rewriter — passthrough to original."""
    fake_llm = MagicMock()
    fake_llm.invoke.side_effect = RuntimeError('LLM 500')
    with patch(
        'niche_research_app.graph.llm.get_llm_for_node',
        return_value=(fake_llm, 'SYSTEM'),
    ), patch(
        'chat_node_config_app.services.resolver.get_chat_prompt',
        return_value='RENDERED',
    ):
        result = rewrite('some user query')

    assert result == 'some user query'


@pytest.mark.django_db
def test_empty_llm_response_returns_original_query():
    """Empty/whitespace LLM responses fall back to the original query."""
    fake_llm = MagicMock()
    fake_llm.invoke.return_value = MagicMock(content='   ')
    with patch(
        'niche_research_app.graph.llm.get_llm_for_node',
        return_value=(fake_llm, 'SYSTEM'),
    ), patch(
        'chat_node_config_app.services.resolver.get_chat_prompt',
        return_value='RENDERED',
    ):
        result = rewrite('orig query')

    assert result == 'orig query'


@pytest.mark.django_db
def test_feature_flag_disabled_skips_llm(settings):
    """When ``NICHE_RAG_QUERY_REWRITE_ENABLED=False`` -> passthrough, no LLM call."""
    settings.NICHE_RAG_QUERY_REWRITE_ENABLED = False

    fake_llm = MagicMock()
    with patch(
        'niche_research_app.graph.llm.get_llm_for_node',
        return_value=(fake_llm, 'SYSTEM'),
    ):
        result = rewrite('slogans for fishing', niche_name='Fishing')

    assert result == 'slogans for fishing'
    fake_llm.invoke.assert_not_called()
