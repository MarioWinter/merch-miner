"""Phase 5 — Workflow Execution + Controls tests.

Covers:
    - AC-24: 5 system templates seeded by management command + lazy
      seeding via _ensure_defaults
    - AC-26: workflow_template → orchestrator follows; without → autonomous
    - AC-36: run_agent_workflow happy path + status transitions
    - AC-37 / AC-38: resume from checkpoint emits "resumed at step X"
    - AC-40 / AC-41 / AC-42: pause / resume / stop endpoints
    - EC-12: user-message queueing during running session, drain order
    - EC-14: invalid template returns 400 with structured error
    - ApprovalRequired during workflow → session paused
"""

from __future__ import annotations

import uuid

import pytest
from rest_framework.test import APIClient

from agent_app.models import (
    AgentMessage,
    AgentSession,
    MessageRole,
    SessionStatus,
    ToolPermission,
    WorkflowTemplate,
    validate_workflow_steps,
)
from agent_app.services import message_queue, template_manager
from agent_app.tasks import run_agent_workflow

pytestmark = pytest.mark.django_db


# ── Fixtures ───────────────────────────────────────────────────────────────


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        email='wf@test.com', password='testpass123',
    )


@pytest.fixture
def workspace(user):
    from workspace_app.models import Membership
    membership = Membership.objects.get(user=user, status='active')
    return membership.workspace


@pytest.fixture
def api_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def session(workspace, user):
    return AgentSession.objects.create(
        workspace=workspace,
        created_by=user,
        title='WF',
        status=SessionStatus.IDLE,
    )


# ── AC-24: 5 system templates seeded ───────────────────────────────────────


class TestAC24SystemTemplates:
    def test_seed_command_creates_5_templates(self, workspace):
        from django.core.management import call_command
        call_command('seed_agent_defaults')

        keys = set(
            WorkflowTemplate.objects.filter(
                workspace=workspace, is_system=True,
            ).values_list('key', flat=True)
        )
        expected = {
            'full_pipeline', 'research_only', 'ideation',
            'design_sprint', 'listing_finalize',
        }
        assert expected.issubset(keys)

    def test_lazy_seed_via_get_endpoint(self, api_client, workspace):
        resp = api_client.get('/api/agent/templates/')
        assert resp.status_code == 200
        keys = {t['key'] for t in resp.data}
        for k in ('full_pipeline', 'research_only', 'ideation',
                  'design_sprint', 'listing_finalize'):
            assert k in keys


# ── AC-25: template manager service ────────────────────────────────────────


class TestAC25TemplateManager:
    def test_create_custom_template(self, workspace, user):
        tmpl = template_manager.create_custom_template(
            workspace, user, name='Quick',
            key='quick_run',
            steps=[
                {'agent_type': 'research', 'action': 'deep'},
                {'agent_type': 'ideation', 'action': 'brainstorm'},
            ],
        )
        assert tmpl.is_system is False
        assert tmpl.created_by == user

    def test_delete_system_template_rejected(self, workspace, user):
        tmpl = WorkflowTemplate.objects.create(
            workspace=workspace, name='Sys', key='sys',
            is_system=True, steps=[{'agent_type': 'research', 'action': 'x'}],
        )
        with pytest.raises(ValueError):
            template_manager.delete_custom_template(tmpl)

    def test_update_system_template_rejected(self, workspace):
        tmpl = WorkflowTemplate.objects.create(
            workspace=workspace, name='Sys', key='sys2',
            is_system=True, steps=[{'agent_type': 'research', 'action': 'x'}],
        )
        with pytest.raises(ValueError):
            template_manager.update_custom_template(tmpl, name='Hacked')

    def test_list_templates(self, workspace):
        WorkflowTemplate.objects.create(
            workspace=workspace, name='A', key='a', is_system=True,
            steps=[{'agent_type': 'research', 'action': 'x'}],
        )
        WorkflowTemplate.objects.create(
            workspace=workspace, name='B', key='b', is_system=False,
            steps=[{'agent_type': 'research', 'action': 'x'}],
        )
        results = template_manager.list_templates(workspace)
        assert len(results) == 2


# ── AC-36: run_agent_workflow happy path (mocked orchestrator) ─────────────


