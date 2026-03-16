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
        self.MetaKeyword = None
        self.SearchKeywordResult = None
        self.timezone = None
        self.scraped_product_pks = []

    def open_spider(self, spider):
        import os
        import django
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
        django.setup()

        from django.utils import timezone
        from scraper_app.models import (
            AmazonProduct, Keyword, ProductSearchCache,
            BSRSnapshot, ScrapeTier, ScrapeJob, ScheduledScrapeTarget,
            MetaKeyword, SearchKeywordResult,
        )

        self.AmazonProduct = AmazonProduct
        self.Keyword = Keyword
        self.ProductSearchCache = ProductSearchCache
        self.BSRSnapshot = BSRSnapshot
        self.ScrapeTier = ScrapeTier
        self.ScrapeJob = ScrapeJob
        self.ScheduledScrapeTarget = ScheduledScrapeTarget
        self.MetaKeyword = MetaKeyword
        self.SearchKeywordResult = SearchKeywordResult
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
            self.scraped_product_pks.append(product.pk)
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
        # Run MetaKeyword extraction regardless of job tracking
        self._extract_meta_keywords(spider)

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
        """PATCH semantics: get_or_create + only update fields where item value is not None."""
        product, created = self.AmazonProduct.objects.get_or_create(
            asin=item['asin'],
            marketplace=item['marketplace'],
        )

        # Map item keys to model fields + default for "empty" (when item has no value)
        field_map = {
            'title': ('title', ''),
            'brand': ('brand', ''),
            'bsr': ('bsr', None),
            'bsr_categories': ('bsr_categories', []),
            'category': ('category', ''),
            'subcategory': ('subcategory', ''),
            'price': ('price', None),
            'rating': ('rating', None),
            'reviews_count': ('reviews_count', None),
            'listed_date': ('listed_date', None),
            'product_type': ('product_type', 'other'),
            'thumbnail_url': ('thumbnail_url', ''),
            'product_url': ('product_url', ''),
            'seller_name': ('seller_name', ''),
            'bullet_1': ('bullet_1', ''),
            'bullet_2': ('bullet_2', ''),
            'description': ('description', ''),
            'variants': ('variants', {}),
            'image_gallery': ('image_gallery', []),
        }

        changed_fields = []
        for item_key, (model_field, default) in field_map.items():
            value = item.get(item_key)
            if value is None:
                # Don't overwrite existing data with None (PATCH semantics)
                continue
            # Apply default for falsy string/list/dict values on create only
            if created and not value:
                value = default
            setattr(product, model_field, value)
            changed_fields.append(model_field)

        # Always update scraped_at
        product.scraped_at = self.timezone.now()
        changed_fields.append('scraped_at')

        if changed_fields:
            product.save(update_fields=changed_fields)

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
        """Create BSR snapshot. Skip if BSR is None (e.g. search_page_only mode)."""
        bsr = item.get('bsr')
        if bsr is None:
            return
        self.BSRSnapshot.objects.create(
            product=product,
            bsr=bsr,
            rating=item.get('rating'),
            price=item.get('price'),
        )

    def _auto_enroll_target(self, item):
        bsr = item.get('bsr')
        tier = self.ScrapeTier.get_tier_for_bsr(bsr) if bsr is not None else None
        if not tier:
            return
        target, created = self.ScheduledScrapeTarget.objects.get_or_create(
            asin=item['asin'],
            marketplace=item['marketplace'],
            defaults={
                'tier': tier,
                'active': True,
            },
        )
        if not created and bsr is not None:
            target.update_tier_from_bsr(bsr)

    def _update_job_progress(self):
        if not self.scrape_job:
            return
        try:
            self.scrape_job.products_scraped = (self.scrape_job.products_scraped or 0) + 1
            self.scrape_job.save(update_fields=['products_scraped'])
        except Exception:
            logger.exception("Failed to update ScrapeJob progress")

    def _extract_meta_keywords(self, spider):
        """Run MetaKeyword extraction in close_spider() for all scraped products."""
        if not self.scraped_product_pks:
            return

        try:
            from scraper_app.scrapy_app.keyword_extractor import extract_keywords

            # Determine if this is a search_page_only run
            is_search_page_only = (
                self.scrape_job
                and self.scrape_job.mode == self.ScrapeJob.Mode.SEARCH_PAGE_ONLY
            )

            products_qs = self.AmazonProduct.objects.filter(
                pk__in=self.scraped_product_pks,
            )

            # Build product data list for extractor, applying data-basis guard
            product_data = []
            eligible_products = []
            for product in products_qs:
                # Data-basis guard: skip MetaKeyword re-calc if search_page_only
                # and product already has richer data (bullets/description)
                if is_search_page_only and (product.bullet_1 or product.bullet_2 or product.description):
                    continue
                product_data.append({
                    'title': product.title,
                    'brand': product.brand,
                    'bullet_1': product.bullet_1,
                    'bullet_2': product.bullet_2,
                    'description': product.description,
                })
                eligible_products.append(product)

            if not product_data:
                return

            keyword_text = getattr(spider, 'keyword', '')
            result = extract_keywords(product_data, keyword_text)

            # Create/update MetaKeyword M2M links per product
            keyword_obj = None
            if keyword_text:
                keyword_obj = self.Keyword.objects.filter(
                    keyword=keyword_text,
                ).first()

            for i, product in enumerate(eligible_products):
                per_product = result['per_product'][i]
                meta_kw_objects = []

                for kw in per_product['short_tail']:
                    mk, _ = self.MetaKeyword.objects.get_or_create(
                        keyword=kw,
                        type=self.MetaKeyword.KeywordType.SHORT_TAIL,
                    )
                    meta_kw_objects.append(mk)

                for kw in per_product['long_tail']:
                    mk, _ = self.MetaKeyword.objects.get_or_create(
                        keyword=kw,
                        type=self.MetaKeyword.KeywordType.LONG_TAIL,
                    )
                    meta_kw_objects.append(mk)

                product.meta_keywords.set(meta_kw_objects)

                # Link MetaKeywords to search Keyword
                if keyword_obj:
                    for mk in meta_kw_objects:
                        mk.search_keywords.add(keyword_obj)

            # Update global frequency from extraction result
            for entry in result['global_top_focus']:
                self.MetaKeyword.objects.filter(
                    keyword=entry['keyword'],
                    type=self.MetaKeyword.KeywordType.SHORT_TAIL,
                ).update(frequency=entry['frequency'])

            for entry in result['global_top_long_tail']:
                self.MetaKeyword.objects.filter(
                    keyword=entry['keyword'],
                    type=self.MetaKeyword.KeywordType.LONG_TAIL,
                ).update(frequency=entry['frequency'])

            # Create SearchKeywordResult if linked to a ProductSearchCache
            if self.scrape_job:
                search_cache = self.ProductSearchCache.objects.filter(
                    scrape_job=self.scrape_job,
                ).first()
                if search_cache:
                    self.SearchKeywordResult.objects.update_or_create(
                        search_cache=search_cache,
                        defaults={
                            'top_focus_keywords': result['global_top_focus'],
                            'top_long_tail_keywords': result['global_top_long_tail'],
                            'all_keywords_flat': result['all_flat'],
                        },
                    )

            logger.info(
                "MetaKeyword extraction complete: %d products, %d focus, %d long-tail",
                len(eligible_products),
                len(result['global_top_focus']),
                len(result['global_top_long_tail']),
            )
        except Exception:
            logger.exception("Error during MetaKeyword extraction")
