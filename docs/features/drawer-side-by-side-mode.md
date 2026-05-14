# MultiPurposeDrawer — Side-by-Side mode + stepless resize

Phase 1J follow-up — extends the existing right-drawer (Niche / Chat / Agent panels) with two user-toggled layout modes and a continuous resize handle.

## Why

Today the right drawer (`MultiPurposeDrawer`) renders as an MUI `Drawer variant="persistent"`. On desktop it stays at `position: fixed` on the right side, and the main view next to it does NOT shrink — the drawer visually OVERLAPS the underlying content. Resize is restricted to 3 snap steps (480/768/1200 px) which feels harsh and unpredictable when the user wants something in between.

Users have asked for:

1. A toggle button (animated + positioned like the left sidebar's collapse button at `Sidebar.tsx:343`) that switches the drawer between OVERLAP and SIDE-BY-SIDE modes.
2. SIDE-BY-SIDE = main content shrinks to make room; drawer + content sit next to each other; resize handle continues to work.
3. OVERLAP = current behavior (drawer floats on top of content); restored by clicking the same toggle again.
4. **Both modes** use stepless resize between `380px` and `1400px`. The 3-step snap is removed entirely.

## Current state (verified 2026-05-14)

| Concern | File | Behavior |
|---|---|---|
| Drawer render | `components/MultiPurposeDrawer/index.tsx` | `Drawer variant="persistent"`, anchor `right`. No layout reservation in main view → overlap. |
| Width state | `store/chatBarSlice.ts` (`DrawerWidth` union) + `useDrawerResize.ts` | Width is one of `480 | 768 | 1200`. `snapToStep()` runs on pointer-up and rounds to the nearest step. |
| Resize handle | `components/MultiPurposeDrawer/DrawerResizeHandle.tsx` | Drag-handle on the drawer's left edge. |
| Sidebar collapse button | `components/sidebar/Sidebar.tsx:343` | Round red `ToggleButton` floating at right edge of sidebar, 48 × 48 wrap, chevron icon, `position: absolute`. |
| Main view padding | n/a — main view never accounts for drawer width. | This is what creates the overlap. |

## Goal — acceptance criteria

- [ ] **AC-1.** `chatBarSlice` adds a new field `drawerLayout: 'overlap' | 'sideBySide'`, persisted in `localStorage` under `chatBar.drawerLayout`. Default `'overlap'` (preserves current UX).
- [ ] **AC-2.** A floating toggle button — visually + positionally a mirror of the sidebar's `ToggleButton` — renders on the LEFT edge of the drawer when the drawer is open. Tooltip / aria-label reads `Side-by-side mode` (English) / `Nebeneinander-Ansicht` (German) when in overlap, and the inverse when in side-by-side.
- [ ] **AC-3.** Clicking the button toggles `drawerLayout`. The chevron direction flips (`ChevronLeftIcon` ↔ `ChevronRightIcon`).
- [ ] **AC-4.** When `drawerLayout === 'sideBySide'` AND `drawerOpen === true`, the main app frame (the `<main>` wrapper in `AppLayout`) reserves a `padding-right` equal to the current drawer width plus the resize-handle width (≈ 4 px). Smooth `transition` (200 ms standard easing) mirrors the drawer's own open/close animation.
- [ ] **AC-5.** When `drawerLayout === 'overlap'`, no padding is applied — the drawer floats on top of content (current behavior).
- [ ] **AC-6.** Stepless resize: `useDrawerResize` no longer calls `snapToStep`. On pointer-up the live width (clamped to `[380, 1400]`) is persisted directly.
- [ ] **AC-7.** `DrawerWidth` type widens from the `480 | 768 | 1200` union to `number` (with the same clamp range).
- [ ] **AC-8.** Resize handle continues to work in BOTH modes.
- [ ] **AC-9.** Mobile (`useMediaQuery(theme.breakpoints.down('sm'))`) is unchanged — drawer is always temporary + full-width, no layout toggle, no resize handle. Toggle button hidden on mobile.
- [ ] **AC-10.** All existing tests still pass; new tests cover the layout toggle action + stepless persistence + main-view padding contract.

## Implementation breakdown

### 1. Redux state — `store/chatBarSlice.ts`

- Extend the slice with:
  ```ts
  type DrawerWidth = number;               // was 480 | 768 | 1200
  type DrawerLayout = 'overlap' | 'sideBySide';
  ```
- Initial state: `drawerWidth: 768`, `drawerLayout: 'overlap'`.
- New reducer action `setDrawerLayout(state, action: PayloadAction<DrawerLayout>)`.

### 2. Stepless resize — `components/MultiPurposeDrawer/hooks/useDrawerResize.ts`

- Drop `STEPS` array and `snapToStep()` helper.
- `onPointerUp`: persist `Math.max(380, Math.min(1400, liveWidthRef.current))` directly to Redux + `localStorage`.
- On mount, read persisted width as `number` (parseInt, then clamp into range; reject NaN by falling back to `768`).

### 3. Toggle button — new partial `components/MultiPurposeDrawer/DrawerLayoutToggle.tsx`

- Style is a fork of `Sidebar.tsx`'s `ToggleWrap` + `ToggleButton`. Same dimensions (48 × 48 wrap, 28 × 28 button), same red colour token, same shadow.
- Positioned `position: absolute; top: 80; left: -24` — mirror of the sidebar (which is `right: -24` on its right edge).
- Renders only on desktop (`!isMobile`) and only when `drawerOpen === true`.
- Icon: `ChevronLeftIcon` when `overlap` (clicking pushes content out = drawer "moves left"); `ChevronRightIcon` when `sideBySide` (clicking lets drawer overlap again).
- `aria-label` + `Tooltip` from i18n.

### 4. Drawer — `components/MultiPurposeDrawer/index.tsx`

- Mount the new `<DrawerLayoutToggle />` inside the `<Drawer>` slot, next to the existing `<DrawerResizeHandle>`.
- No further changes — drawer stays `variant="persistent"`; the visual shift comes from the main-view padding (see step 5).

### 5. Main-view layout — `components/AppLayout.tsx` (or whichever wrapper hosts `<main>`)

- Read `chatBar.drawerWidth`, `chatBar.drawerOpen`, `chatBar.drawerLayout` from Redux.
- When `drawerOpen && drawerLayout === 'sideBySide' && !isMobile` → apply `padding-right: ${drawerWidth + 4}px` to the main column.
- Else: no padding (overlap mode and closed mode look identical from the main view's perspective).
- Same 200 ms ease transition as the drawer so they animate together.

### 6. i18n — `public/locales/en|de/translation.json`

- New keys (drop into existing `search.drawer.*` namespace):
  - `layoutOverlapTooltip`: "Side-by-side view" / "Nebeneinander-Ansicht"
  - `layoutSideBySideTooltip`: "Overlap view" / "Überlappende Ansicht"
  - `layoutToggleAriaLabel`: "Toggle drawer layout" / "Drawer-Layout umschalten"

### 7. Tests

- `useDrawerResize.test.ts`: drag → release at 612px → state holds `612` (not snapped). Drag past clamp → persisted at 380 / 1400.
- `chatBarSlice.test.ts`: `setDrawerLayout` action + initial state.
- `DrawerLayoutToggle.test.tsx`: click dispatches `setDrawerLayout`; chevron flips on each click.
- `MultiPurposeDrawer.test.tsx`: existing tests stay green; add one assertion that `main` element receives the correct `padding-right` when both `drawerOpen` and `drawerLayout === 'sideBySide'`.

## Non-goals

- Re-styling the drawer panels themselves — Niche / Chat / Agent contents are untouched.
- Touching the left sidebar — it already has the toggle behavior; we only mirror its visual language.
- Mobile behavior — stays temporary + full-width, no toggle.
- Cross-tab sync of layout preference — `localStorage` already persists; multi-tab edge cases out of scope.

## Risk + rollback

- Risk: existing user width preferences (480 / 768 / 1200) read as numbers — already valid in the new schema. No migration needed.
- Risk: padding-right transition may "flicker" on slow renders. Mitigation: same 200 ms easing as the drawer itself.
- Rollback: single-file revert of Redux slice + `useDrawerResize` + AppLayout padding. Toggle button can stay rendered with a no-op handler if Redux rollback is partial.

## Status

- 2026-05-14 — Spec written. Implementation queued.
