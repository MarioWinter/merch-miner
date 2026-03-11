from django.contrib.auth import get_user_model
from django.core import signing
from django.utils import timezone
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken

from user_auth_app.api.authentication import CookieJWTAuthentication
from workspace_app.models import Workspace, Membership
from workspace_app.api.serializers import (
    WorkspaceMeSerializer,
    WorkspaceRenameSerializer,
    InviteSerializer,
    MembershipSerializer,
    MemberRoleSerializer,
)

User = get_user_model()

# Invite token max age: 48 hours in seconds
INVITE_TOKEN_MAX_AGE = 172800


def _get_admin_membership(user, workspace_id):
    """Return the Membership if user is an active admin of workspace_id, else None."""
    try:
        return Membership.objects.select_related('workspace').get(
            user=user,
            workspace_id=workspace_id,
            role=Membership.Role.ADMIN,
            status=Membership.Status.ACTIVE,
        )
    except Membership.DoesNotExist:
        return None


def _get_active_membership(user, workspace_id):
    """Return the Membership if user is an active member of workspace_id, else None."""
    try:
        return Membership.objects.select_related('workspace').get(
            user=user,
            workspace_id=workspace_id,
            status=Membership.Status.ACTIVE,
        )
    except Membership.DoesNotExist:
        return None


