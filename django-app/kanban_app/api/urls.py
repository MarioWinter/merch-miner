from django.urls import path

from kanban_app.api.views import (
    NewRoundView,
    RoundSummaryView,
    NicheDesignListView,
    NicheDesignUploadView,
    DesignActionView,
    DesignRestoreView,
    DesignTrashListView,
    NicheCommentListCreateView,
    NicheCommentDeleteView,
    NotificationListView,
    NotificationMarkReadView,
    NotificationMarkAllReadView,
    NotificationUnreadCountView,
)

urlpatterns = [
    # Round
    path(
        'niches/<uuid:niche_id>/new-round/',
        NewRoundView.as_view(),
        name='niche-new-round',
    ),
    path(
        'niches/<uuid:niche_id>/rounds/',
        RoundSummaryView.as_view(),
        name='niche-rounds',
    ),

    # Designs per niche
    path(
        'niches/<uuid:niche_id>/designs/',
        NicheDesignListView.as_view(),
        name='niche-designs',
    ),
    path(
        'niches/<uuid:niche_id>/designs/upload/',
        NicheDesignUploadView.as_view(),
        name='niche-designs-upload',
    ),

    # Design actions — prefixed with kanban/ to avoid conflict with design_app
    path(
        'kanban/designs/trash/',
        DesignTrashListView.as_view(),
        name='design-trash-list',
    ),
    path(
        'kanban/designs/<uuid:design_id>/',
        DesignActionView.as_view(),
        name='design-action',
    ),
    path(
        'kanban/designs/<uuid:design_id>/restore/',
        DesignRestoreView.as_view(),
        name='design-restore',
    ),

    # Comments
    path(
        'niches/<uuid:niche_id>/comments/',
        NicheCommentListCreateView.as_view(),
        name='niche-comments',
    ),
    path(
        'niches/<uuid:niche_id>/comments/<uuid:comment_id>/',
        NicheCommentDeleteView.as_view(),
        name='niche-comment-delete',
    ),

    # Notifications
    path(
        'notifications/',
        NotificationListView.as_view(),
        name='notification-list',
    ),
    path(
        'notifications/mark-all-read/',
        NotificationMarkAllReadView.as_view(),
        name='notification-mark-all-read',
    ),
    path(
        'notifications/unread-count/',
        NotificationUnreadCountView.as_view(),
        name='notification-unread-count',
    ),
    path(
        'notifications/<uuid:notification_id>/',
        NotificationMarkReadView.as_view(),
        name='notification-mark-read',
    ),
]
