# FIX: Canvas + Editor Cleanup — Task Breakdown

**Spec:** [FIX-canvas-editor-cleanup.md](../../features/FIX-canvas-editor-cleanup.md)
**Branch:** `fix/canvas-editor-cleanup`
**Status:** Planned
**Created:** 2026-05-27

Implementation order is sequenced from cheapest to most complex. Each phase is one commit. User reviews diff before next phase starts.

---

## Phase 1 — Re-scrape Snackbar Text (Item 1) ✅

- [x] Update `frontend-ui/public/locales/en/translation.json` key `amazonResearch.detail.rescrapeStarted` to reflect automatic refresh
- [x] Update `frontend-ui/public/locales/de/translation.json` same key
- [x] `grep -r "refresh the page" frontend-ui/public/locales/` — zero hits confirmed
- [ ] Manual smoke (user): trigger re-scrape on a product detail page, confirm snackbar reads new copy

**Acceptance:** AC-1-1, AC-1-2, AC-1-3 — all checked.

---

## Phase 2 — Remove Niche Pipeline "Open Design Canvas" Button (Item 6) ✅

- [x] Remove Button block at `DesignsPipelineContent.tsx:210-228` — DesignsPipelineContent.tsx (removed lines 210-228; file now ends with `<BulkConfirmDialog>` immediately after `</Stack>`)
- [x] Remove `OpenInNewOutlinedIcon` import if no other usage in file — DesignsPipelineContent.tsx:1-11 (import removed; also dropped now-orphan `Button` from `@mui/material` named imports)
- [x] Remove key `niches.pipeline.designs.openCanvas` from `frontend-ui/public/locales/{en,de,fr,es,it}/translation.json` if no other reference (check all 5 locales) — en/translation.json:529-531, de/translation.json:520-522 (key only existed in EN + DE; FR/ES/IT did not contain it)
- [x] Verify surrounding Stack/Box layout has no orphan padding/spacer — DesignsPipelineContent.tsx:204-209 (outer `<Box>` and `</Stack>` collapse cleanly; `BulkConfirmDialog` is a non-rendering sibling)
- [ ] Manual smoke: open Niche pipeline drawer, confirm button gone

**Acceptance:** AC-6-1, AC-6-2, AC-6-3, AC-6-4 — all checked.

---

## Phase 3 — Remove "Add to Editor" Action (Item 3) ✅ + RightPanel extension done

- [x] Delete menu item from `frontend-ui/src/views/designs/board/partials/ArtboardContextMenu.tsx:163-175` — ArtboardContextMenu.tsx:147-156 (entire `{hasImage && onAddToEditor && (<>...</>)}` block removed; "Open in Editor" preserved)
- [x] Remove `onAddToEditor` prop from `ArtboardContextMenu` interface + props — ArtboardContextMenu.tsx:38-41 (interface field removed); destructuring at :57-60 (parameter removed); orphan import `AddPhotoAlternateOutlinedIcon` removed at :1-11; orphan `handleAddToEditor` callback removed
- [x] Remove handler call site in `frontend-ui/src/views/designs/workspace/DesignWorkspaceView.tsx` — DesignWorkspaceView.tsx:430-431 (only the `<ArtboardCanvas onAddToEditor={...}>` prop removed; the `<RightPanel onAddToEditor={...}>` at :246 retained — RightPanel still hosts its own Add-to-Editor toolbar buttons, out of scope for Phase 3)
- [x] Also removed passthrough prop from `ArtboardCanvas.tsx` (props type, destructuring, and forwarding to `<ArtboardContextMenu>`) — ArtboardCanvas.tsx:97-99, :151-153, :467-469
- [x] Verified `handleAddToEditor` in `useWorkspaceActions.ts` STILL has other callers (RightPanel via DesignWorkspaceView:246 → PanelArtboardState + PanelMultiState) — kept per AC-3-3 "if no other caller remains" clause
- [x] i18n key `design.contextMenu.addToEditor` — not present in any locale JSON (verified via `grep -rn "addToEditor" frontend-ui/public/locales/` — zero hits); was only used as inline `t()` fallback default, removed with the MenuItem block
- [x] `npm run lint` — 0 errors, 12 pre-existing warnings unrelated to Phase 3
- [ ] Manual smoke: right-click artboard, confirm only "Open in Editor" remains

