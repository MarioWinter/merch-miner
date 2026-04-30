from rest_framework import serializers

from agent_app.constants import PERSONALITY_PRESETS, TOOL_DESCRIPTIONS
from agent_app.models import (
    DEFAULT_MEMORY_CHAR_LIMIT,
    DEFAULT_PROFILE_CHAR_LIMIT,
    MEMORY_CHAR_LIMIT_RANGE,
    PROFILE_CHAR_LIMIT_RANGE,
    AgentActionLog,
    AgentConfig,
    AgentMessage,
    AgentSession,
    AgentWorkspaceConfig,
    AutonomyPreset,
    KnowledgeDoc,
    Skill,
    SkillTriggerType,
    SkillVersion,
    ToolPermission,
    UserProfile,
    WorkflowTemplate,
    WorkspaceMemory,
    validate_workflow_steps,
)


def _slugify_preset_name(name: str) -> str:
    """Stable, deterministic preset key (no DB roundtrip).

    Lowercase, underscores for spaces, drops chars outside [a-z0-9_].
    """
    if not name:
        return ''
    out = []
    for ch in name.lower():
        if ch.isalnum():
            out.append(ch)
        elif ch in (' ', '-', '_'):
            out.append('_')
    # Collapse double underscores.
    slug = ''.join(out)
    while '__' in slug:
        slug = slug.replace('__', '_')
    return slug.strip('_')


class AgentConfigSerializer(serializers.ModelSerializer):
    personality_presets = serializers.SerializerMethodField()

    class Meta:
        model = AgentConfig
        fields = [
            'id', 'agent_type', 'display_name', 'personality',
            'avatar_emoji', 'model_name', 'temperature', 'system_prompt',
            'max_tokens', 'updated_at', 'personality_presets',
        ]
        read_only_fields = ['id', 'agent_type', 'updated_at', 'personality_presets']

    def get_personality_presets(self, obj):
        """AC-55e: clickable preset chips per agent type.

        Returns a list of ``{key, name, description}`` dicts so the
        frontend can render chips with stable identifiers.
        """
        raw = PERSONALITY_PRESETS.get(obj.agent_type, [])
        return [
            {
                'key': _slugify_preset_name(p['name']),
                'name': p['name'],
                'description': p.get('text', ''),
            }
            for p in raw
        ]


class AgentConfigUpdateSerializer(serializers.ModelSerializer):
    """Subset of fields that users can update."""

    class Meta:
        model = AgentConfig
        fields = [
            'display_name', 'personality', 'avatar_emoji',
            'model_name', 'temperature', 'max_tokens',
        ]


class AgentConfigAdminUpdateSerializer(AgentConfigUpdateSerializer):
    """Admin can also update system_prompt."""

    class Meta(AgentConfigUpdateSerializer.Meta):
        fields = AgentConfigUpdateSerializer.Meta.fields + ['system_prompt']


# ── Session ──

class _NicheContextSerializer(serializers.Serializer):
    """Inline {id, name} payload for AgentSession.niche_context."""

    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(read_only=True)


class AgentSessionListSerializer(serializers.ModelSerializer):
    message_count = serializers.SerializerMethodField()
    niche_name = serializers.SerializerMethodField()
    created_by_email = serializers.CharField(source='created_by.email', read_only=True)

    class Meta:
        model = AgentSession
        fields = [
            'id', 'title', 'status', 'workflow_template', 'autonomy_preset',
            'is_shared', 'source', 'current_step', 'total_steps',
            'completed_steps', 'niche_name', 'created_by_email',
            'message_count', 'batch_id', 'batch_position',
            'created_at', 'updated_at', 'completed_at',
        ]

    def get_message_count(self, obj):
        if hasattr(obj, '_message_count'):
            return obj._message_count
        return obj.messages.count()

    def get_niche_name(self, obj):
        if obj.niche_context_id:
            return getattr(obj.niche_context, 'name', None)
        return None


class AgentSessionDetailSerializer(AgentSessionListSerializer):
    error_message = serializers.CharField(read_only=True)
    niche_context = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()

    class Meta(AgentSessionListSerializer.Meta):
        fields = AgentSessionListSerializer.Meta.fields + [
            'error_message', 'niche_context', 'progress',
        ]

    def get_niche_context(self, obj):
        """Phase 8: nested {id, name} (not just UUID)."""
        if not obj.niche_context_id:
            return None
        return {
            'id': str(obj.niche_context_id),
            'name': getattr(obj.niche_context, 'name', None),
        }

    def get_progress(self, obj):
        """Phase 8: structured progress payload for frontend stepper."""
        total = obj.total_steps or 0
        completed = obj.completed_steps or 0
        if total > 0:
            percent = int(round((completed / total) * 100))
        else:
            percent = 0
        return {
            'current_step': obj.current_step or '',
            'completed_steps': completed,
            'total_steps': total,
            'percent': percent,
        }


