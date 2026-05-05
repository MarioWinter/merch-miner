"""Read-only triage tool for a BulkScrapeBatch (PROJ-25 G.7).

Prints batch identity, counts, drainer-lock state, in-flight ScrapeJobs,
and recent errors. Pure read-only — never mutates state.

Usage:
    python manage.py inspect_bulk_batch <batch_id>
    python manage.py inspect_bulk_batch <batch_id> --limit-errors 50
"""

import django_rq
from django.core.management.base import BaseCommand, CommandError

from scraper_app.models import BulkScrapeBatch, ScrapeJob


class Command(BaseCommand):
    help = 'Read-only triage report for a BulkScrapeBatch (PROJ-25).'

    def add_arguments(self, parser):
        parser.add_argument('batch_id', type=str, help='UUID of the BulkScrapeBatch')
        parser.add_argument(
            '--limit-errors', type=int, default=20,
            help='Number of recent errors to print (default 20).',
        )

    def handle(self, *args, **options):
        batch_id = options['batch_id']
        limit = options['limit_errors']

        try:
            batch = BulkScrapeBatch.objects.get(id=batch_id)
        except BulkScrapeBatch.DoesNotExist:
            raise CommandError(f"BulkScrapeBatch {batch_id!r} not found.")

        self.stdout.write(self.style.SUCCESS(f"=== Batch {batch.id} ==="))
        self.stdout.write(f"  name              : {batch.name}")
        self.stdout.write(f"  source_filename   : {batch.source_filename}")
        self.stdout.write(f"  marketplace       : {batch.marketplace}")
        self.stdout.write(f"  force_rescrape    : {batch.force_rescrape}")
        self.stdout.write(f"  status            : {batch.status}")
        self.stdout.write(f"  created_at        : {batch.created_at}")
        self.stdout.write(f"  started_at        : {batch.started_at}")
        self.stdout.write(f"  finished_at       : {batch.finished_at}")

        self.stdout.write("\n--- Counts ---")
        self.stdout.write(f"  total   : {batch.total_count}")
        self.stdout.write(f"  pending : {batch.pending_count}")
        self.stdout.write(f"  running : {batch.running_count}")
        self.stdout.write(f"  done    : {batch.done_count}")
        self.stdout.write(f"  failed  : {batch.failed_count}")

        self.stdout.write("\n--- Drainer Lock ---")
        try:
            conn = django_rq.get_connection()
            lock_key = f"bulk_drainer:{batch.id}"
            lock_value = conn.get(lock_key)
            if lock_value is None:
                self.stdout.write("  not held")
            else:
                ttl = conn.ttl(lock_key)
                value_str = lock_value.decode('utf-8', errors='replace') if isinstance(lock_value, bytes) else str(lock_value)
                self.stdout.write(f"  held by  : {value_str}")
                self.stdout.write(f"  ttl_secs : {ttl}")
        except Exception as exc:  # noqa: BLE001
            self.stdout.write(self.style.WARNING(f"  lock check failed: {exc}"))

        self.stdout.write("\n--- In-flight ScrapeJobs ---")
        in_flight = ScrapeJob.objects.filter(
            batch=batch,
            status__in=[ScrapeJob.Status.PENDING, ScrapeJob.Status.RUNNING],
        ).order_by('created_at' if hasattr(ScrapeJob, 'created_at') else '-id')
        if not in_flight.exists():
            self.stdout.write("  (none)")
        else:
            for job in in_flight:
                asin_preview = ''
                if job.asin_list:
                    asin_preview = ','.join(job.asin_list[:3])
                    if len(job.asin_list) > 3:
                        asin_preview += f"… (+{len(job.asin_list) - 3} more)"
                self.stdout.write(
                    f"  {job.id} status={job.status} asins=[{asin_preview}] "
                    f"pid={job.pid} started_at={job.started_at}"
                )

        self.stdout.write(f"\n--- Recent errors (last {limit}) ---")
        errors = list(reversed(batch.errors or []))[:limit]
        if not errors:
            self.stdout.write("  (none)")
        else:
            for entry in errors:
                self.stdout.write(f"  {entry}")
