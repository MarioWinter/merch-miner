from rest_framework import serializers

from scraper_app.models import (
    AmazonProduct,
    BSRSnapshot,
    MarketplaceChoices,
    ScrapeJob,
)


class SuggestionsQuerySerializer(serializers.Serializer):
    q = serializers.CharField(required=True, min_length=1, max_length=200)
    marketplace = serializers.ChoiceField(
        choices=MarketplaceChoices.choices,
        default=MarketplaceChoices.AMAZON_COM,
    )


class LiveSearchSerializer(serializers.Serializer):
    keyword = serializers.CharField(required=True, min_length=1, max_length=200)
    marketplace = serializers.ChoiceField(
        choices=MarketplaceChoices.choices,
        required=True,
    )
    product_type = serializers.ChoiceField(
        choices=ScrapeJob.ProductTypeFilter.choices,
        required=False,
        allow_blank=True,
        default='',
    )
    hide_official_brands = serializers.BooleanField(required=False, default=False)


class AmazonProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = AmazonProduct
        fields = [
            'id',
            'asin',
            'marketplace',
            'title',
            'brand',
            'bsr',
            'category',
            'subcategory',
            'price',
            'rating',
            'reviews_count',
            'listed_date',
            'product_type',
            'thumbnail_url',
            'product_url',
            'bullet_1',
            'bullet_2',
            'description',
            'scraped_at',
        ]


class SearchCacheStatusSerializer(serializers.Serializer):
    status = serializers.CharField()
    pages_done = serializers.IntegerField()
    products_scraped = serializers.IntegerField()
    error_log = serializers.CharField(allow_blank=True)


class BSRSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = BSRSnapshot
        fields = ['bsr', 'rating', 'price', 'recorded_at']


class ProductFilterSerializer(serializers.Serializer):
    """Validates query params for GET /api/research/products/."""
    keyword = serializers.CharField(required=False, allow_blank=True, default='')
    marketplace = serializers.ChoiceField(
        choices=MarketplaceChoices.choices,
        required=False,
        default=MarketplaceChoices.AMAZON_COM,
    )
    bsr_min = serializers.IntegerField(required=False, min_value=0)
    bsr_max = serializers.IntegerField(required=False, min_value=0)
    rating_min = serializers.FloatField(required=False, min_value=0, max_value=5)
    reviews_min = serializers.IntegerField(required=False, min_value=0)
    reviews_max = serializers.IntegerField(required=False, min_value=0)
    price_min = serializers.DecimalField(required=False, max_digits=10, decimal_places=2, min_value=0)
    price_max = serializers.DecimalField(required=False, max_digits=10, decimal_places=2, min_value=0)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    product_type = serializers.CharField(required=False, allow_blank=True, default='')
    subcategory = serializers.CharField(required=False, allow_blank=True, default='')
    hide_official_brands = serializers.BooleanField(required=False, default=False)
    exclude_words = serializers.CharField(required=False, allow_blank=True, default='')
    sort_by = serializers.ChoiceField(
        choices=[
            ('bsr_asc', 'BSR Ascending'),
            ('reviews_desc', 'Reviews Descending'),
            ('rating_desc', 'Rating Descending'),
            ('price_asc', 'Price Ascending'),
            ('newest', 'Newest First'),
        ],
        required=False,
        default='',
    )
    page = serializers.IntegerField(required=False, min_value=1, default=1)
    page_size = serializers.IntegerField(required=False, min_value=1, max_value=100, default=50)

    def validate(self, data):
        bsr_min = data.get('bsr_min')
        bsr_max = data.get('bsr_max')
        if bsr_min is not None and bsr_max is not None and bsr_min > bsr_max:
            raise serializers.ValidationError({'bsr_min': 'bsr_min cannot be greater than bsr_max.'})

        reviews_min = data.get('reviews_min')
        reviews_max = data.get('reviews_max')
        if reviews_min is not None and reviews_max is not None and reviews_min > reviews_max:
            raise serializers.ValidationError({'reviews_min': 'reviews_min cannot be greater than reviews_max.'})

        price_min = data.get('price_min')
        price_max = data.get('price_max')
        if price_min is not None and price_max is not None and price_min > price_max:
            raise serializers.ValidationError({'price_min': 'price_min cannot be greater than price_max.'})

        return data
