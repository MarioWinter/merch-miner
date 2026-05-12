import logging
from datetime import timedelta

import django_rq
from django.contrib.contenttypes.models import ContentType
from django.db import connection
from django.utils import timezone

from vector_app.models import Embedding, IndexingFailure
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


def create_or_update_embedding(
    content_type_id: int,
    object_id: str,
    attempt: int = 0,
    force_reembed: bool = False,
):
    """Create or update an embedding for the given object.

    Idempotent: if embedding exists, overwrites it. Retries up to 3 times
    with exponential backoff (10s, 30s, 90s) on failure. After 3 failed
    attempts, IndexingFailure row is left unresolved for the daily retry cron.

    Args:
        content_type_id: ContentType pk.
        object_id: Source row pk.
        attempt: Internal retry counter (0..MAX_ATTEMPTS).
        force_reembed: PROJ-29 Phase 1B Round 3 — when True, delete any
            pre-existing Embedding row before re-creating. Used by the
            backfill command's ``--reembed-existing`` flag to refresh
            contextual headers.
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
    if force_reembed:
        service.delete_embedding_by_ref(content_type_id, str(object_id))
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


# ---------- PROJ-29 Phase 1B Round 3: maintenance + retry jobs ----------


def _discover_embedding_indexes() -> list[str]:
    """Return pgvector + GIN index names for vector_app_embedding."""
    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT indexname FROM pg_indexes
            WHERE tablename = 'vector_app_embedding'
              AND (
                indexdef ILIKE '%hnsw%'
                OR indexdef ILIKE '%ivfflat%'
                OR indexdef ILIKE '%gin%'
              )
            """
        )
        return [row[0] for row in cur.fetchall()]


def maintain_indexes():
    """Daily REINDEX CONCURRENTLY on pgvector + GIN indexes (AC-Ops-DB-5).

    Idempotent: discovers index names dynamically; safe to re-run.
    """
    started = timezone.now()
    indexes = _discover_embedding_indexes()
    if not indexes:
        logger.warning("maintain_indexes: no pgvector/GIN indexes found.")
        return 0

    reindexed = 0
    with connection.cursor() as cur:
        for idx_name in indexes:
            try:
                cur.execute(f'REINDEX INDEX CONCURRENTLY "{idx_name}"')
                reindexed += 1
                logger.info("maintain_indexes: reindexed %s", idx_name)
            except Exception:
                logger.warning(
                    "maintain_indexes: REINDEX failed for %s", idx_name,
                    exc_info=True,
                )

    # Bloat check: log warning if hit-ratio < 95%.
    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT indexrelname, idx_blks_hit, idx_blks_read
            FROM pg_statio_user_indexes
            WHERE indexrelname = ANY(%s)
            """,
            [indexes],
        )
        for idx_name, hits, reads in cur.fetchall():
            total = (hits or 0) + (reads or 0)
            if total > 0:
                ratio = (hits or 0) / total
                if ratio < 0.95:
                    logger.warning(
                        "maintain_indexes: %s low hit-ratio %.2f%% (hits=%d reads=%d)",
                        idx_name, ratio * 100, hits, reads,
                    )

    duration = (timezone.now() - started).total_seconds()
    logger.info(
        "maintain_indexes: %d indexes reindexed in %.1fs", reindexed, duration,
    )
    return reindexed


def retry_failed_indexings():
    """Daily retry of unresolved IndexingFailure rows (caps 100 per fire).

    Picks the oldest unresolved failures and re-enqueues `create_or_update_embedding`
    with `attempt=0` (reset retry counter). Prevents storms after long outages.
    """
    failures = (
        IndexingFailure.objects
        .filter(resolved_at__isnull=True)
        .order_by('last_attempt_at')[:100]
    )
    queue = django_rq.get_queue('default')
    enqueued = 0
    for failure in failures:
        queue.enqueue(
            create_or_update_embedding,
            failure.content_type_id,
            str(failure.object_id),
            0,  # reset attempt
        )
        enqueued += 1

    logger.info("retry_failed_indexings: re-enqueued %d failures.", enqueued)
    return enqueued
