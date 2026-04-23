"""Canonical Amazon Merch by Amazon (MBA) product catalog (AC-37).

Single Python tuple exporting ``MBA_PRODUCT_CATALOG``. Rarely changes; updates
ship as a code deploy. Served read-only by ``GET /api/mba/product-catalog/``
(24h ``Cache-Control``) and consumed by the Edit Page + Desktop Upload App.

Shape (per AC-37 / spec table in PROJ-11):

    {
      "key": str,                      # stable product id
      "label": str,                    # EN display name (i18n client-side)
      "icon_key": str,                 # frontend PRODUCT_ICON_MAP key (AC-78)
      "supports": list[str],           # which control sections render
      "fit_types_options": list[str],  # allowed fit_types per product
      "print_side_options": list[str], # allowed print_side per product
      "colors_options": list[dict],    # per-product color palette
      "marketplaces": list[str],       # Amazon marketplaces shipping it
      "default_prices": dict[str,num], # default retail price per marketplace
      "royalty_formula": dict[str,{coef,base}],  # price*coef - base
    }

Sources:
- Amazon MBA published royalty rates:
  https://merch.amazon.com/resource/201858630 (Standard T-Shirt royalty table)
- Amazon MBA supported garments:
  https://merch.amazon.com/resource/201858620 (product catalog page)

Prices / royalty values below are the published public defaults; they are
overridable per-design via ``DesignProductConfig.products_config[*].marketplaces``.
"""

from publish_app.constants import MBA_COLORS

# ---------------------------------------------------------------------------
# Palette subsets used across catalog entries. MBA_COLORS is the full MBA
# shirt-class palette. Accessories expose narrower palettes.
# ---------------------------------------------------------------------------

_SHIRT_COLORS = tuple(MBA_COLORS)

_POPSOCKET_COLORS: tuple[dict[str, str], ...] = (
    {'key': 'white', 'name': 'White', 'hex': '#FFFFFF'},
    {'key': 'black', 'name': 'Black', 'hex': '#000000'},
)

_PHONE_CASE_COLORS: tuple[dict[str, str], ...] = (
    {'key': 'white', 'name': 'White', 'hex': '#FFFFFF'},
    {'key': 'black', 'name': 'Black', 'hex': '#000000'},
    {'key': 'clear', 'name': 'Clear', 'hex': '#E6E6E6'},
)

_HAT_COLORS: tuple[dict[str, str], ...] = (
    {'key': 'black', 'name': 'Black', 'hex': '#000000'},
    {'key': 'white', 'name': 'White', 'hex': '#FFFFFF'},
    {'key': 'navy', 'name': 'Navy', 'hex': '#0E1E3A'},
    {'key': 'heather_grey', 'name': 'Heather Grey', 'hex': '#9A9A9A'},
)

_BOTTLE_COLORS: tuple[dict[str, str], ...] = (
    {'key': 'white', 'name': 'White', 'hex': '#FFFFFF'},
    {'key': 'silver', 'name': 'Silver', 'hex': '#C8CBCE'},
)

_MUG_COLORS: tuple[dict[str, str], ...] = (
    {'key': 'white', 'name': 'White', 'hex': '#FFFFFF'},
)

# ---------------------------------------------------------------------------
# Marketplace tiers.
# ---------------------------------------------------------------------------

_AMZ_ALL = (
    'amazon.com',
    'amazon.co.uk',
    'amazon.de',
    'amazon.fr',
    'amazon.it',
    'amazon.es',
    'amazon.co.jp',
)
_AMZ_US_EU = (
    'amazon.com',
    'amazon.co.uk',
    'amazon.de',
    'amazon.fr',
    'amazon.it',
    'amazon.es',
)
_AMZ_US_ONLY = ('amazon.com',)
_AMZ_US_UK_DE = ('amazon.com', 'amazon.co.uk', 'amazon.de')

# ---------------------------------------------------------------------------
# Fit type presets. Empty list => product does not expose fit_types.
# ---------------------------------------------------------------------------

_SHIRT_FIT_TYPES = ('men', 'women', 'youth', 'girls', 'adult_unisex')
_NO_FIT = ()

# ---------------------------------------------------------------------------
# Helper factories
# ---------------------------------------------------------------------------


