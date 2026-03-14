import scrapy


class AmazonProductItem(scrapy.Item):
    """Scrapy item matching AmazonProduct model fields."""
    asin = scrapy.Field()
    marketplace = scrapy.Field()
    title = scrapy.Field()
    brand = scrapy.Field()
    bsr = scrapy.Field()
    bsr_categories = scrapy.Field()     # list of {rank, category, category_url}
    category = scrapy.Field()           # str - first sub-category name
    subcategory = scrapy.Field()
    price = scrapy.Field()
    rating = scrapy.Field()
    reviews_count = scrapy.Field()
    listed_date = scrapy.Field()
    product_type = scrapy.Field()
    thumbnail_url = scrapy.Field()
    product_url = scrapy.Field()
    seller_name = scrapy.Field()
    bullet_1 = scrapy.Field()           # first real (non-boilerplate) bullet
    bullet_2 = scrapy.Field()           # second real (non-boilerplate) bullet
    description = scrapy.Field()
    variants = scrapy.Field()           # list/dict of size/color options
    image_gallery = scrapy.Field()      # list of image URLs
    keyword = scrapy.Field()            # search keyword string
    is_sponsored = scrapy.Field()       # bool


class ScrapeErrorItem(scrapy.Item):
    """Error item for reporting selector/scrape failures."""
    failed_selector = scrapy.Field()
    url = scrapy.Field()
    marketplace = scrapy.Field()
    response_status = scrapy.Field()
    error_message = scrapy.Field()