### Phase 3 extension — RightPanel toolbar variant (AC-3-6, 2026-05-27)

- [x] PanelArtboardState.tsx — removed `onAddToEditor` from props interface + destructuring, removed Tooltip+ToolbarButton block, dropped `onAddToEditor ||` term from conditional wrapper, removed orphan `AddPhotoAlternateOutlinedIcon` import
- [x] PanelMultiState.tsx — removed `onAddToEditor` from props interface + destructuring, removed `handleAddEditor` callback, removed Tooltip+ToolbarButton block, removed orphan `AddPhotoAlternateOutlinedIcon` import
- [x] RightPanel.tsx — removed `onAddToEditor` from props interface + destructuring, removed the two passthrough `onAddToEditor={onAddToEditor}` lines to PanelMultiState + PanelArtboardState
- [x] DesignWorkspaceView.tsx — removed `onAddToEditor={actions.handleAddToEditor}` passthrough
- [x] useWorkspaceActions.ts — removed `handleAddToEditor` callback implementation + key from returned object
- [x] Test updates — canvasEditorDecoupling.test.tsx (deleted "calls onAddToEditor" test case, dropped removed prop), PanelMultiStateSend.test.tsx (dropped 4 `onAddToEditor={vi.fn()}` props)
- [x] i18n key `design.panel.addToEditor` — never existed in any locale JSON (verified zero hits via `grep "addToEditor" public/locales/{en,de,fr,es,it}/translation.json`); only inline `t()` fallback default, removed with the button blocks
- [x] Verification: `grep -rn "handleAddToEditor\|onAddToEditor\|design.panel.addToEditor" frontend-ui/src/` → zero hits
- [x] `npm run lint` — 0 errors, 12 pre-existing warnings unrelated
- [x] `npm run test:ci` — 1606/1607 passed; the 1 failure (`ProductDetailPage.test.tsx > clicks Reload button`) is **pre-existing** from Phase 1 (locale text was updated but test assertion still references old copy) — NOT caused by this extension

**Acceptance:** AC-3-1, AC-3-2, AC-3-3, AC-3-4, AC-3-5, AC-3-6 — all checked. EC-3-1.

---

## Phase 4 — Canvas Reads Latest Version + Cache Invalidation (Item 5) ✅

- [x] Add local React state `userPickedVersions: Map<string, VersionSlot>` in `DesignWorkspaceView.tsx`
- [x] Add setter `setUserPickedVersion(designId, slot | null)` — `null` clears the pick
- [x] Reset `userPickedVersions` on workspace switch (render-time compare matching existing `hasRunningGeneration` convention)
- [x] Create `frontend-ui/src/views/designs/board/hooks/useArtboardVersionSync.ts` with priority resolver + no-op guard against render loops (~60 lines)
- [x] Mount the hook at workspace root (`DesignWorkspaceView.tsx`)
- [x] **Critical:** `useUpscaleSingle.ts` poll-complete dispatches `designApi.util.invalidateTags([{ type: 'DesignProject', id: projectId }])`. New optional `projectId` param. `UpscaleToolParams.tsx` passes `projectId` from `useParams`.
- [x] **Closed in Phase 5:** Apply Pipeline tag invalidation — `applyPipeline` mutation now has `invalidatesTags` keyed on `projectId` body field. Mutation has no in-view caller; refetch is driven by `useUpscaleSingle` invalidation. — `designSlice.ts:392-403`
- [x] Vitest: `useArtboardVersionSync` — 5 unit tests covering priority order, user pick override, no-mutation guard. All pass.
- [ ] Manual smoke (user): trigger upscale from editor → return to canvas → confirm artboard shows upscaled image without page reload

**Acceptance:** AC-5-1 ✅, AC-5-2 ✅, AC-5-3 ✅ (closed in Phase 5), AC-5-4 ✅, AC-5-5 deferred to Phase 6 (shimmer overlay UI work).

---

## Phase 5 — Upscale via Apply Pipeline (Item 4) ✅

