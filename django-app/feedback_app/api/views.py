"""FIX-dashboard-bug-report-and-polish Item 1 — feedback API.

Endpoints (all under ``/api/feedback/``):
  * POST   /screenshots/        — upload an image, returns id (throttle scope ``feedback_create``)
  * POST   /reports/            — create a report row, enqueues email job
  * GET    /reports/            — paginated list (workspace-scoped for non-superusers)
  * GET    /reports/<id>/       — retrieve single report
  * PATCH  /reports/<id>/       — superuser-only: update status + admin_notes
"""

import logging

from rest_framework import mixins, status, viewsets
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from feedback_app.models import BugFeatureReport, FeedbackScreenshot
from feedback_app.api.serializers import (
    BugFeatureReportAdminUpdateSerializer,
    BugFeatureReportSerializer,
    FeedbackScreenshotSerializer,
    FeedbackScreenshotUploadSerializer,
)
from feedback_app.tasks import send_feedback_email
from user_auth_app.api.authentication import CookieJWTAuthentication
from workspace_app.models import Membership

logger = logging.getLogger(__name__)


def _resolve_workspace(request):
    """Return ``(workspace, error_response)``.

    Mirrors the pattern used in chat_attachments_app / niche_app:
      * Read ``X-Workspace-Id`` header.
      * Require an ACTIVE membership for the requesting user.
      * On failure return a DRF ``Response`` (the caller bails early).
    """
    workspace_id = request.headers.get('X-Workspace-Id')
    if not workspace_id:
        return None, Response(
            {'error': 'X-Workspace-Id header is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    membership = (
        Membership.objects.filter(
            user=request.user,
            status=Membership.Status.ACTIVE,
            workspace_id=workspace_id,
        )
        .select_related('workspace')
        .first()
    )
    if not membership:
        return None, Response(
            {'error': 'No active workspace membership.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    return membership.workspace, None


class FeedbackPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class FeedbackScreenshotUploadView(APIView):
    """POST /api/feedback/screenshots/ — multipart upload, returns id.

    Throttled at ``feedback_create=10/min`` (EC-1-5) — pairs with the
    report-create endpoint so a spammer can't pre-warm the cache with 100
    screenshots, then submit 100 reports just under the cap.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'feedback_create'

    def post(self, request):
        # Workspace membership not strictly required for the screenshot
        # upload itself, but we still enforce it so dangling uploads can't
        # be created by users with no active workspace at all.
        workspace, err = _resolve_workspace(request)
        if err:
            return err

        serializer = FeedbackScreenshotUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        screenshot = FeedbackScreenshot.objects.create(
            image=serializer.validated_data['image'],
            uploaded_by=request.user,
        )
        # Touch workspace so static analyzers see it as used (no FK on the
        # screenshot — workspace scoping is enforced via the linked report).
        del workspace
        return Response(
            FeedbackScreenshotSerializer(screenshot).data,
            status=status.HTTP_201_CREATED,
        )


class BugFeatureReportViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """ViewSet for ``/api/feedback/reports/``.

    Auth: ``IsAuthenticated`` always. PATCH additionally checked inline so
    we can return 403 with a clear message rather than letting DRF mask the
    intent behind a generic permission error.

    Workspace isolation per AC-1-10:
      * Non-superusers can only see reports in workspaces they are an
        ACTIVE member of (effectively the X-Workspace-Id workspace).
      * Superusers see EVERY workspace's reports.

    Throttling:
      * POST gets ``feedback_create=10/min`` (EC-1-5).
      * Read endpoints use DRF's default user/anon rates.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]
    pagination_class = FeedbackPagination
    lookup_field = 'id'
    queryset = BugFeatureReport.objects.select_related(
        'workspace', 'user', 'screenshot',
    )

    def get_throttles(self):
        if self.action == 'create':
            self.throttle_scope = 'feedback_create'
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_serializer_class(self):
        if self.action == 'partial_update' or self.action == 'update':
            return BugFeatureReportAdminUpdateSerializer
        return BugFeatureReportSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            return qs.order_by('-created_at')
        # Non-superusers — workspace-scoped read. We require the header on
        # read endpoints too so the response is deterministic regardless of
        # how many workspaces the user belongs to.
        workspace_id = self.request.headers.get('X-Workspace-Id')
        if not workspace_id:
            return qs.none()
        member_workspace_ids = Membership.objects.filter(
            user=user,
            status=Membership.Status.ACTIVE,
            workspace_id=workspace_id,
        ).values_list('workspace_id', flat=True)
        return qs.filter(workspace_id__in=member_workspace_ids).order_by(
            '-created_at',
        )

    # ------------------------------------------------------------------
    # create
    # ------------------------------------------------------------------
    def create(self, request, *args, **kwargs):
        workspace, err = _resolve_workspace(request)
        if err:
            return err

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # AC-1-5: workspace + user are NEVER trusted from request data.
        report = serializer.save(workspace=workspace, user=request.user)

        # AC-1-7: enqueue, don't block. Failure here is intentionally swallowed
        # so the API can still return 201 — the row is saved, the email is best-effort.
        try:
            send_feedback_email.delay(str(report.id))
        except Exception:
            logger.warning(
                'send_feedback_email enqueue failed for report %s',
                report.id,
                exc_info=True,
            )

        # Re-serialize through the read serializer so the response carries
        # the nested ``screenshot`` payload + read-only fields.
        out = BugFeatureReportSerializer(report)
        return Response(out.data, status=status.HTTP_201_CREATED)

    # ------------------------------------------------------------------
    # partial_update — superuser only
    # ------------------------------------------------------------------
    def update(self, request, *args, **kwargs):
        return Response(
            {'error': 'Use PATCH for triage updates.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def partial_update(self, request, *args, **kwargs):
        if not request.user.is_superuser:
            return Response(
                {'error': 'Superuser permission required.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        # Superuser must still pass through queryset lookup — but their
        # queryset is unrestricted, so this just fetches by id.
        instance = self.get_object()
        serializer = self.get_serializer(
            instance, data=request.data, partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        out = BugFeatureReportSerializer(instance)
        return Response(out.data)
