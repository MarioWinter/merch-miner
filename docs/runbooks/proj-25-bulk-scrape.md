# PROJ-25 Bulk ASIN Scrape — Operator Runbook

> Step-by-step procedures for running the bulk ASIN one-shot scrape feature in dev and prod. Always start with the smallest tier (10 ASINs) and only escalate when each step is green.

## Pre-flight (every run, dev or prod)

1. **OneShot tier exists**

   ```
   docker compose exec web python manage.py shell -c "from scraper_app.models import ScrapeTier; print(ScrapeTier.objects.filter(name='OneShot').first())"
   ```

   Expect: a non-`None` tier. If `None`, the migration was missed — re-run `python manage.py migrate scraper_app 0018_seed_oneshot_tier`.

2. **`BACKEND_SCRAPER_WORKERS` set**

   `.env` should have `BACKEND_SCRAPER_WORKERS=N` (default 5 in template). Verify with:

   ```
   docker compose ps | grep worker-scraper
   ```

   Expect: N replicas running.

3. **ScraperConfig values sane**

   Visit `/admin/scraper_app/scraperconfig/` and confirm:
   - `concurrent_requests` — total parallel HTTP slots, e.g. 50
   - `concurrent_requests_per_domain` — usually equal to `concurrent_requests`
   - `download_delay_ms` — typically 0 with ScraperOps
   - `batch_size` — ASINs per spider subprocess, default 10
   - `max_retries_per_asin` — default 1
   - `fresh_skip_days` — default 30; lower this if you genuinely want to re-scrape products updated within the last month

4. **ScraperOps quota**

   Check the ScraperOps dashboard. Estimated quota burn: ~1 request per ASIN per scrape attempt (plus 1 retry per `max_retries_per_asin` for failed ASINs).

## 10-ASIN dev test

**Goal:** prove end-to-end works on dev hardware, bound at < 60 s.

1. Prepare a tiny XLSX (column header `asin`, then 10 valid 10-char ASINs). Or use the test fixture builder in `scraper_app/tests/test_bulk_parser.py`.
2. Open `http://localhost:8000/admin/scraper_app/bulkscrapebatch/` → click **Upload new batch**.
3. Pick the file, name it (e.g. `dev-smoke-10`), select marketplace (`amazon_com`), leave `force_rescrape` unchecked, submit.
4. Browser redirects to the detail page. Refresh: expect `status=READY`, `total_count=10`.
5. Click **Start**.
6. Watch the page; refresh every ~10 s. Expect:
   - `status=RUNNING` immediately
   - `pending_count` decreasing, `running_count` briefly 1
   - `done_count` rising
   - `status=COMPLETED` within ~60 s
7. Spot-check 1 row in `/admin/scraper_app/amazonproduct/` — should have title, brand, price.

If anything stalls: run `docker compose exec web python manage.py inspect_bulk_batch <batch_id>` for a triage report.

## 50-ASIN dev test

Same flow as the 10-ASIN test. Expect `COMPLETED` within ~5 minutes.

If `failed_count > 0`: open detail page → check **Recent errors** panel → typically a single ASIN with `HTTP 503` or similar. Click **Retry Failed** to retry just those rows.

## 1000-ASIN dev test (or first prod test)

**Goal:** verify ScraperConfig saturates ScraperOps slots without overwhelming the server.

1. Upload a 1000-ASIN file. Status flips through `PARSING` → `READY` (parse stays sub-second for 1k rows).
2. Click **Start**. The batch run takes ~30–60 minutes depending on marketplace + ScraperOps slots.
3. **During peak**, verify on the ScraperOps dashboard that ≥45 concurrent requests are sustained for at least 60 seconds (AC-29). With `concurrent_requests=50` and `batch_size=10`, expect 5 jobs in-flight × 10 parallel requests each = 50 concurrent.
4. If concurrent stays low (e.g. <10): the bottleneck is `worker-scraper` replicas — `BACKEND_SCRAPER_WORKERS` may be < `floor(50/10) = 5`.

## 100k+ prod test (gated, operator present)

**Pre-flight (in addition to the universal pre-flight above):**

- SSH to prod (`ssh root@212.132.102.96`), verify disk: `df -h /srv/merch-miner` — need at least ~2 GB free for 100k AmazonProduct rows + indexes.
- Confirm `worker-scraper` replicas are healthy: `docker compose ps worker-scraper` shows N up.
- Confirm `Selector Health Check` (PROJ-23) on `amazon_com` is **green** for the past week — Amazon layout drift would silently turn into mass `failed_count` spikes.

**Run:**

1. Upload via prod admin: `https://merch-miner.io/admin/scraper_app/bulkscrapebatch/upload/`.
2. Status reaches `READY` (parser takes ~30–60 s for 100k rows on prod hardware).
3. Click **Start**.
4. Monitor every ~hour: `inspect_bulk_batch <id>` from prod shell.
5. Watch `failed_count`. Acceptable rate: < 1% terminal failures. If higher: open detail page → Recent errors → diagnose. If ScraperOps quota is the cause, click **Pause**, scale up the plan, click **Resume**.
6. Total completion time at 50 concurrent: roughly `100000 / 50 = 2000 minutes ≈ 33 hours` worst case, often faster due to retry-budget left over.

## Recovery procedures

### Drainer is stalled

Symptoms: `status=RUNNING`, `pending_count > 0`, but no `running_count` movement for > 1 minute.

Diagnose:

```
docker compose exec web python manage.py inspect_bulk_batch <batch_id>
```

Check the **Drainer Lock** section. If `held by` is set with a positive `ttl_secs`, a tick is in progress — wait. If the lock is `not held` AND `running_count == 0`, the drainer task itself died:

1. **Pause then Resume** in the admin to re-enqueue a fresh drainer.
2. If still stalled, manually re-enqueue from the shell:

   ```
   docker compose exec web python manage.py shell -c "
   from scraper_app.tasks import drain_bulk_batch
   drain_bulk_batch('<batch_id>')
   "
   ```

### Zombie ScrapeJob

Symptom: `inspect_bulk_batch` shows a `RUNNING` ScrapeJob whose `pid` is no longer alive (or `started_at` is old, e.g. > 30 min for a 10-ASIN batch).

Wrapper code detects this on next run via the zombie-check guard (EC-16) and marks `FAILED`. To force-resolve immediately:

```
docker compose exec web python manage.py shell -c "
from scraper_app.models import ScrapeJob
ScrapeJob.objects.filter(id='<scrape_job_id>').update(status='failed')
"
```

The drainer's next tick will re-enqueue the affected targets via `retry_count`.

### Soft pause without an explicit Pause click

Set `ScraperConfig.concurrent_requests = 0` in the admin. The drainer's next tick (≤10 s) will compute `max_in_flight = 0` and enqueue nothing. Already-running spiders finish naturally. Set back to a positive value to resume.

This is the canonical way to "throttle to zero" without cancelling the batch (EC-13).

### Lower the throughput mid-run

Set `ScraperConfig.concurrent_requests` to a smaller value (e.g. 50 → 25). Already in-flight spiders run to completion; the drainer's next tick adjusts. AC-14 guarantees this happens within 10 s.

## Post-run cleanup

- Batches are kept as history (AC-26). To delete: superuser only, via admin → cascades to ScheduledScrapeTargets, leaves ScrapeJobs (audit trail).
- Drainer logs in container logs: `docker compose logs worker | grep "drainer batch=<id>"` — useful for post-mortem.
