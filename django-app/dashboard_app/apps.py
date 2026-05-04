from django.apps import AppConfig


class DashboardAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'dashboard_app'
    verbose_name = 'Dashboard & Analytics'

    def ready(self):
        import dashboard_app.signals  # noqa: F401
