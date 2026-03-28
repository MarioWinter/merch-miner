"""Product lifecycle chain builder.

Builds and maintains lifecycle records: Niche -> Idea -> Design -> Listing -> Upload -> ASIN.
"""

import logging

from publish_app.models import (
    ProductLifecycle,
    UploadJob,
)

logger = logging.getLogger(__name__)


def get_niche_lifecycle(niche_id, workspace_id) -> list[dict]:
    """Build full lifecycle chains for a niche, grouped by round.

    Returns list of dicts, each representing a lifecycle chain.
    """
    lifecycles = (
        ProductLifecycle.objects
        .filter(niche_id=niche_id, workspace_id=workspace_id)
        .select_related('idea', 'design', 'listing', 'upload_job')
        .order_by('round', '-updated_at')
    )

    result = {}
    for lc in lifecycles:
        round_num = lc.round
        if round_num not in result:
            result[round_num] = []
        result[round_num].append({
            'id': str(lc.id),
            'niche_id': str(lc.niche_id),
            'idea_id': str(lc.idea_id) if lc.idea_id else None,
            'idea_slogan': lc.idea.slogan_text[:100] if lc.idea else None,
            'design_id': str(lc.design_id) if lc.design_id else None,
            'design_file_name': lc.design.file_name if lc.design else None,
            'listing_id': str(lc.listing_id) if lc.listing_id else None,
            'listing_title': lc.listing.title[:80] if lc.listing else None,
            'upload_job_id': str(lc.upload_job_id) if lc.upload_job_id else None,
            'asin': lc.asin,
            'marketplace': lc.marketplace,
            'upload_date': lc.upload_date.isoformat() if lc.upload_date else None,
            'sales_units': lc.sales_units,
            'sales_revenue': str(lc.sales_revenue) if lc.sales_revenue else None,
            'current_bsr': lc.current_bsr,
            'reviews_count': lc.reviews_count,
            'reviews_rating': str(lc.reviews_rating) if lc.reviews_rating else None,
            'round': lc.round,
        })

    return [
        {'round': r, 'chains': chains}
        for r, chains in sorted(result.items())
    ]


def create_or_update_lifecycle(upload_job: UploadJob):
    """Create/update lifecycle record when upload completes with ASIN.

    Called after Desktop App reports successful upload.
    """
    if not upload_job.asin or upload_job.status != UploadJob.Status.COMPLETED:
        return None

    listing = upload_job.listing
    design = upload_job.design

    # Find or create lifecycle
    lc, created = ProductLifecycle.objects.get_or_create(
        workspace=upload_job.workspace,
        upload_job=upload_job,
        defaults={
            'niche': listing.idea.niche if listing and listing.idea else None,
            'idea': listing.idea if listing else None,
            'design': design,
            'listing': listing,
            'asin': upload_job.asin,
            'marketplace': upload_job.marketplace,
            'upload_date': upload_job.completed_at or upload_job.upload_date,
            'round': listing.round if listing else 1,
        },
    )

    if not created:
        lc.asin = upload_job.asin
        lc.marketplace = upload_job.marketplace
        lc.upload_date = upload_job.completed_at or upload_job.upload_date
        lc.save(update_fields=['asin', 'marketplace', 'upload_date', 'updated_at'])

    return lc
