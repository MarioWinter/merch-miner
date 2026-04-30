"""Phase 2 tool-registry contract tests (PROJ-18 AC-12..AC-17).

Locks in:
- Each sub-agent module exposes a `TOOLS` list
- All tools have the @permission_check marker
- Tool names match `agent_app.constants.ALL_TOOLS` exactly
- Each tool's name maps to the correct sub-agent in TOOL_AGENT_MAP
- LangChain @tool wrapping produces a StructuredTool with name + description
"""

from __future__ import annotations

import pytest

from agent_app.agents.tools import (
    design_tools,
    ideation_tools,
    listing_tools,
    publishing_tools,
    research_tools,
    search_tools,
)
from agent_app.constants import ALL_TOOLS, TOOL_AGENT_MAP


AGENT_MODULES = {
    'research': research_tools,
    'ideation': ideation_tools,
    'design': design_tools,
    'listing': listing_tools,
    'publishing': publishing_tools,
    'search': search_tools,
}


class TestToolRegistry:
    def test_all_modules_expose_tools_list(self):
        for agent, mod in AGENT_MODULES.items():
            assert hasattr(mod, 'TOOLS'), f'{agent} module missing TOOLS'
            assert isinstance(mod.TOOLS, list)
            assert len(mod.TOOLS) > 0

    def test_tool_count_matches_constants(self):
        loaded = {t.name for mod in AGENT_MODULES.values() for t in mod.TOOLS}
        assert loaded == set(ALL_TOOLS), (
            f'Mismatch.\nMissing: {set(ALL_TOOLS) - loaded}\n'
            f'Extra: {loaded - set(ALL_TOOLS)}'
        )

    def test_tool_to_agent_mapping_consistent(self):
        for agent_type, mod in AGENT_MODULES.items():
            for tool_obj in mod.TOOLS:
                assert TOOL_AGENT_MAP[tool_obj.name] == agent_type, (
                    f'{tool_obj.name} mapped to '
                    f'{TOOL_AGENT_MAP[tool_obj.name]} but lives in '
                    f'{agent_type}_tools.py'
                )

    def test_each_tool_has_permission_marker(self):
        for mod in AGENT_MODULES.values():
            for tool_obj in mod.TOOLS:
                fn = getattr(tool_obj, 'func', None)
                assert fn is not None, f'{tool_obj.name}: no .func'
                assert getattr(fn, '_tool_name', None) == tool_obj.name, (
                    f'{tool_obj.name}: _tool_name marker missing or wrong'
                )
                assert getattr(fn, '_requires_permission', False), (
                    f'{tool_obj.name}: _requires_permission marker missing'
                )

    def test_each_tool_has_description(self):
        for mod in AGENT_MODULES.values():
            for tool_obj in mod.TOOLS:
                assert tool_obj.description, (
                    f'{tool_obj.name}: missing description (docstring)'
                )

    def test_total_tool_count_is_36(self):
        total = sum(len(mod.TOOLS) for mod in AGENT_MODULES.values())
        assert total == 36, f'Expected 36 tools, got {total}'


# ── Light functional sanity tests on read-only / non-side-effect paths ──

@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        email='tools@test.com', password='testpass123',
    )


@pytest.fixture
def workspace(user):
    from workspace_app.models import Membership
    membership = Membership.objects.get(user=user, status='active')
    return membership.workspace


@pytest.fixture
def runtime_config(workspace, user):
    return {
        'configurable': {
            'workspace_id': str(workspace.id),
            'user_id': user.id,
            'session_id': None,
        },
    }


@pytest.mark.django_db
class TestResearchToolsBasic:
    def test_create_niche_writes_db(self, runtime_config):
        from niche_app.models import Niche
        result = research_tools.create_niche.invoke(
            {'name': 'Test Niche', 'notes': 'note'},
            config=runtime_config,
        )
        assert 'niche_id' in result
        assert Niche.objects.filter(id=result['niche_id']).exists()

    def test_read_niche_details_returns_404_payload(self, runtime_config):
        result = research_tools.read_niche_details.invoke(
            {'niche_id': '00000000-0000-0000-0000-000000000000'},
            config=runtime_config,
        )
        assert 'error' in result

    def test_missing_workspace_raises(self):
        with pytest.raises(ValueError, match='workspace'):
            research_tools.create_niche.invoke(
                {'name': 'X', 'notes': ''},
            )


