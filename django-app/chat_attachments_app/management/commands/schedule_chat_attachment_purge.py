"""Idempotent scheduler for the chat-attachment purge job.

Run on container start (entrypoint) or manually:

    python manage.py schedule_chat_attachment_purge

Re-running clears any previous registration so cron-string changes pick up
without leaving duplicate jobs. Job runs daily at 03:00 UTC.
"""

from __future__ import annotations

import django_rq
from django.core.management.base import BaseCommand

JOB_ID = 'chat_attachments.purge_old'
CRON_DAILY_3AM = '0 3 * * *'


class Command(BaseCommand):
    help = 'Schedule the daily chat-attachment purge cron job.'

    def handle(self, *args, **options):
        scheduler = django_rq.get_scheduler('default')
        # Drop any existing registration before re-adding (idempotent).
        for job in list(scheduler.get_jobs()):
            if job.id == JOB_ID:
                scheduler.cancel(job)

        scheduler.cron(
            CRON_DAILY_3AM,
            func='chat_attachments_app.tasks.purge_old_attachments',
            id=JOB_ID,
            queue_name='default',
            use_local_timezone=False,
            description='Daily purge of chat attachments older than 90 days.',
        )
        self.stdout.write(self.style.SUCCESS(
            f'Scheduled `{JOB_ID}` with cron `{CRON_DAILY_3AM}` (UTC).'
        ))
