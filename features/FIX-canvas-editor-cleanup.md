# FIX: Canvas + Editor Cleanup

## Status: In Progress
**Created:** 2026-05-27
**Last Updated:** 2026-05-27
**Type:** Mini-Fix Bundle (6 items, one PR, frontend-heavy + tiny backend touch)
**Branch:** `fix/canvas-editor-cleanup`

## Dependencies
- PROJ-7 (Amazon Product Research) — In Progress; re-scrape snackbar lives here
- PROJ-9 (Design Generation) — In Review; AI Canvas + Image Editor are the canvas
- PROJ-27 (AI Upscaler) — In Review; upscale flow integrates with editor pipeline
- PROJ-5 (Niche List) — Deployed; niche pipeline drawer hosts the icon we delete

## Scope Summary
Six independent fixes to existing half-built or buggy flows in the AI Canvas + Image Editor stack. No new models, one new lightweight UI component (`ArtboardVersionPicker`), no migrations. Backend touches are limited to validating that `deleteDesignVersion` mutation works against all 4 Design file slots.

| # | Area | Type |
|---|---|---|
| 1 | Re-scrape snackbar text | i18n fix |
| 2 | Editor → Canvas in-place update + version history UI | Frontend (new picker) + RTK invalidate |
| 3 | Redundant "Add to Editor" action | Frontend remove |
| 4 | Upscale tool in Apply Pipeline routes through `useUpscaleSingle` | Frontend pipeline wiring |
| 5 | Canvas reads latest version + refreshes after upscale/edit | Frontend selector + cache invalidation |
| 6 | Niche pipeline "Open Design Canvas" button removal | Frontend remove |

---

## Item 1 — Re-scrape Snackbar Text

### User Stories
- As a POD seller triggering a re-scrape, I want the snackbar to tell me the data refreshes automatically, so I don't manually reload the page.

### Acceptance Criteria
- [x] AC-1-1: i18n key `amazonResearch.detail.rescrapeStarted` (EN + DE) replaced with copy that reflects automatic refresh — no instruction to reload manually.
- [x] AC-1-2: Snackbar fires exactly once on trigger success (current behaviour preserved).
- [x] AC-1-3: Error key `amazonResearch.detail.rescrapeError` unchanged.

### Edge Cases
- [ ] EC-1-1: Polling timeout (no fresh data after 30s) → existing fallback behaviour unchanged; no additional snackbar.

---

## Item 2 — Editor → Canvas: In-place Update + Version Picker

### User Stories
- As a POD seller, I want my edited or upscaled image to appear directly on the same artboard on the canvas, so I don't have to manually re-add it.
- As a POD seller, I want to see which versions exist for an artboard (Original / Edited / BG-Removed / Upscaled) and switch between them, so I can compare results.
- As a POD seller, I want to delete a specific version if I don't like it, with an Undo option, so mistakes are recoverable.
- As a POD seller, I want to re-trigger a version (e.g. re-upscale) if needed, with a confirm dialog when overwriting an existing one.

### Acceptance Criteria
- [x] AC-2-1: `ArtboardVersionPicker` at `frontend-ui/src/views/designs/board/partials/ArtboardVersionPicker.tsx`.
- [x] AC-2-2: Picker renders only when `selectedIds.size === 1` AND selected artboard has a `designId` AND Design is in `designsById`. Multi-select or no selection → hidden (ArtboardCanvas IIFE guard).
- [x] AC-2-3: Up to 4 chips, slot order [original, processed, bg_removed, upscaled].
- [x] AC-2-4: Chips only rendered for slots with non-empty URL. Empty slots hidden.
- [x] AC-2-5: Active chip = currentPickedSlot OR auto-resolved priority slot. Click switches via `onPickVersion(designId, slot)` → `setUserPickedVersion` → `useArtboardVersionSync` writes new `imageUrl`. No backend call.
- [x] AC-2-6: Trash icon on chip hover (CSS-reveal). Click → `usePendingDeletions.requestDelete(designId, slot, projectId)` defers backend call 5s. Snackbar with Undo action restores via `undoDelete` (no backend call ever). Timeout fires `deleteDesignVersion` mutation.
- [x] AC-2-7: i18n keys `design.versions.{original,edited,bgRemoved,upscaled}` added EN + DE.
- [x] AC-2-8: Implemented in Phase 5 via `UpscaleOverwriteDialog` in DesignEditorView.
- [x] AC-2-9: Active chip uses MUI `color="primary"` (resolves to `theme.vars.palette.primary.*`), inactive uses outlined variant. No hex.
- [x] AC-2-10: Horizontal `Stack direction="row" spacing={0.5}`, `position: 'absolute'` at `+8px` below artboard bounding box; world→screen transform applied (zoom + pan).

