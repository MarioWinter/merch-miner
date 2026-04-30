import uuid

from django.conf import settings
from django.contrib.postgres.indexes import GinIndex
from django.core.validators import MaxLengthValidator, MaxValueValidator, MinValueValidator
from django.db import models


class AgentType(models.TextChoices):
    ORCHESTRATOR = 'orchestrator', 'Orchestrator'
    RESEARCH = 'research', 'Research'
    IDEATION = 'ideation', 'Ideation'
    DESIGN = 'design', 'Design'
    LISTING = 'listing', 'Listing'
    PUBLISHING = 'publishing', 'Publishing'
    SEARCH = 'search', 'Search'


# Default agent configs (name, emoji, model, personality)
AGENT_DEFAULTS = {
    AgentType.ORCHESTRATOR: {
        'display_name': 'Chief',
        'avatar_emoji': '\U0001f916',  # robot
        'model_name': 'openai/gpt-4.1-mini',
        'temperature': 0.3,
    },
    AgentType.RESEARCH: {
        'display_name': 'Scout',
        'avatar_emoji': '\U0001f52c',  # microscope
        'model_name': 'openai/gpt-4.1-mini',
        'temperature': 0.3,
    },
    AgentType.IDEATION: {
        'display_name': 'Muse',
        'avatar_emoji': '\U0001f4a1',  # lightbulb
        'model_name': 'openai/gpt-4.1-mini',
        'temperature': 0.7,
    },
    AgentType.DESIGN: {
        'display_name': 'Pixel',
        'avatar_emoji': '\U0001f3a8',  # palette
        'model_name': 'openai/gpt-4.1-mini',
        'temperature': 0.5,
    },
    AgentType.LISTING: {
        'display_name': 'Scribe',
        'avatar_emoji': '\u270d\ufe0f',  # writing hand
        'model_name': 'openai/gpt-4.1-mini',
        'temperature': 0.4,
    },
    AgentType.PUBLISHING: {
        'display_name': 'Launch',
        'avatar_emoji': '\U0001f680',  # rocket
        'model_name': 'openai/gpt-4.1-mini',
        'temperature': 0.2,
    },
    AgentType.SEARCH: {
        'display_name': 'Radar',
        'avatar_emoji': '\U0001f50d',  # magnifier
        'model_name': 'openai/gpt-4.1-mini',
        'temperature': 0.3,
    },
}


class AgentConfig(models.Model):
    """Per-workspace, per-agent-type LLM + personality config (AC-1)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='agent_configs',
        db_index=True,
    )
    agent_type = models.CharField(
        max_length=20,
        choices=AgentType.choices,
        db_index=True,
    )
    display_name = models.CharField(max_length=50)
    personality = models.TextField(
        blank=True,
        default='',
        help_text='Custom personality injected into system prompt',
    )
    avatar_emoji = models.CharField(max_length=5, default='\U0001f916')
    model_name = models.CharField(max_length=100, default='openai/gpt-4.1-mini')
    temperature = models.FloatField(default=0.3)
    system_prompt = models.TextField(
        blank=True,
        default='',
        help_text='Base system prompt for this agent type',
    )
    max_tokens = models.IntegerField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('workspace', 'agent_type')]
        verbose_name = 'Agent Config'
        verbose_name_plural = 'Agent Configs'

    def __str__(self):
        return f"{self.avatar_emoji} {self.display_name} ({self.agent_type})"


class SessionStatus(models.TextChoices):
    IDLE = 'idle', 'Idle'
    RUNNING = 'running', 'Running'
    PAUSED = 'paused', 'Paused'
    COMPLETED = 'completed', 'Completed'
    FAILED = 'failed', 'Failed'
    CANCELLED = 'cancelled', 'Cancelled'


class SessionSource(models.TextChoices):
    AGENT_TAB = 'agent_tab', 'Agent Tab'
    CHAT_COMMAND = 'chat_command', 'Chat Command'
    BATCH_API = 'batch_api', 'Batch API'


class AgentSession(models.Model):
    """Single agent workflow execution (AC-2)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='agent_sessions',
        db_index=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_sessions',
    )
    title = models.CharField(max_length=200, blank=True, default='')
    status = models.CharField(
        max_length=20,
        choices=SessionStatus.choices,
        default=SessionStatus.IDLE,
        db_index=True,
    )
    niche_context = models.ForeignKey(
        'niche_app.Niche',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='agent_sessions',
    )
    workflow_template = models.CharField(max_length=50, blank=True, default='')
    autonomy_preset = models.CharField(max_length=20, default='assisted')
    is_shared = models.BooleanField(default=False)
    current_step = models.CharField(max_length=100, blank=True, default='')
    total_steps = models.IntegerField(default=0)
    completed_steps = models.IntegerField(default=0)
    error_message = models.TextField(blank=True, default='')
    source = models.CharField(
        max_length=20,
        choices=SessionSource.choices,
        default=SessionSource.AGENT_TAB,
        help_text='Where the session was triggered from (analytics + UI hints)',
    )
    batch_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        help_text=(
            'AC-31/AC-33: shared identifier across sibling sessions created '
            'by a single batch request. NULL for non-batch sessions.'
        ),
    )
    batch_position = models.IntegerField(
        default=0,
        help_text='AC-33: 0-indexed position within a batch (sequential ordering).',
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['workspace', 'status'],
                name='agentsess_ws_status_idx',
            ),
        ]

    def __str__(self):
        return f"Session {self.title or self.id} [{self.status}]"


