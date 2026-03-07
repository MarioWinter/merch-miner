from django.apps import AppConfig


class WorkspaceAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'workspace_app'

    def ready(self):
        import workspace_app.signals  # noqa: F401
