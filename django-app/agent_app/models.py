import uuid

from django.conf import settings
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
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(
                fields=['session', 'created_at'],
                name='agentmsg_sess_created_idx',
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
