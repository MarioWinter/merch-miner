"""Tests for SSE streaming endpoint (PROJ-17 Phase 6 Step D).

Covers `ChatSessionMessageStreamView` (GET /chat/sessions/<id>/messages/stream/)
plus the auto-mode classifier + agent-route branches inside
`ChatSessionMessagesView.post` since both are part of the SSE/streaming flow.

Vane's `search_stream()` yields ALREADY-FORMATTED SSE strings of the form
`data: {"type": "init|sources|response|done", ...}\\n\\n`. The view itself
prepends its own `init` event with `user_message_id` and appends a
`persisted` event with `assistant_message_id` once the stream completes
successfully.

Patterns reused:
    - DRF/pytest-django fixtures mirror search_app/tests/test_views.py
    - `mock.patch('search_app.api.views.VaneService')` -> generator stub
    - StreamingHttpResponse iterators are realized with
      `b''.join(response.streaming_content)` then split on `\\n\\n`.
"""
from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from search_app.models import ChatMessage, ChatSession
from search_app.services.vane_service import VaneServiceError
from workspace_app.models import Membership, Workspace

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures (mirror test_views.py)
# ---------------------------------------------------------------------------

@pytest.fixture
def user(db):
    return User.objects.create_user(
        email='sse-owner@example.com', password='testpass123',
    )


@pytest.fixture
def other_user(db):
    return User.objects.create_user(
        email='sse-other@example.com', password='testpass123',
    )


@pytest.fixture
def workspace(db, user):
    ws = Workspace.objects.create(name='SSE WS', slug='sse-ws', owner=user)
    Membership.objects.create(
        workspace=ws, user=user, role='admin', status='active',
    )
    return ws


@pytest.fixture
def other_workspace(db, other_user):
    ws = Workspace.objects.create(
        name='Other WS', slug='other-sse-ws', owner=other_user,
    )
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
def unauth_client():
    return APIClient()


@pytest.fixture
def other_api_client(other_user):
    client = APIClient()
    client.force_authenticate(user=other_user)
    return client


@pytest.fixture
def session(workspace, user):
    return ChatSession.objects.create(
        workspace=workspace, created_by=user, title='SSE Session',
    )


def _headers(workspace):
    return {'HTTP_X_WORKSPACE_ID': str(workspace.id)}


# ---------------------------------------------------------------------------
# SSE parsing helpers
# ---------------------------------------------------------------------------

def parse_sse(streaming_content) -> list[dict]:
    """Realize StreamingHttpResponse and parse SSE events.

    Returns list of decoded events. Each event becomes a dict with the parsed
    JSON `data:` payload merged in, plus a `_event` key holding the SSE event
    name (from `event: NAME` header — defaults to 'message' when missing).

    Backend now emits proper SSE event-named frames (`event: init`,
    `event: chunk`, `event: sources`, `event: done`, `event: error`) so the
    frontend's named EventSource listeners fire correctly.
    """
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


def make_vane_generator(events: list[dict]):
    """Return a generator that yields pre-formatted SSE strings.

    Mirrors the real `VaneService.search_stream()` contract: each yielded
    string is `data: {json}\\n\\n`.
    """
    def _gen(*args, **kwargs):
        for ev in events:
            yield f"data: {json.dumps(ev)}\n\n"
    return _gen


