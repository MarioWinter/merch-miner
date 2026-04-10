"""DRF serializers for design_app API."""

from rest_framework import serializers

from design_app.models import (
    Design,
    DesignGenerationRun,
    DesignPipeline,
    DesignProcessingJob,
    DesignProject,
    DesignProjectDesign,
    ProcessingSettings,
    ProjectPrompt,
    ProjectReference,
    PromptPreset,
)


# -- Generation Run --

class DesignGenerationRunSerializer(serializers.ModelSerializer):
    """Full generation run representation."""

    reference_used = serializers.SerializerMethodField()

    class Meta:
        model = DesignGenerationRun
        fields = [
            'id', 'idea', 'model_name', 'status', 'triggered_by',
            'prompt_used', 'source_image_url',
            'created_at', 'completed_at', 'error_message',
            'reference_used',
        ]
        read_only_fields = fields

    def get_reference_used(self, obj):
        if not obj.source_image_url:
            return None
        from design_app.services.image_generator import MULTIMODAL_MODELS
        mode = 'multimodal' if obj.model_name in MULTIMODAL_MODELS else 'text_analysis'
        return {'image_url': obj.source_image_url, 'mode': mode}


# -- Design --

class DesignSerializer(serializers.ModelSerializer):
    """Full design representation with nested run info."""

    generation_run = DesignGenerationRunSerializer(read_only=True)
    idea_summary = serializers.SerializerMethodField()
    project_ids = serializers.SerializerMethodField()

    class Meta:
        model = Design
        fields = [
            'id', 'workspace', 'idea', 'idea_summary', 'generation_run',
            'image_file', 'status', 'is_manual', 'background_color',
            'source_image_url', 'prompt_analysis',
            'upscaled_file', 'bg_removed_file', 'processed_file', 'created_at',
            'project_ids',
        ]
        read_only_fields = fields

    def get_idea_summary(self, obj):
        if obj.idea:
            return {
                'id': str(obj.idea.id),
                'slogan_text': obj.idea.slogan_text[:100],
            }
        return None

    def get_project_ids(self, obj):
        # Use prefetched data if available
        if hasattr(obj, '_prefetched_objects_cache') and 'projects' in obj._prefetched_objects_cache:
            return [str(p.id) for p in obj.projects.all()]
        return list(
            DesignProjectDesign.objects.filter(design=obj)
            .values_list('project_id', flat=True)
        )


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
    board_layout = serializers.JSONField(allow_null=True, required=False)
    reference_products = ReferenceProductSerializer(many=True)
    designs = DesignSerializer(many=True)


# -- Generate Trigger --

ASPECT_RATIO_CHOICES = ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3']


class GenerateDesignSerializer(serializers.Serializer):
    """Trigger design generation (idea-scoped, optional project link)."""

    model = serializers.ChoiceField(
        choices=DesignGenerationRun.ModelName.choices,
    )
    background_color = serializers.ChoiceField(
        choices=Design.BackgroundColor.choices,
        default=Design.BackgroundColor.LIGHT_GRAY,
    )
    prompt = serializers.CharField(required=True, min_length=10)
    project_id = serializers.UUIDField(required=False, allow_null=True)
    aspect_ratio = serializers.ChoiceField(
        choices=ASPECT_RATIO_CHOICES, default='1:1', required=False,
    )


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


# -- Design Project --

class DesignProjectListSerializer(serializers.ModelSerializer):
    """Compact project list representation."""

    niche_name = serializers.SerializerMethodField()
    design_count = serializers.SerializerMethodField()
    thumbnail = serializers.SerializerMethodField()

    class Meta:
        model = DesignProject
        fields = [
            'id', 'name', 'niche', 'niche_name', 'design_count',
            'thumbnail', 'updated_at', 'created_at',
        ]
        read_only_fields = fields

    def get_niche_name(self, obj):
        return obj.niche.name if obj.niche else None

    def get_design_count(self, obj):
        # Use annotated count if available, else query
        if hasattr(obj, 'design_count_annotated'):
            return obj.design_count_annotated
        return obj.designs.count()

    def get_thumbnail(self, obj):
        # Return first design's image URL
        first = (
            DesignProjectDesign.objects.filter(project=obj)
            .select_related('design')
            .order_by('-added_at')
            .first()
        )
        if first and first.design.image_file:
            return first.design.image_file.url
        return None


class DesignProjectSerializer(serializers.ModelSerializer):
    """Full project representation with nested niche info."""

    niche_summary = serializers.SerializerMethodField()
    design_count = serializers.SerializerMethodField()
    thumbnail = serializers.SerializerMethodField()

    class Meta:
        model = DesignProject
        fields = [
            'id', 'name', 'niche', 'niche_summary', 'design_count',
            'thumbnail', 'board_layout', 'created_by',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'design_count', 'thumbnail', 'niche_summary',
            'created_by', 'created_at', 'updated_at',
        ]

    def get_niche_summary(self, obj):
        if obj.niche:
            return {'id': str(obj.niche.id), 'name': obj.niche.name}
        return None

    def get_design_count(self, obj):
        if hasattr(obj, 'design_count_annotated'):
            return obj.design_count_annotated
        return obj.designs.count()

    def get_thumbnail(self, obj):
        first = (
            DesignProjectDesign.objects.filter(project=obj)
            .select_related('design')
            .order_by('-added_at')
            .first()
        )
        if first and first.design.image_file:
            return first.design.image_file.url
        return None


