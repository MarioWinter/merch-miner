from django.apps import AppConfig


class AgentAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'agent_app'
    verbose_name = 'OpenClaw Agent'

    def ready(self):
        import agent_app.signals  # noqa: F401
