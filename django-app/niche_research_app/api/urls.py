"""URL routing for niche research API endpoints."""

from django.urls import path

from niche_research_app.api.views import (
    NicheResearchCancelView,
    NicheResearchLatestView,
    NicheResearchView,
)

urlpatterns = [
    path(
        'niches/<uuid:niche_id>/research/',
        NicheResearchView.as_view(),
        name='niche-research',
    ),
    path(
        'niches/<uuid:niche_id>/research/latest/',
        NicheResearchLatestView.as_view(),
        name='niche-research-latest',
    ),
    path(
        'niches/<uuid:niche_id>/research/cancel/',
        NicheResearchCancelView.as_view(),
        name='niche-research-cancel',
    ),
]
