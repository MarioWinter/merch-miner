"""PROJ-29 Phase 1D Round 1D-3 — conversation_summarizer service + rq job.

Covers:
- ``summarize([])`` short-circuits (no LLM call attempted).
- ``summarize([...])`` returns stripped LLM content.
- LLM exception -> ``''`` (EC-21 graceful degrade).
- ``summarize_conversation(session_id)`` rq job:
  - Skips when messages < threshold (default 10).
  - Summarizes ``messages[:-5]`` when threshold reached.
  - Writes result to ``ChatSession.conversation_summary``.
  - ``NICHE_RAG_SUMMARIZE_AFTER_N_TURNS`` env override honored.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest


# ── Service: summarize() ─────────────────────────────────────────────────────


class TestSummarizeService:
    def test_empty_messages_returns_empty_string_no_llm_call(self):
        from agent_app.services.conversation_summarizer import summarize

        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
        ) as factory:
            result = summarize([])

        assert result == ''
        factory.assert_not_called()

    def test_returns_stripped_llm_content_on_success(self, db):
        from agent_app.services.conversation_summarizer import summarize

        fake_llm = MagicMock()
        fake_llm.invoke.return_value = MagicMock(
            content='  User explored fishing humor niche.  ',
        )
        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
            return_value=(fake_llm, 'SYSTEM'),
        ), patch(
            'chat_node_config_app.services.resolver.get_chat_prompt',
            return_value='RENDERED_PROMPT',
        ):
            result = summarize(
                [{'role': 'user', 'content': 'hello'}],
                niche_name='Fishing Humor',
            )

        assert result == 'User explored fishing humor niche.'
        # Sanity: LLM was called exactly once.
        fake_llm.invoke.assert_called_once()

    def test_llm_exception_returns_empty_string(self, db):
        """EC-21: any LLM failure -> empty result; caller keeps stale summary."""
        from agent_app.services.conversation_summarizer import summarize

        fake_llm = MagicMock()
        fake_llm.invoke.side_effect = RuntimeError('LLM 500')
        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
            return_value=(fake_llm, 'SYSTEM'),
        ), patch(
            'chat_node_config_app.services.resolver.get_chat_prompt',
            return_value='RENDERED_PROMPT',
        ):
            result = summarize(
                [{'role': 'user', 'content': 'q'}, {'role': 'assistant', 'content': 'a'}],
            )

        assert result == ''

    def test_empty_llm_response_returns_empty_string(self, db):
        from agent_app.services.conversation_summarizer import summarize

        fake_llm = MagicMock()
        fake_llm.invoke.return_value = MagicMock(content='   ')
        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
            return_value=(fake_llm, 'SYSTEM'),
        ), patch(
            'chat_node_config_app.services.resolver.get_chat_prompt',
            return_value='RENDERED_PROMPT',
        ):
            result = summarize([{'role': 'user', 'content': 'q'}])

        assert result == ''


# ── rq job: summarize_conversation ───────────────────────────────────────────


@pytest.fixture
def chat_session_factory(db):
    from django.contrib.auth import get_user_model

    from search_app.models import ChatMessage, ChatSession
    from workspace_app.models import Workspace

    User = get_user_model()

    def _factory(n_messages: int, niche=None):
        user = User.objects.create_user(
            email=f'cs-{n_messages}@test.com', password='pw',
        )
        ws = Workspace.objects.create(
            name='WS', slug=f'cs-ws-{n_messages}', owner=user,
        )
        session = ChatSession.objects.create(
            workspace=ws, created_by=user, niche_context=niche,
        )
        for i in range(n_messages):
            role = 'user' if i % 2 == 0 else 'assistant'
            ChatMessage.objects.create(
                session=session, role=role, content=f'msg {i}',
            )
        return session

    return _factory


class TestSummarizeConversationJob:
    @pytest.mark.django_db
    def test_skips_when_below_threshold(self, chat_session_factory):
        from agent_app.tasks import summarize_conversation

        session = chat_session_factory(n_messages=5)

        with patch(
            'agent_app.services.conversation_summarizer.summarize',
        ) as summarize_fn:
            summarize_conversation(str(session.id))

        summarize_fn.assert_not_called()
        session.refresh_from_db()
        assert session.conversation_summary == ''

    @pytest.mark.django_db
    def test_summarizes_all_but_last_5_when_threshold_reached(
        self, chat_session_factory,
    ):
        from agent_app.tasks import summarize_conversation

        session = chat_session_factory(n_messages=10)

        with patch(
            'agent_app.tasks.summarize',
            return_value='Rolling summary text.',
        ) as summarize_fn:
            summarize_conversation(str(session.id))

        assert summarize_fn.call_count == 1
        # First positional arg is the payload — should have 10 - 5 = 5 msgs.
        call_args = summarize_fn.call_args
        payload = call_args.args[0]
        assert len(payload) == 5
        for entry in payload:
            assert 'role' in entry and 'content' in entry

        session.refresh_from_db()
        assert session.conversation_summary == 'Rolling summary text.'

    @pytest.mark.django_db
    def test_empty_summary_keeps_stale_summary(self, chat_session_factory):
        """EC-21: empty LLM result must NOT clobber existing summary."""
        from agent_app.tasks import summarize_conversation

        session = chat_session_factory(n_messages=12)
        session.conversation_summary = 'PREVIOUS_SUMMARY'
        session.save(update_fields=['conversation_summary'])

        with patch('agent_app.tasks.summarize', return_value=''):
            summarize_conversation(str(session.id))

        session.refresh_from_db()
        assert session.conversation_summary == 'PREVIOUS_SUMMARY'

    @pytest.mark.django_db
    def test_env_threshold_override_respected(
        self, chat_session_factory, monkeypatch,
    ):
        """``NICHE_RAG_SUMMARIZE_AFTER_N_TURNS=3`` -> 3-message session triggers."""
        from agent_app.tasks import summarize_conversation

        monkeypatch.setenv('NICHE_RAG_SUMMARIZE_AFTER_N_TURNS', '3')

        session = chat_session_factory(n_messages=3)

        with patch(
            'agent_app.tasks.summarize',
            return_value='short summary',
        ) as summarize_fn:
            summarize_conversation(str(session.id))

        summarize_fn.assert_called_once()
        session.refresh_from_db()
        assert session.conversation_summary == 'short summary'

    @pytest.mark.django_db
    def test_missing_session_is_a_noop(self):
        """Stale session_id from a deleted session must NOT raise."""
        from agent_app.tasks import summarize_conversation

        # UUID that does not exist
        summarize_conversation('00000000-0000-0000-0000-000000000000')
        # No assertion needed — must not raise.

    @pytest.mark.django_db
    def test_niche_name_passed_when_session_has_niche(
        self, chat_session_factory, db,
    ):
        from django.contrib.auth import get_user_model

        from niche_app.models import Niche
        from workspace_app.models import Workspace

        from agent_app.tasks import summarize_conversation

        User = get_user_model()
        user = User.objects.create_user(email='cs-niche@test.com', password='pw')
        ws = Workspace.objects.create(name='WS', slug='cs-ws-niche', owner=user)
        niche = Niche.objects.create(
            name='Bus Driver Humor', workspace=ws, created_by=user,
        )

        from search_app.models import ChatMessage, ChatSession
        session = ChatSession.objects.create(
            workspace=ws, created_by=user, niche_context=niche,
        )
        for i in range(11):
            ChatMessage.objects.create(
                session=session,
                role='user' if i % 2 == 0 else 'assistant',
                content=f'msg {i}',
            )

        with patch(
            'agent_app.tasks.summarize',
            return_value='summary',
        ) as summarize_fn:
            summarize_conversation(str(session.id))

        summarize_fn.assert_called_once()
        # niche_name kwarg should be passed.
        assert summarize_fn.call_args.kwargs['niche_name'] == 'Bus Driver Humor'
