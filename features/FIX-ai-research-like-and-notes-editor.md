# FIX: AI Research Like + Niche Pipeline Notes Editor

## Status: Planned
**Created:** 2026-05-27
**Last Updated:** 2026-05-27
**Type:** Combined Mini-Fix (two small frontend-only features, one PR)
**Branch:** `fix/ai-research-like-and-notes-editor`

## Dependencies
- PROJ-5 (Niche List) — Deployed
- PROJ-7 (Amazon Product Research) — In Progress; uses `CollectedProduct` model

## Scope Summary
Two independent, frontend-only enhancements bundled in a single PR. No backend changes, no new models, no new endpoints.

- **Feature A** — Heart-toggle on AI Research product cards to add/remove products from the active niche's existing `CollectedProduct` collection.
- **Feature B** — Markdown editor (Edit/Preview, auto-grow + manual resize, list/checklist keyboard shortcuts) for the niche notes field.

---

## Feature A: AI Research Heart-Toggle

### User Stories
- As a POD seller browsing AI Research results, I want to click a heart icon on a product card to add it to my active niche's product collection without leaving the view.
- As a POD seller, I want clicked products to show as "liked" so I see at a glance which products are already in my collection.
- As a POD seller, I want to click the filled heart again to remove a product from the collection (undo a mistake).

### Acceptance Criteria
- [ ] AC-A1: Every `ProductAnalysisCard` in the AI Research view renders a heart icon button (top-right corner of the card).
- [ ] AC-A2: When the product's `(asin, marketplace)` exists in the active niche's `CollectedProduct` set (read via `useGetCollectedProductsQuery`), the icon is filled (`FavoriteIcon`); otherwise outlined (`FavoriteBorderIcon`).
- [ ] AC-A3: Clicking an outlined heart calls `useAddCollectedProductMutation` with `{ nicheId, asin, marketplace }`; on success the icon becomes filled.
- [ ] AC-A4: Clicking a filled heart calls `useRemoveCollectedProductMutation`; on success the icon becomes outlined.
- [ ] AC-A5: Mutations apply optimistic UI updates — icon state flips immediately, rolls back on error.
- [ ] AC-A6: On mutation error, a notistack toast displays an error message (i18n key) and the icon reverts to the previous state.
- [ ] AC-A7: Color tokens come from the theme (`theme.vars.palette.error.main` for filled heart, `theme.vars.palette.action.active` for outline) — no hardcoded hex.
- [ ] AC-A8: Heart button has an `aria-label` ("Add to niche collection" / "Remove from niche collection", i18n keys).
- [ ] AC-A9: All user-visible strings (aria-labels, tooltips, toast messages) go through `useTranslation()`.

### Edge Cases
- [ ] EC-A1: No active niche selected → heart button is disabled with tooltip "Select a niche first" (i18n key).
- [ ] EC-A2: Rapid double-click on heart → second click ignored while the first mutation is pending (button shows `loading` state).
- [ ] EC-A3: Network failure → optimistic update rolls back, error toast shown, no orphan state in cache.
- [ ] EC-A4: User opens AI Research while another user adds the same product to the niche in parallel → next `useGetCollectedProductsQuery` refetch reconciles state correctly (RTK Query cache invalidation on mutation success).
- [ ] EC-A5: Workspace switch mid-session → heart state recomputes against the new workspace's active niche (RTK Query tag invalidation handles this; verify in QA).
- [ ] EC-A6: Product card lacks an ASIN or marketplace (malformed scraper result) → heart button is hidden (not disabled), since the request would fail validation.

### Out of Scope (Feature A)
- New "Liked" stage separate from `CollectedProduct` (rejected during requirements — heart toggles existing collection directly).
- Bulk-like / multi-select on AI Research cards.
- Like-count display, like-history, or "recently liked" view.
- Backend changes — `CollectedProduct` model, serializers, and viewset stay untouched.

---

## Feature B: Niche Notes Markdown Editor

