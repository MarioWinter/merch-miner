"""PROJ-29 Phase 1B: Add `source` discriminator to NicheNote."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('niche_app', '0007_nichenote'),
    ]

    operations = [
        migrations.AddField(
            model_name='nichenote',
            name='source',
            field=models.CharField(
                choices=[
                    ('user', 'User'),
                    ('niche_legacy_notes', 'Niche Legacy Notes'),
                    ('web_search', 'Web Search'),
                    ('agent_research', 'Agent Research'),
                ],
                db_index=True,
                default='user',
                max_length=30,
            ),
        ),
    ]
