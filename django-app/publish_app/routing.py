"""WebSocket URL routing for publish_app."""

from django.urls import re_path

from publish_app.consumers import UploadAppConsumer

websocket_urlpatterns = [
    re_path(
        r'ws/upload-app/(?P<workspace_id>[0-9a-f-]+)/$',
        UploadAppConsumer.as_asgi(),
    ),
    re_path(
        r'ws/upload-app/$',
        UploadAppConsumer.as_asgi(),
    ),
]
