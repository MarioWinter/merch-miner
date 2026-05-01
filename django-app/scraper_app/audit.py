"""Selector health audit: run every detail-page selector against a saved HTML snapshot.

Used by PROJ-23 SelectorHealthCheck pipeline. Reads field names dynamically from
`scraper_app.selectors.get_selectors(marketplace)['detail']` so adding a new selector
in production automatically extends the audit — no second source of truth.

Result vocabulary per field:
- 'OK'   — at least one selector matched and returned non-empty text.
- 'EMPTY'— a selector (or selector cascade) ran but matched nothing.
- 'INFO' — special status reserved for BSR when the BSR block isn't on the page
           at all (genuinely missing, not a layout drift). Does NOT flip `passed`.
"""

import re
from typing import Dict, List, Union

from parsel import Selector

from scraper_app.selectors import get_selectors


# Keys in `selectors.get_selectors(...)['detail']` that are sub-selectors or
# regex literals consumed by other selectors — they must NOT be audited
# independently because they only have meaning inside their parent selector.
NON_AUDITED_KEYS = {
    'bsr_category_link',          # used only inside `bsr_list` items
    'bsr_list',                   # consumed by the BSR cascade below
    'price_fallback',             # consumed by the price cascade below
    'price_whole',                # consumed by the price cascade below
    'price_fraction',             # consumed by the price cascade below
    'date_first_available_bullets',  # consumed by date cascade below
}

# CSS selectors / patterns that indicate the BSR block exists on the page.
# If NONE match AND no BSR strategy yields a rank, BSR is INFO (not EMPTY).
BSR_INDICATORS_CSS = (
    '#detailBullets_feature_div',
    'ul.zg_hrsr',
)
BSR_INDICATOR_TEXT = 'Best Sellers Rank'


def _has_bsr_block(selector: Selector, html: str) -> bool:
    """Return True when the page contains a BSR container, even if no rank parsed.

    Triple check:
    1. `#detailBullets_feature_div` element exists.
    2. `ul.zg_hrsr` element exists.
    3. Any `<table>` row contains the literal text "Best Sellers Rank".
    """
    for css in BSR_INDICATORS_CSS:
        if selector.css(css):
            return True
    # Table-row check (the broader Amazon "Product Details" table can hold BSR).
    for row in selector.css('table tr'):
        header = ' '.join(row.css('th::text').getall())
        if BSR_INDICATOR_TEXT.lower() in header.lower():
            return True
    # Last resort: literal text anywhere in the HTML.
    return BSR_INDICATOR_TEXT.lower() in html.lower()


def _selector_yields_text(selector: Selector, css_selector: str) -> bool:
    """Run a single CSS selector and return True if any non-empty result."""
    try:
        results = selector.css(css_selector).getall()
    except Exception:
        return False
    return any((r or '').strip() for r in results)


def _cascade_yields_text(
    selector: Selector,
    css_or_list: Union[str, List[str]],
) -> bool:
    """Audit a field that may be a single selector or a fallback list.

    OK if ANY entry in the cascade returns non-empty text. The audit does NOT
    validate that the *primary* selector worked, only that the field was
    extractable somehow (mirrors production behaviour — see EC-4 in the spec).
    """
    if isinstance(css_or_list, str):
        return _selector_yields_text(selector, css_or_list)
    for css in css_or_list:
        if _selector_yields_text(selector, css):
            return True
    return False


def _regex_matches(html: str, pattern: str) -> bool:
    """Return True when a regex pattern matches the raw HTML."""
    if not pattern:
        return False
    try:
        return re.search(pattern, html) is not None
    except re.error:
        return False


def _audit_price(selector: Selector, detail: dict) -> str:
    """Price has a 3-step cascade: whole+fraction → fallback (.a-offscreen)."""
    if _selector_yields_text(selector, detail.get('price_whole', '')):
        return 'OK'
    if _selector_yields_text(selector, detail.get('price_fallback', '')):
        return 'OK'
    return 'EMPTY'


