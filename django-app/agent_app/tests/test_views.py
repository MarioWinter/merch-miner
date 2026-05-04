import uuid

import pytest
from rest_framework.test import APIClient

from agent_app.models import (
    ActionStatus,
    AgentActionLog,
    AgentConfig,
    AgentMessage,
    AgentSession,
    AgentType,
    AutonomyPreset,
    KnowledgeDoc,
    MessageRole,
    PermissionLevel,
    SessionStatus,
    ToolPermission,
    WorkflowTemplate,
)

pytestmark = pytest.mark.django_db


# ── Fixtures ──

@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(email='agent@test.com', password='testpass123')


@pytest.fixture
def workspace(user):
    from workspace_app.models import Membership
    membership = Membership.objects.get(user=user, status='active')
    return membership.workspace


@pytest.fixture
def other_user(django_user_model):
    """Different user with their own workspace — used for isolation tests."""
    return django_user_model.objects.create_user(
        email='other@test.com', password='testpass123',
    )


@pytest.fixture
def other_workspace(other_user):
    from workspace_app.models import Membership
    membership = Membership.objects.get(user=other_user, status='active')
    return membership.workspace


@pytest.fixture
def api_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def other_client(other_user):
    client = APIClient()
    client.force_authenticate(user=other_user)
    return client


@pytest.fixture
def session(workspace, user):
    return AgentSession.objects.create(
        workspace=workspace, created_by=user, title='Test',
        status=SessionStatus.RUNNING,
    )


# ══════════════════════════════════════════
#  Session CRUD
# ══════════════════════════════════════════

