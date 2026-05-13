import uuid

from django.conf import settings
from django.db import models


class ChatSession(models.Model):
    """Persistent chat session for web search conversations."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='chat_sessions',
        db_index=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='chat_sessions',
    )
    title = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text='Auto-generated from first query if not set.',
    )
    is_shared = models.BooleanField(default=False, db_index=True)
    share_token = models.CharField(
        max_length=64,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text='Random token used to access the shared chat via public URL.',
    )
    niche_context = models.ForeignKey(
        'niche_app.Niche',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='chat_sessions',
    )
    conversation_summary = models.TextField(
        blank=True,
        default='',
        help_text=(
            'Rolling summary of turns 1..(N-5) when conversation exceeds '
            '10 turns (PROJ-29 AC-Context-2). Regenerated after each new '
            'turn via the conversation_summarizer rq job; eventually '
            'consistent (EC-28).'
        ),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(
                fields=['workspace', '-updated_at'],
                name='chatsess_ws_updated_idx',
            ),
            models.Index(
                fields=['created_by', '-updated_at'],
                name='chatsess_user_updated_idx',
            ),
        ]

    def __str__(self):
        return self.title or f"Session {self.id}"


class ChatMessage(models.Model):
    """Single message in a chat session (user query, assistant response, etc.)."""

    class Role(models.TextChoices):
        USER = 'user', 'User'
        ASSISTANT = 'assistant', 'Assistant'
        SYSTEM = 'system', 'System'

    class MessageType(models.TextChoices):
        SEARCH_QUERY = 'search_query', 'Search Query'
        SEARCH_RESULT = 'search_result', 'Search Result'
        CRAWL_REQUEST = 'crawl_request', 'Crawl Request'
        CRAWL_RESULT = 'crawl_result', 'Crawl Result'
        WORKFLOW_TRIGGER = 'workflow_trigger', 'Workflow Trigger'
        WORKFLOW_CARD = 'workflow_card', 'Workflow Card'
        # PROJ-29 Phase 1J BUG-4 — placeholder when the agent stream errors
        # before producing a final answer. Pairs with the user message so the
        # chat list doesn't strand a question with no visible response.
        ERROR = 'error', 'Error'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        ChatSession,
        on_delete=models.CASCADE,
        related_name='messages',
        db_index=True,
    )
    role = models.CharField(max_length=10, choices=Role.choices)
    content = models.TextField()
    message_type = models.CharField(
        max_length=20,
        choices=MessageType.choices,
        default=MessageType.SEARCH_QUERY,
    )
    sources = models.JSONField(
        default=list,
        blank=True,
        help_text='Array of {title, url, snippet} from Vane results.',
    )
    search_mode = models.CharField(
        max_length=10,
        null=True,
        blank=True,
        help_text='speed, balanced, or quality.',
    )
    search_sources = models.JSONField(
        null=True,
        blank=True,
        help_text='Array of source types: web, academic, discussions.',
    )
    model_used = models.CharField(max_length=100, blank=True, default='')
    agent_session = models.ForeignKey(
        'agent_app.AgentSession',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='triggered_chat_messages',
        help_text='Set for workflow_trigger / workflow_card messages — links to PROJ-18 AgentSession.',
    )
    # PROJ-29 Phase 1I — structured slogan rows emitted by `generate_slogans`
    # tool during a niche-chat turn. Persisted on the assistant message so the
    # GeneratedSloganTable can re-render after page reload (without this the
    # frontend can only show the table during the active stream + the small
    # post-`done` window held by Redux `completedSloganPayload`).
    # Wire shape: `{ slogans: [...], warnings: [...] }`.
    generate_slogans_payload = models.JSONField(
        null=True,
        blank=True,
        help_text='Structured slogan rows from the niche-RAG agent.',
    )
    # PROJ-29 Phase 1I follow-up — retrieved chunks (RAG sources) emitted during
    # the niche-chat turn. Persisted so the ThinkingStrip ExpandedPanel + the
    # NicheCitationLink hover-flash work after page reload. Each chunk:
    # `{ index, content_subtype, text, source_pk?, url?, score? }`.
    chunks_used = models.JSONField(
        null=True,
        blank=True,
        help_text='Retrieved RAG chunks shown in the ThinkingStrip ExpandedPanel.',
    )
    # PROJ-29 Phase 1I follow-up — ordered list of stage rows for the
    # ThinkingStrip collapsed pill (count + duration + status). Each:
    # `{ stage, status, ts, durationMs?, message? }`.
    thinking_stages = models.JSONField(
        null=True,
        blank=True,
        help_text='Ordered ThinkingStrip stage rows (active / done / warning / error).',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(
                fields=['session', 'created_at'],
                name='chatmsg_sess_created_idx',
            ),
        ]

    def __str__(self):
        return f"[{self.role}] {self.content[:50]}"

    def get_embedding_text(self):
        """Return text to embed for vector search."""
        parts = [self.content]
        if self.sources:
            for src in self.sources:
                if isinstance(src, dict):
                    if src.get('title'):
                        parts.append(src['title'])
                    if src.get('snippet'):
                        parts.append(src['snippet'])
        return ' '.join(parts)


class WebSearchResult(models.Model):
    """Stored web search result, optionally deep-crawled via Crawl4ai."""

    class ContentType(models.TextChoices):
        SNIPPET = 'snippet', 'Snippet'
        FULL_CRAWL = 'full_crawl', 'Full Crawl'

    class CrawlStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        RUNNING = 'running', 'Running'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='web_search_results',
        db_index=True,
    )
    chat_message = models.ForeignKey(
        ChatMessage,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='search_results',
    )
    url = models.URLField(max_length=2000)
    title = models.CharField(max_length=500, blank=True, default='')
    content = models.TextField(
        blank=True,
        default='',
        help_text='Full crawled Markdown content or snippet text.',
    )
    content_type = models.CharField(
        max_length=10,
        choices=ContentType.choices,
        default=ContentType.SNIPPET,
    )
    crawl_status = models.CharField(
        max_length=10,
        choices=CrawlStatus.choices,
        default=CrawlStatus.PENDING,
        db_index=True,
    )
    error_message = models.TextField(blank=True, default='')
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text='Page metadata, word count, etc.',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title or self.url} ({self.crawl_status})"

    def get_embedding_text(self):
        """Return text to embed for vector search."""
        parts = []
        if self.title:
            parts.append(self.title)
        if self.content:
            parts.append(self.content)
        return ' '.join(parts) if parts else ''


class SearchUsageLog(models.Model):
    """Tracks every search and crawl action for analytics (PROJ-12)."""

    class Action(models.TextChoices):
        SEARCH = 'search', 'Search'
        DEEP_CRAWL = 'deep_crawl', 'Deep Crawl'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        'workspace_app.Workspace',
        on_delete=models.CASCADE,
        related_name='search_usage_logs',
        db_index=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='search_usage_logs',
    )
    action = models.CharField(max_length=10, choices=Action.choices)
    query = models.TextField(blank=True, default='')
    url = models.URLField(max_length=2000, blank=True, default='')
    model_used = models.CharField(max_length=100, blank=True, default='')
    tokens_used = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['workspace', 'action'],
                name='searchusage_ws_action_idx',
            ),
            models.Index(
                fields=['workspace', '-created_at'],
                name='searchusage_ws_created_idx',
            ),
        ]

    def __str__(self):
        return f"{self.action} by {self.user} at {self.created_at}"