### Edge Cases
- [x] EC-2-1: Design with only `image_file` → 1 chip (`AC-2-4` filter ensures this).
- [x] EC-2-2: Delete currently-displayed slot → `useArtboardVersionSync` auto-falls-back via priority resolution (because `pendingKeys` filter hides the chip; next render the resolved URL flips to next-best slot).
- [x] EC-2-3: Implemented via deferred-delete pattern instead of PATCH-restore endpoint. Undo within 5s = no backend call ever. Cleaner, zero backend touch.
- [x] EC-2-4: Multiple artboards with same `designId` → `userPickedVersions` is keyed by designId; `useArtboardVersionSync` iterates all artboards each render, so all update together.
- [x] EC-2-5: Workspace switch → `userPickedVersions` resets via existing render-time compare in DesignWorkspaceView (Phase 4 wiring).
- [x] EC-2-6: `UpscaleOverwriteDialog` `onClose={onCancel}` (MUI default for Escape + backdrop) — verified in dialog tests.

### Out of Scope
- Branching / multiple variations per slot (e.g. multiple Upscaled variants). MVP keeps one file per slot.
- Linear chronological history (timestamped versions log). MVP uses the 4 categorized slots only.
- Cross-design version transfer (copy Edited from Design A to Design B).

---

## Item 3 — Remove Redundant "Add to Editor" Action

### User Stories
- As a POD seller right-clicking an artboard, I want a single clear action to open it in the editor, so I'm not confused by two similar options.

### Acceptance Criteria
- [x] AC-3-1: "Add to Editor" menu item removed from `ArtboardContextMenu.tsx` (lines 163–175).
- [x] AC-3-2: "Open in Editor" menu item retained and unchanged in behaviour.
- [x] AC-3-3: Handler `handleAddToEditor` and related callback chain removed from `DesignWorkspaceView.tsx` + `useWorkspaceActions.ts` after all callers (context menu + RightPanel toolbar) are removed. — useWorkspaceActions.ts:117 (callback) + :172 (returned object key) removed; DesignWorkspaceView.tsx:246 passthrough removed.
- [x] AC-3-4: i18n key `design.contextMenu.addToEditor` was never present in any locale JSON (verified via `grep -rn "addToEditor" frontend-ui/public/locales/` — zero hits); existed only as inline `t()` fallback default, removed with the MenuItem block.
- [x] AC-3-5: Verified after full Phase 3 (incl. AC-3-6) — `npm run lint` 0 errors; `grep -rn "handleAddToEditor\|onAddToEditor\|design.panel.addToEditor" frontend-ui/src/` → zero hits. Orphan `AddPhotoAlternateOutlinedIcon` imports removed from `ArtboardContextMenu.tsx`, `PanelArtboardState.tsx`, `PanelMultiState.tsx`.
- [x] AC-3-6: RightPanel toolbar "Add to Editor" button removed from `PanelArtboardState.tsx` (single-select) + `PanelMultiState.tsx` (multi-select) + `RightPanel.tsx` prop chain — PanelArtboardState.tsx (Tooltip+ToolbarButton block, prop, destructured prop, orphan icon import, conditional wrapper term removed), PanelMultiState.tsx (Tooltip+ToolbarButton block, prop, destructured prop, `handleAddEditor` callback, orphan icon import removed), RightPanel.tsx (prop interface, destructured prop, 2 child passthroughs removed). i18n key `design.panel.addToEditor` was never present in any locale JSON (verified zero hits via grep across en/de/fr/es/it) — only inline `t()` fallback default, removed with the button blocks. Scope extended per user decision 2026-05-27.

