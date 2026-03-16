
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

    def test_pullover(self):
        assert ProductDetailMixin._detect_product_type("Bus Driver Pullover") == 'pullover'

    def test_sweatshirt_maps_to_pullover(self):
        assert ProductDetailMixin._detect_product_type("Bus Driver Sweatshirt") == 'pullover'

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
        assert spider.max_pages == 4

    def test_custom_max_pages(self):
        spider = AmazonSearchPageSpider(keyword="test", max_pages=2)
        assert spider.max_pages == 2

    def test_detect_product_type_from_title(self):
        assert AmazonSearchPageSpider._detect_product_type_from_title("Funny Cat T-Shirt") == "t_shirt"
        assert AmazonSearchPageSpider._detect_product_type_from_title("Cool Hoodie") == "hoodie"
        assert AmazonSearchPageSpider._detect_product_type_from_title(None) == "other"
        assert AmazonSearchPageSpider._detect_product_type_from_title("") == "other"
