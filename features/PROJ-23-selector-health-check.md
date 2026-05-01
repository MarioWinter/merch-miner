# PROJ-23: Selector Health Check Spider

## Status: In Review
**Created:** 2026-05-01
**Last Updated:** 2026-05-01

## Summary
Periodic control spider that fetches the full HTML of a reference Amazon detail page ("Canary ASIN") per marketplace, saves it as a snapshot file, runs every selector defined in `scraper_app/selectors.py` against it, and writes a per-field health report (`OK` / `EMPTY`) to a new `SelectorHealthCheck` model. Surfaces Amazon layout drift before silent failures pollute the niche pipeline.

## Dependencies
- Requires: PROJ-16 (Amazon Product Scraper) — reuses `selectors.py`, ScraperOps middleware, `worker-scraper` queue

## User Stories
- As a developer, I want to know within a week when Amazon changes a detail-page selector so I can patch the spider before niche research returns empty data.
- As an admin, I want to add/disable canary ASINs per marketplace through the admin UI so I don't need a code deploy to change the test target.
- As an admin, I want to trigger a health check on demand from the admin so I can verify a fix immediately after editing `selectors.py`.
- As a developer, I want the report to flag `BSR_MISSING` only as INFO when the page genuinely has no BSR block, but as a real failure when the BSR container exists and selectors return zero matches.
- As an ops engineer, I want old HTML snapshots auto-pruned so the media volume doesn't grow unbounded.

## Acceptance Criteria

### Canary Management
- [ ] AC-1: New model `CanaryAsin` with fields: `id`, `asin` (10-char), `marketplace` (FK/choice from `MarketplaceChoices`), `label` (free text, e.g. "MBA T-Shirt EN"), `active` (bool, default True), `created_at`, `updated_at`.
- [ ] AC-2: Unique constraint on `(asin, marketplace)`.
- [ ] AC-3: Admin list shows: asin, marketplace, label, active, last_check_at (computed from latest SelectorHealthCheck), last_status (PASS/FAIL).
- [ ] AC-4: Admin allows multiple canaries per marketplace (e.g. apparel + non-apparel).

### Health Check Run
- [ ] AC-5: New Scrapy spider `amazon_html_snapshot` fetches `https://<base>/dp/<asin>/`, identical request setup as `amazon_product` spider (same UA, ScraperOps proxy, headers).
- [ ] AC-6: Spider saves the raw `response.text` to `MEDIA_ROOT/snapshots/<marketplace>/<asin>_<UTC-ISO-timestamp>.html`.
- [ ] AC-7: After save, an audit function loads `selectors.py['detail']` and executes each selector against the saved HTML using the same `parsel.Selector` API Scrapy uses.
- [ ] AC-8: Audit produces per-field result `{field_name: 'OK' | 'EMPTY' | 'INFO'}` covering: title, brand, price, stars, rating_count, feature_bullets, bsr, description, date_first_available, image_gallery, variants.
- [ ] AC-9: BSR is reported as `INFO` (not failure) when none of the 4 BSR strategies match AND no BSR-block-indicator (`#detailBullets_feature_div`, `ul.zg_hrsr`, table row containing "Best Sellers Rank") is present in the HTML; otherwise `EMPTY`.

### Storage & Retention
- [ ] AC-10: New model `SelectorHealthCheck` with fields: `id`, `canary` (FK CanaryAsin), `run_at`, `html_path` (relative), `html_size_bytes`, `results` (JSONField), `passed` (bool — True iff no field is `EMPTY`), `triggered_by` (`'schedule'|'admin'|'cli'`), `error_message` (nullable for spider crashes).
- [ ] AC-11: After a successful run, only the latest 12 snapshot files per `(asin, marketplace)` are kept on disk; older files are deleted; corresponding `SelectorHealthCheck` rows keep their metadata but `html_path` is nulled when the file is pruned.
- [ ] AC-12: Retention runs synchronously at the end of each successful health-check job (not as a separate cron).