# ---------------------------------------------------------------------------
# Auth + workspace isolation
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestSSEStreamAuth:
    def test_unauth_returns_401(self, unauth_client, workspace, session):
        resp = unauth_client.get(
            f'/api/chat/sessions/{session.id}/messages/stream/?content=hello',
            **_headers(workspace),
        )
        assert resp.status_code == 401

    def test_workspace_isolation_returns_404(
        self, api_client, other_workspace, other_user,
    ):
        # Session belongs to a workspace the requester is NOT a member of.
        foreign_session = ChatSession.objects.create(
            workspace=other_workspace,
            created_by=other_user,
            title='Foreign',
        )
        # User not member of session.workspace → 404 (do not leak session existence).
        resp = api_client.get(
            f'/api/chat/sessions/{foreign_session.id}/messages/stream/'
            f'?content=hi',
            **_headers(other_workspace),
        )
        assert resp.status_code == 404

    def test_shared_session_non_owner_cannot_stream(
        self, other_api_client, workspace, session, other_user,
    ):
        """AC-41: shared sessions are READ-ONLY for non-owners.

        The stream endpoint creates a user `ChatMessage` (write op), so even
        if the session is shared, non-owners must be rejected with 403.
        """
        Membership.objects.create(
            workspace=workspace, user=other_user,
            role='member', status='active',
        )
        session.is_shared = True
        session.save(update_fields=['is_shared'])

        resp = other_api_client.get(
            f'/api/chat/sessions/{session.id}/messages/stream/?content=hi',
            **_headers(workspace),
        )
        assert resp.status_code == 403

    def test_missing_content_returns_400(self, api_client, workspace, session):
        resp = api_client.get(
            f'/api/chat/sessions/{session.id}/messages/stream/',
            **_headers(workspace),
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Response headers
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestSSEStreamResponse:
    def _ok_stream(self):
        return make_vane_generator([
            {'type': 'response', 'data': 'hi'},
            {'type': 'done'},
        ])

    @patch('search_app.api.views.django_rq')
    @patch('search_app.api.views.VaneService')
    def test_streaming_response_content_type(
        self, mock_vane_cls, mock_rq, api_client, workspace, session,
    ):
        mock_vane = MagicMock()
        mock_vane.search_stream.side_effect = self._ok_stream()
        mock_vane.default_model = 'gpt-4.1-mini'
        mock_vane_cls.return_value = mock_vane
        mock_rq.get_queue.return_value = MagicMock()

        resp = api_client.get(
            f'/api/chat/sessions/{session.id}/messages/stream/?content=hello',
            **_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp['Content-Type'].startswith('text/event-stream')
        # Drain so transaction completes cleanly
        b''.join(resp.streaming_content)

    @patch('search_app.api.views.django_rq')
    @patch('search_app.api.views.VaneService')
    def test_x_accel_buffering_header(
        self, mock_vane_cls, mock_rq, api_client, workspace, session,
    ):
        mock_vane = MagicMock()
        mock_vane.search_stream.side_effect = self._ok_stream()
        mock_vane.default_model = 'gpt-4.1-mini'
        mock_vane_cls.return_value = mock_vane
        mock_rq.get_queue.return_value = MagicMock()

        resp = api_client.get(
            f'/api/chat/sessions/{session.id}/messages/stream/?content=hello',
            **_headers(workspace),
        )
        assert resp['X-Accel-Buffering'] == 'no'
        b''.join(resp.streaming_content)

    @patch('search_app.api.views.django_rq')
    @patch('search_app.api.views.VaneService')
    def test_cache_control_header(
        self, mock_vane_cls, mock_rq, api_client, workspace, session,
    ):
        mock_vane = MagicMock()
        mock_vane.search_stream.side_effect = self._ok_stream()
        mock_vane.default_model = 'gpt-4.1-mini'
        mock_vane_cls.return_value = mock_vane
        mock_rq.get_queue.return_value = MagicMock()

        resp = api_client.get(
            f'/api/chat/sessions/{session.id}/messages/stream/?content=hello',
            **_headers(workspace),
        )
        assert resp['Cache-Control'] == 'no-cache'
        b''.join(resp.streaming_content)


# ---------------------------------------------------------------------------
# SSE event payloads
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestSSEStreamEvents:
    @patch('search_app.api.views.django_rq')
    @patch('search_app.api.views.VaneService')
    def test_init_event_emitted(
        self, mock_vane_cls, mock_rq, api_client, workspace, session,
    ):
        mock_vane = MagicMock()
        mock_vane.search_stream.side_effect = make_vane_generator([
            {'type': 'response', 'data': 'x'},
            {'type': 'done'},
        ])
        mock_vane.default_model = 'gpt-4.1-mini'
        mock_vane_cls.return_value = mock_vane
        mock_rq.get_queue.return_value = MagicMock()

        resp = api_client.get(
            f'/api/chat/sessions/{session.id}/messages/stream/?content=hello',
            **_headers(workspace),
        )
        events = parse_sse(resp.streaming_content)

        assert events, "no SSE events emitted"
        first = events[0]
        assert first['_event'] == 'init'
        assert 'message_id' in first
        # user_message_id should match the freshly-persisted user msg
        user_msg = ChatMessage.objects.filter(
            session=session, role=ChatMessage.Role.USER,
        ).latest('created_at')
        assert first['message_id'] == str(user_msg.pk)

    @patch('search_app.api.views.django_rq')
    @patch('search_app.api.views.VaneService')
    def test_sources_event_emitted(
        self, mock_vane_cls, mock_rq, api_client, workspace, session,
    ):
        # Vane yields its own pre-built sources SSE event verbatim.
        sources_payload = [
            {'title': 'Example', 'url': 'https://ex.com', 'snippet': 's'},
        ]
        mock_vane = MagicMock()
        mock_vane.search_stream.side_effect = make_vane_generator([
            {'type': 'sources', 'data': sources_payload},
            {'type': 'response', 'data': 'answer'},
            {'type': 'done', 'answer': 'answer', 'sources': sources_payload},
        ])
        mock_vane.default_model = 'gpt-4.1-mini'
        mock_vane_cls.return_value = mock_vane
        mock_rq.get_queue.return_value = MagicMock()

        resp = api_client.get(
            f'/api/chat/sessions/{session.id}/messages/stream/?content=hi',
            **_headers(workspace),
        )
        events = parse_sse(resp.streaming_content)
        sources_events = [e for e in events if e.get('_event') == 'sources']
        assert len(sources_events) == 1
        assert sources_events[0]['sources'] == sources_payload

    @patch('search_app.api.views.django_rq')
    @patch('search_app.api.views.VaneService')
    def test_response_chunks_emitted(
        self, mock_vane_cls, mock_rq, api_client, workspace, session,
    ):
        mock_vane = MagicMock()
        mock_vane.search_stream.side_effect = make_vane_generator([
            {'type': 'response', 'data': 'Hello '},
            {'type': 'response', 'data': 'world'},
            {'type': 'done', 'answer': 'Hello world', 'sources': []},
        ])
        mock_vane.default_model = 'gpt-4.1-mini'
        mock_vane_cls.return_value = mock_vane
        mock_rq.get_queue.return_value = MagicMock()

        resp = api_client.get(
            f'/api/chat/sessions/{session.id}/messages/stream/?content=hi',
            **_headers(workspace),
        )
        events = parse_sse(resp.streaming_content)
        chunks = [e for e in events if e.get('_event') == 'chunk']
        assert [c['text'] for c in chunks] == ['Hello ', 'world']

    @patch('search_app.api.views.django_rq')
    @patch('search_app.api.views.VaneService')
    def test_done_event_emitted(
        self, mock_vane_cls, mock_rq, api_client, workspace, session,
    ):
        mock_vane = MagicMock()
        mock_vane.search_stream.side_effect = make_vane_generator([
            {'type': 'response', 'data': 'final answer'},
            {'type': 'done', 'answer': 'final answer', 'sources': []},
        ])
        mock_vane.default_model = 'gpt-4.1-mini'
        mock_vane_cls.return_value = mock_vane
        mock_rq.get_queue.return_value = MagicMock()

        resp = api_client.get(
            f'/api/chat/sessions/{session.id}/messages/stream/?content=hi',
            **_headers(workspace),
        )
        events = parse_sse(resp.streaming_content)
        done_events = [e for e in events if e.get('_event') == 'done']
        assert len(done_events) == 1
        # New SSE shape: done event carries `message_id` + `total_tokens`
        # (the answer text lives on the persisted ChatMessage row).
        assert 'message_id' in done_events[0]
        assistant_msg = ChatMessage.objects.filter(
            session=session, role=ChatMessage.Role.ASSISTANT,
        ).first()
        assert assistant_msg is not None
        assert assistant_msg.content == 'final answer'

    @patch('search_app.api.views.django_rq')
    @patch('search_app.api.views.VaneService')
    def test_error_event_on_vane_exception(
        self, mock_vane_cls, mock_rq, api_client, workspace, session,
    ):
        def _raising_stream(*args, **kwargs):
            yield f"data: {json.dumps({'type': 'response', 'data': 'partial'})}\n\n"
            raise VaneServiceError('upstream collapsed')

        mock_vane = MagicMock()
        mock_vane.search_stream.side_effect = _raising_stream
        mock_vane.default_model = 'gpt-4.1-mini'
        mock_vane_cls.return_value = mock_vane
        mock_rq.get_queue.return_value = MagicMock()

        resp = api_client.get(
            f'/api/chat/sessions/{session.id}/messages/stream/?content=hi',
            **_headers(workspace),
        )
        # Status itself is 200 — error is signalled in-band as SSE
        assert resp.status_code == 200
        events = parse_sse(resp.streaming_content)
        error_events = [e for e in events if e.get('_event') == 'error']
        assert len(error_events) == 1
        assert 'upstream collapsed' in error_events[0]['error']


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestSSEStreamPersistence:
    @patch('search_app.api.views.django_rq')
    @patch('search_app.api.views.VaneService')
    def test_assistant_message_persisted_after_done(
        self, mock_vane_cls, mock_rq, api_client, workspace, session,
    ):
        sources = [
            {'title': 'Doc', 'url': 'https://doc', 'snippet': 's'},
        ]
        mock_vane = MagicMock()
        mock_vane.search_stream.side_effect = make_vane_generator([
            {'type': 'sources', 'data': sources},
            {'type': 'response', 'data': 'hello world'},
            {
                'type': 'done',
                'answer': 'hello world',
                'sources': sources,
            },
        ])
        mock_vane.default_model = 'gpt-4.1-mini'
        mock_vane_cls.return_value = mock_vane
        mock_rq.get_queue.return_value = MagicMock()

        resp = api_client.get(
            f'/api/chat/sessions/{session.id}/messages/stream/?content=hi',
            **_headers(workspace),
        )
        b''.join(resp.streaming_content)  # drain

        assistant = ChatMessage.objects.get(
            session=session, role=ChatMessage.Role.ASSISTANT,
        )
        assert assistant.content == 'hello world'
        assert assistant.sources == sources
        assert assistant.message_type == ChatMessage.MessageType.SEARCH_RESULT

    @patch('search_app.api.views.django_rq')
    @patch('search_app.api.views.VaneService')
    def test_no_assistant_persisted_on_mid_stream_error(
        self, mock_vane_cls, mock_rq, api_client, workspace, session,
    ):
        def _raising_stream(*args, **kwargs):
            yield f"data: {json.dumps({'type': 'response', 'data': 'oops'})}\n\n"
            raise VaneServiceError('boom')

        mock_vane = MagicMock()
        mock_vane.search_stream.side_effect = _raising_stream
        mock_vane.default_model = 'gpt-4.1-mini'
        mock_vane_cls.return_value = mock_vane
        mock_rq.get_queue.return_value = MagicMock()

        resp = api_client.get(
            f'/api/chat/sessions/{session.id}/messages/stream/?content=hi',
            **_headers(workspace),
        )
        b''.join(resp.streaming_content)

        # User message persisted, assistant message NOT
        assert ChatMessage.objects.filter(
            session=session, role=ChatMessage.Role.USER,
        ).count() == 1
        assert ChatMessage.objects.filter(
            session=session, role=ChatMessage.Role.ASSISTANT,
        ).count() == 0

    @patch('search_app.api.views.django_rq')
    @patch('search_app.api.views.VaneService')
    def test_message_id_consistent(
        self, mock_vane_cls, mock_rq, api_client, workspace, session,
    ):
        """`init.user_message_id` matches the user ChatMessage row;
        `persisted.assistant_message_id` matches the assistant ChatMessage row.
        """
        mock_vane = MagicMock()
        mock_vane.search_stream.side_effect = make_vane_generator([
            {'type': 'response', 'data': 'answer'},
            {'type': 'done', 'answer': 'answer', 'sources': []},
        ])
        mock_vane.default_model = 'gpt-4.1-mini'
        mock_vane_cls.return_value = mock_vane
        mock_rq.get_queue.return_value = MagicMock()

        resp = api_client.get(
            f'/api/chat/sessions/{session.id}/messages/stream/?content=hi',
            **_headers(workspace),
        )
        events = parse_sse(resp.streaming_content)

        init_evt = next(e for e in events if e.get('_event') == 'init')
        persisted_evts = [e for e in events if e.get('_event') == 'done']
        assert len(persisted_evts) == 1

        user_msg = ChatMessage.objects.get(
            session=session, role=ChatMessage.Role.USER,
        )
        assistant_msg = ChatMessage.objects.get(
            session=session, role=ChatMessage.Role.ASSISTANT,
        )
        assert init_evt['message_id'] == str(user_msg.pk)
        # New shape: done event carries the assistant `message_id`.
        assert persisted_evts[0]['message_id'] == str(assistant_msg.pk)


# ---------------------------------------------------------------------------
# Mode routing (POST endpoint, where the classifier lives)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestSSEStreamModeRouting:
    """The GET /messages/stream/ endpoint is web-search-only by design.
    Mode classification + agent routing live on POST /messages/. These tests
    cover the classifier branches that drive the streaming flow.
    """

    @patch('search_app.api.views.django_rq')
    @patch('search_app.api.views.classify_mode')
    @patch('search_app.api.views.VaneService')
    def test_explicit_web_search_skips_classifier(
        self, mock_vane_cls, mock_classify, mock_rq,
        api_client, workspace, session,
    ):
        mock_vane = MagicMock()
        mock_vane.search.return_value = {
            'answer': 'a', 'sources': [], 'model_used': 'gpt-4.1-mini',
        }
        mock_vane_cls.return_value = mock_vane
        mock_rq.get_queue.return_value = MagicMock()

        resp = api_client.post(
            f'/api/chat/sessions/{session.id}/messages/',
            {'content': 'hi', 'mode_override': 'web_search'},
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 201
        mock_classify.assert_not_called()
        mock_vane.search.assert_called_once()

    @patch('search_app.api.views.django_rq')
    @patch('search_app.api.views.classify_mode')
    @patch('search_app.api.views.VaneService')
    def test_auto_mode_calls_classifier_then_vane(
        self, mock_vane_cls, mock_classify, mock_rq,
        api_client, workspace, session,
    ):
        mock_classify.return_value = {
            'mode': 'web_search', 'confidence': 0.9, 'reason': 'lookup',
        }
        mock_vane = MagicMock()
        mock_vane.search.return_value = {
            'answer': 'a', 'sources': [], 'model_used': 'gpt-4.1-mini',
        }
        mock_vane_cls.return_value = mock_vane
        mock_rq.get_queue.return_value = MagicMock()

        resp = api_client.post(
            f'/api/chat/sessions/{session.id}/messages/',
            {'content': 'what is camping?', 'mode_override': 'auto'},
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 201
        mock_classify.assert_called_once()
        mock_vane.search.assert_called_once()

    @patch('search_app.api.views.classify_mode')
    def test_agent_mode_returns_workflow_card_no_stream(
        self, mock_classify, api_client, workspace, session,
    ):
        # agent_app is installed in this codebase, so AgentSession will be
        # created and a workflow_card ChatMessage returned.
        try:
            import agent_app.models  # noqa: F401
        except ImportError:
            pytest.skip('agent_app not available')

        mock_classify.return_value = {
            'mode': 'agent', 'confidence': 0.95,
            'reason': 'multi-step task',
        }

        resp = api_client.post(
            f'/api/chat/sessions/{session.id}/messages/',
            {
                'content': 'research camping niche and create 3 designs',
                'mode_override': 'auto',
            },
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 201
        assert resp.data['mode'] == 'agent'
        assert 'agent_session_id' in resp.data
        # Workflow card persisted
        wf = ChatMessage.objects.filter(
            session=session,
            message_type=ChatMessage.MessageType.WORKFLOW_CARD,
        )
        assert wf.count() == 1


# ---------------------------------------------------------------------------
# Niche context
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestSSEStreamNicheContext:
    @patch('agent_app.agents.niche_chat_agent.run_chat')
    @patch('search_app.api.views.VaneService')
    def test_niche_session_routes_to_agent_not_vane(
        self, mock_vane_cls, mock_run_chat,
        api_client, workspace, user,
    ):
        """PROJ-29 Phase 1E: niche-bound sessions route to the niche-chat
        agent (``run_chat``), NOT Vane. Updated from the legacy contract
        where niche-bound sessions used Vane with build_system_instructions.
        """
        from niche_app.models import Niche
        niche = Niche.objects.create(
            workspace=workspace, name='Camping Dad', created_by=user,
        )
        sess = ChatSession.objects.create(
            workspace=workspace, created_by=user,
            title='Niche Session', niche_context=niche,
        )

        def _stub(session, message):  # noqa: ARG001
            yield {'event': 'init', 'data': {
                'session_id': str(session.id), 'mode': 'agent',
            }}
            yield {'event': 'done', 'data': {'final_answer': 'ok'}}
        mock_run_chat.side_effect = _stub

        mock_vane = MagicMock()
        mock_vane_cls.return_value = mock_vane

        resp = api_client.get(
            # Per-message routing: pass niche_id explicitly so the request
            # carries the chip equivalent.
            f'/api/chat/sessions/{sess.id}/messages/stream/?content=trends'
            f'&niche_id={niche.id}',
            **_headers(workspace),
        )
        b''.join(resp.streaming_content)

        assert resp.status_code == 200
        mock_run_chat.assert_called_once()
        # Vane path MUST NOT fire for niche-bound sessions.
        mock_vane.search_stream.assert_not_called()

    @patch('search_app.api.views.django_rq')
    @patch('search_app.api.views.VaneService')
    def test_no_niche_context_no_system_instructions(
        self, mock_vane_cls, mock_rq, api_client, workspace, session,
    ):
        mock_vane = MagicMock()
        mock_vane.search_stream.side_effect = make_vane_generator([
            {'type': 'response', 'data': 'a'},
            {'type': 'done', 'answer': 'a', 'sources': []},
        ])
        mock_vane.default_model = 'gpt-4.1-mini'
        mock_vane_cls.return_value = mock_vane
        mock_rq.get_queue.return_value = MagicMock()

        resp = api_client.get(
            f'/api/chat/sessions/{session.id}/messages/stream/?content=hi',
            **_headers(workspace),
        )
        b''.join(resp.streaming_content)

        kwargs = mock_vane.search_stream.call_args.kwargs
        assert kwargs.get('system_instructions') == ''
