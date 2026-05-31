# FIX: Canvas + Editor Bugs + Image-Gen Auto-Mode

## Status: Planned

## Overview

Four-item bundle addressing post-merge regressions on the AI Canvas / Image Editor flow PLUS a new selection-driven image-gen flow. All four reported by Mario 2026-05-31 after the dashboard FIX (PR #103) merged. Playwright recon completed before spec — root causes confirmed for Items 1 + 3.

| # | Item | Skill | Phase |
|---|---|---|---|
| 1 | Canvas chip-switch fix (Original / Edit / Upscaled) | Frontend | A |
| 2 | Editor-upscale persistence + global progress reuse | Frontend (mostly) | B |
| 3 | Upscaled image not displayed + compare disabled (= Item 1 root cause) | Frontend | A (bundled) |
| 4 | AI Image-Gen mode auto-switch driven by Canvas selection | Frontend | C |

Items 1 + 3 ship as ONE commit (single root cause). Item 2 depends on Item 1 (Canvas must render the Upscaled file once it lands). Item 4 is independent.

## User stories

- As a POD seller, I want clicking the version chips on a Canvas artboard (Original / Edit / Upscaled) to actually swap the rendered image, so I can compare versions visually.
- As a POD seller, I want the Upscaled image to be displayed AND the compare-mode to be selectable once an upscale has finished, so I know the upscale succeeded.
- As a POD seller, I want my Editor-side upscale to keep running when I navigate to a different view, AND I want to know via a global progress indicator that it's still running, AND I want a clear notification + jump-back affordance when it finishes.
- As a POD seller, I want my AI Image-Gen panel to react to my Canvas selection automatically — if I select one or more artboards, the panel switches to Image-to-Image (Edit) mode with my selected images as references; if I deselect everything, it reverts to Text-to-Image.
- As a POD seller, when I manually flip the Image-Gen mode back to Text-to-Image while artboards are still selected, I want the Canvas selection to clear so the panel state stays coherent with what I see.

## Acceptance Criteria

### Item 1 — Canvas version-chip switch (with Item 3)

- [x] AC-1-1: Clicking a chip in `ArtboardVersionPicker` (Original / Edit / Upscaled / BG-Removed when present) updates the rendered Konva image to the corresponding slot URL within one render frame.
- [x] AC-1-2: The chip's `aria-pressed` state correctly tracks the active slot (auto-priority OR user-picked).
- [x] AC-1-3: Clicking the chip whose URL is `image_file` (the original) while user-picked = `upscaled` reverts the render to the original file.
- [x] AC-1-4: Switching mode in compare-view: when the active slot has a non-empty URL and the upscaled file is present, the compare-mode toggle is enabled. Disabled otherwise.
- [x] AC-1-5: Fix preserves the `useArtboardVersionSync` API surface — `ab.imageUrl` continues to be the source-of-truth for export / RTK invalidation / `ArtboardListSection`. The fix patches the per-layer `props.src` IN ADDITION (Option 1 from architecture brief).
- [x] AC-1-6: Unit test covers: chip click → after one `act()` flush, `ab.layers[image].props.src` matches the resolved slot URL.
- [x] AC-1-7: Manual / no-chip-click case unchanged: artboards without any user pick still auto-resolve to highest-priority slot (`upscaled > bg_removed > processed > original`).

### Item 3 — Upscaled image visible after upscale (covered by Item 1 fix)

- [x] AC-3-1: After an upscale completes on a Canvas artboard, the artboard's image element renders the upscaled bytes (not the original).
- [x] AC-3-2: The Upscaled chip becomes the active selection automatically when the upscale completes (auto-priority kicks in as soon as `design.upscaled_file` is non-null).
- [x] AC-3-3: Compare-mode toggle becomes enabled (verified visually OR via the existing compare-mode unit test).
- [x] AC-3-4: Verified via the same unit test added in AC-1-6 — no separate test file required.

### Item 2 — Editor-upscale persistence + global progress reuse

- [ ] AC-2-1: `UpscaleStatusPill` is PROMOTED from `views/designs/board/partials/` to `frontend-ui/src/components/UpscaleStatusPill/` (per memory `feedback_component_reuse_first`) so both Canvas and Editor paths import the same global component. Topbar import path updated.
- [ ] AC-2-2: The pill is extended to subscribe to BOTH `upscaleSlice.activeBatchId` (current batch path) AND `upscaleSlice.processingDesignIds` (single-design path). The aggregated label reads `Upscaling {completed}/{total}` summed across both.
- [ ] AC-2-3: User starts an upscale in the Image Editor → navigates to Dashboard / Niches / Settings → Pill stays visible in the Topbar throughout. Polling continues per existing `useUpscaleSingle` "no cleanup on unmount" rule.
- [ ] AC-2-4: When a single-design upscale completes (background or foreground), a snackbar fires: "Upscale fertig" / "Upscale done" with an action "Zum Canvas" / "Open in Canvas" that navigates to `/designs/<projectId>` and focuses the artboard.
- [ ] AC-2-5: After Item 1 fix lands, returning to the Canvas after a background-completed upscale shows the upscaled image with the Upscaled chip active.
- [ ] AC-2-6: Pill is hidden again 2s after the last in-flight job terminates (matches existing `TERMINAL_FADE_MS` pattern).
- [ ] AC-2-7: Click on the pill opens a Drawer/Popover that lists each in-flight upscale with source (Editor / Batch) + designId so the user can identify what's running.
- [ ] AC-2-8: Unit test covers: pill renders for single-design state; pill renders for combined batch+single state with summed counts; snackbar fires once on completion; snackbar action navigates to `/designs/<projectId>`.
- [ ] AC-2-9: i18n keys (see "i18n keys" section at the bottom of this spec).

### Item 4 — Image-Gen auto-mode flow

- [ ] AC-4-1: When `useArtboards.selectedIds` transitions from empty → non-empty AND the selection contains 1+ image artboards (`ab.designId` non-null AND `ab.imageUrl` non-null), the AI Image-Gen panel automatically switches mode from `text_to_image` → `image_to_image_edit`.
- [ ] AC-4-2: Up to 2 selected image artboards are passed as references (backend hard limit: `source_image_url` + `source_image_url_2`). When the user selects >2 images, the first 2 in selection order are used AND a snackbar warns: "Es werden nur die ersten 2 Bilder als Referenz verwendet" / "Only the first 2 images are used as references". Snackbar shown ONCE per session (useRef + localStorage gate, same pattern as the chat cost-warning from PR #103). Implementation adds a NEW helper `handleUseSelectionAsReferences(imageUrls: string[])` to `useWorkspaceGeneration` that wraps the existing `setSourceImageUrl` / `setSourceImageUrl2` setters — preserves the existing `handleUseAsReference(imageUrl: string)` signature so all current callers (right-panel "Use as reference" button etc.) keep working unchanged.
- [ ] AC-4-3: When `selectedIds` empties AND the mode was set BY THIS AUTO-FLOW (not manually), the panel auto-reverts to `text_to_image` and the reference slots clear. Requires tracking "auto" vs "manual" mode source — new state field `generationModeSource: 'auto' | 'manual'`.
- [ ] AC-4-4: When the user manually selects `text_to_image` in the mode dropdown WHILE `selectedIds` is non-empty, the Canvas selection is cleared (`useArtboards.deselectAll()` dispatched).
- [ ] AC-4-5: Mode source resets to `'manual'` whenever the user touches the mode dropdown — auto-revert no longer fires until next selection-change cycle.
- [ ] AC-4-6: Auto-trigger reuses existing `useWorkspaceGeneration.handleUseAsReference` plumbing (verified in Playwright recon — it already sets `sourceImageUrl` + flips mode). Wiring layer is a NEW hook `useSelectionDrivenImageGen` that subscribes to `selectedIds` + `boardData.artboards` and calls into the generation hook.
- [ ] AC-4-7: Mid-prompt selection change: reference slot updates SILENTLY (per user decision — no confirm dialog). Prompt textarea content is preserved.
- [ ] AC-4-8: Race with ongoing upscale (Bug 2): selection-driven reference takes `ab.imageUrl` at the time of selection (= current rendered version). After Item 1 fix, that's the active version including just-completed upscales.
- [ ] AC-4-9: No user-facing settings toggle for opt-out (per user decision — "Nein, immer aktiv"). Behavior is hardcoded ON.
- [ ] AC-4-10: Unit tests cover: empty → selection (1 + many images), selection → empty, manual mode-switch clears selection, manual mode-switch sets `'manual'` source, auto-revert only fires when source is `'auto'`, multi-image cap-to-2 warning fires once per session.
- [ ] AC-4-11: When the mode is set BY THE AUTO-FLOW (`generationModeSource === 'auto'`), a small "Auto" Badge / Chip renders next to the mode dropdown with a Tooltip explaining "Modus aus Canvas-Selektion abgeleitet" / "Mode derived from Canvas selection". Badge disappears immediately when the user touches the mode dropdown OR Canvas selection clears.

## Edge Cases

### Item 1 + 3

- [x] EC-1-1: Design has ONLY `image_file` (no upscaled/bg_removed/processed) → only one chip shows; clicking it is a no-op (already covered by `handleChipClick` early return when current = active).
- [x] EC-1-2: User deletes the currently-displayed slot via the trash icon → `useArtboardVersionSync` auto-falls-back to next-best slot AND the layer `props.src` follows (single fix covers both layers).
- [x] EC-1-3: Existing layer-reorder / layer-edit flows continue to work — they read `props.src` directly and we only PATCH it on slot-switch (Option 1 surgical), never strip the layer.
- [x] EC-1-4: An optimistic URL is set on the artboard (e.g. mid-pipeline upscale-overwrite) → optimistic override beats slot resolution (existing behavior preserved; layer src follows the optimistic URL too).

### Item 2

- [ ] EC-2-1: User starts 3 single-design upscales in quick succession (different designs) → pill shows total "Upscaling 0/3" and increments as each completes. Completion snackbar fires per-job OR once at the end — architecture decides.
- [ ] EC-2-2: User has BOTH an active batch (from Canvas) AND a single-design Editor upscale → ONE pill with the summed label "Upscaling {completed}/{total}". Click opens the drawer/popover (AC-2-7) that lists each job with source.
- [ ] EC-2-3: All in-flight upscales fail → pill shows "Upscaling 0/N" briefly then snackbar variant=error fires; pill fades.
- [ ] EC-2-4: User closes the browser mid-upscale → backend job continues (existing django-rq behavior); on next session start, the pill rehydrates from `upscaleSlice` persisted state (verify whether the slice IS persisted today; if not, mark out-of-scope follow-up).
- [ ] EC-2-5: User clicks the "Zum Canvas" snackbar action but the design's project was deleted → standard 404 / redirect-to-list (no custom handling).

### Item 4

- [ ] EC-4-1: Selection contains a mix of image artboards and non-image artboards (text, shape, …) → filter to image-bearing artboards only when building the reference list. If filter leaves 0, no mode switch fires.
- [ ] EC-4-2: User selects > 2 artboards → first 2 in selection order used; warning snackbar fires once per session per AC-4-2.
- [ ] EC-4-3: User is mid-generation (Generate clicked) and selection changes → don't update reference for the in-flight request; queue the update for the NEXT request.
- [ ] EC-4-4: User is in `remix` mode (2-slot) and selection changes → respect existing `remix` 2-slot handling (`handleUseAsReference` already does this). The new selection-driven flow short-circuits when mode is `remix`.
- [ ] EC-4-5: Selection includes an artboard whose linked design was deleted server-side → skip that artboard, use the rest.

## Dependencies

- Requires: FIX-canvas-editor-cleanup (`ArtboardVersionPicker`, `useArtboardVersionSync`, `usePendingDeletions` — all shipped)
- Requires: FIX-dashboard-bug-report-and-polish (`UpscaleStatusPill` reuse pattern + Topbar slot already in place — shipped via PR #103)
- Requires: `useWorkspaceGeneration` + `handleUseAsReference` (PROJ-9 — shipped)
- Requires: `useUpscaleSingle` + `upscaleSlice.processingDesignIds` (PROJ-9 phase 9+10 — shipped)

## Cross-cutting decisions (locked via /requirements multi-choice)

- Bug 1 fix variant: Option 1 — sync hook also patches layer `props.src` (surgical, smallest blast radius)
- Bug 2 progress surface: PROMOTE + EXTEND existing `UpscaleStatusPill` (move to `components/UpscaleStatusPill/`, subscribe to both batch + single-design state, aggregated single label)
- Bug 2 concurrent pill: ONE pill with summed `{completed}/{total}` label, click-to-open drawer with per-job breakdown
- Bug 4 multi-image: cap at 2 (backend `source_image_url` + `source_image_url_2` hard limit) + one-per-session UI warning when user selects more
- Bug 4 mid-prompt selection change: silent replacement (no confirm)
- Bug 4 upscale-race: take current `imageUrl` at selection time
- Bug 4 opt-out: no setting, always active
- Bug 4 visual feedback: small "Auto" Badge next to mode dropdown when `generationModeSource === 'auto'`; disappears on manual mode-switch OR selection clear
- API safety: keep existing `handleUseAsReference(imageUrl: string)` signature; add NEW wrapper `handleUseSelectionAsReferences(imageUrls: string[])` — zero breaking changes for current callers

## Out of scope

- Multi-image-edit provider support beyond what Nano Banana / OpenRouter already accepts (use whatever the existing prompt-build path sends; no provider integration changes in this FIX)
- Editor-side compare mode UI/UX changes — Item 1 just makes it _selectable_ when upscaled exists
- Persisting `upscaleSlice` across browser sessions (EC-2-4 — possible follow-up)
- A "running upscales" full-page review (the snackbar + pill are sufficient for MVP)
- Auto-mode opt-out setting (locked decision; future user complaint can re-open)

## i18n keys

All new strings under existing namespaces in `public/locales/{de,en}/translation.json`. Match the ASCII-fallback convention used in `dashboard.*` etc.

### `upscale.*` (Item 2)
- `pill.singleLabel`: "Upscaling {{completed}}/{{total}}" / "Upscaling {{completed}}/{{total}}" (same wording — singular vs plural handled by template)
- `pill.drawerOpenAria`: "Laufende Upscales anzeigen" / "Show running upscales"
- `pill.drawerJobLabel`: "Design {{designId}} · {{source}}" / same (source = "Editor" | "Batch")
- `snackbar.singleDone`: "Upscale fertig" / "Upscale done"
- `snackbar.singleDoneAction`: "Zum Canvas" / "Open in Canvas"

### `design.imageGen.*` (Item 4)
- `mode.auto.badge`: "Auto" / "Auto"
- `mode.auto.tooltip`: "Modus aus Canvas-Selektion abgeleitet" / "Mode derived from Canvas selection"
- `references.capWarning`: "Es werden nur die ersten 2 Bilder als Referenz verwendet" / "Only the first 2 images are used as references"

### `design.versions.*` (Item 1)
No new keys — existing labels (Original / Edited / Upscaled / BG-Removed) cover the fix.

## Test plan summary

| Item | Test layer | Coverage |
|---|---|---|
| 1 + 3 | Unit (Vitest) | Extend existing `useArtboardVersionSync.test.ts`: chip click → layer `props.src` patched within one `act()` flush |
| 1 + 3 | Unit | New `ArtboardVersionPicker` interaction test: chip click flips `aria-pressed` AND triggers the sync that updates the layer src |
| 2 | Unit | New tests on the promoted `UpscaleStatusPill`: renders for batch-only, single-only, combined; aggregated label; click opens drawer |
| 2 | Unit | New snackbar test: single-design completion fires snackbar once with correct action navigation |
| 4 | Unit | New `useSelectionDrivenImageGen.test.ts`: empty→selection (1 + 2 + 5 images), selection→empty, manual T2I clears selection, manual switch sets source='manual', auto-revert only when source='auto', 5-image cap-to-2 warning |
| 4 | Integration | `DesignWorkspaceView` integration test stub: full selection-driven flow end-to-end with mocked Redux store |
| ALL | E2E | OUT OF SCOPE for this FIX (no Playwright tests added — would require a fixture-design with multiple versions; deferred follow-up if Mario wants the safety net) |

## Notes

- Bug 1 + 3 root cause confirmed via Playwright on 2026-05-31:
  - `useArtboardVersionSync` updates `ab.imageUrl` correctly on chip click.
  - But Konva `ArtboardElement` (`board/partials/ArtboardElement.tsx:68`) reads `element.props.src` from the LAYER, not from `ab.imageUrl`.
  - Layer's `props.src` is frozen at hydration (`board/utils/artboardHydration.ts:139`) to `d.image_file`. Nothing updates it when the chip switches.
  - Fix: extend `useArtboardVersionSync` to ALSO patch `layers[image].props.src` whenever it writes `imageUrl`.
- Bug 2 partial reality: `useUpscaleSingle` has explicit Phase 10 fix ("no cleanup-on-unmount") so polling DOES survive navigation. The actual missing piece is user-visible status outside the Editor tab.
- Bug 4: `handleUseAsReference(imageUrl)` already auto-flips text_to_image → image_to_image_edit when a reference arrives. Currently manual-trigger only via the right-panel "Use as reference" button — needs a selection-driven trigger added.

---

# Tech Design (Solution Architect)

**Scope: 100% frontend.** No Django changes, no migrations, no new endpoints. All four items live in `frontend-ui/`. The backend already exposes everything needed (`design.upscaled_file`, the 2 reference slots, the upscale polling endpoints).

## How the pieces fit (plain language)

There are two parallel "what image am I looking at" systems on the Canvas that drifted apart:

1. **The artboard record** (`ab.imageUrl`) — used for export, the right-panel thumbnail list, and RTK cache invalidation.
2. **The Konva render layer** (`layers[image].props.src`) — what's actually painted on screen.

When the user clicks a version chip, only system #1 updates. System #2 was frozen at page-load. **The entire Item 1 + 3 fix is teaching system #1's updater to also nudge system #2.** That's the smallest possible change and it fixes both bugs at once, because the Upscaled chip was "working" all along — its picture just never reached the screen.

Item 2 is about *visibility*: the upscale already keeps running when you leave the editor, but nothing tells you so. We reuse the pill that already sits in the topbar (today it only knows about Canvas batch-upscales) and teach it to also count single-image editor upscales, then fire a "done — open in canvas" toast when one finishes.

Item 4 is a *new reflex*: when you pick artboards on the canvas, the image-gen panel should flip itself into edit-mode and grab those pictures as references. The panel already knows how to do this when you press a button — we just add an automatic trigger tied to your selection, plus a way to tell "the panel switched itself" from "the user switched it" so we know when to switch back.

## Component / hook structure (visual tree)

```
DesignWorkspaceView
├── useArtboards ........................ owns selectedIds (Set) + deselectAll  [existing]
├── useArtboardVersionSync .............. PATCH: also write layers[image].props.src   ← Item 1+3
├── useWorkspaceGeneration .............. ADD generationModeSource + handleUseSelectionAsReferences  ← Item 4
├── useSelectionDrivenImageGen (NEW) .... watches selectedIds → drives the gen panel  ← Item 4
└── RightPanel → GenerationZone
    └── ModeDropdown
        └── "Auto" Badge (NEW) .......... shows when generationModeSource === 'auto'  ← Item 4

Topbar
└── UpscaleStatusPill ................... PROMOTE to components/ + subscribe to single-design state  ← Item 2
    └── UpscaleJobsDrawer (NEW) ......... per-job breakdown on click  ← Item 2

useUpscaleSingle ........................ ADD completion snackbar w/ "Open in Canvas" action  ← Item 2
```

## What changes where (file-level)

```
frontend-ui/src/
├── views/designs/board/hooks/
│   └── useArtboardVersionSync.ts ............... EDIT  (Item 1+3 — patch layer src)
├── views/designs/board/hooks/__tests__/
│   └── useArtboardVersionSync.test.ts .......... EDIT  (Item 1+3 — assert layer src patched)
├── views/designs/workspace/hooks/
│   ├── useWorkspaceGeneration.ts ............... EDIT  (Item 4 — mode source + multi-ref helper)
│   └── useSelectionDrivenImageGen.ts ........... NEW   (Item 4 — selection→panel reflex)
├── views/designs/workspace/hooks/__tests__/
│   └── useSelectionDrivenImageGen.test.ts ...... NEW   (Item 4)
├── views/designs/board/partials/
│   └── GenerationZone.tsx ...................... EDIT  (Item 4 — Auto badge near mode dropdown)
├── views/designs/editor/hooks/
│   └── useUpscaleSingle.ts ..................... EDIT  (Item 2 — completion snackbar + nav action)
├── components/UpscaleStatusPill/ ............... NEW DIR (Item 2 — promoted from board/partials)
│   ├── index.tsx .............................. MOVED + EDIT (subscribe both batch+single)
│   ├── partials/UpscaleJobsDrawer.tsx ......... NEW   (Item 2 — per-job breakdown)
│   └── __tests__/UpscaleStatusPill.test.tsx ... NEW
├── components/topbar/Topbar.tsx ............... EDIT  (Item 2 — update import path)
├── store/upscaleSlice.ts ...................... EDIT? (Item 2 — only if a derived selector is needed)
└── public/locales/{de,en}/translation.json .... EDIT  (Items 2+4 — new keys)
```

The old `views/designs/board/partials/UpscaleStatusPill.tsx` is removed after the move; any other importers are repointed.

## State model (plain language)

| State | Where it lives | New? | Purpose |
|---|---|---|---|
| `selectedIds: Set<string>` | `useArtboards` | existing | Which artboards are selected — Item 4 watches this |
| `generationMode` | `useWorkspaceGeneration` | existing | text_to_image / image_to_image_edit / remix |
| `generationModeSource: 'auto' \| 'manual'` | `useWorkspaceGeneration` | **NEW** | Did the panel switch itself, or did the user? Drives auto-revert + Auto badge |
| `sourceImageUrl` / `sourceImageUrl2` | `useWorkspaceGeneration` | existing | The (max 2) reference image slots |
| `processingDesignIds: string[]` | `upscaleSlice` | existing | Single-design upscales in flight — Item 2 pill reads this |
| `activeBatchId` | `upscaleSlice` | existing | Canvas batch upscale — Item 2 pill already reads this |
| cap-warning-seen flag | localStorage | **NEW** | Item 4 — show the ">2 images" warning once per browser |

## Tech decisions

| Decision | Why |
|---|---|
| Fix Item 1 in `useArtboardVersionSync` (not `ArtboardElement`) | The sync hook is the single writer of "current version". Patching the layer there keeps one source of truth and avoids touching the render component that other layer flows (reorder, edit) depend on. Smallest blast radius. |
| Bundle Item 1 + 3 into one commit | Same root cause — the Upscaled image was never reaching the screen for the exact same reason as the Original/Edit chips. One fix, one test, verified together. |
| Promote `UpscaleStatusPill` to `components/` | It must serve both Canvas and Editor. Per project rule "promote feature-local code to global when reusable". |
| One aggregated pill, not two | Less topbar clutter; the click-drawer gives the detail when the user wants it. Matches the locked decision. |
| New `useSelectionDrivenImageGen` hook rather than inline effect | Keeps the reflex testable in isolation and keeps `DesignWorkspaceView` thin. |
| Keep `handleUseAsReference(string)`, add `handleUseSelectionAsReferences(string[])` | Zero breaking changes — the existing right-panel button keeps calling the single-arg version. |
| `generationModeSource` as a sibling state, not a derived value | We genuinely can't derive "who switched the mode" from the mode alone — it's a fact we must record at the moment of the switch. |
| 2-image cap, frontend-enforced | Backend has exactly 2 reference columns. No migration in this FIX. Warn the user once so the cap isn't silently confusing. |

## Phase ordering rationale

- **Phase A (Item 1+3)** goes FIRST because Item 2's promised payoff ("open in canvas → see your upscaled image") only works once the Canvas can actually render the upscaled file. Without A, B's snackbar leads to a still-broken canvas.
- **Phase B (Item 2)** second — depends on A for the end-to-end story; otherwise independent.
- **Phase C (Item 4)** is fully independent and could run in parallel, but is scheduled last because it's the largest and riskiest (new reflex + new state).

## Dependencies (packages)

NONE new. Everything uses existing project libraries: MUI v7 (Badge, Drawer, Tooltip, Chip), Redux Toolkit, react-konva, notistack, react-i18next, Vitest.

## Unresolved questions

None — all six clarifications were locked during /requirements. One forward-looking note: if Mario later wants true 3+ image references, that becomes a separate backend FIX (JSONField migration + serializer + task plumbing), explicitly out of scope here.
