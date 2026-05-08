from django.contrib import admin

from design_app.models import (
    Design,
    DesignGenerationRun,
    DesignPipeline,
    DesignProcessingJob,
    DesignProject,
    DesignProjectDesign,
    DesignProjectIdea,
    ProcessingSettings,
    ProjectPrompt,
    ProjectReference,
    PromptPreset,
    UpscalerSettings,
    UpscaleQuotaUsage,
)


class DesignProjectDesignInline(admin.TabularInline):
    model = DesignProjectDesign
    extra = 0
    raw_id_fields = ('design',)


class DesignProjectIdeaInline(admin.TabularInline):
    model = DesignProjectIdea
    extra = 0
    raw_id_fields = ('idea',)


@admin.register(DesignProject)
class DesignProjectAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'workspace', 'niche', 'created_by', 'created_at', 'updated_at')
    list_filter = ('workspace',)
    search_fields = ('name',)
    readonly_fields = ('id', 'created_at', 'updated_at')
    raw_id_fields = ('workspace', 'niche', 'created_by')
    inlines = [DesignProjectDesignInline, DesignProjectIdeaInline]


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
    list_display = (
        'id', 'design', 'type', 'status',
        'replicate_prediction_id', 'batch_id',
        'created_at', 'completed_at',
    )
    list_filter = ('type', 'status')
    search_fields = ('replicate_prediction_id', 'batch_id')
    readonly_fields = ('id', 'created_at', 'completed_at')


@admin.register(UpscalerSettings)
class UpscalerSettingsAdmin(admin.ModelAdmin):
    """Singleton admin: one row only, never deleted, never re-added."""

    list_display = (
        'replicate_model_slug', 'replicate_model_version',
        'default_scale', 'target_width', 'target_height',
        'monthly_quota_per_user', 'bulk_concurrency', 'staff_unlimited',
        'updated_at',
    )
    readonly_fields = ('updated_at',)

    def has_add_permission(self, request):
        # Only one row allowed.
        return not UpscalerSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(UpscaleQuotaUsage)
class UpscaleQuotaUsageAdmin(admin.ModelAdmin):
    list_display = ('user', 'month', 'count', 'updated_at')
    list_filter = ('month',)
    search_fields = ('user__email',)
    readonly_fields = ('user', 'month', 'count', 'updated_at')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        # Read-only — managed by code, not admins.
        return False


@admin.register(ProcessingSettings)
class ProcessingSettingsAdmin(admin.ModelAdmin):
    list_display = ('workspace', 'bg_removal_provider', 'upscale_provider', 'upscale_auto_threshold')


@admin.register(DesignPipeline)
class DesignPipelineAdmin(admin.ModelAdmin):
    list_display = ('id', 'workspace', 'name', 'is_preset', 'created_by', 'created_at')
    list_filter = ('is_preset',)
    search_fields = ('name',)
    readonly_fields = ('id', 'created_at')


@admin.register(DesignProjectIdea)
class DesignProjectIdeaAdmin(admin.ModelAdmin):
    list_display = ('id', 'project', 'idea', 'position', 'added_at')
    raw_id_fields = ('project', 'idea')
    readonly_fields = ('added_at',)


@admin.register(ProjectPrompt)
class ProjectPromptAdmin(admin.ModelAdmin):
    list_display = ('id', 'project', 'source_idea', 'variant_index', 'created_at', 'updated_at')
    list_filter = ('variant_index',)
    search_fields = ('prompt_text',)
    readonly_fields = ('id', 'created_at', 'updated_at')
    raw_id_fields = ('project', 'source_idea')


@admin.register(PromptPreset)
class PromptPresetAdmin(admin.ModelAdmin):
    list_display = ('id', 'workspace', 'name', 'created_by', 'created_at')
    search_fields = ('name',)
    readonly_fields = ('id', 'created_at')
    raw_id_fields = ('workspace', 'created_by')


@admin.register(ProjectReference)
class ProjectReferenceAdmin(admin.ModelAdmin):
    list_display = ('id', 'project', 'title', 'asin', 'position', 'added_at')
    list_filter = ('project',)
    search_fields = ('title', 'asin', 'image_url')
    readonly_fields = ('id', 'added_at')
    raw_id_fields = ('project', 'source_product')