class AgentSessionCreateSerializer(serializers.Serializer):
    workflow_template = serializers.CharField(max_length=50, required=False, allow_blank=True)
    niche_context = serializers.UUIDField(required=False, allow_null=True)
    title = serializers.CharField(max_length=200, required=False, allow_blank=True)
    autonomy_preset = serializers.CharField(max_length=20, required=False, default='assisted')


class BatchSessionCreateSerializer(serializers.Serializer):
    niche_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1, max_length=50)
    workflow_template = serializers.CharField(max_length=50, required=False, allow_blank=True)
    parallel = serializers.BooleanField(default=False)
    autonomy_preset = serializers.CharField(
        max_length=20, required=False, allow_blank=True, default='assisted',
    )


class SendMessageSerializer(serializers.Serializer):
    content = serializers.CharField(max_length=5000)


# ── Messages ──

class AgentMessageSerializer(serializers.ModelSerializer):
    agent_display_name = serializers.SerializerMethodField()
    agent_avatar_emoji = serializers.SerializerMethodField()

    class Meta:
        model = AgentMessage
        fields = [
            'id', 'role', 'content', 'agent_type', 'tool_calls',
            'processed', 'agent_display_name', 'agent_avatar_emoji', 'created_at',
        ]

    def _get_config(self, obj):
        """Resolve AgentConfig for this message via cached context.

        The view should populate ``context['agent_configs']`` as
        ``{agent_type: AgentConfig}`` to avoid N+1. Returns ``None``
        when the agent_type is empty (user/system messages) or no
        config exists for that type.
        """
        if not obj.agent_type:
            return None
        configs = self.context.get('agent_configs') or {}
        return configs.get(obj.agent_type)

    def get_agent_display_name(self, obj):
        config = self._get_config(obj)
        if config:
            return config.display_name
        # Fallback: code defaults (AC-55f) when config lookup unavailable.
        if obj.agent_type:
            from agent_app.models import AGENT_DEFAULTS
            defaults = AGENT_DEFAULTS.get(obj.agent_type, {})
            return defaults.get('display_name')
        return None

    def get_agent_avatar_emoji(self, obj):
        config = self._get_config(obj)
        if config:
            return config.avatar_emoji
        if obj.agent_type:
            from agent_app.models import AGENT_DEFAULTS
            defaults = AGENT_DEFAULTS.get(obj.agent_type, {})
            return defaults.get('avatar_emoji')
        return None


# ── Action Logs ──

class AgentActionLogSerializer(serializers.ModelSerializer):
    target_summary = serializers.SerializerMethodField()

    class Meta:
        model = AgentActionLog
        fields = [
            'id', 'agent_type', 'action', 'target_object_type',
            'target_object_id', 'status', 'cost_estimate',
            'error_message', 'target_summary', 'created_at', 'completed_at',
        ]

    def get_target_summary(self, obj):
        """Resolve target reference to a human-readable label.

        Delegates to ``services.target_resolver.resolve_target_summary``
        which dispatches by ``target_object_type`` and falls back to
        ``"<Type>: (deleted)"`` when the referenced object is gone.
        """
        from agent_app.services.target_resolver import resolve_target_summary

        return resolve_target_summary(obj.target_object_type, obj.target_object_id)


# ── Permissions ──

class ToolPermissionSerializer(serializers.ModelSerializer):
    tool_description = serializers.SerializerMethodField()

    class Meta:
        model = ToolPermission
        fields = ['id', 'tool_name', 'permission_level', 'tool_description', 'updated_at']
        read_only_fields = ['id', 'tool_name', 'tool_description', 'updated_at']

    def get_tool_description(self, obj):
        return TOOL_DESCRIPTIONS.get(obj.tool_name, '')


class ToolPermissionBulkUpdateSerializer(serializers.Serializer):
    permissions = serializers.DictField(
        child=serializers.ChoiceField(choices=['auto', 'notify', 'approve']),
        help_text='{tool_name: permission_level}',
    )


# ── Presets ──

class AutonomyPresetSerializer(serializers.ModelSerializer):
    tool_count = serializers.SerializerMethodField()

    class Meta:
        model = AutonomyPreset
        fields = [
            'id', 'name', 'is_system', 'permissions', 'tool_count', 'created_at',
        ]
        read_only_fields = ['id', 'is_system', 'tool_count', 'created_at']

    def get_tool_count(self, obj):
        perms = obj.permissions or {}
        if isinstance(perms, dict):
            return len(perms)
        return 0


# ── Knowledge ──

