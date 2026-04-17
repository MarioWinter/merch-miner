import uuid

from django.conf import settings
from django.db import models


class DesignCollection(models.Model):
    """Server-side folder system for organizing DesignAssets (MyDesigns-style)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='design_collections',
        db_index=True,
    )
    name = models.CharField(max_length=200)
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children',
        help_text='Parent folder. Null = root level.',
    )
    position = models.IntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_design_collections',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['position', 'name']
        indexes = [
            models.Index(
                fields=['workspace', 'parent'],
                name='collection_ws_parent_idx',
            ),
        ]

    def __str__(self):
        return f"Collection: {self.name}"


class Listing(models.Model):
    """MBA listing linked to an Idea and optionally a DesignAsset."""

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        READY = 'ready', 'Ready'
        PUBLISHED = 'published', 'Published'

    class GeneratedBy(models.TextChoices):
        AI = 'ai', 'AI'
        MANUAL = 'manual', 'Manual'

    class Availability(models.TextChoices):
        PUBLIC = 'public', 'Public'
        PRIVATE = 'private', 'Private'

    class PublishMode(models.TextChoices):
        LIVE = 'live', 'Live'
        DRAFT = 'draft', 'Draft'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='listings',
        db_index=True,
    )
    idea = models.ForeignKey(
        'idea_app.Idea',
        on_delete=models.CASCADE,
        related_name='listings',
        db_index=True,
    )
    design = models.ForeignKey(
        'publish_app.DesignAsset',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='listings',
    )
    round = models.PositiveIntegerField(default=1)

    # MBA listing fields
    brand_name = models.CharField(max_length=50, blank=True, default='')
    title = models.CharField(max_length=60, blank=True, default='')
    bullet_1 = models.CharField(max_length=256, blank=True, default='')
    bullet_2 = models.CharField(max_length=256, blank=True, default='')
    bullet_3 = models.CharField(max_length=256, blank=True, default='')
    bullet_4 = models.CharField(max_length=256, blank=True, default='')
    bullet_5 = models.CharField(max_length=256, blank=True, default='')
    description = models.TextField(max_length=2000, blank=True, default='')
    backend_keywords = models.CharField(max_length=500, blank=True, default='')

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    generated_by = models.CharField(
        max_length=10,
        choices=GeneratedBy.choices,
        default=GeneratedBy.MANUAL,
    )
    availability = models.CharField(
        max_length=10,
        choices=Availability.choices,
        default=Availability.PUBLIC,
    )
    publish_mode = models.CharField(
        max_length=10,
        choices=PublishMode.choices,
        default=PublishMode.LIVE,
    )
    language = models.CharField(max_length=5, default='en')
    translations = models.JSONField(
        default=dict,
        blank=True,
        help_text='Per-language translations: {lang: {title, bullets, description}}',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['workspace', 'status'],
                name='listing_ws_status_idx',
            ),
            models.Index(
                fields=['idea'],
                name='listing_idea_idx',
            ),
        ]

    def __str__(self):
        return f"Listing {str(self.id)[:8]} [{self.status}]"


class UploadTemplate(models.Model):
    """Reusable product/marketplace config template."""

    class PrintSide(models.TextChoices):
        FRONT = 'front', 'Front'
        BACK = 'back', 'Back'
        BOTH = 'both', 'Both'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='upload_templates',
        db_index=True,
    )
    name = models.CharField(max_length=100)
    brand_name = models.CharField(max_length=50, blank=True, default='')
    product_types = models.JSONField(
        default=list,
        blank=True,
        help_text='List of product type keys (e.g. standard_tshirt, hoodie)',
    )
    fit_types = models.JSONField(
        default=list,
        blank=True,
        help_text='List of fit types (e.g. men, women, youth)',
    )
    colors = models.JSONField(
        default=list,
        blank=True,
        help_text='List of MBA color codes',
    )
    marketplaces = models.JSONField(
        default=list,
        blank=True,
        help_text='List of {marketplace, price, enabled} objects',
    )
    print_side = models.CharField(
        max_length=10,
        choices=PrintSide.choices,
        default=PrintSide.FRONT,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_upload_templates',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(
                fields=['workspace'],
                name='uploadtpl_ws_idx',
            ),
        ]

    def __str__(self):
        return f"Template: {self.name}"


class UploadJob(models.Model):
    """A single upload job sent to the Desktop Upload App."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        VALIDATING = 'validating', 'Validating'
        UPLOADING = 'uploading', 'Uploading'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'
        CANCELLED = 'cancelled', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='upload_jobs',
        db_index=True,
    )
    listing = models.ForeignKey(
        Listing,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='upload_jobs',
    )
    design = models.ForeignKey(
        'publish_app.DesignAsset',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='upload_jobs',
    )
    template = models.ForeignKey(
        UploadTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='upload_jobs',
    )
    listing_snapshot = models.JSONField(
        default=dict,
        blank=True,
        help_text='Denormalized listing fields at queue time',
    )
    marketplace = models.CharField(max_length=20, db_index=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    asin = models.CharField(max_length=20, blank=True, default='')
    upload_date = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True, default='')
    error_screenshot = models.URLField(blank=True, default='', max_length=2048)
    retry_count = models.IntegerField(default=0)
    queued_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_upload_jobs',
    )

    class Meta:
        ordering = ['-queued_at']
        indexes = [
            models.Index(
                fields=['workspace', 'status'],
                name='uploadjob_ws_status_idx',
            ),
            models.Index(
                fields=['listing'],
                name='uploadjob_listing_idx',
            ),
        ]

    def __str__(self):
        return f"UploadJob {str(self.id)[:8]} [{self.status}] {self.marketplace}"


