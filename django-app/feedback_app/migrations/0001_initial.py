# Generated for FIX-dashboard-bug-report-and-polish Item 1.

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models

import feedback_app.models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('workspace_app', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='FeedbackScreenshot',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('image', models.ImageField(max_length=512, upload_to=feedback_app.models.screenshot_upload_path)),
                ('uploaded_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('uploaded_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='feedback_screenshots', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-uploaded_at'],
            },
        ),
        migrations.CreateModel(
            name='BugFeatureReport',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('type', models.CharField(choices=[('bug', 'Bug'), ('feature', 'Feature')], db_index=True, max_length=10)),
                ('title', models.CharField(max_length=200)),
                ('description', models.TextField()),
                ('status', models.CharField(choices=[('new', 'New'), ('triaged', 'Triaged'), ('in_progress', 'In Progress'), ('done', 'Done'), ('wontfix', "Won't Fix")], db_index=True, default='new', max_length=20)),
                ('admin_notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('screenshot', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reports', to='feedback_app.feedbackscreenshot')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='feedback_reports', to=settings.AUTH_USER_MODEL)),
                ('workspace', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='feedback_reports', to='workspace_app.workspace')),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['workspace', 'created_at'], name='feedback_ws_created_idx'),
                    models.Index(fields=['status', 'created_at'], name='feedback_status_created_idx'),
                ],
            },
        ),
    ]
