"""2-phase spider: Amazon search results -> product detail pages."""

import scrapy
from urllib.parse import urljoin, quote_plus

from scraper_app.scrapy_app.spiders.mixins import ProductDetailMixin
from scraper_app.selectors import get_selectors, get_base_url


class AmazonSearchProductSpider(ProductDetailMixin, scrapy.Spider):
    """Crawl Amazon search results for a keyword, then scrape each product detail page."""

    name = 'amazon_search_product'

    def __init__(self, keyword, marketplace='amazon_com', job_id=None,
                 max_pages=4, search_index=None, seller_filter=None,
                 hidden_keywords=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.keyword = keyword
        self.marketplace = marketplace
        self.job_id = job_id
        self.max_pages = int(max_pages)
        self.search_index = search_index
        self.seller_filter = seller_filter
        self.hidden_keywords = hidden_keywords

    def start_requests(self):
        base_url = get_base_url(self.marketplace)
        search_url = f"{base_url}/s?k={quote_plus(self.keyword)}&page=1"

        if self.search_index:
            search_url += f"&i={self.search_index}"
        if self.seller_filter:
            search_url += f"&rh=p_6:{self.seller_filter}"

        yield scrapy.Request(
            url=search_url,
            callback=self.discover_product_urls,
            meta={
                'keyword': self.keyword,
                'marketplace': self.marketplace,
                'page': 1,
                'job_id': self.job_id,
                'retry_count': 0,
            },
        )

    def discover_product_urls(self, response):
        marketplace = response.meta['marketplace']
        keyword = response.meta['keyword']
        job_id = response.meta['job_id']
        page = response.meta['page']

        selectors = get_selectors(marketplace)
        base_url = get_base_url(marketplace)
        search_sel = selectors['search']

        products = response.css(search_sel['product_container'])
        self.logger.info(
            "Page %d: found %d products for '%s'", page, len(products), keyword,
        )

        for product in products:
            # Extract URL using fallback list
            product_url = None
            for url_selector in search_sel['url']:
                product_url = product.css(url_selector).get()
                if product_url:
                    break

            if not product_url:
                continue

            # Build absolute URL, strip query params
            absolute_url = urljoin(base_url, product_url).split('?')[0]

            # Extract ASIN from URL
            asin = None
            if '/dp/' in absolute_url:
                asin = absolute_url.split('/dp/')[-1].split('/')[0]
            else:
                parts = absolute_url.rstrip('/').split('/')
                if len(parts) > 3:
                    asin = parts[3]

            # Check if sponsored
            is_sponsored = search_sel['sponsored_indicator'] in product_url

            yield scrapy.Request(
                url=absolute_url,
                callback=self.parse_product_data,
                meta={
                    'keyword': keyword,
                    'marketplace': marketplace,
                    'job_id': job_id,
                    'is_sponsored': is_sponsored,
                    'asin': asin,
                    'retry_count': 0,
                },
            )

        # Pagination: only on page 1, discover total pages
        if page == 1:
            page_numbers = response.xpath(search_sel['pagination']).getall()
            numeric_pages = []
            for p in page_numbers:
                try:
                    numeric_pages.append(int(p.strip()))
                except ValueError:
                    continue

            last_page = max(numeric_pages) if numeric_pages else 1
            last_page = min(last_page, self.max_pages)

            for next_page in range(2, last_page + 1):
                next_url = f"{base_url}/s?k={quote_plus(keyword)}&page={next_page}"
                if self.search_index:
                    next_url += f"&i={self.search_index}"
                if self.seller_filter:
                    next_url += f"&rh=p_6:{self.seller_filter}"

                yield scrapy.Request(
                    url=next_url,
                    callback=self.discover_product_urls,
                    meta={
                        'keyword': keyword,
                        'marketplace': marketplace,
                        'page': next_page,
                        'job_id': job_id,
                        'retry_count': 0,
                    },
                )
