from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVector
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('scraper_app', '0006_productsearchcache_workspace'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE INDEX IF NOT EXISTS scraper_amazonproduct_fts_gin
            ON scraper_app_amazonproduct
            USING GIN (
                to_tsvector(
                    'english',
                    COALESCE(title, '') || ' ' ||
                    COALESCE(brand, '') || ' ' ||
                    COALESCE(bullet_1, '') || ' ' ||
                    COALESCE(bullet_2, '') || ' ' ||
                    COALESCE(description, '')
                )
            );
            """,
            reverse_sql="DROP INDEX IF EXISTS scraper_amazonproduct_fts_gin;",
        ),
    ]
