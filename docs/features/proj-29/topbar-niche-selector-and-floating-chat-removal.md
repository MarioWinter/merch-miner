# Topbar Niche selector + remove FloatingChatBar

PROJ-29 Phase 1J follow-up. Two coordinated UI changes:

1. **Delete the FloatingChatBar** (bottom-center fixed bar). Chat lives only
   inside the right `MultiPurposeDrawer` panel from now on.
2. **Add a Niche chip-selector** in the topbar, immediately right of the
   `WorkspaceSelector`. Same visual language (outlined pill + chevron +
   MUI Menu), implemented as a single reusable `<TopbarChipSelector>`
   primitive consumed by both the workspace chip and the new niche chip.

## Why

- The FloatingChatBar duplicates an entry-point we already have in the
  drawer (`Chat` segment). Two places to start a chat is confusing UX,
  and the bottom-fixed bar covers content on tall scrolls. Removing it
  collapses chat into one canonical location — the drawer.
- Switching the active niche currently means navigating to
  `/niches` and clicking a row. A topbar chip — exactly where users
  already switch workspaces — turns niche switching into a 1-click,
  one-handed action available from every route.
- Pulling the chip pattern out as a reusable primitive lets the next
  similar selector (e.g. Project, Marketplace) be added in 5 lines.

## Current state — verified 2026-05-14

| Concern | File | Behaviour |
|---|---|---|
| FloatingChatBar | `components/FloatingChatBar/index.tsx` + tests | Fixed at bottom-center; hosts ChatInputBar + streaming state (`useSendMessageStream`, optimistic insert). Mounted in `AppLayout.tsx:141`. Hidden on canvas routes via `CHAT_BAR_HIDDEN_PATTERN`. |
| WorkspaceSelector | `components/topbar/WorkspaceSelector.tsx` | Outlined pill (border-radius 999px, height 32), KeyboardArrowDown chevron, MUI Menu of workspaces. Active item rendered with `CheckIcon`. Skeleton placeholder while loading. |
| Active niche state | `chatBar.activeNicheId` (Redux), `setActiveNicheId` action | Already exists. Currently driven by Niche-panel interactions and the chat-bar mention picker. |
| Niche list source | `nicheApi.useListNichesQuery` | RTK Query — paginates; we'll fetch just enough to populate the dropdown. |

## Acceptance criteria

### A — Remove FloatingChatBar
- [x] **AC-1.** Delete `components/FloatingChatBar/` (component + tests).
- [x] **AC-2.** Remove `<FloatingChatBar />` mount + import from `AppLayout.tsx`.
- [x] **AC-3.** Remove `CHAT_BAR_HIDDEN_PATTERN` and the `hideChatBar`
  branch — no longer needed.
- [x] **AC-4.** `chatBarSlice` cleanup: `barExpanded`, `expandBar`,
  `collapseBar` exist only for the FloatingChatBar. Drop the state field,
  drop the reducers, drop the exports. If a non-FCB consumer surfaces
  during the audit, leave the field with a deprecation comment instead of
  removing.
- [x] **AC-5.** All existing imports of `expandBar` / `collapseBar` /
  `barExpanded` are gone; `tsc -b` green; `npm run lint` 0 errors;
  `npm run test:ci` green.
- [x] **AC-6.** Drawer-open entry-point survives: the topbar already has a
  visible drawer-toggle icon (Chat segment in the drawer header is
  reachable via the new niche-chip behaviour — see AC-13). Add a small
  `IconButton` in the Topbar (chat-bubble icon, left of the language
  toggle) as a deterministic drawer-open if niche-chip-driven open feels
  surprising.

