"""
PROJ-14 Kanban API views.

Endpoints:
- POST /api/niches/{id}/new-round/          (AC-9)
- GET  /api/niches/{id}/rounds/             (AC-16)
- GET  /api/niches/{id}/designs/            (AC-10)
- POST /api/niches/{id}/designs/upload/     (AC-11)
- PATCH /api/designs/{id}/                  (AC-13)
- DELETE /api/designs/{id}/                 (AC-14)
- POST /api/designs/{id}/restore/           (AC-15)
- GET  /api/designs/trash/                  (AC-28)
- GET/POST /api/niches/{id}/comments/       (AC-17, AC-18)
- DELETE /api/niches/{id}/comments/{id}/    (AC-19)
- GET  /api/notifications/                  (AC-21)
- PATCH /api/notifications/{id}/            (AC-22)
- POST /api/notifications/mark-all-read/    (AC-23)
- GET  /api/notifications/unread-count/     (AC-24)
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from user_auth_app.api.authentication import CookieJWTAuthentication
from workspace_app.models import Membership
from niche_app.models import Niche
from publish_app.models import DesignAsset
from kanban_app.models import NicheComment, Notification, DesignTrash
from kanban_app.services.round_manager import start_new_round
from kanban_app.services.notification_service import (
    notify_design_approval,
    notify_design_rejection,
    notify_mentions,
)
from kanban_app.api.serializers import (
    NicheCommentSerializer,
    NicheCommentCreateSerializer,
    NotificationSerializer,
    NotificationMarkReadSerializer,
    DesignTrashSerializer,
    DesignApproveRejectSerializer,
    RoundSummarySerializer,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_membership(user, workspace_id_header=None):
    """Resolve active membership from header or first active."""
    if workspace_id_header:
        try:
            return Membership.objects.select_related('workspace').get(
                user=user,
                workspace_id=workspace_id_header,
                status=Membership.Status.ACTIVE,
            )
        except Membership.DoesNotExist:
            return None
    return (
        Membership.objects
        .filter(user=user, status=Membership.Status.ACTIVE)
        .select_related('workspace')
        .first()
    )


class KanbanBaseMixin:
    """Shared logic for resolving workspace membership."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _resolve_membership(self, request):
        ws_id = request.headers.get('X-Workspace-Id')
        return _get_membership(request.user, ws_id)

    def _require_membership(self, request):
        membership = self._resolve_membership(request)
        if not membership:
            raise PermissionDenied('No active workspace membership.')
        return membership

    def _get_niche(self, workspace, niche_id):
        try:
            return Niche.objects.get(id=niche_id, workspace=workspace)
        except Niche.DoesNotExist:
            raise NotFound('Niche not found.')


# ---------------------------------------------------------------------------
# Round API (AC-9, AC-16)
# ---------------------------------------------------------------------------

class NewRoundView(KanbanBaseMixin, APIView):
    """POST /api/niches/{niche_id}/new-round/ (AC-9)"""

    def post(self, request, niche_id):
        membership = self._require_membership(request)
        niche = self._get_niche(membership.workspace, niche_id)
        niche = start_new_round(niche)
        return Response({
            'id': str(niche.id),
            'current_round': niche.current_round,
            'status': niche.status,
        })