class TestSessionListCreate:
    def test_list_empty(self, api_client, workspace):
        resp = api_client.get('/api/agent/sessions/')
        assert resp.status_code == 200
        assert resp.data['results'] == []

    def test_create_session(self, api_client, workspace):
        resp = api_client.post('/api/agent/sessions/', {}, format='json')
        assert resp.status_code == 201
        assert AgentSession.objects.count() == 1

    def test_create_with_template(self, api_client, workspace):
        WorkflowTemplate.objects.create(
            workspace=workspace, name='Research Only', key='research_only',
            is_system=True, steps=[{'agent_type': 'research', 'action': 'deep'}],
        )
        resp = api_client.post('/api/agent/sessions/', {
            'workflow_template': 'research_only',
        }, format='json')
        assert resp.status_code == 201
        assert resp.data['total_steps'] == 1

    def test_create_with_unknown_template_returns_400(self, api_client, workspace):
        """P1 #4: a bogus workflow_template key must NOT silently fall back
        to autonomous (zero total_steps). The serializer accepts the field
        as a free-form string, so the view must validate it against
        WorkflowTemplate.objects.
        """
        resp = api_client.post('/api/agent/sessions/', {
            'workflow_template': 'bogus_xyz',
        }, format='json')
        assert resp.status_code == 400
        assert 'workflow_template' in resp.data
        assert resp.data['workflow_template'] == 'bogus_xyz'
        # No session got persisted as a side effect of the rejection.
        assert AgentSession.objects.count() == 0

    def test_create_with_collision_pauses_session(
        self, api_client, workspace, user,
    ):
        """P2 #9: collision on session create → new session is paused with
        a system warning message, NOT enqueued.
        """
        from niche_app.models import Niche
        niche = Niche.objects.create(
            workspace=workspace, name='Camping Dad', created_by=user,
        )
        # Pre-existing active session on the same niche → collision.
        AgentSession.objects.create(
            workspace=workspace, created_by=user, title='Active',
            niche_context=niche, status=SessionStatus.RUNNING,
        )

        resp = api_client.post('/api/agent/sessions/', {
            'niche_context': str(niche.id),
        }, format='json')
        assert resp.status_code == 201
        assert resp.data.get('collisions')

        new_session = AgentSession.objects.get(id=resp.data['id'])
        assert new_session.status == SessionStatus.PAUSED
        # Collision warning message persisted on the new session.
        assert AgentMessage.objects.filter(
            session=new_session,
            role=MessageRole.SYSTEM,
            content__icontains='collision',
        ).exists()

    def test_create_with_collision_override_bypasses_pause(
        self, api_client, workspace, user,
    ):
        """P2 #9: ``?override=true`` lets the caller bypass the pause flow
        and enqueue normally even when a collision was detected.
        """
        from niche_app.models import Niche
        niche = Niche.objects.create(
            workspace=workspace, name='Camping Dad O', created_by=user,
        )
        AgentSession.objects.create(
            workspace=workspace, created_by=user, title='Active',
            niche_context=niche, status=SessionStatus.RUNNING,
        )

        resp = api_client.post(
            '/api/agent/sessions/?override=true',
            {'niche_context': str(niche.id)},
            format='json',
        )
        assert resp.status_code == 201
        new_session = AgentSession.objects.get(id=resp.data['id'])
        # Override skips the pause — session stays IDLE (worker enqueued).
        assert new_session.status != SessionStatus.PAUSED

    def test_list_sessions(self, api_client, workspace, user):
        AgentSession.objects.create(workspace=workspace, created_by=user, title='S1')
        AgentSession.objects.create(workspace=workspace, created_by=user, title='S2')
        resp = api_client.get('/api/agent/sessions/')
        assert resp.data['count'] == 2

    def test_list_filter_status(self, api_client, workspace, user):
        AgentSession.objects.create(
            workspace=workspace, created_by=user, title='Running',
            status=SessionStatus.RUNNING,
        )
        AgentSession.objects.create(
            workspace=workspace, created_by=user, title='Idle',
            status=SessionStatus.IDLE,
        )
        resp = api_client.get('/api/agent/sessions/?status=running')
        assert resp.data['count'] == 1
        assert resp.data['results'][0]['title'] == 'Running'

    def test_list_filter_batch_id(self, api_client, workspace, user):
        batch = uuid.uuid4()
        AgentSession.objects.create(
            workspace=workspace, created_by=user, title='B1',
            batch_id=batch, batch_position=0,
        )
        AgentSession.objects.create(
            workspace=workspace, created_by=user, title='B2',
            batch_id=batch, batch_position=1,
        )
        AgentSession.objects.create(workspace=workspace, created_by=user, title='Solo')
        resp = api_client.get(f'/api/agent/sessions/?batch_id={batch}')
        assert resp.data['count'] == 2
        # Ordered by batch_position
        titles = [r['title'] for r in resp.data['results']]
        assert titles == ['B1', 'B2']

    def test_list_invalid_batch_id(self, api_client, workspace):
        resp = api_client.get('/api/agent/sessions/?batch_id=not-a-uuid')
        assert resp.status_code == 400

    def test_list_workspace_isolation(
        self, api_client, workspace, user, other_workspace, other_user,
    ):
        AgentSession.objects.create(
            workspace=workspace, created_by=user, title='Mine',
        )
        AgentSession.objects.create(
            workspace=other_workspace, created_by=other_user, title='Theirs',
        )
        resp = api_client.get('/api/agent/sessions/')
        titles = [r['title'] for r in resp.data['results']]
        assert titles == ['Mine']


class TestSessionDetail:
    def test_get_detail(self, api_client, session):
        resp = api_client.get(f'/api/agent/sessions/{session.id}/')
        assert resp.status_code == 200
        assert resp.data['title'] == 'Test'
        assert 'messages' in resp.data
        assert 'action_logs' in resp.data
        assert 'messages_pagination' in resp.data

    def test_not_found(self, api_client, workspace):
        resp = api_client.get(f'/api/agent/sessions/{uuid.uuid4()}/')
        assert resp.status_code == 404

    def test_workspace_isolation(self, api_client, other_workspace, other_user):
        foreign = AgentSession.objects.create(
            workspace=other_workspace, created_by=other_user, title='Foreign',
        )
        resp = api_client.get(f'/api/agent/sessions/{foreign.id}/')
        assert resp.status_code == 404

    def test_member_b_cannot_read_private_session_of_member_a(
        self, django_user_model, workspace, user,
    ):
        """Workspace member B must NOT see member A's private (un-shared)
        session — even though both belong to the same workspace.

        Guards against UUID-guessing leaks (P1 #3 — DetailView privacy).
        """
        from workspace_app.models import Membership
        member_b = django_user_model.objects.create_user(
            email='memberb@test.com', password='testpass123',
        )
        # Move member_b's auto-created workspace membership over to A's
        # workspace so they're co-members of the same workspace as `user`.
        Membership.objects.filter(user=member_b).delete()
        Membership.objects.create(
            user=member_b, workspace=workspace, role='member', status='active',
        )

        private_session = AgentSession.objects.create(
            workspace=workspace, created_by=user, title='A-private',
            is_shared=False,
        )

        client_b = APIClient()
        client_b.force_authenticate(user=member_b)
        resp = client_b.get(f'/api/agent/sessions/{private_session.id}/')
        assert resp.status_code == 404

    def test_member_b_can_read_shared_session_of_member_a(
        self, django_user_model, workspace, user,
    ):
        """Shared sessions are visible to other workspace members (AC-60)."""
        from workspace_app.models import Membership
        member_b = django_user_model.objects.create_user(
            email='memberb2@test.com', password='testpass123',
        )
        Membership.objects.filter(user=member_b).delete()
        Membership.objects.create(
            user=member_b, workspace=workspace, role='member', status='active',
        )

        shared_session = AgentSession.objects.create(
            workspace=workspace, created_by=user, title='A-shared',
            is_shared=True,
        )

        client_b = APIClient()
        client_b.force_authenticate(user=member_b)
        resp = client_b.get(f'/api/agent/sessions/{shared_session.id}/')
        assert resp.status_code == 200
        assert resp.data['title'] == 'A-shared'


