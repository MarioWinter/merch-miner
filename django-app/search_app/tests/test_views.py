from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from search_app.models import (
    ChatMessage,
    ChatSession,
    WebSearchResult,
)
from workspace_app.models import Membership, Workspace

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(email='test@example.com', password='testpass123')


@pytest.fixture
def other_user(db):
    return User.objects.create_user(email='other@example.com', password='testpass123')


@pytest.fixture
def workspace(db, user):
    ws = Workspace.objects.create(name='Test WS', slug='test-ws', owner=user)
    Membership.objects.create(
        workspace=ws, user=user, role='admin', status='active',
    )
    return ws


@pytest.fixture
def other_workspace(db, other_user):
    ws = Workspace.objects.create(name='Other WS', slug='other-ws', owner=other_user)
    Membership.objects.create(
        workspace=ws, user=other_user, role='admin', status='active',
    )
    return ws


@pytest.fixture
def api_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def other_api_client(other_user):
    client = APIClient()
    client.force_authenticate(user=other_user)
    return client


@pytest.fixture
def session(workspace, user):
    return ChatSession.objects.create(
        workspace=workspace, created_by=user, title='Test Session',
    )


def _headers(workspace):
    return {'HTTP_X_WORKSPACE_ID': str(workspace.id)}


@pytest.mark.django_db
class TestChatSessionListCreate:
    def test_create_session(self, api_client, workspace):
        resp = api_client.post(
            '/api/chat/sessions/',
            {'title': 'New Session'},
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 201
        assert resp.data['title'] == 'New Session'

    def test_create_session_no_workspace(self, api_client):
        resp = api_client.post(
            '/api/chat/sessions/',
            {'title': 'Test'},
            format='json',
        )
        assert resp.status_code == 400

    def test_list_own_sessions(self, api_client, workspace, session):
        resp = api_client.get(
            '/api/chat/sessions/',
            **_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['count'] == 1

    def test_list_shared_sessions(self, api_client, workspace, user, other_user):
        # Add other_user to workspace
        Membership.objects.create(
            workspace=workspace, user=other_user, role='member', status='active',
        )
        # Create shared session by other_user
        ChatSession.objects.create(
            workspace=workspace, created_by=other_user,
            title='Shared', is_shared=True,
        )
        resp = api_client.get(
            '/api/chat/sessions/?shared=true',
            **_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['count'] == 1

    def test_workspace_isolation(self, api_client, workspace, other_workspace, other_user):
        ChatSession.objects.create(
            workspace=other_workspace, created_by=other_user, title='Other WS Session',
        )
        resp = api_client.get(
            '/api/chat/sessions/',
            **_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['count'] == 0


@pytest.mark.django_db
class TestChatSessionDetail:
    def test_get_session(self, api_client, workspace, session):
        resp = api_client.get(
            f'/api/chat/sessions/{session.id}/',
            **_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['title'] == 'Test Session'

    def test_patch_title(self, api_client, workspace, session):
        resp = api_client.patch(
            f'/api/chat/sessions/{session.id}/',
            {'title': 'Updated Title'},
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['title'] == 'Updated Title'

    def test_delete_session(self, api_client, workspace, session):
        resp = api_client.delete(
            f'/api/chat/sessions/{session.id}/',
            **_headers(workspace),
        )
        assert resp.status_code == 204
        assert not ChatSession.objects.filter(pk=session.id).exists()

    def test_non_owner_cannot_update(self, other_api_client, workspace, session, other_user):
        Membership.objects.create(
            workspace=workspace, user=other_user, role='member', status='active',
        )
        resp = other_api_client.patch(
            f'/api/chat/sessions/{session.id}/',
            {'title': 'Hacked'},
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 403


@pytest.mark.django_db
class TestChatSessionMessages:
    @patch('search_app.api.views.django_rq')
    @patch('search_app.api.views.VaneService')
    def test_send_message(self, mock_vane_cls, mock_rq, api_client, workspace, session):
        mock_vane = MagicMock()
        mock_vane.search.return_value = {
            'answer': 'AI answer here',
            'sources': [{'title': 'Source', 'url': 'https://example.com', 'snippet': 'text'}],
            'model_used': 'gpt-4.1-mini',
        }
        mock_vane_cls.return_value = mock_vane
        mock_rq.get_queue.return_value = MagicMock()

        resp = api_client.post(
            f'/api/chat/sessions/{session.id}/messages/',
            {
                'content': 'camping trends',
                'search_mode': 'balanced',
                'search_sources': ['web'],
            },
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 201
        assert resp.data['assistant_message']['content'] == 'AI answer here'
        assert len(resp.data['assistant_message']['sources']) == 1

        # Title stays unchanged (already set, auto-title only fires on empty)
        session.refresh_from_db()
        assert session.title == 'Test Session'

    @patch('search_app.api.views.VaneService')
    def test_send_message_vane_error(self, mock_vane_cls, api_client, workspace, session):
        from search_app.services.vane_service import VaneServiceError
        mock_vane = MagicMock()
        mock_vane.search.side_effect = VaneServiceError("Vane down")
        mock_vane_cls.return_value = mock_vane

        resp = api_client.post(
            f'/api/chat/sessions/{session.id}/messages/',
            {'content': 'test query'},
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 502

    def test_shared_session_read_only(self, other_api_client, workspace, session, other_user):
        Membership.objects.create(
            workspace=workspace, user=other_user, role='member', status='active',
        )
        session.is_shared = True
        session.save()

        resp = other_api_client.post(
            f'/api/chat/sessions/{session.id}/messages/',
            {'content': 'test'},
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 403

    def test_load_older_messages(self, api_client, workspace, session):
        # Create 60 messages
        for i in range(60):
            ChatMessage.objects.create(
                session=session,
                role='user',
                content=f'Message {i}',
            )

        resp = api_client.get(
            f'/api/chat/sessions/{session.id}/messages/',
            **_headers(workspace),
        )
        assert resp.status_code == 200
        assert len(resp.data['messages']) == 50
        assert resp.data['has_more'] is True


@pytest.mark.django_db
class TestShareUnshare:
    def test_share(self, api_client, workspace, session):
        resp = api_client.post(
            f'/api/chat/sessions/{session.id}/share/',
            **_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['is_shared'] is True

    def test_unshare(self, api_client, workspace, session):
        session.is_shared = True
        session.save()
        resp = api_client.post(
            f'/api/chat/sessions/{session.id}/unshare/',
            **_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['is_shared'] is False

    def test_non_owner_cannot_share(self, other_api_client, workspace, session, other_user):
        Membership.objects.create(
            workspace=workspace, user=other_user, role='member', status='active',
        )
        resp = other_api_client.post(
            f'/api/chat/sessions/{session.id}/share/',
            **_headers(workspace),
        )
        assert resp.status_code == 404


@pytest.mark.django_db
class TestTriggerCrawl:
    @patch('search_app.api.views.django_rq')
    def test_trigger_crawl(self, mock_rq, api_client, workspace):
        mock_rq.get_queue.return_value = MagicMock()

        resp = api_client.post(
            '/api/search/crawl/',
            {'url': 'https://example.com/article'},
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 201
        assert resp.data['crawl_status'] == 'pending'
        assert resp.data['url'] == 'https://example.com/article'

    def test_crawl_status(self, api_client, workspace):
        result = WebSearchResult.objects.create(
            workspace=workspace,
            url='https://example.com',
            crawl_status='running',
        )
        resp = api_client.get(
            f'/api/search/crawl/{result.id}/status/',
            **_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['crawl_status'] == 'running'


@pytest.mark.django_db
class TestSaveToNiche:
    def test_save_as_notes(self, api_client, workspace, user):
        from niche_app.models import Niche
        niche = Niche.objects.create(
            workspace=workspace, name='Camping Dad',
            created_by=user,
        )
        result = WebSearchResult.objects.create(
            workspace=workspace,
            url='https://example.com',
            title='Camping Guide',
            content='Full content here',
        )

        resp = api_client.post(
            f'/api/search/results/{result.id}/save-to-niche/',
            {'niche_id': str(niche.id), 'save_as': 'notes'},
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['saved'] is True
        niche.refresh_from_db()
        assert 'Camping Guide' in niche.notes


@pytest.mark.django_db
class TestSearchHealth:
    @patch('search_app.api.views.CrawlService')
    @patch('search_app.api.views.VaneService')
    def test_health_both_online(self, mock_vane_cls, mock_crawl_cls, api_client, workspace):
        mock_vane_cls.return_value.health_check.return_value = True
        mock_crawl_cls.return_value.health_check.return_value = True

        resp = api_client.get(
            '/api/search/health/',
            **_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['vane'] == 'online'
        assert resp.data['crawl4ai'] == 'online'

    @patch('search_app.api.views.CrawlService')
    @patch('search_app.api.views.VaneService')
    def test_health_partial(self, mock_vane_cls, mock_crawl_cls, api_client, workspace):
        mock_vane_cls.return_value.health_check.return_value = True
        mock_crawl_cls.return_value.health_check.return_value = False

        resp = api_client.get(
            '/api/search/health/',
            **_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['vane'] == 'online'
        assert resp.data['crawl4ai'] == 'offline'
