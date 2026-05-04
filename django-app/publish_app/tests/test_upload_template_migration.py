"""PROJ-11 Phase K1 / J4-deferred — data migration tests for
``UploadTemplate.products_config``.

Mirror of ``test_listing_translations_migration.py``: we invoke the pure
``migrate_products_config_forward`` function against an in-memory model
stub rather than replaying the full migration graph. The legacy columns
(`product_types`, `fit_types`, `print_side`, `colors`, `marketplaces`) have
already been dropped from the current `UploadTemplate` model, so we can't
seed live ORM rows with them -- the stub simulates pre-migration data.

Covers:
- AC-38: legacy flat row -> per-product expanded ``products_config`` entries.
- EC-35: migration is forward-only; per-product divergence can't be
  reconstructed on downgrade. Reverse function is a no-op -> documented.
"""

import importlib

import pytest


class _LegacyTemplateStub:
    """In-memory stand-in for a pre-K1 UploadTemplate row."""

    _saved_rows = []

    def __init__(
        self, product_types=None, fit_types=None, print_side='front',
        colors=None, marketplaces=None,
    ):
        self.product_types = product_types if product_types is not None else []
        self.fit_types = fit_types if fit_types is not None else []
        self.print_side = print_side
        self.colors = colors if colors is not None else []
        self.marketplaces = marketplaces if marketplaces is not None else []
        self.products_config = []
        self.saved_fields = None

    def save(self, update_fields=None):  # noqa: D401 (shim)
        self.saved_fields = list(update_fields) if update_fields else None
        _LegacyTemplateStub._saved_rows.append(self)


class _StubManager:
    """Implements the `.objects.all().iterator()` chain."""

    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self

    def iterator(self):
        return iter(self._rows)


class _StubModel:
    """Stand-in class with a custom `objects` attribute."""

    def __init__(self, rows):
        self.objects = _StubManager(rows)


class _StubApps:
    """Emulates the migration `apps` registry."""

    def __init__(self, rows):
        self._rows = rows

    def get_model(self, app_label, model_name):  # noqa: ARG002
        return _StubModel(self._rows)


def _load_migration():
    return importlib.import_module(
        'publish_app.migrations.0010_uploadtemplate_products_config',
    )


@pytest.fixture(autouse=True)
def _reset_saved():
    _LegacyTemplateStub._saved_rows = []


class TestUploadTemplateMigrationForward:
    def test_legacy_row_expands_to_per_product_entries(self):
        row = _LegacyTemplateStub(
            product_types=['standard_tshirt', 'hoodie'],
            fit_types=['men', 'women'],
            print_side='front',
            colors=['black', 'white'],
            marketplaces=[
                {
                    'marketplace': 'amazon.com',
                    'price': '19.99',
                    'enabled': True,
                },
            ],
        )
        mod = _load_migration()
        mod.migrate_products_config_forward(_StubApps([row]), None)

        assert len(row.products_config) == 2
        entries = {e['product_type']: e for e in row.products_config}
        assert 'standard_tshirt' in entries
        assert 'hoodie' in entries
        for entry in row.products_config:
            assert entry['enabled'] is True
            assert entry['print_side'] == 'front'
            assert entry['fit_types'] == ['men', 'women']
            assert entry['colors'] == ['black', 'white']
            assert entry['marketplaces'] == [
                {
                    'marketplace': 'amazon.com',
                    'price': '19.99',
                    'enabled': True,
                },
            ]
        # Saved with exactly the new column in update_fields.
        assert row.saved_fields == ['products_config']

    def test_empty_product_types_yields_empty_list(self):
        row = _LegacyTemplateStub(product_types=[])
        mod = _load_migration()
        mod.migrate_products_config_forward(_StubApps([row]), None)
        assert row.products_config == []
        assert row.saved_fields == ['products_config']

    def test_missing_product_types_yields_empty_list(self):
        row = _LegacyTemplateStub()
        row.product_types = None
        mod = _load_migration()
        mod.migrate_products_config_forward(_StubApps([row]), None)
        assert row.products_config == []

    def test_non_string_product_types_entries_skipped(self):
        # Defensive: only string entries produce a per-product row.
        row = _LegacyTemplateStub(
            product_types=['standard_tshirt', None, '', 42, 'hoodie'],
        )
        mod = _load_migration()
        mod.migrate_products_config_forward(_StubApps([row]), None)
        keys = [e['product_type'] for e in row.products_config]
        assert keys == ['standard_tshirt', 'hoodie']

    def test_marketplaces_deep_copied_per_entry(self):
        shared_marketplaces = [
            {'marketplace': 'amazon.com', 'price': '19.99', 'enabled': True},
        ]
        row = _LegacyTemplateStub(
            product_types=['a', 'b'],
            marketplaces=shared_marketplaces,
        )
        mod = _load_migration()
        mod.migrate_products_config_forward(_StubApps([row]), None)

        # Mutating one entry's marketplace must not affect the other.
        row.products_config[0]['marketplaces'][0]['enabled'] = False
        assert (
            row.products_config[1]['marketplaces'][0]['enabled'] is True
        )
        # Original shared list untouched too.
        assert shared_marketplaces[0]['enabled'] is True

    def test_non_dict_marketplaces_filtered_out(self):
        row = _LegacyTemplateStub(
            product_types=['a'],
            marketplaces=[
                {'marketplace': 'amazon.com', 'price': '1', 'enabled': True},
                'bogus',
                None,
            ],
        )
        mod = _load_migration()
        mod.migrate_products_config_forward(_StubApps([row]), None)
        assert row.products_config[0]['marketplaces'] == [
            {'marketplace': 'amazon.com', 'price': '1', 'enabled': True},
        ]


class TestUploadTemplateMigrationBackward:
    """EC-35: migration is forward-only; downgrade loses per-product divergence.

    The reverse function is a documented no-op on JSON data. The auto-generated
    ``RemoveField`` reversibility re-adds legacy columns empty (handled by
    Django), but per-product information can't be reconstructed from the flat
    shape, so we intentionally don't attempt it. This test asserts the
    no-op contract so the expectation can't regress silently.
    """

    def test_backward_is_noop(self):
        mod = _load_migration()
        # Any inputs -> function must not raise and must not touch data.
        result = mod.migrate_products_config_backward(None, None)
        assert result is None
