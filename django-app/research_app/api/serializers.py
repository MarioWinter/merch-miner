import statistics

from rest_framework import serializers

from scraper_app.models import (
    AmazonProduct,
    BSRSnapshot,
    MarketplaceChoices,
    MetaKeyword,
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
            'bsr_categories',
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


class MetaKeywordSerializer(serializers.ModelSerializer):
    class Meta:
        model = MetaKeyword
        fields = ['id', 'keyword', 'type', 'frequency']


class ProductDetailSerializer(serializers.ModelSerializer):
    """Full product detail with nested meta_keywords."""

    meta_keywords = MetaKeywordSerializer(many=True, read_only=True)

    class Meta:
        model = AmazonProduct
        fields = [
            'id',
            'asin',
            'marketplace',
            'title',
            'brand',
            'bsr',
            'bsr_categories',
            'category',
            'subcategory',
            'price',
            'rating',
            'reviews_count',
            'listed_date',
            'product_type',
            'thumbnail_url',
            'product_url',
            'seller_name',
            'bullet_1',
            'bullet_2',
            'description',
            'variants',
            'image_gallery',
            'scraped_at',
            'meta_keywords',
        ]


class SimilarProductSerializer(serializers.ModelSerializer):
    """Compact serializer for similar/same-brand product cards."""

    class Meta:
        model = AmazonProduct
        fields = [
            'id',
            'asin',
            'marketplace',
            'title',
            'brand',
            'bsr',
            'price',
            'rating',
            'reviews_count',
            'listed_date',
            'thumbnail_url',
            'product_type',
        ]


class PriceHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = BSRSnapshot
        fields = ['price', 'recorded_at']


class BSRSummarySerializer(serializers.Serializer):
    """Computed BSR trend summary."""

    overall_trend = serializers.CharField()
    current_trend = serializers.CharField()
    average = serializers.FloatField(allow_null=True)
    median = serializers.FloatField(allow_null=True)


def compute_bsr_summary(snapshots):
    """Compute BSR summary stats from a list of BSRSnapshot objects.

    Returns dict with overall_trend, current_trend, average, median.
    """
    bsr_values = [s.bsr for s in snapshots if s.bsr is not None]
    if not bsr_values:
        return {
            'overall_trend': 'stable',
            'current_trend': 'stable',
            'average': None,
            'median': None,
        }

    avg = round(statistics.mean(bsr_values), 1)
    med = round(statistics.median(bsr_values), 1)

    # Overall trend: compare first third vs last third
    third = max(len(bsr_values) // 3, 1)
    first_avg = statistics.mean(bsr_values[:third])
    last_avg = statistics.mean(bsr_values[-third:])

    if last_avg < first_avg * 0.9:
        overall_trend = 'improving'  # lower BSR = better
    elif last_avg > first_avg * 1.1:
        overall_trend = 'declining'
    else:
        overall_trend = 'stable'

    # Current trend: last 7 data points (or all if fewer)
    recent = bsr_values[-7:]
    if len(recent) >= 2:
        recent_first = statistics.mean(recent[:len(recent) // 2 or 1])
        recent_last = statistics.mean(recent[len(recent) // 2:])
        if recent_last < recent_first * 0.9:
            current_trend = 'improving'
        elif recent_last > recent_first * 1.1:
            current_trend = 'declining'
        else:
            current_trend = 'stable'
    else:
        current_trend = 'stable'

    return {
        'overall_trend': overall_trend,
        'current_trend': current_trend,
        'average': avg,
        'median': med,
    }


class UseAsTemplateSerializer(serializers.Serializer):
    niche_id = serializers.UUIDField(required=True)


class SearchKeywordResultSerializer(serializers.Serializer):
    """Serializer for SearchKeywordResult data included in status response."""

    top_focus_keywords = serializers.ListField(child=serializers.DictField())
    top_long_tail_keywords = serializers.ListField(child=serializers.DictField())
