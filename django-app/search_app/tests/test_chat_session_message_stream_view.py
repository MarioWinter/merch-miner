"""PROJ-29 Phase 1E — tests for ``ChatSessionMessageStreamView`` refactor.

Covers the niche-agent routing branch + SSE protocol additions + throttle
+ Langfuse trace wrap. Legacy Vane path regression is covered by the
existing ``test_sse_stream.py`` file (non-niche sessions are exercised
there).

Strategy:
- Mock ``agent_app.agents.niche_chat_agent.run_chat`` with a fixture
  generator yielding canonical event dicts (no real LLM, no real LangGraph).
- Mock ``VaneService`` so the non-niche regression path doesn't hit
  upstream HTTP.
"""
from __future__ import annotations

import json
import time
from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from niche_app.models import Niche
from search_app.models import ChatMessage, ChatSession
from workspace_app.models import Membership, Workspace

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def user(db):
    return User.objects.create_user(
        email='proj29-owner@example.com', password='testpass123',
    )


@pytest.fixture
def workspace(db, user):
    ws = Workspace.objects.create(
        name='PROJ-29 WS', slug='proj29-ws', owner=user,
    )
    Membership.objects.create(
        workspace=ws, user=user, role='admin', status='active',
    )
    return ws


@pytest.fixture
def niche(db, workspace, user):
    return Niche.objects.create(
        workspace=workspace, name='Camping Dads', created_by=user,
    )


@pytest.fixture
def niche_session(workspace, user, niche):
    return ChatSession.objects.create(
        workspace=workspace, created_by=user,
        title='Niche Session', niche_context=niche,
    )


@pytest.fixture
def legacy_session(workspace, user):
    return ChatSession.objects.create(
        workspace=workspace, created_by=user,
        title='Legacy Session', niche_context=None,
    )


@pytest.fixture
def api_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _headers(workspace):
    return {'HTTP_X_WORKSPACE_ID': str(workspace.id)}


# ---------------------------------------------------------------------------
# SSE parsing helper (mirrors test_sse_stream.py)
# ---------------------------------------------------------------------------

def parse_sse(streaming_content) -> list[dict]:
    """Realize a StreamingHttpResponse and parse SSE events."""
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


def make_run_chat_stub(events: list[dict]):
    """Build a generator factory mirroring ``run_chat``'s signature."""
    def _gen(session, message):  # noqa: ARG001 - signature match
        for evt in events:
            yield evt
    return _gen


# Vane stream stub for the legacy regression test.
def make_vane_generator(events: list[dict]):
    def _gen(*args, **kwargs):  # noqa: ARG001 - kwargs forwarded
        for ev in events:
            yield f"data: {json.dumps(ev)}\n\n"
    return _gen


