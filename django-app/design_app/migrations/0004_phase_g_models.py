# Generated manually for Phase G: DesignProjectIdea, ProjectPrompt, PromptPreset,
# DesignGenerationRun.project_prompt, DesignProject.ideas M2M,
# CreateProjectSerializer.idea_ids

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('design_app', '0003_design_processed_file'),
        ('idea_app', '0001_initial'),
        ('workspace_app', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # -- DesignProjectIdea through table (G1) --
        migrations.CreateModel(
            name='DesignProjectIdea',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('position', models.IntegerField(default=0)),
                ('added_at', models.DateTimeField(auto_now_add=True)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='project_ideas', to='design_app.designproject')),
                ('idea', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='idea_projects_through', to='idea_app.idea')),
            ],
            options={
                'ordering': ['position', '-added_at'],
                'unique_together': {('project', 'idea')},
            },
        ),
        migrations.AddIndex(
            model_name='designprojectidea',
            index=models.Index(fields=['project', 'idea'], name='projidea_proj_idea_idx'),
        ),
        # -- Add ideas M2M on DesignProject --
        migrations.AddField(
            model_name='designproject',
            name='ideas',
            field=models.ManyToManyField(blank=True, related_name='design_projects', through='design_app.DesignProjectIdea', to='idea_app.idea'),
        ),
        # -- ProjectPrompt model (G9) --
        migrations.CreateModel(
            name='ProjectPrompt',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('prompt_text', models.TextField()),
                ('sources', models.JSONField(blank=True, default=dict, help_text='Which sources were used: {slogan, keywords, research, web_research, image}')),
                ('source_image_url', models.URLField(blank=True, default='', max_length=2048)),
                ('variant_index', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='prompts', to='design_app.designproject', db_index=True)),
                ('source_idea', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='project_prompts', to='idea_app.idea')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='projectprompt',
            index=models.Index(fields=['project', 'created_at'], name='projprompt_proj_created_idx'),
        ),
        # -- DesignGenerationRun.project_prompt FK (G9) --
        migrations.AddField(
            model_name='designgenerationrun',
            name='project_prompt',
            field=models.ForeignKey(blank=True, help_text='Saved prompt this run was generated from', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='generation_runs', to='design_app.projectprompt'),
        ),
        # -- PromptPreset model (G10) --
        migrations.CreateModel(
            name='PromptPreset',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=100)),
                ('source_config', models.JSONField(default=dict, help_text='Source toggle config: {slogan, keywords, research, web_research, image}')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('workspace', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='prompt_presets', to='workspace_app.workspace', db_index=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='created_prompt_presets', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['name'],
            },
        ),
    ]
