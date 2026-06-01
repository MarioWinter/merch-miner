import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q, UniqueConstraint
from django.utils import timezone


class DesignProject(models.Model):
    """A project folder organizing designs (Kittl-style)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='design_projects',
        db_index=True,
    )
    name = models.CharField(max_length=200)
    niche = models.ForeignKey(
        'niche_app.Niche',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='design_projects',
    )
    board_layout = models.JSONField(
        null=True,
        blank=True,
        default=None,
        help_text='React Flow node positions + edges',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_design_projects',
    )
    designs = models.ManyToManyField(
        'Design',
        through='DesignProjectDesign',
        related_name='projects',
        blank=True,
    )
    ideas = models.ManyToManyField(
        'idea_app.Idea',
        through='DesignProjectIdea',
        related_name='design_projects',
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(
                fields=['workspace'],
                name='designproject_ws_idx',
            ),
        ]

    def __str__(self):
        return f"Project: {self.name}"


class DesignProjectDesign(models.Model):
    """Through table for DesignProject <-> Design M2M."""

    project = models.ForeignKey(
        DesignProject,
        on_delete=models.CASCADE,
        related_name='project_designs',
    )
    design = models.ForeignKey(
        'Design',
        on_delete=models.CASCADE,
        related_name='design_projects_through',
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('project', 'design')
        indexes = [
            models.Index(
                fields=['project', 'design'],
                name='projdesign_proj_design_idx',
            ),
        ]

    def __str__(self):
        return f"{self.project.name} <-> Design {str(self.design_id)[:8]}"


class DesignGenerationRun(models.Model):
    """A single AI design generation run, optionally linked to an idea."""

    class ModelName(models.TextChoices):
        GEMINI_FLASH = 'gemini_flash', 'Gemini Flash'
        GEMINI_PRO = 'gemini_pro', 'Gemini Pro'
        GPT_IMAGE = 'gpt_image', 'GPT Image'
        FLUX = 'flux', 'Flux'
        # New models (OpenRouter IDs)
        NANO_BANANA_2 = 'google/gemini-3.1-flash-preview-image-generation', 'Nano Banana 2'
        NANO_BANANA_PRO = 'google/gemini-3-pro-preview-image-generation', 'Nano Banana Pro'
        NANO_BANANA = 'google/gemini-2.5-flash-preview-image-generation', 'Nano Banana'
        GPT5_IMAGE = 'openai/gpt-5-image', 'GPT-5 Image'
        GPT5_MINI = 'openai/gpt-5-image-mini', 'GPT-5 Mini'
        GPT54_IMAGE_2 = 'openai/gpt-5.4-image-2', 'GPT-5.4 Image 2'
        FLUX_PRO = 'black-forest-labs/flux-1.1-pro', 'Flux 1.1 Pro'
        FLUX2_KLEIN_4B = 'black-forest-labs/flux.2-klein-4b', 'FLUX.2 Klein 4B'
        FLUX2_MAX = 'black-forest-labs/flux.2-max', 'FLUX.2 Max'
        FLUX2_FLEX = 'black-forest-labs/flux.2-flex', 'FLUX.2 Flex'
        FLUX2_PRO = 'black-forest-labs/flux.2-pro', 'FLUX.2 Pro'
        SEEDREAM = 'bytedance-seed/seedream-4.5', 'Seedream 4.5'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        RUNNING = 'running', 'Running'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

    class Mode(models.TextChoices):
        TEXT_TO_IMAGE = 'text_to_image', 'Text to Image'
        IMAGE_TO_IMAGE = 'image_to_image', 'Image to Image'
        IMAGE_TO_IMAGE_EDIT = 'image_to_image_edit', 'Image to Image (Edit)'
        REMIX = 'remix', 'Remix'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    idea = models.ForeignKey(
        'idea_app.Idea',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='generation_runs',
        db_index=True,
    )
    model_name = models.CharField(
        max_length=64,
        choices=ModelName.choices,
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='triggered_design_runs',
    )
    project_prompt = models.ForeignKey(
        'ProjectPrompt',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='generation_runs',
        help_text='Saved prompt this run was generated from',
    )
    prompt_used = models.TextField(blank=True, default='')
    # PROJ-34: Persist the polished prompt actually sent to the image model
    # (after Builder polish step) for debugging / Langfuse trace correlation.
    prompt_polished = models.TextField(
        blank=True,
        null=True,
        help_text='Polished prompt actually sent to the model (PROJ-34, debug).',
    )
    # PROJ-34: Background color from UI persists onto the Run so the worker
    # injects the exact hex without re-guessing from the prompt text.
    # NOTE: choices kept in sync with Design.BackgroundColor (defined below;
    # cannot reference class attribute here because Design is declared later
    # in this module).
    background_color = models.CharField(
        max_length=20,
        choices=[
            ('light_gray', 'Light Gray'),
            ('neon_pink', 'Neon Pink'),
            ('neon_green', 'Neon Green'),
        ],
        default='light_gray',
        help_text='Background color selected in UI (PROJ-34); used by '
                  'image_generator to inject the exact hex into the user message.',
    )
    source_image_url = models.URLField(
        blank=True,
        default='',
        max_length=2048,
        help_text='Reference image URL for multimodal generation',
    )
    source_image_url_2 = models.URLField(
        blank=True,
        default='',
        max_length=2048,
        help_text='Second reference image URL for remix mode',
    )
    generation_mode = models.CharField(
        max_length=20,
        choices=Mode.choices,
        default=Mode.TEXT_TO_IMAGE,
        db_index=True,
        help_text='Generation mode: text_to_image or image_to_image',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True, default='')
    rq_job_id = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text='RQ job ID for status tracking',
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['idea', 'status'],
                name='designrun_idea_status_idx',
            ),
        ]

    def __str__(self):
        return f"DesignRun {str(self.id)[:8]} [{self.status}] ({self.model_name})"


class Design(models.Model):
    """A generated or manually uploaded design image."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        FAILED = 'failed', 'Failed'

    class BackgroundColor(models.TextChoices):
        LIGHT_GRAY = 'light_gray', 'Light Gray'
        NEON_PINK = 'neon_pink', 'Neon Pink'
        NEON_GREEN = 'neon_green', 'Neon Green'

    # Hex values for prompt injection
    BG_COLOR_HEX = {
        'light_gray': '#D3D3D3',
        'neon_pink': '#FF6EC7',
        'neon_green': '#39FF14',
    }

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='designs',
        db_index=True,
    )
    idea = models.ForeignKey(
        'idea_app.Idea',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='designs',
        db_index=True,
    )
    generation_run = models.ForeignKey(
        DesignGenerationRun,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='designs',
    )
    image_file = models.FileField(
        upload_to='designs/generated/%Y/%m/',
        blank=True,
        default='',
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    is_manual = models.BooleanField(default=False)
    background_color = models.CharField(
        max_length=20,
        choices=BackgroundColor.choices,
        default=BackgroundColor.LIGHT_GRAY,
    )
    source_image_url = models.URLField(blank=True, default='', max_length=2048)
    prompt_analysis = models.JSONField(
        default=dict,
        blank=True,
        help_text='7-step Gemini 3 Architect analysis output',
    )
    upscaled_file = models.FileField(
        upload_to='designs/upscaled/%Y/%m/',
        blank=True,
        default='',
    )
    bg_removed_file = models.FileField(
        upload_to='designs/bg_removed/%Y/%m/',
        blank=True,
        default='',
    )
    processed_file = models.FileField(
        upload_to='designs/processed/%Y/%m/',
        blank=True,
        default='',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['workspace', 'idea'],
                name='design_ws_idea_idx',
            ),
        ]

    def __str__(self):
        return f"Design {str(self.id)[:8]} [{self.status}]"


