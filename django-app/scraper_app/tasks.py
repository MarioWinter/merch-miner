import logging
import os
import signal
# subprocess: only used with cmd lists (no shell=True), args from DB models
import subprocess  # nosec B404
from datetime import timedelta
from pathlib import Path

import django_rq
from django.conf import settings
from django.utils import timezone

from scraper_app.models import (
    PRODUCT_TYPE_SPIDER_KWARGS,
    AmazonProduct,
    CanaryAsin,
    Keyword,
    ProductSearchCache,
    ScheduledScrapeTarget,
    ScrapeJob,
    ScrapeTier,
    SelectorHealthCheck,
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


def get_or_create_keyword_cache(
    keyword_str, marketplace,
    sort_by='', price_min=None, price_max=None, browse_node='',
    product_type_filter='',
):
    """Check for existing pending/fresh cache. Returns (cache, is_new) or (None, False) to proceed.

    BUG-01 fix: dedup concurrent pending jobs.
    BUG-02 fix: return completed cache if <24h old.
    Cache key includes sort_by, price_min, price_max, browse_node — different combos = separate cache.
    """
    keyword_obj, _ = Keyword.objects.get_or_create(
        keyword=keyword_str, marketplace=marketplace,
    )
    filter_kwargs = dict(
        keyword=keyword_obj,
        sort_by=sort_by,
        price_min=price_min,
        price_max=price_max,
        browse_node=browse_node,
        product_type_filter=product_type_filter,
    )
    # Check for pending/running job (dedup)
    pending_cache = ProductSearchCache.objects.filter(
        **filter_kwargs,
        status=ProductSearchCache.Status.PENDING,
    ).select_related('scrape_job').first()
    if pending_cache:
        return pending_cache, False

    # Check for fresh completed cache (<24h)
    cutoff = timezone.now() - timedelta(hours=CACHE_TTL_HOURS)
    fresh_cache = ProductSearchCache.objects.filter(
        **filter_kwargs,
        status=ProductSearchCache.Status.COMPLETED,
        last_scraped_at__gte=cutoff,
    ).order_by('-last_scraped_at').first()
    if fresh_cache:
        return fresh_cache, False

    return None, True


def scrape_keyword_job(
    keyword_str, marketplace, scrape_job_id=None,
    sort_by='', price_min=None, price_max=None, browse_node='',
    start_page=1,
    **spider_kwargs,
):
    """Run AmazonSearchProductSpider via subprocess for a keyword search."""
    scrape_job = None
    if scrape_job_id:
        try:
            scrape_job = ScrapeJob.objects.get(id=scrape_job_id)
        except ScrapeJob.DoesNotExist:
            logger.error("ScrapeJob %s not found", scrape_job_id)
            return

    # Auto-populate browse_node from product_type if not explicitly set
    if not browse_node:
        product_type_filter = spider_kwargs.get('product_type_filter', '')
        if product_type_filter and product_type_filter in PRODUCT_TYPE_SPIDER_KWARGS:
            browse_node = PRODUCT_TYPE_SPIDER_KWARGS[product_type_filter].get('browse_node', '')

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
        # Append filter params as spider args (only when set)
        if sort_by:
            cmd.extend(['-a', f'sort_by={sort_by}'])
        if price_min is not None:
            cmd.extend(['-a', f'price_min={price_min}'])
        if price_max is not None:
            cmd.extend(['-a', f'price_max={price_max}'])
        if browse_node:
            cmd.extend(['-a', f'browse_node={browse_node}'])
        if start_page and int(start_page) > 1:
            cmd.extend(['-a', f'start_page={start_page}'])
        max_items = spider_kwargs.pop('max_items', None)
        for key, value in spider_kwargs.items():
            if value is not None:
                cmd.extend(['-a', f'{key}={value}'])
        if max_items:
            cmd.extend(['-s', f'CLOSESPIDER_ITEMCOUNT={max_items}'])

        # cmd is a list (no shell=True); args are validated spider names + numeric job ids
        proc = subprocess.Popen(  # nosec B603
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


def scrape_search_page_job(
    keyword_str, marketplace, scrape_job_id=None,
    sort_by='', price_min=None, price_max=None, browse_node='',
    start_page=1,
    **spider_kwargs,
):
    """Run AmazonSearchPageSpider via subprocess for search-page-only scraping."""
    scrape_job = None
    if scrape_job_id:
        try:
            scrape_job = ScrapeJob.objects.get(id=scrape_job_id)
        except ScrapeJob.DoesNotExist:
            logger.error("ScrapeJob %s not found", scrape_job_id)
            return

    # Auto-populate browse_node from product_type if not explicitly set
    if not browse_node:
        product_type_filter = spider_kwargs.get('product_type_filter', '')
        if product_type_filter and product_type_filter in PRODUCT_TYPE_SPIDER_KWARGS:
            browse_node = PRODUCT_TYPE_SPIDER_KWARGS[product_type_filter].get('browse_node', '')

    try:
        if scrape_job:
            scrape_job.status = ScrapeJob.Status.RUNNING
            scrape_job.started_at = timezone.now()
            scrape_job.save(update_fields=['status', 'started_at'])

        cmd = [
            'scrapy', 'crawl', 'amazon_search_page',
            '-a', f'keyword={keyword_str}',
            '-a', f'marketplace={marketplace}',
        ]
        if scrape_job_id:
            cmd.extend(['-a', f'job_id={scrape_job_id}'])
        # Append filter params as spider args (only when set)
        if sort_by:
            cmd.extend(['-a', f'sort_by={sort_by}'])
        if price_min is not None:
            cmd.extend(['-a', f'price_min={price_min}'])
        if price_max is not None:
            cmd.extend(['-a', f'price_max={price_max}'])
        if browse_node:
            cmd.extend(['-a', f'browse_node={browse_node}'])
        if start_page and int(start_page) > 1:
            cmd.extend(['-a', f'start_page={start_page}'])
        max_items = spider_kwargs.pop('max_items', None)
        for key, value in spider_kwargs.items():
            if value is not None:
                cmd.extend(['-a', f'{key}={value}'])
        if max_items:
            cmd.extend(['-s', f'CLOSESPIDER_ITEMCOUNT={max_items}'])

        # cmd is a list (no shell=True); args are validated spider names + numeric job ids
        proc = subprocess.Popen(  # nosec B603
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

        stdout_text = stdout.decode('utf-8', errors='replace') if stdout else ''
        stderr_text = stderr.decode('utf-8', errors='replace') if stderr else ''
        if stdout_text:
            logger.info("Scrapy search_page stdout:\n%s", stdout_text[-2000:])
        if stderr_text:
            logger.warning("Scrapy search_page stderr:\n%s", stderr_text[-2000:])

        if scrape_job:
            scrape_job.refresh_from_db()
            scrape_job.pid = None

            if proc.returncode == 0:
                if scrape_job.products_scraped == 0:
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
            "scrape_search_page_job finished job_id=%s returncode=%s",
            scrape_job_id, proc.returncode,
        )

    except Exception:
        logger.exception("Unexpected error in scrape_search_page_job scrape_job_id=%s", scrape_job_id)
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

        # cmd is a list (no shell=True); args are validated spider names + numeric job ids
        proc = subprocess.Popen(  # nosec B603
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

    # If linked to ProductSearchCache, mark as cancelled
    ProductSearchCache.objects.filter(scrape_job=scrape_job).update(
        status=ProductSearchCache.Status.CANCELLED,
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


# ---------------------------------------------------------------------------
# PROJ-23: Selector Health Check
# ---------------------------------------------------------------------------

DEFAULT_HEALTH_CHECK_RETENTION = 12


def _prune_snapshots(asin: str, marketplace: str, keep: int = DEFAULT_HEALTH_CHECK_RETENTION):
    """Keep newest `keep` snapshot files for (asin, marketplace); delete the rest.

    Wrapped in try/except so retention failures NEVER cascade into the
    health-check job result (AC-9 from edge-cases section).
    Sets `html_path=NULL` on SelectorHealthCheck rows whose snapshot was pruned.
    """
    try:
        snapshot_dir = Path(settings.MEDIA_ROOT) / 'snapshots' / marketplace
        if not snapshot_dir.exists():
            return 0

        # Match files for this specific ASIN only (other ASINs share the dir).
        files = sorted(
            snapshot_dir.glob(f"{asin}_*.html"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,  # newest first
        )

        if len(files) <= keep:
            return 0

        to_delete = files[keep:]
        deleted_relative_paths = []
        for path in to_delete:
            try:
                relative = str(path.relative_to(settings.MEDIA_ROOT))
                path.unlink()
                deleted_relative_paths.append(relative)
            except OSError as exc:
                logger.warning(
                    "Snapshot retention: failed to delete %s: %s", path, exc,
                )

        if deleted_relative_paths:
            updated = SelectorHealthCheck.objects.filter(
                html_path__in=deleted_relative_paths,
            ).update(html_path=None)
            logger.info(
                "Pruned %d snapshots for %s/%s (rows updated: %d)",
                len(deleted_relative_paths), marketplace, asin, updated,
            )
            return len(deleted_relative_paths)
        return 0

    except Exception:
        logger.warning(
            "Snapshot retention failed for %s/%s — continuing.",
            marketplace, asin, exc_info=True,
        )
        return 0


def run_selector_health_check(canary_id, triggered_by='schedule'):
    """Run a selector health-check for one CanaryAsin.

    1. Create SelectorHealthCheck row up-front (passed=False placeholder).
    2. Spawn `amazon_html_snapshot` spider (subprocess, same pattern as production
       scrapers) — it writes the raw HTML and updates the row with html_path/size
       OR error_message.
    3. After spider exits: re-fetch the row; if snapshot present, run audit and
       persist `results` + `passed`.
    4. Prune old snapshots (best-effort, non-fatal).
    """
    try:
        canary = CanaryAsin.objects.get(id=canary_id)
    except CanaryAsin.DoesNotExist:
        logger.error("CanaryAsin %s not found — skipping health check.", canary_id)
        return None

    health_check = SelectorHealthCheck.objects.create(
        canary=canary,
        triggered_by=triggered_by,
        passed=False,
        results={},
    )

    cmd = [
        'scrapy', 'crawl', 'amazon_html_snapshot',
        '-a', f'asin={canary.asin}',
        '-a', f'marketplace={canary.marketplace}',
        '-a', f'health_check_id={health_check.id}',
    ]

    try:
        # cmd is a list (no shell=True); args are validated spider names + numeric job ids
        proc = subprocess.Popen(  # nosec B603
            cmd,
            cwd=SCRAPY_PROJECT_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=_scrapy_env(),
        )
        stdout, stderr = proc.communicate()

        stdout_text = stdout.decode('utf-8', errors='replace') if stdout else ''
        stderr_text = stderr.decode('utf-8', errors='replace') if stderr else ''
        if stdout_text:
            logger.info("Snapshot spider stdout:\n%s", stdout_text[-2000:])
        if stderr_text:
            logger.info("Snapshot spider stderr:\n%s", stderr_text[-2000:])

        # Re-fetch — spider has updated either html_path/html_size_bytes OR error_message.
        health_check.refresh_from_db()

        if not health_check.html_path:
            # No snapshot saved → spider failed (HTTP error, network, write error).
            if not health_check.error_message:
                # Fallback: if the spider neither wrote a path nor reported an
                # error_message (e.g. process crash), capture stderr tail so the
                # admin sees something actionable (AC-19).
                health_check.error_message = (
                    stderr_text[-500:] if stderr_text else
                    f"Spider exited rc={proc.returncode} with no snapshot."
                )
            health_check.passed = False
            health_check.save(update_fields=['passed', 'error_message'])
            logger.warning(
                "Health check FAILED for canary=%s (label=%s): %s",
                canary.asin, canary.label or '-', health_check.error_message,
            )
            return health_check

        # Sorry/Dogs-of-Amazon page check BEFORE selector audit. A canary that
        # points to a deleted product would otherwise trigger a false-positive
        # "selector drift" alarm (every selector returns EMPTY on the error page).
        # Mark the row as failed but with an actionable error message so the
        # operator replaces the canary instead of chasing nonexistent drift.
        try:
            absolute_path = Path(settings.MEDIA_ROOT) / health_check.html_path
            html = absolute_path.read_text(encoding='utf-8', errors='replace')
        except Exception as exc:
            logger.exception("Snapshot read failed for health_check=%s", health_check.id)
            health_check.error_message = f"Snapshot read error: {exc}"
            health_check.passed = False
            health_check.save(update_fields=['passed', 'error_message'])
            return health_check

        if '/dogsofamazon' in html:
            health_check.error_message = (
                f"Canary product unavailable on Amazon (Sorry-page). "
                f"Replace canary ASIN {canary.asin} ({canary.label or '-'})."
            )
            health_check.passed = False
            health_check.save(update_fields=['passed', 'error_message'])
            logger.warning(
                "Health check SKIPPED — canary %s is a deleted product. %s",
                canary.asin, health_check.error_message,
            )
            return health_check

        # We have a snapshot — run the audit.
        try:
            from scraper_app.audit import run_audit
            results = run_audit(html, canary.marketplace)
        except Exception as exc:
            logger.exception("Audit failed for health_check=%s", health_check.id)
            health_check.error_message = f"Audit error: {exc}"
            health_check.passed = False
            health_check.save(update_fields=['passed', 'error_message'])
            return health_check

        # `passed` iff zero EMPTY entries. INFO does NOT flip the flag.
        passed = not any(v == 'EMPTY' for v in results.values())
        health_check.results = results
        health_check.passed = passed
        health_check.save(update_fields=['results', 'passed'])

        if not passed:
            failed_fields = [k for k, v in results.items() if v == 'EMPTY']
            logger.warning(
                "Health check FAILED for canary=%s (label=%s): empty fields=%s",
                canary.asin, canary.label or '-', failed_fields,
            )
        else:
            logger.info(
                "Health check PASSED for canary=%s (label=%s)",
                canary.asin, canary.label or '-',
            )

    except Exception as exc:
        logger.exception("Unexpected error in run_selector_health_check id=%s", canary_id)
        health_check.error_message = f"Task error: {exc}"
        health_check.passed = False
        health_check.save(update_fields=['passed', 'error_message'])

    # Retention runs inline, best-effort.
    retention = getattr(
        settings, 'SELECTOR_HEALTH_CHECK_RETENTION', DEFAULT_HEALTH_CHECK_RETENTION,
    )
    _prune_snapshots(canary.asin, canary.marketplace, keep=retention)

    return health_check


def schedule_health_check_runner():
    """Cron-tick: enqueue one health-check job per active CanaryAsin.

    Mirrors `schedule_scrape_runner` — run by rq-scheduler on the configured cron.
    Uses the `scraper` queue so health checks share the rate-limit budget with
    production scrapes (visible in the same monitoring).
    """
    queue = django_rq.get_queue('scraper')
    enqueued = 0
    for canary in CanaryAsin.objects.filter(active=True):
        try:
            queue.enqueue(
                run_selector_health_check,
                canary_id=str(canary.id),
                triggered_by='schedule',
            )
            enqueued += 1
        except Exception:
            logger.exception(
                "Failed to enqueue health check for canary %s", canary.id,
            )
    logger.info("schedule_health_check_runner enqueued %d jobs", enqueued)
    return enqueued
