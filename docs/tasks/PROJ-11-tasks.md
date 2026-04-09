# PROJ-11: Publish (Listing + Upload Manager) — Implementation Tasks

## Key Technical Decisions (from architecture review 2026-03-27 + redesign 2026-04-09)

- **Complete frontend rebuild** — old `views/publish/` (22 files, ~2800 lines) replaced entirely
- **Backend extended** — new `DesignCollection` model for folder system. Existing 5 models kept
- **2 routes:** `/publish` (collection browser) + `/publish/edit` (Flying Upload-style editor)
- **Cloud hooks extracted** to `components/CloudStorage/` — shared by PROJ-11 + PROJ-9
- **Command Palette reused** for "Options ⊙" per-section filtering
- **Frontend Design Decisions FD-PROJ11-1 through FD-PROJ11-7 are MANDATORY** — see spec

---

## Phase A: Backend — Collection Folder Model + API

### A1: DesignCollection Model

- [ ] `DesignCollection` model: UUID pk, `workspace` FK (CASCADE), `name` CharField(200), `parent` FK self (nullable, SET_NULL — root = null), `position` IntegerField(default=0), `created_by` FK User, `created_at`
- [ ] Index on `(workspace, parent)` for folder listing queries
- [ ] Add `collection` FK (nullable, SET_NULL) on existing `DesignAsset` model
- [ ] Migration — **run via Docker**
- [ ] Admin registration for DesignCollection

### A2: Collection API

- [ ] `GET /api/collections/` — list root-level collections for workspace. Include child_count, asset_count
- [ ] `GET /api/collections/{id}/` — collection detail: children folders + contained DesignAssets (paginated)
- [ ] `POST /api/collections/` — create folder: `{name, parent?}`. Auto-assigns position. Workspace isolation
- [ ] `PATCH /api/collections/{id}/` — rename or move: `{name?, parent?}`. Prevent circular references
- [ ] `DELETE /api/collections/{id}/` — delete folder. Assets move to parent (or root). Recursive: child folders deleted, assets bubble up
- [ ] `GET /api/collections/tree/` — full folder tree for Tree Explorer. Recursive serializer
- [ ] `POST /api/designs/gallery/move/` — move assets to collection: `{asset_ids: [...], collection_id}`. Null = root
- [ ] `CollectionSerializer` + `CollectionTreeSerializer`
- [ ] Extend `DesignAssetSerializer` — include `collection` field
- [ ] Extend `GET /api/designs/gallery/` — add `collection` filter param
- [ ] URL registration in `publish_app/api/urls.py`
- [ ] Workspace isolation on ALL new endpoints

### A3: Backend Tests

- [ ] Collection CRUD: create, rename, move, delete (with asset bubbling)
- [ ] Tree endpoint: correct hierarchy serialization
- [ ] Asset move: bulk move to collection, move to root
- [ ] Circular reference prevention
- [ ] Workspace isolation

---

## Phase B: Frontend — Shared Components

### B1: Cloud Storage Hooks (extracted from PROJ-9)

- [ ] Create `components/CloudStorage/hooks/useGoogleDrive.ts` — extract from PROJ-9 CloudManagerDialog
- [ ] Create `components/CloudStorage/hooks/useOneDrive.ts` — extract from PROJ-9 CloudManagerDialog
- [ ] Create `components/CloudStorage/CloudStorageSettings.tsx` — connect/disconnect, account email, status
- [ ] Create `components/CloudStorage/index.ts` — barrel export
- [ ] MSAL redirect bridge: `frontend-ui/public/auth-redirect.html`
- [ ] Verify PROJ-9 Design Editor still works with extracted hooks
- [ ] File filter: only PNG, JPG, JPEG, WebP, SVG. Max 25MB

### B2: RTK Query — publishSlice Rebuild

- [ ] Rebuild `store/publishSlice.ts` — add collection endpoints: `listCollections`, `getCollectionTree`, `createCollection`, `updateCollection`, `deleteCollection`, `moveAssets`
- [ ] Keep existing endpoints: listing CRUD, gallery CRUD, upload jobs, templates, lifecycle
- [ ] Add `collection` filter param to `listDesignAssets` query
- [ ] Tag invalidation: collection mutations invalidate `DesignCollection` + `DesignAsset` tags

