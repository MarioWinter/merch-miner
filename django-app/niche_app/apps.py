from django.apps import AppConfig


class NicheAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'niche_app'
    verbose_name = 'Niche Management'

    def ready(self):
        # Register PROJ-29 niche signal handlers (legacy-notes sync + reindex debounce).
        from niche_app import signals  # noqa: F401
