from django.urls import path
from rest_framework.routers import DefaultRouter

from feedback_app.api.views import (
    BugFeatureReportViewSet,
    FeedbackScreenshotUploadView,
)

router = DefaultRouter()
router.register(
    r'feedback/reports', BugFeatureReportViewSet, basename='feedback-reports',
)

urlpatterns = [
    path(
        'feedback/screenshots/',
        FeedbackScreenshotUploadView.as_view(),
        name='feedback-screenshot-upload',
    ),
    *router.urls,
]
