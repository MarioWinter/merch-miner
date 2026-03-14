# CSS selectors per marketplace for Amazon scraping.
# Based on Simple-Python-Scrapy-Scrapers reference repo.
# Selectors use CSS syntax unless noted as XPath/regex.

# Marketplace base URLs
MARKETPLACE_BASE_URLS = {
    'amazon_com': 'https://www.amazon.com',
    'amazon_de': 'https://www.amazon.de',
    'amazon_co_uk': 'https://www.amazon.co.uk',
    'amazon_fr': 'https://www.amazon.fr',
    'amazon_it': 'https://www.amazon.it',
    'amazon_es': 'https://www.amazon.es',
}

# Default selectors (US Amazon — from Simple-Python-Scrapy-Scrapers reference repo)
DEFAULT_SELECTORS = {
    'search': {
        'product_container': 'div.s-result-item[data-component-type=s-search-result]',
        'title': [
            'h2 a span::text',
            'h2 span::text',
            'a.a-link-normal span::text',
        ],
        'url': [
            'h2 a::attr(href)',
            'a.a-link-normal::attr(href)',
        ],
        'price_whole': 'span.a-price-whole::text',
        'price_fraction': 'span.a-price-fraction::text',
        'rating': 'span.a-icon-alt::text',
        'rating_count': 'span[aria-label~=stars] + span::attr(aria-label)',
        'thumbnail': 'img.s-image::attr(src)',
        'pagination': '//*[contains(@class, "s-pagination-item")][not(has-class("s-pagination-separator"))]/text()',
        'sponsored_indicator': '/slredirect/',
    },
    'detail': {
        'title': '#productTitle::text',
        'price_whole': 'span.a-price-whole::text',
        'price_fraction': 'span.a-price-fraction::text',
        'price_fallback': '.a-price .a-offscreen::text',
        'stars': [
            'i[data-hook=average-star-rating] ::text',
            'span.a-icon-alt::text',
        ],
        'rating_count': 'div[data-hook=total-review-count] ::text',
        'feature_bullets': [
            '#feature-bullets li ::text',
            'ul.a-unordered-list.a-vertical.a-spacing-small li span.a-list-item::text',
        ],
        'bsr_list': 'ul.zg_hrsr li span.a-list-item',
        'bsr_category_link': 'a',
        'brand': [
            '#bylineInfo::text',
            'a#bylineInfo::text',
        ],
        'description': [
            '#productDescription p span::text',
            '#productDescription p::text',
            '#productDescription ::text',
        ],
        'date_first_available': '#productDetails_detailBullets_sections1 tr',
        'date_first_available_bullets': '#detailBullets_feature_div li',
        'images_regex': r"colorImages':.*'initial':\s*(\[.+?\])},\n",
        'variants_regex': r'dimensionValuesDisplayData"\s*:\s*({.+?}),\n',
    },
}

# Per-marketplace overrides (empty = use defaults)
MARKETPLACE_SELECTORS = {
    'amazon_com': {},
    'amazon_de': {},
    'amazon_co_uk': {},
    'amazon_fr': {},
    'amazon_it': {},
    'amazon_es': {},
}


def get_selectors(marketplace):
    """Get merged selectors for a marketplace. Overrides take precedence over defaults."""
    overrides = MARKETPLACE_SELECTORS.get(marketplace, {})
    selectors = {}
    for section in ('search', 'detail'):
        selectors[section] = {**DEFAULT_SELECTORS[section], **overrides.get(section, {})}
    return selectors


def get_base_url(marketplace):
    """Get the base URL for a marketplace."""
    return MARKETPLACE_BASE_URLS.get(marketplace, MARKETPLACE_BASE_URLS['amazon_com'])
