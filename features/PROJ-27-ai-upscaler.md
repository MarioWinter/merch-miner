# PROJ-27: AI Upscaler — Single + Bulk via Replicate

## Status: Planned
**Created:** 2026-05-07
**Last Updated:** 2026-05-07

## Summary
External-API based AI upscaling service that turns Gemini-generated POD designs (typically 1024×1024) into print-ready 4500×5400 PNGs for Merch by Amazon. Replaces the legacy `Pica.js` + `auto-threshold` upscale tool from PROJ-9. Supports Single mode (one design in Image Editor) and Bulk mode (multi-selected designs in Project Artboard Canvas). All processing happens server-side via Replicate; users can close the UI while jobs run.

## Dependencies
- Requires: PROJ-9 (Design Generation) — `Design`, `DesignProcessingJob`, `ProcessingSettings` models, Image Editor entry point, Project Artboard Canvas
- Requires: PROJ-4 (Workspace & Membership) — workspace-scoped quotas + member roles
- Requires: PROJ-1 (User Auth) — `is_staff` / `is_superuser` checks for unlimited quota
- Replaces: PROJ-9 "AI Upscale" tool (Pica.js client-side + auto-threshold) — fully deprecated

## User Stories
- As a Member, I want to click "Upscale" on a single design in the Image Editor and get a 4500×5400 PNG back, so I can publish it on MBA without manual resizing.
- As a Member, I want to multi-select N designs in the Project Artboard Canvas and trigger a Bulk-Upscale, so I can prepare a whole product line in one click.
- As a Member, I want to close the browser tab during a long bulk run and find the upscaled designs ready when I come back, so my workflow is not blocked.
- As a Member, I want to see partial-success results when a bulk run has failures (e.g. 7 of 10 succeeded), with per-failure Retry buttons, so I don't lose successful work.
- As a Member, I want a confirmation dialog before re-upscaling an already-upscaled design, so I don't accidentally overwrite a finished file.
- As a Workspace Admin, I want to see my workspace's monthly upscale-quota usage, so I know when I'm close to the limit.
- As a Platform Admin (Mario / staff), I want unlimited upscales for my own workspace, so I can test and demo without quota friction.
- As a Platform Admin, I want to configure the Replicate model slug, version hash, default scale, monthly per-user quota, bulk concurrency, and target dimensions in the Django Admin, so I can tune cost vs. quality without redeploying.

## Acceptance Criteria

### Models & Settings
- [ ] AC-1: New `UpscalerSettings` model (singleton, one row globally) with fields: `replicate_model_slug` (default `nightmareai/real-esrgan`), `replicate_model_version` (hash), `default_scale` (int, default 4), `target_width` (int, default 4500), `target_height` (int, default 5400), `monthly_quota_per_user` (int, default 100), `bulk_concurrency` (int, default 10), `staff_unlimited` (bool, default True), exposed in Django Admin only.
- [ ] AC-2: Existing `ProcessingSettings.upscale_provider`, `upscale_api_key`, `upscale_auto_threshold` fields are deprecated via migration (kept for now to avoid PROJ-9 breakage; values ignored by new code path); a follow-up migration removes them once PROJ-9 is fully on PROJ-27.
- [ ] AC-3: Existing `DesignProcessingJob` model (`type=upscale`) is reused; a new field `replicate_prediction_id` (CharField, max 100, blank) is added to track the Replicate prediction.
- [ ] AC-4: New `UpscaleQuotaUsage` model: `user` FK, `month` (DateField, first-of-month), `count` (int, default 0); unique together (user, month). Tracks monthly consumption.

### Single-Mode (Image Editor)
- [ ] AC-5: `POST /api/designs/<uuid:design_id>/upscale/` endpoint — auth: `IsAuthenticated` + workspace membership via `X-Workspace-Id`; body empty; returns 202 with `{job_id, replicate_prediction_id, status: "pending"}`.
- [ ] AC-6: Single-Mode endpoint creates one `DesignProcessingJob` (type=upscale), increments `UpscaleQuotaUsage` for the calling user, and enqueues an rq job that fires the Replicate prediction with webhook callback.
- [ ] AC-7: Image Editor "Upscale" button replaces the old PROJ-9 Pica.js trigger; on click it calls the single-mode endpoint, shows a status indicator (Skeleton in image preview area), and surfaces the result via existing `Design.upscaled_file` once complete.
- [ ] AC-8: If user clicks "Upscale" on a Design that already has `upscaled_file` set, a confirmation dialog appears: "This design is already upscaled. Replace existing upscaled version?" — Cancel/Replace. Replace overwrites `upscaled_file`.

