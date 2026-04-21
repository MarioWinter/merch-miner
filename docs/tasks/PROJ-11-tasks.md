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

- [x] `DesignCollection` model: UUID pk, `workspace` FK (CASCADE), `name` CharField(200), `parent` FK self (nullable, SET_NULL — root = null), `position` IntegerField(default=0), `created_by` FK User, `created_at`
- [x] Index on `(workspace, parent)` for folder listing queries
- [x] Add `collection` FK (nullable, SET_NULL) on existing `DesignAsset` model
- [x] Migration — **run via Docker**
- [x] Admin registration for DesignCollection

### A2: Collection API

- [x] `GET /api/collections/` — list root-level collections for workspace. Include child_count, asset_count
- [x] `GET /api/collections/{id}/` — collection detail: children folders + contained DesignAssets (paginated)
- [x] `POST /api/collections/` — create folder: `{name, parent?}`. Auto-assigns position. Workspace isolation
- [x] `PATCH /api/collections/{id}/` — rename or move: `{name?, parent?}`. Prevent circular references
- [x] `DELETE /api/collections/{id}/` — delete folder. Assets move to parent (or root). Recursive: child folders deleted, assets bubble up
- [x] `GET /api/collections/tree/` — full folder tree for Tree Explorer. Recursive serializer
- [x] `POST /api/designs/gallery/move/` — move assets to collection: `{asset_ids: [...], collection_id}`. Null = root
- [x] `CollectionSerializer` + `CollectionTreeSerializer`
- [x] Extend `DesignAssetSerializer` — include `collection` field
- [x] Extend `GET /api/designs/gallery/` — add `collection` filter param
- [x] URL registration in `publish_app/api/urls.py`
- [x] Workspace isolation on ALL new endpoints

### A3: Backend Tests

- [x] Collection CRUD: create, rename, move, delete (with asset bubbling)
- [x] Tree endpoint: correct hierarchy serialization
- [x] Asset move: bulk move to collection, move to root
- [x] Circular reference prevention
- [x] Workspace isolation

---

## Phase B: Frontend — Shared Components

### B1: Cloud Storage Hooks (extracted from PROJ-9)

- [x] Create `components/CloudStorage/hooks/useGoogleDrive.ts` — extract from PROJ-9 CloudManagerDialog
- [x] Create `components/CloudStorage/hooks/useOneDrive.ts` — extract from PROJ-9 CloudManagerDialog
- [x] Create `components/CloudStorage/CloudStorageSettings.tsx` — connect/disconnect, account email, status
- [x] Create `components/CloudStorage/index.ts` — barrel export
- [x] MSAL redirect bridge: `frontend-ui/public/auth-redirect.html`
- [x] Verify PROJ-9 Design Editor still works with extracted hooks
- [x] File filter: only PNG, JPG, JPEG, WebP, SVG. Max 25MB

### B2: RTK Query — publishSlice Rebuild

- [x] Rebuild `store/publishSlice.ts` — add collection endpoints: `listCollections`, `getCollectionTree`, `createCollection`, `updateCollection`, `deleteCollection`, `moveAssets`
- [x] Keep existing endpoints: listing CRUD, gallery CRUD, upload jobs, templates, lifecycle
- [x] Add `collection` filter param to `listDesignAssets` query
- [x] Tag invalidation: collection mutations invalidate `DesignCollection` + `DesignAsset` tags

---

## Phase C: Frontend — Publish View (Collection Browser)

### C1: Toolbar (FD-PROJ11-1)

- [x] Create `partials/toolbar/PublishToolbar.tsx` — 2-row layout
- [x] `SelectCounter.tsx` — checkbox + "0/11" + dropdown
- [x] Collections button → opens CollectionsDialog
- [x] Choose Action button → opens CommandPalette
- [x] View Toggle: ToggleButtonGroup (ViewList/GridView)
- [x] Search: TextField 240→320px focus, `COLORS.inkElevated` bg
- [x] Template, Upload, Publish buttons
- [x] `FileSystemTabs.tsx` — My Designs / Cloud Storage switcher, cyan underline slides, connection dot
- [x] `BreadcrumbNav.tsx` — folder path + cloud provider chip
- [x] `TransferPill.tsx` — "→3→" indicator between tabs
- [x] Tab-context button morphing (Collections↔Folders, Upload↔Import)
- [x] All tokens from theme/constants — zero hardcoded values

### C2: Design Card Grid (FD-PROJ11-2)

- [x] `DesignCardGrid.tsx` — CSS Grid responsive, gap 20px
- [x] `DesignCard.tsx` — glassmorphism, contain thumbnail, glass info strip, hover lift + actions, selection checkbox
- [x] `DesignListRow.tsx` — 56px rows, list view variant
- [x] `CloudFileCard.tsx` — provider badge, import/preview/copy actions
- [x] `AddDesignsCard.tsx` — dashed + icon
- [x] Storage indicator
- [x] Staggered card enter animation

