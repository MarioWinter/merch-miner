"""Serializers for scraper_app API."""

from rest_framework import serializers

from scraper_app.models import MarketplaceChoices


class RescrapeProductSerializer(serializers.Serializer):
    """Validate optional `marketplace` body for the single-ASIN rescrape endpoint.

    ASIN is validated separately in the view (URL path arg).
    """

    marketplace = serializers.ChoiceField(
        choices=MarketplaceChoices.choices,
        required=False,
        default=MarketplaceChoices.AMAZON_COM,
    )
