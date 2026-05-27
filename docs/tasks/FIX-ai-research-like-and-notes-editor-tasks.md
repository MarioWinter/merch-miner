# FIX — AI Research Like + Notes Editor — Implementation Tasks

> **Branch:** `fix/ai-research-like-and-notes-editor`
> **Spec:** `features/FIX-ai-research-like-and-notes-editor.md`
> **Type:** Mini-Fix (no PROJ-ID, single PR, frontend-only)
>
> Run phases **in order**. Each phase is a logical commit boundary. Implementation skills consume one phase at a time per `feedback_phase_by_phase_skill_invocation.md` — orchestrator commits after review.
>
> Every task is a `- [ ]` checkbox. Implementation skills check off as they complete each task. Mapped AC/EC anchors in `( )` after each task.

---

## Phase 1 — Scaffolding & Dependencies (~30 LOC)

**Goal:** Folder skeletons, deps installed, types resolve. Nothing user-visible yet.

- [x] T1.1: Add `remark-github-blockquote-alert` to `frontend-ui/package.json` (dependencies). (Tech-Req) — package.json:64 (`^2.1.0`)
- [x] T1.2: Add `textarea-caret` + `@types/textarea-caret` to `frontend-ui/package.json` (deps + devDeps). (Decision-4) — package.json:65 (`textarea-caret ^3.1.0`) + package.json:84 (`@types/textarea-caret ^3.0.4`)
- [x] T1.3: Run `npm install` from `frontend-ui/` and verify lockfile updated. (Tech-Req) — 3 packages added; lockfile lists `remark-github-blockquote-alert@2.1.0`, `textarea-caret@3.1.0`, `@types/textarea-caret@3.0.4`
- [x] T1.4: Create empty folder skeleton: `frontend-ui/src/components/NicheCollectionHeartButton/{hooks,tests}/`. (Decision-5) — `.gitkeep` in each leaf folder so structure survives git tracking until Phase 2 files materialise
- [x] T1.5: Create empty folder skeleton: `frontend-ui/src/components/NotesMarkdownEditor/{hooks,partials,utils,tests}/`. (Decision-1) — same `.gitkeep` strategy
- [x] T1.6: Run `npm run lint && npm run build` to confirm baseline still passes before any code added. — lint: 0 errors, 11 warnings (all pre-existing in untouched files); build: succeeded in 7.90s

**Dependencies:** none.
**Blocks:** all subsequent phases.

---

## Phase 2 — Heart-Toggle (Feature A) (~250 LOC)

**Goal:** Heart-button shipped in AI Research view, optimistic updates wired, tests green.

### 2A. Verifications

