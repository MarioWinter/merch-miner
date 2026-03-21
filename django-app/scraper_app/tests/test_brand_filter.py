"""Task 9.1 -- Brand filter unit tests for scraper_app.brand_filter.

Covers:
  - is_brand_blocked(): exact match for short brands, substring for longer, empty, case insensitive
  - filter_products_by_brand(): mixed list splits into (allowed, blocked)
  - get_blacklisted_brands(): returns lowercase set from DB
"""

import pytest

from scraper_app.brand_filter import (
    SHORT_BRAND_THRESHOLD,
    filter_products_by_brand,
    get_blacklisted_brands,
    is_brand_blocked,
)
from scraper_app.models import BrandBlacklist


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class FakeProduct:
    """Minimal object with .brand attribute for filter_products_by_brand."""

    def __init__(self, brand: str):
        self.brand = brand

    def __repr__(self):
        return f"FakeProduct({self.brand!r})"


# ---------------------------------------------------------------------------
# is_brand_blocked
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestIsBrandBlocked:

    def test_short_brand_exact_match(self):
        """Brands <= SHORT_BRAND_THRESHOLD chars use exact match only."""
        blacklist = {'nba'}
        assert is_brand_blocked('nba', blacklist) is True

    def test_short_brand_no_substring_match(self):
        """Short brand 'x' must NOT match 'FlexWear' (no substring for <=3 chars)."""
        blacklist = {'x'}
        assert is_brand_blocked('FlexWear', blacklist) is False

    def test_short_brand_exact_case_insensitive(self):
        """Short brand exact match is case-insensitive."""
        blacklist = {'nba'}
        assert is_brand_blocked('NBA', blacklist) is True
        assert is_brand_blocked('Nba', blacklist) is True

    def test_long_brand_substring_match(self):
        """Brands > SHORT_BRAND_THRESHOLD chars use substring match."""
        blacklist = {'nike'}
        assert is_brand_blocked('Nike Shoes', blacklist) is True
        assert is_brand_blocked('NIKE', blacklist) is True
        assert is_brand_blocked('My Nike Store', blacklist) is True

    def test_long_brand_no_match(self):
        """Long brand that doesn't appear as substring."""
        blacklist = {'adidas'}
        assert is_brand_blocked('Nike Shoes', blacklist) is False

    def test_empty_brand_returns_false(self):
        """Empty brand string is never blocked."""
        blacklist = {'nike', 'nba'}
        assert is_brand_blocked('', blacklist) is False

    def test_whitespace_brand_returns_false(self):
        """Whitespace-only brand is treated as empty."""
        blacklist = {'nike'}
        assert is_brand_blocked('   ', blacklist) is False

    def test_case_insensitive_long_brand(self):
        blacklist = {'disney'}
        assert is_brand_blocked('DISNEY Store', blacklist) is True
        assert is_brand_blocked('disney', blacklist) is True

    def test_multiple_blacklisted_brands(self):
        blacklist = {'nike', 'nba', 'disney'}
        assert is_brand_blocked('nike', blacklist) is True
        assert is_brand_blocked('NBA', blacklist) is True
        assert is_brand_blocked('disney land', blacklist) is True
        assert is_brand_blocked('generic brand', blacklist) is False

    def test_threshold_boundary(self):
        """Brand with exactly SHORT_BRAND_THRESHOLD chars uses exact match."""
        assert SHORT_BRAND_THRESHOLD == 3
        blacklist = {'abc'}  # exactly 3 chars
        assert is_brand_blocked('abc', blacklist) is True
        assert is_brand_blocked('abcdef', blacklist) is False  # no substring

    def test_brand_just_above_threshold_uses_substring(self):
        """Brand with SHORT_BRAND_THRESHOLD+1 chars uses substring match."""
        blacklist = {'abcd'}  # 4 chars
        assert is_brand_blocked('xabcdx', blacklist) is True

    def test_single_char_brand_exact_match_only(self):
        """Single-char brand 'x' blocks 'x'/'X' but NOT 'FlexWear'."""
        blacklist = {'x'}
        assert is_brand_blocked('x', blacklist) is True
        assert is_brand_blocked('X', blacklist) is True
        assert is_brand_blocked('FlexWear', blacklist) is False
        assert is_brand_blocked('Xbox', blacklist) is False

    def test_four_char_brand_substring_blocks_containing_word(self):
        """'ford' (4 chars, > threshold) blocks 'Oxford' via substring."""
        blacklist = {'ford'}
        assert is_brand_blocked('Oxford', blacklist) is True
        assert is_brand_blocked('Ford', blacklist) is True
        assert is_brand_blocked('Comfort', blacklist) is False

    def test_three_char_brand_bts_exact_only(self):
        """'bts' (3 chars, = threshold) exact-match only, no substring."""
        blacklist = {'bts'}
        assert is_brand_blocked('bts', blacklist) is True
        assert is_brand_blocked('BTS', blacklist) is True
        assert is_brand_blocked('btsFanShop', blacklist) is False
        assert is_brand_blocked('Robots', blacklist) is False

    def test_loads_from_db_when_no_blacklist_provided(self):
        """When blacklist=None, loads from DB."""
        BrandBlacklist.objects.create(brand_name='testbrand')
        assert is_brand_blocked('TestBrand Apparel') is True

    def test_empty_blacklist_blocks_nothing(self):
        blacklist = set()
        assert is_brand_blocked('anything', blacklist) is False


