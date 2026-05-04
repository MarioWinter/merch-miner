"""DRF views for scraper_app API."""

import logging
import re

import django_rq
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from niche_app.models import CollectedProduct
from scraper_app.api.serializers import RescrapeProductSerializer
from scraper_app.models import AmazonProduct, ScrapeJob
from scraper_app.tasks import scrape_asin_detail_job
from user_auth_app.api.authentication import CookieJWTAuthentication
from workspace_app.models import Membership

logger = logging.getLogger(__name__)

ASIN_PATTERN = re.compile(r'^[A-Z0-9]{10}$')


def _get_workspace_id(request):
    """Resolve workspace from `X-Workspace-Id` header or first active membership.

    Mirrors the helper in `publish_app.api.views` (PROJ-11). Centralised here
    only because scraper_app doesn't import from publish_app.
    """
    header_ws = request.headers.get('X-Workspace-Id')
    if header_ws:
        return header_ws
    user = getattr(request, 'user', None)
    if user is None or not user.is_authenticated:
        return None
    membership = (
        Membership.objects
        .filter(user=user, status=Membership.Status.ACTIVE)
        .values_list('workspace_id', flat=True)
        .first()
    )
    return str(membership) if membership else None


class RescrapeProductView(APIView):
    """POST /api/scraper/products/{asin}/rescrape/

    Trigger a fresh ASIN detail scrape for a product the workspace owns
    (i.e. the product is collected on at least one niche in the workspace).
    Returns 202 Accepted with the new ScrapeJob id + RQ job id.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, asin):
        # 1. ASIN format validation (before serializer to short-circuit cheaply).
        normalised_asin = (asin or '').strip().upper()
        if not ASIN_PATTERN.match(normalised_asin):
            return Response(
                {'error': 'Invalid ASIN. Must be exactly 10 uppercase alphanumeric characters.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 2. Body validation (marketplace).
        serializer = RescrapeProductSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        marketplace = serializer.validated_data['marketplace']

        # 3. Workspace resolution.
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return Response(
                {'error': 'No active workspace.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 4. Workspace ownership check — product must be collected on a niche
        #    in this workspace. Prevents drive-by scraping of arbitrary ASINs.
        product_exists = AmazonProduct.objects.filter(
            asin=normalised_asin, marketplace=marketplace,
        ).exists()
        if not product_exists:
            return Response(
                {'error': f'Product {normalised_asin} ({marketplace}) not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        owns_product = CollectedProduct.objects.filter(
            product__asin=normalised_asin,
            product__marketplace=marketplace,
            niche__workspace_id=ws_id,
        ).exists()
        if not owns_product:
            return Response(
                {'error': 'Product not reachable from this workspace.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # 5. Create ScrapeJob + enqueue.
        scrape_job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            asin=normalised_asin,
            marketplace=marketplace,
            status=ScrapeJob.Status.PENDING,
        )
        try:
            queue = django_rq.get_queue('scraper')
            rq_job = queue.enqueue(
                scrape_asin_detail_job,
                asin=normalised_asin,
                marketplace=marketplace,
                scrape_job_id=str(scrape_job.id),
            )
        except Exception:
            logger.exception(
                "Failed to enqueue rescrape for ASIN %s (job=%s)",
                normalised_asin, scrape_job.id,
            )
            scrape_job.status = ScrapeJob.Status.FAILED
            scrape_job.error_log = 'Failed to enqueue RQ job.'
            scrape_job.save(update_fields=['status', 'error_log'])
            return Response(
                {'error': 'Failed to enqueue scrape job.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        scrape_job.rq_job_id = rq_job.id
        scrape_job.save(update_fields=['rq_job_id'])

        return Response(
            {'job_id': str(scrape_job.id), 'rq_job_id': rq_job.id},
            status=status.HTTP_202_ACCEPTED,
        )
