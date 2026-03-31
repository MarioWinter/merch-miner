from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('idea_app', '0004_add_archived_status_to_idea'),
    ]

    operations = [
        migrations.AddField(
            model_name='idea',
            name='board_layout',
            field=models.JSONField(
                blank=True,
                default=None,
                help_text='React Flow board state: {nodes: [...], edges: [...]}',
                null=True,
            ),
        ),
    ]
