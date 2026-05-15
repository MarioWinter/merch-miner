# PROJ-30 — Mobile Design Decisions

> Sister doc to [`features/PROJ-30-app-responsive.md`](../../../features/PROJ-30-app-responsive.md). Locks visual + interaction details for all 8 new mobile primitives before `/frontend` Phase 1 starts.

**Aesthetic direction:** *"Refined industrial in your pocket."* Same deep-ocean dark surface (`background.default`), same coral accent (`primary.main`), same glassmorphism. Mobile **layers in native patterns** (Bottom Sheet, FAB, sticky bottom bar) without introducing a new aesthetic. No purple gradients, no rounded-everything, no inflation of brand surfaces.

**Token policy:** Every color reference is `theme.vars.palette.*` or design-system spacing/radius token. Zero inline hex.

---

## 1. Hamburger Menu (`<400px` Sidebar replacement)

### Placement
- IconButton lives **at the absolute left of the Topbar**, padding-left 8px from viewport edge.
- Sits BEFORE the MerchMiner wordmark (which already shrinks to icon-only at this width).
- Order: `[≡] [MM-icon]` ... centered chip / context-chip ... `[Drawer] [Bell] [Avatar]`.

### Icon
- `MenuIcon` from `@mui/icons-material` — clean three-bar, 24px.
- No custom mark — Hamburger is a globally-known affordance; brand recognition stays on the coral-bordered active item inside the Drawer.

### Touch target
- IconButton size: **44 × 44 px** (mandatory per AC-6).
- Hit area = full square; visual icon stays 24px centered.
- Ripple uses `primary.subtle` overlay.

### Drawer behaviour
- MUI `<Drawer variant="temporary" anchor="left">` with **width = 280px** (slightly wider than desktop 220px because labels need more breathing room on tiny phones).
- Inside the Drawer = the **same Sidebar component**, forced into expanded mode (no 60px mini state).
- Backdrop: `glass-lg` (rgba(7,30,38,0.85) + blur 24px). Tappable to close.
- Slide-in: 240ms `cubic-bezier(0.2, 0.0, 0.0, 1.0)` (matches existing DURATION.default).
- Top of Drawer flush with viewport top — Drawer covers Topbar area too (clear hierarchy: when menu is open, navigation is the foreground).

### Auto-close (EC-5)
- Subscribed to `useLocation()`; on route change → fire `setOpen(false)` with 80ms delay so the user sees the active state flip before slide-out.
- Manual close also via:
  - Backdrop tap
  - Escape key
  - Swipe-left on the Drawer body (MUI `<SwipeableDrawer>` for free)

### A11y
- IconButton `aria-label="Open navigation menu"` (i18n key `responsive.hamburger.openLabel`)
- When open: aria-expanded=true on the button, focus auto-traps inside Drawer
- First Sidebar nav item receives focus on open
- Restore focus to Hamburger button on close

### i18n
```
responsive.hamburger.openLabel    "Open navigation menu"
responsive.hamburger.closeLabel   "Close navigation menu"
```

---

## 2. Mobile Topbar Context Chip (`<600px`)

### What it shows
A single chip replacing Workspace + Niche chips. Chip text:

- **If niche is active:** `{nicheName}` truncated to 14 chars + ellipsis.
- **If niche is unset:** `{workspaceName}` truncated.
- **If no workspace either:** the literal i18n string `responsive.context.empty` (e.g., "Select context").

The reasoning: niche dominates the immediate work-context — workspace is implicit once a niche is chosen. A leading 14×14 icon (`FolderOpenOutlined` when only WS, `LabelImportantOutlined` when niche set) gives instant visual classification.

### Visual
- Reuses `<TopbarChipSelector>` outlined-pill style (`borderRadius: 9999px`, height 32, border `borders.default`).
- Right side has a downward chevron (`KeyboardArrowDownRounded` 16px) — matches existing chips.
- Active state on tap: `primary.subtle` background, no border-color flip (keep border subtle to avoid jitter).

