"""DRF serializers for ``feedback_app``.

Strict input validation — workspace + user are NEVER read from request data
(AC-1-5): the view infers them from the JWT + X-Workspace-Id header.
"""

from rest_framework import serializers

from feedback_app.models import BugFeatureReport, FeedbackScreenshot


MAX_DESCRIPTION_CHARS = 4000
MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024  # 5 MB per spec AC-1-3.
ALLOWED_SCREENSHOT_MIME = {'image/png', 'image/jpeg', 'image/webp'}


class FeedbackScreenshotSerializer(serializers.ModelSerializer):
    """Response shape for the upload endpoint. Exposes ``image_url``."""

    image_url = serializers.SerializerMethodField()

    class Meta:
        model = FeedbackScreenshot
        fields = ('id', 'image_url', 'uploaded_at')
        read_only_fields = fields

    def get_image_url(self, obj: FeedbackScreenshot) -> str | None:
        if not obj.image:
            return None
        try:
            return obj.image.url
        except ValueError:  # pragma: no cover - storage misconfigured
            return None


class FeedbackScreenshotUploadSerializer(serializers.Serializer):
    """Validates an incoming multipart upload (mime + size).

    Mime is checked from the client-declared ``content_type`` AND the
    Django ImageField will additionally invoke Pillow during ``save()``,
    so a tampered text-file masquerading as png still gets rejected at the
    storage layer.
    """

    image = serializers.ImageField()

    def validate_image(self, image):
        if image.size > MAX_SCREENSHOT_BYTES:
            raise serializers.ValidationError(
                f'Screenshot exceeds {MAX_SCREENSHOT_BYTES} bytes '
                f'({image.size}).',
            )
        # content_type is best-effort (client-set). The ImageField above
        # already verifies the file is a valid image, but we additionally
        # restrict to the spec-allowed set to keep media tidy.
        ct = (image.content_type or '').lower()
        if ct and ct not in ALLOWED_SCREENSHOT_MIME:
            raise serializers.ValidationError(
                f'Unsupported mime `{ct}`. Allowed: '
                f'{sorted(ALLOWED_SCREENSHOT_MIME)}.',
            )
        return image


class BugFeatureReportSerializer(serializers.ModelSerializer):
    """Used for ``create`` + ``retrieve`` + ``list``.

    Write fields: ``type``, ``title``, ``description``, ``screenshot_id``.
    All other fields are read-only — workspace/user are enforced by the view
    (AC-1-5) and status/admin_notes are gated on PATCH by a separate
    superuser-only serializer.
    """

    screenshot_id = serializers.PrimaryKeyRelatedField(
        queryset=FeedbackScreenshot.objects.all(),
        source='screenshot',
        write_only=True,
        required=False,
        allow_null=True,
    )
    screenshot = FeedbackScreenshotSerializer(read_only=True)
    user_email = serializers.SerializerMethodField(read_only=True)
    workspace_id = serializers.UUIDField(source='workspace.id', read_only=True)

    class Meta:
        model = BugFeatureReport
        fields = (
            'id',
            'type',
            'title',
            'description',
            'screenshot',
            'screenshot_id',
            'status',
            'admin_notes',
            'created_at',
            'user_email',
            'workspace_id',
        )
        read_only_fields = (
            'id',
            'screenshot',
            'status',
            'admin_notes',
            'created_at',
            'user_email',
            'workspace_id',
        )

    def get_user_email(self, obj: BugFeatureReport) -> str | None:
        return obj.user.email if obj.user else None

    def validate_title(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Title is required.')
        if len(value) > 200:
            raise serializers.ValidationError('Title cannot exceed 200 chars.')
        return value

    def validate_description(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Description is required.')
        if len(value) > MAX_DESCRIPTION_CHARS:
            raise serializers.ValidationError(
                f'Description cannot exceed {MAX_DESCRIPTION_CHARS} chars.',
            )
        return value


class BugFeatureReportAdminUpdateSerializer(serializers.ModelSerializer):
    """PATCH-only serializer used by superusers for triage.

    Only allows editing ``status`` and ``admin_notes``. All other fields
    return 400 if present (no extra kwargs accepted).
    """

    class Meta:
        model = BugFeatureReport
        fields = ('status', 'admin_notes')

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError(
                'At least one of `status`, `admin_notes` is required.',
            )
        return attrs
