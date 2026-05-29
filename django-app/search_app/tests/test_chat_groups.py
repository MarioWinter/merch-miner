"""FIX 2026-05-28 Item 7 — Chat Groups backend tests.

Covers:
- CRUD on ``ChatGroup`` (workspace-scoped, name uniqueness, rename, delete).
- Reorder endpoint atomicity (foreign-id → 400, no partial write).
- ``reorder-in-group`` updates ``(group_id, group_ordering)`` atomically.
- Group delete cascades sessions to ``group_id IS NULL`` via SET_NULL.
- ``ChatSession`` PATCH ``{group}`` move-to-group flow assigns
  ``group_ordering = max + 1`` in the destination.
- ``ChatSession.Meta.ordering`` regression: explicit ``.order_by()`` still
  wins; the default ordering doesn't yank shared/owner sessions out of the
  list endpoint's pagination contract.
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from search_app.models import ChatGroup, ChatSession
from workspace_app.models import Membership, Workspace

User = get_user_model()


@pytest.fixture
def user_a(db):
    return User.objects.create_user(email='a@example.com', password='pw')


@pytest.fixture
def user_b(db):
    return User.objects.create_user(email='b@example.com', password='pw')


@pytest.fixture
def workspace_a(db, user_a):
    ws = Workspace.objects.create(name='WS-A', slug='ws-a', owner=user_a)
    Membership.objects.create(
        workspace=ws, user=user_a,
        role=Membership.Role.MEMBER, status=Membership.Status.ACTIVE,
    )
    return ws


@pytest.fixture
def workspace_b(db, user_b):
    ws = Workspace.objects.create(name='WS-B', slug='ws-b', owner=user_b)
    Membership.objects.create(
        workspace=ws, user=user_b,
        role=Membership.Role.MEMBER, status=Membership.Status.ACTIVE,
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
class TestChatGroupCRUD:
    def test_list_returns_only_workspace_groups(
        self, client_a, workspace_a, workspace_b, user_a, user_b,
    ):
        ChatGroup.objects.create(
            workspace=workspace_a, created_by=user_a, name='A1', ordering=1,
        )
        ChatGroup.objects.create(
            workspace=workspace_a, created_by=user_a, name='A2', ordering=2,
        )
        ChatGroup.objects.create(
            workspace=workspace_b, created_by=user_b, name='B1', ordering=1,
        )

        resp = client_a.get('/api/chat/groups/', **_hdr(workspace_a))
        assert resp.status_code == 200
        assert len(resp.data) == 2
        names = {g['name'] for g in resp.data}
        assert names == {'A1', 'A2'}
        # session_count annotation present and zero (no sessions linked).
        for g in resp.data:
            assert g['session_count'] == 0

    def test_create_assigns_incremental_ordering(
        self, client_a, workspace_a,
    ):
        for i in range(3):
            resp = client_a.post(
                '/api/chat/groups/',
                {'name': f'G{i}'},
                format='json',
                **_hdr(workspace_a),
            )
            assert resp.status_code == 201, resp.data
            assert resp.data['ordering'] == i + 1
            assert resp.data['session_count'] == 0

    def test_create_sets_created_by_to_request_user(
        self, client_a, workspace_a, user_a,
    ):
        resp = client_a.post(
            '/api/chat/groups/',
            {'name': 'Mine'},
            format='json',
            **_hdr(workspace_a),
        )
        assert resp.status_code == 201
        group = ChatGroup.objects.get(pk=resp.data['id'])
        assert group.created_by_id == user_a.id

    def test_rename_persists_new_name(self, client_a, workspace_a, user_a):
        group = ChatGroup.objects.create(
            workspace=workspace_a, created_by=user_a, name='Old', ordering=1,
        )
        resp = client_a.patch(
            f'/api/chat/groups/{group.id}/',
            {'name': 'New'},
            format='json',
            **_hdr(workspace_a),
        )
        assert resp.status_code == 200
        assert resp.data['name'] == 'New'
        group.refresh_from_db()
        assert group.name == 'New'

    def test_delete_returns_204(self, client_a, workspace_a, user_a):
        group = ChatGroup.objects.create(
            workspace=workspace_a, created_by=user_a, name='G', ordering=1,
        )
        resp = client_a.delete(
            f'/api/chat/groups/{group.id}/', **_hdr(workspace_a),
        )
        assert resp.status_code == 204
        assert not ChatGroup.objects.filter(pk=group.id).exists()

    def test_cross_workspace_get_returns_404(
        self, client_a, workspace_a, workspace_b, user_b,
    ):
        group = ChatGroup.objects.create(
            workspace=workspace_b, created_by=user_b, name='Foreign',
            ordering=1,
        )
        resp = client_a.patch(
            f'/api/chat/groups/{group.id}/',
            {'name': 'Hijack'},
            format='json',
            **_hdr(workspace_a),
        )
        assert resp.status_code == 404


@pytest.mark.django_db
class TestChatGroupNameUnique:
    def test_duplicate_name_in_same_workspace_returns_400(
        self, client_a, workspace_a, user_a,
    ):
        ChatGroup.objects.create(
            workspace=workspace_a, created_by=user_a, name='Dup', ordering=1,
        )
        resp = client_a.post(
            '/api/chat/groups/',
            {'name': 'Dup'},
            format='json',
            **_hdr(workspace_a),
        )
        assert resp.status_code == 400
        assert resp.data.get('name') == ['chatgroup_duplicate_name']

    def test_duplicate_name_across_workspaces_is_allowed(
        self, client_a, client_b, workspace_a, workspace_b, user_a, user_b,
    ):
        ChatGroup.objects.create(
            workspace=workspace_a, created_by=user_a, name='Shared',
            ordering=1,
        )
        resp_b = client_b.post(
            '/api/chat/groups/',
            {'name': 'Shared'},
            format='json',
            **_hdr(workspace_b),
        )
        assert resp_b.status_code == 201

    def test_rename_to_duplicate_name_returns_400(
        self, client_a, workspace_a, user_a,
    ):
        ChatGroup.objects.create(
            workspace=workspace_a, created_by=user_a, name='Existing',
            ordering=1,
        )
        target = ChatGroup.objects.create(
            workspace=workspace_a, created_by=user_a, name='Renamable',
            ordering=2,
        )
        resp = client_a.patch(
            f'/api/chat/groups/{target.id}/',
            {'name': 'Existing'},
            format='json',
            **_hdr(workspace_a),
        )
        assert resp.status_code == 400
        assert resp.data.get('name') == ['chatgroup_duplicate_name']
        target.refresh_from_db()
        assert target.name == 'Renamable'


@pytest.mark.django_db
class TestChatGroupReorderAtomic:
    def test_reorder_sets_ordering_one_based(
        self, client_a, workspace_a, user_a,
    ):
        g1 = ChatGroup.objects.create(
            workspace=workspace_a, created_by=user_a, name='G1', ordering=1,
        )
        g2 = ChatGroup.objects.create(
            workspace=workspace_a, created_by=user_a, name='G2', ordering=2,
        )
        g3 = ChatGroup.objects.create(
            workspace=workspace_a, created_by=user_a, name='G3', ordering=3,
        )

        # Reverse the order.
        resp = client_a.post(
            '/api/chat/groups/reorder/',
            {'ordered_ids': [str(g3.id), str(g2.id), str(g1.id)]},
            format='json',
            **_hdr(workspace_a),
        )
        assert resp.status_code == 200
        g1.refresh_from_db()
        g2.refresh_from_db()
        g3.refresh_from_db()
        assert g3.ordering == 1
        assert g2.ordering == 2
        assert g1.ordering == 3

    def test_reorder_with_foreign_id_returns_400_no_partial_write(
        self, client_a, workspace_a, workspace_b, user_a, user_b,
    ):
        g1 = ChatGroup.objects.create(
            workspace=workspace_a, created_by=user_a, name='G1', ordering=1,
        )
        g2 = ChatGroup.objects.create(
            workspace=workspace_a, created_by=user_a, name='G2', ordering=2,
        )
        foreign = ChatGroup.objects.create(
            workspace=workspace_b, created_by=user_b, name='Foreign',
            ordering=1,
        )

        resp = client_a.post(
            '/api/chat/groups/reorder/',
            {'ordered_ids': [str(g2.id), str(foreign.id), str(g1.id)]},
            format='json',
            **_hdr(workspace_a),
        )
        assert resp.status_code == 400
        assert resp.data.get('ordered_ids') == ['foreign_group_in_list']

        # Pre-existing ordering MUST be untouched (atomic rollback).
        g1.refresh_from_db()
        g2.refresh_from_db()
        foreign.refresh_from_db()
        assert g1.ordering == 1
        assert g2.ordering == 2
        assert foreign.ordering == 1


@pytest.mark.django_db
class TestChatSessionReorderInGroup:
    def test_reorder_in_group_updates_group_and_ordering(
        self, client_a, workspace_a, user_a,
    ):
        group = ChatGroup.objects.create(
            workspace=workspace_a, created_by=user_a, name='Dest', ordering=1,
        )
        s1 = ChatSession.objects.create(
            workspace=workspace_a, created_by=user_a, title='S1',
        )
        s2 = ChatSession.objects.create(
            workspace=workspace_a, created_by=user_a, title='S2',
        )
        s3 = ChatSession.objects.create(
            workspace=workspace_a, created_by=user_a, title='S3',
        )

        resp = client_a.post(
            '/api/chat/sessions/reorder-in-group/',
            {
                'group_id': str(group.id),
                'ordered_ids': [str(s2.id), str(s3.id), str(s1.id)],
            },
            format='json',
            **_hdr(workspace_a),
        )
        assert resp.status_code == 200

        s1.refresh_from_db()
        s2.refresh_from_db()
        s3.refresh_from_db()
        assert s2.group_id == group.id and s2.group_ordering == 1
        assert s3.group_id == group.id and s3.group_ordering == 2
        assert s1.group_id == group.id and s1.group_ordering == 3

    def test_reorder_in_ungrouped_clears_group_id(
        self, client_a, workspace_a, user_a,
    ):
        group = ChatGroup.objects.create(
            workspace=workspace_a, created_by=user_a, name='G', ordering=1,
        )
        s1 = ChatSession.objects.create(
            workspace=workspace_a, created_by=user_a, title='S1',
            group=group, group_ordering=5,
        )
        s2 = ChatSession.objects.create(
            workspace=workspace_a, created_by=user_a, title='S2',
            group=group, group_ordering=6,
        )

        resp = client_a.post(
            '/api/chat/sessions/reorder-in-group/',
            {
                'group_id': None,
                'ordered_ids': [str(s1.id), str(s2.id)],
            },
            format='json',
            **_hdr(workspace_a),
        )
        assert resp.status_code == 200

        s1.refresh_from_db()
        s2.refresh_from_db()
        assert s1.group_id is None and s1.group_ordering == 1
        assert s2.group_id is None and s2.group_ordering == 2

    def test_foreign_session_id_rejected_no_partial_write(
        self, client_a, workspace_a, workspace_b, user_a, user_b,
    ):
        group = ChatGroup.objects.create(
            workspace=workspace_a, created_by=user_a, name='G', ordering=1,
        )
        s1 = ChatSession.objects.create(
            workspace=workspace_a, created_by=user_a, title='S1',
            group_ordering=0,
        )
        foreign = ChatSession.objects.create(
            workspace=workspace_b, created_by=user_b, title='Foreign',
            group_ordering=0,
        )

        resp = client_a.post(
            '/api/chat/sessions/reorder-in-group/',
            {
                'group_id': str(group.id),
                'ordered_ids': [str(s1.id), str(foreign.id)],
            },
            format='json',
            **_hdr(workspace_a),
        )
        assert resp.status_code == 400
        assert resp.data.get('ordered_ids') == ['foreign_session_in_list']

        s1.refresh_from_db()
        foreign.refresh_from_db()
        assert s1.group_id is None
        assert s1.group_ordering == 0
        assert foreign.group_id is None
        assert foreign.group_ordering == 0

    def test_foreign_destination_group_rejected(
        self, client_a, workspace_a, workspace_b, user_a, user_b,
    ):
        foreign_group = ChatGroup.objects.create(
            workspace=workspace_b, created_by=user_b, name='Foreign',
            ordering=1,
        )
        s1 = ChatSession.objects.create(
            workspace=workspace_a, created_by=user_a, title='S1',
        )

        resp = client_a.post(
            '/api/chat/sessions/reorder-in-group/',
            {
                'group_id': str(foreign_group.id),
                'ordered_ids': [str(s1.id)],
            },
            format='json',
            **_hdr(workspace_a),
        )
        assert resp.status_code == 400
        assert resp.data.get('group_id') == ['chatgroup_not_in_workspace']


@pytest.mark.django_db
class TestChatGroupDeleteCascade:
    def test_delete_group_sets_member_sessions_to_null(
        self, client_a, workspace_a, user_a,
    ):
        group = ChatGroup.objects.create(
            workspace=workspace_a, created_by=user_a, name='Doomed',
            ordering=1,
        )
        sessions = [
            ChatSession.objects.create(
                workspace=workspace_a, created_by=user_a,
                title=f'S{i}', group=group, group_ordering=i + 1,
            )
            for i in range(3)
        ]

        resp = client_a.delete(
            f'/api/chat/groups/{group.id}/', **_hdr(workspace_a),
        )
        assert resp.status_code == 204

        for s in sessions:
            s.refresh_from_db()
            assert s.group_id is None
            # group_ordering preserved by SET_NULL (no cascade reset). OK
            # because the sessions are now visually in Ungrouped where the
            # frontend re-renders them in -updated_at order anyway.


@pytest.mark.django_db
class TestChatSessionMoveToGroupViaPatch:
    def test_patch_session_group_appends_to_destination(
        self, client_a, workspace_a, user_a,
    ):
        dest = ChatGroup.objects.create(
            workspace=workspace_a, created_by=user_a, name='Dest',
            ordering=1,
        )
        # Pre-populate destination with existing sessions to verify max+1.
        ChatSession.objects.create(
            workspace=workspace_a, created_by=user_a, title='Existing',
            group=dest, group_ordering=4,
        )
        moving = ChatSession.objects.create(
            workspace=workspace_a, created_by=user_a, title='Moving',
            group_ordering=0,
        )

        resp = client_a.patch(
            f'/api/chat/sessions/{moving.id}/',
            {'group': str(dest.id)},
            format='json',
            **_hdr(workspace_a),
        )
        assert resp.status_code == 200
        moving.refresh_from_db()
        assert moving.group_id == dest.id
        assert moving.group_ordering == 5

    def test_patch_session_group_null_moves_to_ungrouped(
        self, client_a, workspace_a, user_a,
    ):
        group = ChatGroup.objects.create(
            workspace=workspace_a, created_by=user_a, name='G',
            ordering=1,
        )
        # Existing ungrouped session with explicit group_ordering=7.
        ChatSession.objects.create(
            workspace=workspace_a, created_by=user_a, title='OtherUngrouped',
            group_ordering=7,
        )
        session = ChatSession.objects.create(
            workspace=workspace_a, created_by=user_a, title='S',
            group=group, group_ordering=3,
        )

        resp = client_a.patch(
            f'/api/chat/sessions/{session.id}/',
            {'group': None},
            format='json',
            **_hdr(workspace_a),
        )
        assert resp.status_code == 200
        session.refresh_from_db()
        assert session.group_id is None
        # Appended after the existing max(7) of NULL-group sessions.
        assert session.group_ordering == 8

    def test_patch_foreign_group_returns_400(
        self, client_a, workspace_a, workspace_b, user_a, user_b,
    ):
        foreign_group = ChatGroup.objects.create(
            workspace=workspace_b, created_by=user_b, name='Foreign',
            ordering=1,
        )
        session = ChatSession.objects.create(
            workspace=workspace_a, created_by=user_a, title='S',
            group_ordering=0,
        )

        resp = client_a.patch(
            f'/api/chat/sessions/{session.id}/',
            {'group': str(foreign_group.id)},
            format='json',
            **_hdr(workspace_a),
        )
        assert resp.status_code == 400
        assert resp.data.get('group') == ['chatgroup_not_in_workspace']
        session.refresh_from_db()
        assert session.group_id is None


@pytest.mark.django_db
class TestChatSessionListOrdering:
    """Regression for the listSessions endpoint sort order.

    The endpoint orders globally by ``-updated_at`` regardless of group
    membership; ``group_ordering`` is applied only WITHIN a group section
    by the frontend (and inside per-group queries). This guarantees a
    chat moved into a group with high ``group_ordering`` stays on the
    first page of the paginated response.
    """

    def test_list_orders_by_updated_at_regardless_of_group(
        self, client_a, workspace_a, user_a,
    ):
        group = ChatGroup.objects.create(
            workspace=workspace_a, created_by=user_a, name='G',
            ordering=1,
        )
        # Creation order = update order under auto_now: oldest first,
        # newest last. Recency-sorted output reverses that.
        s_a = ChatSession.objects.create(
            workspace=workspace_a, created_by=user_a, title='Ungrouped-old',
        )
        s_b = ChatSession.objects.create(
            workspace=workspace_a, created_by=user_a, title='Ungrouped-new',
        )
        s_c = ChatSession.objects.create(
            workspace=workspace_a, created_by=user_a, title='Grouped-1',
            group=group, group_ordering=1,
        )
        s_d = ChatSession.objects.create(
            workspace=workspace_a, created_by=user_a, title='Grouped-2',
            group=group, group_ordering=2,
        )

        resp = client_a.get('/api/chat/sessions/', **_hdr(workspace_a))
        assert resp.status_code == 200
        titles = [row['title'] for row in resp.data['results']]
        # Strict recency order regardless of group_ordering — the
        # most-recently-updated chat is first. This is the key invariant
        # that keeps moved-into-group chats visible on page 1.
        assert titles == [
            'Grouped-2', 'Grouped-1', 'Ungrouped-new', 'Ungrouped-old',
        ]

        # Sanity-check `group` + `group_ordering` are surfaced via the serializer.
        for row in resp.data['results']:
            assert 'group' in row
            assert 'group_ordering' in row
        # Ensure no sessions dropped from the response.
        assert {s.id for s in (s_a, s_b, s_c, s_d)} == {
            ChatSession.objects.get(title=row['title']).id
            for row in resp.data['results']
        }
