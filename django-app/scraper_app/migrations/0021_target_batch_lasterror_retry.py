"""Extend ScheduledScrapeTarget with batch FK + last_error + retry_count (PROJ-25 Phase B).

Schema-only, additive (all fields nullable / default 0). Composite index on
(batch, active, last_error) added here to avoid a costly later migration on a
populated table — drainer's pick query is the hot path. See AC-2 / Phase B B.5.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('scraper_app', '0020_bulkscrapebatch'),
    ]

    operations = [
        migrations.AddField(
            model_name='scheduledscrapetarget',
            name='batch',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.CASCADE,
                related_name='targets',
                to='scraper_app.bulkscrapebatch',
            ),
        ),
        migrations.AddField(
            model_name='scheduledscrapetarget',
            name='last_error',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='scheduledscrapetarget',
            name='retry_count',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddIndex(
            model_name='scheduledscrapetarget',
            index=models.Index(
                fields=['batch', 'active', 'last_error'],
                name='sst_batch_active_lasterr_idx',
            ),
        ),
    ]
