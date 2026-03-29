"""2-phase spider: Amazon search results -> product detail pages."""

import scrapy

from scraper_app.scrapy_app.spiders.mixins import ProductDetailMixin, SearchPageMixin


class AmazonSearchProductSpider(SearchPageMixin, ProductDetailMixin, scrapy.Spider):
    """Crawl Amazon search results for a keyword, then scrape each product detail page."""

    name = "amazon_search_product"

    def __init__(
        self,
        keyword,
        marketplace="amazon_com",
        job_id=None,
        max_pages=2,
        start_page='1',
        search_index=None,
        seller_filter=None,
        hidden_keywords=None,
        sort_by=None,
        price_min=None,
        price_max=None,
        browse_node=None,
        *args,
        **kwargs,
    ):
        super().__init__(*args, **kwargs)
        self.keyword = keyword
        self.marketplace = marketplace
        self.job_id = job_id
        self.max_pages = int(max_pages)
        self.start_page = int(start_page)
        self.search_index = search_index
        self.seller_filter = seller_filter
        self.hidden_keywords = hidden_keywords
        self.sort_by = sort_by or ""
        self.price_min = price_min if price_min is not None and price_min != "" else None
        self.price_max = price_max if price_max is not None and price_max != "" else None
        self.browse_node = browse_node or ""

    def start_requests(self):
        search_url = self._build_search_url(page=self.start_page)
        yield scrapy.Request(
            url=search_url,
            callback=self.discover_product_urls,
            meta={
                "keyword": self.keyword,
                "marketplace": self.marketplace,
                "page": self.start_page,
                "job_id": self.job_id,
                "retry_count": 0,
            },
        )

    def discover_product_urls(self, response):
        marketplace = response.meta["marketplace"]
        keyword = response.meta["keyword"]
        job_id = response.meta["job_id"]

        products, search_sel, page = self._parse_search_page(response)

        for product in products:
            card_data = self._extract_search_card_data(product, search_sel, marketplace)
            if not card_data:
                continue

            yield scrapy.Request(
                url=card_data['absolute_url'],
                callback=self.parse_product_data,
                meta={
                    "keyword": keyword,
                    "marketplace": marketplace,
                    "job_id": job_id,
                    "is_sponsored": card_data['is_sponsored'],
                    "asin": card_data['asin'],
                    "retry_count": 0,
                },
            )

        # Pagination
        yield from self._get_pagination_requests(response, self.discover_product_urls)