### Edge Cases
- [ ] EC-3-1: User has muscle-memory for "Add to Editor" → no migration needed; the remaining "Open in Editor" performs the equivalent flow.

---

## Item 4 — Upscale via Apply Pipeline

### User Stories
- As a POD seller adding "AI Upscale" to the pipeline and pressing Apply, I want it to actually execute, not be silently dropped.

### Acceptance Criteria
- [x] AC-4-1: `DesignEditorView.tsx:188-199` filter for `ai_upscale` is **intentionally retained** — `ai_upscale` is now handled in a separate carve-out flow via `useUpscaleSingle.runUpscaleAsync` (Replicate path), NOT via `startProcessing` (which only knows `bg_remove`/`upscale` django-rq jobs). The step is computed as `upscaleStep` and executed last after client + server tools complete. — `DesignEditorView.tsx:174-186, 240-247`
- [x] AC-4-2: When `handleApplyPipeline` encounters an `ai_upscale` step, it invokes the existing `useUpscaleSingle` flow (via the same Replicate trigger + polling mechanism used by the standalone Upscale tool). — `DesignEditorView.tsx:129-137, 240-247`
- [x] AC-4-3: Pipeline execution order: client tools first (local transforms), then server tools (bg_remove), then `ai_upscale` last (validated by AC-4-1 ordering rule). — `DesignEditorView.tsx:202-247`
- [x] AC-4-4: If upscale is in pipeline AND user already has `upscaled_file` set → opens `UpscaleOverwriteDialog` before applying pipeline. — `DesignEditorView.tsx:250-255, 443-447`
- [x] AC-4-5: Apply Pipeline button shows existing loading state until upscale poll completes; `runUpscaleAsync` awaits poll terminal → button stays in `isProcessing` until then. — `DesignEditorView.tsx:243`
- [x] AC-4-6: Snackbar on completion uses existing `upscale.single.success` key — fires inside `useUpscaleSingle` poll-complete branch. — `useUpscaleSingle.ts:144-148`

### Edge Cases
- [x] EC-4-1: Upscale step is followed by another server tool → validation snackbar `design.pipeline.upscaleMustBeLast` and Apply is blocked. — `DesignEditorView.tsx:174-186`
- [x] EC-4-2: Upscale fails → `runUpscaleAsync` rejects; outer try/catch swallows (snackbar surfaced by hook); previously-applied client transforms remain on `processed_file`. — `DesignEditorView.tsx:241-247`
- [x] EC-4-3: Pipeline contains only `ai_upscale` → both `clientTools` and `serverTools` are empty; `executeApplyPipeline` skips both blocks and runs `runUpscaleAsync` directly. — `DesignEditorView.tsx:202-247`

### Out of Scope
- Re-orderable post-upscale steps (would require multi-stage Replicate chain).
- Bulk pipeline application across batch (already covered by separate bulk upscale; not in this fix).

---

## Item 5 — Canvas Auto-Refresh + Reads Latest Version

### User Stories
- As a POD seller, after an upscale or edit completes, I want the new image to appear on the canvas without re-opening the artboard.

### Acceptance Criteria
- [x] AC-5-1: Artboard `imageUrl` resolves via `useArtboardVersionSync` priority `upscaled > bg_removed > processed > image_file`, with user pick override.
- [x] AC-5-2: `useUpscaleSingle` poll-complete dispatches `designApi.util.invalidateTags([{ type: 'DesignProject', id: projectId }])` — confirmed in `useUpscaleSingle.ts:124-130`.
- [x] AC-5-3: `applyPipeline` mutation now invalidates `DesignProject` tag via `projectId` field on body (Phase 4 work). Note: in the current Phase 5 implementation `applyPipeline` itself has no in-view caller (`handleApplyPipeline` uses `processBatch` + `startProcessing` + `runUpscaleAsync`); cache refetch is driven by `useUpscaleSingle` invalidation (AC-5-2). Mutation is wired and ready for future callers. — `designSlice.ts:392-403`
- [x] AC-5-4: `userPickedVersions` consumed by Phase 6 picker. Picks persist via local React state; reset on workspace switch.
- [ ] AC-5-5: Loading shimmer during upscale. **Deferred to follow-up FIX** — would require lifting `pipelineUpscale.isProcessing` state across editor↔canvas boundary OR exposing a per-Design "is-upscaling" Set via Redux. Existing image swap on upscale completion already provides visible feedback to the user. AC-5-5 left intentionally unchecked; tracked as known follow-up.