### Bottom Sheet behaviour (tap → opens)
- MUI `<SwipeableDrawer anchor="bottom">` with rounded top corners (`borderRadius: lg` → `borderTopLeftRadius: 12, borderTopRightRadius: 12`, bottom corners flat).
- Height = **dynamic** (fit-content), max 80vh.
- Drag handle: 4×40px pill, `borders.strong`, centered, 8px top margin.
- Background: `background.paper`, no glass — must be opaque to read content over busy pages.
- Backdrop: `glass-md`, tappable to close.

### Sheet content layout (vertical stack, padding 16px)
```
─────────────
  ▬▬▬▬▬     ← drag handle (4 × 40)
─────────────
"Context"               ← h6, weight 600 (i18n: responsive.context.sheetTitle)
─────────────────────────────────────────────
  WORKSPACE                                ← overline weight 600, color text.secondary
  [WorkspaceSelector full-width]
─────────────────────────────────────────────
  NICHE                                    ← overline
  [NicheSelector full-width]
─────────────────────────────────────────────
                   [Close button]          ← TextButton, primary.main
```

### Close affordances (3 ways)
- Drag down on the sheet
- Tap backdrop
- Tap Close button (visible at bottom; users with no swipe-discovery still escape easily)

### Loading state
- Workspace dropdown shows MUI Skeleton (height 40, width 100%) while `useListWorkspacesQuery` fetches.
- Niche dropdown same pattern (Skeleton, not Spinner) — per `feedback_skeleton_over_spinner.md`.

### Empty state
- Workspace dropdown shows the i18n string `responsive.context.noWorkspaces` with a TextButton "Create workspace" → navigates to `/settings/workspaces`.
- Niche dropdown shows `responsive.context.noNiches` + TextButton "Create niche" → navigates to `/niches`.

### A11y
- Chip `aria-haspopup="dialog"`, `aria-expanded` reflects sheet open state
- Sheet has `role="dialog"`, `aria-modal="true"`, `aria-labelledby` → sheet title id
- Focus auto-moves to the WorkspaceSelector on open
- Escape closes the sheet, focus returns to the trigger Chip

### i18n
```
responsive.context.chipFallback   "Set context"
responsive.context.empty          "Select context"
responsive.context.sheetTitle     "Workspace & Niche"
responsive.context.workspaceLabel "Workspace"
responsive.context.nicheLabel     "Niche"
responsive.context.noWorkspaces   "No workspaces yet"
responsive.context.noNiches       "No niches in this workspace"
responsive.context.createWorkspace "Create workspace"
responsive.context.createNiche     "Create niche"
responsive.context.close          "Close"
```

---

## 3. Mobile Editor Tool Sheet (FAB + BottomSheet on `<744px`)

### FAB
- MUI `<Fab>` color `primary`, size `medium` (48 × 48 px).
- Position: **bottom-right**, 16px from right edge, **20px above the iOS home indicator** (uses `env(safe-area-inset-bottom)` + 16px fallback).
- Icon: `TuneRoundedIcon` — "tune" reads as "adjust parameters" which is closer to design-tool semantics than a paintbrush.
- Glow: subtle `primary.glow` shadow (`0 0 24px rgba(255,90,79, 0.30)`) so the FAB lifts from the dark canvas without competing with hue.
- z-index: 1300 (above MUI default drawer 1200 but below modal 1400).

### Bottom Sheet
- MUI `<SwipeableDrawer anchor="bottom">` with two snap points:
  - **Peek** (default open height): **40% viewport** — enough for the most-used tools.
  - **Full** (drag up): **calc(100vh - 56px - safe-area-inset-top)** — leaves the topbar visible for context awareness.
- Snap behaviour: `disableSwipeToOpen={false}`, custom `transitionDuration: 220`.
- Drag handle at top: same 4×40 pill as the Context Sheet.
- Background `background.paper`, top corners `xl` (16px) rounded, bottom corners flat.

### Canvas behaviour when sheet is open
- Canvas **shrinks** to the area above the sheet — NOT a translucent overlay. Designers must be able to see what their edits do in real-time.
- Sheet has a "Preview" toggle in its header that collapses it to the FAB-only state for full-canvas preview.
- When the sheet collapses to FAB, last-used tool state is preserved (zoom level, selected layer).

