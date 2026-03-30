"""DRF serializers for idea_app API."""

from rest_framework import serializers

from idea_app.models import Idea, IdeaAdaptationRun, IdeaFilterTemplate


class IdeaSerializer(serializers.ModelSerializer):
    """Full idea representation."""

    source_idea_summary = serializers.SerializerMethodField()
    niche_name = serializers.SerializerMethodField()

    class Meta:
        model = Idea
        fields = [
            'id', 'workspace', 'niche', 'niche_name', 'adaptation_run',
            'source_idea', 'source_idea_summary', 'source_product_url',
            'slogan_text', 'is_manual', 'signal_type',
            'creative_modules_used', 'emotional_archetype',
            'buyer_voice_pattern', 'stylistic_device', 'pattern_used',
            'why_it_works', 'market_confidence', 'status',
            'was_changed', 'change_reason', 'created_by', 'created_at',
        ]
        read_only_fields = [
            'id', 'workspace', 'created_by', 'created_at',
            'is_manual', 'adaptation_run',
        ]

    def get_source_idea_summary(self, obj):
        if obj.source_idea:
            return {
                'id': str(obj.source_idea.id),
                'slogan_text': obj.source_idea.slogan_text[:100],
            }
        return None

    def get_niche_name(self, obj):
        if obj.niche:
            return obj.niche.name
        return None


class IdeaCreateSerializer(serializers.Serializer):
    """Create manual/collected ideas. Supports batch (newline-separated)."""

    slogan_text = serializers.CharField(required=True)
    niche = serializers.UUIDField(required=False, allow_null=True, default=None)
    source_product_url = serializers.URLField(required=False, default='')

    def validate_slogan_text(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Slogan text cannot be empty.")
        return value


class IdeaUpdateSerializer(serializers.ModelSerializer):
    """Partial update for ideas."""

    class Meta:
        model = Idea
        fields = [
            'slogan_text', 'niche', 'status', 'signal_type',
            'market_confidence', 'emotional_archetype',
        ]
        extra_kwargs = {field: {'required': False} for field in fields}


class AdaptTriggerSerializer(serializers.Serializer):
    """Trigger an adaptation run."""

    target_niche_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        max_length=20,
    )


class IdeaAdaptationRunSerializer(serializers.ModelSerializer):
    """Adaptation run detail."""

    source_idea_text = serializers.SerializerMethodField()

    class Meta:
        model = IdeaAdaptationRun
        fields = [
            'id', 'workspace', 'source_idea', 'source_idea_text',
            'target_niche_ids', 'niche_results', 'status',
            'triggered_by', 'completed_nodes', 'current_node',
            'created_at', 'completed_at', 'error_message',
        ]
        read_only_fields = fields

    def get_source_idea_text(self, obj):
        return obj.source_idea.slogan_text[:100] if obj.source_idea else None


class ImproveSerializer(serializers.Serializer):
    """Improve a slogan with optional feedback."""

    feedback = serializers.CharField(
        required=False, default='', allow_blank=True,
    )


class ExtractSloganSerializer(serializers.Serializer):
    """Extract slogan from product image."""

    product_image_url = serializers.URLField(required=True)
    product_title = serializers.CharField(required=False, default='')
    product_brand = serializers.CharField(required=False, default='')


class BulkStatusSerializer(serializers.Serializer):
    """Bulk update idea status."""

    ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        max_length=100,
    )
    status = serializers.ChoiceField(choices=['approved', 'rejected'])


class NicheSuggestionSerializer(serializers.Serializer):
    """A suggested compatible niche."""

    niche_id = serializers.UUIDField()
    niche_name = serializers.CharField()
    compatibility_score = serializers.IntegerField()
    shared_patterns = serializers.ListField(
        child=serializers.CharField(), required=False,
    )
    already_adapted = serializers.BooleanField()
    has_completed_research = serializers.BooleanField()
    research_status = serializers.CharField(allow_null=True)


class IdeaImportItemSerializer(serializers.Serializer):
    """Single item in a batch import."""

    slogan_text = serializers.CharField()
    niche_name = serializers.CharField(required=False, default='', allow_blank=True)

    def validate_slogan_text(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Slogan text cannot be empty.")
        return value


class IdeaImportSerializer(serializers.Serializer):
    """Batch import ideas from parsed CSV/XLSX data."""

    ideas = serializers.ListField(
        child=IdeaImportItemSerializer(),
        min_length=1,
        max_length=500,
    )


class IdeaFilterTemplateSerializer(serializers.ModelSerializer):
    """CRUD serializer for saved filter templates."""

    class Meta:
        model = IdeaFilterTemplate
        fields = [
            'id', 'workspace', 'name', 'filters',
            'created_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'workspace', 'created_by', 'created_at', 'updated_at']

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Name cannot be empty.")
        return value

    def validate_filters(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Filters must be a JSON object.")
        allowed_keys = {'niche_id', 'status', 'signal_type', 'is_orphan', 'ordering'}
        unknown = set(value.keys()) - allowed_keys
        if unknown:
            raise serializers.ValidationError(
                f"Unknown filter keys: {', '.join(sorted(unknown))}",
            )
        return value