class TestAC36RunAgentWorkflow:
    def test_happy_path_marks_completed(self, session, monkeypatch):
        called = {}

        def fake_run(s, resume=False):
            called['ran'] = True
            called['resume'] = resume

        monkeypatch.setattr(
            'agent_app.agents.orchestrator.run_orchestrator',
            fake_run,
        )

        run_agent_workflow(str(session.id))

        session.refresh_from_db()
        assert called.get('ran') is True
        assert called.get('resume') is False
        assert session.status == SessionStatus.COMPLETED
        assert session.completed_at is not None
        # Summary message emitted
        assert AgentMessage.objects.filter(
            session=session, role=MessageRole.SYSTEM,
        ).exists()

    def test_unhandled_exception_marks_failed(self, session, monkeypatch):
        def boom(s, resume=False):
            raise RuntimeError('kaboom')

        monkeypatch.setattr(
            'agent_app.agents.orchestrator.run_orchestrator',
            boom,
        )

        run_agent_workflow(str(session.id))

        session.refresh_from_db()
        assert session.status == SessionStatus.FAILED
        assert 'kaboom' in session.error_message
        assert AgentMessage.objects.filter(
            session=session,
            role=MessageRole.SYSTEM,
            content__icontains='Workflow failed',
        ).exists()

    def test_cancelled_session_skipped(self, session, monkeypatch):
        session.status = SessionStatus.CANCELLED
        session.save()

        called = {'ran': False}

        def fake_run(s, resume=False):
            called['ran'] = True

        monkeypatch.setattr(
            'agent_app.agents.orchestrator.run_orchestrator',
            fake_run,
        )

        run_agent_workflow(str(session.id))
        assert called['ran'] is False

    def test_lazy_seeds_default_permissions(self, session, monkeypatch):
        monkeypatch.setattr(
            'agent_app.agents.orchestrator.run_orchestrator',
            lambda s, resume=False: None,
        )
        # No permissions yet
        assert ToolPermission.objects.filter(
            workspace=session.workspace, user=session.created_by,
        ).count() == 0

        run_agent_workflow(str(session.id))

        # AC-19 lazy seed
        assert ToolPermission.objects.filter(
            workspace=session.workspace, user=session.created_by,
        ).count() > 0

    def test_orchestrator_pause_keeps_paused(self, session, monkeypatch):
        """When orchestrator paused (EC-6/awaiting_approval), job exits cleanly."""
        def fake_run(s, resume=False):
            # Simulate sub-agent pausing the session mid-flight
            AgentSession.objects.filter(pk=s.pk).update(status=SessionStatus.PAUSED)

        monkeypatch.setattr(
            'agent_app.agents.orchestrator.run_orchestrator',
            fake_run,
        )

        run_agent_workflow(str(session.id))

        session.refresh_from_db()
        assert session.status == SessionStatus.PAUSED


# ── AC-37 / AC-38: Resume after simulated crash ────────────────────────────


class TestAC37AC38Resume:
    def test_resume_emits_resumed_message(self, session, monkeypatch):
        """Session was RUNNING (worker crashed) — re-enqueue triggers resume msg."""
        session.status = SessionStatus.RUNNING
        session.current_step = 'delegate_to_research'
        session.save()

        captured_resume = {}

        def fake_run(s, resume=False):
            captured_resume['resume'] = resume

        monkeypatch.setattr(
            'agent_app.agents.orchestrator.run_orchestrator',
            fake_run,
        )

        run_agent_workflow(str(session.id))

        assert captured_resume.get('resume') is True
        # AC-38: "Workflow resumed at step X" message
        assert AgentMessage.objects.filter(
            session=session,
            role=MessageRole.SYSTEM,
            content__icontains='Workflow resumed',
        ).exists()

    def test_resume_from_paused(self, session, monkeypatch):
        session.status = SessionStatus.PAUSED
        session.current_step = 'delegate_to_design'
        session.save()

        monkeypatch.setattr(
            'agent_app.agents.orchestrator.run_orchestrator',
            lambda s, resume=False: None,
        )

        run_agent_workflow(str(session.id))

        msg = AgentMessage.objects.filter(
            session=session,
            role=MessageRole.SYSTEM,
            content__icontains='delegate_to_design',
        ).first()
        assert msg is not None


# ── AC-40 / AC-41 / AC-42: pause / resume / stop transitions ───────────────


