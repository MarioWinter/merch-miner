from django.urls import path

from vector_app.api.views import (
    IdeaSimilarView,
    NicheRelatedContentView,
    NicheSimilarView,
    SemanticSearchView,
)

urlpatterns = [
    path('search/semantic/', SemanticSearchView.as_view(), name='semantic-search'),
    path('niches/<uuid:niche_id>/similar/', NicheSimilarView.as_view(), name='niche-similar'),
    path('niches/<uuid:niche_id>/related-content/', NicheRelatedContentView.as_view(), name='niche-related-content'),
    path('ideas/<uuid:idea_id>/similar/', IdeaSimilarView.as_view(), name='idea-similar'),
]
