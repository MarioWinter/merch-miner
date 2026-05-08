"""Idempotent scheduler for the stuck-upscale reconciler.

Run on container start (entrypoint) or manually:

    python manage.py schedule_upscale_reconciler

Re-running clears any previous registration so interval changes pick up
without leaving duplicate jobs.
"""

from __future__ import annotations

import django_rq
from django.core.management.base import BaseCommand

JOB_ID = 'design_app_reconcile_stuck_upscales'
INTERVAL_SECONDS = 60


class Command(BaseCommand):
    help = 'Schedule the 60s upscale reconciler.'

    def handle(self, *args, **options):
        scheduler = django_rq.get_scheduler('design')
        # Drop any existing registration before re-adding (idempotent).
        for job in list(scheduler.get_jobs()):
            if job.id == JOB_ID:
                scheduler.cancel(job)

        scheduler.schedule(
            scheduled_time=__import__('datetime').datetime.utcnow(),
            func='design_app.tasks.reconcile_stuck_jobs',
            interval=INTERVAL_SECONDS,
            repeat=None,
            id=JOB_ID,
            queue_name='design',
            description=(
                'Every 60s: scan running upscale jobs >5min old and poll '
                'Replicate to recover lost-webhook state.'
            ),
        )
        self.stdout.write(self.style.SUCCESS(
            f'Scheduled `{JOB_ID}` every {INTERVAL_SECONDS}s on the `design` queue.'
        ))