### C3: Selection System

- [x] `useDesignSelection.ts` — click/shift/lasso state
- [x] `useLassoSelect.ts` — rubber band mousedown/move/up + intersection
- [x] `LassoOverlay.tsx` — cyan dashed rectangle
- [x] Selection syncs toolbar counter + action bar

### C4: Collections Dialog (FD-PROJ11-3)

- [x] `CollectionsDialog.tsx` — split-panel: tree (240px sunken) + folder grid
- [x] Header + toolbar (toggle + breadcrumb + search)
- [x] `FolderTree.tsx` — expand/collapse, selected cyan stripe, drop target
- [x] `FolderGrid.tsx` + `FolderCard.tsx` — folder cards with tab detail, Add Folder card
- [x] Inline rename on Add Folder
- [x] "Open Folder" footer button
- [x] Empty state + animations

### C5: Command Palette (FD-PROJ11-4)

- [x] `CommandPalette.tsx` — glassmorphism 3-column, fuzzy search, keyboard nav
- [x] `CommandAction.tsx` — icon + label row
- [x] 3 columns: LISTING+GENERAL, FILES+EXPORT+CLOUD, TEMPLATES
- [x] `context` prop: pre-filter for "Options ⊙" trigger
- [x] `useCommandPalette.ts` — action registry, fuzzy match, keyboard, recently-used (localStorage)
- [x] Triggers: toolbar button, Ctrl+K, Options ⊙

### C6: Bottom Action Bar (FD-PROJ11-5)

- [x] `ActionBar.tsx` — floating dock, glassmorphism
- [x] Counter + Edit + All/None + History + Batch + Options dropdown + Delete
- [x] Enter/exit animations, stagger
- [x] Responsive <600px: icons only

### C7: Cloud Storage Tab (FD-PROJ11-6)

- [x] `CloudStorageTab.tsx` — renders when Cloud tab active
- [x] `ProviderSwitcher.tsx` — chip dropdown with connection dots
- [x] `CloudConnectionState.tsx` — not connected / loading / empty
- [x] Cloud file cards with import/preview actions
- [x] `TransferProgress.tsx` — CircularProgress overlay + CheckCircle
- [x] Transfer flows: Import (cloud→server), Send to Cloud (server→cloud)

### C8: Publish View Assembly

- [x] Create `PublishView.tsx` — assembles Toolbar + Grid/Cloud tab content + ActionBar
- [x] Route `/publish` in App.tsx
- [x] Sidebar link "Listing Loadout" → `/publish`
- [x] Empty state when no designs

---

## Phase D: Frontend — Edit Page (Flying Upload Style)

### D1: Edit Page Layout (FD-PROJ11-7)

- [x] Create `EditView.tsx` — route `/publish/edit`
- [x] Layout: thumbnail strip (left 200px fixed) + form (center scroll) + preview (right 300px sticky)
- [x] Page header: Back + Add + Shortcut Guide
- [x] Marketplace tabs: Global/Mba/Displate toggle
- [x] Route in App.tsx

### D2: Thumbnail Strip

- [x] `ThumbnailStrip.tsx` — fixed left, design tags, Load/Clear, "1 of 5" arrows
- [x] Active thumbnail: cyan border + number badge
- [x] Other thumbnails: 80×80px, opacity 0.60, click navigates
- [x] Cross-fade on design switch

### D3: Section Header + Options ⊙

- [x] `SectionHeader.tsx` — title + InfoOutlined + Options ⊙ right-aligned
- [x] `OptionsButton.tsx` — opens CommandPalette with `context` filter. Icon rotates 90°
- [x] Used on every section

### D4: Product Config Sections

- [x] `ProductTypeScroller.tsx` — horizontal scroll, product cards 72px, count badge, selected cyan
- [x] Fit Type + Print: 2-col checkboxes/radio
- [x] `ColorGrid.tsx` — circles 36px, selected cyan + glow + scale, checkmark
- [x] `MarketplacePricing.tsx` — 4-col grid, checkbox + price + royalty

### D5: Listing Fields

- [x] `ListingField.tsx` — char counter (normal/amber/red), AI Improve hover, Options ⊙
- [x] Brand+Title 2-col, Bullets 2-col, Description full-width
- [x] `KeywordChipsField.tsx` — removable chips, "+ Add", counter, KW Finder link
- [x] `TranslationTabs.tsx` — flag chips, Auto Translate, Translate to All

### D6: Bottom Sections + Preview

- [x] Options/Trademarks tabs, Availability/Publish radios
- [x] TMCheckDialog
- [x] `DesignPreview.tsx` — sticky right, contain, meta info
- [x] "Unsaved changes" bar

### D7: Listing Editor Hook

- [x] `useListingEditor.ts` — multi-marketplace nav, field state, auto-save, AI generate/translate
- [x] Options ⊙ context passing to CommandPalette
- [x] Copy/Apply bulk: "Copy from design X" → applies to current