class DesignProcessingJob(models.Model):
    """A post-processing job (upscale or bg_remove) for a design."""

    class JobType(models.TextChoices):
        UPSCALE = 'upscale', 'Upscale'
        BG_REMOVE = 'bg_remove', 'Background Remove'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        RUNNING = 'running', 'Running'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    design = models.ForeignKey(
        Design,
        on_delete=models.CASCADE,
        related_name='processing_jobs',
        db_index=True,
    )
    type = models.CharField(
        max_length=20,
        choices=JobType.choices,
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    result_file = models.FileField(
        upload_to='designs/processed/%Y/%m/',
        blank=True,
        default='',
    )
    error_message = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    rq_job_id = models.CharField(
        max_length=100,
        blank=True,
        default='',
    )
    # PROJ-27: Replicate prediction tracking for webhook callbacks + reconciler.
    replicate_prediction_id = models.CharField(
        max_length=100,
        blank=True,
        default='',
        db_index=True,
        help_text='Replicate prediction ID for webhook idempotency + fallback polling',
    )
    # PROJ-27: Bulk batch grouping. Single-mode jobs leave this null.
    batch_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        help_text='Bulk-batch UUID grouping (null for single-mode jobs)',
    )
    # PROJ-27: Bookkeeping so failure-refund knows which user to refund.
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='triggered_processing_jobs',
        help_text='User who triggered the job (for quota refund)',
    )
    # PROJ-27: Cloud destination payload (`{provider, folder_id, folder_path}`)
    # captured at submission. Worker uses it post-success to enqueue cloud
    # upload. Empty dict means destination=local.
    cloud_target = models.JSONField(
        blank=True,
        default=dict,
        help_text='Cloud upload target (provider+folder); empty = local-only',
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['design', 'type'],
                name='procjob_design_type_idx',
            ),
        ]

    def __str__(self):
        return f"ProcessingJob {str(self.id)[:8]} [{self.type}:{self.status}]"