---

## Phase C: Frontend — Publish View (Collection Browser)

### C1: Toolbar (FD-PROJ11-1)

- [ ] Create `partials/toolbar/PublishToolbar.tsx` — 2-row layout
- [ ] `SelectCounter.tsx` — checkbox + "0/11" + dropdown
- [ ] Collections button → opens CollectionsDialog
- [ ] Choose Action button → opens CommandPalette
- [ ] View Toggle: ToggleButtonGroup (ViewList/GridView)
- [ ] Search: TextField 240→320px focus, `COLORS.inkElevated` bg
- [ ] Template, Upload, Publish buttons
- [ ] `FileSystemTabs.tsx` — My Designs / Cloud Storage switcher, cyan underline slides, connection dot
- [ ] `BreadcrumbNav.tsx` — folder path + cloud provider chip
- [ ] `TransferPill.tsx` — "→3→" indicator between tabs
- [ ] Tab-context button morphing (Collections↔Folders, Upload↔Import)
- [ ] All tokens from theme/constants — zero hardcoded values

### C2: Design Card Grid (FD-PROJ11-2)

- [ ] `DesignCardGrid.tsx` — CSS Grid responsive, gap 20px
- [ ] `DesignCard.tsx` — glassmorphism, contain thumbnail, glass info strip, hover lift + actions, selection checkbox
- [ ] `DesignListRow.tsx` — 56px rows, list view variant
- [ ] `CloudFileCard.tsx` — provider badge, import/preview/copy actions
- [ ] `AddDesignsCard.tsx` — dashed + icon
- [ ] Storage indicator
- [ ] Staggered card enter animation

### C3: Selection System

- [ ] `useDesignSelection.ts` — click/shift/lasso state
- [ ] `useLassoSelect.ts` — rubber band mousedown/move/up + intersection
- [ ] `LassoOverlay.tsx` — cyan dashed rectangle
- [ ] Selection syncs toolbar counter + action bar

### C4: Collections Dialog (FD-PROJ11-3)

- [ ] `CollectionsDialog.tsx` — split-panel: tree (240px sunken) + folder grid
- [ ] Header + toolbar (toggle + breadcrumb + search)
- [ ] `FolderTree.tsx` — expand/collapse, selected cyan stripe, drop target
- [ ] `FolderGrid.tsx` + `FolderCard.tsx` — folder cards with tab detail, Add Folder card
- [ ] Inline rename on Add Folder
- [ ] "Open Folder" footer button
- [ ] Empty state + animations

### C5: Command Palette (FD-PROJ11-4)

- [ ] `CommandPalette.tsx` — glassmorphism 3-column, fuzzy search, keyboard nav
- [ ] `CommandAction.tsx` — icon + label row
- [ ] 3 columns: LISTING+GENERAL, FILES+EXPORT+CLOUD, TEMPLATES
- [ ] `context` prop: pre-filter for "Options ⊙" trigger
- [ ] `useCommandPalette.ts` — action registry, fuzzy match, keyboard, recently-used (localStorage)
- [ ] Triggers: toolbar button, Ctrl+K, Options ⊙

### C6: Bottom Action Bar (FD-PROJ11-5)

- [ ] `ActionBar.tsx` — floating dock, glassmorphism
- [ ] Counter + Edit + All/None + History + Batch + Options dropdown + Delete
- [ ] Enter/exit animations, stagger
- [ ] Responsive <600px: icons only

### C7: Cloud Storage Tab (FD-PROJ11-6)

- [ ] `CloudStorageTab.tsx` — renders when Cloud tab active
- [ ] `ProviderSwitcher.tsx` — chip dropdown with connection dots
- [ ] `CloudConnectionState.tsx` — not connected / loading / empty
- [ ] Cloud file cards with import/preview actions
- [ ] `TransferProgress.tsx` — CircularProgress overlay + CheckCircle
- [ ] Transfer flows: Import (cloud→server), Send to Cloud (server→cloud)

### C8: Publish View Assembly

- [ ] Create `PublishView.tsx` — assembles Toolbar + Grid/Cloud tab content + ActionBar
- [ ] Route `/publish` in App.tsx
- [ ] Sidebar link "Listing Loadout" → `/publish`
- [ ] Empty state when no designs