### Bulk-Mode (Project Artboard Canvas)
- [ ] AC-9: Project Artboard Canvas supports multi-select on design tiles (existing pattern, verify or add); a "Bulk Upscale" button is enabled when ≥1 design selected.
- [ ] AC-10: `POST /api/designs/upscale/bulk/` endpoint — body `{design_ids: [uuid, ...]}`; validates all IDs belong to the workspace; returns 202 with `{batch_id, jobs: [{design_id, job_id, status}], skipped_quota: int, skipped_already_upscaled: int}`.
- [ ] AC-11: Bulk-Mode pre-flight checks per design: if user has hit monthly quota, abort entire request with 402 + remaining quota; if individual design is already upscaled, prompt user via UI confirmation BEFORE submitting (frontend handles), passes `replace=true` flag in body.
- [ ] AC-12: Bulk worker fires Replicate predictions with concurrency limit `bulk_concurrency` (default 10) using semaphore — ensures no more than 10 in-flight Replicate calls per batch at any time.
- [ ] AC-13: A "Bulk Upscale Status" panel/drawer in the Project Artboard Canvas shows per-design status (pending/running/completed/failed) with live updates (poll `/api/designs/upscale/batch/<batch_id>/` every 5s OR via SSE if pattern available).
- [ ] AC-14: Failed jobs in bulk show a per-row "Retry" button that re-submits the single design via the single-mode endpoint.
- [ ] AC-15: User can close the tab/browser during a bulk run; on return, the status panel shows current state (jobs continue independent of UI).

### Replicate Integration & Webhook
- [ ] AC-16: rq worker (`worker-design`) calls Replicate predictions using webhook callback URL pointing to `/api/upscale/callback/`; webhook receives `{id, status, output, error}`.
- [ ] AC-17: Webhook endpoint `/api/upscale/callback/` is public (no JWT) but verifies a Replicate-signed `webhook-signature` header against `REPLICATE_WEBHOOK_SECRET` env var; rejects 403 on invalid signature.
- [ ] AC-18: On `succeeded` callback: worker downloads Replicate output URL, runs Pillow center-pad to 4500×5400 transparent canvas, saves to `Design.upscaled_file`, and updates `DesignProcessingJob.status=completed` + `completed_at`.
- [ ] AC-19: On `failed`/`canceled` callback: `DesignProcessingJob.status=failed`, `error_message` populated from Replicate error; quota usage is NOT decremented (cost was incurred).
- [ ] AC-20: Pillow center-pad logic: if `output.width × 4 > target_width` OR `output.height × 4 > target_height` (i.e. portrait input would overflow), Lanczos-down to fit longer dimension first; then place centered on transparent 4500×5400 RGBA canvas; save as PNG `compress_level=6`.

### Quota & Permissions
- [ ] AC-21: Non-staff users have hard cap of `monthly_quota_per_user` (default 100) successful upscales per calendar month; quota counted at job-submission time, refunded on failure.
- [ ] AC-22: `is_staff=True` OR `is_superuser=True` users are exempt from quota when `staff_unlimited=True` in `UpscalerSettings`.
- [ ] AC-23: When quota is exceeded, single-mode returns 402 `{error: "monthly_quota_exceeded", used: int, limit: int, resets_on: date}`; bulk-mode returns 402 with same structure if even partial submission would exceed quota.
- [ ] AC-24: `GET /api/designs/upscale/quota/` returns current user's monthly usage `{used: int, limit: int|null, resets_on: date, is_unlimited: bool}` for UI display.

### Security & Storage
- [ ] AC-25: `REPLICATE_API_TOKEN` and `REPLICATE_WEBHOOK_SECRET` stored in Django `.env`, never committed to git, documented in `.env.template`.
- [ ] AC-26: Workspace isolation enforced on all endpoints — users cannot upscale designs in workspaces they are not a member of.
- [ ] AC-27: Output PNGs stored in existing `Design.upscaled_file` FileField (`designs/upscaled/%Y/%m/`) — existing download flow already wires through.
- [ ] AC-28: Replicate API token used only server-side in worker process; never exposed to frontend.