class WorkspaceMeView(APIView):
    """GET /api/workspaces/me/ — list all active workspaces for the authenticated user."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspace_ids = Membership.objects.filter(
            user=request.user,
            status=Membership.Status.ACTIVE,
        ).values_list('workspace_id', flat=True)

        workspaces = (
            Workspace.objects
            .filter(id__in=workspace_ids)
            .select_related('owner')
            .prefetch_related('memberships__user', 'memberships__invited_by')
        )

        serializer = WorkspaceMeSerializer(workspaces, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class WorkspaceDetailView(APIView):
    """PATCH /api/workspaces/{id}/ — rename workspace (admin only)."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request, workspace_id):
        membership = _get_admin_membership(request.user, workspace_id)
        if not membership:
            # Check if user is even an active member to distinguish 403 vs 404
            active = _get_active_membership(request.user, workspace_id)
            if active:
                return Response(
                    {'error': 'Workspace admin role required.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            return Response({'error': 'Workspace not found or access denied.'}, status=status.HTTP_403_FORBIDDEN)

        workspace = membership.workspace
        serializer = WorkspaceRenameSerializer(workspace, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class WorkspaceInviteView(APIView):
    """POST /api/workspaces/{id}/invite/ — send invite email (admin only)."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, workspace_id):
        membership = _get_admin_membership(request.user, workspace_id)
        if not membership:
            active = _get_active_membership(request.user, workspace_id)
            if active:
                return Response({'error': 'Workspace admin role required.'}, status=status.HTTP_403_FORBIDDEN)
            return Response({'error': 'Workspace not found or access denied.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = InviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        workspace = membership.workspace

        # Resolve or create a user for the invited email
        invited_user, created = User.objects.get_or_create(
            email=email,
            defaults={'username': email, 'is_active': False},
        )
        if created:
            invited_user.set_unusable_password()
            invited_user.save(update_fields=['password'])

        # Check for duplicate active/pending membership
        existing = Membership.objects.filter(workspace=workspace, user=invited_user).first()
        if existing:
            if existing.status == Membership.Status.ACTIVE:
                return Response({'error': 'User is already an active member.'}, status=status.HTTP_409_CONFLICT)
            # Already pending — resend is allowed; fall through to re-enqueue email
            token_payload = {'workspace_id': str(workspace.id), 'user_id': str(invited_user.id)}
            token = signing.dumps(token_payload)
            from workspace_app.tasks import send_invite_email_task
            import django_rq
            django_rq.enqueue(send_invite_email_task, email, workspace.name, token)
            return Response({'detail': 'Invite resent.'}, status=status.HTTP_200_OK)

        Membership.objects.create(
            workspace=workspace,
            user=invited_user,
            role=Membership.Role.MEMBER,
            status=Membership.Status.PENDING,
            invited_by=request.user,
        )

        token_payload = {'workspace_id': str(workspace.id), 'user_id': str(invited_user.id)}
        token = signing.dumps(token_payload)

        from workspace_app.tasks import send_invite_email_task
        import django_rq
        django_rq.enqueue(send_invite_email_task, email, workspace.name, token)

        return Response({'detail': 'Invite sent.'}, status=status.HTTP_201_CREATED)


class WorkspaceInviteAcceptView(APIView):
    """GET /api/workspaces/invite/accept/?token={token} — public; activate membership."""

    permission_classes = [AllowAny]

    def get(self, request):
        token = request.query_params.get('token')
        if not token:
            return Response({'error': 'Token required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payload = signing.loads(token, max_age=INVITE_TOKEN_MAX_AGE)
        except signing.SignatureExpired:
            return Response(
                {'error': 'Invite link expired. Please request a new invite.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except signing.BadSignature:
            return Response({'error': 'Invalid invite token.'}, status=status.HTTP_400_BAD_REQUEST)

        workspace_id = payload.get('workspace_id')
        user_id = payload.get('user_id')

        try:
            membership = Membership.objects.select_related('workspace', 'user').get(
                workspace_id=workspace_id,
                user_id=user_id,
                status=Membership.Status.PENDING,
            )
        except Membership.DoesNotExist:
            # Check if already accepted — return success-like response, not error
            try:
                membership = Membership.objects.select_related('workspace', 'user').get(
                    workspace_id=workspace_id,
                    user_id=user_id,
                    status=Membership.Status.ACTIVE,
                )
                serializer = MembershipSerializer(membership)
                needs_setup = not membership.user.has_usable_password()
                password_setup_data = {}
                if needs_setup:
                    refresh = RefreshToken.for_user(membership.user)
                    password_setup_data = {
                        'password_reset_uid': urlsafe_base64_encode(force_bytes(membership.user.pk)),
                        'password_reset_token': str(refresh.access_token),
                    }
                return Response(
                    {
                        **serializer.data,
                        'already_accepted': True,
                        'needs_password_setup': needs_setup,
                        **password_setup_data,
                    },
                    status=status.HTTP_200_OK,
                )
            except Membership.DoesNotExist:
                return Response(
                    {'error': 'Invite not found or already accepted.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        membership.status = Membership.Status.ACTIVE
        membership.accepted_at = timezone.now()
        membership.save(update_fields=['status', 'accepted_at'])

        # Activate user account if not yet active
        user = membership.user
        if not user.is_active:
            user.is_active = True
            user.save(update_fields=['is_active'])

        serializer = MembershipSerializer(membership)
        needs_setup = not membership.user.has_usable_password()
        password_setup_data = {}
        if needs_setup:
            refresh = RefreshToken.for_user(user)
            password_setup_data = {
                'password_reset_uid': urlsafe_base64_encode(force_bytes(user.pk)),
                'password_reset_token': str(refresh.access_token),
            }
        return Response(
            {
                **serializer.data,
                'needs_password_setup': needs_setup,
                **password_setup_data,
            },
            status=status.HTTP_200_OK,
        )


class WorkspaceMemberDetailView(APIView):
    """
    PATCH  /api/workspaces/{id}/members/{user_id}/ — change member role (admin only)
    DELETE /api/workspaces/{id}/members/{user_id}/ — remove member (admin only, cannot remove owner)
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _get_target_membership(self, workspace_id, user_id):
        try:
            return Membership.objects.select_related('workspace', 'user').get(
                workspace_id=workspace_id,
                user_id=user_id,
            )
        except Membership.DoesNotExist:
            return None

    def patch(self, request, workspace_id, user_id):
        admin_membership = _get_admin_membership(request.user, workspace_id)
        if not admin_membership:
            active = _get_active_membership(request.user, workspace_id)
            if active:
                return Response({'error': 'Workspace admin role required.'}, status=status.HTTP_403_FORBIDDEN)
            return Response({'error': 'Workspace not found or access denied.'}, status=status.HTTP_403_FORBIDDEN)

        target = self._get_target_membership(workspace_id, user_id)
        if not target:
            return Response({'error': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = MemberRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target.role = serializer.validated_data['role']
        target.save(update_fields=['role'])

        return Response(MembershipSerializer(target).data, status=status.HTTP_200_OK)

    def delete(self, request, workspace_id, user_id):
        admin_membership = _get_admin_membership(request.user, workspace_id)
        if not admin_membership:
            active = _get_active_membership(request.user, workspace_id)
            if active:
                return Response({'error': 'Workspace admin role required.'}, status=status.HTTP_403_FORBIDDEN)
            return Response({'error': 'Workspace not found or access denied.'}, status=status.HTTP_403_FORBIDDEN)

        target = self._get_target_membership(workspace_id, user_id)
        if not target:
            return Response({'error': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Block removal of the workspace owner
        workspace = admin_membership.workspace
        if str(target.user_id) == str(workspace.owner_id):
            return Response(
                {'error': 'Cannot remove workspace owner.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        target.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
