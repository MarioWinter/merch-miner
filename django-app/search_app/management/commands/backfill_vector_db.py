"""Backfill Vector DB embeddings for already-crawled WebSearchResults.

Usage:
    python manage.py backfill_vector_db
    python manage.py backfill_vector_db --workspace-id <uuid> --limit 100
    python manage.py backfill_vector_db --dry-run

Useful when `VECTOR_DB_ENABLED` was false during initial crawls — flips back
on later and re-embeds all existing full_crawl results that don't yet have
an embedding row in `vector_app.Embedding`.
"""

import django_rq
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand

from search_app.models import WebSearchResult


class Command(BaseCommand):
    help = 'Backfill Vector DB embeddings for completed WebSearchResults.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--workspace-id',
            type=str,
            default=None,
            help='Limit to a single workspace UUID.',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Max number of records to process.',
        )
        parser.add_argument(
            '--include-snippets',
            action='store_true',
            help='Also embed snippet-only results (default: full_crawl only).',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Print counts without enqueuing.',
        )

    def handle(self, *args, **options):
        workspace_id = options.get('workspace_id')
        limit = options.get('limit')
        include_snippets = options.get('include_snippets')
        dry_run = options.get('dry_run')

        try:
            from vector_app.models import Embedding
            from vector_app.tasks import create_or_update_embedding
        except ImportError:
            self.stderr.write(
                self.style.ERROR(
                    'vector_app not installed — cannot backfill.',
                ),
            )
            return

        ct = ContentType.objects.get_for_model(WebSearchResult)

        qs = WebSearchResult.objects.filter(
            crawl_status=WebSearchResult.CrawlStatus.COMPLETED,
        ).exclude(content='')

        if not include_snippets:
            qs = qs.filter(content_type=WebSearchResult.ContentType.FULL_CRAWL)

        if workspace_id:
            qs = qs.filter(workspace_id=workspace_id)

        # Skip those with existing embeddings
        existing_ids = set(
            Embedding.objects.filter(content_type=ct).values_list(
                'object_id', flat=True,
            )
        )
        total = qs.count()
        qs = qs.exclude(pk__in=existing_ids)
        pending = qs.count()

        self.stdout.write(
            f"Total completed crawls: {total}, pending embedding: {pending}",
        )

        if limit:
            qs = qs[:limit]

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"[DRY RUN] Would enqueue {qs.count()} embedding jobs.",
                ),
            )
            return

        queue = django_rq.get_queue('search')
        enqueued = 0
        for result in qs:
            queue.enqueue(
                create_or_update_embedding,
                content_type_id=ct.id,
                object_id=str(result.pk),
            )
            enqueued += 1
            if enqueued % 50 == 0:
                self.stdout.write(f"  ...enqueued {enqueued}")

        self.stdout.write(
            self.style.SUCCESS(
                f"Enqueued {enqueued} embedding jobs.",
            ),
        )