# ---------------------------------------------------------------------------
# Routing — niche-context vs legacy Vane path
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestNicheAgentRouting:
    """When ``session.niche_context`` is set the view MUST route to
    ``run_chat``. When not set the legacy Vane path MUST be used (no agent
    overhead)."""

    @patch('search_app.api.views.django_rq')
    @patch('search_app.api.views.VaneService')
    def test_legacy_session_uses_vane_not_agent(
        self, mock_vane_cls, mock_rq,
        api_client, workspace, legacy_session,
    ):
        mock_vane = MagicMock()
        mock_vane.search_stream.side_effect = make_vane_generator([
            {'type': 'response', 'data': 'hi'},
            {'type': 'done', 'answer': 'hi', 'sources': []},
        ])
        mock_vane.default_model = 'gpt-4.1-mini'
        mock_vane_cls.return_value = mock_vane
        mock_rq.get_queue.return_value = MagicMock()

        with patch(
            'agent_app.agents.niche_chat_agent.run_chat'
        ) as mock_run_chat:
            resp = api_client.get(
                f'/api/chat/sessions/{legacy_session.id}/messages/stream/'
                f'?content=hello',
                **_headers(workspace),
            )
            # Drain so generators complete cleanly.
            b''.join(resp.streaming_content)

        assert resp.status_code == 200
        mock_run_chat.assert_not_called()
        # Legacy Vane path emits chunks via Vane's search_stream.
        mock_vane.search_stream.assert_called_once()

    def test_niche_session_routes_through_agent(
        self, api_client, workspace, niche_session,
    ):
        canonical = [
            {'event': 'init', 'data': {
                'session_id': str(niche_session.id), 'mode': 'agent',
            }},
            {'event': 'stage', 'data': {'stage': 'thinking'}},
            {'event': 'tool_call', 'data': {
                'tool': 'top_keywords', 'args': {'limit': 5},
            }},
            {'event': 'tool_result', 'data': {
                'tool': 'top_keywords', 'duration_ms': 12,
                'output_preview': '[{...}]',
            }},
            {'event': 'tool_call', 'data': {
                'tool': 'search_slogans', 'args': {'query': 'tight lines'},
            }},
            {'event': 'tool_result', 'data': {
                'tool': 'search_slogans', 'duration_ms': 42,
                'output_preview': '[{chunk_text: ...}]',
            }},
            {'event': 'chunks_used', 'data': {'chunks': [
                {
                    'chunk_text': 'Camping Dad slogan example',
                    'content_subtype': 'slogan',
                    'source_pk': 'idea-123',
                    'score': 0.91,
                },
            ]}},
            {'event': 'chunk', 'data': {'delta': 'Try '}},
            {'event': 'chunk', 'data': {'delta': 'these slogans'}},
            {'event': 'done', 'data': {'final_answer': 'Try these slogans'}},
            {'event': 'follow_ups', 'data': {'suggestions': [
                'More like this', 'Why does this work?', 'Add to niche',
            ]}},
        ]

        with patch(
            'agent_app.agents.niche_chat_agent.run_chat',
            side_effect=make_run_chat_stub(canonical),
        ):
            resp = api_client.get(
                f'/api/chat/sessions/{niche_session.id}/messages/stream/'
                f'?content=hi',
                **_headers(workspace),
            )
            events = parse_sse(resp.streaming_content)

        assert resp.status_code == 200
        assert resp['Content-Type'].startswith('text/event-stream')
        assert resp['X-Accel-Buffering'] == 'no'

        # The expected ordered subset (heartbeats may interleave when the
        # producer thread happens to block; the test seeds a fast stub so
        # they should not in practice, but we filter just in case).
        non_heartbeats = [e for e in events if e['_event'] != 'heartbeat']
        names = [e['_event'] for e in non_heartbeats]

        # Required event types present in the documented order.
        assert names[0] == 'init'
        assert 'stage' in names
        assert names.index('tool_call') < names.index('tool_result')
        assert 'chunks_used' in names
        assert 'chunk' in names
        assert 'done' in names
        assert 'follow_ups' in names
        # chunks_used MUST fire before done (UI clears citation state).
        assert names.index('chunks_used') < names.index('done')
        # follow_ups MUST fire AFTER done.
        assert names.index('done') < names.index('follow_ups')

        # Assistant message persisted with the streamed final_answer.
        assistant = ChatMessage.objects.get(
            session=niche_session, role=ChatMessage.Role.ASSISTANT,
        )
        assert assistant.content == 'Try these slogans'