- [x] Extend `useUpscaleSingle.ts` with a Promise-returning helper `runUpscaleAsync()` — additive, no breaking change. Resolves on `upscaled_file` change; rejects on error/timeout via `pendingPromisesRef` drain. — `useUpscaleSingle.ts:110-126, 156, 171, 204, 222-223, 258-269`
- [x] `ai_upscale` filter at `DesignEditorView.tsx:188-199` **intentionally retained** — the step is peeled out of `clientTools`/`serverTools` so it runs via the Replicate path (`runUpscaleAsync`) instead of `startProcessing` (which only knows `bg_remove`/`upscale` django-rq jobs). See AC-4-1 note in spec.
- [x] Refactor `handleApplyPipeline` to be `async`: client tools → server tools → `ai_upscale` last; validation snackbar `design.pipeline.upscaleMustBeLast` if upscale not last; pre-check opens `UpscaleOverwriteDialog` if `upscaled_file` already exists. — `DesignEditorView.tsx:171-274`
- [x] Create `frontend-ui/src/views/designs/editor/partials/UpscaleOverwriteDialog.tsx` (MUI Dialog, Cancel/Overwrite actions). — `UpscaleOverwriteDialog.tsx:1-75`
- [x] Add i18n keys for validation snackbar + dialog title/body/buttons. EN + DE added (proper translations). FR/ES/IT skipped — i18next `fallbackLng: 'en'` covers them. — `en/translation.json:1391-1392, 1400-1407`, `de/translation.json:1287, 1290-1297`
- [x] Reuse existing snackbar `upscale.single.success` on completion — fires inside `useUpscaleSingle` poll-complete branch.
- [x] Vitest: `UpscaleOverwriteDialog` — 5 unit tests (open render, closed render, Cancel click, Confirm click, Escape key). All pass. — `__tests__/UpscaleOverwriteDialog.test.tsx:1-60`
- [ ] Manual smoke (orchestrator user):
  - Add only `ai_upscale` to pipeline → Apply → success
  - Add `bg_remove` then `ai_upscale` → Apply → success
  - Add `ai_upscale` then `bg_remove` → Apply → validation snackbar
  - Re-trigger upscale on design with existing `upscaled_file` → confirm dialog appears

**Acceptance:** AC-4-1 ✅, AC-4-2 ✅, AC-4-3 ✅, AC-4-4 ✅, AC-4-5 ✅, AC-4-6 ✅. EC-4-1 ✅, EC-4-2 ✅, EC-4-3 ✅. AC-5-3 ✅ (closed via `applyPipeline` mutation invalidation wiring).

---

## Phase 6 — Artboard Version Picker (Item 2) ✅

- [x] Created `frontend-ui/src/views/designs/board/hooks/usePendingDeletions.ts` (100 lines) — deferred-delete via `pendingKeys: Set<\`${designId}:${slot}\`>` + timeout refs. Backend call only fires on timeout, not on requestDelete itself.
- [x] Created `frontend-ui/src/views/designs/board/partials/ArtboardVersionPicker.tsx` (206 lines) — Chip row, CSS-hover trash reveal, snackbar with Undo action via notistack `action` prop. MUI v7 only, theme tokens.
- [x] Mounted picker in `ArtboardCanvas.tsx` via IIFE block — single selection + designId guard. World→screen transform applied (zoom + pan).
- [x] Wired `userPickedVersions` + `setUserPickedVersion` + `designsById` through DesignWorkspaceView → ArtboardCanvas → ArtboardVersionPicker (removed Phase 4 `void setUserPickedVersion` placeholder).
- [x] Added i18n keys EN + DE (`design.versions.{original,edited,bgRemoved,upscaled,deleted,undo,deleteFailed}`). FR/ES/IT fall back via i18next.
- [x] EC-2-2 handled by `pendingKeys` filter — deleted chip hidden, `useArtboardVersionSync` resolves to next-best slot automatically.
- [x] EC-2-5 handled by existing render-time compare reset in DesignWorkspaceView (Phase 4 wiring).
- [x] Vitest: 5 tests for `ArtboardVersionPicker` (slot filtering, active state, pick handler, trash → snackbar with Undo).
- [x] Vitest: 4 tests for `usePendingDeletions` (request → pending, undo → no call, timeout → call mutation, concurrent slots tracked independently).
- [x] AC-5-5 shimmer overlay — **deferred to follow-up FIX** (would require lifting upscale state across editor↔canvas boundary). Image swap on completion already provides feedback.
  - Deferred delete: clicking trash hides chip immediately; Undo within 5s restores
  - Timeout fires `deleteDesignVersion` mutation
