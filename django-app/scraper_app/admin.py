import csv
import io
import os
import re

from django import forms
from django.contrib import admin, messages
from django.http import HttpResponseRedirect
from django.template.response import TemplateResponse
from django.urls import path, reverse
from django.utils import timezone

from scraper_app.models import (
    AmazonProduct,
    BSRSnapshot,
    Keyword,
    MarketplaceChoices,
    ProductSearchCache,
    ScrapeJob,
    ScrapeTier,
    ScheduledScrapeTarget,
)


def _tier_from_bsr_or_fallback(asin=None, marketplace=None):
    """Lookup tier from existing product BSR, fallback to Tier 3."""
    if asin and marketplace:
        try:
            product = AmazonProduct.objects.get(asin=asin, marketplace=marketplace)
            if product.bsr is not None:
                tier = ScrapeTier.get_tier_for_bsr(product.bsr)
                if tier:
                    return tier
        except AmazonProduct.DoesNotExist:
            pass
    return ScrapeTier.objects.order_by('-bsr_min').first()


# ---------------------------------------------------------------------------
# CSV Upload Form
# ---------------------------------------------------------------------------

class CsvUploadForm(forms.Form):
    csv_file = forms.FileField(label='CSV File')


# ---------------------------------------------------------------------------
# ScrapeJob Admin (Task 5.1)
# ---------------------------------------------------------------------------

@admin.register(ScrapeJob)
class ScrapeJobAdmin(admin.ModelAdmin):
    list_display = [
        'get_target', 'marketplace', 'mode', 'product_type_filter', 'status',
        'pages_total', 'max_items', 'get_progress', 'products_scraped', 'get_error_count',
        'started_at', 'finished_at',
    ]
    list_filter = ['status', 'mode', 'marketplace', 'product_type_filter']
    readonly_fields = [
        'id', 'rq_job_id', 'pid', 'error_log', 'cancelled_by',
        'started_at', 'finished_at', 'pages_done', 'products_scraped',
    ]
    actions = ['start_pending_jobs', 'stop_running_jobs', 'cancel_pending_jobs', 'retry_failed_jobs']

    def get_target(self, obj):
        return str(obj.keyword) if obj.keyword else obj.asin or '-'
    get_target.short_description = 'Target'

    def get_progress(self, obj):
        return f"{obj.pages_done or 0}/{obj.pages_total or 0}"
    get_progress.short_description = 'Pages'

    def get_error_count(self, obj):
        return obj.error_count
    get_error_count.short_description = 'Errors'

    @admin.action(description='Start selected pending jobs')
    def start_pending_jobs(self, request, queryset):
        import django_rq
        from scraper_app.models import PRODUCT_TYPE_SPIDER_KWARGS
        from scraper_app.tasks import scrape_asin_detail_job, scrape_keyword_job

        pending = queryset.filter(status=ScrapeJob.Status.PENDING)
        count = 0
        queue = django_rq.get_queue('scraper')
        for job in pending:
            if job.keyword:
                spider_kwargs = {}
                if job.product_type_filter and job.product_type_filter in PRODUCT_TYPE_SPIDER_KWARGS:
                    spider_kwargs = PRODUCT_TYPE_SPIDER_KWARGS[job.product_type_filter].copy()
                spider_kwargs['max_pages'] = job.pages_total
                if job.max_items:
                    spider_kwargs['max_items'] = job.max_items
                rq_job = queue.enqueue(
                    scrape_keyword_job,
                    keyword_str=job.keyword.keyword,
                    marketplace=job.marketplace,
                    scrape_job_id=str(job.id),
                    **spider_kwargs,
                )
            elif job.asin:
                rq_job = queue.enqueue(
                    scrape_asin_detail_job,
                    asin=job.asin,
                    marketplace=job.marketplace,
                    scrape_job_id=str(job.id),
                )
            else:
                self.message_user(
                    request,
                    f"Job {job.id} has no keyword or ASIN — skipped.",
                    messages.WARNING,
                )
                continue
            job.rq_job_id = rq_job.id
            job.save(update_fields=['rq_job_id'])
            count += 1
        self.message_user(request, f"Started {count} jobs.", messages.SUCCESS)

    @admin.action(description='Stop selected running jobs')
    def stop_running_jobs(self, request, queryset):
        from scraper_app.tasks import cancel_scrape_job

        running = queryset.filter(status=ScrapeJob.Status.RUNNING)
        count = 0
        for job in running:
            cancel_scrape_job(job.id, 'admin')
            count += 1
        self.message_user(request, f"Stopped {count} jobs.", messages.SUCCESS)

    @admin.action(description='Cancel selected pending jobs')
    def cancel_pending_jobs(self, request, queryset):
        from scraper_app.tasks import cancel_scrape_job

        pending = queryset.filter(status=ScrapeJob.Status.PENDING)
        count = 0
        for job in pending:
            cancel_scrape_job(job.id, 'admin')
            count += 1
        self.message_user(request, f"Cancelled {count} jobs.", messages.SUCCESS)

    @admin.action(description='Retry selected failed jobs')
    def retry_failed_jobs(self, request, queryset):
        import django_rq
        from scraper_app.models import PRODUCT_TYPE_SPIDER_KWARGS
        from scraper_app.tasks import scrape_asin_detail_job, scrape_keyword_job

        failed = queryset.filter(status=ScrapeJob.Status.FAILED)
        count = 0
        queue = django_rq.get_queue('scraper')
        for job in failed:
            new_job = ScrapeJob.objects.create(
                mode=job.mode,
                keyword=job.keyword,
                asin=job.asin,
                marketplace=job.marketplace,
                status=ScrapeJob.Status.PENDING,
                pages_total=job.pages_total,
                max_items=job.max_items,
                product_type_filter=job.product_type_filter,
            )
            if job.keyword:
                spider_kwargs = {}
                if job.product_type_filter and job.product_type_filter in PRODUCT_TYPE_SPIDER_KWARGS:
                    spider_kwargs = PRODUCT_TYPE_SPIDER_KWARGS[job.product_type_filter].copy()
                spider_kwargs['max_pages'] = job.pages_total
                if job.max_items:
                    spider_kwargs['max_items'] = job.max_items
                rq_job = queue.enqueue(
                    scrape_keyword_job,
                    keyword_str=job.keyword.keyword,
                    marketplace=job.marketplace,
                    scrape_job_id=str(new_job.id),
                    **spider_kwargs,
                )
            elif job.asin:
                rq_job = queue.enqueue(
                    scrape_asin_detail_job,
                    asin=job.asin,
                    marketplace=job.marketplace,
                    scrape_job_id=str(new_job.id),
                )
            else:
                new_job.delete()
                continue
            new_job.rq_job_id = rq_job.id
            new_job.save(update_fields=['rq_job_id'])
            count += 1
        self.message_user(request, f"Retried {count} jobs.", messages.SUCCESS)


