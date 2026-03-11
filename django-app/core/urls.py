from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from user_auth_app.views import redirect_to_admin
from user_auth_app.api.views import (
    RegisterView, ActivateView, LoginView, LogoutView,
    TokenRefreshView, PasswordResetView, PasswordConfirmView,
    GoogleLoginView, GoogleCallbackView, MeView,
    InlinePasswordChangeView,
)
import user_auth_app.api.urls as api_urls

handler404 = 'core.views.handler404'

urlpatterns = [

    path('', redirect_to_admin, name='root'),
    path('api/', redirect_to_admin, name='root'),
    path('admin/', admin.site.urls),
    path('django-rq/', include('django_rq.urls')),

    # Auth endpoints — /api/auth/
    path('api/auth/register/', RegisterView.as_view(), name='register'),
    path('api/auth/activate/', ActivateView.as_view(), name='activate_post'),
    path('api/auth/activate/<uidb64>/<token>/', ActivateView.as_view(), name='activate'),
    path('api/auth/login/', LoginView.as_view(), name='login'),
    path('api/auth/logout/', LogoutView.as_view(), name='logout'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/password/reset/', PasswordResetView.as_view(), name='password_reset'),
    path('api/auth/password/confirm/', PasswordConfirmView.as_view(), name='password_confirm'),
    path('api/auth/password/confirm/<uidb64>/<token>/', PasswordConfirmView.as_view(), name='password_confirm_legacy'),
    path('api/auth/password/change/', InlinePasswordChangeView.as_view(), name='password_change'),
    path('api/auth/me/', MeView.as_view(), name='auth_me'),

    # Google OAuth2 — /api/auth/google/
    path('api/auth/google/', GoogleLoginView.as_view(), name='google_login'),
    path('api/auth/google/callback/', GoogleCallbackView.as_view(), name='google_callback'),

    # allauth internal URLs (needed for OAuth state/session handling)
    path('accounts/', include('allauth.urls')),

    # Content API
    path('api/', include('content.api.urls')),

    # User profile (api/users/me/)
    path('api/', include(api_urls)),

    # Workspace API
    path('api/', include('workspace_app.api.urls')),
]

if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT
    )
