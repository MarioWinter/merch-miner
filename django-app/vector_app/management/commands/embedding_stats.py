from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand
from django.db.models import Count

from vector_app.models import Embedding
from vector_app.services import EMBEDDABLE_MODELS


class Command(BaseCommand):
    help = 'Print embedding statistics per content type and workspace.'

    def handle(self, *args, **options):
        self.stdout.write("\n=== Embedding Stats ===\n")

        # Per content type
        ct_stats = (
            Embedding.objects
            .values('content_type__app_label', 'content_type__model')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        self.stdout.write("By Content Type:")
        total = 0
        for stat in ct_stats:
            key = f"{stat['content_type__app_label']}.{stat['content_type__model']}"
            label = EMBEDDABLE_MODELS.get(key, key)
            self.stdout.write(f"  {label}: {stat['count']}")
            total += stat['count']
        self.stdout.write(f"  Total: {total}\n")

        # Per workspace
        ws_stats = (
            Embedding.objects
            .values('workspace__name')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        self.stdout.write("By Workspace:")
        for stat in ws_stats:
            self.stdout.write(
                f"  {stat['workspace__name']}: {stat['count']}"
            )

        # Missing embeddings
        self.stdout.write("\nMissing Embeddings:")
        for model_key, label in EMBEDDABLE_MODELS.items():
            app_label, model_name = model_key.split('.')
            try:
                ct = ContentType.objects.get(
                    app_label=app_label, model=model_name,
                )
            except ContentType.DoesNotExist:
                continue

            model_class = ct.model_class()
            if model_class is None:
                continue

            total_objects = model_class.objects.count()
            embedded = Embedding.objects.filter(content_type=ct).count()
            missing = total_objects - embedded

            if missing > 0:
                self.stdout.write(
                    f"  {label}: {missing} missing "
                    f"({embedded}/{total_objects} embedded)"
                )

        self.stdout.write("")
