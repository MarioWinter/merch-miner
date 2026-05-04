"""
PROJ-14 -- Team Kanban & Collaboration: backend tests.

Covers:
  - New Round: increment, reset status, validate Done-only (AC-9)
  - Round summaries (AC-16)
  - Comments: card-level + design-level, @mention -> Notification (AC-17-19)
  - Notifications: CRUD, unread count, mark-all-read (AC-21-24)
  - Design soft-delete -> DesignTrash, restore (AC-14-15)
  - Design upload (AC-11)
  - Workspace isolation
"""

import io
from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from user_auth_app.models import User
from workspace_app.models import Membership, Workspace
from niche_app.models import Niche
from publish_app.models import DesignAsset
from kanban_app.models import NicheComment, Notification, DesignTrash


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(email, password='TestPass123!', **kwargs):
    return User.objects.create_user(
        email=email, password=password, username=email, is_active=True, **kwargs,
    )


def auth_client(user, workspace=None):
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.cookies['access_token'] = token
    if workspace:
        client.credentials(HTTP_X_WORKSPACE_ID=str(workspace.id))
    return client


def make_workspace_with_admin(email):
    user = make_user(email)
    workspace = Workspace.objects.get(owner=user)
    membership = Membership.objects.get(user=user, workspace=workspace)
    return user, workspace, membership


def add_member(workspace, email, role=Membership.Role.MEMBER):
    user = make_user(email)
    membership = Membership.objects.create(
        workspace=workspace, user=user, role=role,
        status=Membership.Status.ACTIVE,
    )
    return user, membership


def create_niche(workspace, user, **kwargs):
    defaults = {
        'workspace': workspace,
        'created_by': user,
        'name': 'Test Niche',
        'status': Niche.Status.DATA_ENTRY,
    }
    defaults.update(kwargs)
    return Niche.objects.create(**defaults)


def create_design_asset(workspace, user, niche=None, **kwargs):
    defaults = {
        'workspace': workspace,
        'created_by': user,
        'file_name': 'test.png',
        'niche': niche,
        'round': 1,
    }
    defaults.update(kwargs)
    return DesignAsset.objects.create(**defaults)


# ---------------------------------------------------------------------------
# Tests: New Round (AC-9)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestNewRound:
    def test_new_round_from_winner(self):
        admin, ws, _ = make_workspace_with_admin('admin@test.com')
        niche = create_niche(ws, admin, status=Niche.Status.WINNER)
        client = auth_client(admin, ws)

        url = reverse('niche-new-round', kwargs={'niche_id': niche.id})
        resp = client.post(url)

        assert resp.status_code == 200
        assert resp.data['current_round'] == 2
        assert resp.data['status'] == 'to_designer'

        niche.refresh_from_db()
        assert niche.current_round == 2
        assert niche.status == Niche.Status.TO_DESIGNER

    def test_new_round_from_loser(self):
        admin, ws, _ = make_workspace_with_admin('admin2@test.com')
        niche = create_niche(ws, admin, status=Niche.Status.LOSER)
        client = auth_client(admin, ws)

        url = reverse('niche-new-round', kwargs={'niche_id': niche.id})
        resp = client.post(url)

        assert resp.status_code == 200
        assert resp.data['current_round'] == 2

    def test_new_round_rejects_non_done_status(self):
        admin, ws, _ = make_workspace_with_admin('admin3@test.com')
        niche = create_niche(ws, admin, status=Niche.Status.TO_DESIGNER)
        client = auth_client(admin, ws)

        url = reverse('niche-new-round', kwargs={'niche_id': niche.id})
        resp = client.post(url)

        assert resp.status_code == 400

    def test_new_round_workspace_isolation(self):
        admin1, ws1, _ = make_workspace_with_admin('admin4@test.com')
        admin2, ws2, _ = make_workspace_with_admin('admin5@test.com')
        niche = create_niche(ws1, admin1, status=Niche.Status.WINNER)
        client = auth_client(admin2, ws2)

        url = reverse('niche-new-round', kwargs={'niche_id': niche.id})
        resp = client.post(url)

        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Tests: Round Summaries (AC-16)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestRoundSummaries:
    def test_round_summaries_basic(self):
        admin, ws, _ = make_workspace_with_admin('rs@test.com')
        niche = create_niche(ws, admin, current_round=2)
        client = auth_client(admin, ws)

        url = reverse('niche-rounds', kwargs={'niche_id': niche.id})
        resp = client.get(url)

        assert resp.status_code == 200
        assert len(resp.data) == 2
        assert resp.data[0]['round'] == 1
        assert resp.data[1]['round'] == 2


