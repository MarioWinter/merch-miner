from django.apps import AppConfig


class ResearchAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'research_app'
    verbose_name = 'Amazon Product Research'

    def ready(self):
        # Wire BrandBlacklist save/delete -> Redis cache invalidation.
        from research_app import signals  # noqa: F401
