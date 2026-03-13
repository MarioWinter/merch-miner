from rest_framework import serializers
from django.contrib.auth import get_user_model

from niche_app.models import Niche, NicheFilterTemplate
from workspace_app.api.serializers import WorkspaceMemberSerializer
from workspace_app.models import Membership

User = get_user_model()


class NicheSerializer(serializers.ModelSerializer):
    created_by = WorkspaceMemberSerializer(read_only=True)
    assigned_to = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.none(),
        allow_null=True,
        required=False,
    )
    idea_count = serializers.SerializerMethodField()
    approved_idea_count = serializers.SerializerMethodField()

    class Meta:
        model = Niche
        fields = (
            'id', 'workspace', 'name', 'notes', 'status',
            'potential_rating', 'research_status', 'research_run_id',
            'position', 'assigned_to', 'created_by',
            'created_at', 'updated_at',
            'idea_count', 'approved_idea_count',
        )
        read_only_fields = (
            'id', 'workspace', 'created_by', 'created_at', 'updated_at',
            'research_status', 'research_run_id',
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        workspace = self.context.get('workspace')
        if workspace:
            active_user_ids = Membership.objects.filter(
                workspace=workspace,
                status=Membership.Status.ACTIVE,
            ).values_list('user', flat=True)
            self.fields['assigned_to'].queryset = User.objects.filter(
                id__in=active_user_ids,
            )

    def get_idea_count(self, obj):
        return getattr(obj, 'idea_count', 0)

    def get_approved_idea_count(self, obj):
        return getattr(obj, 'approved_idea_count', 0)

    def validate_assigned_to(self, value):
        if value is None:
            return value
        workspace = self.context.get('workspace')
        if not workspace:
            raise serializers.ValidationError('Workspace context required.')
        is_active = Membership.objects.filter(
            workspace=workspace,
            user=value,
            status=Membership.Status.ACTIVE,
        ).exists()
        if not is_active:
            raise serializers.ValidationError(
                'User is not an active member of this workspace.'
            )
        return value

    def validate(self, attrs):
        status = attrs.get('status')
        potential_rating = attrs.get('potential_rating')

        # On PATCH, read current value if not provided
        if self.instance:
            if potential_rating is None and 'potential_rating' not in attrs:
                potential_rating = self.instance.potential_rating
            if status is None and 'status' not in attrs:
                status = self.instance.status

        # When setting status to niche_with_potential without a
        # compatible rating, auto-set rating to 'good'
        if (
            'status' in attrs
            and status == Niche.Status.NICHE_WITH_POTENTIAL
            and potential_rating not in (
                Niche.PotentialRating.GOOD,
                Niche.PotentialRating.VERY_GOOD,
            )
        ):
            attrs['potential_rating'] = Niche.PotentialRating.GOOD

        # When changing rating to incompatible value while status is
        # niche_with_potential, auto-downgrade status to deep_research
        if (
            'potential_rating' in attrs
            and 'status' not in attrs
            and self.instance
            and self.instance.status == Niche.Status.NICHE_WITH_POTENTIAL
            and potential_rating not in (
                Niche.PotentialRating.GOOD,
                Niche.PotentialRating.VERY_GOOD,
            )
        ):
            attrs['status'] = Niche.Status.DEEP_RESEARCH

        return attrs


class NicheBulkSerializer(serializers.Serializer):
    BULK_ACTIONS = ('archive', 'assign')

    ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        allow_empty=False,
    )
    action = serializers.ChoiceField(choices=BULK_ACTIONS)
    assigned_to = serializers.UUIDField(required=False, allow_null=True)

    def validate(self, attrs):
        if attrs['action'] == 'assign' and not attrs.get('assigned_to'):
            raise serializers.ValidationError(
                {'assigned_to': 'This field is required when action is assign.'}
            )
        return attrs


class NicheFilterTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = NicheFilterTemplate
        fields = ('id', 'user', 'name', 'filters', 'created_at', 'updated_at')
        read_only_fields = ('id', 'user', 'created_at', 'updated_at')

    def validate_filters(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('Filters must be a JSON object.')
        return value


class NicheCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Niche
        fields = ('name', 'notes')

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        validated_data['workspace'] = self.context['workspace']
        return super().create(validated_data)
