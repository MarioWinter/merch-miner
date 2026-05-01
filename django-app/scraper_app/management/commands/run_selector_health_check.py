"""Manual / CI trigger for the selector health-check spider (PROJ-23).

Usage:
    # Single canary
    python manage.py run_selector_health_check --canary-id <uuid>

    # All active canaries (default)
    python manage.py run_selector_health_check
"""

import logging

import django_rq
from django.core.management.base import BaseCommand, CommandError

from scraper_app.models import CanaryAsin
from scraper_app.tasks import run_selector_health_check

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        'Run the selector health-check for one specific canary (--canary-id) '
        'or for all active CanaryAsin records when no ID is given. '
        'Jobs are enqueued onto the "scraper" RQ queue.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--canary-id',
            type=str,
            default=None,
            help='UUID of a single CanaryAsin to run; omit to run all active canaries.',
        )
        parser.add_argument(
            '--inline',
            action='store_true',
            default=False,
            help='Run synchronously in this process (skip RQ queue). Useful for CI.',
        )

    def handle(self, *args, **options):
        canary_id = options.get('canary_id')
        run_inline = options.get('inline', False)

        if canary_id:
            try:
                canaries = [CanaryAsin.objects.get(id=canary_id)]
            except CanaryAsin.DoesNotExist as exc:
                raise CommandError(f"CanaryAsin {canary_id} not found.") from exc
        else:
            canaries = list(CanaryAsin.objects.filter(active=True))

        if not canaries:
            self.stdout.write(self.style.WARNING(
                'No canaries to run (none active or none found).'
            ))
            return

        triggered_by = 'cli'
        results = []
        queue = None if run_inline else django_rq.get_queue('scraper')

        for canary in canaries:
            if run_inline:
                health_check = run_selector_health_check(
                    canary_id=str(canary.id),
                    triggered_by=triggered_by,
                )
                hc_id = str(health_check.id) if health_check else 'n/a'
                self.stdout.write(
                    f"Inline-ran canary={canary.asin} marketplace={canary.marketplace} "
                    f"-> SelectorHealthCheck {hc_id}"
                )
                results.append(hc_id)
            else:
                rq_job = queue.enqueue(
                    run_selector_health_check,
                    canary_id=str(canary.id),
                    triggered_by=triggered_by,
                )
                self.stdout.write(
                    f"Enqueued canary={canary.asin} marketplace={canary.marketplace} "
                    f"-> rq_job={rq_job.id}"
                )
                results.append(rq_job.id)

        self.stdout.write(self.style.SUCCESS(
            f'Submitted {len(results)} health-check job(s).'
        ))