---

## Phase F: Backend — Marketplace Type + MBA Reference Data (added 2026-04-18)

> Scope decisions finalized 2026-04-18 during D3/D4 implementation. Spec updated: PROJ-11 AC-1 (marketplace_type field), AC-37 (MBA colors endpoint), FD-PROJ11-7 Section Specs (MBA-only gating).

### F1: Backend — Listing Marketplace Type

- [x] Add `marketplace_type` CharField to `Listing` model — choices `[global, mba, displate]`, default=`mba`
- [x] Add `UniqueConstraint(fields=['design', 'marketplace_type'])` to Listing Meta
- [x] Django migration: schema change + data migration (existing listings → `mba` default)
- [x] Update `ListingSerializer` to include `marketplace_type` (read + write)
- [x] Update `GET /api/ideas/{id}/listing/` — return MBA variant by default, support `?marketplace_type=global` query param
- [x] Update Listing create endpoint — enforce uniqueness (return 409 on duplicate design+marketplace_type)
- [x] Backend tests: unique constraint, filter by marketplace_type, 409 on duplicate

### F2: Backend — MBA Reference Data API (AC-37)

- [x] Create `publish_app/constants.py` — `MBA_COLORS` list `[{key, name, hex}, ...]` (canonical Amazon garment palette)
- [x] Create `MbaColorsView` (DRF APIView, `IsAuthenticated`, `CookieJWTAuthentication`) returning MBA_COLORS
- [x] Register URL `/api/mba/colors/` in `publish_app/urls.py`
- [x] Backend test: authenticated GET → 200 + correct shape
- [x] Backend test: unauthenticated GET → 401
- [x] Optional: response cached (HTTP cache headers or RTK cache TTL) — list changes rarely

### F3: Backend — Marketplace Conversion API (future — D6/D7 scope)

- [x] `POST /api/listings/convert/` endpoint — body `{source_listing_id, target_marketplace_type, overwrite: bool}` — returns created/updated Listing
- [x] Mapping logic: Global → MBA (Title/Brand/Bullet1 where data maps, rest empty); MBA → Global (simpler shape)
- [x] Backend test: convert when target does not exist → 201 create
- [x] Backend test: convert when target exists + `overwrite=false` → 409
- [x] Backend test: convert when target exists + `overwrite=true` → 200 update

### F4: Backend — Per-Design Product Config (added 2026-04-18)

> Spec: AC-38 to AC-44, EC-11 to EC-15. Blocks D7 Copy-from-Design for non-listing scopes and PROJ-13 upload matrix.

- [x] Add `DesignProductConfig` model to `publish_app/models.py`: UUID pk, `design` FK (DesignAsset, on_delete=CASCADE), `marketplace_type` CharField choices `[global, mba, displate]` default=`mba`, `product_types` JSONField default=list, `fit_types` JSONField default=list, `print_side` CharField choices `[front, back, both]` default=`front`, `colors` JSONField default=list, `marketplaces` JSONField default=list, `created_at`, `updated_at`
- [x] `UniqueConstraint(fields=['design', 'marketplace_type'], name='design_product_config_unique')` on Meta
- [x] Django migration — **run via Docker**
- [x] Admin registration for `DesignProductConfig` (read-only JSON previews)
- [x] `DesignProductConfigSerializer` — full read + partial write (all fields optional except `marketplace_type`)
- [x] Validation: `colors[]` entries must exist in `MBA_COLORS` palette (AC-37) when `marketplace_type=mba` — return 400 on unknown key
- [x] Validation: `marketplaces[*].price` Decimal > 0, `marketplaces[*].marketplace` non-empty string, `marketplaces[*].enabled` bool
- [x] `DesignProductConfigView` — `GET` + `PATCH` under `/api/designs/{design_id}/product-config/`
  - GET: `?marketplace_type=<mba|global|displate>` (default `mba`). 404 when row missing. 400 on invalid `marketplace_type`
  - PATCH: upsert semantics — `marketplace_type` required in body, creates row if missing, updates if exists. Workspace isolation via `design.workspace`. Returns 200 with full record
- [x] `DesignProductConfigCopyView` — `POST /api/designs/{design_id}/product-config/copy-from/`
  - Body: `{source_design_id, marketplace_type, scope}` where `scope` ∈ `[all, colors, fit_types, print_side, product_types, marketplaces]`
  - Atomic transaction: load source config → upsert target row → return target
  - 404 when source has no config for `marketplace_type`
  - 400 on unknown `scope`
  - Workspace isolation on BOTH source + target designs
  - `scope='all'` copies every JSON field + `print_side`
  - Scalar scope copies just that field (even if empty — EC-15)