# ---------------------------------------------------------------------------
# ScrapeTier Admin (Task 5.2)
# ---------------------------------------------------------------------------

@admin.register(ScrapeTier)
class ScrapeTierAdmin(admin.ModelAdmin):
    list_display = ['name', 'bsr_min', 'bsr_max', 'interval_days']
    list_editable = ['bsr_min', 'bsr_max', 'interval_days']


# ---------------------------------------------------------------------------
# ScheduledScrapeTarget Admin (Task 5.3)
# ---------------------------------------------------------------------------

VALID_MARKETPLACES = {c.value for c in MarketplaceChoices}
ASIN_PATTERN = re.compile(r'^[A-Z0-9]{10}$')


@admin.register(ScheduledScrapeTarget)
class ScheduledScrapeTargetAdmin(admin.ModelAdmin):
    list_display = [
        'get_target', 'marketplace', 'tier', 'last_scraped_at',
        'next_scrape_at', 'active',
    ]
    list_filter = ['marketplace', 'tier', 'active']
    list_editable = ['active']
    actions = ['upload_asin_csv', 'upload_keyword_csv']

    def get_target(self, obj):
        return str(obj.keyword) if obj.keyword else obj.asin or '-'
    get_target.short_description = 'Target'

    def get_urls(self):
        custom_urls = [
            path(
                'upload-csv/<str:csv_type>/',
                self.admin_site.admin_view(self.csv_upload_view),
                name='scraper_app_scheduledscrapetarget_csv_upload',
            ),
        ]
        return custom_urls + super().get_urls()

    # -- CSV upload actions --------------------------------------------------

    @admin.action(description='Upload ASIN CSV')
    def upload_asin_csv(self, request, queryset):
        return HttpResponseRedirect(
            reverse('admin:scraper_app_scheduledscrapetarget_csv_upload', args=['asin'])
        )

    @admin.action(description='Upload Keyword CSV')
    def upload_keyword_csv(self, request, queryset):
        return HttpResponseRedirect(
            reverse('admin:scraper_app_scheduledscrapetarget_csv_upload', args=['keyword'])
        )

    def csv_upload_view(self, request, csv_type):
        if csv_type not in ('asin', 'keyword'):
            self.message_user(request, "Invalid CSV type.", messages.ERROR)
            return HttpResponseRedirect(
                reverse('admin:scraper_app_scheduledscrapetarget_changelist')
            )

        if request.method == 'POST':
            form = CsvUploadForm(request.POST, request.FILES)
            if form.is_valid():
                csv_file = request.FILES['csv_file']
                try:
                    decoded = csv_file.read().decode('utf-8')
                except UnicodeDecodeError:
                    self.message_user(request, "File is not valid UTF-8.", messages.ERROR)
                    return HttpResponseRedirect(
                        reverse('admin:scraper_app_scheduledscrapetarget_changelist')
                    )

                reader = csv.DictReader(io.StringIO(decoded))
                headers = set(reader.fieldnames or [])

                if csv_type == 'asin':
                    count, errors = self._process_asin_csv(reader, headers)
                else:
                    count, errors = self._process_keyword_csv(reader, headers)

                if errors:
                    self.message_user(
                        request,
                        f"Created/updated {count} targets. Errors: {'; '.join(errors)}",
                        messages.WARNING,
                    )
                else:
                    self.message_user(
                        request,
                        f"Created/updated {count} targets.",
                        messages.SUCCESS,
                    )
                return HttpResponseRedirect(
                    reverse('admin:scraper_app_scheduledscrapetarget_changelist')
                )
        else:
            form = CsvUploadForm()

        title = f"Upload {'ASIN' if csv_type == 'asin' else 'Keyword'} CSV"
        context = {
            **self.admin_site.each_context(request),
            'title': title,
            'form': form,
            'opts': self.model._meta,
        }
        return TemplateResponse(
            request, 'admin/scraper_app/csv_upload.html', context,
        )

    # -- CSV processors ------------------------------------------------------

    def _process_asin_csv(self, reader, headers):
        required = {'asin', 'marketplace'}
        if not required.issubset(headers):
            return 0, [f"Missing columns: {required - headers}"]

        count = 0
        errors = []
        for i, row in enumerate(reader, start=2):
            asin = (row.get('asin') or '').strip().upper()
            marketplace = (row.get('marketplace') or '').strip()
            tier_name = (row.get('tier') or '').strip()

            if not ASIN_PATTERN.match(asin):
                errors.append(f"Row {i}: invalid ASIN '{asin}'")
                continue
            if marketplace not in VALID_MARKETPLACES:
                errors.append(f"Row {i}: invalid marketplace '{marketplace}'")
                continue

            tier = None
            tier_from_csv = False
            if tier_name:
                try:
                    tier = ScrapeTier.objects.get(name=tier_name)
                    tier_from_csv = True
                except ScrapeTier.DoesNotExist:
                    errors.append(f"Row {i}: unknown tier '{tier_name}'")
                    continue
            else:
                tier = _tier_from_bsr_or_fallback(asin=asin, marketplace=marketplace)

            ScheduledScrapeTarget.objects.update_or_create(
                asin=asin,
                marketplace=marketplace,
                defaults={
                    'tier': tier,
                    'tier_override': tier_from_csv,
                    'active': True,
                },
            )
            count += 1
        return count, errors

    def _process_keyword_csv(self, reader, headers):
        required = {'keyword', 'marketplace'}
        if not required.issubset(headers):
            return 0, [f"Missing columns: {required - headers}"]

        count = 0
        errors = []
        for i, row in enumerate(reader, start=2):
            kw = (row.get('keyword') or '').strip()
            marketplace = (row.get('marketplace') or '').strip()
            tier_name = (row.get('tier') or '').strip()

            if not kw:
                errors.append(f"Row {i}: empty keyword")
                continue
            if marketplace not in VALID_MARKETPLACES:
                errors.append(f"Row {i}: invalid marketplace '{marketplace}'")
                continue

            tier = None
            tier_from_csv = False
            if tier_name:
                try:
                    tier = ScrapeTier.objects.get(name=tier_name)
                    tier_from_csv = True
                except ScrapeTier.DoesNotExist:
                    errors.append(f"Row {i}: unknown tier '{tier_name}'")
                    continue
            else:
                # Keywords have no ASIN for BSR lookup; fallback to Tier 3
                tier = ScrapeTier.objects.order_by('-bsr_min').first()

            keyword_obj, _ = Keyword.objects.get_or_create(
                keyword=kw, marketplace=marketplace,
            )
            ScheduledScrapeTarget.objects.update_or_create(
                keyword=keyword_obj,
                marketplace=marketplace,
                defaults={
                    'tier': tier,
                    'tier_override': tier_from_csv,
                    'active': True,
                },
            )
            count += 1
        return count, errors


