"""Signals for ChatNodeConfig (PROJ-29, AC-20 + AC-21).

post_save:
  (a) invalidate Redis cache key
  (b) snapshot to ChatNodeConfigVersion
  (c) purge versions older than the 10-newest for this node_name
"""

from django.db.models.signals import post_save
from django.dispatch import receiver

from chat_node_config_app.models import ChatNodeConfig, ChatNodeConfigVersion
from chat_node_config_app.services.resolver import invalidate_cache

VERSION_CAP_PER_NODE = 10


@receiver(post_save, sender=ChatNodeConfig)
def on_chat_node_config_save(sender, instance, **kwargs):
    invalidate_cache(instance.node_name)

    ChatNodeConfigVersion.objects.create(
        node_name=instance.node_name,
        model_name=instance.model_name,
        temperature=instance.temperature,
        max_tokens=instance.max_tokens,
        system_prompt=instance.system_prompt,
        snapshot_by=instance.updated_by,
    )

    # 10-cap purge: keep newest VERSION_CAP_PER_NODE, delete older.
    keep_ids = list(
        ChatNodeConfigVersion.objects
        .filter(node_name=instance.node_name)
        .order_by('-snapshot_at')
        .values_list('id', flat=True)[:VERSION_CAP_PER_NODE]
    )
    ChatNodeConfigVersion.objects.filter(
        node_name=instance.node_name,
    ).exclude(id__in=keep_ids).delete()
