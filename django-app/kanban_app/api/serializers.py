from rest_framework import serializers
from django.contrib.auth import get_user_model

from kanban_app.models import NicheComment, Notification, DesignTrash
from publish_app.models import DesignAsset

User = get_user_model()


class CommentAuthorSerializer(serializers.ModelSerializer):
    """Minimal author info for comments."""

    class Meta:
        model = User
        fields = ('id', 'email', 'first_name', 'last_name')


class NicheCommentSerializer(serializers.ModelSerializer):
    """Read serializer for NicheComment."""

    author = CommentAuthorSerializer(read_only=True)

    class Meta:
        model = NicheComment
        fields = (
            'id', 'niche', 'design', 'author', 'agent_type',
            'content', 'mentions', 'created_at',
        )
        read_only_fields = (
            'id', 'niche', 'author', 'agent_type', 'created_at',
        )


class NicheCommentCreateSerializer(serializers.Serializer):
    """Write serializer for creating a comment."""

    content = serializers.CharField(max_length=5000)
    design_id = serializers.UUIDField(required=False, allow_null=True)
    mentions = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
    )

    def validate_design_id(self, value):
        if value is None:
            return value
        niche = self.context.get('niche')
        if not niche:
            raise serializers.ValidationError('Niche context required.')
        if not DesignAsset.objects.filter(
            id=value,
            niche=niche,
            workspace=niche.workspace,
        ).exists():
            raise serializers.ValidationError(
                'Design not found or does not belong to this niche.'
            )
        return value

    def validate_mentions(self, value):
        """Validate all mentioned user IDs are workspace members."""
        from workspace_app.models import Membership
        workspace = self.context.get('workspace')
        if not workspace or not value:
            return value
        active_ids = set(
            Membership.objects.filter(
                workspace=workspace,
                status=Membership.Status.ACTIVE,
            ).values_list('user_id', flat=True)
        )
        invalid = [uid for uid in value if uid not in active_ids]
        if invalid:
            raise serializers.ValidationError(
                f'Users {invalid} are not active members of this workspace.'
            )
        return value


class NotificationSerializer(serializers.ModelSerializer):
    """Read serializer for Notification."""

    source_user_email = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            'id', 'type', 'title', 'message', 'link',
            'is_read', 'source_user', 'source_user_email',
            'source_agent_type', 'created_at',
        )
        read_only_fields = (
            'id', 'type', 'title', 'message', 'link',
            'source_user', 'source_agent_type', 'created_at',
        )

    def get_source_user_email(self, obj):
        return obj.source_user.email if obj.source_user else None


class NotificationMarkReadSerializer(serializers.Serializer):
    """Serializer for marking notification as read."""

    is_read = serializers.BooleanField()


class DesignTrashSerializer(serializers.ModelSerializer):
    """Read serializer for trashed designs (AC-28)."""

    file_name = serializers.CharField(source='design.file_name', read_only=True)
    thumbnail_url = serializers.CharField(
        source='design.thumbnail_url', read_only=True,
    )
    deleted_by_email = serializers.SerializerMethodField()

    class Meta:
        model = DesignTrash
        fields = (
            'id', 'design', 'file_name', 'thumbnail_url',
            'deleted_by', 'deleted_by_email',
            'deleted_at', 'expires_at',
        )

    def get_deleted_by_email(self, obj):
        return obj.deleted_by.email if obj.deleted_by else None


class DesignApproveRejectSerializer(serializers.Serializer):
    """Serializer for approve/reject actions on a design."""

    ACTIONS = ('approved', 'rejected')
    status = serializers.ChoiceField(choices=ACTIONS)
    feedback = serializers.CharField(required=False, default='', allow_blank=True)


class DesignUploadSerializer(serializers.Serializer):
    """Serializer for design file upload validation."""

    files = serializers.ListField(
        child=serializers.FileField(),
        min_length=1,
        max_length=20,
    )


class RoundSummarySerializer(serializers.Serializer):
    """Serializer for round summary data (AC-16)."""

    round = serializers.IntegerField()
    idea_count = serializers.IntegerField()
    design_count = serializers.IntegerField()
    approved_design_count = serializers.IntegerField()
    rejected_design_count = serializers.IntegerField()
    listing_count = serializers.IntegerField()
    winner_design_thumbnail = serializers.CharField(allow_null=True)
