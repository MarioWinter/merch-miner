"""FlyingUpload constant maps (PROJ-11 Phase S).

PINNED VERSION: FlyingUpload "Excel Standard v2.3" (2023-11-07).
Any schema upgrade to v2.4+ must: (1) replace the stub files + headers,
(2) header-diff review, (3) re-map columns, (4) ship a minor PR
(see AC-120).

Maps live here so the export service and tests share a single source of
truth.
"""

# ---------------------------------------------------------------------------
# Language map -- our ISO-639-1 codes -> FlyingUpload column suffix.
# AC-93: our `ja` -> Excel `JP`.
# ---------------------------------------------------------------------------

LANG_MAP: dict[str, str] = {
    'de': 'DE',
    'fr': 'FR',
    'it': 'IT',
    'es': 'ES',
    'ja': 'JP',
    'en': 'EN',
}

# Ordered language list used when iterating per-row (matches template column
# order DE, FR, IT, ES, JP, EN for Title/Description/Tags/Brand/Bullet blocks).
LANG_ORDER: tuple[str, ...] = ('de', 'fr', 'it', 'es', 'ja', 'en')

# ---------------------------------------------------------------------------
# Marketplace map -- our Amazon marketplace domain -> FlyingUpload country code.
# AC-93: BA `Marketplace` column = CSV of enabled codes.
# ---------------------------------------------------------------------------

MARKETPLACE_MAP: dict[str, str] = {
    'amazon.com': 'US',
    'amazon.co.uk': 'UK',
    'amazon.de': 'DE',
    'amazon.fr': 'FR',
    'amazon.it': 'IT',
    'amazon.es': 'ES',
    'amazon.co.jp': 'JP',
}

# Price column order for MBA XLSX (BB-BH). One entry per marketplace code --
# cells are empty when the marketplace is disabled / missing.
PRICE_COLUMN_ORDER: tuple[tuple[str, str], ...] = (
    ('US', 'amazon.com'),
    ('UK', 'amazon.co.uk'),
    ('DE', 'amazon.de'),
    ('FR', 'amazon.fr'),
    ('IT', 'amazon.it'),
    ('ES', 'amazon.es'),
    ('JP', 'amazon.co.jp'),
)

# ---------------------------------------------------------------------------
# Product map -- our MBA catalog key -> FlyingUpload `Product` column label.
# AC-93: AZ `Product` column. Unknown keys -> row skipped + preflight warning
# (AC-94, EC-48).
# ---------------------------------------------------------------------------

FLYINGUPLOAD_PRODUCT_MAP: dict[str, str] = {
    't_shirt': 'Standard t-shirt',
    't_shirt_premium': 'Premium t-shirt',
    't_shirt_heavyweight': 'Heavyweight t-shirt',
    'v_neck': 'V-Neck t-shirt',
    'tank_top': 'Tank Top',
    'long_sleeve': 'Long Sleeve t-shirt',
    'raglan': 'Raglan Baseball Tee',
    'sweatshirt': 'Sweatshirt',
    'hoodie_pullover': 'Pullover Hoodie',
    'hoodie_zip': 'Zip Hoodie',
    'performance': 'Performance t-shirt',
    'baseball': 'Baseball t-shirt',
    'trucker_hat': 'Trucker Hat',
    'popsocket': 'PopSocket',
    'phone_case': 'Phone Case',
    'throw_pillow': 'Throw Pillow',
    'tote_bag': 'Tote Bag',
    'tumbler': 'Tumbler',
    'mug': 'Mug',
    'water_bottle': 'Water Bottle',
}

# ---------------------------------------------------------------------------
# Fit type map -- used by the Basic export only (AC-96).
# MBA XLSX `Type` column (U) passes our keys through as-is.
# ---------------------------------------------------------------------------

FIT_TYPE_MAP: dict[str, str] = {
    'men': 'man',
    'women': 'woman',
    'youth': 'youth',
    'girls': 'girls',
    'adult_unisex': 'adult_unisex',
}

# ---------------------------------------------------------------------------
# Color-mode derivation -- used by AC-93 V column.
# "dark" keys collapse to `black`, "white-only" -> `white`, mixed -> `colorful`.
# Matches MBA catalog keys in ``publish_app.constants.MBA_COLORS``.
# ---------------------------------------------------------------------------

_DARK_COLOR_KEYS: frozenset[str] = frozenset({
    'black',
    'navy',
    'asphalt',
    'red',
    'royal_blue',
    'kelly_green',
    'forest_green',
    'brown',
    'purple',
    'pink',
    'orange',
    'heather_navy',
    'heather_dark_grey',
    'cranberry',
})

_WHITE_COLOR_KEYS: frozenset[str] = frozenset({
    'white',
})

# Keys that don't fit dark/white boundaries -- always count as `colorful` when
# present (mixed w/ anything).
# silver, yellow, heather_grey, heather_blue, heather_red -> "colorful".


def derive_color_mode(color_keys: list[str]) -> str:
    """AC-93 V column: derive the single-value color column from a list of
    color keys.

    - all keys in `_DARK_COLOR_KEYS` -> 'black'
    - all keys in `_WHITE_COLOR_KEYS` -> 'white'
    - otherwise -> 'colorful' (includes empty list per spec default)
    """
    keys = {k for k in color_keys if k}
    if not keys:
        return 'colorful'
    if keys.issubset(_DARK_COLOR_KEYS):
        return 'black'
    if keys.issubset(_WHITE_COLOR_KEYS):
        return 'white'
    return 'colorful'