class RoundSummaryView(KanbanBaseMixin, APIView):
    """GET /api/niches/{niche_id}/rounds/ (AC-16)"""

    def get(self, request, niche_id):
        membership = self._require_membership(request)
        niche = self._get_niche(membership.workspace, niche_id)

        summaries = []
        for r in range(1, niche.current_round + 1):
            idea_count = niche.ideas.filter(round=r).count()

            designs = DesignAsset.objects.filter(
                niche=niche,
                workspace=membership.workspace,
                round=r,
            ).exclude(trash_record__isnull=False)

            design_agg = designs.aggregate(
                total=Count('id'),
                approved=Count('id', filter=Q(
                    listings__status='published',
                )),
            )

            # Count approved/rejected via Design model status (design_app)
            # DesignAsset doesn't have status -- check via linked Design objects
            approved_count = designs.filter(
                idea__designs__status='approved',
            ).distinct().count()
            rejected_count = designs.filter(
                idea__designs__status='rejected',
            ).distinct().count()

            listing_count = niche.ideas.filter(
                round=r,
                listings__isnull=False,
            ).values('listings').distinct().count()

            # Winner thumbnail: first approved design
            winner = designs.first()
            winner_thumb = winner.thumbnail_url if winner else None

            summaries.append({
                'round': r,
                'idea_count': idea_count,
                'design_count': design_agg['total'],
                'approved_design_count': approved_count,
                'rejected_design_count': rejected_count,
                'listing_count': listing_count,
                'winner_design_thumbnail': winner_thumb,
            })

        serializer = RoundSummarySerializer(summaries, many=True)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# Designs API (AC-10, AC-11, AC-13, AC-14, AC-15, AC-28)
# ---------------------------------------------------------------------------

class DesignListPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 100


class NicheDesignListView(KanbanBaseMixin, APIView):
    """GET /api/niches/{niche_id}/designs/?round=X (AC-10)"""

    def get(self, request, niche_id):
        membership = self._require_membership(request)
        niche = self._get_niche(membership.workspace, niche_id)

        designs = DesignAsset.objects.filter(
            niche=niche,
            workspace=membership.workspace,
        ).exclude(
            trash_record__isnull=False,
        ).select_related('created_by')

        round_param = request.query_params.get('round')
        if round_param:
            try:
                designs = designs.filter(round=int(round_param))
            except (ValueError, TypeError):
                pass

        paginator = DesignListPagination()
        page = paginator.paginate_queryset(designs, request)

        data = [
            {
                'id': str(d.id),
                'file_name': d.file_name,
                'file_url': d.file_url or (d.file.url if d.file else ''),
                'thumbnail_url': d.thumbnail_url,
                'source': d.source,
                'round': d.round,
                'dimensions': d.dimensions,
                'file_size': d.file_size,
                'tags': d.tags,
                'created_by': d.created_by.email if d.created_by else None,
                'created_at': d.created_at.isoformat(),
            }
            for d in (page if page is not None else designs)
        ]

        if page is not None:
            return paginator.get_paginated_response(data)
        return Response(data)


