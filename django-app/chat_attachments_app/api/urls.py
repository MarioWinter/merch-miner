from django.urls import path

from chat_attachments_app.api.views import (
    ChatAttachmentDestroyView,
    ChatAttachmentListCreateView,
)

urlpatterns = [
    path(
        'chat/attachments/',
        ChatAttachmentListCreateView.as_view(),
        name='chat-attachments-list-create',
    ),
    path(
        'chat/attachments/<uuid:attachment_id>/',
        ChatAttachmentDestroyView.as_view(),
        name='chat-attachment-destroy',
    ),
]
