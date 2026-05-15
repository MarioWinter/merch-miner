# PROJ-30: App-wide Responsive Design

## Status: Planned
**Created:** 2026-05-14
**Last Updated:** 2026-05-14

## Dependencies
- None (cross-cutting refactor of existing views)

## Goal
Make the entire Merch Miner frontend usable on three reference viewports without breaking any existing functionality:
- **iPhone SE** — 375 × 667 (smallest supported mobile)
- **iPad portrait** — 744 × 1024
- **MacBook 13"** — 1280 × 800 (desktop baseline)

User constraint: "alles muss funktionieren" — zero functional regression in any view.

## User Stories
- As a POD seller on the road, I want to open Merch Miner on my iPhone and review niche data without horizontal-scrolling the whole page
- As a team member reviewing a slogan list on iPad, I want tables to stay readable without zoom-pinching
- As a designer on iPad, I want to inspect a design (gallery, niches, ideas) even if heavy editing stays a desktop activity
- As a user on any device, I want all primary actions (publish, generate, save) reachable without elements being clipped or off-screen
- As a user on iPhone, I want the sidebar to not consume 50%+ of my screen width

## Design Decisions (signed off via A/B/C)

- **Q1A (Sidebar):** Hybrid — Sidebar stays at 60px mini variant from `<900px`. Below `<400px`, sidebar hides entirely and a Hamburger IconButton in the Topbar opens it as a temporary `Drawer`.
- **Q2A (Tables):** Card-Collapse — On `<744px`, NicheTable, AmazonProductTable, KeywordBankTable, PublishList, KanbanCardTable, etc. render as a vertical card list (one card per row, fields stacked, action menu collapsed into a 3-dot menu).
- **Q3A (Design Editor):** Bottom Sheet — On `<744px`, the 280px left tool panel disappears and a Floating Action Button opens an expandable bottom sheet containing the tools. Canvas takes 100% width.
- **Q4A (Kanban):** Tab-Switcher — On `<744px`, Kanban columns become MUI Tabs (one column visible at a time). Drag-and-drop is preserved within the visible column; cross-column moves use a "Move to…" menu.

## Acceptance Criteria

### Shell / Global

- [ ] AC-1: Sidebar shows full 220px width on `≥900px`; collapses to 60px mini variant between `400–899px`; hides entirely below 400px with a Hamburger button in the Topbar that opens it as a temporary Drawer
- [ ] AC-2: Topbar Workspace+Niche chip pair stays centered on `≥900px`; on `<900px` chips remain visible but no longer absolutely-centered (flex-flow); on `<600px` chips collapse to a single "Context" Chip that opens a bottom sheet containing both pickers
- [ ] AC-3: MultiPurposeDrawer (chat) opens at 100% viewport width on `<600px`, 80% on `600–899px`, and existing user-resized width on `≥900px`
- [ ] AC-4: All Dialog / Modal components (NichePicker, design-gen wizard, kanban detail, settings panels, confirm dialogs) use `fullScreen` prop on `<600px` and default sizing on `≥600px`
- [ ] AC-5: No horizontal page scroll occurs on any view at 375×667 (only intended scrollable regions inside containers may scroll horizontally)
- [ ] AC-6: All clickable / tappable controls (buttons, icon buttons, list items, chips) are at least 44×44 CSS pixels on `<900px`

### View-level

