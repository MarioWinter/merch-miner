"""DRF serializers for publish_app API."""

from rest_framework import serializers

from publish_app.constants import MBA_COLORS
from publish_app.models import (
    DesignAsset,
    DesignCollection,
    DesignProductConfig,
    Listing,
    ProductLifecycle,
    UploadJob,
    UploadTemplate,
)

MBA_COLOR_KEYS = {entry['key'] for entry in MBA_COLORS}


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
            'design_file_name', 'marketplace_type', 'round',
            'brand_name', 'title',
            'bullet_1', 'bullet_2',
            'description', 'keyword_context', 'status', 'generated_by',
            'availability', 'publish_mode', 'language', 'translations',
            'is_template', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'workspace', 'generated_by', 'is_template',
            'created_at', 'updated_at',
        ]

    def get_idea_slogan(self, obj):
        if obj.idea:
            return obj.idea.slogan_text[:120]
        return None

    def get_design_file_name(self, obj):
        if obj.design:
            return obj.design.file_name
        return None


class ListingUpdateSerializer(serializers.ModelSerializer):
    """Partial update for listings. Status reverts to draft on edit.

    Note: DRF auto-generates a UniqueTogetherValidator from the model's
    UniqueConstraint on (design, marketplace_type). We strip it here so that
    conflicts bubble up to the view as DB-level IntegrityError and can be
    mapped to HTTP 409 (see ListingUpdateView.patch).

    EC-21: ``is_template`` is write-once at creation. PATCH rejects any
    attempt to flip it with a 400 ValidationError.
    """

    # Accept `is_template` only so we can reject it with a clear 400 instead
    # of silently ignoring it (which would happen if we just left it off).
    is_template = serializers.BooleanField(required=False)

    # EC-42: keyword_context is AI-input only, not user-facing listing copy.
    # Explicit field decl keeps max_length=500 + allow_blank=True, and lets
    # us document the non-status-reverting behavior in one place.
    keyword_context = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=500,
    )

    class Meta:
        model = Listing
        fields = [
            'brand_name', 'title', 'bullet_1', 'bullet_2',
            'description', 'keyword_context',
            'status', 'availability', 'publish_mode', 'design',
            'marketplace_type', 'is_template',
        ]
        extra_kwargs = {field: {'required': False} for field in fields}
        validators = []  # disable auto unique-together validator -> 409 at DB

    def validate_is_template(self, value):
        # EC-21: disallow flipping is_template after creation.
        raise serializers.ValidationError(
            'is_template is write-once at creation and cannot be changed.',
        )

    def validate(self, attrs):
        # EC-16: if a caller passes both `design` and the instance is a
        # template, reject. Templates must keep design=NULL.
        instance = self.instance
        new_design = attrs.get('design', getattr(instance, 'design', None))
        is_template = getattr(instance, 'is_template', False)
        if is_template and new_design is not None:
            raise serializers.ValidationError(
                {'design': 'Template listings cannot be linked to a design'},
            )
        return attrs


class ListingTemplateCreateSerializer(serializers.ModelSerializer):
    """Create a standalone Listing Template (is_template=True, design=None).

    AC-48: body accepts ``brand_name, title, bullet_1, bullet_2, description,
    keyword_context, language, marketplace_type, idea``. ``idea`` is
    required for workspace scoping. ``is_template`` and ``design`` are
    forced server-side regardless of request body.

    EC-16: if the caller sends ``design``, we reject with 400.
    """

    # Accept `design` only to detect and reject it -> 400 (EC-16).
    design = serializers.PrimaryKeyRelatedField(
        queryset=DesignAsset.objects.all(),
        required=False,
        allow_null=True,
        default=None,
    )

    class Meta:
        model = Listing
        fields = [
            'idea', 'marketplace_type', 'brand_name', 'title',
            'bullet_1', 'bullet_2',
            'description', 'keyword_context', 'language', 'design',
        ]
        extra_kwargs = {
            'idea': {'required': True},
            'marketplace_type': {'required': False},
            'keyword_context': {'required': False, 'allow_blank': True},
        }

    def validate(self, attrs):
        # EC-16: templates may not reference a design. If the caller
        # supplied any design value (even null), we coerce to null, but a
        # non-null value is a user error and returns 400 with a clear msg.
        design = attrs.get('design')
        if design is not None:
            raise serializers.ValidationError(
                {'design': 'Template listings cannot be linked to a design'},
            )
        # Strip `design` from the payload; the view forces design=None.
        attrs.pop('design', None)
        return attrs


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