# ---------------------------------------------------------------------------
# Tests: Comments (AC-17, AC-18, AC-19)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestComments:
    def test_create_card_level_comment(self):
        admin, ws, _ = make_workspace_with_admin('c1@test.com')
        niche = create_niche(ws, admin)
        client = auth_client(admin, ws)

        url = reverse('niche-comments', kwargs={'niche_id': niche.id})
        resp = client.post(url, {'content': 'Great niche!'}, format='json')

        assert resp.status_code == 201
        assert resp.data['content'] == 'Great niche!'
        assert resp.data['design'] is None

    def test_create_design_level_comment(self):
        admin, ws, _ = make_workspace_with_admin('c2@test.com')
        niche = create_niche(ws, admin)
        design = create_design_asset(ws, admin, niche=niche)
        client = auth_client(admin, ws)

        url = reverse('niche-comments', kwargs={'niche_id': niche.id})
        resp = client.post(url, {
            'content': 'Fix contrast',
            'design_id': str(design.id),
        }, format='json')

        assert resp.status_code == 201
        assert str(resp.data['design']) == str(design.id)

    def test_list_card_level_comments(self):
        admin, ws, _ = make_workspace_with_admin('c3@test.com')
        niche = create_niche(ws, admin)
        NicheComment.objects.create(niche=niche, author=admin, content='Hello')
        NicheComment.objects.create(niche=niche, author=admin, content='World')
        client = auth_client(admin, ws)

        url = reverse('niche-comments', kwargs={'niche_id': niche.id})
        resp = client.get(url)

        assert resp.status_code == 200
        assert resp.data['count'] == 2

    def test_mention_creates_notification(self):
        admin, ws, _ = make_workspace_with_admin('c4@test.com')
        member, _ = add_member(ws, 'member@test.com')
        niche = create_niche(ws, admin)
        client = auth_client(admin, ws)

        url = reverse('niche-comments', kwargs={'niche_id': niche.id})
        resp = client.post(url, {
            'content': '@member check this',
            'mentions': [member.id],
        }, format='json')

        assert resp.status_code == 201
        assert Notification.objects.filter(
            recipient=member,
            type=Notification.Type.MENTION,
        ).exists()

    def test_delete_own_comment(self):
        admin, ws, _ = make_workspace_with_admin('c5@test.com')
        niche = create_niche(ws, admin)
        comment = NicheComment.objects.create(niche=niche, author=admin, content='Delete me')
        client = auth_client(admin, ws)

        url = reverse('niche-comment-delete', kwargs={
            'niche_id': niche.id, 'comment_id': comment.id,
        })
        resp = client.delete(url)

        assert resp.status_code == 204
        assert not NicheComment.objects.filter(id=comment.id).exists()

    def test_non_author_non_admin_cannot_delete(self):
        admin, ws, _ = make_workspace_with_admin('c6@test.com')
        member, _ = add_member(ws, 'mem2@test.com')
        niche = create_niche(ws, admin)
        comment = NicheComment.objects.create(niche=niche, author=admin, content='Mine')
        client = auth_client(member, ws)

        url = reverse('niche-comment-delete', kwargs={
            'niche_id': niche.id, 'comment_id': comment.id,
        })
        resp = client.delete(url)

        assert resp.status_code == 403

    def test_workspace_isolation_comments(self):
        admin1, ws1, _ = make_workspace_with_admin('c7@test.com')
        admin2, ws2, _ = make_workspace_with_admin('c8@test.com')
        niche = create_niche(ws1, admin1)
        client = auth_client(admin2, ws2)

        url = reverse('niche-comments', kwargs={'niche_id': niche.id})
        resp = client.get(url)

        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Tests: Notifications (AC-21, AC-22, AC-23, AC-24)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestNotifications:
    def test_list_notifications(self):
        admin, ws, _ = make_workspace_with_admin('n1@test.com')
        Notification.objects.create(
            workspace=ws, recipient=admin,
            type=Notification.Type.MENTION,
            title='Test', message='Hello',
        )
        client = auth_client(admin, ws)

        resp = client.get(reverse('notification-list'))

        assert resp.status_code == 200
        assert resp.data['count'] == 1

    def test_filter_unread_only(self):
        admin, ws, _ = make_workspace_with_admin('n2@test.com')
        Notification.objects.create(
            workspace=ws, recipient=admin,
            type=Notification.Type.MENTION,
            title='Unread', is_read=False,
        )
        Notification.objects.create(
            workspace=ws, recipient=admin,
            type=Notification.Type.MENTION,
            title='Read', is_read=True,
        )
        client = auth_client(admin, ws)

        resp = client.get(reverse('notification-list') + '?is_read=false')

        assert resp.status_code == 200
        assert resp.data['count'] == 1
        assert resp.data['results'][0]['title'] == 'Unread'

    def test_mark_as_read(self):
        admin, ws, _ = make_workspace_with_admin('n3@test.com')
        notif = Notification.objects.create(
            workspace=ws, recipient=admin,
            type=Notification.Type.MENTION,
            title='Mark me',
        )
        client = auth_client(admin, ws)

        url = reverse('notification-mark-read', kwargs={'notification_id': notif.id})
        resp = client.patch(url, {'is_read': True}, format='json')

        assert resp.status_code == 200
        notif.refresh_from_db()
        assert notif.is_read is True

    def test_mark_all_read(self):
        admin, ws, _ = make_workspace_with_admin('n4@test.com')
        for i in range(3):
            Notification.objects.create(
                workspace=ws, recipient=admin,
                type=Notification.Type.MENTION,
                title=f'Notif {i}',
            )
        client = auth_client(admin, ws)

        resp = client.post(reverse('notification-mark-all-read'))

        assert resp.status_code == 200
        assert resp.data['updated'] == 3
        assert Notification.objects.filter(
            recipient=admin, is_read=False,
        ).count() == 0

    def test_unread_count(self):
        admin, ws, _ = make_workspace_with_admin('n5@test.com')
        Notification.objects.create(
            workspace=ws, recipient=admin,
            type=Notification.Type.MENTION, title='1',
        )
        Notification.objects.create(
            workspace=ws, recipient=admin,
            type=Notification.Type.MENTION, title='2',
        )
        Notification.objects.create(
            workspace=ws, recipient=admin,
            type=Notification.Type.MENTION, title='3', is_read=True,
        )
        client = auth_client(admin, ws)

        resp = client.get(reverse('notification-unread-count'))

        assert resp.status_code == 200
        assert resp.data['count'] == 2

    def test_workspace_isolation_notifications(self):
        admin1, ws1, _ = make_workspace_with_admin('n6@test.com')
        admin2, ws2, _ = make_workspace_with_admin('n7@test.com')
        Notification.objects.create(
            workspace=ws1, recipient=admin1,
            type=Notification.Type.MENTION, title='Secret',
        )
        client = auth_client(admin2, ws2)

        resp = client.get(reverse('notification-list'))

        assert resp.status_code == 200
        assert resp.data['count'] == 0