- [ ] AC-7: **DashboardView** — KPI cards stack 1-column on `<744px`, 2-column on `744–1199px`, 4-column on `≥1200px`
- [ ] AC-8: **PublishView** — Card grid uses `minmax(160px, 1fr)` on `<744px`, `minmax(240px, 1fr)` on `≥744px`; FilterBar collapses into a Drawer trigger on `<744px`
- [ ] AC-9: **EditView (Publish)** — 3-column grid (`200px + 1fr + 300px`) collapses to single-column stack on `<744px`: thumbnail strip becomes horizontal scrollable row on top, then center editor, then right preview as collapsible section
- [ ] AC-10: **KanbanBoardView** — On `<744px` shows MUI Tabs (one column per tab); on `≥744px` keeps horizontal-scroll columns layout; existing dnd-kit drag works in both modes (cross-column on mobile uses "Move to column" menu in card menu)
- [ ] AC-11: **TrashView** — Row layout collapses to cards on `<600px`; bulk-action bar sticks to bottom on mobile
- [ ] AC-12: **IdeaListView (Slogan Factory)** — Bulk action bar sticks to bottom on `<744px`; idea cards (or list rows) stack vertically; Generate-button area stays accessible (not clipped)
- [ ] AC-13: **NicheListView** — NicheTable renders as Card-Collapse on `<744px` (Q2A); bulk-select bar sticks to bottom on mobile
- [ ] AC-14: **ProjectGalleryView** — Grid `xs=12 sm=6 md=4 lg=3` (was `xs=6 sm=4 md=3`) to keep cards readable
- [ ] AC-15: **DesignWorkspaceView** — Right pane (300px+) becomes a collapsible bottom panel on `<900px`; main canvas takes full width
- [ ] AC-16: **DesignEditorView** — Tool panel becomes a FAB+BottomSheet on `<744px` (Q3A); thumbnail strip horizontal-scrolls; canvas takes full available width
- [ ] AC-17: **AmazonResearchView** — Product grid: 1 col `<375px`, 2 col `<744px`, 3 col `<1200px`, 4 col `≥1200px`; AdvancedOptionsPanel collapses behind a button on `<744px`
- [ ] AC-18: **InviteAcceptView** — No regression (already responsive)
- [ ] AC-19: **SharedChatView** — Container takes 100% width on `<600px` with 12px side padding; message bubbles wrap; copy/retry actions remain tappable
- [ ] AC-20: **Auth views** (Login, Register, ForgotPassword, EmailActivation) — Centered card with `maxWidth: 400`, side padding 16px on mobile, no regression

### Cross-cutting visual / testing

- [ ] AC-21: All 13 views pass a Playwright smoke check at 375×667, 744×1024, and 1280×800: page loads, no horizontal scroll, primary CTA visible above the fold
- [ ] AC-22: Existing Vitest suite passes (`npm run test:ci`) with zero new failures
- [ ] AC-23: ESLint passes (`npm run lint`) with zero new errors
- [ ] AC-24: All breakpoint-conditional rendering uses MUI's `useMediaQuery(theme.breakpoints.down/up(...))` or `sx={{ display: { xs, sm, md } }}` — no hard-coded `window.innerWidth` checks
- [ ] AC-25: New breakpoint values (if any are added beyond MUI defaults `xs=375 / sm=600 / md=900 / lg=1200 / xl=1536`) are defined centrally in the MUI theme, not inline per component

## Edge Cases

- [ ] EC-1: User rotates iPad from portrait (744px) to landscape (1024px) — layout transitions to the correct breakpoint without state loss (scroll position, open drawers, form data preserved)
- [ ] EC-2: User opens the chat drawer on iPhone SE — drawer takes full screen, but Topbar context-chip "Context" still openable via a small floating return button OR the drawer's own close button (no dead-lock state)
- [ ] EC-3: User tries to drag-and-drop a Kanban card across columns on `<744px` — since only one tab is visible, fallback "Move to column" menu in the card's 3-dot menu handles cross-column moves
- [ ] EC-4: User loads DesignEditorView on iPhone — Bottom Sheet appears (Q3A) but if the device keyboard is open, sheet collapses to leave canvas viewable; reopens on keyboard dismiss
- [ ] EC-5: Sidebar is in hamburger mode (`<400px`) and the user navigates to a route — sidebar Drawer auto-closes after route change
- [ ] EC-6: Workspace+Niche "Context" chip on `<600px` is tapped while drawer is open — bottom sheet opens layered above drawer, drawer is not closed (z-index ordering)
- [ ] EC-7: Tables converted to Card-Collapse retain bulk-select — checkbox appears at top-left of each card; bulk-action bar sticks to viewport bottom and shows "(N) selected" with the same action buttons as desktop
- [ ] EC-8: User has a very long workspace or niche name (>30 chars) — chip text truncates with ellipsis on all viewports, tooltip on hover/long-press shows the full name
- [ ] EC-9: Long forms (Settings → Profile, Niche Edit, Slogan Edit) on `<600px` — fields stack to 1 column; submit button remains visible at bottom (sticky form footer where applicable)
- [ ] EC-10: User installs as PWA / opens with iOS Safari hidden URL bar — viewport math uses `100dvh` not `100vh` to avoid 56px Topbar being offscreen
- [ ] EC-11: User zooms in (pinch) on iPhone — layout doesn't break (uses relative units / `rem` for typography where appropriate); accessibility zoom up to 200% remains usable
- [ ] EC-12: Component reused inside a Dialog (e.g. ProductCard inside a modal) — responsive rules trigger based on viewport, not container, so cards in modals render consistently

