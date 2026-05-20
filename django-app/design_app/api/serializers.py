"""DRF serializers for design_app API."""

from rest_framework import serializers

from design_app.models import (
    BuilderPreset,
    CustomSpatial,
    CustomTypography,
    Design,
    DesignGenerationRun,
    DesignPipeline,
    DesignProcessingJob,
    DesignProject,
    DesignProjectDesign,
    NicheCardPreset,
    ProcessingSettings,
    ProjectPrompt,
    ProjectReference,
    PromptPreset,
)


# -- PROJ-27 AI Upscaler --

class CloudTargetSerializer(serializers.Serializer):
    """Cloud destination payload (provider+folder)."""

    provider = serializers.ChoiceField(choices=['google_drive', 'onedrive'])
    folder_id = serializers.CharField(required=False, allow_blank=True, default='')
    folder_path = serializers.CharField(required=False, allow_blank=True, default='')


class UpscaleSingleTriggerSerializer(serializers.Serializer):
    """Body for POST /api/designs/<id>/upscale/.

    Empty body is valid (defaults: destination=local, no replace).
    """

    destination = serializers.ChoiceField(
        choices=['local', 'cloud'], required=False, default='local',
    )
    cloud_target = CloudTargetSerializer(required=False, allow_null=True)
    replace = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        if attrs.get('destination') == 'cloud' and not attrs.get('cloud_target'):
            raise serializers.ValidationError(
                {'cloud_target': 'Required when destination=cloud.'},
            )
        return attrs


class UpscaleBulkTriggerSerializer(serializers.Serializer):
    """Body for POST /api/designs/upscale/bulk/."""

    design_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        max_length=500,
    )
    destination = serializers.ChoiceField(
        choices=['local', 'cloud'], required=False, default='local',
    )
    cloud_target = CloudTargetSerializer(required=False, allow_null=True)
    # When True, already-upscaled designs are re-upscaled (overwrite).
    # When False, those designs are skipped + counted in `skipped_already_upscaled`.
    replace = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        if attrs.get('destination') == 'cloud' and not attrs.get('cloud_target'):
            raise serializers.ValidationError(
                {'cloud_target': 'Required when destination=cloud.'},
            )
        return attrs


class UpscaleJobSerializer(serializers.ModelSerializer):
    """Per-design upscale job (used in single-mode response + batch poll)."""

    design_id = serializers.UUIDField(read_only=True)
    upscaled_file_url = serializers.SerializerMethodField()

    class Meta:
        model = DesignProcessingJob
        fields = [
            'id', 'design_id', 'status',
            'replicate_prediction_id', 'batch_id',
            'error_message', 'created_at', 'completed_at',
            'upscaled_file_url',
        ]
        read_only_fields = fields

    def get_upscaled_file_url(self, obj):
        if obj.design and obj.design.upscaled_file:
            try:
                return obj.design.upscaled_file.url
            except Exception:  # noqa: BLE001
                return None
        return None


class BatchStatusSerializer(serializers.Serializer):
    """Response shape for GET /api/designs/upscale/batch/<id>/."""

    batch_id = serializers.UUIDField()
    total = serializers.IntegerField()
    completed = serializers.IntegerField()
    failed = serializers.IntegerField()
    pending = serializers.IntegerField()
    running = serializers.IntegerField()
    is_terminal = serializers.BooleanField()
    jobs = UpscaleJobSerializer(many=True)


class UpscaleQuotaSerializer(serializers.Serializer):
    """Response shape for GET /api/designs/upscale/quota/."""

    used = serializers.IntegerField()
    limit = serializers.IntegerField(allow_null=True)
    resets_on = serializers.DateField()
    is_unlimited = serializers.BooleanField()


# -- Generation Run --

