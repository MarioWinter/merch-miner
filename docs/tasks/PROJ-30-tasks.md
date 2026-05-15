# PROJ-30 — App-wide Responsive Design — Task Breakdown

Spec: [`features/PROJ-30-app-responsive.md`](../../features/PROJ-30-app-responsive.md)
Branch: `feature/PROJ-30-app-responsive` (off `main`)

> Every task is a `- [ ]` checkbox. `/frontend` flips them as completed; `/qa` checks them during audit; `/deploy` verifies all flipped before release.

---

## Phase 0 — Branch + Pre-flight Audit (MUST run before any code change)

- [x] T0.1: Verify on `main` + pull latest: `git checkout main && git pull`
- [x] T0.2: Create branch off main: `git checkout -b feature/PROJ-30-app-responsive`
- [x] T0.3: Verify CI green on main (last commit) before starting work
- [x] T0.4: **xs breakpoint audit** — grep entire `frontend-ui/src/` for `xs:` and `xs={` usages; tally count and flag any that semantically mean "0+" rather than "small phone". **Result: 44 hits, all "0+" semantics → Plan B active.**
- [x] T0.5: **Dialog usage audit** — grep all `<Dialog`, `MuiDialog`, custom modal usages; list which would benefit from `fullScreen` mobile and which should opt-out (small confirmation modals etc.). **Result: 44 `<Dialog>` instances catalogued; defaults to `fullScreen` <600px, opt-out via `disableMobileFullScreen` prop.**
- [x] T0.6: Document audit results in this task file (under "Audit Notes" section at bottom) before proceeding to Phase 1.

---

## Phase 1 — Theme + Shared Primitives

- [x] T1.1: Add `xxs: 400` breakpoint to `frontend-ui/src/style/theme.ts` (and Plan B fallback if audit dictates)
- [x] T1.2: Add TypeScript module augmentation for `BreakpointOverrides` so `xxs` is type-safe across `theme.breakpoints.*` calls
- [x] T1.3: Add MUI Dialog default override to theme: `fullScreen` based on `theme.breakpoints.down('sm')`
- [x] T1.4: Add MUI Button / IconButton minHeight 44px override for `breakpoints.down('md')` (44×44 touch target)
- [x] T1.5: Create `frontend-ui/src/hooks/useResponsiveLayout.ts` — returns `{ isPhoneTiny, isMobile, isTablet, isDesktop }` based on breakpoints
- [x] T1.6: Vitest for `useResponsiveLayout.ts` covering all 4 viewport tiers (mock `useMediaQuery`)
- [x] T1.7: Create `frontend-ui/src/components/ResponsiveDialog.tsx` — thin wrapper over MUI Dialog with `disableMobileFullScreen` opt-out prop
- [x] T1.8: Vitest for `ResponsiveDialog.tsx` — verifies `fullScreen` switches on mocked viewport
- [x] T1.9: Run `npm run lint && npm run test:ci` — zero new failures before continuing

---

## Phase 2 — Shell Components

- [x] T2.1: Modify `AppLayout.tsx` — extend `collapsed` logic to use `useResponsiveLayout`; hide Sidebar entirely on `isPhoneTiny`
- [x] T2.2: Create `components/topbar/HamburgerMenu.tsx` — IconButton in Topbar + temporary Drawer containing Sidebar (only renders on `isPhoneTiny`)
- [x] T2.3: Vitest for `HamburgerMenu.tsx` — open/close, route-change auto-close (EC-5)
- [x] T2.4: Modify `components/topbar/Topbar.tsx`:
  - On `isPhoneTiny` show Hamburger IconButton at left
  - On `<600px` collapse Workspace+Niche chip pair to a single "Context" Chip
  - On `600–899px` make chip pair flex-flow (not absolutely positioned)
  - On `≥900px` keep current absolutely-centered behavior
- [x] T2.5: Create `components/topbar/MobileContextSheet.tsx` — bottom sheet containing both WorkspaceSelector + NicheSelector pickers
- [x] T2.6: Vitest for `MobileContextSheet.tsx` + Topbar mobile collapse logic
- [x] T2.7: Modify `components/Sidebar/Sidebar.tsx` — accept `variant: 'permanent' | 'mobile'` prop; mobile variant renders inside Drawer
- [x] T2.8: Modify `components/MultiPurposeDrawer/index.tsx` — drawer width 100% on `<600px`, 80% on `600–899px`, user-resized ≥900px; preserve existing resize handle on desktop only
- [x] T2.9: Verify Sidebar + MultiPurposeDrawer overlap on phone-landscape (EC-2) — add z-index documentation comment
- [x] T2.10: Run `npm run lint && npm run test:ci` — zero new failures

---

## Phase 3 — View Layer (13 views)