## Technical Requirements

- **Breakpoints:** Use MUI defaults (`xs=0, sm=600, md=900, lg=1200, xl=1536`); add `xxs=400` only if necessary (Q1 hamburger threshold) — define centrally in theme
- **Touch targets:** Minimum 44×44 CSS pixels for all interactive controls on `<900px` (iOS HIG)
- **No hardcoded colors:** Theme tokens only (existing constraint from `feedback_no_hardcoded_colors.md`)
- **styled() preferred:** Where responsive overrides exceed 5 sx properties, extract to inline `styled()` component
- **i18n:** All new user-visible strings via `useTranslation()`
- **Tests:** New responsive logic in shared components must have at least one Vitest test (mock `useMediaQuery` for breakpoint variation)
- **Performance:** No additional re-renders triggered by viewport resize beyond MUI's built-in `useMediaQuery` debounce
- **Browser support:** Safari iOS 15+, Chrome Android 110+, latest desktop Safari/Chrome/Firefox/Edge
- **No new dependencies:** Use existing MUI v7 + Emotion responsive primitives only

## Out of Scope (Non-Goals)

- New features or UI flows
- Animation overhaul / motion polish
- Color/theme/typography tweaks (no design-system token changes)
- Landscape phone optimization (portrait-first; landscape should not break but not be polished)
- PWA install flow, offline mode, push notifications
- Keyboard / accessibility audit beyond zoom-to-200% (separate concern)
- Right-to-left (RTL) layout support

---

## Open Questions for User

None — Q1A / Q2A / Q3A / Q4A answered. Remaining drawer/topbar/modal defaults chosen by RE (documented in AC-2..AC-4); flag during architecture review if any need to flip.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Architecture Decisions (signed off via A/B/C)

| Decision | Choice | Why |
|---|---|---|
| Table mobile pattern | Per-table own Card partial (Q1A) | 5 tables, each has different cell semantics; shared schema-wrapper would force unnecessary migration; local Card markup keeps domain logic tight |
| Test strategy | Playwright responsive smoke @ 3 viewports (Q2A) | Catches visual + functional regressions across all 13 routes; Vitest mock-only would miss layout collisions |
| EditView / DesignEditorView refactor | Big-Bang single task per view (Q3A) | Both views isolated, no cross-view dep; single PR easier to QA than incremental branch |
| `xxs=400` breakpoint | Custom MUI breakpoint inserted, shifts `xs` to 400 (Q4A) | Clean API (`theme.breakpoints.down('xs')` works); **risk:** shifts existing `xs` usages — Phase 1 starts with a codebase audit, fallback Plan B documented below |
| Sidebar mobile | Full 220 ≥900 / mini 60 between 400–899 / hidden + Hamburger <400 | From spec Q1A |
| Kanban mobile | Tabs (one column visible) on <744 | From spec Q4A |
| Editor mobile | FAB → BottomSheet on <744 | From spec Q3A |
| Tables on mobile | Card-Collapse on <744 (per-table partial) | From spec Q2A |
| Drawer | 100% <600 / 80% 600–899 / user-resized ≥900 | From spec AC-3 |
| Dialogs | `fullScreen` on <600 globally via theme override | From spec AC-4 |
| Topbar chips | Centered ≥900 / flex 600–899 / single "Context" chip + bottom sheet <600 | From spec AC-2 |

### Plan B (Fallback for Q4A regression)

If the Phase 1 codebase audit reveals more than ~10 existing components relying on `xs=0` semantically (e.g., `size={{ xs: 12 }}` meaning "12-col on all viewports"), we switch to: keep `xs: 0` unchanged and add `xxs: 400` as an ADDITIONAL named breakpoint (Q4B). User has been flagged; decision deferred until audit data is in.

### Theme Changes (`frontend-ui/src/style/theme.ts`)

