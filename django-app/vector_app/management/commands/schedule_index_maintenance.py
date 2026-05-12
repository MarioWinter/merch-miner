"""PROJ-29 Phase 1B Round 3: register daily maintenance + retry crons.

Two scheduled jobs registered via `django_rq.get_scheduler()`:
- 04:00 UTC -> maintain_indexes (REINDEX CONCURRENTLY + bloat log)
- 04:15 UTC -> retry_failed_indexings (oldest 100 unresolved)

Idempotent: cancels existing schedules with the same id before re-registering.
Run once per deploy:  docker compose exec web python manage.py schedule_index_maintenance
"""

import logging
from datetime import datetime, timezone

import django_rq
from django.core.management.base import BaseCommand

from vector_app.tasks import maintain_indexes, retry_failed_indexings

logger = logging.getLogger(__name__)


SCHEDULED_JOBS = [
    {
        'id': 'vector_app.maintain_indexes',
        'cron': '0 4 * * *',
        'func': maintain_indexes,
        'description': 'PROJ-29: daily REINDEX CONCURRENTLY at 04:00 UTC',
    },
    {
        'id': 'vector_app.retry_failed_indexings',
        'cron': '15 4 * * *',
        'func': retry_failed_indexings,
        'description': 'PROJ-29: retry unresolved IndexingFailure rows at 04:15 UTC',
    },
]


class Command(BaseCommand):
    help = (
        'Register daily PROJ-29 maintenance crons (maintain_indexes + '
        'retry_failed_indexings) on the default rq queue.'
    )

    def handle(self, *args, **options):
        scheduler = django_rq.get_scheduler('default')

        for spec in SCHEDULED_JOBS:
            self._cancel_existing(scheduler, spec['id'])
            scheduler.cron(
                spec['cron'],
                func=spec['func'],
                id=spec['id'],
                queue_name='default',
                use_local_timezone=False,
                description=spec['description'],
            )
            self.stdout.write(self.style.SUCCESS(
                f"Scheduled '{spec['id']}' on cron '{spec['cron']}'."
            ))

    def _cancel_existing(self, scheduler, job_id: str) -> None:
        for job in scheduler.get_jobs():
            if job.id == job_id:
                scheduler.cancel(job)
