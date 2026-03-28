"""Post-save/delete signals for KnowledgeDoc embedding in Vector DB (AC-7)."""

import logging

import django_rq
from django.contrib.contenttypes.models import ContentType
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from agent_app.models import KnowledgeDoc
from vector_app.tasks import create_or_update_embedding, delete_embedding

logger = logging.getLogger(__name__)


@receiver(post_save, sender=KnowledgeDoc, dispatch_uid='knowledge_doc_embed_save')
def enqueue_knowledge_embedding(sender, instance, **kwargs):
    """Embed KnowledgeDoc in Vector DB on create/update."""
    ct = ContentType.objects.get_for_model(sender)
    queue = django_rq.get_queue('default')
    queue.enqueue(
        create_or_update_embedding,
        content_type_id=ct.id,
        object_id=str(instance.pk),
    )
    logger.debug("Enqueued embedding for KnowledgeDoc %s", instance.pk)


@receiver(post_delete, sender=KnowledgeDoc, dispatch_uid='knowledge_doc_embed_delete')
def enqueue_knowledge_embedding_delete(sender, instance, **kwargs):
    """Remove KnowledgeDoc embedding from Vector DB on delete (EC-9)."""
    ct = ContentType.objects.get_for_model(sender)
    queue = django_rq.get_queue('default')
    queue.enqueue(
        delete_embedding,
        content_type_id=ct.id,
        object_id=str(instance.pk),
    )
    logger.debug("Enqueued embedding deletion for KnowledgeDoc %s", instance.pk)
