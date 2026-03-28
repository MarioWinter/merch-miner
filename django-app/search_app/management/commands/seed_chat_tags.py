"""Seed default chat tags for all workspaces that don't have them yet."""

from django.core.management.base import BaseCommand

from search_app.models import ChatTag, DEFAULT_TAGS
from workspace_app.models import Workspace


class Command(BaseCommand):
    help = 'Seed default system chat tags for all workspaces.'

    def handle(self, *args, **options):
        workspaces = Workspace.objects.all()
        created_count = 0

        for ws in workspaces:
            for tag_data in DEFAULT_TAGS:
                _, created = ChatTag.objects.get_or_create(
                    workspace=ws,
                    name=tag_data['name'],
                    defaults={
                        'color': tag_data['color'],
                        'is_system': True,
                        'created_by': ws.owner,
                    },
                )
                if created:
                    created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {created_count} tags across {workspaces.count()} workspaces."
            )
        )
