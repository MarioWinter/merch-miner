import logging
import os
import signal
import subprocess
from datetime import timedelta

import django_rq
from django.conf import settings
from django.utils import timezone

from scraper_app.models import (
    AmazonProduct,
    Keyword,
    ProductSearchCache,
    ScheduledScrapeTarget,
    ScrapeJob,
    ScrapeTier,
)

logger = logging.getLogger(__name__)

SCRAPY_PROJECT_DIR = str(settings.BASE_DIR)  # /app — so Python can import scraper_app.*


def _scrapy_env():
    """Build env dict for Scrapy subprocess with PYTHONPATH set to Django root."""
    env = {**os.environ, 'SCRAPY_SETTINGS_MODULE': 'scraper_app.scrapy_app.settings'}
    # Ensure /app (Django root) is on PYTHONPATH so `import scraper_app` works
    existing = env.get('PYTHONPATH', '')
    env['PYTHONPATH'] = f"{SCRAPY_PROJECT_DIR}:{existing}" if existing else SCRAPY_PROJECT_DIR
    return env


CACHE_TTL_HOURS = 24


def get_or_create_keyword_cache(keyword_str, marketplace):
    """Check for existing pending/fresh cache. Returns (cache, is_new) or (None, False) to proceed.

    BUG-01 fix: dedup concurrent pending jobs.
    BUG-02 fix: return completed cache if <24h old.
    """
    keyword_obj, _ = Keyword.objects.get_or_create(
        keyword=keyword_str, marketplace=marketplace,
    )
    # Check for pending/running job (dedup)
    pending_cache = ProductSearchCache.objects.filter(
        keyword=keyword_obj,
        status=ProductSearchCache.Status.PENDING,
    ).select_related('scrape_job').first()
    if pending_cache:
        return pending_cache, False

    # Check for fresh completed cache (<24h)
    cutoff = timezone.now() - timedelta(hours=CACHE_TTL_HOURS)
    fresh_cache = ProductSearchCache.objects.filter(
        keyword=keyword_obj,
        status=ProductSearchCache.Status.COMPLETED,
        last_scraped_at__gte=cutoff,
    ).order_by('-last_scraped_at').first()
    if fresh_cache:
        return fresh_cache, False

    return None, True


def scrape_keyword_job(keyword_str, marketplace, scrape_job_id=None, **spider_kwargs):
    """Run AmazonSearchProductSpider via subprocess for a keyword search."""
    scrape_job = None
    if scrape_job_id:
        try:
            scrape_job = ScrapeJob.objects.get(id=scrape_job_id)
        except ScrapeJob.DoesNotExist:
            logger.error("ScrapeJob %s not found", scrape_job_id)
            return

    try:
        if scrape_job:
            scrape_job.status = ScrapeJob.Status.RUNNING
            scrape_job.started_at = timezone.now()
            scrape_job.save(update_fields=['status', 'started_at'])

        cmd = [
            'scrapy', 'crawl', 'amazon_search_product',
            '-a', f'keyword={keyword_str}',
            '-a', f'marketplace={marketplace}',
        ]
        if scrape_job_id:
            cmd.extend(['-a', f'job_id={scrape_job_id}'])
        max_items = spider_kwargs.pop('max_items', None)
        for key, value in spider_kwargs.items():
            if value is not None:
                cmd.extend(['-a', f'{key}={value}'])
        if max_items:
            cmd.extend(['-s', f'CLOSESPIDER_ITEMCOUNT={max_items}'])

        proc = subprocess.Popen(
            cmd,
            cwd=SCRAPY_PROJECT_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=_scrapy_env(),
        )

        if scrape_job:
            scrape_job.pid = proc.pid
            scrape_job.save(update_fields=['pid'])

        stdout, stderr = proc.communicate()

        # Always log subprocess output for debugging
        stdout_text = stdout.decode('utf-8', errors='replace') if stdout else ''
        stderr_text = stderr.decode('utf-8', errors='replace') if stderr else ''
        if stdout_text:
            logger.info("Scrapy stdout:\n%s", stdout_text[-2000:])
        if stderr_text:
            logger.warning("Scrapy stderr:\n%s", stderr_text[-2000:])

        if scrape_job:
            scrape_job.refresh_from_db()
            scrape_job.pid = None

            if proc.returncode == 0:
                if scrape_job.products_scraped == 0:
                    # Spider ran but scraped nothing — treat as failed
                    scrape_job.status = ScrapeJob.Status.FAILED
                    scrape_job.finished_at = timezone.now()
                    log_entry = f"Spider completed with 0 products.\nstdout (last 2000 chars):\n{stdout_text[-2000:]}\nstderr:\n{stderr_text[-2000:]}"
                    scrape_job.error_log = (
                        f"{scrape_job.error_log}\n---\n{log_entry}".strip()
                        if scrape_job.error_log else log_entry
                    )
                    scrape_job.save(update_fields=['status', 'finished_at', 'pid', 'error_log'])

                    ProductSearchCache.objects.filter(scrape_job=scrape_job).update(
                        status=ProductSearchCache.Status.FAILED,
                    )
                else:
                    if scrape_job.status != ScrapeJob.Status.COMPLETED:
                        scrape_job.status = ScrapeJob.Status.COMPLETED
                        scrape_job.finished_at = timezone.now()
                    scrape_job.save(update_fields=['status', 'finished_at', 'pid'])

                    ProductSearchCache.objects.filter(scrape_job=scrape_job).update(
                        status=ProductSearchCache.Status.COMPLETED,
                        last_scraped_at=timezone.now(),
                    )
            else:
                if stderr_text:
                    scrape_job.error_log = (
                        f"{scrape_job.error_log}\n---\n{stderr_text}".strip()
                        if scrape_job.error_log
                        else stderr_text
                    )
                scrape_job.status = ScrapeJob.Status.FAILED
                scrape_job.finished_at = timezone.now()
                scrape_job.save(update_fields=['status', 'finished_at', 'pid', 'error_log'])

                ProductSearchCache.objects.filter(scrape_job=scrape_job).update(
                    status=ProductSearchCache.Status.FAILED,
                )

        logger.info(
            "scrape_keyword_job finished job_id=%s returncode=%s",
            scrape_job_id, proc.returncode,
        )

    except Exception:
        logger.exception("Unexpected error in scrape_keyword_job scrape_job_id=%s", scrape_job_id)
        if scrape_job:
            try:
                scrape_job.refresh_from_db()
                scrape_job.status = ScrapeJob.Status.FAILED
                scrape_job.finished_at = timezone.now()
                scrape_job.pid = None
                scrape_job.save(update_fields=['status', 'finished_at', 'pid'])
                ProductSearchCache.objects.filter(scrape_job=scrape_job).update(
                    status=ProductSearchCache.Status.FAILED,
                )
            except Exception:
                logger.exception("Failed to mark ScrapeJob %s as failed", scrape_job_id)