@pytest.mark.django_db
class TestKanbanReadBoard:
    def test_read_kanban_board_returns_columns(
        self, runtime_config, workspace, user,
    ):
        from niche_app.models import Niche
        Niche.objects.create(
            workspace=workspace, created_by=user, name='Kanban A',
            status=Niche.Status.DATA_ENTRY,
        )
        Niche.objects.create(
            workspace=workspace, created_by=user, name='Kanban B',
            status=Niche.Status.UPLOAD,
        )
        result = publishing_tools.read_kanban_board.invoke(
            {}, config=runtime_config,
        )
        statuses = {col['status']: col['count'] for col in result['columns']}
        assert statuses['data_entry'] >= 1
        assert statuses['upload'] >= 1


@pytest.mark.django_db
class TestListingTextOnlyFallback:
    """EC-7: generate_listing falls back to text-only when no design exists."""

    def test_text_only_fallback_no_niche(self, runtime_config, workspace, user):
        from idea_app.models import Idea
        idea = Idea.objects.create(
            workspace=workspace,
            slogan_text='Test Slogan',
            is_manual=True,
            created_by=user,
        )
        result = listing_tools.generate_listing.invoke(
            {'idea_id': str(idea.id)},
            config=runtime_config,
        )
        assert result.get('text_only') is True
        assert result.get('design_id') is None

    def test_non_approved_design_still_triggers_text_only_fallback(
        self, runtime_config, workspace, user,
    ):
        """P2 #10 / EC-7: a niche with a DesignAsset whose linked Idea is
        NOT approved must still trigger the text-only fallback. Previous
        behaviour picked up the latest design regardless of approval
        signal which masked the fallback path.
        """
        from idea_app.models import Idea
        from niche_app.models import Niche
        from publish_app.models import DesignAsset

        niche = Niche.objects.create(
            workspace=workspace, name='Fallback Niche', created_by=user,
        )
        # Pending idea with a linked DesignAsset — must be ignored.
        pending_idea = Idea.objects.create(
            workspace=workspace, niche=niche,
            slogan_text='Pending Slogan',
            is_manual=True, created_by=user,
            status=Idea.Status.PENDING,
        )
        DesignAsset.objects.create(
            workspace=workspace, niche=niche, idea=pending_idea,
            file_name='pending.png', created_by=user,
        )

        # Active idea (the one we generate the listing from) is also
        # pending — no approved design hangs off this niche.
        idea = Idea.objects.create(
            workspace=workspace, niche=niche,
            slogan_text='Listing Slogan',
            is_manual=True, created_by=user,
            status=Idea.Status.PENDING,
        )

        result = listing_tools.generate_listing.invoke(
            {'idea_id': str(idea.id)},
            config=runtime_config,
        )
        assert result.get('text_only') is True
        assert result.get('design_id') is None

    def test_text_only_emits_session_message(
        self, workspace, user,
    ):
        from agent_app.models import (
            AgentMessage, AgentSession, MessageRole, PermissionLevel,
            SessionStatus, ToolPermission,
        )
        from idea_app.models import Idea

        session = AgentSession.objects.create(
            workspace=workspace, created_by=user, title='Listing Session',
            status=SessionStatus.RUNNING,
        )
        # Permission decorator is now active (Phase 4): pre-seed AUTO so the
        # tool body runs and emits the EC-7 text-only fallback message.
        ToolPermission.objects.create(
            workspace=workspace, user=user,
            tool_name='generate_listing', permission_level=PermissionLevel.AUTO,
        )
        cfg = {
            'configurable': {
                'workspace_id': str(workspace.id),
                'user_id': user.id,
                'session_id': str(session.id),
            },
        }
        idea = Idea.objects.create(
            workspace=workspace,
            slogan_text='Slogan A',
            is_manual=True,
            created_by=user,
        )
        listing_tools.generate_listing.invoke(
            {'idea_id': str(idea.id)},
            config=cfg,
        )
        msgs = AgentMessage.objects.filter(
            session=session, role=MessageRole.SYSTEM,
        )
        assert msgs.filter(content__icontains='text-only').exists()


