from django.apps import AppConfig


class VectorAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'vector_app'
    verbose_name = 'Vector Database (AI Memory)'

    def ready(self):
        from vector_app.signals import connect_signals

        connect_signals()