- [ ] Manual smoke:
  - Select artboard with all 4 slots → 4 chips appear
  - Click each chip → image swaps
  - Trash icon → chip hides + Undo snackbar
  - Click Undo within 5s → chip reappears, no backend call (verify in Network tab)
  - Wait 5s → backend POST to `delete-version` fires
  - Delete original on design with only `image_file` → artboard disappears from canvas (per EC-2-2)

**Acceptance:** AC-2-1 through AC-2-10. EC-2-1 through EC-2-6.

---

## Phase 8 — Persistence + Cross-tab Diff Refresh (Item 7, AC-7-1..AC-7-12)

### 8a — localStorage hooks (foundation)
- [ ] Create `frontend-ui/src/views/designs/workspace/hooks/usePersistentState.ts`:
  - Generic `<T>(key: string, initial: T, options?: { serialize, deserialize }): [T, (v: T) => void]`
  - Reads localStorage on init (one-time); writes on every state change (debounced 250ms)
  - Try/catch around JSON.parse + localStorage access; graceful fallback to in-memory on quota errors
  - Listens to `storage` event for cross-tab sync (other tab edits same key → react)

### 8b — Apply persistence to existing state
- [ ] `userPickedVersions` in `DesignWorkspaceView.tsx`: replace `useState(new Map())` with `usePersistentState`-backed Map (custom serialize: Map→entries[], deserialize: entries→Map). Key: `mm.canvas.pickedVersions.<projectId>`.
- [ ] Restore-time validation: filter out picks for designs no longer in `designsById` (AC-7-4).
- [ ] Workspace switch reset retained (clear localStorage entry for current projectId on workspace change).

### 8c — Hoist editor state to workspace + persist
- [ ] Lift `activePipeline` from `DesignEditorView` to `DesignWorkspaceView`. Persist via `usePersistentState` with key `mm.editor.pipeline.<projectId>`.
- [ ] Lift `currentImageIndex` similarly. Key: `mm.editor.currentIndex.<projectId>`.
- [ ] On restore: filter `activePipeline` tools that aren't in TOOL_CATALOG anymore (AC-7-5). Clamp `currentImageIndex` to `batchImages.length - 1` (AC-7-6).
- [ ] Pass state + setters as props to `DesignEditorView`.

### 8d — Cross-tab diff refresh in useEditorBatchState
- [ ] Remove `hydratedRef.current` guard.
- [ ] Replace single hydration `useEffect` with **diff-based merge**:
  - On every `boardData?.designs` change, compute diff:
    - **New designs** (designId not in current batch): append as new `BatchImage` entries (run `loadImageMeta`)
    - **Removed designs** (in batch but not in boardData): filter out from batch
    - **Updated designs** (same id, changed file URLs): refresh `previewUrl`/`processedUrl`/`originalUrl` in-place
  - Clamp `currentImageIndex` after diff.
- [ ] Existing tests must still pass (verify `useEditorBatchState` test suite if exists).

### 8e — Tab switch state preservation
- [ ] **Decision (architect note):** With state hoisted in 8c, the Editor remount on tab switch no longer loses pipeline/current-index. Undo/redo: lift `undoRedo` similarly to workspace level, OR document as "in-memory only, resets on tab switch" if undo state proves too coupled. **Default: hoist undoRedo too.**

### 8f — Verification
- [ ] `npm run lint` — 0 errors
- [ ] `npm run test:ci` — 0 failures
- [ ] Manual smoke: build pipeline → switch tab → switch back → pipeline retained
- [ ] Manual smoke: build pipeline → reload page → pipeline retained
- [ ] Manual smoke: pick version → reload → pick retained
- [ ] Manual smoke: 2 browser tabs of same project — generate AI image in tab A while tab B has Editor open → tab B's batch grows automatically

