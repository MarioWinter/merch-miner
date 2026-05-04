"""Tests for design_app models."""

import pytest
from django.utils import timezone

from design_app.models import (
    Design,
    DesignGenerationRun,
    DesignPipeline,
    DesignProcessingJob,
    ProcessingSettings,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        email='test@example.com', password='testpass123',
    )


@pytest.fixture
def workspace(user):
    from workspace_app.models import Workspace
    return Workspace.objects.create(name='Test WS', slug='test-ws', owner=user)


@pytest.fixture
def idea(workspace, user):
    from idea_app.models import Idea
    return Idea.objects.create(
        workspace=workspace,
        slogan_text='Test Slogan',
        created_by=user,
    )


class TestDesignGenerationRun:
    def test_create_run(self, idea, user):
        run = DesignGenerationRun.objects.create(
            idea=idea,
            model_name=DesignGenerationRun.ModelName.GEMINI_FLASH,
            triggered_by=user,
            prompt_used='test prompt',
        )
        assert run.status == DesignGenerationRun.Status.PENDING
        assert run.model_name == 'gemini_flash'
        assert str(run.id)[:8] in str(run)

    def test_status_transitions(self, idea, user):
        run = DesignGenerationRun.objects.create(
            idea=idea,
            model_name=DesignGenerationRun.ModelName.FLUX,
            triggered_by=user,
        )
        assert run.status == 'pending'

        run.status = DesignGenerationRun.Status.RUNNING
        run.save(update_fields=['status'])
        run.refresh_from_db()
        assert run.status == 'running'

        run.status = DesignGenerationRun.Status.COMPLETED
        run.completed_at = timezone.now()
        run.save(update_fields=['status', 'completed_at'])
        run.refresh_from_db()
        assert run.status == 'completed'
        assert run.completed_at is not None


class TestDesign:
    def test_create_design(self, workspace, idea):
        design = Design.objects.create(
            workspace=workspace,
            idea=idea,
            status=Design.Status.PENDING,
        )
        assert design.background_color == Design.BackgroundColor.LIGHT_GRAY
        assert not design.is_manual

    def test_auto_reject_on_approve(self, workspace, idea):
        """Approving a new design should let views auto-reject previous approved."""
        d1 = Design.objects.create(
            workspace=workspace, idea=idea, status=Design.Status.APPROVED,
        )
        d2 = Design.objects.create(
            workspace=workspace, idea=idea, status=Design.Status.PENDING,
        )

        # Simulate what the view does: reject others, then approve new
        Design.objects.filter(
            idea=idea, workspace=workspace, status=Design.Status.APPROVED,
        ).exclude(pk=d2.pk).update(status=Design.Status.REJECTED)

        d2.status = Design.Status.APPROVED
        d2.save(update_fields=['status'])

        d1.refresh_from_db()
        d2.refresh_from_db()
        assert d1.status == 'rejected'
        assert d2.status == 'approved'

    def test_bg_color_hex_mapping(self):
        assert Design.BG_COLOR_HEX['light_gray'] == '#D3D3D3'
        assert Design.BG_COLOR_HEX['neon_pink'] == '#FF6EC7'
        assert Design.BG_COLOR_HEX['neon_green'] == '#39FF14'


class TestDesignProcessingJob:
    def test_create_job(self, workspace, idea):
        design = Design.objects.create(workspace=workspace, idea=idea)
        job = DesignProcessingJob.objects.create(
            design=design,
            type=DesignProcessingJob.JobType.UPSCALE,
        )
        assert job.status == 'pending'
        assert job.type == 'upscale'

    def test_failure_isolation(self, workspace, idea):
        """One failed job should not affect others."""
        design = Design.objects.create(workspace=workspace, idea=idea)
        j1 = DesignProcessingJob.objects.create(
            design=design, type='upscale',
            status=DesignProcessingJob.Status.FAILED,
            error_message='timeout',
        )
        j2 = DesignProcessingJob.objects.create(
            design=design, type='bg_remove',
            status=DesignProcessingJob.Status.COMPLETED,
        )
        assert j1.status == 'failed'
        assert j2.status == 'completed'


class TestProcessingSettings:
    def test_defaults(self, workspace):
        ps = ProcessingSettings.objects.create(workspace=workspace)
        assert ps.bg_removal_provider == 'rembg'
        assert ps.upscale_provider == 'auto'
        assert ps.upscale_auto_threshold == 3000

    def test_one_to_one(self, workspace):
        ProcessingSettings.objects.create(workspace=workspace)
        with pytest.raises(Exception):
            ProcessingSettings.objects.create(workspace=workspace)


class TestGenerationModes:
    def test_mode_choices(self):
        choices = dict(DesignGenerationRun.Mode.choices)
        assert 'text_to_image' in choices
        assert 'image_to_image' in choices
        assert 'image_to_image_edit' in choices
        assert 'remix' in choices
        assert len(choices) == 4

    def test_create_remix_run(self, idea, user):
        run = DesignGenerationRun.objects.create(
            idea=idea,
            model_name=DesignGenerationRun.ModelName.GEMINI_FLASH,
            triggered_by=user,
            prompt_used='Mix these',
            generation_mode=DesignGenerationRun.Mode.REMIX,
            source_image_url='https://example.com/a.jpg',
            source_image_url_2='https://example.com/b.jpg',
        )
        run.refresh_from_db()
        assert run.generation_mode == 'remix'
        assert run.source_image_url == 'https://example.com/a.jpg'
        assert run.source_image_url_2 == 'https://example.com/b.jpg'

    def test_create_edit_run(self, idea, user):
        run = DesignGenerationRun.objects.create(
            idea=idea,
            model_name=DesignGenerationRun.ModelName.GEMINI_FLASH,
            triggered_by=user,
            prompt_used='Change color',
            generation_mode=DesignGenerationRun.Mode.IMAGE_TO_IMAGE_EDIT,
            source_image_url='https://example.com/ref.jpg',
        )
        run.refresh_from_db()
        assert run.generation_mode == 'image_to_image_edit'
        assert run.source_image_url_2 == ''

    def test_source_image_url_2_defaults_empty(self, idea, user):
        run = DesignGenerationRun.objects.create(
            idea=idea,
            model_name=DesignGenerationRun.ModelName.GEMINI_FLASH,
            triggered_by=user,
            prompt_used='Simple text',
        )
        assert run.source_image_url_2 == ''


class TestDesignPipeline:
    def test_create_pipeline(self, workspace, user):
        pipeline = DesignPipeline.objects.create(
            workspace=workspace,
            name='My Pipeline',
            tools=[
                {'tool_name': 'bg_remove', 'params': {}},
                {'tool_name': 'upscale', 'params': {'threshold': 3000}},
            ],
            is_preset=True,
            created_by=user,
        )
        assert len(pipeline.tools) == 2
        assert pipeline.is_preset
