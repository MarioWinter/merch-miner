import logging

import django_rq
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand

from vector_app.models import Embedding
from vector_app.services import EMBEDDABLE_MODELS
from vector_app.tasks import create_or_update_embedding

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Backfill embeddings for existing objects that are missing them.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--content-type',
            type=str,
            help='Only backfill specific content type label (e.g. "niche", "idea")',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=100,
            help='Number of objects to process per batch (default: 100)',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Re-create all embeddings (even existing ones)',
        )

    def handle(self, *args, **options):
        content_type_filter = options['content_type']
        batch_size = options['batch_size']
        force = options['force']

        queue = django_rq.get_queue('default')
        total_enqueued = 0

        for model_key, label in EMBEDDABLE_MODELS.items():
            if content_type_filter and label != content_type_filter:
                continue

            app_label, model_name = model_key.split('.')
            try:
                ct = ContentType.objects.get(app_label=app_label, model=model_name)
            except ContentType.DoesNotExist:
                self.stdout.write(f"  Skipping {label}: ContentType not found")
                continue

            model_class = ct.model_class()
            if model_class is None:
                self.stdout.write(f"  Skipping {label}: model class not found")
                continue

            if not hasattr(model_class, 'get_embedding_text'):
                self.stdout.write(f"  Skipping {label}: no get_embedding_text()")
                continue

            # Get IDs that need embeddings
            all_ids = list(model_class.objects.values_list('pk', flat=True))

            if force:
                missing_ids = all_ids
            else:
                existing_ids = set(
                    Embedding.objects
                    .filter(content_type=ct)
                    .values_list('object_id', flat=True)
                )
                missing_ids = [pk for pk in all_ids if pk not in existing_ids]

            if not missing_ids:
                self.stdout.write(f"  {label}: 0 missing, skipping")
                continue

            self.stdout.write(
                f"  {label}: {len(missing_ids)} objects to process"
            )

            # Enqueue in batches
            for i in range(0, len(missing_ids), batch_size):
                batch = missing_ids[i:i + batch_size]
                for obj_id in batch:
                    queue.enqueue(
                        create_or_update_embedding,
                        content_type_id=ct.id,
                        object_id=str(obj_id),
                    )
                total_enqueued += len(batch)
                self.stdout.write(
                    f"    Enqueued batch {i // batch_size + 1} "
                    f"({len(batch)} jobs)"
                )

        self.stdout.write(
            self.style.SUCCESS(f"Done. {total_enqueued} jobs enqueued.")
        )
