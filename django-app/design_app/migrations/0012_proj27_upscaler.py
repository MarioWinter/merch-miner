# Generated manually for PROJ-27: AI Upscaler (Single + Bulk via Replicate).
#
# Adds:
#   - UpscalerSettings (singleton, admin-only)
#   - UpscaleQuotaUsage (per-user month bucket)
# Extends:
#   - DesignProcessingJob: replicate_prediction_id, batch_id, triggered_by, cloud_target

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('design_app', '0011_generation_modes_remix'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # --- DesignProcessingJob extensions ---
        migrations.AddField(
            model_name='designprocessingjob',
            name='replicate_prediction_id',
            field=models.CharField(
                blank=True,
                db_index=True,
                default='',
                help_text='Replicate prediction ID for webhook idempotency + fallback polling',
                max_length=100,
            ),
        ),
        migrations.AddField(
            model_name='designprocessingjob',
            name='batch_id',
            field=models.UUIDField(
                blank=True,
                db_index=True,
                help_text='Bulk-batch UUID grouping (null for single-mode jobs)',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='designprocessingjob',
            name='triggered_by',
            field=models.ForeignKey(
                blank=True,
                help_text='User who triggered the job (for quota refund)',
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name='triggered_processing_jobs',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='designprocessingjob',
            name='cloud_target',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='Cloud upload target (provider+folder); empty = local-only',
            ),
        ),
        # --- UpscalerSettings (singleton) ---
        migrations.CreateModel(
            name='UpscalerSettings',
            fields=[
                (
                    'id',
                    models.PositiveSmallIntegerField(
                        default=1, primary_key=True, serialize=False,
                    ),
                ),
                (
                    'replicate_model_slug',
                    models.CharField(
                        default='nightmareai/real-esrgan',
                        help_text='Replicate model slug (owner/name).',
                        max_length=200,
                    ),
                ),
                (
                    'replicate_model_version',
                    models.CharField(
                        blank=True,
                        default='',
                        help_text='Pinned version hash for reproducibility (blank = use latest).',
                        max_length=200,
                    ),
                ),
                (
                    'default_scale',
                    models.PositiveSmallIntegerField(
                        default=4, help_text='Replicate `scale` input.',
                    ),
                ),
                (
                    'target_width',
                    models.PositiveIntegerField(
                        default=4500,
                        help_text='Final canvas width after Pillow center-pad.',
                    ),
                ),
                (
                    'target_height',
                    models.PositiveIntegerField(
                        default=5400,
                        help_text='Final canvas height after Pillow center-pad.',
                    ),
                ),
                (
                    'monthly_quota_per_user',
                    models.PositiveIntegerField(
                        default=100,
                        help_text='Hard cap of successful upscales per non-staff user per month.',
                    ),
                ),
                (
                    'bulk_concurrency',
                    models.PositiveSmallIntegerField(
                        default=10,
                        help_text='Max parallel Replicate predictions per bulk batch.',
                    ),
                ),
                (
                    'staff_unlimited',
                    models.BooleanField(
                        default=True,
                        help_text='Skip quota for is_staff/is_superuser users.',
                    ),
                ),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Upscaler Settings',
                'verbose_name_plural': 'Upscaler Settings',
            },
        ),
        # --- UpscaleQuotaUsage ---
        migrations.CreateModel(
            name='UpscaleQuotaUsage',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        primary_key=True, serialize=False,
                    ),
                ),
                (
                    'month',
                    models.DateField(
                        db_index=True,
                        help_text='First day of the calendar month bucket.',
                    ),
                ),
                ('count', models.PositiveIntegerField(default=0)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'user',
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name='upscale_quota_usage',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'verbose_name': 'Upscale Quota Usage',
                'verbose_name_plural': 'Upscale Quota Usage',
                'indexes': [
                    models.Index(
                        fields=['user', 'month'],
                        name='upscale_quota_user_month_idx',
                    ),
                ],
                'unique_together': {('user', 'month')},
            },
        ),
        # --- Deprecation help_text updates on ProcessingSettings ---
        migrations.AlterField(
            model_name='processingsettings',
            name='upscale_provider',
            field=models.CharField(
                choices=[
                    ('pica', 'Pica.js (client-side)'),
                    ('api', 'External API'),
                    ('auto', 'Auto (threshold-based)'),
                ],
                default='auto',
                help_text='DEPRECATED (PROJ-27): ignored — use UpscalerSettings.',
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='processingsettings',
            name='upscale_api_key',
            field=models.CharField(
                blank=True,
                default='',
                help_text='DEPRECATED (PROJ-27): ignored — Replicate token via env var.',
                max_length=500,
            ),
        ),
        migrations.AlterField(
            model_name='processingsettings',
            name='upscale_auto_threshold',
            field=models.IntegerField(
                default=3000,
                help_text='DEPRECATED (PROJ-27): no longer used; strict 4× upscaling.',
            ),
        ),
    ]