### Edge Cases
- [x] EC-5-1: User picks "Original", upscale completes → artboard stays on Original because `userPickedVersions['d-1'] === 'original'` overrides priority. New Upscaled chip appears as available but inactive.
- [x] EC-5-2: Canvas-in-background + upscale completes → `designApi.util.invalidateTags` triggers refetch; React renders next frame, `useArtboardVersionSync` writes new URL.
- [x] EC-5-3: Concurrent upscales → each `useUpscaleSingle` instance has its own polling state + invalidation; tags are unique per projectId.
- [x] EC-5-4: Network error → existing RTK Query retry/error handling; stale image acceptable for MVP.

---

## Item 6 — Remove Niche Pipeline Icon from AI Canvas Header

### Direction Correction (2026-05-27)
The original spec wording was ambiguous ("Niche pipline icon AI Canvas delete"). The first interpretation (Phase 2, commit `c173254`) removed the "Open Design Canvas" button **inside the Niche Pipeline drawer**. After user manual smoke, the actual intent was the **inverse**: remove the `Inventory2OutlinedIcon` button **inside the AI Canvas header** that opens the Niche Pipeline drawer. Phase 2 has been reverted (button restored); the correct icon is now removed.

### User Stories
- As a POD seller working in the AI Canvas, I don't want the canvas header cluttered by a button that opens the Niche Pipeline drawer — Niche planning happens elsewhere; the canvas is for design work.

### Acceptance Criteria
- [x] AC-6-1: `Inventory2OutlinedIcon` IconButton (with Tooltip) in `DesignWorkspaceView.tsx` header removed.
- [x] AC-6-2: Handler `handleOpenNichePipeline` removed.
- [x] AC-6-3: Orphan imports removed: `Inventory2OutlinedIcon`, `openNicheEdit` from chatBarSlice, `useAppDispatch`, local `dispatch` declaration.
- [x] AC-6-4: i18n key `design.workspace.openNicheDrawer` removed from all 5 locale JSONs.
- [x] AC-6-5: Phase 2 reverted — "Open Design Canvas" ghost button restored in `DesignsPipelineContent.tsx` along with its i18n key (`niches.pipeline.designs.openCanvas` EN + DE).

### Edge Cases
- [x] EC-6-1: Niche-binding selector + niche-link chip in canvas header remain — they're useful workflow indicators, not navigation.

---

## Item 7 — Canvas↔Editor State Resilience (Phase 8-10)

### Direction (2026-05-28)
After Items 1-6 shipped, user-test surfaced two robustness gaps:
1. **Tab switch = state loss.** `{activeTab === 'canvas' ? <Canvas/> : <Editor/>}` unmount/remount drops the editor's `activePipeline` draft, `currentImageIndex`, `undoRedo` history, selected version picks. Same on page reload.
2. **Cross-window staleness.** `useEditorBatchState.hydratedRef.current` guard means a new design created on Canvas in a second browser window/tab doesn't appear in an already-open Editor.

### User Stories
- As a POD seller mid-edit, I want to switch from Editor to Canvas to check a thumbnail and back, without losing my pipeline draft / current image / version picks.
- As a POD seller who accidentally reloads, I want my pipeline draft + current image + picks restored exactly where I left off (within the same project).
- As a POD seller working on a design while my AI Canvas generates a new design in parallel, I want the new design to appear automatically in both views.
- As a POD seller watching an upscale run, I want the affected artboard on Canvas to show a subtle "processing" overlay so I know something is happening — not just a sudden image swap on completion.
- As a POD seller applying client edits in the Editor, I want the new image to appear on the Canvas artboard immediately (within ~16ms render), not after a server round-trip.
- As a POD seller in the Canvas tab while an upscale I triggered earlier completes, I want a snackbar to inform me (currently only Editor-tab shows it).