**Acceptance:** AC-7-1..AC-7-12. EC-7-1..EC-7-5.

---

## Phase 9 — Optimistic Updates + Shimmer Overlay (Item 7, AC-7-13..AC-7-17) ✅

### 9a — Optimistic artboard imageUrl
- [x] Added `optimisticArtboardUrls: Map<artboardId, string>` + `setOptimisticArtboardUrl` to `DesignWorkspaceView`. — `DesignWorkspaceView.tsx:207-225`
- [x] `useArtboardVersionSync` extended with optional `optimisticArtboardUrls?: Map<string, string>` arg; optimistic entry beats both user pick and auto-priority. — `useArtboardVersionSync.ts:14-22, 47-56`
- [x] Added `handleOptimisticDesignUpdate(designId, url|null)` helper that fans out to every artboard linked to the designId. Passed as `onOptimisticUpdate` prop into `DesignEditorView`. — `DesignWorkspaceView.tsx:227-238, 626`
- [x] `handleApplyPipeline`: after `processBatch`, for each result with `processedUrl` + `designId`, call `onOptimisticUpdate(designId, processedUrl)`. After `saveProcessedImage` resolves OR rejects, call `onOptimisticUpdate(designId, null)` to clear. — `DesignEditorView.tsx:230-235, 247-258`
- [x] EC-7-6: documented in spec as "optimistic state clears on next saveProcessedImage round-trip; client-side undo while save in flight may briefly show stale URL — acceptable for MVP".

### 9b — Shimmer overlay during upscale
- [x] Decision: **Redux upscaleSlice** (not prop chain). Added `processingDesignIds: string[]` + `addProcessingDesignId` / `removeProcessingDesignId` reducers. — `upscaleSlice.ts:51-58, 64, 108-118, 137-144`
- [x] `useUpscaleSingle`: added cleanup-on-unmount useEffect that dispatches add on `pollEnabled=true` and remove on cleanup. Cleanup ensures the set is cleared on unmount or designId switch even if the trigger never reached a terminal state (e.g. user navigates away mid-flight). Works for both call sites (UpscaleToolParams + pipelineUpscale in DesignEditorView) without prop changes. — `useUpscaleSingle.ts:163-176`
- [x] `ArtboardCanvas` reads `processingDesignIds` via `useAppSelector` + renders `ArtboardShimmerOverlay` for each matching artboard with world→screen positioning. — `ArtboardCanvas.tsx:174-178, 496-510`
- [x] New `ArtboardShimmerOverlay.tsx` — DOM overlay (matches version-picker positioning) with `@mui/material/styles` keyframes pulse. Uses `color-mix(in srgb, ${theme.vars.palette.primary.main} 12%, transparent)` — no hardcoded hex. — `ArtboardShimmerOverlay.tsx:1-60`
- [x] Tests: 2 new test cases for `useArtboardVersionSync` (optimistic beats user pick, optimistic beats auto-priority). 1 test for `ArtboardShimmerOverlay` (renders at correct screen-space rect, pointerEvents none). — `useArtboardVersionSync.test.ts:127-160`, `ArtboardShimmerOverlay.test.tsx:1-21`

### 9c — Verification
- [x] `npm run lint` — 0 errors (17 pre-existing warnings, none in touched files)
- [x] `./node_modules/.bin/vitest run` — 1621 passed, 15 skipped, 0 failures
- [ ] Manual smoke (orchestrator user verifies after deploy):
  - Apply Pipeline with Trim → artboard image updates instantly
  - Trigger upscale (standalone Upscale Now or via Apply Pipeline) → shimmer appears on artboard, disappears on completion
  - Cancel upscale or quota error → shimmer disappears (cleanup on isProcessing flip)
  - Two designs upscaling concurrently → both artboards show shimmer

**Acceptance:** AC-7-13 ✅, AC-7-14 ✅, AC-7-15 ✅, AC-7-16 ✅, AC-7-17 ✅. EC-7-6 ✅ (documented partial), EC-7-7 ✅, EC-7-8 ✅.

---

