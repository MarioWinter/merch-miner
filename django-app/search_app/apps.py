from django.apps import AppConfig


class SearchAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'search_app'
    verbose_name = 'Deep Web Search'

    def ready(self):
        import search_app.signals  # noqa: F401