- [x] Register URLs in `publish_app/api/urls.py`
- [x] Extend `UploadJob` / upload snapshot serializer — include associated `DesignProductConfig` so Desktop App (PROJ-13) receives variant matrix (AC-44)
- [x] Backend tests:
  - [x] Model: unique constraint per `(design, marketplace_type)`; cascade delete when design deleted (EC-11)
  - [x] GET: default marketplace_type=mba; explicit global; 404 when missing; 400 on invalid enum
  - [x] PATCH: create on first call; update on second; partial fields preserved; invalid color key → 400; invalid price → 400
  - [x] Copy-from: full scope copies all fields; `colors` scope copies only colors; empty source value copies through (EC-15); 404 when source missing; workspace isolation (404 when source in different workspace); 400 on unknown scope
  - [x] Marketplace tab isolation: config for `mba` does not leak into `global` (EC-12)
  - [x] Last-write-wins on concurrent PATCH (EC-14) — no optimistic locking, sequential writes confirm LWW
  - [x] Workspace isolation on GET + PATCH + copy-from (404 cross-workspace — avoids ID enumeration)

### F5: Backend — Listing Templates (added 2026-04-19)

> Spec: AC-45 to AC-51, EC-16, EC-21, EC-22, US 32–33. Enables saving standalone Listings as reusable text templates. Unlocks Convert with template source.

- [x] Add `is_template` BooleanField (default=False) to `Listing` model in `publish_app/models.py`
- [x] Django migration — backfill existing rows to `is_template=False`. Run via Docker
- [x] Model `clean()` method: when `is_template=True`, `design` must be NULL. Raise ValidationError "Template listings cannot be linked to a design" (EC-16)
- [x] `ListingSerializer` — validate `is_template=True` ↔ `design=None` mutual exclusion; return 400 on violation
- [x] `ListingSerializer` — reject `is_template` field transitions on PATCH (write-once at creation) (EC-21)
- [x] Default queryset on existing listing views filters `is_template=False`:
  - [x] `GET /api/ideas/<id>/listing/` — excludes templates (AC-51, EC-22)
  - [x] Any listing-by-design lookup endpoints — same filter (no other by-design lookup endpoints exist; gallery `has_listing` filter unaffected because templates have NULL design)
- [x] New view `ListingTemplateListCreateView`:
  - [x] `GET /api/listings/templates/` — paginated, `is_template=True` filter, workspace isolation via Listing.workspace FK (direct, not via `idea.niche.workspace`)
  - [x] Support `?marketplace_type=` filter
  - [x] Ordered by `-created_at`
  - [x] `POST /api/listings/templates/` — forces `is_template=True, design=NULL` regardless of request body. Returns 201
  - [x] Body validation: `idea` (required FK), `marketplace_type`, listing text fields (brand_name, title, bullet_1..5, description, backend_keywords, language)
- [x] `DELETE /api/listings/<id>/` — added DELETE method to `ListingUpdateView` (no prior DELETE existed). Workspace isolation enforced.
- [x] `ListingConvertView` — accept `source_listing_id` that references a template. Current null-design behavior (always create new target) remains. Target Listing has `is_template=False` (AC-50, both create and overwrite paths)
- [x] URL registration: `listings/templates/` in `publish_app/api/urls.py` (placed BEFORE `listings/<uuid:pk>/`)
- [x] Backend tests (`test_listing_templates.py`):
  - [x] Model: `is_template=True` + design set → ValidationError on `full_clean()`
  - [x] Model: `is_template=True` + design NULL → saves
  - [x] Model: `is_template=False` + design NULL → saves (existing behavior preserved)
  - [x] Serializer POST: template create succeeds with null design, 201 + persisted row
  - [x] Serializer POST: template create with design ID in body → 400 "Template listings cannot be linked to a design" (EC-16)
  - [x] Serializer PATCH: attempt to flip `is_template` → 400 (EC-21)
  - [x] GET `/api/listings/templates/`: returns only templates from caller's workspace
  - [x] GET: cross-workspace templates excluded
  - [x] GET: `?marketplace_type=` filter works
  - [x] GET `/api/ideas/<id>/listing/`: does NOT return templates (AC-51, EC-22)
  - [x] DELETE template: succeeds; cross-workspace DELETE → 404
  - [x] Convert with template source: creates new target Listing, `is_template=False` on target, original template unchanged
  - [x] URL ordering: `/api/listings/templates/` does not collide with `/api/listings/<uuid>/`

### F6: Backend — Default UploadTemplate + Convert Auto-Apply (added 2026-04-19)

> Spec: AC-52 to AC-59, EC-17 to EC-20, US 34–35. Designates one UploadTemplate per marketplace as workspace default; Convert auto-seeds DesignProductConfig from it when target has no config yet.

