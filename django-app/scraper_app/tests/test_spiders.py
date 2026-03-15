
from scraper_app.scrapy_app.spiders.mixins import BOILERPLATE_PHRASES, ProductDetailMixin


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
