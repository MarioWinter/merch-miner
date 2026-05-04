"""PROJ-20 Phase 7.3 — Vision SSE stream tests.

Covers:
  - SSE stream view routes through Vision path when `attachment_ids` present
  - LLM payload includes the image_url content block
  - Non-vision-capable model falls back to AppSettings.vision_model and the
    `init` event surfaces `vision_fallback: true`
  - Cross-workspace attachment id → 404
  - Vision answer persists as a ChatMessage with model_used set
"""

from __future__ import annotations

import io
import json
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from PIL import Image
from rest_framework.test import APIClient

from chat_attachments_app.models import AppSettings, ChatAttachment
from search_app.models import ChatMessage, ChatSession
from workspace_app.models import Membership, Workspace

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(email='vision@example.com', password='pw')


@pytest.fixture
def other_user(db):
    return User.objects.create_user(email='vision-other@example.com', password='pw')


@pytest.fixture
def workspace(db, user):
    ws = Workspace.objects.create(name='Vision WS', slug='vision-ws', owner=user)
    Membership.objects.create(
        workspace=ws, user=user, role='admin', status='active',
    )
    return ws


@pytest.fixture
def other_workspace(db, other_user):
    ws = Workspace.objects.create(
        name='Other Vision WS', slug='other-vision-ws', owner=other_user,
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


@pytest.fixture
def session(workspace, user):
    return ChatSession.objects.create(
        workspace=workspace, created_by=user, title='Vision Session',
    )


def _png_bytes() -> bytes:
    img = Image.new('RGB', (32, 24), (200, 100, 50))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


def _make_attachment(workspace, user) -> ChatAttachment:
    from django.core.files.base import ContentFile
    return ChatAttachment.objects.create(
        workspace=workspace,
        uploaded_by=user,
        file=ContentFile(_png_bytes(), name='img.webp'),
        original_filename='img.png',
        mime_type='image/webp',
        size_bytes=64,
    )


def _headers(workspace):
    return {'HTTP_X_WORKSPACE_ID': str(workspace.id)}


def parse_sse(streaming_content) -> list[dict]:
    raw = b''.join(streaming_content).decode('utf-8')
    events: list[dict] = []
    for block in raw.split('\n\n'):
        block = block.strip()
        if not block:
            continue
        event_name = 'message'
        payload = None
        for line in block.splitlines():
            if line.startswith('event:'):
                event_name = line[len('event:'):].strip()
            elif line.startswith('data:'):
                payload = line[len('data:'):].strip()
        if payload is None:
            continue
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            data = {'_raw': payload}
        data['_event'] = event_name
        events.append(data)
    return events


@pytest.mark.django_db
class TestVisionStream:
    URL_TPL = '/api/chat/sessions/{session_id}/messages/stream/'

    def test_stream_with_attachment_routes_to_vision_path(
        self, api_client, workspace, session, user
    ):
        att = _make_attachment(workspace, user)

        # Stub the langchain-openai stream to yield deterministic chunks.
        captured_messages: list = []

        class _Chunk:
            def __init__(self, txt):
                self.content = txt

        def fake_stream(messages):
            captured_messages.append(messages)
            yield _Chunk('I see ')
            yield _Chunk('a picture.')

        class _LLM:
            def stream(self, messages):
                return fake_stream(messages)

        with patch(
            'chat_attachments_app.vision.build_vision_llm',
            return_value=_LLM(),
        ):
            url = (
                self.URL_TPL.format(session_id=session.pk)
                + f'?content=Describe%20this&attachment_ids={att.id}'
                + '&model=openai/gpt-4.1-mini'
            )
            resp = api_client.get(url, **_headers(workspace))
            # Drain generator INSIDE the `with` block so the patch is still
            # active while the lazy SSE generator iterates.
            assert resp.status_code == 200, resp.content
            events = parse_sse(resp.streaming_content)

        kinds = [e['_event'] for e in events]
        assert 'init' in kinds
        assert 'chunk' in kinds
        assert 'done' in kinds

        init = next(e for e in events if e['_event'] == 'init')
        assert init['mode'] == 'vision'
        assert init['model_used'] == 'openai/gpt-4.1-mini'
        assert init['vision_fallback'] is False

        # LLM payload includes the user's text + image_url block.
        assert captured_messages, 'LLM stream was not called'
        last_message = captured_messages[0][-1]
        # message tuple is (role, content)
        assert last_message[0] == 'user'
        blocks = last_message[1]
        assert isinstance(blocks, list)
        assert any(b.get('type') == 'image_url' for b in blocks)
        assert any(b.get('type') == 'text' for b in blocks)

    def test_non_vision_model_falls_back_to_app_settings(
        self, api_client, workspace, session, user
    ):
        att = _make_attachment(workspace, user)
        # Set fallback model via AppSettings singleton
        AppSettings.get_solo()  # ensure row exists
        AppSettings.objects.filter(pk=1).update(vision_model='openai/gpt-4.1')

        class _Chunk:
            def __init__(self, txt):
                self.content = txt

        def fake_stream(messages):
            yield _Chunk('ok')

        class _LLM:
            def stream(self, messages):
                return fake_stream(messages)

        with patch(
            'chat_attachments_app.vision.build_vision_llm',
            return_value=_LLM(),
        ):
            url = (
                self.URL_TPL.format(session_id=session.pk)
                + f'?content=hi&attachment_ids={att.id}'
                + '&model=mistral-medium-2025'  # not vision-capable
            )
            resp = api_client.get(url, **_headers(workspace))
            assert resp.status_code == 200
            events = parse_sse(resp.streaming_content)
        init = next(e for e in events if e['_event'] == 'init')
        assert init['vision_fallback'] is True
        assert init['model_used'] == 'openai/gpt-4.1'

    def test_attachment_id_from_other_workspace_returns_404(
        self, api_client, other_workspace, other_user, workspace, session
    ):
        # Attachment belongs to OTHER workspace; caller is in `workspace`.
        foreign_att = _make_attachment(other_workspace, other_user)
        url = (
            self.URL_TPL.format(session_id=session.pk)
            + f'?content=hi&attachment_ids={foreign_att.id}'
        )
        resp = api_client.get(url, **_headers(workspace))
        assert resp.status_code == 404

    def test_assistant_message_persisted_with_vision_model_used(
        self, api_client, workspace, session, user
    ):
        att = _make_attachment(workspace, user)

        class _Chunk:
            def __init__(self, txt):
                self.content = txt

        def fake_stream(messages):
            yield _Chunk('Vision answer text.')

        class _LLM:
            def stream(self, messages):
                return fake_stream(messages)

        with patch(
            'chat_attachments_app.vision.build_vision_llm',
            return_value=_LLM(),
        ):
            url = (
                self.URL_TPL.format(session_id=session.pk)
                + f'?content=q&attachment_ids={att.id}'
                + '&model=openai/gpt-4.1-mini'
            )
            resp = api_client.get(url, **_headers(workspace))
            # Drain generator INSIDE the `with` so the patch is still active.
            list(resp.streaming_content)
        msgs = ChatMessage.objects.filter(session=session).order_by('created_at')
        assert msgs.count() == 2
        assistant = msgs.last()
        assert assistant.role == ChatMessage.Role.ASSISTANT
        assert assistant.content == 'Vision answer text.'
        assert assistant.model_used == 'openai/gpt-4.1-mini'

        # User message has the attachment linked back to it.
        att.refresh_from_db()
        assert att.message_id == msgs.first().pk
