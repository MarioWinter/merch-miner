"""Management command: daily cleanup of expired design trash (AC-27)."""

from django.core.management.base import BaseCommand

from kanban_app.services.trash_cleanup import cleanup_expired_trash


class Command(BaseCommand):
    help = 'Delete expired design trash entries (30+ days old) and their files.'

    def handle(self, *args, **options):
        count = cleanup_expired_trash()
        self.stdout.write(self.style.SUCCESS(f'Deleted {count} expired design trash entries.'))