- [x] Add `is_default` BooleanField (default=False) to `UploadTemplate` model
- [x] Add `marketplace_type` CharField choices `[global, mba, displate]` default=`mba` to `UploadTemplate` model
- [x] `Meta.constraints` — `UniqueConstraint(fields=['workspace', 'marketplace_type'], condition=Q(is_default=True), name='upload_template_single_default')`
- [x] Django migration — backfill existing rows: `is_default=False, marketplace_type='mba'`. Partial unique index created. Run via Docker
- [x] `UploadTemplateSerializer` — expose `is_default` + `marketplace_type` (read + write)
- [x] `UploadTemplateViewSet` (or equivalent view):
  - [x] Override `perform_create` + `perform_update` — when incoming `is_default=True`, wrap in `transaction.atomic()`: UPDATE other UploadTemplates in same `(workspace, marketplace_type)` set to `is_default=False`, THEN save the incoming row (AC-54, AC-55, EC-18)
  - [x] Clear-then-set must happen before the save hits the unique constraint, or IntegrityError surfaces
- [x] New view `UploadTemplateDefaultView`:
  - [x] `GET /api/upload-templates/default/?marketplace_type=mba` — returns the single default UploadTemplate for workspace + marketplace_type; 404 if none set (AC-56)
  - [x] 400 on invalid `marketplace_type`; default to `mba` when omitted
- [x] `ListingConvertView` — extend auto-apply logic:
  - [x] After target Listing is created/updated, check: `target.design IS NOT NULL` AND no `DesignProductConfig` exists for `(target.design, target_marketplace_type)`
  - [x] If both true: look up default `UploadTemplate` for `(workspace, target_marketplace_type)` via new helper
  - [x] If default exists: create `DesignProductConfig` with `colors / fit_types / print_side / product_types / marketplaces` from the template (AC-57, AC-58)
  - [x] Include `product_config_seeded: bool` in Convert response body (always, true or false)
  - [x] If target.design IS NULL: skip auto-apply entirely (AC-59); `product_config_seeded=False`
  - [x] If existing ProductConfig found: skip auto-apply (EC-19); `product_config_seeded=False`
  - [x] If no default template set: skip auto-apply (EC-20); `product_config_seeded=False`
- [x] Seeding helper function `_seed_product_config_from_default(design, marketplace_type)`:
  - [x] Read-only against UploadTemplate (AC-58)
  - [x] Returns created `DesignProductConfig` instance or None
  - [x] Shared location in `views.py` or dedicated `services.py` (prefer services if views.py grows large)
- [x] URL registration: `upload-templates/default/` BEFORE viewset router to avoid shadowing by `<uuid:pk>`
- [x] Backend tests (`test_upload_template_default.py`):
  - [x] Model: partial unique constraint blocks two `is_default=True` rows for same `(workspace, marketplace_type)`; allows multiple per workspace across different marketplaces
  - [x] Model: flipping `is_default=False` allows another row to become default
  - [x] Serializer POST: create with `is_default=True` when another default exists → previous cleared, new one set (EC-18)
  - [x] Serializer PATCH: set `is_default=True` on existing template → previous default cleared atomically
  - [x] Serializer: `is_default=True` + no existing default → saves without touching siblings
  - [x] GET `/default/?marketplace_type=mba`: returns default; 404 when none; cross-workspace default excluded
  - [x] GET `/default/`: defaults to `marketplace_type=mba`
  - [x] GET `/default/?marketplace_type=invalid`: 400
- [x] Backend tests (`test_listing_convert.py` extension):
  - [x] Convert Global → MBA with workspace default set, target design has NO existing ProductConfig → `product_config_seeded=True`, new DesignProductConfig created with fields from default (AC-57)
  - [x] Convert Global → MBA with workspace default set, target design HAS existing ProductConfig → `product_config_seeded=False`, existing config unchanged (EC-19)
  - [x] Convert Global → MBA with NO workspace default set → `product_config_seeded=False`, Convert still succeeds (EC-20)
  - [x] Convert where target.design is NULL → `product_config_seeded=False` (AC-59)
  - [x] Auto-apply uses colors/fit_types/print_side/product_types/marketplaces from default template — verify each field matches
  - [x] Edit default UploadTemplate AFTER auto-apply → existing DesignProductConfig unchanged (AC-58 read-only)
  - [x] Delete workspace's only default UploadTemplate → no replacement promoted (EC-17); subsequent Convert has `product_config_seeded=False`

---

## Phase G: Frontend — Marketplace Type Integration (added 2026-04-18)

> Consumes F1-F3 backend endpoints. Depends on Phase F completion (or parallel where possible).

### G1: Frontend — Listing Record Per Tab

- [x] `getListing` RTK query accepts `marketplace_type` param
- [x] `activeMarketplace` tab state (already in D1) drives query param → loads correct Listing record on tab switch
- [x] Handle loading/error state when switching tabs (skeleton instead of spinner)
- [x] Handle 404 case: tab has no Listing yet → render empty form ready for user input

### G2: Frontend — ColorGrid Backend Verification

- [x] Verify `useGetMbaColorsQuery` (wired in D4) renders ColorGrid once F2 endpoint lands
- [x] Smoke test: loading skeleton → happy path with real colors
- [x] Remove any remaining error-state placeholder text

