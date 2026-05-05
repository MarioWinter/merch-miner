"""Tests for ProductDetailMixin._extract_bsr canonical bsr selection (2026-05-06).

The canonical `bsr` field on AmazonProduct must be the *department-level* rank
that Amazon shows on the product page (e.g. "#5,932,252 in Clothing, Shoes &
Jewelry"), NOT the smallest sub-category rank. Pre-fix code used min(rank)
which silently picked sub-cats. Tests pin the new heuristic against:

- 6 real snapshots captured by PROJ-23 health-check spider — apparel ASINs
  with the canonical "Clothing, Shoes & Jewelry" department.
- Synthetic fixtures for the empty-bsr_categories case + the no-Format-1 case.
"""

from pathlib import Path

import pytest
from scrapy.http import HtmlResponse

from scraper_app.scrapy_app.spiders.mixins import ProductDetailMixin
from scraper_app.selectors import get_selectors


SNAPSHOTS_DIR = Path('/app/media/snapshots/amazon_com')

# Expected (asin, expected_main_rank) for each snapshot. These were captured
# from the live Amazon product pages on 2026-05-01 (PROJ-23 canary set).
EXPECTED_MAIN_RANKS = {
    'B077GWMQGM': 6440889,
    'B09WZHW6DN': 15678,
    'B0D2H71TXP': 21647,
    'B0F24L7GHB': 26202,
    'B0FSGNCR7C': 13010,
    'B0GYSZZXW8': 262569,
}


def _make_response(asin, html):
    return HtmlResponse(
        url=f'https://amazon.com/dp/{asin}',
        body=html.encode('utf-8'),
        encoding='utf-8',
    )


@pytest.mark.parametrize('asin,expected_rank', EXPECTED_MAIN_RANKS.items())
def test_extract_bsr_picks_department_rank_from_real_snapshot(asin, expected_rank):
    """Real Amazon HTML must yield department-level rank as canonical bsr."""
    snap = next(
        (f for f in SNAPSHOTS_DIR.iterdir() if f.name.startswith(f'{asin}_')),
        None,
    )
    if snap is None:
        pytest.skip(f"Snapshot for {asin} not present (cleanup deleted it).")

    resp = _make_response(asin, snap.read_text())
    selectors = get_selectors('amazon_com')['detail']
    bsr, cats = ProductDetailMixin._extract_bsr(resp, selectors)

    assert bsr == expected_rank, (
        f"{asin}: bsr={bsr} but expected department rank {expected_rank}. "
        f"Categories: {cats}"
    )
    assert cats, f"{asin}: bsr_categories must not be empty when bsr is set"

    # Exactly one is_main=True.
    main_count = sum(1 for c in cats if c.get('is_main'))
    assert main_count == 1, (
        f"{asin}: expected exactly one is_main=True entry, got {main_count}"
    )

    main = next(c for c in cats if c.get('is_main'))
    assert main['rank'] == expected_rank
    assert 'Clothing, Shoes & Jewelry' in main['category']


def test_no_bsr_block_returns_none_and_empty_list():
    """Page with no BSR block at all → bsr=None and bsr_categories=[]."""
    html = '<html><body><div>No BSR here</div></body></html>'
    resp = _make_response('B0NONEEEEE', html)
    selectors = get_selectors('amazon_com')['detail']
    bsr, cats = ProductDetailMixin._extract_bsr(resp, selectors)
    assert bsr is None
    assert cats == []


def test_select_main_bsr_index_signal_a_format_1_first_entry():
    """When the page has ul.zg_hrsr AND first entry is a known department
    root, signal A returns 0 unconditionally — Format 1 fired correctly."""
    html = (
        '<html><body>'
        '<span>#5,932,252 in Clothing, Shoes & Jewelry</span>'
        '<ul class="zg_hrsr"><li><span class="a-list-item">'
        '#1,071,860 in Men\'s Novelty T-Shirts</span></li></ul>'
        '</body></html>'
    )
    resp = _make_response('B07TEST0001', html)
    cats = [
        {'rank': 5_932_252, 'category': 'Clothing, Shoes & Jewelry'},
        {'rank': 1_071_860, 'category': "Men's Novelty T-Shirts"},
    ]
    idx = ProductDetailMixin._select_main_bsr_index(cats, resp)
    assert idx == 0


def test_select_main_bsr_index_signal_b_name_match_when_no_zg_hrsr():
    """When ul.zg_hrsr is absent (Format 2/3/4 path), name-match still finds
    the department category regardless of position."""
    html = '<html><body><div>placeholder, no zg_hrsr</div></body></html>'
    resp = _make_response('B07TEST0002', html)
    cats = [
        {'rank': 30_000, 'category': "Men's Novelty T-Shirts"},
        {'rank': 5_932_252, 'category': 'Clothing, Shoes & Jewelry'},
        {'rank': 1_500, 'category': 'Some Sub-Sub-Category'},
    ]
    idx = ProductDetailMixin._select_main_bsr_index(cats, resp)
    assert idx == 1
    assert cats[idx]['category'] == 'Clothing, Shoes & Jewelry'


def test_select_main_bsr_index_signal_c_max_rank_when_no_dept_match():
    """When no entry matches a known department root, signal C falls back to
    the largest rank (department has the most competition)."""
    html = '<html><body></body></html>'
    resp = _make_response('B07TEST0003', html)
    cats = [
        {'rank': 100, 'category': 'Random Niche A'},
        {'rank': 999_999, 'category': 'Random Niche B'},
        {'rank': 50_000, 'category': 'Random Niche C'},
    ]
    idx = ProductDetailMixin._select_main_bsr_index(cats, resp)
    assert idx == 1
    assert cats[idx]['rank'] == 999_999


def test_select_main_bsr_index_empty_returns_none():
    html = '<html><body></body></html>'
    resp = _make_response('B07TEST0004', html)
    assert ProductDetailMixin._select_main_bsr_index([], resp) is None
