# PROJ-11 Phase K1 (2026-04-23): UploadTemplate shape alignment.
#
# Collapse legacy flat fields (`product_types`, `fit_types`, `print_side`,
# `colors`, `marketplaces`) on ``UploadTemplate`` into a single per-product
# JSON list (`products_config`) — same shape as
# ``DesignProductConfig.products_config``. Lets the Convert auto-apply path
# (AC-57) copy ``default_template.products_config`` directly into the new
# ``DesignProductConfig`` row without fan-out (K3).
#
# Forward migration steps:
#   1. Add `products_config` JSONField (default=list).
#   2. Data migration: for each existing row, for every `product_type` in
#      the legacy `product_types[]`, emit one `products_config` entry
#      copying the shared legacy `fit_types` / `print_side` / `colors` /
#      `marketplaces` values. Rows with legacy `product_types=[]` get
#      `products_config=[]`.
#   3. Drop the legacy columns.
#
# Forward-only: per-product divergence cannot be reconstructed from the flat
# shape, so the RunPython reverse() is a no-op on the JSON data. The
# column-level reverse (re-adding legacy fields empty) is handled by
# Django's auto-generated RemoveField reversibility. See EC-35.

from django.db import migrations, models


def migrate_products_config_forward(apps, schema_editor):
    """Expand legacy flat fields into `products_config` entries."""
    UploadTemplate = apps.get_model('publish_app', 'UploadTemplate')

    for tpl in UploadTemplate.objects.all().iterator():
        legacy_product_types = tpl.product_types or []
        shared_fit_types = tpl.fit_types or []
        shared_print_side = tpl.print_side or 'front'
        shared_colors = tpl.colors or []
        shared_marketplaces = tpl.marketplaces or []

        if not isinstance(legacy_product_types, list) or not legacy_product_types:
            # Nothing to migrate -- emit empty list.
            tpl.products_config = []
            tpl.save(update_fields=['products_config'])
            continue

        expanded = []
        for product_type in legacy_product_types:
            if not isinstance(product_type, str) or not product_type:
                continue
            expanded.append(
                {
                    'product_type': product_type,
                    'enabled': True,
                    'fit_types': list(shared_fit_types),
                    'print_side': shared_print_side,
                    'colors': list(shared_colors),
                    # Deep copy marketplaces so each entry is independent.
                    'marketplaces': [
                        dict(m) for m in shared_marketplaces
                        if isinstance(m, dict)
                    ],
                }
            )

        tpl.products_config = expanded
        tpl.save(update_fields=['products_config'])


def migrate_products_config_backward(apps, schema_editor):
    """Forward-only: per-product divergence is lost on downgrade (EC-35)."""
    return


class Migration(migrations.Migration):

    dependencies = [
        ('publish_app', '0009_designproductconfig_products_config'),
    ]

    operations = [
        # 1. Add the new column first so the data migration can populate it.
        migrations.AddField(
            model_name='uploadtemplate',
            name='products_config',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text=(
                    'Per-product configuration list. Each entry: '
                    '{product_type, enabled, fit_types, print_side, '
                    'colors, marketplaces[]}. Same shape as '
                    'DesignProductConfig.products_config (AC-38 / AC-57).'
                ),
            ),
        ),
        # 2. Collapse legacy flat fields into the new list.
        migrations.RunPython(
            migrate_products_config_forward,
            migrate_products_config_backward,
        ),
        # 3. Drop the legacy columns.
        migrations.RemoveField(
            model_name='uploadtemplate',
            name='colors',
        ),
        migrations.RemoveField(
            model_name='uploadtemplate',
            name='fit_types',
        ),
        migrations.RemoveField(
            model_name='uploadtemplate',
            name='marketplaces',
        ),
        migrations.RemoveField(
            model_name='uploadtemplate',
            name='print_side',
        ),
        migrations.RemoveField(
            model_name='uploadtemplate',
            name='product_types',
        ),
    ]