class DesignAsset(models.Model):
    """Design file from any source (upload, cloud, PROJ-9 generated)."""

    class Source(models.TextChoices):
        UPLOAD = 'upload', 'Upload'
        GOOGLE_DRIVE = 'google_drive', 'Google Drive'
        ONEDRIVE = 'onedrive', 'OneDrive'
        GENERATED = 'generated', 'Generated'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='design_assets',
        db_index=True,
    )
    file_name = models.CharField(max_length=255)
    file = models.FileField(
        upload_to='designs/assets/%Y/%m/',
        blank=True,
        default='',
    )
    file_url = models.URLField(blank=True, default='', max_length=2048)
    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.UPLOAD,
        db_index=True,
    )
    source_file_id = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text='External file ID (Drive/OneDrive)',
    )
    thumbnail_url = models.URLField(blank=True, default='', max_length=2048)
    dimensions = models.JSONField(
        default=dict,
        blank=True,
        help_text='{width, height} in pixels',
    )
    file_size = models.IntegerField(
        default=0,
        help_text='File size in bytes',
    )
    tags = models.JSONField(default=list, blank=True)

    # Linking
    collection = models.ForeignKey(
        DesignCollection,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assets',
        help_text='Collection folder this asset belongs to. Null = root.',
    )
    listing = models.ForeignKey(
        Listing,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='design_assets',
    )
    idea = models.ForeignKey(
        'idea_app.Idea',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='design_assets',
    )
    niche = models.ForeignKey(
        'niche_app.Niche',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='design_assets',
    )
    round = models.PositiveIntegerField(default=1)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_design_assets',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['workspace', 'source'],
                name='designasset_ws_source_idx',
            ),
        ]

    def __str__(self):
        return f"DesignAsset: {self.file_name}"

    # Max upload size: 25 MB
    MAX_FILE_SIZE = 25 * 1024 * 1024
    ALLOWED_TYPES = ['image/png', 'image/jpeg']


class ProductLifecycle(models.Model):
    """Cross-cutting entity: Niche -> Idea -> Design -> Listing -> Upload -> Sales."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='product_lifecycles',
        db_index=True,
    )
    niche = models.ForeignKey(
        'niche_app.Niche',
        on_delete=models.CASCADE,
        related_name='product_lifecycles',
    )
    idea = models.ForeignKey(
        'idea_app.Idea',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='product_lifecycles',
    )
    design = models.ForeignKey(
        DesignAsset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='product_lifecycles',
    )
    listing = models.ForeignKey(
        Listing,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='product_lifecycles',
    )
    upload_job = models.ForeignKey(
        UploadJob,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='product_lifecycles',
    )
    asin = models.CharField(max_length=20, blank=True, default='')
    marketplace = models.CharField(max_length=20, blank=True, default='')
    upload_date = models.DateTimeField(null=True, blank=True)

    # Sales data (from browser extension or API)
    sales_units = models.IntegerField(null=True, blank=True)
    sales_revenue = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
    )
    current_bsr = models.IntegerField(null=True, blank=True)
    reviews_count = models.IntegerField(null=True, blank=True)
    reviews_rating = models.DecimalField(
        max_digits=3, decimal_places=2, null=True, blank=True,
    )

    round = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(
                fields=['niche', 'round'],
                name='lifecycle_niche_round_idx',
            ),
            models.Index(
                fields=['workspace'],
                name='lifecycle_ws_idx',
            ),
        ]

    def __str__(self):
        return f"Lifecycle {str(self.id)[:8]} [{self.asin or 'no ASIN'}]"
