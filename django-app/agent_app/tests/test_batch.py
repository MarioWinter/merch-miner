"""Phase 6 — Batch + Rate Limiting tests.

Covers:
    - AC-31: POST /api/agent/sessions/batch/ creates one session per niche
             with shared batch_id; cross-workspace niche_ids rejected.
    - AC-32: Sequential (default) — only first sibling enqueued; chains
             on completion. Parallel — all siblings enqueued upfront.
    - AC-33: GET /api/agent/sessions/?batch_id=<uuid> returns siblings.
             AgentSessionListSerializer exposes batch_id + batch_position.
    - AC-44: agents/llm.py uses OPENROUTER_AGENT_API_KEY.
    - AC-45: OpenRouter 402 → session paused + "Agent budget exhausted"
             SYSTEM message; budget_guard.is_budget_error covers shapes.
    - AC-46: cost_tracker.maybe_emit_budget_warning emits at 80% then
             de-dups for 24h via cache.
    - AC-47: AgentActionLog.cost_estimate populated by permission_checker
             on every tool call (smoke test).
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from agent_app.models import (
    ActionStatus,
    AgentActionLog,
    AgentMessage,
    AgentSession,
    MessageRole,
    SessionSource,
    SessionStatus,
)
from agent_app.services import batch_runner, budget_guard, cost_tracker
from agent_app.tasks import run_agent_workflow

pytestmark = pytest.mark.django_db


# ── Fixtures ───────────────────────────────────────────────────────────────


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        email='batch@test.com', password='testpass123',
    )


@pytest.fixture
def workspace(user):
    from workspace_app.models import Membership
    membership = Membership.objects.get(user=user, status='active')
    return membership.workspace


@pytest.fixture
def other_workspace(django_user_model):
    other = django_user_model.objects.create_user(
        email='other@test.com', password='testpass123',
    )
    from workspace_app.models import Membership
    membership = Membership.objects.get(user=other, status='active')
    return membership.workspace


@pytest.fixture
def api_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def niches(workspace, user):
    from niche_app.models import Niche
    return [
        Niche.objects.create(workspace=workspace, name=f'N{i}', created_by=user)
        for i in range(3)
    ]


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


# ── AC-31: Batch creation ──────────────────────────────────────────────────


class TestAC31BatchCreate:
    def test_creates_one_session_per_niche_with_shared_batch_id(
        self, api_client, workspace, niches, monkeypatch,
    ):
        # Stub RQ enqueue so we don't try to actually run anything.
        enqueued = []
        monkeypatch.setattr(
            'agent_app.api.views.django_rq.get_queue',
            lambda name: type('Q', (), {
                'enqueue': lambda self, *a, **k: enqueued.append((a, k)),
            })(),
        )

        resp = api_client.post('/api/agent/sessions/batch/', {
            'niche_ids': [str(n.id) for n in niches],
            'workflow_template': '',
            'parallel': False,
        }, format='json')

        assert resp.status_code == 201
        body = resp.data
        assert 'batch_id' in body
        assert len(body['session_ids']) == 3
        assert body['parallel'] is False
        assert body['status'] == 'queued'

        sessions = AgentSession.objects.filter(
            batch_id=uuid.UUID(body['batch_id']),
        ).order_by('batch_position')
        assert sessions.count() == 3
        # All sessions share the same batch_id.
        assert len({s.batch_id for s in sessions}) == 1
        # batch_position is contiguous starting at 0.
        assert [s.batch_position for s in sessions] == [0, 1, 2]
        # source flagged as batch_api (AC-31).
        assert all(s.source == SessionSource.BATCH_API for s in sessions)
        # Niche order preserved.
        for s, n in zip(sessions, niches):
            assert s.niche_context_id == n.id

    def test_cross_workspace_niche_rejected(
        self, api_client, workspace, other_workspace,
    ):
        from niche_app.models import Niche
        # Niche owned by a different workspace.
        other_niche = Niche.objects.create(
            workspace=other_workspace,
            name='Foreign',
            created_by=other_workspace.owner,
        )
        resp = api_client.post('/api/agent/sessions/batch/', {
            'niche_ids': [str(other_niche.id)],
        }, format='json')
        assert resp.status_code == 400
        assert 'missing_niche_ids' in resp.data
        assert AgentSession.objects.count() == 0

    def test_unknown_niche_id_rejected(self, api_client, workspace):
        random_id = str(uuid.uuid4())
        resp = api_client.post('/api/agent/sessions/batch/', {
            'niche_ids': [random_id],
        }, format='json')
        assert resp.status_code == 400
        assert random_id in resp.data['missing_niche_ids']

    def test_autonomy_preset_propagated(
        self, api_client, workspace, niches, monkeypatch,
    ):
        monkeypatch.setattr(
            'agent_app.api.views.django_rq.get_queue',
            lambda name: type('Q', (), {
                'enqueue': lambda self, *a, **k: None,
            })(),
        )
        resp = api_client.post('/api/agent/sessions/batch/', {
            'niche_ids': [str(niches[0].id)],
            'autonomy_preset': 'autonomous',
        }, format='json')
        assert resp.status_code == 201
        s = AgentSession.objects.get(id=resp.data['session_ids'][0])
        assert s.autonomy_preset == 'autonomous'


# ── AC-32: Sequential vs parallel enqueue ──────────────────────────────────


class TestAC32SequentialVsParallel:
    def test_sequential_enqueues_only_first(
        self, api_client, workspace, niches, monkeypatch,
    ):
        enqueued_ids: list[str] = []

        def fake_enqueue(self, fn, *args, **kwargs):
            enqueued_ids.append(args[0])

        monkeypatch.setattr(
            'agent_app.api.views.django_rq.get_queue',
            lambda name: type('Q', (), {'enqueue': fake_enqueue})(),
        )

        resp = api_client.post('/api/agent/sessions/batch/', {
            'niche_ids': [str(n.id) for n in niches],
            'parallel': False,
        }, format='json')
        assert resp.status_code == 201
        # Only the FIRST sibling enqueued (others chained on completion).
        assert len(enqueued_ids) == 1
        assert enqueued_ids[0] == resp.data['session_ids'][0]

    def test_parallel_enqueues_all(
        self, api_client, workspace, niches, monkeypatch,
    ):
        enqueued_ids: list[str] = []

        def fake_enqueue(self, fn, *args, **kwargs):
            enqueued_ids.append(args[0])

        monkeypatch.setattr(
            'agent_app.api.views.django_rq.get_queue',
            lambda name: type('Q', (), {'enqueue': fake_enqueue})(),
        )

        resp = api_client.post('/api/agent/sessions/batch/', {
            'niche_ids': [str(n.id) for n in niches],
            'parallel': True,
        }, format='json')
        assert resp.status_code == 201
        assert len(enqueued_ids) == 3
        assert set(enqueued_ids) == set(resp.data['session_ids'])

    def test_chain_next_after_completion(
        self, workspace, user, niches, monkeypatch,
    ):
        """When a sequential session completes, the next IDLE sibling enqueues."""
        bid = uuid.uuid4()
        s1 = AgentSession.objects.create(
            workspace=workspace, created_by=user, niche_context=niches[0],
            batch_id=bid, batch_position=0, status=SessionStatus.IDLE,
        )
        s2 = AgentSession.objects.create(
            workspace=workspace, created_by=user, niche_context=niches[1],
            batch_id=bid, batch_position=1, status=SessionStatus.IDLE,
        )
        s3 = AgentSession.objects.create(
            workspace=workspace, created_by=user, niche_context=niches[2],
            batch_id=bid, batch_position=2, status=SessionStatus.IDLE,
        )

        enqueued: list[str] = []
        monkeypatch.setattr(
            'agent_app.services.batch_runner.django_rq.get_queue',
            lambda name: type('Q', (), {
                'enqueue': lambda self, fn, *a, **k: enqueued.append(a[0]),
            })(),
        )
        # Stub orchestrator to "complete" the session.
        monkeypatch.setattr(
            'agent_app.agents.orchestrator.run_orchestrator',
            lambda s, resume=False: None,
        )

        run_agent_workflow(str(s1.id))

        s1.refresh_from_db()
        assert s1.status == SessionStatus.COMPLETED
        # AC-32: next sibling (s2) was enqueued.
        assert enqueued == [str(s2.id)]
        # s3 remains IDLE — chained later when s2 completes.
        s3.refresh_from_db()
        assert s3.status == SessionStatus.IDLE

    def test_failed_session_still_chains(
        self, workspace, user, niches, monkeypatch,
    ):
        """EC-8: per-niche failure does NOT halt the rest of the batch."""
        bid = uuid.uuid4()
        s1 = AgentSession.objects.create(
            workspace=workspace, created_by=user, niche_context=niches[0],
            batch_id=bid, batch_position=0, status=SessionStatus.IDLE,
        )
        s2 = AgentSession.objects.create(
            workspace=workspace, created_by=user, niche_context=niches[1],
            batch_id=bid, batch_position=1, status=SessionStatus.IDLE,
        )

        enqueued: list[str] = []
        monkeypatch.setattr(
            'agent_app.services.batch_runner.django_rq.get_queue',
            lambda name: type('Q', (), {
                'enqueue': lambda self, fn, *a, **k: enqueued.append(a[0]),
            })(),
        )

        def boom(s, resume=False):
            raise RuntimeError('niche failed')

        monkeypatch.setattr(
            'agent_app.agents.orchestrator.run_orchestrator', boom,
        )

        run_agent_workflow(str(s1.id))

        s1.refresh_from_db()
        assert s1.status == SessionStatus.FAILED
        # Next sibling enqueued despite failure.
        assert enqueued == [str(s2.id)]

    def test_paused_for_approval_does_not_chain(
        self, workspace, user, niches, monkeypatch,
    ):
        """Explicit pause (approval / budget) does NOT auto-advance the batch."""
        bid = uuid.uuid4()
        s1 = AgentSession.objects.create(
            workspace=workspace, created_by=user, niche_context=niches[0],
            batch_id=bid, batch_position=0, status=SessionStatus.IDLE,
        )
        AgentSession.objects.create(
            workspace=workspace, created_by=user, niche_context=niches[1],
            batch_id=bid, batch_position=1, status=SessionStatus.IDLE,
        )

        enqueued: list[str] = []
        monkeypatch.setattr(
            'agent_app.services.batch_runner.django_rq.get_queue',
            lambda name: type('Q', (), {
                'enqueue': lambda self, fn, *a, **k: enqueued.append(a[0]),
            })(),
        )

        def pause_session(s, resume=False):
            AgentSession.objects.filter(pk=s.pk).update(
                status=SessionStatus.PAUSED,
            )

        monkeypatch.setattr(
            'agent_app.agents.orchestrator.run_orchestrator', pause_session,
        )

        run_agent_workflow(str(s1.id))

        s1.refresh_from_db()
        assert s1.status == SessionStatus.PAUSED
        # No chaining — user must resume manually.
        assert enqueued == []

    def test_find_next_skips_running(
        self, workspace, user, niches,
    ):
        bid = uuid.uuid4()
        s1 = AgentSession.objects.create(
            workspace=workspace, created_by=user, niche_context=niches[0],
            batch_id=bid, batch_position=0, status=SessionStatus.COMPLETED,
        )
        AgentSession.objects.create(
            workspace=workspace, created_by=user, niche_context=niches[1],
            batch_id=bid, batch_position=1, status=SessionStatus.RUNNING,
        )
        s3 = AgentSession.objects.create(
            workspace=workspace, created_by=user, niche_context=niches[2],
            batch_id=bid, batch_position=2, status=SessionStatus.IDLE,
        )
        # Skip the RUNNING one and pick the next IDLE.
        nxt = batch_runner.find_next_in_batch(s1)
        assert nxt is not None
        assert nxt.id == s3.id

    def test_find_next_returns_none_when_all_done(
        self, workspace, user, niches,
    ):
        bid = uuid.uuid4()
        s1 = AgentSession.objects.create(
            workspace=workspace, created_by=user, niche_context=niches[0],
            batch_id=bid, batch_position=0, status=SessionStatus.COMPLETED,
        )
        AgentSession.objects.create(
            workspace=workspace, created_by=user, niche_context=niches[1],
            batch_id=bid, batch_position=1, status=SessionStatus.COMPLETED,
        )
        assert batch_runner.find_next_in_batch(s1) is None

    def test_find_next_returns_none_for_non_batch_session(
        self, workspace, user,
    ):
        s = AgentSession.objects.create(
            workspace=workspace, created_by=user, status=SessionStatus.COMPLETED,
        )
        assert batch_runner.find_next_in_batch(s) is None


# ── AC-33: Batch progress visible via list filter ──────────────────────────


class TestAC33BatchProgressVisible:
    def test_list_filter_by_batch_id(
        self, api_client, workspace, user, niches, monkeypatch,
    ):
        monkeypatch.setattr(
            'agent_app.api.views.django_rq.get_queue',
            lambda name: type('Q', (), {
                'enqueue': lambda self, *a, **k: None,
            })(),
        )
        # Create batch via API to get a real batch_id.
        resp = api_client.post('/api/agent/sessions/batch/', {
            'niche_ids': [str(n.id) for n in niches],
            'parallel': True,
        }, format='json')
        assert resp.status_code == 201
        batch_id = resp.data['batch_id']

        # Also create a non-batch session — must NOT show in the filter.
        AgentSession.objects.create(
            workspace=workspace, created_by=user, title='Solo',
        )

        list_resp = api_client.get(f'/api/agent/sessions/?batch_id={batch_id}')
        assert list_resp.status_code == 200
        results = list_resp.data['results']
        assert len(results) == 3
        assert all(r['batch_id'] == batch_id for r in results)
        # Sorted by batch_position ascending.
        positions = [r['batch_position'] for r in results]
        assert positions == sorted(positions)

    def test_list_invalid_batch_id_400(self, api_client, workspace):
        resp = api_client.get('/api/agent/sessions/?batch_id=not-a-uuid')
        assert resp.status_code == 400


# ── AC-44: Agent-specific OpenRouter API key ───────────────────────────────


class TestAC44AgentApiKeyIsolated:
    def test_llm_uses_agent_key_when_set(self, settings, workspace):
        settings.OPENROUTER_AGENT_API_KEY = 'sk-agent-isolated'
        settings.OPENROUTER_API_KEY = 'sk-main-fallback'

        from agent_app.agents import llm
        with patch.object(llm, 'ChatOpenAI') as mock_llm:
            llm.get_llm_for_agent(workspace, 'orchestrator')
            kwargs = mock_llm.call_args.kwargs
            assert kwargs['api_key'] == 'sk-agent-isolated'

    def test_llm_falls_back_to_main_key(self, settings, workspace):
        settings.OPENROUTER_AGENT_API_KEY = ''
        settings.OPENROUTER_API_KEY = 'sk-main-fallback'

        from agent_app.agents import llm
        with patch.object(llm, 'ChatOpenAI') as mock_llm:
            llm.get_llm_for_agent(workspace, 'orchestrator')
            kwargs = mock_llm.call_args.kwargs
            assert kwargs['api_key'] == 'sk-main-fallback'


# ── AC-45: OpenRouter 402 → pause + budget exhausted message ───────────────


class TestAC45BudgetExhausted:
    def test_is_budget_error_detects_status_code(self):
        class FakeStatusError(Exception):
            status_code = 402

        assert budget_guard.is_budget_error(FakeStatusError('out of credits'))

    def test_is_budget_error_detects_response_status(self):
        class FakeResponse:
            status_code = 402

        class FakeHttpxError(Exception):
            response = FakeResponse()

        assert budget_guard.is_budget_error(FakeHttpxError('Payment Required'))

    def test_is_budget_error_detects_message_keywords(self):
        assert budget_guard.is_budget_error(
            RuntimeError('insufficient_quota for OpenRouter'),
        )
        assert budget_guard.is_budget_error(
            RuntimeError('Payment Required: top up your account'),
        )
        assert budget_guard.is_budget_error(
            RuntimeError('Error 402 from upstream'),
        )

    def test_is_budget_error_walks_cause_chain(self):
        class FakeStatusError(Exception):
            status_code = 402

        outer = RuntimeError('langchain wrapper')
        outer.__cause__ = FakeStatusError('upstream')
        assert budget_guard.is_budget_error(outer)

    def test_is_budget_error_false_for_unrelated(self):
        assert not budget_guard.is_budget_error(RuntimeError('niche not found'))
        assert not budget_guard.is_budget_error(None)

    def test_pause_for_budget_flips_status_and_emits_message(
        self, workspace, user,
    ):
        s = AgentSession.objects.create(
            workspace=workspace, created_by=user,
            status=SessionStatus.RUNNING,
        )
        budget_guard.pause_for_budget(s)
        s.refresh_from_db()
        assert s.status == SessionStatus.PAUSED
        assert s.error_message == budget_guard.BUDGET_EXHAUSTED_MESSAGE
        assert AgentMessage.objects.filter(
            session=s,
            role=MessageRole.SYSTEM,
            content=budget_guard.BUDGET_EXHAUSTED_MESSAGE,
        ).exists()

    def test_pause_for_budget_idempotent(self, workspace, user):
        s = AgentSession.objects.create(
            workspace=workspace, created_by=user,
            status=SessionStatus.RUNNING,
        )
        budget_guard.pause_for_budget(s)
        budget_guard.pause_for_budget(s)
        # Single message even after two calls.
        assert AgentMessage.objects.filter(
            session=s,
            role=MessageRole.SYSTEM,
            content=budget_guard.BUDGET_EXHAUSTED_MESSAGE,
        ).count() == 1

    def test_run_workflow_402_pauses_instead_of_failing(
        self, workspace, user, monkeypatch,
    ):
        s = AgentSession.objects.create(
            workspace=workspace, created_by=user,
            status=SessionStatus.IDLE,
        )

        class FakeStatusError(Exception):
            status_code = 402

        def boom(session, resume=False):
            raise FakeStatusError('OpenRouter: Payment Required')

        monkeypatch.setattr(
            'agent_app.agents.orchestrator.run_orchestrator', boom,
        )

        run_agent_workflow(str(s.id))

        s.refresh_from_db()
        assert s.status == SessionStatus.PAUSED
        assert s.error_message == budget_guard.BUDGET_EXHAUSTED_MESSAGE
        # System message in chat
        assert AgentMessage.objects.filter(
            session=s,
            role=MessageRole.SYSTEM,
            content=budget_guard.BUDGET_EXHAUSTED_MESSAGE,
        ).exists()


# ── AC-46: Soft warning at 80% threshold ───────────────────────────────────


class TestAC46BudgetWarning:
    def _session(self, workspace, user):
        return AgentSession.objects.create(
            workspace=workspace, created_by=user,
            status=SessionStatus.RUNNING,
        )

    def _set_threshold(self, monkeypatch, value: str):
        monkeypatch.setenv('AGENT_BUDGET_WARNING_THRESHOLD', value)

    def _add_cost(self, session, user, amount: Decimal):
        AgentActionLog.objects.create(
            session=session,
            workspace=session.workspace,
            user=user,
            agent_type='research',
            action='trigger_deep_research',
            cost_estimate=amount,
            status=ActionStatus.COMPLETED,
        )

    def test_no_warning_under_threshold(
        self, workspace, user, monkeypatch,
    ):
        self._set_threshold(monkeypatch, '10.0')
        s = self._session(workspace, user)
        # 50% of threshold — well under 80%.
        self._add_cost(s, user, Decimal('5.00'))
        assert cost_tracker.maybe_emit_budget_warning(s) is None
        assert not AgentMessage.objects.filter(
            session=s, role=MessageRole.SYSTEM,
            content__icontains='budget',
        ).exists()

    def test_warning_at_80_percent(
        self, workspace, user, monkeypatch,
    ):
        self._set_threshold(monkeypatch, '10.0')
        s = self._session(workspace, user)
        self._add_cost(s, user, Decimal('8.50'))  # 85% — over threshold.
        msg = cost_tracker.maybe_emit_budget_warning(s)
        assert msg is not None
        assert '85' in msg or '80' in msg
        assert AgentMessage.objects.filter(
            session=s, role=MessageRole.SYSTEM,
            content__icontains='budget',
        ).count() == 1

    def test_warning_dedup_within_24h(
        self, workspace, user, monkeypatch,
    ):
        self._set_threshold(monkeypatch, '10.0')
        s = self._session(workspace, user)
        self._add_cost(s, user, Decimal('9.00'))  # 90%
        first = cost_tracker.maybe_emit_budget_warning(s)
        second = cost_tracker.maybe_emit_budget_warning(s)
        assert first is not None
        assert second is None  # de-duped via cache key
        # Single AgentMessage created.
        assert AgentMessage.objects.filter(
            session=s, role=MessageRole.SYSTEM,
            content__icontains='budget',
        ).count() == 1

    def test_warning_dedup_across_sessions_same_workspace(
        self, workspace, user, monkeypatch,
    ):
        self._set_threshold(monkeypatch, '10.0')
        s1 = self._session(workspace, user)
        s2 = self._session(workspace, user)
        self._add_cost(s1, user, Decimal('9.00'))  # 90% workspace-wide
        first = cost_tracker.maybe_emit_budget_warning(s1)
        # Second session in the SAME workspace doesn't emit again.
        second = cost_tracker.maybe_emit_budget_warning(s2)
        assert first is not None
        assert second is None

    def test_no_warning_when_threshold_unset(
        self, workspace, user, monkeypatch,
    ):
        monkeypatch.delenv('AGENT_BUDGET_WARNING_THRESHOLD', raising=False)
        s = self._session(workspace, user)
        self._add_cost(s, user, Decimal('999.9999'))
        assert cost_tracker.maybe_emit_budget_warning(s) is None

    def test_no_warning_when_threshold_invalid(
        self, workspace, user, monkeypatch,
    ):
        self._set_threshold(monkeypatch, 'not-a-number')
        s = self._session(workspace, user)
        self._add_cost(s, user, Decimal('999.9999'))
        assert cost_tracker.maybe_emit_budget_warning(s) is None


# ── AC-47: Tool-call cost logged ───────────────────────────────────────────


class TestAC47CostLoggedPerToolCall:
    def test_check_tool_permission_writes_cost_estimate(
        self, workspace, user,
    ):
        from agent_app.services import permission_checker
        s = AgentSession.objects.create(
            workspace=workspace, created_by=user,
            status=SessionStatus.RUNNING,
        )
        can, log = permission_checker.check_tool_permission(
            s, 'trigger_deep_research', agent_type='research',
        )
        # tool defaults to 'approve' so can=False — the log row still must exist.
        assert log.id is not None
        assert log.cost_estimate is not None
        assert log.cost_estimate == cost_tracker.estimate_cost(
            'trigger_deep_research',
        )

    def test_auto_tool_logs_completed_with_cost(
        self, workspace, user,
    ):
        from agent_app.services.permission_decorator import permission_check
        s = AgentSession.objects.create(
            workspace=workspace, created_by=user,
            status=SessionStatus.RUNNING,
        )

        # web_search is AUTO by default.
        @permission_check('web_search')
        def my_tool(query: str, config=None):
            return {'ok': True, 'q': query}

        cfg = {'configurable': {
            'session_id': str(s.id),
            'agent_type': 'search',
            'workspace_id': str(workspace.id),
        }}
        out = my_tool('hello', config=cfg)
        assert out['ok'] is True

        log = AgentActionLog.objects.get(session=s, action='web_search')
        assert log.status == ActionStatus.COMPLETED
        # web_search has a non-zero cost in TOOL_COST_ESTIMATES.
        assert log.cost_estimate == cost_tracker.estimate_cost('web_search')
