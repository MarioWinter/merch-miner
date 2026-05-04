# Generated manually

import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('niche_app', '0005_niche_current_round'),
        ('scraper_app', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='CollectedProduct',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('collected_at', models.DateTimeField(auto_now_add=True)),
                ('extracted_keywords', models.JSONField(blank=True, default=list)),
                ('listing_template', models.JSONField(blank=True, default=dict)),
                ('niche', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='collected_products', to='niche_app.niche', db_index=True)),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='collected_by_niches', to='scraper_app.amazonproduct')),
            ],
            options={
                'ordering': ['-collected_at'],
                'unique_together': {('niche', 'product')},
            },
        ),
    ]
