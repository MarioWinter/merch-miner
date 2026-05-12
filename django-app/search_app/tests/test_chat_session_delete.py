"""PROJ-29 Phase 1F — chat session DELETE endpoint tests.

Covers:
- Single-session DELETE (owner / cross-user-404 / workspace-admin / cascade).
- Bulk-purge DELETE with ``confirm_purge=all`` guard.
- AC-Isolation-2: cross-user GET returns 0 of foreign user's sessions.
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from search_app.models import ChatMessage, ChatSession
from workspace_app.models import Membership, Workspace

User = get_user_model()


@pytest.fixture
def user_a(db):
    return User.objects.create_user(email='a@example.com', password='pw')


@pytest.fixture
def user_b(db):
    return User.objects.create_user(email='b@example.com', password='pw')


@pytest.fixture
def workspace(db, user_a, user_b):
    """Shared workspace — both users are active members. user_a is owner +
    'member' (NOT admin) so cross-user delete attempts are denied. Workspace
    admin scenario uses a dedicated fixture below.
    """
    ws = Workspace.objects.create(name='WS', slug='ws-a', owner=user_a)
    Membership.objects.create(
        workspace=ws, user=user_a, role='member', status='active',
    )
    Membership.objects.create(
        workspace=ws, user=user_b, role='member', status='active',
    )
    return ws


@pytest.fixture
def admin_workspace(db, user_a, user_b):
    """Workspace where user_b is an ADMIN — used to verify admin can delete
    user_a's sessions.
    """
    ws = Workspace.objects.create(name='Admin WS', slug='admin-ws', owner=user_a)
    Membership.objects.create(
        workspace=ws, user=user_a, role='member', status='active',
    )
    Membership.objects.create(
        workspace=ws, user=user_b, role='admin', status='active',
    )
    return ws


@pytest.fixture
def client_a(user_a):
    c = APIClient()
    c.force_authenticate(user=user_a)
    return c


@pytest.fixture
def client_b(user_b):
    c = APIClient()
    c.force_authenticate(user=user_b)
    return c


def _hdr(ws):
    return {'HTTP_X_WORKSPACE_ID': str(ws.id)}


@pytest.mark.django_db
class TestChatSessionSingleDelete:
    def test_owner_deletes_own_session_returns_204(
        self, client_a, workspace, user_a,
    ):
        session = ChatSession.objects.create(
            workspace=workspace, created_by=user_a, title='Mine',
        )
        resp = client_a.delete(
            f'/api/chat/sessions/{session.id}/', **_hdr(workspace),
        )
        assert resp.status_code == 204
        # Second GET on deleted session -> 404.
        resp2 = client_a.get(
            f'/api/chat/sessions/{session.id}/', **_hdr(workspace),
        )
        assert resp2.status_code == 404

    def test_cascade_deletes_chat_messages(
        self, client_a, workspace, user_a,
    ):
        session = ChatSession.objects.create(
            workspace=workspace, created_by=user_a, title='With messages',
        )
        ChatMessage.objects.create(
            session=session, role='user', content='hi',
        )
        ChatMessage.objects.create(
            session=session, role='assistant', content='hello',
        )
        assert ChatMessage.objects.filter(session=session).count() == 2

        resp = client_a.delete(
            f'/api/chat/sessions/{session.id}/', **_hdr(workspace),
        )
        assert resp.status_code == 204
        # FK on_delete=CASCADE handles message cleanup at the ORM level.
        assert ChatMessage.objects.filter(session_id=session.id).count() == 0

    def test_cross_user_delete_returns_404_not_403(
        self, client_b, workspace, user_a,
    ):
        """AC-Isolation-2: foreign-user delete must NOT leak existence.

        user_b is a workspace member but NOT the session owner and NOT a
        workspace admin -> 404 (NOT 403).
        """
        session = ChatSession.objects.create(
            workspace=workspace, created_by=user_a, title="A's session",
        )
        resp = client_b.delete(
            f'/api/chat/sessions/{session.id}/', **_hdr(workspace),
        )
        assert resp.status_code == 404
        # Session must still exist (untouched).
        assert ChatSession.objects.filter(pk=session.id).exists()

    def test_workspace_admin_can_delete_any_users_session(
        self, client_b, admin_workspace, user_a,
    ):
        """Workspace admin (user_b in admin_workspace) can delete user_a's
        session within that workspace -> 204.
        """
        session = ChatSession.objects.create(
            workspace=admin_workspace,
            created_by=user_a,
            title="A's session",
        )
        resp = client_b.delete(
            f'/api/chat/sessions/{session.id}/', **_hdr(admin_workspace),
        )
        assert resp.status_code == 204
        assert not ChatSession.objects.filter(pk=session.id).exists()

    def test_nonexistent_session_returns_404(self, client_a, workspace):
        bogus_id = '00000000-0000-0000-0000-000000000000'
        resp = client_a.delete(
            f'/api/chat/sessions/{bogus_id}/', **_hdr(workspace),
        )
        assert resp.status_code == 404


@pytest.mark.django_db
class TestChatSessionBulkPurge:
    def test_missing_confirm_purge_returns_400(self, client_a, workspace):
        resp = client_a.delete(
            '/api/chat/sessions/', format='json', **_hdr(workspace),
        )
        assert resp.status_code == 400

    def test_wrong_confirm_purge_returns_400(self, client_a, workspace, user_a):
        ChatSession.objects.create(
            workspace=workspace, created_by=user_a, title='Mine',
        )
        resp = client_a.delete(
            '/api/chat/sessions/',
            {'confirm_purge': 'wrong'},
            format='json',
            **_hdr(workspace),
        )
        assert resp.status_code == 400
        # Session must remain untouched.
        assert ChatSession.objects.filter(created_by=user_a).count() == 1

    def test_correct_confirm_purge_deletes_all_own_sessions(
        self, client_a, workspace, user_a,
    ):
        for i in range(3):
            ChatSession.objects.create(
                workspace=workspace, created_by=user_a, title=f'Mine {i}',
            )
        resp = client_a.delete(
            '/api/chat/sessions/',
            {'confirm_purge': 'all'},
            format='json',
            **_hdr(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['deleted_count'] == 3
        assert ChatSession.objects.filter(created_by=user_a).count() == 0

    def test_bulk_purge_isolates_other_users_sessions(
        self, client_a, client_b, workspace, user_a, user_b,
    ):
        """Bulk-purge by user_a must NOT touch user_b's sessions in the same
        workspace.
        """
        ChatSession.objects.create(
            workspace=workspace, created_by=user_a, title="A's 1",
        )
        ChatSession.objects.create(
            workspace=workspace, created_by=user_a, title="A's 2",
        )
        b_session = ChatSession.objects.create(
            workspace=workspace, created_by=user_b, title="B's 1",
        )

        resp = client_a.delete(
            '/api/chat/sessions/',
            {'confirm_purge': 'all'},
            format='json',
            **_hdr(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['deleted_count'] == 2

        # user_b still sees their own session via GET.
        list_resp = client_b.get('/api/chat/sessions/', **_hdr(workspace))
        assert list_resp.status_code == 200
        assert list_resp.data['count'] == 1
        assert list_resp.data['results'][0]['id'] == str(b_session.id)


@pytest.mark.django_db
class TestChatSessionListIsolation:
    def test_AC_Isolation_2_cross_user_get_sees_no_foreign_sessions(
        self, client_b, workspace, user_a,
    ):
        """AC-Isolation-2: user_a creates 2 sessions; user_b lists -> 0 of
        A's sessions visible (only own + shared).
        """
        ChatSession.objects.create(
            workspace=workspace, created_by=user_a, title="A's 1",
        )
        ChatSession.objects.create(
            workspace=workspace, created_by=user_a, title="A's 2",
        )
        resp = client_b.get('/api/chat/sessions/', **_hdr(workspace))
        assert resp.status_code == 200
        assert resp.data['count'] == 0