class MessageRole(models.TextChoices):
    USER = 'user', 'User'
    AGENT = 'agent', 'Agent'
    SYSTEM = 'system', 'System'
    APPROVAL_REQUEST = 'approval_request', 'Approval Request'
    APPROVAL_RESPONSE = 'approval_response', 'Approval Response'


class AgentMessage(models.Model):
    """Chat message within a session (AC-3)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        AgentSession,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    role = models.CharField(max_length=20, choices=MessageRole.choices)
    content = models.TextField()
    agent_type = models.CharField(max_length=50, blank=True, default='')
    tool_calls = models.JSONField(default=list, blank=True)
    processed = models.BooleanField(
        default=True,
        db_index=True,
        help_text=(
            'EC-12: user commands sent during active tool execution are '
            'persisted as processed=False and dequeued by the orchestrator '
            'after the current tool completes.'
        ),
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(
                fields=['session', 'created_at'],
                name='agentmsg_sess_created_idx',
            ),
            models.Index(
                fields=['session', 'role', 'processed'],
                name='agentmsg_sess_role_proc_idx',
            ),
        ]

    def __str__(self):
        return f"[{self.role}] {self.content[:60]}"


class ActionStatus(models.TextChoices):
    STARTED = 'started', 'Started'
    COMPLETED = 'completed', 'Completed'
    FAILED = 'failed', 'Failed'
    SKIPPED = 'skipped', 'Skipped'
    AWAITING_APPROVAL = 'awaiting_approval', 'Awaiting Approval'
    APPROVED = 'approved', 'Approved'
    REJECTED = 'rejected', 'Rejected'


class AgentActionLog(models.Model):
    """Audit log for every tool call (AC-4)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        AgentSession,
        on_delete=models.CASCADE,
        related_name='action_logs',
    )
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='agent_action_logs',
        db_index=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_action_logs',
    )
    agent_type = models.CharField(max_length=50)
    action = models.CharField(max_length=100, db_index=True)
    target_object_type = models.CharField(max_length=50, blank=True, default='')
    target_object_id = models.UUIDField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=ActionStatus.choices,
        default=ActionStatus.STARTED,
        db_index=True,
    )
    cost_estimate = models.DecimalField(
        max_digits=8, decimal_places=4, null=True, blank=True,
    )
    error_message = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['session', 'created_at'],
                name='actionlog_sess_created_idx',
            ),
        ]

    def __str__(self):
        return f"{self.agent_type}.{self.action} [{self.status}]"