| Change | Description |
|---|---|
| Breakpoints | Add `xxs: 400` as new lowest tier; shift `xs` from 0 → 400 (pending Phase 1 audit); other tiers unchanged (sm=600, md=900, lg=1200, xl=1536) |
| Module augmentation | TypeScript module augment for `BreakpointOverrides` so `xxs` is type-safe |
| MuiDialog default | Add component default override that sets `fullScreen` based on `useMediaQuery(theme.breakpoints.down('sm'))` — global one-shot fix for AC-4 |
| MuiButton / MuiIconButton minHeight | Add `@media (max-width: 899px)` override to ensure 44×44 minimum touch target |

### New Shared Primitives

| Primitive | Path | Purpose |
|---|---|---|
| `useResponsiveLayout()` hook | `frontend-ui/src/hooks/useResponsiveLayout.ts` | Single source of truth: returns `{ isMobile, isTablet, isDesktop, isPhoneTiny }` based on breakpoints. Replaces ad-hoc `useMediaQuery` scattered across files |
| `<HamburgerMenu />` | `frontend-ui/src/components/topbar/HamburgerMenu.tsx` | Topbar IconButton + temporary `Drawer` that contains the Sidebar (only renders <400px) |
| `<MobileContextSheet />` | `frontend-ui/src/components/topbar/MobileContextSheet.tsx` | Bottom sheet that contains Workspace + Niche pickers; opened by tapping the collapsed "Context" chip on <600px |
| `<ResponsiveDialog />` | `frontend-ui/src/components/ResponsiveDialog.tsx` | Wraps MUI `Dialog`, defaults to `fullScreen` on `<600px`; thin wrapper to standardize across the app |
| `<MobileKanbanTabs />` | `frontend-ui/src/views/kanban/partials/MobileKanbanTabs.tsx` | Renders Kanban columns as MUI Tabs on `<744px`; reuses existing dnd-kit logic within visible column |
| `<MobileEditorToolSheet />` | `frontend-ui/src/views/designs/editor/partials/MobileEditorToolSheet.tsx` | FAB + Bottom Sheet containing all DesignEditor tools when `<744px` |
| Per-table Card partials | `views/<view>/partials/<Table>CardList.tsx` | One per: NicheTable, ProductTable, KeywordTable, MembersTable, CloudFileTable |

### Refactor Strategy Per View (Risk Matrix)

| View | Risk | Strategy | Tasks |
|---|---|---|---|
| DashboardView | LOW | Grid breakpoint tweak | 1 |
| PublishView | LOW | FilterBar to Drawer trigger on <744 | 1 |
| EditView | **HIGH** | Big-Bang restructure (Q3A): 3-col grid → single-col stack on <744 | 1 |
| KanbanBoardView | MED | Add `<MobileKanbanTabs>` branch | 1 |
| TrashView | LOW | Card collapse + sticky bottom bar | 1 |
| IdeaListView | LOW | Stack already responsive; sticky bottom bar | 1 |
| NicheListView | MED | Add `NicheCardList.tsx` partial | 1 |
| ProjectGalleryView | LOW | Grid breakpoint adjust | 1 |
| DesignWorkspaceView | MED | Right pane → collapsible bottom panel on <900 | 1 |
| DesignEditorView | **HIGH** | Big-Bang (Q3A) + `<MobileEditorToolSheet>` | 1 |
| AmazonResearchView | MED | Grid + ProductCardList + AdvancedOptions collapse | 1 |
| InviteAcceptView | NONE | No-op | 0 |
| SharedChatView | LOW | Padding adjust | 1 |

**Total:** 11 view-touching tasks + 7 shared-primitive tasks + theme + Playwright = ~22 tasks.

### Test Strategy

| Layer | What | Tool |
|---|---|---|
| Smoke | All 13 routes load @ 375/744/1280, no horizontal scroll, primary CTA visible | Playwright (new spec: `tests/e2e/responsive-smoke.spec.ts`) |
| Unit | `useResponsiveLayout` hook returns correct flags for mocked viewport sizes | Vitest |
| Unit | Each per-table CardList renders correct rows + bulk-select works | Vitest |
| Unit | `<ResponsiveDialog>` switches `fullScreen` based on mocked `useMediaQuery` | Vitest |
| Regression | Existing Vitest suite stays green | `npm run test:ci` |
| Manual | Real-device check (iPhone SE Simulator, iPad Simulator, MacBook) before merge | DevTools / Simulator |

