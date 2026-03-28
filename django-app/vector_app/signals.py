import logging

import django_rq
from django.contrib.contenttypes.models import ContentType
from django.db.models.signals import post_delete, post_save

from vector_app.tasks import create_or_update_embedding, delete_embedding

logger = logging.getLogger(__name__)

# Models that should trigger embedding creation/update on save.
# Import lazily to avoid circular imports and handle missing models gracefully.
_EMBEDDABLE_MODELS = None


def _get_embeddable_models():
    """Lazily load all embeddable model classes."""
    global _EMBEDDABLE_MODELS
    if _EMBEDDABLE_MODELS is not None:
        return _EMBEDDABLE_MODELS

    models = []

    try:
        from niche_app.models import Niche
        models.append(Niche)
    except ImportError:
        pass

    try:
        from niche_research_app.models import (
            NicheAnalysis,
            NicheKeywordAnalysis,
            NicheProductEmotionalAnalysis,
            NicheProductVisionAnalysis,
        )
        models.extend([
            NicheAnalysis,
            NicheKeywordAnalysis,
            NicheProductEmotionalAnalysis,
            NicheProductVisionAnalysis,
        ])
    except ImportError:
        pass

    try:
        from scraper_app.models import AmazonProduct
        models.append(AmazonProduct)
    except ImportError:
        pass

    try:
        from search_app.models import WebSearchResult
        models.append(WebSearchResult)
    except ImportError:
        pass

    try:
        from agent_app.models import KnowledgeDoc
        models.append(KnowledgeDoc)
    except ImportError:
        pass

    # Future models (PROJ-8, PROJ-11) will be added here
    # when they are created.

    _EMBEDDABLE_MODELS = models
    return models


def _enqueue_create(sender, instance, **kwargs):
    """Enqueue embedding creation/update job on post_save."""
    ct = ContentType.objects.get_for_model(sender)
    queue = django_rq.get_queue('default')
    queue.enqueue(
        create_or_update_embedding,
        content_type_id=ct.id,
        object_id=str(instance.pk),
    )


def _enqueue_delete(sender, instance, **kwargs):
    """Enqueue embedding deletion job on post_delete."""
    ct = ContentType.objects.get_for_model(sender)
    queue = django_rq.get_queue('default')
    queue.enqueue(
        delete_embedding,
        content_type_id=ct.id,
        object_id=str(instance.pk),
    )


def connect_signals():
    """Connect post_save and post_delete signals for all embeddable models."""
    for model in _get_embeddable_models():
        post_save.connect(
            _enqueue_create,
            sender=model,
            dispatch_uid=f'embedding_create_{model.__name__}',
        )
        post_delete.connect(
            _enqueue_delete,
            sender=model,
            dispatch_uid=f'embedding_delete_{model.__name__}',
        )
        logger.debug("Embedding signals connected for %s", model.__name__)