### User Stories
- As a POD seller, I want to write longer niche notes than three lines without the textarea cutting off, so I can capture detailed research observations.
- As a POD seller, I want to type `/` to open a Notion-style command menu that transforms the current line into a list, checklist, heading, or quote, because that pattern is what I'm already used to from Notion and other modern editors.
- As a POD seller, I want to switch to a preview mode that renders my notes as formatted markdown, so I can read them as a structured document.
- As a POD seller in preview mode, I want to tick off checklist items by clicking them directly, so I can track progress without switching back to edit.

### Acceptance Criteria
- [ ] AC-B1: The notes field in `PipelineEditForm.tsx` is replaced by a `NotesMarkdownEditor` component (location: `frontend-ui/src/components/NotesMarkdownEditor/` or feature-local under `views/niches/list/partials/` — to be decided by `/architecture` based on reuse potential).
- [ ] AC-B2: The component has two modes toggled via a small control (Tabs or ToggleButtonGroup — chosen by `/architecture`/`/frontend-design`): **Edit** (default) and **Preview**.
- [ ] AC-B3: Edit mode renders a MUI `TextField` with `multiline`, `minRows={3}`, `maxRows={20}` so it auto-grows with content up to ~20 rows, then scrolls.
- [ ] AC-B4: The textarea slot has CSS `resize: vertical` so the user can manually drag the bottom-right handle to override auto-grow height. Width remains fixed.
- [ ] AC-B5: Typing `/` in Edit mode at the **start of a line** OR **immediately after whitespace** opens a floating command menu (Notion-style) anchored near the caret. The `/` character is visible in the textarea while the menu is open.
- [ ] AC-B6: Command menu contains exactly these 15 commands (MUST). Each entry shows label + small icon + optional short description (Notion-style). The "Behaviour" column defines how the command modifies the textarea content:

  | # | Command | Inserts | Behaviour |
  |---|---|---|---|
  | 1 | Bulleted list | `- ` | Line-prefix |
  | 2 | To-do list | `- [ ] ` | Line-prefix |
  | 3 | Numbered list | `1. ` | Line-prefix |
  | 4 | Heading 1 | `# ` | Line-prefix |
  | 5 | Heading 2 | `## ` | Line-prefix |
  | 6 | Heading 3 | `### ` | Line-prefix |
  | 7 | Quote | `> ` | Line-prefix |
  | 8 | Callout: Note | `> [!NOTE]\n> ` | Block (multi-line) |
  | 9 | Callout: Tip | `> [!TIP]\n> ` | Block (multi-line) |
  | 10 | Callout: Warning | `> [!WARNING]\n> ` | Block (multi-line) |
  | 11 | Callout: Important | `> [!IMPORTANT]\n> ` | Block (multi-line) |
  | 12 | Code block | ` ```\n\n``` ` | Block (caret on empty middle line) |
  | 13 | Divider | `---\n` | Block (single line) |
  | 14 | Bold | `****` | Inline wrapper (caret between `**…**`) |
  | 15 | Link | `[text](url)` | Inline template (selection on `url` for fast paste) |

  Insertion-behaviour definitions:
  - **Line-prefix:** the `/` + filter chars are removed; the prefix string is prepended to the start of the current line; existing line content is preserved after the prefix; caret lands at the end of the prefix.
  - **Block (multi-line / single-line / code):** the `/` + filter chars are removed; the block is inserted at the caret position; if the current line has content before the caret, a leading newline is added so the block starts on a fresh line; caret lands at the documented position (inside the callout body / on the empty middle line for code / at start of next line for divider).
  - **Inline:** the `/` + filter chars are removed; the wrapper/template is inserted at the caret position; caret/selection positioned as documented.