# ---------------------------------------------------------------------------
# AmazonProduct Admin
# ---------------------------------------------------------------------------

@admin.register(AmazonProduct)
class AmazonProductAdmin(admin.ModelAdmin):
    list_display = ['asin', 'marketplace', 'title', 'bsr', 'price', 'rating', 'scraped_at']
    list_filter = ['marketplace', 'product_type']
    search_fields = ['asin', 'title', 'brand', 'bullet_1', 'bullet_2']
    readonly_fields = ['id']
    fieldsets = (
        (None, {
            'fields': (
                'id', 'asin', 'marketplace', 'title', 'brand', 'product_type',
                'bsr', 'bsr_categories', 'category', 'subcategory',
                'price', 'rating', 'reviews_count', 'listed_date',
            ),
        }),
        ('Bullets & Description', {
            'fields': ('bullet_1', 'bullet_2', 'description'),
        }),
        ('Media & Links', {
            'fields': ('thumbnail_url', 'product_url', 'image_gallery'),
        }),
        ('Other', {
            'fields': ('seller_name', 'variants', 'scraped_at'),
        }),
    )


# ---------------------------------------------------------------------------
# BSRSnapshot Admin
# ---------------------------------------------------------------------------

@admin.register(BSRSnapshot)
class BSRSnapshotAdmin(admin.ModelAdmin):
    list_display = ['product', 'bsr', 'rating', 'price', 'recorded_at']
    list_filter = ['recorded_at']
    readonly_fields = ['id']


