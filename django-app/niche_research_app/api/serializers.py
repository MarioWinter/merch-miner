"""Serializers for niche research API endpoints."""

from rest_framework import serializers

from scraper_app.models import MarketplaceChoices

from niche_research_app.models import (
    NicheAnalysis,
    NicheKeywordAnalysis,
    NicheProductEmotionalAnalysis,
    NicheProductVisionAnalysis,
    NicheResearch,
    NicheResearchProduct,
)

TOTAL_NODES = 6

# Product type choices for research trigger (subset of ScrapeJob.ProductTypeFilter,
# excluding 'ALL' since research always needs a specific type)
RESEARCH_PRODUCT_TYPE_CHOICES = [
    ('t_shirt', 'T-Shirt (Standard)'),
    ('premium_shirt', 'Premium Shirt'),
    ('comfort_colors', 'Comfort Colors'),
    ('v_neck', 'V-Neck'),
    ('long_sleeve', 'Long Sleeve'),
    ('raglan', 'Raglan'),
    ('sweatshirt', 'Sweatshirt'),
    ('hoodie', 'Hoodie'),
    ('performance_polo', 'Performance Polo'),
    ('zip_hoodie', 'Zip Hoodie'),
    ('popsocket', 'PopSocket'),
    ('phone_case', 'Phone Case'),
    ('tote_bag', 'Tote Bag'),
    ('tumbler', 'Tumbler'),
    ('ceramic_mug', 'Ceramic Mug'),
    ('tank_top', 'Tank Top'),
]


class ResearchTriggerSerializer(serializers.Serializer):
    """Validates trigger request params: marketplace, product_type, force_refresh, product_limit."""

    marketplace = serializers.ChoiceField(
        choices=MarketplaceChoices.choices,
        default='amazon_com',
    )
    product_type = serializers.ChoiceField(
        choices=RESEARCH_PRODUCT_TYPE_CHOICES,
        default='t_shirt',
    )
    force_refresh = serializers.BooleanField(default=False)
    product_limit = serializers.IntegerField(
        min_value=10,
        max_value=200,
        default=50,
        required=False,
    )


class NicheResearchSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list view and trigger response."""

    total_nodes = serializers.SerializerMethodField()

    class Meta:
        model = NicheResearch
        fields = [
            'id', 'status', 'created_at', 'completed_at', 'error_message',
            'completed_nodes', 'current_node', 'total_nodes',
            'marketplace', 'product_type', 'retry_count',
            'brand_filtered_count', 'product_limit',
        ]
        read_only_fields = fields

    def get_total_nodes(self, obj):
        return TOTAL_NODES


class NicheProductVisionAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = NicheProductVisionAnalysis
        fields = [
            'slogan_text', 'meaning_context', 'visual_style',
            'graphic_elements', 'layout_composition',
        ]


class NicheProductEmotionalAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = NicheProductEmotionalAnalysis
        fields = [
            'customer_psychology', 'sentiment_analysis', 'emotional_pattern',
            'vibe', 'semantic_structure', 'key_elements', 'tone',
            'adaptation_formula', 'adaptation_examples', 'transferability_notes',
        ]


class NicheProductSerializer(serializers.ModelSerializer):
    """Product with nested vision + emotional analysis."""

    asin = serializers.CharField(source='product.asin')
    title = serializers.CharField(source='product.title')
    brand = serializers.CharField(source='product.brand')
    url = serializers.URLField(source='product.product_url')
    rating = serializers.FloatField(source='product.rating')
    reviews_count = serializers.IntegerField(source='product.reviews_count')
    thumbnail_url = serializers.URLField(source='product.thumbnail_url')
    vision_analysis = serializers.SerializerMethodField()
    emotional_analysis = serializers.SerializerMethodField()

    class Meta:
        model = NicheResearchProduct
        fields = [
            'asin', 'title', 'brand', 'url', 'rating', 'reviews_count',
            'thumbnail_url', 'vision_analysis', 'emotional_analysis',
            'brand_blocked',
        ]

    def get_vision_analysis(self, obj):
        research = obj.research
        product = obj.product
        try:
            va = NicheProductVisionAnalysis.objects.get(
                research=research, product=product, is_niche_match=True,
            )
            return NicheProductVisionAnalysisSerializer(va).data
        except NicheProductVisionAnalysis.DoesNotExist:
            return None

    def get_emotional_analysis(self, obj):
        research = obj.research
        product = obj.product
        try:
            ea = NicheProductEmotionalAnalysis.objects.get(
                research=research, product=product,
            )
            return NicheProductEmotionalAnalysisSerializer(ea).data
        except NicheProductEmotionalAnalysis.DoesNotExist:
            return None


class NicheAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = NicheAnalysis
        fields = [
            'niche_summary', 'sentiment', 'primary_emotions',
            'emotional_archetype', 'example_keywords', 'pattern_analysis',
            'emotional_reality', 'design_concepts', 'dominant_design_aesthetics',
        ]


class NicheKeywordAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = NicheKeywordAnalysis
        fields = [
            'main_short_tail', 'main_long_tail', 'all_keywords_flat',
            'top_focus_keywords', 'top_long_tail_keywords',
        ]


class RelatedNicheSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    shared_patterns = serializers.ListField(child=serializers.CharField())


class NicheResearchDetailSerializer(serializers.ModelSerializer):
    """Full detail serializer for latest endpoint."""

    analysis = serializers.SerializerMethodField()
    keywords = serializers.SerializerMethodField()
    products = serializers.SerializerMethodField()
    related_niches = serializers.SerializerMethodField()
    total_nodes = serializers.SerializerMethodField()

    class Meta:
        model = NicheResearch
        fields = [
            'id', 'status', 'created_at', 'completed_at', 'error_message',
            'completed_nodes', 'current_node', 'total_nodes',
            'marketplace', 'product_type', 'retry_count',
            'brand_filtered_count', 'product_limit',
            'analysis', 'keywords', 'products', 'related_niches',
        ]
        read_only_fields = fields

    def get_total_nodes(self, obj):
        return TOTAL_NODES

    def get_analysis(self, obj):
        try:
            na = obj.niche_analyses.first()
            if na:
                return NicheAnalysisSerializer(na).data
        except Exception:
            pass
        return None

    def get_keywords(self, obj):
        try:
            ka = obj.keyword_analyses.first()
            if ka:
                return NicheKeywordAnalysisSerializer(ka).data
        except Exception:
            pass
        return None

    def get_products(self, obj):
        rps = obj.research_products.select_related('product').all()
        return NicheProductSerializer(rps, many=True).data

    def get_related_niches(self, obj):
        """Compute niches in same workspace with >=2 shared active patterns."""
        try:
            analysis = obj.niche_analyses.first()
            if not analysis or not analysis.pattern_analysis:
                return []

            # Get active patterns from this niche
            active_patterns = {
                p['name'] for p in analysis.pattern_analysis
                if p.get('present')
            }
            if len(active_patterns) < 2:
                return []

            # Find other niches in same workspace
            workspace = obj.niche.workspace
            other_analyses = NicheAnalysis.objects.filter(
                niche__workspace=workspace,
            ).exclude(
                niche=obj.niche,
            ).select_related('niche')

            related = []
            for other in other_analyses:
                if not other.pattern_analysis:
                    continue
                other_active = {
                    p['name'] for p in other.pattern_analysis
                    if p.get('present')
                }
                shared = active_patterns & other_active
                if len(shared) >= 2:
                    related.append({
                        'id': other.niche.id,
                        'name': other.niche.name,
                        'shared_patterns': sorted(shared),
                    })

            return RelatedNicheSerializer(related[:5], many=True).data
        except Exception:
            return []