class PermissionLevel(models.TextChoices):
    AUTO = 'auto', 'Auto'
    NOTIFY = 'notify', 'Notify'
    APPROVE = 'approve', 'Approve'


class ToolPermission(models.Model):
    """Per-user, per-tool permission level (AC-5)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='tool_permissions',
        db_index=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tool_permissions',
    )
    tool_name = models.CharField(max_length=100, db_index=True)
    permission_level = models.CharField(
        max_length=10,
        choices=PermissionLevel.choices,
        default=PermissionLevel.AUTO,
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('workspace', 'user', 'tool_name')]
        verbose_name = 'Tool Permission'
        verbose_name_plural = 'Tool Permissions'

    def __str__(self):
        return f"{self.tool_name}: {self.permission_level}"


class AutonomyPreset(models.Model):
    """Named permission preset (AC-6). 3 system + custom per workspace."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='autonomy_presets',
        db_index=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='autonomy_presets',
    )
    name = models.CharField(max_length=50)
    is_system = models.BooleanField(default=False)
    permissions = models.JSONField(
        default=dict,
        help_text='{tool_name: permission_level} mapping',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-is_system', 'name']

    def __str__(self):
        label = ' (system)' if self.is_system else ''
        return f"{self.name}{label}"


class KnowledgeDoc(models.Model):
    """User-created knowledge for agent context (AC-7)."""

    class Source(models.TextChoices):
        MANUAL = 'manual', 'Manual'
        CHAT_COMMAND = 'chat_command', 'Chat Command'
        AUTO_EXTRACTED = 'auto_extracted', 'Auto Extracted'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='knowledge_docs',
        db_index=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='knowledge_docs',
    )
    title = models.CharField(max_length=200)
    content = models.TextField(help_text='Markdown content')
    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.MANUAL,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.title

    def get_embedding_text(self):
        """Text representation for Vector DB embedding."""
        return f"{self.title}\n\n{self.content}"


