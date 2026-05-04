from rest_framework import serializers

VALID_CONTENT_TYPES = [
    'niche', 'niche_analysis', 'vision_analysis', 'emotional_analysis',
    'keyword_analysis', 'amazon_product', 'idea', 'listing',
    'chat_message', 'web_search',
]

VALID_STRATEGIES = ['similarity', 'mmr']


class SemanticSearchRequestSerializer(serializers.Serializer):
    query = serializers.CharField(max_length=2000)
    content_types = serializers.ListField(
        child=serializers.ChoiceField(choices=VALID_CONTENT_TYPES),
        required=False,
        default=None,
        allow_empty=True,
    )
    top_k = serializers.IntegerField(min_value=1, max_value=100, default=10)
    threshold = serializers.FloatField(min_value=0.0, max_value=1.0, default=0.3)
    strategy = serializers.ChoiceField(
        choices=VALID_STRATEGIES,
        default='similarity',
    )


class SemanticSearchResultSerializer(serializers.Serializer):
    score = serializers.FloatField()
    content_type = serializers.CharField()
    object_id = serializers.CharField()
    text_preview = serializers.CharField()
    metadata = serializers.DictField()


class SemanticSearchResponseSerializer(serializers.Serializer):
    results = SemanticSearchResultSerializer(many=True)
    total = serializers.IntegerField()
    query = serializers.CharField()
    strategy = serializers.CharField()
