from core import settings
from django.contrib.auth import get_user_model
from django.core.files.storage import FileSystemStorage
from django.shortcuts import redirect
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken, TokenError

from user_auth_app.models import BillingProfile

from .authentication import CookieJWTAuthentication
from .emails import send_password_reset_email, send_verification_email
from .serializers import (
    BillingProfileSerializer,
    InlinePasswordChangeSerializer,
    LoginSerializer,
    PasswordChangeSerializer,
    PasswordResetSerializer,
    UserCreateSerializer,
    UserProfileSerializer,
    UserSerializer,
    UserUpdateSerializer,
)
from .utils import clear_jwt_cookies, get_refresh_token_from_request, set_jwt_cookies

User = get_user_model()


class UserProfileViewSet(viewsets.ModelViewSet):
    """Retrieve and update the authenticated user's profile."""

    queryset = User.objects.all()
    serializer_class = UserSerializer

    def get_queryset(self):
        return User.objects.filter(id=self.request.user.id)


class RegisterView(APIView):
    """Handle user registration and send activation email."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserCreateSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()

            refresh = RefreshToken.for_user(user)
            activation_token = str(refresh.access_token)
            uidb64 = urlsafe_base64_encode(force_bytes(user.pk))

            send_verification_email(user.email, uidb64, activation_token)

            return Response(
                {"user": {"id": user.id, "email": user.email}},
                status=status.HTTP_201_CREATED,
            )

        return Response(
            {"detail": "Please check your entries and try again."},
            status=status.HTTP_400_BAD_REQUEST,
        )


class ActivateView(APIView):
    """Activate user account using token from email.

    Accepts two calling conventions:
    1. POST /api/auth/activate/           body: { uid, token }  (used by frontend SPA)
    2. GET  /api/auth/activate/<uidb64>/<token>/               (direct link fallback)
    """

    permission_classes = [AllowAny]

    def _activate(self, uidb64, token):
        """Shared activation logic. Returns (success: bool, already_active: bool)."""
        uid = urlsafe_base64_decode(uidb64).decode()
        user = User.objects.get(pk=uid)
        access_token = AccessToken(token)

        if str(user.pk) != str(access_token["user_id"]):
            raise Exception("Token user_id mismatch")

        if not user.is_active:
            user.is_active = True
            user.save()

    def post(self, request):
        """Activate via POST body — used by the React SPA."""
        uidb64 = request.data.get("uid")
        token = request.data.get("token")

        if not uidb64 or not token:
            return Response(
                {"message": "Account activation failed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            self._activate(uidb64, token)
            return Response(
                {"message": "Account successfully activated."},
                status=status.HTTP_200_OK,
            )
        except Exception:
            return Response(
                {"message": "Account activation failed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    def get(self, request, uidb64, token):
        """Activate via GET path params — direct email link fallback."""
        try:
            self._activate(uidb64, token)
            return Response(
                {"message": "Account successfully activated."},
                status=status.HTTP_200_OK,
            )
        except Exception:
            return Response(
                {"message": "Account activation failed."},
                status=status.HTTP_400_BAD_REQUEST,
            )


class LoginView(APIView):
    """Handle user login and set JWT tokens in cookies."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"detail": "Please check your entries and try again."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = serializer.validated_data["user"]
        refresh = RefreshToken.for_user(user)
        access_token = refresh.access_token

        response = Response(
            {
                "detail": "Login successful",
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "first_name": user.first_name,
                    "avatar_url": request.build_absolute_uri(user.avatar)
                    if user.avatar
                    else None,
                },
            },
            status=status.HTTP_200_OK,
        )

        set_jwt_cookies(response, access_token, refresh)

        return response