### Triggering
- [ ] AC-13: django-rq scheduler enqueues one health-check job per active `CanaryAsin` once per week (default Mondays 04:00 UTC), using `worker-scraper` queue.
- [ ] AC-14: Admin action `Run health check now` on `CanaryAsin` enqueues the job immediately and shows a success message with the SelectorHealthCheck ID.
- [ ] AC-15: Management command `python manage.py run_selector_health_check --canary-id <uuid>` exists for manual/CI use; defaults to all active canaries when no ID passed.

### Admin Visibility
- [ ] AC-16: `SelectorHealthCheck` admin list shows: canary, run_at, passed (with green/red badge), failed_field_count, html_size_kb, triggered_by — sortable by run_at desc.
- [ ] AC-17: Detail view shows full JSON `results` plus a download link to the HTML snapshot when `html_path` is still present.
- [ ] AC-18: Filter by `passed`, `triggered_by`, `canary__marketplace`.

### Reliability
- [ ] AC-19: If the spider request fails (HTTP 4xx/5xx, ScraperOps quota, timeout), a `SelectorHealthCheck` row is still created with `passed=False`, `error_message` populated, no `html_path`.
- [ ] AC-20: A failed health-check job logs at WARNING level with the canary label so it's visible in container logs.
- [ ] AC-21: Multiple concurrent runs against the same canary are allowed (no locking) — duplicates are acceptable, easier to reason about than serialization bugs.

