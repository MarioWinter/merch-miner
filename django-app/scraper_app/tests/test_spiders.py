
from scraper_app.scrapy_app.spiders.mixins import BOILERPLATE_PHRASES, ProductDetailMixin, SearchPageMixin
from scraper_app.scrapy_app.spiders.amazon_search_page import AmazonSearchPageSpider


class TestDetectProductType:
    def test_tshirt(self):
        assert ProductDetailMixin._detect_product_type("Funny Bus Driver T-Shirt") == 't_shirt'

    def test_hoodie(self):
        assert ProductDetailMixin._detect_product_type("Cool Bus Driver Hoodie") == 'hoodie'

    def test_zip_hoodie(self):
        assert ProductDetailMixin._detect_product_type("Bus Driver Zip Hoodie") == 'zip_hoodie'

    def test_tank_top(self):
        assert ProductDetailMixin._detect_product_type("Bus Driver Tank Top") == 'tank_top'

    def test_long_sleeve(self):
        assert ProductDetailMixin._detect_product_type("Bus Driver Long Sleeve") == 'long_sleeve'

    def test_pullover_maps_to_sweatshirt(self):
        assert ProductDetailMixin._detect_product_type("Bus Driver Pullover") == 'sweatshirt'

    def test_sweatshirt(self):
        assert ProductDetailMixin._detect_product_type("Bus Driver Sweatshirt") == 'sweatshirt'

    def test_unknown_returns_other(self):
        assert ProductDetailMixin._detect_product_type("Bus Driver Mug") == 'other'

    def test_none_returns_other(self):
        assert ProductDetailMixin._detect_product_type(None) == 'other'

    def test_empty_returns_other(self):
        assert ProductDetailMixin._detect_product_type("") == 'other'


class TestBoilerplateFiltering:
    def test_boilerplate_detected(self):
        boilerplate = "Lightweight, Classic fit, Double-needle sleeve and bottom hem"
        assert any(phrase in boilerplate.lower() for phrase in BOILERPLATE_PHRASES)

    def test_real_bullet_not_filtered(self):
        real = "Perfect gift for school bus drivers"
        assert not any(phrase in real.lower() for phrase in BOILERPLATE_PHRASES)


# ------------------------------------------------------------------
# SearchPageMixin (Task 8.3)
# ------------------------------------------------------------------


class TestSearchPageMixin:
    def test_build_search_url_basic(self):
        """_build_search_url generates correct base URL."""
        class FakeSpider(SearchPageMixin):
            keyword = "funny cat"
            marketplace = "amazon_com"
            search_index = None
            seller_filter = None

        spider = FakeSpider()
        url = spider._build_search_url(page=1)
        assert "s?k=funny+cat" in url
        assert "page=1" in url
        assert "amazon.com" in url

    def test_build_search_url_with_filters(self):
        """_build_search_url adds search_index and seller_filter params."""
        class FakeSpider(SearchPageMixin):
            keyword = "test"
            marketplace = "amazon_com"
            search_index = "fashion-novelty"
            seller_filter = "ATVPDKIKX0DER"

        spider = FakeSpider()
        url = spider._build_search_url(page=2)
        assert "i=fashion-novelty" in url
        assert "p_6:ATVPDKIKX0DER" in url
        assert "page=2" in url

    def test_build_search_url_different_marketplace(self):
        class FakeSpider(SearchPageMixin):
            keyword = "test"
            marketplace = "amazon_de"
            search_index = None
            seller_filter = None

        spider = FakeSpider()
        url = spider._build_search_url(page=1)
        assert "amazon.de" in url


# ------------------------------------------------------------------
# AmazonSearchPageSpider (Task 8.4)
# ------------------------------------------------------------------


class TestAmazonSearchPageSpider:
    def test_spider_name(self):
        spider = AmazonSearchPageSpider(keyword="test", marketplace="amazon_com")
        assert spider.name == "amazon_search_page"

    def test_default_max_pages(self):
        spider = AmazonSearchPageSpider(keyword="test")
        assert spider.max_pages == 2

    def test_custom_max_pages(self):
        spider = AmazonSearchPageSpider(keyword="test", max_pages=2)
        assert spider.max_pages == 2

    def test_detect_product_type_from_title(self):
        assert AmazonSearchPageSpider._detect_product_type_from_title("Funny Cat T-Shirt") == "t_shirt"
        assert AmazonSearchPageSpider._detect_product_type_from_title("Cool Hoodie") == "hoodie"
        assert AmazonSearchPageSpider._detect_product_type_from_title(None) == "other"
        assert AmazonSearchPageSpider._detect_product_type_from_title("") == "other"


# ------------------------------------------------------------------
# SearchPageMixin._build_search_url — Sort & Filter params (Phase 14)
# ------------------------------------------------------------------


