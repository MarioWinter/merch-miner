from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Value
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from user_auth_app.api.authentication import CookieJWTAuthentication
from workspace_app.models import Membership
from niche_app.models import Niche, NicheFilterTemplate
from niche_app.api.filters import NicheFilter
from niche_app.api.permissions import IsWorkspaceMember, IsNicheOwnerOrAdmin
from niche_app.api.serializers import (
    NicheSerializer,
    NicheCreateSerializer,
    NicheBulkSerializer,
    NicheFilterTemplateSerializer,
)

User = get_user_model()

VALID_ORDERING_FIELDS = [
    'name', '-name', 'created_at', '-created_at',
    'updated_at', '-updated_at', 'position', '-position',
]


class NichePagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


def _get_active_membership(user):
    """Return the first active Membership for the user, or None."""
    return (
        Membership.objects
        .filter(user=user, status=Membership.Status.ACTIVE)
        .select_related('workspace')
        .first()
    )


def _get_membership_for_workspace(user, workspace_id):
    """Return Membership if user is active member of workspace_id, else None."""
    try:
        return Membership.objects.select_related('workspace').get(
            user=user,
            workspace_id=workspace_id,
            status=Membership.Status.ACTIVE,
        )
    except Membership.DoesNotExist:
        return None


class NicheViewSet(ModelViewSet):
    """
    CRUD for Niche within a workspace.
    Workspace resolved from X-Workspace-Id header or user's first active membership.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, IsWorkspaceMember, IsNicheOwnerOrAdmin]
    pagination_class = NichePagination
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def _resolve_membership(self):
        """Resolve workspace membership from header or first active membership."""
        workspace_id = self.request.headers.get('X-Workspace-Id')
        if workspace_id:
            return _get_membership_for_workspace(self.request.user, workspace_id)
        return _get_active_membership(self.request.user)

    def initial(self, request, *args, **kwargs):
        """Resolve membership early so permission classes can access it."""
        membership = self._resolve_membership()
        if membership:
            self._membership = membership
        super().initial(request, *args, **kwargs)

    def get_queryset(self):
        membership = getattr(self, '_membership', None)
        if not membership:
            return Niche.objects.none()

        workspace = membership.workspace

        queryset = (
            Niche.objects
            .filter(workspace=workspace)
            .select_related('assigned_to', 'created_by')
        )

        # Annotate idea counts -- relation added by PROJ-8 Idea model
        # Until then, annotate with 0 to keep serializer fields consistent
        related_names = [f.get_accessor_name() for f in Niche._meta.get_fields() if f.one_to_many]
        if 'ideas' in related_names:
            queryset = queryset.annotate(
                idea_count=Count('ideas', distinct=True),
                approved_idea_count=Count(
                    'ideas',
                    filter=Q(ideas__status='approved'),
                    distinct=True,
                ),
            )
        else:
            queryset = queryset.annotate(
                idea_count=Value(0),
                approved_idea_count=Value(0),
            )

        # Exclude archived by default unless explicitly requested
        params = self.request.query_params
        status_param = params.get('status')
        status_group_param = params.get('status_group')
        if status_param != Niche.Status.ARCHIVED and not status_group_param:
            queryset = queryset.exclude(status=Niche.Status.ARCHIVED)

        # Apply filters
        niche_filter = NicheFilter(params)
        queryset = niche_filter.apply(queryset)

        # Apply ordering
        ordering = params.get('ordering', 'position')
        if ordering and ordering not in VALID_ORDERING_FIELDS:
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                {'ordering': f'Invalid ordering. Valid choices: {", ".join(VALID_ORDERING_FIELDS)}'}
            )
        if ordering:
            queryset = queryset.order_by(ordering)

        return queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return NicheCreateSerializer
        return NicheSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        membership = getattr(self, '_membership', None)
        if not membership:
            membership = self._resolve_membership()
            self._membership = membership
        if membership:
            context['workspace'] = membership.workspace
            context['membership'] = membership
        return context

    def update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        # Soft delete: set status=archived instead of deleting
        instance.status = Niche.Status.ARCHIVED
        instance.save(update_fields=['status', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_create(self, serializer):
        serializer.save()


class NicheBulkActionView(APIView):
    """
    POST /api/niches/bulk/
    Admin-only bulk actions: archive, assign.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _resolve_membership(self, request):
        workspace_id = request.headers.get('X-Workspace-Id')
        if workspace_id:
            return _get_membership_for_workspace(request.user, workspace_id)
        return _get_active_membership(request.user)

    def post(self, request):
        membership = self._resolve_membership(request)
        if not membership:
            return Response(
                {'error': 'No active workspace membership.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Admin only
        if membership.role != Membership.Role.ADMIN:
            return Response(
                {'error': 'Only admins can perform bulk actions.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = NicheBulkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action = serializer.validated_data['action']
        ids = serializer.validated_data['ids']
        workspace = membership.workspace

        # Filter IDs by workspace (silently skip cross-workspace IDs)
        niches = Niche.objects.filter(id__in=ids, workspace=workspace)

        if action == 'archive':
            updated = niches.update(status=Niche.Status.ARCHIVED)
            return Response({'updated': updated}, status=status.HTTP_200_OK)

        if action == 'assign':
            assigned_to_id = serializer.validated_data['assigned_to']
            # Validate assignee is workspace member
            is_member = Membership.objects.filter(
                workspace=workspace,
                user_id=assigned_to_id,
                status=Membership.Status.ACTIVE,
            ).exists()
            if not is_member:
                return Response(
                    {'error': 'Assignee is not an active member of this workspace.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            updated = niches.update(assigned_to_id=assigned_to_id)
            return Response({'updated': updated}, status=status.HTTP_200_OK)

        return Response(
            {'error': 'Unknown action.'},
            status=status.HTTP_400_BAD_REQUEST,
        )


class NicheFilterTemplatePagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 100


class NicheFilterTemplateViewSet(ModelViewSet):
    """CRUD for per-user saved filter templates."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = NicheFilterTemplateSerializer
    pagination_class = NicheFilterTemplatePagination
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return NicheFilterTemplate.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
