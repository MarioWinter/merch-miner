import logging

from scraper_app.scrapy_app.items import ScrapeErrorItem

logger = logging.getLogger(__name__)


class DjangoORMPipeline:
    """Pipeline that saves scraped items to Django models via ORM.

    Handles: upsert AmazonProduct, link Keywords (M2M), create BSRSnapshot,
    auto-enroll ScheduledScrapeTarget, track ScrapeJob progress.
    """

    def __init__(self):
        self.scrape_job = None
        self.AmazonProduct = None
        self.Keyword = None
        self.ProductSearchCache = None
        self.BSRSnapshot = None
        self.ScrapeTier = None
        self.ScrapeJob = None
        self.ScheduledScrapeTarget = None
        self.timezone = None

    def open_spider(self, spider):
        import os
        import django
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
        django.setup()

        from django.utils import timezone
        from scraper_app.models import (
            AmazonProduct, Keyword, ProductSearchCache,
            BSRSnapshot, ScrapeTier, ScrapeJob, ScheduledScrapeTarget,
        )

        self.AmazonProduct = AmazonProduct
        self.Keyword = Keyword
        self.ProductSearchCache = ProductSearchCache
        self.BSRSnapshot = BSRSnapshot
        self.ScrapeTier = ScrapeTier
        self.ScrapeJob = ScrapeJob
        self.ScheduledScrapeTarget = ScheduledScrapeTarget
        self.timezone = timezone

        job_id = getattr(spider, 'job_id', None)
        if job_id:
            try:
                self.scrape_job = ScrapeJob.objects.get(id=job_id)
                self.scrape_job.status = ScrapeJob.Status.RUNNING
                self.scrape_job.started_at = timezone.now()
                self.scrape_job.save(update_fields=['status', 'started_at'])
                logger.info("ScrapeJob %s set to running", job_id)
            except ScrapeJob.DoesNotExist:
                logger.warning("ScrapeJob %s not found, proceeding without job tracking", job_id)

    def process_item(self, item, spider):
        # Handle error items
        if isinstance(item, ScrapeErrorItem):
            self._handle_error_item(item)
            return item

        try:
            product = self._upsert_product(item)
            self._link_keyword(item, product)
            self._create_bsr_snapshot(item, product)
            self._auto_enroll_target(item)
            self._update_job_progress()
        except Exception:
            logger.exception(
                "Pipeline error processing ASIN %s",
                item.get('asin', 'unknown'),
            )

        return item

    def close_spider(self, spider):
        if not self.scrape_job:
            return

        try:
            self.scrape_job.refresh_from_db()
            has_errors = bool(self.scrape_job.error_log and self.scrape_job.error_log.strip())
            no_products = (self.scrape_job.products_scraped or 0) == 0

            if has_errors and no_products:
                self.scrape_job.status = self.ScrapeJob.Status.FAILED
            else:
                self.scrape_job.status = self.ScrapeJob.Status.COMPLETED

            self.scrape_job.finished_at = self.timezone.now()
            self.scrape_job.save(update_fields=['status', 'finished_at'])
            logger.info(
                "ScrapeJob %s finished with status=%s, products=%d",
                self.scrape_job.id,
                self.scrape_job.status,
                self.scrape_job.products_scraped or 0,
            )
        except Exception:
            logger.exception("Error finalizing ScrapeJob %s", self.scrape_job.id)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _handle_error_item(self, item):
        error_entry = (
            f"SELECTOR_ERROR: {item['failed_selector']} | "
            f"URL: {item['url']} | "
            f"Marketplace: {item['marketplace']} | "
            f"Status: {item['response_status']} | "
            f"{item['error_message']}\n---\n"
        )
        logger.warning("Scrape error: %s", error_entry.strip())

        if self.scrape_job:
            try:
                self.scrape_job.error_log = (self.scrape_job.error_log or '') + error_entry
                self.scrape_job.save(update_fields=['error_log'])
            except Exception:
                logger.exception("Failed to save error to ScrapeJob")

    def _upsert_product(self, item):
        product, created = self.AmazonProduct.objects.update_or_create(
            asin=item['asin'],
            marketplace=item['marketplace'],
            defaults={
                'title': item.get('title') or '',
                'brand': item.get('brand') or '',
                'bsr': item.get('bsr'),
                'bsr_categories': item.get('bsr_categories') or [],
                'category': item.get('category') or '',
                'subcategory': item.get('subcategory') or '',
                'price': item.get('price'),
                'rating': item.get('rating'),
                'reviews_count': item.get('reviews_count'),
                'listed_date': item.get('listed_date'),
                'product_type': item.get('product_type') or 'other',
                'thumbnail_url': item.get('thumbnail_url') or '',
                'product_url': item.get('product_url') or '',
                'seller_name': item.get('seller_name') or '',
                'bullet_1': item.get('bullet_1') or '',
                'bullet_2': item.get('bullet_2') or '',
                'description': item.get('description') or '',
                'variants': item.get('variants') or {},
                'image_gallery': item.get('image_gallery') or [],
                'scraped_at': self.timezone.now(),
            },
        )
        action = "Created" if created else "Updated"
        logger.debug("%s product %s (%s)", action, item['asin'], item['marketplace'])
        return product

    def _link_keyword(self, item, product):
        keyword_str = item.get('keyword')
        if not keyword_str:
            return
        keyword_obj, _ = self.Keyword.objects.get_or_create(
            keyword=keyword_str,
            marketplace=item['marketplace'],
        )
        product.keywords.add(keyword_obj)

    def _create_bsr_snapshot(self, item, product):
        if item.get('bsr') is None:
            return
        self.BSRSnapshot.objects.create(
            product=product,
            bsr=item['bsr'],
            rating=item.get('rating'),
            price=item.get('price'),
        )

    def _auto_enroll_target(self, item):
        bsr = item.get('bsr')
        tier = self.ScrapeTier.get_tier_for_bsr(bsr) if bsr is not None else None
        if not tier:
            return
        self.ScheduledScrapeTarget.objects.get_or_create(
            asin=item['asin'],
            marketplace=item['marketplace'],
            defaults={
                'tier': tier,
                'active': True,
            },
        )

    def _update_job_progress(self):
        if not self.scrape_job:
            return
        try:
            self.scrape_job.products_scraped = (self.scrape_job.products_scraped or 0) + 1
            self.scrape_job.save(update_fields=['products_scraped'])
        except Exception:
            logger.exception("Failed to update ScrapeJob progress")
