"""URL routing for design_app API."""

from django.urls import path

from design_app.api.upscale_views import (
    UpscaleBatchStatusView,
    UpscaleBulkView,
    UpscaleCallbackView,
    UpscaleQuotaView,
    UpscaleSingleView,
)
from design_app.api.views import (
    AnalyzeImageView,
    ApplyPipelineView,
    BatchProcessView,
    BuilderBuildView,
    BuilderPresetDetailView,
    BuilderPresetListCreateView,
    BuildPromptsView,
    DesignBoardView,
    DesignDeleteVersionView,
    DesignDetailView,
    DesignDownloadView,
    DesignListByIdsView,
    DesignListView,
    DesignRevertView,
    DesignSaveProcessedView,
    GenerateDesignView,
    GenerateFromPromptView,
    PipelineDetailView,
    PipelineListCreateView,
    ProcessingJobStatusView,
    ProcessingSettingsView,
    ProductAnalyzeImageView,
    ProjectBoardView,
    ProjectDesignRemoveView,
    ProjectDesignsView,
    ProjectDetailView,
    ProjectIdeaRemoveView,
    ProjectIdeasView,
    ProjectListCreateView,
    ProjectPromptDetailView,
    ProjectPromptsView,
    ProjectReferenceRemoveView,
    ProjectReferencesView,
    ProjectUploadView,
    PromptPresetDeleteView,
    PromptPresetListCreateView,
    RunStatusView,
    StandaloneGenerateView,
)

