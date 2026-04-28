from rest_framework import serializers

from chat_attachments_app.models import ChatAttachment


class ChatAttachmentSerializer(serializers.ModelSerializer):
    """Response shape for upload + chat-history rendering. Exposes a
    `thumbnail_url` derived from the FileField storage URL."""

    thumbnail_url = serializers.SerializerMethodField()
    filename = serializers.CharField(source='original_filename', read_only=True)
    size = serializers.IntegerField(source='size_bytes', read_only=True)
    status = serializers.SerializerMethodField()

    class Meta:
        model = ChatAttachment
        fields = (
            'id',
            'filename',
            'mime_type',
            'size',
            'thumbnail_url',
            'attachment_type',
            'status',
            'created_at',
            'purged_at',
        )

    def get_thumbnail_url(self, obj: ChatAttachment) -> str | None:
        if obj.purged_at is not None or not obj.file:
            return None
        try:
            return obj.file.url
        except ValueError:  # pragma: no cover - storage misconfigured
            return None

    def get_status(self, obj: ChatAttachment) -> str:
        return 'purged' if obj.purged_at else 'completed'
