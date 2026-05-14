from django.conf import settings
from django.db import models


class ChatNodeConfig(models.Model):
    """LLM config + system prompt per chat-agent node (PROJ-29, AC-17).

    Mirrors `niche_research_app.ResearchNodeConfig` shape, plus `is_active` and
    `updated_by` (PROJ-29 additions). One row per node_name (unique).
    """

    class NodeName(models.TextChoices):
        AGENT_REACT = 'agent_react', 'Agent ReAct'
        CREATIVE_TECHNIQUES = 'creative_techniques', 'Creative Techniques'
        CHAT_WITH_NICHE = 'chat_with_niche', 'Chat With Niche'
        CHAT_NO_NICHE = 'chat_no_niche', 'Chat No Niche'
        QUERY_REWRITE = 'query_rewrite', 'Query Rewrite'
        CONTEXTUAL_HEADER = 'contextual_header', 'Contextual Header'
        FOLLOW_UP_SUGGESTER = 'follow_up_suggester', 'Follow-Up Suggester'
        CONVERSATION_SUMMARIZER = 'conversation_summarizer', 'Conversation Summarizer'

    node_name = models.CharField(
        max_length=50,
        choices=NodeName.choices,
        unique=True,
    )
    model_name = models.CharField(max_length=100, default='openai/gpt-4.1-mini')
    temperature = models.FloatField(default=0.3)
    max_tokens = models.IntegerField(null=True, blank=True)
    system_prompt = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )

    class Meta:
        verbose_name = 'Chat Node Config'
        verbose_name_plural = 'Chat Node Configs'

    def __str__(self):
        return f"{self.get_node_name_display()} ({self.model_name})"


class ChatNodeConfigVersion(models.Model):
    """Immutable snapshot per save of `ChatNodeConfig` (PROJ-29, AC-20).

    Capped at 10 newest per node_name (older versions purged in post_save).
    """

    node_name = models.CharField(max_length=50, db_index=True)
    model_name = models.CharField(max_length=100)
    temperature = models.FloatField()
    max_tokens = models.IntegerField(null=True, blank=True)
    system_prompt = models.TextField(blank=True, default='')
    snapshot_at = models.DateTimeField(auto_now_add=True, db_index=True)
    snapshot_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )

    class Meta:
        verbose_name = 'Chat Node Config Version'
        verbose_name_plural = 'Chat Node Config Versions'
        ordering = ['-snapshot_at']
        indexes = [
            models.Index(
                fields=['node_name', '-snapshot_at'],
                name='chatcfg_version_node_time_idx',
            ),
        ]

    def __str__(self):
        return f"{self.node_name} @ {self.snapshot_at:%Y-%m-%d %H:%M:%S}"