urlpatterns = [
    # Board context (idea-scoped)
    path(
        'ideas/<uuid:pk>/design-board/',
        DesignBoardView.as_view(),
        name='design-board',
    ),
    # Design list (idea-scoped)
    path(
        'ideas/<uuid:pk>/designs/',
        DesignListView.as_view(),
        name='design-list',
    ),
    # Generate design (idea-scoped)
    path(
        'ideas/<uuid:pk>/designs/generate/',
        GenerateDesignView.as_view(),
        name='design-generate',
    ),
    # Design list by IDs (query param: ?ids=uuid1,uuid2)
    path(
        'designs/',
        DesignListByIdsView.as_view(),
        name='design-list-by-ids',
    ),
    # Design detail: PATCH status, DELETE
    path(
        'designs/<uuid:pk>/',
        DesignDetailView.as_view(),
        name='design-detail',
    ),
    # Download design image
    path(
        'designs/<uuid:pk>/download/',
        DesignDownloadView.as_view(),
        name='design-download',
    ),
    # Revert design to original (delete processed files)
    path(
        'designs/<uuid:pk>/revert/',
        DesignRevertView.as_view(),
        name='design-revert',
    ),
    # Save processed image (to processed_file)
    path(
        'designs/<uuid:pk>/save-processed/',
        DesignSaveProcessedView.as_view(),
        name='design-save-processed',
    ),
    # Delete a specific file version
    path(
        'designs/<uuid:pk>/delete-version/',
        DesignDeleteVersionView.as_view(),
        name='design-delete-version',
    ),
    # Analyze image on a design
    path(
        'designs/<uuid:pk>/analyze-image/',
        AnalyzeImageView.as_view(),
        name='design-analyze-image',
    ),
    # Poll generation run status
    path(
        'designs/runs/<uuid:run_id>/',
        RunStatusView.as_view(),
        name='design-run-status',
    ),
    # Batch processing
    path(
        'designs/batch-process/',
        BatchProcessView.as_view(),
        name='design-batch-process',
    ),
    # Poll processing job
    path(
        'designs/processing-jobs/<uuid:job_id>/',
        ProcessingJobStatusView.as_view(),
        name='design-processing-job-status',
    ),
    # Processing settings
    path(
        'designs/settings/',
        ProcessingSettingsView.as_view(),
        name='design-processing-settings',
    ),
    # Pipeline CRUD
    path(
        'designs/pipelines/',
        PipelineListCreateView.as_view(),
        name='design-pipeline-list-create',
    ),
    path(
        'designs/pipelines/<uuid:pk>/',
        PipelineDetailView.as_view(),
        name='design-pipeline-detail',
    ),
    # Apply pipeline
    path(
        'designs/apply-pipeline/',
        ApplyPipelineView.as_view(),
        name='design-apply-pipeline',
    ),
    # Standalone generate (project-scoped)
    path(
        'designs/generate/',
        StandaloneGenerateView.as_view(),
        name='design-standalone-generate',
    ),
    # Design Projects CRUD
    path(
        'designs/projects/',
        ProjectListCreateView.as_view(),
        name='design-project-list-create',
    ),
    path(
        'designs/projects/<uuid:pk>/',
        ProjectDetailView.as_view(),
        name='design-project-detail',
    ),
    # Project <-> Design M2M
    path(
        'designs/projects/<uuid:pk>/designs/',
        ProjectDesignsView.as_view(),
        name='design-project-designs',
    ),
    path(
        'designs/projects/<uuid:pk>/designs/<uuid:design_id>/',
        ProjectDesignRemoveView.as_view(),
        name='design-project-design-remove',
    ),
    # Project board context
    path(
        'designs/projects/<uuid:pk>/board/',
        ProjectBoardView.as_view(),
        name='design-project-board',
    ),
    # Manual image upload to project
    path(
        'designs/projects/<uuid:project_id>/upload/',
        ProjectUploadView.as_view(),
        name='design-project-upload',
    ),
    # Slogan Pool (G2)
    path(
        'designs/projects/<uuid:pk>/ideas/',
        ProjectIdeasView.as_view(),
        name='design-project-ideas',
    ),
    path(
        'designs/projects/<uuid:pk>/ideas/<uuid:idea_id>/',
        ProjectIdeaRemoveView.as_view(),
        name='design-project-idea-remove',
    ),
    # Project References (I2)
    path(
        'designs/projects/<uuid:pk>/references/',
        ProjectReferencesView.as_view(),
        name='design-project-references',
    ),
    path(
        'designs/projects/<uuid:pk>/references/<uuid:ref_id>/',
        ProjectReferenceRemoveView.as_view(),
        name='design-project-reference-remove',
    ),
    # ProjectPrompt CRUD (G9)
    path(
        'designs/projects/<uuid:pk>/prompts/',
        ProjectPromptsView.as_view(),
        name='design-project-prompts',
    ),
    path(
        'designs/projects/<uuid:pk>/prompts/<uuid:prompt_id>/',
        ProjectPromptDetailView.as_view(),
        name='design-project-prompt-detail',
    ),
    path(
        'designs/projects/<uuid:pk>/prompts/<uuid:prompt_id>/generate/',
        GenerateFromPromptView.as_view(),
        name='design-project-prompt-generate',
    ),
    # Prompt Builder (G10)
    path(
        'designs/projects/<uuid:pk>/build-prompts/',
        BuildPromptsView.as_view(),
        name='design-project-build-prompts',
    ),
    # PROJ-34 — Multi-Prompt Builder (N×M cross-product + polish)
    path(
        'designs/projects/<uuid:pk>/builder/build/',
        BuilderBuildView.as_view(),
        name='design-project-builder-build',
    ),
    # PROJ-34 — BuilderPreset CRUD
    path(
        'designs/projects/<uuid:pk>/builder-presets/',
        BuilderPresetListCreateView.as_view(),
        name='design-project-builder-presets',
    ),
    path(
        'designs/projects/<uuid:pk>/builder-presets/<uuid:preset_id>/',
        BuilderPresetDetailView.as_view(),
        name='design-project-builder-preset-detail',
    ),
    # Prompt Presets (G10)
    path(
        'designs/prompt-presets/',
        PromptPresetListCreateView.as_view(),
        name='design-prompt-preset-list-create',
    ),
    path(
        'designs/prompt-presets/<uuid:pk>/',
        PromptPresetDeleteView.as_view(),
        name='design-prompt-preset-delete',
    ),
    # Product image analysis (PROJ-7 integration)
    path(
        'products/<uuid:product_id>/analyze-image/',
        ProductAnalyzeImageView.as_view(),
        name='product-analyze-image',
    ),

    # PROJ-27 — AI Upscaler endpoints.
    # Bulk + batch + quota are listed before the single-mode trigger so the
    # static segment 'upscale/<bulk|batch|quota>' wins over the UUID path.
    path(
        'designs/upscale/bulk/',
        UpscaleBulkView.as_view(),
        name='design-upscale-bulk',
    ),
    path(
        'designs/upscale/batch/<uuid:batch_id>/',
        UpscaleBatchStatusView.as_view(),
        name='design-upscale-batch-status',
    ),
    path(
        'designs/upscale/quota/',
        UpscaleQuotaView.as_view(),
        name='design-upscale-quota',
    ),
    path(
        'designs/<uuid:design_id>/upscale/',
        UpscaleSingleView.as_view(),
        name='design-upscale-single',
    ),
    # Webhook is published at /api/upscale/callback/ — no JWT, signature-verified.
    path(
        'upscale/callback/',
        UpscaleCallbackView.as_view(),
        name='upscale-replicate-callback',
    ),
]
