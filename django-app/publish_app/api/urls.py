"""URL routing for publish_app API."""

from django.urls import path

from publish_app.api.views import (
    DesignGalleryBulkActionView,
    DesignGalleryDetailView,
    DesignGalleryImportView,
    DesignGalleryListView,
    DesignGalleryUploadView,
    LifecycleUpdateView,
    ListingDetailView,
    ListingExportView,
    ListingGenerateView,
    ListingTMCheckView,
    ListingTranslateView,
    ListingUpdateView,
    NicheLifecycleView,
    UploadJobBatchCreateView,
    UploadJobCancelView,
    UploadJobCreateView,
    UploadJobDetailView,
    UploadJobListView,
    UploadJobStatusUpdateView,
    UploadTemplateDetailView,
    UploadTemplateListCreateView,
)

urlpatterns = [
    # Listing endpoints
    path(
        'ideas/<uuid:pk>/listing/generate/',
        ListingGenerateView.as_view(),
        name='listing-generate',
    ),
    path(
        'ideas/<uuid:pk>/listing/',
        ListingDetailView.as_view(),
        name='listing-detail',
    ),
    path(
        'listings/<uuid:pk>/',
        ListingUpdateView.as_view(),
        name='listing-update',
    ),
    path(
        'listings/<uuid:pk>/translate/',
        ListingTranslateView.as_view(),
        name='listing-translate',
    ),
    path(
        'listings/<uuid:pk>/tm-check/',
        ListingTMCheckView.as_view(),
        name='listing-tm-check',
    ),
    path(
        'listings/<uuid:pk>/export/',
        ListingExportView.as_view(),
        name='listing-export',
    ),

    # Design Gallery endpoints
    path(
        'designs/gallery/',
        DesignGalleryListView.as_view(),
        name='design-gallery-list',
    ),
    path(
        'designs/gallery/upload/',
        DesignGalleryUploadView.as_view(),
        name='design-gallery-upload',
    ),
    path(
        'designs/gallery/import-drive/',
        DesignGalleryImportView.as_view(),
        name='design-gallery-import',
    ),
    path(
        'designs/gallery/bulk-action/',
        DesignGalleryBulkActionView.as_view(),
        name='design-gallery-bulk-action',
    ),
    path(
        'designs/gallery/<uuid:pk>/',
        DesignGalleryDetailView.as_view(),
        name='design-gallery-detail',
    ),

    # Upload Job endpoints
    path(
        'upload-jobs/',
        UploadJobCreateView.as_view(),
        name='upload-job-create',
    ),
    path(
        'upload-jobs/list/',
        UploadJobListView.as_view(),
        name='upload-job-list',
    ),
    path(
        'upload-jobs/batch/',
        UploadJobBatchCreateView.as_view(),
        name='upload-job-batch',
    ),
    path(
        'upload-jobs/<uuid:pk>/',
        UploadJobDetailView.as_view(),
        name='upload-job-detail',
    ),
    path(
        'upload-jobs/<uuid:pk>/cancel/',
        UploadJobCancelView.as_view(),
        name='upload-job-cancel',
    ),
    path(
        'upload-jobs/<uuid:pk>/status/',
        UploadJobStatusUpdateView.as_view(),
        name='upload-job-status-update',
    ),

    # Upload Template endpoints
    path(
        'upload-templates/',
        UploadTemplateListCreateView.as_view(),
        name='upload-template-list-create',
    ),
    path(
        'upload-templates/<uuid:pk>/',
        UploadTemplateDetailView.as_view(),
        name='upload-template-detail',
    ),

    # Product Lifecycle endpoints
    path(
        'niches/<uuid:pk>/lifecycle/',
        NicheLifecycleView.as_view(),
        name='niche-lifecycle',
    ),
    path(
        'lifecycle/<uuid:pk>/',
        LifecycleUpdateView.as_view(),
        name='lifecycle-update',
    ),
]