# ---------------------------------------------------------------------------
# filter_products_by_brand
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestFilterProductsByBrand:

    def test_mixed_list_split(self):
        """Products split into allowed and blocked correctly."""
        blacklist = {'nike', 'nba'}
        products = [
            FakeProduct('Nike Store'),
            FakeProduct('Generic Brand'),
            FakeProduct('NBA'),
            FakeProduct('FishBrand'),
        ]

        allowed, blocked = filter_products_by_brand(products, blacklist)

        assert len(allowed) == 2
        assert len(blocked) == 2
        assert all(p.brand in ('Generic Brand', 'FishBrand') for p in allowed)
        assert all(p.brand in ('Nike Store', 'NBA') for p in blocked)

    def test_all_allowed(self):
        blacklist = {'nike'}
        products = [FakeProduct('SafeBrand'), FakeProduct('AnotherBrand')]

        allowed, blocked = filter_products_by_brand(products, blacklist)

        assert len(allowed) == 2
        assert len(blocked) == 0

    def test_all_blocked(self):
        blacklist = {'nike', 'adidas'}
        products = [FakeProduct('Nike Gear'), FakeProduct('Adidas Pro')]

        allowed, blocked = filter_products_by_brand(products, blacklist)

        assert len(allowed) == 0
        assert len(blocked) == 2

    def test_empty_product_list(self):
        blacklist = {'nike'}
        allowed, blocked = filter_products_by_brand([], blacklist)
        assert allowed == []
        assert blocked == []

    def test_loads_blacklist_from_db_if_none(self):
        """When blacklist=None, loads from DB."""
        BrandBlacklist.objects.create(brand_name='fromdb')
        products = [FakeProduct('FromDB Apparel'), FakeProduct('Safe')]

        allowed, blocked = filter_products_by_brand(products)

        assert len(blocked) == 1
        assert blocked[0].brand == 'FromDB Apparel'


# ---------------------------------------------------------------------------
# get_blacklisted_brands
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestGetBlacklistedBrands:

    def test_returns_set_from_db(self):
        """get_blacklisted_brands returns a set containing seeded + new brands."""
        # DB may have pre-seeded brands from data migration
        BrandBlacklist.objects.get_or_create(brand_name='uniquetestbrand1')
        BrandBlacklist.objects.get_or_create(brand_name='uniquetestbrand2')

        result = get_blacklisted_brands()

        assert isinstance(result, set)
        assert 'uniquetestbrand1' in result
        assert 'uniquetestbrand2' in result

    def test_returns_set_type(self):
        result = get_blacklisted_brands()
        assert isinstance(result, set)

    def test_brands_stored_lowercase(self):
        """BrandBlacklist.save() lowercases brand_name."""
        BrandBlacklist.objects.get_or_create(brand_name='UPPERBRAND')
        result = get_blacklisted_brands()
        assert 'upperbrand' in result
        assert 'UPPERBRAND' not in result
