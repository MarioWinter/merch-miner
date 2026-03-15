import logging

from django.core.management.base import BaseCommand
from django_rq import get_scheduler

from scraper_app.tasks import schedule_scrape_runner

logger = logging.getLogger(__name__)

SCHEDULER_INTERVAL_SECONDS = 60 * 60  # 1 hour


class Command(BaseCommand):
    help = 'Register schedule_scrape_runner as an hourly job in rqscheduler'

    def handle(self, *args, **options):
        scheduler = get_scheduler('default')

        # Clear existing schedule_scrape_runner jobs to avoid duplicates
        for job in scheduler.get_jobs():
            if job.func_name == 'scraper_app.tasks.schedule_scrape_runner':
                scheduler.cancel(job)
                self.stdout.write(f'Cancelled existing job {job.id}')

        scheduler.schedule(
            scheduled_time=None,  # start immediately
            func=schedule_scrape_runner,
            interval=SCHEDULER_INTERVAL_SECONDS,
            repeat=None,  # repeat forever
            queue_name='default',
        )

        self.stdout.write(self.style.SUCCESS(
            f'Registered schedule_scrape_runner (every {SCHEDULER_INTERVAL_SECONDS}s)'
        ))
