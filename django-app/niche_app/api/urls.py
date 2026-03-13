from django.urls import path, include
from rest_framework.routers import DefaultRouter

from niche_app.api.views import (
    NicheViewSet,
    NicheBulkActionView,
    NicheFilterTemplateViewSet,
)

router = DefaultRouter()
router.register(
    r'niches/filter-templates',
    NicheFilterTemplateViewSet,
    basename='niche-filter-template',
)
router.register(r'niches', NicheViewSet, basename='niche')

urlpatterns = [
    path('niches/bulk/', NicheBulkActionView.as_view(), name='niche-bulk'),
    path('', include(router.urls)),
]
