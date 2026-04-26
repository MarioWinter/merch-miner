from rest_framework import serializers

from search_app.models import (
    ChatMessage,
    ChatSession,
    WebSearchResult,
)


class ChatMessageSerializer(serializers.ModelSerializer):
    """Serializer for ChatMessage (read-only, nested in session detail)."""

    agent_session = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = [
            'id', 'role', 'content', 'message_type', 'sources',
            'search_mode', 'search_sources', 'model_used',
            'agent_session', 'created_at',
        ]
        read_only_fields = fields

    def get_agent_session(self, obj):
        """Return nested {id, status, current_step} when agent_session is set."""
        if not obj.agent_session_id:
            return None
        sess = obj.agent_session
        return {
            'id': str(sess.id),
            'status': sess.status,
            'current_step': sess.current_step,
            'completed_steps': sess.completed_steps,
            'total_steps': sess.total_steps,
        }


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
        # Only surface `shared_by` to *non-owner* viewers — the owner of a
        # shared session is never read-only and must not see a "Shared by X"
        # banner when looking at their own session.
        if not obj.is_shared:
            return None
        request = self.context.get('request') if hasattr(self, 'context') else None
        viewer = getattr(request, 'user', None) if request else None
        if viewer and viewer.is_authenticated and obj.created_by_id == viewer.id:
            return None
        return getattr(obj.created_by, 'email', str(obj.created_by))

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
        # Only surface `shared_by` to *non-owner* viewers — the owner of a
        # shared session is never read-only and must not see a "Shared by X"
        # banner when looking at their own session.
        if not obj.is_shared:
            return None
        request = self.context.get('request') if hasattr(self, 'context') else None
        viewer = getattr(request, 'user', None) if request else None
        if viewer and viewer.is_authenticated and obj.created_by_id == viewer.id:
            return None
        return getattr(obj.created_by, 'email', str(obj.created_by))

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
    """Input serializer for sending a message (triggers Vane search or Agent workflow)."""
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
    mode_override = serializers.ChoiceField(
        choices=['auto', 'web_search', 'agent'],
        default='auto',
        help_text='Pattern B: auto = LLM classifier, web_search = force Vane, agent = force PROJ-18.',
    )


class TriggerCrawlSerializer(serializers.Serializer):
    """Input serializer for triggering a deep crawl."""
    url = serializers.URLField(max_length=2000)
    chat_message_id = serializers.UUIDField(required=False, allow_null=True, default=None)


class SaveToNicheSerializer(serializers.Serializer):
    """Input serializer for saving search result to a niche.

    selected_text is a manually-marked snippet from the frontend. For 'keywords',
    it is split by comma/newline → one NicheKeyword per token (web_search source).
    For 'notes', it is appended to Niche.notes (with source URL prefix).
    If selected_text is empty, falls back to result.title.
    """
    niche_id = serializers.UUIDField()
    save_as = serializers.ChoiceField(choices=['keywords', 'notes'])
    selected_text = serializers.CharField(required=False, default='', allow_blank=True)


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
