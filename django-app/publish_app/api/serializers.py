"""DRF serializers for publish_app API."""

from rest_framework import serializers

from publish_app.models import (
    DesignAsset,
    Listing,
    ProductLifecycle,
    UploadJob,
    UploadTemplate,
)


# ---------------------------------------------------------------------------
# Listing
# ---------------------------------------------------------------------------

class ListingSerializer(serializers.ModelSerializer):
    """Full listing representation."""

    idea_slogan = serializers.SerializerMethodField()
    design_file_name = serializers.SerializerMethodField()

    class Meta:
        model = Listing
        fields = [
            'id', 'workspace', 'idea', 'idea_slogan', 'design',
            'design_file_name', 'round', 'brand_name', 'title',
            'bullet_1', 'bullet_2', 'bullet_3', 'bullet_4', 'bullet_5',
            'description', 'backend_keywords', 'status', 'generated_by',
            'availability', 'publish_mode', 'language', 'translations',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'workspace', 'generated_by', 'created_at', 'updated_at',
        ]

    def get_idea_slogan(self, obj):
        if obj.idea:
            return obj.idea.slogan_text[:120]
        return None

    def get_design_file_name(self, obj):
        if obj.design:
            return obj.design.file_name
        return None


class ListingGenerateSerializer(serializers.Serializer):
    """Input for AI listing generation."""

    design_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    extra_keywords = serializers.CharField(
        required=False, default='', allow_blank=True,
    )
    language = serializers.CharField(required=False, default='en')


class ListingUpdateSerializer(serializers.ModelSerializer):
    """Partial update for listings. Status reverts to draft on edit."""

    class Meta:
        model = Listing
        fields = [
            'brand_name', 'title', 'bullet_1', 'bullet_2', 'bullet_3',
            'bullet_4', 'bullet_5', 'description', 'backend_keywords',
            'status', 'availability', 'publish_mode', 'design',
        ]
        extra_kwargs = {field: {'required': False} for field in fields}


class ListingTranslateSerializer(serializers.Serializer):
    """Input for AI translation."""

    target_languages = serializers.ListField(
        child=serializers.CharField(max_length=5),
        min_length=1,
        max_length=10,
    )


class ListingExportSerializer(serializers.Serializer):
    """Export format: plain-text MBA format."""

    format = serializers.ChoiceField(
        choices=['plain_text', 'csv'],
        default='plain_text',
        required=False,
    )


class TMCheckSerializer(serializers.Serializer):
    """Trademark check results."""

    flagged_terms = serializers.ListField(
        child=serializers.DictField(),
        read_only=True,
    )


# ---------------------------------------------------------------------------
# Design Gallery
# ---------------------------------------------------------------------------

class DesignAssetSerializer(serializers.ModelSerializer):
    """Full design asset representation."""

    has_listing = serializers.SerializerMethodField()
    niche_name = serializers.SerializerMethodField()

    class Meta:
        model = DesignAsset
        fields = [
            'id', 'workspace', 'file_name', 'file', 'file_url', 'source',
            'source_file_id', 'thumbnail_url', 'dimensions', 'file_size',
            'tags', 'listing', 'idea', 'niche', 'niche_name', 'round',
            'has_listing', 'created_by', 'created_at',
        ]
        read_only_fields = [
            'id', 'workspace', 'source', 'file_size', 'dimensions',
            'created_by', 'created_at',
        ]

    def get_has_listing(self, obj):
        return obj.listing_id is not None

    def get_niche_name(self, obj):
        if obj.niche:
            return obj.niche.name
        return None


class DesignAssetUploadSerializer(serializers.Serializer):
    """Direct file upload."""

    file = serializers.FileField()
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        default=list,
    )
    niche_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    idea_id = serializers.UUIDField(required=False, allow_null=True, default=None)


class DesignAssetUpdateSerializer(serializers.ModelSerializer):
    """Partial update: tags, linking."""

    class Meta:
        model = DesignAsset
        fields = ['tags', 'niche', 'idea', 'listing']
        extra_kwargs = {field: {'required': False} for field in fields}


class CloudImportSerializer(serializers.Serializer):
    """Import files from Google Drive or OneDrive."""

    file_ids = serializers.ListField(
        child=serializers.CharField(max_length=255),
        min_length=1,
        max_length=50,
    )
    provider = serializers.ChoiceField(choices=['google_drive', 'onedrive'])


class BulkActionSerializer(serializers.Serializer):
    """Bulk actions on designs."""

    ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        max_length=100,
    )
    action = serializers.ChoiceField(
        choices=['apply_template', 'apply_listing', 'delete'],
    )
    source_id = serializers.UUIDField(required=False, allow_null=True, default=None)