# ---------------------------------------------------------------------------
# Tests: Design Soft-Delete & Restore (AC-14, AC-15)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestDesignTrash:
    def test_soft_delete_design(self):
        admin, ws, _ = make_workspace_with_admin('d1@test.com')
        niche = create_niche(ws, admin)
        design = create_design_asset(ws, admin, niche=niche)
        client = auth_client(admin, ws)

        url = reverse('design-action', kwargs={'design_id': design.id})
        resp = client.delete(url)

        assert resp.status_code == 204
        assert DesignTrash.objects.filter(design=design).exists()

    def test_restore_design(self):
        admin, ws, _ = make_workspace_with_admin('d2@test.com')
        niche = create_niche(ws, admin)
        design = create_design_asset(ws, admin, niche=niche)

        from django.utils import timezone
        from datetime import timedelta
        now = timezone.now()
        DesignTrash.objects.create(
            design=design, workspace=ws, deleted_by=admin,
            deleted_at=now, expires_at=now + timedelta(days=30),
        )

        client = auth_client(admin, ws)
        url = reverse('design-restore', kwargs={'design_id': design.id})
        resp = client.post(url)

        assert resp.status_code == 200
        assert resp.data['restored'] is True
        assert not DesignTrash.objects.filter(design=design).exists()

    def test_trash_list(self):
        admin, ws, _ = make_workspace_with_admin('d3@test.com')
        niche = create_niche(ws, admin)
        design = create_design_asset(ws, admin, niche=niche)

        from django.utils import timezone
        from datetime import timedelta
        now = timezone.now()
        DesignTrash.objects.create(
            design=design, workspace=ws, deleted_by=admin,
            deleted_at=now, expires_at=now + timedelta(days=30),
        )

        client = auth_client(admin, ws)
        resp = client.get(reverse('design-trash-list'))

        assert resp.status_code == 200
        assert resp.data['count'] == 1

    def test_double_delete_rejected(self):
        admin, ws, _ = make_workspace_with_admin('d4@test.com')
        niche = create_niche(ws, admin)
        design = create_design_asset(ws, admin, niche=niche)
        client = auth_client(admin, ws)

        url = reverse('design-action', kwargs={'design_id': design.id})
        client.delete(url)
        resp = client.delete(url)

        assert resp.status_code == 400

    def test_workspace_isolation_trash(self):
        admin1, ws1, _ = make_workspace_with_admin('d5@test.com')
        admin2, ws2, _ = make_workspace_with_admin('d6@test.com')
        niche = create_niche(ws1, admin1)
        design = create_design_asset(ws1, admin1, niche=niche)
        client = auth_client(admin2, ws2)

        url = reverse('design-action', kwargs={'design_id': design.id})
        resp = client.delete(url)

        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Tests: Design Approve/Reject (AC-13)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestDesignApproveReject:
    @patch('django_rq.enqueue')
    def test_approve_design(self, mock_enqueue):
        admin, ws, _ = make_workspace_with_admin('ar1@test.com')
        niche = create_niche(ws, admin)
        design = create_design_asset(ws, admin, niche=niche)
        client = auth_client(admin, ws)

        url = reverse('design-action', kwargs={'design_id': design.id})
        resp = client.patch(url, {'status': 'approved'}, format='json')

        assert resp.status_code == 200
        assert resp.data['status'] == 'approved'
        design.refresh_from_db()
        assert 'approved' in design.tags

    def test_reject_design_with_feedback(self):
        admin, ws, _ = make_workspace_with_admin('ar2@test.com')
        member, _ = add_member(ws, 'designer@test.com')
        niche = create_niche(ws, admin)
        design = create_design_asset(ws, member, niche=niche)
        client = auth_client(admin, ws)

        url = reverse('design-action', kwargs={'design_id': design.id})
        resp = client.patch(url, {
            'status': 'rejected',
            'feedback': 'Contrast too low',
        }, format='json')

        assert resp.status_code == 200
        # Should create a feedback comment
        assert NicheComment.objects.filter(
            niche=niche, design=design,
            content__contains='Contrast too low',
        ).exists()
        # Should create rejection notification
        assert Notification.objects.filter(
            recipient=member,
            type=Notification.Type.REJECTION,
        ).exists()


