from django.contrib import admin

from keyword_app.models import (
    KeywordHistoryCache,
    KeywordJSCache,
    NicheJSCallTracker,
    NicheKeyword,
    NicheKeywordGroup,
    JSUsageLog,
)


@admin.register(NicheKeyword)
class NicheKeywordAdmin(admin.ModelAdmin):
    list_display = ('keyword', 'niche', 'source', 'group', 'position', 'created_at')
    list_filter = ('source',)
    search_fields = ('keyword',)
    raw_id_fields = ('niche', 'group', 'design_template', 'created_by')


@admin.register(NicheKeywordGroup)
class NicheKeywordGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'niche', 'position', 'created_at')
    search_fields = ('name',)
    raw_id_fields = ('niche', 'created_by')


@admin.register(KeywordJSCache)
class KeywordJSCacheAdmin(admin.ModelAdmin):
    list_display = (
        'keyword', 'marketplace', 'monthly_search_volume_exact',
        'ease_of_ranking_score', 'fetched_at',
    )
    list_filter = ('marketplace',)
    search_fields = ('keyword',)


@admin.register(KeywordHistoryCache)
class KeywordHistoryCacheAdmin(admin.ModelAdmin):
    list_display = ('keyword', 'marketplace', 'fetched_at')
    list_filter = ('marketplace',)
    search_fields = ('keyword',)


@admin.register(NicheJSCallTracker)
class NicheJSCallTrackerAdmin(admin.ModelAdmin):
    list_display = ('niche', 'keyword_used', 'called_at')
    raw_id_fields = ('niche',)


@admin.register(JSUsageLog)
class JSUsageLogAdmin(admin.ModelAdmin):
    list_display = ('provider', 'endpoint', 'keywords_count', 'user', 'created_at')
    list_filter = ('provider',)
    readonly_fields = ('id',)
