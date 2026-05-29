from django.urls import path

from search_app.api.views import (
    ChatGroupDetailView,
    ChatGroupListCreateView,
    ChatGroupReorderView,
    ChatHealthView,
    ChatMessageDestroyView,
    ChatSessionDetailView,
    ChatSessionListCreateView,
    ChatSessionMessagesView,
    ChatSessionMessageStreamView,
    ChatSessionPublicFetchView,
    ChatSessionReorderInGroupView,
    ChatSessionShareCreateView,
    ChatSessionUnshareView,
    CrawlStatusView,
    SaveToNicheView,
    SearchHealthView,
    TriggerCrawlView,
)

urlpatterns = [
    # Chat sessions
    path(
        'chat/sessions/',
        ChatSessionListCreateView.as_view(),
        name='chat-session-list-create',
    ),
    path(
        'chat/sessions/<uuid:session_id>/',
        ChatSessionDetailView.as_view(),
        name='chat-session-detail',
    ),
    path(
        'chat/sessions/<uuid:session_id>/messages/',
        ChatSessionMessagesView.as_view(),
        name='chat-session-messages',
    ),
    path(
        'chat/sessions/<uuid:session_id>/messages/stream/',
        ChatSessionMessageStreamView.as_view(),
        name='chat-session-message-stream',
    ),
    path(
        'chat/sessions/<uuid:session_id>/share/',
        ChatSessionShareCreateView.as_view(),
        name='chat-session-share',
    ),
    path(
        'chat/sessions/<uuid:session_id>/unshare/',
        ChatSessionUnshareView.as_view(),
        name='chat-session-unshare',
    ),
    path(
        'chat/sessions/shared/<str:token>/',
        ChatSessionPublicFetchView.as_view(),
        name='chat-session-public-fetch',
    ),
    path(
        'chat/messages/<uuid:message_id>/',
        ChatMessageDestroyView.as_view(),
        name='chat-message-destroy',
    ),

    # FIX 2026-05-28 Item 7 — Chat Groups (sidebar folders).
    # Reorder endpoints come BEFORE the detail route so
    # ``chat/groups/reorder/`` is not absorbed by ``<uuid:group_id>``.
    path(
        'chat/groups/reorder/',
        ChatGroupReorderView.as_view(),
        name='chat-group-reorder',
    ),
    path(
        'chat/sessions/reorder-in-group/',
        ChatSessionReorderInGroupView.as_view(),
        name='chat-session-reorder-in-group',
    ),
    path(
        'chat/groups/',
        ChatGroupListCreateView.as_view(),
        name='chat-group-list-create',
    ),
    path(
        'chat/groups/<uuid:group_id>/',
        ChatGroupDetailView.as_view(),
        name='chat-group-detail',
    ),

    # Search / Crawl
    path(
        'search/crawl/',
        TriggerCrawlView.as_view(),
        name='trigger-crawl',
    ),
    path(
        'search/crawl/<uuid:result_id>/status/',
        CrawlStatusView.as_view(),
        name='crawl-status',
    ),
    path(
        'search/results/<uuid:result_id>/save-to-niche/',
        SaveToNicheView.as_view(),
        name='save-to-niche',
    ),

    # Health
    path(
        'search/health/',
        SearchHealthView.as_view(),
        name='search-health',
    ),
    path(
        'chat/health/',
        ChatHealthView.as_view(),
        name='chat-health',
    ),
]
