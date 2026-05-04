"""URL routes for scraper_app API."""

from django.urls import path

from scraper_app.api.views import RescrapeProductView

urlpatterns = [
    path(
        'scraper/products/<str:asin>/rescrape/',
        RescrapeProductView.as_view(),
        name='scraper-product-rescrape',
    ),
]
