from django.contrib import admin

from .constants import VISION_CAPABLE_MODELS
from .models import AppSettings, ChatAttachment


@admin.register(AppSettings)
class AppSettingsAdmin(admin.ModelAdmin):
    """Singleton admin — superuser only. The change form's `vision_model`
    field is rendered as a free-text CharField; admins must enter one of the
    `VISION_CAPABLE_MODELS` ids. We surface the valid set in `help_text`."""

    list_display = ('vision_model', 'updated_at')
    fields = ('vision_model', 'updated_at')
    readonly_fields = ('updated_at',)

    def has_module_permission(self, request) -> bool:
        return bool(request.user and request.user.is_superuser)

    def has_add_permission(self, request) -> bool:
        # Singleton — only allow add if no row exists yet.
        return AppSettings.objects.count() == 0

    def has_delete_permission(self, request, obj=None) -> bool:
        return False

    def has_view_permission(self, request, obj=None) -> bool:
        return bool(request.user and request.user.is_superuser)

    def has_change_permission(self, request, obj=None) -> bool:
        return bool(request.user and request.user.is_superuser)

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        form.base_fields['vision_model'].help_text = (
            'Vision-capable model ids: '
            + ', '.join(sorted(VISION_CAPABLE_MODELS))
        )
        return form


@admin.register(ChatAttachment)
class ChatAttachmentAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'workspace',
        'uploaded_by',
        'original_filename',
        'mime_type',
        'size_bytes',
        'created_at',
        'purged_at',
    )
    list_filter = ('attachment_type', 'mime_type', 'purged_at')
    search_fields = ('original_filename', 'workspace__name')
    readonly_fields = (
        'id',
        'workspace',
        'message',
        'uploaded_by',
        'file',
        'original_filename',
        'mime_type',
        'size_bytes',
        'attachment_type',
        'created_at',
        'purged_at',
    )
