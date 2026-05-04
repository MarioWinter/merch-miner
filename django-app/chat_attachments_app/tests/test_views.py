"""PROJ-20 Phase 7.2 — chat-attachment upload endpoint tests."""

import io
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from chat_attachments_app.constants import MAX_FILE_SIZE_BYTES
from chat_attachments_app.models import ChatAttachment
from workspace_app.models import Membership, Workspace

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(email='attach@example.com', password='pw')


@pytest.fixture
def other_user(db):
    return User.objects.create_user(email='attach-other@example.com', password='pw')


@pytest.fixture
def workspace(db, user):
    ws = Workspace.objects.create(name='Attach WS', slug='attach-ws', owner=user)
    Membership.objects.create(
        workspace=ws, user=user, role='admin', status='active',
    )
    return ws


@pytest.fixture
def other_workspace(db, other_user):
    ws = Workspace.objects.create(
        name='Other Attach WS', slug='other-attach-ws', owner=other_user,
    )
    Membership.objects.create(
        workspace=ws, user=other_user, role='admin', status='active',
    )
    return ws


@pytest.fixture
def api_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _headers(workspace):
    return {'HTTP_X_WORKSPACE_ID': str(workspace.id)}


def _png_bytes(size=(512, 384), color=(120, 80, 40)) -> bytes:
    """Tiny valid PNG file content for upload tests."""
    img = Image.new('RGB', size, color)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


def _png_upload(name='cute.png', size=(512, 384)) -> SimpleUploadedFile:
    return SimpleUploadedFile(
        name=name, content=_png_bytes(size=size), content_type='image/png',
    )


@pytest.mark.django_db
class TestChatAttachmentUpload:
    URL = '/api/chat/attachments/'

    def test_valid_png_upload_returns_201_with_attachment(
        self, api_client, workspace
    ):
        resp = api_client.post(
            self.URL,
            {'files': _png_upload()},
            format='multipart',
            **_headers(workspace),
        )
        assert resp.status_code == 201, resp.content
        body = resp.json()
        assert 'attachments' in body
        assert len(body['attachments']) == 1
        item = body['attachments'][0]
        assert item['mime_type'] == 'image/webp'  # resized to webp
        assert item['filename'] == 'cute.png'  # original filename preserved
        assert item['status'] == 'completed'
        assert ChatAttachment.objects.filter(workspace=workspace).count() == 1

    def test_oversize_file_returns_413(self, api_client, workspace):
        # Generate a "fake" oversize blob with valid PNG header. We don't
        # actually round-trip through Pillow here — the size check fires
        # FIRST at the per-file gate before any decoding.
        big = SimpleUploadedFile(
            name='big.png',
            content=b'\x89PNG\r\n\x1a\n' + b'\x00' * (MAX_FILE_SIZE_BYTES + 1),
            content_type='image/png',
        )
        resp = api_client.post(
            self.URL,
            {'files': big},
            format='multipart',
            **_headers(workspace),
        )
        assert resp.status_code == 413, resp.content

    def test_non_image_mime_returns_400(self, api_client, workspace):
        bogus = SimpleUploadedFile(
            name='evil.txt',
            content=b'just plain text masquerading as image',
            content_type='image/png',  # client lies — server sniffs
        )
        resp = api_client.post(
            self.URL,
            {'files': bogus},
            format='multipart',
            **_headers(workspace),
        )
        assert resp.status_code == 400, resp.content
        assert 'unsupported mime' in resp.json()['error']

    def test_too_many_files_returns_400(self, api_client, workspace):
        files = [_png_upload(name=f'i{n}.png') for n in range(6)]
        resp = api_client.post(
            self.URL,
            {'files': files},
            format='multipart',
            **_headers(workspace),
        )
        assert resp.status_code == 400, resp.content
        assert 'Too many files' in resp.json()['error']

    def test_decompression_bomb_image_rejected(self, api_client, workspace):
        # Build a small PNG, then patch Pillow's Image.open to raise the
        # bomb error (a real bomb would be >1GB on disk to trigger the
        # MAX_IMAGE_PIXELS check in jsdom-free space).
        with patch(
            'chat_attachments_app.api.views.Image.open',
            side_effect=Image.DecompressionBombError('boom'),
        ):
            resp = api_client.post(
                self.URL,
                {'files': _png_upload()},
                format='multipart',
                **_headers(workspace),
            )
        assert resp.status_code == 400, resp.content
        assert 'could not be processed' in resp.json()['error']

    def test_cross_workspace_access_returns_403(
        self, api_client, other_workspace
    ):
        # User belongs to `workspace` but submits header for `other_workspace`.
        resp = api_client.post(
            self.URL,
            {'files': _png_upload()},
            format='multipart',
            **_headers(other_workspace),
        )
        assert resp.status_code == 403, resp.content


@pytest.mark.django_db
class TestChatAttachmentDelete:
    def test_delete_own_attachment_returns_204(self, api_client, workspace):
        resp = api_client.post(
            '/api/chat/attachments/',
            {'files': _png_upload()},
            format='multipart',
            **_headers(workspace),
        )
        att_id = resp.json()['attachments'][0]['id']
        del_resp = api_client.delete(
            f'/api/chat/attachments/{att_id}/', **_headers(workspace),
        )
        assert del_resp.status_code == 204
        assert not ChatAttachment.objects.filter(id=att_id).exists()