class ProcessingSettings(models.Model):
    """Per-workspace processing provider configuration.

    PROJ-27 NOTE: ``upscale_provider``, ``upscale_api_key`` and
    ``upscale_auto_threshold`` are DEPRECATED — kept for one release cycle to
    avoid breaking PROJ-9 callers, but ignored by the new Replicate flow.
    The new global ``UpscalerSettings`` singleton owns all upscale config.
    Targeted for removal: PROJ-27 release N+1.
    """

    class BgProvider(models.TextChoices):
        REMBG = 'rembg', 'rembg (self-hosted)'
        API = 'api', 'External API'

    class UpscaleProvider(models.TextChoices):
        PICA = 'pica', 'Pica.js (client-side)'
        API = 'api', 'External API'
        AUTO = 'auto', 'Auto (threshold-based)'

    workspace = models.OneToOneField(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='processing_settings',
        primary_key=True,
    )
    bg_removal_provider = models.CharField(
        max_length=20,
        choices=BgProvider.choices,
        default=BgProvider.REMBG,
    )
    bg_removal_api_key = models.CharField(
        max_length=500,
        blank=True,
        default='',
        help_text='Encrypted API key for external BG removal service',
    )
    # DEPRECATED (PROJ-27): superseded by global UpscalerSettings.
    upscale_provider = models.CharField(
        max_length=20,
        choices=UpscaleProvider.choices,
        default=UpscaleProvider.AUTO,
        help_text='DEPRECATED (PROJ-27): ignored — use UpscalerSettings.',
    )
    # DEPRECATED (PROJ-27): superseded by global UpscalerSettings.
    upscale_api_key = models.CharField(
        max_length=500,
        blank=True,
        default='',
        help_text='DEPRECATED (PROJ-27): ignored — Replicate token via env var.',
    )
    # DEPRECATED (PROJ-27): no longer used.
    upscale_auto_threshold = models.IntegerField(
        default=3000,
        help_text='DEPRECATED (PROJ-27): no longer used; strict 4× upscaling.',
    )
    # PROJ-34: Workspace-level toggle for Builder prompt auto-polish.
    polish_builder_prompts_enabled = models.BooleanField(
        default=True,
        help_text='When True, prompts created by the Prompt Builder are '
                  'polished by a small LLM before generation (PROJ-34).',
    )

    class Meta:
        verbose_name = 'Processing Settings'
        verbose_name_plural = 'Processing Settings'

    def __str__(self):
        return f"ProcessingSettings for {self.workspace}"


