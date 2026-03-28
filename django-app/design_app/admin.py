from django.contrib import admin

from design_app.models import (
    Design,
    DesignGenerationRun,
    DesignPipeline,
    DesignProcessingJob,
    ProcessingSettings,
)


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