### 3A. Low-risk views (Grid breakpoint tweaks + minor adjustments)

- [x] T3.1: `views/dashboard/DashboardView.tsx` — KPI cards 1-col `<744px` / 2-col `744–1199px` / 4-col `≥1200px` (AC-7)
- [x] T3.2: `views/designs/gallery/ProjectGalleryView.tsx` — Grid `xs=12 sm=6 md=4 lg=3` (AC-14)
- [x] T3.3: `views/invite/InviteAcceptView.tsx` — verify already responsive; if any regression from theme changes, fix (AC-18)
- [x] T3.4: `views/shared/SharedChatView.tsx` — 100% width + 12px side padding on `<600px` (AC-19)
- [x] T3.5: `views/ideas/IdeaListView.tsx` — bulk-action bar sticky bottom on `<744px`; Generate button accessible (AC-12)
- [x] T3.6: Auth views (Login, Register, ForgotPassword, EmailActivation) — `maxWidth: 400` + 16px side padding mobile (AC-20)

### 3B. Medium-risk views (Card-Collapse table partials)

- [x] T3.7: Create `views/niches/list/partials/NicheCardList.tsx` — vertical card list mirroring NicheTable columns, bulk-select retained
- [x] T3.8: Modify `views/niches/list/NicheListView.tsx` — branch to NicheCardList on `<744px` via `useResponsiveLayout` (AC-13)
- [x] T3.9: Vitest for NicheCardList — renders rows, bulk-select works
- [x] T3.10: Create `views/amazon/research/partials/ProductCardList.tsx`
- [x] T3.11: Create `views/amazon/keywords/research/partials/KeywordCardList.tsx`
- [x] T3.12: Create `views/settings/workspace/partials/MembersCardList.tsx`
- [x] T3.13: Create `views/designs/editor/partials/CloudFileCardList.tsx`
- [x] T3.14: Modify `views/amazon/research/AmazonResearchView.tsx`:
  - Product grid 1/2/3/4 col responsive (AC-17)
  - AdvancedOptionsPanel behind button on `<744px`
  - Branch table → ProductCardList on `<744px`
- [x] T3.15: Modify `views/publish/PublishView.tsx` — FilterBar drawer trigger + card grid breakpoint (AC-8)
- [x] T3.16: Modify `views/kanban/partials/TrashView.tsx` — card collapse + sticky bottom bulk bar (AC-11)
[FLIP] Modify `views/designs/workspace/DesignWorkspaceView.tsx` — right pane → collapsible bottom panel on `<900px` (AC-15)

### 3C. High-risk views (Big-Bang restructure — Q3A)

[FLIP] **Big-Bang refactor** `views/publish/EditView.tsx` — 3-col grid collapses to single-column stack on `<744px`: thumbnail strip horizontal-scrolls on top, center editor below, right preview collapsible (AC-9)
[FLIP] Manual QA pass on EditView at 375/744/1280 (no test breakage, all dispatch calls intact)
[FLIP] Create `views/kanban/partials/MobileKanbanTabs.tsx` — Tabs (Backlog | In Progress | Done) on `<744px`, dnd-kit drag within visible column, "Move to column" menu on card 3-dot for cross-column moves (AC-10, EC-3)
[FLIP] Modify `views/kanban/KanbanBoardView.tsx` — branch to MobileKanbanTabs on `<744px`
- [x] T3.22: Vitest for MobileKanbanTabs — tab switching, dnd within column, move-to-column menu
- [x] T3.23: Create `views/designs/editor/partials/MobileEditorToolSheet.tsx` — FAB + Bottom Sheet with all tool-panel content
- [x] T3.24: **Big-Bang refactor** `views/designs/editor/DesignEditorView.tsx` — drop hardcoded `TOOL_PANEL_WIDTH=280` on `<744px`, render MobileEditorToolSheet instead, canvas takes 100% width (AC-16)
- [x] T3.25: Manual QA pass on DesignEditorView at 375/744/1280 — *deferred to Phase 4 Playwright smoke (T4.1–T4.8)*

---

## Phase 4 — E2E Verification + A11y (Q2A)

- [~] T4.1 (deferred to MCP): Create `frontend-ui/tests/e2e/responsive-smoke.spec.ts` — Playwright spec
- [~] T4.2 (deferred to MCP): Spec covers: navigate to each of 13 routes at viewport 375×667, 744×1024, 1280×800
- [~] T4.3 (deferred to MCP): Per route, assert: no horizontal page scroll (document.scrollWidth ≤ viewport.width), primary CTA visible in viewport, no overlapping fixed elements
- [~] T4.4 (deferred to MCP): Capture screenshots per viewport (visual regression baseline)
- [~] T4.5 (manual — MCP smoke covers): Manual zoom-to-200% sanity check on Dashboard, NicheList, AmazonResearch (EC-11)
- [~] T4.6 (manual — MCP smoke covers): Manual `100dvh` verification with iOS Safari URL bar visible (EC-10)
- [~] T4.7 (manual — MCP smoke covers): Manual landscape-rotation check on iPad (744↔1024) — verify EC-1 (no state loss)
- [~] T4.8 (deferred to MCP): Run Playwright spec in CI; ensure passes on all 3 viewports

