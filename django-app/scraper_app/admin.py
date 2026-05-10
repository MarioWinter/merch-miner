import os

from django import forms
from django.conf import settings
from django.contrib import admin, messages
from django.db import models
from django.http import HttpResponseRedirect
from django.template.response import TemplateResponse
from django.urls import path, reverse
from django.utils import timezone
from django.utils.html import format_html

from scraper_app.models import (
    AmazonProduct,
    BrandBlacklist,
    BSRSnapshot,
    BulkScrapeBatch,
    CanaryAsin,
    Keyword,
    MarketplaceChoices,
    MetaKeyword,
    ProductSearchCache,
    ScraperConfig,
    SearchKeywordResult,
    ScrapeJob,
    ScrapeTier,
    ScheduledScrapeTarget,
    SelectorHealthCheck,
)
from scraper_app.parsers import ASIN_PATTERN, _parse_uploaded_file


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
# CSV / XLSX Upload Form + Parser
# ---------------------------------------------------------------------------

class CsvUploadForm(forms.Form):
    csv_file = forms.FileField(
        label='CSV or Excel File',
        widget=forms.ClearableFileInput(attrs={'accept': '.csv,.xlsx'}),
    )


# ---------------------------------------------------------------------------
# ScrapeJob Admin (Task 5.1)
# ---------------------------------------------------------------------------

