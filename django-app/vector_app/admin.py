from django.contrib import admin
from django.db.models import Count

from vector_app.models import Embedding


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
