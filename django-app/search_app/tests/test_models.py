import pytest
from django.contrib.auth import get_user_model

from search_app.models import (
    ChatMessage,
    ChatSession,
    ChatTag,
    SearchUsageLog,
    WebSearchResult,
)
from workspace_app.models import Membership, Workspace

User = get_user_model()


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
class TestChatTag:
    def test_create_tag(self, workspace, user):
        tag = ChatTag.objects.create(
            workspace=workspace,
            name='Research',
            color='#3B82F6',
            created_by=user,
        )
        assert tag.name == 'Research'
        assert tag.color == '#3B82F6'
        assert not tag.is_system

    def test_unique_together(self, workspace, user):
        ChatTag.objects.create(
            workspace=workspace, name='Test', created_by=user,
        )
        with pytest.raises(Exception):
            ChatTag.objects.create(
                workspace=workspace, name='Test', created_by=user,
            )


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