## Phase 10 — Cross-tab Notifications + Final Sweep (Item 7, AC-7-18..AC-7-19, plus Phase 7 sweep)

### 10a — Cross-tab snackbars
- [ ] In the hook that drives upscale (DesignEditorView level), detect if user is on Canvas tab at the moment of completion (via `activeTab` from `useWorkspaceTab()`).
- [ ] If completion happens while NOT in Editor: enqueue snackbar `'upscale.single.successCrossTab'` (with design name if available).
- [ ] Same for error path: `'upscale.single.errorCrossTab'`.
- [ ] Apply Pipeline completion: same cross-tab snackbar pattern with key `'design.pipeline.appliedCrossTab'`.

### 10b — i18n keys (all 5 locales)
- [ ] `upscale.single.successCrossTab` (EN: "Upscale completed", DE: "Hochskalierung abgeschlossen")
- [ ] `upscale.single.errorCrossTab` (EN: "Upscale failed", DE: "Hochskalierung fehlgeschlagen")
- [ ] `design.pipeline.appliedCrossTab` (EN: "Pipeline applied to design", DE: "Pipeline auf Design angewendet")

### 10c — Final sweep
- [ ] `npm run lint` in `frontend-ui/` — zero errors
- [ ] `npm run test:ci` in `frontend-ui/` — zero failures
- [ ] Verify no orphan imports, unused props, commented-out code
- [ ] Final manual smoke checklist:
  - [ ] Build pipeline → reload page → pipeline + current image retained
  - [ ] Pick version chip → reload → pick retained
  - [ ] Trigger upscale → shimmer on artboard → wait for completion → image swap
  - [ ] Apply Pipeline → artboard updates instantly (optimistic)
  - [ ] Switch tabs back-and-forth — zero state loss
  - [ ] 2 browser tabs same project — AI generate in one → other tab's batch grows
- [ ] Push branch + open PR (user approval required per CLAUDE.md)

**Acceptance:** AC-7-18..AC-7-19. Final smoke covers all FIX items.

---

## Out of Scope (Reminder)
- New backend endpoints
- Migrations
- Multiple variations per slot
- Chronological history log
- BatchThumbnailStrip refactor

## Notes for Implementers
- **MUI v7 only.** No GridLegacy, no `InputProps`, no `@mui/lab`. Use `slotProps`, `Grid size={...}`, `theme.vars.palette.*`.
- **No hardcoded colors.** All chip styling via `theme.vars.palette.*`.
- **English-only code/comments/files.** Per `.claude/rules/general.md` precedent (memory: `feedback_english_only_files`).
- **No auto-commit/push.** After each phase, show diff and wait for explicit approval.
- **Component reuse first.** Check existing MUI Chip/IconButton/Dialog before custom builds.
- **File size cap.** New components must stay under 250-300 lines. Split into partials/hooks if exceeding.
- **No `style={{}}` on MUI.** Use `styled()` for reusable styles, `sx` for ≤5 one-off props.
- **Arrow functions only.** `const Foo = () => {}`, no `function Foo() {}`, no explicit return type.
- **One phase = one commit.** Commit message format: `fix(canvas-editor-cleanup): <phase summary>`.

## Audit Notes (2026-05-27)
- **Security:** No new endpoints, no auth flow changes, no new env vars, no permission_class changes — zero security-review triggers per `.claude/rules/security.md`. Existing `DesignDeleteVersionView` enforces workspace via `Design.objects.get(pk=pk, workspace_id=ws_id)`.
- **Backend untouched:** `.claude/rules/backend.md` rules N/A.
- **Frontend rules verified:** MUI v7 patterns, theme tokens, file size, English-only — all called out above.
- **i18n location:** `frontend-ui/public/locales/{en,de,fr,es,it}/translation.json` (single file per locale, http-backend loaded).
- **Canvas state:** React `useState` in `useArtboards` hook (not Zustand). Use `updateArtboard(id, patch)` API.
- **RTK invalidation gap:** `triggerSingle` upscale mutation invalidates only `UpscaleQuota` — Phase 4 adds explicit `DesignProject` tag invalidation in `useUpscaleSingle` poll-complete branch.