# ══════════════════════════════════════════
#  Session Controls (pause/resume/stop)
# ══════════════════════════════════════════

class TestSessionControls:
    def test_pause(self, api_client, session):
        resp = api_client.post(f'/api/agent/sessions/{session.id}/pause/')
        assert resp.status_code == 200
        session.refresh_from_db()
        assert session.status == SessionStatus.PAUSED

    def test_resume_paused(self, api_client, session):
        session.status = SessionStatus.PAUSED
        session.save()
        resp = api_client.post(f'/api/agent/sessions/{session.id}/resume/')
        assert resp.status_code == 200
        session.refresh_from_db()
        assert session.status == SessionStatus.RUNNING

    def test_stop(self, api_client, session):
        resp = api_client.post(f'/api/agent/sessions/{session.id}/stop/')
        assert resp.status_code == 200
        session.refresh_from_db()
        assert session.status == SessionStatus.CANCELLED
        # System "stopped" message persisted.
        assert AgentMessage.objects.filter(
            session=session, role=MessageRole.SYSTEM,
        ).exists()

    def test_pause_not_running(self, api_client, session):
        session.status = SessionStatus.IDLE
        session.save()
        resp = api_client.post(f'/api/agent/sessions/{session.id}/pause/')
        assert resp.status_code == 400

    def test_resume_not_paused(self, api_client, session):
        # Currently running, not paused.
        resp = api_client.post(f'/api/agent/sessions/{session.id}/resume/')
        assert resp.status_code == 400

    def test_stop_idle(self, api_client, session):
        session.status = SessionStatus.IDLE
        session.save()
        resp = api_client.post(f'/api/agent/sessions/{session.id}/stop/')
        assert resp.status_code == 400

    def test_non_owner_cannot_pause(
        self, other_client, workspace, user, other_workspace, other_user,
    ):
        """Non-owner gets 404 on session control endpoints (AC-61)."""
        # Session in user's workspace; other_user has their own workspace.
        s = AgentSession.objects.create(
            workspace=workspace, created_by=user, title='Mine',
            status=SessionStatus.RUNNING,
        )
        resp = other_client.post(f'/api/agent/sessions/{s.id}/pause/')
        # Other user's workspace doesn't contain the session → 404
        assert resp.status_code == 404


# ══════════════════════════════════════════
#  Share / Unshare
# ══════════════════════════════════════════

class TestSessionShare:
    def test_share(self, api_client, session):
        resp = api_client.post(f'/api/agent/sessions/{session.id}/share/')
        assert resp.status_code == 200
        session.refresh_from_db()
        assert session.is_shared is True

    def test_unshare(self, api_client, session):
        session.is_shared = True
        session.save()
        resp = api_client.post(f'/api/agent/sessions/{session.id}/unshare/')
        assert resp.status_code == 200
        session.refresh_from_db()
        assert session.is_shared is False

    def test_non_owner_cannot_share(
        self, other_client, workspace, user,
    ):
        s = AgentSession.objects.create(workspace=workspace, created_by=user, title='Mine')
        resp = other_client.post(f'/api/agent/sessions/{s.id}/share/')
        assert resp.status_code == 404