class DesignGenerationRunSerializer(serializers.ModelSerializer):
    """Full generation run representation."""

    reference_used = serializers.SerializerMethodField()

    class Meta:
        model = DesignGenerationRun
        fields = [
            'id', 'idea', 'model_name', 'generation_mode', 'status', 'triggered_by',
            'prompt_used', 'source_image_url', 'source_image_url_2',
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
    # PROJ-9 Phase O / AC-171: "In Listings" indicator. Populated via an
    # ``Exists()`` annotation on the queryset (see design_app.api.views).
    # Defaults to False when the queryset is not annotated (e.g. detail view
    # bypasses for now -- frontend only needs this on list endpoints).
    has_design_asset = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = Design
        fields = [
            'id', 'workspace', 'idea', 'idea_summary', 'generation_run',
            'image_file', 'status', 'is_manual', 'background_color',
            'source_image_url', 'prompt_analysis',
            'upscaled_file', 'bg_removed_file', 'processed_file', 'created_at',
            'project_ids', 'has_design_asset',
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


def _validate_mode_image_urls(mode: str, source_url: str, source_url_2: str):
    """Shared validation: image URLs required per generation mode."""
    _IMAGE_MODES = {
        DesignGenerationRun.Mode.IMAGE_TO_IMAGE,
        DesignGenerationRun.Mode.IMAGE_TO_IMAGE_EDIT,
    }
    if mode in _IMAGE_MODES and not source_url:
        raise serializers.ValidationError(
            {'source_image_url': f'Required when mode is {mode}.'},
        )
    if mode == DesignGenerationRun.Mode.REMIX:
        errors = {}
        if not source_url:
            errors['source_image_url'] = 'Required when mode is remix.'
        if not source_url_2:
            errors['source_image_url_2'] = 'Required when mode is remix.'
        if errors:
            raise serializers.ValidationError(errors)


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
    mode = serializers.ChoiceField(
        choices=DesignGenerationRun.Mode.choices,
        default=DesignGenerationRun.Mode.TEXT_TO_IMAGE,
        required=False,
    )
    source_image_url = serializers.URLField(
        required=False, allow_blank=True, default='',
        max_length=2048,
    )
    source_image_url_2 = serializers.URLField(
        required=False, allow_blank=True, default='',
        max_length=2048,
    )

    def validate(self, attrs):
        mode = attrs.get('mode', DesignGenerationRun.Mode.TEXT_TO_IMAGE)
        source_url = attrs.get('source_image_url', '')
        source_url_2 = attrs.get('source_image_url_2', '')
        _validate_mode_image_urls(mode, source_url, source_url_2)
        return attrs


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
            # PROJ-34 — Builder polish toggle (per-workspace).
            'polish_builder_prompts_enabled',
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
    mode = serializers.ChoiceField(
        choices=DesignGenerationRun.Mode.choices,
        default=DesignGenerationRun.Mode.TEXT_TO_IMAGE,
        required=False,
    )
    source_image_url = serializers.URLField(
        required=False, allow_blank=True, default='',
        max_length=2048,
    )
    source_image_url_2 = serializers.URLField(
        required=False, allow_blank=True, default='',
        max_length=2048,
    )

    def validate(self, attrs):
        mode = attrs.get('mode', DesignGenerationRun.Mode.TEXT_TO_IMAGE)
        source_url = attrs.get('source_image_url', '')
        source_url_2 = attrs.get('source_image_url_2', '')
        _validate_mode_image_urls(mode, source_url, source_url_2)
        return attrs


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
    mode = serializers.ChoiceField(
        choices=DesignGenerationRun.Mode.choices,
        default=DesignGenerationRun.Mode.TEXT_TO_IMAGE,
        required=False,
    )
    source_image_url = serializers.URLField(
        required=False, allow_blank=True, default='',
        max_length=2048,
    )
    source_image_url_2 = serializers.URLField(
        required=False, allow_blank=True, default='',
        max_length=2048,
    )

    def validate(self, attrs):
        mode = attrs.get('mode', DesignGenerationRun.Mode.TEXT_TO_IMAGE)
        source_url = attrs.get('source_image_url', '')
        source_url_2 = attrs.get('source_image_url_2', '')
        _validate_mode_image_urls(mode, source_url, source_url_2)
        return attrs


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


# -- Builder Build (PROJ-34) --

class BuilderBuildSerializer(serializers.Serializer):
    """PROJ-34 — input for `POST /api/designs/projects/{id}/builder/build/`.

    Cross-product Builder: N slogans × M styles → N×M polished prompts.
    Backend-side validation only — frontend disables Build when N=0 or M=0
    (AC-34) and shows the confirm dialog when N×M > 30 (AC-35), so the
    backend simply enforces non-empty inputs (EC-9, EC-10) and ignores
    niche-context when no niche is linked (EC-16, EC-23).

    Phase 13b adds the form-based `slots` object (8 optional strings) that
    `build_form_prompt` consumes via the explicit → niche-hint → style-default
    → omit fallback chain. Empty strings are preserved (distinguishes
    "user touched but cleared" from "user never touched").
    """

    slogans = serializers.ListField(
        child=serializers.CharField(min_length=1, max_length=300),
        min_length=1,
        max_length=200,
        help_text='Slogan strings (combined pool selections + free-text lines).',
    )
    styles = serializers.ListField(
        child=serializers.CharField(min_length=1, max_length=64),
        min_length=1,
        max_length=15,
        help_text='Style slugs from the 15-entry library.',
    )
    background_color = serializers.ChoiceField(
        choices=Design.BackgroundColor.choices,
        default=Design.BackgroundColor.LIGHT_GRAY,
    )
    with_polish = serializers.BooleanField(default=True)
    include_niche_context = serializers.BooleanField(default=True)
    # PROJ-34 Phase 13b — Architect form slots. 8 optional strings keyed by
    # `SLOT_SCHEMA[i]['key']`. Per Appendix N.4: `DictField` of
    # blank-allowed CharFields; unknown keys rejected; whitespace-stripped.
    slots = serializers.DictField(
        child=serializers.CharField(allow_blank=True, max_length=2000),
        required=False,
        default=dict,
        help_text='Form-based Architect slots (Appendix J.3 / N.4).',
    )

    def validate_slots(self, value):
        """Reject unknown slot keys + whitespace-normalize each value."""
        from design_app.services.style_library import SLOT_SCHEMA

        valid_keys = {slot['key'] for slot in SLOT_SCHEMA}
        cleaned: dict[str, str] = {}
        for key, raw in value.items():
            if key not in valid_keys:
                raise serializers.ValidationError(
                    f'Unknown slot key: {key!r}. Valid keys: '
                    f'{sorted(valid_keys)}.',
                )
            cleaned[key] = raw.strip() if isinstance(raw, str) else raw
        return cleaned


# -- BuilderPreset (PROJ-34) --

class BuilderPresetSerializer(serializers.ModelSerializer):
    """PROJ-34: Builder preset CRUD.

    `name` validated: non-empty, length ≤ 80 (also enforced at model level).
    Server-managed fields are read-only; the unique-name-per-project
    constraint is enforced at the model level via a partial UniqueConstraint
    (only among non-deleted rows).
    """

    class Meta:
        model = BuilderPreset
        fields = [
            'id', 'workspace', 'project', 'name', 'config',
            'created_by', 'is_deleted', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'workspace', 'project', 'created_by',
            'created_at', 'updated_at',
        ]

    def validate_name(self, value):
        stripped = value.strip() if isinstance(value, str) else value
        if not stripped:
            raise serializers.ValidationError('Name must not be empty.')
        if len(stripped) > 80:
            raise serializers.ValidationError(
                'Name must be 80 characters or fewer.',
            )
        return stripped


# -- CustomSpatial (PROJ-34 Phase 13d) --

class CustomSpatialAnalyzeSerializer(serializers.Serializer):
    """PROJ-34 Phase 13d AC-72 — analyze-spatial-layout input.

    Exactly one of ``image`` / ``reference_id`` / ``design_id`` is required.
    Upload file is gated to ≤10 MB and JPG/PNG/WebP (EC-30). Verbatim from
    Appendix O.2.
    """

    image = serializers.ImageField(required=False, allow_null=True)
    reference_id = serializers.UUIDField(required=False, allow_null=True)
    design_id = serializers.UUIDField(required=False, allow_null=True)

    def validate(self, attrs):
        provided = [k for k in ('image', 'reference_id', 'design_id') if attrs.get(k)]
        if len(provided) != 1:
            raise serializers.ValidationError(
                'Provide exactly one of: image, reference_id, design_id.'
            )
        img = attrs.get('image')
        if img is not None:
            if img.size > 10 * 1024 * 1024:
                raise serializers.ValidationError({'image': 'Max 10 MB.'})
            if img.content_type not in ('image/jpeg', 'image/png', 'image/webp'):
                raise serializers.ValidationError({'image': 'Use JPG, PNG, or WebP.'})
        return attrs


class CustomSpatialSerializer(serializers.ModelSerializer):
    """PROJ-34 Phase 13d AC-71 — CustomSpatial CRUD.

    Per Appendix O.2: name 2–80 chars, prompt_text 50–500 chars, partial-unique
    name per workspace enforced at the model AND serializer levels (the
    serializer surfaces the ``name_conflict`` code so the API can return a
    clean 400 with that error code).
    """

    class Meta:
        model = CustomSpatial
        fields = [
            'id', 'name', 'prompt_text', 'source_kind', 'source_image_ref',
            'is_unsafe', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_name(self, value):
        v = value.strip()
        if len(v) < 2:
            raise serializers.ValidationError('Name too short (min 2 chars).')
        return v

    def validate_prompt_text(self, value):
        v = value.strip()
        if not (50 <= len(v) <= 500):
            raise serializers.ValidationError('prompt_text must be 50–500 chars.')
        return v

    def validate(self, attrs):
        workspace = self.context['workspace']
        name = attrs.get('name')
        qs = CustomSpatial.objects.filter(
            workspace=workspace, name=name, is_deleted=False,
        )
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                {'name': 'A custom spatial with that name already exists.'},
                code='name_conflict',
            )
        return attrs


# -- CustomTypography (PROJ-34 Phase 13i) --

class CustomTypographyAnalyzeSerializer(serializers.Serializer):
    """PROJ-34 Phase 13i — analyze-typography-style input.

    Exactly one of ``image`` / ``reference_id`` / ``design_id`` is required.
    Upload file is gated to ≤10 MB and JPG/PNG/WebP. Mirror of
    ``CustomSpatialAnalyzeSerializer``.
    """

    image = serializers.ImageField(required=False, allow_null=True)
    reference_id = serializers.UUIDField(required=False, allow_null=True)
    design_id = serializers.UUIDField(required=False, allow_null=True)

    def validate(self, attrs):
        provided = [k for k in ('image', 'reference_id', 'design_id') if attrs.get(k)]
        if len(provided) != 1:
            raise serializers.ValidationError(
                'Provide exactly one of: image, reference_id, design_id.'
            )
        img = attrs.get('image')
        if img is not None:
            if img.size > 10 * 1024 * 1024:
                raise serializers.ValidationError({'image': 'Max 10 MB.'})
            if img.content_type not in ('image/jpeg', 'image/png', 'image/webp'):
                raise serializers.ValidationError({'image': 'Use JPG, PNG, or WebP.'})
        return attrs


class CustomTypographySerializer(serializers.ModelSerializer):
    """PROJ-34 Phase 13i — CustomTypography CRUD.

    Name 2–80 chars, prompt_text 50–500 chars, partial-unique name per
    workspace enforced at the model AND serializer levels (the serializer
    surfaces the ``name_conflict`` code so the API can return a clean 400
    with that error code).
    """

    class Meta:
        model = CustomTypography
        fields = [
            'id', 'name', 'prompt_text', 'source_kind', 'source_image_ref',
            'is_unsafe', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_name(self, value):
        v = value.strip()
        if len(v) < 2:
            raise serializers.ValidationError('Name too short (min 2 chars).')
        return v

    def validate_prompt_text(self, value):
        v = value.strip()
        if not (50 <= len(v) <= 500):
            raise serializers.ValidationError('prompt_text must be 50–500 chars.')
        return v

    def validate(self, attrs):
        workspace = self.context['workspace']
        name = attrs.get('name')
        qs = CustomTypography.objects.filter(
            workspace=workspace, name=name, is_deleted=False,
        )
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                {'name': 'A custom typography with that name already exists.'},
                code='name_conflict',
            )
        return attrs


# -- PROJ-34 Phase 13t-g — NicheCardPreset (Niche-Reference Preset Picker) --


class NicheCardPresetSerializer(serializers.ModelSerializer):
    """Serialize NicheCardPreset for list/history/custom/confirm responses.

    Groups the 7 ``slot_*`` fields into a nested ``slots`` object and the 7
    ``*_is_raw`` flags into ``raw_flags``. Source metadata (``card_type`` +
    ``references``) is collapsed into a ``source`` object. Read-only — writes
    go through ``preset_persistence`` service helpers, never this serializer.
    """

    slots = serializers.SerializerMethodField()
    raw_flags = serializers.SerializerMethodField()
    source = serializers.SerializerMethodField()

    class Meta:
        model = NicheCardPreset
        fields = (
            'id',
            'preset_label',
            'preset_hash',
            'slots',
            'raw_flags',
            'source',
            'reference_thumbnail_url',
            'is_in_history',
            'is_in_custom',
            'custom_promoted_by',
            'custom_promoted_at',
            'last_clicked_at',
            'created_at',
        )
        read_only_fields = fields

    def get_slots(self, obj):
        return {
            'spatial_configuration': obj.slot_spatial_configuration,
            'visual_description': obj.slot_visual_description,
            'typography_adjectives': obj.slot_typography_adjectives,
            'font_combination': obj.slot_font_combination,
            'accessories': obj.slot_accessories,
            'style_dna': obj.slot_style_dna,
            'extra_context': obj.slot_extra_context,
        }

    def get_raw_flags(self, obj):
        return {
            'spatial_configuration': obj.spatial_is_raw,
            'visual_description': obj.visual_is_raw,
            'typography_adjectives': obj.typography_is_raw,
            'font_combination': obj.font_combination_is_raw,
            'accessories': obj.accessories_is_raw,
            'style_dna': obj.style_dna_is_raw,
            'extra_context': obj.extra_context_is_raw,
        }

    def get_source(self, obj):
        return {
            'card_type': obj.source_card_type,
            'references': obj.source_card_references or [],
        }


class PresetConfirmSerializer(serializers.Serializer):
    """Body for POST /api/designs/preset-cards/confirm/.

    Two paths:
      * ``preset_id`` — preset already persisted (History / Custom / Mix).
        Endpoint bumps ``last_clicked_at`` only.
      * ``preset_dict`` + ``source_card_type`` + ``source_refs`` — Top-Card
        path (preset computed on the fly from a vision row, not yet in DB).
        Endpoint calls ``upsert_preset`` to insert + dedup + LRU-evict.

    Exactly one of the two paths must be provided.
    """

    SOURCE_CARD_TYPE_CHOICES = (
        'top',
        'mix_most_common',
        'mix_edgy',
        'mix_safe',
    )

    preset_id = serializers.UUIDField(required=False, allow_null=True)
    preset_dict = serializers.DictField(required=False, allow_null=True)
    source_card_type = serializers.ChoiceField(
        choices=SOURCE_CARD_TYPE_CHOICES,
        required=False, allow_null=True,
    )
    source_refs = serializers.ListField(
        child=serializers.DictField(),
        required=False, allow_null=True,
    )

    def validate(self, attrs):
        has_id = attrs.get('preset_id') is not None
        has_dict = attrs.get('preset_dict') is not None
        if has_id == has_dict:
            raise serializers.ValidationError(
                'Provide exactly one of: preset_id OR preset_dict '
                '(with source_card_type + source_refs).',
            )
        if has_dict:
            if not attrs.get('source_card_type'):
                raise serializers.ValidationError(
                    {'source_card_type': 'Required with preset_dict.'},
                )
            if not attrs.get('source_refs'):
                raise serializers.ValidationError(
                    {'source_refs': 'Required with preset_dict.'},
                )
        return attrs


class PresetRegenerateSerializer(serializers.Serializer):
    """Body for POST /api/designs/preset-cards/regenerate-mix/."""

    niche_id = serializers.UUIDField()
