from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter


class CustomGoogleOAuth2Adapter(GoogleOAuth2Adapter):
    """Force allauth to use our custom callback URL as redirect_uri."""

    def get_callback_url(self, request, app):
        return request.build_absolute_uri('/api/auth/google/callback/')
