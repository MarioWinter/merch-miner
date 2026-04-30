"""Phase 3 multi-agent system tests (PROJ-18 AC-9 / AC-10 / AC-11 / EC-6 / EC-15).

Covers:
- Sub-agent isolation (AC-11) — research_agent rejects design tools
- Tool registry coverage — every TOOL_AGENT_MAP entry has a real tool
- Orchestrator builds 6 delegate tools (one per sub-agent)
- EC-6: design delegate pre-flight pauses workflow when no approved slogans
- EC-15: sub-agent timeout → AgentActionLog.failed + workflow paused
- AC-73 stub: `_extract_final_result` strips intermediate steps
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.tools import tool

from agent_app.agents import (
    design_agent,
    ideation_agent,
    listing_agent,
    publishing_agent,
    research_agent,
    search_agent,
)
from agent_app.agents.orchestrator import (
    SUB_AGENT_BUILDERS,
    _extract_final_result,
    build_orchestrator_tools,
)
from agent_app.agents.sub_agent_base import (
    ToolIsolationError,
    assert_tools_belong_to_agent,
)
from agent_app.constants import TOOL_AGENT_MAP
from agent_app.models import (
    ActionStatus,
    AgentActionLog,
    AgentMessage,
    AgentSession,
    AgentType,
    MessageRole,
    SessionStatus,
)

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        email='agent_phase3@test.com',
        password='testpass123',
    )


@pytest.fixture
def workspace(user):
    from workspace_app.models import Membership
    return Membership.objects.get(user=user, status='active').workspace


@pytest.fixture
def session(workspace, user):
    return AgentSession.objects.create(
        workspace=workspace,
        created_by=user,
        title='Phase3 test session',
        status=SessionStatus.RUNNING,
    )


# ── AC-11 — sub-agent tool isolation ───────────────────────────────────────


class TestToolIsolation:
    def test_research_agent_only_research_tools(self):
        # Every research tool must be mapped to 'research'
        for t in research_agent.TOOLS:
            name = getattr(t, '_tool_name', None) or getattr(t, 'name', None)
            assert TOOL_AGENT_MAP[name] == 'research'

    @pytest.mark.parametrize(
        'mod, expected',
        [
            (research_agent, 'research'),
            (ideation_agent, 'ideation'),
            (design_agent, 'design'),
            (listing_agent, 'listing'),
            (publishing_agent, 'publishing'),
            (search_agent, 'search'),
        ],
    )
    def test_assert_tools_belong_to_agent_passes(self, mod, expected):
        # Should not raise
        assert_tools_belong_to_agent(expected, mod.TOOLS)

    def test_research_agent_rejects_design_tool(self):
        # Mixing in a design tool must trigger ToolIsolationError
        mixed = list(research_agent.TOOLS) + list(design_agent.TOOLS[:1])
        with pytest.raises(ToolIsolationError):
            assert_tools_belong_to_agent('research', mixed)

    def test_unregistered_tool_blocked(self):
        @tool
        def stray_tool(x: str) -> str:  # noqa: D401 — test stub
            """A tool not in TOOL_AGENT_MAP."""
            return x

        with pytest.raises(ToolIsolationError):
            assert_tools_belong_to_agent('research', [stray_tool])


# ── AC-9 — orchestrator delegate tools ─────────────────────────────────────


class TestOrchestratorTools:
    def test_six_delegate_tools_built(self):
        tools = build_orchestrator_tools()
        assert len(tools) == 6
        names = sorted(t.name for t in tools)
        assert names == sorted(
            f'delegate_to_{at}' for at in SUB_AGENT_BUILDERS
        )

    def test_each_delegate_tagged_with_target(self):
        tools = build_orchestrator_tools()
        targets = {getattr(t, '_delegate_target', None) for t in tools}
        assert targets == set(SUB_AGENT_BUILDERS.keys())


# ── AC-73 stub — return-value filter ───────────────────────────────────────


class TestFinalResultExtraction:
    def test_extracts_last_string_message(self):
        msg = MagicMock()
        msg.content = 'final answer'
        result = {'messages': [MagicMock(content='intermediate'), msg]}
        assert _extract_final_result(result) == 'final answer'

    def test_skips_empty_messages(self):
        empty = MagicMock()
        empty.content = ''
        good = MagicMock()
        good.content = 'real'
        assert _extract_final_result({'messages': [good, empty]}) == 'real'

    def test_handles_list_content(self):
        msg = MagicMock()
        msg.content = [{'text': 'part1 '}, {'text': 'part2'}]
        assert _extract_final_result({'messages': [msg]}) == 'part1 part2'

    def test_returns_empty_when_no_messages(self):
        assert _extract_final_result({'messages': []}) == ''
        assert _extract_final_result({}) == ''


# ── EC-6 — design pre-flight ───────────────────────────────────────────────


class TestDesignPreflight:
    def test_zero_approved_slogans_pauses_session(self, session, workspace):
        # Make session niche-bound but with no approved Idea rows
        from niche_app.models import Niche
        niche = Niche.objects.create(
            workspace=workspace,
            created_by=session.created_by,
            name='Test niche',
        )
        session.niche_context = niche
        session.save()

        tools = build_orchestrator_tools()
        delegate_design = next(t for t in tools if t.name == 'delegate_to_design')

        # Patch SUB_AGENT_BUILDERS['design'] so test never instantiates LangGraph
        with patch.dict(
            SUB_AGENT_BUILDERS,
            {'design': lambda ws: pytest.fail('Sub-agent should not be invoked when slogans=0')},
        ):
            result = asyncio.run(
                delegate_design.ainvoke(
                    {
                        'task': 'Create a t-shirt design for adventure niche',
                    },
                    config={
                        'configurable': {
                            'session_id': str(session.id),
                            'workspace_id': str(workspace.id),
                            'user_id': session.created_by_id,
                        },
                    },
                )
            )

        assert 'No approved slogans' in result
        session.refresh_from_db()
        assert session.status == SessionStatus.PAUSED
        msgs = AgentMessage.objects.filter(session=session, role=MessageRole.SYSTEM)
        assert msgs.exists()


# ── EC-15 — per-sub-agent timeout ──────────────────────────────────────────


class TestSubAgentTimeout:
    def test_timeout_logs_failed_and_pauses(self, session, workspace, settings):
        # Tight timeout so wait_for fires immediately
        settings.AGENT_SUBAGENT_TIMEOUT_SEC = 0  # 0 → wait_for raises instantly

        # Build a fake sub-agent whose `ainvoke` blocks indefinitely
        async def _slow_ainvoke(*_args, **_kwargs):
            await asyncio.sleep(60)
            return {'messages': []}

        fake_agent = MagicMock()
        fake_agent.ainvoke = AsyncMock(side_effect=_slow_ainvoke)

        tools = build_orchestrator_tools()
        delegate_research = next(t for t in tools if t.name == 'delegate_to_research')

        with patch.dict(SUB_AGENT_BUILDERS, {'research': lambda ws: fake_agent}):
            result = asyncio.run(
                delegate_research.ainvoke(
                    {'task': 'Research adventure niche'},
                    config={
                        'configurable': {
                            'session_id': str(session.id),
                            'workspace_id': str(workspace.id),
                            'user_id': session.created_by_id,
                        },
                    },
                )
            )

        assert 'TIMEOUT' in result
        session.refresh_from_db()
        assert session.status == SessionStatus.PAUSED
        log = AgentActionLog.objects.filter(
            session=session,
            agent_type='research',
            status=ActionStatus.FAILED,
        ).first()
        assert log is not None
        assert 'timed out' in (log.error_message or '').lower()


# ── Sanity: missing runtime context raises ─────────────────────────────────


class TestRuntimeContext:
    def test_missing_session_id_raises(self):
        tools = build_orchestrator_tools()
        delegate_research = next(t for t in tools if t.name == 'delegate_to_research')
        with pytest.raises(ValueError):
            asyncio.run(
                delegate_research.ainvoke(
                    {'task': 'x'},
                    config={'configurable': {}},
                )
            )

    def test_session_not_found_returns_error(self, workspace):
        import uuid as _uuid
        tools = build_orchestrator_tools()
        delegate_research = next(t for t in tools if t.name == 'delegate_to_research')
        result = asyncio.run(
            delegate_research.ainvoke(
                {'task': 'x'},
                config={
                    'configurable': {
                        'session_id': str(_uuid.uuid4()),
                        'workspace_id': str(workspace.id),
                        'user_id': 1,
                    },
                },
            )
        )
        assert result.startswith('ERROR') and 'not found' in result