@pytest.mark.django_db
class TestPermissionDecoratorWiring:
    """Phase 4 AC-18 — permission decorator gates tool calls end-to-end.

    Default seed for `generate_listing` is APPROVE → invoking it via a real
    AgentSession config must short-circuit and return the awaiting_approval
    payload WITHOUT writing a Listing row.
    """

    def test_approve_short_circuits_tool_body(self, workspace, user):
        from agent_app.models import (
            ActionStatus, AgentActionLog, AgentSession,
            MessageRole, AgentMessage, SessionStatus,
        )
        from idea_app.models import Idea
        from publish_app.models import Listing

        session = AgentSession.objects.create(
            workspace=workspace, created_by=user, title='Approve Test',
            status=SessionStatus.RUNNING,
        )
        idea = Idea.objects.create(
            workspace=workspace, slogan_text='Approve Me',
            is_manual=True, created_by=user,
        )
        cfg = {
            'configurable': {
                'workspace_id': str(workspace.id),
                'user_id': user.id,
                'session_id': str(session.id),
                'thread_id': f'{session.id}__listing',
            },
        }

        result = listing_tools.generate_listing.invoke(
            {'idea_id': str(idea.id)},
            config=cfg,
        )

        # Decorator returned awaiting_approval payload …
        assert result.get('status') == 'awaiting_approval'
        assert 'action_log_id' in result
        # … and the tool body never created a Listing row.
        assert Listing.objects.filter(idea=idea).count() == 0
        # AgentActionLog records the pause.
        log = AgentActionLog.objects.get(id=result['action_log_id'])
        assert log.status == ActionStatus.AWAITING_APPROVAL
        # Approval-request message persisted for the frontend.
        assert AgentMessage.objects.filter(
            session=session, role=MessageRole.APPROVAL_REQUEST,
        ).exists()

    def test_approve_pauses_session_synchronously(self, workspace, user):
        """P2 #7: the decorator must flip session.status=PAUSED in the same
        transaction as creating the awaiting_approval AgentActionLog +
        approval_request AgentMessage. Otherwise the frontend can poll the
        session between the action_log write and a follow-up pause and see
        an inconsistent (running, but blocked) state.
        """
        from agent_app.models import AgentSession, SessionStatus
        from idea_app.models import Idea

        session = AgentSession.objects.create(
            workspace=workspace, created_by=user, title='Sync Pause',
            status=SessionStatus.RUNNING,
        )
        idea = Idea.objects.create(
            workspace=workspace, slogan_text='Sync Pause Me',
            is_manual=True, created_by=user,
        )
        cfg = {
            'configurable': {
                'workspace_id': str(workspace.id),
                'user_id': user.id,
                'session_id': str(session.id),
                'thread_id': f'{session.id}__listing',
            },
        }

        result = listing_tools.generate_listing.invoke(
            {'idea_id': str(idea.id)},
            config=cfg,
        )
        assert result.get('status') == 'awaiting_approval'
        # Reload from DB — session must be PAUSED right now, before the
        # caller does anything else.
        session.refresh_from_db()
        assert session.status == SessionStatus.PAUSED

    def test_auto_executes_and_completes_log(self, workspace, user):
        from agent_app.models import (
            ActionStatus, AgentActionLog, AgentSession,
            PermissionLevel, SessionStatus, ToolPermission,
        )
        from niche_app.models import Niche

        session = AgentSession.objects.create(
            workspace=workspace, created_by=user, title='Auto Test',
            status=SessionStatus.RUNNING,
        )
        ToolPermission.objects.create(
            workspace=workspace, user=user,
            tool_name='create_niche', permission_level=PermissionLevel.AUTO,
        )
        cfg = {
            'configurable': {
                'workspace_id': str(workspace.id),
                'user_id': user.id,
                'session_id': str(session.id),
                'thread_id': f'{session.id}__research',
            },
        }

        result = research_tools.create_niche.invoke(
            {'name': 'Auto Niche', 'notes': ''},
            config=cfg,
        )
        assert 'niche_id' in result
        assert Niche.objects.filter(id=result['niche_id']).exists()
        # AgentActionLog terminal: completed.
        log = AgentActionLog.objects.filter(
            session=session, action='create_niche',
        ).latest('created_at')
        assert log.status == ActionStatus.COMPLETED

    def test_no_session_in_config_falls_through(self, runtime_config):
        """Backwards-compat: tools called without a real session_id must still run."""
        from niche_app.models import Niche
        result = research_tools.create_niche.invoke(
            {'name': 'No-Session Niche', 'notes': ''},
            config=runtime_config,
        )
        assert 'niche_id' in result
        assert Niche.objects.filter(id=result['niche_id']).exists()