### G3: Frontend — Conversion UI (D6/D7 scope)

- [x] Command Palette action "Convert from Global" (context: `mba`) — calls `POST /api/listings/convert/`
- [x] Command Palette action "Convert from MBA" (context: `global`) — calls `POST /api/listings/convert/`
- [x] Confirm dialog when target marketplace_type already has a Listing: "Overwrite existing {target} data?" — NO silent overwrite
- [x] Wire conversion actions into `useListingEditor` (D7)
- [x] Success snackbar on convert + cache invalidation so new Listing appears

### G-Config: Frontend — Per-Design Product Config Wiring (added 2026-04-18)

> Depends on F4. Replaces current in-memory `productConfig` in `useEditView` with RTK-backed persistence. Closes D7 Copy-from-Design scopes beyond `listing`.

- [x] RTK Query endpoints in `publishSlice.ts`:
  - [x] `getProductConfig` — query `{designId, marketplace_type}`. Tag `ProductConfig:{designId}:{mt}`. Handle 404 as "empty defaults" (no error state)
  - [x] `updateProductConfig` (PATCH) — invalidates matching tag
  - [x] `copyProductConfigFrom` (POST) — invalidates target tag
  - [x] Add `'ProductConfig'` to `tagTypes`
  - [x] Export `useGetProductConfigQuery`, `useUpdateProductConfigMutation`, `useCopyProductConfigFromMutation`
- [x] `useProductConfig` hook (new, `hooks/useProductConfig.ts`):
  - [x] Loads config via `useGetProductConfigQuery({designId, marketplace_type})`
  - [x] Maps 404 → empty defaults (product_types=[], fit_types=[], print_side='front', colors=[], marketplaces=[])
  - [x] Exposes debounced auto-save (1200ms, same constant as `useListingEditor`)
  - [x] Individual setters (`setColors`, `setFitTypes`, `setPrintSide`, `setProductTypes`, `setMarketplaces`) each schedule auto-save
  - [x] `isSaving` / `isAutoSaving` flags exposed
  - [x] Silent auto-save failures (consistent with listing editor)
  - [x] Manual `flush()` to save pending edits on unmount / tab switch
- [x] Refactor `useEditView`:
  - [x] Replace local `productConfig` state with `useProductConfig({designId: activeDesign?.id, marketplaceType: activeMarketplace})`
  - [x] Remove `ProductConfigState`, `initialProductConfig`, manual setters that wrote local state
  - [x] On active design switch or marketplace switch: flush pending saves before unmount of previous hook instance
  - [x] Expose same section-setter surface to `EditView` (API unchanged for section components)
- [x] Refactor `applyCopy` in `useEditView`:
  - [x] Scopes `colors`, `fit_types`, `prices`, `product_types` now call `copyProductConfigFrom` mutation instead of no-op snackbar
  - [x] Map frontend scope names → backend scope keys (`prices` → `marketplaces`, others identity)
  - [x] Success snackbar + error handling (404 → "Source has no config for {marketplace}", EC-13)
  - [x] Scope `'listing'` path unchanged (still uses lazy listing fetch)
- [x] `CopyFromDesignDialog`:
  - [x] No UI changes — same picker, same Apply button
  - [x] Remove any "coming soon" hint for non-listing scopes once wired
- [x] Section component wiring (minimal):
  - [x] `ColorGrid` / `FitTypePrintSection` / `ProductTypeScroller` / `MarketplacePricing` unchanged — they already accept selected + onChange props
  - [x] EditView passes new setters from `useProductConfig`
- [x] Loading / empty states:
  - [x] Skeleton for each section while `isLoading` (first fetch)
  - [x] No skeleton on marketplace-tab switch if cache hit (use `isFetching` instead of `isLoading`)
- [x] Edge cases:
  - [x] EC-11: no UI impact (cascade delete is backend-only)
  - [x] EC-12: verify marketplace-tab switch refetches correct row (integration test)
  - [x] EC-13: copy-from 404 → warning snackbar with marketplace name
  - [x] EC-15: empty-value copy (source has `colors=[]`) → target becomes `colors=[]` (no short-circuit)
- [x] i18n keys:
  - [x] `publish.productConfig.saveError`
  - [x] `publish.copyFrom.sourceNoConfig` (replaces current "noListing" fallback for non-listing scopes)
  - [x] `publish.productConfig.loadError`
- [x] Tests:
  - [x] `useProductConfig`: 404 → defaults; PATCH debounce; flush on unmount; isSaving flag transitions (covered in useProductConfig.test.ts — 5 tests)
  - [x] `useEditView`: copy scope `colors` calls copyFrom mutation with correct body (covered in useEditView.copy.test.ts)
  - [x] Integration: switch marketplace tab → config changes; switch active design → config changes (covered in useEditView.configSwitch.test.ts — 4 tests)
  - [x] Copy dialog with non-listing scope: success path + 404 path (covered in CopyFromDesignDialog.test.tsx — 7 tests; 404/success snackbars live in useEditView.copy.test.ts since the dialog is dumb and just forwards intent to onConfirm)

