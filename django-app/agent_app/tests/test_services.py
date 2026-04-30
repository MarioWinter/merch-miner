import pytest
from decimal import Decimal

from agent_app.models import (
    AgentActionLog,
    AgentConfig,
    AgentMessage,
    AgentSession,
    AgentType,
    ActionStatus,
    AutonomyPreset,
    KnowledgeDoc,
    MessageRole,
    PermissionLevel,
    SessionStatus,
    ToolPermission,
)
from agent_app.services.permission_checker import (
    ApprovalRequired,
    apply_preset,
    check_tool_permission,
    get_permission_level,
    resolve_approval,
    update_permissions,
)
from agent_app.services.collision_detector import (
    check_niche_collision,
    warn_and_pause,
)
from agent_app.services.cost_tracker import estimate_cost, get_session_cost
from agent_app.services.knowledge_loader import (
    build_agent_context,
    load_implicit_knowledge,
    load_knowledge_docs,
    load_system_prompt,
    render_context_as_prompt,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(email='svc@test.com', password='testpass123')


@pytest.fixture
def workspace(user):
    from workspace_app.models import Membership
    # Use the auto-created personal workspace from the post_save signal
    membership = Membership.objects.get(user=user, status='active')
    return membership.workspace


@pytest.fixture
def session(workspace, user):
    return AgentSession.objects.create(
        workspace=workspace, created_by=user, title='SVC Test',
        status=SessionStatus.RUNNING,
    )


# ── Permission Checker ──

class TestPermissionChecker:
    def test_auto_permission(self, session, workspace, user):
        ToolPermission.objects.create(
            workspace=workspace, user=user,
            tool_name='read_niche_details', permission_level=PermissionLevel.AUTO,
        )
        can_exec, log = check_tool_permission(session, 'read_niche_details', 'research')
        assert can_exec is True
        assert log.status == ActionStatus.STARTED

    def test_notify_permission(self, session, workspace, user):
        ToolPermission.objects.create(
            workspace=workspace, user=user,
            tool_name='create_niche', permission_level=PermissionLevel.NOTIFY,
        )
        can_exec, log = check_tool_permission(session, 'create_niche', 'research')
        assert can_exec is True
        # Should create a system notification message
        assert AgentMessage.objects.filter(
            session=session, role=MessageRole.SYSTEM,
        ).exists()

    def test_approve_permission(self, session, workspace, user):
        ToolPermission.objects.create(
            workspace=workspace, user=user,
            tool_name='generate_design', permission_level=PermissionLevel.APPROVE,
        )
        can_exec, log = check_tool_permission(session, 'generate_design', 'design')
        assert can_exec is False
        assert log.status == ActionStatus.AWAITING_APPROVAL
        # Should create approval request message
        assert AgentMessage.objects.filter(
            session=session, role=MessageRole.APPROVAL_REQUEST,
        ).exists()

    def test_default_seeded_on_first_use(self, workspace, user):
        level = get_permission_level(workspace, user, 'trigger_deep_research')
        assert level == PermissionLevel.APPROVE
        assert ToolPermission.objects.filter(
            workspace=workspace, user=user, tool_name='trigger_deep_research',
        ).exists()

    def test_resolve_approval_approve(self, session, workspace, user):
        log = AgentActionLog.objects.create(
            session=session, workspace=workspace, user=user,
            agent_type='research', action='trigger_deep_research',
            status=ActionStatus.AWAITING_APPROVAL,
        )
        result = resolve_approval(log, approved=True)
        assert result is True
        log.refresh_from_db()
        assert log.status == ActionStatus.APPROVED

    def test_resolve_approval_reject(self, session, workspace, user):
        log = AgentActionLog.objects.create(
            session=session, workspace=workspace, user=user,
            agent_type='design', action='generate_design',
            status=ActionStatus.AWAITING_APPROVAL,
        )
        result = resolve_approval(log, approved=False)
        assert result is False
        log.refresh_from_db()
        assert log.status == ActionStatus.REJECTED


# ── Collision Detector ──

class TestCollisionDetector:
    def test_no_collision(self, workspace, user):
        from niche_app.models import Niche
        niche = Niche.objects.create(workspace=workspace, created_by=user, name='Safe Niche')
        collisions = check_niche_collision(workspace, niche)
        assert collisions == []

    def test_active_session_collision(self, workspace, user):
        from niche_app.models import Niche
        niche = Niche.objects.create(workspace=workspace, created_by=user, name='Busy Niche')
        AgentSession.objects.create(
            workspace=workspace, created_by=user, niche_context=niche,
            status=SessionStatus.RUNNING,
        )
        collisions = check_niche_collision(workspace, niche)
        assert len(collisions) == 1
        assert collisions[0]['type'] == 'agent_session'

    def test_excludes_self(self, workspace, user):
        from niche_app.models import Niche
        niche = Niche.objects.create(workspace=workspace, created_by=user, name='Self Niche')
        session = AgentSession.objects.create(
            workspace=workspace, created_by=user, niche_context=niche,
            status=SessionStatus.RUNNING,
        )
        collisions = check_niche_collision(workspace, niche, exclude_session_id=session.id)
        assert collisions == []

    def test_none_niche(self, workspace):
        collisions = check_niche_collision(workspace, None)
        assert collisions == []


# ── Cost Tracker ──

class TestCostTracker:
    def test_estimate_known_tool(self):
        cost = estimate_cost('generate_design')
        assert cost == Decimal('0.10')

    def test_estimate_unknown_tool(self):
        cost = estimate_cost('unknown_tool')
        assert cost == Decimal('0')

    def test_session_cost(self, session, workspace, user):
        AgentActionLog.objects.create(
            session=session, workspace=workspace, user=user,
            agent_type='design', action='generate_design',
            cost_estimate=Decimal('0.10'),
        )
        AgentActionLog.objects.create(
            session=session, workspace=workspace, user=user,
            agent_type='research', action='trigger_deep_research',
            cost_estimate=Decimal('0.05'),
        )
        total = get_session_cost(session)
        assert total == Decimal('0.15')


# ── AC-20 / AC-21: Permission overrides + preset bulk-update ──

class TestPermissionOverrides:
    def test_update_permissions_creates_and_updates(self, workspace, user):
        # First call creates rows
        n = update_permissions(workspace, user, {
            'create_niche': PermissionLevel.NOTIFY,
            'generate_design': PermissionLevel.APPROVE,
        })
        assert n == 2
        assert ToolPermission.objects.filter(
            workspace=workspace, user=user, tool_name='create_niche',
            permission_level=PermissionLevel.NOTIFY,
        ).exists()

        # Second call updates existing rows
        n = update_permissions(workspace, user, {
            'create_niche': PermissionLevel.APPROVE,
        })
        assert n == 1
        perm = ToolPermission.objects.get(
            workspace=workspace, user=user, tool_name='create_niche',
        )
        assert perm.permission_level == PermissionLevel.APPROVE

    def test_update_permissions_invalid_level_raises(self, workspace, user):
        with pytest.raises(ValueError):
            update_permissions(workspace, user, {'create_niche': 'BOGUS'})

    def test_apply_preset_bulk_update(self, workspace, user):
        preset = AutonomyPreset.objects.create(
            workspace=workspace, name='Test Preset', is_system=False,
            permissions={
                'create_niche': PermissionLevel.AUTO,
                'generate_design': PermissionLevel.APPROVE,
                'web_search': PermissionLevel.AUTO,
            },
        )
        n = apply_preset(workspace, user, preset)
        assert n == 3

        gd = ToolPermission.objects.get(
            workspace=workspace, user=user, tool_name='generate_design',
        )
        assert gd.permission_level == PermissionLevel.APPROVE

        cn = ToolPermission.objects.get(
            workspace=workspace, user=user, tool_name='create_niche',
        )
        assert cn.permission_level == PermissionLevel.AUTO

    def test_apply_preset_skips_invalid_levels(self, workspace, user):
        preset = AutonomyPreset.objects.create(
            workspace=workspace, name='Bad Preset', is_system=False,
            permissions={
                'create_niche': PermissionLevel.AUTO,
                'web_search': 'INVALID',
            },
        )
        n = apply_preset(workspace, user, preset)
        assert n == 1
        assert ToolPermission.objects.filter(
            workspace=workspace, user=user, tool_name='web_search',
        ).count() == 0

    def test_apply_preset_wrong_workspace_raises(self, workspace, user, django_user_model):
        from workspace_app.models import Membership
        other_user = django_user_model.objects.create_user(
            email='other@test.com', password='testpass123',
        )
        other_ws = Membership.objects.get(user=other_user, status='active').workspace
        preset = AutonomyPreset.objects.create(
            workspace=other_ws, name='Wrong WS', is_system=False,
            permissions={'create_niche': PermissionLevel.AUTO},
        )
        with pytest.raises(ValueError):
            apply_preset(workspace, user, preset)


# ── ApprovalRequired exception ──

class TestApprovalRequired:
    def test_raise_with_action_log(self, session, workspace, user):
        log = AgentActionLog.objects.create(
            session=session, workspace=workspace, user=user,
            agent_type='design', action='generate_design',
            status=ActionStatus.AWAITING_APPROVAL,
        )
        exc = ApprovalRequired(log, 'generate_design')
        assert exc.action_log is log
        assert exc.tool_name == 'generate_design'
        assert 'generate_design' in str(exc)


# ── AC-22: Approval cost-estimate in payload ──

class TestApprovalPayload:
    def test_cost_estimate_in_message(self, session, workspace, user):
        ToolPermission.objects.create(
            workspace=workspace, user=user,
            tool_name='generate_design', permission_level=PermissionLevel.APPROVE,
        )
        can_exec, log = check_tool_permission(
            session, 'generate_design', 'design',
            target_object_type='Niche', target_object_id=session.id,
            description='Generate hero design for camping niche',
        )
        assert can_exec is False
        msg = AgentMessage.objects.filter(
            session=session, role=MessageRole.APPROVAL_REQUEST,
        ).latest('created_at')
        assert 'generate_design' in msg.content
        assert 'cost' in msg.content.lower()
        assert msg.tool_calls
        payload = msg.tool_calls[0]
        assert payload['action_log_id'] == str(log.id)
        assert payload['tool_name'] == 'generate_design'


# ── Knowledge loader (AC-27/28/29/30) ──

class TestKnowledgeLoader:
    def test_layer1_system_prompt_with_personality(self, workspace):
        AgentConfig.objects.create(
            workspace=workspace,
            agent_type=AgentType.RESEARCH,
            display_name='Scout',
            personality='Datengetrieben.',
            system_prompt='You are a research agent.',
        )
        prompt = load_system_prompt(workspace, 'research')
        assert 'Scout' in prompt
        assert 'Datengetrieben' in prompt
        assert 'research agent' in prompt

    def test_layer1_missing_config_returns_empty(self, workspace):
        # No AgentConfig for ideation in this workspace
        prompt = load_system_prompt(workspace, 'ideation')
        assert prompt == ''

    def test_layer2_fallback_recent_docs_when_no_query(self, workspace, user):
        d1 = KnowledgeDoc.objects.create(
            workspace=workspace, created_by=user,
            title='Old Doc', content='Old content',
        )
        d2 = KnowledgeDoc.objects.create(
            workspace=workspace, created_by=user,
            title='New Doc', content='New content',
        )
        results = load_knowledge_docs(workspace, query_text='', limit=5)
        titles = [r['title'] for r in results]
        assert 'New Doc' in titles
        assert 'Old Doc' in titles
        assert results[0]['title'] == 'New Doc'  # ordered by -updated_at
        # Suppress unused-var lint
        _ = (d1, d2)

    def test_layer2_respects_limit(self, workspace, user):
        for i in range(8):
            KnowledgeDoc.objects.create(
                workspace=workspace, created_by=user,
                title=f'Doc {i}', content=f'Content {i}',
            )
        results = load_knowledge_docs(workspace, query_text='', limit=5)
        assert len(results) == 5

    def test_layer3_filters_by_terminal_status(self, session, workspace, user):
        AgentActionLog.objects.create(
            session=session, workspace=workspace, user=user,
            agent_type='research', action='trigger_deep_research',
            status=ActionStatus.APPROVED,
        )
        AgentActionLog.objects.create(
            session=session, workspace=workspace, user=user,
            agent_type='design', action='generate_design',
            status=ActionStatus.STARTED,  # should be excluded
        )
        AgentActionLog.objects.create(
            session=session, workspace=workspace, user=user,
            agent_type='design', action='generate_design',
            status=ActionStatus.REJECTED,
        )
        results = load_implicit_knowledge(workspace, query_text='', limit=5)
        statuses = [r['status'] for r in results]
        assert ActionStatus.APPROVED in statuses
        assert ActionStatus.REJECTED in statuses
        assert ActionStatus.STARTED not in statuses

    def test_build_agent_context_has_3_layers(self, workspace, user):
        AgentConfig.objects.create(
            workspace=workspace,
            agent_type=AgentType.DESIGN,
            display_name='Pixel',
            system_prompt='Design things.',
        )
        KnowledgeDoc.objects.create(
            workspace=workspace, created_by=user,
            title='Brand Guidelines', content='Always use bold fonts.',
        )
        ctx = build_agent_context(workspace, 'design', query_text='design hero')
        assert 'system_prompt' in ctx
        assert 'knowledge_docs' in ctx
        assert 'implicit_knowledge' in ctx
        assert 'Pixel' in ctx['system_prompt']
        assert any(d['title'] == 'Brand Guidelines' for d in ctx['knowledge_docs'])

    def test_render_context_as_prompt_combines_layers(self, workspace, user):
        AgentConfig.objects.create(
            workspace=workspace,
            agent_type=AgentType.DESIGN,
            display_name='Pixel',
            system_prompt='Design things.',
        )
        KnowledgeDoc.objects.create(
            workspace=workspace, created_by=user,
            title='Brand Guidelines', content='Always use bold fonts.',
        )
        ctx = build_agent_context(workspace, 'design', query_text='')
        rendered = render_context_as_prompt(ctx)
        assert 'Pixel' in rendered
        assert 'Workspace Knowledge' in rendered
        assert 'Brand Guidelines' in rendered


# ── AC-35: Collision warn-and-pause ──

class TestCollisionWarnAndPause:
    def test_warn_pauses_running_session(self, workspace, user):
        from niche_app.models import Niche
        niche = Niche.objects.create(
            workspace=workspace, created_by=user, name='Coll Niche',
        )
        s = AgentSession.objects.create(
            workspace=workspace, created_by=user, niche_context=niche,
            status=SessionStatus.RUNNING,
        )
        collisions = [{
            'type': 'agent_session', 'session_id': '00000',
            'user_name': 'someone@x.com',
            'message': 'Other user is on this niche.',
        }]
        warn_and_pause(s, collisions)
        s.refresh_from_db()
        assert s.status == SessionStatus.PAUSED
        msg = AgentMessage.objects.filter(
            session=s, role=MessageRole.SYSTEM,
        ).latest('created_at')
        assert 'Collision detected' in msg.content

    def test_warn_noop_with_no_collisions(self, workspace, user):
        s = AgentSession.objects.create(
            workspace=workspace, created_by=user,
            status=SessionStatus.RUNNING,
        )
        warn_and_pause(s, [])
        s.refresh_from_db()
        assert s.status == SessionStatus.RUNNING
