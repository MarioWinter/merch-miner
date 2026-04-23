# PROJ-11 Phase I1 (2026-04-22): Listing.translations JSON shape migration.
#
# Old shape (pre-AC-1 rewrite):
#   {lang: {title, bullets: [b1, b2, b3, b4, b5], description, ...}}
# New shape:
#   {lang: {title, bullet_1, bullet_2, description, ...}}
#
# Forward migration:
#   - For each Listing row, walk the `translations` dict.
#   - For each language entry, if a `bullets` array exists, promote the
#     first two entries to `bullet_1` / `bullet_2` (only if those keys
#     are not already populated from a previous run), then drop `bullets`.
#   - Entries already matching the new shape are left untouched.
#
# Reverse migration:
#   - No-op. The old shape is not meaningfully recoverable because
#     bullets 3-5 were dropped in 0007_listing_shrink_and_rename. Any
#     caller rolling back past this point must reseed translations
#     manually. Documented as forward-only for the JSON data.

from django.db import migrations


def migrate_translations_forward(apps, schema_editor):
    Listing = apps.get_model('publish_app', 'Listing')

    qs = Listing.objects.exclude(translations={}).exclude(translations=None)
    for listing in qs.iterator():
        translations = listing.translations or {}
        if not isinstance(translations, dict):
            # Defensive: if the field somehow contains a non-dict, reset.
            listing.translations = {}
            listing.save(update_fields=['translations'])
            continue

        changed = False
        for lang, entry in list(translations.items()):
            if not isinstance(entry, dict):
                continue

            bullets = entry.get('bullets')
            if isinstance(bullets, list):
                # Promote first two entries when the new keys are empty.
                if not entry.get('bullet_1') and len(bullets) >= 1:
                    entry['bullet_1'] = bullets[0] or ''
                if not entry.get('bullet_2') and len(bullets) >= 2:
                    entry['bullet_2'] = bullets[1] or ''
                entry.pop('bullets', None)
                changed = True

            # Remove any stale bullet_3..5 keys from prior writes.
            for legacy_key in ('bullet_3', 'bullet_4', 'bullet_5'):
                if legacy_key in entry:
                    entry.pop(legacy_key, None)
                    changed = True

            translations[lang] = entry

        if changed:
            listing.translations = translations
            listing.save(update_fields=['translations'])


def migrate_translations_backward(apps, schema_editor):
    # Forward-only: bullets 3-5 are already gone. No-op on reverse.
    return


class Migration(migrations.Migration):

    dependencies = [
        ('publish_app', '0007_listing_shrink_and_rename'),
    ]

    operations = [
        migrations.RunPython(
            migrate_translations_forward,
            migrate_translations_backward,
        ),
    ]
