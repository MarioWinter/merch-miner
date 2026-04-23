# PROJ-11 Phase I1 (2026-04-22): Listing model shrink + rename.
#
# - Drop bullet_3, bullet_4, bullet_5 (AC-1: 5 bullets -> 2).
# - Rename backend_keywords -> keyword_context (RenameField preserves data).
# - Update translations JSONField help_text to new shape (no schema change).
#
# Data migration for the `translations` JSON shape lives in the follow-up
# migration 0008_listing_translations_shape so we keep schema changes and
# data changes in separate, rollback-friendly migrations.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('publish_app', '0006_uploadtemplate_is_default_and_more'),
    ]

    operations = [
        # Rename first so data in `backend_keywords` is preserved.
        migrations.RenameField(
            model_name='listing',
            old_name='backend_keywords',
            new_name='keyword_context',
        ),
        migrations.AlterField(
            model_name='listing',
            name='keyword_context',
            field=models.CharField(
                blank=True,
                default='',
                max_length=500,
            ),
        ),
        # Drop the three unused bullets. Forward-only -- any data in these
        # columns is discarded (AC-1 says 5 -> 2; the extra content is
        # expected to be lost or previously consolidated into bullet_1/2
        # by frontend migration).
        migrations.RemoveField(
            model_name='listing',
            name='bullet_3',
        ),
        migrations.RemoveField(
            model_name='listing',
            name='bullet_4',
        ),
        migrations.RemoveField(
            model_name='listing',
            name='bullet_5',
        ),
        # Refresh translations help_text to the new documented shape.
        migrations.AlterField(
            model_name='listing',
            name='translations',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text=(
                    'Per-language translations: '
                    '{lang: {title, bullet_1, bullet_2, description}}'
                ),
            ),
        ),
    ]
