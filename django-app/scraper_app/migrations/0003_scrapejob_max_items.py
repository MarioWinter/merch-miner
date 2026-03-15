from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('scraper_app', '0002_scrapejob_product_type_filter'),
    ]

    operations = [
        migrations.AddField(
            model_name='scrapejob',
            name='max_items',
            field=models.PositiveIntegerField(
                blank=True,
                help_text='Max products to scrape. Leave empty for all.',
                null=True,
            ),
        ),
    ]
