import uuid

from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.contrib.postgres.search import SearchVectorField
from django.db import models
from pgvector.django import VectorField


class Embedding(models.Model):
    """Central embedding store for all AI-generated and user-created data.

    Uses GenericForeignKey to link to any source model. One embedding
    per source object (unique on content_type + object_id). Supports
    hybrid search: pgvector cosine similarity + PostgreSQL full-text search.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        related_name='embeddings',
        db_index=True,
    )
    object_id = models.UUIDField(db_index=True)
    content_object = GenericForeignKey('content_type', 'object_id')

    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='embeddings',
        db_index=True,
    )

    embedding = VectorField(dimensions=1536)
    text_input = models.TextField(
        help_text='Original text that was embedded',
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text='Flexible: source, niche_id, content_subtype, chunk_index, etc.',
    )

    search_text = models.TextField(
        blank=True,
        default='',
        help_text='Optimized text for tsvector full-text search',
    )
    search_vector = SearchVectorField(
        null=True,
        blank=True,
        help_text='Auto-updated GIN-indexed tsvector',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('content_type', 'object_id')]
        indexes = [
            models.Index(
                fields=['workspace', 'content_type'],
                name='emb_ws_ct_idx',
            ),
        ]

    def __str__(self):
        return f"Embedding {self.id} [{self.content_type}:{self.object_id}]"
