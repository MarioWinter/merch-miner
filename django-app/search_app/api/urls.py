from django.urls import path

from search_app.api.views import (
    ChatSessionDetailView,
    ChatSessionListCreateView,
    ChatSessionMessagesView,
    ChatSessionMessageStreamView,
    ChatSessionShareView,
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
        ChatSessionShareView.as_view(),
        name='chat-session-share',
    ),
    path(
        'chat/sessions/<uuid:session_id>/unshare/',
        ChatSessionUnshareView.as_view(),
        name='chat-session-unshare',
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
]