class NicheDesignUploadView(KanbanBaseMixin, APIView):
    """POST /api/niches/{niche_id}/designs/upload/ (AC-11)"""

    parser_classes = [MultiPartParser]

    def post(self, request, niche_id):
        membership = self._require_membership(request)
        niche = self._get_niche(membership.workspace, niche_id)

        files = request.FILES.getlist('files')
        if not files:
            return Response(
                {'error': 'No files provided.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_size = getattr(settings, 'MAX_DESIGN_UPLOAD_SIZE', 25 * 1024 * 1024)
        created = []
        for f in files[:20]:  # Cap at 20 files
            if f.size > max_size:
                return Response(
                    {'error': f'File "{f.name}" exceeds max size of {max_size // (1024*1024)}MB.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if f.content_type not in DesignAsset.ALLOWED_TYPES:
                return Response(
                    {'error': f'File "{f.name}" has unsupported type "{f.content_type}".'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            asset = DesignAsset.objects.create(
                workspace=membership.workspace,
                niche=niche,
                file_name=f.name,
                file=f,
                source=DesignAsset.Source.UPLOAD,
                round=niche.current_round,
                file_size=f.size,
                created_by=request.user,
            )
            created.append({
                'id': str(asset.id),
                'file_name': asset.file_name,
                'round': asset.round,
            })

        return Response(
            {'uploaded': len(created), 'designs': created},
            status=status.HTTP_201_CREATED,
        )


class DesignActionView(KanbanBaseMixin, APIView):
    """
    PATCH /api/designs/{design_id}/  (AC-13) — approve/reject
    DELETE /api/designs/{design_id}/ (AC-14) — soft delete
    """

    def _get_design(self, workspace, design_id):
        try:
            return DesignAsset.objects.select_related(
                'workspace', 'niche', 'created_by',
            ).get(id=design_id, workspace=workspace)
        except DesignAsset.DoesNotExist:
            raise NotFound('Design not found.')

    def patch(self, request, design_id):
        membership = self._require_membership(request)
        design = self._get_design(membership.workspace, design_id)

        serializer = DesignApproveRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data['status']
        feedback = serializer.validated_data.get('feedback', '')

        # Update tags to reflect status (DesignAsset doesn't have status field,
        # so we use tags as a lightweight approach)
        tags = design.tags or []
        # Remove old status tags
        tags = [t for t in tags if t not in ('approved', 'rejected', 'pending')]
        tags.append(new_status)
        design.tags = tags
        design.save(update_fields=['tags'])

        workspace = membership.workspace

        if new_status == 'approved':
            notify_design_approval(workspace, design, request.user)
            # Trigger cloud sync as async job
            try:
                import django_rq
                from kanban_app.tasks import cloud_sync_task
                django_rq.enqueue(
                    cloud_sync_task,
                    design_id=str(design.id),
                    workspace_id=str(workspace.id),
                )
            except Exception:
                logger.exception('Failed to enqueue cloud sync for design %s', design.id)

        elif new_status == 'rejected':
            notify_design_rejection(workspace, design, request.user, feedback)
            # Create feedback as design-level comment if provided
            if feedback and design.niche:
                NicheComment.objects.create(
                    niche=design.niche,
                    design=design,
                    author=request.user,
                    content=f'Rejected: {feedback}',
                )

        return Response({
            'id': str(design.id),
            'status': new_status,
        })

    def delete(self, request, design_id):
        membership = self._require_membership(request)
        design = self._get_design(membership.workspace, design_id)

        # Check not already trashed
        if hasattr(design, 'trash_record') and DesignTrash.objects.filter(design=design).exists():
            return Response(
                {'error': 'Design is already in trash.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()
        DesignTrash.objects.create(
            design=design,
            workspace=membership.workspace,
            deleted_by=request.user,
            deleted_at=now,
            expires_at=now + timedelta(days=DesignTrash.TRASH_DAYS),
        )

        return Response(status=status.HTTP_204_NO_CONTENT)


class DesignRestoreView(KanbanBaseMixin, APIView):
    """POST /api/designs/{design_id}/restore/ (AC-15)"""

    def post(self, request, design_id):
        membership = self._require_membership(request)

        try:
            trash = DesignTrash.objects.select_related('design').get(
                design_id=design_id,
                workspace=membership.workspace,
            )
        except DesignTrash.DoesNotExist:
            raise NotFound('Design not found in trash.')

        trash.delete()
        return Response({'id': str(design_id), 'restored': True})


class DesignTrashListView(KanbanBaseMixin, APIView):
    """GET /api/designs/trash/ (AC-28)"""

    def get(self, request):
        membership = self._require_membership(request)

        trash_qs = DesignTrash.objects.filter(
            workspace=membership.workspace,
        ).select_related('design', 'deleted_by')

        paginator = DesignListPagination()
        page = paginator.paginate_queryset(trash_qs, request)
        serializer = DesignTrashSerializer(
            page if page is not None else trash_qs,
            many=True,
        )

        if page is not None:
            return paginator.get_paginated_response(serializer.data)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# Comments API (AC-17, AC-18, AC-19)
# ---------------------------------------------------------------------------

class CommentPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


class NicheCommentListCreateView(KanbanBaseMixin, APIView):
    """
    GET  /api/niches/{niche_id}/comments/  (AC-17)
    POST /api/niches/{niche_id}/comments/  (AC-18)
    """

    def get(self, request, niche_id):
        membership = self._require_membership(request)
        niche = self._get_niche(membership.workspace, niche_id)

        comments = NicheComment.objects.filter(
            niche=niche,
        ).select_related('author')

        design_id = request.query_params.get('design_id')
        if design_id:
            comments = comments.filter(design_id=design_id)
        else:
            # Card-level comments only (no design)
            comments = comments.filter(design__isnull=True)

        paginator = CommentPagination()
        page = paginator.paginate_queryset(comments, request)
        serializer = NicheCommentSerializer(
            page if page is not None else comments,
            many=True,
        )

        if page is not None:
            return paginator.get_paginated_response(serializer.data)
        return Response(serializer.data)

    def post(self, request, niche_id):
        membership = self._require_membership(request)
        niche = self._get_niche(membership.workspace, niche_id)

        serializer = NicheCommentCreateSerializer(
            data=request.data,
            context={
                'niche': niche,
                'workspace': membership.workspace,
            },
        )
        serializer.is_valid(raise_exception=True)

        design_id = serializer.validated_data.get('design_id')
        mentions = serializer.validated_data.get('mentions', [])

        comment = NicheComment.objects.create(
            niche=niche,
            design_id=design_id,
            author=request.user,
            content=serializer.validated_data['content'],
            mentions=mentions,
        )

        if mentions:
            notify_mentions(membership.workspace, comment, mentions)

        return Response(
            NicheCommentSerializer(comment).data,
            status=status.HTTP_201_CREATED,
        )


class NicheCommentDeleteView(KanbanBaseMixin, APIView):
    """DELETE /api/niches/{niche_id}/comments/{comment_id}/ (AC-19)"""

    def delete(self, request, niche_id, comment_id):
        membership = self._require_membership(request)
        niche = self._get_niche(membership.workspace, niche_id)

        try:
            comment = NicheComment.objects.get(id=comment_id, niche=niche)
        except NicheComment.DoesNotExist:
            raise NotFound('Comment not found.')

        # Author or admin can delete
        is_author = comment.author_id == request.user.id
        is_admin = membership.role == Membership.Role.ADMIN
        if not is_author and not is_admin:
            raise PermissionDenied('Only the author or an admin can delete this comment.')

        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Notifications API (AC-21, AC-22, AC-23, AC-24)
# ---------------------------------------------------------------------------

class NotificationPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class NotificationListView(KanbanBaseMixin, APIView):
    """GET /api/notifications/ (AC-21)"""

    def get(self, request):
        membership = self._require_membership(request)

        notifications = Notification.objects.filter(
            workspace=membership.workspace,
            recipient=request.user,
        ).select_related('source_user')

        is_read = request.query_params.get('is_read')
        if is_read == 'false':
            notifications = notifications.filter(is_read=False)
        elif is_read == 'true':
            notifications = notifications.filter(is_read=True)

        paginator = NotificationPagination()
        page = paginator.paginate_queryset(notifications, request)
        serializer = NotificationSerializer(
            page if page is not None else notifications,
            many=True,
        )

        if page is not None:
            return paginator.get_paginated_response(serializer.data)
        return Response(serializer.data)


class NotificationMarkReadView(KanbanBaseMixin, APIView):
    """PATCH /api/notifications/{notification_id}/ (AC-22)"""

    def patch(self, request, notification_id):
        membership = self._require_membership(request)

        try:
            notification = Notification.objects.get(
                id=notification_id,
                workspace=membership.workspace,
                recipient=request.user,
            )
        except Notification.DoesNotExist:
            raise NotFound('Notification not found.')

        serializer = NotificationMarkReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        notification.is_read = serializer.validated_data['is_read']
        notification.save(update_fields=['is_read'])

        return Response(NotificationSerializer(notification).data)


class NotificationMarkAllReadView(KanbanBaseMixin, APIView):
    """POST /api/notifications/mark-all-read/ (AC-23)"""

    def post(self, request):
        membership = self._require_membership(request)

        updated = Notification.objects.filter(
            workspace=membership.workspace,
            recipient=request.user,
            is_read=False,
        ).update(is_read=True)

        return Response({'updated': updated})


class NotificationUnreadCountView(KanbanBaseMixin, APIView):
    """GET /api/notifications/unread-count/ (AC-24)"""

    def get(self, request):
        membership = self._require_membership(request)

        count = Notification.objects.filter(
            workspace=membership.workspace,
            recipient=request.user,
            is_read=False,
        ).count()

        return Response({'count': count})
