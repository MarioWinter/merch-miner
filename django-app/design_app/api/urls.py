"""URL routing for design_app API."""

from django.urls import path

from design_app.api.views import (
    AnalyzeImageView,
    ApplyPipelineView,
    BatchProcessView,
    DesignBoardView,
    DesignDetailView,
    DesignDownloadView,
    DesignListView,
    GenerateDesignView,
    PipelineDetailView,
    PipelineListCreateView,
    ProcessingJobStatusView,
    ProcessingSettingsView,
    RunStatusView,
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
]