def _royalty(coef: float, base: float) -> dict[str, float]:
    return {'coef': coef, 'base': base}


def _prices_uniform(marketplaces: tuple[str, ...], price: float) -> dict[str, float]:
    return {mp: price for mp in marketplaces}


def _royalty_uniform(
    marketplaces: tuple[str, ...], coef: float, base: float,
) -> dict[str, dict[str, float]]:
    return {mp: _royalty(coef, base) for mp in marketplaces}


# ---------------------------------------------------------------------------
# Catalog (17 entries covering shirt + hat + accessory classes)
# ---------------------------------------------------------------------------

MBA_PRODUCT_CATALOG: tuple[dict, ...] = (
    {
        'key': 't_shirt',
        'label': 'Standard T-Shirt',
        'icon_key': 't_shirt',
        'supports': ['fit_types', 'print_side', 'colors'],
        'fit_types_options': list(_SHIRT_FIT_TYPES),
        'print_side_options': ['front', 'back', 'both'],
        'colors_options': [dict(c) for c in _SHIRT_COLORS],
        'marketplaces': list(_AMZ_ALL),
        'default_prices': {
            'amazon.com': 19.99,
            'amazon.co.uk': 19.99,
            'amazon.de': 18.99,
            'amazon.fr': 18.99,
            'amazon.it': 18.99,
            'amazon.es': 18.99,
            'amazon.co.jp': 2580,
        },
        'royalty_formula': {
            'amazon.com': _royalty(0.4, 5.04),
            'amazon.co.uk': _royalty(0.4, 5.80),
            'amazon.de': _royalty(0.4, 5.34),
            'amazon.fr': _royalty(0.4, 5.34),
            'amazon.it': _royalty(0.4, 5.34),
            'amazon.es': _royalty(0.4, 5.34),
            'amazon.co.jp': _royalty(0.4, 756),
        },
    },
    {
        'key': 't_shirt_premium',
        'label': 'Premium T-Shirt',
        'icon_key': 't_shirt_premium',
        'supports': ['fit_types', 'print_side', 'colors'],
        'fit_types_options': list(_SHIRT_FIT_TYPES),
        'print_side_options': ['front', 'back', 'both'],
        'colors_options': [dict(c) for c in _SHIRT_COLORS],
        'marketplaces': list(_AMZ_US_EU),
        'default_prices': _prices_uniform(_AMZ_US_EU, 22.99),
        'royalty_formula': _royalty_uniform(_AMZ_US_EU, 0.4, 6.54),
    },
    {
        'key': 't_shirt_heavyweight',
        'label': 'Heavyweight T-Shirt',
        'icon_key': 't_shirt_heavyweight',
        'supports': ['fit_types', 'print_side', 'colors'],
        'fit_types_options': list(_SHIRT_FIT_TYPES),
        'print_side_options': ['front', 'back', 'both'],
        'colors_options': [dict(c) for c in _SHIRT_COLORS],
        'marketplaces': list(_AMZ_US_EU),
        'default_prices': _prices_uniform(_AMZ_US_EU, 24.99),
        'royalty_formula': _royalty_uniform(_AMZ_US_EU, 0.4, 7.38),
    },
    {
        'key': 'v_neck',
        'label': 'V-Neck T-Shirt',
        'icon_key': 'v_neck',
        'supports': ['fit_types', 'print_side', 'colors'],
        'fit_types_options': ['men', 'women'],
        'print_side_options': ['front', 'back', 'both'],
        'colors_options': [dict(c) for c in _SHIRT_COLORS],
        'marketplaces': list(_AMZ_US_EU),
        'default_prices': _prices_uniform(_AMZ_US_EU, 21.99),
        'royalty_formula': _royalty_uniform(_AMZ_US_EU, 0.4, 6.14),
    },
    {
        'key': 'tank_top',
        'label': 'Tank Top',
        'icon_key': 'tank_top',
        'supports': ['fit_types', 'print_side', 'colors'],
        'fit_types_options': ['men', 'women'],
        'print_side_options': ['front', 'back', 'both'],
        'colors_options': [dict(c) for c in _SHIRT_COLORS],
        'marketplaces': list(_AMZ_US_EU),
        'default_prices': _prices_uniform(_AMZ_US_EU, 21.99),
        'royalty_formula': _royalty_uniform(_AMZ_US_EU, 0.4, 6.25),
    },
    {
        'key': 'long_sleeve',
        'label': 'Long Sleeve T-Shirt',
        'icon_key': 'long_sleeve',
        'supports': ['fit_types', 'print_side', 'colors'],
        'fit_types_options': ['men', 'women', 'adult_unisex'],
        'print_side_options': ['front', 'back', 'both'],
        'colors_options': [dict(c) for c in _SHIRT_COLORS],
        'marketplaces': list(_AMZ_US_EU),
        'default_prices': _prices_uniform(_AMZ_US_EU, 24.99),
        'royalty_formula': _royalty_uniform(_AMZ_US_EU, 0.4, 7.35),
    },
    {
        'key': 'raglan',
        'label': 'Raglan Baseball Tee',
        'icon_key': 'raglan',
        'supports': ['fit_types', 'print_side', 'colors'],
        'fit_types_options': ['men', 'women'],
        'print_side_options': ['front', 'back', 'both'],
        'colors_options': [dict(c) for c in _SHIRT_COLORS],
        'marketplaces': list(_AMZ_US_EU),
        'default_prices': _prices_uniform(_AMZ_US_EU, 22.99),
        'royalty_formula': _royalty_uniform(_AMZ_US_EU, 0.4, 6.61),
    },
    {
        'key': 'sweatshirt',
        'label': 'Sweatshirt',
        'icon_key': 'sweatshirt',
        'supports': ['fit_types', 'print_side', 'colors'],
        'fit_types_options': ['men', 'women', 'adult_unisex'],
        'print_side_options': ['front', 'back', 'both'],
        'colors_options': [dict(c) for c in _SHIRT_COLORS],
        'marketplaces': list(_AMZ_US_EU),
        'default_prices': _prices_uniform(_AMZ_US_EU, 27.99),
        'royalty_formula': _royalty_uniform(_AMZ_US_EU, 0.4, 10.29),
    },
    {
        'key': 'hoodie_pullover',
        'label': 'Pullover Hoodie',
        'icon_key': 'hoodie_pullover',
        'supports': ['fit_types', 'print_side', 'colors'],
        'fit_types_options': ['men', 'women', 'adult_unisex'],
        'print_side_options': ['front', 'back', 'both'],
        'colors_options': [dict(c) for c in _SHIRT_COLORS],
        'marketplaces': list(_AMZ_US_EU),
        'default_prices': _prices_uniform(_AMZ_US_EU, 34.99),
        'royalty_formula': _royalty_uniform(_AMZ_US_EU, 0.4, 13.64),
    },
    {
        'key': 'hoodie_zip',
        'label': 'Zip Hoodie',
        'icon_key': 'hoodie_zip',
        'supports': ['fit_types', 'print_side', 'colors'],
        'fit_types_options': ['men', 'women', 'adult_unisex'],
        'print_side_options': ['front', 'back', 'both'],
        'colors_options': [dict(c) for c in _SHIRT_COLORS],
        'marketplaces': list(_AMZ_US_EU),
        'default_prices': _prices_uniform(_AMZ_US_EU, 39.99),
        'royalty_formula': _royalty_uniform(_AMZ_US_EU, 0.4, 15.76),
    },
    {
        'key': 'performance',
        'label': 'Performance T-Shirt',
        'icon_key': 'performance',
        'supports': ['fit_types', 'print_side', 'colors'],
        'fit_types_options': ['men', 'women'],
        'print_side_options': ['front', 'back'],
        'colors_options': [dict(c) for c in _SHIRT_COLORS],
        'marketplaces': list(_AMZ_US_ONLY),
        'default_prices': _prices_uniform(_AMZ_US_ONLY, 25.99),
        'royalty_formula': _royalty_uniform(_AMZ_US_ONLY, 0.4, 8.24),
    },
    {
        'key': 'baseball',
        'label': 'Baseball T-Shirt',
        'icon_key': 'baseball',
        'supports': ['fit_types', 'print_side', 'colors'],
        'fit_types_options': ['men', 'women'],
        'print_side_options': ['front', 'back'],
        'colors_options': [dict(c) for c in _SHIRT_COLORS],
        'marketplaces': list(_AMZ_US_ONLY),
        'default_prices': _prices_uniform(_AMZ_US_ONLY, 22.99),
        'royalty_formula': _royalty_uniform(_AMZ_US_ONLY, 0.4, 6.61),
    },
    {
        'key': 'trucker_hat',
        'label': 'Trucker Hat',
        'icon_key': 'trucker_hat',
        'supports': ['colors'],
        'fit_types_options': list(_NO_FIT),
        'print_side_options': ['front'],
        'colors_options': [dict(c) for c in _HAT_COLORS],
        'marketplaces': list(_AMZ_US_ONLY),
        'default_prices': _prices_uniform(_AMZ_US_ONLY, 19.99),
        'royalty_formula': _royalty_uniform(_AMZ_US_ONLY, 0.4, 6.80),
    },
    {
        'key': 'popsocket',
        'label': 'PopSocket',
        'icon_key': 'popsocket',
        'supports': ['colors'],
        'fit_types_options': list(_NO_FIT),
        'print_side_options': ['front'],
        'colors_options': [dict(c) for c in _POPSOCKET_COLORS],
        'marketplaces': list(_AMZ_US_ONLY),
        'default_prices': _prices_uniform(_AMZ_US_ONLY, 14.99),
        'royalty_formula': _royalty_uniform(_AMZ_US_ONLY, 0.4, 5.25),
    },
    {
        'key': 'phone_case',
        'label': 'Phone Case',
        'icon_key': 'phone_case',
        'supports': ['colors'],
        'fit_types_options': list(_NO_FIT),
        'print_side_options': ['front'],
        'colors_options': [dict(c) for c in _PHONE_CASE_COLORS],
        'marketplaces': list(_AMZ_US_ONLY),
        'default_prices': _prices_uniform(_AMZ_US_ONLY, 16.99),
        'royalty_formula': _royalty_uniform(_AMZ_US_ONLY, 0.4, 5.74),
    },
    {
        'key': 'throw_pillow',
        'label': 'Throw Pillow',
        'icon_key': 'throw_pillow',
        'supports': ['print_side', 'colors'],
        'fit_types_options': list(_NO_FIT),
        'print_side_options': ['front', 'back', 'both'],
        'colors_options': [dict(c) for c in _MUG_COLORS],
        'marketplaces': list(_AMZ_US_ONLY),
        'default_prices': _prices_uniform(_AMZ_US_ONLY, 19.99),
        'royalty_formula': _royalty_uniform(_AMZ_US_ONLY, 0.4, 6.95),
    },
    {
        'key': 'tote_bag',
        'label': 'Tote Bag',
        'icon_key': 'tote_bag',
        'supports': ['print_side', 'colors'],
        'fit_types_options': list(_NO_FIT),
        'print_side_options': ['front', 'back'],
        'colors_options': [
            {'key': 'natural', 'name': 'Natural', 'hex': '#D9C9A4'},
            {'key': 'black', 'name': 'Black', 'hex': '#000000'},
        ],
        'marketplaces': list(_AMZ_US_UK_DE),
        'default_prices': _prices_uniform(_AMZ_US_UK_DE, 17.99),
        'royalty_formula': _royalty_uniform(_AMZ_US_UK_DE, 0.4, 6.12),
    },
)

# Freeze catalog shape with an assertion at import time. Cheap guardrail so a
# malformed edit raises early during Django startup instead of at request time.
assert len(MBA_PRODUCT_CATALOG) == 17, (
    f'MBA_PRODUCT_CATALOG must hold 17 entries (got {len(MBA_PRODUCT_CATALOG)}).'
)
_required_keys = {
    'key', 'label', 'icon_key', 'supports', 'fit_types_options',
    'print_side_options', 'colors_options', 'marketplaces',
    'default_prices', 'royalty_formula',
}
for _entry in MBA_PRODUCT_CATALOG:
    _missing = _required_keys - set(_entry.keys())
    assert not _missing, (
        f'MBA_PRODUCT_CATALOG entry {_entry.get("key")!r} missing keys: '
        f'{sorted(_missing)}'
    )
del _entry, _missing, _required_keys
