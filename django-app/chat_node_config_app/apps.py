from django.apps import AppConfig


class ChatNodeConfigAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'chat_node_config_app'
    verbose_name = 'Chat Node Config (PROJ-29)'

    def ready(self):
        # Wire post_save signal: cache-invalidate + version-snapshot + 10-cap purge.
        from chat_node_config_app import signals  # noqa: F401
