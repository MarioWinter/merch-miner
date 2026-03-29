from django.urls import path

from research_app.api.views import (
    BSRHistoryView,
    LiveSearchView,
    PriceHistoryView,
    ProductDetailView,
    ProductExportView,
    ProductListView,
    SameBrandView,
    SearchStatusView,
    SimilarProductsView,
    SuggestionsView,
    UseAsTemplateView,
)

urlpatterns = [
    path('research/suggestions/', SuggestionsView.as_view(), name='research-suggestions'),
    path('research/search/', LiveSearchView.as_view(), name='research-live-search'),
    path('research/search/<uuid:cache_id>/status/', SearchStatusView.as_view(), name='research-search-status'),
    path('research/products/', ProductListView.as_view(), name='research-products'),
    path('research/products/export/', ProductExportView.as_view(), name='research-products-export'),
    # Product detail + sub-resources (order matters: specific paths before <str:asin>/)
    path('research/products/<str:asin>/bsr-history/', BSRHistoryView.as_view(), name='research-bsr-history'),
    path('research/products/<str:asin>/similar/', SimilarProductsView.as_view(), name='research-similar-products'),
    path('research/products/<str:asin>/same-brand/', SameBrandView.as_view(), name='research-same-brand'),
    path('research/products/<str:asin>/price-history/', PriceHistoryView.as_view(), name='research-price-history'),
    path('research/products/<str:asin>/use-as-template/', UseAsTemplateView.as_view(), name='research-use-as-template'),
    path('research/products/<str:asin>/', ProductDetailView.as_view(), name='research-product-detail'),
]
