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
    DesignProject,
    ProjectReference,
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
def project(workspace, user):
    return DesignProject.objects.create(
        workspace=workspace,
        name='Test Project',
        created_by=user,
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

    def test_board_requires_workspace(self, django_user_model):
        """User with no workspace membership gets 400."""
        from workspace_app.models import Membership, Workspace
        no_ws_user = django_user_model.objects.create_user(
            email='nowsuser@example.com', password='testpass123',
        )
        # Remove auto-created workspace + membership
        Membership.objects.filter(user=no_ws_user).delete()
        Workspace.objects.filter(owner=no_ws_user).delete()
        client = APIClient()
        client.force_authenticate(user=no_ws_user)
        fake_id = uuid.uuid4()
        resp = client.get(f'/api/ideas/{fake_id}/design-board/')
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


class TestPipelineViewsExtended:
    """Extended pipeline CRUD tests — validation, workspace isolation, presets."""

    def test_create_pipeline_with_multiple_tools(self, auth_client):
        resp = auth_client.post(
            '/api/designs/pipelines/',
            {
                'name': 'Full POD Pipeline',
                'tools': [
                    {'tool_name': 'bg_remove', 'params': {'model': 'birefnet-general-lite'}},
                    {'tool_name': 'upscale', 'params': {'threshold': 3000}},
                    {'tool_name': 'trim', 'params': {'padding': 10}},
                ],
                'is_preset': True,
            },
            format='json',
        )
        assert resp.status_code == 201
        assert len(resp.data['tools']) == 3

    def test_create_pipeline_empty_tools(self, auth_client):
        """Empty tools array is valid — user may save and add later."""
        resp = auth_client.post(
            '/api/designs/pipelines/',
            {'name': 'Empty', 'tools': []},
            format='json',
        )
        assert resp.status_code == 201
        assert resp.data['tools'] == []

    def test_create_pipeline_missing_name(self, auth_client):
        resp = auth_client.post(
            '/api/designs/pipelines/',
            {'tools': [{'tool_name': 'bg_remove', 'params': {}}]},
            format='json',
        )
        assert resp.status_code == 400

    def test_workspace_isolation_list(self, auth_client, user):
        """Pipelines from another workspace don't appear in list."""
        from workspace_app.models import Workspace, Membership
        other_ws = Workspace.objects.create(
            name='Other', slug='other-pipe-list', owner=user,
        )
        Membership.objects.create(
            workspace=other_ws, user=user, role='admin', status='active',
        )
        DesignPipeline.objects.create(
            workspace=other_ws, name='Other Pipeline',
            tools=[], created_by=user,
        )
        resp = auth_client.get('/api/designs/pipelines/')
        assert resp.status_code == 200
        assert resp.data['count'] == 0

    def test_workspace_isolation_update(self, auth_client, user):
        """Cannot update pipeline in another workspace."""
        from workspace_app.models import Workspace
        other_ws = Workspace.objects.create(
            name='Other', slug='other-pipe-upd', owner=user,
        )
        p = DesignPipeline.objects.create(
            workspace=other_ws, name='Secret', tools=[], created_by=user,
        )
        resp = auth_client.patch(
            f'/api/designs/pipelines/{p.id}/',
            {'name': 'Hacked'},
            format='json',
        )
        assert resp.status_code == 404

    def test_workspace_isolation_delete(self, auth_client, user):
        """Cannot delete pipeline in another workspace."""
        from workspace_app.models import Workspace
        other_ws = Workspace.objects.create(
            name='Other', slug='other-pipe-del', owner=user,
        )
        p = DesignPipeline.objects.create(
            workspace=other_ws, name='Protected', tools=[], created_by=user,
        )
        resp = auth_client.delete(f'/api/designs/pipelines/{p.id}/')
        assert resp.status_code == 404

    def test_update_tools(self, auth_client, workspace, user):
        p = DesignPipeline.objects.create(
            workspace=workspace, name='Flow', tools=[], created_by=user,
        )
        new_tools = [{'tool_name': 'trim', 'params': {'padding': 5}}]
        resp = auth_client.patch(
            f'/api/designs/pipelines/{p.id}/',
            {'tools': new_tools},
            format='json',
        )
        assert resp.status_code == 200
        assert resp.data['tools'] == new_tools

    def test_list_filters_by_workspace(self, auth_client, workspace, user):
        """Only pipelines in the current workspace are returned."""
        DesignPipeline.objects.create(
            workspace=workspace, name='Mine', tools=[], created_by=user,
        )
        DesignPipeline.objects.create(
            workspace=workspace, name='Also Mine', tools=[], created_by=user,
        )
        resp = auth_client.get('/api/designs/pipelines/')
        assert resp.status_code == 200
        assert resp.data['count'] == 2

    def test_preset_flag(self, auth_client, workspace, user):
        p = DesignPipeline.objects.create(
            workspace=workspace, name='Preset', tools=[],
            is_preset=False, created_by=user,
        )
        resp = auth_client.patch(
            f'/api/designs/pipelines/{p.id}/',
            {'is_preset': True},
            format='json',
        )
        assert resp.status_code == 200
        assert resp.data['is_preset'] is True


class TestApplyPipelineView:
    """Tests for POST /api/designs/apply-pipeline/."""

    @patch('design_app.api.views.django_rq')
    def test_apply_pipeline_creates_server_jobs(
        self, mock_rq, auth_client, workspace, user, design,
    ):
        mock_queue = MagicMock()
        mock_queue.enqueue.return_value = MagicMock(id='rq-pipe-1')
        mock_rq.get_queue.return_value = mock_queue

        pipeline = DesignPipeline.objects.create(
            workspace=workspace,
            name='BG + Upscale',
            tools=[
                {'tool_name': 'bg_remove', 'params': {}},
                {'tool_name': 'upscale', 'params': {}},
            ],
            created_by=user,
        )
        resp = auth_client.post(
            '/api/designs/apply-pipeline/',
            {
                'design_ids': [str(design.id)],
                'pipeline_id': str(pipeline.id),
            },
            format='json',
        )
        assert resp.status_code == 200
        assert len(resp.data['server_jobs']) == 2
        assert DesignProcessingJob.objects.filter(design=design).count() == 2

    @patch('design_app.api.views.django_rq')
    def test_apply_pipeline_client_steps(
        self, mock_rq, auth_client, workspace, user, design,
    ):
        """Client-side tools (e.g. trim, filters) returned as client_steps."""
        mock_queue = MagicMock()
        mock_queue.enqueue.return_value = MagicMock(id='rq-pipe-2')
        mock_rq.get_queue.return_value = mock_queue

        pipeline = DesignPipeline.objects.create(
            workspace=workspace,
            name='Mixed Pipeline',
            tools=[
                {'tool_name': 'bg_remove', 'params': {}},
                {'tool_name': 'trim', 'params': {'padding': 10}},
                {'tool_name': 'filters', 'params': {'brightness': 1.2}},
            ],
            created_by=user,
        )
        resp = auth_client.post(
            '/api/designs/apply-pipeline/',
            {
                'design_ids': [str(design.id)],
                'pipeline_id': str(pipeline.id),
            },
            format='json',
        )
        assert resp.status_code == 200
        # 1 server job (bg_remove), 2 client steps (trim, filters)
        assert len(resp.data['server_jobs']) == 1
        assert len(resp.data['client_steps']) == 2
        assert resp.data['client_steps'][0]['tool_name'] == 'trim'
        assert resp.data['client_steps'][1]['tool_name'] == 'filters'

    def test_apply_pipeline_invalid_design_ids(self, auth_client, workspace, user):
        pipeline = DesignPipeline.objects.create(
            workspace=workspace,
            name='P',
            tools=[{'tool_name': 'bg_remove', 'params': {}}],
            created_by=user,
        )
        resp = auth_client.post(
            '/api/designs/apply-pipeline/',
            {
                'design_ids': [str(uuid.uuid4())],
                'pipeline_id': str(pipeline.id),
            },
            format='json',
        )
        assert resp.status_code == 400
        assert 'not found' in resp.data['error'].lower()

    def test_apply_pipeline_not_found(self, auth_client, design):
        resp = auth_client.post(
            '/api/designs/apply-pipeline/',
            {
                'design_ids': [str(design.id)],
                'pipeline_id': str(uuid.uuid4()),
            },
            format='json',
        )
        assert resp.status_code == 404

    @patch('design_app.api.views.django_rq')
    def test_apply_pipeline_workspace_isolation(
        self, mock_rq, auth_client, user, workspace,
    ):
        """Cannot apply pipeline from another workspace."""
        from workspace_app.models import Workspace
        other_ws = Workspace.objects.create(
            name='Other', slug='other-apply', owner=user,
        )
        pipeline = DesignPipeline.objects.create(
            workspace=other_ws, name='Other',
            tools=[{'tool_name': 'bg_remove', 'params': {}}],
            created_by=user,
        )
        from idea_app.models import Idea
        idea = Idea.objects.create(
            workspace=workspace, slogan_text='X', created_by=user,
        )
        d = Design.objects.create(workspace=workspace, idea=idea)

        resp = auth_client.post(
            '/api/designs/apply-pipeline/',
            {
                'design_ids': [str(d.id)],
                'pipeline_id': str(pipeline.id),
            },
            format='json',
        )
        assert resp.status_code == 404

    @patch('design_app.api.views.django_rq')
    def test_apply_pipeline_all_client_side(
        self, mock_rq, auth_client, workspace, user, design,
    ):
        """Pipeline with only client-side tools returns no server jobs."""
        pipeline = DesignPipeline.objects.create(
            workspace=workspace,
            name='Client Only',
            tools=[
                {'tool_name': 'trim', 'params': {}},
                {'tool_name': 'rotate', 'params': {'angle': 90}},
            ],
            created_by=user,
        )
        resp = auth_client.post(
            '/api/designs/apply-pipeline/',
            {
                'design_ids': [str(design.id)],
                'pipeline_id': str(pipeline.id),
            },
            format='json',
        )
        assert resp.status_code == 200
        assert len(resp.data['server_jobs']) == 0
        assert len(resp.data['client_steps']) == 2
        # Queue is initialized but enqueue is never called for client-only tools
        mock_queue = mock_rq.get_queue.return_value
        mock_queue.enqueue.assert_not_called()


class TestProcessingSettingsViewExtended:
    """Extended ProcessingSettings tests — API keys, isolation, providers."""

    def test_api_keys_write_only(self, auth_client, workspace):
        """GET should not return raw API key values."""
        from design_app.models import ProcessingSettings
        ProcessingSettings.objects.create(
            workspace=workspace,
            bg_removal_api_key='secret-bg-key-123',
            upscale_api_key='secret-up-key-456',
        )
        resp = auth_client.get('/api/designs/settings/')
        assert resp.status_code == 200
        assert 'bg_removal_api_key' not in resp.data
        assert 'upscale_api_key' not in resp.data

    def test_api_key_set_booleans(self, auth_client, workspace):
        """_set booleans reflect whether keys are stored."""
        resp = auth_client.get('/api/designs/settings/')
        assert resp.status_code == 200
        assert resp.data['bg_removal_api_key_set'] is False
        assert resp.data['upscale_api_key_set'] is False

    def test_patch_api_key_sets_flag(self, auth_client, workspace):
        """PATCH with API key saves it, next GET shows _set=True."""
        auth_client.get('/api/designs/settings/')  # ensure created
        resp = auth_client.patch(
            '/api/designs/settings/',
            {'bg_removal_api_key': 'my-secret-key'},
            format='json',
        )
        assert resp.status_code == 200
        assert resp.data['bg_removal_api_key_set'] is True

        # Verify persisted
        resp2 = auth_client.get('/api/designs/settings/')
        assert resp2.data['bg_removal_api_key_set'] is True
        assert 'bg_removal_api_key' not in resp2.data

    def test_patch_upscale_api_key(self, auth_client, workspace):
        auth_client.get('/api/designs/settings/')
        resp = auth_client.patch(
            '/api/designs/settings/',
            {'upscale_api_key': 'upscale-secret'},
            format='json',
        )
        assert resp.status_code == 200
        assert resp.data['upscale_api_key_set'] is True

    def test_provider_switching(self, auth_client, workspace):
        auth_client.get('/api/designs/settings/')
        resp = auth_client.patch(
            '/api/designs/settings/',
            {'bg_removal_provider': 'api'},
            format='json',
        )
        assert resp.status_code == 200
        assert resp.data['bg_removal_provider'] == 'api'

        resp2 = auth_client.patch(
            '/api/designs/settings/',
            {'bg_removal_provider': 'rembg'},
            format='json',
        )
        assert resp2.data['bg_removal_provider'] == 'rembg'

    def test_upscale_provider_switching(self, auth_client, workspace):
        auth_client.get('/api/designs/settings/')
        for provider in ('pica', 'api', 'auto'):
            resp = auth_client.patch(
                '/api/designs/settings/',
                {'upscale_provider': provider},
                format='json',
            )
            assert resp.status_code == 200
            assert resp.data['upscale_provider'] == provider

    def test_threshold_validation_valid(self, auth_client, workspace):
        auth_client.get('/api/designs/settings/')
        resp = auth_client.patch(
            '/api/designs/settings/',
            {'upscale_auto_threshold': 5000},
            format='json',
        )
        assert resp.status_code == 200
        assert resp.data['upscale_auto_threshold'] == 5000

    def test_workspace_isolation(self, auth_client, user, workspace):
        """Settings for another workspace are not accessible."""
        from workspace_app.models import Workspace
        from design_app.models import ProcessingSettings
        other_ws = Workspace.objects.create(
            name='Other', slug='other-settings', owner=user,
        )
        ProcessingSettings.objects.create(
            workspace=other_ws,
            bg_removal_provider='api',
            bg_removal_api_key='secret',
        )
        # auth_client uses the first workspace — should get default settings
        resp = auth_client.get('/api/designs/settings/')
        assert resp.status_code == 200
        assert resp.data['bg_removal_provider'] == 'rembg'
        assert resp.data['bg_removal_api_key_set'] is False

    def test_invalid_provider_rejected(self, auth_client, workspace):
        auth_client.get('/api/designs/settings/')
        resp = auth_client.patch(
            '/api/designs/settings/',
            {'bg_removal_provider': 'invalid_provider'},
            format='json',
        )
        assert resp.status_code == 400


class TestProjectReferencesView:
    """Tests for ProjectReferencesView — bulk add references."""

    def test_add_manual_references(self, auth_client, project):
        resp = auth_client.post(
            f'/api/designs/projects/{project.id}/references/',
            {
                'image_urls': [
                    {'url': 'https://example.com/img1.jpg', 'title': 'Ref 1'},
                    {'url': 'https://example.com/img2.jpg', 'title': 'Ref 2'},
                ],
            },
            format='json',
        )
        assert resp.status_code == 201
        assert len(resp.data) == 2
        assert resp.data[0]['image_url'] == 'https://example.com/img1.jpg'
        assert resp.data[0]['title'] == 'Ref 1'
        assert ProjectReference.objects.filter(project=project).count() == 2

    def test_add_references_from_products(self, auth_client, project):
        from scraper_app.models import AmazonProduct
        p1 = AmazonProduct.objects.create(
            title='Coffee Shirt',
            asin='B001ABC',
            thumbnail_url='https://images.amazon.com/1.jpg',
        )
        p2 = AmazonProduct.objects.create(
            title='Dog Shirt',
            asin='B002DEF',
            thumbnail_url='https://images.amazon.com/2.jpg',
        )
        resp = auth_client.post(
            f'/api/designs/projects/{project.id}/references/',
            {'product_ids': [str(p1.id), str(p2.id)]},
            format='json',
        )
        assert resp.status_code == 201
        assert len(resp.data) == 2
        # Verify source_product is linked
        ref = ProjectReference.objects.get(
            project=project, source_product=p1,
        )
        assert ref.asin == 'B001ABC'

    def test_bulk_create_dedup_skips_existing(self, auth_client, project):
        """Adding references with duplicate image_url should skip them."""
        ProjectReference.objects.create(
            project=project,
            image_url='https://example.com/existing.jpg',
            title='Existing',
            position=0,
        )
        resp = auth_client.post(
            f'/api/designs/projects/{project.id}/references/',
            {
                'image_urls': [
                    {'url': 'https://example.com/existing.jpg', 'title': 'Dup'},
                    {'url': 'https://example.com/new.jpg', 'title': 'New'},
                ],
            },
            format='json',
        )
        assert resp.status_code == 201
        # Should have 2 total: 1 existing + 1 new (dup skipped)
        assert len(resp.data) == 2
        assert ProjectReference.objects.filter(project=project).count() == 2

    def test_missing_payload_returns_400(self, auth_client, project):
        resp = auth_client.post(
            f'/api/designs/projects/{project.id}/references/',
            {},
            format='json',
        )
        assert resp.status_code == 400

    def test_workspace_isolation(self, auth_client, user):
        """Cannot add references to project in another workspace."""
        from workspace_app.models import Workspace
        other_ws = Workspace.objects.create(
            name='Other WS', slug='other-ref', owner=user,
        )
        other_proj = DesignProject.objects.create(
            workspace=other_ws, name='Other Proj', created_by=user,
        )
        resp = auth_client.post(
            f'/api/designs/projects/{other_proj.id}/references/',
            {
                'image_urls': [
                    {'url': 'https://example.com/hack.jpg'},
                ],
            },
            format='json',
        )
        assert resp.status_code == 404


class TestProjectReferenceRemoveView:
    """Tests for ProjectReferenceRemoveView — delete a reference."""

    def test_delete_reference(self, auth_client, project):
        ref = ProjectReference.objects.create(
            project=project,
            image_url='https://example.com/del.jpg',
            position=0,
        )
        resp = auth_client.delete(
            f'/api/designs/projects/{project.id}/references/{ref.id}/',
        )
        assert resp.status_code == 204
        assert not ProjectReference.objects.filter(pk=ref.id).exists()

    def test_delete_nonexistent_returns_404(self, auth_client, project):
        fake_id = uuid.uuid4()
        resp = auth_client.delete(
            f'/api/designs/projects/{project.id}/references/{fake_id}/',
        )
        assert resp.status_code == 404

    def test_workspace_isolation(self, auth_client, user):
        from workspace_app.models import Workspace
        other_ws = Workspace.objects.create(
            name='Other', slug='other-del-ref', owner=user,
        )
        other_proj = DesignProject.objects.create(
            workspace=other_ws, name='Other', created_by=user,
        )
        ref = ProjectReference.objects.create(
            project=other_proj,
            image_url='https://example.com/other.jpg',
            position=0,
        )
        resp = auth_client.delete(
            f'/api/designs/projects/{other_proj.id}/references/{ref.id}/',
        )
        assert resp.status_code == 404


class TestProjectBoardReferences:
    """Tests that ProjectBoardView includes references in response."""

    def test_board_includes_references(self, auth_client, project):
        ProjectReference.objects.create(
            project=project,
            image_url='https://example.com/board-ref.jpg',
            title='Board Ref',
            position=0,
        )
        resp = auth_client.get(
            f'/api/designs/projects/{project.id}/board/',
        )
        assert resp.status_code == 200
        assert 'references' in resp.data
        assert len(resp.data['references']) == 1
        assert resp.data['references'][0]['image_url'] == 'https://example.com/board-ref.jpg'

    def test_board_empty_references(self, auth_client, project):
        resp = auth_client.get(
            f'/api/designs/projects/{project.id}/board/',
        )
        assert resp.status_code == 200
        assert resp.data['references'] == []


class TestImageToImageGeneration:
    """Tests for image-to-image generation mode."""

    @patch('design_app.api.views.django_rq')
    def test_i2i_standalone_generate(self, mock_rq, auth_client, project):
        """Valid i2i request creates run with mode + source_image_url."""
        mock_queue = MagicMock()
        mock_queue.enqueue.return_value = MagicMock(id='rq-i2i-1')
        mock_rq.get_queue.return_value = mock_queue

        resp = auth_client.post(
            '/api/designs/generate/',
            {
                'model': 'gemini_flash',
                'prompt': 'Remix this design with brighter colors',
                'mode': 'image_to_image',
                'source_image_url': 'https://example.com/ref.png',
                'project_id': str(project.id),
            },
            format='json',
        )
        assert resp.status_code == 202
        assert resp.data['generation_mode'] == 'image_to_image'
        assert resp.data['source_image_url'] == 'https://example.com/ref.png'

        # Verify run was created correctly
        run = DesignGenerationRun.objects.get(pk=resp.data['id'])
        assert run.generation_mode == 'image_to_image'
        assert run.source_image_url == 'https://example.com/ref.png'

    def test_i2i_missing_source_url(self, auth_client, project):
        """i2i mode without source_image_url returns 400."""
        resp = auth_client.post(
            '/api/designs/generate/',
            {
                'model': 'gemini_flash',
                'prompt': 'Remix this design with brighter colors',
                'mode': 'image_to_image',
                'project_id': str(project.id),
            },
            format='json',
        )
        assert resp.status_code == 400
        assert 'source_image_url' in str(resp.data)

    def test_i2i_non_multimodal_model(self, auth_client, project):
        """i2i with non-multimodal model returns 400."""
        resp = auth_client.post(
            '/api/designs/generate/',
            {
                'model': 'black-forest-labs/flux-1.1-pro',
                'prompt': 'Remix this design with brighter colors',
                'mode': 'image_to_image',
                'source_image_url': 'https://example.com/ref.png',
                'project_id': str(project.id),
            },
            format='json',
        )
        assert resp.status_code == 400
        assert 'multimodal' in resp.data['error'].lower()

    @patch('design_app.api.views.django_rq')
    def test_t2i_default_mode(self, mock_rq, auth_client, project):
        """Omitting mode defaults to text_to_image."""
        mock_queue = MagicMock()
        mock_queue.enqueue.return_value = MagicMock(id='rq-t2i-1')
        mock_rq.get_queue.return_value = mock_queue

        resp = auth_client.post(
            '/api/designs/generate/',
            {
                'model': 'gemini_flash',
                'prompt': 'A coffee-themed design with bold text',
                'project_id': str(project.id),
            },
            format='json',
        )
        assert resp.status_code == 202
        assert resp.data['generation_mode'] == 'text_to_image'

    @patch('design_app.api.views.django_rq')
    def test_i2i_idea_scoped_generate(self, mock_rq, auth_client, idea):
        """i2i works via idea-scoped endpoint too."""
        mock_queue = MagicMock()
        mock_queue.enqueue.return_value = MagicMock(id='rq-i2i-2')
        mock_rq.get_queue.return_value = mock_queue

        resp = auth_client.post(
            f'/api/ideas/{idea.id}/designs/generate/',
            {
                'model': 'gemini_flash',
                'prompt': 'Remix this design with vintage style',
                'mode': 'image_to_image',
                'source_image_url': 'https://example.com/ref2.png',
            },
            format='json',
        )
        assert resp.status_code == 202
        assert resp.data['generation_mode'] == 'image_to_image'

    def test_i2i_idea_scoped_non_multimodal(self, auth_client, idea):
        """i2i with non-multimodal model on idea endpoint returns 400."""
        resp = auth_client.post(
            f'/api/ideas/{idea.id}/designs/generate/',
            {
                'model': 'black-forest-labs/flux-1.1-pro',
                'prompt': 'Remix this design with brighter colors',
                'mode': 'image_to_image',
                'source_image_url': 'https://example.com/ref.png',
            },
            format='json',
        )
        assert resp.status_code == 400


class TestGenerationModesSerialization:
    """Tests for all 4 generation modes: serializer + view validation."""

    # -- Serializer validation --

    def test_image_to_image_requires_source_url(self):
        from design_app.api.serializers import GenerateDesignSerializer
        s = GenerateDesignSerializer(data={
            'model': 'gemini_flash',
            'prompt': 'A beautiful coffee cup design',
            'mode': 'image_to_image',
        })
        assert not s.is_valid()
        assert 'source_image_url' in s.errors

    def test_image_to_image_edit_requires_source_url(self):
        from design_app.api.serializers import GenerateDesignSerializer
        s = GenerateDesignSerializer(data={
            'model': 'gemini_flash',
            'prompt': 'Change background to blue please',
            'mode': 'image_to_image_edit',
        })
        assert not s.is_valid()
        assert 'source_image_url' in s.errors

    def test_remix_requires_both_urls(self):
        from design_app.api.serializers import GenerateDesignSerializer
        s = GenerateDesignSerializer(data={
            'model': 'gemini_flash',
            'prompt': 'Mix these two designs together',
            'mode': 'remix',
        })
        assert not s.is_valid()
        assert 'source_image_url' in s.errors
        assert 'source_image_url_2' in s.errors

    def test_remix_requires_url_2(self):
        from design_app.api.serializers import GenerateDesignSerializer
        s = GenerateDesignSerializer(data={
            'model': 'gemini_flash',
            'prompt': 'Mix these two designs together',
            'mode': 'remix',
            'source_image_url': 'https://example.com/a.jpg',
        })
        assert not s.is_valid()
        assert 'source_image_url_2' in s.errors

    def test_remix_valid_with_both_urls(self):
        from design_app.api.serializers import GenerateDesignSerializer
        s = GenerateDesignSerializer(data={
            'model': 'gemini_flash',
            'prompt': 'Mix these two designs together',
            'mode': 'remix',
            'source_image_url': 'https://example.com/a.jpg',
            'source_image_url_2': 'https://example.com/b.jpg',
        })
        assert s.is_valid(), s.errors

    def test_text_to_image_valid_without_urls(self):
        from design_app.api.serializers import GenerateDesignSerializer
        s = GenerateDesignSerializer(data={
            'model': 'gemini_flash',
            'prompt': 'A beautiful sunset design for t-shirt',
            'mode': 'text_to_image',
        })
        assert s.is_valid(), s.errors

    def test_image_to_image_edit_valid(self):
        from design_app.api.serializers import GenerateDesignSerializer
        s = GenerateDesignSerializer(data={
            'model': 'gemini_flash',
            'prompt': 'Change the background to blue',
            'mode': 'image_to_image_edit',
            'source_image_url': 'https://example.com/ref.jpg',
        })
        assert s.is_valid(), s.errors

    # -- Standalone serializer --

    def test_standalone_remix_requires_both_urls(self):
        from design_app.api.serializers import StandaloneGenerateSerializer
        s = StandaloneGenerateSerializer(data={
            'model': 'gemini_flash',
            'prompt': 'Mix these two designs together',
            'mode': 'remix',
            'source_image_url': 'https://example.com/a.jpg',
        })
        assert not s.is_valid()
        assert 'source_image_url_2' in s.errors

    def test_standalone_remix_valid(self):
        from design_app.api.serializers import StandaloneGenerateSerializer
        s = StandaloneGenerateSerializer(data={
            'model': 'gemini_flash',
            'prompt': 'Mix these two designs together',
            'mode': 'remix',
            'source_image_url': 'https://example.com/a.jpg',
            'source_image_url_2': 'https://example.com/b.jpg',
        })
        assert s.is_valid(), s.errors

    # -- GenerateFromPrompt serializer --

    def test_prompt_serializer_remix_requires_both(self):
        from design_app.api.serializers import GenerateFromPromptSerializer
        s = GenerateFromPromptSerializer(data={
            'model': 'gemini_flash',
            'mode': 'remix',
            'source_image_url': 'https://example.com/a.jpg',
        })
        assert not s.is_valid()
        assert 'source_image_url_2' in s.errors

    def test_prompt_serializer_edit_valid(self):
        from design_app.api.serializers import GenerateFromPromptSerializer
        s = GenerateFromPromptSerializer(data={
            'model': 'gemini_flash',
            'mode': 'image_to_image_edit',
            'source_image_url': 'https://example.com/ref.jpg',
        })
        assert s.is_valid(), s.errors

    # -- View integration tests --

    @patch('design_app.api.views.django_rq')
    def test_edit_mode_idea_endpoint(self, mock_rq, auth_client, idea):
        mock_queue = MagicMock()
        mock_job = MagicMock()
        mock_job.id = 'test-job-id'
        mock_queue.enqueue.return_value = mock_job
        mock_rq.get_queue.return_value = mock_queue

        resp = auth_client.post(
            f'/api/ideas/{idea.id}/designs/generate/',
            {
                'model': 'gemini_flash',
                'prompt': 'Change the font to bold serif style',
                'mode': 'image_to_image_edit',
                'source_image_url': 'https://example.com/ref.png',
            },
            format='json',
        )
        assert resp.status_code == 202
        assert resp.data['generation_mode'] == 'image_to_image_edit'

    @patch('design_app.api.views.django_rq')
    def test_remix_mode_idea_endpoint(self, mock_rq, auth_client, idea):
        mock_queue = MagicMock()
        mock_job = MagicMock()
        mock_job.id = 'test-job-id'
        mock_queue.enqueue.return_value = mock_job
        mock_rq.get_queue.return_value = mock_queue

        resp = auth_client.post(
            f'/api/ideas/{idea.id}/designs/generate/',
            {
                'model': 'gemini_flash',
                'prompt': 'Blend both reference designs into something new',
                'mode': 'remix',
                'source_image_url': 'https://example.com/a.png',
                'source_image_url_2': 'https://example.com/b.png',
            },
            format='json',
        )
        assert resp.status_code == 202
        assert resp.data['generation_mode'] == 'remix'
        assert resp.data['source_image_url_2'] == 'https://example.com/b.png'

    def test_remix_non_multimodal_returns_400(self, auth_client, idea):
        resp = auth_client.post(
            f'/api/ideas/{idea.id}/designs/generate/',
            {
                'model': 'black-forest-labs/flux-1.1-pro',
                'prompt': 'Blend both reference designs into something new',
                'mode': 'remix',
                'source_image_url': 'https://example.com/a.png',
                'source_image_url_2': 'https://example.com/b.png',
            },
            format='json',
        )
        assert resp.status_code == 400

    def test_edit_non_multimodal_returns_400(self, auth_client, idea):
        resp = auth_client.post(
            f'/api/ideas/{idea.id}/designs/generate/',
            {
                'model': 'black-forest-labs/flux-1.1-pro',
                'prompt': 'Change the background to blue please',
                'mode': 'image_to_image_edit',
                'source_image_url': 'https://example.com/ref.png',
            },
            format='json',
        )
        assert resp.status_code == 400

    @patch('design_app.api.views.django_rq')
    def test_remix_mode_standalone_endpoint(self, mock_rq, auth_client):
        mock_queue = MagicMock()
        mock_job = MagicMock()
        mock_job.id = 'test-job-id'
        mock_queue.enqueue.return_value = mock_job
        mock_rq.get_queue.return_value = mock_queue

        resp = auth_client.post(
            '/api/designs/generate/',
            {
                'model': 'gemini_flash',
                'prompt': 'Mix these two awesome reference designs',
                'mode': 'remix',
                'source_image_url': 'https://example.com/a.png',
                'source_image_url_2': 'https://example.com/b.png',
            },
            format='json',
        )
        assert resp.status_code == 202
        assert resp.data['generation_mode'] == 'remix'

    def test_remix_standalone_missing_url_2(self, auth_client):
        resp = auth_client.post(
            '/api/designs/generate/',
            {
                'model': 'gemini_flash',
                'prompt': 'Mix these two awesome reference designs',
                'mode': 'remix',
                'source_image_url': 'https://example.com/a.png',
            },
            format='json',
        )
        assert resp.status_code == 400
