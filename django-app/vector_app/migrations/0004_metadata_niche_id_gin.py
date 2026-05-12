"""PROJ-29 Phase 1C: GIN index on Embedding.metadata->>'niche_id'.

Accelerates niche-scoped filtering used by `EmbeddingService.hybrid_search`
(e.g. `Embedding.objects.filter(metadata__niche_id=<id>)`). CONCURRENTLY
requires `atomic = False`.
"""

from django.db import migrations


SQL_FORWARD = (
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS embedding_metadata_niche_id_gin "
    "ON vector_app_embedding USING GIN ((metadata->>'niche_id') gin_trgm_ops);"
)

SQL_REVERSE = "DROP INDEX IF EXISTS embedding_metadata_niche_id_gin;"


class Migration(migrations.Migration):

    atomic = False

    dependencies = [
        ('vector_app', '0003_indexing_failure'),
    ]

    operations = [
        migrations.RunSQL(sql=SQL_FORWARD, reverse_sql=SQL_REVERSE),
    ]