- [ ] AC-B7: Continuing to type after `/` filters the menu by case-insensitive substring match on the command labels (e.g. `/bu` → "Bulleted list"; `/to` → "To-do list").
- [ ] AC-B8: Keyboard navigation in the open menu: `ArrowDown` / `ArrowUp` moves selection, `Enter` or `Tab` confirms, `Esc` closes. Mouse: click on a row also confirms.
- [ ] AC-B9: Confirming a command removes the `/` + filter chars typed since `/` was pressed and inserts the chosen prefix at the start of the current line (preserving any content already on the line after the prefix). Caret lands at the end of the inserted prefix.
- [ ] AC-B10: `Esc` or clicking outside the menu closes it; the `/` and any filter chars stay in the textarea as plain text (no destructive auto-revert).
- [ ] AC-B11: Pressing `Enter` while the cursor is on a non-empty list line (line starts with `- `, `- [ ] `, or `N. `) inserts a new line with the same prefix (continuation pattern).
- [ ] AC-B12: Pressing `Enter` on a list line containing only the prefix (e.g. just `- ` or `- [ ] `) removes the prefix and inserts a plain newline (escape pattern).
- [ ] AC-B13: Preview mode renders the markdown via `react-markdown` + `remark-gfm` (already in dependencies) — same pattern as existing `MarkdownAnswer`/`MemoryEditor`/`SkillEditor` components. Reuse, do not reimplement.
- [ ] AC-B14: GFM checkboxes in Preview mode are interactive: clicking `[ ]` toggles to `[x]` (and vice versa); the change updates the form value via `onChange` so the form becomes dirty and can be saved with the existing form Save button.
- [ ] AC-B15: Stored value remains plain-text markdown in `Niche.notes` — no schema change, no serializer change.
- [ ] AC-B16: Editor honours `react-hook-form` `Controller` integration so existing form validation, dirty state, and Save behaviour continue to work unchanged.
- [ ] AC-B17: All user-visible strings (mode labels, command labels + descriptions, aria-labels, placeholder, tooltips) go through `useTranslation()`.
- [ ] AC-B18: Colors come from the theme (`theme.vars.palette.*`) — no hardcoded hex.
- [ ] AC-B19: Slash-menu interception and Enter-continuation are scoped to the notes editor only (event listeners bound to the textarea element) — they do not fire when focus is elsewhere on the page.

### Edge Cases
- [ ] EC-B1: Notes field empty → Preview mode shows a muted placeholder ("No notes yet", i18n key) instead of empty space.
- [ ] EC-B2: Notes contain only whitespace → treated as empty in preview (same placeholder).
- [ ] EC-B3: User toggles to Preview, clicks a checkbox, toggles back to Edit → the new `[x]`/`[ ]` is visible in the textarea at the correct position.
- [ ] EC-B4: User types `- ` then presses Enter twice (empty list line) → prefix removed on second Enter, plain newline inserted (per AC-B12).
- [ ] EC-B5: User types `/` in the middle of a word (e.g. "and/or") → menu does NOT open; `/` is treated as plain text. Trigger only when `/` is preceded by start-of-line or whitespace.
- [ ] EC-B6: Slash menu is open + user keeps typing characters that match no command (e.g. `/zzz`) → menu shows an empty state ("No matching commands", i18n key). `Esc` closes it without altering text.
- [ ] EC-B7: Slash menu is open + user types whitespace (space/tab) → menu closes, `/` + filter chars stay as plain text (whitespace ends the filter context).
- [ ] EC-B8: Caret is near the bottom edge of the textarea → command menu opens **above** the caret to stay in viewport (auto-flip via Popper placement).
- [ ] EC-B9: Caret is near the right edge of the textarea → menu shifts left to stay in viewport.
- [ ] EC-B10: Slash menu confirms via `Enter` → `Enter`'s default new-line behaviour is prevented; only the prefix insertion fires.
- [ ] EC-B11: User pastes multi-line text containing `/` characters → no menu opens during paste (only on a single keystroke that produces `/`).
- [ ] EC-B12: Block command (Callout / Code block / Divider) confirmed while caret is mid-line with content on either side → a leading newline is inserted so the block starts on a fresh line; content after the caret remains on the line after the block.
- [ ] EC-B13: Line-prefix command confirmed while current line already has a different prefix (e.g. line is `- existing`, user runs Heading 1) → existing prefix is replaced with the new prefix (line becomes `# existing`); content preserved.
- [ ] EC-B14: Inline Link command confirmed → `url` placeholder is selected (not just cursor placed), so the user can immediately paste a URL to replace it.
- [ ] EC-B15: Notes field exceeds `maxRows={20}` → textarea scrolls internally instead of growing further. Manual resize handle still works.
- [ ] EC-B16: User manually drags the resize handle smaller than `minRows={3}` → browser enforces `min-height` derived from `minRows`; cannot go below 3 visible rows.
- [ ] EC-B17: Switching between Edit/Preview while form has unsaved changes → mode toggle does NOT save; form dirty state preserved.
- [ ] EC-B18: User pastes multi-line text with checkboxes/lists/callouts → preview renders them correctly via remark-gfm + remark-github-blockquote-alert; no special handling on edit side.
- [ ] EC-B19: User toggles to Preview with a callout that uses an unsupported alert type (e.g. `> [!CUSTOM]`) → renderer falls back to plain blockquote (no crash, no console error).

