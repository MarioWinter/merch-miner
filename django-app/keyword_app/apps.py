from django.apps import AppConfig


class KeywordAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'keyword_app'
    verbose_name = 'Keyword Research & Bank'

    def ready(self):
        import keyword_app.signals  # noqa: F401
