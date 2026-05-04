from rest_framework import serializers

from keyword_app.models import (
    KeywordJSCache,
    KeywordProductCount,
    NicheKeyword,
    NicheKeywordGroup,
)


# ---- Keyword Groups ----

class NicheKeywordGroupSerializer(serializers.ModelSerializer):
    keyword_count = serializers.SerializerMethodField()

    class Meta:
        model = NicheKeywordGroup
        fields = ('id', 'name', 'position', 'keyword_count', 'created_at')
        read_only_fields = ('id', 'created_at')

    def get_keyword_count(self, obj):
        return getattr(obj, 'keyword_count', obj.keywords.count())


class NicheKeywordGroupCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)


class NicheKeywordGroupUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100, required=False)
    position = serializers.IntegerField(min_value=0, required=False)


# ---- Niche Keywords ----

class KeywordJSDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = KeywordJSCache
        fields = (
            'monthly_search_volume_exact', 'monthly_search_volume_broad',
            'monthly_trend', 'quarterly_trend',
            'ppc_bid_exact', 'ppc_bid_broad', 'sp_brand_ad_bid',
            'ease_of_ranking_score', 'relevancy_score',
            'organic_product_count', 'sponsored_product_count',
            'dominant_category', 'recommended_promotions',
            'fetched_at',
        )


class NicheKeywordSerializer(serializers.ModelSerializer):
    group_name = serializers.SerializerMethodField()
    js_data = serializers.SerializerMethodField()

    class Meta:
        model = NicheKeyword
        fields = (
            'id', 'keyword', 'source', 'group', 'group_name',
            'design_template', 'position', 'created_by', 'created_at',
            'js_data',
        )
        read_only_fields = ('id', 'created_by', 'created_at')

    def get_group_name(self, obj):
        if obj.group:
            return obj.group.name
        return None

    def get_js_data(self, obj):
        # Check if js_cache was prefetched via annotation
        js_cache = self.context.get('js_cache_map', {}).get(obj.keyword)
        if js_cache:
            return KeywordJSDataSerializer(js_cache).data
        return None


class NicheKeywordCreateSerializer(serializers.Serializer):
    keyword = serializers.CharField(max_length=200)
    source = serializers.ChoiceField(
        choices=NicheKeyword.Source.choices,
        default=NicheKeyword.Source.MANUAL,
    )
    group_id = serializers.UUIDField(required=False, allow_null=True)

    def validate_keyword(self, value):
        value = value.strip()
        if len(value) > 200:
            value = value[:200]
        return value


class NicheKeywordBulkAddSerializer(serializers.Serializer):
    keywords = serializers.ListField(
        child=serializers.DictField(),
        min_length=1,
        max_length=500,
    )
    group_id = serializers.UUIDField(required=False, allow_null=True)

    def validate_keywords(self, value):
        validated = []
        for item in value:
            kw = item.get('keyword', '').strip()
            if not kw:
                continue
            if len(kw) > 200:
                kw = kw[:200]
            source = item.get('source', NicheKeyword.Source.MANUAL)
            if source not in dict(NicheKeyword.Source.choices):
                source = NicheKeyword.Source.MANUAL
            validated.append({'keyword': kw, 'source': source})
        if not validated:
            raise serializers.ValidationError('No valid keywords provided.')
        return validated


class NicheKeywordBulkDeleteSerializer(serializers.Serializer):
    ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        allow_empty=False,
    )


class NicheKeywordUpdateSerializer(serializers.Serializer):
    group = serializers.UUIDField(required=False, allow_null=True)
    position = serializers.IntegerField(min_value=0, required=False)
    design_template = serializers.UUIDField(required=False, allow_null=True)


# ---- Keyword Research (Search / Enrich / History / Export) ----

class KeywordSearchQuerySerializer(serializers.Serializer):
    query = serializers.CharField(max_length=200)
    marketplace = serializers.CharField(max_length=20, default='amazon_com')
    page = serializers.IntegerField(min_value=1, default=1, required=False)
    page_size = serializers.IntegerField(min_value=1, max_value=100, default=20, required=False)


class KeywordSearchResultSerializer(serializers.Serializer):
    keyword = serializers.CharField()
    source = serializers.CharField()
    in_product_count = serializers.IntegerField(default=0)
    in_slogan_count = serializers.IntegerField(default=0)
    js_data = KeywordJSDataSerializer(required=False, allow_null=True)
    amazon_product_count = serializers.IntegerField(
        required=False, allow_null=True, default=None,
    )
    product_count_fetched_at = serializers.DateTimeField(
        required=False, allow_null=True, default=None,
    )


class KeywordEnrichRequestSerializer(serializers.Serializer):
    keywords = serializers.ListField(
        child=serializers.CharField(max_length=200),
        min_length=1,
        max_length=100,
    )
    marketplace = serializers.CharField(max_length=20, default='amazon_com')


class KeywordHistoryQuerySerializer(serializers.Serializer):
    marketplace = serializers.CharField(max_length=20, default='amazon_com')
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)


class KeywordExportQuerySerializer(serializers.Serializer):
    query = serializers.CharField(max_length=200)
    marketplace = serializers.CharField(max_length=20, default='amazon_com')


# ---- Product Count ----

class KeywordProductCountSerializer(serializers.ModelSerializer):
    class Meta:
        model = KeywordProductCount
        fields = ('keyword', 'marketplace', 'product_count', 'fetched_at')
        read_only_fields = fields


class KeywordProductCountRequestSerializer(serializers.Serializer):
    keyword = serializers.CharField(max_length=200)
    marketplace = serializers.CharField(max_length=20, default='amazon_com')

    def validate_keyword(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Keyword must not be empty.')
        if len(value) > 200:
            value = value[:200]
        return value
