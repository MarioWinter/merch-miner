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
- [ ] AC-1-1: i18n key `amazonResearch.detail.rescrapeStarted` (EN + DE) replaced with copy that reflects automatic refresh — no instruction to reload manually.
- [ ] AC-1-2: Snackbar fires exactly once on trigger success (current behaviour preserved).
- [ ] AC-1-3: Error key `amazonResearch.detail.rescrapeError` unchanged.

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
- [ ] AC-2-1: A new component `ArtboardVersionPicker` is added at `frontend-ui/src/views/designs/board/partials/ArtboardVersionPicker.tsx` (feature-local; promote later if reused).
- [ ] AC-2-2: The picker renders **only when an artboard is selected** (single-select). For multi-select or no selection, hidden.
- [ ] AC-2-3: Picker renders **up to 4 chips** under the selected artboard, one per available Design file slot:
  - Original (`image_file`)
  - Edited (`processed_file`)
  - BG-Removed (`bg_removed_file`)
  - Upscaled (`upscaled_file`)
- [ ] AC-2-4: Chips are only rendered for slots where the Design has a non-empty file URL. Empty slots hidden (no greyed-out placeholders).
- [ ] AC-2-5: The currently-displayed version is highlighted (filled chip variant). Click on a different chip switches the artboard `imageUrl` to that version (frontend-only state update, no backend call).
- [ ] AC-2-6: Each chip has a small trash icon on hover. Click → calls existing `deleteDesignVersion` mutation with `{ designId, slot }`, then enqueues a notistack snackbar `"Version deleted"` with **Undo** action. Undo within 5s restores the deleted file via re-uploading the cached URL to the same slot (frontend keeps the file URL in component state until snackbar dismisses).
- [ ] AC-2-7: Chip labels via `useTranslation()` (keys: `design.versions.original`, `design.versions.edited`, `design.versions.bgRemoved`, `design.versions.upscaled`).
- [ ] AC-2-8: Re-trigger upscale when `upscaled_file` already exists → show MUI `Dialog` confirm "Overwrite existing upscaled version?" with Cancel/Overwrite buttons. On Overwrite, proceed with existing `useUpscaleSingle` flow.
- [ ] AC-2-9: Chips use theme tokens — no hardcoded hex. Active chip uses `theme.vars.palette.primary.main`, inactive uses `theme.vars.palette.action.selected`.
- [ ] AC-2-10: Picker layout: horizontal row, gap `theme.spacing(0.5)`, positioned absolutely below artboard bounding box at `+8px` offset.

### Edge Cases
- [ ] EC-2-1: Design has only `image_file` (no edits yet) → only 1 chip "Original" shown.
- [ ] EC-2-2: User deletes the currently-displayed version → auto-switch to next available slot in priority order: `upscaled → bg_removed → processed → image_file`. If all slots empty → artboard removed from canvas (existing behaviour for designId-less artboards).
- [ ] EC-2-3: Undo after delete clicked → restore the deleted slot file URL via PATCH to Design endpoint (new field in existing serializer; backend touch). If undo timeout exceeded → permanent delete.
- [ ] EC-2-4: Multiple artboards reference the same `designId` (rare but possible) → all of them update when version changes. Use designId-keyed selector, not artboard-keyed.
- [ ] EC-2-5: Workspace switch while picker is open → picker closes (artboard selection cleared on workspace change).
- [ ] EC-2-6: Confirm dialog for re-upscale dismissed via Escape or backdrop → treated as Cancel (no re-trigger).

### Out of Scope
- Branching / multiple variations per slot (e.g. multiple Upscaled variants). MVP keeps one file per slot.
- Linear chronological history (timestamped versions log). MVP uses the 4 categorized slots only.
- Cross-design version transfer (copy Edited from Design A to Design B).

---

## Item 3 — Remove Redundant "Add to Editor" Action

### User Stories
- As a POD seller right-clicking an artboard, I want a single clear action to open it in the editor, so I'm not confused by two similar options.

### Acceptance Criteria
- [ ] AC-3-1: "Add to Editor" menu item removed from `ArtboardContextMenu.tsx` (lines 163–175).
- [ ] AC-3-2: "Open in Editor" menu item retained and unchanged in behaviour.
- [ ] AC-3-3: Handler `handleAddToEditor` and related callback chain removed from `DesignWorkspaceView.tsx` + `useWorkspaceActions.ts` if no other caller remains.
- [ ] AC-3-4: i18n key `design.contextMenu.addToEditor` removed from EN + DE if no other reference.
- [ ] AC-3-5: No dead code (orphan imports, unused props) left after removal.

### Edge Cases
- [ ] EC-3-1: User has muscle-memory for "Add to Editor" → no migration needed; the remaining "Open in Editor" performs the equivalent flow.

