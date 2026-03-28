from rest_framework import serializers

from agent_app.constants import PERSONALITY_PRESETS, TOOL_DESCRIPTIONS
from agent_app.models import (
    AgentActionLog,
    AgentConfig,
    AgentMessage,
    AgentSession,
    AutonomyPreset,
    KnowledgeDoc,
    ToolPermission,
    WorkflowTemplate,
)


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
        return PERSONALITY_PRESETS.get(obj.agent_type, [])


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

class AgentSessionListSerializer(serializers.ModelSerializer):
    message_count = serializers.SerializerMethodField()
    niche_name = serializers.SerializerMethodField()
    created_by_email = serializers.CharField(source='created_by.email', read_only=True)

    class Meta:
        model = AgentSession
        fields = [
            'id', 'title', 'status', 'workflow_template', 'autonomy_preset',
            'is_shared', 'current_step', 'total_steps', 'completed_steps',
            'niche_name', 'created_by_email', 'message_count',
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

    class Meta(AgentSessionListSerializer.Meta):
        fields = AgentSessionListSerializer.Meta.fields + ['error_message']


class AgentSessionCreateSerializer(serializers.Serializer):
    workflow_template = serializers.CharField(max_length=50, required=False, allow_blank=True)
    niche_context = serializers.UUIDField(required=False, allow_null=True)
    title = serializers.CharField(max_length=200, required=False, allow_blank=True)
    autonomy_preset = serializers.CharField(max_length=20, required=False, default='assisted')


class BatchSessionCreateSerializer(serializers.Serializer):
    niche_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1, max_length=50)
    workflow_template = serializers.CharField(max_length=50, required=False, allow_blank=True)
    parallel = serializers.BooleanField(default=False)


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
            'agent_display_name', 'agent_avatar_emoji', 'created_at',
        ]

    def get_agent_display_name(self, obj):
        if obj.agent_type:
            configs = self.context.get('agent_configs', {})
            config = configs.get(obj.agent_type)
            if config:
                return config.display_name
        return None

    def get_agent_avatar_emoji(self, obj):
        if obj.agent_type:
            configs = self.context.get('agent_configs', {})
            config = configs.get(obj.agent_type)
            if config:
                return config.avatar_emoji
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
        if obj.target_object_type and obj.target_object_id:
            return f"{obj.target_object_type}:{obj.target_object_id}"
        return None


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
    class Meta:
        model = AutonomyPreset
        fields = ['id', 'name', 'is_system', 'permissions', 'created_at']
        read_only_fields = ['id', 'is_system', 'created_at']


# ── Knowledge ──

class KnowledgeDocSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeDoc
        fields = ['id', 'title', 'content', 'source', 'created_at', 'updated_at']
        read_only_fields = ['id', 'source', 'created_at', 'updated_at']


class KnowledgeDocCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeDoc
        fields = ['title', 'content']


# ── Templates ──

class WorkflowTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowTemplate
        fields = ['id', 'name', 'key', 'is_system', 'steps', 'created_at']
        read_only_fields = ['id', 'is_system', 'created_at']


class WorkflowTemplateCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    key = serializers.SlugField(max_length=50)
    steps = serializers.ListField(
        child=serializers.DictField(),
        min_length=1,
        max_length=20,
    )