# ══════════════════════════════════════════
#  Send Command (EC-12)
# ══════════════════════════════════════════

class TestSessionMessage:
    def test_send_message_running_queues_unprocessed(self, api_client, session):
        """EC-12: While RUNNING, message persisted as processed=False."""
        resp = api_client.post(f'/api/agent/sessions/{session.id}/messages/', {
            'content': 'Research Camping Dad',
        }, format='json')
        assert resp.status_code == 201
        msg = AgentMessage.objects.get(session=session, role=MessageRole.USER)
        assert msg.processed is False

    def test_send_message_idle_marks_processed(self, api_client, workspace, user):
        s = AgentSession.objects.create(
            workspace=workspace, created_by=user, title='S',
            status=SessionStatus.IDLE,
        )
        resp = api_client.post(f'/api/agent/sessions/{s.id}/messages/', {
            'content': 'go',
        }, format='json')
        assert resp.status_code == 201
        msg = AgentMessage.objects.get(session=s, role=MessageRole.USER)
        assert msg.processed is True
        s.refresh_from_db()
        assert s.status == SessionStatus.RUNNING

    def test_send_empty_message(self, api_client, session):
        resp = api_client.post(f'/api/agent/sessions/{session.id}/messages/', {
            'content': '',
        }, format='json')
        assert resp.status_code == 400

    def test_send_message_non_owner(self, other_client, workspace, user):
        s = AgentSession.objects.create(workspace=workspace, created_by=user, title='Mine')
        resp = other_client.post(f'/api/agent/sessions/{s.id}/messages/', {
            'content': 'hi',
        }, format='json')
        assert resp.status_code == 404


# ══════════════════════════════════════════
#  Approve / Reject
# ══════════════════════════════════════════

class TestApproveReject:
    def test_approve(self, api_client, session):
        log = AgentActionLog.objects.create(
            session=session, workspace=session.workspace, user=session.created_by,
            agent_type='research', action='trigger_deep_research',
            status=ActionStatus.AWAITING_APPROVAL,
        )
        resp = api_client.post(
            f'/api/agent/sessions/{session.id}/approve/{log.id}/',
        )
        assert resp.status_code == 200
        log.refresh_from_db()
        assert log.status == ActionStatus.APPROVED
        # approval_response message emitted
        assert AgentMessage.objects.filter(
            session=session, role=MessageRole.APPROVAL_RESPONSE,
        ).count() == 1

    def test_reject(self, api_client, session):
        log = AgentActionLog.objects.create(
            session=session, workspace=session.workspace, user=session.created_by,
            agent_type='design', action='generate_design',
            status=ActionStatus.AWAITING_APPROVAL,
        )
        resp = api_client.post(
            f'/api/agent/sessions/{session.id}/reject/{log.id}/',
        )
        assert resp.status_code == 200
        log.refresh_from_db()
        assert log.status == ActionStatus.REJECTED
        assert AgentMessage.objects.filter(
            session=session, role=MessageRole.APPROVAL_RESPONSE,
        ).count() == 1

    def test_approve_resumes_paused_session(self, api_client, workspace, user):
        s = AgentSession.objects.create(
            workspace=workspace, created_by=user, title='S',
            status=SessionStatus.PAUSED,
        )
        log = AgentActionLog.objects.create(
            session=s, workspace=workspace, user=user,
            agent_type='research', action='create_niche',
            status=ActionStatus.AWAITING_APPROVAL,
        )
        api_client.post(f'/api/agent/sessions/{s.id}/approve/{log.id}/')
        s.refresh_from_db()
        assert s.status == SessionStatus.RUNNING

    def test_reject_resumes_paused_session(self, api_client, workspace, user):
        s = AgentSession.objects.create(
            workspace=workspace, created_by=user, title='S',
            status=SessionStatus.PAUSED,
        )
        log = AgentActionLog.objects.create(
            session=s, workspace=workspace, user=user,
            agent_type='design', action='generate_design',
            status=ActionStatus.AWAITING_APPROVAL,
        )
        api_client.post(f'/api/agent/sessions/{s.id}/reject/{log.id}/')
        s.refresh_from_db()
        assert s.status == SessionStatus.RUNNING

    def test_approve_already_resolved_404(self, api_client, session):
        log = AgentActionLog.objects.create(
            session=session, workspace=session.workspace, user=session.created_by,
            agent_type='research', action='create_niche',
            status=ActionStatus.APPROVED,  # already approved
        )
        resp = api_client.post(
            f'/api/agent/sessions/{session.id}/approve/{log.id}/',
        )
        assert resp.status_code == 404

    def test_non_owner_cannot_approve(
        self, other_client, workspace, user,
    ):
        """AC-61: shared sessions read-only for non-owners."""
        s = AgentSession.objects.create(
            workspace=workspace, created_by=user, title='Mine',
            is_shared=True,  # even if shared
        )
        log = AgentActionLog.objects.create(
            session=s, workspace=workspace, user=user,
            agent_type='research', action='create_niche',
            status=ActionStatus.AWAITING_APPROVAL,
        )
        resp = other_client.post(
            f'/api/agent/sessions/{s.id}/approve/{log.id}/',
        )
        assert resp.status_code == 404