class UpscalerSettings(models.Model):
    """Global singleton config for the AI upscaler (PROJ-27).

    Exactly one row exists. Admin-editable; never exposed to API.
    Use ``UpscalerSettings.load()`` to fetch (auto-creates with defaults).
    """

    SINGLETON_PK = 1

    id = models.PositiveSmallIntegerField(primary_key=True, default=SINGLETON_PK)
    replicate_model_slug = models.CharField(
        max_length=200,
        default='nightmareai/real-esrgan',
        help_text='Replicate model slug (owner/name).',
    )
    replicate_model_version = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text='Pinned version hash for reproducibility (blank = use latest).',
    )
    default_scale = models.PositiveSmallIntegerField(
        default=4,
        help_text='Replicate `scale` input.',
    )
    target_width = models.PositiveIntegerField(
        default=4500,
        help_text='Final canvas width after Pillow center-pad.',
    )
    target_height = models.PositiveIntegerField(
        default=5400,
        help_text='Final canvas height after Pillow center-pad.',
    )
    monthly_quota_per_user = models.PositiveIntegerField(
        default=100,
        help_text='Hard cap of successful upscales per non-staff user per month.',
    )
    bulk_concurrency = models.PositiveSmallIntegerField(
        default=10,
        help_text='Max parallel Replicate predictions per bulk batch.',
    )
    staff_unlimited = models.BooleanField(
        default=True,
        help_text='Skip quota for is_staff/is_superuser users.',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Upscaler Settings'
        verbose_name_plural = 'Upscaler Settings'

    def __str__(self):
        return f"UpscalerSettings (model={self.replicate_model_slug})"

    def save(self, *args, **kwargs):
        # Force singleton — always pk=1
        self.pk = self.SINGLETON_PK
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):  # pragma: no cover - guard
        # Refuse to delete the singleton row from code.
        raise RuntimeError("UpscalerSettings is a singleton; cannot be deleted.")

    @classmethod
    def load(cls):
        """Return the singleton (auto-create with defaults if missing)."""
        obj, _ = cls.objects.get_or_create(pk=cls.SINGLETON_PK)
        return obj


class UpscaleQuotaUsage(models.Model):
    """Per-user month-bucket counter for AI upscale consumption (PROJ-27).

    `count` is incremented at job-submission time; refunded on failure.
    Unique per (user, month) so increments use atomic F-expressions.
    """

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='upscale_quota_usage',
        db_index=True,
    )
    month = models.DateField(
        help_text='First day of the calendar month bucket.',
        db_index=True,
    )
    count = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Upscale Quota Usage'
        verbose_name_plural = 'Upscale Quota Usage'
        unique_together = (('user', 'month'),)
        indexes = [
            models.Index(
                fields=['user', 'month'],
                name='upscale_quota_user_month_idx',
            ),
        ]

    def __str__(self):
        return f"{self.user_id} {self.month:%Y-%m} = {self.count}"