### Out of Scope (Feature B)
- WYSIWYG editing (inline bold/italic styling visible in Edit mode). Markdown stays as plain-text source.
- Embeds / images / files / mentions / database blocks — i.e. anything beyond plain-text-markdown.
- Italic, strikethrough, inline code, tables, nested lists / sub-tasks via slash menu (only the 15 commands in AC-B6 are in scope).
- Custom / user-configurable callout types beyond the 4 GitHub-Alert types (Note / Tip / Warning / Important).
- URL prompt dialog for the Link command (template insertion only).
- Format toolbar with buttons (rejected during requirements — slash menu only).
- Configurable / user-customisable slash command list.
- Auto-save on checkbox click in preview (form-dirty + existing Save flow only).
- Backend changes — `Niche.notes` field, serializer, validation all stay untouched.

---

## Technical Requirements (cross-feature)
- **Reuse first:** Confirm `CollectedProduct` mutations (`useAddCollectedProductMutation` / `useRemoveCollectedProductMutation` / `useGetCollectedProductsQuery`) are used as-is for Feature A. Confirm `react-markdown` + `remark-gfm` reused for Feature B (extract shared `<MarkdownRenderer />` component if not already present — `/architecture` decision).
- **New dependency:** Add `remark-github-blockquote-alert` (or equivalent maintained plugin) to `frontend-ui/package.json` to render GitHub-style callouts (`> [!NOTE]` / `> [!TIP]` / `> [!WARNING]` / `> [!IMPORTANT]`) in Preview mode. `/architecture` selects the exact package after a quick maintenance/size check.
- **MUI v7:** all icons from `@mui/icons-material` (e.g. `FavoriteIcon`, `FavoriteBorderIcon`, `FormatListBulletedIcon`, `CheckBoxOutlinedIcon`, `FormatQuoteIcon`, `InfoOutlinedIcon`, `LightbulbOutlinedIcon`, `WarningAmberOutlinedIcon`, `PriorityHighIcon`, `HorizontalRuleIcon`, `CodeIcon`, `FormatBoldIcon`, `LinkIcon`); all components from `@mui/material`. No deprecated APIs.
- **Slash menu component:** prefer a single floating MUI `Popper` (or `Menu`) anchored to the caret position. Caret coordinates may need a mirror-div helper or a small library (e.g. `textarea-caret`) — `/architecture` decides. Reuse the existing `useCommandTrigger` pattern from `ChatInputBar` if compatible.
- **Styling:** `styled()` for reusable styles, `sx` only for small overrides (per `.claude/rules/frontend.md`). No hardcoded colors. Callout colors per alert type derive from `theme.vars.palette.info/success/warning/error.*`.
- **Performance:** No measurable regression on Niche-Pipeline edit form open time (< 100ms additional render budget for the markdown editor).
- **i18n:** All new strings added to `frontend-ui/src/i18n/locales/{en,de}.json` (slash command labels and descriptions, callout titles, mode toggle labels, empty/placeholder states, error toasts).
- **Tests:** Vitest + RTL unit tests for the heart-toggle behaviour, slash-menu open/filter/select flow, Enter-continuation, preview rendering of each callout type, and checkbox click in preview. `npm run test:ci` must pass with zero failures.
- **Browser support:** Chrome, Firefox, Safari (latest 2 versions). Slash-menu trigger verified on all three (different IME / keyboard layouts not in scope).

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Spec Reconciliation
Two clarifications discovered while reading the codebase. Both refine the spec without changing user-visible behaviour:

