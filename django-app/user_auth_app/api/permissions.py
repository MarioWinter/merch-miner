"""
PROJ-31 — DRF permission classes for entitlement gating.

Usage:
    from user_auth_app.api.permissions import HasFeature

    class DesignUpscaleView(APIView):
        permission_classes = [IsAuthenticated, HasFeature('design.upscaler')]

Composes with existing `IsAuthenticated` and `IsWorkspaceMember`. Logs denials
to the `entitlement` channel for audit/observability.
"""
import logging

from rest_framework.permissions import BasePermission

from core.entitlements import resolve_features

logger = logging.getLogger('entitlement')


def HasFeature(feature: str):
    """Factory returning a DRF permission class bound to `feature`.

    DRF instantiates each entry in `permission_classes` with `cls()`, so we
    return a class (not an instance). Factory-with-closure is the idiomatic
    way to parameterize DRF permissions without subclass-per-feature boilerplate.
    """

    class _HasFeature(BasePermission):
        def has_permission(self, request, view):
            user = request.user
            if not user or not user.is_authenticated:
                return False
            features = resolve_features(user)
            granted = '*' in features or feature in features
            if not granted:
                logger.warning(
                    'entitlement.denied user_id=%s feature=%s path=%s',
                    user.id,
                    feature,
                    request.path,
                )
            return granted

    _HasFeature.__name__ = f'HasFeature_{feature}'
    _HasFeature.__qualname__ = _HasFeature.__name__
    return _HasFeature