class DesignPipeline(models.Model):
    """Reusable post-processing pipeline preset."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='design_pipelines',
        db_index=True,
    )
    name = models.CharField(max_length=200)
    tools = models.JSONField(
        default=list,
        help_text='Ordered list of {tool_name, params, condition} objects',
    )
    is_preset = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_pipelines',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Pipeline: {self.name}"


class DesignProjectIdea(models.Model):
    """Through table for DesignProject <-> Idea M2M (Slogan Pool)."""

    project = models.ForeignKey(
        DesignProject,
        on_delete=models.CASCADE,
        related_name='project_ideas',
    )
    idea = models.ForeignKey(
        'idea_app.Idea',
        on_delete=models.CASCADE,
        related_name='idea_projects_through',
    )
    position = models.IntegerField(default=0)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('project', 'idea')
        ordering = ['position', '-added_at']
        indexes = [
            models.Index(
                fields=['project', 'idea'],
                name='projidea_proj_idea_idx',
            ),
        ]

    def __str__(self):
        return f"{self.project.name} <-> Idea {str(self.idea_id)[:8]}"


class ProjectPrompt(models.Model):
    """A saved prompt for a design project (not ephemeral)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        DesignProject,
        on_delete=models.CASCADE,
        related_name='prompts',
        db_index=True,
    )
    prompt_text = models.TextField()
    sources = models.JSONField(
        default=dict,
        blank=True,
        help_text='Which sources were used: {slogan, keywords, research, web_research, image}',
    )
    source_idea = models.ForeignKey(
        'idea_app.Idea',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='project_prompts',
    )
    source_image_url = models.URLField(
        blank=True,
        default='',
        max_length=2048,
    )
    variant_index = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['project', 'created_at'],
                name='projprompt_proj_created_idx',
            ),
        ]

    def __str__(self):
        return f"Prompt {str(self.id)[:8]} for {self.project.name}"


class PromptPreset(models.Model):
    """Saved source configuration template for the Prompt Builder."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='prompt_presets',
        db_index=True,
    )
    name = models.CharField(max_length=100)
    source_config = models.JSONField(
        default=dict,
        help_text='Source toggle config: {slogan, keywords, research, web_research, image}',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_prompt_presets',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"Preset: {self.name}"


class ProjectReference(models.Model):
    """A reference image attached to a design project (from product or manual)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        DesignProject,
        on_delete=models.CASCADE,
        related_name='references',
        db_index=True,
    )
    source_product = models.ForeignKey(
        'scraper_app.AmazonProduct',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='design_references',
    )
    image_url = models.URLField(max_length=2048)
    title = models.CharField(max_length=500, blank=True, default='')
    asin = models.CharField(max_length=20, blank=True, default='')
    prompt_analysis = models.JSONField(
        null=True,
        blank=True,
        default=None,
        help_text='AI vision analysis of the reference image',
    )
    position = models.IntegerField(default=0)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['position', '-added_at']
        unique_together = ('project', 'image_url')
        indexes = [
            models.Index(
                fields=['project'],
                name='projref_project_idx',
            ),
        ]

    def __str__(self):
        label = self.title[:40] if self.title else self.asin or str(self.id)[:8]
        return f"Ref: {label} → {self.project.name}"


