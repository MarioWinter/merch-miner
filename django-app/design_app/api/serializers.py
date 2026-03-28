"""DRF serializers for design_app API."""

from rest_framework import serializers

from design_app.models import (
    Design,
    DesignGenerationRun,
    DesignPipeline,
    DesignProcessingJob,
    ProcessingSettings,
)


# -- Generation Run --

class DesignGenerationRunSerializer(serializers.ModelSerializer):
    """Full generation run representation."""

    class Meta:
        model = DesignGenerationRun
        fields = [
            'id', 'idea', 'model_name', 'status', 'triggered_by',
            'prompt_used', 'created_at', 'completed_at', 'error_message',
        ]
        read_only_fields = fields


# -- Design --

class DesignSerializer(serializers.ModelSerializer):
    """Full design representation with nested run info."""

    generation_run = DesignGenerationRunSerializer(read_only=True)
    idea_summary = serializers.SerializerMethodField()

    class Meta:
        model = Design
        fields = [
            'id', 'workspace', 'idea', 'idea_summary', 'generation_run',
            'image_file', 'status', 'is_manual', 'background_color',
            'source_image_url', 'prompt_analysis',
            'upscaled_file', 'bg_removed_file', 'created_at',
        ]
        read_only_fields = fields

    def get_idea_summary(self, obj):
        if obj.idea:
            return {
                'id': str(obj.idea.id),
                'slogan_text': obj.idea.slogan_text[:100],
            }
        return None


# -- Board Context --

class ReferenceProductSerializer(serializers.Serializer):
    """Reference product from niche research with design-relevant fields."""

    product_id = serializers.UUIDField()
    image = serializers.URLField(allow_blank=True)
    title = serializers.CharField()
    visual_style = serializers.CharField(allow_blank=True)
    graphic_elements = serializers.CharField(allow_blank=True)
    layout_composition = serializers.CharField(allow_blank=True)
    vibe = serializers.JSONField()
    emotional_pattern = serializers.CharField(allow_blank=True)
    semantic_structure = serializers.JSONField()
    key_elements = serializers.JSONField()
    tone = serializers.CharField(allow_blank=True)
    adaptation_formula = serializers.CharField(allow_blank=True)
    adaptation_examples = serializers.JSONField()
    customer_psychology = serializers.JSONField()
    sentiment_analysis = serializers.JSONField()
    prompt_analysis = serializers.JSONField(required=False)


class DesignBoardSerializer(serializers.Serializer):
    """Board context: slogan, reference images, existing designs."""

    idea_id = serializers.UUIDField()
    slogan_text = serializers.CharField()
    niche_name = serializers.CharField(allow_blank=True, allow_null=True)
    reference_products = ReferenceProductSerializer(many=True)
    designs = DesignSerializer(many=True)


# -- Generate Trigger --

class GenerateDesignSerializer(serializers.Serializer):
    """Trigger design generation."""

    model = serializers.ChoiceField(
        choices=DesignGenerationRun.ModelName.choices,
    )
    background_color = serializers.ChoiceField(
        choices=Design.BackgroundColor.choices,
        default=Design.BackgroundColor.LIGHT_GRAY,
    )
    prompt = serializers.CharField(required=True, min_length=10)


# -- Analyze Image --

class AnalyzeImageSerializer(serializers.Serializer):
    """Trigger image analysis."""

    source_image_url = serializers.URLField(required=True)


# -- Update Design Status --

class DesignStatusUpdateSerializer(serializers.Serializer):
    """Update design status (approve/reject)."""

    status = serializers.ChoiceField(choices=['approved', 'rejected'])


# -- Batch Processing --

class BatchProcessSerializer(serializers.Serializer):
    """Batch upscale + bg_remove."""

    design_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        max_length=50,
    )
    steps = serializers.ListField(
        child=serializers.ChoiceField(choices=['upscale', 'bg_remove']),
        min_length=1,
    )


# -- Processing Job --

class DesignProcessingJobSerializer(serializers.ModelSerializer):
    """Processing job status."""

    class Meta:
        model = DesignProcessingJob
        fields = [
            'id', 'design', 'type', 'status',
            'result_file', 'error_message',
            'created_at', 'completed_at',
        ]
        read_only_fields = fields


# -- Processing Settings --

class ProcessingSettingsSerializer(serializers.ModelSerializer):
    """Workspace processing settings."""

    bg_removal_api_key_set = serializers.SerializerMethodField()
    upscale_api_key_set = serializers.SerializerMethodField()

    class Meta:
        model = ProcessingSettings
        fields = [
            'bg_removal_provider', 'bg_removal_api_key',
            'bg_removal_api_key_set',
            'upscale_provider', 'upscale_api_key',
            'upscale_api_key_set',
            'upscale_auto_threshold',
        ]
        extra_kwargs = {
            'bg_removal_api_key': {'write_only': True, 'required': False},
            'upscale_api_key': {'write_only': True, 'required': False},
        }

    def get_bg_removal_api_key_set(self, obj):
        return bool(obj.bg_removal_api_key)

    def get_upscale_api_key_set(self, obj):
        return bool(obj.upscale_api_key)


# -- Pipeline --

class DesignPipelineSerializer(serializers.ModelSerializer):
    """Pipeline CRUD."""

    class Meta:
        model = DesignPipeline
        fields = [
            'id', 'workspace', 'name', 'tools', 'is_preset',
            'created_by', 'created_at',
        ]
        read_only_fields = ['id', 'workspace', 'created_by', 'created_at']


class ApplyPipelineSerializer(serializers.Serializer):
    """Apply a pipeline to designs."""

    design_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        max_length=50,
    )
    pipeline_id = serializers.UUIDField()
