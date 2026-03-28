"""Seed default AgentConfigs, AutonomyPresets, and WorkflowTemplates per workspace."""

from django.core.management.base import BaseCommand

from agent_app.constants import AGENT_DEFAULTS, SYSTEM_PRESETS, SYSTEM_TEMPLATES
from agent_app.models import AgentConfig, AgentType, AutonomyPreset, WorkflowTemplate
from workspace_app.models import Workspace


class Command(BaseCommand):
    help = 'Seed default agent configs, autonomy presets, and workflow templates for all workspaces.'

    def handle(self, *args, **options):
        workspaces = Workspace.objects.all()
        if not workspaces.exists():
            self.stdout.write(self.style.WARNING("No workspaces found. Skipping seed."))
            return

        for ws in workspaces:
            self._seed_configs(ws)
            self._seed_presets(ws)
            self._seed_templates(ws)

        self.stdout.write(self.style.SUCCESS(
            f"Seeded agent defaults for {workspaces.count()} workspace(s)."
        ))

    def _seed_configs(self, workspace):
        for agent_type in AgentType.values:
            defaults = AGENT_DEFAULTS.get(agent_type, {})
            AgentConfig.objects.get_or_create(
                workspace=workspace,
                agent_type=agent_type,
                defaults={
                    'display_name': defaults.get('display_name', agent_type.title()),
                    'avatar_emoji': defaults.get('avatar_emoji', '\U0001f916'),
                    'model_name': defaults.get('model_name', 'openai/gpt-4.1-mini'),
                    'temperature': defaults.get('temperature', 0.3),
                },
            )

    def _seed_presets(self, workspace):
        for preset_data in SYSTEM_PRESETS:
            AutonomyPreset.objects.get_or_create(
                workspace=workspace,
                name=preset_data['name'],
                is_system=True,
                defaults={'permissions': preset_data['permissions']},
            )

    def _seed_templates(self, workspace):
        for tmpl_data in SYSTEM_TEMPLATES:
            WorkflowTemplate.objects.get_or_create(
                workspace=workspace,
                key=tmpl_data['key'],
                defaults={
                    'name': tmpl_data['name'],
                    'is_system': True,
                    'steps': tmpl_data['steps'],
                },
            )