- [x] T2.1: Verify `marketplace` field on `ResearchProduct` type — `ResearchProduct` has NO `marketplace` field. Confirmed via `grep -E "marketplace" src/views/niches/research/types/index.ts` (returns only `marketplace?: Marketplace` / `marketplace: Marketplace` from other types, not ResearchProduct). Resolution: parent passes `marketplace` from `data.marketplace` of the niche-research response → wired through `index.tsx` → `GroupedProductAnalysis` → `PatternProductGroup` → `ProductAnalysisCard` → `NicheCollectionHeartButton`. (OQ-1, EC-A6)
- [x] T2.2: `ProductAnalysisCard` always receives non-null `nicheId` in current usage — confirmed via `views/niches/research/index.tsx:211` (`nicheId={nicheId!}` non-null assertion at the call site, gated by the parent view's data-loaded branch). (OQ-2, EC-A1)

### 2B. Hook + Slice Updates

- [x] T2.3: Created `components/NicheCollectionHeartButton/hooks/useIsProductLiked.ts` — wraps `useGetCollectedProductsQuery(nicheId)` with skip, returns `{ isLiked, collectedProductId, isLoading }` by matching ASIN+marketplace. (AC-A2)
- [x] T2.4: Edited `store/collectedProductsSlice.ts` — `onQueryStarted` added to `collectProduct` (inserts optimistic entry with temporary id `optimistic-{asin}-{Date.now()}`, rolls back on error). (AC-A5, EC-A3)
- [x] T2.5: Edited `store/collectedProductsSlice.ts` — `onQueryStarted` added to `removeCollectedProduct` (filters out by id, rolls back on error). (AC-A5, EC-A3)

### 2C. Component

- [x] T2.6: Created `components/NicheCollectionHeartButton/index.tsx` — `IconButton` with filled/outline swap, disabled+tooltip when `nicheId === null`, returns null when ASIN/marketplace missing. Inline `styled(IconButton)` with `theme.vars.palette.error.main` (filled) / `theme.vars.palette.action.active` (outline). (AC-A1, A2, A7, A8, EC-A1, EC-A6)
- [x] T2.7: Click handler in same component uses `useCollectProductMutation` or `useRemoveCollectedProductMutation` based on `isLiked`. Button disabled while either mutation `isLoading`. notistack error toast on reject — icon reverts via slice rollback. (AC-A3, A4, A6, EC-A2, EC-A3)
- [x] T2.8: i18n keys added to `public/locales/{en,de}/translation.json` under `nicheCollection.heart.*`: `addAriaLabel`, `removeAriaLabel`, `noNicheTooltip`, `addError`, `removeError`. EN + DE both present. (AC-A8, A9)

### 2D. Integration

- [x] T2.9: Edited `views/niches/research/partials/ProductAnalysisCard.tsx` — `<NicheCollectionHeartButton />` rendered in a `Stack direction="row"` alongside the expand `IconButton` (top-right). Accepts new required `marketplace: string` prop. (AC-A1)
- [x] T2.10: Gap confirmed in T2.1 → marketplace threaded through `views/niches/research/index.tsx` → `GroupedProductAnalysis.tsx` → `PatternProductGroup.tsx` → `ProductAnalysisCard.tsx`. (EC-A6)

### 2E. Tests

- [x] T2.11: Created `components/NicheCollectionHeartButton/tests/NicheCollectionHeartButton.test.tsx` — 9 tests, all pass:
  - renders outlined heart when product not in collection (AC-A2)
  - renders filled heart when product in collection (AC-A2)
  - click outlined → fires `collectProduct` (AC-A3)
  - click filled → fires `removeCollectedProduct` (AC-A4)
  - shows optimistic flip + rollback on error (AC-A5, EC-A3)
  - disabled with tooltip when `nicheId === null` (EC-A1)
  - hidden when `asin` missing (EC-A6)
  - shows error toast on mutation reject (AC-A6)
- [x] T2.12: `npm run test:ci` — 1608/1608 PASS, 0 failures, 0 errors. Lint: 0 errors, 11 pre-existing warnings (no new). Fixed regression in `views/niches/research/tests/ProductAnalysisCard.test.tsx` by mocking `@/store/collectedProductsSlice` hooks (same pattern as existing `ideaSlice` mock) and adding `marketplace="amazon_com"` to all 9 render calls.

**Dependencies:** Phase 1.
**Blocks:** none for Feature B, but Phase 7 (QA prep) requires Phase 2 done.

---

## Phase 3 — Notes Editor Shell (~180 LOC)

**Goal:** `NotesMarkdownEditor` mounted in `PipelineEditForm` with Edit/Preview tabs and auto-grow textarea. Slash menu + preview NOT yet wired (placeholders shown).

- [x] T3.1: Created `components/NotesMarkdownEditor/index.tsx` — arrow-function component exporting `NotesMarkdownEditorProps` with value/onChange/placeholder/minRows/maxRows/ariaLabel/onBlur/error/helperText/disabled. Defaults minRows=3, maxRows=20. (AC-B1, B12, B16) — index.tsx:18-80
- [x] T3.2: Inside index: MUI `Tabs` (Edit/Preview), Edit is default (`useState(0)`), pattern lifted from `SkillEditor.tsx:142`. (AC-B2) — index.tsx:43-50
- [x] T3.3: Edit tab: `<EditTextarea />` partial (`forwardRef<HTMLTextAreaElement>`) wraps MUI TextField with `multiline`, `minRows`/`maxRows` passthrough, `fullWidth`, `size="small"`, `slotProps={{ htmlInput: { ref, style: { resize: 'vertical' }, 'aria-label': ariaLabel } }}`. Phase 4 slash-menu marker left in code. (AC-B3, B4, EC-B15, EC-B16) — partials/EditTextarea.tsx:24-61
- [x] T3.4: Preview tab: inline `<Box>` placeholder rendering `t('notesEditor.preview.phase3Placeholder')`. (AC-B2) — index.tsx:67-77
- [x] T3.5: Edited `views/niches/list/partials/PipelineEditForm.tsx` — `notes` Controller now renders `<Box>` + `<Typography>` label + `<NotesMarkdownEditor>` (value coerced via `?? ''`, onBlur/error/helperText/ariaLabel passed through). (AC-B1, B16) — PipelineEditForm.tsx:60-78
- [x] T3.6: i18n keys added to BOTH `public/locales/en/translation.json` AND `de/translation.json` under top-level `notesEditor.*`: tab.edit, tab.preview, placeholder.empty, placeholder.startTyping, preview.phase3Placeholder. (AC-B17, EC-B1) — en/translation.json:254-266 + de/translation.json:254-266
- [x] T3.7: Verification — lint 0 errors / 11 pre-existing warnings (baseline matched); build PASS 7.78s; test:ci 1608/1608 pass, 0 failures, 0 errors (no regression from PipelineEditForm change since no existing test queried the notes textarea by label/role).

**Dependencies:** Phase 1.
**Blocks:** Phase 4 + Phase 5 build on this shell.

---

## Phase 4 — Slash-Menu (~450 LOC)

**Goal:** All 15 commands functional from typing `/` to inserted markdown with correct caret placement. Enter-continuation works.

### 4A. Command Registry + Insertion Strategies

- [x] T4.1: Created `components/NotesMarkdownEditor/utils/commandRegistry.ts` — `SlashCommand` type + `COMMANDS` array of 15 + `findMatches`. (AC-B6, B7)
- [x] T4.2: Created `components/NotesMarkdownEditor/utils/linePrefixRegex.ts` — `LINE_PREFIX_REGEX` + `matchExistingPrefix(text, lineStart)`. (Decision-7, EC-B13)
- [x] T4.3: Created `components/NotesMarkdownEditor/utils/insertionStrategies.ts` — `applyLinePrefix`, `applyBlock`, `applyInline`. (AC-B6, B9, EC-B12, EC-B13, EC-B14)
- [x] T4.4: Created `components/NotesMarkdownEditor/utils/tests/insertionStrategies.test.ts` — table-driven tests pass. (Cross-cuts AC-B6, EC-B12, EC-B13, EC-B14)

### 4B. Hook

- [x] T4.5: Create `components/NotesMarkdownEditor/hooks/useTextareaSlashMenu.ts` — state machine per Tech Design Decision 4. Returns `{ menuProps: { open, anchorRect, query, activeIndex, commands, onSelect, onHoverIndex, onClose } }`. Listens on the textarea ref. (AC-B5, B7, B8, B10, B11, B12, B19, EC-B5, EC-B6, EC-B7, EC-B8, EC-B9, EC-B10, EC-B11)
- [x] T4.6: Inside hook: `/` keystroke gate — only opens when previous char is undefined / whitespace / start-of-line. (AC-B5, EC-B5)
- [x] T4.7: Inside hook: ArrowUp/Down navigation, Enter/Tab commit, Esc close (leaves `/query` text intact). (AC-B8, AC-B10)
- [x] T4.8: Inside hook: typing whitespace closes menu (EC-B7). Backspace past `/` closes menu.
- [x] T4.9: Inside hook: paste does NOT open the menu (only single-keystroke `/`). (EC-B11)
- [x] T4.10: Inside hook: caret rect via `textarea-caret`'s `getCaretCoordinates(textarea, selectionStart)` → translates to screen rect for Popper anchor. (Decision-4)
- [x] T4.11: Inside hook: on confirm, call `applyLinePrefix` / `applyBlock` / `applyInline` per command behaviour and dispatch `onChange` to the parent. (AC-B9)
- [x] T4.12: Create `components/NotesMarkdownEditor/tests/useTextareaSlashMenu.test.ts` — open/filter/select/cancel flows, mid-word guard, whitespace close, Esc close.

### 4C. Enter-Continuation Hook

- [x] T4.13: Create `components/NotesMarkdownEditor/hooks/useListContinuation.ts` — keydown listener for `Enter`: if cursor line starts with `- `, `- [ ] `, `- [x] `, or `N. ` and the line has content after the prefix → insert newline + same prefix (numbered list increments N). If line contains only prefix → remove prefix, insert plain newline. (AC-B11, AC-B12, EC-B4)
- [x] T4.14: Tests for `useListContinuation` — bulleted, to-do, numbered, escape on empty list line.

### 4D. UI Popper

- [x] T4.15: Create `components/NotesMarkdownEditor/partials/SlashCommandMenu.tsx` — MUI `Popper` with `Paper` + `MenuList`. Virtual anchorEl from `anchorRect` prop. Modifiers: `flip` + `preventOverflow`. Each row: icon + label + secondary description text. Active row highlighted (background `theme.vars.palette.action.selected`). (AC-B6, EC-B8, EC-B9)
- [x] T4.16: Empty state: when `commands.length === 0` show "No matching commands" (i18n key). (EC-B6)
- [x] T4.17: Click outside / Esc close hook plumbed via `onClose` prop. (AC-B10)

### 4E. Wire-up

- [x] T4.18: Create `components/NotesMarkdownEditor/partials/EditTextarea.tsx` — owns the textarea ref, wires both hooks (`useTextareaSlashMenu` + `useListContinuation`), renders `<TextField>` + `<SlashCommandMenu />`. Replaces the placeholder textarea from Phase 3. (AC-B3, B4, B5, B19)
- [x] T4.19: i18n keys for all 15 command labels + descriptions + empty state. Use a single namespace `notesEditor.commands.*`. (AC-B17)

### 4F. Component-Level Tests

- [x] T4.20: `tests/NotesMarkdownEditor.slashmenu.test.tsx` — type `/` → menu opens; type `bu` → filters to Bulleted list; Enter → `- ` inserted; type `/` mid-word → menu does NOT open. (AC-B5, B7, B9, EC-B5)

**Dependencies:** Phase 3.
**Blocks:** none (Phase 5 is independent).

---

## Phase 5 — Preview + Callouts (~200 LOC)

**Goal:** Preview tab renders markdown with GFM + GitHub-Alerts + interactive checkboxes.

- [ ] T5.1: Create `components/NotesMarkdownEditor/partials/NotesMarkdownRenderer.tsx` — props `{ value: string; onChange: (v: string) => void; emptyPlaceholderI18nKey: string }`. (AC-B13, B14)
- [ ] T5.2: Inside renderer: `react-markdown` with `remarkPlugins={[remarkGfm, remarkGithubBlockquoteAlert]}` and `rehypePlugins={[rehypeSanitize]}`. (AC-B13, Tech-Req new dep)
- [ ] T5.3: Inside renderer: empty/whitespace-only value → render `<Typography>` with placeholder, fontStyle italic, `text.secondary`. (EC-B1, EC-B2)
- [ ] T5.4: Inside renderer: GFM checkbox click handler — locate the source `[ ]` / `[x]` substring corresponding to the clicked DOM checkbox (Nth task-list-item across the source), toggle, call `onChange` with the patched string. (AC-B14, EC-B3)
- [ ] T5.5: Inside renderer: `Root` styled `Box` with markdown CSS (borrow pattern from `MarkdownAnswer.tsx:34`). Add callout selectors:
  - `.markdown-alert-note` → `info` palette
  - `.markdown-alert-tip` → `success` palette
  - `.markdown-alert-warning` → `warning` palette
  - `.markdown-alert-important` → `error` palette
  Each: left border + tinted background using `alpha(theme.palette.X.main, 0.1)`. (Decision-6, EC-B19, AC-B18)
- [ ] T5.6: Edit `components/NotesMarkdownEditor/index.tsx` — replace Phase 3 placeholder Preview with `<NotesMarkdownRenderer value={value} onChange={onChange} emptyPlaceholderI18nKey="notesEditor.placeholder.empty" />`. (AC-B2)
- [ ] T5.7: Create `tests/NotesMarkdownRenderer.test.tsx`:
  - renders bullet list (AC-B13)
  - renders each callout type with correct alert class (Decision-6)
  - falls back to plain blockquote for unknown alert type (EC-B19)
  - empty value → placeholder shown (EC-B1)
  - whitespace-only → placeholder shown (EC-B2)
  - checkbox click toggles `[ ]` → `[x]` in source and fires `onChange` (AC-B14)
- [ ] T5.8: Visual smoke: open a niche with sample callouts/checklists in notes → render in Preview correctly.

**Dependencies:** Phase 3.
**Blocks:** Phase 7.

---

## Phase 6 — Cross-cutting Tests + i18n + Polish (~400 LOC)

**Goal:** Integration tests, all i18n locked in, accessibility verified, no console warnings.

- [ ] T6.1: Create `tests/NotesMarkdownEditor.integration.test.tsx` — full flow: open editor → type `/bu` → Enter → see `- ` → type text → Enter → see `- ` again (continuation) → switch to Preview → see rendered bullet → switch back, value preserved. (AC-B2, B7, B9, B11, EC-B17)
- [ ] T6.2: Run `npm run lint -- --max-warnings 0` from `frontend-ui/` — fix any new warnings introduced by Feature A or B touches. (rules/general.md)
- [ ] T6.3: Run `npm run build` (tsc + vite) — must succeed with zero TS errors.
- [ ] T6.4: Run `npm run test:ci` — full suite green; coverage acceptable for new files.
- [ ] T6.5: Verify all `i18n/locales/en.json` AND `de.json` have matching keys for: all 15 command labels, all 15 command descriptions, empty-commands state, "No notes yet", "Edit"/"Preview" tab labels, callout titles ("Note"/"Tip"/"Warning"/"Important"), heart button aria-labels and tooltips, error toast messages. (AC-A9, AC-B17)
- [ ] T6.6: Aria audit: heart button has `aria-label`; tab buttons have implicit Tab role; slash menu has `role="listbox"` and items `role="option"` with `aria-selected` on active row.
- [ ] T6.7: Manual a11y smoke: navigate the editor with keyboard only — Tab into textarea, type `/`, Up/Down arrow, Enter, Esc. Tab between Edit/Preview tabs. No focus traps.
- [ ] T6.8: Hard-code colour grep: `grep -rE "#[0-9a-fA-F]{3,8}|rgb\(|rgba\(" frontend-ui/src/components/{NotesMarkdownEditor,NicheCollectionHeartButton}/` returns no hits except in test fixtures. (AC-A7, AC-B18)

**Dependencies:** Phases 2, 4, 5.
**Blocks:** Phase 7.

---

## Phase 7 — QA Hand-off Prep (~20 LOC docs)

**Goal:** Ready for `/qa` skill. Status updated. Smoke checklist documented.

- [ ] T7.1: Update `features/INDEX.md` Mini-Fixes row status: Planned → In Review.
- [ ] T7.2: Update spec header "Status: Planned" → "Status: In Review".
- [ ] T7.3: Append a "Smoke Checklist" subsection inside the spec (under QA Test Results, leaving the rest for `/qa`):
  - [ ] Heart appears on every AI Research product card.
  - [ ] Heart filled when product already in collection; outlined otherwise.
  - [ ] Click outlined → filled + product appears in Niche Pipeline ProductsGrid after refetch.
  - [ ] Click filled → outlined + product disappears from ProductsGrid.
  - [ ] Heart disabled with tooltip when no active niche.
  - [ ] Network error → icon reverts + error toast.
  - [ ] Notes editor opens in Edit by default; switch to Preview works.
  - [ ] Auto-grow up to ~20 rows; manual resize handle works vertically.
  - [ ] Type `/` at line start → menu opens; type `/` mid-word → no menu.
  - [ ] Filter by typing — `/bu` filters to Bulleted list.
  - [ ] Arrow keys navigate; Enter inserts the prefix; Esc closes; Space closes.
  - [ ] All 15 commands insert the correct markdown.
  - [ ] Enter continues a list/checklist/numbered prefix; Enter on empty list line escapes.
  - [ ] Preview renders all 4 callout types in distinct colours.
  - [ ] Click checkbox in Preview toggles `[ ]`/`[x]` and marks form dirty.
  - [ ] Save persists notes; reload shows them; round-trip preserves all markdown.
  - [ ] EN and DE translations both present for all new strings.
- [ ] T7.4: Verify no orphan files in branch: `git status` clean except for intended new files; `git diff --stat` matches the scope.

**Dependencies:** Phases 1-6 all checked.
**Blocks:** `/qa` skill invocation.

---

## Phase Dependency Graph

```
Phase 1 (Scaffolding)
  ├─→ Phase 2 (Heart-Toggle)        ──┐
  └─→ Phase 3 (Editor Shell)          │
         ├─→ Phase 4 (Slash-Menu)  ──┤
         └─→ Phase 5 (Preview)     ──┤
                                     ↓
                              Phase 6 (Tests + i18n)
                                     ↓
                              Phase 7 (QA hand-off)
```

Phase 2 is independent of Phase 3-5 and may run in parallel if delegated to separate sub-agents.

---

## Out of Scope (do not implement here)
- New `LikedProduct` model or "Liked" stage
- Bulk-like / multi-select on AI Research
- WYSIWYG formatting in Edit mode
- Markdown autocomplete / inline suggestions beyond the slash menu
- URL prompt dialog for the Link command
- Auto-save on checkbox click
- Backend changes of any kind
- Italic / strikethrough / table / inline-code commands
- User-configurable slash command list
