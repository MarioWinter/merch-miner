import pytest
from django.contrib.auth import get_user_model

from search_app.api.serializers import ChatMessageSerializer
from search_app.models import (
    ChatMessage,
    ChatSession,
    SearchUsageLog,
    WebSearchResult,
)
from workspace_app.models import Membership, Workspace

User = get_user_model()

try:
    from agent_app.models import AgentSession, SessionStatus
    AGENT_APP_AVAILABLE = True
except ImportError:
    AGENT_APP_AVAILABLE = False


@pytest.fixture
def user(db):
    return User.objects.create_user(email='test@example.com', password='testpass123')


@pytest.fixture
def workspace(db, user):
    ws = Workspace.objects.create(name='Test WS', slug='test-ws', owner=user)
    Membership.objects.create(
        workspace=ws, user=user, role='admin', status='active',
    )
    return ws


@pytest.mark.django_db
class TestChatSession:
    def test_create_session(self, workspace, user):
        session = ChatSession.objects.create(
            workspace=workspace, created_by=user, title='Test Session',
        )
        assert str(session) == 'Test Session'
        assert session.is_shared is False
        assert session.niche_context is None

    def test_ordering(self, workspace, user):
        ChatSession.objects.create(workspace=workspace, created_by=user, title='First')
        s2 = ChatSession.objects.create(workspace=workspace, created_by=user, title='Second')
        # s2 created later, should appear first (ordered by -updated_at)
        sessions = list(ChatSession.objects.filter(workspace=workspace))
        assert sessions[0] == s2


@pytest.mark.django_db
class TestChatMessage:
    def test_create_message(self, workspace, user):
        session = ChatSession.objects.create(
            workspace=workspace, created_by=user,
        )
        msg = ChatMessage.objects.create(
            session=session,
            role=ChatMessage.Role.USER,
            content='Test question',
            message_type=ChatMessage.MessageType.SEARCH_QUERY,
        )
        assert msg.role == 'user'
        assert msg.sources == []

    def test_get_embedding_text(self, workspace, user):
        session = ChatSession.objects.create(
            workspace=workspace, created_by=user,
        )
        msg = ChatMessage.objects.create(
            session=session,
            role=ChatMessage.Role.ASSISTANT,
            content='Answer text',
            sources=[
                {'title': 'Source 1', 'url': 'https://example.com', 'snippet': 'Some snippet'},
            ],
        )
        text = msg.get_embedding_text()
        assert 'Answer text' in text
        assert 'Source 1' in text
        assert 'Some snippet' in text


