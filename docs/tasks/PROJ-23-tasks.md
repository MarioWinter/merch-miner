# PROJ-23: Selector Health Check Spider — Tasks

> Implementation order. Each `- [ ]` is a discrete unit of work. Backend-only feature.

## Phase 1 — Models & Migration
- [x] 1.1 Add `CanaryAsin` model to `scraper_app/models.py` (asin, marketplace, label, active, timestamps; unique_together asin+marketplace; ASIN regex validator)
- [x] 1.2 Add `SelectorHealthCheck` model (canary FK, run_at, html_path, html_size_bytes, results JSON, passed, triggered_by choices, error_message)
- [x] 1.3 Index: `SelectorHealthCheck.run_at` desc, `SelectorHealthCheck.canary` FK
- [x] 1.4 Add `triggered_by` choices constant (TextChoices: SCHEDULE, ADMIN, CLI)
- [x] 1.5 Generate migration `python manage.py makemigrations scraper_app`
- [x] 1.6 Apply migration locally `python manage.py migrate`

## Phase 2 — Audit Module
- [x] 2.1 Create `scraper_app/audit.py` with `run_audit(html: str, marketplace: str) -> dict` returning `{field: 'OK'|'EMPTY'|'INFO'}`
- [x] 2.2 Build a `parsel.Selector` from the html string
- [x] 2.3 Iterate every key in `selectors.get_selectors(marketplace)['detail']` and execute it against the selector
- [x] 2.4 Handle list-of-selectors (cascade fields like `brand`, `stars`, `rating_count`, `feature_bullets`, `description`): OK if ANY fallback returns text
- [x] 2.5 Handle regex fields (`images_regex`, `variants_regex`): run regex on raw html; OK if match found
- [x] 2.6 BSR-specific logic: run all 4 BSR strategies; if all empty, check for BSR-block-indicator (`#detailBullets_feature_div`, `ul.zg_hrsr`, table row containing "Best Sellers Rank") → INFO if absent, EMPTY if present
- [x] 2.7 Helper `_has_bsr_block(selector) -> bool` for the indicator check
- [x] 2.8 Skip non-selector keys (e.g. `bsr_category_link` is sub-selector, `sponsored_indicator` is regex literal — exclude from audit)

## Phase 3 — Snapshot Spider
- [x] 3.1 Create `scraper_app/scrapy_app/spiders/amazon_html_snapshot.py` extending `scrapy.Spider`
- [x] 3.2 Accept `asin`, `marketplace`, `health_check_id` as init kwargs
- [x] 3.3 `start_requests` yields one Request to `<base>/dp/<asin>/` with same UA/headers as `amazon_product` spider (use existing settings)
- [x] 3.4 `parse` callback: write `response.text` to `MEDIA_ROOT/snapshots/<marketplace>/<asin>_<UTC-iso>.html` (mkdir parents=True, exist_ok=True)
- [x] 3.5 Persist relative path + size onto the SelectorHealthCheck row
- [x] 3.6 On HTTP error (handled via Scrapy errback): write `error_message` to the row, no html_path

## Phase 4 — Task & Retention
- [x] 4.1 Add `run_selector_health_check(canary_id, triggered_by)` to `scraper_app/tasks.py`
- [x] 4.2 Create the SelectorHealthCheck row up-front (passed=False placeholder)
- [x] 4.3 Launch CrawlerProcess with `amazon_html_snapshot` spider, passing `health_check_id`
- [x] 4.4 After spider finishes: re-fetch the row, if `html_path` set then load file + call `audit.run_audit`, populate `results` + `passed`
- [x] 4.5 Retention helper `_prune_snapshots(asin, marketplace, keep=12)`: glob the snapshot dir, sort by mtime desc, delete files beyond `keep`, null `html_path` on pruned rows via SelectorHealthCheck.objects.filter(html_path__in=...).update(html_path=None)
- [x] 4.6 Read `SELECTOR_HEALTH_CHECK_RETENTION` from settings (default 12)
- [x] 4.7 Wrap retention in try/except; log WARNING on failure but never re-raise

## Phase 5 — Scheduler Registration
- [x] 5.1 Extend `scraper_app/management/commands/setup_scheduler.py` to also register a weekly job that iterates active canaries and enqueues one health-check job per canary
- [x] 5.2 New helper `scraper_app/tasks.py::schedule_health_check_runner` (mirror of existing `schedule_scrape_runner`)
- [x] 5.3 Cron expression read from `SELECTOR_HEALTH_CHECK_SCHEDULE_CRON` env var (default `0 4 * * 1`)
- [x] 5.4 Use `scheduler.cron(...)` API (rq-scheduler supports cron strings)
- [x] 5.5 Cancel any existing instance of `schedule_health_check_runner` before re-registering (idempotent re-run of the command)

