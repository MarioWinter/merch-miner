from django.contrib import admin

from niche_research_app.models import (
    NicheAnalysis,
    NicheKeywordAnalysis,
    NicheProductEmotionalAnalysis,
    NicheProductVisionAnalysis,
    NicheResearch,
    NicheResearchProduct,
    ResearchNodeConfig,
)


@admin.register(ResearchNodeConfig)
class ResearchNodeConfigAdmin(admin.ModelAdmin):
    list_display = ('node_name', 'model_name', 'temperature', 'updated_at')
    readonly_fields = ('updated_at',)

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        form.base_fields['system_prompt'].widget.attrs.update({
            'rows': 30,
            'cols': 120,
            'style': 'font-family: monospace; width: 100%;',
        })
        return form


@admin.register(NicheResearch)
class NicheResearchAdmin(admin.ModelAdmin):
    list_display = ('niche', 'status', 'triggered_by', 'created_at', 'completed_at')
    list_filter = ('status',)
    search_fields = ('niche__name',)
    readonly_fields = ('id', 'config_snapshot', 'created_at', 'completed_at')


@admin.register(NicheResearchProduct)
class NicheResearchProductAdmin(admin.ModelAdmin):
    list_display = ('research', 'product')
    search_fields = ('product__asin',)


@admin.register(NicheProductVisionAnalysis)
class NicheProductVisionAnalysisAdmin(admin.ModelAdmin):
    list_display = ('product', 'research', 'is_niche_match', 'created_at')
    list_filter = ('is_niche_match',)
    search_fields = ('slogan_text', 'product__asin')


@admin.register(NicheProductEmotionalAnalysis)
class NicheProductEmotionalAnalysisAdmin(admin.ModelAdmin):
    list_display = ('product', 'research', 'emotional_pattern', 'created_at')
    search_fields = ('original_slogan', 'product__asin')


@admin.register(NicheAnalysis)
class NicheAnalysisAdmin(admin.ModelAdmin):
    list_display = ('niche', 'sentiment', 'created_at')
    list_filter = ('sentiment',)
    search_fields = ('niche__name', 'niche_summary')


@admin.register(NicheKeywordAnalysis)
class NicheKeywordAnalysisAdmin(admin.ModelAdmin):
    list_display = ('niche', 'research', 'created_at')
    search_fields = ('niche__name',)