class KnowledgeDocSerializer(serializers.ModelSerializer):
    created_by_username = serializers.SerializerMethodField()
    content_preview = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgeDoc
        fields = [
            'id', 'title', 'content', 'content_preview', 'source',
            'created_by_username', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'source', 'content_preview',
            'created_by_username', 'created_at', 'updated_at',
        ]

    def get_created_by_username(self, obj):
        user = getattr(obj, 'created_by', None)
        if not user:
            return None
        return (
            getattr(user, 'username', None)
            or getattr(user, 'email', None)
        )

    def get_content_preview(self, obj):
        content = obj.content or ''
        if len(content) <= 200:
            return content
        return content[:200].rstrip() + '…'


class KnowledgeDocCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeDoc
        fields = ['title', 'content']


# ── Templates ──

# Default action descriptions used when a step omits its own ``description``.
# Keys mirror ``WorkflowTemplate.steps[].action`` values seeded in
# ``constants.SYSTEM_TEMPLATES`` and accepted in the create serializer.
STEP_ACTION_DESCRIPTIONS = {
    'deep_research': 'Run deep niche research',
    'product_research': 'Scrape Amazon products',
    'slogan_generation': 'Generate slogans and ideas',
    'adaptation': 'Adapt and refine slogans',
    'design_generation': 'Generate designs',
    'batch_processing': 'Batch process designs',
    'listing_generation': 'Create listings',
    'keywords': 'Optimize keywords',
    'finalize': 'Mark listings ready',
    'publish': 'Prepare for upload',
}


class WorkflowTemplateSerializer(serializers.ModelSerializer):
    steps_with_descriptions = serializers.SerializerMethodField()

    class Meta:
        model = WorkflowTemplate
        fields = [
            'id', 'name', 'key', 'is_system', 'steps',
            'steps_with_descriptions', 'created_at',
        ]
        read_only_fields = [
            'id', 'is_system', 'steps_with_descriptions', 'created_at',
        ]

    def get_steps_with_descriptions(self, obj):
        """Enrich each step with a description for the workflow stepper UI.

        Custom templates created via the API may omit the ``description``
        key; we fall back to ``STEP_ACTION_DESCRIPTIONS[action]`` and finally
        to the action label itself so the frontend always has something
        renderable.
        """
        steps = obj.steps or []
        if not isinstance(steps, list):
            return []
        enriched = []
        for step in steps:
            if not isinstance(step, dict):
                continue
            agent_type = step.get('agent_type', '')
            action = step.get('action', '')
            description = step.get('description') or STEP_ACTION_DESCRIPTIONS.get(
                action, action.replace('_', ' ').title() if action else '',
            )
            enriched.append({
                'agent_type': agent_type,
                'action': action,
                'description': description,
            })
        return enriched


class WorkflowTemplateCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    key = serializers.SlugField(max_length=50)
    steps = serializers.ListField(
        child=serializers.DictField(),
        min_length=1,
        max_length=20,
    )

    def validate_steps(self, value):
        """EC-14: structural + prerequisite validation."""
        errors = validate_workflow_steps(value)
        if errors:
            raise serializers.ValidationError(errors)
        return value


# ── PROJ-18 AC-63 — Dashboard summary widget ──

class _LastCompletedSessionSerializer(serializers.Serializer):
    session_id = serializers.CharField()
    title = serializers.CharField(allow_blank=True)
    completed_at = serializers.CharField()


class AgentDashboardSummarySerializer(serializers.Serializer):
    """AC-63 — agent dashboard summary widget payload."""
    active_count = serializers.IntegerField()
    last_completed = _LastCompletedSessionSerializer(allow_null=True)
    weekly_actions = serializers.IntegerField()
    budget_pct = serializers.FloatField()


# ── PROJ-18 Phase 14 — Self-Improvement Layer (Metis Pattern) ────────────────

class SkillSerializer(serializers.ModelSerializer):
    """AC-65 — read serializer for Skill (workspace-scoped)."""

    version_count = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()

    class Meta:
        model = Skill
        fields = [
            'id', 'name', 'description', 'content_md', 'version',
            'trigger_type', 'applicable_agent_types',
            'success_count', 'error_count',
            'last_used_at', 'deleted_at',
            'created_by_session', 'created_by',
            'created_at', 'updated_at',
            'version_count', 'is_active',
        ]
        read_only_fields = [
            'id', 'version', 'success_count', 'error_count', 'last_used_at',
            'deleted_at', 'created_by_session', 'created_by',
            'created_at', 'updated_at', 'version_count', 'is_active',
        ]

    def get_version_count(self, obj):
        return obj.versions.count() if obj.pk else 0

    def get_is_active(self, obj):
        return obj.deleted_at is None