### Acceptance Criteria

**State Persistence (reload-safe):**
- [ ] AC-7-1: `activePipeline` (tool list + per-tool params) persists to `localStorage` under key `mm.editor.pipeline.<projectId>`. Restores on mount.
- [ ] AC-7-2: `userPickedVersions` Map persists to `localStorage` under `mm.canvas.pickedVersions.<projectId>`. Restores on mount.
- [ ] AC-7-3: `currentImageIndex` (editor batch) persists to `localStorage` under `mm.editor.currentIndex.<projectId>`. Restores on mount.
- [ ] AC-7-4: Persistence layer cleaned on workspace switch (avoid leaking picks between unrelated projects in same workspace) — `userPickedVersions` reset matches existing render-time-compare pattern.
- [ ] AC-7-5: Restored pipeline tools that no longer exist in `TOOL_CATALOG` (e.g. removed tool) are silently dropped during restore.
- [ ] AC-7-6: Restored `currentImageIndex` is clamped to `batchImages.length - 1` (out-of-range index after design deletion).

**Tab-switch resilience (no remount-cost):**
- [ ] AC-7-7: Pipeline draft survives Canvas↔Editor tab switches with zero flash.
- [ ] AC-7-8: `userPickedVersions` survive tab switches.
- [ ] AC-7-9: Undo/redo history (in-memory only) — acceptable to reset on reload but MUST survive tab switches. Hoist to workspace level OR use display-none pattern (`/architecture` decides).

**Cross-tab diff refresh (multi-window safety):**
- [ ] AC-7-10: `useEditorBatchState`'s `hydratedRef.current` guard replaced with diff-based merge. New designs in `boardData` are appended as new `BatchImage` entries without resetting existing batch state.
- [ ] AC-7-11: Deleted designs (no longer in `boardData`) are filtered out of batch. `currentImageIndex` clamped if it pointed to a deleted slot.
- [ ] AC-7-12: Updated designs (same `id`, changed file URLs) refresh their `previewUrl`/`processedUrl` in-place — no batch reorder.

**Optimistic updates:**
- [ ] AC-7-13: After Apply Pipeline client tools complete locally (before `saveProcessedImage` resolves), corresponding artboard's `imageUrl` updates to the local blob URL immediately. On backend failure, revert to last-known good URL.
- [ ] AC-7-14: Optimistic update writes to a separate "pending overlay" state, not directly to `artboard.imageUrl`, so the version-sync hook can still resolve auto-priority correctly once backend confirms.

**Shimmer overlay (deferred AC-5-5):**
- [ ] AC-7-15: A workspace-level `Set<designId>` tracks designs currently being upscaled (populated when `useUpscaleSingle.isProcessing` flips true, cleared on poll-complete or error). Passed to `ArtboardCanvas`.
- [ ] AC-7-16: Artboards whose `designId` is in the upscaling-set render a subtle pulse overlay (semi-transparent gradient sweeping across the image, ~1.5s loop) on top of the existing image — no Skeleton replacement.
- [ ] AC-7-17: Overlay uses `theme.vars.palette.primary.main` at ~12% opacity. No hardcoded hex.

**Cross-tab notifications:**
- [ ] AC-7-18: When upscale completes while user is on Canvas tab (i.e. not in the Editor where it was triggered), notistack snackbar fires with key `'upscale.single.successCrossTab'`. Same for Apply Pipeline completion.
- [ ] AC-7-19: When upscale FAILS while user is on the other tab, error snackbar fires with key `'upscale.single.errorCrossTab'`.