# ---------------------------------------------------------------------------
# DRF chat_agent throttle (30/min)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestChatAgentThrottle:
    """``chat_agent`` scope = 30/min via ``ScopedRateThrottle``.

    The autouse ``disable_throttling`` conftest fixture clears
    ``DEFAULT_THROTTLE_CLASSES`` — we restore them locally to verify the
    scope-isolation contract.
    """

    def _enable_throttling(self, settings_obj, rate='30/min'):
        """Enable the ``chat_agent`` scope at ``rate``.

        DRF's ``SimpleRateThrottle.THROTTLE_RATES`` is captured at class
        definition time from ``api_settings.DEFAULT_THROTTLE_RATES`` — so
        flipping settings + ``api_settings.reload()`` is not enough. We must
        also overwrite the class attribute so the active rate is read
        correctly when ``ScopedRateThrottle.allow_request`` fires.
        """
        from rest_framework.settings import api_settings
        from rest_framework.throttling import (
            ScopedRateThrottle, SimpleRateThrottle,
        )
        from django.core.cache import cache as django_cache

        new_rates = {
            'chat_agent': rate,
            'user': '10000/day',
            'anon': '10000/day',
        }
        settings_obj.REST_FRAMEWORK = {
            **settings_obj.REST_FRAMEWORK,
            'DEFAULT_THROTTLE_CLASSES': [
                'rest_framework.throttling.ScopedRateThrottle',
            ],
            'DEFAULT_THROTTLE_RATES': new_rates,
        }
        api_settings.reload()
        # SimpleRateThrottle.THROTTLE_RATES is a snapshot captured at class
        # definition; override it explicitly to reflect the test rate.
        SimpleRateThrottle.THROTTLE_RATES = new_rates
        ScopedRateThrottle.THROTTLE_RATES = new_rates
        django_cache.clear()

    def test_31st_call_returns_429(
        self, api_client, workspace, niche_session, settings,
    ):
        """30 streams succeed within a minute; the 31st returns 429."""
        self._enable_throttling(settings, rate='30/min')

        canonical = [
            {'event': 'init', 'data': {
                'session_id': str(niche_session.id), 'mode': 'agent',
            }},
            {'event': 'stage', 'data': {'stage': 'thinking'}},
            {'event': 'chunks_used', 'data': {'chunks': []}},
            {'event': 'done', 'data': {'final_answer': 'ok'}},
        ]

        with patch(
            'agent_app.agents.niche_chat_agent.run_chat',
            side_effect=make_run_chat_stub(canonical),
        ):
            for i in range(30):
                resp = api_client.get(
                    f'/api/chat/sessions/{niche_session.id}/messages/stream/'
                    f'?content=ping-{i}',
                    **_headers(workspace),
                )
                # Drain to release the streaming response cleanly.
                b''.join(resp.streaming_content)
                assert resp.status_code == 200, (
                    f'call #{i + 1} unexpectedly throttled '
                    f'(status={resp.status_code})'
                )

            # 31st call within the same minute window -> 429.
            resp = api_client.get(
                f'/api/chat/sessions/{niche_session.id}/messages/stream/'
                f'?content=ping-31',
                **_headers(workspace),
            )

        assert resp.status_code == 429
        assert 'Retry-After' in resp.headers or 'retry-after' in {
            k.lower() for k in resp.headers
        }

    def test_throttle_isolation_other_endpoints_unaffected(
        self, api_client, workspace, niche_session, settings,
    ):
        """After the chat-agent bucket is drained, the user can still hit
        other endpoints (different throttle bucket / no chat_agent scope)."""
        self._enable_throttling(settings, rate='1/min')

        canonical = [
            {'event': 'init', 'data': {
                'session_id': str(niche_session.id), 'mode': 'agent',
            }},
            {'event': 'done', 'data': {'final_answer': 'ok'}},
        ]

        with patch(
            'agent_app.agents.niche_chat_agent.run_chat',
            side_effect=make_run_chat_stub(canonical),
        ):
            ok = api_client.get(
                f'/api/chat/sessions/{niche_session.id}/messages/stream/'
                f'?content=first',
                **_headers(workspace),
            )
            b''.join(ok.streaming_content)
            assert ok.status_code == 200

            throttled = api_client.get(
                f'/api/chat/sessions/{niche_session.id}/messages/stream/'
                f'?content=second',
                **_headers(workspace),
            )
        assert throttled.status_code == 429

        # Non-chat endpoint (sessions list) MUST still return 200 — different
        # scope bucket entirely.
        sessions_resp = api_client.get(
            '/api/chat/sessions/', **_headers(workspace),
        )
        assert sessions_resp.status_code == 200


