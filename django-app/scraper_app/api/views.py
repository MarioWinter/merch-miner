"""DRF views for scraper_app API."""

import logging
import re

import django_rq
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from scraper_app.api.serializers import RescrapeProductSerializer
from scraper_app.models import AmazonProduct, ScrapeJob
from scraper_app.tasks import scrape_asin_detail_job
from user_auth_app.api.authentication import CookieJWTAuthentication

logger = logging.getLogger(__name__)

ASIN_PATTERN = re.compile(r'^[A-Z0-9]{10}$')


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

        # 3. Product existence — guards against arbitrary ASIN abuse. The
        # rescrape-trigger is intentionally NOT gated by workspace ownership
        # (CollectedProduct) because the research search endpoint exposes
        # AmazonProduct globally to all authenticated users; gating rescrape
        # tighter than search would be UX-broken (user sees the product on the
        # research grid, opens the detail page, hits Reload → 403). Throttle
        # protection (DRF user-throttle) caps abuse at the per-user budget.
        product_exists = AmazonProduct.objects.filter(
            asin=normalised_asin, marketplace=marketplace,
        ).exists()
        if not product_exists:
            return Response(
                {'error': f'Product {normalised_asin} ({marketplace}) not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # 4. Create ScrapeJob + enqueue.
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
