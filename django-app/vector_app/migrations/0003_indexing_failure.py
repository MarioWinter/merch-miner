"""PROJ-29 Phase 1B: IndexingFailure tracking for embedding pipeline retry."""

import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('contenttypes', '0002_remove_content_type_name'),
        ('vector_app', '0002_search_vector_trigger'),
    ]

    operations = [
        migrations.CreateModel(
            name='IndexingFailure',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('object_id', models.UUIDField()),
                ('attempt_count', models.PositiveIntegerField(default=0)),
                ('last_error', models.TextField(blank=True, default='')),
                ('last_attempt_at', models.DateTimeField(auto_now=True)),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('content_type', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='indexing_failures', to='contenttypes.contenttype')),
            ],
            options={
                'unique_together': {('content_type', 'object_id')},
            },
        ),
        migrations.AddIndex(
            model_name='indexingfailure',
            index=models.Index(fields=['resolved_at', 'last_attempt_at'], name='idx_failure_resolved_attempt'),
        ),
    ]