# ---------------------------------------------------------------------------
# Upload Job
# ---------------------------------------------------------------------------

class UploadJobSerializer(serializers.ModelSerializer):
    """Full upload job representation."""

    listing_title = serializers.SerializerMethodField()
    design_file_name = serializers.SerializerMethodField()

    class Meta:
        model = UploadJob
        fields = [
            'id', 'workspace', 'listing', 'listing_title', 'design',
            'design_file_name', 'template', 'listing_snapshot', 'marketplace',
            'status', 'asin', 'upload_date', 'error_message',
            'error_screenshot', 'retry_count', 'queued_at', 'started_at',
            'completed_at', 'created_by',
        ]
        read_only_fields = [
            'id', 'workspace', 'listing_snapshot', 'queued_at',
            'created_by',
        ]

    def get_listing_title(self, obj):
        if obj.listing:
            return obj.listing.title[:80]
        return obj.listing_snapshot.get('title', '')[:80]

    def get_design_file_name(self, obj):
        if obj.design:
            return obj.design.file_name
        return None


class UploadJobCreateSerializer(serializers.Serializer):
    """Create a single upload job."""

    listing_id = serializers.UUIDField()
    design_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    template_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    marketplace = serializers.CharField(max_length=20)


class UploadJobBatchSerializer(serializers.Serializer):
    """Batch create upload jobs."""

    design_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        max_length=50,
    )
    template_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    marketplace = serializers.CharField(max_length=20)


class UploadJobStatusUpdateSerializer(serializers.Serializer):
    """Desktop App reports status updates."""

    status = serializers.ChoiceField(
        choices=['validating', 'uploading', 'completed', 'failed'],
    )
    asin = serializers.CharField(max_length=20, required=False, default='')
    error_message = serializers.CharField(required=False, default='', allow_blank=True)
    error_screenshot = serializers.URLField(
        required=False, default='', allow_blank=True,
    )


# ---------------------------------------------------------------------------
# Upload Template
# ---------------------------------------------------------------------------

class UploadTemplateSerializer(serializers.ModelSerializer):
    """Full template representation."""

    class Meta:
        model = UploadTemplate
        fields = [
            'id', 'workspace', 'name', 'brand_name', 'product_types',
            'fit_types', 'colors', 'marketplaces', 'print_side',
            'created_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'workspace', 'created_by', 'created_at', 'updated_at']


class UploadTemplateCreateSerializer(serializers.ModelSerializer):
    """Create/update template."""

    class Meta:
        model = UploadTemplate
        fields = [
            'name', 'brand_name', 'product_types', 'fit_types',
            'colors', 'marketplaces', 'print_side',
        ]
        extra_kwargs = {
            'name': {'required': True},
        }


# ---------------------------------------------------------------------------
# Product Lifecycle
# ---------------------------------------------------------------------------

class ProductLifecycleSerializer(serializers.ModelSerializer):
    """Full lifecycle chain."""

    niche_name = serializers.SerializerMethodField()
    idea_slogan = serializers.SerializerMethodField()
    design_file_name = serializers.SerializerMethodField()
    listing_title = serializers.SerializerMethodField()

    class Meta:
        model = ProductLifecycle
        fields = [
            'id', 'workspace', 'niche', 'niche_name', 'idea', 'idea_slogan',
            'design', 'design_file_name', 'listing', 'listing_title',
            'upload_job', 'asin', 'marketplace', 'upload_date',
            'sales_units', 'sales_revenue', 'current_bsr',
            'reviews_count', 'reviews_rating', 'round', 'updated_at',
        ]
        read_only_fields = [
            'id', 'workspace', 'niche', 'updated_at',
        ]

    def get_niche_name(self, obj):
        if obj.niche:
            return obj.niche.name
        return None

    def get_idea_slogan(self, obj):
        if obj.idea:
            return obj.idea.slogan_text[:100]
        return None

    def get_design_file_name(self, obj):
        if obj.design:
            return obj.design.file_name
        return None

    def get_listing_title(self, obj):
        if obj.listing:
            return obj.listing.title[:80]
        return None


class LifecycleSalesUpdateSerializer(serializers.Serializer):
    """Update sales data from browser extension or API."""

    sales_units = serializers.IntegerField(required=False, allow_null=True)
    sales_revenue = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, allow_null=True,
    )
    current_bsr = serializers.IntegerField(required=False, allow_null=True)
    reviews_count = serializers.IntegerField(required=False, allow_null=True)
    reviews_rating = serializers.DecimalField(
        max_digits=3, decimal_places=2, required=False, allow_null=True,
    )