def scrape_asin_detail_job(asin, marketplace, scrape_job_id=None):
    """Run AmazonProductSpider via subprocess for a single ASIN detail page."""
    scrape_job = None
    if scrape_job_id:
        try:
            scrape_job = ScrapeJob.objects.get(id=scrape_job_id)
        except ScrapeJob.DoesNotExist:
            logger.error("ScrapeJob %s not found", scrape_job_id)
            return

    try:
        if scrape_job:
            scrape_job.status = ScrapeJob.Status.RUNNING
            scrape_job.started_at = timezone.now()
            scrape_job.save(update_fields=['status', 'started_at'])

        cmd = [
            'scrapy', 'crawl', 'amazon_product',
            '-a', f'asin={asin}',
            '-a', f'marketplace={marketplace}',
        ]
        if scrape_job_id:
            cmd.extend(['-a', f'job_id={scrape_job_id}'])

        proc = subprocess.Popen(
            cmd,
            cwd=SCRAPY_PROJECT_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=_scrapy_env(),
        )

        if scrape_job:
            scrape_job.pid = proc.pid
            scrape_job.save(update_fields=['pid'])

        stdout, stderr = proc.communicate()

        # BUG-07 fix: log stdout/stderr symmetrically with keyword job
        stdout_text = stdout.decode('utf-8', errors='replace') if stdout else ''
        stderr_text = stderr.decode('utf-8', errors='replace') if stderr else ''
        if stdout_text:
            logger.info("Scrapy ASIN stdout:\n%s", stdout_text[-2000:])
        if stderr_text:
            logger.warning("Scrapy ASIN stderr:\n%s", stderr_text[-2000:])

        if scrape_job:
            scrape_job.refresh_from_db()
            scrape_job.pid = None

            if proc.returncode == 0:
                if scrape_job.status != ScrapeJob.Status.COMPLETED:
                    scrape_job.status = ScrapeJob.Status.COMPLETED
                    scrape_job.finished_at = timezone.now()
                scrape_job.save(update_fields=['status', 'finished_at', 'pid'])

                # Update ScheduledScrapeTarget for this ASIN
                targets = ScheduledScrapeTarget.objects.filter(
                    asin=asin, marketplace=marketplace,
                )
                for target in targets:
                    target.last_scraped_at = timezone.now()
                    # Lookup current BSR from AmazonProduct to update tier
                    try:
                        product = AmazonProduct.objects.get(
                            asin=asin, marketplace=marketplace,
                        )
                        new_tier = ScrapeTier.get_tier_for_bsr(product.bsr)
                        if new_tier and not target.tier_override and new_tier != target.tier:
                            target.tier = new_tier
                    except AmazonProduct.DoesNotExist:
                        pass
                    # save() triggers next_scrape_at recalculation via model's save()
                    target.save()
            else:
                if stderr_text:
                    scrape_job.error_log = (
                        f"{scrape_job.error_log}\n---\n{stderr_text}".strip()
                        if scrape_job.error_log
                        else stderr_text
                    )
                scrape_job.status = ScrapeJob.Status.FAILED
                scrape_job.finished_at = timezone.now()
                scrape_job.save(update_fields=['status', 'finished_at', 'pid', 'error_log'])

        logger.info(
            "scrape_asin_detail_job finished job_id=%s returncode=%s",
            scrape_job_id, proc.returncode,
        )

    except Exception:
        logger.exception("Unexpected error in scrape_asin_detail_job scrape_job_id=%s", scrape_job_id)
        if scrape_job:
            try:
                scrape_job.refresh_from_db()
                scrape_job.status = ScrapeJob.Status.FAILED
                scrape_job.finished_at = timezone.now()
                scrape_job.pid = None
                scrape_job.save(update_fields=['status', 'finished_at', 'pid'])
            except Exception:
                logger.exception("Failed to mark ScrapeJob %s as failed", scrape_job_id)


