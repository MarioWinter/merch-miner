from rest_framework import serializers

from search_app.models import (
    ChatMessage,
    ChatSession,
    WebSearchResult,
)


class ChatMessageSerializer(serializers.ModelSerializer):
    """Serializer for ChatMessage (read-only, nested in session detail)."""

    class Meta:
        model = ChatMessage
        fields = [
            'id', 'role', 'content', 'message_type', 'sources',
            'search_mode', 'search_sources', 'model_used', 'created_at',
        ]
        read_only_fields = fields


class ChatSessionListSerializer(serializers.ModelSerializer):
    """Serializer for listing chat sessions (compact)."""

    message_count = serializers.SerializerMethodField()
    shared_by = serializers.SerializerMethodField()
    niche_context_name = serializers.SerializerMethodField()
    niche_context_id = serializers.SerializerMethodField()

    class Meta:
        model = ChatSession
        fields = [
            'id', 'title', 'is_shared', 'niche_context_id',
            'niche_context_name', 'message_count', 'shared_by',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_message_count(self, obj):
        if hasattr(obj, '_message_count'):
            return obj._message_count
        return obj.messages.count()

    def get_shared_by(self, obj):
        if obj.is_shared:
            return getattr(obj.created_by, 'email', str(obj.created_by))
        return None

    def get_niche_context_name(self, obj):
        if obj.niche_context:
            return obj.niche_context.name
        return None

    def get_niche_context_id(self, obj):
        if obj.niche_context:
            return str(obj.niche_context.id)
        return None


class ChatSessionDetailSerializer(serializers.ModelSerializer):
    """Serializer for session detail (includes messages)."""

    messages = serializers.SerializerMethodField()
    message_count = serializers.SerializerMethodField()
    shared_by = serializers.SerializerMethodField()
    niche_context_name = serializers.SerializerMethodField()
    niche_context_id = serializers.SerializerMethodField()

    class Meta:
        model = ChatSession
        fields = [
            'id', 'title', 'is_shared', 'niche_context_id',
            'niche_context_name', 'messages', 'message_count',
            'shared_by', 'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_messages(self, obj):
        """Return latest 50 messages (EC-9: paginate 100+ messages)."""
        qs = obj.messages.order_by('-created_at')[:50]
        # Reverse to show oldest first in the list
        messages = list(reversed(qs))
        return ChatMessageSerializer(messages, many=True).data

    def get_message_count(self, obj):
        return obj.messages.count()

    def get_shared_by(self, obj):
        if obj.is_shared:
            return getattr(obj.created_by, 'email', str(obj.created_by))
        return None

    def get_niche_context_name(self, obj):
        if obj.niche_context:
            return obj.niche_context.name
        return None

    def get_niche_context_id(self, obj):
        if obj.niche_context:
            return str(obj.niche_context.id)
        return None


class ChatSessionCreateSerializer(serializers.Serializer):
    """Input serializer for creating a chat session."""
    title = serializers.CharField(max_length=200, required=False, default='')
    niche_context = serializers.UUIDField(required=False, allow_null=True, default=None)


class ChatSessionUpdateSerializer(serializers.Serializer):
    """Input serializer for PATCH update (title only)."""
    title = serializers.CharField(max_length=200, required=False)


class SendMessageSerializer(serializers.Serializer):
    """Input serializer for sending a message (triggers Vane search)."""
    content = serializers.CharField()
    search_mode = serializers.ChoiceField(
        choices=['speed', 'balanced', 'quality'],
        default='balanced',
    )
    search_sources = serializers.ListField(
        child=serializers.ChoiceField(choices=['web', 'academic', 'discussions']),
        default=['web'],
    )
    model = serializers.CharField(max_length=100, required=False, default='')
    system_instructions = serializers.CharField(required=False, default='')


class TriggerCrawlSerializer(serializers.Serializer):
    """Input serializer for triggering a deep crawl."""
    url = serializers.URLField(max_length=2000)
    chat_message_id = serializers.UUIDField(required=False, allow_null=True, default=None)


class SaveToNicheSerializer(serializers.Serializer):
    """Input serializer for saving search result to a niche."""
    niche_id = serializers.UUIDField()
    save_as = serializers.ChoiceField(choices=['keywords', 'notes'])


class WebSearchResultSerializer(serializers.ModelSerializer):
    """Serializer for WebSearchResult."""

    content_preview = serializers.SerializerMethodField()

    class Meta:
        model = WebSearchResult
        fields = [
            'id', 'url', 'title', 'content_preview', 'content_type',
            'crawl_status', 'error_message', 'metadata', 'created_at',
        ]
        read_only_fields = fields

    def get_content_preview(self, obj):
        if obj.content:
            return obj.content[:500]
        return ''


class SearchHealthSerializer(serializers.Serializer):
    """Response serializer for health check."""
    vane = serializers.ChoiceField(choices=['online', 'offline'])
    crawl4ai = serializers.ChoiceField(choices=['online', 'offline'])