# ---------------------------------------------------------------------------
# Heartbeat injection
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestHeartbeat:
    """``_wrap_with_heartbeat`` injects ``{event: heartbeat}`` events when the
    underlying generator blocks longer than the interval."""

    def test_heartbeat_fires_during_long_tool_call(
        self, api_client, workspace, niche_session,
    ):
        # Simulate a slow producer: yield ``init``, sleep > interval, then
        # yield the rest. The view's heartbeat wrapper (3s default) is
        # patched to 0.2s so the test runs in well under a second.
        def slow_run_chat(session, message):  # noqa: ARG001
            yield {'event': 'init', 'data': {
                'session_id': str(session.id), 'mode': 'agent',
            }}
            time.sleep(0.6)
            yield {'event': 'chunks_used', 'data': {'chunks': []}}
            yield {'event': 'done', 'data': {'final_answer': 'late'}}

        original_wrap = None
        from search_app.api import views as views_module
        original_wrap = views_module._wrap_with_heartbeat

        def fast_wrap(gen, interval_s=0.2):
            return original_wrap(gen, interval_s=interval_s)

        with patch(
            'agent_app.agents.niche_chat_agent.run_chat',
            side_effect=slow_run_chat,
        ), patch.object(
            views_module, '_wrap_with_heartbeat', side_effect=fast_wrap,
        ):
            resp = api_client.get(
                f'/api/chat/sessions/{niche_session.id}/messages/stream/'
                f'?content=hello',
                **_headers(workspace),
            )
            events = parse_sse(resp.streaming_content)

        assert resp.status_code == 200
        heartbeats = [e for e in events if e['_event'] == 'heartbeat']
        assert len(heartbeats) >= 1, (
            f'expected at least 1 heartbeat, got events: '
            f'{[e["_event"] for e in events]}'
        )
        # Heartbeat payload carries elapsed_ms (sanity check the shape).
        assert 'elapsed_ms' in heartbeats[0]


# ---------------------------------------------------------------------------
# tool_timeout — emitted in place of tool_result
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestToolTimeoutEvent:
    """When the agent's tool wrapper returns the structured timeout error,
    ``run_chat`` MUST emit ``tool_timeout`` (NOT ``tool_result``)."""

    def test_tool_timeout_emitted_in_place_of_tool_result(
        self, api_client, workspace, niche_session,
    ):
        canonical = [
            {'event': 'init', 'data': {
                'session_id': str(niche_session.id), 'mode': 'agent',
            }},
            {'event': 'stage', 'data': {'stage': 'thinking'}},
            {'event': 'tool_call', 'data': {
                'tool': 'web_search', 'args': {'query': 'x'},
            }},
            {'event': 'tool_timeout', 'data': {
                'tool': 'web_search',
                'duration_ms': 30000,
                'output_preview': '{error: tool_timeout, ...}',
            }},
            {'event': 'chunks_used', 'data': {'chunks': []}},
            {'event': 'chunk', 'data': {'delta': 'Could not search.'}},
            {'event': 'done', 'data': {
                'final_answer': 'Could not search.',
            }},
        ]

        with patch(
            'agent_app.agents.niche_chat_agent.run_chat',
            side_effect=make_run_chat_stub(canonical),
        ):
            resp = api_client.get(
                f'/api/chat/sessions/{niche_session.id}/messages/stream/'
                f'?content=do-it',
                **_headers(workspace),
            )
            events = parse_sse(resp.streaming_content)

        names = [e['_event'] for e in events if e['_event'] != 'heartbeat']
        assert 'tool_timeout' in names
        assert 'tool_result' not in names
        # Final answer still delivered (graceful degradation).
        assert 'done' in names

        timeout_evt = next(e for e in events if e['_event'] == 'tool_timeout')
        assert timeout_evt['tool'] == 'web_search'
        assert timeout_evt['duration_ms'] == 30000


