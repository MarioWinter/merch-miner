from django.urls import path
from .views import (
    UserProfileView,
    AvatarUploadView,
    BillingProfileView,
)

urlpatterns = [
    # Profile
    path('users/me/', UserProfileView.as_view(), name='user-profile'),
    path('users/me/avatar/', AvatarUploadView.as_view(), name='user-avatar'),

    # Billing
    path('users/me/billing/', BillingProfileView.as_view(), name='user-billing'),
]
