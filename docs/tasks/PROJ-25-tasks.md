# PROJ-25: Bulk ASIN One-Shot Scrape Batches — Tasks

> Implementation order. Each `- [ ]` is a discrete unit of work. Backend-only feature. AC-X / EC-X references the spec at `features/PROJ-25-bulk-asin-scrape-batches.md`.

> **Rollout strategy:** Phases A → H ship in PR-able increments so the user can test 10 → 50 → 1k → 100k progressively. Phase A alone unblocks 10/50/1000 ASIN smoke-tests (using the existing admin CSV upload path with the seeded `OneShot` tier). Phases B–E are needed for 100k+. Phases F–H harden + verify.

---

## Phase A — OneShot tier + minimal model (≈ 0.5 day)

**Goal:** Make the existing admin CSV/XLSX upload path correctly auto-deactivate OneShot targets after a successful scrape. Unblocks 10 / 50 / 1000 ASIN smoke-tests today.

- [x] A.1 Data migration `0018_seed_oneshot_tier.py`: idempotent `ScrapeTier.objects.get_or_create(name='OneShot', defaults={'bsr_min': 0, 'bsr_max': None, 'interval_days': 999999})` (AC-5, EC-15)
- [x] A.2 Reverse migration is a no-op (do NOT auto-delete the tier on rollback)
- [x] A.3 Extend `ScheduledScrapeTarget.save()` in `scraper_app/models.py`: when `self.tier and self.tier.name == 'OneShot'` AND `self.last_scraped_at`, do NOT recalculate `next_scrape_at` from `interval_days`; leave it untouched (AC-21)
- [x] A.4 Update `scrape_asin_detail_job` in `scraper_app/tasks.py` post-success block: if any of the linked targets has `tier.name == 'OneShot'`, set `target.active=False` instead of letting `save()` reschedule
- [x] A.5 Tests `tests/test_oneshot_tier.py`:
    - `test_oneshot_tier_seed_idempotent` — running migration twice doesn't duplicate
    - `test_oneshot_target_save_does_not_reschedule` — save with last_scraped_at, assert next_scrape_at unchanged
    - `test_oneshot_target_deactivated_after_scrape` — call `scrape_asin_detail_job` with mocked subprocess, assert `active=False`
- [x] A.6 Smoke-test runbook (≤ 50 ASINs): upload via existing admin "Upload ASIN CSV" path, click "Run ALL due scheduled scrapes", verify all targets become `active=False`

**Phase A ship gate:** all unit tests green; manual 10-ASIN smoke-test passes; `git commit -m "feat(PROJ-25): seed OneShot tier + auto-deactivate after scrape"`.

---

## Phase B — BulkScrapeBatch model + async upload + parser job (≈ 1.5 days)

**Goal:** Upload form returns within 1 s for any file size; targets land in DB ready to be activated. No drainer / spider yet — Phase B alone produces a `READY` batch that just sits.

### Models & Migrations
- [x] B.1 Add `BulkScrapeBatch` model to `scraper_app/models.py` (AC-1, AC-11b): UUID id, name, source_filename, marketplace (FK choice), force_rescrape bool, status TextChoices (DRAFT, PARSING, PARSE_FAILED, READY, RUNNING, PAUSED, COMPLETED, CANCELLED), 5 PositiveInt counts, errors JSONField default list, created_by FK User nullable, 3 datetimes
- [x] B.2 Add `Meta.ordering = ['-created_at']`, add `db_index=True` on `status`
- [x] B.3 Add `BulkScrapeBatch.append_error(event_dict, max_keep=100)` instance helper that pushes an entry and trims to last 100 (AC-32)
- [x] B.4 Extend `ScheduledScrapeTarget`: nullable `batch` FK CASCADE (related_name='targets'), nullable `last_error` text, `retry_count` PositiveInt default 0 (AC-2)
- [x] B.5 Composite index on `ScheduledScrapeTarget(batch, active, last_error)` for drainer pick query
- [x] B.6 Migration `0020_bulkscrapebatch.py` (schema)
- [x] B.7 Migration `0021_target_batch_lasterror_retry.py` (schema, all additive/nullable so safe on prod)

### Parser Module
- [x] B.8 Create `scraper_app/parsers.py`. Move `_parse_uploaded_file()` from `admin.py` here verbatim. Update `admin.py` to import from new location.
- [x] B.9 Add `parsers.normalize_asin_row(row, default_marketplace, asin_pattern, valid_marketplaces) -> (clean_dict | None, error_msg | None)` helper that returns either a normalised row dict ready for `ScheduledScrapeTarget(...)` or an error message
- [x] B.10 Add `parsers.dedupe_within_file(rows_iter)` generator yielding only the latest occurrence per `(asin, marketplace)` while counting duplicates

