from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('scraper_app', '0003_scrapejob_max_items'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='amazonproduct',
            name='feature_bullets',
        ),
        migrations.AddField(
            model_name='amazonproduct',
            name='bullet_1',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='amazonproduct',
            name='bullet_2',
            field=models.TextField(blank=True, default=''),
        ),
    ]
