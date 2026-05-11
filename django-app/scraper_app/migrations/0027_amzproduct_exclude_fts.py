"""Indexes for the broadened `exclude_words` filter + the `subcategory` filter.

1. `ix_amzproduct_subcat_trgm` — pg_trgm GIN on `subcategory` so
   `subcategory__icontains=...` is served by an index (positive LIKE).

2. `ix_amzproduct_excl_fts` — FTS GIN over `to_tsvector('english',
   title || brand || bullet_1 || bullet_2)`. Used by the refactored
   `exclude_words` filter via tsquery NEGATION (`NOT vec @@ query`),
   which — unlike negative ILIKE — IS index-served. `description` is
   intentionally excluded to avoid over-filtering on marketing copy.

Both indexes are created with CONCURRENTLY (atomic = False, IF NOT
EXISTS) so the migration does not lock `scraper_app_amazonproduct` on
deploy. The state side mirrors what `makemigrations` produced so the
Django migration graph stays consistent with the on-disk schema.

The SQL below was captured from `manage.py sqlmigrate` and adapted with
CONCURRENTLY — keeping the index expression IDENTICAL to what Django's
SearchVector(...) generates at query time is critical: any deviation
(quoting, COALESCE, regconfig cast) breaks index usage at runtime.
"""

import django.contrib.postgres.indexes
import django.contrib.postgres.search
from django.db import migrations


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('scraper_app', '0026_amazonproduct_brand_index'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        'CREATE INDEX CONCURRENTLY IF NOT EXISTS '
                        '"ix_amzproduct_subcat_trgm" '
                        'ON "scraper_app_amazonproduct" '
                        'USING gin ("subcategory" gin_trgm_ops);'
                    ),
                    reverse_sql=(
                        'DROP INDEX CONCURRENTLY IF EXISTS '
                        '"ix_amzproduct_subcat_trgm";'
                    ),
                ),
                migrations.RunSQL(
                    sql=(
                        'CREATE INDEX CONCURRENTLY IF NOT EXISTS '
                        '"ix_amzproduct_excl_fts" '
                        'ON "scraper_app_amazonproduct" '
                        "USING gin ((to_tsvector('english'::regconfig, "
                        "COALESCE(\"title\", '') || ' ' || "
                        "COALESCE(\"brand\", '') || ' ' || "
                        "COALESCE(\"bullet_1\", '') || ' ' || "
                        "COALESCE(\"bullet_2\", ''))));"
                    ),
                    reverse_sql=(
                        'DROP INDEX CONCURRENTLY IF EXISTS '
                        '"ix_amzproduct_excl_fts";'
                    ),
                ),
            ],
            state_operations=[
                migrations.AddIndex(
                    model_name='amazonproduct',
                    index=django.contrib.postgres.indexes.GinIndex(
                        fields=['subcategory'],
                        name='ix_amzproduct_subcat_trgm',
                        opclasses=['gin_trgm_ops'],
                    ),
                ),
                migrations.AddIndex(
                    model_name='amazonproduct',
                    index=django.contrib.postgres.indexes.GinIndex(
                        django.contrib.postgres.search.SearchVector(
                            'title', 'brand', 'bullet_1', 'bullet_2',
                            config='english',
                        ),
                        name='ix_amzproduct_excl_fts',
                    ),
                ),
            ],
        ),
    ]