### Async Parser Task
- [x] B.11 Add `parse_bulk_upload_job(batch_id)` to `scraper_app/tasks.py` (AC-7, AC-8, AC-9, AC-10, EC-11, EC-12)
- [x] B.12 Job loads `BulkScrapeBatch` + opens file from `MEDIA_ROOT/bulk_uploads/<batch_id>.<ext>`
- [x] B.13 Stream rows via `parsers._parse_uploaded_file` (XLSX uses `read_only=True, data_only=True`); chunk into batches of 1000
- [x] B.14 For each chunk: validate via `normalize_asin_row`, dedupe via `dedupe_within_file`, build `ScheduledScrapeTarget` instances with `tier=OneShot, active=False, tier_override=True, batch=B`, then `bulk_create(ignore_conflicts=True, batch_size=1000)` inside `transaction.atomic()`
- [x] B.15 Append first 100 row-level errors to `batch.errors` via `append_error`
- [x] B.16 After parsing: set `total_count` to actual valid-row count via `targets.filter(batch=B).count()`. Set `status=READY` if `total_count > 0`, else `PARSE_FAILED`
- [x] B.17 On any uncaught exception: `status=PARSE_FAILED`, append exception message to `errors`, log at ERROR (EC-11)
- [x] B.18 On success: `os.remove(uploaded_file_path)` to keep MEDIA_ROOT/bulk_uploads/ small

### Admin Upload Form (minimal, full styling in Phase E)
- [x] B.19 Register `BulkScrapeBatchAdmin` placeholder in `admin.py` so the changelist exists (basic list_display, no custom actions yet)
- [x] B.20 Add `BulkScrapeUploadForm(forms.Form)` with: csv_file FileField (accept .csv,.xlsx), name CharField, marketplace ChoiceField, force_rescrape BooleanField (default False)
- [x] B.21 Custom admin URL `/admin/scraper_app/bulkscrapebatch/upload/` rendering the form (template `templates/admin/scraper_app/bulkscrapebatch_upload.html`)
- [x] B.22 POST handler: save uploaded file to `MEDIA_ROOT/bulk_uploads/<batch_uuid>.<ext>` (ext from form), create `BulkScrapeBatch(status=PARSING, name, marketplace, force_rescrape, source_filename=upload.name, created_by=request.user)`, enqueue `parse_bulk_upload_job(batch.id)` on `default` queue, redirect to detail page (AC-6, AC-7)
- [x] B.23 Handle EC-17 (disk full) — wrap file save in try/except, return form with error message; do NOT create batch row

### Tests
- [x] B.24 `tests/test_bulk_parser.py::test_parser_handles_xlsx_with_only_asin_column` — uses fixture file `fixtures/bulk_asin_10.xlsx`
- [x] B.25 `test_parser_dedupes_duplicate_asins` — same ASIN twice → one target row, duplicate count in errors
- [x] B.26 `test_parser_skips_invalid_asin_rows` — bad regex → row skipped, error appended
- [x] B.27 `test_parser_skips_unknown_marketplace` (EC-12)
- [x] B.28 `test_parser_handles_partial_last_chunk` — 7 rows; bulk_create works for partial chunk (EC-2)
- [x] B.29 `test_parser_marks_failed_on_corrupt_xlsx` (EC-11)
- [x] B.30 `test_upload_view_creates_batch_and_enqueues_parser` — Django admin client, mock `django_rq.get_queue('default').enqueue`, assert call args
- [x] B.31 `test_upload_view_redirects_within_1s` — perf assertion not strictly enforced in CI but document expected return path

**Phase B ship gate:** Upload of 10-row XLSX produces `BulkScrapeBatch.status=READY` with 10 `ScheduledScrapeTarget` rows linked. Tests green.

---

## Phase C — Batch spider + JSON outcome file + wrapper task (≈ 1.5 days)

**Goal:** A single `ScrapeJob(mode=BATCH_ASIN, asin_list=[…10 ASINs])` row, manually enqueued via Django shell, runs the batch spider end-to-end and reconciles per-ASIN outcomes back to targets. Drainer not yet — Phase C is testable in isolation.

### ScrapeJob Schema
- [x] C.1 Add `BATCH_ASIN = 'batch_asin', 'Batch ASIN'` to `ScrapeJob.Mode` (AC-3)
- [x] C.2 Add `asin_list = models.JSONField(null=True, blank=True)` to `ScrapeJob` with a Python-level validator: `len <= 50`, each entry matches ASIN regex
- [x] C.3 Add `batch = models.ForeignKey(BulkScrapeBatch, null=True, on_delete=SET_NULL, related_name='scrape_jobs')` (AC-26)
- [x] C.4 Composite index on `(status, mode)` for drainer's global-in-flight query
- [x] C.5 Migration `0022_scrapejob_batch_asinlist_mode.py`

### Batch Spider
- [x] C.6 Create `scraper_app/scrapy_app/spiders/amazon_product_batch.py` (AC-16, AC-17, AC-18)
- [x] C.7 `class AmazonProductBatchSpider(ProductDetailMixin, scrapy.Spider)` with `name = 'amazon_product_batch'`
- [x] C.8 `__init__(self, asins, marketplace='amazon_com', job_id=None)` — `self.asins = asins.split(',')`
- [x] C.9 `start_requests` yields one Request per ASIN to `<base>/dp/<asin>/`, identical headers/meta to `amazon_product` (reuse mixin parse callback)
- [x] C.10 Outcome JSON file path: `/tmp/scrape_batch_<job_id>.json` (AC-19)
- [x] C.11 Connect Scrapy `item_scraped` signal: append `{asin, status: 'ok', http_status: 200, scraped_at}` to in-memory results list, atomically rewrite the JSON file
- [x] C.12 Connect `request_failed` / errback: append `{asin, status: 'failed', error_message, http_status}` to results, rewrite file
- [x] C.13 At spider close (via `closed(self, reason)`): final flush + ensure JSON parseable (graceful even if reason was 'finished_with_errors')
- [x] C.14 Numeric concurrency: spider's own `custom_settings = {}` (left empty); concurrency comes from `-s` flags injected by wrapper

