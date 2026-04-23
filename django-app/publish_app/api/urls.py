"""URL routing for publish_app API."""

from django.urls import path

from publish_app.api.views import (
    CollectionDetailView,
    CollectionListCreateView,
    CollectionTreeView,
    DesignAssetDuplicateView,
    DesignGalleryBulkActionView,
    DesignGalleryDetailView,
    DesignGalleryImportView,
    DesignGalleryListView,
    DesignGalleryMoveView,
    DesignGalleryUploadView,
    DesignProductConfigCopyFromView,
    DesignProductConfigView,
    LifecycleUpdateView,
    ListingAIImproveView,
    ListingConvertView,
    ListingDetailView,
    ListingExportView,
    ListingTemplateListCreateView,
    ListingTranslateView,
    ListingUpdateView,
    MbaColorsView,
    MbaProductCatalogView,
    NicheLifecycleView,
    UploadJobBatchCreateView,
    UploadJobCancelView,
    UploadJobCreateView,
    UploadJobDetailView,
    UploadJobListView,
    UploadJobStatusUpdateView,
    UploadTemplateDefaultView,
    UploadTemplateDetailView,
    UploadTemplateListCreateView,
)

urlpatterns = [
    # Collection endpoints
    path(
        'collections/',
        CollectionListCreateView.as_view(),
        name='collection-list-create',
    ),
    path(
        'collections/tree/',
        CollectionTreeView.as_view(),
        name='collection-tree',
    ),
    path(
        'collections/<uuid:pk>/',
        CollectionDetailView.as_view(),
        name='collection-detail',
    ),

    # Listing endpoints
    path(
        'ideas/<uuid:pk>/listing/',
        ListingDetailView.as_view(),
        name='listing-detail',
    ),
    # Non-UUID listing routes — declare BEFORE `listings/<uuid:pk>/` even
    # though the `uuid:` path converter is strict, so the route order stays
    # explicit for future static segments.
    path(
        'listings/convert/',
        ListingConvertView.as_view(),
        name='listing-convert',
    ),
    # Listing Templates (F5 / AC-47, AC-48). MUST be registered BEFORE
    # `listings/<uuid:pk>/` so the static `/templates/` segment is matched
    # first by Django's URL resolver.
    path(
        'listings/templates/',
        ListingTemplateListCreateView.as_view(),
        name='listing-templates',
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
        'listings/<uuid:pk>/ai-improve/',
        ListingAIImproveView.as_view(),
        name='listing-ai-improve',
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
        'designs/gallery/move/',
        DesignGalleryMoveView.as_view(),
        name='design-gallery-move',
    ),
    path(
        'designs/gallery/<uuid:pk>/',
        DesignGalleryDetailView.as_view(),
        name='design-gallery-detail',
    ),
    path(
        'designs/gallery/<uuid:pk>/duplicate/',
        DesignAssetDuplicateView.as_view(),
        name='design-gallery-duplicate',
    ),

    # Per-Design Product Config endpoints (F4 / AC-38..AC-44)
    path(
        'designs/<uuid:design_id>/product-config/',
        DesignProductConfigView.as_view(),
        name='design-product-config',
    ),
    path(
        'designs/<uuid:design_id>/product-config/copy-from/',
        DesignProductConfigCopyFromView.as_view(),
        name='design-product-config-copy-from',
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
    # AC-56: `/default/` must be registered BEFORE `<uuid:pk>` so the static
    # segment is matched first by Django's URL resolver.
    path(
        'upload-templates/default/',
        UploadTemplateDefaultView.as_view(),
        name='upload-template-default',
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

    # MBA Reference Data endpoints (AC-37)
    path(
        'mba/colors/',
        MbaColorsView.as_view(),
        name='mba-colors',
    ),
    path(
        'mba/product-catalog/',
        MbaProductCatalogView.as_view(),
        name='mba-product-catalog',
    ),
]
