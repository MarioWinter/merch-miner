"""PROJ-29: initial schema for ChatNodeConfig + ChatNodeConfigVersion."""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ChatNodeConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('node_name', models.CharField(choices=[
                    ('agent_react', 'Agent ReAct'),
                    ('creative_techniques', 'Creative Techniques'),
                    ('chat_with_niche', 'Chat With Niche'),
                    ('chat_no_niche', 'Chat No Niche'),
                    ('query_rewrite', 'Query Rewrite'),
                    ('contextual_header', 'Contextual Header'),
                    ('follow_up_suggester', 'Follow-Up Suggester'),
                    ('conversation_summarizer', 'Conversation Summarizer'),
                ], max_length=50, unique=True)),
                ('model_name', models.CharField(default='openai/gpt-4.1-mini', max_length=100)),
                ('temperature', models.FloatField(default=0.3)),
                ('max_tokens', models.IntegerField(blank=True, null=True)),
                ('system_prompt', models.TextField(blank=True, default='')),
                ('is_active', models.BooleanField(default=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('updated_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='+',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Chat Node Config',
                'verbose_name_plural': 'Chat Node Configs',
            },
        ),
        migrations.CreateModel(
            name='ChatNodeConfigVersion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('node_name', models.CharField(db_index=True, max_length=50)),
                ('model_name', models.CharField(max_length=100)),
                ('temperature', models.FloatField()),
                ('max_tokens', models.IntegerField(blank=True, null=True)),
                ('system_prompt', models.TextField(blank=True, default='')),
                ('snapshot_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('snapshot_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='+',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Chat Node Config Version',
                'verbose_name_plural': 'Chat Node Config Versions',
                'ordering': ['-snapshot_at'],
            },
        ),
        migrations.AddIndex(
            model_name='chatnodeconfigversion',
            index=models.Index(
                fields=['node_name', '-snapshot_at'],
                name='chatcfg_version_node_time_idx',
            ),
        ),
    ]
