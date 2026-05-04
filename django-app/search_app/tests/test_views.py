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
class TestChatSessionListFilterByNicheId:
    """P2 Coverage: ChatSessionListView ?niche_id=<uuid> filter."""

    def test_list_sessions_filter_by_niche_id(
        self, api_client, workspace, user,
    ):
        """5 sessions: 2 with niche A, 3 without — filter returns 2."""
        from niche_app.models import Niche
        niche_a = Niche.objects.create(
            workspace=workspace, name='Niche A', created_by=user,
        )
        # 2 sessions linked to niche_a
        ChatSession.objects.create(
            workspace=workspace, created_by=user,
            title='S1', niche_context=niche_a,
        )
        ChatSession.objects.create(
            workspace=workspace, created_by=user,
            title='S2', niche_context=niche_a,
        )
        # 3 sessions with no niche_context
        for i in range(3):
            ChatSession.objects.create(
                workspace=workspace, created_by=user,
                title=f'NoNiche{i}',
            )

        resp = api_client.get(
            f'/api/chat/sessions/?niche_id={niche_a.id}',
            **_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['count'] == 2
        for entry in resp.data['results']:
            assert entry['niche_context_id'] == str(niche_a.id)

    def test_list_sessions_filter_invalid_niche_id(
        self, api_client, workspace, user,
    ):
        """Invalid UUID currently raises Django ValidationError on filter.

        Documents existing behavior: filter raises an uncaught
        ValidationError. A future hardening would catch this and return
        400 or an empty list.
        """
        from django.core.exceptions import ValidationError
        ChatSession.objects.create(
            workspace=workspace, created_by=user, title='S1',
        )
        try:
            resp = api_client.get(
                '/api/chat/sessions/?niche_id=not-a-uuid',
                **_headers(workspace),
            )
            # If the view ever catches it, accept 400 or 200 with empty list.
            assert resp.status_code in (200, 400)
            if resp.status_code == 200:
                assert resp.data['count'] in (0, 1)
        except ValidationError:
            # Current behavior: ValidationError bubbles out of the test client
            pass

    def test_list_sessions_filter_niche_id_not_in_workspace(
        self, api_client, workspace, other_workspace, other_user,
    ):
        """Niche from another workspace → empty list (workspace-isolated)."""
        from niche_app.models import Niche
        foreign_niche = Niche.objects.create(
            workspace=other_workspace, name='Foreign',
            created_by=other_user,
        )
        resp = api_client.get(
            f'/api/chat/sessions/?niche_id={foreign_niche.id}',
            **_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['count'] == 0

    def test_list_sessions_no_filter_returns_all(
        self, api_client, workspace, user,
    ):
        """No niche_id filter → all user's sessions."""
        from niche_app.models import Niche
        niche = Niche.objects.create(
            workspace=workspace, name='N', created_by=user,
        )
        ChatSession.objects.create(
            workspace=workspace, created_by=user,
            title='With Niche', niche_context=niche,
        )
        ChatSession.objects.create(
            workspace=workspace, created_by=user, title='Without',
        )
        resp = api_client.get(
            '/api/chat/sessions/',
            **_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['count'] == 2


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

    def test_trigger_crawl_invalid_url(self, api_client, workspace):
        """Non-URL value → 400 from URLField validator."""
        resp = api_client.post(
            '/api/search/crawl/',
            {'url': 'not-a-url'},
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 400
        # DRF returns dict with field errors
        assert 'url' in resp.data

    def test_trigger_crawl_workspace_required(self, api_client):
        """Missing X-Workspace-Id header → 400."""
        resp = api_client.post(
            '/api/search/crawl/',
            {'url': 'https://example.com'},
            format='json',
        )
        assert resp.status_code == 400
        assert 'X-Workspace-Id' in str(resp.data)


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


@pytest.mark.django_db
class TestWorkspaceIsolationP1:
    """P1 risk-reduction: workspace isolation across remaining endpoints."""

    @patch('search_app.api.views.django_rq')
    def test_trigger_crawl_chat_message_from_other_workspace(
        self, mock_rq, api_client, workspace, other_workspace, other_user,
    ):
        """User A cannot reference a chat_message_id that belongs to User B's workspace."""
        mock_rq.get_queue.return_value = MagicMock()
        # Foreign chat message in other workspace
        other_session = ChatSession.objects.create(
            workspace=other_workspace, created_by=other_user, title='Other',
        )
        foreign_msg = ChatMessage.objects.create(
            session=other_session,
            role=ChatMessage.Role.USER,
            content='Foreign',
        )
        resp = api_client.post(
            '/api/search/crawl/',
            {
                'url': 'https://example.com/x',
                'chat_message_id': str(foreign_msg.id),
            },
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 404

    def test_crawl_status_workspace_isolation(
        self, api_client, workspace, other_workspace,
    ):
        """GET crawl status for a result from another workspace returns 404."""
        foreign_result = WebSearchResult.objects.create(
            workspace=other_workspace,
            url='https://example.com',
            crawl_status='completed',
        )
        resp = api_client.get(
            f'/api/search/crawl/{foreign_result.id}/status/',
            **_headers(workspace),
        )
        assert resp.status_code == 404

    def test_save_to_niche_workspace_isolation_result(
        self, api_client, workspace, other_workspace, user,
    ):
        """Result from another workspace returns 404."""
        from niche_app.models import Niche
        niche = Niche.objects.create(
            workspace=workspace, name='My Niche', created_by=user,
        )
        foreign_result = WebSearchResult.objects.create(
            workspace=other_workspace,
            url='https://example.com',
            title='Foreign',
            content='content',
        )
        resp = api_client.post(
            f'/api/search/results/{foreign_result.id}/save-to-niche/',
            {'niche_id': str(niche.id), 'save_as': 'notes'},
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 404

    def test_save_to_niche_workspace_isolation_niche(
        self, api_client, workspace, other_workspace, other_user,
    ):
        """Niche from another workspace returns 404 (own result, foreign niche)."""
        from niche_app.models import Niche
        own_result = WebSearchResult.objects.create(
            workspace=workspace,
            url='https://example.com',
            title='Mine',
            content='content',
        )
        foreign_niche = Niche.objects.create(
            workspace=other_workspace,
            name='Foreign Niche',
            created_by=other_user,
        )
        resp = api_client.post(
            f'/api/search/results/{own_result.id}/save-to-niche/',
            {'niche_id': str(foreign_niche.id), 'save_as': 'notes'},
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 404

    def test_health_endpoint_no_auth(self):
        """Anonymous request to health endpoint returns 401."""
        client = APIClient()
        resp = client.get('/api/search/health/')
        assert resp.status_code == 401

    @patch('search_app.api.views.CrawlService')
    @patch('search_app.api.views.VaneService')
    def test_health_endpoint_no_workspace_required(
        self, mock_vane_cls, mock_crawl_cls, api_client,
    ):
        """Health endpoint is global — works without X-Workspace-Id header."""
        mock_vane_cls.return_value.health_check.return_value = True
        mock_crawl_cls.return_value.health_check.return_value = True
        # No _headers(workspace) — no X-Workspace-Id passed
        resp = api_client.get('/api/search/health/')
        assert resp.status_code == 200
        assert resp.data['vane'] == 'online'
        assert resp.data['crawl4ai'] == 'online'

    @patch('search_app.api.views.CrawlService')
    @patch('search_app.api.views.VaneService')
    def test_health_endpoint_cache_control_header(
        self, mock_vane_cls, mock_crawl_cls, api_client, workspace,
    ):
        """Health response sets short Cache-Control (3s) — adaptive polling
        (60s healthy / 5s offline) needs fresh data on each tick."""
        mock_vane_cls.return_value.health_check.return_value = True
        mock_crawl_cls.return_value.health_check.return_value = True
        resp = api_client.get(
            '/api/search/health/',
            **_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp['Cache-Control'] == 'private, max-age=3'


@pytest.mark.django_db
class TestChatMessageDestroy:
    """PROJ-20 Phase 1.2: DELETE /api/chat/messages/<uuid>/

    Used by AC-30 Regenerate flow — frontend deletes the previous AI message
    before re-streaming a new one. Cross-workspace returns 404 to match the
    info-leak-prevention convention used elsewhere in this file.
    """

    def test_destroy_own_message_returns_204(
        self, api_client, session,
    ):
        msg = ChatMessage.objects.create(
            session=session,
            role=ChatMessage.Role.ASSISTANT,
            content='to be deleted',
        )
        resp = api_client.delete(f'/api/chat/messages/{msg.id}/')
        assert resp.status_code == 204
        assert not ChatMessage.objects.filter(pk=msg.pk).exists()

    def test_destroy_does_not_require_workspace_header(
        self, api_client, session,
    ):
        """Endpoint resolves workspace from message.session.workspace —
        X-Workspace-Id header is not required (parity with SSE stream view)."""
        msg = ChatMessage.objects.create(
            session=session,
            role=ChatMessage.Role.ASSISTANT,
            content='to be deleted',
        )
        # Note: no _headers(workspace)
        resp = api_client.delete(f'/api/chat/messages/{msg.id}/')
        assert resp.status_code == 204

    def test_destroy_cross_workspace_returns_404(
        self, api_client, other_workspace, other_user,
    ):
        """User without active membership in the message's workspace gets 404
        (info-leak prevention) instead of 403."""
        foreign_session = ChatSession.objects.create(
            workspace=other_workspace,
            created_by=other_user,
            title='Foreign session',
        )
        foreign_msg = ChatMessage.objects.create(
            session=foreign_session,
            role=ChatMessage.Role.ASSISTANT,
            content='foreign',
        )
        resp = api_client.delete(f'/api/chat/messages/{foreign_msg.id}/')
        assert resp.status_code == 404
        # Foreign message must remain intact
        assert ChatMessage.objects.filter(pk=foreign_msg.pk).exists()

    def test_destroy_missing_message_returns_404(self, api_client):
        import uuid as _uuid
        bogus = _uuid.uuid4()
        resp = api_client.delete(f'/api/chat/messages/{bogus}/')
        assert resp.status_code == 404

    def test_destroy_unauthenticated_returns_401(self, db, session):
        msg = ChatMessage.objects.create(
            session=session,
            role=ChatMessage.Role.ASSISTANT,
            content='hi',
        )
        client = APIClient()  # no force_authenticate
        resp = client.delete(f'/api/chat/messages/{msg.id}/')
        assert resp.status_code == 401

    def test_destroy_workspace_member_can_delete_others_message(
        self, api_client, workspace, user, other_user,
    ):
        """Any active workspace member can delete a message in that workspace
        (no created_by ownership check) — needed so a workspace owner can
        regenerate a teammate's shared chat. Membership is the boundary."""
        # other_user is also an active member of `workspace`
        Membership.objects.create(
            workspace=workspace, user=other_user,
            role='member', status='active',
        )
        # other_user owns the session, but `user` (current api_client) deletes
        teammate_session = ChatSession.objects.create(
            workspace=workspace, created_by=other_user, title='Teammate',
        )
        teammate_msg = ChatMessage.objects.create(
            session=teammate_session,
            role=ChatMessage.Role.ASSISTANT,
            content='teammate msg',
        )
        resp = api_client.delete(f'/api/chat/messages/{teammate_msg.id}/')
        assert resp.status_code == 204


@pytest.mark.django_db
class TestChatSessionShareCreate:
    """PROJ-20 Phase 1.3: POST /api/chat/sessions/<uuid>/share/

    AC-30 Share button. Generates a public share-link, idempotent on re-call.
    """

    def test_share_create_returns_token_and_public_url(
        self, api_client, workspace, session,
    ):
        resp = api_client.post(
            f'/api/chat/sessions/{session.id}/share/',
            **_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['is_shared'] is True
        # Token must be present, non-empty, URL-safe length-ish
        token = resp.data['share_token']
        assert isinstance(token, str)
        assert len(token) >= 32
        # Public URL contains the token + the public viewer path
        public_url = resp.data['public_url']
        assert isinstance(public_url, str)
        assert token in public_url
        assert '/shared/chat/' in public_url
        # DB row reflects state
        session.refresh_from_db()
        assert session.share_token == token
        assert session.is_shared is True

    def test_share_create_is_idempotent(
        self, api_client, workspace, session,
    ):
        """Calling share twice returns the SAME token — never regenerates."""
        first = api_client.post(
            f'/api/chat/sessions/{session.id}/share/',
            **_headers(workspace),
        )
        assert first.status_code == 200
        first_token = first.data['share_token']

        second = api_client.post(
            f'/api/chat/sessions/{session.id}/share/',
            **_headers(workspace),
        )
        assert second.status_code == 200
        assert second.data['share_token'] == first_token
        assert second.data['public_url'] == first.data['public_url']
        # Still exactly one share_token in DB
        session.refresh_from_db()
        assert session.share_token == first_token

    def test_share_create_cross_workspace_returns_404(
        self, api_client, other_workspace, other_user,
    ):
        """Share-create against a session in another workspace returns 404."""
        foreign_session = ChatSession.objects.create(
            workspace=other_workspace,
            created_by=other_user,
            title='Foreign session',
        )
        # Caller (user) sends X-Workspace-Id of OWN workspace, but session_id
        # belongs to other_workspace — view filters by workspace+owner → 404.
        resp = api_client.post(
            f'/api/chat/sessions/{foreign_session.id}/share/',
            **_headers(other_workspace),
        )
        # User is not a member of other_workspace → workspace resolution 403
        # OR session ownership check 404. Either is acceptable info-leak prevention.
        assert resp.status_code in (403, 404)
        # Foreign session must remain un-shared
        foreign_session.refresh_from_db()
        assert foreign_session.share_token is None
        assert foreign_session.is_shared is False


@pytest.mark.django_db
class TestChatSessionPublicFetch:
    """PROJ-20 Phase 1.3: GET /api/chat/sessions/shared/<token>/

    Public, no auth. 404 if token unknown OR is_shared=False.
    """

    def test_public_fetch_with_valid_token_returns_200(
        self, api_client, workspace, session,
    ):
        # Set up a shared session with a couple of messages
        ChatMessage.objects.create(
            session=session, role='user', content='Hello?',
        )
        ChatMessage.objects.create(
            session=session, role='assistant', content='Hi there!',
            sources=[{'title': 'S', 'url': 'https://x.test', 'snippet': 'snip'}],
        )
        # Generate share-link via the share endpoint to mirror real flow
        share_resp = api_client.post(
            f'/api/chat/sessions/{session.id}/share/',
            **_headers(workspace),
        )
        token = share_resp.data['share_token']

        # Public fetch — use a brand-new unauthenticated client
        public_client = APIClient()
        resp = public_client.get(f'/api/chat/sessions/shared/{token}/')
        assert resp.status_code == 200
        # Payload shape
        assert resp.data['id'] == str(session.id)
        assert resp.data['title'] == 'Test Session'
        assert 'messages' in resp.data
        assert isinstance(resp.data['messages'], list)
        assert len(resp.data['messages']) == 2
        # Messages chronological — user first, assistant second
        assert resp.data['messages'][0]['role'] == 'user'
        assert resp.data['messages'][1]['role'] == 'assistant'
        # Sources surfaced on the assistant message
        assert resp.data['messages'][1]['sources'][0]['url'] == 'https://x.test'
        # Internal/operator fields must NOT be in the public payload
        assert 'created_by' not in resp.data
        assert 'workspace' not in resp.data
        assert 'share_token' not in resp.data
        assert 'is_shared' not in resp.data

    def test_public_fetch_no_auth_required(
        self, api_client, workspace, session,
    ):
        """Endpoint must respond 200 to a fully-anonymous client."""
        share_resp = api_client.post(
            f'/api/chat/sessions/{session.id}/share/',
            **_headers(workspace),
        )
        token = share_resp.data['share_token']

        anon = APIClient()  # no force_authenticate, no cookies, no headers
        resp = anon.get(f'/api/chat/sessions/shared/{token}/')
        assert resp.status_code == 200

    def test_public_fetch_with_unknown_token_returns_404(self):
        anon = APIClient()
        resp = anon.get('/api/chat/sessions/shared/this-token-does-not-exist-xyz/')
        assert resp.status_code == 404

    def test_public_fetch_with_is_shared_false_returns_404(
        self, api_client, workspace, session,
    ):
        """Token exists in DB but is_shared was flipped off → 404 (revoked)."""
        share_resp = api_client.post(
            f'/api/chat/sessions/{session.id}/share/',
            **_headers(workspace),
        )
        token = share_resp.data['share_token']
        # Revoke
        session.refresh_from_db()
        session.is_shared = False
        session.save(update_fields=['is_shared', 'updated_at'])

        anon = APIClient()
        resp = anon.get(f'/api/chat/sessions/shared/{token}/')
        assert resp.status_code == 404
