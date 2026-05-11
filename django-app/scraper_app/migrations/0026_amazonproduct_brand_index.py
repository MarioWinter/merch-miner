"""Add btree index on AmazonProduct.brand for the `brand__in` filter path.

Runs `CREATE INDEX CONCURRENTLY` so the migration does NOT lock the
`scraper_app_amazonproduct` table on prod (100k+ rows). CONCURRENTLY
cannot run inside a transaction, so this migration is marked
`atomic = False`. `IF NOT EXISTS` makes a re-run safe if the index
was already created out-of-band.

State side (`AddIndex`) mirrors the index in Django's migration graph so
future `makemigrations` runs don't try to recreate it.
"""

from django.db import migrations, models


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('scraper_app', '0025_alter_extra_rh_filters_null'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        'CREATE INDEX CONCURRENTLY IF NOT EXISTS '
                        '"ix_amzproduct_brand" '
                        'ON "scraper_app_amazonproduct" ("brand");'
                    ),
                    reverse_sql=(
                        'DROP INDEX CONCURRENTLY IF EXISTS '
                        '"ix_amzproduct_brand";'
                    ),
                ),
            ],
            state_operations=[
                migrations.AddIndex(
                    model_name='amazonproduct',
                    index=models.Index(
                        fields=['brand'],
                        name='ix_amzproduct_brand',
                    ),
                ),
            ],
        ),
    ]
