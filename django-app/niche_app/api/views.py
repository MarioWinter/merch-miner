from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Q, Value
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from user_auth_app.api.authentication import CookieJWTAuthentication
from workspace_app.models import Membership
from scraper_app.models import AmazonProduct
from niche_app.models import Niche, NicheFilterTemplate, CollectedProduct, NicheNote
from niche_app.api.filters import NicheFilter
from niche_app.api.permissions import IsWorkspaceMember, IsNicheOwnerOrAdmin
from niche_app.api.serializers import (
    NicheSerializer,
    NicheCreateSerializer,
    NicheBulkSerializer,
    NicheFilterTemplateSerializer,
    CollectedProductSerializer,
    CollectedProductCreateSerializer,
    SaveSnippetSerializer,
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
        from idea_app.models import Idea

        instance = self.get_object()
        confirm = request.query_params.get('confirm_archive_ideas') == 'true'

        # Check for linked non-archived ideas
        linked_ideas = Idea.objects.filter(
            niche=instance,
        ).exclude(status=Idea.Status.ARCHIVED)
        idea_count = linked_ideas.count()

        if idea_count > 0 and not confirm:
            return Response(
                {
                    'has_linked_ideas': True,
                    'idea_count': idea_count,
                },
                status=status.HTTP_409_CONFLICT,
            )

        with transaction.atomic():
            # Archive linked ideas if confirmed
            if idea_count > 0 and confirm:
                linked_ideas.update(status=Idea.Status.ARCHIVED)

            # Soft delete: set status=archived
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
            from idea_app.models import Idea

            confirm = request.query_params.get('confirm_archive_ideas') == 'true'

            # Check for linked non-archived ideas across all target niches
            linked_ideas = Idea.objects.filter(
                niche__in=niches,
            ).exclude(status=Idea.Status.ARCHIVED)
            idea_count = linked_ideas.count()

            if idea_count > 0 and not confirm:
                return Response(
                    {
                        'has_linked_ideas': True,
                        'idea_count': idea_count,
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            with transaction.atomic():
                if idea_count > 0 and confirm:
                    linked_ideas.update(status=Idea.Status.ARCHIVED)
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


class CollectedProductPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class CollectedProductViewSet(ModelViewSet):
    """
    CRUD for collected products within a niche.
    Nested under /api/niches/{niche_id}/collected-products/
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]
    pagination_class = CollectedProductPagination
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def _resolve_membership(self):
        workspace_id = self.request.headers.get('X-Workspace-Id')
        if workspace_id:
            return _get_membership_for_workspace(self.request.user, workspace_id)
        return _get_active_membership(self.request.user)

    def _get_niche(self):
        """Return niche scoped to workspace, or 404."""
        membership = self._resolve_membership()
        if not membership:
            return None
        niche_id = self.kwargs['niche_id']
        return get_object_or_404(
            Niche, id=niche_id, workspace=membership.workspace,
        )

    def get_queryset(self):
        niche = self._get_niche()
        if not niche:
            return CollectedProduct.objects.none()
        return (
            CollectedProduct.objects
            .filter(niche=niche)
            .select_related('product')
            .prefetch_related('product__meta_keywords')
        )

    def get_serializer_class(self):
        if self.action == 'create':
            return CollectedProductCreateSerializer
        return CollectedProductSerializer

    def create(self, request, *args, **kwargs):
        niche = self._get_niche()
        if not niche:
            return Response(
                {'error': 'No active workspace membership.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = CollectedProductCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        asin = serializer.validated_data['asin']
        marketplace = serializer.validated_data['marketplace']

        product = AmazonProduct.objects.filter(
            asin=asin, marketplace=marketplace,
        ).first()
        if not product:
            return Response(
                {'error': f'AmazonProduct with asin={asin}, marketplace={marketplace} not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        collected, created = CollectedProduct.objects.get_or_create(
            niche=niche, product=product,
        )
        if not created:
            return Response(
                {'error': 'Product already collected for this niche.'},
                status=status.HTTP_409_CONFLICT,
            )

        out_serializer = CollectedProductSerializer(collected)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        niche = self._get_niche()
        if not niche:
            return Response(
                {'error': 'No active workspace membership.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        collected = get_object_or_404(
            CollectedProduct, id=self.kwargs['pk'], niche=niche,
        )
        collected.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='extract-keywords')
    def extract_keywords(self, request, niche_id=None, pk=None):
        """Extract keywords from product's meta_keywords M2M into JSONField."""
        niche = self._get_niche()
        if not niche:
            return Response(
                {'error': 'No active workspace membership.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        collected = get_object_or_404(
            CollectedProduct, id=pk, niche=niche,
        )
        meta_kws = collected.product.meta_keywords.all()
        collected.extracted_keywords = [
            {
                'keyword': kw.keyword,
                'type': kw.type,
                'frequency': kw.frequency,
            }
            for kw in meta_kws
        ]
        collected.save(update_fields=['extracted_keywords'])
        return Response(
            CollectedProductSerializer(collected).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], url_path='save-listing-template')
    def save_listing_template(self, request, niche_id=None, pk=None):
        """Copy product title, bullets, description to listing_template JSONField."""
        niche = self._get_niche()
        if not niche:
            return Response(
                {'error': 'No active workspace membership.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        collected = get_object_or_404(
            CollectedProduct, id=pk, niche=niche,
        )
        product = collected.product
        collected.listing_template = {
            'title': product.title,
            'bullet_1': product.bullet_1,
            'bullet_2': product.bullet_2,
            'description': product.description,
        }
        collected.save(update_fields=['listing_template'])
        return Response(
            CollectedProductSerializer(collected).data,
            status=status.HTTP_200_OK,
        )


class SaveSnippetView(APIView):
    """
    POST /api/niches/{niche_id}/save-snippet/

    Save a manually selected text snippet to a Niche either as keywords
    (split by newline + comma into NicheKeyword rows) or as a NicheNote.

    Body: {selected_text: str, save_as: 'keywords' | 'notes'}
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _resolve_membership(self, request):
        workspace_id = request.headers.get('X-Workspace-Id')
        if workspace_id:
            return _get_membership_for_workspace(request.user, workspace_id)
        return _get_active_membership(request.user)

    def _get_niche_for_user(self, request, niche_id):
        """Return Niche if user is active member of its workspace, else None."""
        try:
            niche = Niche.objects.select_related('workspace').get(id=niche_id)
        except Niche.DoesNotExist:
            return None
        is_member = Membership.objects.filter(
            user=request.user,
            workspace=niche.workspace,
            status=Membership.Status.ACTIVE,
        ).exists()
        if not is_member:
            return None
        return niche

    def post(self, request, niche_id):
        niche = self._get_niche_for_user(request, niche_id)
        if not niche:
            return Response(
                {'error': 'Niche not found or not accessible.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = SaveSnippetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        selected_text = serializer.validated_data['selected_text']
        save_as = serializer.validated_data['save_as']
        # Normalize empty string -> None; only used for notes
        source_url = serializer.validated_data.get('source_url') or None

        if save_as == 'keywords':
            # source_url is irrelevant for keywords -- not stored on NicheKeyword
            return self._save_as_keywords(niche, selected_text, request.user)
        return self._save_as_note(niche, selected_text, request.user, source_url)

    def _save_as_keywords(self, niche, selected_text, user):
        from keyword_app.models import NicheKeyword

        # Split by newline + comma; strip and dedupe
        raw_tokens = []
        for line in selected_text.split('\n'):
            for token in line.split(','):
                cleaned = token.strip()
                if cleaned:
                    raw_tokens.append(cleaned)

        # Dedupe while preserving order (case-insensitive)
        seen = set()
        ordered_tokens = []
        for token in raw_tokens:
            key = token.lower()
            if key not in seen:
                seen.add(key)
                ordered_tokens.append(token)

        created_count = 0
        skipped_count = 0
        with transaction.atomic():
            # Pre-load existing keywords for this niche (case-insensitive dedupe)
            existing_lower = {
                kw.lower()
                for kw in NicheKeyword.objects
                .filter(niche=niche)
                .values_list('keyword', flat=True)
            }
            for token in ordered_tokens:
                if token.lower() in existing_lower:
                    skipped_count += 1
                    continue
                NicheKeyword.objects.create(
                    niche=niche,
                    keyword=token,
                    source=NicheKeyword.Source.MANUAL_SNIPPET,
                    created_by=user,
                )
                existing_lower.add(token.lower())
                created_count += 1

        return Response(
            {'created': created_count, 'skipped': skipped_count},
            status=status.HTTP_201_CREATED if created_count > 0 else status.HTTP_200_OK,
        )

    def _save_as_note(self, niche, selected_text, user, source_url=None):
        note = NicheNote.objects.create(
            niche=niche,
            text=selected_text,
            source_url=source_url,
            created_by=user,
        )
        return Response(
            {'note_id': str(note.id), 'created': 1},
            status=status.HTTP_201_CREATED,
        )
