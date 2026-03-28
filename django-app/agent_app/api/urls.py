from django.urls import path

from agent_app.api.views import (
    AgentConfigListView,
    AgentConfigUpdateView,
    AgentSessionApproveRejectView,
    AgentSessionControlView,
    AgentSessionDetailView,
    AgentSessionListCreateView,
    AgentSessionMessageView,
    AgentSessionShareView,
    AutonomyPresetActivateView,
    AutonomyPresetDeleteView,
    AutonomyPresetListCreateView,
    BatchSessionCreateView,
    KnowledgeDocDetailView,
    KnowledgeDocListCreateView,
    ToolPermissionListView,
    WorkflowTemplateDeleteView,
    WorkflowTemplateListCreateView,
)

urlpatterns = [
    # Session CRUD + Controls
    path('agent/sessions/', AgentSessionListCreateView.as_view(), name='agent-session-list-create'),
    path('agent/sessions/batch/', BatchSessionCreateView.as_view(), name='agent-session-batch'),
    path('agent/sessions/<uuid:session_id>/', AgentSessionDetailView.as_view(), name='agent-session-detail'),
    path('agent/sessions/<uuid:session_id>/messages/', AgentSessionMessageView.as_view(), name='agent-session-messages'),
    path('agent/sessions/<uuid:session_id>/<str:action>/', AgentSessionControlView.as_view(), name='agent-session-control'),
    path('agent/sessions/<uuid:session_id>/share/<str:action>/', AgentSessionShareView.as_view(), name='agent-session-share'),  # noqa: E501
    path(
        'agent/sessions/<uuid:session_id>/<str:decision>/<uuid:action_log_id>/',
        AgentSessionApproveRejectView.as_view(),
        name='agent-session-approve-reject',
    ),

    # Config
    path('agent/config/', AgentConfigListView.as_view(), name='agent-config-list'),
    path('agent/config/<str:agent_type>/', AgentConfigUpdateView.as_view(), name='agent-config-update'),

    # Permissions
    path('agent/permissions/', ToolPermissionListView.as_view(), name='agent-permissions'),

    # Presets
    path('agent/presets/', AutonomyPresetListCreateView.as_view(), name='agent-preset-list-create'),
    path('agent/presets/<uuid:preset_id>/activate/', AutonomyPresetActivateView.as_view(), name='agent-preset-activate'),
    path('agent/presets/<uuid:preset_id>/', AutonomyPresetDeleteView.as_view(), name='agent-preset-delete'),

    # Templates
    path('agent/templates/', WorkflowTemplateListCreateView.as_view(), name='agent-template-list-create'),
    path('agent/templates/<uuid:template_id>/', WorkflowTemplateDeleteView.as_view(), name='agent-template-delete'),

    # Knowledge Docs
    path('agent/knowledge/', KnowledgeDocListCreateView.as_view(), name='agent-knowledge-list-create'),
    path('agent/knowledge/<uuid:doc_id>/', KnowledgeDocDetailView.as_view(), name='agent-knowledge-detail'),
]
