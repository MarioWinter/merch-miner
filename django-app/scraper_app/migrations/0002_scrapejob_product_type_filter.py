from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('scraper_app', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='scrapejob',
            name='product_type_filter',
            field=models.CharField(
                blank=True,
                choices=[
                    ('', 'All Products (no filter)'),
                    ('t_shirt', 'T-Shirt'),
                    ('hoodie', 'Hoodie'),
                    ('pullover', 'Pullover'),
                    ('zip_hoodie', 'Zip Hoodie'),
                    ('long_sleeve', 'Long Sleeve'),
                    ('tank_top', 'Tank Top'),
                ],
                default='',
                help_text='Filter Amazon search to specific MBA product type',
                max_length=20,
            ),
        ),
    ]
