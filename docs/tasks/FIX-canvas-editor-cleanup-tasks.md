# FIX: Canvas + Editor Cleanup — Task Breakdown

**Spec:** [FIX-canvas-editor-cleanup.md](../../features/FIX-canvas-editor-cleanup.md)
**Branch:** `fix/canvas-editor-cleanup`
**Status:** Planned
**Created:** 2026-05-27

Implementation order is sequenced from cheapest to most complex. Each phase is one commit. User reviews diff before next phase starts.

---

## Phase 1 — Re-scrape Snackbar Text (Item 1)

- [ ] Update `frontend-ui/public/locales/en/translation.json` key `amazonResearch.detail.rescrapeStarted` to reflect automatic refresh (e.g. `"Scrape started — data will refresh automatically in ~30s."`)
- [ ] Update `frontend-ui/public/locales/de/translation.json` same key (e.g. `"Scrape gestartet — Daten aktualisieren sich automatisch in ~30s."`)
- [ ] `grep -r "refresh the page" frontend-ui/public/locales/` — verify no stale copies elsewhere
- [ ] Manual smoke: trigger re-scrape on a product detail page, confirm snackbar reads new copy

**Acceptance:** AC-1-1, AC-1-2, AC-1-3 — all checked.

---

## Phase 2 — Remove Niche Pipeline "Open Design Canvas" Button (Item 6)

- [ ] Remove Button block at `DesignsPipelineContent.tsx:210-228`
- [ ] Remove `OpenInNewOutlinedIcon` import if no other usage in file
- [ ] Remove key `niches.pipeline.designs.openCanvas` from `frontend-ui/public/locales/{en,de,fr,es,it}/translation.json` if no other reference (check all 5 locales)
- [ ] Verify surrounding Stack/Box layout has no orphan padding/spacer
- [ ] Manual smoke: open Niche pipeline drawer, confirm button gone

**Acceptance:** AC-6-1, AC-6-2, AC-6-3, AC-6-4 — all checked.

---

## Phase 3 — Remove "Add to Editor" Action (Item 3)

- [ ] Delete menu item from `frontend-ui/src/views/designs/board/partials/ArtboardContextMenu.tsx:163-175`
- [ ] Remove `onAddToEditor` prop from `ArtboardContextMenu` interface + props
- [ ] Remove handler call site in `frontend-ui/src/views/designs/workspace/DesignWorkspaceView.tsx`
- [ ] Remove `handleAddToEditor` from `frontend-ui/src/views/designs/workspace/hooks/useWorkspaceActions.ts` if no other caller (verify via `grep -r "handleAddToEditor" frontend-ui/src/`)
- [ ] Remove key `design.contextMenu.addToEditor` from all 5 locale JSONs
- [ ] Run `npm run lint` to catch orphan imports/types
- [ ] Manual smoke: right-click artboard, confirm only "Open in Editor" remains

**Acceptance:** AC-3-1, AC-3-2, AC-3-3, AC-3-4, AC-3-5 — all checked. EC-3-1.

---

## Phase 4 — Canvas Reads Latest Version + Cache Invalidation (Item 5)

- [ ] Add local React state `userPickedVersions: Map<string, 'original'|'processed'|'bg_removed'|'upscaled'>` in `frontend-ui/src/views/designs/workspace/DesignWorkspaceView.tsx`
- [ ] Add setter `setUserPickedVersion(designId, slot | null)` — `null` clears the pick (back to auto-latest)
- [ ] Reset `userPickedVersions` on workspace switch (existing workspace-switch signal in DesignWorkspaceView)
- [ ] Create `frontend-ui/src/views/designs/board/hooks/useArtboardVersionSync.ts`:
  - Args: `{ artboards, designsById, userPickedVersions, updateArtboard }`
  - For each artboard with `designId`: compute priority URL (user pick > upscaled > bg_removed > processed > image_file)
  - Only call `updateArtboard(id, { imageUrl: newUrl })` if `newUrl !== artboard.imageUrl` (avoid render loops)
  - Use `useEffect` with stable deps
- [ ] Mount the hook once at canvas root (`DesignWorkspaceView` or `ArtboardCanvas`)
- [ ] **Critical:** In `useUpscaleSingle.ts`, on poll-complete (`upscaled_file` change detected), dispatch `designSlice.util.invalidateTags([{ type: 'DesignProject', id: projectId }])` — the existing `triggerSingle` mutation only invalidates `UpscaleQuota`, NOT DesignProject
- [ ] Verify Editor "Apply Pipeline" server response already invalidates `DesignProject` tag (read `applyPipeline` mutation in store); if not, add invalidation
- [ ] Vitest: `useArtboardVersionSync` — unit test the priority logic with mock Designs
- [ ] Manual smoke: trigger upscale from editor → return to canvas → confirm artboard shows upscaled image without page reload

