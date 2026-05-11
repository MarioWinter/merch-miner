"""Indexes for the broadened exclude_words filter + the subcategory filter.

- `ix_amzproduct_subcat_trgm` — pg_trgm GIN on `subcategory` for
  `subcategory__icontains=...` (positive LIKE → index-served).
- `ix_amzproduct_excl_fts` — FTS GIN over `to_tsvector('english',
  title || brand || bullet_1 || bullet_2)`. views.py consumes it via
  anti-join: positive `@@` in an inner subquery uses the index, outer
  NOT IN excludes the matched IDs. Direct `NOT vec @@` would fall
  back to Seq Scan (same planner limitation as negative ILIKE).

CONCURRENTLY + atomic=False so deploy doesn't lock the table. SQL was
captured from `manage.py sqlmigrate` so the index expression matches
what Django's SearchVector emits — any drift in quoting/COALESCE/cast
breaks index usage at runtime.
"""

import django.contrib.postgres.indexes
import django.contrib.postgres.search
from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('scraper_app', '0026_amazonproduct_brand_index'),
    ]

    operations = [
        # Ensure pg_trgm is available. Idempotent: no-op when the extension is
        # already installed (dev + prod), creates it where missing (CI test DB).
        TrigramExtension(),
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
