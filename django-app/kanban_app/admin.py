from django.contrib import admin

from kanban_app.models import NicheComment, Notification, DesignTrash


@admin.register(NicheComment)
class NicheCommentAdmin(admin.ModelAdmin):
    list_display = ('id', 'niche', 'author', 'agent_type', 'created_at')
    list_filter = ('agent_type', 'created_at')
    search_fields = ('content',)
    raw_id_fields = ('niche', 'design', 'author')
    readonly_fields = ('id', 'created_at')


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('id', 'recipient', 'type', 'title', 'is_read', 'created_at')
    list_filter = ('type', 'is_read', 'created_at')
    search_fields = ('title', 'message')
    raw_id_fields = ('workspace', 'recipient', 'source_user')
    readonly_fields = ('id', 'created_at')


@admin.register(DesignTrash)
class DesignTrashAdmin(admin.ModelAdmin):
    list_display = ('id', 'design', 'deleted_by', 'deleted_at', 'expires_at')
    list_filter = ('deleted_at',)
    raw_id_fields = ('design', 'workspace', 'deleted_by')
    readonly_fields = ('id',)
