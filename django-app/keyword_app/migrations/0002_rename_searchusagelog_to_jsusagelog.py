import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('keyword_app', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('workspace_app', '0001_initial'),
    ]

    operations = [
        # Rename model SearchUsageLog -> JSUsageLog
        migrations.RenameModel(
            old_name='SearchUsageLog',
            new_name='JSUsageLog',
        ),
        # Update related_name on user FK to avoid clash with search_app
        migrations.AlterField(
            model_name='jsusagelog',
            name='user',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='js_usage_logs',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        # Update related_name on workspace FK to avoid clash with search_app
        migrations.AlterField(
            model_name='jsusagelog',
            name='workspace',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='js_usage_logs',
                to='workspace_app.workspace',
            ),
        ),
        # Add verbose_name
        migrations.AlterModelOptions(
            name='jsusagelog',
            options={
                'ordering': ['-created_at'],
                'verbose_name': 'JS Usage Log',
                'verbose_name_plural': 'JS Usage Logs',
            },
        ),
    ]
