"""Idempotent scheduler for the BrandBlacklist cache warmup job.

Run on container start (entrypoint) or manually:

    python manage.py schedule_brand_blacklist_warmup

Re-running clears any previous registration so cron-string changes pick up
without leaving duplicate jobs. Job runs every 30 minutes.
"""

from __future__ import annotations

import django_rq
from django.core.management.base import BaseCommand

JOB_ID = 'research_brand_blacklist_cache_warmup'
CRON_EVERY_30_MIN = '*/30 * * * *'


class Command(BaseCommand):
    help = 'Schedule the BrandBlacklist cache warmup cron job.'

    def handle(self, *args, **options):
        scheduler = django_rq.get_scheduler('default')
        # Drop any existing registration before re-adding (idempotent).
        for job in list(scheduler.get_jobs()):
            if job.id == JOB_ID:
                scheduler.cancel(job)

        scheduler.cron(
            CRON_EVERY_30_MIN,
            func='research_app.tasks.warm_blacklisted_brand_values_cache',
            id=JOB_ID,
            queue_name='default',
            use_local_timezone=False,
            description=(
                'Refresh BrandBlacklist-derived brand values cache every '
                '30 minutes.'
            ),
        )
        self.stdout.write(self.style.SUCCESS(
            f'Scheduled `{JOB_ID}` with cron `{CRON_EVERY_30_MIN}` (UTC).'
        ))
