from django.apps import AppConfig


class PublishAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'publish_app'
    verbose_name = 'Publish (Listing + Upload)'