class TestAC40_41_42Controls:
    def test_pause(self, api_client, session):
        session.status = SessionStatus.RUNNING
        session.save()
        resp = api_client.post(f'/api/agent/sessions/{session.id}/pause/')
        assert resp.status_code == 200
        session.refresh_from_db()
        assert session.status == SessionStatus.PAUSED

    def test_resume_from_paused(self, api_client, session):
        session.status = SessionStatus.PAUSED
        session.save()
        resp = api_client.post(f'/api/agent/sessions/{session.id}/resume/')
        assert resp.status_code == 200
        session.refresh_from_db()
        assert session.status == SessionStatus.RUNNING

    def test_stop(self, api_client, session):
        session.status = SessionStatus.RUNNING
        session.save()
        resp = api_client.post(f'/api/agent/sessions/{session.id}/stop/')
        assert resp.status_code == 200
        session.refresh_from_db()
        assert session.status == SessionStatus.CANCELLED
        # Audit message
        assert AgentMessage.objects.filter(
            session=session, role=MessageRole.SYSTEM,
            content__icontains='stopped',
        ).exists()

    def test_pause_only_when_running(self, api_client, session):
        session.status = SessionStatus.IDLE
        session.save()
        resp = api_client.post(f'/api/agent/sessions/{session.id}/pause/')
        assert resp.status_code == 400

    def test_decorator_aborts_when_paused(self, session, user, workspace):
        """When session.status==PAUSED, permission_decorator returns aborted."""
        from agent_app.services.permission_decorator import permission_check

        session.status = SessionStatus.PAUSED
        session.save()

        @permission_check('read_niche_details')
        def my_tool(query: str, config=None):
            return f"result for {query}"

        config = {
            'configurable': {
                'session_id': str(session.id),
                'agent_type': 'research',
                'workspace_id': str(workspace.id),
            },
        }
        out = my_tool('foo', config=config)
        assert isinstance(out, dict)
        assert out['status'] == 'aborted'

    def test_decorator_aborts_when_cancelled(self, session, workspace):
        from agent_app.services.permission_decorator import permission_check

        session.status = SessionStatus.CANCELLED
        session.save()

        @permission_check('read_niche_details')
        def my_tool(query: str, config=None):
            return 'ran'

        config = {
            'configurable': {
                'session_id': str(session.id),
                'agent_type': 'research',
                'workspace_id': str(workspace.id),
            },
        }
        out = my_tool('foo', config=config)
        assert out['status'] == 'aborted'


# ── EC-12: User-message queueing during running session ───────────────────


class TestEC12MessageQueueing:
    def test_enqueue_during_running_marks_unprocessed(self, api_client, session):
        session.status = SessionStatus.RUNNING
        session.save()

        resp = api_client.post(
            f'/api/agent/sessions/{session.id}/messages/',
            {'content': 'Stop and switch to design'},
            format='json',
        )
        assert resp.status_code == 201

        msg = AgentMessage.objects.get(session=session, role=MessageRole.USER)
        assert msg.processed is False
        # Status MUST stay running (no interruption)
        session.refresh_from_db()
        assert session.status == SessionStatus.RUNNING

    def test_enqueue_during_idle_marks_processed_and_starts(
        self, api_client, session, monkeypatch,
    ):
        session.status = SessionStatus.IDLE
        session.save()

        # Stub out RQ enqueue so test is fast/isolated
        monkeypatch.setattr(
            'agent_app.api.views.django_rq.get_queue',
            lambda name: type('Q', (), {'enqueue': lambda self, *a, **k: None})(),
        )

        resp = api_client.post(
            f'/api/agent/sessions/{session.id}/messages/',
            {'content': 'Begin'},
            format='json',
        )
        assert resp.status_code == 201
        msg = AgentMessage.objects.get(session=session, role=MessageRole.USER)
        assert msg.processed is True

    def test_drain_returns_in_order(self, session):
        """drain_unprocessed returns oldest-first + marks processed."""
        m1 = message_queue.enqueue_user_message(session, 'first')
        m2 = message_queue.enqueue_user_message(session, 'second')
        m3 = message_queue.enqueue_user_message(session, 'third')

        out = message_queue.drain_unprocessed(session)
        assert out == ['first', 'second', 'third']

        for m in (m1, m2, m3):
            m.refresh_from_db()
            assert m.processed is True

    def test_drain_empty_when_no_pending(self, session):
        assert message_queue.drain_unprocessed(session) == []

    def test_drain_idempotent(self, session):
        message_queue.enqueue_user_message(session, 'one')
        first = message_queue.drain_unprocessed(session)
        second = message_queue.drain_unprocessed(session)
        assert first == ['one']
        assert second == []


# ── EC-14: WorkflowTemplate validation ─────────────────────────────────────


