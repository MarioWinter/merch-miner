# Tasks — FIX: Canvas + Editor Bugs + Image-Gen Auto-Mode

Branch: `fix/canvas-editor-bugs-and-image-gen` (off main, post-PR-#103)
Merge strategy: `--merge` (preserve commits for release-please) — multi-concern bundle.
Skill invocation: phase-by-phase `/frontend` with hard scope-lock + "do NOT commit"; orchestrator audits + commits per phase (memory `feedback_phase_by_phase_skill_invocation`).
Every implementation phase MUST read `.claude/rules/` + flip task/AC/EC checkboxes (memory `feedback_skills_must_follow_rules`).

> **Phase ordering rationale:** Phase A (chip-switch + upscaled display) ships first because Phase B's "open in canvas" snackbar only pays off once the canvas can render the upscaled file. Phase C (image-gen auto-mode) is independent but scheduled last as the largest/riskiest item.

---

## Phase A — Item 1 + 3: Canvas chip-switch + Upscaled display

Skill: `/frontend`, hard scope lock to `useArtboardVersionSync` + its test. Single commit covers both items (shared root cause).

- [ ] TA.1: Read `views/designs/board/hooks/useArtboardVersionSync.ts` + `board/partials/ArtboardElement.tsx` + `board/utils/artboardHydration.ts` to confirm the layer-src freeze (recon already documented in spec Notes).
- [ ] TA.2: Extend `useArtboardVersionSync`: whenever it writes a new `imageUrl` to an artboard, ALSO patch that artboard's primary image layer's `props.src` to the same URL. Applies to all three resolution paths (optimistic override, user-picked slot, auto-priority).
- [ ] TA.3: Guard: only patch the FIRST image-type layer (the auto-created design image), never text/shape/brush layers. If no image layer exists, no-op (don't create one — hydration owns creation).
- [ ] TA.4: Preserve `ab.imageUrl` as the public source-of-truth (export / ArtboardListSection / RTK invalidation unchanged) — AC-1-5.
- [ ] TA.5: Verify compare-mode toggle becomes enabled once `design.upscaled_file` resolves into the rendered layer (AC-1-4 / AC-3-3). If the toggle has its own gating logic, confirm it reads the same resolved state; adjust only if it reads a stale field.
- [ ] TA.6: Extend `views/designs/board/hooks/__tests__/useArtboardVersionSync.test.ts`:
  - chip-pick a slot → after one flush, the artboard's image-layer `props.src` equals the resolved slot URL (AC-1-6).
  - upscaled file appears → auto-priority makes layer src = upscaled url (AC-3-1 / AC-3-2).
  - delete currently-displayed slot → layer src follows the fallback slot (EC-1-2).
  - optimistic override → layer src follows the optimistic url (EC-1-4).
  - no image layer present → no-op, no crash.
- [ ] TA.7: `npm run lint && npx tsc -b && npm run test -- --run` (scope to designs board tests + full suite). Zero failures.
- [ ] TA.8: Flip AC-1-1..AC-1-7 + AC-3-1..AC-3-4 + EC-1-1..EC-1-4 to `[x]`.

---

## Phase B — Item 2: Editor-upscale persistence + global progress reuse

Skill: `/frontend`. Depends on Phase A (the snackbar's "open in canvas" must show the upscaled image).

### B1 — Promote the pill
- [ ] TB.1: Move `views/designs/board/partials/UpscaleStatusPill.tsx` → `components/UpscaleStatusPill/index.tsx`. Update the Topbar import (`components/topbar/Topbar.tsx`). Grep for any other importers and repoint them.
- [ ] TB.2: Confirm no behavior change after the move (batch path still works) — run existing tests if any, else smoke-verify in dev.

### B2 — Extend the pill to single-design upscales
- [ ] TB.3: Extend the pill to ALSO subscribe to `upscaleSlice.processingDesignIds`. Compute an aggregated `{completed}/{total}` across batch jobs + single-design jobs (AC-2-2). If a derived selector keeps it clean, add it to `upscaleSlice` (only if needed — AC-2-x).
- [ ] TB.4: Pill stays visible while single-design upscales are in flight, hides 2s after the last terminal job (reuse `TERMINAL_FADE_MS`) — AC-2-3 / AC-2-6.
- [ ] TB.5: Create `components/UpscaleStatusPill/partials/UpscaleJobsDrawer.tsx` — MUI Drawer/Popover listing each in-flight job with `designId` + source label (Editor / Batch). Opened by clicking the pill (AC-2-7).

### B3 — Completion snackbar with navigation
- [ ] TB.6: In `views/designs/editor/hooks/useUpscaleSingle.ts`, on terminal success fire a notistack snackbar "Upscale fertig" with action "Zum Canvas" that `navigate(`/designs/${projectId}`)` and focuses the artboard (AC-2-4). Error variant on failure (EC-2-3).
- [ ] TB.7: Ensure the snackbar fires once per completed job (useRef/Set gate), not on every poll tick.

### B4 — i18n + tests
- [ ] TB.8: Add i18n keys `upscale.pill.singleLabel`, `upscale.pill.drawerOpenAria`, `upscale.pill.drawerJobLabel`, `upscale.snackbar.singleDone`, `upscale.snackbar.singleDoneAction` (de + en, ASCII fallback convention).
- [ ] TB.9: Tests on the promoted `UpscaleStatusPill`: renders batch-only, single-only, combined (summed label); click opens drawer; drawer lists jobs with source (AC-2-8). Snackbar test: single completion fires once + action navigates to `/designs/<projectId>`.
- [ ] TB.10: `npm run lint && npx tsc -b && npm run test -- --run`. Zero failures.
- [ ] TB.11: Flip AC-2-1..AC-2-9 + EC-2-1..EC-2-5 to `[x]`. (EC-2-4 cross-session persistence: verify whether `upscaleSlice` persists today; if not, mark EC-2-4 as out-of-scope follow-up inline.)

---

## Phase C — Item 4: AI Image-Gen mode auto-switch driven by Canvas selection

Skill: `/frontend`. Independent of A/B; largest item.

### C1 — Generation hook: mode source + multi-ref helper
- [ ] TC.1: Read `views/designs/workspace/hooks/useWorkspaceGeneration.ts` + `RightPanel.tsx` + `GenerationZone.tsx` to confirm the mode-change wiring (`onGenerationModeChange`).
- [ ] TC.2: Add `generationModeSource: 'auto' | 'manual'` state to `useWorkspaceGeneration` (default `'manual'`). Expose it + a setter alongside `generationMode`.
- [ ] TC.3: When the user changes the mode via the dropdown, set source = `'manual'` (AC-4-5). When the auto-flow changes it, set source = `'auto'`.
- [ ] TC.4: Add `handleUseSelectionAsReferences(imageUrls: string[])` — caps at 2 (sets `sourceImageUrl` + `sourceImageUrl2`), flips mode → `image_to_image_edit` with source `'auto'`. Fires the once-per-session ">2 images" warning snackbar when `imageUrls.length > 2` (useRef + localStorage `chat-...`-style flag). Keep existing `handleUseAsReference(string)` untouched (AC-4-2).
- [ ] TC.5: When the user manually selects `text_to_image` while a selection exists → dispatch `deselectAll()` on the artboards (AC-4-4). Wire the deselect callback into the mode-change handler.

### C2 — Selection-driven reflex hook
- [ ] TC.6: Create `views/designs/workspace/hooks/useSelectionDrivenImageGen.ts` — subscribes to `selectedIds` + `boardData.artboards` + the generation hook. On selection change:
  - empty → non-empty with 1+ image artboards: call `handleUseSelectionAsReferences(imageUrlsInSelectionOrder)` (AC-4-1).
  - non-empty → empty AND `generationModeSource === 'auto'`: revert mode → `text_to_image`, clear reference slots (AC-4-3).
  - filter to image-bearing artboards only (`designId` + `imageUrl` non-null); if filter leaves 0, no switch (EC-4-1).
  - short-circuit when mode is `remix` (EC-4-4) and when a generation is in-flight (queue for next request — EC-4-3).
  - take `ab.imageUrl` at selection time (AC-4-8). Skip artboards whose linked design was deleted (EC-4-5).
- [ ] TC.7: Mount `useSelectionDrivenImageGen` in `DesignWorkspaceView`. Keep the view thin.

### C3 — Auto badge
- [ ] TC.8: In `GenerationZone.tsx` (near the mode dropdown), render a small MUI Badge/Chip "Auto" with Tooltip "Modus aus Canvas-Selektion abgeleitet" when `generationModeSource === 'auto'`. Hide on manual switch or selection clear (AC-4-11). Use `theme.vars.palette.*`, no hex.

### C4 — i18n + tests
- [ ] TC.9: Add i18n keys `design.imageGen.mode.auto.badge`, `design.imageGen.mode.auto.tooltip`, `design.imageGen.references.capWarning` (de + en).
- [ ] TC.10: Create `views/designs/workspace/hooks/__tests__/useSelectionDrivenImageGen.test.ts`: empty→selection (1 / 2 / 5 images), selection→empty auto-revert, manual T2I clears selection, manual switch sets source='manual', auto-revert only when source='auto', 5-image cap-to-2 warning once (AC-4-10).
- [ ] TC.11: `npm run lint && npx tsc -b && npm run test -- --run`. Zero failures.
- [ ] TC.12: Flip AC-4-1..AC-4-11 + EC-4-1..EC-4-5 to `[x]`.

---

## Phase D — QA + final verification

Skill: `/qa`.

- [ ] TD.1: Re-verify every AC + EC against the latest code (unit tests + manual Playwright on dev).
- [ ] TD.2: Playwright on dev: chip-switch shows the right image (Items 1+3); upscale from editor → navigate away → pill visible → completion snackbar → back to canvas shows upscaled (Item 2); select artboards → image-gen flips to edit mode with refs → deselect → reverts (Item 4).
- [ ] TD.3: Add QA section to the spec with a per-item results table.
- [ ] TD.4: Flip `features/INDEX.md` status Planned → In Review once QA passes.

---

## Phase E — Open PR + monitor deploy

- [ ] TE.1: Confirm one commit per phase (A, B, C, QA-docs).
- [ ] TE.2: `git push -u origin fix/canvas-editor-bugs-and-image-gen`.
- [ ] TE.3: `gh pr create` referencing all 4 items + Playwright recon findings. Note `--merge` strategy in the PR body.
- [ ] TE.4: Wait for CI green.
- [ ] TE.5: On user approval: `gh pr merge --merge --delete-branch`.
- [ ] TE.6: Monitor deploy chain (CI → Docker Publish → Deploy).
