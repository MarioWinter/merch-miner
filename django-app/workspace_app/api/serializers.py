from rest_framework import serializers
from django.contrib.auth import get_user_model
from workspace_app.models import Workspace, Membership

User = get_user_model()


class WorkspaceMemberSerializer(serializers.ModelSerializer):
    """Minimal user representation used inside MembershipSerializer."""

    avatar_url = serializers.SerializerMethodField()

    def get_avatar_url(self, obj):
        request = self.context.get('request')
        if obj.avatar and request:
            return request.build_absolute_uri(obj.avatar)
        return None

    class Meta:
        model = User
        fields = ('id', 'email', 'first_name', 'last_name', 'avatar_url')


class WorkspaceSerializer(serializers.ModelSerializer):
    owner = WorkspaceMemberSerializer(read_only=True)

    class Meta:
        model = Workspace
        fields = ('id', 'name', 'slug', 'owner', 'created_at')
        read_only_fields = ('id', 'slug', 'owner', 'created_at')


class WorkspaceRenameSerializer(serializers.ModelSerializer):
    """Only allow renaming the workspace (name field)."""

    class Meta:
        model = Workspace
        fields = ('id', 'name')
        read_only_fields = ('id',)


class MembershipSerializer(serializers.ModelSerializer):
    user = WorkspaceMemberSerializer(read_only=True)
    invited_by = WorkspaceMemberSerializer(read_only=True)

    class Meta:
        model = Membership
        fields = (
            'id', 'workspace', 'user', 'role', 'status',
            'invited_by', 'invited_at', 'accepted_at',
        )
        read_only_fields = (
            'id', 'workspace', 'user', 'status',
            'invited_by', 'invited_at', 'accepted_at',
        )


class WorkspaceMeSerializer(serializers.ModelSerializer):
    """Workspace + caller's role in that workspace."""

    role = serializers.SerializerMethodField()
    owner = WorkspaceMemberSerializer(read_only=True)
    members = serializers.SerializerMethodField()

    class Meta:
        model = Workspace
        fields = ('id', 'name', 'slug', 'owner', 'created_at', 'role', 'members')

    def get_role(self, obj):
        request = self.context.get('request')
        if not request:
            return None
        try:
            membership = obj.memberships.get(user=request.user, status=Membership.Status.ACTIVE)
            return membership.role
        except Membership.DoesNotExist:
            return None

    def get_members(self, obj):
        memberships = obj.memberships.select_related('user', 'invited_by').all()
        return MembershipSerializer(memberships, many=True, context=self.context).data


class InviteSerializer(serializers.Serializer):
    email = serializers.EmailField()


class MemberRoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=Membership.Role.choices)