class CreateProjectSerializer(serializers.Serializer):
    """Create a new design project."""

    name = serializers.CharField(max_length=200, min_length=1)
    niche = serializers.UUIDField(required=False, allow_null=True)
    idea_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list,
        max_length=50,
    )


class UpdateProjectSerializer(serializers.Serializer):
    """Update a design project."""

    name = serializers.CharField(max_length=200, min_length=1, required=False)
    niche = serializers.UUIDField(required=False, allow_null=True)
    board_layout = serializers.JSONField(required=False, allow_null=True)


class AddDesignsToProjectSerializer(serializers.Serializer):
    """Add designs to a project."""

    design_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        max_length=100,
    )


class DesignProjectBoardSerializer(serializers.Serializer):
    """Full board context for a project."""

    project = DesignProjectSerializer()
    designs = DesignSerializer(many=True)
    board_layout = serializers.JSONField(allow_null=True)
    # Optional idea context overlay
    idea_context = serializers.DictField(required=False, allow_null=True)


class StandaloneGenerateSerializer(serializers.Serializer):
    """Standalone design generation (project-scoped)."""

    model = serializers.ChoiceField(
        choices=DesignGenerationRun.ModelName.choices,
    )
    background_color = serializers.ChoiceField(
        choices=Design.BackgroundColor.choices,
        default=Design.BackgroundColor.LIGHT_GRAY,
    )
    prompt = serializers.CharField(required=True, min_length=10)
    project_id = serializers.UUIDField(required=False, allow_null=True)
    idea_id = serializers.UUIDField(required=False, allow_null=True)
    aspect_ratio = serializers.ChoiceField(
        choices=ASPECT_RATIO_CHOICES, default='1:1', required=False,
    )
    source_image_url = serializers.URLField(
        required=False, allow_blank=True, default='',
        max_length=2048,
    )


class ProductAnalyzeImageSerializer(serializers.Serializer):
    """Trigger image analysis on an AmazonProduct."""

    source_image_url = serializers.URLField(required=True)


class DesignUploadSerializer(serializers.Serializer):
    """Validate manual image upload for artboard canvas."""

    ALLOWED_TYPES = (
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/svg+xml',
    )

    file = serializers.FileField(required=True)

    def validate_file(self, value):
        from django.conf import settings

        max_size = getattr(settings, 'MAX_DESIGN_UPLOAD_SIZE', 25 * 1024 * 1024)
        if value.size > max_size:
            raise serializers.ValidationError(
                f'File size {value.size} exceeds maximum of {max_size} bytes.',
            )

        if value.content_type not in self.ALLOWED_TYPES:
            raise serializers.ValidationError(
                f'File type "{value.content_type}" not allowed. '
                f'Accepted: {", ".join(self.ALLOWED_TYPES)}.',
            )

        return value


# -- Slogan Pool (G2) --

class AddIdeasToPoolSerializer(serializers.Serializer):
    """Add ideas to a project's slogan pool."""

    idea_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        max_length=50,
    )


class ProjectIdeaSerializer(serializers.Serializer):
    """Slogan pool item with full metadata."""

    id = serializers.UUIDField(source='idea.id')
    slogan_text = serializers.CharField(source='idea.slogan_text')
    signal_type = serializers.CharField(source='idea.signal_type', allow_blank=True)
    market_confidence = serializers.CharField(
        source='idea.market_confidence', allow_blank=True,
    )
    emotional_archetype = serializers.CharField(
        source='idea.emotional_archetype', allow_blank=True,
    )
    pattern_used = serializers.CharField(source='idea.pattern_used', allow_blank=True)
    why_it_works = serializers.CharField(source='idea.why_it_works', allow_blank=True)
    niche_name = serializers.SerializerMethodField()
    position = serializers.IntegerField()
    added_at = serializers.DateTimeField()
    reference_products = serializers.SerializerMethodField()
    design_count = serializers.SerializerMethodField()

    def get_niche_name(self, obj):
        idea = obj.idea
        return idea.niche.name if idea.niche else None

    def get_reference_products(self, obj):
        # Lazy import to avoid circulars
        from design_app.api.views import _get_reference_products
        return _get_reference_products(obj.idea)

    def get_design_count(self, obj):
        return obj.idea.designs.count()


# -- Bulk Generate (G3) --