**Acceptance:** AC-5-1, AC-5-2, AC-5-3, AC-5-4, AC-5-5. EC-5-1 through EC-5-4.

---

## Phase 5 — Upscale via Apply Pipeline (Item 4)

- [ ] Extend `useUpscaleSingle.ts` with a Promise-returning helper (e.g. `runUpscaleAsync(design)`) — additive, no breaking change to existing trigger function
  - Internally: trigger Replicate + poll; resolve on `upscaled_file` change; reject on error/timeout
- [ ] Remove the `ai_upscale` filter at `DesignEditorView.tsx:128-144`
- [ ] Refactor `handleApplyPipeline` to be `async`:
  - Run client tools first (existing logic)
  - Run server tools — if `ai_upscale` present, MUST be last index, else show validation snackbar `'design.pipeline.upscaleMustBeLast'` and abort
  - For non-upscale server tools: existing behaviour
  - For `ai_upscale` step: pre-check — if `upscaled_file` already set, show `UpscaleOverwriteDialog`; on cancel, abort; on confirm, call `runUpscaleAsync(design)` and await
- [ ] Create `frontend-ui/src/views/designs/editor/partials/UpscaleOverwriteDialog.tsx` (MUI Dialog, Cancel/Overwrite actions)
- [ ] Add i18n keys for validation snackbar + dialog title/body/buttons in all 5 locales (EN + DE proper, FR/ES/IT fallback)
- [ ] Reuse existing snackbar `upscale.single.success` on completion
- [ ] Vitest: `useUpscaleSingle.runUpscaleAsync` resolves on success, rejects on error
- [ ] Manual smoke:
  - Add only `ai_upscale` to pipeline → Apply → success
  - Add `bg_remove` then `ai_upscale` → Apply → success
  - Add `ai_upscale` then `bg_remove` → Apply → validation snackbar
  - Re-trigger upscale on design with existing `upscaled_file` → confirm dialog appears

**Acceptance:** AC-4-1, AC-4-2, AC-4-3, AC-4-4, AC-4-5, AC-4-6. EC-4-1, EC-4-2, EC-4-3.

---

## Phase 6 — Artboard Version Picker (Item 2)

- [ ] Create `frontend-ui/src/views/designs/board/hooks/usePendingDeletions.ts`:
  - State: `pendingDeletions` map keyed by `${designId}:${slot}`
  - Action `requestDelete(designId, slot, url)` → adds entry, schedules timeout (5s)
  - Action `undoDelete(designId, slot)` → clears entry, clears timeout
  - On timeout fire: calls `deleteDesignVersion` mutation, clears entry
- [ ] Create `frontend-ui/src/views/designs/board/partials/ArtboardVersionPicker.tsx`:
  - Props: `{ designId, design, selectedArtboardId }`
  - Renders horizontally below artboard at +8px offset
  - Iterates slots in order [original, processed, bg_removed, upscaled]; renders chip only if slot URL exists and not in `pendingDeletions`
  - Active chip: filled variant (color via `theme.vars.palette.primary.main`); inactive: outlined (color via `theme.vars.palette.action.selected`)
  - Click chip → calls `setUserPickedVersion(designId, slot)`; `useArtboardVersionSync` picks it up
  - Hover chip → reveals trash icon → click triggers `requestDelete`
  - On `requestDelete`: enqueue notistack snackbar with `'design.versions.deleted'` + Undo action; on Undo click → `undoDelete`
- [ ] Mount `ArtboardVersionPicker` in `ArtboardCanvas.tsx` — only when single artboard selected AND has a `designId`
- [ ] Add i18n keys to all 5 locales (`frontend-ui/public/locales/{en,de,fr,es,it}/translation.json`):
  - `design.versions.original`, `design.versions.edited`, `design.versions.bgRemoved`, `design.versions.upscaled`
  - `design.versions.deleted` (snackbar)
  - `design.versions.undo` (action label)
  - `design.versions.deleteFailed` (error)
  - EN + DE properly translated; FR/ES/IT use EN fallback or copy EN (per existing project pattern)
- [ ] Handle EC-2-2: if user deletes currently-displayed slot → `useArtboardVersionSync` auto-switches via priority order
- [ ] Handle EC-2-5: clear `userPickedVersions` on workspace switch (hook into existing workspace-switch signal)
- [ ] Vitest unit tests:
  - Picker renders correct number of chips based on Design slots
  - Click on inactive chip switches active state
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

## Phase 7 — Lint, Tests, Diff Review, Commit Bundle

- [ ] `npm run lint` in `frontend-ui/` — zero errors
- [ ] `npm run test:ci` in `frontend-ui/` — zero failures
- [ ] Verify no orphan imports, unused props, or commented-out code
- [ ] Final manual smoke: full editor → canvas → upscale → version pick → delete-undo cycle
- [ ] Push branch + open PR (after user approval per CLAUDE.md no-auto-push rule)

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