def _audit_bsr(selector: Selector, detail: dict, html: str) -> str:
    """BSR has 4 strategies; only EMPTY when the block exists yet nothing matches.

    Strategy 1: ul.zg_hrsr items (sidebar list).
    Strategy 2: any table row with header "Best Sellers Rank".
    Strategy 3: #detailBullets_feature_div items containing "best sellers rank".
    Strategy 4: raw-text regex `#N in CategoryName`.
    """
    # Strategy 1
    if selector.css('ul.zg_hrsr li'):
        return 'OK'
    # Strategy 2
    for row in selector.css('table tr'):
        header = ' '.join(row.css('th::text').getall()).lower()
        if 'best sellers rank' in header or 'ranking' in header:
            cell_text = ' '.join(row.css('td ::text').getall())
            if re.search(r'#[\d,]+\s+in\s+', cell_text):
                return 'OK'
    # Strategy 3
    for li in selector.css('#detailBullets_feature_div li'):
        text = ' '.join(li.css('::text').getall())
        if 'best sellers rank' in text.lower() and re.search(r'#[\d,]+\s+in\s+', text):
            return 'OK'
    # Strategy 4 (raw text fallback)
    if re.search(r'#[\d,]+\s+in\s+[A-Z][^<\n(]{3,50}', html):
        return 'OK'

    # Nothing matched — distinguish "block missing" (INFO) from "drift" (EMPTY).
    if _has_bsr_block(selector, html):
        return 'EMPTY'
    return 'INFO'


def _audit_date_first_available(selector: Selector, detail: dict, html: str) -> str:
    """Date First Available — table row OR detail bullets OR raw regex."""
    table_sel = detail.get('date_first_available', '')
    if table_sel:
        for row in selector.css(table_sel):
            header = ' '.join(row.css('th::text').getall()).lower()
            if 'date first available' in header:
                value = ' '.join(row.css('td::text').getall()).strip()
                if value:
                    return 'OK'

    bullets_sel = detail.get('date_first_available_bullets', '')
    if bullets_sel:
        for li in selector.css(bullets_sel):
            text = ' '.join(li.css('::text').getall())
            if 'date first available' in text.lower():
                # Text after the colon should be non-empty
                parts = text.split(':')
                if len(parts) >= 2 and parts[-1].strip():
                    return 'OK'

    if re.search(
        r'Date First Available[^:]*:\s*</span>\s*<span[^>]*>([^<]+)</span>',
        html,
    ):
        return 'OK'

    return 'EMPTY'


def run_audit(html: str, marketplace: str) -> Dict[str, str]:
    """Run every detail-page selector against the snapshot HTML.

    Returns a dict mapping field name → 'OK' / 'EMPTY' / 'INFO'.
    Field names are read from `selectors.get_selectors(marketplace)['detail']`
    so additions in production are picked up automatically.
    """
    selector = Selector(text=html or '')
    detail = get_selectors(marketplace)['detail']

    results: Dict[str, str] = {}

    # Price (cascade across 3 keys → reported under one logical field 'price')
    results['price'] = _audit_price(selector, detail)

    # BSR (4 strategies, INFO-aware)
    results['bsr'] = _audit_bsr(selector, detail, html or '')

    # Date First Available (compound)
    results['date_first_available'] = _audit_date_first_available(
        selector, detail, html or '',
    )

    # Iterate every other selector key; skip aggregates handled above + sub-keys.
    handled = {
        'price', 'price_whole', 'price_fraction', 'price_fallback',
        'bsr', 'bsr_list', 'bsr_category_link',
        'date_first_available', 'date_first_available_bullets',
    }

    for field, value in detail.items():
        if field in handled or field in NON_AUDITED_KEYS:
            continue

        # Regex-extracted fields (e.g. images_regex, variants_regex)
        if field.endswith('_regex'):
            results[field] = 'OK' if _regex_matches(html or '', value) else 'EMPTY'
            continue

        # CSS selector (string or list)
        if isinstance(value, (str, list)):
            results[field] = 'OK' if _cascade_yields_text(selector, value) else 'EMPTY'
            continue

        # Unknown shape — skip rather than crash.
        # (Future-proofs against new dict-typed selector definitions.)

    return results
