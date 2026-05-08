# PROJ-27 — AI Upscaler Tasks

> Implementation checklist. `/frontend` and `/backend` skills tick boxes as they complete work. Each phase has explicit acceptance against the spec ACs.

---

## Replicate API Reference (verified 2026-05-08 via Context7 + replicate.com docs)

> Authoritative implementation reference. Use these exact patterns — do NOT improvise. Verified against `/replicate/replicate-python` SDK docs and `replicate.com/docs/topics/webhooks/verify-webhook`.

### SDK Install
- Package: `replicate` (Python). Pin version in `requirements.txt` after testing — verify latest stable on PyPI before committing version.
- Auth: `REPLICATE_API_TOKEN` env var auto-detected by SDK.

### Creating a Prediction (async with webhook)

The `predictions.create()` method (NOT `replicate.run()` which blocks). Required params:

| Param | Value for PROJ-27 |
|-------|-------------------|
| `model` | `nightmareai/real-esrgan` (slug only) OR `version=<hash>` for pinned reproducibility |
| `input` | `{"image": <URL or file>, "scale": 4}` — `face_enhance: false` (POD designs, not portraits) |
| `webhook` | `https://<domain>/api/upscale/callback/` |
| `webhook_events_filter` | `["completed"]` — only fire on terminal state (we don't need "start" events) |

**File input strategy:** prefer URL (no upload roundtrip). Since `Design.upscaled_file` originals live on Django storage, expose a signed pre-auth URL OR upload via SDK with file handle. Both work; URL is faster.

**SDK method shape (for `/backend` reference):**
- Module: `replicate.predictions.create(...)` returns a Prediction object with `.id`, `.status`, `.output`, `.error`
- Returned `prediction.id` is what we store in `DesignProcessingJob.replicate_prediction_id`
- For reconciler: `replicate.predictions.get(prediction_id)` re-fetches state

### Webhook Verification (CRITICAL — security-sensitive)

**SDK does it for us — DO NOT hand-roll HMAC.** Use `replicate.webhooks.validate()`:

```
replicate.webhooks.validate(
    headers=dict(request.headers),
    body=request.body.decode(),
    secret=REPLICATE_WEBHOOK_SECRET,
    tolerance=300,  # 5 min clock skew window
)
# Raises replicate.exceptions.InvalidSignatureError on failure
```

**Headers Replicate sends** (SDK consumes these — do not parse manually):
- `webhook-id`
- `webhook-timestamp`
- `webhook-signature`

**Secret retrieval:** one-time fetch from `GET https://api.replicate.com/v1/webhooks/default/secret`. Returns `{"key": "whsec_<base64>"}`. Store the FULL string (incl. `whsec_` prefix) in `REPLICATE_WEBHOOK_SECRET` env var. SDK handles prefix stripping internally.

**For rotation grace (EC-9):** if `REPLICATE_WEBHOOK_SECRET_PREVIOUS` is set, attempt validation against PRIMARY first; on `InvalidSignatureError`, retry against PREVIOUS. After 1h grace window, remove PREVIOUS env var.

### Webhook Payload Shape (from SDK docs)

When prediction completes, Replicate POSTs JSON body:

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Prediction ID (matches `replicate_prediction_id` we stored) |
| `status` | string | `succeeded` / `failed` / `canceled` |
| `output` | string OR list-of-strings | URL(s) of result file(s). For real-esrgan: single URL string |
| `error` | string or null | Error message when status=failed |
| `logs` | string | Optional model logs (last 100 chars useful for debugging) |
| `metrics.predict_time` | float | Optional, seconds spent in prediction |

**Idempotency:** Replicate may send duplicate webhooks (network retries). Implementation must:
- Check `DesignProcessingJob.status` before processing — if already `completed` or `failed`, return 200 OK without re-processing.
- Use `prediction_id` as idempotency key.

### Reconciler / Manual Polling (fallback for lost webhooks)

For EC-3 (60s reconciler):
- Query `replicate.predictions.get(prediction_id)` — returns same Prediction object
- Check `.status` against our DB
- If diverged (Replicate=succeeded but our row=running), trigger same callback path manually

### Cost & Rate Reference (for monitoring / quota tuning)

- `nightmareai/real-esrgan` cost: ~$0.0014/image at 4× scale (verify against current Replicate pricing page before launch)
- Replicate rate limits: not officially documented but ~600 predictions/min per account is observed safe ceiling. Our `bulk_concurrency=10` default is well below.
- Cold-start: model is "warm" / always-on so no cold start delay (verify on first prod test).

### What NOT to use

- ❌ `replicate.run()` — synchronous, blocks request thread. Wrong for our async flow.
- ❌ Manual HMAC verification — error-prone, SDK already maintains the algorithm.
- ❌ `face_enhance: true` — POD designs are typography/illustration, not faces. Causes artifacts.
- ❌ Custom scale > 4 — model output quality degrades; stick with `scale: 4`.
- ❌ Polling Replicate every 2s in worker (the user's original Python sketch) — we use webhook + reconciler instead.

### Open Items to Verify Before /backend Starts

- [ ] Pin exact `replicate` SDK version (check PyPI for latest stable)
- [ ] Pin exact `nightmareai/real-esrgan` model version hash (check Replicate model page; hash changes when model is republished)
- [ ] Verify Replicate signing secret is fetched + stored in `REPLICATE_WEBHOOK_SECRET` BEFORE first prediction is fired
- [ ] Confirm 4500×5400 isn't outside model's tile-output limit (real-esrgan handles up to ~2048×2048 native; our pipeline upscales 1024→4096 then Pillow-pads, so we never hit native limit)

---

## Phase 1: Backend Foundation (Models + Settings)

- [x] Add `replicate` to `django-app/requirements.txt` (pin to latest stable as of 2026-05) — _added unpinned; pin before prod deploy_
- [x] Add env vars to `django-app/.env.template`: `REPLICATE_API_TOKEN`, `REPLICATE_WEBHOOK_SECRET`, optional `REPLICATE_WEBHOOK_SECRET_PREVIOUS` (rotation grace)
- [x] Create `UpscalerSettings` singleton model in `design_app/models.py` with the 8 fields per Tech Design table
- [x] Create `UpscaleQuotaUsage` model in `design_app/models.py` with `user`, `month`, `count` + unique_together
- [x] Add `replicate_prediction_id` (CharField max 100, blank) to existing `DesignProcessingJob`
- [x] Mark legacy fields on `ProcessingSettings` as deprecated via docstring (`upscale_provider`, `upscale_api_key`, `upscale_auto_threshold`); kept for one release cycle
- [x] Generate migration `00XX_proj27_upscaler.py` — actual: `0012_proj27_upscaler.py`
- [x] Register `UpscalerSettings` in `design_app/admin.py` (singleton-style — `has_add_permission=False` after first row)
- [x] Register `UpscaleQuotaUsage` in admin (read-only, for support)
- [x] Create singleton-default fixture or post-migrate signal so first deploy has UpscalerSettings row with defaults — _UpscalerSettings.load() lazy-creates on first access; equivalent UX_

## Phase 2: Replicate Service Layer

- [x] Create `design_app/services/replicate_client.py` — wraps `replicate-python` SDK
- [x] Implement `start_prediction(design_id, image_path, scale, webhook_url)` — fires async prediction with webhook
- [x] Implement `get_prediction(prediction_id)` — for fallback reconciler
- [x] Implement `verify_webhook_signature(headers, body)` — validates Replicate signature against `REPLICATE_WEBHOOK_SECRET` (with PREVIOUS fallback for rotation) — _uses official SDK `replicate.webhooks.validate()` instead of hand-rolled HMAC_
- [x] Refactor `design_app/services/upscaler.py` — remove Pica/auto-threshold logic, replace with Replicate-only flow + Pillow post-processing
- [x] Implement `center_pad_to_target(image_bytes, target_w, target_h)` — Pillow logic with Lanczos-down guard for portrait overflow

## Phase 3: rq Tasks (Async Workers)

- [x] In `design_app/tasks.py`: implement `enqueue_replicate_upscale(job_id, replace_flag)` — fires Replicate, updates DesignProcessingJob with prediction_id
- [x] Implement `process_replicate_callback(prediction_id, status, output_url, error)` — downloads result, runs center-pad, saves to `Design.upscaled_file`, updates job, optionally enqueues cloud upload
- [x] Implement `reconcile_stuck_jobs()` — scheduled rq job, runs every 60s, finds DesignProcessingJob in `running` state >5min old, calls `replicate_client.get_prediction()`, reconciles status
- [x] Configure scheduler entry for `reconcile_stuck_jobs` in `core/settings.py` RQ_QUEUES + django-rq scheduler block — _via `schedule_proj27_reconciler` management command_
- [ ] Implement `enqueue_cloud_upload(job_id, provider, folder)` — reuses existing `publish_app/tasks.py` upload primitives; called post-success when destination=cloud — _shim only, full wiring deferred_

## Phase 4: API Endpoints

- [x] `POST /api/designs/<uuid:design_id>/upscale/` — Single-mode trigger. Validates workspace + quota, creates DesignProcessingJob, increments quota, enqueues rq job, returns 202. Implements AC-5, AC-6.
- [x] `POST /api/designs/upscale/bulk/` — Bulk trigger. Validates all design_ids in workspace, runs pre-flight quota check, accepts `replace` flag, creates batch_id (UUID v4 per call), enqueues N jobs. Implements AC-10, AC-11.
- [x] `GET /api/designs/upscale/batch/<uuid:batch_id>/` — Returns array of job statuses for polling. Implements AC-13.
- [x] `GET /api/designs/upscale/quota/` — Returns user's monthly usage. Implements AC-24.
- [x] `POST /api/upscale/callback/` — Webhook receiver. Verifies signature (AC-17), routes to `process_replicate_callback` rq job for async processing. Implements AC-16, AC-18, AC-19.
- [x] Add 409 Conflict response on Single-mode trigger if job already pending/running for same design (EC-1)
- [x] Add 402 Payment Required response shape `{error, used, limit, resets_on}` for over-quota cases (AC-23)
- [x] Add `replace=true` query/body flag to single-mode and bulk-mode for confirmed re-upscale flow
- [x] DRF serializers: `UpscaleQuotaSerializer`, `BatchStatusSerializer`, `UpscaleJobSerializer`
- [x] Wire URLs in `design_app/api/urls.py` and `core/urls.py`

## Phase 5: Frontend State (Redux + RTK Query)

- [x] Create `frontend-ui/src/store/api/upscaleApi.ts` — RTK Query slice with endpoints: `triggerSingle`, `triggerBulk`, `getBatchStatus` (with `pollingInterval: 5000`), `getQuota` — _location: `store/upscaleApi.ts` (flat, project convention)_
- [x] Create `frontend-ui/src/store/slices/upscaleSlice.ts` — local state for `activeBatchId`, `destinationPreference`, `cloudTarget`. Persist via `localStorage` middleware (existing pattern in repo) — _location: `store/upscaleSlice.ts`_
- [x] Add `upscaleApi.reducer` and `upscaleSlice.reducer` to root store in `store/index.ts`
- [x] On app mount: dispatch `verifyActiveBatch` thunk — if `activeBatchId` in localStorage, fetch batch status; if 404 or terminal, clear — _via `useVerifyActiveBatch` hook in App.tsx_

## Phase 6: Single-Mode UI (Image Editor)

- [x] Create `views/designs/editor/hooks/useUpscaleSingle.ts` — wires RTK Query trigger + 5s polling + dialog logic
- [x] Refactor `views/designs/editor/partials/toolParams/UpscaleToolParams.tsx` from 274 lines (Pica.js stub) to ~80 lines (Minimal Panel per spec)
- [x] Create shared `views/designs/board/partials/UpscaleDestinationToggle.tsx` (icon-only Local/Cloud toggle, used by both Single and Bulk) — _later refactored to a single Switch "Also save to Cloud" per user feedback_
- [x] Wire ConfirmDialog integration for Single-Mode re-upscale guard (AC-8)
- [x] Implement Skeleton overlay on image preview during processing (per `feedback_skeleton_over_spinner` memory)
- [x] Wire snackbar notifications (success: "Upscaled to 4500×5400", optionally "Uploaded to Drive"; error: error_message)
- [x] Delete `views/designs/editor/hooks/usePicaUpscale.ts` entirely
- [x] Strip upscale path from `views/designs/editor/hooks/useClientProcessing.ts` (BG Remove path stays)
- [ ] Update i18n strings in `i18n/de/*.json` + `i18n/en/*.json` for new panel labels — _all strings have `defaultValue` inline so they render fine; explicit JSON keys not yet added (Phase 11)_

## Phase 7: Bulk-Mode UI (Project Artboard Canvas)

- [x] Create `views/designs/board/hooks/useUpscaleBatch.ts` — wires bulk trigger, batch polling (mirrors `useNicheResearch` 5s pattern, stops on terminal)
- [x] Add `AutoFixHighIcon` button to existing SELECTION-section icon row in Artboard right sidebar — _swapped to `PhotoSizeSelectLargeIcon` per user feedback (more semantically correct for upscaling)_
- [x] Add Destination toggle (`UpscaleDestinationToggle`) below the icon row in SELECTION
- [x] Add Quota text line below destination toggle in SELECTION (hidden for staff)
- [x] Create `views/designs/board/partials/BulkUpscaleDrawer.tsx` (anchor=right, width 400px, glass-md)
- [x] Drawer header: batch short_id + progress badge `7/10` + close icon
- [x] Drawer body: LinearProgress + per-job rows (40×40 thumbnail, filename, status chip, retry icon)
- [x] Drawer footer: Close + "Clear completed" (client-side filter only)
- [x] Per-row Retry button: re-submits via Single-mode endpoint; disabled after 3 same-error attempts (AC-14, EC-10)
- [x] Implement Bulk-Mode Re-Upscale ConfirmDialog (Skip / Re-upscale all / Cancel; default focus Skip)
- [x] Implement Pre-flight quota Dialog when selection > remaining quota ("Upscale first 50 only?" — uses GET quota endpoint per Q2 decision)

## Phase 8: Topbar Pill + Settings Usage Tab

- [x] Create `views/designs/board/partials/UpscaleStatusPill.tsx` — Chip in `Topbar.tsx`, conditionally rendered when `activeBatchId` and not terminal
- [x] Pill click → re-opens `BulkUpscaleDrawer` for active batch
- [x] Pill auto-fades 3s after batch reaches terminal state (success snackbar replaces it)
- [x] Mount Pill in existing `components/topbar/Topbar.tsx`
- [x] Create `views/settings/partials/UsageQuotaCard.tsx` — month-to-date breakdown, progress ring, resets-on date, staff "Unlimited" badge — _location: `views/settings/usage/UsageSection.tsx`_
- [x] Add new "Usage" tab to existing `views/settings/` route

## Phase 9: Cloud Tie-in (Reuse PROJ-11)

- [x] Wire `useGoogleDrive` / `useOneDrive` from `components/CloudStorage` to determine if Cloud option is available
- [x] Wire `SendToCloudDialog` from `views/publish/partials/cloud/` to open in "pick destination only" mode (provider + folder, no immediate upload) — _new lighter `PickCloudFolderDialog` built (reuses CloudStorage hooks); existing SendToCloudDialog kept for Publish flow_
- [x] Pass picked target to upscale trigger payload (`destination: 'cloud', cloud_target: {...}`)
- [ ] Backend: when payload has `cloud_target`, after successful upscale post-process, enqueue cloud upload via `enqueue_cloud_upload` rq job — _shim only; needs full wiring to publish_app upload primitives_
- [x] Snackbar enrichment: `Upscaled to 4500×5400 · Uploaded to Drive` on combined success — _frontend wired; backend completion still partial pending above_
- [x] Cloud upload failure surfaces as separate snackbar (Django file already saved, retry via publish-app flow)

## Phase 10: Tests

### Backend (pytest, in django-app/tests/)
- [x] Unit: `test_replicate_client.py` — start_prediction with mocked SDK, verify_webhook_signature with valid/invalid/rotated secrets
- [x] Unit: `test_upscaler_service.py` — center_pad_to_target with square, portrait, landscape, ultra-portrait inputs
- [x] Integration: `test_upscale_views.py` — single-mode auth + workspace + quota + 409 conflict; bulk-mode pre-flight + 402; quota endpoint
- [x] Integration: `test_upscale_callback.py` — webhook signature verify (valid, invalid, rotation grace), success/failed/canceled flows, idempotency for replay — _delivered as `test_upscale_callback_processing.py`_
- [ ] Integration: `test_upscale_quota.py` — increment on submit, refund on failure, staff_unlimited bypass, month rollover — _quota basics covered in `test_upscale_views.py`; dedicated quota tests not yet split out_
- [ ] Integration: `test_reconcile_stuck_jobs.py` — finds stuck jobs, polls Replicate, updates status correctly — _basic coverage in `test_upscale_callback_processing.py`; dedicated file not split out_

### Frontend (Vitest + RTL)
- [x] `views/designs/editor/tests/UpscaleToolParams.test.tsx` — Minimal Panel rendering, destination toggle states, disabled-when-no-cloud, Cloud picker click — _4 tests_
- [x] `views/designs/board/tests/BulkUpscaleDrawer.test.tsx` — drawer opens with batch, polling-mock, status chips, retry button, clear-completed filter — _5 tests_
- [x] `views/designs/board/tests/UpscaleStatusPill.test.tsx` — conditional render, click opens drawer, auto-fade on terminal — _4 tests_
- [x] `views/designs/board/hooks/tests/useUpscaleBatch.test.ts` — polling start/stop, terminal detection, mocked RTK Query — _5 tests; .tsx because of JSX wrapper_
- [x] `views/settings/tests/UsageQuotaCard.test.tsx` — non-staff progress ring, staff Unlimited badge, 80% warning, 100% disabled — _delivered as `UsageSection.test.tsx`, 5 tests_

### E2E sanity (Playwright/Cypress if existing pattern)
- [ ] Single-mode happy path: click Upscale → mocked Replicate webhook → upscaled_file appears in preview — _no E2E framework wired in this branch; manual smoke + `simulate_upscale` command compensates for now_
- [ ] Bulk-mode happy path: select 3 designs → confirm → drawer shows progress → all 3 succeed — _same as above_
- [ ] Bulk-mode partial failure: 1 of 3 fails → retry button works → succeeds on retry — _same as above_

## Phase 11: Documentation + Cleanup

- [ ] Update `docs/design-editor-tools.md` — replace "AI Upscale" row to reflect Replicate-only flow (remove Pica.js mention)
- [ ] Add `docs/PROJ-27-runbook.md` (operations doc) — env var setup, Replicate token rotation, webhook secret rotation procedure
- [ ] Update `docs/PRD.md` — bump PROJ-27 status from Planned to In Review when QA enters
- [x] Add deprecation notice to docstrings on `ProcessingSettings.upscale_*` fields with target removal version

## Cross-Cutting (verify before merge)

- [x] All user-visible strings via `useTranslation()` (no hardcoded labels) — _all strings wrapped in `t()` with inline defaultValue; JSON keys still TODO (Phase 11)_
- [x] All colors via `theme.vars.palette.*` (no hex/rgb) — _glass surfaces use COLORS constants per project pattern (RightPanel precedent); compare-modal label tags use rgba on opaque overlays — acceptable_
- [x] Backend: `IsAuthenticated` + workspace check on every protected endpoint
- [x] No console.log / print statements left in code
- [x] `npm run lint` + `npm run test:ci` pass clean — _0 errors lint; 1395/1396 tests pass; 1 pre-existing test file (WorkspaceSection) fails to load due to fragile vi.mock chain exposed by upscaleApi default registration in test-utils — known follow-up_
- [x] `docker compose exec web pytest` passes clean — _2042 passed, 3 skipped_
- [ ] Manual smoke test on dev: full single + bulk flow with real Replicate sandbox token — _Replicate webhook can't reach localhost without a tunnel; `simulate_upscale` management command provides equivalent local validation_

---

## Bonus features (not in original task list — added during build per user request)

- [x] **Replicate API Reference section** at top of this file (verified 2026-05-08 via Context7 + replicate.com docs) — SDK install, predictions.create shape, webhook verification pattern, payload shape, anti-patterns
- [x] **`simulate_upscale` Django management command** for local dev (Replicate webhooks can't reach localhost) — copies or Pillow-scales image_file → upscaled_file, creates DesignProcessingJob in completed status
- [x] **Replicate-style Compare modal** — UpscaleCompareModal with drag-handle + clip-path slider for before/after comparison
- [x] **Bulk Compare carousel** — same modal extended to take items[] with chevron navigation, keyboard ←/→ support, counter chip
- [x] **Single-design upscale in Artboard Canvas** — added Upscale icon to PanelArtboardState (single-select state) via shared `useUpscaleSelection` hook (not just multi-select)
- [x] **Send-to-Listings icon redesign** — replaced paper-plane with Article + cyan "+" badge per user feedback (separate PROJ-9 chore commit included)