@pytest.mark.django_db
class TestChatMessageWorkflowCard:
    """P1 tests for workflow_card / workflow_trigger message types + agent_session FK."""

    def test_workflow_trigger_message_type_valid(self, workspace, user):
        session = ChatSession.objects.create(workspace=workspace, created_by=user)
        msg = ChatMessage.objects.create(
            session=session,
            role=ChatMessage.Role.ASSISTANT,
            content='Workflow triggered',
            message_type=ChatMessage.MessageType.WORKFLOW_TRIGGER,
        )
        assert msg.message_type == 'workflow_trigger'
        assert msg.pk is not None

    def test_workflow_card_message_type_valid(self, workspace, user):
        session = ChatSession.objects.create(workspace=workspace, created_by=user)
        msg = ChatMessage.objects.create(
            session=session,
            role=ChatMessage.Role.ASSISTANT,
            content='Workflow card',
            message_type=ChatMessage.MessageType.WORKFLOW_CARD,
        )
        assert msg.message_type == 'workflow_card'
        assert msg.pk is not None

    def test_agent_message_type_no_longer_in_choices(self):
        """`agent_message` was removed from MessageType choices."""
        choice_values = [c[0] for c in ChatMessage.MessageType.choices]
        assert 'agent_message' not in choice_values
        # Verify expected types remain
        assert 'workflow_trigger' in choice_values
        assert 'workflow_card' in choice_values

    def test_agent_session_fk_nullable(self, workspace, user):
        """ChatMessage without agent_session is valid."""
        session = ChatSession.objects.create(workspace=workspace, created_by=user)
        msg = ChatMessage.objects.create(
            session=session,
            role=ChatMessage.Role.USER,
            content='Plain message',
        )
        assert msg.agent_session is None
        assert msg.agent_session_id is None

    @pytest.mark.skipif(
        not AGENT_APP_AVAILABLE, reason='agent_app not installed'
    )
    def test_agent_session_fk_set_null_on_delete(self, workspace, user):
        """AgentSession deletion sets ChatMessage.agent_session to None (SET_NULL)."""
        agent_sess = AgentSession.objects.create(
            workspace=workspace,
            created_by=user,
            title='Test agent session',
            status=SessionStatus.IDLE,
        )
        session = ChatSession.objects.create(workspace=workspace, created_by=user)
        msg = ChatMessage.objects.create(
            session=session,
            role=ChatMessage.Role.ASSISTANT,
            content='Workflow card with agent',
            message_type=ChatMessage.MessageType.WORKFLOW_CARD,
            agent_session=agent_sess,
        )
        assert msg.agent_session_id == agent_sess.id

        agent_sess.delete()
        msg.refresh_from_db()
        assert msg.agent_session is None
        assert msg.agent_session_id is None
        # Message itself must still exist (NOT cascade)
        assert ChatMessage.objects.filter(pk=msg.pk).exists()

    @pytest.mark.skipif(
        not AGENT_APP_AVAILABLE, reason='agent_app not installed'
    )
    def test_workflow_card_message_with_agent_session(self, workspace, user):
        agent_sess = AgentSession.objects.create(
            workspace=workspace,
            created_by=user,
            title='Workflow',
            status=SessionStatus.RUNNING,
            current_step='research',
            total_steps=5,
            completed_steps=1,
        )
        session = ChatSession.objects.create(workspace=workspace, created_by=user)
        msg = ChatMessage.objects.create(
            session=session,
            role=ChatMessage.Role.ASSISTANT,
            content='Started',
            message_type=ChatMessage.MessageType.WORKFLOW_CARD,
            agent_session=agent_sess,
        )
        msg.refresh_from_db()
        assert msg.message_type == 'workflow_card'
        assert msg.agent_session_id == agent_sess.id
        assert msg.agent_session.current_step == 'research'

    @pytest.mark.skipif(
        not AGENT_APP_AVAILABLE, reason='agent_app not installed'
    )
    def test_chatmessage_serializer_includes_agent_session_nested(
        self, workspace, user,
    ):
        agent_sess = AgentSession.objects.create(
            workspace=workspace,
            created_by=user,
            title='Workflow',
            status=SessionStatus.RUNNING,
            current_step='research',
            total_steps=5,
            completed_steps=2,
        )
        session = ChatSession.objects.create(workspace=workspace, created_by=user)
        msg = ChatMessage.objects.create(
            session=session,
            role=ChatMessage.Role.ASSISTANT,
            content='Started',
            message_type=ChatMessage.MessageType.WORKFLOW_CARD,
            agent_session=agent_sess,
        )
        data = ChatMessageSerializer(msg).data
        assert data['message_type'] == 'workflow_card'
        assert data['agent_session'] is not None
        assert data['agent_session']['id'] == str(agent_sess.id)
        assert data['agent_session']['status'] == 'running'
        assert data['agent_session']['current_step'] == 'research'
        assert data['agent_session']['completed_steps'] == 2
        assert data['agent_session']['total_steps'] == 5

    def test_chatmessage_serializer_no_agent_session_when_null(
        self, workspace, user,
    ):
        session = ChatSession.objects.create(workspace=workspace, created_by=user)
        msg = ChatMessage.objects.create(
            session=session,
            role=ChatMessage.Role.USER,
            content='Hello',
            message_type=ChatMessage.MessageType.SEARCH_QUERY,
        )
        data = ChatMessageSerializer(msg).data
        assert 'agent_session' in data
        assert data['agent_session'] is None


@pytest.mark.django_db
class TestWebSearchResult:
    def test_create_result(self, workspace):
        result = WebSearchResult.objects.create(
            workspace=workspace,
            url='https://example.com',
            title='Test Page',
        )
        assert result.crawl_status == 'pending'
        assert result.content_type == 'snippet'

    def test_get_embedding_text(self, workspace):
        result = WebSearchResult.objects.create(
            workspace=workspace,
            url='https://example.com',
            title='Page Title',
            content='Full page content here',
        )
        text = result.get_embedding_text()
        assert 'Page Title' in text
        assert 'Full page content here' in text


@pytest.mark.django_db
class TestSearchUsageLog:
    def test_create_log(self, workspace, user):
        log = SearchUsageLog.objects.create(
            workspace=workspace,
            user=user,
            action=SearchUsageLog.Action.SEARCH,
            query='test query',
            model_used='gpt-4.1-mini',
        )
        assert log.action == 'search'
        assert log.tokens_used is None
