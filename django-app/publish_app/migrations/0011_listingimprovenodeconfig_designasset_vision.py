# PROJ-11 Phase M1 extension (2026-04-23):
#
# 1. Create ``ListingImproveNodeConfig`` — per-node LLM config (model name,
#    temperature, max_tokens, system_prompt). Mirrors ``SloganNodeConfig`` +
#    ``ResearchNodeConfig``. Row per logical AI Improve node
#    (``ai_improve`` + ``design_vision``).
# 2. Add ``DesignAsset.vision_analysis`` JSONField to cache vision LLM output
#    so the AI Improve text call is cheaper (no repeat vision pass per call).
#    Empty dict = not yet analyzed. See AC-69..AC-72.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('publish_app', '0010_uploadtemplate_products_config'),
    ]

    operations = [
        migrations.CreateModel(
            name='ListingImproveNodeConfig',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                (
                    'node_name',
                    models.CharField(
                        choices=[
                            ('ai_improve', 'AI Improve'),
                            ('design_vision', 'Design Vision'),
                        ],
                        max_length=50,
                        unique=True,
                    ),
                ),
                (
                    'model_name',
                    models.CharField(
                        default='openai/gpt-4.1-mini',
                        max_length=100,
                    ),
                ),
                ('temperature', models.FloatField(default=0.7)),
                (
                    'max_tokens',
                    models.IntegerField(blank=True, default=2000, null=True),
                ),
                (
                    'system_prompt',
                    models.TextField(blank=True, default=''),
                ),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Listing Improve Node Config',
                'verbose_name_plural': 'Listing Improve Node Configs',
            },
        ),
        migrations.AddField(
            model_name='designasset',
            name='vision_analysis',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text=(
                    'Cached structured vision LLM analysis for AI Improve '
                    '(PROJ-11 Phase M). Empty dict = not yet analyzed. '
                    'Shape: {analyzed_at, model, description, visual_style, '
                    'graphic_elements, layout_composition, '
                    'dominant_colors[], detected_text}.'
                ),
            ),
        ),
    ]