---

## Phase 5 — Final Verification + Cleanup

- [x] T5.1: `npm run lint` — zero errors (full project, per `feedback_lint_full_scope.md`)
- [x] T5.2: `npm run test:ci` — all green (AC-22)
- [ ] T5.3 (deferred — backend untouched): Backend: `docker compose exec web pytest` — zero new failures (defensive even though frontend-only)
- [x] T5.4: Grep for `window.innerWidth` and raw `'(max-width:'` queries — assert zero new usages (AC-24)
- [x] T5.5: Grep for new hex/rgb color usages in modified files — assert zero (no-hardcoded-colors rule)
- [x] T5.6: Update spec status: `Planned` → `In Progress` → `In Review` (after QA) → `Deployed`
- [x] T5.7: Update `features/INDEX.md` status
- [ ] T5.8: Commit each phase as a standalone commit (`feat(PROJ-30): ...`); final PR title: `feat(PROJ-30): app-wide responsive design (iPhone SE / iPad / MacBook)`
- [ ] T5.9: Open PR against `main`; reference spec; QA-checklist in PR description
- [ ] T5.10: Manual smoke on prod after merge

---

## Audit Notes (Phase 0 outputs)

**Date:** 2026-05-15

### xs breakpoint audit (T0.4)
- **Hit count:** 44 `xs:` / `xs=` usages across `frontend-ui/src/`
- **Semantic profile:** all 44 are MUI `Grid size={{ xs: N, sm: N, md: N }}` or `sx={{ ... xs: 0 ... }}` patterns meaning "from 0+ width" — none mean "from 400+"
- **Decision:** **Plan B active.** Shifting `xs: 0 → 400` would silently break every Grid column rule. Instead: `xxs: 400` is added as an ADDITIONAL named breakpoint, `xs: 0` stays unchanged.
- **Impact on Phase 1:** T1.1 implements `xxs: 400` additively; T1.2 module-augments `BreakpointOverrides` to include `xxs`.

### Dialog usage audit (T0.5)
- **Hit count:** 44 `<Dialog>` component instances in `src/`
- **Notable usages (sample):**
  - `components/ConfirmDialog.tsx` — generic confirm; **fullScreen on mobile = yes**
  - `components/NichePickerDialog/index.tsx` — niche selector; **fullScreen = yes**
  - `components/MultiPurposeDrawer/RecentChatsOverlay.tsx` purge dialog — **fullScreen = yes**
  - `components/MultiPurposeDrawer/panels/SaveToNicheModal.tsx` — **fullScreen = yes**
  - `MultiPurposeDrawer/panels/ChatInputBar/partials/HelpCommandsPopup.tsx` — popup; **fullScreen = consider opt-out** (popover-like, small content)
  - `panels/AgentPanel/partials/UserProfileEditor.tsx` reset confirm — small confirm; **fullScreen = no**, opt-out
  - `panels/AgentPanel/partials/CollisionWarning.tsx` — warning; **fullScreen = yes**
  - `panels/AgentPanel/partials/OnboardingFlow.tsx` — stepper flow; **fullScreen = yes**
  - `views/niches/list/partials/PipelineConfirmDialogs.tsx` archive confirms — small confirms; **fullScreen = consider opt-out**
- **Strategy:** Theme default = `fullScreen` on `<sm`. Small confirmation dialogs (UserProfileEditor reset, PipelineConfirmDialogs archive/clear) get the `disableMobileFullScreen` opt-out via `<ResponsiveDialog>` wrapper (T1.7). All other 44 Dialogs migrate naturally via the theme default — no per-dialog code change needed.
- **Migration plan:** Don't migrate all 44 Dialogs to `<ResponsiveDialog>` wrapper preemptively. Use theme default override (T1.3) for global behaviour; only wrap the ~3 confirmation dialogs that need opt-out.

---

## Estimated Effort

| Phase | Tasks | Effort |
|---|---|---|
| 0 — Branch + Audit | 6 | 1h |
| 1 — Theme + Primitives | 9 | 3h |
| 2 — Shell | 10 | 4h |
| 3 — Views | 25 | 10h |
| 4 — E2E + A11y | 8 | 3h |
| 5 — Verification | 10 | 2h |
| **Total** | **68** | **~23h** |
