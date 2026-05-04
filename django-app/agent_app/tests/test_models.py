import pytest
from django.db import IntegrityError

from agent_app.models import (
    AgentConfig,
    AgentSession,
    AgentMessage,
    AgentActionLog,
    AgentType,
    AutonomyPreset,
    KnowledgeDoc,
    ToolPermission,
    WorkflowTemplate,
    SessionStatus,
    MessageRole,
    ActionStatus,
    PermissionLevel,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(email='agent@test.com', password='testpass123')


@pytest.fixture
def workspace(user):
    from workspace_app.models import Membership
    # Use the auto-created personal workspace from the post_save signal
    membership = Membership.objects.get(user=user, status='active')
    return membership.workspace


class TestAgentConfig:
    def test_create(self, workspace):
        config = AgentConfig.objects.create(
            workspace=workspace,
            agent_type=AgentType.ORCHESTRATOR,
            display_name='Chief',
            avatar_emoji='\U0001f916',
        )
        assert str(config) == '\U0001f916 Chief (orchestrator)'

    def test_unique_per_workspace_agent_type(self, workspace):
        AgentConfig.objects.create(workspace=workspace, agent_type=AgentType.RESEARCH, display_name='Scout')
        with pytest.raises(IntegrityError):
            AgentConfig.objects.create(workspace=workspace, agent_type=AgentType.RESEARCH, display_name='Scout2')


class TestAgentSession:
    def test_create_and_defaults(self, workspace, user):
        session = AgentSession.objects.create(
            workspace=workspace, created_by=user, title='Test Session',
        )
        assert session.status == SessionStatus.IDLE
        assert session.total_steps == 0
        assert session.is_shared is False

    def test_ordering(self, workspace, user):
        AgentSession.objects.create(workspace=workspace, created_by=user, title='First')
        s2 = AgentSession.objects.create(workspace=workspace, created_by=user, title='Second')
        sessions = list(AgentSession.objects.all())
        assert sessions[0].id == s2.id  # newest first


class TestAgentMessage:
    def test_create(self, workspace, user):
        session = AgentSession.objects.create(workspace=workspace, created_by=user)
        msg = AgentMessage.objects.create(
            session=session, role=MessageRole.AGENT, content='Hello',
            agent_type='orchestrator',
        )
        assert '[agent]' in str(msg).lower()

    def test_cascade_delete(self, workspace, user):
        session = AgentSession.objects.create(workspace=workspace, created_by=user)
        AgentMessage.objects.create(session=session, role=MessageRole.USER, content='Test')
        session.delete()
        assert AgentMessage.objects.count() == 0


class TestAgentActionLog:
    def test_create(self, workspace, user):
        session = AgentSession.objects.create(workspace=workspace, created_by=user)
        log = AgentActionLog.objects.create(
            session=session, workspace=workspace, user=user,
            agent_type='research', action='trigger_deep_research',
        )
        assert log.status == ActionStatus.STARTED
        assert 'research.trigger_deep_research' in str(log)


class TestToolPermission:
    def test_unique_constraint(self, workspace, user):
        ToolPermission.objects.create(
            workspace=workspace, user=user, tool_name='create_niche',
            permission_level=PermissionLevel.NOTIFY,
        )
        with pytest.raises(IntegrityError):
            ToolPermission.objects.create(
                workspace=workspace, user=user, tool_name='create_niche',
                permission_level=PermissionLevel.AUTO,
            )


class TestAutonomyPreset:
    def test_system_preset(self, workspace):
        preset = AutonomyPreset.objects.create(
            workspace=workspace, name='Supervised', is_system=True,
            permissions={'create_niche': 'approve'},
        )
        assert '(system)' in str(preset)


class TestKnowledgeDoc:
    def test_embedding_text(self, workspace, user):
        doc = KnowledgeDoc.objects.create(
            workspace=workspace, created_by=user,
            title='My Preferences', content='Always use humor slogans.',
        )
        assert 'My Preferences' in doc.get_embedding_text()
        assert 'humor slogans' in doc.get_embedding_text()


class TestWorkflowTemplate:
    def test_unique_key_per_workspace(self, workspace):
        WorkflowTemplate.objects.create(
            workspace=workspace, name='Full Pipeline',
            key='full_pipeline', is_system=True, steps=[],
        )
        with pytest.raises(IntegrityError):
            WorkflowTemplate.objects.create(
                workspace=workspace, name='Full Pipeline 2',
                key='full_pipeline', is_system=False, steps=[],
            )
