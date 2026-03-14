import os

BOT_NAME = 'amazon_scraper'
SPIDER_MODULES = ['scraper_app.scrapy_app.spiders']
NEWSPIDER_MODULE = 'scraper_app.scrapy_app.spiders'

ROBOTSTXT_OBEY = False

# ScraperOps SDK
SCRAPEOPS_API_KEY = os.environ.get('SCRAPEOPS_API_KEY', '')
SCRAPEOPS_PROXY_ENABLED = True

EXTENSIONS = {
    'scrapeops_scrapy.extension.ScrapeOpsMonitor': 500,
}

DOWNLOADER_MIDDLEWARES = {
    'scrapeops_scrapy.middleware.retry.RetryMiddleware': 550,
    'scrapy.downloadermiddlewares.retry.RetryMiddleware': None,
    'scrapeops_scrapy_proxy_sdk.scrapeops_scrapy_proxy_sdk.ScrapeOpsScrapyProxySdk': 725,
}

ITEM_PIPELINES = {
    'scraper_app.scrapy_app.pipelines.DjangoORMPipeline': 300,
}

CONCURRENT_REQUESTS = int(os.environ.get('SCRAPY_CONCURRENT_REQUESTS', 1))
LOG_LEVEL = 'INFO'

# Timeout for individual requests
DOWNLOAD_TIMEOUT = 30

# Use synchronous Twisted reactor — required for Django ORM in pipelines
# Scrapy 2.14+ defaults to AsyncioSelectorReactor which blocks sync DB calls
TWISTED_REACTOR = 'twisted.internet.selectreactor.SelectReactor'
