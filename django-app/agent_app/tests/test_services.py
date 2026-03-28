import pytest
from decimal import Decimal

from agent_app.models import (
    AgentActionLog,
    AgentMessage,
    AgentSession,
    ActionStatus,
    MessageRole,
    PermissionLevel,
    SessionStatus,
    ToolPermission,
)
from agent_app.services.permission_checker import (
    check_tool_permission,
    get_permission_level,
    resolve_approval,
)
from agent_app.services.collision_detector import check_niche_collision
from agent_app.services.cost_tracker import estimate_cost, get_session_cost

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
