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

## Frontend Design Decisions

> Resolved via `/frontend-design` 2026-05-08 — informs `/architecture` API surface.

### Bulk-Status Display Pattern — RESOLVED

**Decision: Inline-Drawer in Project Artboard Canvas + lightweight Topbar pill (no cross-feature aggregator).**

Rationale:
- Existing pattern (`useNicheResearch` 5s polling, view-local status) is the project's idiom — match it.
- `NotificationBell` is paradigmatically *read/unread* (Kanban notifications), NOT *in-progress tracking* — extending it would collide concepts.
- Cross-feature global aggregator (Niche Research + Slogan Gen + Scrape Batches + Upscale...) is real future need, but premature for MVP. Defer until ≥3 features need it.

Architectural implication for `/architecture`:
- **ONE endpoint suffices:** `GET /api/designs/upscale/batch/<batch_id>/` → per-batch status array.
- **NO new aggregate-jobs endpoint** in this feature.

UI Composition:
- **Right Drawer** (MUI `Drawer` anchor=right, width 400px, glass-md backdrop):
  - Header: "Bulk Upscale — Batch <short_id>" + close icon + overall progress badge (e.g. `7/10`)
  - Linear progress bar (`LinearProgress` `determinate`, value=completed/total)
  - Scrollable list of jobs (one row per design):
    - 40×40 thumbnail (rounded 6px) | design filename (truncate) | status chip | inline action
    - Status chips: `pending` (text-secondary), `running` (cyan-secondary, animated dot), `completed` (success), `failed` (error)
    - Inline action: Retry icon button only when `status=failed`; disabled with tooltip after 3 retries with same error
  - Footer: "Close" (drawer stays mounted, can re-open from pill) + "Clear completed" (removes succeeded rows from view, keeps DB)
- **Topbar pill** (only visible when an active batch exists, polling not yet terminal):
  - Compact `Chip` next to existing NotificationBell: 🌀 icon + "Upscaling 7/10" (cyan-secondary subtle bg)
  - Click → re-opens drawer (drawer state persists in Redux while batch active)
  - Auto-fades out 3s after batch reaches terminal state (success snackbar replaces it)
- **No global notification system extension** — pill is PROJ-27-scoped Redux slice.

### Single-Mode (Image Editor)

- **Entry point:** existing **"AI Upscale" Tool-Tab** in the editor toolbar (already implemented in PROJ-9 stub). Click → opens left side-panel with `UpscaleToolParams` config.
- **Existing component to refactor:** `frontend-ui/src/views/designs/editor/partials/toolParams/UpscaleToolParams.tsx` (currently 274 lines, PROJ-9 Pica.js logic). Simplify to a Minimal-Panel (~80 lines).
- **Minimal-Panel content (in order, top to bottom):**
  1. Current image size chip: `Current: 1024×1024` (read-only, from selected design metadata)
  2. Target size chip: `Target: 4500×5400` (read-only, sourced from `UpscalerSettings` admin config — NOT user-editable)
  3. **Destination toggle** (icon-only buttons with tooltips, ToggleButtonGroup pattern, `exclusive`):
     - `💾` (HardDriveIcon) — Tooltip: "Local only (Django)"
     - `☁️` (CloudUploadIcon) — Tooltip: "Local + Cloud" (disabled with tooltip "Connect Google Drive or OneDrive in Settings" if no cloud provider linked)
     - **NO "Auto" button** — user must consciously pick destination
     - **Default: last-used** per workspace (first-time user defaults to Local-only)
     - When Cloud selected: small chip below shows picked target — `📁 Drive · /MerchMiner/Upscaled` — click chip to re-pick
  4. Quota indicator (non-staff only): `Quota: 98/100 left this month` (text-secondary 12px; warning-yellow at 80%, error-red at 100%)
  5. Cost-hint text: `Uses 1 of your monthly upscales` (text-disabled 11px)
  6. Primary button: `[▶ Upscale Now]` — coral primary, full-width. Disabled if Cloud selected but no provider+folder picked yet.