# ---------------------------------------------------------------------------
# Tests: Design Upload (AC-11)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestDesignUpload:
    def test_upload_single_file(self):
        admin, ws, _ = make_workspace_with_admin('u1@test.com')
        niche = create_niche(ws, admin)
        client = auth_client(admin, ws)

        img = io.BytesIO(b'\x89PNG\r\n\x1a\n' + b'\x00' * 100)
        img.name = 'test.png'
        img.content_type = 'image/png'

        url = reverse('niche-designs-upload', kwargs={'niche_id': niche.id})
        resp = client.post(url, {'files': img}, format='multipart')

        assert resp.status_code == 201
        assert resp.data['uploaded'] == 1
        assert DesignAsset.objects.filter(niche=niche).count() == 1

    def test_upload_no_files_rejected(self):
        admin, ws, _ = make_workspace_with_admin('u2@test.com')
        niche = create_niche(ws, admin)
        client = auth_client(admin, ws)

        url = reverse('niche-designs-upload', kwargs={'niche_id': niche.id})
        resp = client.post(url, {}, format='multipart')

        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Tests: Trash Cleanup (AC-27)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestTrashCleanup:
    def test_cleanup_expired(self):
        from django.utils import timezone
        from datetime import timedelta
        from kanban_app.services.trash_cleanup import cleanup_expired_trash

        admin, ws, _ = make_workspace_with_admin('tc@test.com')
        niche = create_niche(ws, admin)
        design = create_design_asset(ws, admin, niche=niche)

        now = timezone.now()
        DesignTrash.objects.create(
            design=design, workspace=ws, deleted_by=admin,
            deleted_at=now - timedelta(days=31),
            expires_at=now - timedelta(days=1),
        )

        count = cleanup_expired_trash()

        assert count == 1
        assert not DesignAsset.objects.filter(id=design.id).exists()

    def test_cleanup_skips_non_expired(self):
        from django.utils import timezone
        from datetime import timedelta
        from kanban_app.services.trash_cleanup import cleanup_expired_trash

        admin, ws, _ = make_workspace_with_admin('tc2@test.com')
        niche = create_niche(ws, admin)
        design = create_design_asset(ws, admin, niche=niche)

        now = timezone.now()
        DesignTrash.objects.create(
            design=design, workspace=ws, deleted_by=admin,
            deleted_at=now,
            expires_at=now + timedelta(days=29),
        )

        count = cleanup_expired_trash()

        assert count == 0
        assert DesignAsset.objects.filter(id=design.id).exists()