### B — TopbarChipSelector primitive
- [x] **AC-7.** New `components/topbar/TopbarChipSelector.tsx` with this
  prop contract:
  ```ts
  interface ChipOption { id: string; label: string }

  interface TopbarChipSelectorProps {
    value: string | null;                  // active option id, null when none
    placeholder: string;                   // shown when value is null
    options: ChipOption[];                 // dropdown contents
    onChange: (id: string) => void;
    loading?: boolean;                     // renders Skeleton
    emptyLabel?: string;                   // shown when options.length === 0
    'aria-label'?: string;                 // a11y override (defaults to placeholder)
    menuId: string;                        // unique per consumer for ARIA wiring
  }
  ```
- [x] **AC-8.** Visual / a11y parity with the current WorkspaceSelector:
  - styled `Button` with `borderRadius: 999`, height 32, maxWidth 300,
    `KeyboardArrowDownIcon` end-adornment
  - MUI `Menu` placement `anchorOrigin: { horizontal: 'center',
    vertical: 'bottom' }`, transformOrigin top-center
  - selected option shown with `CheckIcon`
  - `Skeleton` rounded pill while `loading`
- [x] **AC-9.** Refactor `WorkspaceSelector.tsx` to compose
  `<TopbarChipSelector>`. Workspace-specific logic (RTK cache reset on
  switch via `publishApi.util.resetApiState()`, `setActiveWorkspace`
  dispatch, `fetchWorkspaces` effect) stays inside `WorkspaceSelector`;
  styling moves to the primitive.
- [x] **AC-10.** Existing `WorkspaceSelector` tests still pass with no
  changes — refactor is internal.

### C — NicheSelector
- [x] **AC-11.** New `components/topbar/NicheSelector.tsx` that
  composes `<TopbarChipSelector>`:
  - `value`: `useAppSelector((s) => s.chatBar.activeNicheId)`
  - `placeholder`: `t('topbar.niche.selector')` → English "Niche",
    German "Nische"
  - `options`: from `useListNichesQuery({ page: 1, page_size: 100 })`
    mapped to `[{ id, label: name }]`. Page-size 100 covers every realistic
    workspace; if the result is paginated we surface a `…more` hint as a
    disabled tail item (post-MVP — gated behind a follow-up if it bites).
  - `onChange`: `dispatch(setActiveNicheId(id))` ONLY — see AC-13.
- [x] **AC-12.** NicheSelector refetches when `activeWorkspaceId` changes
  (workspace dropdown switch must repopulate the niches dropdown).
- [x] **AC-13.** Selecting a niche from the chip is a pure context-setter
  (user decision Q1A, 2026-05-14). NO drawer auto-open. Drawer opens via
  the dedicated topbar chat-bubble IconButton (AC-6).
- [x] **AC-14.** Niche chip is mounted in `Topbar.tsx` immediately right
  of `<WorkspaceSelector />`. Spacing matches the topbar's existing gap
  rhythm.
- [x] **AC-15.** When the user has no workspaces / no niches, chip
  renders the disabled "no niches" empty state (`t('topbar.niche.none')`).

### D — i18n
- [x] **AC-16.** New keys (EN + DE) under `topbar.niche.*`:
  - `selector` — placeholder text ("Niche" / "Nische")
  - `none` — empty state ("No niches" / "Keine Nischen")
  - `loading` — aria-label for skeleton

### E — Tests
- [x] **AC-17.** `TopbarChipSelector.test.tsx`:
  - renders placeholder when `value` is `null`
  - renders selected label when `value` matches an option id
  - clicking the chip opens the menu
  - clicking a menu item fires `onChange` with the right id
  - `loading=true` renders a Skeleton instead of the button
  - empty options + non-null `emptyLabel` shows the disabled empty item
- [x] **AC-18.** `NicheSelector.test.tsx`:
  - reads active niche from chatBar slice; shows its name on the chip
  - selecting an item dispatches `setActiveNicheId` (NO `openDrawer` —
    Q1A pure context-setter)
  - chip is hidden / shows empty state when there's no active workspace
- [x] **AC-19.** `WorkspaceSelector.test.tsx` — existing tests pass
  unchanged.
- [x] **AC-20.** Project-wide regression: `npm run test:ci` 0 failures.