---

## Phase E: i18n + Tests + Lint

### E1: i18n

- [x] Toolbar keys: `publish.toolbar.*`
- [x] Tab keys: `publish.tabs.*`
- [x] Collection keys: `publish.collections.*`
- [x] Command Palette keys: `publish.command.*`
- [x] Action Bar keys: `publish.actionBar.*`
- [x] Cloud keys: `publish.cloud.*`
- [x] Edit Page section keys: `publish.edit.*`
- [x] Edit Page action keys: `publish.edit.options`, `publish.edit.copyFrom`, etc.
- [x] Sync to DE, FR, ES, IT (5 locales)

### E2: Tests

- [x] Backend: Collection CRUD, tree, asset move, circular ref, workspace isolation (covered in A3)
- [x] Toolbar: 2 rows, tab switch, breadcrumb
- [x] Card Grid: grid/list, selection, hover actions
- [x] Collections Dialog: tree nav, folder CRUD
- [x] Command Palette: search, keyboard, context filter
- [x] Action Bar: appear/disappear, counter, actions
- [x] Cloud Tab: provider switch, connection states, import
- [x] Edit Page: thumbnail nav, char counters, Options ⊙
- [x] Listing Field: counter colors, AI Improve

### E3: Lint + Cleanup

- [x] Zero hardcoded colors/px — all theme tokens
- [x] All transitions via `DURATION.*` + `EASING.*`
- [x] Remove old `views/publish/` files after verification
- [x] `npm run lint` clean
- [x] `npm run test:ci` passes (864/864)
- [x] `ruff check django-app/` passes

---

## Phase H: Per-Card Quick Actions (added 2026-04-19)

> Spec: US 36–38, AC-60 to AC-63, EC-23 to EC-26. Unblocks single-card edit path + tag editing. Existing MoreVert and "Add Tags" link are rendered but inert.

### H1: Backend — Tag Patch Validation

- [x] `DesignAssetUpdateSerializer` — enforce per-tag max length 20 chars, max 10 tags total, reject whitespace-only tags. Return 400 with clear field errors.
- [x] Extend `test_views.py` (or new `test_design_tags.py`): PATCH happy path, >10 tags rejected, tag >20 chars rejected, whitespace-only rejected.

### H2: Frontend — Card 3-Dot Menu (AC-60, AC-61)

- [x] `DesignCard.tsx` — add anchor state for Menu, open on MoreVert click (`stopPropagation`)
- [x] MenuItems: Edit, Duplicate, Move to Collection, Add Tags, Delete (with icons + Delete in `error.main`)
- [x] New props: `onEditSingle(id)`, `onAddTags(id)`, `onDeleteSingle(id)` (duplicate/move already exist)
- [x] `PublishView` wires `onEditSingle` to `navigate('/publish/edit?designs=' + id)` (no selection required)
- [x] `PublishView` wires `onDeleteSingle` to `useDeleteDesignMutation` + confirm dialog
- [x] `PublishView` wires `onAddTags` to open the inline tag editor (H3)

### H3: Frontend — Inline Tag Editor (AC-62, AC-63, EC-24, EC-25, EC-26)

- [x] New `DesignCardTagEditor.tsx` — MUI `Autocomplete freeSolo multiple`, autofocus input, comma/Enter adds chip, backspace removes last
- [x] State flag on `DesignCard` (`tagsEditing: bool`) replaces the info strip's tag row + "Add Tags" link while editing
- [x] Blur / Enter → call `useUpdateDesignMutation` (PATCH `/api/designs/gallery/<id>/`) with `{ tags }`, optimistic update
- [x] Escape → discard, restore previous tags
- [x] Client-side dedup, reject whitespace-only, max 10 chips
- [x] Error snackbar on 400, RTK cache revert via `onQueryStarted`

### H4: Tests

- [x] `DesignCard.test.tsx` (extend or new) — MoreVert opens menu, menu item callbacks fire with design id, menu closes after click
- [x] `DesignCardTagEditor.test.tsx` — open → type → Enter → chip added; blur → mutation fired with tags; Escape → no mutation; duplicate input rejected
- [x] `PublishView` integration — card menu Edit navigates to `/publish/edit?designs=<id>` (Playwright-verified 2026-04-19)
- [x] Backend `test_design_tags.py` — serializer validation (max count, max length, whitespace) — 13 tests, implemented in H1

### H5: Delete Action — Live Verification (AC-64, EC-29)

> Delete is code-complete (Phase H2). This phase adds the missing AC + EC test coverage and an end-to-end Playwright smoke.