---

## Phase D: Frontend — Edit Page (Flying Upload Style)

### D1: Edit Page Layout (FD-PROJ11-7)

- [ ] Create `EditView.tsx` — route `/publish/edit`
- [ ] Layout: thumbnail strip (left 200px fixed) + form (center scroll) + preview (right 300px sticky)
- [ ] Page header: Back + Add + Shortcut Guide
- [ ] Marketplace tabs: Global/Mba/Displate toggle
- [ ] Route in App.tsx

### D2: Thumbnail Strip

- [ ] `ThumbnailStrip.tsx` — fixed left, design tags, Load/Clear, "1 of 5" arrows
- [ ] Active thumbnail: cyan border + number badge
- [ ] Other thumbnails: 80×80px, opacity 0.60, click navigates
- [ ] Cross-fade on design switch

### D3: Section Header + Options ⊙

- [ ] `SectionHeader.tsx` — title + InfoOutlined + Options ⊙ right-aligned
- [ ] `OptionsButton.tsx` — opens CommandPalette with `context` filter. Icon rotates 90°
- [ ] Used on every section

### D4: Product Config Sections

- [ ] `ProductTypeScroller.tsx` — horizontal scroll, product cards 72px, count badge, selected cyan
- [ ] Fit Type + Print: 2-col checkboxes/radio
- [ ] `ColorGrid.tsx` — circles 36px, selected cyan + glow + scale, checkmark
- [ ] `MarketplacePricing.tsx` — 4-col grid, checkbox + price + royalty

### D5: Listing Fields

- [ ] `ListingField.tsx` — char counter (normal/amber/red), AI Improve hover, Options ⊙
- [ ] Brand+Title 2-col, Bullets 2-col, Description full-width
- [ ] `KeywordChipsField.tsx` — removable chips, "+ Add", counter, KW Finder link
- [ ] `TranslationTabs.tsx` — flag chips, Auto Translate, Translate to All

### D6: Bottom Sections + Preview

- [ ] Options/Trademarks tabs, Availability/Publish radios
- [ ] TMCheckDialog
- [ ] `DesignPreview.tsx` — sticky right, contain, meta info
- [ ] "Unsaved changes" bar

### D7: Listing Editor Hook

- [ ] `useListingEditor.ts` — multi-design nav, field state, auto-save, AI generate/translate
- [ ] Options ⊙ context passing to CommandPalette
- [ ] Copy/Apply bulk: "Copy from design X" → applies to current

---

## Phase E: i18n + Tests + Lint

### E1: i18n

- [ ] Toolbar keys: `publish.toolbar.*`
- [ ] Tab keys: `publish.tabs.*`
- [ ] Collection keys: `publish.collections.*`
- [ ] Command Palette keys: `publish.command.*`
- [ ] Action Bar keys: `publish.actionBar.*`
- [ ] Cloud keys: `publish.cloud.*`
- [ ] Edit Page section keys: `publish.edit.*`
- [ ] Edit Page action keys: `publish.edit.options`, `publish.edit.copyFrom`, etc.
- [ ] Sync to DE, FR, ES, IT (5 locales)

### E2: Tests

- [ ] Backend: Collection CRUD, tree, asset move, circular ref, workspace isolation
- [ ] Toolbar: 2 rows, tab switch, breadcrumb
- [ ] Card Grid: grid/list, selection, hover actions
- [ ] Collections Dialog: tree nav, folder CRUD
- [ ] Command Palette: search, keyboard, context filter
- [ ] Action Bar: appear/disappear, counter, actions
- [ ] Cloud Tab: provider switch, connection states, import
- [ ] Edit Page: thumbnail nav, char counters, Options ⊙
- [ ] Listing Field: counter colors, AI Improve

### E3: Lint + Cleanup

- [ ] Zero hardcoded colors/px — all theme tokens
- [ ] All transitions via `DURATION.*` + `EASING.*`
- [ ] Remove old `views/publish/` files after verification
- [ ] `npm run lint` clean
- [ ] `npm run test:ci` passes
- [ ] `ruff check django-app/` passes