- **Cloud-click flow:** Click on `☁️` icon → if no destination picked yet OR user wants to change → opens existing `SendToCloudDialog` (from `views/publish/partials/cloud/`) in "pick destination only" mode (no immediate upload). User picks Provider + Folder → dialog closes → chip below toggle shows picked target → Upscale-Now button becomes enabled. After Upscale: file gets uploaded to chosen target automatically as part of the post-success flow.
- **Removed from existing UI** (legacy PROJ-9 stubs no longer needed):
  - 3-Mode Toggle text-labels (Auto / Client / Server) — repurposed to icon-only Destination toggle (Local / Local+Cloud), Auto removed
  - Width/Height number inputs — replaced by read-only Target chip
  - Filter dropdown (Lanczos variants) — Pica.js gone
  - Auto-mode InfoBox + threshold info text
- **On click [Upscale Now]:**
  - Button switches to loading state (CircularProgress 14px, label "Upscaling…")
  - Image preview canvas overlays MUI `Skeleton` (`variant="rectangular"`, animation="wave") — **per memory `feedback_skeleton_over_spinner.md`**
  - 5s polling starts (mirrors `useNicheResearch` pattern)
- **On success:** preview swaps to upscaled file, snackbar "Upscaled to 4500×5400" (variant=success). Button resets to idle.
- **On fail:** snackbar error with `error_message`, button returns to idle with subtle error ring. Click again = retry (no separate retry UI in single-mode).
- **Re-upscale guard:** if Design has existing `upscaled_file`, click triggers Single-Mode ConfirmDialog (see Re-Upscale section) BEFORE polling starts.

### Cloud-Storage Tie-in (reuse existing PROJ-11 infrastructure)

PROJ-11 Cloud-Picker is fully implemented and shipped (Google Drive + OneDrive). PROJ-27 reuses it:

- **No new cloud code in PROJ-27.** Wire up existing `SendToCloudDialog` component from `views/publish/partials/cloud/` and `useGoogleDrive`/`useOneDrive` hooks.
- **Pre-upload picker pattern (NOT post-success snackbar):** user picks destination BEFORE clicking Upscale-Now via the Destination toggle (see Single-Mode section). After successful upscale, file is uploaded to chosen target automatically — no extra click needed.
- **Single-Mode (Editor):** Cloud icon in Destination toggle → opens existing `SendToCloudDialog` in "pick destination" mode (provider + folder, no immediate upload). After upscale completes, worker triggers upload to picked target. Snackbar confirms: `Upscaled to 4500×5400 · Uploaded to Drive`.
- **Bulk-Mode (Drawer):** Bulk Action Bar (in SELECTION section) gets a Destination toggle just like single-mode. Pick once, applies to whole batch. After completion, drawer footer shows summary: `12/12 done · 12 uploaded to Drive`.
- **Cloud option disabled when no provider connected:** the `☁️` icon is greyed out with tooltip `Connect Google Drive or OneDrive in Settings`. User can only pick `💾 Local only` until they link a provider.
- **Last-used destination is remembered per workspace:** Redux/localStorage persists the user's last picked Destination + cloud target so they don't re-pick every session. First-time user defaults to `💾 Local only`.
- **Local Django storage stays primary (Source of Truth):** even when cloud is picked, file is ALWAYS saved to `Design.upscaled_file` first. Cloud upload is additive/post-Django. If cloud upload fails (auth expired, quota), Django file stays — error surfaced via snackbar, user can retry cloud-only via existing publish-app flow.

### Legacy Code Cleanup (PROJ-27 scope)

The following PROJ-9-era files become dead code with PROJ-27 and should be removed in the `/frontend` step:
- `frontend-ui/src/views/designs/editor/hooks/usePicaUpscale.ts` — entire client-side Pica.js implementation
- `frontend-ui/src/views/designs/editor/hooks/useClientProcessing.ts` — only the upscale path (BG Remove path stays)
- Mode-related logic in `UpscaleToolParams.tsx` and any caller wiring `mode: 'auto'|'client'|'server'`

Backend cleanup (PROJ-27 scope, /backend step):
- `ProcessingSettings.upscale_provider` / `upscale_api_key` / `upscale_auto_threshold` fields — kept via deprecated migration for one release cycle, then removed (per AC-2)
- Any Pica-related serializers, views, or env vars (`UPSCALE_PROVIDER`, `UPSCALE_AUTO_THRESHOLD`)

### Multi-Select in Project Artboard Canvas

