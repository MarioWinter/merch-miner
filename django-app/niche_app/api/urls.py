from django.urls import path, include
from rest_framework.routers import DefaultRouter

from niche_app.api.views import (
    NicheViewSet,
    NicheBulkActionView,
    NicheFilterTemplateViewSet,
    CollectedProductViewSet,
)

router = DefaultRouter()
router.register(
    r'niches/filter-templates',
    NicheFilterTemplateViewSet,
    basename='niche-filter-template',
)
router.register(r'niches', NicheViewSet, basename='niche')

collected_router = DefaultRouter()
collected_router.register(
    r'collected-products',
    CollectedProductViewSet,
    basename='collected-product',
)

urlpatterns = [
    path('niches/bulk/', NicheBulkActionView.as_view(), name='niche-bulk'),
    # collected-products must use a MORE SPECIFIC prefix to avoid shadowing niches/<pk>/
    path(
        'niches/<uuid:niche_id>/collected-products/',
        CollectedProductViewSet.as_view({'get': 'list', 'post': 'create'}),
        name='collected-product-list',
    ),
    path(
        'niches/<uuid:niche_id>/collected-products/<uuid:pk>/',
        CollectedProductViewSet.as_view({'delete': 'destroy'}),
        name='collected-product-detail',
    ),
    path(
        'niches/<uuid:niche_id>/collected-products/<uuid:pk>/extract-keywords/',
        CollectedProductViewSet.as_view({'post': 'extract_keywords'}),
        name='collected-product-extract-keywords',
    ),
    path(
        'niches/<uuid:niche_id>/collected-products/<uuid:pk>/save-listing-template/',
        CollectedProductViewSet.as_view({'post': 'save_listing_template'}),
        name='collected-product-save-listing-template',
    ),
    path('', include(router.urls)),
]
