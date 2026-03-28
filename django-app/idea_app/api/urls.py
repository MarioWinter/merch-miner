"""URL routing for idea_app API."""

from django.urls import path

from idea_app.api.views import (
    AdaptationRunDetailView,
    ExtractSloganView,
    IdeaAdaptView,
    IdeaBulkStatusView,
    IdeaDetailView,
    IdeaImproveView,
    IdeaListCreateView,
    IdeaRegenerateView,
    IdeaSuggestNichesView,
)

urlpatterns = [
    # Niche-scoped
    path(
        'niches/<uuid:niche_id>/ideas/',
        IdeaListCreateView.as_view(),
        name='idea-list-create',
    ),
    # Idea-scoped
    path(
        'ideas/<uuid:pk>/',
        IdeaDetailView.as_view(),
        name='idea-detail',
    ),
    path(
        'ideas/<uuid:pk>/adapt/',
        IdeaAdaptView.as_view(),
        name='idea-adapt',
    ),
    path(
        'ideas/<uuid:pk>/improve/',
        IdeaImproveView.as_view(),
        name='idea-improve',
    ),
    path(
        'ideas/<uuid:pk>/regenerate/',
        IdeaRegenerateView.as_view(),
        name='idea-regenerate',
    ),
    path(
        'ideas/<uuid:pk>/suggest-niches/',
        IdeaSuggestNichesView.as_view(),
        name='idea-suggest-niches',
    ),
    # Run-scoped
    path(
        'ideas/adaptation-runs/<uuid:run_id>/',
        AdaptationRunDetailView.as_view(),
        name='adaptation-run-detail',
    ),
    # Global
    path(
        'ideas/extract-slogan/',
        ExtractSloganView.as_view(),
        name='idea-extract-slogan',
    ),
    path(
        'ideas/bulk-status/',
        IdeaBulkStatusView.as_view(),
        name='idea-bulk-status',
    ),
]