def cancel_scrape_job(scrape_job_id, cancelled_by='admin'):
    """Cancel a running or pending ScrapeJob."""
    try:
        scrape_job = ScrapeJob.objects.get(id=scrape_job_id)
    except ScrapeJob.DoesNotExist:
        logger.error("ScrapeJob %s not found for cancellation", scrape_job_id)
        return

    if scrape_job.status == ScrapeJob.Status.RUNNING and scrape_job.pid:
        try:
            os.kill(scrape_job.pid, signal.SIGTERM)
            logger.info("Sent SIGTERM to PID %s for job %s", scrape_job.pid, scrape_job_id)
        except ProcessLookupError:
            logger.info("Process %s already finished for job %s", scrape_job.pid, scrape_job_id)
        except OSError as e:
            logger.warning("Failed to kill PID %s: %s", scrape_job.pid, e)

    elif scrape_job.status == ScrapeJob.Status.PENDING and scrape_job.rq_job_id:
        try:
            queue = django_rq.get_queue('scraper')
            queue.remove(scrape_job.rq_job_id)
            logger.info("Removed pending RQ job %s", scrape_job.rq_job_id)
        except Exception:
            logger.warning("Failed to remove RQ job %s from queue", scrape_job.rq_job_id)

    scrape_job.status = ScrapeJob.Status.CANCELLED
    scrape_job.cancelled_by = cancelled_by
    scrape_job.pid = None
    scrape_job.finished_at = timezone.now()
    scrape_job.save(update_fields=['status', 'cancelled_by', 'pid', 'finished_at'])

    # If linked to ProductSearchCache, mark as failed
    ProductSearchCache.objects.filter(scrape_job=scrape_job).update(
        status=ProductSearchCache.Status.FAILED,
    )

    logger.info("ScrapeJob %s cancelled by %s", scrape_job_id, cancelled_by)


def schedule_scrape_runner():
    """Hourly runner: find due ScheduledScrapeTargets and enqueue scrape jobs."""
    now = timezone.now()
    due_targets = ScheduledScrapeTarget.objects.filter(
        next_scrape_at__lte=now,
        active=True,
    ).select_related('keyword', 'tier')

    enqueued = 0
    queue = django_rq.get_queue('scraper')

    for target in due_targets:
        try:
            if target.keyword:
                scrape_job = ScrapeJob.objects.create(
                    mode=ScrapeJob.Mode.SCHEDULED,
                    keyword=target.keyword,
                    marketplace=target.marketplace,
                    status=ScrapeJob.Status.PENDING,
                )
                rq_job = queue.enqueue(
                    scrape_keyword_job,
                    keyword_str=target.keyword.keyword,
                    marketplace=target.marketplace,
                    scrape_job_id=str(scrape_job.id),
                    max_pages=scrape_job.pages_total,
                )
                scrape_job.rq_job_id = rq_job.id
                scrape_job.save(update_fields=['rq_job_id'])
                enqueued += 1

            elif target.asin:
                scrape_job = ScrapeJob.objects.create(
                    mode=ScrapeJob.Mode.SCHEDULED,
                    asin=target.asin,
                    marketplace=target.marketplace,
                    status=ScrapeJob.Status.PENDING,
                )
                rq_job = queue.enqueue(
                    scrape_asin_detail_job,
                    asin=target.asin,
                    marketplace=target.marketplace,
                    scrape_job_id=str(scrape_job.id),
                )
                scrape_job.rq_job_id = rq_job.id
                scrape_job.save(update_fields=['rq_job_id'])
                enqueued += 1

        except Exception:
            logger.exception(
                "Failed to enqueue scheduled job for target %s", target.id,
            )

    logger.info("schedule_scrape_runner enqueued %d jobs", enqueued)
    return enqueued
