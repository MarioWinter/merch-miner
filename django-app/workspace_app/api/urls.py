from django.urls import path
from workspace_app.api.views import (
    WorkspaceMeView,
    WorkspaceDetailView,
    WorkspaceInviteView,
    WorkspaceInviteAcceptView,
    WorkspaceMemberDetailView,
)

urlpatterns = [
    # List workspaces for authenticated user
    path('workspaces/me/', WorkspaceMeView.as_view(), name='workspace-me'),

    # Accept invite — public, must come before workspaces/<id>/ to avoid slug collision
    path('workspaces/invite/accept/', WorkspaceInviteAcceptView.as_view(), name='workspace-invite-accept'),

    # Rename workspace (admin only)
    path('workspaces/<uuid:workspace_id>/', WorkspaceDetailView.as_view(), name='workspace-detail'),

    # Send invite (admin only)
    path('workspaces/<uuid:workspace_id>/invite/', WorkspaceInviteView.as_view(), name='workspace-invite'),

    # Change role / remove member (admin only)
    path(
        'workspaces/<uuid:workspace_id>/members/<int:user_id>/',
        WorkspaceMemberDetailView.as_view(),
        name='workspace-member-detail',
    ),
]
