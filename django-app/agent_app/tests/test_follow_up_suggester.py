"""PROJ-29 Phase 1D Round 1D-3 — follow_up_suggester service.

Covers (AC-Lang-3 / EC-20):
- Valid JSON `{suggestions: [a, b, c]}` -> 3 chips.
- Markdown-fenced JSON parses correctly.
- Fewer than 3 suggestions -> padded with `''` to length 3.
- More than 3 -> truncated to first 3.
- Chip > 80 chars -> truncated.
- LLM exception -> ``[]`` (frontend hides chip row).
- Non-JSON response -> ``[]``.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest


def _patch_llm(content: str):
    fake_llm = MagicMock()
    fake_llm.invoke.return_value = MagicMock(content=content)
    return fake_llm


@pytest.mark.django_db
class TestFollowUpSuggester:
    def _patch_resolver(self):
        return patch(
            'chat_node_config_app.services.resolver.get_chat_prompt',
            return_value='RENDERED_PROMPT',
        )

    def test_returns_three_chips_on_valid_json(self):
        from agent_app.services.follow_up_suggester import suggest

        llm = _patch_llm(
            '{"suggestions": ["What pattern works best?", '
            '"Generate 5 more slogans", "Compare to Bus Driver niche"]}'
        )
        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
            return_value=(llm, 'SYSTEM'),
        ), self._patch_resolver():
            chips = suggest(
                user_msg='Give me slogans',
                assistant_msg='Here are 5 slogans...',
                niche_name='Fishing Humor',
            )

        assert len(chips) == 3
        assert chips[0] == 'What pattern works best?'

    def test_parses_markdown_fenced_json(self):
        from agent_app.services.follow_up_suggester import suggest

        raw = '```json\n{"suggestions": ["a", "b", "c"]}\n```'
        llm = _patch_llm(raw)
        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
            return_value=(llm, 'SYSTEM'),
        ), self._patch_resolver():
            chips = suggest('q', 'a')

        assert chips == ['a', 'b', 'c']

    def test_truncates_chips_longer_than_80_chars(self):
        from agent_app.services.follow_up_suggester import (
            CHIP_MAX_CHARS,
            suggest,
        )

        long_chip = 'x' * 200
        llm = _patch_llm(
            '{"suggestions": ["short", "' + long_chip + '", "c"]}'
        )
        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
            return_value=(llm, 'SYSTEM'),
        ), self._patch_resolver():
            chips = suggest('q', 'a')

        assert len(chips) == 3
        assert len(chips[1]) == CHIP_MAX_CHARS
        assert chips[1] == 'x' * CHIP_MAX_CHARS

    def test_truncates_to_three_when_llm_returns_more(self):
        from agent_app.services.follow_up_suggester import suggest

        llm = _patch_llm(
            '{"suggestions": ["a", "b", "c", "d", "e"]}'
        )
        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
            return_value=(llm, 'SYSTEM'),
        ), self._patch_resolver():
            chips = suggest('q', 'a')

        assert chips == ['a', 'b', 'c']

    def test_pads_with_empty_strings_when_llm_returns_fewer(self):
        """EC-20 graceful: caller filters empty strings before render."""
        from agent_app.services.follow_up_suggester import suggest

        llm = _patch_llm('{"suggestions": ["only one"]}')
        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
            return_value=(llm, 'SYSTEM'),
        ), self._patch_resolver():
            chips = suggest('q', 'a')

        assert chips == ['only one', '', '']

    def test_llm_exception_returns_empty_list(self):
        from agent_app.services.follow_up_suggester import suggest

        fake_llm = MagicMock()
        fake_llm.invoke.side_effect = RuntimeError('LLM 500')
        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
            return_value=(fake_llm, 'SYSTEM'),
        ), self._patch_resolver():
            chips = suggest('q', 'a')

        assert chips == []

    def test_non_json_response_returns_empty_list(self):
        from agent_app.services.follow_up_suggester import suggest

        llm = _patch_llm('Sorry I am not able to help with that.')
        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
            return_value=(llm, 'SYSTEM'),
        ), self._patch_resolver():
            chips = suggest('q', 'a')

        assert chips == []

    def test_empty_inputs_short_circuit(self):
        """Both user + assistant empty -> ``[]`` without LLM call."""
        from agent_app.services.follow_up_suggester import suggest

        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
        ) as factory:
            chips = suggest('', '')

        assert chips == []
        factory.assert_not_called()

    def test_assistant_msg_truncated_to_500_chars_in_prompt(self):
        from agent_app.services.follow_up_suggester import suggest

        llm = _patch_llm('{"suggestions": ["a", "b", "c"]}')
        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
            return_value=(llm, 'SYSTEM'),
        ), patch(
            'chat_node_config_app.services.resolver.get_chat_prompt',
            return_value='RENDERED',
        ) as resolver:
            suggest(
                user_msg='Q',
                assistant_msg='A' * 2000,
            )

        # last_assistant_message_summary kwarg <= 500 chars
        kwargs = resolver.call_args.kwargs
        assert len(kwargs['last_assistant_message_summary']) == 500
