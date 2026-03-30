# Generated manually — run makemigrations to verify

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('idea_app', '0002_idea_round'),
        ('workspace_app', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='IdeaFilterTemplate',
            fields=[
                ('id', models.UUIDField(
                    default=uuid.uuid4, editable=False, primary_key=True, serialize=False,
                )),
                ('name', models.CharField(max_length=100)),
                ('filters', models.JSONField(
                    default=dict,
                    help_text='Saved filter state: {niche_id, status, signal_type, is_orphan, ordering}',
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='idea_filter_templates',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('workspace', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='idea_filter_templates',
                    to='workspace_app.workspace',
                )),
            ],
            options={
                'ordering': ['name'],
            },
        ),
    ]