| # | Spec says | Reality | Resolution |
|---|---|---|---|
| 1 | `useAddCollectedProductMutation` (AC-A3) | The hook is named `useCollectProductMutation` in `store/collectedProductsSlice.ts` | Use the real name throughout. AC-A3 / A4 remain satisfied (same endpoint, same body). |
| 2 | `useGetCollectedProductsQuery` returns ASIN-matchable shape | Returns `CollectedProduct[]` where each item has `product.asin` (nested under `product`) | Match condition is `item.product.asin === card.asin && item.product.marketplace === card.marketplace`. |

A third item is pending verification: `marketplace` field on `ResearchProduct`. If it is absent, the parent view must pass it as a prop alongside `nicheId` — flagged in Phase 2 tasks.

### Decision 1 — Notes-Editor Location: GLOBAL
Build at `frontend-ui/src/components/NotesMarkdownEditor/`.

| Decision | Why |
|---|---|
| Global `components/`, not feature-local | Notes are a common pattern (Ideas, Listings, Briefs) — likely reuse target |
| Aligns with `feedback_component_reuse_first.md` | Promote on first build, not later |
| Component is generic | No niche-domain logic inside; consumes a `value`/`onChange` pair |

### Decision 2 — Edit/Preview Toggle: MUI Tabs
Pick: **MUI `Tabs` with two `Tab` entries (`Edit` / `Preview`)**.

| Decision | Why |
|---|---|
| MUI Tabs (not ToggleButtonGroup) | `SkillEditor.tsx:142` already uses Tabs for the exact same Edit/Preview semantics — established codebase pattern |
| Tabs convey "view mode" intent | ToggleButtonGroup reads as an option picker, not a viewport switch |
| `Edit` is the default tab | New niches typically open with empty notes; users start in Edit |

### Decision 3 — Markdown Renderer: NEW co-located `NotesMarkdownRenderer`
Build a new renderer inside `components/NotesMarkdownEditor/partials/NotesMarkdownRenderer.tsx`. Do **not** extend `MarkdownAnswer`.