@admin.register(ScrapeJob)
class ScrapeJobAdmin(admin.ModelAdmin):
    list_display = [
        'get_target', 'marketplace', 'mode', 'product_type_filter', 'status',
        'get_sort_by', 'browse_node',
        'pages_total', 'start_page', 'max_items', 'get_progress', 'products_scraped', 'get_error_count',
        'started_at', 'finished_at',
    ]
    list_filter = ['status', 'mode', 'marketplace', 'product_type_filter', 'sort_by']
    readonly_fields = [
        'id', 'rq_job_id', 'pid', 'error_log', 'cancelled_by',
        'started_at', 'finished_at', 'pages_done', 'products_scraped',
    ]
    fieldsets = (
        (None, {
            'fields': (
                'mode', 'keyword', 'asin', 'marketplace', 'product_type_filter',
                'status', 'pages_total', 'start_page', 'max_items',
            ),
        }),
        ('Search Filters', {
            'fields': (
                'sort_by', 'price_min', 'price_max', 'browse_node',
                'extra_rh_filters',
            ),
        }),
        ('Progress & Metadata', {
            'fields': (
                'id', 'rq_job_id', 'pid', 'pages_done', 'products_scraped',
                'error_log', 'cancelled_by', 'started_at', 'finished_at',
            ),
        }),
    )
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

    def get_sort_by(self, obj):
        return obj.get_sort_by_display() if obj.sort_by else '-'
    get_sort_by.short_description = 'Sort'
    get_sort_by.admin_order_field = 'sort_by'

    @admin.action(description='Start selected pending jobs')
    def start_pending_jobs(self, request, queryset):
        import django_rq
        from scraper_app.models import PRODUCT_TYPE_SPIDER_KWARGS
        from scraper_app.tasks import scrape_asin_detail_job, scrape_keyword_job, scrape_search_page_job

        pending = queryset.filter(status=ScrapeJob.Status.PENDING)
        count = 0
        queue = django_rq.get_queue('scraper')
        for job in pending:
            if job.keyword or job.browse_node or job.product_type_filter:
                spider_kwargs = {}
                if job.product_type_filter and job.product_type_filter in PRODUCT_TYPE_SPIDER_KWARGS:
                    spider_kwargs = PRODUCT_TYPE_SPIDER_KWARGS[job.product_type_filter].copy()
                spider_kwargs['max_pages'] = job.pages_total
                if job.max_items:
                    spider_kwargs['max_items'] = job.max_items
                if job.extra_rh_filters:
                    spider_kwargs['extra_rh_filters'] = job.extra_rh_filters
                # Resolve effective browse_node: explicit job.browse_node wins,
                # else the preset's value (popped from spider_kwargs to avoid
                # being passed twice to enqueue).
                preset_browse_node = spider_kwargs.pop('browse_node', '')
                effective_browse_node = job.browse_node or preset_browse_node
                # Choose spider based on mode
                task_func = scrape_search_page_job if job.mode == ScrapeJob.Mode.SEARCH_PAGE_ONLY else scrape_keyword_job
                rq_job = queue.enqueue(
                    task_func,
                    keyword_str=job.keyword.keyword if job.keyword else '',
                    marketplace=job.marketplace,
                    scrape_job_id=str(job.id),
                    sort_by=job.sort_by or '',
                    price_min=job.price_min,
                    price_max=job.price_max,
                    browse_node=effective_browse_node,
                    start_page=job.start_page,
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
                    f"Job {job.id} has no keyword, browse_node, product_type_filter, or ASIN — skipped.",
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
        from scraper_app.tasks import scrape_asin_detail_job, scrape_keyword_job, scrape_search_page_job

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
                start_page=job.start_page,
                max_items=job.max_items,
                product_type_filter=job.product_type_filter,
                sort_by=job.sort_by,
                price_min=job.price_min,
                price_max=job.price_max,
                browse_node=job.browse_node,
                extra_rh_filters=job.extra_rh_filters,
            )
            if job.keyword or job.browse_node or job.product_type_filter:
                spider_kwargs = {}
                if job.product_type_filter and job.product_type_filter in PRODUCT_TYPE_SPIDER_KWARGS:
                    spider_kwargs = PRODUCT_TYPE_SPIDER_KWARGS[job.product_type_filter].copy()
                spider_kwargs['max_pages'] = job.pages_total
                if job.max_items:
                    spider_kwargs['max_items'] = job.max_items
                if job.extra_rh_filters:
                    spider_kwargs['extra_rh_filters'] = job.extra_rh_filters
                # Resolve effective browse_node (same logic as start_pending_jobs):
                # explicit wins, else preset, else empty.
                preset_browse_node = spider_kwargs.pop('browse_node', '')
                effective_browse_node = job.browse_node or preset_browse_node
                task_func = scrape_search_page_job if job.mode == ScrapeJob.Mode.SEARCH_PAGE_ONLY else scrape_keyword_job
                rq_job = queue.enqueue(
                    task_func,
                    keyword_str=job.keyword.keyword if job.keyword else '',
                    marketplace=job.marketplace,
                    scrape_job_id=str(new_job.id),
                    sort_by=job.sort_by or '',
                    price_min=job.price_min,
                    price_max=job.price_max,
                    browse_node=effective_browse_node,
                    start_page=job.start_page,
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


@admin.register(ScheduledScrapeTarget)
class ScheduledScrapeTargetAdmin(admin.ModelAdmin):
    list_display = [
        'get_target', 'marketplace', 'tier', 'last_scraped_at',
        'next_scrape_at', 'active',
    ]
    list_filter = ['marketplace', 'tier', 'active']
    list_editable = ['active']
    actions = ['run_due_scrapes', 'upload_asin_csv', 'upload_keyword_csv']

    def get_target(self, obj):
        return str(obj.keyword) if obj.keyword else obj.asin or '-'
    get_target.short_description = 'Target'

    @admin.action(description='Run ALL due scheduled scrapes (selection ignored)')
    def run_due_scrapes(self, request, queryset):
        from scraper_app.tasks import schedule_scrape_runner

        try:
            enqueued = schedule_scrape_runner()
        except Exception as exc:
            self.message_user(
                request,
                f"Failed to run scheduled scrapes: {exc}",
                messages.ERROR,
            )
            return
        self.message_user(
            request,
            f"Enqueued {enqueued} scrape jobs for due targets.",
            messages.SUCCESS,
        )

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
                uploaded = request.FILES['csv_file']
                try:
                    rows, headers = _parse_uploaded_file(uploaded)
                except ValueError as exc:
                    self.message_user(request, str(exc), messages.ERROR)
                    return HttpResponseRedirect(
                        reverse('admin:scraper_app_scheduledscrapetarget_changelist')
                    )

                if csv_type == 'asin':
                    count, errors = self._process_asin_csv(rows, headers)
                else:
                    count, errors = self._process_keyword_csv(rows, headers)

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
# BrandBlacklist Admin (Task 8.3)
# ---------------------------------------------------------------------------

@admin.register(BrandBlacklist)
class BrandBlacklistAdmin(admin.ModelAdmin):
    list_display = ['brand_name', 'created_at']
    search_fields = ['brand_name']
    ordering = ['brand_name']


# ---------------------------------------------------------------------------
# AmazonProduct Admin
# ---------------------------------------------------------------------------

@admin.register(AmazonProduct)
class AmazonProductAdmin(admin.ModelAdmin):
    list_display = ['asin', 'marketplace', 'title', 'bsr', 'price', 'rating', 'scraped_at']
    list_filter = ['marketplace', 'product_type']
    search_fields = ['asin', 'title', 'brand', 'bullet_1', 'bullet_2']
    readonly_fields = ['id']
    filter_horizontal = ['meta_keywords']
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
        ('Keywords', {
            'fields': ('meta_keywords',),
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
    list_display = ['keyword', 'sort_by', 'price_min', 'price_max', 'browse_node', 'status', 'last_scraped_at']
    list_filter = ['status']


# ---------------------------------------------------------------------------
# MetaKeyword Admin
# ---------------------------------------------------------------------------

@admin.register(MetaKeyword)
class MetaKeywordAdmin(admin.ModelAdmin):
    list_display = ['keyword', 'type', 'frequency']
    list_filter = ['type']
    search_fields = ['keyword']
    readonly_fields = ['id']


# ---------------------------------------------------------------------------
# SearchKeywordResult Admin
# ---------------------------------------------------------------------------

@admin.register(SearchKeywordResult)
class SearchKeywordResultAdmin(admin.ModelAdmin):
    list_display = ['search_cache', 'created_at']
    readonly_fields = ['id', 'top_focus_keywords', 'top_long_tail_keywords', 'all_keywords_flat', 'created_at']


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


# ---------------------------------------------------------------------------
# CanaryAsin & SelectorHealthCheck Admin (PROJ-23)
# ---------------------------------------------------------------------------

@admin.register(CanaryAsin)
class CanaryAsinAdmin(admin.ModelAdmin):
    list_display = [
        'asin', 'marketplace', 'label', 'active',
        'last_check_at', 'last_status',
    ]
    list_filter = ['active', 'marketplace']
    list_editable = ['active']
    search_fields = ['asin', 'label']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['marketplace', 'asin']
    actions = ['run_health_check_now']

    def get_queryset(self, request):
        # Prefetch latest health check per canary to avoid N+1.
        qs = super().get_queryset(request)
        latest_subq = SelectorHealthCheck.objects.filter(
            canary=models.OuterRef('pk'),
        ).order_by('-run_at')
        return qs.annotate(
            _latest_run_at=models.Subquery(latest_subq.values('run_at')[:1]),
            _latest_passed=models.Subquery(latest_subq.values('passed')[:1]),
        )

    def last_check_at(self, obj):
        return getattr(obj, '_latest_run_at', None) or '-'
    last_check_at.short_description = 'Last Check'
    last_check_at.admin_order_field = '_latest_run_at'

    def last_status(self, obj):
        passed = getattr(obj, '_latest_passed', None)
        if passed is None:
            return format_html('<span style="color:#888;">never run</span>')
        if passed:
            return format_html(
                '<span style="background:#1b5e20;color:#fff;padding:2px 8px;border-radius:4px;">PASS</span>'
            )
        return format_html(
            '<span style="background:#b00020;color:#fff;padding:2px 8px;border-radius:4px;">FAIL</span>'
        )
    last_status.short_description = 'Last Status'

    @admin.action(description='Run health check now')
    def run_health_check_now(self, request, queryset):
        import django_rq

        from scraper_app.tasks import run_selector_health_check

        queue = django_rq.get_queue('scraper')
        new_check_ids = []
        for canary in queryset:
            try:
                queue.enqueue(
                    run_selector_health_check,
                    canary_id=str(canary.id),
                    triggered_by=SelectorHealthCheck.TriggeredBy.ADMIN,
                )
                # AC-14: surface the SelectorHealthCheck IDs after the spider runs.
                # We don't have the row yet (it's created inside the task),
                # so we report the queued canary instead.
                new_check_ids.append(canary.asin)
            except Exception as exc:
                self.message_user(
                    request,
                    f"Failed to enqueue {canary.asin}: {exc}",
                    messages.ERROR,
                )
        if new_check_ids:
            self.message_user(
                request,
                f"Enqueued health check for: {', '.join(new_check_ids)}",
                messages.SUCCESS,
            )


@admin.register(SelectorHealthCheck)
class SelectorHealthCheckAdmin(admin.ModelAdmin):
    list_display = [
        'canary', 'run_at', 'passed_badge',
        'failed_field_count_display', 'html_size_kb',
        'triggered_by',
    ]
    list_filter = ['passed', 'triggered_by', 'canary__marketplace']
    search_fields = ['canary__asin', 'canary__label']
    readonly_fields = [
        'id', 'canary', 'run_at', 'html_path', 'snapshot_link',
        'html_size_bytes', 'results', 'passed',
        'triggered_by', 'error_message',
    ]
    fieldsets = (
        (None, {
            'fields': (
                'id', 'canary', 'run_at', 'passed', 'triggered_by',
            ),
        }),
        ('Results', {
            'fields': ('results', 'error_message'),
        }),
        ('Snapshot', {
            'fields': ('html_path', 'snapshot_link', 'html_size_bytes'),
        }),
    )
    ordering = ['-run_at']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('canary')

    def passed_badge(self, obj):
        if obj.passed:
            return format_html(
                '<span style="background:#1b5e20;color:#fff;padding:2px 8px;border-radius:4px;">PASS</span>'
            )
        return format_html(
            '<span style="background:#b00020;color:#fff;padding:2px 8px;border-radius:4px;">FAIL</span>'
        )
    passed_badge.short_description = 'Status'
    passed_badge.admin_order_field = 'passed'

    def failed_field_count_display(self, obj):
        return obj.failed_field_count
    failed_field_count_display.short_description = 'EMPTY fields'

    def html_size_kb(self, obj):
        if obj.html_size_bytes is None:
            return '-'
        return f"{obj.html_size_bytes / 1024:.1f} KB"
    html_size_kb.short_description = 'Snapshot Size'

    def snapshot_link(self, obj):
        """Render a download link to the HTML snapshot if file still on disk."""
        from django.conf import settings as dj_settings
        from pathlib import Path

        if not obj.html_path:
            return format_html('<em>file pruned</em>')
        absolute_path = Path(dj_settings.MEDIA_ROOT) / obj.html_path
        if not absolute_path.exists():
            return format_html('<em>file pruned</em>')
        url = f"{dj_settings.MEDIA_URL}{obj.html_path}"
        return format_html('<a href="{}" target="_blank">Download HTML</a>', url)
    snapshot_link.short_description = 'Snapshot File'

    def has_add_permission(self, request):
        # Health checks are produced by the scheduler/admin actions, never created manually.
        return False


# ---------------------------------------------------------------------------
# ScraperConfig Admin (singleton — concurrency knobs)
# ---------------------------------------------------------------------------

@admin.register(ScraperConfig)
class ScraperConfigAdmin(admin.ModelAdmin):
    list_display = [
        'concurrent_requests',
        'concurrent_requests_per_domain',
        'download_delay_ms',
        'batch_size',
        'max_retries_per_asin',
        'fresh_skip_days',
    ]
    fieldsets = (
        (None, {
            'fields': (
                'concurrent_requests',
                'concurrent_requests_per_domain',
                'download_delay_ms',
            ),
            'description': (
                'Singleton row — applied to every Scrapy spider invocation. '
                'Changes take effect on the NEXT spider spawn.'
            ),
        }),
        ('Bulk batch settings (PROJ-25)', {
            'fields': (
                'batch_size',
                'max_retries_per_asin',
                'fresh_skip_days',
            ),
            'description': (
                'Tunables for the bulk-ASIN drainer. '
                'Changes propagate within one drainer tick (≤10 s).'
            ),
        }),
    )

    def has_add_permission(self, request):
        # Singleton: allow add only when no row exists.
        return not ScraperConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


# ---------------------------------------------------------------------------
# BulkScrapeBatch Admin (PROJ-25 Phase B — placeholder, full UX in Phase E)
# ---------------------------------------------------------------------------


class BulkScrapeUploadForm(forms.Form):
    csv_file = forms.FileField(
        label='CSV or Excel File',
        widget=forms.ClearableFileInput(attrs={'accept': '.csv,.xlsx'}),
    )
    name = forms.CharField(
        max_length=200,
        label='Batch name',
        help_text='Free-text label, e.g. "MBA seed batch 2026-05-05".',
    )
    marketplace = forms.ChoiceField(
        choices=MarketplaceChoices.choices,
        initial=MarketplaceChoices.AMAZON_COM,
        label='Marketplace',
    )
    force_rescrape = forms.BooleanField(
        required=False,
        initial=False,
        label='Re-scrape even if product was updated within last 30 days',
    )


# PROJ-25 Phase E — status badge colors (AC-22, AC-23).
# Use mark_safe (not format_html) for the static HTML to avoid the Django 6
# format_html-without-args deprecation warning (PROJ-23 fix pattern).
_BULK_BATCH_BADGE_COLORS = {
    'draft':         ('#616161', '#fff'),  # grey
    'parsing':       ('#1565c0', '#fff'),  # blue
    'parse_failed':  ('#b00020', '#fff'),  # red
    'ready':         ('#00838f', '#fff'),  # teal
    'running':       ('#2e7d32', '#fff'),  # green
    'paused':        ('#ef6c00', '#fff'),  # orange
    'completed':     ('#1b5e20', '#fff'),  # dark green
    'cancelled':     ('#424242', '#fff'),  # dark grey
}


@admin.register(BulkScrapeBatch)
class BulkScrapeBatchAdmin(admin.ModelAdmin):
    # AC-22: changelist columns + filters + ordering.
    list_display = [
        'name', 'marketplace', 'status_badge',
        'total_count', 'pending_count', 'running_count',
        'done_count', 'failed_count',
        'force_rescrape', 'created_at', 'started_at',
    ]
    list_filter = ['status', 'marketplace', 'force_rescrape']
    ordering = ['-created_at']
    readonly_fields = [
        'id', 'errors',
        'total_count', 'pending_count', 'running_count',
        'done_count', 'failed_count',
        'started_at', 'finished_at', 'created_at',
        'created_by', 'source_filename',
    ]
    fieldsets = (
        (None, {
            'fields': (
                'id', 'name', 'source_filename', 'marketplace',
                'force_rescrape', 'status', 'created_by',
            ),
        }),
        ('Counts', {
            'fields': (
                'total_count', 'pending_count', 'running_count',
                'done_count', 'failed_count',
            ),
        }),
        ('Lifecycle', {
            'fields': ('created_at', 'started_at', 'finished_at'),
        }),
        ('Errors / Audit', {
            'fields': ('errors',),
        }),
    )

    change_list_template = 'admin/scraper_app/bulkscrapebatch_changelist.html'
    change_form_template = 'admin/scraper_app/bulkscrapebatch_change_form.html'

    # ------------------------------------------------------------------
    # Permissions (AC-25)
    # ------------------------------------------------------------------

    def has_add_permission(self, request):
        # E.17: creation only via the upload form.
        return False

    def has_delete_permission(self, request, obj=None):
        # E.19: superuser-only manual delete (AC-26 — cascades targets,
        # leaves ScrapeJobs with batch=NULL for audit).
        return bool(request.user and request.user.is_superuser)

    # ------------------------------------------------------------------
    # Display helpers
    # ------------------------------------------------------------------

    @admin.display(description='Status', ordering='status')
    def status_badge(self, obj):
        # AC-22: colored badge. Use format_html (auto-escapes its args)
        # rather than mark_safe; bandit B703/B308 flag mark_safe even when
        # inputs are server-controlled enums.
        bg, fg = _BULK_BATCH_BADGE_COLORS.get(obj.status, ('#424242', '#fff'))
        return format_html(
            '<span style="background:{};color:{};'
            'padding:2px 8px;border-radius:4px;font-weight:600;">{}</span>',
            bg, fg, obj.get_status_display(),
        )

    # ------------------------------------------------------------------
    # URLs (E.9 + E.21 upload)
    # ------------------------------------------------------------------

    def get_urls(self):
        custom_urls = [
            path(
                'upload/',
                self.admin_site.admin_view(self.upload_view),
                name='scraper_app_bulkscrapebatch_upload',
            ),
            path(
                '<uuid:batch_id>/start/',
                self.admin_site.admin_view(self.action_start),
                name='scraper_app_bulkscrapebatch_start',
            ),
            path(
                '<uuid:batch_id>/pause/',
                self.admin_site.admin_view(self.action_pause),
                name='scraper_app_bulkscrapebatch_pause',
            ),
            path(
                '<uuid:batch_id>/resume/',
                self.admin_site.admin_view(self.action_resume),
                name='scraper_app_bulkscrapebatch_resume',
            ),
            path(
                '<uuid:batch_id>/cancel/',
                self.admin_site.admin_view(self.action_cancel),
                name='scraper_app_bulkscrapebatch_cancel',
            ),
            path(
                '<uuid:batch_id>/retry-failed/',
                self.admin_site.admin_view(self.action_retry_failed),
                name='scraper_app_bulkscrapebatch_retry_failed',
            ),
        ]
        return custom_urls + super().get_urls()

    # ------------------------------------------------------------------
    # Detail-page extra context (progress + recent errors + button flags)
    # ------------------------------------------------------------------

    def change_view(self, request, object_id, form_url='', extra_context=None):
        extra_context = extra_context or {}
        try:
            batch = BulkScrapeBatch.objects.get(pk=object_id)
        except BulkScrapeBatch.DoesNotExist:
            batch = None

        if batch is not None:
            total = batch.total_count or 0
            done = batch.done_count or 0
            percent = int((done / total) * 100) if total > 0 else 0

            errors_list = batch.errors if isinstance(batch.errors, list) else []
            # Normalise each entry so the template never hits VariableDoesNotExist
            # when an audit entry has only `action` (or only `event`, etc.).
            recent_errors = []
            for raw in reversed(errors_list[-20:]):
                if not isinstance(raw, dict):
                    continue
                recent_errors.append({
                    'at': raw.get('at', '-'),
                    'action': raw.get('action', ''),
                    'event': raw.get('event', ''),
                    'error': raw.get('error', ''),
                    'user': raw.get('user', ''),
                    'reset_count': raw.get('reset_count'),
                    'row': raw.get('row', ''),
                })

            status = batch.status
            S = BulkScrapeBatch.Status
            # AC-23: which buttons are visible per status.
            can_start = status == S.READY
            can_pause = status == S.RUNNING
            can_resume = status == S.PAUSED
            can_cancel = status in {S.READY, S.RUNNING, S.PAUSED}
            can_retry = status in {S.COMPLETED, S.CANCELLED}
            # E.15: button label "Resume" when status=CANCELLED, otherwise "Start".
            can_resume_cancelled = status == S.CANCELLED

            extra_context.update({
                'bulk_batch': batch,
                'progress_percent': percent,
                'progress_done': done,
                'progress_total': total,
                'recent_errors': recent_errors,
                'can_start': can_start,
                'can_pause': can_pause,
                'can_resume': can_resume,
                'can_cancel': can_cancel,
                'can_retry': can_retry,
                'can_resume_cancelled': can_resume_cancelled,
            })
        return super().change_view(
            request, object_id, form_url, extra_context=extra_context,
        )

    # ------------------------------------------------------------------
    # Action handlers (E.10–E.16) — all require POST + is_staff.
    # ------------------------------------------------------------------

    def _detail_redirect(self, batch_id):
        return HttpResponseRedirect(
            reverse('admin:scraper_app_bulkscrapebatch_change', args=[batch_id])
        )

    def _audit_username(self, request):
        u = getattr(request, 'user', None)
        if not u or not u.is_authenticated:
            return 'anonymous'
        return getattr(u, 'email', None) or getattr(u, 'username', None) or str(u.pk)

    def _require_staff_post(self, request):
        """Return None if request is OK, else an HttpResponse to short-circuit."""
        from django.http import HttpResponseForbidden, HttpResponseNotAllowed
        if request.method != 'POST':
            return HttpResponseNotAllowed(['POST'])
        if not (request.user and request.user.is_authenticated and request.user.is_staff):
            return HttpResponseForbidden('Staff only.')
        return None

    def _enqueue_drainer(self, batch):
        """Enqueue drain_bulk_batch on the default queue."""
        import django_rq
        from scraper_app.tasks import drain_bulk_batch
        queue = django_rq.get_queue('default')
        queue.enqueue(drain_bulk_batch, str(batch.id))

    def _start_or_resume(self, request, batch, action_label):
        """Shared body for E.10 start / E.12 resume / E.14 retry-failed restart."""
        S = BulkScrapeBatch.Status
        batch.status = S.RUNNING
        if batch.started_at is None:
            batch.started_at = timezone.now()
        # If we transitioned out of CANCELLED/COMPLETED, clear finished_at so
        # the lifecycle stays meaningful (E.14 / Q4 nuance).
        batch.finished_at = None
        batch.append_error({
            'action': action_label,
            'user': self._audit_username(request),
            'at': timezone.now().isoformat(),
        })
        batch.save(update_fields=['status', 'started_at', 'finished_at', 'errors'])
        try:
            self._enqueue_drainer(batch)
        except Exception as exc:  # noqa: BLE001
            batch.append_error({
                'event': 'drainer_enqueue_failed',
                'error': str(exc),
                'at': timezone.now().isoformat(),
            })
            batch.save(update_fields=['errors'])
            messages.error(
                request,
                f"Drainer enqueue failed: {exc}. State set to RUNNING; admin can retry.",
            )

    def action_start(self, request, batch_id):
        """E.10 / E.12: Start (READY) or Resume (PAUSED). Renamed to Resume on cancelled."""
        guard = self._require_staff_post(request)
        if guard is not None:
            return guard
        try:
            batch = BulkScrapeBatch.objects.get(pk=batch_id)
        except BulkScrapeBatch.DoesNotExist:
            messages.error(request, 'Batch not found.')
            return HttpResponseRedirect(
                reverse('admin:scraper_app_bulkscrapebatch_changelist')
            )
        S = BulkScrapeBatch.Status
        # AC-23: Start visible for READY or PAUSED; CANCELLED also accepts via Resume.
        if batch.status not in {S.READY, S.PAUSED, S.CANCELLED}:
            messages.warning(
                request,
                f"Cannot start batch in status '{batch.get_status_display()}'.",
            )
            return self._detail_redirect(batch.id)
        label = 'resume' if batch.status in {S.PAUSED, S.CANCELLED} else 'start'
        self._start_or_resume(request, batch, label)
        messages.success(
            request,
            f"Batch '{batch.name}' is now RUNNING — drainer enqueued.",
        )
        return self._detail_redirect(batch.id)

    def action_resume(self, request, batch_id):
        """E.12: explicit Resume URL (mirrors Start; precondition PAUSED)."""
        guard = self._require_staff_post(request)
        if guard is not None:
            return guard
        try:
            batch = BulkScrapeBatch.objects.get(pk=batch_id)
        except BulkScrapeBatch.DoesNotExist:
            messages.error(request, 'Batch not found.')
            return HttpResponseRedirect(
                reverse('admin:scraper_app_bulkscrapebatch_changelist')
            )
        S = BulkScrapeBatch.Status
        if batch.status not in {S.PAUSED, S.CANCELLED}:
            messages.warning(
                request,
                f"Cannot resume batch in status '{batch.get_status_display()}'.",
            )
            return self._detail_redirect(batch.id)
        self._start_or_resume(request, batch, 'resume')
        messages.success(
            request,
            f"Batch '{batch.name}' resumed — drainer enqueued.",
        )
        return self._detail_redirect(batch.id)

    def action_pause(self, request, batch_id):
        """E.11: Pause a RUNNING batch — drainer self-detects on next tick."""
        guard = self._require_staff_post(request)
        if guard is not None:
            return guard
        try:
            batch = BulkScrapeBatch.objects.get(pk=batch_id)
        except BulkScrapeBatch.DoesNotExist:
            messages.error(request, 'Batch not found.')
            return HttpResponseRedirect(
                reverse('admin:scraper_app_bulkscrapebatch_changelist')
            )
        if batch.status != BulkScrapeBatch.Status.RUNNING:
            messages.warning(
                request,
                f"Cannot pause batch in status '{batch.get_status_display()}'.",
            )
            return self._detail_redirect(batch.id)
        batch.status = BulkScrapeBatch.Status.PAUSED
        batch.append_error({
            'action': 'pause',
            'user': self._audit_username(request),
            'at': timezone.now().isoformat(),
        })
        batch.save(update_fields=['status', 'errors'])
        messages.success(
            request,
            f"Batch '{batch.name}' paused — drainer will exit on next tick.",
        )
        return self._detail_redirect(batch.id)

    def action_cancel(self, request, batch_id):
        """E.13: Cancel a READY/RUNNING/PAUSED batch.

        Scrubs PENDING RQ jobs from the `scraper` queue that belong to this
        batch. Already-running spider subprocesses are NOT signalled — they
        finish naturally and their writes still apply (EC-8).
        """
        guard = self._require_staff_post(request)
        if guard is not None:
            return guard
        try:
            batch = BulkScrapeBatch.objects.get(pk=batch_id)
        except BulkScrapeBatch.DoesNotExist:
            messages.error(request, 'Batch not found.')
            return HttpResponseRedirect(
                reverse('admin:scraper_app_bulkscrapebatch_changelist')
            )
        S = BulkScrapeBatch.Status
        if batch.status not in {S.READY, S.RUNNING, S.PAUSED}:
            messages.warning(
                request,
                f"Cannot cancel batch in status '{batch.get_status_display()}'.",
            )
            return self._detail_redirect(batch.id)

        batch.status = S.CANCELLED
        batch.finished_at = timezone.now()
        batch.append_error({
            'action': 'cancel',
            'user': self._audit_username(request),
            'at': batch.finished_at.isoformat(),
        })
        batch.save(update_fields=['status', 'finished_at', 'errors'])

        # Scrub pending RQ jobs in the scraper queue whose ScrapeJob points at
        # this batch. Bounded by max_in_flight (~5–10), so iteration is cheap.
        scrub_count = 0
        try:
            import django_rq
            queue = django_rq.get_queue('scraper')
            for rq_job in queue.get_jobs():
                func_name = getattr(rq_job, 'func_name', '') or ''
                if not func_name.endswith('scrape_asin_batch_job'):
                    continue
                args = getattr(rq_job, 'args', None) or []
                if not args:
                    continue
                scrape_job_id = args[0]
                try:
                    sj = ScrapeJob.objects.get(pk=scrape_job_id)
                except ScrapeJob.DoesNotExist:
                    continue
                if sj.batch_id == batch.id:
                    queue.remove(rq_job.id)
                    scrub_count += 1
        except Exception as exc:  # noqa: BLE001
            batch.append_error({
                'event': 'cancel_scrub_failed',
                'error': str(exc),
                'at': timezone.now().isoformat(),
            })
            batch.save(update_fields=['errors'])
            messages.warning(
                request,
                f"Batch cancelled, but RQ scrub failed: {exc}",
            )

        messages.success(
            request,
            f"Batch '{batch.name}' cancelled — scrubbed {scrub_count} pending job(s). "
            "In-flight subprocesses will finish.",
        )
        return self._detail_redirect(batch.id)

    def action_retry_failed(self, request, batch_id):
        """E.14: Retry-Failed (Q4=A strict).

        Only resets targets where last_error IS NOT NULL AND last_error != 'skipped_fresh'.
        Then transitions to RUNNING + enqueues a fresh drainer.
        """
        guard = self._require_staff_post(request)
        if guard is not None:
            return guard
        try:
            batch = BulkScrapeBatch.objects.get(pk=batch_id)
        except BulkScrapeBatch.DoesNotExist:
            messages.error(request, 'Batch not found.')
            return HttpResponseRedirect(
                reverse('admin:scraper_app_bulkscrapebatch_changelist')
            )
        S = BulkScrapeBatch.Status
        if batch.status not in {S.COMPLETED, S.CANCELLED}:
            messages.warning(
                request,
                f"Cannot retry failed in status '{batch.get_status_display()}'.",
            )
            return self._detail_redirect(batch.id)

        reset_count = (
            ScheduledScrapeTarget.objects
            .filter(batch=batch, last_error__isnull=False)
            .exclude(last_error='skipped_fresh')
            .update(last_error=None, retry_count=0)
        )
        batch.append_error({
            'action': 'retry_failed',
            'user': self._audit_username(request),
            'at': timezone.now().isoformat(),
            'reset_count': reset_count,
        })
        batch.save(update_fields=['errors'])

        # Then mirror Start: status=RUNNING, started_at set if missing,
        # finished_at cleared, and re-enqueue the drainer.
        self._start_or_resume(request, batch, 'retry_failed_start')

        messages.info(
            request,
            f"Retry-failed reset {reset_count} target(s). Batch '{batch.name}' is RUNNING again.",
        )
        return self._detail_redirect(batch.id)

    def upload_view(self, request):
        if request.method == 'POST':
            form = BulkScrapeUploadForm(request.POST, request.FILES)
            if form.is_valid():
                upload = request.FILES['csv_file']
                name = form.cleaned_data['name']
                marketplace = form.cleaned_data['marketplace']
                force_rescrape = form.cleaned_data['force_rescrape']

                # Determine extension before creating the batch row so we know
                # the on-disk filename. Fall back to '.csv' if missing.
                lower = (upload.name or '').lower()
                if lower.endswith('.xlsx'):
                    ext = 'xlsx'
                elif lower.endswith('.csv'):
                    ext = 'csv'
                else:
                    self.message_user(
                        request,
                        f"Unsupported file type: {upload.name}. Use .csv or .xlsx.",
                        messages.ERROR,
                    )
                    return TemplateResponse(
                        request,
                        'admin/scraper_app/bulkscrapebatch_upload.html',
                        {
                            **self.admin_site.each_context(request),
                            'title': 'Upload bulk ASIN batch',
                            'form': form,
                            'opts': self.model._meta,
                        },
                    )

                # EC-17: catch disk-full / permission errors at file-write time.
                bulk_dir = os.path.join(settings.MEDIA_ROOT, 'bulk_uploads')
                try:
                    os.makedirs(bulk_dir, exist_ok=True)
                except OSError as exc:
                    self.message_user(
                        request,
                        f"Could not create upload directory: {exc}",
                        messages.ERROR,
                    )
                    return TemplateResponse(
                        request,
                        'admin/scraper_app/bulkscrapebatch_upload.html',
                        {
                            **self.admin_site.each_context(request),
                            'title': 'Upload bulk ASIN batch',
                            'form': form,
                            'opts': self.model._meta,
                        },
                    )

                # Generate the batch UUID first so the on-disk filename is
                # stable and predictable for the parser job.
                import uuid as _uuid
                batch_id = _uuid.uuid4()
                target_path = os.path.join(bulk_dir, f"{batch_id}.{ext}")
                try:
                    with open(target_path, 'wb') as out:
                        for chunk in upload.chunks():
                            out.write(chunk)
                except OSError as exc:
                    self.message_user(
                        request,
                        f"Could not write upload to disk: {exc}",
                        messages.ERROR,
                    )
                    return TemplateResponse(
                        request,
                        'admin/scraper_app/bulkscrapebatch_upload.html',
                        {
                            **self.admin_site.each_context(request),
                            'title': 'Upload bulk ASIN batch',
                            'form': form,
                            'opts': self.model._meta,
                        },
                    )

                batch = BulkScrapeBatch.objects.create(
                    id=batch_id,
                    name=name,
                    source_filename=upload.name or '',
                    marketplace=marketplace,
                    force_rescrape=force_rescrape,
                    status=BulkScrapeBatch.Status.PARSING,
                    created_by=request.user if request.user.is_authenticated else None,
                )

                # Enqueue async parser on `default` queue.
                import django_rq
                from scraper_app.tasks import parse_bulk_upload_job

                queue = django_rq.get_queue('default')
                queue.enqueue(parse_bulk_upload_job, str(batch.id))

                self.message_user(
                    request,
                    f"Upload received — parsing batch '{batch.name}' in the background.",
                    messages.SUCCESS,
                )
                return HttpResponseRedirect(
                    reverse('admin:scraper_app_bulkscrapebatch_change', args=[batch.id])
                )
        else:
            form = BulkScrapeUploadForm()

        context = {
            **self.admin_site.each_context(request),
            'title': 'Upload bulk ASIN batch',
            'form': form,
            'opts': self.model._meta,
        }
        return TemplateResponse(
            request, 'admin/scraper_app/bulkscrapebatch_upload.html', context,
        )
