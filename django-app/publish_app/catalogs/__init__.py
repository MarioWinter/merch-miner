"""Static reference catalogs for publish_app (PROJ-11 Phase L, AC-37).

Exports the canonical MBA product catalog and the helper utilities used by
serializers to perform catalog-referential validation on
``DesignProductConfig.products_config`` + ``UploadTemplate.products_config``.
"""

from publish_app.catalogs.mba_catalog import MBA_PRODUCT_CATALOG
from publish_app.catalogs.validators import (
    CATALOG_KEYS,
    get_product,
    valid_color_keys,
    valid_fit_types,
    valid_marketplaces,
    valid_print_sides,
)

__all__ = [
    'CATALOG_KEYS',
    'MBA_PRODUCT_CATALOG',
    'get_product',
    'valid_color_keys',
    'valid_fit_types',
    'valid_marketplaces',
    'valid_print_sides',
]