## Edge Cases
- [ ] EC-1: User triggers Single-Upscale on a design currently being upscaled (job already pending/running) — endpoint returns 409 Conflict with current `job_id`; UI shows existing progress instead of starting a new job.
- [ ] EC-2: Replicate API is down or rate-limits us during bulk submission — worker retries with exponential backoff (max 3 attempts per job, 2s/4s/8s); after 3 failures the job is marked failed with `error_message="replicate_unavailable"`.
- [ ] EC-3: Replicate webhook never arrives (lost packet, network issue) — worker has a fallback: every 60s a scheduled rq task scans `DesignProcessingJob` rows in `running` status >5min old and polls Replicate API directly to reconcile.
- [ ] EC-4: User selects 500 designs for bulk but has only 50 quota left — pre-flight returns 402 with explicit count; UI offers "Upscale first 50 only" option.
- [ ] EC-5: User selects designs spanning multiple workspaces (corner case via direct API misuse) — endpoint rejects with 400; only designs in current workspace allowed.
- [ ] EC-6: Replicate output is NOT a valid PNG (corrupted, server error returning HTML) — Pillow raises; job marked failed with `error_message="invalid_replicate_output"`; quota refunded.
- [ ] EC-7: Input design has weird aspect ratio (e.g. 1024×3072 ultra-portrait) — strict-4× would yield 4096×12288 which after Lanczos-down to 5400 height = 1800×5400, much narrower than 4500; placed center-padded, large transparent left/right margins. Acceptable for MVP; documented behavior.
- [ ] EC-8: User starts a bulk run, tab is closed, comes back 1h later but ALL designs in batch already completed — status panel still loadable via `batch_id` from URL or re-derivable via `?recent_batches=true` query; existing rendered upscaled_file shown immediately.
- [ ] EC-9: Webhook signature secret rotation — deploys with new `REPLICATE_WEBHOOK_SECRET` while in-flight predictions reference old secret — fallback: verify against current AND previous secret for 1h grace period (env var `REPLICATE_WEBHOOK_SECRET_PREVIOUS`).
- [ ] EC-10: User clicks Retry on a failed job that had hit Replicate-side validation error (e.g. input image too small or corrupt) — Retry attempts again; if same error 3× in a row, retry is disabled with permanent error message.
- [ ] EC-11: Two concurrent bulk runs by the same user (browser in two tabs) — both succeed; `bulk_concurrency` is per-batch not per-user, so 20 parallel calls possible. Acceptable. Only quota is the per-user gate.
- [ ] EC-12: Existing `Design.upscaled_file` from legacy PROJ-9 Pica.js path — new upscale runs overwrite it after confirmation dialog (AC-8); no separate "legacy" tracking needed.

## Technical Requirements
- **External Provider:** Replicate, model `nightmareai/real-esrgan` @ pinned version hash. Cost ~$0.002/image. Single-tier (no quality tiers exposed to user).
- **Performance:** Single-Upscale end-to-end (click → upscaled_file ready) should complete in <15s for 1024×1024 input under normal Replicate load. Bulk of 100 designs at concurrency 10 should complete in <2 minutes.
- **Async:** All Replicate calls go through `worker-design` rq queue; HTTP requests never block on Replicate. Webhook-driven completion (no polling).
- **Concurrency:** Default 10 parallel Replicate predictions per bulk run, configurable in Django Admin via `UpscalerSettings.bulk_concurrency`.
- **Failure Handling:** Continue+Report semantics — partial failures don't abort batch; per-job retry available.
- **Resilience:** Webhook fallback poller scans stuck-running jobs every 60s, reconciles with Replicate API.
- **Quota:** Hard cap 100/month for non-staff, unlimited for staff; counted on submission, refunded on failure.
- **Security:** Webhook signature verification mandatory; workspace isolation enforced; API token server-side only.
- **Storage:** Output PNGs in existing `Design.upscaled_file` field; no new storage path needed.
- **Aspect Strategy:** Strict 4× AI upscale + center-pad on 4500×5400 transparent canvas; Lanczos-down guard if 4× output exceeds target dimensions.

## Out of Scope (Non-Goals)
- Quality tiers (Fast/Balanced/Best) — single workflow only
- Multiple providers (no fal.ai fallback in MVP)
- Topaz Gigapixel / Claid.ai integration (deferred — possible Premium tier post-MVP)
- Client-side Pica.js upscaling (deprecated from PROJ-9, fully replaced)
- Custom target dimensions per call (always 4500×5400; admin-configurable globally only)
- Aspect-aware smart routing (Strategy B in design discussion) — strict 4× + pad only
- Real-time progress percentage from Replicate (Replicate doesn't expose granular progress; we show pending/running/done)
- Email notifications when bulk completes (in-app status panel only)
- Cost-per-user reporting / usage billing dashboard (deferred)
- Re-using outputs across workspaces (each workspace's upscale is isolated)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