### Sheet content layout (vertical, padding 12px)
- **Header row** (sticky inside sheet, 48px high):
  - Tab strip: `[Layers] [Tools] [Properties]` — MUI `<Tabs>` variant `fullWidth`
  - Right edge: Preview toggle IconButton (`VisibilityRounded` ↔ `VisibilityOffRounded`)
- **Body** (scrollable inside the sheet):
  - The existing tool-panel content, transplanted from the 280px desktop column.
  - Single column at all widths (no nested grids).
  - 12px gap between tool sections.

### A11y
- FAB `aria-label="Open design tools"`, becomes `"Close design tools"` when sheet open
- Sheet `role="dialog" aria-modal="true"`, focus enters the active tab
- `prefers-reduced-motion`: snap transition disabled (instant), pulse glow off

### i18n
```
responsive.editor.toolFab.openLabel    "Open design tools"
responsive.editor.toolFab.closeLabel   "Close design tools"
responsive.editor.tools.previewToggle  "Toggle preview"
responsive.editor.tools.tabLayers      "Layers"
responsive.editor.tools.tabTools       "Tools"
responsive.editor.tools.tabProperties  "Properties"
```

---

## 4. Mobile Kanban Tabs (`<744px`)

### Tab visual style
- MUI `<Tabs>` variant `scrollable` (horizontal scroll if many columns), indicator color `primary.main` (4px bar bottom).
- Tab style: lowercase column name + count badge in coral pill.
- Active tab text: `text.primary` weight 600.
- Inactive: `text.secondary` weight 500.

### Tab labels
- Format: `{columnName} ({count})` e.g., `Backlog (12)`.
- Count badge is **inline text in parens**, NOT a separate `<Badge>`. Reasoning: avoids the badge "exclamation" semantics; count is informational, not alarming.
- If count is 0: shown as `(0)` in `text.disabled`.

### Sticky tab strip
- Tabs row pinned to top of the view (just below Topbar). Background `background.paper` + 1px bottom border `borders.default`.
- z-index 100 (below Topbar 1200, above scroll content).

### "Move to column" card menu
- Each kanban card retains its existing 3-dot `MoreVertIcon` IconButton at top-right.
- Menu items prepended with:
  - `Move to column ▸` (submenu): list of other columns
  - Then existing options (Edit, Delete, etc.)
- On column tap: card animates fade-out + slide-up, then re-appears in target tab (only visually disappears in current tab; tab badge updates).

### Drag-and-drop within visible column
- Existing dnd-kit `useSortable` stays exactly as on desktop. Vertical drag reorders within column.
- Long-press gesture (300ms) initiates drag — distinguishes from scroll.

### Vertical scroll
- Each tab has its own internal scroll container (`overflowY: auto`, height = `calc(100dvh - 56px - 48px - safe-bottom)` where 48 = tabs height).
- Page-level scroll is locked when a tab is active (prevents double-scroll confusion).

### Loading state
- Tab strip renders eagerly with skeletons in count parens: `Backlog (—)`.
- Tab body shows 3 card skeletons (height 80, full width, gap 8) per skeleton row.

### Empty state
- Empty column: centered illustration-less message:
  - h4 text.secondary `"All clear in {columnName}"` (i18n)
  - body2 hint `"Drag cards here or use the Move-to action"`

### A11y
- Tabs use `role="tablist"`, each tab `role="tab"`, body `role="tabpanel"` (MUI handles automatically)
- Arrow-Left / Arrow-Right cycles tabs
- "Move to column" menu items reachable via Tab key

### i18n
```
responsive.kanban.allClearIn        "All clear in {columnName}"
responsive.kanban.allClearHint      "Drag cards here or use the Move-to action"
responsive.kanban.moveToColumn      "Move to column"
```

---

## 5. Mobile Sticky Bottom Bulk-Action Bars

### Position
- `position: fixed`, `bottom: env(safe-area-inset-bottom) + var(--footer-offset, 0px)` — stacks ABOVE iOS home indicator AND above the global footer (footer-offset CSS var already exposed by AppLayout).
- `left: 0; right: 0`. Full viewport width.
- z-index 1100 (above page content, below Drawer/Dialog).