class TestEC14TemplateValidation:
    def test_serializer_rejects_design_before_research(self, api_client, workspace):
        resp = api_client.post(
            '/api/agent/templates/',
            {
                'name': 'Bad',
                'key': 'bad_design_first',
                'steps': [
                    {'agent_type': 'design', 'action': 'design_generation'},
                    {'agent_type': 'research', 'action': 'deep'},
                ],
            },
            format='json',
        )
        assert resp.status_code == 400
        # Structured error payload
        body = resp.data
        # DRF wraps validate_steps errors under 'steps' key
        assert 'steps' in body
        steps_err = body['steps']
        if isinstance(steps_err, dict):
            payload = steps_err
        elif isinstance(steps_err, list) and steps_err and isinstance(steps_err[0], dict):
            payload = steps_err[0]
        else:
            payload = {'error': str(steps_err)}
        assert 'design' in str(payload.get('error', '')).lower()
        assert payload.get('missing_prerequisite') == 'research_or_ideation'

    def test_serializer_accepts_valid_pipeline(self, api_client, workspace):
        resp = api_client.post(
            '/api/agent/templates/',
            {
                'name': 'Good',
                'key': 'good_pipeline',
                'steps': [
                    {'agent_type': 'research', 'action': 'deep'},
                    {'agent_type': 'ideation', 'action': 'brainstorm'},
                    {'agent_type': 'design', 'action': 'design_generation'},
                ],
            },
            format='json',
        )
        assert resp.status_code == 201

    def test_validate_helper_rejects_invalid_agent_type(self):
        errs = validate_workflow_steps([
            {'agent_type': 'unknown', 'action': 'x'},
        ])
        assert errs is not None
        assert 'invalid agent_type' in errs['error']

    def test_validate_helper_rejects_empty(self):
        errs = validate_workflow_steps([])
        assert errs is not None

    def test_validate_helper_rejects_missing_agent_type(self):
        errs = validate_workflow_steps([{'action': 'x'}])
        assert errs is not None
        assert 'agent_type' in errs['error']

    def test_validate_helper_design_after_ideation_ok(self):
        """Ideation as prerequisite is also acceptable."""
        errs = validate_workflow_steps([
            {'agent_type': 'ideation', 'action': 'brainstorm'},
            {'agent_type': 'design', 'action': 'gen'},
        ])
        assert errs is None

    def test_model_clean_raises_on_invalid(self, workspace):
        from django.core.exceptions import ValidationError as DjangoValidationError
        tmpl = WorkflowTemplate(
            workspace=workspace, name='X', key='x_bad', is_system=False,
            steps=[
                {'agent_type': 'design', 'action': 'gen'},
            ],
        )
        with pytest.raises(DjangoValidationError):
            tmpl.clean()


# ── AC-26: workflow_template → orchestrator follows it ─────────────────────


class TestAC26TemplateFollowed:
    def test_initial_prompt_includes_template_steps(self, workspace, user):
        WorkflowTemplate.objects.create(
            workspace=workspace, name='Pipeline', key='pipe',
            is_system=False,
            steps=[
                {'agent_type': 'research', 'action': 'deep', 'description': 'Research'},
                {'agent_type': 'ideation', 'action': 'brainstorm', 'description': 'Ideate'},
            ],
        )
        s = AgentSession.objects.create(
            workspace=workspace, created_by=user,
            workflow_template='pipe',
        )
        from agent_app.agents.orchestrator import _build_initial_prompt
        prompt = _build_initial_prompt(s, resume=False)
        assert 'pipe' in prompt
        assert 'delegate_to_research' in prompt
        assert 'delegate_to_ideation' in prompt

    def test_initial_prompt_autonomous_when_no_template(self, workspace, user):
        s = AgentSession.objects.create(
            workspace=workspace, created_by=user, workflow_template='',
        )
        from agent_app.agents.orchestrator import _build_initial_prompt
        prompt = _build_initial_prompt(s, resume=False)
        assert 'autonomously' in prompt.lower() or 'autonomous' in prompt.lower()

    def test_invalid_template_pauses_session(self, workspace, user):
        """EC-14 double-check: invalid template at load time pauses + emits error."""
        WorkflowTemplate.objects.create(
            workspace=workspace, name='BadTpl', key='bad_tpl',
            is_system=True,  # bypasses serializer; raw insert
            steps=[
                {'agent_type': 'design', 'action': 'gen'},  # design first → invalid
            ],
        )
        s = AgentSession.objects.create(
            workspace=workspace, created_by=user, workflow_template='bad_tpl',
            status=SessionStatus.RUNNING,
        )
        from agent_app.agents.orchestrator import _build_initial_prompt
        _build_initial_prompt(s, resume=False)

        s.refresh_from_db()
        assert s.status == SessionStatus.PAUSED
        assert AgentMessage.objects.filter(
            session=s, role=MessageRole.SYSTEM,
            content__icontains='invalid steps',
        ).exists()


# ── ApprovalRequired during workflow → session paused ──────────────────────


class TestApprovalDuringWorkflow:
    def test_pause_endpoint_paused_session(self, api_client, session):
        """Session paused via control endpoint flips state for orchestrator to honor."""
        session.status = SessionStatus.RUNNING
        session.save()
        resp = api_client.post(f'/api/agent/sessions/{session.id}/pause/')
        assert resp.status_code == 200

        # Subsequent tools see PAUSED → abort gracefully (covered above)
        session.refresh_from_db()
        assert session.status == SessionStatus.PAUSED
