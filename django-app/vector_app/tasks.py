import logging
from datetime import timedelta

import django_rq
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone

from vector_app.models import IndexingFailure
from vector_app.services import EmbeddingService

logger = logging.getLogger(__name__)

RETRY_DELAYS = [10, 30, 90]  # seconds: attempt 0 fail -> 10s, 1 fail -> 30s, 2 fail -> 90s
MAX_ATTEMPTS = 3


def _record_failure(content_type_id: int, object_id: str, exc: Exception) -> IndexingFailure:
    """Upsert IndexingFailure row, incrementing attempt_count."""
    failure, created = IndexingFailure.objects.get_or_create(
        content_type_id=content_type_id,
        object_id=object_id,
        defaults={
            'attempt_count': 1,
            'last_error': str(exc)[:2000],
        },
    )
    if not created:
        failure.attempt_count = (failure.attempt_count or 0) + 1
        failure.last_error = str(exc)[:2000]
        failure.resolved_at = None
        failure.save(update_fields=['attempt_count', 'last_error', 'resolved_at', 'last_attempt_at'])
    return failure


def _mark_failure_resolved(content_type_id: int, object_id: str) -> None:
    """If a prior IndexingFailure row exists for this (ct, obj), mark resolved."""
    IndexingFailure.objects.filter(
        content_type_id=content_type_id,
        object_id=object_id,
        resolved_at__isnull=True,
    ).update(resolved_at=timezone.now())


def create_or_update_embedding(content_type_id: int, object_id: str, attempt: int = 0):
    """Create or update an embedding for the given object.

    Idempotent: if embedding exists, overwrites it. Retries up to 3 times
    with exponential backoff (10s, 30s, 90s) on failure. After 3 failed
    attempts, IndexingFailure row is left unresolved for the daily retry cron.
    """
    try:
        ct = ContentType.objects.get(pk=content_type_id)
    except ContentType.DoesNotExist:
        logger.error("ContentType %s not found, skipping embedding.", content_type_id)
        return

    model_class = ct.model_class()
    if model_class is None:
        logger.error("Model class for ContentType %s not found.", ct)
        return

    try:
        instance = model_class.objects.get(pk=object_id)
    except model_class.DoesNotExist:
        # Object deleted before job ran (EC-2)
        logger.info(
            "Object %s:%s no longer exists, skipping embedding.",
            ct, object_id,
        )
        return

    service = EmbeddingService()
    try:
        result = service.create_embedding(instance)
        if result:
            logger.info(
                "Embedding created/updated for %s:%s",
                ct, object_id,
            )
        # Success path — resolve any pending IndexingFailure row for this (ct, obj).
        _mark_failure_resolved(content_type_id, object_id)
    except Exception as exc:
        _record_failure(content_type_id, object_id, exc)
        if attempt < len(RETRY_DELAYS):
            delay = RETRY_DELAYS[attempt]
            logger.warning(
                "Embedding failed for %s:%s (attempt %d), retrying in %ds.",
                ct, object_id, attempt + 1, delay,
                exc_info=True,
            )
            queue = django_rq.get_queue('default')
            queue.enqueue_in(
                timedelta(seconds=delay),
                create_or_update_embedding,
                content_type_id,
                object_id,
                attempt + 1,
            )
        else:
            logger.warning(
                "Embedding failed for %s:%s after %d attempts; left for daily retry cron.",
                ct, object_id, MAX_ATTEMPTS,
                exc_info=True,
            )


def delete_embedding(content_type_id: int, object_id: str):
    """Delete the embedding for the given object."""
    service = EmbeddingService()
    deleted = service.delete_embedding_by_ref(content_type_id, object_id)
    if deleted:
        logger.info("Embedding deleted for ct=%s obj=%s", content_type_id, object_id)
    else:
        logger.debug("No embedding found to delete for ct=%s obj=%s", content_type_id, object_id)


def reindex_niche_sources(niche_id: str):
    """Re-enqueue embedding for all niche-scoped Idea + NicheNote rows.

    Fired (debounced 5s) by `Niche.post_save` so that contextual headers are
    refreshed when niche metadata (name, etc.) changes. Capped at 500 rows per
    fan-out to avoid Redis storms — niches with > 500 rows can use the
    `backfill_niche_rag` management command for full re-embedding.
    """
    from idea_app.models import Idea
    from niche_app.models import NicheNote

    queue = django_rq.get_queue('default')
    cap = 500
    enqueued = 0

    idea_ct = ContentType.objects.get_for_model(Idea)
    note_ct = ContentType.objects.get_for_model(NicheNote)

    idea_ids = list(
        Idea.objects.filter(niche_id=niche_id).values_list('pk', flat=True)[:cap]
    )
    for pk in idea_ids:
        queue.enqueue(create_or_update_embedding, idea_ct.id, str(pk))
        enqueued += 1
        if enqueued >= cap:
            break

    if enqueued < cap:
        remaining = cap - enqueued
        note_ids = list(
            NicheNote.objects.filter(niche_id=niche_id).values_list('pk', flat=True)[:remaining]
        )
        for pk in note_ids:
            queue.enqueue(create_or_update_embedding, note_ct.id, str(pk))
            enqueued += 1

    logger.info(
        "reindex_niche_sources(niche=%s) enqueued %d jobs (cap=%d).",
        niche_id, enqueued, cap,
    )
    return enqueued
