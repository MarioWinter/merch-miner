import logging

import django_rq
from django.contrib.contenttypes.models import ContentType
from django.db.models.signals import post_save
from django.dispatch import receiver

from search_app.models import WebSearchResult

logger = logging.getLogger(__name__)


@receiver(
    post_save,
    sender=WebSearchResult,
    dispatch_uid='search_app_websearchresult_embedding',
)
def enqueue_embedding_on_crawl_complete(sender, instance, **kwargs):
    """Enqueue Vector DB embedding when a WebSearchResult crawl completes.

    Only triggers when content_type is full_crawl and status is completed,
    or for snippets that have content. Delegates to vector_app task.
    """
    if instance.crawl_status == WebSearchResult.CrawlStatus.COMPLETED and instance.content:
        try:
            from vector_app.tasks import create_or_update_embedding
            ct = ContentType.objects.get_for_model(WebSearchResult)
            queue = django_rq.get_queue('default')
            queue.enqueue(
                create_or_update_embedding,
                content_type_id=ct.id,
                object_id=str(instance.pk),
            )
            logger.info(
                "Enqueued embedding for WebSearchResult %s (%s)",
                instance.pk, instance.content_type,
            )
        except Exception:
            logger.warning(
                "Failed to enqueue embedding for WebSearchResult %s",
                instance.pk,
                exc_info=True,
            )