class WorkflowTemplate(models.Model):
    """Workflow step sequence (AC-8). 5 system defaults + custom."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='workflow_templates',
        db_index=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='workflow_templates',
    )
    name = models.CharField(max_length=100)
    key = models.CharField(max_length=50, db_index=True)
    is_system = models.BooleanField(default=False)
    steps = models.JSONField(
        default=list,
        help_text='Ordered list of {agent_type, action, description}',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('workspace', 'key')]
        ordering = ['-is_system', 'name']

    def __str__(self):
        label = ' (system)' if self.is_system else ''
        return f"{self.name}{label}"

    def clean(self):
        """EC-14: validate template steps shape + prerequisites.

        - `steps` must be a list of dicts each containing `agent_type`
        - `agent_type` must be one of `AgentType.values` (excluding orchestrator)
        - If `design` appears it must be preceded by `research` or `ideation`
        """
        from django.core.exceptions import ValidationError as DjangoValidationError

        errors = validate_workflow_steps(self.steps)
        if errors:
            raise DjangoValidationError({'steps': errors['error']})


# Valid sub-agent types accepted in WorkflowTemplate.steps (orchestrator excluded)
VALID_TEMPLATE_AGENT_TYPES = {
    AgentType.RESEARCH,
    AgentType.IDEATION,
    AgentType.DESIGN,
    AgentType.LISTING,
    AgentType.PUBLISHING,
    AgentType.SEARCH,
}


def validate_workflow_steps(steps):
    """Shared validator for WorkflowTemplate.steps (model + serializer + orchestrator).

    Returns:
        None if valid, or a structured error dict:
        {
            'error': '...',
            'missing_prerequisite': '<agent_type>',
            'suggestion': '...',
        }
    """
    if not isinstance(steps, list):
        return {
            'error': 'steps must be a list',
            'missing_prerequisite': None,
            'suggestion': 'Provide a list of {agent_type, action, description} dicts.',
        }
    if len(steps) == 0:
        return {
            'error': 'steps cannot be empty',
            'missing_prerequisite': None,
            'suggestion': 'Add at least one step.',
        }

    seen_types = []
    for idx, step in enumerate(steps):
        if not isinstance(step, dict):
            return {
                'error': f'step[{idx}] must be a dict, got {type(step).__name__}',
                'missing_prerequisite': None,
                'suggestion': 'Each step is {agent_type, action, description}.',
            }
        agent_type = step.get('agent_type')
        if not agent_type:
            return {
                'error': f'step[{idx}] is missing agent_type',
                'missing_prerequisite': None,
                'suggestion': 'Provide agent_type in every step.',
            }
        if agent_type not in VALID_TEMPLATE_AGENT_TYPES:
            return {
                'error': (
                    f'step[{idx}] has invalid agent_type {agent_type!r}; '
                    f'must be one of {sorted(VALID_TEMPLATE_AGENT_TYPES)}'
                ),
                'missing_prerequisite': None,
                'suggestion': 'Use a valid sub-agent type.',
            }
        # Prerequisite: design must be preceded by research or ideation.
        if agent_type == AgentType.DESIGN:
            if not (
                AgentType.RESEARCH in seen_types
                or AgentType.IDEATION in seen_types
            ):
                return {
                    'error': (
                        f'step[{idx}] design step requires a preceding '
                        f'research or ideation step'
                    ),
                    'missing_prerequisite': 'research_or_ideation',
                    'suggestion': (
                        'Add a research or ideation step before design — '
                        'designs need approved slogans/ideas.'
                    ),
                }
        seen_types.append(agent_type)

    return None


# ─────────────────────────────────────────────────────────────────────────────
# Phase 14 — Self-Improvement Layer (Metis Pattern)
# ─────────────────────────────────────────────────────────────────────────────


class SkillTriggerType(models.TextChoices):
    AUTO_COMPLEX_TASK = 'auto_complex_task', 'Auto: Complex Task'
    AUTO_ERROR_RECOVERY = 'auto_error_recovery', 'Auto: Error Recovery'
    USER_CORRECTION = 'user_correction', 'User Correction'
    MANUAL = 'manual', 'Manual'


# Default char limits for memory + profile (also seeded in AgentWorkspaceConfig)
DEFAULT_MEMORY_CHAR_LIMIT = 2200
DEFAULT_PROFILE_CHAR_LIMIT = 1375
MEMORY_CHAR_LIMIT_RANGE = (1500, 4000)
PROFILE_CHAR_LIMIT_RANGE = (1000, 2500)


class Skill(models.Model):
    """AC-65 — Workspace-scoped reusable agent skill (Metis Pattern).

    A Skill is a Markdown blob describing how an agent should approach a
    recurring task. Skills are auto-created during reflection (AC-71),
    can be patched iteratively (AC-72), are versioned (SkillVersion),
    and embedded in the Vector DB so ``find_relevant_skills`` can pull
    the top-K applicable to a given task description.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='agent_skills',
        db_index=True,
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    content_md = models.TextField(help_text='Markdown body of the skill (the "how-to").')
    version = models.IntegerField(default=1)
    trigger_type = models.CharField(
        max_length=30,
        choices=SkillTriggerType.choices,
        default=SkillTriggerType.MANUAL,
        db_index=True,
    )
    applicable_agent_types = models.JSONField(
        default=list,
        blank=True,
        help_text='List of agent_type values this skill applies to.',
    )
    success_count = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_by_session = models.ForeignKey(
        AgentSession,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_skills',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_skills',
    )
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(
                fields=['workspace', 'deleted_at'],
                name='skill_ws_deleted_idx',
            ),
            GinIndex(
                fields=['applicable_agent_types'],
                name='skill_agent_types_gin',
            ),
        ]
        verbose_name = 'Agent Skill'
        verbose_name_plural = 'Agent Skills'

    def __str__(self):
        return f"{self.name} (v{self.version})"

    @property
    def is_active(self) -> bool:
        return self.deleted_at is None

    def get_embedding_text(self) -> str:
        """Text representation for Vector DB embedding (AC-68 similarity search)."""
        parts = [self.name]
        if self.description:
            parts.append(self.description)
        if self.content_md:
            parts.append(self.content_md)
        return '\n\n'.join(parts)


