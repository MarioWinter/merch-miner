"""Add batch-related fields to ScraperConfig (PROJ-25 Phase D).

Schema-only, additive. Numbered 0019 even though it lands AFTER 0022 in
dependency order — Django migrations are addressed by name + dependency graph,
not by numeric ordering. Keeping the historic numbering matches the spec's
component map without rewriting the prior schema migrations.

See features/PROJ-25-bulk-asin-scrape-batches.md AC-4 / AC-11b.
"""

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('scraper_app', '0022_scrapejob_batch_asinlist_mode'),
    ]

    operations = [
        migrations.AddField(
            model_name='scraperconfig',
            name='batch_size',
            field=models.PositiveIntegerField(
                default=10,
                help_text='ASINs per batch spider subprocess (PROJ-25 / AC-4). 1–50.',
                validators=[MinValueValidator(1), MaxValueValidator(50)],
            ),
        ),
        migrations.AddField(
            model_name='scraperconfig',
            name='max_retries_per_asin',
            field=models.PositiveIntegerField(
                default=1,
                help_text=(
                    'How many times a failed ASIN is auto-retried in the same '
                    'batch (PROJ-25 / AC-4).'
                ),
            ),
        ),
        migrations.AddField(
            model_name='scraperconfig',
            name='fresh_skip_days',
            field=models.PositiveIntegerField(
                default=30,
                help_text=(
                    'Skip ASINs whose AmazonProduct was scraped within this many '
                    'days unless the batch has force_rescrape=True '
                    '(PROJ-25 / AC-4 / AC-11b).'
                ),
            ),
        ),
    ]