### Edge Cases
- [ ] EC-7-1: localStorage quota exceeded (e.g. 10MB limit hit by many projects) — graceful fallback to in-memory state + console warning. No crash.
- [ ] EC-7-2: User logs out / token expires → localStorage retained but user must re-authenticate on next mount. Acceptable.
- [ ] EC-7-3: Two browser tabs both editing same project simultaneously → last-write-wins for localStorage. Acceptable for MVP (not collaborative editing).
- [ ] EC-7-4: User opens project, edits pipeline, then opens same project in second tab → second tab sees the restored pipeline (localStorage shared across tabs of same origin).
- [ ] EC-7-5: Design deleted while user has it as currentImageIndex → `currentImageIndex` clamped to new range, batch shows next available; if batch empty, editor empty state.
- [ ] EC-7-6: Optimistic update applied, then user undoes the operation client-side → optimistic state must also undo (don't strand the local blob on the artboard).
- [ ] EC-7-7: Upscale times out (20min) → upscaling-set entry cleared, shimmer overlay removed, error snackbar shown.
- [ ] EC-7-8: User reloads mid-upscale → upscaling-set lost (only in-memory), polling resumed via existing `pendingRunId` artboard mechanism if applicable, OR overlay simply doesn't appear (acceptable degradation).

### Out of Scope (Item 7)
- Real-time collaborative editing (multi-user simultaneously on same project).
- Cross-device sync (always single-device per session).
- Server-side persistence of pipeline drafts (localStorage only — pipeline is a draft until applied).
- Undo/redo persistence across page reload (in-memory only).
- Zoom/pan state persistence (out of scope; UX impact minor).

---

## QA Notes
- Manual smoke per item; coverage tests for `ArtboardVersionPicker` (new component) only.
- Existing tests for `DesignEditorView`, `ArtboardContextMenu`, `DesignsPipelineContent` must still pass after edits.
- RTK Query invalidation verified by triggering upscale + observing artboard image swap without manual refresh.

## Implementation Order (informational — final tasks in `/architecture` output)
1. Item 1 — trivial i18n
2. Item 6 — trivial button removal
3. Item 3 — context menu cleanup
4. Item 5 — canvas reads latest + cache invalidation (foundation for Item 2)
5. Item 4 — upscale pipeline routing
6. Item 2 — version picker UI (last, most complex)

Each item is committed separately for reviewable diffs.

## Out of Scope (entire FIX)
- Real chronological version log per slot (>1 version per slot).
- Cross-workspace / cross-design version copying.
- New Design model fields or migrations.
- New backend endpoints — reuse existing `deleteDesignVersion` + Design GET/PATCH.
- BatchThumbnailStrip refactor (stays as-is, separate concern).

---

# Tech Design (Solution Architect)

## Overview
Six surgical changes touching ~10 frontend files + zero backend files. No migrations, no new endpoints. Existing infrastructure reused:
- Backend `Design` model already has 4 file slots (`image_file`, `processed_file`, `bg_removed_file`, `upscaled_file`).
- `DesignDeleteVersionView` endpoint + `deleteDesignVersion` RTK mutation already exist and are functional.
- `useUpscaleSingle` hook already triggers Replicate + polls — will be promisified for reuse in pipeline.

## Component Tree (Visual)

```
DesignWorkspaceView (existing)
+-- ArtboardCanvas (existing)
|   +-- Artboard (existing, render unchanged)
|   +-- ArtboardVersionPicker (NEW — only when single selection)
|       +-- VersionChip x 4 (Original / Edited / BG-Removed / Upscaled)
|           +-- Trash icon (deferred delete with Undo)
|
+-- DesignEditorView (existing)
|   +-- ToolPanel / PipelineBar (existing — ai_upscale no longer filtered)
|   +-- ApplyPipelineButton (existing — now async; awaits upscale)
|   +-- UpscaleOverwriteDialog (NEW — confirm when upscaled_file exists)
|
+-- ArtboardContextMenu (existing)
    +-- "Open in Editor" (kept)
    +-- "Add to Editor" (REMOVED)

NicheDetailDrawer (existing)
+-- DesignsPipelineContent
    +-- "Open Design Canvas" button (REMOVED)

ProductDetailPage (existing)
+-- Rescrape Snackbar (i18n text update only)
```

## State Architecture

### New State: User-Picked Version Map
A new piece of canvas state tracking explicit user picks per Design. Only populated when the user clicks a non-latest chip in the picker.

```
userPickedVersions: Map<designId, 'original' | 'processed' | 'bg_removed' | 'upscaled'>
```

**Where:** Local React `useState` in `DesignWorkspaceView.tsx` (canvas state is React useState-based via `useArtboards`, NOT Zustand). Pass setter to `ArtboardVersionPicker` + the sync hook. Session-only, not persisted.

### New State: Pending Deletions (Deferred Delete Pattern)
A short-lived map for the Undo window. Hides chips visually before the backend call fires.

```
pendingDeletions: { [`${designId}:${slot}`]: { url: string, timeoutHandle: number } }
```

**Where:** Component-local state in `ArtboardVersionPicker` (or a custom hook `usePendingDeletions`).

**Flow:**
1. User clicks trash on chip → entry added, chip hidden, snackbar with Undo shown (5s).
2. **Undo within 5s** → entry removed, timeout cleared, chip reappears. **No backend call.**
3. **Timeout reached** → `deleteDesignVersion` mutation fires, entry removed.

Result: deletion is **deferred, not optimistic**. No restore endpoint needed.

## Version Resolution Logic

When rendering an artboard with a linked `designId`, the displayed image URL is computed by a new selector:

| Condition | Result |
|---|---|
| User picked a slot for this designId | Picked slot's URL |
| Otherwise | Priority: `upscaled_file → bg_removed_file → processed_file → image_file` |

After RTK Query invalidates a `Design` (post upscale, post edit), the refetched Design flows through this selector and the artboard's `imageUrl` updates. A new hook `useArtboardVersionSync` watches `(designId, Design from cache, userPickedVersions)` and writes the resolved URL into `ArtboardData.imageUrl` via `useArtboards.updateArtboard(id, { imageUrl })`.

**Mounting:** The sync hook runs once at the canvas root (in `DesignWorkspaceView` or `ArtboardCanvas`), iterating artboards with `designId` and computing resolved URL. Use `useEffect` with stable dependencies; only call `updateArtboard` when the resolved URL actually differs from current `imageUrl` to avoid re-render loops.

## Upscale Pipeline Integration

### Promisify `useUpscaleSingle`
The hook currently exposes a fire-and-forget trigger. It will additionally expose a Promise-returning function (e.g. `runUpscaleAsync(design)`) that resolves with the updated Design when polling detects `upscaled_file` change, or rejects on error/timeout.

**No breaking change** — the existing standalone Upscale button continues using the same hook.

### Refactor `handleApplyPipeline`
- Remove the `ai_upscale` filter at `DesignEditorView.tsx:128-144`.
- Function becomes fully async.
- Order: client tools → server tools (bg_remove etc.) → ai_upscale (if present, always last).
- Validation: if `ai_upscale` is not the last step → snackbar error, abort.
- Pre-check: if `upscaled_file` already exists → open `UpscaleOverwriteDialog` first; only proceed on confirm.

### RTK Cache Invalidation
**Gap identified during audit:** `triggerSingle` mutation in `upscaleApi.ts:99` currently invalidates only `UpscaleQuota` — NOT `DesignProject`. The `useGetDesignsByIdsQuery` polling fetches updated Design directly, but the canvas reads designs via `DesignProject` query (different cache entry).

**Resolution:** In `useUpscaleSingle.ts`, when polling detects `upscaled_file` change (existing logic), explicitly `dispatch(designSlice.util.invalidateTags([{ type: 'DesignProject', id: projectId }]))`. This causes the canvas's `DesignProject` query to refetch, and `useArtboardVersionSync` picks up the new Design data and updates artboard `imageUrl`.

Editor "Apply Pipeline" path (existing `applyPipeline` server mutation) already invalidates the relevant tags — verify during Phase 4 implementation.

## Tech Decisions

| Decision | Why |
|---|---|
| **Deferred delete (no backend Undo endpoint)** | Existing `DesignDeleteVersionView` destroys files on disk. Adding restore would require soft-delete + cleanup job. Deferring delete by 5s in frontend is simpler, zero backend cost, identical UX. |
| **No new Artboard fields** | `ArtboardData.imageUrl` stays as single source of truth for the canvas renderer. Version resolution runs as a sync effect, not a derived render. Keeps Konva render path unchanged. |
| **User-picked versions in canvas store** | Session-only; no need to persist. Survives within session, resets per workspace switch (per EC-2-5). |
| **Promisify `useUpscaleSingle`, don't fork** | Existing standalone Upscale button must keep working. One hook, two ways to invoke it (fire-and-forget OR await). |
| **Validation: upscale must be last step** | Multi-stage Replicate chains are out of scope. Easier to validate + show clear error than implement a server-side chain. |
| **Chips below artboard, on selection only** | Matches existing pattern (selection-driven UI). Doesn't clutter canvas when nothing selected. |

## Files Modified

| File | Change |
|---|---|
| `frontend-ui/public/locales/en/translation.json` | Snackbar text fix; new picker labels; remove obsolete keys |
| `frontend-ui/public/locales/de/translation.json` | Same as above (DE) |
| `frontend-ui/src/views/amazon/research/detail/ProductDetailPage.tsx` | No change (i18n key text only) |
| `frontend-ui/src/views/niches/list/partials/DesignsPipelineContent.tsx` | Remove button + `OpenInNewOutlinedIcon` import (lines 210-228) |
| `frontend-ui/src/views/designs/board/partials/ArtboardContextMenu.tsx` | Remove "Add to Editor" menu item (lines 163-175) |
| `frontend-ui/src/views/designs/workspace/DesignWorkspaceView.tsx` | Remove unused `handleAddToEditor` wiring |
| `frontend-ui/src/views/designs/workspace/hooks/useWorkspaceActions.ts` | Remove unused `handleAddToEditor` |
| `frontend-ui/src/views/designs/board/partials/ArtboardCanvas.tsx` | Mount `ArtboardVersionPicker` on `selectedIds.size === 1` |
| `frontend-ui/src/views/designs/board/partials/ArtboardVersionPicker.tsx` | **NEW** — chips UI + deferred delete |
| `frontend-ui/src/views/designs/board/hooks/useArtboardVersionSync.ts` | **NEW** — sync `(designId, Design cache, userPickedVersions) → artboard.imageUrl` via `useArtboards.updateArtboard` |
| `frontend-ui/src/views/designs/board/hooks/usePendingDeletions.ts` | **NEW** — deferred delete state + Undo |
| `frontend-ui/src/views/designs/workspace/DesignWorkspaceView.tsx` | Add local state `userPickedVersions` (Map<designId, slot>); pass setter to picker + sync hook |
| `frontend-ui/src/views/designs/editor/hooks/useUpscaleSingle.ts` | Add Promise-returning helper `runUpscaleAsync(design)`; on poll-complete trigger explicit `DesignProject` tag invalidation (currently only `UpscaleQuota` is invalidated by `triggerSingle`) |
| `frontend-ui/src/views/designs/editor/DesignEditorView.tsx` | Remove `ai_upscale` filter (lines 128-144); make `handleApplyPipeline` async; integrate validation + overwrite dialog |
| `frontend-ui/src/views/designs/editor/partials/UpscaleOverwriteDialog.tsx` | **NEW** — MUI Dialog (or co-locate inline if small) |
| Test files for new hooks + picker | **NEW** — Vitest specs |

**No backend file changes.** **No migrations.**

## Dependencies (Packages)
None. All work uses existing dependencies (MUI v7, RTK Query, notistack, react-hook-form not needed).

## Risk Assessment

| Risk | Mitigation |
|---|---|
| `useArtboardVersionSync` causes re-render loop | Use stable selectors + dependency arrays; manual review during code review |
| Deferred delete: user closes browser within 5s | Acceptable — chip stays in backend, reappears on reload. Documented in EC. |
| Promisified upscale + existing fire-and-forget conflict | Both call paths use the same internal trigger → only the return value differs. No state divergence. |
| RTK invalidation triggers refetch on every artboard render | Verified existing pattern: `DesignProject` tag invalidates once per mutation, not per render |
| Removing "Add to Editor" breaks an integration test | Grep for `addToEditor` before deleting; remove orphan tests |

## Open Questions
None — all edge cases resolved in `/requirements`.

