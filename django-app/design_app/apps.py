from django.apps import AppConfig


class DesignAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'design_app'
    verbose_name = 'Design Generation'

    def ready(self):
        import design_app.signals  # noqa: F401
