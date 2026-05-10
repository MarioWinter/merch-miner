from django.urls import path
from .views import (
    UserProfileView,
    AvatarUploadView,
    BillingProfileView,
    SearchHistoryListCreateView,
    SearchHistoryDeleteView,
    SearchHistoryClearView,
)

urlpatterns = [
    # Profile
    path('users/me/', UserProfileView.as_view(), name='user-profile'),
    path('users/me/avatar/', AvatarUploadView.as_view(), name='user-avatar'),

    # Billing
    path('users/me/billing/', BillingProfileView.as_view(), name='user-billing'),

    # Search History — `/clear/` route MUST come before `/<uuid:entry_id>/`
    # so the literal "clear" segment is not parsed as a UUID.
    path(
        'users/me/search-history/clear/',
        SearchHistoryClearView.as_view(),
        name='user-search-history-clear',
    ),
    path(
        'users/me/search-history/',
        SearchHistoryListCreateView.as_view(),
        name='user-search-history',
    ),
    path(
        'users/me/search-history/<uuid:entry_id>/',
        SearchHistoryDeleteView.as_view(),
        name='user-search-history-detail',
    ),
]
