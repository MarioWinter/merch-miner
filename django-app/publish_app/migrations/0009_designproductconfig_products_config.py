# PROJ-11 Phase J1 (2026-04-23): DesignProductConfig restructure.
#
# Collapse legacy flat fields (`product_types`, `fit_types`, `print_side`,
# `colors`, `marketplaces`) into a single per-product JSON list
# (`products_config`). See AC-38 + EC-35.
#
# Forward migration steps:
#   1. Add `products_config` JSONField (default=list).
#   2. Data migration: for each existing row, for every `product_type` in the
#      legacy `product_types[]`, emit one `products_config` entry copying the
#      shared legacy `fit_types` / `print_side` / `colors` / `marketplaces`
#      values. Rows with legacy `product_types=[]` get `products_config=[]`.
#   3. Drop the legacy columns.
#
# Forward-only: per-product divergence cannot be reconstructed from the flat
# shape, so reverse() is a no-op on the JSON data. The column-level reverse
# (re-adding legacy fields empty) is handled by Django's auto-generated
# RemoveField reversibility.

from django.db import migrations, models


def migrate_products_config_forward(apps, schema_editor):
    """Expand legacy flat fields into `products_config` entries."""
    DesignProductConfig = apps.get_model('publish_app', 'DesignProductConfig')

    for cfg in DesignProductConfig.objects.all().iterator():
        legacy_product_types = cfg.product_types or []
        shared_fit_types = cfg.fit_types or []
        shared_print_side = cfg.print_side or 'front'
        shared_colors = cfg.colors or []
        shared_marketplaces = cfg.marketplaces or []

        if not isinstance(legacy_product_types, list) or not legacy_product_types:
            # Nothing to migrate -- emit empty list.
            cfg.products_config = []
            cfg.save(update_fields=['products_config'])
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

        cfg.products_config = expanded
        cfg.save(update_fields=['products_config'])


def migrate_products_config_backward(apps, schema_editor):
    """Forward-only: per-product divergence is lost on downgrade."""
    return


class Migration(migrations.Migration):

    dependencies = [
        ('publish_app', '0008_listing_translations_shape'),
    ]

    operations = [
        # 1. Add the new column first so the data migration can populate it.
        migrations.AddField(
            model_name='designproductconfig',
            name='products_config',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text=(
                    'Per-product configuration list. Each entry: '
                    '{product_type, enabled, fit_types, print_side, '
                    'colors, marketplaces[]}. See AC-38.'
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
            model_name='designproductconfig',
            name='colors',
        ),
        migrations.RemoveField(
            model_name='designproductconfig',
            name='fit_types',
        ),
        migrations.RemoveField(
            model_name='designproductconfig',
            name='marketplaces',
        ),
        migrations.RemoveField(
            model_name='designproductconfig',
            name='print_side',
        ),
        migrations.RemoveField(
            model_name='designproductconfig',
            name='product_types',
        ),
    ]