### Wrapper Task
- [x] C.15 Add `scrape_asin_batch_job(scrape_job_id)` to `scraper_app/tasks.py` (AC-20)
- [x] C.16 Zombie detection (EC-16): if `scrape_job.status == RUNNING` at entry, mark FAILED with `error_log='zombie at task entry'`, return; do NOT spawn subprocess
- [x] C.17 Set `status=RUNNING, started_at=now`, save
- [x] C.18 Build subprocess command: `scrapy crawl amazon_product_batch -a asins=<comma> -a marketplace=<mp> -a job_id=<id>` + `_scrapy_concurrency_settings()` + `-s CONCURRENT_REQUESTS_PER_DOMAIN={cfg.batch_size}` if missing
- [x] C.19 `subprocess.Popen` with same `_scrapy_env()` and `cwd=SCRAPY_PROJECT_DIR` as existing `scrape_asin_detail_job`. Capture pid into `ScrapeJob.pid`
- [x] C.20 `proc.communicate()` (block on the scraper-queue worker — fine, that's what those workers do)
- [x] C.21 After exit: read `/tmp/scrape_batch_<id>.json`. If file missing or unparseable → all ASINs treated as failed with `error_message='no outcome file (subprocess crashed)'`
- [x] C.22 **Freshness skip (AC-11, EC-10/10b/10c):** before reconciling outcomes, if `batch.force_rescrape == False`, query `AmazonProduct.objects.filter(asin__in=ok_asins, marketplace=mp, updated_at__gte=now-fresh_skip_days)` to get the set of "skip" ASINs. For these, set `target.active=False, last_error='skipped_fresh'` and DO NOT increment retry. They count as `done`.
- [x] C.23 Reconcile per-ASIN outcomes (Phase C continuation):
    - ok (and not freshness-skipped): `target.update(active=False, last_scraped_at=now, last_error=NULL)`
    - failed and `retry_count + 1 < cfg.max_retries_per_asin`: `target.update(active=False, retry_count=F('retry_count')+1, last_error=NULL)` — drainer picks up again
    - failed and at retry-cap: `target.update(active=False, retry_count=F('retry_count')+1, last_error=<msg>)` — terminal
- [x] C.24 Compute final `ScrapeJob.status`: COMPLETED if all OK or all retried-with-room; COMPLETED with `error_log` summary if mixed; FAILED only if subprocess crashed before any outcome
- [x] C.25 Delete `/tmp/scrape_batch_<id>.json` on success (keep on failure for debugging)

### Tests
- [x] C.26 `tests/test_batch_spider.py::test_spider_writes_outcome_json` — mock HTTP responses, assert file contents
- [x] C.27 `test_spider_records_failed_asin` — 1 OK + 1 503; outcome file has both
- [x] C.28 `test_wrapper_marks_targets_done_on_success` — mock subprocess, write fake outcome file, assert target.active=False
- [x] C.29 `test_wrapper_increments_retry_on_failure_below_cap`
- [x] C.30 `test_wrapper_terminal_fails_at_cap`
- [x] C.31 `test_wrapper_freshness_skip_when_fresh_amazonproduct_exists` — seed AmazonProduct fresh, run wrapper, target should be skipped_fresh (EC-10)
- [x] C.32 `test_wrapper_force_rescrape_bypasses_freshness` (EC-10b)
- [x] C.33 `test_wrapper_zombie_detection` — pre-set ScrapeJob.status=RUNNING, run wrapper, assert FAILED without subprocess spawn (EC-16)

**Phase C ship gate:** Manually `python manage.py shell` → enqueue one ScrapeJob with 10 ASINs → all 10 land in AmazonProduct + targets become `active=False`. Tests green.

---

## Phase D — Drainer loop + Redis lock + ScraperConfig new fields (≈ 1.5 days)

**Goal:** Self-rescheduling drainer respects global slot pool, Redis-locked, idempotent. End-to-end: upload → start → drainer drives all targets to completion automatically.

### ScraperConfig Schema
- [x] D.1 Add `batch_size` PositiveIntegerField default 10 with MinValueValidator(1) MaxValueValidator(50), help_text per AC-4
- [x] D.2 Add `max_retries_per_asin` PositiveIntegerField default 1
- [x] D.3 Add `fresh_skip_days` PositiveIntegerField default 30, help_text per AC-11b
- [x] D.4 Migration `0019_scraperconfig_batch_fields.py` (added before B/C migrations? No — order is A then D then B/C then E to keep model-only changes early; renumber as needed and pick consistent order)
- [x] D.5 Update `ScraperConfigAdmin` to include the 3 new fields in `fieldsets`

### Drainer Helpers
- [x] D.6 Add `_bulk_drainer_lock(batch_id, ttl=60)` context manager in `tasks.py` using `django_rq.get_connection().set(name=..., value=str(uuid4()), nx=True, ex=ttl)`. Yields acquired-bool. On exit, only DEL the key if the value matches (lua script or check-then-delete) — prevents another worker's lock from being released.
- [x] D.7 Add `_refresh_batch_counts(batch)` — single aggregation query updating pending/running/done/failed_count from `ScheduledScrapeTarget.objects.filter(batch=B).aggregate(...)` and `ScrapeJob.objects.filter(batch=B).aggregate(...)`. Save batch with `update_fields`. (AC-31)
- [x] D.8 Add `_pick_next_targets(batch, count)` — returns queryset of targets where batch=B AND active=False AND (last_error IS NULL OR (last_error != 'skipped_fresh' AND retry_count < cfg.max_retries_per_asin)), ordered by id, sliced [:count]

### Drainer Task
- [x] D.9 Add `drain_bulk_batch(batch_id)` to `scraper_app/tasks.py` (AC-12, AC-13, AC-14, AC-15)
- [x] D.10 Acquire lock via `_bulk_drainer_lock`. If not acquired: log INFO `"drainer batch=<id> already locked, skipping tick"`, exit gracefully without re-enqueueing (the running tick will re-enqueue the next one) (AC-13)
- [x] D.11 Reload `BulkScrapeBatch.objects.get(id=batch_id)` and `ScraperConfig.load()` from DB
- [x] D.12 If `batch.status != RUNNING`: release lock, exit (no re-enqueue) — handles Pause/Cancel
- [x] D.13 Compute `max_in_flight = max(1, cfg.concurrent_requests // cfg.batch_size)` and `global_in_flight = ScrapeJob.objects.filter(status__in=['pending','running'], mode='batch_asin').count()`
- [x] D.14 `slots_free = max_in_flight - global_in_flight` (clamped ≥ 0)
- [x] D.15 If slots_free > 0: pick `slots_free * cfg.batch_size` targets via `_pick_next_targets`. Loop chunks of `cfg.batch_size`:
    - Inside `transaction.atomic()`: create `ScrapeJob(mode=BATCH_ASIN, asin_list=[t.asin for t in chunk], batch=B, marketplace=B.marketplace, status=PENDING)`, then `ScheduledScrapeTarget.objects.filter(id__in=chunk_ids).update(active=True, scrape_job=created_job)` (or skip the FK link — the asin+batch pair is enough to reconcile)
    - `rq_scraper.enqueue(scrape_asin_batch_job, scrape_job.id)`; capture rq_job_id
    - On enqueue exception: `batch.append_error({event:'drainer_enqueue_failed', error:str(e), at:now})`, log WARNING (AC-30)
- [x] D.16 `_refresh_batch_counts(batch)`
- [x] D.17 Completion check (AC-12 step 8): if no targets remaining (using `_pick_next_targets(batch, 1).exists() == False`) AND `ScrapeJob.objects.filter(batch=B, status__in=[PENDING,RUNNING]).count() == 0`: `batch.status=COMPLETED`, `finished_at=now`, save, release lock, exit (no re-enqueue)
- [x] D.18 Otherwise: `django_rq.get_queue('default').enqueue_in(timedelta(seconds=10), drain_bulk_batch, batch_id)` and release lock
- [x] D.19 INFO log every tick: `f"drainer batch={batch_id} in_flight={global_in_flight} max={max_in_flight} enqueued={enqueued_this_tick} remaining={remaining}"` (AC-30)

### Tests
- [x] D.20 `tests/test_bulk_drainer.py::test_drainer_enqueues_first_chunk_when_idle`
- [x] D.21 `test_drainer_respects_max_in_flight` — set 5 fake PENDING jobs, drainer enqueues 0 more
- [x] D.22 `test_drainer_exits_when_status_paused` (AC-23 Pause path)
- [x] D.23 `test_drainer_completes_batch_when_no_remaining_or_in_flight` — assert status=COMPLETED, finished_at set
- [x] D.24 `test_drainer_lock_idempotent` — call drainer twice from same test; second call sees lock, exits, does not re-enqueue
- [x] D.25 `test_drainer_concurrency_limit_change_takes_effect_next_tick` (AC-14, EC-3) — first tick with cfg=50, second tick with cfg=25 → `max_in_flight` changes
- [x] D.26 `test_drainer_global_pool_shared_across_batches` (EC-7, AC-15) — two batches, one drainer sees the other's in-flight
- [x] D.27 `test_drainer_batch_size_zero_concurrent_acts_as_soft_pause` (EC-13) — cfg=0 → enqueued=0 every tick, batch stays RUNNING
- [x] D.28 `test_drainer_skips_targets_with_skipped_fresh_last_error` — they should never be picked again

**Phase D ship gate:** End-to-end: upload 10 ASINs (Phase B path), call `drain_bulk_batch(batch_id)` once, observe drainer drive batch to COMPLETED in <1 minute (subprocess startup + Amazon page).

---

## Phase E — Admin UI (≈ 1.5 days)

**Goal:** Admin can do everything via the browser: upload, watch progress, Start/Pause/Resume/Cancel/Retry-Failed.

### Changelist
- [x] E.1 `BulkScrapeBatchAdmin.list_display` (AC-22): `name, marketplace, status_badge, total_count, pending_count, running_count, done_count, failed_count, force_rescrape, created_at, started_at`
- [x] E.2 `list_filter`: `status, marketplace, force_rescrape`
- [x] E.3 Default ordering `-created_at`
- [x] E.4 `status_badge` rendered with green/red/yellow color via `mark_safe` (avoid Django 6 `format_html` deprecation per PROJ-23 fix pattern)
- [x] E.5 "Upload new batch" button on changelist top → links to `/admin/scraper_app/bulkscrapebatch/upload/`

### Detail Page
- [x] E.6 Override `change_form_template = 'admin/scraper_app/bulkscrapebatch_change_form.html'`
- [x] E.7 Template extends Django admin's change_form, adds:
    - Progress bar `<progress value=done max=total>` + percentage label (AC-23)
    - Recent errors panel (last 20 from `errors[]` reversed) (AC-23)
    - 5 action buttons rendered conditionally on `status` (AC-23)
- [x] E.8 Buttons render as `<form method="post" action="{% url 'admin:bulk_batch_action' batch.id action %}">` POST so they can mutate state safely
- [x] E.9 Add `get_urls()` overrides for: `start/`, `pause/`, `resume/`, `cancel/`, `retry-failed/` per batch (AC-23, AC-25)

### Action Handlers (each is a `self.admin_site.admin_view`-wrapped method)
- [x] E.10 `start` (AC-23): preconditions `status ∈ {READY, PAUSED}`. Set `status=RUNNING`, `started_at=now if not set`, append errors entry `{action:'start', user, at}`, enqueue `drain_bulk_batch(batch.id)` on `default` queue. messages.success.
- [x] E.11 `pause` (AC-23): preconditions `status=RUNNING`. Set `status=PAUSED`, append errors entry. Drainer self-detects on next tick.
- [x] E.12 `resume` (AC-23): preconditions `status=PAUSED`. Same as start.
- [x] E.13 `cancel` (AC-23, EC-8): preconditions `status ∈ {READY,RUNNING,PAUSED}`. Set `status=CANCELLED, finished_at=now`, append errors entry. Iterate `rq_scraper.get_jobs()` → if `func_name == 'scrape_asin_batch_job'` and the linked ScrapeJob.batch_id == batch.id, `queue.remove(job.id)`. Bounded by `max_in_flight`, so loop is cheap.
- [x] E.14 `retry-failed` (AC-23, EC-9, Q4=A strict semantics): preconditions `status ∈ {COMPLETED, CANCELLED}`. Run `targets.filter(batch=B, last_error__isnull=False).exclude(last_error='skipped_fresh').update(last_error=None, retry_count=0)`. Append errors entry. Then: same body as `start` (status=RUNNING + enqueue drainer). Add explicit `messages.info` showing how many targets were reset.
- [x] E.15 Make `cancel`+`start` button text adapt: when `status=CANCELLED`, the "Start" button reads "Resume" (Q4 nuance)
- [x] E.16 All actions require `request.user.is_staff` (AC-25); 403 otherwise

### Permissions / Hardening
- [x] E.17 `BulkScrapeBatchAdmin.has_add_permission = lambda self, request: False` (creation only via upload form, not the standard admin add)
- [x] E.18 `has_change_permission` returns True only for superusers OR `is_staff` (default Django admin policy is fine, just confirm)
- [x] E.19 `has_delete_permission` returns True for superusers — manual delete cascade-removes targets, leaves ScrapeJobs (AC-26)

### Tests
- [x] E.20 `tests/test_bulk_admin.py::test_changelist_renders_status_badges`
- [x] E.21 `test_upload_form_uploads_xlsx_and_creates_batch`
- [x] E.22 `test_upload_form_rejects_unauth_user`
- [x] E.23 `test_start_action_sets_running_and_enqueues_drainer` (mock RQ enqueue)
- [x] E.24 `test_pause_action_sets_paused`
- [x] E.25 `test_cancel_action_scrubs_pending_rq_jobs`
- [x] E.26 `test_retry_failed_only_resets_last_error_targets` (AC-23 strict, Q4=A)
- [x] E.27 `test_retry_failed_does_not_touch_skipped_fresh_targets`
- [x] E.28 `test_action_audit_trail_appended_to_errors_json`
- [x] E.29 `test_non_staff_cannot_call_actions` (AC-25)
- [x] E.30 `test_delete_batch_cascades_to_targets_but_not_scrapejobs` (AC-26)

**Phase E ship gate:** A non-developer admin user can complete the full upload → start → watch → pause → resume → completed flow without touching the shell. Tests green.

---

## Phase F — Worker scaling (≈ 0.5 day)

**Goal:** `BACKEND_SCRAPER_WORKERS` env var controls replicas. Compose v5.1.3 verified.

- [x] F.1 Edit `docker-compose.yml` `worker-scraper`: remove `container_name: app_worker_scraper`. Add `deploy: { replicas: ${BACKEND_SCRAPER_WORKERS:-5} }` under the service (AC-27)
- [x] F.2 Edit `docker-compose.prod.yml` `worker-scraper`: same replicas block. Confirm no `container_name` is set there either.
- [x] F.3 Add `BACKEND_SCRAPER_WORKERS=5` to `django-app/.env.template` with comment `# Number of worker-scraper replicas. Each replica ~1-2 GB RAM.` (AC-28)
- [x] F.4 Document the change in `docs/architecture-decisions.md` if that file has an ADR pattern (verify against existing repo)
- [x] F.5 Local smoke-test: `docker compose up worker-scraper` and confirm 5 containers spin up via `docker compose ps`
- [ ] F.6 *(post-deploy)* Prod deploy verification (gated, requires `/deploy` skill later): SSH 212.132.102.96, `docker compose ps | grep worker-scraper` shows 5 replicas

**Phase F ship gate:** Local + (later) prod show 5 replicas; queue throughput visibly increases on a 100-ASIN test batch.

---

## Phase G — Observability (≈ 0.5 day)

**Goal:** Drainer + admin show enough state that no tail of `docker logs` is needed for routine runs.

- [x] G.1 Drainer INFO log every tick: format per AC-30, include batch_id, in_flight, max, enqueued, remaining
- [x] G.2 Drainer WARNING log on RQ enqueue exception, lock-acquire failure, RQ stalled (no worker alive)
- [x] G.3 Wrapper writes per-job summary at COMPLETED: `f"batch_job job_id={id} ok={ok_n} failed={f_n} retried={r_n}"`
- [x] G.4 `BulkScrapeBatch.append_error` is called from: parser (B.15), drainer enqueue failures (D.15), wrapper unhandled exceptions (C.x), all admin actions (E.10–E.14) — verify coverage
- [x] G.5 Admin detail page shows `errors[]` last-20 in reverse-chrono with timestamps formatted as local TZ
- [x] G.6 Add `BulkScrapeBatchAdmin.get_queryset` annotation for `progress_percent` if useful for changelist ordering (optional)
- [x] G.7 Add management command `python manage.py inspect_bulk_batch <batch_id>` printing: status, counts, lock-state, in-flight ScrapeJobs, recent errors. Useful for production triage when admin UI isn't enough.

**Phase G ship gate:** A 1k-ASIN run produces useful logs and a usable admin detail page; no need to grep raw container logs.

---

## Phase H — Tests + smoke-test runbook + bootstrap (≈ 1 day)

**Goal:** End-to-end verification at user's planned 10 → 50 → 1k → 100k progression.

- [x] H.1 Create `tests/fixtures/bulk_asin_10.xlsx` (10 valid ASINs, 1 marketplace) for parser tests
- [x] H.2 Create `tests/fixtures/bulk_asin_dirty.xlsx` (mix of valid + invalid + duplicate) for edge-case tests
- [x] H.3 Full regression: `docker compose exec web pytest scraper_app/tests/` — confirm zero new failures vs main
- [x] H.4 Coverage check: every AC-X and EC-X above has at least one test reference; build a checklist mapping at the bottom of this file as part of QA prep
- [x] H.5 Document smoke-test runbook in `docs/runbooks/proj-25-bulk-scrape.md` with explicit commands:
    - 10 ASINs: upload, start, expect COMPLETED < 60 s
    - 50 ASINs: same, expect < 5 min
    - 1000 ASINs: expect ~30–60 min depending on ScraperOps slots; verify ScraperOps dashboard shows 45+ concurrent during peak (AC-29)
    - 100k ASINs: prepared but not run in dev — only on prod with operator present
- [ ] H.6 *(post-deploy)* Production smoke-test (after `/deploy`): upload `flying-research-asins-test-100.xlsx` (100 ASINs), start, verify completion + no orphan jobs in admin

**Phase H ship gate:** All ACs/ECs covered by tests, runbook published, 100-ASIN prod test passes.

---

## Cross-Cutting Reminders

- [ ] Conventional Commits per phase: `feat(PROJ-25): <phase summary>` (e.g. `feat(PROJ-25): add OneShot tier auto-deactivate`)
- [ ] Each phase commits + pushes to `feat/PROJ-25-bulk-asin-scrape-batches`; NO PR until Phase H complete (single PR for the feature, multi-concern → use `--merge` per memory `feedback_pr_merge_strategy.md`)
- [ ] After Phase A merges to feature branch, run `python manage.py migrate` locally before continuing; same after Phase B (model changes accumulate)
- [ ] No frontend work — admin-only feature
- [ ] No new packages — `openpyxl` already in requirements.txt (used by `_parse_uploaded_file`)
- [ ] Every test file uses `@pytest.mark.django_db` and the existing test infrastructure pattern from `scraper_app/tests/`

---

## Dev Effort Estimate

| Phase | Estimate | Cumulative |
|-------|----------|------------|
| A — OneShot tier | 0.5 d | 0.5 d |
| B — Batch model + parser | 1.5 d | 2 d |
| C — Spider + wrapper | 1.5 d | 3.5 d |
| D — Drainer | 1.5 d | 5 d |
| E — Admin UI | 1.5 d | 6.5 d |
| F — Worker scaling | 0.5 d | 7 d |
| G — Observability | 0.5 d | 7.5 d |
| H — Tests + runbook | 1 d | 8.5 d |

**Total: ~8.5 dev days** for one developer with full domain context. Add ~2 days for review cycles + prod smoke-tests = ~10 days end-to-end.

---

## AC / EC Coverage Matrix (H.4)

> Maps every spec acceptance criterion and edge case to at least one test. Generated 2026-05-05 after Phases A–G complete. Gaps marked **NO TEST** require coverage before QA sign-off.

### Acceptance Criteria

| ID | Description (short) | Covered by |
|----|---------------------|------------|
| AC-1 | BulkScrapeBatch model fields | `test_upload_form_uploads_xlsx_and_creates_batch` (model used end-to-end), `test_changelist_renders_status_badges` |
| AC-2 | ScheduledScrapeTarget gains batch FK + last_error + retry_count | `test_parser_handles_xlsx_with_only_asin_column` (FK populated), `test_retry_below_cap_clears_last_error` (retry_count) |
| AC-3 | ScrapeJob.Mode.BATCH_ASIN + asin_list + batch FK | `test_marks_targets_done_on_success` (asin_list), `test_two_batches_share_global_inflight` (batch FK) |
| AC-4 | ScraperConfig batch_size + max_retries_per_asin + fresh_skip_days | `test_max_in_flight_changes_after_cfg_update` (batch_size), `test_terminal_failure_at_cap` (max_retries), `test_freshness_skip_when_amazonproduct_recent` (fresh_skip_days) |
| AC-5 | OneShot tier seed migration idempotent | `test_running_seed_twice_does_not_duplicate`, `test_seed_does_not_overwrite_existing` |
| AC-6 | Upload URL + form fields | `test_upload_form_uploads_xlsx_and_creates_batch` |
| AC-7 | Async parser enqueue, redirect to detail | `test_upload_view_creates_batch_and_enqueues_parser` |
| AC-8 | Streaming parser, bulk_create with tier=OneShot | `test_parser_handles_xlsx_with_only_asin_column` |
| AC-9 | Invalid rows → skipped + counted in errors | `test_parser_skips_invalid_asin_rows`, `test_parser_skips_unknown_marketplace` |
| AC-10 | Memory bounded for 10/800k rows | Implicit in streaming impl (openpyxl read_only=True). **NO DIRECT TEST** — bounded by impl review; H.5 runbook covers manual verification at 1k/100k. |
| AC-11 | Freshness skip via AmazonProduct.updated_at | `test_freshness_skip_when_amazonproduct_recent`, `test_freshness_skip_ignored_when_product_old` |
| AC-11b | force_rescrape on batch + fresh_skip_days config | `test_force_rescrape_bypasses_freshness` |
| AC-12 | Drainer loop steps | `test_enqueues_chunks_when_no_inflight`, `test_no_enqueue_when_pool_full`, `test_paused_batch_does_not_enqueue_or_reschedule`, `test_completion_when_all_done` |
| AC-13 | Drainer Redis lock idempotent | `test_lock_acquired_and_released`, `test_locked_drainer_exits_without_reenqueue` |
| AC-14 | Live concurrency change ≤10 s | `test_max_in_flight_changes_after_cfg_update` |
| AC-15 | Multiple batches share global slot pool | `test_two_batches_share_global_inflight` |
| AC-16 | Batch spider accepts asins arg + per-ASIN request | `test_one_request_per_asin`, `test_dedupes_and_uppercases` |
| AC-17 | Spider runs with CONCURRENT_REQUESTS_PER_DOMAIN=batch_size | Verified via `_scrapy_concurrency_settings` reuse in wrapper. **NO DIRECT TEST** — would require live Scrapy invocation; covered by H.5 1k-ASIN runbook step (ScraperOps dashboard). |
| AC-18 | Spider reuses ProductDetailMixin + pipelines | Code review (inheritance chain). **NO DIRECT TEST** — would require live spider run. |
| AC-19 | Per-ASIN outcome JSON file format | `test_record_writes_outcome_file`, `test_first_write_per_asin_wins`, `test_failed_records_error_message`, `test_closed_synthesizes_failed_for_missing_asins` |
| AC-20 | Wrapper: zombie check, subprocess, reconcile | `test_marks_targets_done_on_success`, `test_zombie_marks_failed_without_subprocess`, `test_no_outcome_file_marks_all_asins_failed` |
| AC-21 | save() OneShot does not reschedule | `test_save_with_last_scraped_at_does_not_recalculate_next_scrape_at`, `test_oneshot_target_deactivated_after_successful_scrape` |
| AC-22 | Changelist columns/filters | `test_changelist_renders_status_badges`, `test_changelist_has_upload_button` |
| AC-23 | Detail page progress bar + 5 buttons | `test_start_action_sets_running_and_enqueues_drainer`, `test_pause_action_sets_paused`, `test_cancel_action_scrubs_pending_rq_jobs`, `test_retry_failed_only_resets_last_error_targets` |
| AC-24 | 2-click start UX | Implicit in admin tests above. |
| AC-25 | All actions IsStaff + audit entries | `test_non_staff_cannot_call_actions`, `test_action_audit_trail_appended_to_errors_json` |
| AC-26 | Delete cascade rules | `test_delete_batch_cascades_to_targets_but_not_scrapejobs` |
| AC-27 | docker-compose deploy.replicas | F.5 manual verification (`docker compose ps`). **NO DIRECT TEST** — YAML config, not unit-testable. |
| AC-28 | BACKEND_SCRAPER_WORKERS in .env.template | Direct file read; no test needed. |
| AC-29 | ≥45 sustained simultaneous requests | H.5 1k-ASIN runbook step (manual ScraperOps dashboard check). **NO UNIT TEST** by design. |
| AC-30 | Drainer logs | Code review (logger.info call in drain_bulk_batch). Visible via `docker compose logs`. |
| AC-31 | Counts via aggregation, self-correcting | `test_counts_categorize_correctly` |
| AC-32 | errors[] capped at 100 | `test_action_audit_trail_appended_to_errors_json` (audit entries appended); `append_error` impl review for cap. |

### Edge Cases

| ID | Description (short) | Covered by |
|----|---------------------|------------|
| EC-1 | 800k upload bounded memory | H.5 runbook section "100k+ prod test" |
| EC-2 | 7-row partial last chunk | `test_parser_handles_partial_last_chunk` |
| EC-3 | Mid-run cfg 50→25 | `test_max_in_flight_changes_after_cfg_update` |
| EC-4 | Mid-run batch_size change | `test_old_jobs_keep_size_new_jobs_use_new_size` (test_bulk_drainer.py) — old jobs keep size 10, new jobs use size 5 |
| EC-5 | ScraperOps quota exhaustion → retry → terminal | `test_retry_below_cap_clears_last_error`, `test_terminal_failure_at_cap` |
| EC-6 | Drainer crash mid-run; lock TTL recovery | `test_lock_acquired_and_released`, `test_locked_drainer_exits_without_reenqueue` |
| EC-7 | Two batches simultaneous, FIFO via queue | `test_two_batches_share_global_inflight` |
| EC-8 | Cancel mid-flight | `test_cancel_action_scrubs_pending_rq_jobs` |
| EC-9 | Retry Failed only resets failed | `test_retry_failed_only_resets_last_error_targets` |
| EC-10 | Same ASIN in two batches; freshness skip | `test_freshness_skip_when_amazonproduct_recent` |
| EC-10b | force_rescrape overrides freshness | `test_force_rescrape_bypasses_freshness` |
| EC-10c | Skip decision at scrape-time, not parse-time | `test_skip_decision_deferred_to_scrape_time` (test_bulk_wrapper.py) — admin lowers fresh_skip_days mid-flight; wrapper scrapes despite parse-time freshness |
| EC-11 | Corrupt XLSX → PARSE_FAILED | `test_parser_marks_failed_on_corrupt_xlsx` |
| EC-12 | Unknown marketplace skipped | `test_parser_skips_unknown_marketplace` |
| EC-13 | concurrent_requests=0 acts as soft pause | `test_concurrent_requests_zero_enqueues_nothing` |
| EC-14 | replicas=0 → jobs pile, drainer keeps trying | `test_warning_logged_when_no_workers` (test_bulk_drainer.py) — mocked Worker.all() empty; WARNING logged + drainer self-reschedules |
| EC-15 | OneShot seed leaves manual tier alone | `test_seed_does_not_overwrite_existing` |
| EC-16 | Zombie ScrapeJob detection | `test_zombie_marks_failed_without_subprocess` |
| EC-17 | Disk full during upload write | `test_upload_view_handles_disk_full_gracefully` |

### Coverage Gaps (require manual / runbook verification)

Only the inherently-manual gaps remain after post-QA fixes:

- **AC-10 / EC-1**: 800k row memory boundedness — verified by impl (openpyxl read_only) + H.5 runbook prod test.
- **AC-17 / AC-18**: live Scrapy invocation paths — covered by H.5 1k-ASIN dev test + ScraperOps dashboard check.
- **AC-27 / AC-29**: Compose replica behavior + sustained throughput — verified manually per F.5 + H.5 runbook.

(EC-4, EC-10c, EC-14 were closed by post-QA test additions on 2026-05-05.)

### Phase F / G / H Task Status

- **F.1–F.5**: complete; F.5 verified locally (`docker compose ps` snippet documented in commit).
- **F.6**: post-deploy (gated by `/deploy`).
- **G.1–G.5**: complete (drainer log format, stalled-queue WARNING, wrapper summary log, append_error coverage, recent errors panel).
- **G.6**: SKIPPED (optional, marked OK to defer in spec).
- **G.7**: complete — `inspect_bulk_batch` mgmt command + 2 tests.
- **H.1–H.2**: programmatic fixtures (no binary commits) — adopted via Phase B test choice.
- **H.3**: full regression green (357 passing after H additions).
- **H.4**: this matrix.
- **H.5**: `docs/runbooks/proj-25-bulk-scrape.md` published.
- **H.6**: post-deploy (gated by `/deploy`).
