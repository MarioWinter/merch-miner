from django.contrib import admin

from dashboard_app.models import ActivityEvent


@admin.register(ActivityEvent)
class ActivityEventAdmin(admin.ModelAdmin):
    list_display = ('event_type', 'target_name', 'user', 'agent_type', 'workspace', 'created_at')
    list_filter = ('event_type', 'workspace', 'agent_type')
    search_fields = ('target_name',)
    readonly_fields = ('id', 'created_at')
    ordering = ('-created_at',)
