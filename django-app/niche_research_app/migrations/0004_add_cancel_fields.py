"""Add rq_job_id and cancelled fields to NicheResearch for cancel support."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('niche_research_app', '0003_add_resume_progress_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='nicheresearch',
            name='rq_job_id',
            field=models.CharField(
                blank=True,
                default='',
                help_text='RQ job ID for cancellation support',
                max_length=100,
            ),
        ),
        migrations.AddField(
            model_name='nicheresearch',
            name='cancelled',
            field=models.BooleanField(
                default=False,
                help_text='Whether this research was cancelled by user',
            ),
        ),
    ]
