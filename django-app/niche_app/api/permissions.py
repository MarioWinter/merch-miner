from rest_framework.permissions import BasePermission

from workspace_app.models import Membership


class IsWorkspaceMember(BasePermission):
    """
    Allows access only to users with an active membership in the resolved workspace.
    Expects view to have a `_resolve_membership()` method or `_membership` attribute.
    """

    message = 'No active workspace membership.'

    def has_permission(self, request, view):
        membership = getattr(view, '_membership', None)
        if not membership:
            membership = view._resolve_membership()
            if membership:
                view._membership = membership
        return membership is not None


class IsNicheOwnerOrAdmin(BasePermission):
    """
    Admin can PATCH/DELETE any niche in the workspace.
    Member can only PATCH/DELETE niches where assigned_to == request.user
    OR created_by == request.user. Otherwise 403.

    Safe methods (GET, HEAD, OPTIONS) are allowed for any workspace member.
    """

    message = 'You can only modify niches assigned to or created by you.'

    def has_object_permission(self, request, view, obj):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True

        membership = getattr(view, '_membership', None)
        if not membership:
            membership = view._resolve_membership()
            if membership:
                view._membership = membership

        if not membership:
            return False

        # Admin can do anything
        if membership.role == Membership.Role.ADMIN:
            return True

        # Member: only own or assigned niches
        return (
            obj.assigned_to_id == request.user.id
            or obj.created_by_id == request.user.id
        )
