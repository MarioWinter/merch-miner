import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('niche_app', '0001_initial'),
        ('design_app', '0001_initial'),
        ('workspace_app', '0001_initial'),
    ]

    operations = [
        # NicheKeywordGroup
        migrations.CreateModel(
            name='NicheKeywordGroup',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=100)),
                ('position', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('niche', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='keyword_groups',
                    to='niche_app.niche',
                )),
                ('created_by', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='created_keyword_groups',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['position'],
                'unique_together': {('niche', 'name')},
            },
        ),
        # NicheKeyword
        migrations.CreateModel(
            name='NicheKeyword',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('keyword', models.CharField(db_index=True, max_length=200)),
                ('source', models.CharField(
                    choices=[
                        ('research', 'Research'),
                        ('amazon_search', 'Amazon Search'),
                        ('web_search', 'Web Search'),
                        ('manual', 'Manual'),
                        ('junglescout', 'JungleScout'),
                    ],
                    db_index=True,
                    default='manual',
                    max_length=20,
                )),
                ('position', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('niche', models.ForeignKey(
                    db_index=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='niche_keywords',
                    to='niche_app.niche',
                )),
                ('group', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='keywords',
                    to='keyword_app.nichekeywordgroup',
                )),
                ('design_template', models.ForeignKey(
                    blank=True,
                    help_text='Design for PROJ-11 auto-injection',
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='keyword_templates',
                    to='design_app.design',
                )),
                ('created_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='created_keywords',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['group', 'position'],
                'unique_together': {('niche', 'keyword')},
            },
        ),
        migrations.AddIndex(
            model_name='nichekeyword',
            index=models.Index(
                fields=['niche', 'source'],
                name='nichekw_niche_source_idx',
            ),
        ),
        # KeywordJSCache
        migrations.CreateModel(
            name='KeywordJSCache',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('keyword', models.CharField(db_index=True, max_length=200)),
                ('marketplace', models.CharField(db_index=True, max_length=20)),
                ('monthly_search_volume_exact', models.IntegerField(blank=True, null=True)),
                ('monthly_search_volume_broad', models.IntegerField(blank=True, null=True)),
                ('monthly_trend', models.FloatField(blank=True, null=True)),
                ('quarterly_trend', models.FloatField(blank=True, null=True)),
                ('ppc_bid_exact', models.FloatField(blank=True, null=True)),
                ('ppc_bid_broad', models.FloatField(blank=True, null=True)),
                ('sp_brand_ad_bid', models.FloatField(blank=True, null=True)),
                ('ease_of_ranking_score', models.IntegerField(blank=True, null=True)),
                ('relevancy_score', models.IntegerField(blank=True, null=True)),
                ('organic_product_count', models.IntegerField(blank=True, null=True)),
                ('sponsored_product_count', models.IntegerField(blank=True, null=True)),
                ('dominant_category', models.CharField(blank=True, default='', max_length=200)),
                ('recommended_promotions', models.IntegerField(blank=True, null=True)),
                ('fetched_at', models.DateTimeField(db_index=True)),
            ],
            options={
                'verbose_name': 'Keyword JS Cache',
                'verbose_name_plural': 'Keyword JS Caches',
                'unique_together': {('keyword', 'marketplace')},
            },
        ),
        # KeywordHistoryCache
        migrations.CreateModel(
            name='KeywordHistoryCache',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('keyword', models.CharField(db_index=True, max_length=200)),
                ('marketplace', models.CharField(db_index=True, max_length=20)),
                ('history_data', models.JSONField(
                    default=list,
                    help_text='List of {date, search_volume} objects (12 months)',
                )),
                ('fetched_at', models.DateTimeField(db_index=True)),
            ],
            options={
                'verbose_name': 'Keyword History Cache',
                'verbose_name_plural': 'Keyword History Caches',
                'unique_together': {('keyword', 'marketplace')},
            },
        ),
        # NicheJSCallTracker
        migrations.CreateModel(
            name='NicheJSCallTracker',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('keyword_used', models.CharField(max_length=200)),
                ('called_at', models.DateTimeField(auto_now_add=True)),
                ('niche', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='js_call_tracker',
                    to='niche_app.niche',
                )),
            ],
            options={
                'verbose_name': 'Niche JS Call Tracker',
                'verbose_name_plural': 'Niche JS Call Trackers',
            },
        ),
        # SearchUsageLog (renamed to JSUsageLog in 0002)
        migrations.CreateModel(
            name='SearchUsageLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('provider', models.CharField(
                    choices=[('junglescout', 'JungleScout')],
                    db_index=True,
                    max_length=20,
                )),
                ('endpoint', models.CharField(max_length=100)),
                ('keywords_count', models.PositiveIntegerField(default=0, help_text='Number of keywords in this API call')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('user', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='search_usage_logs',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('workspace', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='search_usage_logs',
                    to='workspace_app.workspace',
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
