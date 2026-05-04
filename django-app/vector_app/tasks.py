import logging
from datetime import timedelta

import django_rq
from django.contrib.contenttypes.models import ContentType

from vector_app.services import EmbeddingService

logger = logging.getLogger(__name__)

RETRY_DELAYS = [10, 30, 90]  # seconds


def create_or_update_embedding(content_type_id: int, object_id: str, attempt: int = 0):
    """Create or update an embedding for the given object.

    Idempotent: if embedding exists, overwrites it. Retries up to 3 times
    with exponential backoff (10s, 30s, 90s) on failure.
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
    except Exception:
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
            logger.error(
                "Embedding failed for %s:%s after %d attempts, giving up.",
                ct, object_id, len(RETRY_DELAYS),
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
