"""PROJ-29 Phase 1B niche-side signal handlers.

Two responsibilities on `post_save(Niche)`:

1. Sync `Niche.notes` TextField to a synthetic `NicheNote(source='niche_legacy_notes')`
   so the existing embedding pipeline (registered in `vector_app/signals.py`)
   indexes legacy notes alongside user-created notes — without re-architecting
   the `Niche` model.

2. Enqueue a debounced `reindex_niche_sources(niche_id)` rq job so that all
   niche-scoped Idea + NicheNote embeddings get their contextual headers
   refreshed when niche metadata (e.g. name) changes. Deduplication is enforced
   via `job_id = "niche_rag:reindex:<niche_id>"` — duplicate enqueues within the
   5-second debounce window collapse to a single execution (AC-Ops-RQ-2).
"""

from __future__ import annotations

import logging
from datetime import timedelta

import django_rq
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from niche_app.models import Niche, NicheNote
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
    job_id = f"niche_rag:reindex:{niche_id}"
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
