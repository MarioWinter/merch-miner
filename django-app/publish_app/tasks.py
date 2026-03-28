"""django-rq background tasks for publish_app."""

import logging

logger = logging.getLogger(__name__)


def task_generate_listing(
    listing_id: str,
    slogan_text: str,
    extra_keywords: str = '',
    language: str = 'en',
    design_context: str = '',
):
    """AI listing generation task. Updates Listing with generated fields."""
    from publish_app.models import Listing
    from publish_app.services.listing_generator import generate_listing

    try:
        listing = Listing.objects.get(pk=listing_id)

        result = generate_listing(
            slogan_text=slogan_text,
            extra_keywords=extra_keywords,
            language=language,
            design_context=design_context,
        )

        listing.brand_name = result.get('brand_name', '')
        listing.title = result.get('title', '')
        listing.bullet_1 = result.get('bullet_1', '')
        listing.bullet_2 = result.get('bullet_2', '')
        listing.bullet_3 = result.get('bullet_3', '')
        listing.bullet_4 = result.get('bullet_4', '')
        listing.bullet_5 = result.get('bullet_5', '')
        listing.description = result.get('description', '')
        listing.backend_keywords = result.get('backend_keywords', '')
        listing.status = Listing.Status.DRAFT
        listing.save()

        logger.info("Listing %s generated successfully", listing_id)

    except Listing.DoesNotExist:
        logger.error("Listing %s not found", listing_id)
    except Exception:
        logger.exception("Failed to generate listing %s", listing_id)
        try:
            listing = Listing.objects.get(pk=listing_id)
            listing.status = Listing.Status.DRAFT
            listing.save(update_fields=['status'])
        except Listing.DoesNotExist:
            pass


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


def task_tm_check(listing_id: str) -> list[dict]:
    """Trademark check task. Returns flagged terms."""
    from publish_app.models import Listing
    from publish_app.services.tm_checker import check_listing_tm

    try:
        listing = Listing.objects.get(pk=listing_id)
        return check_listing_tm(listing)
    except Listing.DoesNotExist:
        logger.error("Listing %s not found for TM check", listing_id)
        return []


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
