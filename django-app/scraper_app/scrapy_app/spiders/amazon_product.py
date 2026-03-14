"""Single-ASIN detail page spider."""

import scrapy

from scraper_app.scrapy_app.spiders.mixins import ProductDetailMixin
from scraper_app.selectors import get_selectors, get_base_url


class AmazonProductSpider(ProductDetailMixin, scrapy.Spider):
    """Scrape a single Amazon product detail page by ASIN."""

    name = 'amazon_product'

    def __init__(self, asin, marketplace='amazon_com', job_id=None,
                 *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.asin = asin
        self.marketplace = marketplace
        self.job_id = job_id

    def start_requests(self):
        base_url = get_base_url(self.marketplace)
        product_url = f"{base_url}/dp/{self.asin}/"

        yield scrapy.Request(
            url=product_url,
            callback=self.parse_product_data,
            meta={
                'marketplace': self.marketplace,
                'job_id': self.job_id,
                'asin': self.asin,
                'retry_count': 0,
            },
        )
