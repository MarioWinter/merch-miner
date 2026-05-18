"""PROJ-34 Phase 13c.7 / AC-57 — Backfill `Niche.builder_form_hints`.

Walks every Niche whose `builder_form_hints` is still null AND which has at
least one COMPLETED `NicheResearch` run, calling
`niche_app.services.builder_hints.structure_niche_for_builder` for each.

Usage:
    python manage.py backfill_niche_builder_hints              # process all candidates
    python manage.py backfill_niche_builder_hints --dry-run    # list count only, no LLM calls
    python manage.py backfill_niche_builder_hints --workspace-id <uuid>
    python manage.py backfill_niche_builder_hints --limit 20

Behaviour:
- 1 second sleep between LLM calls so we never hammer OpenRouter.
- Per-niche try/except so one failure does not abort the batch.
- Exits 0 on partial success; exits 1 only if zero niches succeed AND at
  least one failed (so an empty candidate list is still a 0 exit).
"""

from __future__ import annotations

import time

from django.core.management.base import BaseCommand, CommandError

from niche_app.models import Niche
from niche_app.services.builder_hints import structure_niche_for_builder

SLEEP_BETWEEN_CALLS_SEC = 1.0


class Command(BaseCommand):
    help = (
        'Backfill `Niche.builder_form_hints` for every niche with completed '
        'research but no stored hints yet (PROJ-34 AC-57).'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='List candidate count only — do not call the LLM.',
        )
        parser.add_argument(
            '--workspace-id',
            type=str,
            default=None,
            help='Restrict the backfill to a single workspace UUID.',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Maximum number of niches to process this run.',
        )

    def handle(self, *args, **options):
        dry_run: bool = options['dry_run']
        workspace_id: str | None = options['workspace_id']
        limit: int | None = options['limit']

        qs = (
            Niche.objects
            .filter(builder_form_hints__isnull=True)
            .filter(research_runs__status='completed')
            .distinct()
            .order_by('created_at')
        )
        if workspace_id:
            qs = qs.filter(workspace_id=workspace_id)
        if limit is not None and limit >= 0:
            qs = qs[:limit]

        candidates = list(qs)
        self.stdout.write(
            f'Found {len(candidates)} candidate(s) for backfill.',
        )

        if dry_run:
            for niche in candidates:
                self.stdout.write(f'  - {niche.id} {niche.name}')
            return

        if not candidates:
            return

        success_count = 0
        failure_count = 0
        for index, niche in enumerate(candidates):
            try:
                result = structure_niche_for_builder(niche.id)
            except Exception as exc:  # noqa: BLE001 — never abort batch
                failure_count += 1
                self.stderr.write(
                    f'  FAIL {niche.id} {niche.name}: '
                    f'{type(exc).__name__}: {exc}',
                )
            else:
                if result is None:
                    failure_count += 1
                    self.stderr.write(
                        f'  FAIL {niche.id} {niche.name}: '
                        f'structure_niche_for_builder returned None',
                    )
                else:
                    success_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'  OK   {niche.id} {niche.name}',
                        ),
                    )
            # Throttle between calls so we don't hammer OpenRouter.
            if index < len(candidates) - 1:
                time.sleep(SLEEP_BETWEEN_CALLS_SEC)

        self.stdout.write(
            f'Done. success={success_count} failure={failure_count}',
        )

        if success_count == 0 and failure_count > 0:
            raise CommandError(
                'All niches failed during backfill — see errors above.',
            )