- [x] Add test in `DesignCardGrid.test.tsx`: menu item "Delete" fires `onDeleteSingle` with correct id (also covers Duplicate + Move menu items)
- [x] Add test in `PublishView.delete.test.tsx` (new): mount with 1 design → click menu Delete → Confirm → expect `deleteDesign` mutation called with id → expect success snackbar
- [x] Add test: mock delete mutation to reject 500 → expect optimistic revert + error snackbar (EC-29)
- [x] Playwright smoke — upload 1 design, open menu, click Delete, confirm, expect card gone + snackbar

### H6: Duplicate Action — Backend + Frontend (AC-65, AC-66, EC-27, EC-30)

**Backend:**
- [x] New view `DesignAssetDuplicateView` in `publish_app/api/views.py` — POST `/api/designs/gallery/<id>/duplicate/`
  - [x] Workspace isolation via `_get_workspace_id` (404 cross-workspace)
  - [x] Load source asset; return 404 if missing or cross-workspace (EC-27)
  - [x] Wrap in `transaction.atomic()` — file copy + DB row both succeed or neither (EC-30)
  - [x] Stream source file via `default_storage.open(source.file.name, 'rb')` into a new `ContentFile` → save with original filename prefix (storage auto-appends hash suffix)
  - [x] Create new `DesignAsset` with: new UUID auto, same `workspace`, same `file_name`, same `tags`, same `collection`, `source='upload'`, cleared `listing`/`idea`/`niche`, re-copied `dimensions`/`file_size`
  - [x] Return 201 with `DesignAssetSerializer(new_asset).data`
  - [x] Catch IOError / OSError during copy → raise ValidationError → 500 surfaces with clear message
- [x] URL registration in `publish_app/api/urls.py` — `designs/gallery/<uuid:pk>/duplicate/`
- [x] New `test_design_duplicate.py`:
  - [x] Happy path: POST → 201, new UUID differs, `collection`+`tags` inherited, `listing`+`idea`+`niche` null, file_size matches
  - [x] Cross-workspace → 404 (EC-27)
  - [x] Non-existent id → 404
  - [x] File missing from storage → 500 + no DB row (EC-30, use mock)
  - [x] Unauthenticated → 401
  - [x] Tags preserved
  - [x] Collection preserved (source in a subfolder → duplicate in same subfolder)
  - [x] Listing/idea/niche cleared even when source had them

**Frontend:**
- [x] `publishSlice.ts` — add `duplicateDesign` mutation: POST `/api/designs/gallery/<id>/duplicate/`, invalidates `GalleryList:LIST` tag
- [x] Export `useDuplicateDesignMutation`
- [x] `PublishView.tsx` — replace `onDuplicate={() => {}}` with `handleDuplicate(id)` calling the mutation; success + error snackbars
- [x] Thread `onDuplicate` through `DesignCardGrid` to `DesignCard` (already wired, just update handler)
- [x] Playwright smoke — click menu Duplicate → expect new card appears with same filename

### H7: Move Action — New MovePickerDialog (AC-67, AC-68, EC-28)

**Frontend:**
- [x] New component `frontend-ui/src/views/publish/partials/grid/MovePickerDialog.tsx`:
  - [x] Props: `open: bool`, `assetId: string | null`, `currentCollectionId: string | null`, `onClose`, `onMoved`
  - [x] Reuses `FolderTree` from `partials/collections/FolderTree.tsx`
  - [x] Adds a "Root" pseudo-node at the top of the tree
  - [x] Picker state: `selectedTargetId: string | null` (null = Root)
  - [x] Disables the asset's current collection in the tree (AC-68) — pass `disabledId` prop or filter via `FolderTree` or render inline
  - [x] Disables "Root" entry when asset's `collection === null`
  - [x] "Move Here" primary button, disabled until a valid target is picked
  - [x] On click: `useMoveAssetsMutation({ asset_ids: [assetId], collection_id: selectedTargetId })` → on success snackbar + onClose, on 404 error snackbar + invalidate `CollectionTree` (EC-28)
  - [x] Glassmorphism styling matching other publish dialogs, borderRadius in px-string pattern
- [x] `PublishView.tsx` — new state `moveTargetId: string | null`; replace `onMove={() => setCollectionsOpen(true)}` with `onMove={setMoveTargetId}`; render `<MovePickerDialog open={moveTargetId !== null} assetId={moveTargetId} currentCollectionId={...} />`
- [x] `FolderTree.tsx` — accept optional `disabledIds: Set<string>` prop; grey out + block selection when id matches
- [x] Tests:
  - [x] `MovePickerDialog.test.tsx` — renders tree + Root + Move Here button; Move Here disabled initially; click folder → Move Here enables; click Move Here → mutation fires with correct body; current collection is disabled
  - [x] EC-28: mutation 404 → error snackbar + tree refetch
- [x] Playwright smoke — open menu Move → pick "Test Folder" → Move Here → expect card moved

### H8: Spec + Docs Polish (tracking)

- [x] Update `docs/tasks/PROJ-11-tasks.md` totals note — now `864/864` frontend, `241/241` backend
- [x] Append H5-H7 tests to QA Report in spec
