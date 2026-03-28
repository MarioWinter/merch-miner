"""Create pgvector + pg_trgm extensions and Embedding model.

AC-1: pgvector extension
AC-2: pg_trgm extension
AC-3: Embedding model with VectorField + SearchVectorField
AC-4: HNSW index on embedding column
AC-5: GIN index on search_vector column
AC-6: Composite index on (workspace_id, content_type_id)
AC-7: unique_together on (content_type, object_id)
"""

import uuid

import django.contrib.postgres.search
import django.db.models.deletion
import pgvector.django
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('contenttypes', '0002_remove_content_type_name'),
        ('workspace_app', '0001_initial'),
    ]

    operations = [
        # AC-1: Enable pgvector extension
        migrations.RunSQL(
            sql='CREATE EXTENSION IF NOT EXISTS vector;',
            reverse_sql='DROP EXTENSION IF EXISTS vector;',
        ),
        # AC-2: Enable pg_trgm extension
        migrations.RunSQL(
            sql='CREATE EXTENSION IF NOT EXISTS pg_trgm;',
            reverse_sql='DROP EXTENSION IF EXISTS pg_trgm;',
        ),
        # AC-3: Embedding model
        migrations.CreateModel(
            name='Embedding',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('object_id', models.UUIDField(db_index=True)),
                ('embedding', pgvector.django.VectorField(dimensions=1536)),
                ('text_input', models.TextField(help_text='Original text that was embedded')),
                ('metadata', models.JSONField(blank=True, default=dict, help_text='Flexible: source, niche_id, content_subtype, chunk_index, etc.')),
                ('search_text', models.TextField(blank=True, default='', help_text='Optimized text for tsvector full-text search')),
                ('search_vector', django.contrib.postgres.search.SearchVectorField(blank=True, help_text='Auto-updated GIN-indexed tsvector', null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('content_type', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='embeddings', to='contenttypes.contenttype')),
                ('workspace', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='embeddings', to='workspace_app.workspace')),
            ],
            options={
                'unique_together': {('content_type', 'object_id')},
            },
        ),
        # AC-6: Composite index on (workspace_id, content_type_id)
        migrations.AddIndex(
            model_name='embedding',
            index=models.Index(fields=['workspace', 'content_type'], name='emb_ws_ct_idx'),
        ),
        # AC-4: HNSW index on embedding column for fast ANN search
        migrations.RunSQL(
            sql='CREATE INDEX emb_hnsw_idx ON vector_app_embedding USING hnsw (embedding vector_cosine_ops);',
            reverse_sql='DROP INDEX IF EXISTS emb_hnsw_idx;',
        ),
        # AC-5: GIN index on search_vector column for full-text search
        migrations.RunSQL(
            sql='CREATE INDEX emb_search_gin_idx ON vector_app_embedding USING gin (search_vector);',
            reverse_sql='DROP INDEX IF EXISTS emb_search_gin_idx;',
        ),
    ]