## Phase 6 — Management Command
- [x] 6.1 Create `scraper_app/management/commands/run_selector_health_check.py`
- [x] 6.2 Argument `--canary-id <uuid>` runs that single canary
- [x] 6.3 No argument → enqueue all active canaries
- [x] 6.4 Pass `triggered_by='cli'`
- [x] 6.5 Print resulting SelectorHealthCheck IDs to stdout

## Phase 7 — Admin Integration
- [x] 7.1 Register `CanaryAsinAdmin` in `scraper_app/admin.py` (list: asin, marketplace, label, active, last_check_at, last_status; list_filter active+marketplace)
- [x] 7.2 SerializerMethodField equivalents `last_check_at` / `last_status` via prefetched latest SelectorHealthCheck
- [x] 7.3 Admin action `Run health check now` — enqueues `run_selector_health_check(canary.id, 'admin')` per selected row, success message with new SelectorHealthCheck IDs
- [x] 7.4 Register `SelectorHealthCheckAdmin` (list: canary, run_at, passed badge, failed_field_count, html_size_kb, triggered_by; filters: passed, triggered_by, canary__marketplace; readonly fields: results, html_path, run_at)
- [x] 7.5 `failed_field_count` computed from results JSON (count of EMPTY)
- [x] 7.6 `passed` rendered with green/red colored badge using `format_html`
- [x] 7.7 Detail view shows download link to snapshot file when `html_path` is not null and file exists

## Phase 8 — Settings & Env
- [x] 8.1 Add `SELECTOR_HEALTH_CHECK_RETENTION` and `SELECTOR_HEALTH_CHECK_SCHEDULE_CRON` to `core/settings.py` reading from env with sensible defaults
- [x] 8.2 Document the two env vars in `django-app/.env.template`
- [x] 8.3 Confirm `MEDIA_ROOT/snapshots/` is writable in dev + prod containers (volume mount check)

## Phase 9 — Tests
- [x] 9.1 `tests/test_audit.py`: capture a real B077GRS3BJ HTML snapshot once, save as fixture, assert `run_audit` returns expected per-field statuses
- [x] 9.2 Synthetic fixture: HTML with NO BSR block at all → bsr=INFO, passed=True
- [x] 9.3 Synthetic fixture: HTML with `#detailBullets_feature_div` but no rank inside → bsr=EMPTY, passed=False
- [x] 9.4 Synthetic fixture: HTML with empty `#productTitle` → title=EMPTY, passed=False
- [x] 9.5 `tests/test_health_check_task.py`: mock `CrawlerProcess` to write a fixture HTML, run task, assert SelectorHealthCheck row populated correctly
- [x] 9.6 `tests/test_health_check_task.py`: error path — spider fails, row has `error_message`, `passed=False`, no `html_path`
- [x] 9.7 `tests/test_retention.py`: create 15 snapshot files, run `_prune_snapshots`, assert exactly 12 remain (newest), 3 SelectorHealthCheck rows have `html_path` nulled
- [x] 9.8 `tests/test_canary_admin.py`: log in as admin, trigger `Run health check now` action via Django test client, assert RQ job enqueued (mock `django_rq.get_queue`)
- [x] 9.9 All new tests pass with `docker compose exec web pytest scraper_app/tests/test_audit.py scraper_app/tests/test_health_check_task.py scraper_app/tests/test_retention.py scraper_app/tests/test_canary_admin.py`

## Phase 10 — Bootstrap & Verification
- [ ] 10.1 Seed one canary for each of the 6 marketplaces via Django shell or data-migration (asin TBD per marketplace; for amazon_com use B077GRS3BJ)
- [ ] 10.2 Run `python manage.py setup_scheduler` to register the weekly job
- [ ] 10.3 Run `python manage.py run_selector_health_check` to verify end-to-end with seeded canaries
- [ ] 10.4 Inspect admin: SelectorHealthCheck list shows fresh rows, snapshot files visible under `media/snapshots/`
- [ ] 10.5 Verify retention: trigger 13 manual runs against one canary, confirm only 12 files remain
- [ ] 10.6 Update `features/INDEX.md`: PROJ-23 status to "In Review" once all above is green
