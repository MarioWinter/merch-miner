from django.contrib import admin
from django.db.models import Count

from vector_app.models import Embedding, IndexingFailure


@admin.register(Embedding)
class EmbeddingAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'content_type', 'object_id', 'workspace',
        'text_preview', 'created_at', 'updated_at',
    ]
    list_filter = ['content_type', 'workspace']
    search_fields = ['text_input', 'object_id']
    readonly_fields = [
        'id', 'content_type', 'object_id', 'workspace',
        'text_input', 'search_text', 'metadata',
        'created_at', 'updated_at',
    ]
    ordering = ['-updated_at']

    def text_preview(self, obj):
        return obj.text_input[:100] if obj.text_input else ''
    text_preview.short_description = 'Text Preview'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        """Add embedding stats to the changelist page."""
        stats = (
            Embedding.objects
            .values('content_type__app_label', 'content_type__model')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        extra_context = extra_context or {}
        extra_context['embedding_stats'] = list(stats)
        return super().changelist_view(request, extra_context=extra_context)


@admin.register(IndexingFailure)
class IndexingFailureAdmin(admin.ModelAdmin):
    """PROJ-29 AC-Ops-RQ + EC-2: surface unresolved embedding-failures for daily retry triage."""

    list_display = (
        'content_type', 'object_id', 'attempt_count', 'last_attempt_at',
        'resolved_at', 'error_preview',
    )
    list_filter = ('content_type', 'resolved_at')
    search_fields = ('object_id', 'last_error')
    readonly_fields = (
        'content_type', 'object_id', 'attempt_count', 'last_error',
        'last_attempt_at', 'resolved_at',
    )
    ordering = ['resolved_at', '-last_attempt_at']

    def get_queryset(self, request):
        # Default view = unresolved (resolved_at IS NULL) for fast triage.
        qs = super().get_queryset(request)
        if not request.GET:
            return qs.filter(resolved_at__isnull=True)
        return qs

    @admin.display(description='Error (preview)')
    def error_preview(self, obj):
        if not obj.last_error:
            return ''
        return obj.last_error[:120] + ('…' if len(obj.last_error) > 120 else '')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