| Decision | Why |
|---|---|
| New, co-located renderer | `MarkdownAnswer` is PROJ-20-specific (citation post-processing, `CodeBlock` with copy-button, source-card lookups). Forking is cleaner than gating with feature flags. |
| Needs `remark-github-blockquote-alert` | Required for callouts (AC-B6 #8-11) — `MarkdownAnswer` has no use for this plugin |
| Needs interactive GFM checkboxes | `MarkdownAnswer` is read-only; clicking a `[ ]` must toggle to `[x]` and call `onChange` |
| Re-uses styling philosophy | Borrow the `Root` styled wrapper pattern from `MarkdownAnswer` (callout colors, blockquote borders, etc.) — code copy, not import |

### Decision 4 — Slash-Menu Architecture

#### State Machine
Same five-state shape as `useCommandTrigger`:

| State | Entry trigger | Exit transitions |
|---|---|---|
| **Idle** | Initial / after Cancelled | `/` keystroke at start-of-line or after whitespace → Open |
| **Open** | `/` accepted | typing → Filtering · ArrowUp/Down → Open (active row update) · Enter/Tab → Confirming · Esc/Space/Tab-out → Cancelled |
| **Filtering** | Any non-Enter/Esc/Arrow keystroke that changes the query | Same exits as Open |
| **Confirming** | Enter/Tab/click on a row | Strip `/query` text → insert prefix/block/wrapper → reset to Idle |
| **Cancelled** | Esc / blur / Space / Backspace past `/` | Leaves `/query` as plain text → reset to Idle |

#### Hook: `useTextareaSlashMenu`
- Location: `components/NotesMarkdownEditor/hooks/useTextareaSlashMenu.ts`
- Pattern mirrors `useCommandTrigger` (state-machine API, `paletteProps` return) **but adapts for `<textarea>`**:
  - `selectionStart` / `selectionEnd` instead of DOM `Selection` ranges
  - Caret coordinates via the `textarea-caret` npm package (not the contenteditable `getCursorRect` helper)
  - No chip / `data-niche-chip` handling
  - Trigger guard: `text[selectionStart - 1] === undefined || /\s/.test(text[selectionStart - 1])` for the "start-of-line or after whitespace" rule
- Cannot directly import `useCommandTrigger` — the differences run too deep — but copy the state-machine shape verbatim for consistency.

#### Caret Coordinates
| Pick | Why |
|---|---|
| `textarea-caret` (npm) | ~3 KB, mature (~5M weekly downloads), TypeScript types in `@types/textarea-caret` |
| Skip mirror-div hand-roll | Saves ~80 LOC of fiddly DOM helper code; the library handles RTL, font-metrics, scroll offset, line-wrap quirks |
| Bundle impact acceptable | We already ship `react-markdown` (~80 KB); +3 KB is negligible |

#### MUI Primitive: Popper
| Pick | Why |
|---|---|
| `Popper` from `@mui/material` | Doesn't steal focus; flexible anchor via `anchorEl` rect or virtual element |
| Not `Menu` | Steals focus (we need focus to stay in the textarea so typing continues to filter) |
| Not `Autocomplete` listbox | Owns the textarea — we'd lose `react-hook-form` `Controller` integration |
| Flip behaviour | Use `modifiers={[{ name: 'flip' }, { name: 'preventOverflow' }]}` for EC-B8 / EC-B9 |
| Virtual anchor | Built with `{ getBoundingClientRect: () => caretRect }` so the Popper tracks the caret, not the textarea |

### Decision 5 — Heart-Toggle Component

#### Component
- Name: `<NicheCollectionHeartButton />`
- Location: `frontend-ui/src/components/NicheCollectionHeartButton/`
- Rationale for global location: also reusable from `views/amazon/research/` (Amazon Product Research) and any future product card; the "like into active niche collection" action is a domain primitive, not a research-specific one.

#### Props

| Prop | Type | Notes |
|---|---|---|
| `nicheId` | `string \| null` | `null` → button disabled with tooltip "Select a niche first" (EC-A1) |
| `asin` | `string` | If empty/missing → button hidden (EC-A6) |
| `marketplace` | `string` | If empty/missing → button hidden (EC-A6) |
| `size` | `'small' \| 'medium'` (default `'small'`) | Visual sizing |
| `sx` | `SxProps` (optional) | Positioning override from parent |

#### Active-niche Source
`ProductAnalysisCard.tsx:42` already accepts `nicheId: string` as a prop — pass it straight through to the heart button. The AI Research view (`views/niches/research/index.tsx`) is the niche-aware caller and already passes `nicheId` to each card for slogan-click logic. No new state lookup required.

#### Marketplace Source
`marketplace` is **not** confirmed on `ResearchProduct`. Phase 2 has a verification task. If absent, the contract becomes: parent provides `marketplace` as a prop (current niche's `marketplace_country`, available from `Niche` model).

#### Optimistic Update Strategy
The existing `collectProduct` and `removeCollectedProduct` mutations in `store/collectedProductsSlice.ts` use only `invalidatesTags` — they refetch but do not patch the cache in-flight.

To satisfy AC-A5 (icon flips immediately, rolls back on error), add `onQueryStarted` to both mutations:

| Mutation | Optimistic patch |
|---|---|
| `collectProduct` | `dispatch(updateQueryData('getCollectedProducts', nicheId, (draft) => draft.results.unshift({ id: 'optimistic-…', product: { asin, marketplace, … } as AmazonProduct, … })))` — undo on error |
| `removeCollectedProduct` | `dispatch(updateQueryData('getCollectedProducts', nicheId, (draft) => draft.results = draft.results.filter((c) => c.id !== collectedProductId)))` — undo on error |

The patches modify the slice file but do **not** touch backend code or model shape — pure frontend cache wiring. Allowed by spec.

### Decision 6 — GitHub-Alerts Plugin: `remark-github-blockquote-alert`

| Criterion | `remark-github-blockquote-alert` | `remark-directive` (alt) |
|---|---|---|
| Weekly downloads | ~50K+ | ~500K but requires more setup |
| Bundle size | ~3 KB | ~12 KB |
| TypeScript types | Included | Yes |
| Last release | < 6 months | < 3 months |
| Unsupported types | Falls back to plain blockquote (EC-B19 satisfied out of the box) | Must hand-roll fallback |
| Setup | Single plugin add | Plugin + custom directive parser |

**Pick: `remark-github-blockquote-alert`**. Native fallback for unsupported alert types is the deciding factor (EC-B19 wins for free).

Companion CSS: the plugin renders `<div class="markdown-alert markdown-alert-note">` etc. Style each variant in the `NotesMarkdownRenderer` `Root` wrapper using theme tokens:
- Note → `theme.vars.palette.info.*`
- Tip → `theme.vars.palette.success.*`
- Warning → `theme.vars.palette.warning.*`
- Important → `theme.vars.palette.error.*`

No `rehype-raw` needed — sanitisation by `react-markdown` defaults is sufficient. Plugin emits safe HTML structure.

### Decision 7 — Line-Prefix Detection & Replacement (EC-B13)

Existing-prefix detector regex (matches the start of the current line):

```
^(#{1,6}\s|\-\s\[[ x]\]\s|\-\s|\d+\.\s|>\s)
```

Matches:
- `# ` to `###### ` (headings)
- `- [ ] ` and `- [x] ` (to-do)
- `- ` (bulleted list)
- `N. ` (numbered list)
- `> ` (quote, also matches Callout body lines — acceptable: replacing inside a callout body is a deliberate user action)

Algorithm for **line-prefix commands**:
1. Compute current line's start offset (`text.lastIndexOf('\n', selectionStart - 1) + 1`).
2. Apply the detector regex to the substring from line-start onward.
3. If matched → replace the matched span with the new prefix.
4. If no match → insert the new prefix at line-start.
5. Caret lands at line-start + new-prefix length.

### Data Flow Diagram (text)

```
ProductAnalysisCard
  ├─ existing chips + slogans (unchanged)
  └─ <NicheCollectionHeartButton nicheId asin marketplace />
       ├─ reads useGetCollectedProductsQuery(nicheId)   -> derives "isLiked"
       ├─ on click -> useCollectProductMutation or useRemoveCollectedProductMutation
       └─ optimistic patch in slice; rollback on error

PipelineEditForm
  └─ Controller name="notes"
       └─ <NotesMarkdownEditor value onChange />
            ├─ Tabs: Edit / Preview
            │
            ├─ Edit:  <TextField multiline minRows={3} maxRows={20} sx={{ resize: 'vertical' }} />
            │         ├─ useTextareaSlashMenu(ref, commandRegistry)
            │         │     └─ <SlashCommandMenu /> (Popper, anchored to caret rect)
            │         └─ useListContinuation(ref)  // Enter-prefix-continuation handler
            │
            └─ Preview: <NotesMarkdownRenderer value onChange />
                       ├─ react-markdown + remark-gfm + remark-github-blockquote-alert
                       ├─ rehype-sanitize
                       └─ input[type=checkbox] click handler -> patches markdown source -> onChange
```

### Component / Folder Structure

```
frontend-ui/src/components/
  ├── NicheCollectionHeartButton/
  │   ├── index.tsx                          # main component + styled wrappers
  │   ├── hooks/
  │   │   └── useIsProductLiked.ts           # query + match helper
  │   └── tests/
  │       └── NicheCollectionHeartButton.test.tsx
  └── NotesMarkdownEditor/
      ├── index.tsx                          # Tabs shell + Controller-friendly value/onChange
      ├── hooks/
      │   ├── useTextareaSlashMenu.ts        # slash-menu state machine
      │   └── useListContinuation.ts         # Enter-continues prefix logic
      ├── partials/
      │   ├── EditTextarea.tsx               # TextField with slash + continuation wired in
      │   ├── SlashCommandMenu.tsx           # Popper UI for the 15 commands
      │   └── NotesMarkdownRenderer.tsx      # react-markdown wrapper with callouts + checkbox toggle
      ├── utils/
      │   ├── commandRegistry.ts             # the 15 commands + filter logic
      │   ├── insertionStrategies.ts         # line-prefix / block / inline insertion algorithms
      │   └── linePrefixRegex.ts             # shared regex helpers (EC-B13)
      └── tests/
          ├── NotesMarkdownEditor.test.tsx
          ├── useTextareaSlashMenu.test.ts
          ├── insertionStrategies.test.ts
          └── NotesMarkdownRenderer.test.tsx
```

### Dependencies (packages to install)
| Package | Purpose | Approx size |
|---|---|---|
| `remark-github-blockquote-alert` | GFM callout rendering | ~3 KB |
| `textarea-caret` | Caret pixel-position helper for Popper anchor | ~3 KB |
| `@types/textarea-caret` | TypeScript types (devDependency) | n/a |

`react-markdown`, `remark-gfm`, `rehype-sanitize` already in `package.json` — no changes.

### Backend
**None.** No model, serializer, view, migration, urls, or settings changes. `Niche.notes` and `CollectedProduct` endpoints remain exactly as deployed.

### Performance Budget
- `NotesMarkdownEditor` first render: < 80 ms (mostly Tabs + TextField; markdown libs are lazy-loaded on first Preview)
- `NicheCollectionHeartButton`: negligible (reads existing query, ~1 ms match)
- Total bundle delta: ~+6 KB gzipped (markdown plugin + caret lib)

### LOC Estimate per Phase
| Phase | LOC (incl. tests) |
|---|---|
| 1 — Scaffolding + deps | ~30 |
| 2 — Heart-Toggle (Feature A) | ~250 |
| 3 — Editor shell + Controller wiring | ~180 |
| 4 — Slash-Menu (registry + hook + Popper UI + insertion strategies) | ~450 |
| 5 — Preview + Callouts | ~200 |
| 6 — Tests + i18n | ~400 |
| 7 — QA hand-off prep | ~20 |
| **Total** | **~1,530** |

### Open Questions for Implementation
- [ ] OQ-1: Is `marketplace` on `ResearchProduct`? If not, parent must pass it (verify in Phase 2 first task).
- [ ] OQ-2: Does the existing AI Research view always have an active `nicheId`, or can it run without one? (Affects EC-A1 disabled-state visibility.)
- [ ] OQ-3: Should the slash menu remain open while the user scrolls the textarea (caret moves)? Default: close on scroll (simpler); reopen on next `/`.
- [ ] OQ-4: Behaviour when user is in Preview and Save is clicked: spec implies normal Save fires (the form's existing handler). Confirm in Phase 6.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