# ---------------------------------------------------------------------------
# Keyword Admin
# ---------------------------------------------------------------------------

@admin.register(Keyword)
class KeywordAdmin(admin.ModelAdmin):
    list_display = ['keyword', 'marketplace']
    list_filter = ['marketplace']
    search_fields = ['keyword']


# ---------------------------------------------------------------------------
# ProductSearchCache Admin
# ---------------------------------------------------------------------------

@admin.register(ProductSearchCache)
class ProductSearchCacheAdmin(admin.ModelAdmin):
    list_display = ['keyword', 'status', 'last_scraped_at']
    list_filter = ['status']


# ---------------------------------------------------------------------------
# Queue Health Custom Admin View (Task 5.4)
# ---------------------------------------------------------------------------

def get_queue_health(request):
    """Custom admin view for scraper queue health."""
    today = timezone.now().date()

    pending_count = ScrapeJob.objects.filter(status=ScrapeJob.Status.PENDING).count()
    running_count = ScrapeJob.objects.filter(status=ScrapeJob.Status.RUNNING).count()
    completed_today = ScrapeJob.objects.filter(
        status=ScrapeJob.Status.COMPLETED,
        finished_at__date=today,
    ).count()
    failed_today = ScrapeJob.objects.filter(
        status=ScrapeJob.Status.FAILED,
        finished_at__date=today,
    ).count()
    active_targets = ScheduledScrapeTarget.objects.filter(active=True).count()

    if request.method == 'POST' and 'stop_all' in request.POST:
        from scraper_app.tasks import cancel_scrape_job

        stoppable = ScrapeJob.objects.filter(
            status__in=[ScrapeJob.Status.RUNNING, ScrapeJob.Status.PENDING],
        )
        count = 0
        for job in stoppable:
            cancel_scrape_job(job.id, 'admin')
            count += 1
        messages.success(request, f"Stopped {count} jobs.")
        return HttpResponseRedirect(reverse('admin:scraper_queue_health'))

    context = {
        **admin.site.each_context(request),
        'title': 'Scraper Queue Health',
        'pending_count': pending_count,
        'running_count': running_count,
        'completed_today': completed_today,
        'failed_today': failed_today,
        'active_targets': active_targets,
        'scrapeops_configured': bool(os.environ.get('SCRAPEOPS_API_KEY')),
    }
    return TemplateResponse(request, 'admin/scraper_app/queue_health.html', context)


def stop_all_jobs(request):
    """Stop all running + pending scrape jobs."""
    from scraper_app.tasks import cancel_scrape_job

    stoppable = ScrapeJob.objects.filter(
        status__in=[ScrapeJob.Status.RUNNING, ScrapeJob.Status.PENDING],
    )
    count = 0
    for job in stoppable:
        cancel_scrape_job(job.id, 'admin')
        count += 1
    messages.success(request, f"Stopped {count} jobs.")
    return HttpResponseRedirect(reverse('admin:scraper_queue_health'))


# Register custom admin URLs
_original_get_urls = admin.AdminSite.get_urls


def _custom_get_urls(self):
    custom_urls = [
        path(
            'scraper/queue-health/',
            self.admin_view(get_queue_health),
            name='scraper_queue_health',
        ),
        path(
            'scraper/stop-all/',
            self.admin_view(stop_all_jobs),
            name='scraper_stop_all',
        ),
    ]
    return custom_urls + _original_get_urls(self)


admin.AdminSite.get_urls = _custom_get_urls
