from django.urls import path

from keyword_app.api.views import (
    KeywordEnrichView,
    KeywordExportView,
    KeywordHistoryView,
    KeywordProductCountView,
    KeywordSearchView,
    KeywordSynonymsView,
    NicheKeywordBulkAddView,
    NicheKeywordBulkDeleteView,
    NicheKeywordDetailView,
    NicheKeywordGroupDetailView,
    NicheKeywordGroupListCreateView,
    NicheKeywordListCreateView,
)

urlpatterns = [
    # Keyword Research (global)
    path(
        'keywords/search/',
        KeywordSearchView.as_view(),
        name='keyword-search',
    ),
    path(
        'keywords/enrich/',
        KeywordEnrichView.as_view(),
        name='keyword-enrich',
    ),
    path(
        'keywords/<str:keyword>/history/',
        KeywordHistoryView.as_view(),
        name='keyword-history',
    ),
    path(
        'keywords/export/',
        KeywordExportView.as_view(),
        name='keyword-export',
    ),
    path(
        'keywords/product-count/',
        KeywordProductCountView.as_view(),
        name='keyword-product-count',
    ),
    path(
        'keywords/synonyms/',
        KeywordSynonymsView.as_view(),
        name='keyword-synonyms',
    ),

    # Niche Keywords CRUD
    path(
        'niches/<uuid:niche_id>/keywords/',
        NicheKeywordListCreateView.as_view(),
        name='niche-keyword-list-create',
    ),
    path(
        'niches/<uuid:niche_id>/keywords/bulk-add/',
        NicheKeywordBulkAddView.as_view(),
        name='niche-keyword-bulk-add',
    ),
    path(
        'niches/<uuid:niche_id>/keywords/bulk-delete/',
        NicheKeywordBulkDeleteView.as_view(),
        name='niche-keyword-bulk-delete',
    ),
    path(
        'niches/<uuid:niche_id>/keywords/<uuid:keyword_id>/',
        NicheKeywordDetailView.as_view(),
        name='niche-keyword-detail',
    ),

    # Keyword Groups CRUD
    path(
        'niches/<uuid:niche_id>/keyword-groups/',
        NicheKeywordGroupListCreateView.as_view(),
        name='niche-keyword-group-list-create',
    ),
    path(
        'niches/<uuid:niche_id>/keyword-groups/<uuid:group_id>/',
        NicheKeywordGroupDetailView.as_view(),
        name='niche-keyword-group-detail',
    ),
]