## Implementation steps

1. **Audit FCB usage** (`grep`) — locate every import / dispatch /
   selector tied to `expandBar`, `collapseBar`, `barExpanded`,
   `FloatingChatBar`. List of files to be touched lands here before
   deletion.
2. **Extract `<TopbarChipSelector>`** primitive from
   WorkspaceSelector's render layer. Workspace-specific side effects stay
   in the workspace component.
3. **Refactor WorkspaceSelector** to consume the primitive. Run
   `WorkspaceSelector.test.tsx` — must stay green without test edits.
4. **Add NicheSelector**. RTK Query for niches, wire into chatBar slice.
5. **Mount NicheSelector** in `Topbar.tsx` immediately right of
   `<WorkspaceSelector />`.
6. **Delete FloatingChatBar** + AppLayout mount + chatBarSlice
   fields.
7. **Add topbar drawer-open icon** (AC-6 — small ChatBubbleOutline
   IconButton next to the language menu) so users have a non-niche path
   to open the drawer.
8. **i18n keys** (EN + DE).
9. **Tests** for primitive + niche selector + lint + build.
10. **Browser smoke** on localhost via Playwright MCP: switch workspace
    → niches refetch → pick a niche → drawer opens on Chat panel with the
    new niche pinned.

## Files to touch

```
Touch
  components/topbar/Topbar.tsx                                 (+ NicheSelector + drawer-open IconButton)
  components/topbar/WorkspaceSelector.tsx                      (refactor to compose primitive)
  components/AppLayout.tsx                                     (drop FloatingChatBar mount + pattern)
  store/chatBarSlice.ts                                        (drop barExpanded + expand/collapseBar)
  public/locales/en/translation.json                           (3 new keys)
  public/locales/de/translation.json                           (3 new keys)
  docs/features/topbar-niche-selector-and-floating-chat-removal.md (this file → checkbox flips on commit)

Add
  components/topbar/TopbarChipSelector.tsx                     (reusable primitive)
  components/topbar/NicheSelector.tsx
  components/topbar/__tests__/TopbarChipSelector.test.tsx
  components/topbar/__tests__/NicheSelector.test.tsx

Delete
  components/FloatingChatBar/                                  (whole directory)
```

## Non-goals

- Touching the drawer Chat panel itself — chat lives there already, we just
  remove the duplicate entry point.
- Project- / Marketplace-level chip selectors (later, on demand — the
  primitive is ready).
- Mobile drawer behaviour stays as-is.

## Open questions — resolved 2026-05-14

1. **Niche-chip opens drawer?** → Q1A: **No**. Chip is a pure context-setter.
   Drawer opens separately via the new topbar chat-bubble IconButton
   (AC-6). AC-13 updated to reflect this.
2. **Empty-workspace UX?** → Q2A: chip renders, disabled "Keine Nischen"
   item on open. (AC-15.)
3. **FCB removal radicality?** → Q3A: **Hard delete** — component file,
   AppLayout mount, chatBarSlice fields. Rollback = single PR revert.
4. **Active-niche persistence.** `activeNicheId` is already persisted in
   localStorage by chatBarSlice. No change needed.

## Risk + rollback

- Risk: deleting FCB removes shortcut keystrokes that some power users
  might rely on (none documented today; the bar has no global hotkey).
- Risk: niche fetch returns large lists in workspaces with many niches;
  `page_size=100` is the MVP cap. Adding scroll inside the Menu is cheap
  if it bites.
- Rollback: single revert of the PR restores FloatingChatBar. The new
  selectors stay (they don't conflict with FCB).

## Status

- 2026-05-14 — Shipped on `feat/PROJ-29-topbar-niche-selector`. All 20 ACs verified locally (1441 vitest, lint 0 errors, build clean) + Playwright e2e (workspace chip + niche chip side-by-side, niche click sets context only, open-chat icon opens drawer, FCB gone). Awaiting PR review.
  queued.