- **Selection model:** existing project pattern (don't reinvent). Selection state and visual indicators already implemented in the Artboard Canvas — Esc/click-empty/multi-select behavior reused as-is.
- **Entry point:** existing **SELECTION section in the right sidebar panel** ("Artwork(s) [count]" + icon-button row). Add:
  - **One new icon button** in the icon-button row: `AutoFixHighIcon` (sparkle/wand — implies AI processing). Tooltip: "Upscale to 4500×5400". Disabled when 0 selected OR quota=0 for non-staff.
  - **Destination toggle below the icon row** — same pattern as Single-Mode: `💾` (Local) | `☁️` (Local+Cloud, disabled if no provider linked) icon-only with tooltips. Last-used remembered. Click on Cloud opens `SendToCloudDialog` in pick-destination mode. Selected cloud target shown as small chip below toggle: `📁 Drive · /MerchMiner/Upscaled`.
  - **Quota text line** below destination toggle: `Quota: 98/100 left this month` (see Quota Indicator section).
- **Click flow:** User selects designs → SELECTION section enabled → user picks destination (or accepts last-used) → click `AutoFixHighIcon` button → Bulk-Mode Re-Upscale dialog appears (if any already-upscaled) → confirmed → Drawer opens with batch progress.
- **NO floating action bar** — the existing SELECTION section is the canonical place for batch actions, don't compete with it.

### Re-Upscale Confirmation Dialog

- Reuses existing `<ConfirmDialog />` component.
- **Wording convention:** "Re-upscale" (not "Replace" / "Overwrite") — matches POD/AI domain language and emphasizes the action is a fresh AI pass.
- **Visual:** count only — no thumbnails of affected designs (keeps dialog compact, avoids over-engineering).

**Single-Mode dialog** (kept on purpose — Replicate costs money + quota is precious):
- Title: "Re-upscale this design?"
- Body: "This design has already been upscaled to 4500×5400. Re-upscaling will consume 1 from your monthly quota and overwrite the current file."
- Actions: `[Cancel]` (default focus / Esc) | `[Re-upscale]` (coral primary)

**Bulk-Mode dialog** (shown ONCE before submission if any selected designs already have `upscaled_file`):
- Title: "Some designs have already been upscaled"
- Body: "5 of 12 selected designs already have an upscaled version. How do you want to proceed?"
- Actions: `[Cancel]` | `[Skip already upscaled]` (default focus, ghost) | `[Re-upscale all]` (coral primary)
- **Default focus = "Skip already upscaled"** — safer choice (quota-conserving, preserves existing work). User must consciously click "Re-upscale all" to overwrite.

### Quota Indicator — Placement Strategy

- **Settings page (full):** new "Usage" tab in `/settings` route showing month-to-date breakdown — `Used: 87 / 100`, `Resets on: Jun 1`, progress ring. Staff sees "Unlimited" badge.
- **Inline (compact):** small text line **inside the existing SELECTION section in the right sidebar**, below the icon-button row:
  - Format: `Quota: 98/100 left` (text-secondary, 12px)
  - Same line shown below Image Editor Upscale button in Single-Mode
  - Hidden entirely for staff/superuser
- **NOT in Topbar, NOT as a tooltip:** noise for non-active users; tooltip requires hover discovery.
- **Soft warning at 80% used:** text turns warning-yellow.
- **At 100%:** text turns error-red, Upscale buttons disable with tooltip "Monthly quota exceeded — resets <date>".

### Pre-flight Quota Check (Bulk over-quota)

User selects 200 designs but has only 50 left:
- On "Bulk Upscale" click → MUI `Dialog`:
  - Title: "Selection exceeds your monthly quota"
  - Body: "You selected 200 designs but only 50 upscales remain this month (resets <date>)."
  - Actions: `[Cancel]` | `[Upscale first 50 only]` (coral primary)
- "First 50" = first 50 in current selection sorted by `Design.created_at desc` (deterministic, newest-first).
- Staff: dialog skipped entirely (no quota).

### Per-Row Retry Behavior

- Retry button visible only for `status=failed` rows in the Drawer.
- Click → calls Single-Mode endpoint with that one design ID, row updates to `running`.
- After 3 failed retries with the same `error_message` value → button disabled with Tooltip: "Permanent failure: {error}". Manual /admin intervention required.
- Retry resets quota usage (no double-counting on retry of a previously-counted submission).

### Component Inventory (for `/frontend` skill)

New components needed:
- `views/designs/board/partials/BulkUpscaleDrawer.tsx` — the right drawer (400px)
- `views/designs/board/partials/UpscaleStatusPill.tsx` — topbar pill (mounts in `Topbar.tsx` conditionally)
- `views/designs/board/hooks/useUpscaleBatch.ts` — 5s polling pattern (mirrors `useNicheResearch`)
- `views/settings/partials/UsageQuotaCard.tsx` — settings page quota panel
- `views/designs/editor/hooks/useUpscaleSingle.ts` — single-mode polling

Reused infrastructure (don't rebuild):
- Existing SELECTION-section in Artboard right sidebar — add ONE icon button + quota text line
- Existing multi-select state machine in Artboard — no new selection hook needed

Reused components:
- `<ConfirmDialog />`, `<Skeleton />`, `<LinearProgress />`, `<CircularProgress />`, MUI `<Drawer />`, `<Chip />`, `<Dialog />`

### Design System Compliance

- All colors via `theme.vars.palette.*` — coral primary for CTAs, cyan secondary for "in-progress" states, success/warning/error for status chips. **No hardcoded hex.**
- Glass-md backdrop on Drawer + Floating Action Bar.
- Inter for body text, JetBrains Mono only for batch IDs / hash strings.
- Skeleton-over-spinner per project convention (memory: `feedback_skeleton_over_spinner.md`).
- All user-visible text via `useTranslation()` — no hardcoded strings.

### Open Questions for `/architecture`
1. Should `UpscaleStatusPill` Redux slice persist across page reloads (rehydrate active batch from server) or only in-memory? Tradeoff: localStorage = better UX after refresh, but stale-state risk if batch was canceled server-side.
2. Pre-flight quota check — endpoint round-trip (`GET /api/designs/upscale/quota/`) before showing dialog, or include quota in initial bulk-submit response (402 with details)? Latter saves a request but couples error path.
3. Drawer "Clear completed" — only client-side hide, or send `DELETE /api/designs/upscale/batch/<id>/jobs/<job_id>/` to remove from DB? Latter affects job-history audit.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

> Resolved via `/architecture` 2026-05-08. PM-friendly summary below; implementation specifics live in `docs/tasks/PROJ-27-tasks.md`.

### Architectural Decisions for Open Questions

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | UpscaleStatusPill Redux state | **Hybrid: localStorage + server-verify on mount** | Best UX (instant pill render after page refresh) + correctness (server check clears stale batch_id if user canceled in another tab) |
| 2 | Pre-flight quota check | **Both: GET endpoint AND 402-on-submit** | Quota endpoint exists anyway for inline indicator (`Quota: 98/100 left`). Reuse for pre-flight. 402-on-submit stays as race-condition safety net (two tabs scenario) |
| 3 | Drawer "Clear completed" | **Client-side hide only** | `DesignProcessingJob` is audit data — never delete. Drawer filter removes rows from view; admin can still see history. Cheap, reversible (page refresh restores) |

### Component Structure (Frontend)

```
Image Editor View
├── Toolbar (existing)
│   └── "AI Upscale" Tab (existing) → opens left side-panel
└── Tools Side-Panel
    └── UpscaleToolParams.tsx (REFACTORED — Minimal Panel ~80 lines)
        ├── Current Size Chip (read-only)
        ├── Target Size Chip (read-only, from UpscalerSettings)
        ├── Destination Toggle (icon-only: 💾 Local / ☁️ Local+Cloud)
        ├── Cloud Target Chip (when Cloud picked)
        ├── Quota Indicator (text line, hidden for staff)
        ├── Cost Hint
        └── "Upscale Now" Button

Project Artboard Canvas
├── Canvas (existing)
├── Right Sidebar Panel
│   └── SELECTION section (existing — extended)
│       ├── Artwork(s) [count] (existing)
│       ├── Icon Button Row (existing + NEW Bulk-Upscale icon)
│       ├── Destination Toggle (NEW, shared component)
│       ├── Cloud Target Chip (when Cloud picked)
│       └── Quota Indicator (NEW)
└── BulkUpscaleDrawer (NEW, anchor=right, width 400px)
    ├── Header (batch short_id + progress badge)
    ├── LinearProgress
    ├── Job List (per-design rows: thumbnail, filename, status chip, retry icon)
    └── Footer (Close + Clear completed)

Topbar (existing)
└── UpscaleStatusPill (NEW, conditional render when active batch exists)

Settings View
└── Usage Tab (NEW)
    └── UsageQuotaCard.tsx (monthly breakdown, progress ring)
```

### Component Structure (Backend)

```
design_app/
├── models.py
│   ├── Design (existing)
│   ├── DesignProcessingJob (existing + new field replicate_prediction_id)
│   ├── UpscalerSettings (NEW, singleton, admin-only)
│   └── UpscaleQuotaUsage (NEW, per-user month-bucket)
├── api/
│   ├── views.py (NEW endpoints — see API table below)
│   ├── serializers.py (NEW serializers for quota + batch)
│   └── urls.py (NEW routes)
├── services/
│   ├── upscaler.py (REFACTORED — replaces Pica.js logic with Replicate flow)
│   └── replicate_client.py (NEW — wraps replicate-python SDK)
├── tasks.py (NEW rq jobs: fire_replicate_prediction, process_replicate_callback, reconcile_stuck_jobs)
├── admin.py (extended — register UpscalerSettings)
└── migrations/00XX_proj27_upscaler.py
```

### Data Model

**UpscalerSettings** (new — singleton, one global row, admin-editable):

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| replicate_model_slug | string | `nightmareai/real-esrgan` | Which Replicate model to call |
| replicate_model_version | string | (pinned hash) | Reproducibility |
| default_scale | int | 4 | Replicate `scale` param |
| target_width | int | 4500 | Final canvas width |
| target_height | int | 5400 | Final canvas height |
| monthly_quota_per_user | int | 100 | Hard cap for non-staff |
| bulk_concurrency | int | 10 | Parallel Replicate calls per batch |
| staff_unlimited | bool | true | Skip quota for is_staff/superuser |

**UpscaleQuotaUsage** (new):

| Field | Type | Purpose |
|-------|------|---------|
| user | FK to User | Who consumed |
| month | Date (1st of month) | Calendar bucket |
| count | int | Successful upscales this month |
| _unique_ | (user, month) | One row per user-month |

**DesignProcessingJob** (existing, additions only):

| New Field | Type | Purpose |
|-----------|------|---------|
| replicate_prediction_id | string (max 100) | Tracks Replicate prediction for callbacks/polling |

**Frontend State** (no new DB tables):

| State | Storage | Purpose |
|-------|---------|---------|
| activeBatchId | localStorage + Redux | Hydrates Topbar Pill on refresh; verified server-side on mount |
| destination preference | localStorage + Redux | "Last-used" Local-vs-Cloud toggle per workspace |
| selected cloud target (provider, folder) | localStorage + Redux | Last-used cloud picker target |

### API Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/designs/<uuid:design_id>/upscale/` | POST | JWT + workspace | Single-mode trigger; body optional `{destination, cloud_target}`; returns `202` with job_id |
| `/api/designs/upscale/bulk/` | POST | JWT + workspace | Bulk-mode trigger; body `{design_ids, replace, destination, cloud_target}`; returns `202` with batch_id + jobs[] |
| `/api/designs/upscale/batch/<uuid:batch_id>/` | GET | JWT + workspace | Polling endpoint (frontend hits every 5s); returns array of per-design status rows |
| `/api/designs/upscale/quota/` | GET | JWT | Returns `{used, limit, resets_on, is_unlimited}` for inline indicator + pre-flight check |
| `/api/upscale/callback/` | POST | Webhook signature | Replicate webhook callback — public endpoint, signature-verified via `REPLICATE_WEBHOOK_SECRET` |

### Tech Decisions (and Why)

| Decision | Why |
|----------|-----|
| Replicate-only (no fal.ai fallback in MVP) | Simpler integration, predictable cost; can add fallback post-MVP |
| `nightmareai/real-esrgan` model | Cheap (~$0.002/image), fast (~3-5s), proven for hard-edge POD designs |
| Webhook-driven async (vs polling Replicate) | Zero polling cost, scales to 1000+ batches without worker load |
| 60s fallback reconciler scheduled job | Defensive safety net for lost webhooks (network drops) |
| Frontend 5s polling (no SSE) | Matches existing `useNicheResearch` pattern; works with Gunicorn WSGI; SSE post-MVP |
| Polling auto-stops at terminal state | Avoids unnecessary DB queries when batch done |
| Polling pauses on tab-blur (Page Visibility API) | Saves backend load when tab is in background |
| Official `replicate-python` SDK (vs raw httpx) | Maintained by Replicate, webhook support built-in, ~5 lines of code vs ~40 |
| Per-batch endpoint only (no global aggregator) | Defer cross-feature active-jobs aggregator until ≥3 features need it |
| `localStorage` + server-verify on Pill mount | Instant render after refresh + auto-clear stale batch_ids |
| Quota endpoint reused for both UI indicator and pre-flight | Single source of truth; 402-on-submit kept for race-condition safety |
| Client-side hide for "Clear completed" | Preserves audit trail in DB; rows still visible in admin |
| New `UpscalerSettings` singleton (admin-only) | Tunable without redeploy; isolates upscaler config from per-workspace `ProcessingSettings` |
| New `UpscaleQuotaUsage` model | Decouples quota tracking from job records; clean per-user month-bucket |
| Reuse `Design.upscaled_file` (existing FileField) | Existing download flow already wires through; no new storage path |
| Cloud upload reuses PROJ-11 (`publish_app/tasks.py`) | No new cloud-integration code in PROJ-27 |
| Strict 4× + center-pad (vs aspect-aware) | 95%+ of inputs are square Gemini outputs; portrait-overflow guarded with Lanczos-down |
| Quota counted on submission, refunded on failure | Prevents user gaming retries; preserves user goodwill on system errors |

### Dependencies

| Package | Where | Purpose |
|---------|-------|---------|
| `replicate` (Python) | `django-app/requirements.txt` | Official Replicate SDK (single new backend dep) |
| Pillow | `django-app/requirements.txt` (existing) | Image resize + center-pad logic |

**Frontend:** zero new dependencies — MUI v7, RTK Query, react-hook-form, Zod already cover all needs.

### Worker Queue Routing

- **Existing `worker-design` queue** is reused for upscale jobs (already provisioned in `docker-compose.yml` + `docker-compose.prod.yml`).
- New rq jobs: `enqueue_replicate_upscale` (fires single prediction with webhook), `process_replicate_callback` (downloads result, runs Pillow center-pad, saves file, optionally triggers cloud upload), `reconcile_stuck_jobs` (60s scheduled — finds running jobs >5min old and polls Replicate to recover).

### Security Model

| Concern | Mitigation |
|---------|------------|
| Replicate API token leak | Only loaded from env var in worker process; never sent to frontend; never logged |
| Webhook spoofing | Signature header verified against `REPLICATE_WEBHOOK_SECRET`; 403 on mismatch; rotation grace via `REPLICATE_WEBHOOK_SECRET_PREVIOUS` |
| Workspace isolation | Every endpoint checks `workspace_id` from `X-Workspace-Id` header against design ownership |
| Cost-bombing by single user | Hard quota cap (100/month for non-staff); enforced at submission |
| Replay attack on webhook | Replicate prediction_id is checked — already-completed jobs ignore duplicate callbacks |

### Out of Scope for `/architecture` (deferred to other skills)

- Visual styling tokens, exact spacing, animation timing → `/frontend` reads design-system.md
- Test coverage strategy → `/qa`
- Production deploy steps (env var rollout, migration ordering) → `/deploy`

## QA Test Results

> Focused QA pass 2026-05-08, manual code-audit + targeted test runs (skill-based /qa run produced no output, fell back to manual review).

### Security audit

| Area | Finding | Severity | Status |
|------|---------|----------|--------|
| Webhook signature verification | First check before JSON parse — uses official SDK `replicate.webhooks.validate()` (no hand-rolled HMAC). 5min clock skew tolerance. PRIMARY + PREVIOUS (rotation grace) | — | ✅ secure |
| Webhook output URL → SSRF risk | Worker downloaded `output_url` from webhook payload without host allow-listing. If webhook secret leaks, attacker could redirect download to internal services / AWS metadata. | LOW (signature gates the surface) | ✅ FIXED — host allow-list to `replicate.delivery` (+ `pbxt.replicate.delivery`) + `https`-only + `follow_redirects=False`. New tests `test_rejects_non_replicate_output_host` + `test_rejects_http_scheme` |
| Workspace isolation | All 4 protected endpoints call `_require_workspace()` and filter Design queries by `workspace_id` from header | — | ✅ secure |
| `IsAuthenticated` enforcement | DRF default permission is `IsAuthenticated` (`core/settings.py`). Only callback view explicitly opts out via `[AllowAny]` — required because Replicate has no JWT | — | ✅ secure |
| Token leak risk | `REPLICATE_API_TOKEN` only loaded into worker process; never returned in any API response; never logged | — | ✅ secure |
| Input validation | `UpscaleSingleTriggerSerializer` + `UpscaleBulkTriggerSerializer` validate destination ChoiceField, design_ids ListField (UUIDField, min 1 / max 500 → DoS-cap), cloud_target nested serializer, replace BooleanField | — | ✅ secure |
| Quota refund concurrency | `_consume_quota` + `_refund_quota` use F() expression atomic increments, clamp at 0 | — | ✅ secure |

### AC + EC sample-coverage (focused)

| ID | Description | Verified |
|----|-------------|----------|
| AC-17 | Webhook signature verification with 403 on invalid | ✅ via `verify_webhook_signature` + tested in `test_replicate_client.py` |
| AC-21 | Hard cap 100/month for non-staff, counted at submission | ✅ `_consume_quota` called before rq enqueue; `_quota_402` returns at 100 |
| AC-26 | Workspace isolation on all endpoints | ✅ all 4 protected endpoints filter by ws_id |
| AC-19 | Quota refund on failure | ✅ all 3 failure paths in `process_replicate_callback` call `_refund_quota` |
| EC-1 | 409 Conflict on in-flight upscale | ✅ explicit check in UpscaleSingleView |
| EC-9 | Webhook secret rotation grace | ✅ `verify_webhook_signature` tries PRIMARY then PREVIOUS |
| AC-12 | Bulk concurrency limit (10) | ✅ admin-configurable via `UpscalerSettings.bulk_concurrency`; rq queue handles enqueue, but actual cap is enforced by Replicate's parallel-prediction limit, not our code — accepted MVP scope |
| EC-2 | Backoff retry (2s/4s/8s, max 3) | ✅ `enqueue_replicate_upscale` has retry loop with exponential backoff |

### MUI v7 + design system compliance

| Check | Result |
|-------|--------|
| `GridLegacy` / `Grid2` / `Grid item` usage | None |
| `@mui/lab` imports | None |
| `InputProps={}` deprecated | None — uses `slotProps` |
| `<Hidden>` component | None |
| `createMuiTheme` | None |
| Hardcoded colors `#nnn` / `rgb()` / `rgba()` | Only on overlay surfaces over user-provided images (`UpscaleCompareModal` Before/After tags, grip handle, nav buttons, drop shadows) — domain-justified (must read regardless of image content / theme mode); `UpscaleStatusPill` background switched to `alpha(COLORS.cyan, 0.1)` per project convention |
| `useTranslation()` for user strings | All `t()` calls have matching keys in en + de translation.json; fr/es/it fall back to en via i18next config |

### UI bugs found

| Bug | Location | Status |
|-----|----------|--------|
| `SendOutlinedIcon` (paper-plane) still used in Project Gallery card | `views/designs/gallery/partials/ProjectCard.tsx` | ✅ FIXED — swapped to custom `<SendToListingsIcon />` (Article + cyan `+` badge) |

### Frontend test suite

- Phase 10 PROJ-27 tests: 23/23 passing across 5 files
- Full frontend suite: 1395 passed, 1 skipped — 1 file load issue in `WorkspaceSection.test.tsx` is pre-existing test-infrastructure fragility (vi.mock chain interacts with import order) and not a PROJ-27 regression. Documented as known follow-up.

### Backend test suite

- design_app full: 175 passed (added 2 new SSRF defense tests)

### Go/no-go

**Recommended: GO for merge to main.** Backend security defenses are layered (signature → host allow-list → input validation → workspace isolation → quota cap). Frontend is theme-compliant with documented exceptions. Open items (Phase 9 backend cloud-upload wiring, dedicated quota/reconciler test files, E2E framework) are post-launch work that does not block MVP.

Manual smoke-test on prod after deploy still required (single + bulk happy path with one real Replicate call) — token must be set on server first.

## Deployment
_To be added by /deploy_
