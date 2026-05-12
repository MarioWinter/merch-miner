"""PROJ-29 Phase 1B — Idea enum hardening.

Converts `Idea.pattern_used` + `Idea.stylistic_device` from free-form CharField
to constrained `TextChoices`. Includes a data-migration step that normalises
legacy slash/space pattern_used values (e.g. ``"IDENTITY DECLARATION"``,
``"TRIBE/COMMUNITY"``) to the new SCREAMING_SNAKE enum keys. Unknown legacy
values are cleared to ``""`` rather than re-mapped — manual cleanup is safer
than silent loss of meaning.

Choices are enforced at serializer level (no DB CHECK constraint) so old rows
with blank values keep working.
"""

from django.db import migrations, models


PATTERN_CHOICES = [
    ('IDENTITY_DECLARATION', 'IDENTITY DECLARATION'),
    ('GROUP_LEADER', 'GROUP LEADER'),
    ('TRIBE_COMMUNITY', 'TRIBE/COMMUNITY'),
    ('FUNNY_ACTIVITY', 'FUNNY ACTIVITY'),
    ('CROSS_NICHE_EVENTS', 'CROSS-NICHE EVENTS'),
    ('CROSS_NICHE_MASHUP', 'CROSS-NICHE MASHUP'),
    ('ADDICTION_OBSESSION', 'ADDICTION/OBSESSION'),
    ('VINTAGE_LEGACY', 'VINTAGE/LEGACY'),
    ('ACHIEVEMENT_GAMIFIED', 'ACHIEVEMENT/GAMIFIED'),
    ('JOB_PROFESSION_PARODY', 'JOB/PROFESSION PARODY'),
    ('RELATIONSHIP_HUMOR', 'RELATIONSHIP HUMOR'),
    ('BOUNDARY_GATEKEEPING', 'BOUNDARY/GATEKEEPING'),
    ('ENDURANCE_SURVIVAL', 'ENDURANCE/SURVIVAL'),
    ('COMPETENCE_EXPERTISE', 'COMPETENCE/EXPERTISE'),
    ('CHAOS_CONTROL', 'CHAOS/CONTROL'),
    ('SELF_CARE_PRIORITIES', 'SELF-CARE/PRIORITIES'),
]

STYLISTIC_CHOICES = [
    ('RHYME', 'Rhyme'),
    ('SONGTEXT_ADAPTION', 'Songtext Adaption'),
    ('LIST', 'List'),
    ('COMMAND', 'Command'),
    ('QUESTION_ANSWER', 'Question + Answer'),
    ('IF_THEN', 'If/Then'),
    ('DECLARATION', 'Declaration'),
    ('FREE_FORM', 'Free-form'),
]

VALID_PATTERN_KEYS = {key for key, _ in PATTERN_CHOICES}
VALID_STYLISTIC_KEYS = {key for key, _ in STYLISTIC_CHOICES}


def _normalise_pattern_value(value: str) -> str:
    """Map legacy slash/space form (or any input) to the enum key.

    Returns '' if value cannot be reconciled to a known enum key.
    """
    if not value:
        return ''
    candidate = (
        value.strip()
        .upper()
        .replace('-', '_')
        .replace('/', '_')
        .replace(' ', '_')
    )
    if candidate in VALID_PATTERN_KEYS:
        return candidate
    return ''


def _normalise_stylistic_value(value: str) -> str:
    if not value:
        return ''
    candidate = (
        value.strip()
        .upper()
        .replace('-', '_')
        .replace('/', '_')
        .replace('+', '_')
        .replace(' ', '_')
    )
    # Collapse repeated underscores from things like "QUESTION + ANSWER".
    while '__' in candidate:
        candidate = candidate.replace('__', '_')
    candidate = candidate.strip('_')
    if candidate in VALID_STYLISTIC_KEYS:
        return candidate
    return ''


def forwards_normalise_legacy_values(apps, schema_editor):
    """Coerce legacy pattern_used / stylistic_device values to enum keys."""
    Idea = apps.get_model('idea_app', 'Idea')
    # Only iterate rows with non-empty values to keep the query cheap.
    for idea in Idea.objects.exclude(pattern_used='').only('id', 'pattern_used'):
        new_value = _normalise_pattern_value(idea.pattern_used)
        if new_value != idea.pattern_used:
            Idea.objects.filter(pk=idea.pk).update(pattern_used=new_value)
    for idea in Idea.objects.exclude(stylistic_device='').only(
        'id', 'stylistic_device',
    ):
        new_value = _normalise_stylistic_value(idea.stylistic_device)
        if new_value != idea.stylistic_device:
            Idea.objects.filter(pk=idea.pk).update(stylistic_device=new_value)


def reverse_noop(apps, schema_editor):
    """Reverse is a no-op — the normalised values stay valid CharField content."""
    return None


class Migration(migrations.Migration):

    dependencies = [
        ('idea_app', '0005_idea_board_layout'),
    ]

    operations = [
        migrations.AlterField(
            model_name='idea',
            name='pattern_used',
            field=models.CharField(
                blank=True,
                choices=PATTERN_CHOICES,
                db_index=True,
                default='',
                max_length=50,
            ),
        ),
        migrations.AlterField(
            model_name='idea',
            name='stylistic_device',
            field=models.CharField(
                blank=True,
                choices=STYLISTIC_CHOICES,
                db_index=True,
                default='',
                max_length=30,
            ),
        ),
        migrations.RunPython(
            forwards_normalise_legacy_values,
            reverse_code=reverse_noop,
        ),
    ]
