# Generated manually for PROJ-9: 4 generation modes + source_image_url_2

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('design_app', '0010_add_image_to_image_mode'),
    ]

    operations = [
        # Update Mode choices: rename image_to_image_remix → remix
        migrations.AlterField(
            model_name='designgenerationrun',
            name='generation_mode',
            field=models.CharField(
                choices=[
                    ('text_to_image', 'Text to Image'),
                    ('image_to_image', 'Image to Image'),
                    ('image_to_image_edit', 'Image to Image (Edit)'),
                    ('remix', 'Remix'),
                ],
                db_index=True,
                default='text_to_image',
                help_text='Generation mode: text_to_image or image_to_image',
                max_length=20,
            ),
        ),
        # Add second reference image URL for remix mode
        migrations.AddField(
            model_name='designgenerationrun',
            name='source_image_url_2',
            field=models.URLField(
                blank=True,
                default='',
                help_text='Second reference image URL for remix mode',
                max_length=2048,
            ),
        ),
        # Migrate existing image_to_image_remix → remix
        migrations.RunSQL(
            sql="UPDATE design_app_designgenerationrun SET generation_mode = 'remix' WHERE generation_mode = 'image_to_image_remix';",
            reverse_sql="UPDATE design_app_designgenerationrun SET generation_mode = 'image_to_image_remix' WHERE generation_mode = 'remix';",
        ),
    ]