# ---------------------------------------------------------------------------
# Langfuse trace wrap (graceful no-op when keys absent)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestLangfuseTraceWrap:
    """The view invokes ``get_langfuse_handler`` once per request. With
    Langfuse keys missing the handler returns ``None`` — the stream MUST
    still complete normally (graceful no-op)."""

    def test_langfuse_handler_invoked_per_request(
        self, api_client, workspace, niche_session,
    ):
        canonical = [
            {'event': 'init', 'data': {
                'session_id': str(niche_session.id), 'mode': 'agent',
            }},
            {'event': 'done', 'data': {'final_answer': 'hello'}},
        ]

        with patch(
            'agent_app.agents.niche_chat_agent.run_chat',
            side_effect=make_run_chat_stub(canonical),
        ), patch(
            'core.observability.langfuse_handler.get_langfuse_handler',
            return_value=None,
        ) as mock_handler:
            resp = api_client.get(
                f'/api/chat/sessions/{niche_session.id}/messages/stream/'
                f'?content=hi',
                **_headers(workspace),
            )
            b''.join(resp.streaming_content)

        assert resp.status_code == 200
        mock_handler.assert_called_once()
        call_kwargs = mock_handler.call_args.kwargs
        assert call_kwargs['trace_name'] == 'chat_session_stream'
        assert call_kwargs['trace_id'] == str(niche_session.id)
        metadata = call_kwargs['metadata']
        assert metadata['workspace_id'] == str(workspace.id)
        assert metadata['niche_context_id'] == str(niche_session.niche_context.id)
        assert metadata['mode'] == 'agent'


# ---------------------------------------------------------------------------
# generate_slogans_payload special-case
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestGenerateSlogansPayloadEvent:
    """When ``run_chat`` yields a ``generate_slogans_payload`` event the view
    MUST serialize it without dropping its structured fields."""

    def test_generate_slogans_payload_passthrough(
        self, api_client, workspace, niche_session,
    ):
        slogan_payload = {
            'slogans': [
                {
                    'slogan_text': 'Pitched and present',
                    'signal_type': 'self',
                    'pattern_used': 'IDENTITY_DECLARATION',
                    'stylistic_device': 'DECLARATION',
                    'emotional_archetype': ['Explorer'],
                    'creative_modules_used': [],
                    'buyer_voice_pattern': '',
                    'why_it_works': '',
                    'market_confidence': 'Medium',
                },
            ],
            'warnings': [],
        }
        canonical = [
            {'event': 'init', 'data': {
                'session_id': str(niche_session.id), 'mode': 'agent',
            }},
            {'event': 'tool_call', 'data': {
                'tool': 'generate_slogans', 'args': {'count': 1},
            }},
            {'event': 'tool_result', 'data': {
                'tool': 'generate_slogans', 'duration_ms': 1234,
                'output_preview': '{slogans: [...]}',
            }},
            {'event': 'generate_slogans_payload', 'data': slogan_payload},
            {'event': 'chunks_used', 'data': {'chunks': []}},
            {'event': 'chunk', 'data': {'delta': 'Here is 1 slogan.'}},
            {'event': 'done', 'data': {'final_answer': 'Here is 1 slogan.'}},
        ]

        with patch(
            'agent_app.agents.niche_chat_agent.run_chat',
            side_effect=make_run_chat_stub(canonical),
        ):
            resp = api_client.get(
                f'/api/chat/sessions/{niche_session.id}/messages/stream/'
                f'?content=generate-1',
                **_headers(workspace),
            )
            events = parse_sse(resp.streaming_content)

        payload_evt = next(
            e for e in events if e['_event'] == 'generate_slogans_payload'
        )
        # Strip the _event marker added by the SSE parser before comparing.
        del payload_evt['_event']
        assert payload_evt == slogan_payload