## Edge Cases
- [ ] EC-1: ASIN deleted from Amazon (404) → spider gets 404, audit not run, SelectorHealthCheck row written with `passed=False`, `error_message='HTTP 404'`.
- [ ] EC-2: Amazon serves CAPTCHA / Robot Check page → audit will mark almost all selectors EMPTY → `passed=False` (correctly flags it as a problem to investigate, even if root cause is bot detection).
- [ ] EC-3: Canary product genuinely lacks BSR (e.g. brand-new listing) → field reported as `INFO`, does NOT flip `passed` to False.
- [ ] EC-4: Selector cascade: if any selector in a fallback list (e.g. brand, stars, rating_count) returns a value, the field is `OK` regardless of which fallback matched. The audit does NOT validate that the *primary* selector worked, only that the field was extractable.
- [ ] EC-5: Disk full or write error during snapshot save → SelectorHealthCheck created with `passed=False`, `error_message`, no audit run.
- [ ] EC-6: `selectors.py` is edited to add a new field → audit picks it up automatically on next run (audit reads the dict, doesn't hardcode field names).
- [ ] EC-7: Two canaries with the same ASIN on different marketplaces → independent runs, independent snapshot directories, no collision.
- [ ] EC-8: User deactivates a canary mid-week → scheduled job skips it on next run; existing reports remain visible.
- [ ] EC-9: Snapshot retention deletion fails (file locked, permission error) → log WARNING, do NOT fail the health-check run.

## Out of Scope (deferred)
- Diff viewer between snapshots (Scope C — could come later)
- Email/Slack alerts on failure (Scope C)
- Per-field semantic SUSPECT heuristics (e.g. "brand looks like title" detection) — only OK/EMPTY/INFO in MVP
- Health checks for the search-page selectors (`search_page` section in `selectors.py`) — only `detail` section in MVP
- Auto-rollback or auto-fix of broken selectors

## Technical Requirements
- Snapshot files are HTML (~500KB-2MB each); 12 snapshots × N canaries × M marketplaces = bounded ≤ ~250MB realistic upper limit.
- Audit must use the same selector engine Scrapy uses (`parsel.Selector(text=html)`) so results match production behavior exactly.
- Spider runs in `worker-scraper` queue; uses ScraperOps proxy; respects existing rate limits — no new infra.
- Settings: env-overridable `SELECTOR_HEALTH_CHECK_RETENTION` (default 12), `SELECTOR_HEALTH_CHECK_SCHEDULE_CRON` (default `0 4 * * 1`).

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Approach
Lives entirely inside the existing `scraper_app` — no new Django app, no new infrastructure. Reuses the production Scrapy machinery (settings, ScraperOps middleware, `worker-scraper` queue), the production selector dictionary (`scraper_app/selectors.py`), and the existing django-rq scheduler. Two new database tables, one new spider, one new audit helper module, one extension to the admin.

### Component Map (where things live)

```
django-app/scraper_app/
+-- models.py                     # + CanaryAsin, + SelectorHealthCheck
+-- selectors.py                  # unchanged - audit reads from this
+-- audit.py                      # NEW: run_audit(html, marketplace) -> dict
+-- tasks.py                      # + run_selector_health_check(canary_id, triggered_by)
+-- admin.py                      # + CanaryAsinAdmin, + SelectorHealthCheckAdmin
+-- scrapy_app/spiders/
|   +-- amazon_html_snapshot.py   # NEW spider - 1 request, save raw HTML, no parsing
+-- management/commands/
|   +-- run_selector_health_check.py   # NEW: CLI trigger
|   +-- setup_scheduler.py        # extended: also register weekly health-check
+-- migrations/
|   +-- 00XX_canary_asin_and_health_check.py   # NEW migration
+-- tests/
    +-- test_audit.py             # NEW: golden-HTML fixture-based tests
    +-- test_canary_admin.py      # NEW: admin action triggers job
    +-- test_health_check_task.py # NEW: end-to-end task with mocked spider
```

```
django-app/media/snapshots/
+-- amazon_com/
|   +-- B077GRS3BJ_2026-05-01T04-00-00Z.html
|   +-- B077GRS3BJ_2026-04-24T04-00-00Z.html
|   +-- ...                       # max 12 per ASIN+marketplace
+-- amazon_de/
|   +-- ...
```

### Data Model (plain language)

**`CanaryAsin`** — admin-managed list of reference products to monitor.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | primary key |
| asin | char(10) | Amazon ASIN, validated by `^[A-Z0-9]{10}$` |
| marketplace | choice | from existing `MarketplaceChoices` |
| label | text | free-form, e.g. "MBA T-Shirt EN with BSR" |
| active | bool | default True; inactive canaries skipped by scheduler |
| created_at, updated_at | datetime | auto |
| **Constraint:** unique together `(asin, marketplace)` |

**`SelectorHealthCheck`** — one row per audit run.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | primary key |
| canary | FK → CanaryAsin | on_delete=CASCADE |
| run_at | datetime | auto, indexed desc |
| html_path | text, nullable | relative to MEDIA_ROOT; nulled when file pruned |
| html_size_bytes | int, nullable | size at write time |
| results | JSON | `{"title": "OK", "brand": "OK", "bsr": "INFO", ...}` |
| passed | bool | True iff zero `EMPTY` entries in results |
| triggered_by | choice | `schedule` / `admin` / `cli` |
| error_message | text, nullable | populated on spider/HTTP failure |

### Workflow Sequence

```
Trigger (scheduler / admin button / CLI)
  -> tasks.run_selector_health_check(canary_id, triggered_by)
        -> create SelectorHealthCheck row (passed=False, no html_path yet)
        -> launch CrawlerProcess with amazon_html_snapshot spider
            -> spider fetches /dp/<asin>/ via ScraperOps
            -> on response: write response.text to snapshot file
            -> stash file path on ScrapeJob-equivalent meta
        -> after spider done:
            -> if no file: set error_message, save, return
            -> else: load file, call audit.run_audit(html, marketplace)
                -> for each selector in selectors.get_selectors(marketplace)['detail']:
                    - run via parsel.Selector(text=html)
                    - mark OK / EMPTY / INFO (BSR-specific rules apply)
            -> update SelectorHealthCheck: results, passed, html_path, html_size
        -> retention: glob snapshot dir, keep newest 12, delete rest, null html_path on pruned rows
```

### Tech Decisions

| Decision | Why |
|----------|-----|
| Reuse `scraper_app`, no new app | The functionality is logically a part of the scraper; new app would duplicate Scrapy setup. |
| Use `parsel.Selector` directly in audit | Same engine Scrapy uses; perfect parity between audit and production. No HTTP round-trip needed for audit. |
| File storage under `media/snapshots/` (not DB BLOB) | HTMLs are 0.5-2 MB each; PostgreSQL BYTEA would bloat backups, complicate restore, and slow listing queries. Files are simple to pipe to `grep`/`diff`. |
| Retention runs inline at end of job (not separate cron) | Eliminates a moving part. Bounded work (~12 file deletes), cheap, fails-soft. |
| Weekly schedule via existing rq-scheduler | We already have `setup_scheduler.py` registering hourly jobs — extending it is one block of code. No new infra. |
| `worker-scraper` queue | Health checks share rate-limit budget with normal scrapes — visible in same monitoring, no separate worker needed. |
| BSR has special INFO rule | Avoids alarm fatigue: a brand-new listing legitimately has no BSR. We only flag when the BSR *block* is present but selectors still match nothing. |
| MVP only OK / EMPTY / INFO (no SUSPECT heuristics) | EMPTY catches Amazon layout drift definitively; semantic SUSPECT (e.g. "brand looks like title") is high-noise and can come later. |
| Audit reads field names from `selectors.py` dynamically | Adding a new selector to production automatically extends the audit — no second source of truth. |

### Dependencies (no new packages)
All capabilities exist already:
- `scrapy` + `parsel` (already in requirements)
- `django-rq` + `rq-scheduler` (already in requirements)
- ScraperOps middleware (already configured)
- `MEDIA_ROOT` (already set in settings)

### Settings (env-overridable)
- `SELECTOR_HEALTH_CHECK_RETENTION` (default `12`)
- `SELECTOR_HEALTH_CHECK_SCHEDULE_CRON` (default `0 4 * * 1` — Mon 04:00 UTC)

### Failure Modes & Observability
- Spider failure → row written with `error_message`, container log warning at WARNING level, `passed=False` shown red in admin list.
- Audit succeeds but EMPTY fields → row green/red badge in admin list, JSON viewable on detail page.
- Snapshot file deleted by retention → admin detail still shows the JSON results; download link hidden.

## QA Test Results

**QA Date:** 2026-05-01
**Verdict:** ✅ **PASS** — all 21 ACs + 9 ECs verified, 34 unit tests green, 6 live end-to-end runs against real Amazon (3 PASS canaries on `amazon_com`).
**Branch:** `feature/create-new-features`

### Test Suite
| Suite | Tests | Result |
|-------|-------|--------|
| `scraper_app/tests/test_audit.py` | 11 | ✅ all pass |
| `scraper_app/tests/test_health_check_task.py` | 5 | ✅ all pass |
| `scraper_app/tests/test_retention.py` | 6 | ✅ all pass |
| `scraper_app/tests/test_canary_admin.py` | 12 | ✅ all pass |
| Full `scraper_app/tests/` regression | 280 | 279 pass, 1 pre-existing failure (`test_cancel_job_updates_cache` — unrelated to PROJ-23, predates branch) |

### Live End-to-End Verification (Real Amazon, ScraperOps proxy)
| Canary ASIN | Marketplace | Status | All 11 selectors |
|-------------|-------------|--------|------------------|
| B09WZHW6DN | amazon_com | ✅ PASS | OK |
| B0F24L7GHB | amazon_com | ✅ PASS | OK |
| B0FSGNCR7C | amazon_com | ✅ PASS | OK |

Snapshots persisted to `./media/snapshots/amazon_com/`, sizes 1.4 - 2.0 MB each, 6 files retained at QA time.

### Acceptance Criteria — Per-AC Verification

#### Canary Management
- ✅ **AC-1** `CanaryAsin` fields confirmed via introspection: `id, asin, marketplace, label, active, created_at, updated_at`. ASIN regex validator `^[A-Z0-9]{10}$` enforced in `models.py`.
- ✅ **AC-2** `Meta.unique_together = (('asin', 'marketplace'),)` — verified at runtime + by `test_canary_unique_together_asin_marketplace`.
- ✅ **AC-3** `CanaryAsinAdmin.list_display = ['asin','marketplace','label','active','last_check_at','last_status']`. Computed columns via Subquery prefetch (no N+1).
- ✅ **AC-4** Multiple canaries on `amazon_com` confirmed live: B09WZHW6DN + B0F24L7GHB + B0FSGNCR7C coexist.

#### Health Check Run
- ✅ **AC-5** Spider `amazon_html_snapshot` extends `scrapy.Spider`, emits Accept-Language `en-US,en;q=0.9` (matches production). ScraperOps proxy applied via shared `scrapy_app/settings.py`.
- ✅ **AC-6** Snapshot files written to `MEDIA_ROOT/snapshots/<marketplace>/<asin>_<UTC-ISO>.html`. Filename format verified: `B09WZHW6DN_2026-05-01T08-17-52Z.html`.
- ✅ **AC-7** `audit.run_audit` reads `selectors.get_selectors(marketplace)['detail']` dynamically — adding a new selector key auto-extends the audit. Confirmed by code review of `audit.py:172-219`.
- ✅ **AC-8** Live result example: `{"title":"OK","brand":"OK","bsr":"OK","price":"OK","stars":"OK","rating_count":"OK","feature_bullets":"OK","description":"OK","date_first_available":"OK","images_regex":"OK","variants_regex":"OK"}` — covers all 11 spec'd fields.
- ✅ **AC-9** BSR INFO-vs-EMPTY proven by `test_audit_no_bsr_block_returns_info` + `test_audit_bsr_block_present_but_no_rank_returns_empty`. Real-world hit during testing: ASIN B077GRS3BJ legitimately had no BSR → INFO (not FAIL).

#### Storage & Retention
- ✅ **AC-10** `SelectorHealthCheck` fields confirmed: `id, canary, run_at, html_path, html_size_bytes, results, passed, triggered_by, error_message`. `triggered_by` choices: `['schedule','admin','cli']`.
- ✅ **AC-11** Retention deletes oldest mtime files beyond `keep`, nulls `html_path` on corresponding rows. `test_prune_keeps_newest_n` (15→12 files) + `test_prune_nulls_html_path_on_pruned_rows` (3 rows nulled) prove behavior.
- ✅ **AC-12** Retention is invoked synchronously at the end of `run_selector_health_check` (line 735), not as a separate cron.

#### Triggering
- ✅ **AC-13** Scheduler introspection: `schedule_health_check_runner -> 0 4 * * 1` registered alongside existing `schedule_scrape_runner`. Idempotent re-registration: `setup_scheduler` cancels old jobs first.
- ✅ **AC-14** `Run health check now` admin action enqueues onto `scraper` queue. Tests `test_admin_action_enqueues_health_check` + `test_admin_action_handles_multiple_canaries` pass; live-tested in browser session earlier.
- ✅ **AC-15** Mgmt cmd `run_selector_health_check --help` confirms `--canary-id` and `--inline` flags. No-arg form runs all active canaries. Used 5+ times during this QA session.

#### Admin Visibility
- ✅ **AC-16** `SelectorHealthCheckAdmin.list_display = ['canary','run_at','passed_badge','failed_field_count_display','html_size_kb','triggered_by']`. Default ordering `-run_at`. PASS/FAIL badges rendered with green/red CSS.
- ✅ **AC-17** Detail view shows `results` JSON + `snapshot_link` (Download HTML when file present, "file pruned" when null). `has_add_permission=False` blocks manual creation (`test_health_check_admin_blocks_manual_creation` passes — returns 403).
- ✅ **AC-18** `list_filter = ['passed','triggered_by','canary__marketplace']` — exact match to spec.

#### Reliability
- ✅ **AC-19** Spider failure ⇒ row written with `error_message`, `passed=False`, no `html_path`. Proven by `test_task_spider_failure_writes_error_message` and additional safety net `test_task_creates_row_even_when_spider_crashes`.
- ✅ **AC-20** `logger.warning("Health check FAILED for canary=%s (label=%s)...")` at `tasks.py:691`. Verified visible in stdout during inline runs.
- ✅ **AC-21** No locking around concurrent runs — `run_selector_health_check` does not wrap in `transaction.atomic` nor `select_for_update`. Two concurrent runs against the same canary would each insert their own row, as spec'd.

### Edge Cases — Per-EC Verification
- ✅ **EC-1** (HTTP 404) — Spider `parse_snapshot` checks `response.status >= 400` ⇒ `_mark_error("HTTP 404")`. Code at `amazon_html_snapshot.py:84`.
- ✅ **EC-2** (CAPTCHA / Robot Check) — Audit naturally marks most fields EMPTY ⇒ `passed=False`. Behaviour reviewed and matches spec intent (alarm worth investigating).
- ✅ **EC-3** (no BSR on listing) — `test_task_no_bsr_block_still_passes` confirms `passed=True` despite `bsr=INFO`. Real-world hit: B077GRS3BJ.
- ✅ **EC-4** (cascade semantics) — `test_audit_cascade_only_secondary_match_is_still_ok` confirms OK as long as ANY fallback matches. Audit does NOT validate primary selector specifically.
- ✅ **EC-5** (disk full / write error) — `_save_snapshot` wraps `OSError` ⇒ `_mark_error("Snapshot write failed: ...")`. Code at `amazon_html_snapshot.py:90-92`.
- ✅ **EC-6** (new selector added) — Audit iterates `detail.items()` dynamically. `test_audit_does_not_audit_sub_selectors` exercises the iteration + skip logic.
- ✅ **EC-7** (same ASIN different marketplaces) — `unique_together=(asin,marketplace)`. Snapshot dirs are partitioned per marketplace: `snapshots/amazon_com/`, `snapshots/amazon_de/`, etc.
- ✅ **EC-8** (deactivated mid-week) — `schedule_health_check_runner` filters `active=True`. Manual admin/CLI triggers ignore the active flag (intentional — debugging path).
- ✅ **EC-9** (retention deletion fails) — `_prune_snapshots` wraps unlink in try/except, logs WARNING, never re-raises. `test_prune_failure_does_not_raise` simulates `PermissionError` on first delete.

### Real-World Findings
1. **Description / rating_count are often empty on MBA listings** — discovered when the user's first 3 canaries (B077GWMQGM, B0F24L7GHB, B0GYSZZXW8) returned 2× FAIL. Snapshot inspection proved sellers had not entered descriptions; Amazon renders `<div id="productDescription"></div>` with no `<p>` inside. Audit was technically correct, but `EMPTY` produces alert noise. **Decision (logged):** stay strict for MVP; user picked replacement canaries (B09WZHW6DN, B0FSGNCR7C) with full content. Future enhancement: extend INFO logic to `description` + `rating_count` when their parent containers are empty (parallel to BSR rule).
2. **Pre-existing failing test `test_cancel_job_updates_cache`** — unrelated to PROJ-23, dates back to migration 0012. Not in scope to fix here.

### Issues Found — Non-Blocking / Cosmetic
| Severity | Issue | Status |
|----------|-------|--------|
| LOW | `format_html()` called without args in `admin.py` for static badges — Django 6.0 deprecation warning | ✅ **FIXED** 2026-05-01 — replaced 7 call sites with `mark_safe()`; verified with `pytest -W error::DeprecationWarning` (12/12 admin tests pass, 0 warnings) |
| INFO | Phase 10 of tasks file (Bootstrap & Verification) partially open — only `amazon_com` has live canaries; other 5 marketplaces (`de`, `co_uk`, `fr`, `it`, `es`) have no canaries yet | Open — user-driven, pick one ASIN per marketplace and add via admin |

### Security Audit
- ✅ Auth: admin actions require `IsStaff` (default Django admin). No public endpoints added.
- ✅ Input validation: ASIN regex validator on `CanaryAsin.asin` enforces `^[A-Z0-9]{10}$`; uppercased + stripped on save (`test_canary_asin_uppercase_normalisation`).
- ✅ Path traversal: snapshot filenames built from `(asin, UTC timestamp)` only — no user-controlled path segments. ASIN is regex-validated, marketplace is enum-constrained.
- ✅ No new env-var secrets — only operational tunables (`SELECTOR_HEALTH_CHECK_RETENTION`, cron).
- ✅ No raw SQL added; ORM-only.
- ✅ Snapshot files served via Django `MEDIA_URL` (download link) — already protected by deployment-level access controls; not introduced here.

### Sign-off
PROJ-23 implementation matches the spec end-to-end and is **ready to advance to `In Review` → `/deploy`**. No blocking issues. The two cosmetic issues above can be addressed in a follow-up cleanup pass.

## Deployment
_To be added by /deploy_