# ══════════════════════════════════════════
#  Config (AgentConfig)
# ══════════════════════════════════════════

class TestAgentConfig:
    def test_list_configs(self, api_client, workspace):
        resp = api_client.get('/api/agent/config/')
        assert resp.status_code == 200
        # Auto-seed 7 configs (1 orchestrator + 6 sub-agents)
        assert len(resp.data) == 7

    def test_update_config(self, api_client, workspace):
        api_client.get('/api/agent/config/')  # ensure seeded
        resp = api_client.patch('/api/agent/config/orchestrator/', {
            'display_name': 'Julian',
            'temperature': 0.5,
        }, format='json')
        assert resp.status_code == 200
        assert resp.data['display_name'] == 'Julian'
        assert resp.data['temperature'] == 0.5

    def test_update_invalid_type(self, api_client, workspace):
        resp = api_client.patch('/api/agent/config/invalid_type/', {
            'display_name': 'X',
        }, format='json')
        assert resp.status_code == 400

    def test_member_cannot_update_system_prompt(
        self, api_client, workspace, user,
    ):
        """system_prompt is admin-only — member's PATCH ignores the field."""
        from workspace_app.models import Membership
        # Demote the user to member role.
        Membership.objects.filter(user=user, workspace=workspace).update(role='member')

        api_client.get('/api/agent/config/')  # seed
        config = AgentConfig.objects.get(workspace=workspace, agent_type=AgentType.ORCHESTRATOR)
        original = config.system_prompt

        resp = api_client.patch('/api/agent/config/orchestrator/', {
            'display_name': 'X',
            'system_prompt': 'HACKED PROMPT',
        }, format='json')
        # Patch succeeds for allowed fields, but system_prompt is silently
        # discarded by the non-admin serializer.
        assert resp.status_code == 200
        config.refresh_from_db()
        assert config.system_prompt == original
        assert config.display_name == 'X'

    def test_admin_can_update_system_prompt(self, api_client, workspace, user):
        from workspace_app.models import Membership
        Membership.objects.filter(user=user, workspace=workspace).update(role='admin')

        api_client.get('/api/agent/config/')
        resp = api_client.patch('/api/agent/config/orchestrator/', {
            'system_prompt': 'New admin prompt',
        }, format='json')
        assert resp.status_code == 200
        config = AgentConfig.objects.get(workspace=workspace, agent_type=AgentType.ORCHESTRATOR)
        assert config.system_prompt == 'New admin prompt'


# ══════════════════════════════════════════
#  Permissions
# ══════════════════════════════════════════

class TestPermissions:
    def test_list_seeds_defaults(self, api_client, workspace):
        resp = api_client.get('/api/agent/permissions/')
        assert resp.status_code == 200
        assert len(resp.data) > 0

    def test_bulk_update(self, api_client, workspace):
        api_client.get('/api/agent/permissions/')
        resp = api_client.patch('/api/agent/permissions/', {
            'permissions': {'create_niche': 'approve', 'read_listing': 'notify'},
        }, format='json')
        assert resp.status_code == 200
        perm = ToolPermission.objects.get(
            workspace=workspace,
            user__email='agent@test.com',
            tool_name='create_niche',
        )
        assert perm.permission_level == PermissionLevel.APPROVE

    def test_bulk_update_invalid_level(self, api_client, workspace):
        resp = api_client.patch('/api/agent/permissions/', {
            'permissions': {'create_niche': 'INVALID'},
        }, format='json')
        assert resp.status_code == 400


