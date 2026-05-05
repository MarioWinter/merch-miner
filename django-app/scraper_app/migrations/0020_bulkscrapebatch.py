"""Create BulkScrapeBatch model (PROJ-25 Phase B).

Schema-only, additive. See features/PROJ-25-bulk-asin-scrape-batches.md AC-1 / AC-11b / AC-32.
"""

import uuid

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('scraper_app', '0018_seed_oneshot_tier'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='BulkScrapeBatch',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=200)),
                ('source_filename', models.CharField(blank=True, default='', max_length=500)),
                ('marketplace', models.CharField(
                    choices=[
                        ('amazon_com', 'Amazon.com (US)'),
                        ('amazon_de', 'Amazon.de (DE)'),
                        ('amazon_co_uk', 'Amazon.co.uk (UK)'),
                        ('amazon_fr', 'Amazon.fr (FR)'),
                        ('amazon_it', 'Amazon.it (IT)'),
                        ('amazon_es', 'Amazon.es (ES)'),
                    ],
                    default='amazon_com',
                    max_length=20,
                )),
                ('force_rescrape', models.BooleanField(
                    default=False,
                    help_text=(
                        'If True, the freshness skip (AmazonProduct.updated_at within '
                        'fresh_skip_days) is bypassed for every target in this batch.'
                    ),
                )),
                ('status', models.CharField(
                    choices=[
                        ('draft', 'Draft'),
                        ('parsing', 'Parsing'),
                        ('parse_failed', 'Parse Failed'),
                        ('ready', 'Ready'),
                        ('running', 'Running'),
                        ('paused', 'Paused'),
                        ('completed', 'Completed'),
                        ('cancelled', 'Cancelled'),
                    ],
                    db_index=True,
                    default='draft',
                    max_length=20,
                )),
                ('total_count', models.PositiveIntegerField(default=0)),
                ('pending_count', models.PositiveIntegerField(default=0)),
                ('running_count', models.PositiveIntegerField(default=0)),
                ('done_count', models.PositiveIntegerField(default=0)),
                ('failed_count', models.PositiveIntegerField(default=0)),
                ('errors', models.JSONField(
                    blank=True,
                    default=list,
                    help_text='Last 100 events: parse warnings, drainer enqueue failures, admin actions.',
                )),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('finished_at', models.DateTimeField(blank=True, null=True)),
                ('created_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=models.deletion.SET_NULL,
                    related_name='bulk_scrape_batches',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Bulk Scrape Batch',
                'verbose_name_plural': 'Bulk Scrape Batches',
                'ordering': ['-created_at'],
            },
        ),
    ]
