from django.urls import path

from agent_app.api.views import (
    AgentConfigListView,
    AgentConfigUpdateView,
    AgentDashboardSummaryView,
    AgentSessionApproveView,
    AgentSessionDetailView,
    AgentSessionListCreateView,
    AgentSessionMessageView,
    AgentSessionPauseView,
    AgentSessionRejectView,
    AgentSessionResumeView,
    AgentSessionShareView,
    AgentSessionStopView,
    AgentSessionUnshareView,
    AgentWorkspaceConfigView,
    AutonomyPresetActivateView,
    AutonomyPresetDeleteView,
    AutonomyPresetListCreateView,
    BatchSessionCreateView,
    KnowledgeDocDetailView,
    KnowledgeDocListCreateView,
    ReflectionTriggerView,
    SkillDetailView,
    SkillVersionsListView,
    SkillsListCreateView,
    ToolPermissionListView,
    UserProfileView,
    WorkflowTemplateDeleteView,
    WorkflowTemplateListCreateView,
    WorkspaceMemoryView,
)

urlpatterns = [
    # Session CRUD
    path(
        'agent/sessions/',
        AgentSessionListCreateView.as_view(),
        name='agent-session-list-create',
    ),
    path(
        'agent/sessions/batch/',
        BatchSessionCreateView.as_view(),
        name='agent-session-batch',
    ),
    path(
        'agent/sessions/<uuid:session_id>/',
        AgentSessionDetailView.as_view(),
        name='agent-session-detail',
    ),
    path(
        'agent/sessions/<uuid:session_id>/messages/',
        AgentSessionMessageView.as_view(),
        name='agent-session-messages',
    ),

    # Session controls (explicit per-action endpoints)
    path(
        'agent/sessions/<uuid:session_id>/pause/',
        AgentSessionPauseView.as_view(),
        name='agent-session-pause',
    ),
    path(
        'agent/sessions/<uuid:session_id>/resume/',
        AgentSessionResumeView.as_view(),
        name='agent-session-resume',
    ),
    path(
        'agent/sessions/<uuid:session_id>/stop/',
        AgentSessionStopView.as_view(),
        name='agent-session-stop',
    ),
    path(
        'agent/sessions/<uuid:session_id>/share/',
        AgentSessionShareView.as_view(),
        name='agent-session-share',
    ),
    path(
        'agent/sessions/<uuid:session_id>/unshare/',
        AgentSessionUnshareView.as_view(),
        name='agent-session-unshare',
    ),
    path(
        'agent/sessions/<uuid:session_id>/approve/<uuid:action_log_id>/',
        AgentSessionApproveView.as_view(),
        name='agent-session-approve',
    ),
    path(
        'agent/sessions/<uuid:session_id>/reject/<uuid:action_log_id>/',
        AgentSessionRejectView.as_view(),
        name='agent-session-reject',
    ),

    # Config
    path(
        'agent/config/',
        AgentConfigListView.as_view(),
        name='agent-config-list',
    ),
    path(
        'agent/config/<str:agent_type>/',
        AgentConfigUpdateView.as_view(),
        name='agent-config-update',
    ),

    # Permissions
    path(
        'agent/permissions/',
        ToolPermissionListView.as_view(),
        name='agent-permissions',
    ),

    # Presets
    path(
        'agent/presets/',
        AutonomyPresetListCreateView.as_view(),
        name='agent-preset-list-create',
    ),
    path(
        'agent/presets/<uuid:preset_id>/activate/',
        AutonomyPresetActivateView.as_view(),
        name='agent-preset-activate',
    ),
    path(
        'agent/presets/<uuid:preset_id>/',
        AutonomyPresetDeleteView.as_view(),
        name='agent-preset-delete',
    ),

    # Templates
    path(
        'agent/templates/',
        WorkflowTemplateListCreateView.as_view(),
        name='agent-template-list-create',
    ),
    path(
        'agent/templates/<uuid:template_id>/',
        WorkflowTemplateDeleteView.as_view(),
        name='agent-template-delete',
    ),

    # Knowledge Docs
    path(
        'agent/knowledge/',
        KnowledgeDocListCreateView.as_view(),
        name='agent-knowledge-list-create',
    ),
    path(
        'agent/knowledge/<uuid:doc_id>/',
        KnowledgeDocDetailView.as_view(),
        name='agent-knowledge-detail',
    ),

    # Dashboard summary widget (AC-63)
    path(
        'agent/dashboard/summary/',
        AgentDashboardSummaryView.as_view(),
        name='agent-dashboard-summary',
    ),

    # ── Phase 14 — Self-Improvement Layer ──

    # Skills
    path(
        'agent/skills/',
        SkillsListCreateView.as_view(),
        name='agent-skill-list-create',
    ),
    path(
        'agent/skills/<uuid:skill_id>/',
        SkillDetailView.as_view(),
        name='agent-skill-detail',
    ),
    path(
        'agent/skills/<uuid:skill_id>/versions/',
        SkillVersionsListView.as_view(),
        name='agent-skill-versions',
    ),

    # Workspace memory
    path(
        'agent/memory/',
        WorkspaceMemoryView.as_view(),
        name='agent-memory',
    ),

    # User profile
    path(
        'agent/profile/',
        UserProfileView.as_view(),
        name='agent-profile',
    ),

    # Workspace tuning knobs (admin only)
    path(
        'agent/workspace-config/',
        AgentWorkspaceConfigView.as_view(),
        name='agent-workspace-config',
    ),

    # Manual reflection trigger
    path(
        'agent/sessions/<uuid:session_id>/reflect/',
        ReflectionTriggerView.as_view(),
        name='agent-session-reflect',
    ),
]
