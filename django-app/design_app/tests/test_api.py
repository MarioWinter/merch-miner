"""Tests for design_app API views."""

import uuid
from unittest.mock import MagicMock, patch

import pytest
from rest_framework.test import APIClient

from design_app.models import (
    Design,
    DesignGenerationRun,
    DesignPipeline,
    DesignProcessingJob,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        email='test@example.com', password='testpass123',
    )


@pytest.fixture
def workspace(user):
    from workspace_app.models import Workspace, Membership
    ws = Workspace.objects.create(name='Test WS', slug='test-ws', owner=user)
    Membership.objects.create(
        workspace=ws, user=user, role='admin', status='active',
    )
    return ws


@pytest.fixture
def idea(workspace, user):
    from idea_app.models import Idea
    return Idea.objects.create(
        workspace=workspace,
        slogan_text='Coffee is Life',
        created_by=user,
    )


@pytest.fixture
def design(workspace, idea):
    return Design.objects.create(
        workspace=workspace,
        idea=idea,
        status=Design.Status.PENDING,
    )


@pytest.fixture
def auth_client(user, workspace):
    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_WORKSPACE_ID=str(workspace.id))
    return client


class TestDesignBoardView:
    def test_board_returns_idea_context(self, auth_client, idea):
        resp = auth_client.get(f'/api/ideas/{idea.id}/design-board/')
        assert resp.status_code == 200
        assert resp.data['slogan_text'] == 'Coffee is Life'
        assert resp.data['idea_id'] == str(idea.id)

    def test_board_requires_workspace(self, user, idea):
        client = APIClient()
        client.force_authenticate(user=user)
        resp = client.get(f'/api/ideas/{idea.id}/design-board/')
        assert resp.status_code == 400

    def test_board_workspace_isolation(self, auth_client, user):
        from workspace_app.models import Workspace
        from idea_app.models import Idea
        other_ws = Workspace.objects.create(
            name='Other', slug='other-ws', owner=user,
        )
        other_idea = Idea.objects.create(
            workspace=other_ws, slogan_text='Other', created_by=user,
        )
        resp = auth_client.get(f'/api/ideas/{other_idea.id}/design-board/')
        assert resp.status_code == 404


class TestDesignListView:
    def test_list_designs(self, auth_client, idea, design):
        resp = auth_client.get(f'/api/ideas/{idea.id}/designs/')
        assert resp.status_code == 200
        assert resp.data['count'] == 1

    def test_list_empty(self, auth_client, idea):
        resp = auth_client.get(f'/api/ideas/{idea.id}/designs/')
        assert resp.status_code == 200
        assert resp.data['count'] == 0


class TestGenerateDesignView:
    @patch('design_app.api.views.django_rq')
    def test_generate_enqueues_job(self, mock_rq, auth_client, idea):
        mock_queue = MagicMock()
        mock_queue.enqueue.return_value = MagicMock(id='rq-123')
        mock_rq.get_queue.return_value = mock_queue

        resp = auth_client.post(
            f'/api/ideas/{idea.id}/designs/generate/',
            {
                'model': 'gemini_flash',
                'background_color': 'neon_pink',
                'prompt': 'A coffee-themed design with bold text',
            },
            format='json',
        )
        assert resp.status_code == 202
        assert resp.data['status'] == 'pending'
        assert resp.data['model_name'] == 'gemini_flash'
        mock_rq.get_queue.assert_called_with('design')

    def test_generate_validation_error(self, auth_client, idea):
        resp = auth_client.post(
            f'/api/ideas/{idea.id}/designs/generate/',
            {'model': 'invalid_model', 'prompt': 'short'},
            format='json',
        )
        assert resp.status_code == 400


class TestDesignDetailView:
    def test_approve_design(self, auth_client, design):
        resp = auth_client.patch(
            f'/api/designs/{design.id}/',
            {'status': 'approved'},
            format='json',
        )
        assert resp.status_code == 200
        assert resp.data['status'] == 'approved'

    def test_approve_auto_rejects_previous(self, auth_client, workspace, idea):
        d1 = Design.objects.create(
            workspace=workspace, idea=idea, status=Design.Status.APPROVED,
        )
        d2 = Design.objects.create(
            workspace=workspace, idea=idea, status=Design.Status.PENDING,
        )

        resp = auth_client.patch(
            f'/api/designs/{d2.id}/',
            {'status': 'approved'},
            format='json',
        )
        assert resp.status_code == 200
        d1.refresh_from_db()
        assert d1.status == 'rejected'

    def test_reject_design(self, auth_client, design):
        resp = auth_client.patch(
            f'/api/designs/{design.id}/',
            {'status': 'rejected'},
            format='json',
        )
        assert resp.status_code == 200
        assert resp.data['status'] == 'rejected'

    def test_delete_design(self, auth_client, design):
        resp = auth_client.delete(f'/api/designs/{design.id}/')
        assert resp.status_code == 204
        assert not Design.objects.filter(pk=design.id).exists()

    def test_workspace_isolation(self, auth_client, user):
        from workspace_app.models import Workspace
        from idea_app.models import Idea
        other_ws = Workspace.objects.create(
            name='Other', slug='other-ws-2', owner=user,
        )
        other_idea = Idea.objects.create(
            workspace=other_ws, slogan_text='X', created_by=user,
        )
        other_design = Design.objects.create(
            workspace=other_ws, idea=other_idea,
        )
        resp = auth_client.patch(
            f'/api/designs/{other_design.id}/',
            {'status': 'approved'},
            format='json',
        )
        assert resp.status_code == 404


