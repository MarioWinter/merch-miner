from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('workspace_app', '0001_initial'),
        ('scraper_app', '0005_alter_scrapejob_mode_metakeyword_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='productsearchcache',
            name='workspace',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='search_caches',
                to='workspace_app.workspace',
            ),
        ),
    ]