# ══════════════════════════════════════════
#  Presets (AC-21)
# ══════════════════════════════════════════

class TestPresets:
    def test_list_seeds_system(self, api_client, workspace):
        resp = api_client.get('/api/agent/presets/')
        assert resp.status_code == 200
        names = [p['name'] for p in resp.data]
        assert 'Supervised' in names
        assert 'Assisted' in names
        assert 'Autonomous' in names

    def test_create_custom(self, api_client, workspace):
        resp = api_client.post('/api/agent/presets/', {
            'name': 'My Custom',
            'permissions': {'create_niche': 'auto'},
        }, format='json')
        assert resp.status_code == 201
        assert resp.data['is_system'] is False

    def test_activate_preset_bulk_updates_permissions(
        self, api_client, workspace, user,
    ):
        """AC-21: activating a preset bulk-writes ToolPermission rows."""
        custom = AutonomyPreset.objects.create(
            workspace=workspace, created_by=user, name='Bulk',
            is_system=False,
            permissions={
                'create_niche': 'auto',
                'generate_design': 'approve',
                'export_listing': 'notify',
            },
        )
        resp = api_client.post(f'/api/agent/presets/{custom.id}/activate/')
        assert resp.status_code == 200
        # All three rows were written for this user.
        perms = {
            p.tool_name: p.permission_level
            for p in ToolPermission.objects.filter(workspace=workspace, user=user)
        }
        assert perms['create_niche'] == 'auto'
        assert perms['generate_design'] == 'approve'
        assert perms['export_listing'] == 'notify'

    def test_cannot_delete_system(self, api_client, workspace):
        api_client.get('/api/agent/presets/')
        preset = AutonomyPreset.objects.get(workspace=workspace, name='Supervised')
        resp = api_client.delete(f'/api/agent/presets/{preset.id}/')
        assert resp.status_code == 400

    def test_delete_custom(self, api_client, workspace, user):
        preset = AutonomyPreset.objects.create(
            workspace=workspace, created_by=user, name='Custom',
            is_system=False, permissions={},
        )
        resp = api_client.delete(f'/api/agent/presets/{preset.id}/')
        assert resp.status_code == 204


# ══════════════════════════════════════════
#  Templates (AC-25 + EC-14)
# ══════════════════════════════════════════

class TestTemplates:
    def test_list_seeds_system(self, api_client, workspace):
        resp = api_client.get('/api/agent/templates/')
        assert resp.status_code == 200
        keys = [t['key'] for t in resp.data]
        assert 'full_pipeline' in keys

    def test_create_custom(self, api_client, workspace):
        resp = api_client.post('/api/agent/templates/', {
            'name': 'Quick Design',
            'key': 'quick_design',
            'steps': [
                {'agent_type': 'research', 'action': 'research', 'description': 'R'},
            ],
        }, format='json')
        assert resp.status_code == 201

    def test_create_invalid_steps_ec14(self, api_client, workspace):
        """EC-14: design before research → 400 with structured error."""
        resp = api_client.post('/api/agent/templates/', {
            'name': 'Bad',
            'key': 'bad_order',
            'steps': [
                {'agent_type': 'design', 'action': 'generate_design', 'description': 'D'},
            ],
        }, format='json')
        assert resp.status_code == 400
        # validate_workflow_steps returned structured errors under "steps".
        assert 'steps' in resp.data

    def test_duplicate_key(self, api_client, workspace):
        api_client.get('/api/agent/templates/')
        resp = api_client.post('/api/agent/templates/', {
            'name': 'Dup', 'key': 'full_pipeline',
            'steps': [{'agent_type': 'research', 'action': 'x', 'description': 'x'}],
        }, format='json')
        assert resp.status_code == 400

    def test_cannot_delete_system(self, api_client, workspace):
        api_client.get('/api/agent/templates/')
        tmpl = WorkflowTemplate.objects.get(workspace=workspace, key='full_pipeline')
        resp = api_client.delete(f'/api/agent/templates/{tmpl.id}/')
        assert resp.status_code == 400

    def test_delete_custom(self, api_client, workspace):
        tmpl = WorkflowTemplate.objects.create(
            workspace=workspace, name='Custom', key='custom',
            is_system=False,
            steps=[{'agent_type': 'research', 'action': 'r', 'description': 'r'}],
        )
        resp = api_client.delete(f'/api/agent/templates/{tmpl.id}/')
        assert resp.status_code == 204


