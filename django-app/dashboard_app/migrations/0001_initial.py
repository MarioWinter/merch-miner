import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('workspace_app', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='ActivityEvent',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('event_type', models.CharField(
                    choices=[
                        ('niche_created', 'Niche Created'),
                        ('niche_archived', 'Niche Archived'),
                        ('niche_status_changed', 'Niche Status Changed'),
                        ('research_completed', 'Research Completed'),
                        ('research_failed', 'Research Failed'),
                        ('idea_created', 'Idea Created'),
                        ('idea_approved', 'Idea Approved'),
                        ('idea_rejected', 'Idea Rejected'),
                        ('design_generated', 'Design Generated'),
                        ('design_approved', 'Design Approved'),
                        ('listing_ready', 'Listing Ready'),
                        ('listing_published', 'Listing Published'),
                        ('upload_completed', 'Upload Completed'),
                        ('upload_failed', 'Upload Failed'),
                    ],
                    db_index=True,
                    max_length=50,
                )),
                ('target_name', models.CharField(default='', max_length=200)),
                ('target_id', models.UUIDField(blank=True, null=True)),
                ('agent_type', models.CharField(blank=True, default='', max_length=50)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='activity_events',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('workspace', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='activity_events',
                    to='workspace_app.workspace',
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='activityevent',
            index=models.Index(
                fields=['workspace', '-created_at'],
                name='activity_ws_created_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='activityevent',
            index=models.Index(
                fields=['workspace', 'event_type'],
                name='activity_ws_type_idx',
            ),
        ),
    ]
