"""PROJ-29 Phase 1B niche-side signal handlers.

Responsibilities on `post_save(Niche)`:

1. Sync `Niche.notes` TextField to a synthetic `NicheNote(source='niche_legacy_notes')`
   so the existing embedding pipeline (registered in `vector_app/signals.py`)
   indexes legacy notes alongside user-created notes — without re-architecting
   the `Niche` model.

2. Enqueue a debounced `reindex_niche_sources(niche_id)` rq job so that all
   niche-scoped Idea + NicheNote embeddings get their contextual headers
   refreshed when niche metadata (e.g. name) changes. Deduplication is enforced
   via `job_id = "niche-rag-reindex-<niche_id>"` — duplicate enqueues within the
   5-second debounce window collapse to a single execution (AC-Ops-RQ-2).

Cache-invalidation responsibilities (Round 1B-2):

* `NicheResearch.post_save` invalidates the cached marketplace key
  ``niche_marketplace:<niche_id>`` so a subsequent ``derive_marketplace`` call
  picks up the freshly-completed research.
* `CollectedProduct.post_save` invalidates the same key so newly-collected
  products feed back into the marketplace heuristic.

Both invalidations run inside ``transaction.on_commit`` to avoid leaving stale
cache entries on rollback.
"""

from __future__ import annotations

import logging
from datetime import timedelta

import django_rq
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from niche_app.models import CollectedProduct, Niche, NicheNote
from vector_app.tasks import reindex_niche_sources

logger = logging.getLogger(__name__)

REINDEX_DEBOUNCE_SECONDS = 5


def _sync_legacy_notes(niche: Niche) -> None:
    """Upsert/delete the synthetic NicheNote mirroring `Niche.notes`.

    Idempotent: re-running on the same Niche produces no diff in DB state when
    `Niche.notes` hasn't changed. Empty `Niche.notes` removes the synthetic row.
    """
    if niche.notes and niche.notes.strip():
        NicheNote.objects.update_or_create(
            niche=niche,
            source=NicheNote.Source.NICHE_LEGACY_NOTES,
            defaults={
                'text': niche.notes,
                'created_by': niche.created_by,
            },
        )
    else:
        NicheNote.objects.filter(
            niche=niche,
            source=NicheNote.Source.NICHE_LEGACY_NOTES,
        ).delete()


def _enqueue_reindex(niche_id) -> None:
    """Enqueue debounced reindex; deduped via job_id within the 5s window."""
    queue = django_rq.get_queue('default')
    # rq.job.validate_job_id only allows letters/numbers/underscores/dashes —
    # colons would raise ValueError. Use dashes as separators.
    job_id = f"niche-rag-reindex-{niche_id}"
    # rq dedups pending jobs with the same job_id — duplicate enqueues become no-ops
    # if a prior job has not yet started.
    queue.enqueue_in(
        timedelta(seconds=REINDEX_DEBOUNCE_SECONDS),
        reindex_niche_sources,
        str(niche_id),
        job_id=job_id,
    )


@receiver(post_save, sender=Niche, dispatch_uid='niche_app_niche_post_save_proj29')
def niche_post_save(sender, instance: Niche, **kwargs):
    """Sync legacy notes + enqueue debounced niche-scope reindex."""

    def _on_commit():
        try:
            _sync_legacy_notes(instance)
        except Exception:
            logger.exception(
                "niche_post_save: legacy-notes sync failed for niche %s", instance.pk,
            )
        try:
            _enqueue_reindex(instance.pk)
        except Exception:
            logger.exception(
                "niche_post_save: reindex enqueue failed for niche %s", instance.pk,
            )

    transaction.on_commit(_on_commit)


def _invalidate_marketplace_for_niche(niche_id) -> None:
    """Drop the cached marketplace inside an on-commit hook."""
    from niche_app.services import invalidate_marketplace_cache

    def _on_commit():
        try:
            invalidate_marketplace_cache(niche_id)
        except Exception:
            logger.exception(
                "marketplace cache invalidation failed for niche %s", niche_id,
            )

    transaction.on_commit(_on_commit)


@receiver(
    post_save,
    sender='niche_research_app.NicheResearch',
    dispatch_uid='niche_app_marketplace_cache_invalidate_research',
)
def niche_research_post_save(sender, instance, **kwargs):
    """Invalidate the marketplace cache when a niche's research changes."""
    _invalidate_marketplace_for_niche(instance.niche_id)


@receiver(
    post_save,
    sender=CollectedProduct,
    dispatch_uid='niche_app_marketplace_cache_invalidate_collected',
)
def collected_product_post_save(sender, instance, **kwargs):
    """Invalidate the marketplace cache when collected-product mix changes."""
    _invalidate_marketplace_for_niche(instance.niche_id)
