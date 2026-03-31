from django.contrib import admin

from design_app.models import (
    Design,
    DesignGenerationRun,
    DesignPipeline,
    DesignProcessingJob,
    DesignProject,
    DesignProjectDesign,
    ProcessingSettings,
)


class DesignProjectDesignInline(admin.TabularInline):
    model = DesignProjectDesign
    extra = 0
    raw_id_fields = ('design',)


@admin.register(DesignProject)
class DesignProjectAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'workspace', 'niche', 'created_by', 'created_at', 'updated_at')
    list_filter = ('workspace',)
    search_fields = ('name',)
    readonly_fields = ('id', 'created_at', 'updated_at')
    raw_id_fields = ('workspace', 'niche', 'created_by')
    inlines = [DesignProjectDesignInline]


@admin.register(DesignGenerationRun)
class DesignGenerationRunAdmin(admin.ModelAdmin):
    list_display = ('id', 'idea', 'model_name', 'status', 'triggered_by', 'created_at')
    list_filter = ('status', 'model_name')
    search_fields = ('id', 'prompt_used')
    readonly_fields = ('id', 'created_at', 'completed_at')


@admin.register(Design)
class DesignAdmin(admin.ModelAdmin):
    list_display = ('id', 'workspace', 'idea', 'status', 'is_manual', 'background_color', 'created_at')
    list_filter = ('status', 'is_manual', 'background_color')
    search_fields = ('id',)
    readonly_fields = ('id', 'created_at')


@admin.register(DesignProcessingJob)
class DesignProcessingJobAdmin(admin.ModelAdmin):
    list_display = ('id', 'design', 'type', 'status', 'created_at', 'completed_at')
    list_filter = ('type', 'status')
    readonly_fields = ('id', 'created_at', 'completed_at')


@admin.register(ProcessingSettings)
class ProcessingSettingsAdmin(admin.ModelAdmin):
    list_display = ('workspace', 'bg_removal_provider', 'upscale_provider', 'upscale_auto_threshold')


@admin.register(DesignPipeline)
class DesignPipelineAdmin(admin.ModelAdmin):
    list_display = ('id', 'workspace', 'name', 'is_preset', 'created_by', 'created_at')
    list_filter = ('is_preset',)
    search_fields = ('name',)
    readonly_fields = ('id', 'created_at')
