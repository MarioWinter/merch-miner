import logging
from rest_framework import serializers
from ..models import Video, Image

logger = logging.getLogger(__name__)


class VideoUploadSerializer(serializers.ModelSerializer):
    """Serializer for uploading new video entries."""

    owner = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Video
        fields = ['id', 'title', 'description', 'original_file', 'genre', 'owner']


class VideoListSerializer(serializers.ModelSerializer):
    """Serializer for listing videos according to API specification."""
    
    created_at = serializers.DateTimeField(source='upload_date', read_only=True)
    thumbnail_url = serializers.SerializerMethodField()
    category = serializers.CharField(read_only=True)

    class Meta:
        model = Video
        fields = ['id', 'created_at', 'title', 'description', 'thumbnail_url', 'category']

    def get_thumbnail_url(self, obj):
        """Return the absolute URL of the thumbnail image."""
        request = self.context.get('request')

        if obj.thumbnail:
            try:
                if hasattr(obj.thumbnail, 'url'):
                    thumbnail_url = obj.thumbnail.url
                    if request:
                        return request.build_absolute_uri(thumbnail_url)
                    return thumbnail_url
            except (ValueError, OSError, AttributeError):
                logger.debug(f"Thumbnail file missing for video {obj.id}")
                return None

        return None


class ImageUploadSerializer(serializers.ModelSerializer):
    """Serializer for uploading images."""

    owner = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Image
        fields = ['id', 'title', 'description', 'file', 'owner']


class ImageListSerializer(serializers.ModelSerializer):
    """Serializer for listing images."""

    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Image
        fields = ['id', 'title', 'description', 'file_url', 'upload_date']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file:
            try:
                url = obj.file.url
                return request.build_absolute_uri(url) if request else url
            except (ValueError, OSError, AttributeError):
                return None
        return None