class TokenRefreshView(APIView):
    """Refresh JWT access token using refresh token from cookies."""

    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = get_refresh_token_from_request(request)

        if not refresh_token:
            return Response(
                {"detail": "Refresh token not found"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            old_refresh = RefreshToken(refresh_token)
            user_id = old_refresh["user_id"]
            user = User.objects.get(id=user_id)
            old_refresh.blacklist()
            new_refresh = RefreshToken.for_user(user)
            new_access_token = new_refresh.access_token
        except TokenError:
            return Response(
                {"detail": "Invalid refresh token"}, status=status.HTTP_401_UNAUTHORIZED
            )

        response = Response(
            {"detail": "Token refreshed", "access": str(new_access_token)},
            status=status.HTTP_200_OK,
        )

        set_jwt_cookies(response, new_access_token, new_refresh)

        return response


class LogoutView(APIView):
    """Log out user by clearing JWT cookies and blacklisting refresh token."""

    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = get_refresh_token_from_request(request)

        if not refresh_token:
            return Response(
                {"detail": "Refresh token not found"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            RefreshToken(refresh_token).blacklist()
        except Exception:
            pass

        response = Response(
            {"detail": "Log-Out successfully!"}, status=status.HTTP_200_OK
        )

        clear_jwt_cookies(response)

        return response


class PasswordResetView(APIView):
    """Handle password reset requests by sending email with reset link."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data["email"]
            try:
                user = User.objects.get(email=email)

                refresh = RefreshToken.for_user(user)
                token = str(refresh.access_token)
                uidb64 = urlsafe_base64_encode(force_bytes(user.pk))

                send_password_reset_email(user.email, uidb64, token)

            except User.DoesNotExist:
                pass

            return Response(
                {"detail": "An email has been sent to reset your password."},
                status=status.HTTP_200_OK,
            )

        return Response(
            {"detail": "Invalid email address"}, status=status.HTTP_400_BAD_REQUEST
        )


class PasswordConfirmView(APIView):
    """Handle password reset confirmation and update user password."""

    permission_classes = [AllowAny]

    def post(self, request, uidb64=None, token=None):
        # Accept uid/token from POST body (preferred) or URL path (legacy email links)
        uidb64 = uidb64 or request.data.get("uid", "")
        token = token or request.data.get("token", "")

        serializer = PasswordChangeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"detail": "Passwords do not match"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            uid = urlsafe_base64_decode(uidb64).decode()
            user = User.objects.get(pk=uid)
            access_token = AccessToken(token)

            if str(user.pk) != str(access_token["user_id"]):
                raise Exception

        except Exception:
            return Response(
                {"detail": "Invalid token or user"}, status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(serializer.validated_data["new_password"])
        user.save()

        return Response(
            {"detail": "Your password has been successfully reset."},
            status=status.HTTP_200_OK,
        )


class MeView(APIView):
    """Return authenticated user's id and email for Redux session hydration."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response(
            {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "avatar_url": request.build_absolute_uri(user.avatar)
                if user.avatar
                else None,
            },
            status=status.HTTP_200_OK,
        )


class GoogleLoginView(APIView):
    """Redirect the browser to Google's OAuth2 consent screen via allauth."""

    permission_classes = [AllowAny]

    def get(self, request):
        from allauth.socialaccount.providers.oauth2.views import OAuth2LoginView

        from user_auth_app.api.adapters import CustomGoogleOAuth2Adapter

        view = OAuth2LoginView.adapter_view(CustomGoogleOAuth2Adapter)
        return view(request)


class GoogleCallbackView(APIView):
    """
    Handle the Google OAuth2 callback.

    allauth completes the OAuth flow and creates/links the User.
    We then issue CookieJWT tokens and redirect to the frontend.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        from allauth.core.exceptions import ImmediateHttpResponse
        from allauth.socialaccount.providers.oauth2.views import OAuth2CallbackView

        from user_auth_app.api.adapters import CustomGoogleOAuth2Adapter

        try:
            view = OAuth2CallbackView.adapter_view(CustomGoogleOAuth2Adapter)
            view(request)
        except ImmediateHttpResponse:
            frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
            return redirect(f"{frontend_url}/login?error=oauth_failed")
        except Exception:
            frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
            return redirect(f"{frontend_url}/login?error=oauth_failed")

        user = request.user
        if not user or not user.is_authenticated:
            frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
            return redirect(f"{frontend_url}/login?error=oauth_failed")

        refresh = RefreshToken.for_user(user)
        access_token = refresh.access_token

        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
        redirect_response = redirect(frontend_url)
        set_jwt_cookies(redirect_response, access_token, refresh)
        return redirect_response


# ---------------------------------------------------------------------------
# Task 7 — User Profile API
# ---------------------------------------------------------------------------


class UserProfileView(APIView):
    """GET + PATCH /api/users/me/ — full profile read/update."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        serializer = UserUpdateSerializer(
            request.user,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            UserProfileSerializer(request.user, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class AvatarRateThrottle(UserRateThrottle):
    scope = "avatar"


class AvatarUploadView(APIView):
    """POST /api/users/me/avatar/ — multipart upload to Django FileSystemStorage."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]
    throttle_classes = [AvatarRateThrottle]

    ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
    MAX_SIZE_BYTES = 2 * 1024 * 1024  # 2 MB
    EXT_MAP = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}

    def post(self, request):
        from PIL import Image

        file = request.FILES.get("avatar")
        if not file:
            return Response(
                {"detail": 'No file provided. Use field name "avatar".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if file.content_type not in self.ALLOWED_MIME_TYPES:
            return Response(
                {"detail": "Unsupported file type. Allowed: JPEG, PNG, WEBP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if file.size > self.MAX_SIZE_BYTES:
            return Response(
                {"detail": "File too large. Maximum size is 2 MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Magic-byte validation via Pillow
        file.seek(0)
        try:
            img = Image.open(file)
            img.verify()
        except Exception:
            return Response(
                {"detail": "Invalid image file."}, status=status.HTTP_400_BAD_REQUEST
            )
        FORMAT_TO_MIME = {
            "JPEG": "image/jpeg",
            "PNG": "image/png",
            "WEBP": "image/webp",
        }
        if FORMAT_TO_MIME.get(img.format, "") != file.content_type:
            return Response(
                {"detail": "File content does not match declared type."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        file.seek(0)  # reset for fs.save()

        ext = self.EXT_MAP[file.content_type]
        relative_path = f"avatars/user_{request.user.pk}/avatar.{ext}"

        fs = FileSystemStorage()
        # Delete old avatar file(s) before saving new one
        for old_ext in self.EXT_MAP.values():
            old_path = f"avatars/user_{request.user.pk}/avatar.{old_ext}"
            if fs.exists(old_path):
                fs.delete(old_path)

        saved_path = fs.save(relative_path, file)
        relative = settings.MEDIA_URL + saved_path  # /media/avatars/...
        request.user.avatar = relative
        request.user.save(update_fields=["avatar"])
        return Response(
            {"avatar_url": request.build_absolute_uri(relative)},
            status=status.HTTP_200_OK,
        )


class InlinePasswordChangeView(APIView):
    """POST /api/auth/password/change/ — change password while logged in."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = InlinePasswordChangeSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.save()

        # Blacklist current refresh token so the user must re-login
        refresh_token = get_refresh_token_from_request(request)
        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                pass

        response = Response(
            {"detail": "Password changed successfully. Please log in again."},
            status=status.HTTP_200_OK,
        )
        clear_jwt_cookies(response)
        return response


# ---------------------------------------------------------------------------
# Task 8 — Billing API
# ---------------------------------------------------------------------------


class BillingProfileView(APIView):
    """GET + PUT /api/users/me/billing/ — upsert billing profile."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _get_or_create_billing(self, user):
        profile, _ = BillingProfile.objects.get_or_create(user=user)
        return profile

    def get(self, request):
        profile = self._get_or_create_billing(request.user)
        serializer = BillingProfileSerializer(profile)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        profile = self._get_or_create_billing(request.user)
        serializer = BillingProfileSerializer(
            profile,
            data=request.data,
            partial=False,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
