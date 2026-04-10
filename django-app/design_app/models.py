import uuid

from django.conf import settings
from django.db import models


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
        FLUX_PRO = 'black-forest-labs/flux-1.1-pro', 'Flux 1.1 Pro'
        SEEDREAM = 'bytedance-seed/seedream-4.5', 'Seedream 4.5'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        RUNNING = 'running', 'Running'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

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
    source_image_url = models.URLField(
        blank=True,
        default='',
        max_length=2048,
        help_text='Reference image URL for multimodal generation',
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
    """Per-workspace processing provider configuration."""

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
    upscale_provider = models.CharField(
        max_length=20,
        choices=UpscaleProvider.choices,
        default=UpscaleProvider.AUTO,
    )
    upscale_api_key = models.CharField(
        max_length=500,
        blank=True,
        default='',
        help_text='Encrypted API key for external upscaling service',
    )
    upscale_auto_threshold = models.IntegerField(
        default=3000,
        help_text='Images >= this px use Pica.js; below use API',
    )

    class Meta:
        verbose_name = 'Processing Settings'
        verbose_name_plural = 'Processing Settings'

    def __str__(self):
        return f"ProcessingSettings for {self.workspace}"


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
