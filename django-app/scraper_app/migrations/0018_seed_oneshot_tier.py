"""Seed the OneShot ScrapeTier used for bulk one-shot ASIN scrapes (PROJ-25 Phase A).

Idempotent: only creates the row if a tier with name='OneShot' does not already exist.
The reverse migration is intentionally a no-op so a manual rollback does not
auto-delete the tier (and any targets that reference it).

See AC-5, EC-15 in features/PROJ-25-bulk-asin-scrape-batches.md.
"""

from django.db import migrations


ONESHOT_NAME = 'OneShot'
ONESHOT_DEFAULTS = {
    'bsr_min': 0,
    'bsr_max': None,
    'interval_days': 999999,
}


def seed_oneshot_tier(apps, schema_editor):
    """Create a OneShot tier only if none exists yet.

    Uses filter().exists() instead of get_or_create() because ScrapeTier.name
    has no unique constraint and prod may already contain multiple manually
    created OneShot rows (e.g. from admin testing). get_or_create() would
    raise MultipleObjectsReturned in that case.
    """
    ScrapeTier = apps.get_model('scraper_app', 'ScrapeTier')
    if not ScrapeTier.objects.filter(name=ONESHOT_NAME).exists():
        ScrapeTier.objects.create(name=ONESHOT_NAME, **ONESHOT_DEFAULTS)


def unseed_oneshot_tier(apps, schema_editor):
    """No-op on reverse — never auto-delete the OneShot tier on rollback."""
    return


class Migration(migrations.Migration):

    dependencies = [
        ('scraper_app', '0017_scraperconfig'),
    ]

    operations = [
        migrations.RunPython(seed_oneshot_tier, unseed_oneshot_tier),
    ]
