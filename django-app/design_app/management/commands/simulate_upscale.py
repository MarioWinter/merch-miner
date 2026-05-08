"""Simulate a successful upscale for local dev (Replicate webhook can't reach localhost).

Usage examples:

    # Single design — sync mode, real Pillow upscale
    docker compose exec web python manage.py simulate_upscale <design_id>

    # Single design — instant (just copy original to upscaled_file slot)
    docker compose exec web python manage.py simulate_upscale <design_id> --copy

    # Whole workspace — upscale every design that doesn't have upscaled_file yet
    docker compose exec web python manage.py simulate_upscale --workspace <ws_id>

The command writes a DesignProcessingJob in `completed` status, populates
``Design.upscaled_file``, and (if applicable) increments quota usage so the
flow exactly matches what the real Replicate webhook produces.
"""

from __future__ import annotations

import io
from datetime import date

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from PIL import Image

from design_app.models import (
    Design,
    DesignProcessingJob,
    UpscaleQuotaUsage,
    UpscalerSettings,
)
from design_app.services.upscaler import center_pad_to_target


User = get_user_model()


class Command(BaseCommand):
    help = "Simulate a successful AI upscale for one or many designs (dev only)."

    def add_arguments(self, parser):
        parser.add_argument(
            'design_id',
            nargs='?',
            default=None,
            help='UUID of a single design to upscale.',
        )
        parser.add_argument(
            '--workspace',
            dest='workspace_id',
            default=None,
            help='UUID of a workspace — upscales all designs without upscaled_file.',
        )
        parser.add_argument(
            '--copy',
            action='store_true',
            help=(
                'Skip Pillow scaling — copy original bytes verbatim into '
                'upscaled_file slot. Faster but no visible difference in '
                'the Compare modal.'
            ),
        )
        parser.add_argument(
            '--user-email',
            dest='user_email',
            default=None,
            help=(
                'Email of the user the simulated job should be attributed to. '
                'Defaults to the design.workspace.owner.'
            ),
        )

    # ----------------------------------------

    def handle(self, *args, **options):
        design_id = options.get('design_id')
        workspace_id = options.get('workspace_id')
        if not design_id and not workspace_id:
            raise CommandError(
                'Provide either a positional design_id or --workspace <ws_id>.',
            )

        if design_id:
            queryset = Design.objects.filter(id=design_id)
        else:
            queryset = Design.objects.filter(workspace_id=workspace_id)

        designs = list(queryset.select_related('workspace', 'workspace__owner'))
        if not designs:
            raise CommandError('No matching designs.')

        cfg = UpscalerSettings.load()
        target_w = cfg.target_width
        target_h = cfg.target_height

        copied = 0
        skipped = 0
        for design in designs:
            if design.upscaled_file:
                self.stdout.write(
                    self.style.WARNING(
                        f'  - {design.id} already has upscaled_file, skipping. '
                        f'Re-run with the design deleting upscaled_file first.',
                    ),
                )
                skipped += 1
                continue
            if not design.image_file:
                self.stdout.write(
                    self.style.WARNING(
                        f'  - {design.id} has no original image_file, skipping.',
                    ),
                )
                skipped += 1
                continue

            triggered_by = self._resolve_user(design, options.get('user_email'))

            try:
                source_bytes = design.image_file.read()
            finally:
                design.image_file.close()

            if options['copy']:
                # Verbatim copy — modal works, but no visible difference.
                output_bytes = source_bytes
            else:
                # Real Pillow path. Choose a scale factor that:
                #   (a) doesn't trip Pillow's DecompressionBomb limit (~89M px), and
                #   (b) actually produces a visible difference vs the source.
                # If source is already ≥ target dim on either axis, we just
                # center-pad without scaling.
                with Image.open(io.BytesIO(source_bytes)) as img:
                    img.load()
                    src_w, src_h = img.size
                    if src_w >= target_w or src_h >= target_h:
                        # Already big enough — no scaling, just center-pad to canvas.
                        scaled = img
                    else:
                        # Pick the largest integer scale that keeps total px below
                        # ~80M (margin under Pillow's bomb limit).
                        max_scale_w = target_w // src_w if src_w else 1
                        max_scale_h = target_h // src_h if src_h else 1
                        scale = max(1, min(4, max_scale_w, max_scale_h))
                        scaled = img.resize(
                            (src_w * scale, src_h * scale),
                            Image.LANCZOS,
                        )
                    buf = io.BytesIO()
                    scaled.save(buf, format='PNG', compress_level=6)
                    output_bytes = center_pad_to_target(
                        buf.getvalue(),
                        target_w=target_w,
                        target_h=target_h,
                    )

            # Persist as Design.upscaled_file
            design.upscaled_file.save(
                f'{design.id}_simulated.png',
                ContentFile(output_bytes),
                save=True,
            )

            # Create matching DesignProcessingJob in completed status
            DesignProcessingJob.objects.create(
                design=design,
                type=DesignProcessingJob.JobType.UPSCALE,
                status=DesignProcessingJob.Status.COMPLETED,
                triggered_by=triggered_by,
                replicate_prediction_id='simulated',
                completed_at=timezone.now(),
                error_message='',
            )

            # Bump quota usage (mirrors prod consume on submit) — only for non-staff.
            if triggered_by and not (triggered_by.is_staff or triggered_by.is_superuser):
                UpscaleQuotaUsage.objects.update_or_create(
                    user=triggered_by,
                    month=date.today().replace(day=1),
                    defaults={},
                )
                row = UpscaleQuotaUsage.objects.get(
                    user=triggered_by,
                    month=date.today().replace(day=1),
                )
                row.count = (row.count or 0) + 1
                row.save(update_fields=['count'])

            self.stdout.write(
                self.style.SUCCESS(
                    f'  ✓ {design.id} → {design.upscaled_file.url}',
                ),
            )
            copied += 1

        self.stdout.write('')
        self.stdout.write(
            self.style.SUCCESS(
                f'Done. Upscaled: {copied}. Skipped: {skipped}.',
            ),
        )
        self.stdout.write(
            'Reload the Artboard Canvas — the CompareArrows icon should now '
            'appear in the right panel for these designs.',
        )

    # ----------------------------------------

    @staticmethod
    def _resolve_user(design: Design, email: str | None):
        if email:
            try:
                return User.objects.get(email=email)
            except User.DoesNotExist:
                pass
        return design.workspace.owner if design.workspace else None