class BuilderPreset(models.Model):
    """A saved Prompt-Builder configuration scoped to a single DesignProject.

    PROJ-34: Stores slogans + styles + bg_color + niche_context flag + form
    slots as a JSON blob (config schema iterates as the Builder UI evolves;
    Phase 13k removed the legacy `warp` field). Soft-deleted via ``is_deleted``
    so name re-use after delete is allowed via a partial UniqueConstraint
    (Appendix F of docs/tasks/PROJ-34-tasks.md).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='builder_presets',
        db_index=True,
    )
    project = models.ForeignKey(
        DesignProject,
        on_delete=models.CASCADE,
        related_name='builder_presets',
    )
    name = models.CharField(max_length=80)
    config = models.JSONField(
        default=dict,
        help_text='Builder config: slogans, styles, bg_color, '
                  'niche_context_enabled, slots.',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_builder_presets',
    )
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        constraints = [
            UniqueConstraint(
                fields=['project', 'name'],
                condition=Q(is_deleted=False),
                name='builderpreset_unique_name_per_project_active',
            ),
        ]
        indexes = [
            models.Index(
                fields=['project', 'is_deleted'],
                name='builderpreset_active_idx',
            ),
        ]

    def __str__(self):
        return f"BuilderPreset: {self.name} ({self.project.name})"


class CustomSpatial(models.Model):
    """PROJ-34 Phase 13d — user-defined spatial layout entries.

    Each row is a workspace-scoped reusable spatial-configuration block.
    Created via vision-LLM analysis of an uploaded image OR an existing
    ``ProjectReference`` / ``Design``. Soft-deleted via ``is_deleted`` so a
    BuilderPreset that referenced a deleted custom can fall through the
    resolver chain (Appendix N.3 / EC-32).

    Schema: Appendix O.1 of docs/tasks/PROJ-34-tasks.md (verbatim).
    """

    SOURCE_KIND_CHOICES = [
        ('upload', 'Image upload'),
        ('reference', 'Project reference'),
        ('design', 'Generated design'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='custom_spatials',
        db_index=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_custom_spatials',
    )

    name = models.CharField(max_length=80)
    prompt_text = models.TextField()  # 50–500 chars enforced at serializer

    source_kind = models.CharField(max_length=16, choices=SOURCE_KIND_CHOICES)
    source_image_ref = models.CharField(max_length=64, blank=True, default='')
    # ↑ stores ProjectReference.id OR Design.id (UUID-string) when source_kind != 'upload'
    source_image_file = models.ImageField(
        upload_to='custom_spatials/%Y/%m/', blank=True, null=True,
    )
    # ↑ ONLY set when source_kind='upload'

    is_unsafe = models.BooleanField(default=False)
    # ↑ EC-31 escape-hatch: user saved a flagged custom anyway

    is_deleted = models.BooleanField(default=False, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'design_app'
        ordering = ['-created_at']
        constraints = [
            UniqueConstraint(
                fields=['workspace', 'name'],
                condition=Q(is_deleted=False),
                name='uniq_custom_spatial_name_per_ws',
            ),
        ]

    def __str__(self):
        return f'{self.workspace_id}/{self.name}'

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.source_kind == 'upload':
            if not self.source_image_file:
                raise ValidationError(
                    'source_image_file required when source_kind=upload',
                )
            if self.source_image_ref:
                raise ValidationError(
                    'source_image_ref must be empty when source_kind=upload',
                )
        else:
            if self.source_image_file:
                raise ValidationError(
                    'source_image_file forbidden when source_kind!=upload',
                )
            if not self.source_image_ref:
                raise ValidationError(
                    'source_image_ref required when source_kind!=upload',
                )


class NicheCardPreset(models.Model):
    """PROJ-34 Phase 13t — saved Niche-Reference preset bundle.

    Workspace-scoped, dedup'd by SHA256 hash over the 7 normalized slot values.
    Acts as both History (LRU) and Custom (user-promoted) entry — the two
    boolean flags toggle membership independently. Source-card-type tracks
    whether the preset originated from the Top card or a Best-of-Mix variant
    (most_common / edgy / safe). Schema: Tech Design — Phase 13t (Data Model
    table) of features/PROJ-34-design-prompt-engineering.md.
    """

    SOURCE_CARD_TYPE_CHOICES = [
        ('top', 'Top'),
        ('mix_most_common', 'Mix · Most-Common'),
        ('mix_edgy', 'Mix · Edgy'),
        ('mix_safe', 'Mix · Safe'),
        ('collection', 'Collection'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='niche_card_presets',
        db_index=True,
    )
    preset_hash = models.CharField(max_length=64, db_index=True)
    preset_label = models.CharField(max_length=200)

    # 7 slot values (raw text OR built-in option id; resolution handled by
    # prompt_builder per-slot chains, not by this model).
    slot_spatial_configuration = models.TextField(blank=True, default='')
    slot_visual_description = models.TextField(blank=True, default='')
    slot_typography_adjectives = models.TextField(blank=True, default='')
    slot_font_combination = models.TextField(blank=True, default='')
    slot_accessories = models.TextField(blank=True, default='')
    slot_style_dna = models.TextField(blank=True, default='')
    slot_extra_context = models.TextField(blank=True, default='')

    # 7 raw-override flags. visual_is_raw / style_dna_is_raw / extra_context_is_raw
    # are structurally always True (no built-in pool), but kept for schema symmetry.
    spatial_is_raw = models.BooleanField(default=False)
    visual_is_raw = models.BooleanField(default=False)
    typography_is_raw = models.BooleanField(default=False)
    font_combination_is_raw = models.BooleanField(default=False)
    accessories_is_raw = models.BooleanField(default=False)
    style_dna_is_raw = models.BooleanField(default=False)
    extra_context_is_raw = models.BooleanField(default=False)

    reference_thumbnail_url = models.CharField(max_length=500, blank=True, default='')
    source_card_type = models.CharField(
        max_length=20,
        choices=SOURCE_CARD_TYPE_CHOICES,
    )
    source_card_references = models.JSONField(default=list, blank=True)
    # ↑ list of {'niche_id': str, 'product_ids': list[str]} — append-only on dedup

    is_in_history = models.BooleanField(default=True, db_index=True)
    is_in_custom = models.BooleanField(default=False, db_index=True)
    custom_promoted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='promoted_niche_presets',
    )
    custom_promoted_at = models.DateTimeField(null=True, blank=True)
    last_clicked_at = models.DateTimeField(default=timezone.now, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'design_app'
        ordering = ['-last_clicked_at']
        constraints = [
            UniqueConstraint(
                fields=['workspace', 'preset_hash'],
                name='uniq_preset_hash_per_ws',
            ),
        ]
        indexes = [
            models.Index(
                fields=['workspace', 'is_in_history', '-last_clicked_at'],
                name='nichepreset_ws_hist_idx',
            ),
            models.Index(
                fields=['workspace', 'is_in_custom', '-custom_promoted_at'],
                name='nichepreset_ws_custom_idx',
            ),
        ]

    def __str__(self):
        return f'{self.workspace_id}/{self.preset_label[:40]}'


class CustomTypography(models.Model):
    """PROJ-34 Phase 13i — user-defined typography style entries.

    Mirror of ``CustomSpatial`` but for font/anatomy descriptions extracted
    by a vision-LLM. Each row is a workspace-scoped reusable typography
    description block created via vision-LLM analysis of an uploaded image
    OR an existing ``ProjectReference`` / ``Design``. Soft-deleted via
    ``is_deleted`` so a BuilderPreset that referenced a deleted custom can
    fall through the resolver chain.
    """

    SOURCE_KIND_CHOICES = [
        ('upload', 'Image upload'),
        ('reference', 'Project reference'),
        ('design', 'Generated design'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='custom_typographies',
        db_index=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_custom_typographies',
    )

    name = models.CharField(max_length=80)
    prompt_text = models.TextField()  # 50–500 chars enforced at serializer

    source_kind = models.CharField(max_length=16, choices=SOURCE_KIND_CHOICES)
    source_image_ref = models.CharField(max_length=64, blank=True, default='')
    # ↑ stores ProjectReference.id OR Design.id (UUID-string) when source_kind != 'upload'
    source_image_file = models.ImageField(
        upload_to='custom_typographies/%Y/%m/', blank=True, null=True,
    )
    # ↑ ONLY set when source_kind='upload'

    is_unsafe = models.BooleanField(default=False)
    # ↑ escape-hatch: user saved a flagged custom anyway

    is_deleted = models.BooleanField(default=False, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'design_app'
        ordering = ['-created_at']
        constraints = [
            UniqueConstraint(
                fields=['workspace', 'name'],
                condition=Q(is_deleted=False),
                name='uniq_custom_typography_name_per_ws',
            ),
        ]

    def __str__(self):
        return f'{self.workspace_id}/{self.name}'

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.source_kind == 'upload':
            if not self.source_image_file:
                raise ValidationError(
                    'source_image_file required when source_kind=upload',
                )
            if self.source_image_ref:
                raise ValidationError(
                    'source_image_ref must be empty when source_kind=upload',
                )
        else:
            if self.source_image_file:
                raise ValidationError(
                    'source_image_file forbidden when source_kind!=upload',
                )
            if not self.source_image_ref:
                raise ValidationError(
                    'source_image_ref required when source_kind!=upload',
                )