### Visual
- Height: 56px (matches Topbar — symmetric "bookend" feel).
- Background: `glass-md` (rgba(11,39,49, 0.75) + blur 16px).
- Border-top: 1px solid `borders.default` (extra emphasis since it's the action zone).
- No shadow (dark mode uses borders, per design-system §6).

### Content layout (horizontal flex, padding 0 16px, gap 12)
```
[count badge]    [action icons]                        [primary CTA]
"3 selected"     [Delete] [Move] [Tag] [...overflow]   [Action ▾]
```
- **Count badge:** body1 weight 600 color `primary.main`, e.g., `"3 selected"` (i18n with plural).
- **Action icons:** IconButtons (44×44), `text.secondary` default, `primary.main` on hover/press.
- **Overflow `...`:** if >3 actions, the 4th+ collapse into a `MoreHoriz` IconButton → MUI Menu.
- **Primary CTA (optional):** the most common action (e.g., "Generate Slogans") rendered as a `<Button variant="contained" size="small">`.

### Show/hide animation
- Slide-up from `translateY(100%) → translateY(0)` over 200ms ease-out when selection count goes 0 → ≥1.
- Slide-down (reverse) when selection clears.
- `prefers-reduced-motion`: instant opacity 0→1.

### A11y
- `role="toolbar"`, `aria-label="Bulk actions"`
- Action icons have `aria-label` matching their tooltip
- When the bar appears, it does **not** auto-focus (user is still in the list); but a screen-reader live-region announces `"3 items selected"`.

### i18n
```
responsive.bulkBar.selectedOne      "1 selected"
responsive.bulkBar.selectedMany     "{count} selected"
responsive.bulkBar.toolbarLabel     "Bulk actions"
responsive.bulkBar.overflowLabel    "More actions"
```

---

## 6. Per-Table Card Layout (NicheCardList, ProductCardList, KeywordCardList, MembersCardList, CloudFileCardList)

### Common card pattern (use as a template — each list adapts fields)
```
┌────────────────────────────────────────────────────────────┐
│ [✓]   {title — h5 weight 600, ellipsis 2 lines}    [⋯]    │
│        {primary meta — body2 text.secondary}              │
│        {secondary meta — caption text.hint}               │
│        [chip1] [chip2] [chip3]                             │
│                                          [Action button]   │
└────────────────────────────────────────────────────────────┘
```

### Visual
- Card: `<Paper variant="outlined">`, `borderRadius: lg` (12px), padding 12 16, full width.
- Gap between cards: 8px (`spacing(2)`).
- Border on hover/press: `borders.strong`.
- No shadow (dark mode uses borders).

### Bulk-select checkbox
- Top-left of the card, 24×24 visual area inside a 44×44 hit zone (so the whole "left column" tap-zone selects).
- When selected: card border switches to `primary.main` 1px + background tinted `primary.subtle`.
- Selecting a card does NOT auto-navigate; tapping the title row navigates.

### Touch behaviour
- Tapping the **left checkbox zone (44px wide)** → toggles selection.
- Tapping **anywhere else in the card** → opens detail/edit view (same as the desktop primary-click).
- Long-press anywhere → toggles selection (allows mass-select without aiming for checkbox).
- 3-dot menu (`MoreVertIcon`) top-right → row actions menu (same as desktop).

### Per-list field mapping
| Card list | Title | Primary meta | Secondary meta | Chips |
|---|---|---|---|---|
| NicheCardList | Niche name | `{productCount} products · {ideasCount} ideas` | `Created {date}` | Status badges (Researching / Mining / Ready) |
| ProductCardList | Product title (truncate 2 lines) | `BSR {bsr} · ${price} · {reviewCount} reviews` | ASIN (mono font) | Trend chip if available |
| KeywordCardList | Keyword | `Vol {volume} · CPC ${cpc}` | `Comp {competition}` | Source chip (JS / Vane) |
| MembersCardList | User display name | `{email}` | `Role · joined {date}` | Role chip (Owner / Admin / Member) |
| CloudFileCardList | File name | `{size} · {type}` | `Modified {date}` | Cloud source chip (Drive / OneDrive) |

### Loading state
- 5 Skeleton cards (height 96, full width, gap 8). Skeleton variant `rounded`, animation `wave`.

### Empty state
- Centered Stack, 48px top padding:
  - 40×40 icon `InboxOutlinedRounded` color `text.disabled`
  - h6 text.secondary: per-list message (i18n)
  - body2 text.hint: optional CTA line ("Try adjusting filters" / "Create your first niche")
  - Optional Button "Add new {entity}" → primary action

### Error state
- Centered:
  - 40×40 icon `ErrorOutlineRounded` color `error.main`
  - h6 text.primary: "Couldn't load {entity}"
  - body2 text.secondary: error.detail
  - TextButton "Try again" → triggers refetch

### A11y
- Card is `<article role="listitem">`
- Checkbox has `aria-label` "Select {title}" (i18n templated)
- 3-dot menu IconButton `aria-label` "Actions for {title}"

### i18n
```
responsive.cardList.empty.title.{niche|product|keyword|member|file}    "..."
responsive.cardList.empty.hint.{niche|product|keyword|member|file}     "..."
responsive.cardList.errorTitle                                          "Couldn't load {entity}"
responsive.cardList.tryAgain                                            "Try again"
responsive.cardList.selectAria                                          "Select {title}"
responsive.cardList.actionsAria                                         "Actions for {title}"
```

---

## 7. MultiPurposeDrawer Mobile Behaviour

### Geometry per breakpoint
| Width | Drawer behaviour |
|---|---|
| `≥900px` | Existing: user-resized width, variant `persistent`, sideBySide/overlap toggle visible |
| `600–899px` | variant `temporary`, width **80vw**, slide from right, backdrop tappable to close |
| `<600px` | variant `temporary`, width **100vw**, slide from right, **top: 0** (covers Topbar — drawer becomes the foreground) |

### Why cover Topbar on `<600px` (not `top: 56px`)
- On a 375px viewport with the keyboard up, every pixel of vertical space matters for the chat input.
- Drawer covering the Topbar makes the drawer a true full-screen overlay, with its own close affordance.
- Topbar context is irrelevant inside the drawer (user is in a chat, not navigating routes).

### Close affordances (mobile)
- Drawer has its own **header bar** (`SegmentedHeaderBar`) which already exists — extend it with a close button when `<600px` (X icon, 44×44, top-right).
- Swipe-right gesture on drawer body (MUI SwipeableDrawer free).
- Backdrop tap (any visible area outside the drawer).
- Browser back button: intercepted, closes drawer instead of route-pop (history-API trick).

### Resize handle
- Hidden entirely on `<900px` (already partially handled — extend to also hide on `<sm`).
- DrawerLayoutToggle (sideBySide/overlap) **hidden** on `<900px` — sideBySide makes no sense when the drawer takes 80–100% width.

### Existing AppLayout `isMobile = useMediaQuery(theme.breakpoints.down('sm'))` already disables sideBySide — keep that, just confirm.

### A11y
- Drawer has `role="dialog" aria-modal="true"`
- Focus auto-moves to drawer header on open
- Escape closes the drawer

### i18n
```
responsive.drawer.closeLabel  "Close drawer"
```

---

## 8. Mobile Dialog Defaults (covers 44 existing `<Dialog>` usages)

### Theme-level default
MUI `<Dialog>` gets a global default override in `theme.components.MuiDialog`:
```text
fullScreen on theme.breakpoints.down('sm') == true (default)
```
This means: **without changing any existing Dialog usage code**, all 44 Dialogs become fullscreen on phones automatically.

### Mobile Dialog appearance
- Background: `background.default` (NOT paper — fullscreen should match page canvas).
- Top: 56px AppBar inside the Dialog containing:
  - X close IconButton (left, 44×44)
  - Dialog title (h5 weight 600)
  - Optional primary action button (right) — e.g., "Save" for editor dialogs
- Body: standard MUI DialogContent, padding 16, scrollable.
- Footer: standard DialogActions sticky at bottom with `safe-area-inset-bottom` respected.

### Opt-out: `<ResponsiveDialog disableMobileFullScreen>` 
For the ~3 small confirmation dialogs identified in T0.5 (e.g., UserProfileEditor reset, PipelineConfirmDialogs archive), the wrapper accepts a prop to keep the centered-modal appearance even on mobile. These dialogs:
- Stay centered, max-width 320px
- Tappable backdrop to dismiss (the only "destructive" action is a button anyway)

### Migration policy
- **Do NOT preemptively migrate** all 44 `<Dialog>` calls to `<ResponsiveDialog>`. The theme default handles them.
- Only wrap dialogs that need the `disableMobileFullScreen` opt-out (the ~3 small confirms).
- Future new dialogs: prefer `<ResponsiveDialog>` over raw `<Dialog>` for consistency.

### A11y
- Mobile-fullscreen dialogs trap focus and restore on close (MUI default)
- Visible X close button at 44×44 (not just escape key)
- Title element has `id` and is referenced by `aria-labelledby`

### i18n
```
responsive.dialog.closeLabel    "Close dialog"
```

---

## Aesthetic Cohesion Notes

- All 8 primitives reuse:
  - `borderRadius: lg / xl` for surfaces (cards, sheets, drawers)
  - `glass-md` for the **chrome that floats over content** (sticky bars, bottom sheets headers)
  - `background.paper` for the **content body of sheets**
  - `primary.main` ONLY for indicator/active states (tab underline, active selection border, primary CTAs) — never as a background color
  - `borders.default` / `borders.strong` for separation in dark mode (no drop shadows)
- Motion durations consistently use `DURATION.default` (240ms) and `EASING.standard` from `style/constants.ts`
- `prefers-reduced-motion` honored across all primitives (slide → fade)
- Typography stays on the existing scale; no new sizes introduced
- Touch targets ≥44×44 for all interactive elements on `<900px`

---

## Open Questions for User (A/B/C)

### Q-D1: Context Chip label format on `<600px`

When BOTH workspace + niche are set, what does the single chip show?

| Option | Label | Pro | Con |
|---|---|---|---|
| **A** (recommended) | `{nicheName}` (truncate 14ch) | Niche dominates work-context; shortest cognitive load | Workspace identity hidden until sheet opens |
| **B** | `{workspaceShort}/{nicheName}` truncate joint to 18ch | Both surfaces visible | Forced abbreviation, harder to read |
| **C** | Icon-only chip (`LabelIcon` + chevron) | Maximum space saved | Loses all textual cue — user can't see active niche at a glance |

### Q-D2: FAB icon for Mobile Editor Tool Sheet

| Option | Icon | Reasoning |
|---|---|---|
| **A** (recommended) | `TuneRoundedIcon` | "Adjust parameters" reads as design controls |
| **B** | `BrushRoundedIcon` | Most literal "design" affordance |
| **C** | `EditRoundedIcon` | Generic, but immediately understood |

### Q-D3: Kanban tab count badge style

| Option | Style | Pro | Con |
|---|---|---|---|
| **A** (recommended) | Inline parens `Backlog (12)` | Calm, informational | Less visually punchy |
| **B** | Coral pill badge next to label | Visually scannable | Implies "needs attention" semantics |
| **C** | No count, just column name | Cleanest visual | Forces tab-switch to see counts |

### Q-D4: Drawer covering Topbar on `<600px`

| Option | Behaviour | Pro | Con |
|---|---|---|---|
| **A** (recommended) | Drawer covers Topbar (top:0) | Max vertical space for chat input + keyboard | Loses route context |
| **B** | Drawer below Topbar (top:56px) | Topbar always visible for navigation | 56px less for chat content; awkward with keyboard up |
| **C** | Drawer below Topbar BUT Topbar shrinks to 40px when drawer is open | Compromise visual | Adds animation complexity, edge cases |

---

## Handoff to `/frontend`

When user has answered Q-D1..Q-D4, the design is fully locked. `/frontend` Phase 1 can start theme + primitive implementation without further design clarification.
