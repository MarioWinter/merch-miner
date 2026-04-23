"""Tests for MBA Product Catalog API + validator helpers (PROJ-11 Phase L4, AC-37).

Covers:
1. ``GET /api/mba/product-catalog/`` returns all 17 catalog entries.
2. Response carries ``Cache-Control: public, max-age=86400`` (24h).
3. Auth required — unauthenticated request returns 401.
4. Shape assertion: every entry has the 10 required top-level keys.
5. Validator helpers: unknown product key → ``get_product`` returns ``None``
   and every ``valid_*`` helper returns an empty frozenset.
6. Contract test: every catalog ``icon_key`` is present in the frontend
   ``PRODUCT_ICON_MAP`` fixture (``fixtures/product_icon_map_keys.json``) —
   locks the backend <-> frontend contract before N1 ships.
"""

import json
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from publish_app.catalogs.mba_catalog import MBA_PRODUCT_CATALOG
from publish_app.catalogs.validators import (
    CATALOG_KEYS,
    get_product,
    valid_color_keys,
    valid_fit_types,
    valid_marketplaces,
    valid_print_sides,
)

User = get_user_model()

REQUIRED_ENTRY_KEYS: frozenset[str] = frozenset(
    {
        'key',
        'label',
        'icon_key',
        'supports',
        'fit_types_options',
        'print_side_options',
        'colors_options',
        'marketplaces',
        'default_prices',
        'royalty_formula',
    },
)

ICON_MAP_FIXTURE = (
    Path(__file__).parent / 'fixtures' / 'product_icon_map_keys.json'
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email='catalog@example.com', password='testpass123',
    )


@pytest.fixture
def api_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


# ---------------------------------------------------------------------------
# 1. Endpoint returns 17 entries
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_product_catalog_returns_17_entries(api_client):
    url = reverse('mba-product-catalog')
    response = api_client.get(url)

    assert response.status_code == 200
    data = response.data
    assert isinstance(data, list)
    assert len(data) == 17, (
        f'Expected 17 catalog entries, got {len(data)}'
    )

    # Keys must be unique across the catalog.
    keys = [entry['key'] for entry in data]
    assert len(keys) == len(set(keys)), 'Catalog keys must be unique'


# ---------------------------------------------------------------------------
# 2. Cache-Control header present (24h)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_product_catalog_sets_cache_control_header(api_client):
    url = reverse('mba-product-catalog')
    response = api_client.get(url)

    assert response.status_code == 200
    cache_control = response.headers.get('Cache-Control', '')
    assert 'public' in cache_control, (
        f'Expected "public" in Cache-Control, got {cache_control!r}'
    )
    assert 'max-age=86400' in cache_control, (
        f'Expected "max-age=86400" in Cache-Control, got {cache_control!r}'
    )


# ---------------------------------------------------------------------------
# 3. Auth required
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_product_catalog_requires_authentication():
    client = APIClient()
    url = reverse('mba-product-catalog')
    response = client.get(url)
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# 4. Shape assertion — every entry has the required keys
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_product_catalog_entries_have_required_shape(api_client):
    url = reverse('mba-product-catalog')
    response = api_client.get(url)

    assert response.status_code == 200
    data = response.data

    for entry in data:
        assert isinstance(entry, dict), f'Entry not a dict: {entry!r}'
        missing = REQUIRED_ENTRY_KEYS - set(entry.keys())
        assert not missing, (
            f'Entry {entry.get("key")!r} missing keys: {sorted(missing)}'
        )

        # Spot-check the value types so downstream consumers can rely on them.
        assert isinstance(entry['key'], str) and entry['key']
        assert isinstance(entry['label'], str) and entry['label']
        assert isinstance(entry['icon_key'], str) and entry['icon_key']
        assert isinstance(entry['supports'], list)
        assert isinstance(entry['fit_types_options'], list)
        assert isinstance(entry['print_side_options'], list)
        assert isinstance(entry['colors_options'], list)
        assert isinstance(entry['marketplaces'], list)
        assert isinstance(entry['default_prices'], dict)
        assert isinstance(entry['royalty_formula'], dict)

        # Every color option has {key, name, hex}.
        for color in entry['colors_options']:
            assert set(color.keys()) >= {'key', 'name', 'hex'}

        # Every royalty entry has {coef, base}.
        for mp, royalty in entry['royalty_formula'].items():
            assert mp in entry['marketplaces'], (
                f'royalty_formula marketplace {mp!r} missing from '
                f'entry {entry["key"]!r} marketplaces'
            )
            assert set(royalty.keys()) == {'coef', 'base'}


# ---------------------------------------------------------------------------
# 5. Validator helpers — unknown product key
# ---------------------------------------------------------------------------


def test_get_product_returns_none_for_unknown_key():
    assert get_product('not_a_product') is None


def test_valid_helpers_return_empty_frozenset_for_unknown_key():
    unknown = 'not_a_product'

    result_colors = valid_color_keys(unknown)
    result_fits = valid_fit_types(unknown)
    result_sides = valid_print_sides(unknown)
    result_marketplaces = valid_marketplaces(unknown)

    for name, result in (
        ('valid_color_keys', result_colors),
        ('valid_fit_types', result_fits),
        ('valid_print_sides', result_sides),
        ('valid_marketplaces', result_marketplaces),
    ):
        assert isinstance(result, frozenset), (
            f'{name} must return a frozenset, got {type(result).__name__}'
        )
        assert result == frozenset(), (
            f'{name}({unknown!r}) must be empty, got {result}'
        )


def test_get_product_returns_entry_for_known_key():
    entry = get_product('t_shirt')
    assert entry is not None
    assert entry['key'] == 't_shirt'


def test_catalog_keys_matches_catalog():
    assert CATALOG_KEYS == frozenset(
        entry['key'] for entry in MBA_PRODUCT_CATALOG
    )


# ---------------------------------------------------------------------------
# 6. Contract test — icon_key keys match frontend PRODUCT_ICON_MAP
# ---------------------------------------------------------------------------


def _load_icon_map_fixture() -> list[str]:
    """Load the agreed-upon icon_key list shared with frontend N1.

    Fixture lives under ``publish_app/tests/fixtures/``. If the frontend
    ``PRODUCT_ICON_MAP`` ever diverges, update the fixture + that map in the
    same PR.
    """
    with ICON_MAP_FIXTURE.open('r', encoding='utf-8') as fh:
        payload = json.load(fh)
    keys = payload.get('keys', [])
    assert isinstance(keys, list) and keys, (
        'product_icon_map_keys.json must expose a non-empty "keys" list'
    )
    return keys


def test_catalog_icon_keys_match_frontend_product_icon_map_fixture():
    expected_keys = set(_load_icon_map_fixture())
    catalog_icon_keys = {entry['icon_key'] for entry in MBA_PRODUCT_CATALOG}

    missing_in_fixture = catalog_icon_keys - expected_keys
    extra_in_fixture = expected_keys - catalog_icon_keys

    assert not missing_in_fixture, (
        f'Catalog icon_keys missing from frontend PRODUCT_ICON_MAP fixture: '
        f'{sorted(missing_in_fixture)}'
    )
    assert not extra_in_fixture, (
        f'Frontend PRODUCT_ICON_MAP fixture has keys not present in catalog: '
        f'{sorted(extra_in_fixture)}'
    )
