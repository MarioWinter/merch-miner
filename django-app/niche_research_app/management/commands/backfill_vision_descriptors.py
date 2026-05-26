"""PROJ-34 Phase 13t-p — CLI wrapper for vision_backfill service.

Usage:
    python manage.py backfill_vision_descriptors
    python manage.py backfill_vision_descriptors --dry-run
    python manage.py backfill_vision_descriptors --limit 5
    python manage.py backfill_vision_descriptors --niche-id <uuid>
    python manage.py backfill_vision_descriptors --workspace-id <uuid>
"""

from django.core.management.base import BaseCommand

from niche_research_app.models import NicheProductVisionAnalysis
from niche_research_app.services.vision_backfill import (
    backfill_vision_descriptors,
)


class Command(BaseCommand):
    help = (
        'Backfill typography/font_combination/accessory descriptors for '
        'existing NicheProductVisionAnalysis rows using gpt-4.1-mini.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Log would-be results without writing to DB.',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Process at most N rows (after filters).',
        )
        parser.add_argument(
            '--niche-id',
            type=str,
            default=None,
            help='Scope to a single Niche UUID.',
        )
        parser.add_argument(
            '--workspace-id',
            type=str,
            default=None,
            help='Scope to a single Workspace UUID.',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Bypass empty-field eligibility filter; reprocess all rows '
                 'with non-empty graphic_elements (overwrites existing descriptors).',
        )

    def handle(self, *args, **options):
        qs = NicheProductVisionAnalysis.objects.all()

        niche_id = options.get('niche_id')
        if niche_id:
            qs = qs.filter(research__niche_id=niche_id)

        workspace_id = options.get('workspace_id')
        if workspace_id:
            qs = qs.filter(research__niche__workspace_id=workspace_id)

        summary = backfill_vision_descriptors(
            rows=qs,
            dry_run=options.get('dry_run', False),
            limit=options.get('limit'),
            force=options.get('force', False),
        )

        self.stdout.write(self.style.SUCCESS('Backfill complete.'))
        for key, value in summary.as_dict().items():
            self.stdout.write(f'  {key}: {value}')
