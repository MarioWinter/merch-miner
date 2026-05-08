"""API views for niche research endpoints."""

import logging

import django_rq
from django.utils import timezone
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from user_auth_app.api.authentication import CookieJWTAuthentication
from workspace_app.models import Membership
from niche_app.models import Niche
from niche_research_app.models import (
    NicheAnalysis,
    NicheKeywordAnalysis,
    NicheProductEmotionalAnalysis,
    NicheProductVisionAnalysis,
    NicheResearch,
    ResearchNodeConfig,
)
from niche_research_app.api.serializers import (
    NicheResearchDetailSerializer,
    NicheResearchSerializer,
    ResearchTriggerSerializer,
)

logger = logging.getLogger(__name__)


def _get_membership_for_niche(user, niche_id):
    """Return (niche, membership) if user is active member, else (None, None)."""
    try:
        niche = Niche.objects.select_related('workspace').get(id=niche_id)
    except (Niche.DoesNotExist, ValueError):
        return None, None

    try:
        membership = Membership.objects.get(
            user=user,
            workspace=niche.workspace,
            status=Membership.Status.ACTIVE,
        )
    except Membership.DoesNotExist:
        return niche, None

    return niche, membership


def _check_niche_access(request, niche_id):
    """Validate niche exists and user has access. Returns (niche, error_response)."""
    niche, membership = _get_membership_for_niche(request.user, niche_id)
    if niche is None:
        return None, Response(
            {'error': 'Niche not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )
    if membership is None:
        return None, Response(
            {'error': 'You are not a member of this workspace.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    return niche, None


class ResearchPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 50


class NicheResearchView(APIView):
    """
    POST /api/niches/{id}/research/ - trigger a new research run.
    GET  /api/niches/{id}/research/ - paginated list of research runs.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, niche_id):
        niche, error = _check_niche_access(request, niche_id)
        if error:
            return error

        # Validate trigger params
        trigger = ResearchTriggerSerializer(data=request.data)
        trigger.is_valid(raise_exception=True)
        marketplace = trigger.validated_data['marketplace']
        product_type = trigger.validated_data['product_type']
        force_refresh = trigger.validated_data['force_refresh']
        product_limit = trigger.validated_data['product_limit']

        # Check for existing pending/running research
        existing_active = NicheResearch.objects.filter(
            niche=niche,
            status__in=[NicheResearch.Status.PENDING, NicheResearch.Status.RUNNING],
        ).exists()
        if existing_active:
            return Response(
                {'error': 'Research already in progress.'},
                status=status.HTTP_409_CONFLICT,
            )

        # Check for existing completed/failed research
        latest = NicheResearch.objects.filter(niche=niche).first()

        if latest and latest.status == NicheResearch.Status.COMPLETED:
            if not force_refresh:
                # Return existing result
                serializer = NicheResearchSerializer(latest)
                return Response(serializer.data, status=status.HTTP_200_OK)

            # Force refresh: reuse record, delete LLM results, keep scrape products
            NicheProductVisionAnalysis.objects.filter(research=latest).delete()
            NicheProductEmotionalAnalysis.objects.filter(research=latest).delete()
            NicheAnalysis.objects.filter(research=latest).delete()
            NicheKeywordAnalysis.objects.filter(research=latest).delete()

            latest.completed_nodes = ['scrape']
            latest.current_node = ''
            latest.status = NicheResearch.Status.PENDING
            latest.error_message = ''
            latest.completed_at = None
            latest.marketplace = marketplace
            latest.product_type = product_type
            latest.product_limit = product_limit
            latest.save(update_fields=[
                'completed_nodes', 'current_node', 'status',
                'error_message', 'completed_at', 'marketplace', 'product_type',
                'product_limit',
            ])

            self._enqueue_research(latest)
            serializer = NicheResearchSerializer(latest)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        if latest and latest.status == NicheResearch.Status.FAILED:
            if niche.research_retry_count >= 3:
                return Response(
                    {'error': 'Max retries exceeded (3). Create a new niche or contact support.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Retry: reuse record, keep completed_nodes, increment retries
            latest.retry_count += 1
            latest.status = NicheResearch.Status.PENDING
            latest.error_message = ''
            latest.completed_at = None
            latest.current_node = ''
            latest.save(update_fields=[
                'retry_count', 'status', 'error_message',
                'completed_at', 'current_node',
            ])

            niche.research_retry_count += 1
            niche.save(update_fields=['research_retry_count'])

            self._enqueue_research(latest)
            serializer = NicheResearchSerializer(latest)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        # No existing run: create new record
        config_snapshot = self._snapshot_config()
        research = NicheResearch.objects.create(
            niche=niche,
            triggered_by=request.user,
            status=NicheResearch.Status.PENDING,
            config_snapshot=config_snapshot,
            marketplace=marketplace,
            product_type=product_type,
            product_limit=product_limit,
        )

        self._enqueue_research(research)
        serializer = NicheResearchSerializer(research)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @staticmethod
    def _snapshot_config():
        configs = ResearchNodeConfig.objects.all()
        return {
            c.node_name: {
                'model_name': c.model_name,
                'temperature': c.temperature,
                'max_tokens': c.max_tokens,
                'system_prompt': (
                    c.system_prompt[:200] + '...'
                    if len(c.system_prompt) > 200
                    else c.system_prompt
                ),
            }
            for c in configs
        }

    @staticmethod
    def _enqueue_research(research):
        from niche_research_app.tasks import run_niche_research

        queue = django_rq.get_queue('research')
        job = queue.enqueue(run_niche_research, str(research.id))
        research.rq_job_id = job.id
        research.save(update_fields=['rq_job_id'])

    def get(self, request, niche_id):
        niche, error = _check_niche_access(request, niche_id)
        if error:
            return error

        queryset = NicheResearch.objects.filter(niche=niche).order_by('-created_at')
        paginator = ResearchPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = NicheResearchSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class NicheResearchLatestView(APIView):
    """GET /api/niches/{id}/research/latest/ - latest research with full results."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, niche_id):
        niche, error = _check_niche_access(request, niche_id)
        if error:
            return error

        research = NicheResearch.objects.filter(
            niche=niche,
        ).prefetch_related(
            'niche_analyses',
            'keyword_analyses',
            'research_products__product',
        ).first()

        if research is None:
            return Response(
                {'error': 'No research found for this niche.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = NicheResearchDetailSerializer(research)
        return Response(serializer.data)


class NicheResearchCancelView(APIView):
    """POST /api/niches/{id}/research/cancel/ - cancel running research."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, niche_id):
        niche, error = _check_niche_access(request, niche_id)
        if error:
            return error

        research = NicheResearch.objects.filter(
            niche=niche,
            status__in=[NicheResearch.Status.PENDING, NicheResearch.Status.RUNNING],
        ).first()

        if research is None:
            return Response(
                {'error': 'No pending or running research to cancel.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Mark as cancelled
        research.cancelled = True
        research.status = NicheResearch.Status.FAILED
        research.error_message = 'Cancelled by user'
        research.completed_at = timezone.now()
        research.save(update_fields=[
            'cancelled', 'status', 'error_message', 'completed_at',
        ])

        # Reset niche research_status
        niche.research_status = None
        niche.save(update_fields=['research_status'])

        # Cancel the RQ job
        if research.rq_job_id:
            try:
                from rq import cancel_job
                from rq.command import send_stop_job_command

                connection = django_rq.get_connection('research')
                cancel_job(research.rq_job_id, connection=connection)
                try:
                    send_stop_job_command(connection, research.rq_job_id)
                except Exception:
                    logger.debug(
                        "Could not send stop command for job %s (may have already finished)",
                        research.rq_job_id,
                    )
            except Exception:
                logger.warning(
                    "Failed to cancel RQ job %s", research.rq_job_id,
                    exc_info=True,
                )

        serializer = NicheResearchSerializer(research)
        return Response(serializer.data, status=status.HTTP_200_OK)