class SkillVersion(models.Model):
    """Frozen snapshot of a Skill — append-only audit log + rollback target."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    skill = models.ForeignKey(
        Skill,
        on_delete=models.CASCADE,
        related_name='versions',
    )
    version = models.IntegerField()
    content_md = models.TextField()
    patch_summary = models.TextField(
        blank=True,
        default='',
        help_text='1-2 sentence rationale for this version (why was it created/patched).',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-version']
        unique_together = [('skill', 'version')]
        verbose_name = 'Skill Version'
        verbose_name_plural = 'Skill Versions'

    def __str__(self):
        return f"{self.skill.name} v{self.version}"


class WorkspaceMemory(models.Model):
    """AC-66 — Singleton workspace memory (Metis-style).

    Hard char-limit (default 2200) is load-bearing: forces consolidation /
    eviction during reflection. Without enforcement the emergent
    prioritization fails.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.OneToOneField(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='agent_memory',
    )
    content_md = models.TextField(
        max_length=DEFAULT_MEMORY_CHAR_LIMIT,
        validators=[MaxLengthValidator(DEFAULT_MEMORY_CHAR_LIMIT)],
        blank=True,
        default='',
        help_text='Compact Markdown summary of what the agent has learned about the workspace.',
    )
    last_consolidated_at = models.DateTimeField(null=True, blank=True)
    last_consolidated_session = models.ForeignKey(
        AgentSession,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='consolidated_memories',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Workspace Memory'
        verbose_name_plural = 'Workspace Memories'

    def __str__(self):
        return f"Memory for ws={self.workspace_id}"


class UserProfile(models.Model):
    """AC-67 — Per-user, per-workspace agent-inferred profile (dialectic-built)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='agent_user_profiles',
        db_index=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_profiles',
    )
    content_md = models.TextField(
        max_length=DEFAULT_PROFILE_CHAR_LIMIT,
        validators=[MaxLengthValidator(DEFAULT_PROFILE_CHAR_LIMIT)],
        blank=True,
        default='',
        help_text='Compact Markdown profile that the agent has inferred about this user.',
    )
    dialect_reasoning = models.TextField(
        blank=True,
        default='',
        help_text='Unbounded scratchpad — last dialectic 3-pass reasoning (read-only for UI).',
    )
    last_dialectic_at = models.DateTimeField(null=True, blank=True)
    dialect_cadence_sessions = models.IntegerField(
        default=2,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('workspace', 'user')]
        verbose_name = 'Agent User Profile'
        verbose_name_plural = 'Agent User Profiles'

    def __str__(self):
        return f"UserProfile ws={self.workspace_id} user={self.user_id}"


class AgentWorkspaceConfig(models.Model):
    """AC-75 — Per-workspace tuning knobs for the self-improvement layer."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.OneToOneField(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='agent_workspace_config',
    )
    reflection_cadence_sessions = models.IntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(50)],
    )
    skill_creation_min_tool_calls = models.IntegerField(
        default=5,
        validators=[MinValueValidator(1), MaxValueValidator(50)],
    )
    memory_char_limit = models.IntegerField(
        default=DEFAULT_MEMORY_CHAR_LIMIT,
        validators=[
            MinValueValidator(MEMORY_CHAR_LIMIT_RANGE[0]),
            MaxValueValidator(MEMORY_CHAR_LIMIT_RANGE[1]),
        ],
    )
    profile_char_limit = models.IntegerField(
        default=DEFAULT_PROFILE_CHAR_LIMIT,
        validators=[
            MinValueValidator(PROFILE_CHAR_LIMIT_RANGE[0]),
            MaxValueValidator(PROFILE_CHAR_LIMIT_RANGE[1]),
        ],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Agent Workspace Config'
        verbose_name_plural = 'Agent Workspace Configs'

    def __str__(self):
        return f"AgentWorkspaceConfig ws={self.workspace_id}"
