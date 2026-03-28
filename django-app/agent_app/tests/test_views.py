import pytest
from rest_framework.test import APIClient

from agent_app.models import (
    AgentSession,
    AgentActionLog,
    AgentMessage,
    ActionStatus,
    AutonomyPreset,
    KnowledgeDoc,
    MessageRole,
    PermissionLevel,
    SessionStatus,
    ToolPermission,
    WorkflowTemplate,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(email='agent@test.com', password='testpass123')


@pytest.fixture
def workspace(user):
    from workspace_app.models import Membership
    # Use the auto-created personal workspace from the post_save signal
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
        workspace=workspace, created_by=user, title='Test',
        status=SessionStatus.RUNNING,
    )


# ── Session CRUD ──

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

    def test_list_sessions(self, api_client, workspace, user):
        AgentSession.objects.create(workspace=workspace, created_by=user, title='S1')
        AgentSession.objects.create(workspace=workspace, created_by=user, title='S2')
        resp = api_client.get('/api/agent/sessions/')
        assert resp.data['count'] == 2


class TestSessionDetail:
    def test_get_detail(self, api_client, session):
        resp = api_client.get(f'/api/agent/sessions/{session.id}/')
        assert resp.status_code == 200
        assert resp.data['title'] == 'Test'
        assert 'messages' in resp.data

    def test_not_found(self, api_client, workspace):
        import uuid
        resp = api_client.get(f'/api/agent/sessions/{uuid.uuid4()}/')
        assert resp.status_code == 404


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

    def test_stop(self, api_client, session):
        resp = api_client.post(f'/api/agent/sessions/{session.id}/stop/')
        assert resp.status_code == 200
        session.refresh_from_db()
        assert session.status == SessionStatus.CANCELLED

    def test_pause_not_running(self, api_client, session):
        session.status = SessionStatus.IDLE
        session.save()
        resp = api_client.post(f'/api/agent/sessions/{session.id}/pause/')
        assert resp.status_code == 400


class TestSessionShare:
    def test_share(self, api_client, session):
        resp = api_client.post(f'/api/agent/sessions/{session.id}/share/share/')
        assert resp.status_code == 200
        session.refresh_from_db()
        assert session.is_shared is True

    def test_unshare(self, api_client, session):
        session.is_shared = True
        session.save()
        resp = api_client.post(f'/api/agent/sessions/{session.id}/share/unshare/')
        assert resp.status_code == 200
        session.refresh_from_db()
        assert session.is_shared is False


class TestSessionMessage:
    def test_send_message(self, api_client, session):
        resp = api_client.post(f'/api/agent/sessions/{session.id}/messages/', {
            'content': 'Research Camping Dad',
        }, format='json')
        assert resp.status_code == 201
        assert AgentMessage.objects.filter(session=session, role=MessageRole.USER).count() == 1

    def test_send_empty_message(self, api_client, session):
        resp = api_client.post(f'/api/agent/sessions/{session.id}/messages/', {
            'content': '',
        }, format='json')
        assert resp.status_code == 400


class TestApproveReject:
    def test_approve(self, api_client, session):
        log = AgentActionLog.objects.create(
            session=session, workspace=session.workspace, user=session.created_by,
            agent_type='research', action='trigger_deep_research',
            status=ActionStatus.AWAITING_APPROVAL,
        )
        resp = api_client.post(f'/api/agent/sessions/{session.id}/approve/{log.id}/')
        assert resp.status_code == 200
        log.refresh_from_db()
        assert log.status == ActionStatus.APPROVED

    def test_reject(self, api_client, session):
        log = AgentActionLog.objects.create(
            session=session, workspace=session.workspace, user=session.created_by,
            agent_type='design', action='generate_design',
            status=ActionStatus.AWAITING_APPROVAL,
        )
        resp = api_client.post(f'/api/agent/sessions/{session.id}/reject/{log.id}/')
        assert resp.status_code == 200
        log.refresh_from_db()
        assert log.status == ActionStatus.REJECTED


# ── Config ──

class TestAgentConfig:
    def test_list_configs(self, api_client, workspace):
        resp = api_client.get('/api/agent/config/')
        assert resp.status_code == 200
        # Should auto-seed 7 configs
        assert len(resp.data) == 7

    def test_update_config(self, api_client, workspace):
        # Ensure configs exist
        api_client.get('/api/agent/config/')
        resp = api_client.patch('/api/agent/config/orchestrator/', {
            'display_name': 'Julian',
            'temperature': 0.5,
        }, format='json')
        assert resp.status_code == 200
        assert resp.data['display_name'] == 'Julian'

    def test_update_invalid_type(self, api_client, workspace):
        resp = api_client.patch('/api/agent/config/invalid_type/', {
            'display_name': 'X',
        }, format='json')
        assert resp.status_code == 400


# ── Permissions ──

class TestPermissions:
    def test_list_seeds_defaults(self, api_client, workspace):
        resp = api_client.get('/api/agent/permissions/')
        assert resp.status_code == 200
        assert len(resp.data) > 0

    def test_bulk_update(self, api_client, workspace):
        # Seed first
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


# ── Presets ──

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

    def test_activate_preset(self, api_client, workspace):
        # Seed
        api_client.get('/api/agent/presets/')
        preset = AutonomyPreset.objects.get(workspace=workspace, name='Supervised')
        resp = api_client.post(f'/api/agent/presets/{preset.id}/activate/')
        assert resp.status_code == 200

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


# ── Templates ──

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
            'steps': [{'agent_type': 'research', 'action': 'research', 'description': 'Research'}],
        }, format='json')
        assert resp.status_code == 201

    def test_duplicate_key(self, api_client, workspace):
        api_client.get('/api/agent/templates/')  # seed
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


# ── Knowledge Docs ──

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


# ── Batch ──

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
        assert len(resp.data) == 2
        assert AgentSession.objects.count() == 2

    def test_batch_invalid_niche(self, api_client, workspace):
        import uuid
        resp = api_client.post('/api/agent/sessions/batch/', {
            'niche_ids': [str(uuid.uuid4())],
        }, format='json')
        assert resp.status_code == 400


# ── Auth ──

class TestAuth:
    def test_unauthenticated(self):
        client = APIClient()
        resp = client.get('/api/agent/sessions/')
        assert resp.status_code == 401