# ══════════════════════════════════════════
#  Knowledge Docs
# ══════════════════════════════════════════

class TestKnowledgeDocs:
    def test_create(self, api_client, workspace):
        resp = api_client.post('/api/agent/knowledge/', {
            'title': 'Design Prefs', 'content': 'Always use humor.',
        }, format='json')
        assert resp.status_code == 201
        assert resp.data['source'] == 'manual'

    def test_list(self, api_client, workspace, user):
        KnowledgeDoc.objects.create(
            workspace=workspace, created_by=user, title='Test', content='Content',
        )
        resp = api_client.get('/api/agent/knowledge/')
        assert resp.data['count'] == 1

    def test_update(self, api_client, workspace, user):
        doc = KnowledgeDoc.objects.create(
            workspace=workspace, created_by=user, title='Old', content='Old content',
        )
        resp = api_client.patch(f'/api/agent/knowledge/{doc.id}/', {
            'title': 'Updated',
        }, format='json')
        assert resp.status_code == 200
        assert resp.data['title'] == 'Updated'

    def test_delete(self, api_client, workspace, user):
        doc = KnowledgeDoc.objects.create(
            workspace=workspace, created_by=user, title='Del', content='Content',
        )
        resp = api_client.delete(f'/api/agent/knowledge/{doc.id}/')
        assert resp.status_code == 204
        assert KnowledgeDoc.objects.count() == 0

    def test_workspace_isolation(
        self, api_client, other_workspace, other_user,
    ):
        foreign = KnowledgeDoc.objects.create(
            workspace=other_workspace, created_by=other_user,
            title='Foreign', content='x',
        )
        # PATCH foreign doc should 404
        resp = api_client.patch(f'/api/agent/knowledge/{foreign.id}/', {
            'title': 'Hacked',
        }, format='json')
        assert resp.status_code == 404
        # DELETE foreign doc should 404
        resp = api_client.delete(f'/api/agent/knowledge/{foreign.id}/')
        assert resp.status_code == 404
        # List must not include foreign docs.
        resp = api_client.get('/api/agent/knowledge/')
        assert resp.data['count'] == 0


# ══════════════════════════════════════════
#  Batch
# ══════════════════════════════════════════

class TestBatch:
    def test_batch_create(self, api_client, workspace):
        from niche_app.models import Niche
        n1 = Niche.objects.create(workspace=workspace, name='Niche1', created_by=workspace.owner)
        n2 = Niche.objects.create(workspace=workspace, name='Niche2', created_by=workspace.owner)
        resp = api_client.post('/api/agent/sessions/batch/', {
            'niche_ids': [str(n1.id), str(n2.id)],
            'workflow_template': '',
        }, format='json')
        assert resp.status_code == 201
        assert 'batch_id' in resp.data
        assert len(resp.data['session_ids']) == 2
        assert len(resp.data['sessions']) == 2
        assert AgentSession.objects.count() == 2

    def test_batch_invalid_niche(self, api_client, workspace):
        resp = api_client.post('/api/agent/sessions/batch/', {
            'niche_ids': [str(uuid.uuid4())],
        }, format='json')
        assert resp.status_code == 400


# ══════════════════════════════════════════
#  Auth
# ══════════════════════════════════════════

class TestAuth:
    def test_unauthenticated_sessions(self):
        client = APIClient()
        resp = client.get('/api/agent/sessions/')
        assert resp.status_code == 401

    def test_unauthenticated_config(self):
        client = APIClient()
        resp = client.get('/api/agent/config/')
        assert resp.status_code == 401

    def test_unauthenticated_permissions(self):
        client = APIClient()
        resp = client.get('/api/agent/permissions/')
        assert resp.status_code == 401

    def test_unauthenticated_presets(self):
        client = APIClient()
        resp = client.get('/api/agent/presets/')
        assert resp.status_code == 401

    def test_unauthenticated_templates(self):
        client = APIClient()
        resp = client.get('/api/agent/templates/')
        assert resp.status_code == 401

    def test_unauthenticated_knowledge(self):
        client = APIClient()
        resp = client.get('/api/agent/knowledge/')
        assert resp.status_code == 401
