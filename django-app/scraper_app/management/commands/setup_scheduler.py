import logging

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone
from django_rq import get_scheduler

from scraper_app.tasks import (
    schedule_health_check_runner,
    schedule_scrape_runner,
)

logger = logging.getLogger(__name__)

SCHEDULER_INTERVAL_SECONDS = 60 * 60  # 1 hour
DEFAULT_HEALTH_CHECK_CRON = '0 4 * * 1'  # Mondays 04:00 UTC


class Command(BaseCommand):
    help = (
        'Register schedule_scrape_runner (hourly) and schedule_health_check_runner '
        '(weekly via cron) in rqscheduler. Idempotent — safe to re-run.'
    )

    def handle(self, *args, **options):
        scheduler = get_scheduler('default')

        # ------------------------------------------------------------------
        # Hourly: schedule_scrape_runner
        # ------------------------------------------------------------------
        for job in scheduler.get_jobs():
            if job.func_name == 'scraper_app.tasks.schedule_scrape_runner':
                scheduler.cancel(job)
                self.stdout.write(f'Cancelled existing scrape-runner job {job.id}')

        scheduler.schedule(
            scheduled_time=timezone.now(),  # start immediately
            func=schedule_scrape_runner,
            interval=SCHEDULER_INTERVAL_SECONDS,
            repeat=None,  # repeat forever
            queue_name='default',
        )
        self.stdout.write(self.style.SUCCESS(
            f'Registered schedule_scrape_runner (every {SCHEDULER_INTERVAL_SECONDS}s)'
        ))

        # ------------------------------------------------------------------
        # Weekly cron: schedule_health_check_runner (PROJ-23)
        # ------------------------------------------------------------------
        cron_expression = getattr(
            settings, 'SELECTOR_HEALTH_CHECK_SCHEDULE_CRON', DEFAULT_HEALTH_CHECK_CRON,
        )

        for job in scheduler.get_jobs():
            if job.func_name == 'scraper_app.tasks.schedule_health_check_runner':
                scheduler.cancel(job)
                self.stdout.write(f'Cancelled existing health-check job {job.id}')

        scheduler.cron(
            cron_string=cron_expression,
            func=schedule_health_check_runner,
            queue_name='default',
            use_local_timezone=False,  # cron is UTC-based by spec default
        )
        self.stdout.write(self.style.SUCCESS(
            f'Registered schedule_health_check_runner (cron: {cron_expression})'
        ))
