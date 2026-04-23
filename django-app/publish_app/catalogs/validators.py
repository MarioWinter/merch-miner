"""Catalog-referential validation helpers (PROJ-11 Phase L3, AC-37 + AC-38).

Thin lookup helpers over ``MBA_PRODUCT_CATALOG``. Used by
``DesignProductConfigSerializer`` and ``UploadTemplateSerializer`` to enforce:

- ``product_type`` is a known catalog key
- ``fit_types`` ⊆ catalog entry's ``fit_types_options``
- ``colors``    ⊆ catalog entry's ``colors_options`` (by key)
- ``print_side`` ∈ catalog entry's ``print_side_options``
- ``marketplaces[*].marketplace`` ⊆ catalog entry's ``marketplaces``

Catalog lookup is an in-memory dict — no DB round-trip. Safe to call in tight
loops inside serializers.
"""

from typing import Any

from publish_app.catalogs.mba_catalog import MBA_PRODUCT_CATALOG

# Index the catalog by ``key`` at import time. Cheap + idempotent.
_CATALOG_BY_KEY: dict[str, dict[str, Any]] = {
    entry['key']: entry for entry in MBA_PRODUCT_CATALOG
}

CATALOG_KEYS: frozenset[str] = frozenset(_CATALOG_BY_KEY.keys())


def get_product(key: str) -> dict[str, Any] | None:
    """Return catalog entry for ``key`` or ``None`` if unknown.

    Raises no exception so callers can compose catalog checks with custom
    error messages (serializers prefer ``ValidationError`` over bare
    ``KeyError``).
    """
    return _CATALOG_BY_KEY.get(key)


def valid_color_keys(product_key: str) -> frozenset[str]:
    """Allowed color ``key`` values for ``product_key``.

    Returns an empty frozenset for unknown product keys — callers should gate
    on ``get_product`` first if they need to distinguish "unknown product"
    from "no colors configured".
    """
    entry = _CATALOG_BY_KEY.get(product_key)
    if not entry:
        return frozenset()
    return frozenset(c['key'] for c in entry.get('colors_options', ()))


def valid_fit_types(product_key: str) -> frozenset[str]:
    """Allowed ``fit_types`` for ``product_key`` (empty when product has none)."""
    entry = _CATALOG_BY_KEY.get(product_key)
    if not entry:
        return frozenset()
    return frozenset(entry.get('fit_types_options', ()))


def valid_print_sides(product_key: str) -> frozenset[str]:
    """Allowed ``print_side`` values for ``product_key``."""
    entry = _CATALOG_BY_KEY.get(product_key)
    if not entry:
        return frozenset()
    return frozenset(entry.get('print_side_options', ()))


def valid_marketplaces(product_key: str) -> frozenset[str]:
    """Allowed marketplace identifiers for ``product_key``."""
    entry = _CATALOG_BY_KEY.get(product_key)
    if not entry:
        return frozenset()
    return frozenset(entry.get('marketplaces', ()))
