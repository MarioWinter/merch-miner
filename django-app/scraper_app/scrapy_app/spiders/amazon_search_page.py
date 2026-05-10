"""Search-page-only spider: scrapes Amazon search results without following detail pages."""

import scrapy

from scraper_app.scrapy_app.items import AmazonProductItem
from scraper_app.scrapy_app.spiders.mixins import SearchPageMixin


class AmazonSearchPageSpider(SearchPageMixin, scrapy.Spider):
    """Scrape Amazon search pages for a keyword. No detail page follow.

    Yields AmazonProductItem with search-level data only.
    Detail fields (bsr, bsr_categories, bullets, description, etc.) set to None.
    """

    name = "amazon_search_page"

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
        extra_rh_filters=None,
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
        self.extra_rh_filters = extra_rh_filters or None

    def start_requests(self):
        search_url = self._build_search_url(page=self.start_page)
        yield scrapy.Request(
            url=search_url,
            callback=self.parse,
            meta={
                "keyword": self.keyword,
                "marketplace": self.marketplace,
                "page": self.start_page,
                "job_id": self.job_id,
                "retry_count": 0,
            },
        )

    def parse(self, response):
        marketplace = response.meta["marketplace"]
        keyword = response.meta["keyword"]

        products, search_sel, page = self._parse_search_page(response)

        for product in products:
            card_data = self._extract_search_card_data(product, search_sel, marketplace)
            if not card_data or not card_data.get('asin'):
                continue

            yield AmazonProductItem(
                asin=card_data['asin'],
                marketplace=marketplace,
                title=card_data.get('title'),
                brand=card_data.get('brand'),
                bsr=None,
                bsr_categories=None,
                category=None,
                subcategory=None,
                price=card_data.get('price'),
                rating=card_data.get('rating'),
                reviews_count=card_data.get('reviews_count'),
                listed_date=None,
                product_type=self._detect_product_type_from_title(card_data.get('title')),
                thumbnail_url=card_data.get('thumbnail_url'),
                product_url=card_data.get('absolute_url'),
                seller_name=None,
                bullet_1=None,
                bullet_2=None,
                description=None,
                variants=None,
                image_gallery=None,
                keyword=keyword,
                is_sponsored=card_data.get('is_sponsored', False),
            )

        # Pagination
        yield from self._get_pagination_requests(response, self.parse)

    @staticmethod
    def _detect_product_type_from_title(title):
        """Detect MBA product type from title suffix."""
        if not title:
            return 'other'
        title_lower = title.lower().strip()
        type_mapping = [
            ('zip hoodie', 'zip_hoodie'),
            ('long sleeve', 'long_sleeve'),
            ('tank top', 'tank_top'),
            ('t-shirt', 't_shirt'),
            ('tee shirt', 't_shirt'),
            ('tee', 't_shirt'),
            ('hoodie', 'hoodie'),
            ('pullover', 'sweatshirt'),
            ('sweatshirt', 'sweatshirt'),
        ]
        for suffix, product_type in type_mapping:
            if title_lower.endswith(suffix):
                return product_type
        return 'other'