class SkillCreateSerializer(serializers.Serializer):
    """Manual Skill creation — admin only (POST /api/agent/skills/)."""

    name = serializers.CharField(max_length=200)
    description = serializers.CharField(allow_blank=True, default='')
    content_md = serializers.CharField()
    applicable_agent_types = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )
    patch_summary = serializers.CharField(
        allow_blank=True, default='', max_length=500,
    )


class SkillPatchSerializer(serializers.Serializer):
    """Optimistic-concurrency patch — EC-19 surfaces 409 on stale version."""

    patch_md = serializers.CharField()
    expected_version = serializers.IntegerField(min_value=1)
    patch_summary = serializers.CharField(
        allow_blank=True, default='', max_length=500,
    )


class SkillVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SkillVersion
        fields = ['id', 'version', 'content_md', 'patch_summary', 'created_at']
        read_only_fields = fields


class WorkspaceMemorySerializer(serializers.ModelSerializer):
    """AC-66 — workspace memory with computed char_count + char_limit."""

    char_count = serializers.SerializerMethodField()
    char_limit = serializers.SerializerMethodField()

    class Meta:
        model = WorkspaceMemory
        fields = [
            'id', 'content_md',
            'last_consolidated_at', 'last_consolidated_session',
            'char_count', 'char_limit',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'last_consolidated_at', 'last_consolidated_session',
            'char_count', 'char_limit', 'created_at', 'updated_at',
        ]

    def get_char_count(self, obj):
        return len(obj.content_md or '')

    def get_char_limit(self, obj):
        cfg = AgentWorkspaceConfig.objects.filter(workspace_id=obj.workspace_id).first()
        return cfg.memory_char_limit if cfg else DEFAULT_MEMORY_CHAR_LIMIT


class WorkspaceMemoryPatchSerializer(serializers.Serializer):
    """Char-limit enforced server-side — caller must respect AgentWorkspaceConfig."""

    content_md = serializers.CharField(allow_blank=True)


class UserProfileSerializer(serializers.ModelSerializer):
    """AC-67 — user profile.

    ``dialect_reasoning`` is exposed only when the serializer context flag
    ``include_reasoning=True`` is set (e.g. ``?include_reasoning=true`` on
    GET). All other paths receive a redacted payload to keep the
    scratchpad out of regular responses.
    """

    char_count = serializers.SerializerMethodField()
    char_limit = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            'id', 'content_md',
            'last_dialectic_at', 'dialect_cadence_sessions',
            'dialect_reasoning',
            'char_count', 'char_limit',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'last_dialectic_at', 'dialect_reasoning',
            'char_count', 'char_limit', 'created_at', 'updated_at',
        ]

    def get_char_count(self, obj):
        return len(obj.content_md or '')

    def get_char_limit(self, obj):
        cfg = AgentWorkspaceConfig.objects.filter(workspace_id=obj.workspace_id).first()
        return cfg.profile_char_limit if cfg else DEFAULT_PROFILE_CHAR_LIMIT

    def to_representation(self, instance):
        data = super().to_representation(instance)
        include_reasoning = bool(self.context.get('include_reasoning'))
        if not include_reasoning:
            data.pop('dialect_reasoning', None)
        return data


class UserProfilePatchSerializer(serializers.Serializer):
    """Server enforces char-limit + cadence-range bounds."""

    content_md = serializers.CharField(allow_blank=True, required=False)
    dialect_cadence_sessions = serializers.IntegerField(
        min_value=1, max_value=5, required=False,
    )


class AgentWorkspaceConfigSerializer(serializers.ModelSerializer):
    """AC-75 — admin-editable cadence + char-limit knobs."""

    class Meta:
        model = AgentWorkspaceConfig
        fields = [
            'id',
            'reflection_cadence_sessions',
            'skill_creation_min_tool_calls',
            'memory_char_limit',
            'profile_char_limit',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_memory_char_limit(self, value):
        lo, hi = MEMORY_CHAR_LIMIT_RANGE
        if not (lo <= value <= hi):
            raise serializers.ValidationError(
                f'memory_char_limit must be between {lo} and {hi}',
            )
        return value

    def validate_profile_char_limit(self, value):
        lo, hi = PROFILE_CHAR_LIMIT_RANGE
        if not (lo <= value <= hi):
            raise serializers.ValidationError(
                f'profile_char_limit must be between {lo} and {hi}',
            )
        return value

    def validate_reflection_cadence_sessions(self, value):
        if not (1 <= value <= 50):
            raise serializers.ValidationError(
                'reflection_cadence_sessions must be between 1 and 50',
            )
        return value

    def validate_skill_creation_min_tool_calls(self, value):
        if not (1 <= value <= 50):
            raise serializers.ValidationError(
                'skill_creation_min_tool_calls must be between 1 and 50',
            )
        return value