### Dependencies (Packages)

**None.** All work uses existing MUI v7 + Emotion + dnd-kit. No new npm installs.

### File Structure (Visual Tree of New / Modified Files)

```
frontend-ui/src/
├── style/
│   └── theme.ts                          [MODIFY: xxs breakpoint + Dialog default + button minHeight]
├── hooks/
│   └── useResponsiveLayout.ts            [NEW]
├── components/
│   ├── AppLayout.tsx                     [MODIFY: hamburger threshold logic]
│   ├── ResponsiveDialog.tsx              [NEW]
│   ├── topbar/
│   │   ├── Topbar.tsx                    [MODIFY: hamburger button, mobile chip collapse]
│   │   ├── HamburgerMenu.tsx             [NEW]
│   │   └── MobileContextSheet.tsx        [NEW]
│   ├── Sidebar/
│   │   └── Sidebar.tsx                   [MODIFY: mobile drawer mode]
│   └── MultiPurposeDrawer/
│       └── index.tsx                     [MODIFY: 100%/80% width on <900]
└── views/
    ├── dashboard/DashboardView.tsx       [MODIFY: Grid breakpoints]
    ├── publish/
    │   ├── PublishView.tsx               [MODIFY: FilterBar mobile drawer]
    │   └── EditView.tsx                  [MODIFY: Big-Bang stack on mobile]
    ├── kanban/
    │   ├── KanbanBoardView.tsx           [MODIFY: branch to mobile tabs]
    │   ├── partials/
    │   │   ├── MobileKanbanTabs.tsx      [NEW]
    │   │   └── TrashView.tsx             [MODIFY: card collapse]
    ├── ideas/IdeaListView.tsx            [MODIFY: sticky bottom bar]
    ├── niches/list/
    │   ├── NicheListView.tsx             [MODIFY: branch to card list]
    │   └── partials/
    │       └── NicheCardList.tsx         [NEW]
    ├── designs/
    │   ├── gallery/ProjectGalleryView.tsx     [MODIFY: Grid breakpoints]
    │   ├── workspace/DesignWorkspaceView.tsx  [MODIFY: collapsible bottom panel]
    │   └── editor/
    │       ├── DesignEditorView.tsx           [MODIFY: Big-Bang FAB+BottomSheet]
    │       └── partials/
    │           ├── MobileEditorToolSheet.tsx  [NEW]
    │           └── CloudFileCardList.tsx      [NEW]
    ├── amazon/
    │   ├── research/
    │   │   ├── AmazonResearchView.tsx         [MODIFY: collapse panels]
    │   │   └── partials/ProductCardList.tsx   [NEW]
    │   └── keywords/research/
    │       └── partials/KeywordCardList.tsx   [NEW]
    ├── settings/workspace/partials/
    │   └── MembersCardList.tsx               [NEW]
    └── shared/SharedChatView.tsx              [MODIFY: padding]

frontend-ui/tests/e2e/
└── responsive-smoke.spec.ts                   [NEW Playwright spec]
```

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Q4A `xs` shift breaks existing `xs={12}` semantics | HIGH | HIGH | Phase 1.1 = full grep audit; if >10 hits, fall back to Plan B (additive `xxs: 400`) |
| Dialog `fullScreen` default breaks small modals (e.g. ColorPicker, confirm dialogs) | MED | MED | Audit all `<Dialog>` usages in Phase 1; allow `disableMobileFullScreen` opt-out prop on `<ResponsiveDialog>` |
| Kanban dnd-kit cross-column drag breaks on tab-switched view | MED | MED | "Move to column" menu added to card 3-dot menu as alternative; in-tab drag preserved |
| Sidebar Hamburger Drawer + MultiPurposeDrawer overlap on phone landscape | LOW | MED | EC-2 covers; z-index ordering tested manually |
| Playwright smoke runs slow CI | LOW | LOW | Use `test.describe.parallel` + 3 viewport configs |
| Big-Bang EditView refactor regresses publish flow | MED | HIGH | Keep all existing test IDs / dispatch calls intact; QA pass before merge |

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
