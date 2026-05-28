from rest_framework import serializers

from search_app.models import (
    ChatMessage,
    ChatSession,
    WebSearchResult,
)


class ChatMessageSerializer(serializers.ModelSerializer):
    """Serializer for ChatMessage (read-only, nested in session detail)."""

    agent_session = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()
    # FIX 2026-05-28 Item 4 — per-message niche reference. Set only on
    # role='user' messages by the SSE stream view; null on assistant rows.
    # Exposed for the chat-history NicheChip render (read-only).
    referenced_niche_id = serializers.UUIDField(
        source='referenced_niche.id', read_only=True, allow_null=True,
    )
    referenced_niche_name = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = [
            'id', 'role', 'content', 'message_type', 'sources',
            'search_mode', 'search_sources', 'model_used',
            'agent_session', 'attachments',
            # PROJ-29 Phase 1I — structured slogan payload from niche-RAG agent.
            # Null on every non-niche-agent message.
            'generate_slogans_payload',
            # PROJ-29 Phase 1I follow-up — chunks_used + thinking_stages drive
            # the ThinkingStrip ExpandedPanel + NicheCitationLink hover-flash
            # on persisted messages.
            'chunks_used',
            'thinking_stages',
            # FIX 2026-05-28 Item 4 — per-message niche reference.
            'referenced_niche_id',
            'referenced_niche_name',
            'created_at',
        ]
        read_only_fields = fields

    def get_referenced_niche_name(self, obj):
        if obj.referenced_niche_id:
            return obj.referenced_niche.name
        return None

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

    def get_attachments(self, obj):
        """PROJ-20 Phase 7.6 — return image attachments linked to this message.

        We rely on the reverse-related-manager `attachments` set up by
        `chat_attachments_app.models.ChatAttachment.message`. Each entry
        carries enough info for the frontend thumbnail + purged-placeholder
        render path.
        """
        try:
            attachments = list(obj.attachments.all())
        except (AttributeError, Exception):  # noqa: BLE001 - relation may not exist
            return []
        out = []
        for a in attachments:
            try:
                url = a.file.url if a.file and not a.purged_at else None
            except (ValueError, AttributeError):
                url = None
            out.append({
                'id': str(a.id),
                'filename': a.original_filename,
                'mime_type': a.mime_type,
                'size': a.size_bytes,
                'thumbnail_url': url,
                'attachment_type': a.attachment_type,
                'purged_at': (
                    a.purged_at.isoformat() if a.purged_at else None
                ),
                'created_at': a.created_at.isoformat(),
            })
        return out


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
        # FIX 2026-05-28 Item 4 — select_related so the new
        # referenced_niche_name field doesn't hit a per-row query.
        qs = obj.messages.select_related('referenced_niche').order_by(
            '-created_at',
        )[:50]
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


class PublicChatMessageSerializer(serializers.ModelSerializer):
    """Read-only message serializer for public-shared sessions.

    Excludes any internal/operator fields. Only renders what a public viewer
    needs to read the conversation: role, content, message_type, sources,
    model_used, attachments, created_at.

    BUG-3 fix (2026-04-28): include image attachments so the public viewer
    can render the same conversation the owner sees. Attachment file URLs
    are static-file paths under MEDIA_URL and are accessible without auth —
    the share-token itself gates the conversation, so anyone with the link
    is intended to see the full thread (text + sources + images).
    """

    attachments = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = [
            'id', 'role', 'content', 'message_type', 'sources',
            'model_used', 'attachments', 'created_at',
        ]
        read_only_fields = fields

    def get_attachments(self, obj):
        try:
            attachments = list(obj.attachments.all())
        except (AttributeError, Exception):  # noqa: BLE001
            return []
        out = []
        for a in attachments:
            try:
                url = a.file.url if a.file and not a.purged_at else None
            except (ValueError, AttributeError):
                url = None
            out.append({
                'id': str(a.id),
                'filename': a.original_filename,
                'mime_type': a.mime_type,
                'size': a.size_bytes,
                'thumbnail_url': url,
                'attachment_type': a.attachment_type,
                'purged_at': (
                    a.purged_at.isoformat() if a.purged_at else None
                ),
                'created_at': a.created_at.isoformat(),
            })
        return out


class PublicChatSessionSerializer(serializers.ModelSerializer):
    """Read-only public serializer for shared chat sessions.

    PROJ-20 Phase 1.3: returned by `GET /api/chat/sessions/shared/<token>/`.
    Excludes `created_by`, `workspace`, `share_token`, `niche_context_id`, and
    any other internal/operator fields. The public viewer only needs the title,
    timestamps, and the ordered list of messages with their sources.
    """

    messages = serializers.SerializerMethodField()
    niche_context_name = serializers.SerializerMethodField()

    class Meta:
        model = ChatSession
        fields = [
            'id', 'title', 'niche_context_name',
            'messages', 'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_messages(self, obj):
        # Public viewers see ALL messages in chronological order (oldest first).
        qs = obj.messages.order_by('created_at')
        return PublicChatMessageSerializer(qs, many=True).data

    def get_niche_context_name(self, obj):
        if obj.niche_context:
            return obj.niche_context.name
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


class ChatStreamRequestSerializer(serializers.Serializer):
    """Input serializer for the SSE chat stream POST body (FIX 2026-05-28).

    Replaces the URL-query-string GET contract on
    ``ChatSessionMessageStreamView`` so prompts larger than the proxy URI
    cap (~8 KB on Caddy) can travel in the request body instead. The shape
    is intentionally the union of every query param the legacy GET accepts;
    the view's internal ``_stream`` helper consumes both paths identically.
    """

    content = serializers.CharField(
        required=True, max_length=64000, allow_blank=False,
    )
    mode_override = serializers.CharField(
        required=False, allow_blank=True, default='',
    )
    niche_id = serializers.UUIDField(
        required=False, allow_null=True, default=None,
    )
    attachment_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False, allow_empty=True, default=list,
    )
    model = serializers.CharField(
        required=False, allow_blank=True, default='',
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
