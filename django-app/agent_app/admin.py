from django.contrib import admin

from agent_app.models import (
    AgentActionLog,
    AgentConfig,
    AgentMessage,
    AgentSession,
    AutonomyPreset,
    KnowledgeDoc,
    ToolPermission,
    WorkflowTemplate,
)


@admin.register(AgentConfig)
class AgentConfigAdmin(admin.ModelAdmin):
    list_display = ('display_name', 'agent_type', 'workspace', 'model_name', 'temperature')
    list_filter = ('agent_type', 'workspace')
    search_fields = ('display_name',)


@admin.register(AgentSession)
class AgentSessionAdmin(admin.ModelAdmin):
    list_display = ('title', 'status', 'workspace', 'created_by', 'workflow_template', 'created_at')
    list_filter = ('status', 'workspace')
    search_fields = ('title',)
    readonly_fields = ('created_at', 'updated_at', 'completed_at')


@admin.register(AgentMessage)
class AgentMessageAdmin(admin.ModelAdmin):
    list_display = ('session', 'role', 'agent_type', 'created_at')
    list_filter = ('role',)
    readonly_fields = ('created_at',)


@admin.register(AgentActionLog)
class AgentActionLogAdmin(admin.ModelAdmin):
    list_display = ('action', 'agent_type', 'status', 'session', 'cost_estimate', 'created_at')
    list_filter = ('status', 'agent_type')
    readonly_fields = ('created_at', 'completed_at')


@admin.register(ToolPermission)
class ToolPermissionAdmin(admin.ModelAdmin):
    list_display = ('tool_name', 'permission_level', 'user', 'workspace')
    list_filter = ('permission_level', 'workspace')
    search_fields = ('tool_name',)


@admin.register(AutonomyPreset)
class AutonomyPresetAdmin(admin.ModelAdmin):
    list_display = ('name', 'workspace', 'is_system', 'created_at')
    list_filter = ('is_system', 'workspace')


@admin.register(KnowledgeDoc)
class KnowledgeDocAdmin(admin.ModelAdmin):
    list_display = ('title', 'workspace', 'source', 'created_by', 'updated_at')
    list_filter = ('source', 'workspace')
    search_fields = ('title', 'content')


@admin.register(WorkflowTemplate)
class WorkflowTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'key', 'workspace', 'is_system', 'created_at')
    list_filter = ('is_system', 'workspace')
    search_fields = ('name', 'key')
