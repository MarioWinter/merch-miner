from django.contrib import admin

from agent_app.models import (
    AgentActionLog,
    AgentConfig,
    AgentMessage,
    AgentSession,
    AgentWorkspaceConfig,
    AutonomyPreset,
    KnowledgeDoc,
    Skill,
    SkillVersion,
    ToolPermission,
    UserProfile,
    WorkflowTemplate,
    WorkspaceMemory,
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


# ── Phase 14 — Self-Improvement Layer ────────────────────────────────────────


@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'workspace', 'version', 'trigger_type',
        'success_count', 'error_count', 'deleted_at', 'updated_at',
    )
    list_filter = ('trigger_type', 'workspace', 'deleted_at')
    search_fields = ('name', 'description')
    readonly_fields = ('created_at', 'updated_at', 'last_used_at')


@admin.register(SkillVersion)
class SkillVersionAdmin(admin.ModelAdmin):
    list_display = ('skill', 'version', 'created_at')
    list_filter = ('skill__workspace',)
    readonly_fields = ('created_at',)


@admin.register(WorkspaceMemory)
class WorkspaceMemoryAdmin(admin.ModelAdmin):
    list_display = ('workspace', 'last_consolidated_at', 'updated_at')
    readonly_fields = ('created_at', 'updated_at', 'last_consolidated_at')


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'workspace', 'last_dialectic_at', 'dialect_cadence_sessions')
    list_filter = ('workspace',)
    readonly_fields = ('created_at', 'updated_at', 'last_dialectic_at')


@admin.register(AgentWorkspaceConfig)
class AgentWorkspaceConfigAdmin(admin.ModelAdmin):
    list_display = (
        'workspace', 'reflection_cadence_sessions',
        'skill_creation_min_tool_calls', 'memory_char_limit',
        'profile_char_limit',
    )
    readonly_fields = ('created_at', 'updated_at')