class BulkGenerateSerializer(serializers.Serializer):
    """Bulk generate designs for multiple ideas."""

    idea_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        max_length=10,
    )
    model = serializers.ChoiceField(
        choices=DesignGenerationRun.ModelName.choices,
    )
    background_color = serializers.ChoiceField(
        choices=Design.BackgroundColor.choices,
        default=Design.BackgroundColor.LIGHT_GRAY,
    )
    aspect_ratio = serializers.ChoiceField(
        choices=ASPECT_RATIO_CHOICES, default='1:1', required=False,
    )


# -- ProjectPrompt (G9) --

class ProjectPromptSerializer(serializers.ModelSerializer):
    """Full prompt representation."""

    source_idea_summary = serializers.SerializerMethodField()
    is_generated = serializers.SerializerMethodField()

    class Meta:
        model = ProjectPrompt
        fields = [
            'id', 'project', 'prompt_text', 'sources',
            'source_idea', 'source_idea_summary',
            'source_image_url', 'variant_index',
            'is_generated', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'project', 'source_idea_summary',
            'is_generated', 'created_at', 'updated_at',
        ]

    def get_source_idea_summary(self, obj):
        if obj.source_idea:
            return {
                'id': str(obj.source_idea.id),
                'slogan_text': obj.source_idea.slogan_text[:100],
            }
        return None

    def get_is_generated(self, obj):
        return obj.generation_runs.filter(
            status=DesignGenerationRun.Status.COMPLETED,
        ).exists()


class BulkCreatePromptsSerializer(serializers.Serializer):
    """Bulk create prompts for a project."""

    prompts = serializers.ListField(
        min_length=1,
        max_length=50,
    )

    def validate_prompts(self, value):
        for i, item in enumerate(value):
            if not isinstance(item, dict):
                raise serializers.ValidationError(
                    f'Item {i} must be a dict.',
                )
            if 'prompt_text' not in item or not item['prompt_text']:
                raise serializers.ValidationError(
                    f'Item {i} missing prompt_text.',
                )
        return value


class UpdatePromptSerializer(serializers.Serializer):
    """Edit a prompt's text."""

    prompt_text = serializers.CharField(min_length=1)


class GenerateFromPromptSerializer(serializers.Serializer):
    """Generate a design from a saved prompt."""

    model = serializers.ChoiceField(
        choices=DesignGenerationRun.ModelName.choices,
    )
    background_color = serializers.ChoiceField(
        choices=Design.BackgroundColor.choices,
        default=Design.BackgroundColor.LIGHT_GRAY,
    )
    aspect_ratio = serializers.ChoiceField(
        choices=ASPECT_RATIO_CHOICES, default='1:1', required=False,
    )


# -- Prompt Builder (G10) --

class BuildPromptsSerializer(serializers.Serializer):
    """Prompt Builder: gather sources, build prompt(s)."""

    sources = serializers.DictField()
    slogan_id = serializers.UUIDField(required=False, allow_null=True)
    image_url = serializers.URLField(required=False, allow_blank=True, allow_null=True)
    variants = serializers.IntegerField(min_value=1, max_value=5, default=1)

    def validate_sources(self, value):
        valid_keys = {'slogan', 'keywords', 'research', 'web_research', 'image'}
        for key in value:
            if key not in valid_keys:
                raise serializers.ValidationError(
                    f'Invalid source key: {key}. Valid: {valid_keys}',
                )
        return value


# -- Prompt Preset (G10) --

class PromptPresetSerializer(serializers.ModelSerializer):
    """Prompt preset CRUD."""

    class Meta:
        model = PromptPreset
        fields = [
            'id', 'workspace', 'name', 'source_config',
            'created_by', 'created_at',
        ]
        read_only_fields = ['id', 'workspace', 'created_by', 'created_at']


class CreatePromptPresetSerializer(serializers.Serializer):
    """Create a new prompt preset."""

    name = serializers.CharField(max_length=100, min_length=1)
    source_config = serializers.DictField()


# -- ProjectReference (I2) --

class ProjectReferenceSerializer(serializers.ModelSerializer):
    """Full reference representation."""

    class Meta:
        model = ProjectReference
        fields = [
            'id', 'project', 'source_product', 'image_url',
            'title', 'asin', 'prompt_analysis', 'position', 'added_at',
        ]
        read_only_fields = [
            'id', 'project', 'source_product', 'prompt_analysis', 'added_at',
        ]


class AddReferencesFromProductsSerializer(serializers.Serializer):
    """Bulk add references from AmazonProduct IDs."""

    product_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        max_length=50,
    )


class ManualReferenceItemSerializer(serializers.Serializer):
    """Single manual reference image."""

    url = serializers.URLField(max_length=2048)
    title = serializers.CharField(max_length=500, required=False, default='')


class AddManualReferencesSerializer(serializers.Serializer):
    """Bulk add manual image references."""

    image_urls = serializers.ListField(
        child=ManualReferenceItemSerializer(),
        min_length=1,
        max_length=50,
    )
