# PROJ-11 Phase R1 (2026-04-24): Listing schema extension for Global +
# Displate tab completion.
#
# Adds five new fields to ``Listing`` (AC-81 / AC-123):
#   - ``keywords``              JSONField(default=dict) -- per-language keyword
#                               chips. Global + Displate only.
#   - ``type_flags``            JSONField(default=list) -- fit-type flags.
#                               Global + Displate only.
#   - ``color_mode``            CharField(choices=black/white/colorful).
#                               Global only.
#   - ``background_color_hex``  CharField(max_length=7). Displate only.
#   - ``category``              CharField(max_length=200). MBA + Global only.
#
# All fields default empty. Every existing row is backfilled with the empty
# default via Django's AddField default= contract (no explicit RunPython
# needed -- JSONField(default=dict/list) + CharField(default='') handle it).
#
# Per-field marketplace gates live in the serializer layer
# (publish_app.api.serializers.ListingUpdateSerializer.validate_<field>) per
# AC-82 -- model-level clean() is intentionally NOT used so Django admin
# stays unconstrained for ops-debug workflows.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('publish_app', '0012_seed_listing_improve_node_config'),
    ]

    operations = [
        migrations.AddField(
            model_name='listing',
            name='background_color_hex',
            field=models.CharField(blank=True, default='', help_text='Displate background color. Must match ^#[0-9A-Fa-f]{6}$ when non-empty. Displate-only (AC-123).', max_length=7),
        ),
        migrations.AddField(
            model_name='listing',
            name='category',
            field=models.CharField(blank=True, default='', help_text='Listing category, set via Advanced Options modal. MBA + Global only -- rejected on Displate (AC-81 / AC-82).', max_length=200),
        ),
        migrations.AddField(
            model_name='listing',
            name='color_mode',
            field=models.CharField(blank=True, choices=[('black', 'Black'), ('white', 'White'), ('colorful', 'Colorful')], default='', help_text='Design color mode for Basic export Color column. Global-only (AC-81 / AC-82).', max_length=10),
        ),
        migrations.AddField(
            model_name='listing',
            name='keywords',
            field=models.JSONField(blank=True, default=dict, help_text='Per-language keyword chips for Global/Displate listings. Shape: {lang: [keyword, ...]} where lang in {en, de, fr, it, es, ja}. Rejected on marketplace_type=mba via serializer gate (AC-82).'),
        ),
        migrations.AddField(
            model_name='listing',
            name='type_flags',
            field=models.JSONField(blank=True, default=list, help_text='List of fit-type flags from [men, women, youth]. Used by the Basic export Type column. Global/Displate only (AC-81).'),
        ),
    ]