class TestDesignDownloadView:
    def test_download_no_file(self, auth_client, design):
        resp = auth_client.get(f'/api/designs/{design.id}/download/')
        assert resp.status_code == 404


class TestAnalyzeImageView:
    @patch('design_app.api.views.django_rq')
    def test_analyze_enqueues_job(self, mock_rq, auth_client, design):
        mock_queue = MagicMock()
        mock_queue.enqueue.return_value = MagicMock(id='rq-456')
        mock_rq.get_queue.return_value = mock_queue

        resp = auth_client.post(
            f'/api/designs/{design.id}/analyze-image/',
            {'source_image_url': 'https://example.com/image.jpg'},
            format='json',
        )
        assert resp.status_code == 202
        assert resp.data['status'] == 'pending'

    def test_analyze_reuses_existing(self, auth_client, workspace, idea):
        design = Design.objects.create(
            workspace=workspace, idea=idea,
            prompt_analysis={'text_dna': {'text': 'Hello'}},
        )
        resp = auth_client.post(
            f'/api/designs/{design.id}/analyze-image/',
            {'source_image_url': 'https://example.com/image.jpg'},
            format='json',
        )
        assert resp.status_code == 200
        assert resp.data['status'] == 'reused'


class TestRunStatusView:
    def test_poll_run(self, auth_client, idea, user):
        run = DesignGenerationRun.objects.create(
            idea=idea,
            model_name='gemini_flash',
            triggered_by=user,
            status=DesignGenerationRun.Status.RUNNING,
        )
        resp = auth_client.get(f'/api/designs/runs/{run.id}/')
        assert resp.status_code == 200
        assert resp.data['status'] == 'running'


class TestBatchProcessView:
    @patch('design_app.api.views.django_rq')
    def test_batch_creates_jobs(self, mock_rq, auth_client, design):
        mock_queue = MagicMock()
        mock_queue.enqueue.return_value = MagicMock(id='rq-789')
        mock_rq.get_queue.return_value = mock_queue

        resp = auth_client.post(
            '/api/designs/batch-process/',
            {
                'design_ids': [str(design.id)],
                'steps': ['upscale', 'bg_remove'],
            },
            format='json',
        )
        assert resp.status_code == 202
        assert len(resp.data) == 2  # 1 design x 2 steps

    def test_batch_workspace_validation(self, auth_client):
        resp = auth_client.post(
            '/api/designs/batch-process/',
            {
                'design_ids': [str(uuid.uuid4())],
                'steps': ['upscale'],
            },
            format='json',
        )
        assert resp.status_code == 400


class TestProcessingJobStatusView:
    def test_poll_job(self, auth_client, design):
        job = DesignProcessingJob.objects.create(
            design=design, type='upscale',
        )
        resp = auth_client.get(f'/api/designs/processing-jobs/{job.id}/')
        assert resp.status_code == 200
        assert resp.data['status'] == 'pending'


class TestProcessingSettingsView:
    def test_get_creates_default(self, auth_client, workspace):
        resp = auth_client.get('/api/designs/settings/')
        assert resp.status_code == 200
        assert resp.data['bg_removal_provider'] == 'rembg'
        assert resp.data['upscale_provider'] == 'auto'

    def test_patch_settings(self, auth_client, workspace):
        auth_client.get('/api/designs/settings/')  # Create first
        resp = auth_client.patch(
            '/api/designs/settings/',
            {'upscale_auto_threshold': 5000},
            format='json',
        )
        assert resp.status_code == 200
        assert resp.data['upscale_auto_threshold'] == 5000


class TestPipelineViews:
    def test_create_pipeline(self, auth_client):
        resp = auth_client.post(
            '/api/designs/pipelines/',
            {
                'name': 'My Flow',
                'tools': [{'tool_name': 'bg_remove', 'params': {}}],
                'is_preset': True,
            },
            format='json',
        )
        assert resp.status_code == 201
        assert resp.data['name'] == 'My Flow'

    def test_list_pipelines(self, auth_client, workspace, user):
        DesignPipeline.objects.create(
            workspace=workspace, name='P1', tools=[], created_by=user,
        )
        resp = auth_client.get('/api/designs/pipelines/')
        assert resp.status_code == 200
        assert resp.data['count'] == 1

    def test_update_pipeline(self, auth_client, workspace, user):
        p = DesignPipeline.objects.create(
            workspace=workspace, name='Old', tools=[], created_by=user,
        )
        resp = auth_client.patch(
            f'/api/designs/pipelines/{p.id}/',
            {'name': 'New'},
            format='json',
        )
        assert resp.status_code == 200
        assert resp.data['name'] == 'New'

    def test_delete_pipeline(self, auth_client, workspace, user):
        p = DesignPipeline.objects.create(
            workspace=workspace, name='Del', tools=[], created_by=user,
        )
        resp = auth_client.delete(f'/api/designs/pipelines/{p.id}/')
        assert resp.status_code == 204
