import uuid

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('keyword_app', '0002_rename_searchusagelog_to_jsusagelog'),
    ]

    operations = [
        migrations.CreateModel(
            name='KeywordProductCount',
            fields=[
                ('id', models.UUIDField(
                    default=uuid.uuid4, editable=False, primary_key=True, serialize=False,
                )),
                ('keyword', models.CharField(db_index=True, max_length=200)),
                ('marketplace', models.CharField(db_index=True, max_length=20)),
                ('product_count', models.PositiveIntegerField()),
                ('fetched_at', models.DateTimeField(db_index=True)),
            ],
            options={
                'verbose_name': 'Keyword Product Count',
                'verbose_name_plural': 'Keyword Product Counts',
                'unique_together': {('keyword', 'marketplace')},
            },
        ),
    ]
