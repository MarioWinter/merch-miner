from rest_framework.exceptions import ValidationError
from niche_app.models import Niche


STATUS_GROUP_MAP = {
    'todo': [
        Niche.Status.DATA_ENTRY,
        Niche.Status.DEEP_RESEARCH,
        Niche.Status.NICHE_WITH_POTENTIAL,
    ],
    'in_progress': [
        Niche.Status.TO_DESIGNER,
        Niche.Status.UPLOAD,
        Niche.Status.START_ADS,
    ],
    'complete': [
        Niche.Status.PENDING,
        Niche.Status.WINNER,
        Niche.Status.LOSER,
    ],
}

VALID_STATUS_VALUES = [choice[0] for choice in Niche.Status.choices]
VALID_POTENTIAL_RATING_VALUES = [choice[0] for choice in Niche.PotentialRating.choices]
VALID_STATUS_GROUP_VALUES = list(STATUS_GROUP_MAP.keys())


class NicheFilter:
    """
    Manual filter for Niche queryset.
    Supports: status, status_group, potential_rating, assigned_to, search.
    """

    def __init__(self, params):
        self.params = params

    def apply(self, queryset):
        queryset = self._filter_status(queryset)
        queryset = self._filter_status_group(queryset)
        queryset = self._filter_potential_rating(queryset)
        queryset = self._filter_assigned_to(queryset)
        queryset = self._filter_search(queryset)
        return queryset

    def _filter_status(self, queryset):
        status = self.params.get('status')
        if not status:
            return queryset
        if status not in VALID_STATUS_VALUES:
            raise ValidationError(
                {'status': f'Invalid status. Valid choices: {", ".join(VALID_STATUS_VALUES)}'}
            )
        return queryset.filter(status=status)

    def _filter_status_group(self, queryset):
        group = self.params.get('status_group')
        if not group:
            return queryset
        if group not in STATUS_GROUP_MAP:
            raise ValidationError(
                {'status_group': f'Invalid status_group. Valid choices: {", ".join(VALID_STATUS_GROUP_VALUES)}'}
            )
        return queryset.filter(status__in=STATUS_GROUP_MAP[group])

    def _filter_potential_rating(self, queryset):
        rating = self.params.get('potential_rating')
        if not rating:
            return queryset
        if rating not in VALID_POTENTIAL_RATING_VALUES:
            raise ValidationError(
                {'potential_rating': f'Invalid potential_rating. Valid choices: {", ".join(VALID_POTENTIAL_RATING_VALUES)}'}
            )
        return queryset.filter(potential_rating=rating)

    def _filter_assigned_to(self, queryset):
        assigned_to = self.params.get('assigned_to')
        if not assigned_to:
            return queryset
        try:
            assigned_to_int = int(assigned_to)
        except (ValueError, TypeError):
            raise ValidationError(
                {'assigned_to': 'Must be a valid user ID (integer).'}
            )
        return queryset.filter(assigned_to_id=assigned_to_int)

    def _filter_search(self, queryset):
        search = self.params.get('search', '').strip()
        if not search:
            return queryset
        return queryset.filter(name__icontains=search)
