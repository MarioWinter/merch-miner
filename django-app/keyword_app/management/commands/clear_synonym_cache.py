"""One-time cleanup: clear stale SynonymCache entries.

After Phase 14 added multi-endpoint + token filter to Datamuse,
old cached results may contain irrelevant synonyms. Clearing the
cache forces fresh lookups with the new filtering logic.
"""

from django.core.management.base import BaseCommand

from keyword_app.models import SynonymCache


class Command(BaseCommand):
    help = 'Clear all SynonymCache entries (stale data from pre-token-filter era).'

    def handle(self, *args, **options):
        count, _ = SynonymCache.objects.all().delete()
        self.stdout.write(self.style.SUCCESS(f'Deleted {count} SynonymCache entries.'))
