from django.urls import path

from research_app.api.views import (
    SuggestionsView,
    LiveSearchView,
    SearchStatusView,
    ProductListView,
    ProductExportView,
    BSRHistoryView,
)

urlpatterns = [
    path('research/suggestions/', SuggestionsView.as_view(), name='research-suggestions'),
    path('research/search/', LiveSearchView.as_view(), name='research-live-search'),
    path('research/search/<uuid:cache_id>/status/', SearchStatusView.as_view(), name='research-search-status'),
    path('research/products/', ProductListView.as_view(), name='research-products'),
    path('research/products/export/', ProductExportView.as_view(), name='research-products-export'),
    path('research/products/<str:asin>/bsr-history/', BSRHistoryView.as_view(), name='research-bsr-history'),
]
