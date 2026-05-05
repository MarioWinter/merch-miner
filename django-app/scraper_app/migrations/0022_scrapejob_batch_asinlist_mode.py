"""Extend ScrapeJob with BATCH_ASIN mode + asin_list + batch FK (PROJ-25 Phase C).

Schema-only, additive (asin_list nullable, batch FK nullable). Composite index on
(status, mode) added here so the drainer's global-in-flight count query is fast
even on a populated table.

See features/PROJ-25-bulk-asin-scrape-batches.md AC-3 / AC-12.
"""

from django.db import migrations, models

import scraper_app.models


class Migration(migrations.Migration):

    dependencies = [
        ('scraper_app', '0021_target_batch_lasterror_retry'),
    ]

    operations = [
        migrations.AlterField(
            model_name='scrapejob',
            name='mode',
            field=models.CharField(
                choices=[
                    ('live', 'Live Research'),
                    ('scheduled', 'Scheduled Scrape'),
                    ('bsr_snapshot', 'BSR Snapshot'),
                    ('search_page_only', 'Search Page Only'),
                    ('batch_asin', 'Batch ASIN'),
                ],
                db_index=True,
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='scrapejob',
            name='asin_list',
            field=models.JSONField(
                blank=True,
                help_text='Up to 50 ASINs for mode=BATCH_ASIN. Validated by _validate_asin_list.',
                null=True,
                validators=[scraper_app.models._validate_asin_list],
            ),
        ),
        migrations.AddField(
            model_name='scrapejob',
            name='batch',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name='scrape_jobs',
                to='scraper_app.bulkscrapebatch',
            ),
        ),
        migrations.AddIndex(
            model_name='scrapejob',
            index=models.Index(
                fields=['status', 'mode'],
                name='scrapejob_status_mode_idx',
            ),
        ),
    ]