# ---------------------------------------------------------------------------
# Design Gallery
# ---------------------------------------------------------------------------

class DesignAssetSerializer(serializers.ModelSerializer):
    """Full design asset representation."""

    has_listing = serializers.SerializerMethodField()
    niche_name = serializers.SerializerMethodField()
    collection_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = DesignAsset
        fields = [
            'id', 'workspace', 'file_name', 'file', 'file_url', 'source',
            'source_file_id', 'thumbnail_url', 'dimensions', 'file_size',
            'tags', 'collection', 'collection_name', 'listing', 'idea',
            'niche', 'niche_name', 'round',
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

    def get_collection_name(self, obj):
        if obj.collection:
            return obj.collection.name
        return None

    def get_file_url(self, obj):
        # Prefer stored URL (external sources); fall back to FileField URL.
        if obj.file_url:
            return obj.file_url
        if obj.file:
            try:
                return obj.file.url
            except ValueError:
                return ''
        return ''

    def get_thumbnail_url(self, obj):
        # No thumbnail pipeline yet — fall back to the full image URL so
        # <img> tags render instead of showing the missing-image placeholder.
        if obj.thumbnail_url:
            return obj.thumbnail_url
        return self.get_file_url(obj)


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
    """Partial update: tags, linking.

    AC-63 / EC-25 / EC-26 — tag validation rules:
      * Each tag stripped of surrounding whitespace.
      * Whitespace-only tags rejected.
      * Per-tag max length 20 characters.
      * Max 10 tags total per design.
      * Duplicate tags deduplicated in order of first occurrence
        (not treated as an error — client-side dedup is the first line
        of defense, the serializer is defensive).
    """

    MAX_TAG_LENGTH = 20
    MAX_TAG_COUNT = 10

    class Meta:
        model = DesignAsset
        fields = ['tags', 'niche', 'idea', 'listing']
        extra_kwargs = {field: {'required': False} for field in fields}

    def validate_tags(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('tags must be a list.')

        cleaned = []
        seen = set()
        for i, raw in enumerate(value):
            if not isinstance(raw, str):
                raise serializers.ValidationError(
                    f'tags[{i}] must be a string.',
                )
            tag = raw.strip()
            if not tag:
                raise serializers.ValidationError(
                    f'tags[{i}] cannot be empty or whitespace-only.',
                )
            if len(tag) > self.MAX_TAG_LENGTH:
                raise serializers.ValidationError(
                    f'Tag too long (max {self.MAX_TAG_LENGTH} chars): '
                    f'{tag[:30]!r}',
                )
            if tag in seen:
                continue  # dedupe silently, keep first occurrence
            seen.add(tag)
            cleaned.append(tag)

        if len(cleaned) > self.MAX_TAG_COUNT:
            raise serializers.ValidationError(
                f'Maximum {self.MAX_TAG_COUNT} tags allowed '
                f'(got {len(cleaned)}).',
            )
        return cleaned


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
# Design Collection
# ---------------------------------------------------------------------------

class CollectionSerializer(serializers.ModelSerializer):
    """Collection folder with child/asset counts."""

    child_count = serializers.SerializerMethodField()
    asset_count = serializers.SerializerMethodField()

    class Meta:
        model = DesignCollection
        fields = [
            'id', 'workspace', 'name', 'parent', 'position',
            'child_count', 'asset_count',
            'created_by', 'created_at',
        ]
        read_only_fields = [
            'id', 'workspace', 'position', 'created_by', 'created_at',
        ]

    def get_child_count(self, obj):
        if hasattr(obj, '_child_count'):
            return obj._child_count
        return obj.children.count()

    def get_asset_count(self, obj):
        if hasattr(obj, '_asset_count'):
            return obj._asset_count
        return obj.assets.count()


class CollectionCreateSerializer(serializers.Serializer):
    """Create a collection folder."""

    name = serializers.CharField(max_length=200)
    parent = serializers.UUIDField(required=False, allow_null=True, default=None)


class CollectionUpdateSerializer(serializers.Serializer):
    """Rename or move a collection folder."""

    name = serializers.CharField(max_length=200, required=False)
    parent = serializers.UUIDField(required=False, allow_null=True)


class CollectionTreeSerializer(serializers.ModelSerializer):
    """Recursive tree serializer for folder explorer."""

    children = serializers.SerializerMethodField()
    asset_count = serializers.SerializerMethodField()

    class Meta:
        model = DesignCollection
        fields = ['id', 'name', 'parent', 'position', 'asset_count', 'children']

    def get_children(self, obj):
        # Use prefetched children if available, else query
        children = obj.children.all()
        return CollectionTreeSerializer(children, many=True, context=self.context).data

    def get_asset_count(self, obj):
        if hasattr(obj, '_asset_count'):
            return obj._asset_count
        return obj.assets.count()


class MoveAssetsSerializer(serializers.Serializer):
    """Move assets to a collection (or root)."""

    asset_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        max_length=100,
    )
    collection_id = serializers.UUIDField(required=False, allow_null=True, default=None)


# ---------------------------------------------------------------------------
# Upload Job
# ---------------------------------------------------------------------------

class UploadJobSerializer(serializers.ModelSerializer):
    """Full upload job representation.

    AC-44: includes the ``DesignProductConfig`` for the job's design at the
    job's marketplace type so the Desktop Upload App can determine the
    MBA variant matrix (product_types x fit_types x colors x marketplaces).
    """

    listing_title = serializers.SerializerMethodField()
    design_file_name = serializers.SerializerMethodField()
    product_config = serializers.SerializerMethodField()

    class Meta:
        model = UploadJob
        fields = [
            'id', 'workspace', 'listing', 'listing_title', 'design',
            'design_file_name', 'template', 'listing_snapshot',
            'product_config', 'marketplace',
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

    def get_product_config(self, obj):
        if not obj.design_id:
            return None
        marketplace_type = (
            obj.listing.marketplace_type if obj.listing
            else DesignProductConfig.MarketplaceType.MBA
        )
        config = (
            DesignProductConfig.objects
            .filter(design_id=obj.design_id, marketplace_type=marketplace_type)
            .first()
        )
        if not config:
            return None
        return DesignProductConfigSerializer(config).data


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
    """Full template representation.

    PROJ-11 Phase K2 (2026-04-23): exposes ``products_config`` (per-product
    list) instead of the legacy flat fields. Same schema as
    ``DesignProductConfigSerializer.products_config`` so Convert auto-apply
    (AC-57) can copy the list verbatim.
    """

    class Meta:
        model = UploadTemplate
        fields = [
            'id', 'workspace', 'name', 'brand_name', 'products_config',
            'marketplace_type', 'is_default',
            'created_by', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'workspace', 'created_by', 'created_at', 'updated_at',
        ]


class UploadTemplateCreateSerializer(serializers.ModelSerializer):
    """Create/update template.

    PROJ-11 Phase K2: accepts ``products_config`` (same per-product entry
    contract as ``DesignProductConfig``). MVP-safe validation (Q1=A) —
    shape + types + MBA color palette + price>=0. Full catalog-referential
    validation lands in Phase L.
    """

    class Meta:
        model = UploadTemplate
        fields = [
            'name', 'brand_name', 'products_config',
            'marketplace_type', 'is_default',
        ]
        extra_kwargs = {
            'name': {'required': True},
            'brand_name': {'required': False},
            'products_config': {'required': False},
            'marketplace_type': {'required': False},
            'is_default': {'required': False},
        }

    def validate(self, attrs):
        # Validate products_config shape against the effective marketplace_type
        # (body value on write, or the existing row's value on PATCH).
        products_config = attrs.get('products_config', None)
        if products_config is None:
            return attrs

        effective_mt = attrs.get('marketplace_type')
        if effective_mt is None:
            instance = getattr(self, 'instance', None)
            effective_mt = (
                getattr(instance, 'marketplace_type', None)
                or UploadTemplate.MarketplaceType.MBA
            )

        _validate_products_config(products_config, effective_mt)
        return attrs


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


# ---------------------------------------------------------------------------
# Design Product Config (PROJ-11 F4 / Phase J2 — 2026-04-23)
# ---------------------------------------------------------------------------
#
# Phase J2 scope (per user decisions 2026-04-23):
# - Q1=A: MVP-safe validation only. Shape + types + `colors` (MBA) + price>=0.
#   Full catalog-referential validation (catalog keys, per-product allowed
#   values) lands in Phase L when MBA_PRODUCT_CATALOG exists.
# - Q2=A: `_seed_product_config_from_default` stubbed to return None until
#   Phase K3 (UploadTemplate shape alignment). `product_config_seeded=False`
#   on every Convert response until then.
# - Q3=A: Tests in test_design_product_config.py rewritten in same phase.

# Entry field contract (per AC-38):
#   {
#     "product_type": str,
#     "enabled": bool,
#     "fit_types": [str],
#     "print_side": "front" | "back" | "both",
#     "colors": [str],
#     "marketplaces": [{"marketplace": str, "price": number>=0, "enabled": bool}],
#   }
PRODUCT_ENTRY_FIELDS = {
    'product_type', 'enabled', 'fit_types', 'print_side', 'colors',
    'marketplaces',
}
# Fields valid for `scope=<field>` copy-from (per AC-41).
PRODUCT_ENTRY_SCOPE_FIELDS = {
    'fit_types', 'print_side', 'colors', 'marketplaces', 'enabled',
}
# Full scope choices accepted by copy-from (`all` is the wholesale case).
COPY_SCOPE_CHOICES = ['all', *sorted(PRODUCT_ENTRY_SCOPE_FIELDS)]

VALID_PRINT_SIDES = {c[0] for c in DesignProductConfig.PrintSide.choices}


def _validate_entry_marketplaces(entries, entry_index):
    """Validate entry.marketplaces[] shape.

    MVP-safe (J2 / Q1=A): each entry must be
    ``{marketplace: str, price: number >= 0, enabled: bool}``.
    Full marketplace-key catalog check lands in Phase L.
    """
    if not isinstance(entries, list):
        raise serializers.ValidationError(
            f'products_config[{entry_index}].marketplaces must be a list.',
        )
    for i, entry in enumerate(entries):
        prefix = f'products_config[{entry_index}].marketplaces[{i}]'
        if not isinstance(entry, dict):
            raise serializers.ValidationError(f'{prefix} must be an object.')

        marketplace = entry.get('marketplace')
        if not isinstance(marketplace, str) or not marketplace.strip():
            raise serializers.ValidationError(
                f'{prefix}.marketplace must be a non-empty string.',
            )

        price = entry.get('price')
        if price is None:
            raise serializers.ValidationError(f'{prefix}.price is required.')
        try:
            price_val = float(price)
        except (TypeError, ValueError):
            raise serializers.ValidationError(
                f'{prefix}.price must be a number.',
            )
        # AC-38 MVP-safe: price >= 0 (free is allowed; negative is not).
        if price_val < 0:
            raise serializers.ValidationError(f'{prefix}.price must be >= 0.')

        enabled = entry.get('enabled')
        if not isinstance(enabled, bool):
            raise serializers.ValidationError(
                f'{prefix}.enabled must be a boolean.',
            )


def _validate_entry_colors_for_mba(colors, marketplace_type, entry_index):
    """Validate entry.colors[] is a list of strings; MBA palette when mba.

    Q1=A: only the MBA palette is enforced here. Per-product color-subset
    filtering moves to Phase L via the catalog helper.
    """
    if not isinstance(colors, list):
        raise serializers.ValidationError(
            f'products_config[{entry_index}].colors must be a list.',
        )
    if not all(isinstance(c, str) for c in colors):
        raise serializers.ValidationError(
            f'products_config[{entry_index}].colors must be strings.',
        )
    if marketplace_type != DesignProductConfig.MarketplaceType.MBA:
        return
    unknown = [c for c in colors if c not in MBA_COLOR_KEYS]
    if unknown:
        raise serializers.ValidationError(
            f'products_config[{entry_index}].colors contains unknown MBA '
            f'color keys: {sorted(set(unknown))}',
        )


def _validate_entry_shape(entry, index, marketplace_type, *, require_all=True):
    """Validate one ``products_config`` entry.

    When ``require_all`` is False (targeted-op patch), missing keys are
    allowed. When True (full replace), any missing key is rejected.
    """
    if not isinstance(entry, dict):
        raise serializers.ValidationError(
            f'products_config[{index}] must be an object.',
        )

    unknown_keys = set(entry.keys()) - PRODUCT_ENTRY_FIELDS
    if unknown_keys:
        raise serializers.ValidationError(
            f'products_config[{index}] contains unknown keys: '
            f'{sorted(unknown_keys)}',
        )

    if require_all:
        missing = PRODUCT_ENTRY_FIELDS - set(entry.keys())
        if missing:
            raise serializers.ValidationError(
                f'products_config[{index}] missing required keys: '
                f'{sorted(missing)}',
            )

    if 'product_type' in entry:
        pt = entry['product_type']
        if not isinstance(pt, str) or not pt.strip():
            raise serializers.ValidationError(
                f'products_config[{index}].product_type must be a non-empty '
                f'string.',
            )

    if 'enabled' in entry and not isinstance(entry['enabled'], bool):
        raise serializers.ValidationError(
            f'products_config[{index}].enabled must be a boolean.',
        )

    if 'fit_types' in entry:
        ft = entry['fit_types']
        if not isinstance(ft, list) or not all(isinstance(f, str) for f in ft):
            raise serializers.ValidationError(
                f'products_config[{index}].fit_types must be a list of '
                f'strings.',
            )

    if 'print_side' in entry:
        ps = entry['print_side']
        if ps not in VALID_PRINT_SIDES:
            raise serializers.ValidationError(
                f'products_config[{index}].print_side must be one of '
                f'{sorted(VALID_PRINT_SIDES)}.',
            )

    if 'colors' in entry:
        _validate_entry_colors_for_mba(
            entry['colors'], marketplace_type, index,
        )

    if 'marketplaces' in entry:
        _validate_entry_marketplaces(entry['marketplaces'], index)


def _validate_products_config(value, marketplace_type):
    """Validate full `products_config` payload (full-replace form)."""
    if not isinstance(value, list):
        raise serializers.ValidationError('products_config must be a list.')

    seen_keys = set()
    for i, entry in enumerate(value):
        _validate_entry_shape(entry, i, marketplace_type, require_all=True)
        pt = entry['product_type']
        if pt in seen_keys:
            raise serializers.ValidationError(
                f'products_config[{i}].product_type duplicate key: {pt!r}.',
            )
        seen_keys.add(pt)
    return value


class DesignProductConfigSerializer(serializers.ModelSerializer):
    """Full representation of a DesignProductConfig row.

    AC-38 (Phase J2): ``products_config`` is a list of per-product entries.
    """

    class Meta:
        model = DesignProductConfig
        fields = [
            'id', 'design', 'marketplace_type',
            'products_config',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'design', 'created_at', 'updated_at',
        ]


class DesignProductConfigUpsertSerializer(serializers.Serializer):
    """Input for PATCH upsert. Two accepted body shapes:

    1. Full replace: ``{marketplace_type, products_config: [...]}`` — wholesale
       overwrite of the entry list for ``(design, marketplace_type)``.
    2. Targeted op: ``{marketplace_type, op: 'upsert_product', product_type,
       patch: {...}}`` — merge patch into the matching entry by ``product_type``
       or append a new entry when it doesn't yet exist (AC-40).

    ``marketplace_type`` is required in both shapes.
    """

    OP_UPSERT_PRODUCT = 'upsert_product'
    OP_CHOICES = [OP_UPSERT_PRODUCT]

    marketplace_type = serializers.ChoiceField(
        choices=DesignProductConfig.MarketplaceType.choices,
    )
    # Full-replace form.
    products_config = serializers.ListField(
        child=serializers.DictField(),
        required=False,
    )
    # Targeted-op form.
    op = serializers.ChoiceField(choices=OP_CHOICES, required=False)
    product_type = serializers.CharField(max_length=50, required=False)
    patch = serializers.DictField(required=False)

    def validate(self, attrs):
        marketplace_type = attrs['marketplace_type']
        has_replace = 'products_config' in attrs
        has_op = 'op' in attrs

        if has_replace and has_op:
            raise serializers.ValidationError(
                'Provide either `products_config` (full replace) or '
                '`op` (targeted) — not both.',
            )
        if not has_replace and not has_op:
            raise serializers.ValidationError(
                'Body must contain either `products_config` (full replace) '
                'or `op` (targeted).',
            )

        if has_replace:
            _validate_products_config(
                attrs['products_config'], marketplace_type,
            )
            return attrs

        # Targeted op branch.
        if attrs['op'] == self.OP_UPSERT_PRODUCT:
            if 'product_type' not in attrs or not attrs['product_type'].strip():
                raise serializers.ValidationError(
                    'op=upsert_product requires non-empty `product_type`.',
                )
            if 'patch' not in attrs or not isinstance(attrs['patch'], dict):
                raise serializers.ValidationError(
                    'op=upsert_product requires `patch` object.',
                )
            # Validate patch fields match a partial entry shape (no
            # require_all). `product_type` inside `patch` is redundant; drop it.
            patch = dict(attrs['patch'])
            patch.pop('product_type', None)
            _validate_entry_shape(
                patch, 0, marketplace_type, require_all=False,
            )
            attrs['patch'] = patch
        return attrs


class DesignProductConfigCopyFromSerializer(serializers.Serializer):
    """Input for copy-from (AC-41).

    Body:
      - ``source_design_id``: UUID of source design.
      - ``marketplace_type``: marketplace to copy.
      - ``scope``: ``all`` or one of ``fit_types``/``print_side``/``colors``/
        ``marketplaces``/``enabled``.
      - ``product_type``: optional. When provided, scoped copy targets only the
        matching entry on source + target. When omitted (scalar scope), the
        value is applied across all target entries.
    """

    source_design_id = serializers.UUIDField()
    marketplace_type = serializers.ChoiceField(
        choices=DesignProductConfig.MarketplaceType.choices,
    )
    scope = serializers.ChoiceField(choices=COPY_SCOPE_CHOICES)
    product_type = serializers.CharField(
        max_length=50, required=False, allow_blank=False,
    )


# ---------------------------------------------------------------------------
# Listing Conversion (PROJ-11 F3)
# ---------------------------------------------------------------------------

class ListingConvertSerializer(serializers.Serializer):
    """Input for marketplace conversion.

    ``source_listing_id``: UUID of the source Listing (any marketplace_type).
    ``target_marketplace_type``: destination marketplace variant.
    ``overwrite``: if True, updates an existing target Listing in-place;
    if False, 409 when a target already exists.
    """

    source_listing_id = serializers.UUIDField()
    target_marketplace_type = serializers.ChoiceField(
        choices=Listing.MarketplaceType.choices,
    )
    overwrite = serializers.BooleanField(required=False, default=False)
