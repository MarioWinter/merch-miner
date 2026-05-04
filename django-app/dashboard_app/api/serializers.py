from rest_framework import serializers


class NicheCountsSerializer(serializers.Serializer):
    research = serializers.IntegerField()
    design = serializers.IntegerField()
    publish = serializers.IntegerField()
    live = serializers.IntegerField()
    done = serializers.IntegerField()
    archived = serializers.IntegerField()


class DesignCountsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    approved = serializers.IntegerField()


class ListingCountsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    ready = serializers.IntegerField()


class ActivityEventSerializer(serializers.Serializer):
    event = serializers.CharField()
    niche_name = serializers.CharField()
    target_id = serializers.CharField(allow_null=True)
    user = serializers.CharField(allow_blank=True)
    agent_type = serializers.CharField(allow_null=True)
    timestamp = serializers.CharField()
    metadata = serializers.DictField(required=False)


class StuckNicheSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    status = serializers.CharField()
    days_stuck = serializers.IntegerField()


class DashboardSerializer(serializers.Serializer):
    niche_counts = NicheCountsSerializer()
    design_counts = DesignCountsSerializer()
    listing_counts = ListingCountsSerializer()
    recent_activity = ActivityEventSerializer(many=True)
    stuck_niches = StuckNicheSerializer(many=True)
    agent_activity = serializers.DictField()
    search_activity = serializers.DictField()


class DateRangeSerializer(serializers.Serializer):
    """Validates date_from / date_to query params for analytics endpoints."""
    date_from = serializers.DateField(required=False, default=None)
    date_to = serializers.DateField(required=False, default=None)


class DesignAnalyticsRowSerializer(serializers.Serializer):
    week = serializers.CharField()
    model = serializers.CharField()
    count = serializers.IntegerField()


class ListingAnalyticsRowSerializer(serializers.Serializer):
    week = serializers.CharField()
    listings_ready = serializers.IntegerField()
    listings_published = serializers.IntegerField()