class TestBuildSearchUrlSortAndFilter:
    """Tests for _build_search_url with sort_by, price_min, price_max, browse_node."""

    def _make_spider(self, **overrides):
        defaults = {
            'keyword': 'funny cat',
            'marketplace': 'amazon_com',
            'search_index': None,
            'seller_filter': None,
            'sort_by': None,
            'price_min': None,
            'price_max': None,
            'browse_node': None,
        }
        defaults.update(overrides)

        class FakeSpider(SearchPageMixin):
            pass
        spider = FakeSpider()
        for k, v in defaults.items():
            setattr(spider, k, v)
        return spider

    def test_sort_by_adds_s_param(self):
        spider = self._make_spider(sort_by='exact-aware-popularity-rank')
        url = spider._build_search_url(page=1)
        assert '&s=exact-aware-popularity-rank' in url

    def test_price_min_adds_low_price(self):
        spider = self._make_spider(price_min='9.99')
        url = spider._build_search_url(page=1)
        assert '&low-price=9.99' in url

    def test_price_max_adds_high_price(self):
        spider = self._make_spider(price_max='29.99')
        url = spider._build_search_url(page=1)
        assert '&high-price=29.99' in url

    def test_price_min_and_max_combined(self):
        spider = self._make_spider(price_min='10', price_max='30')
        url = spider._build_search_url(page=1)
        assert '&low-price=10' in url
        assert '&high-price=30' in url

    def test_browse_node_adds_bbn(self):
        spider = self._make_spider(browse_node='12035955011')
        url = spider._build_search_url(page=1)
        assert '&bbn=12035955011' in url

    def test_empty_keyword_with_browse_node_no_k_param(self):
        """Empty keyword + browse_node → no &k= in URL."""
        spider = self._make_spider(keyword='', browse_node='12035955011')
        url = spider._build_search_url(page=1)
        assert '&k=' not in url and 's?k=' not in url
        assert '&bbn=12035955011' in url
        assert 'page=1' in url

    def test_all_params_combined(self):
        spider = self._make_spider(
            keyword='funny cat',
            search_index='fashion-novelty',
            seller_filter='ATVPDKIKX0DER',
            sort_by='date-desc-rank',
            price_min='5',
            price_max='50',
            browse_node='12035955011',
        )
        url = spider._build_search_url(page=2)
        assert 's?k=funny+cat' in url
        assert 'page=2' in url
        assert 'i=fashion-novelty' in url
        assert 'p_6:ATVPDKIKX0DER' in url
        assert '&s=date-desc-rank' in url
        assert '&low-price=5' in url
        assert '&high-price=50' in url
        assert '&bbn=12035955011' in url

    def test_no_new_params_backwards_compatible(self):
        """No sort/price/browse_node → URL unchanged from before."""
        spider = self._make_spider()
        url = spider._build_search_url(page=1)
        assert '&s=' not in url
        assert '&low-price=' not in url
        assert '&high-price=' not in url
        assert '&bbn=' not in url
        # Base URL still correct
        assert 's?k=funny+cat' in url
        assert 'page=1' in url


# ----------------------------------------------------------------------
# Sorry/Dogs-of-Amazon page detection
# ----------------------------------------------------------------------


class TestSorryPageDetection:
    """Amazon serves HTTP 200 with a 'Dogs of Amazon' page for deleted ASINs.

    Spider must recognize this signature WITHOUT triggering the 3x retry loop
    (would burn ScrapeOps credits) and yield a `product_unavailable` error so
    the pipeline can flag the row instead of treating it as selector drift.
    """

    SORRY_BODY = b'''
    <html><body><div id="g">
      <div><a href="/"><img alt="Sorry! We couldn't find that page."></a></div>
      <a href="/dogsofamazon" target="_blank" rel="noopener noreferrer">
        <img id="d" alt="Dogs of Amazon">
      </a>
    </div></body></html>
    '''

    REAL_PRODUCT_BODY = b'<html><body><span id="productTitle">Real product</span></body></html>'

    def _make_response(self, body: bytes, url: str = 'https://www.amazon.com/dp/B0DEAD12345/'):
        from scrapy.http import HtmlResponse, Request
        request = Request(url=url, meta={'asin': 'B0DEAD12345', 'marketplace': 'amazon_com'})
        return HtmlResponse(url=url, request=request, body=body, encoding='utf-8')

    def test_dogsofamazon_link_detected(self):
        response = self._make_response(self.SORRY_BODY)
        assert ProductDetailMixin._is_product_unavailable_page(response) is True

    def test_real_product_not_flagged(self):
        response = self._make_response(self.REAL_PRODUCT_BODY)
        assert ProductDetailMixin._is_product_unavailable_page(response) is False

    def test_parse_yields_unavailable_no_retry(self):
        """parse_product_data yields product_unavailable + does NOT enqueue retry."""
        from scraper_app.scrapy_app.spiders.amazon_product import AmazonProductSpider

        spider = AmazonProductSpider(asin='B0DEAD12345')
        response = self._make_response(self.SORRY_BODY)

        results = list(spider.parse_product_data(response))

        assert len(results) == 1
        item = results[0]
        assert item['failed_selector'] == 'product_unavailable'
        assert item['marketplace'] == 'amazon_com'
        assert 'B0DEAD12345' in item['error_message']
