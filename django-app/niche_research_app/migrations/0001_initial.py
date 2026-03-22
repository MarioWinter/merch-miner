import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('niche_app', '0001_initial'),
        ('scraper_app', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='ResearchNodeConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('node_name', models.CharField(choices=[('vision_analyze', 'Vision Analyze'), ('emotional_analyze', 'Emotional Analyze'), ('niche_profile', 'Niche Profile'), ('keywords', 'Keywords')], max_length=50, unique=True)),
                ('model_name', models.CharField(default='openai/gpt-4.1-mini', max_length=100)),
                ('temperature', models.FloatField(default=0.3)),
                ('max_tokens', models.IntegerField(blank=True, null=True)),
                ('system_prompt', models.TextField(blank=True, default='')),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Research Node Config',
                'verbose_name_plural': 'Research Node Configs',
            },
        ),
        migrations.CreateModel(
            name='NicheResearch',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('running', 'Running'), ('completed', 'Completed'), ('failed', 'Failed')], db_index=True, default='pending', max_length=20)),
                ('config_snapshot', models.JSONField(blank=True, default=dict, help_text='Snapshot of all ResearchNodeConfig at run start (audit trail)')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('error_message', models.TextField(blank=True, default='')),
                ('niche', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='research_runs', to='niche_app.niche')),
                ('triggered_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='triggered_research_runs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='nicheresearch',
            index=models.Index(fields=['niche', 'status'], name='research_niche_status_idx'),
        ),
        migrations.CreateModel(
            name='NicheResearchProduct',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('research', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='research_products', to='niche_research_app.nicheresearch')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='research_entries', to='scraper_app.amazonproduct')),
            ],
            options={
                'unique_together': {('research', 'product')},
            },
        ),
        migrations.CreateModel(
            name='NicheProductVisionAnalysis',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('slogan_text', models.TextField(blank=True, default='')),
                ('meaning_context', models.TextField(blank=True, default='')),
                ('visual_style', models.TextField(blank=True, default='')),
                ('graphic_elements', models.TextField(blank=True, default='')),
                ('layout_composition', models.TextField(blank=True, default='')),
                ('is_niche_match', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('research', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='vision_analyses', to='niche_research_app.nicheresearch')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='vision_analyses', to='scraper_app.amazonproduct')),
            ],
            options={
                'verbose_name': 'Vision Analysis',
                'verbose_name_plural': 'Vision Analyses',
            },
        ),
        migrations.CreateModel(
            name='NicheProductEmotionalAnalysis',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('original_slogan', models.TextField(blank=True, default='')),
                ('customer_psychology', models.JSONField(blank=True, default=dict)),
                ('sentiment_analysis', models.JSONField(blank=True, default=dict)),
                ('emotional_pattern', models.CharField(blank=True, default='', max_length=100)),
                ('vibe', models.JSONField(blank=True, default=dict)),
                ('semantic_structure', models.JSONField(blank=True, default=dict)),
                ('key_elements', models.JSONField(blank=True, default=list)),
                ('tone', models.TextField(blank=True, default='')),
                ('adaptation_formula', models.TextField(blank=True, default='')),
                ('adaptation_examples', models.JSONField(blank=True, default=list)),
                ('transferability_notes', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('research', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='emotional_analyses', to='niche_research_app.nicheresearch')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='emotional_analyses', to='scraper_app.amazonproduct')),
            ],
            options={
                'verbose_name': 'Emotional Analysis',
                'verbose_name_plural': 'Emotional Analyses',
            },
        ),
        migrations.CreateModel(
            name='NicheAnalysis',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('niche_summary', models.TextField(blank=True, default='')),
                ('sentiment', models.CharField(blank=True, choices=[('Positive', 'Positive'), ('Neutral', 'Neutral'), ('Negative', 'Negative')], default='', max_length=50)),
                ('primary_emotions', models.JSONField(blank=True, default=list)),
                ('emotional_archetype', models.JSONField(blank=True, default=list)),
                ('example_keywords', models.JSONField(blank=True, default=list)),
                ('pattern_analysis', models.JSONField(blank=True, default=list, help_text='list[{name, present, context}] - all 16 patterns')),
                ('emotional_reality', models.TextField(blank=True, default='')),
                ('design_concepts', models.TextField(blank=True, default='')),
                ('dominant_design_aesthetics', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('research', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='niche_analyses', to='niche_research_app.nicheresearch')),
                ('niche', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='niche_analyses', to='niche_app.niche')),
            ],
            options={
                'verbose_name': 'Niche Analysis',
                'verbose_name_plural': 'Niche Analyses',
            },
        ),
        migrations.CreateModel(
            name='NicheKeywordAnalysis',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('main_short_tail', models.JSONField(blank=True, default=list)),
                ('main_long_tail', models.JSONField(blank=True, default=list)),
                ('all_keywords_flat', models.TextField(blank=True, default='')),
                ('top_focus_keywords', models.JSONField(blank=True, default=list)),
                ('top_long_tail_keywords', models.JSONField(blank=True, default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('research', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='keyword_analyses', to='niche_research_app.nicheresearch')),
                ('niche', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='keyword_analyses', to='niche_app.niche')),
            ],
            options={
                'verbose_name': 'Keyword Analysis',
                'verbose_name_plural': 'Keyword Analyses',
            },
        ),
    ]