---

## Item 4 — Upscale via Apply Pipeline

### User Stories
- As a POD seller adding "AI Upscale" to the pipeline and pressing Apply, I want it to actually execute, not be silently dropped.

### Acceptance Criteria
- [ ] AC-4-1: `DesignEditorView.tsx:128-144` no longer filters `ai_upscale` out of `clientTools` / `serverTools`.
- [ ] AC-4-2: When `handleApplyPipeline` encounters an `ai_upscale` step, it invokes the existing `useUpscaleSingle` flow (via the same Replicate trigger + polling mechanism used by the standalone Upscale tool).
- [ ] AC-4-3: Pipeline execution order: client tools first (local transforms), then server tools (bg_remove + ai_upscale), in the order the user arranged them in the pipeline panel.
- [ ] AC-4-4: If upscale is in pipeline AND user already has `upscaled_file` set → trigger the same overwrite-confirm dialog from AC-2-8 before applying pipeline.
- [ ] AC-4-5: Apply Pipeline button shows existing loading state until upscale poll completes; no separate spinner for upscale step.
- [ ] AC-4-6: Snackbar on completion uses existing `upscale.single.success` key.

### Edge Cases
- [ ] EC-4-1: Upscale step is followed by another server tool in the pipeline (e.g. `bg_remove`) → not supported in MVP; upscale must be the last step. If user arranges otherwise, show validation snackbar "AI Upscale must be the last pipeline step" and block Apply.
- [ ] EC-4-2: Upscale fails → existing error handling fires; pipeline stops; previously-applied client transforms remain on `processed_file`.
- [ ] EC-4-3: Pipeline contains only `ai_upscale` (no other tools) → executes upscale directly without going through "apply client transforms" intermediate.

### Out of Scope
- Re-orderable post-upscale steps (would require multi-stage Replicate chain).
- Bulk pipeline application across batch (already covered by separate bulk upscale; not in this fix).

---

## Item 5 — Canvas Auto-Refresh + Reads Latest Version

### User Stories
- As a POD seller, after an upscale or edit completes, I want the new image to appear on the canvas without re-opening the artboard.

### Acceptance Criteria
- [ ] AC-5-1: Artboard `imageUrl` selector resolves to: `upscaled_file ?? processed_file ?? bg_removed_file ?? image_file` (priority order), unless the user explicitly switched via the version picker (then use the picked slot).
- [ ] AC-5-2: After `useUpscaleSingle` polling detects completion, RTK Query tag for the affected Design is invalidated (`Design` tag with id = designId). This automatically updates any artboard referencing that designId.
- [ ] AC-5-3: After editor "Apply Pipeline" completes (client tools committed via existing save flow), the same Design tag invalidation runs.
- [ ] AC-5-4: Manual user-switched version (from picker) persists across the session; resets to "latest" priority order only when the user explicitly clicks "Latest" or when a new version is added.
- [ ] AC-5-5: Loading state during upscale: artboard shows existing image + a subtle overlay shimmer (no Skeleton replacement — that would hide context). Reuse existing `theme.vars.palette` tokens.

### Edge Cases
- [ ] EC-5-1: User has picker-switched to "Original" and an Upscale completes → artboard stays on Original (user's explicit choice wins). New "Upscaled" chip appears as inactive but available.
- [ ] EC-5-2: Editor open on Design X while canvas is in background, upscale completes → canvas updates on next render (RTK invalidation triggers re-render).
- [ ] EC-5-3: Concurrent upscales on different artboards → each polls independently, each invalidates its own Design tag.
- [ ] EC-5-4: Network error during invalidation refetch → existing RTK Query error handling; user sees stale image until manual refresh (acceptable for MVP).

---

## Item 6 — Remove Niche Pipeline "Open Design Canvas" Button

### User Stories
- As a POD seller browsing a niche pipeline drawer, I don't need a separate button to open the AI Canvas — the canvas is accessible via the main nav.

### Acceptance Criteria
- [ ] AC-6-1: `DesignsPipelineContent.tsx:210-228` Button (`OpenInNewOutlinedIcon` + i18n `niches.pipeline.designs.openCanvas`) removed.
- [ ] AC-6-2: i18n key `niches.pipeline.designs.openCanvas` removed from EN + DE if no other reference.
- [ ] AC-6-3: Surrounding layout (Stack/Box) collapses cleanly — no empty padding/spacer left.
- [ ] AC-6-4: Unused import `OpenInNewOutlinedIcon` removed from the file.

### Edge Cases
- [ ] EC-6-1: Other niche pipeline sections (Slogans, Research) keep their own navigation buttons untouched.

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

