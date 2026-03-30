from django.contrib import admin

from idea_app.models import Idea, IdeaAdaptationRun, IdeaFilterTemplate, SloganNodeConfig


@admin.register(SloganNodeConfig)
class SloganNodeConfigAdmin(admin.ModelAdmin):
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


@admin.register(Idea)
class IdeaAdmin(admin.ModelAdmin):
    list_display = (
        'slogan_text_short', 'niche', 'status', 'signal_type',
        'market_confidence', 'is_manual', 'created_at',
    )
    list_filter = ('status', 'signal_type', 'market_confidence', 'is_manual')
    search_fields = ('slogan_text', 'niche__name')
    readonly_fields = ('created_at',)

    @admin.display(description='Slogan')
    def slogan_text_short(self, obj):
        return obj.slogan_text[:60] + '...' if len(obj.slogan_text) > 60 else obj.slogan_text


@admin.register(IdeaAdaptationRun)
class IdeaAdaptationRunAdmin(admin.ModelAdmin):
    list_display = ('id_short', 'source_idea', 'status', 'created_at', 'completed_at')
    list_filter = ('status',)
    readonly_fields = ('config_snapshot', 'created_at', 'completed_at')

    @admin.display(description='ID')
    def id_short(self, obj):
        return str(obj.id)[:8]


@admin.register(IdeaFilterTemplate)
class IdeaFilterTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'workspace', 'created_by', 'created_at', 'updated_at')
    list_filter = ('workspace',)
    search_fields = ('name',)
    readonly_fields = ('created_at', 'updated_at')
