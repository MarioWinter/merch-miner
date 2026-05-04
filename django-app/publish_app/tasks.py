"""django-rq background tasks for publish_app."""

import logging

logger = logging.getLogger(__name__)


def task_translate_listing(listing_id: str, target_languages: list[str]):
    """AI translation task. Stores translations in listing.translations JSONField."""
    from publish_app.models import Listing
    from publish_app.services.translator import translate_listing

    try:
        listing = Listing.objects.get(pk=listing_id)
        translations = listing.translations or {}

        for lang in target_languages:
            try:
                result = translate_listing(listing, lang)
                over_limit = result.pop('over_limit_fields', [])
                translations[lang] = {
                    **result,
                    'over_limit_fields': over_limit,
                }
                logger.info("Listing %s translated to %s", listing_id, lang)
            except Exception:
                logger.exception(
                    "Failed to translate listing %s to %s", listing_id, lang,
                )
                translations[lang] = {'error': 'Translation failed'}

        listing.translations = translations
        listing.save(update_fields=['translations', 'updated_at'])

    except Listing.DoesNotExist:
        logger.error("Listing %s not found for translation", listing_id)


def task_import_cloud_files(
    workspace_id: str,
    file_ids: list[str],
    provider: str,
    user_id: int,
):
    """Import files from Google Drive or OneDrive."""
    from publish_app.models import DesignAsset

    logger.info(
        "Importing %d files from %s for workspace %s",
        len(file_ids), provider, workspace_id,
    )

    # Note: OAuth tokens would need to be passed or refreshed here.
    # For MVP, this is a placeholder that creates records without download.
    for file_id in file_ids:
        try:
            source = (
                DesignAsset.Source.GOOGLE_DRIVE
                if provider == 'google_drive'
                else DesignAsset.Source.ONEDRIVE
            )

            DesignAsset.objects.create(
                workspace_id=workspace_id,
                file_name=f'{provider}_{file_id}',
                source=source,
                source_file_id=file_id,
                created_by_id=user_id,
            )
            logger.info("Created DesignAsset for %s file %s", provider, file_id)
        except Exception:
            logger.exception(
                "Failed to import %s file %s", provider, file_id,
            )
