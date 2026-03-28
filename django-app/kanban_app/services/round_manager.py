"""Round management for niches (AC-1, AC-9)."""

from rest_framework.exceptions import ValidationError

from niche_app.models import Niche

DONE_STATUSES = {Niche.Status.WINNER, Niche.Status.LOSER}


def start_new_round(niche):
    """
    Increment current_round and reset status to to_designer.
    Validates niche must be in Done column (winner/loser).
    Returns the updated niche.
    """
    if niche.status not in DONE_STATUSES:
        raise ValidationError({
            'status': 'New round can only be started on niches with status winner or loser.'
        })

    niche.current_round += 1
    niche.status = Niche.Status.TO_DESIGNER
    niche.save(update_fields=['current_round', 'status', 'updated_at'])
    return niche
