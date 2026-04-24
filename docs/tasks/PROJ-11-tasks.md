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

## Phase H: Frontend + Backend — Per-Card Quick Actions (added 2026-04-19)

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

---

## Phase I: Backend — Listing Model Shrink + Rename (added 2026-04-23)

> Scope: AC-1 rewrite. Drop `bullet_3`, `bullet_4`, `bullet_5`; rename `backend_keywords` → `keyword_context`; rewrite `translations` JSON shape. Delete removed endpoints (`/listing/generate/`, `/tm-check/`).

### I1: Listing Model + Migration

- [x] Remove fields `bullet_3`, `bullet_4`, `bullet_5` from `Listing` model
- [x] Rename `backend_keywords` → `keyword_context` (Django RenameField, data preserved)
- [x] Update `translations` JSONField comment + validator to new shape `{lang: {title, bullet_1, bullet_2, description}}`
- [x] Django migration: generate with `makemigrations` — run via Docker (0007_listing_shrink_and_rename)
- [x] Data migration for `translations`: for each Listing row with legacy `{bullets: [...]}` shape, map first two entries to `bullet_1` + `bullet_2` keys; drop the `bullets` array (0008_listing_translations_shape)
- [x] Verify migration reversibility (for rollback safety) — `RunPython` with backward no-op (forward-only documented)
- [x] Update `ListingSerializer` fields list (drop bullets 3-5, rename key)
- [x] Update `ListingSerializer` validation: `keyword_context` `max_length=500`, not required, allows blank
- [x] `keyword_context` updates do NOT revert `status` to `draft` (EC-42) — `ListingUpdateView.patch` content_fields set excludes keyword_context

### I2: Remove `/listing/generate/` Endpoint

- [x] Delete view class `ListingGenerateView` (or function view) in `publish_app/api/views.py`
- [x] Remove URL route for `/api/ideas/{id}/listing/generate/`
- [x] Delete service module `publish_app/services/listing_generator.py`
- [x] Delete associated tests in `publish_app/tests/test_listing_generator.py`
- [x] Remove any references in admin / docstrings / comments

### I3: Remove `/tm-check/` Endpoint

- [x] Delete view class `ListingTMCheckView` in `publish_app/api/views.py`
- [x] Remove URL route for `/api/listings/{id}/tm-check/`
- [x] Delete service module `publish_app/services/tm_checker.py`
- [x] Delete trademark fixture / seed data if any (`publish_app/fixtures/tm_terms.json` etc.) — none existed
- [x] Delete associated tests — removed `TMCheckSerializer` (last dead reference)

### I4: Backend Tests

- [x] Update `test_listing_serializer.py` — remove bullets 3-5 assertions, rename keyword field — created new `test_listing_serializer.py` (13 tests) covering `ListingSerializer` / `ListingUpdateSerializer` / `ListingTemplateCreateSerializer` field shape + keyword_context rules; also fixed stale `backend_keywords` payload in `test_listing_templates.py`
- [x] New test: `keyword_context` PATCH does not revert status — `TestListingUpdateView.test_keyword_context_patch_does_not_revert_status` in `test_views.py` (EC-42)
- [x] New test: legacy `translations.bullets` array migrates to `bullet_1` + `bullet_2` (truncates over 2) — `test_listing_translations_migration.py` covers promote / truncate / no-op / stale-key / non-dict cases
- [x] Delete tests for removed generate + tm-check endpoints — confirmed absent (removed in I2/I3)
- [x] `pytest publish_app` — all green (248 passed)

---

## Phase J: Backend — DesignProductConfig Restructure (added 2026-04-23)

> Scope: AC-38 rewrite. Collapse flat fields (`product_types`, `fit_types`, `print_side`, `colors`, `marketplaces`) into per-product JSON `products_config`.

### J1: Model + Migration

- [x] Add `products_config` JSONField (default=list) to `DesignProductConfig`
- [x] Data migration: for each existing row, for each `product_type` in legacy `product_types[]`, emit one `products_config` entry copying shared `fit_types`, `print_side`, `colors`, `marketplaces` into that entry
- [x] Data migration: drop rows where legacy `product_types=[]` (nothing to migrate) OR emit empty `products_config=[]`
- [x] Remove legacy columns `product_types`, `fit_types`, `print_side`, `colors`, `marketplaces`
- [x] Verify unique constraint `(design, marketplace_type)` still enforced
- [x] Migration reversibility note: flat shape cannot be perfectly restored (per-product divergence lost). Document as forward-only
- [x] Run migration via Docker, verify with `showmigrations`

### J2: Serializer + Validation

> Completed 2026-04-23 (MVP-safe shape/type validation per Q1=A). Catalog-referential checks (`product_type` key, per-product `fit_types`/`colors`/`marketplaces` subsets) land in Phase L once `MBA_PRODUCT_CATALOG` exists. `_seed_product_config_from_default` temp-stubbed to return `None` until K3 (Q2=A).

- [x] Rewrite `DesignProductConfigSerializer` to accept `products_config` JSON
- [x] Per-entry MVP-safe validation: shape (dict with known keys), types (`enabled` bool, `fit_types`/`colors` str lists, `print_side` ∈ {front,back,both}), `colors` ⊆ `MBA_COLORS` when marketplace_type=mba, `marketplaces[*].price` ≥ 0, `marketplaces[*].enabled` bool
- [x] Full catalog-referential validation (Phase L): `product_type` exists in catalog (AC-37), `fit_types` ⊆ catalog.fit_types_options, `colors` ⊆ catalog.colors_options, `marketplaces[*].marketplace` ⊆ catalog.marketplaces — delivered in L3 via `validators.py`, wired into `DesignProductConfigSerializer`
- [x] Targeted op support on PATCH: body `{marketplace_type, op: 'upsert_product', product_type, patch: {...}}` for single-product mutations (AC-40)
- [x] Full replace: body `{marketplace_type, products_config: [...]}` overwrites entire list
- [x] Reject body missing `marketplace_type` with 400
- [x] Reject duplicate `product_type` keys within a full-replace payload
- [x] `_seed_product_config_from_default` temp-stubbed (Q2=A) — returns `None` until K3

### J3: Copy-From Endpoint Updates

> Completed 2026-04-23 alongside J2.

- [x] Update `POST /api/designs/{id}/product-config/copy-from/` body to accept optional `product_type` (AC-41)
- [x] Scope behaviors:
  - [x] `scope=all` → copy entire `products_config`
  - [x] `scope=<field>` + `product_type` given → copy that field for the matching entry (scope ∈ `fit_types`/`print_side`/`colors`/`marketplaces`/`enabled`)
  - [x] `scope=<field>` + no `product_type` → apply to all entries in target
- [x] 404 when source has no matching `products_config` for `marketplace_type`
- [x] 404 when scalar scope + product_type but source entry missing
- [x] Legacy `scope=product_types` rejected with 400 (replaced by scope=all)
- [x] Workspace isolation check on both source + target

### J4: Backend Tests

> Completed 2026-04-23 (Q3=A, test file fully rewritten).

- [x] Serializer validation: duplicate product_type keys → 400
- [x] Serializer validation: unknown per-entry key → 400
- [x] Serializer validation: invalid `print_side` → 400
- [x] Serializer validation: missing required entry keys (full-replace) → 400
- [x] Serializer validation: missing `marketplace_type` → 400
- [x] Serializer validation: both `products_config` + `op` in body → 400
- [x] MBA color palette enforced on `products_config[*].colors`
- [x] Zero price accepted (Q1=A: price ≥ 0, not > 0)
- [x] Negative price rejected
- [x] Targeted op: `upsert_product` for existing product updates only that entry
- [x] Targeted op: `upsert_product` for new product appends entry
- [x] Targeted op: `upsert_product` on missing design config creates row
- [x] Targeted op: invalid patch (unknown MBA color) → 400
- [x] Copy-from scalar scope + product_type: copies only one field, one product
- [x] Copy-from scalar scope + no product_type: applies across all target entries
- [x] Copy-from scalar scope + product_type missing on source → 404
- [x] Data migration test: legacy row → expanded per-product entries — covered by `test_upload_template_migration.py` (0010 uses identical `migrate_products_config_forward` logic as 0009; 7 tests cover expand, empty, missing, non-string filter, deep-copy, non-dict filter, backward no-op)
- [x] EC-35: migration lossiness documented + tested — `TestUploadTemplateMigrationBackward::test_backward_is_noop`
- [x] `pytest publish_app` green (270 passed)

---

## Phase K: Backend — UploadTemplate Shape Alignment (added 2026-04-23)

> Scope: Option A — UploadTemplate mitmigriert auf `products_config` (same shape as DesignProductConfig). Convert-Auto-Apply (AC-57) seeds directly without fan-out.

### K1: Model + Migration

> Completed 2026-04-23 (bundled with K2+K3 per Q1=C, matches J1 pattern).

- [x] Add `products_config` JSONField (default=list) to `UploadTemplate`
- [x] Data migration: collapse legacy `product_types` + shared `fit_types` / `print_side` / `colors` / `marketplaces` into per-product entries (migration `0010_uploadtemplate_products_config.py`)
- [x] Remove legacy columns `product_types`, `fit_types`, `print_side`, `colors`, `marketplaces` from `UploadTemplate`
- [x] Preserve: `name`, `brand_name`, `is_default`, `marketplace_type`, partial unique constraint
- [x] Run migration via Docker (`showmigrations` confirms `[X] 0010_uploadtemplate_products_config`)

### K2: Serializer + Validation

> Completed 2026-04-23. MVP-safe validation (shape/types/MBA colors/price ≥ 0) per J2 pattern. Full catalog-referential checks deferred to Phase L.

- [x] Rewrite `UploadTemplateSerializer` to accept `products_config` (same schema as DesignProductConfig)
- [ ] Same catalog-referential validation as J2 (deferred to Phase L alongside J2 equivalent)

### K3: Convert Auto-Apply Update

> Completed 2026-04-23. Temp-stub from J2 replaced with real implementation.

- [x] Rewrite seeding helper in `ListingConvertView`: read `default_template.products_config` → assign directly to new `DesignProductConfig.products_config` (no fan-out needed — shapes match)
- [x] `product_config_seeded` response flag behavior unchanged (AC-57)

### K4: Backend Tests

> Completed 2026-04-23.

- [x] Update UploadTemplate CRUD tests to new shape (`test_upload_template_default.py`, `test_views.py` fixtures, `test_models.py` adjusted)
- [x] Convert + default template: target gets seeded with `products_config` copied verbatim (`test_listing_convert.py` reinstated happy-path seed tests)
- [x] Template without default still seeds nothing (AC-57 unchanged — existing test adjusted)

---

## Phase L: Backend — MBA Product Catalog (added 2026-04-23)

> Scope: AC-37 (rewritten). Python constant + read-only endpoint. 17 product entries.

### L1: Catalog Data Module

> Completed 2026-04-23. MVP ships EN labels only per the simplest i18n hook option.

- [x] Create `publish_app/catalogs/__init__.py` (new subpackage)
- [x] Create `publish_app/catalogs/mba_catalog.py` exporting `MBA_PRODUCT_CATALOG: tuple[dict, ...]`
- [x] Populate 17 product entries with: `key`, `label` (English base), `icon_key`, `supports`, `fit_types_options`, `print_side_options`, `colors_options` (key/name/hex), `marketplaces`, `default_prices`, `royalty_formula` (coef/base per marketplace)
- [x] Verify all `icon_key` values match `PRODUCT_ICON_MAP` keys in frontend — enforced both server-side (`test_mba_product_catalog.py::test_catalog_icon_keys_match_frontend_product_icon_map_fixture`) and client-side (`ProductIcons.test.tsx::Backend catalog contract`)
- [x] Use Amazon's published royalty formulas for `coef` + `base` (documented in module docstring)
- [x] Include i18n hook: EN labels only for MVP — frontend i18n via `PRODUCT_LABEL_I18N`

### L2: Endpoint View

> Completed 2026-04-23. Legacy `/api/mba/colors/` kept as deprecated alias (1 release grace period).

- [x] Create `MbaProductCatalogView` (DRF APIView, GET-only, default `permission_classes` inherits IsAuthenticated)
- [x] Return `MBA_PRODUCT_CATALOG` directly as JSON response (no serializer needed)
- [x] Add `Cache-Control: public, max-age=86400` response header (24h)
- [x] URL route: `GET /api/mba/product-catalog/`
- [x] Register in `publish_app/api/urls.py` (skill forgot URL-register; added manually after skill)
- [x] Keep legacy `/api/mba/colors/` view + route as deprecated alias for 1 release

### L3: Validation Helper

> Completed 2026-04-23. Catalog-referential checks now enforced in both serializers (layered on top of J2 MVP-safe validation).

- [x] Create helper module `publish_app/catalogs/validators.py` exporting `get_product(key)`, `valid_color_keys(product_key)`, `valid_fit_types(product_key)`, `valid_print_sides(product_key)`, `valid_marketplaces(product_key)`, `CATALOG_KEYS` frozenset
- [x] Used by `DesignProductConfigSerializer` + `UploadTemplateSerializer` for AC-38 validation (product_type ∈ CATALOG_KEYS, fit_types/colors/marketplaces/print_side subsets per product)

### L4: Backend Tests

> Completed 2026-04-23. `publish_app/tests/test_mba_product_catalog.py` (9 tests, all green). Fixture for N1 contract: `publish_app/tests/fixtures/product_icon_map_keys.json`.

- [x] Endpoint returns 20 entries
- [x] Cache-Control header present
- [x] Auth required (401 when unauthenticated)
- [x] Shape assertion: every entry has required keys
- [x] Helper: unknown product key → raises / returns None per contract
- [x] Contract test: every `icon_key` matches the frontend `PRODUCT_ICON_MAP` keys list (maintained as JSON fixture)

---

## Phase M: Backend — AI-Improve Service + Endpoint (added 2026-04-23)

> Scope: AC-69 to AC-72. Replaces removed AC-6 generate endpoint. Unified "generate or improve" via one LLM call.

### M1: Service Module

> Completed 2026-04-23. Extended same day: DB-backed LLM config via `ListingImproveNodeConfig` (Admin-editable, mirrors `SloganNodeConfig` / `ResearchNodeConfig`) + cached vision pass on `DesignAsset.vision_analysis`. Env-var path (M4) no longer needed — Admin-Config pattern replaces it. 40 tests in `test_ai_improve.py`.

- [x] Create `publish_app/services/ai_improve.py` with pure functions:
  - [x] `build_prompt(listing, vision_context, keyword_context, language) -> list[dict]` — system + text-only user message. Vision context is the cached dict from `ensure_design_vision` (no raw image URL in this call). Embeds existing listing copy, keyword_context hint, marketplace_type, localized language name via `LANGUAGE_NAMES` from translator
  - [x] `ensure_design_vision(design_asset) -> dict` — cache-aware. Returns `DesignAsset.vision_analysis` when non-empty; otherwise runs the `design_vision` LLM node, normalizes output, persists via `update_fields=['vision_analysis']`, and returns the structured dict (`description`, `visual_style`, `graphic_elements`, `layout_composition`, `dominant_colors[]`, `detected_text`, `analyzed_at`, `model`)
  - [x] `call_llm(messages) -> dict` — OpenRouter via `ChatOpenAI` client. Reads model + temperature + max_tokens + system_prompt from `ListingImproveNodeConfig(node_name='ai_improve')` (falls back to code defaults). JSON mode via `response_format`
  - [x] `get_ai_improve_llm()` / `get_design_vision_llm()` — DB-backed factory helpers (mirrors `niche_research_app/graph/llm.py::get_llm_for_node`)
  - [x] `validate_and_truncate(response_dict) -> (fields_dict, truncated_keys: list)` — coerces 5 `EXPECTED_FIELDS` to strings, truncates to `CHAR_LIMITS` from `translator.py`
  - [x] `apply_to_listing(listing, fields) -> Listing` — validates via `ListingSerializer`, sets `generated_by='ai'`, reverts `status='draft'`, saves with `update_fields`, refreshes from DB
- [x] Default system prompts live in `publish_app/services/ai_improve_prompts.py` (kept out of service module so the seed migration can import without touching LangChain)
- [x] New model `ListingImproveNodeConfig` (node_name, model_name, temperature, max_tokens, system_prompt, updated_at) + admin registration
- [x] New field `DesignAsset.vision_analysis` (JSONField, default=dict). Invalidation on file replacement is manual (tech debt documented in model docstring)
- [x] Migration `0011_listingimprovenodeconfig_designasset_vision` (CreateModel + AddField)
- [x] Migration `0012_seed_listing_improve_node_config` (seeds `ai_improve` + `design_vision` rows with default prompts/models)
- [x] Handle LLM JSON parsing failures → raise `AIImproveError("LLM returned non-JSON response")` (also wraps upstream exceptions + non-dict inputs)
- [x] Log LLM request + response to Langfuse (trace + generation spans, mirrors `design_app/services/image_analyzer.py` pattern)
- [x] Respect `listing.language` for prompt localization (unknown codes fall back to raw code so LLM still gets usable instruction)

### M2: View + URL

> Completed 2026-04-23 (bundled with M3 per Q1=A).

- [x] Create `ListingAIImproveView` (DRF APIView, POST, IsAuthenticated inherited, `throttle_classes=[AIImproveThrottle]`)
- [x] Workspace isolation: load Listing via direct `workspace_id` FK filter (matches other Listing views); 404 on mismatch
- [x] Guard: if `listing.design is None` → return 400 `{error: "AI Improve requires a linked design asset"}` (EC-31)
- [x] Response 200 shape: `{listing: {...}, truncated_fields: []}`
- [x] Response 502 on LLM failure (EC-33) — generic `{error: "AI Improve LLM call failed"}`, full exception logged via `logger.exception`; listing unchanged because pipeline raises BEFORE `apply_to_listing`
- [x] URL route: `POST /api/listings/{id}/ai-improve/`
- [x] Pipeline: `ensure_design_vision → build_prompt → call_llm → validate_and_truncate → apply_to_listing`
- [x] 4 inline tests in `test_views.py::TestListingAIImproveView` (happy-path, 400 no-design, 502 LLM-raise w/ DB-unchanged assert, 404 cross-workspace)

### M3: Rate Limiting

> Completed 2026-04-23 (bundled with M2).

- [x] Create `publish_app/api/throttles.py` with class `AIImproveThrottle(UserRateThrottle)` — `scope = 'ai_improve'` (rate resolved from `DEFAULT_THROTTLE_RATES`)
- [x] Add `DEFAULT_THROTTLE_RATES['ai_improve'] = '10/min'` in settings.py
- [x] Tests auto-disable throttle via `conftest.py::disable_throttling` fixture (added `ai_improve: 10000/day` entry)

### M4: Env Vars

> Superseded 2026-04-23 by M1 extension: LLM config now lives in `ListingImproveNodeConfig` (Admin-editable, DB-backed), matching the `SloganNodeConfig` / `ResearchNodeConfig` pattern. No env-var wiring needed. Seed migration `0012_seed_listing_improve_node_config` provides first-boot defaults.

- [x] ~~Env-var wiring~~ → replaced by `ListingImproveNodeConfig` Admin-Config pattern (Q1=A decision)

### M5: Backend Tests

> Completed 2026-04-23. Bullets 1-5, 7-9 already shipped with M1/M2/M3 (see `test_ai_improve.py` 40 tests + `test_views.py::TestListingAIImproveView` 4 tests). M5 only needed the 429 throttle test. Bullet 1 text is stale from the M1-V1 era (no raw image URL in AI-Improve call post-extension — `vision_context` dict is embedded as text; vision image URL lives in `ensure_design_vision` only) — corrected below.

- [x] ~~`build_prompt` includes design image URL~~ + `keyword_context` + existing text (vision URL lives in `ensure_design_vision`, not AI-Improve prompt — covered by `TestBuildPrompt::test_user_message_includes_keyword_context_hint` + `test_user_message_includes_existing_listing_copy` + `test_user_message_includes_vision_block`)
- [x] `validate_and_truncate` caps Title at 60, Bullets at 256, Description at 2000 → truncated keys returned (`test_truncates_{title,bullets,description}_over_*_chars`)
- [x] `validate_and_truncate` returns empty truncated list when all fields within limit (`test_returns_all_5_fields_within_limits`)
- [x] Endpoint returns 400 when design is null (`test_returns_400_when_design_is_null`)
- [x] Endpoint returns 200 with updated listing when happy path (`test_happy_path_returns_updated_listing`)
- [x] Endpoint returns 429 after 10 calls/min (`test_returns_429_after_10_calls_per_minute` — `patch.object(AIImproveThrottle, 'THROTTLE_RATES', {'ai_improve': '10/min'})` + cache clear; asserts pipeline short-circuits before `ensure_design_vision` / `call_llm`)
- [x] Endpoint returns 502 when LLM raises; listing unchanged in DB (`test_returns_502_when_llm_raises_and_listing_unchanged`)
- [x] Workspace isolation: 404 on cross-workspace listing (`test_returns_404_on_cross_workspace_listing`)
- [x] Mock `call_llm` — never hit OpenRouter in tests (all 45 AI-Improve tests use `unittest.mock.patch`)

---

## Phase N: Frontend — Product SVG Icons (added 2026-04-23)

> Scope: AC-78 to AC-80. 20 custom React SVG components replacing the generic hanger icon.

### N1: Icon Components

- [x] Create `frontend-ui/src/components/ProductIcons/` directory
- [x] One file per product (20 total, matching catalog icon_keys): `TShirtIcon.tsx`, `TShirtPremiumIcon.tsx`, `TShirtHeavyweightIcon.tsx`, `VNeckIcon.tsx`, `TankTopIcon.tsx`, `LongSleeveIcon.tsx`, `RaglanIcon.tsx`, `SweatshirtIcon.tsx`, `HoodiePulloverIcon.tsx`, `HoodieZipIcon.tsx`, `PerformanceIcon.tsx`, `BaseballIcon.tsx`, `TruckerHatIcon.tsx`, `PopSocketIcon.tsx`, `PhoneCaseIcon.tsx`, `ThrowPillowIcon.tsx`, `ToteBagIcon.tsx`, `TumblerIcon.tsx`, `MugIcon.tsx`, `WaterBottleIcon.tsx`
- [x] Each component: arrow-function, props `{ size?: number; color?: string }`, default size 40, `currentColor` for stroke, `viewBox 0 0 40 40`
- [x] Line-based drawings, stroke-width 1.75px, Iconoir/Tabler style
- [x] Product-shaped silhouettes (not hangers)
- [x] Export each as named export from its own file

### N2: Icon Map

- [x] Create `frontend-ui/src/components/ProductIcons/index.ts` with barrel export
- [x] Export `PRODUCT_ICON_MAP: Record<string, FC<IconProps>>` keyed by catalog `icon_key` values
- [x] Export `IconProps` TypeScript interface
- [x] Keys match `MBA_PRODUCT_CATALOG[*].icon_key` — verified against `product_icon_map_keys.json` fixture (20/20)

### N3: Frontend Tests

- [x] One snapshot test per icon component (20 tests)
- [x] `PRODUCT_ICON_MAP` exports all 20 keys
- [x] Icon inherits theme color via `currentColor` (+ size/color prop overrides)
- [x] Contract test: every key in `PRODUCT_ICON_MAP` is also present in the backend catalog fixture (`product_icon_map_keys.json` — read via `fs` at test time)

---

## Phase O: Frontend — State + Auto-Save Hybrid (added 2026-04-23)

> Scope: AC-43 rewrite, AC-73 to AC-77. Refactor `useEditView` to 3 setter categories + manual save + offline queue.

### O1: publishSlice RTK Query Endpoints

> Completed 2026-04-23. Types refactored for J2 shape (`DesignProductConfig.products_config`, discriminated upsert/replace/legacy union). Removed endpoint consumers stubbed — `handleGenerate` / `handleTMCheck` kept as no-ops until Phase O2 rewrites `useListingEditor` → `useEditView`; `TMCheckDialog.tsx` deleted; TM-Check button disabled in `OptionsTrademarksTabs`.

- [x] Add `getMbaProductCatalog` query endpoint (`keepUnusedDataFor=24h`, tag `MbaCatalog`)
- [x] Add `aiImproveListing` mutation endpoint (POST `/api/listings/{id}/ai-improve/`, invalidates `Listing` id + `{idea}:{marketplace_type}` pair)
- [x] Remove `generateListing` mutation endpoint (+ `GenerateListingBody` import + `useGenerateListingMutation` export)
- [x] Remove `tmCheck` mutation endpoint (+ `TMCheckResult` import + `useTmCheckMutation` export)
- [x] Update `updateProductConfig` mutation body to accept targeted `op=upsert_product` payload (+ legacy flat shape kept `@deprecated` on the type for pre-O2 callers)
- [x] Update `copyProductConfigFrom` mutation to forward optional `product_type`

### O2: useEditView Hook Refactor

> Completed 2026-04-23. New hook `useEditFormState` added at `views/publish/hooks/useEditFormState.ts` (~270 lines) + pure helper `royaltyFor.ts`. Exposed through `useEditView` under a namespaced `editFormState` prop so Phase P can adopt without touching legacy paths. Frontend `Listing` type updated for Phase I backend shape (bullet_3..5 dropped, `backend_keywords` → `keyword_context`; legacy fields kept `@deprecated` optional for pre-O2 callers).

- [x] Split setters into 3 factories:
  - [x] `controlSetters` — immediate PATCH on change via `op=upsert_product` (toggleProductEnabled, setFitTypes, setPrintSide, setColors, setMarketplaces)
  - [x] `priceSetters` — 400ms debounced PATCH per `(product, marketplace)` key
  - [x] `textSetters` — on-blur-if-dirty PATCH (Brand, Title, Bullet 1, Bullet 2, Description, Keyword Context) via `onBlur` + buffered `onChange`
- [x] Expose `isDirty: bool`, `isSaving: bool`, `saveError: Error | null`
- [x] Expose `manualSave()` — flushes buffered text + pending debounced prices in parallel
- [x] Expose `discard()` — clears buffered text + pending prices, cancels timers (no PATCH)
- [x] Expose `focusedProduct: string | null` + `setFocusedProduct(key)`
- [x] Expose `royaltyFor(productKey, marketplace, price): number | null` pure function (catalog-driven, clamps negative to 0)
- [x] Expose `aiImprove()` mutation trigger

### O3: UnsavedChangesBanner Component

> Completed 2026-04-23. New banner lives at `views/publish/partials/editor/UnsavedChangesBanner.tsx` and covers all 5 states via a priority ladder (offline > failed > saving > saved toast > unsaved). Variant drives colour via `variantPalette` map (warningDk/infoDk/successDk/errorDk/warningDkShade). Integration into `EditView` (swap of `UnsavedChangesBar` → `UnsavedChangesBanner`) lands with Phase P once `useEditFormState` is wired through `useEditView`. 11-test suite in `tests/UnsavedChangesBanner.test.tsx` (visibility, save/discard+ConfirmDialog, saving/failed/offline variants, 2s Saved auto-hide). i18n keys added under `publish.edit.unsaved.*`.

- [x] New component `views/publish/partials/editor/UnsavedChangesBanner.tsx`
- [x] Sticky top, `position: sticky; top: 0`, slide-in animation (MUI `Slide` direction=down, `DURATION.default`)
- [x] States: Unsaved (amber) / Saving (spinner) / Saved (2s green toast, auto-hide) / Failed (red + Retry) / Offline (orange)
- [x] Save button → calls `onSave()` (wired to `manualSave()` when composed into Edit page in Phase P)
- [x] Discard button → `ConfirmDialog` "Discard unsaved changes?" → `onDiscard()` (wired to `discard()` in Phase P)
- [x] Offline chip shown when `navigator.onLine === false` (also drives the dedicated "offline" variant when pending changes exist)

### O4: Offline Queue Hook

> Completed 2026-04-23. New hook `useOfflineQueue<P>({ storageKey, executor, classifyError? })` at `views/publish/hooks/useOfflineQueue.ts` exposes `{ isOnline, queueLength, enqueue(payload): Promise<void> }`. Payload-based API (serializable, not closures) → queue survives page reloads via localStorage; hydrates on mount and auto-flushes when online. Online path pushes + flushes immediately; offline path buffers FIFO until the next `online` event. Failure handling: caller-provided `classifyError(err) → 'retry' | 'drop'` decides the per-op fate — `'retry'` leaves the op at head and halts flush (transient errors), `'drop'` shifts the op out permanently and keeps draining (non-transient errors like 4xx validation). Default: `'retry'` (conservative). Concurrent flushes coalesced via a running-flag ref. Storage key is scoped to `{userId}:{workspaceId}` (prefix `mm.publish.editFormQueue.v1`) so queues on shared machines can't leak across users or workspaces — passing `storageKey: null` makes the hook ref-only (no persist). Storage-key changes mid-life reset the in-memory queue and re-hydrate from the new scope's slot. Shared storage helpers live in `hooks/editQueueStorage.ts` (`PUBLISH_EDIT_QUEUE_KEY_PREFIX` + `buildPublishEditQueueKey` + `clearPublishEditQueues`). Logout cleanup: `clearPublishEditQueues()` wipes every `mm.publish.editFormQueue.v1:*` entry from localStorage and is invoked in both `clearAuth` dispatch sites — `ProfileMenu.handleSignOut` (user logout) and `authService.ts` 401 interceptor (refresh fail). Integrated into `useEditFormState` with a `QueuePayload` union (`updateProductConfig` | `updateListing`), an executor that re-dispatches through the existing RTK triggers, and a `classifyQueueError` that drops on HTTP 4xx and retries on 5xx / `'FETCH_ERROR'` / unknown shapes. `useEditFormState` reads `state.auth.user.id` + `state.workspace.activeWorkspaceId` via `useAppSelector` and re-exposes `isOnline` + `queueLength`. Banner integration: `UnsavedChangesBanner` accepts `queueLength?` (default 0), raises the `offline` variant whenever the queue has items (even without local dirty state, so a post-reload offline state still surfaces the banner), and renders a "N queued" chip (`publish.edit.unsaved.queued` key, `{{count}}` plural-ready). 10-test unit suite in `tests/useOfflineQueue.test.ts` (online fast-path, offline buffer + persist, FIFO flush, retry-on-failure, hydrate + auto-flush, hydrate while offline, isOnline reactivity, null key = ref-only, storage-key change resets + re-hydrates, classifyError=drop). Integration tests in `tests/useEditFormState.test.ts` cover the O6 FIFO scenario, per-(user, workspace) storage-key scoping, ref-only fallback when user id is missing, **4xx-drop** (attempted once → queue cleared), and **5xx-retry** (op stays queued until server recovers). 8-test suite in `tests/editQueueStorage.test.ts` covers key builder + `clearPublishEditQueues` (removes matching, leaves unrelated + bare-prefix keys alone). 3 banner tests (queue chip shown offline, post-reload visibility when queue > 0 and not dirty, chip omitted when queueLength=0). Full suite: **956/956** tests green, tsc clean, eslint clean.

- [x] New hook `useOfflineQueue` in `views/publish/hooks/`
- [x] Detects `offline` / `online` events
- [x] Queues pending PATCHes in a ref + mirrored to `localStorage`; storage key scoped to `{userId}:{workspaceId}` (prefix `mm.publish.editFormQueue.v1`) with a null-key fallback for pre-auth bootstrap
- [x] Storage-key change (user / workspace switch) resets in-memory queue + re-hydrates from the new scope's slot
- [x] On `online`, replays queue in FIFO order via RTK mutation triggers
- [x] Failure classifier: 4xx → drop (discard + keep draining); 5xx / network / unknown → retry (hold at head)
- [x] Logout cleanup: `clearPublishEditQueues()` wipes every `mm.publish.editFormQueue.v1:*` entry; wired into `ProfileMenu.handleSignOut` + `authService.ts` 401 interceptor
- [x] Exposes `queueLength: number` + surfaces it via `UnsavedChangesBanner` "N queued" chip (offline variant)
- [x] Tests: offline → toggle control → queued; online event → flushed in order; retry-on-failure; hydrate-from-storage; per-scope storage key; null-key ref-only; storage-key change re-hydrates; 4xx drop vs 5xx retry; `clearPublishEditQueues` scoping

### O5: Concurrency Serialization

> Completed 2026-04-23. Per-key promise chain lives in `useEditFormState.queueExecutor`. `perKeyChainsRef: Map<string, Promise<unknown>>` holds the tail promise for each bucket; `patchKeyOf(payload)` returns `pc:{designId}:{marketplace_type}` for `updateProductConfig` ops and `l:{listingId}` for `updateListing` ops (prefixes guarantee the buckets can't collide). Each executor call `.then`s off the current tail (swallowing prior rejections via `.catch(() => undefined)` so one failure doesn't poison later ops in the same bucket) and stores the new tail. Stored tail also swallows errors, and a `.then`-based cleanup removes the Map entry once this op becomes the tail and settles — bounded memory across long edit sessions. The chain layers on top of the O4 offline queue's global FIFO drain: the queue already orders all replay, but the chain makes the EC-38 guarantee explicit, payload-shape-aware, and stable even if any future caller reaches the executor directly. 3 new tests in `tests/useEditFormState.test.ts` cover: two same-listing blur PATCHes (second awaits first's resolution), two same-`(design, marketplace)` control PATCHes (second awaits first), and chain recovery after a 4xx drop (subsequent same-key PATCH still fires). Full suite: **959/959** tests green.

- [x] `useEditFormState` serializes PATCHes per `(listing_id)` and per `(design_id, marketplace_type)` via promise chain
- [x] Prevents client-side races (EC-38)

### O6: Frontend Tests

> Partially completed 2026-04-23. `views/publish/tests/useEditFormState.test.ts` (12 tests, all green) covers the O2 hook surface. Banner "Saved ✓" visual test shipped in `tests/UnsavedChangesBanner.test.tsx` (2s auto-hide + non-error guard). Offline queue tests land with O4.

- [x] Control click → immediate mutation fires (`controlSetters.toggleProductEnabled` + `controlSetters.setColors`)
- [x] Price input → 4 keystrokes "1999" → 1 mutation 400ms after last keystroke
- [x] Text field blur with no change → no mutation
- [x] Text field blur with change → PATCH with partial body (only changed key)
- [x] manualSave flushes pending blur + pending debounced prices
- [x] Discard clears buffered text + pending prices; no mutation fires after debounce window
- [x] Offline queue: offline → 3 toggles → queue=3 → online → 3 PATCHes fire in order (Phase O4)

---

## Phase P: Frontend — Edit-Page Components (added 2026-04-23)

> Scope: AC-38/43 frontend, AC-69 to AC-72 UI, AC-75. Rebuild Edit-page sub-components for per-product scope + AI button + removal of chips/TM.

### P1: ProductTypeScroller Rebuild

> Completed 2026-04-23 (+ cleanup pass same day). In-place rewrite at `partials/edit/ProductTypeScroller.tsx` (~180 lines). Reads `useGetMbaProductCatalogQuery` + `useGetProductConfigQuery` (skipToken when no `designId`) and renders one `ProductCard` per catalog entry (currently 20, catalog-driven). Icons via `PRODUCT_ICON_MAP` with a safety-net Box when catalog drifts ahead of the map. Two independent visual states: `enabled` (cyan 1px ring + cyan-tinted background + count badge) and `focused` (2px ring). `CountBadge` = count of enabled marketplaces in the matching `products_config` entry; hidden when zero. Click handler calls `onFocusedProductChange(key)` + `toggleProductEnabled(key, !current)` — focusing and toggling in one gesture. Legacy `onOptionsClick` prop dropped (Phase P9 removes the Options UI). EditView updated to pass new per-product props via `editFormState`. **Cleanup**: `useEditFormState` now reads `products_config` via RTK and auto-focuses the first enabled product when focus is null, resetting on `(designId, marketplaceType)` change (derived-during-render pattern matching `useSavedToast` to satisfy `react-hooks/set-state-in-effect`). The legacy `useProductConfig` hook + its test were deleted entirely; `useEditView` no longer exports the old flat-shape `productConfig`/`setColors`/`setMarketplaces`/etc. The `@deprecated` flat fields were dropped from `DesignProductConfig` + `UpdateProductConfigBody` types. `ColorGrid` + `MarketplacePricing` were removed from the EditView render pending P3/P4 rebuild (component files + isolated tests preserved). 7-test suite in `tests/ProductTypeScroller.test.tsx` + 3 auto-focus tests appended to `tests/useEditFormState.test.ts` (auto-focus on load, user override preserved, scope-change reset).

- [x] Read catalog via `getMbaProductCatalog` query
- [x] Render one card per catalog entry (20 today) via `PRODUCT_ICON_MAP`
- [x] Active state: ring + count badge = number of enabled marketplaces for that product in `products_config`
- [x] Focused state: 2px ring when clicked
- [x] Click handler: toggle `enabled` in `products_config` + set `focusedProduct`
- [x] Tests: render all cards, click toggles enabled + focuses, count badge updates

### P2: FitTypePrintSection Rebuild

> Completed 2026-04-23. In-place rewrite at `partials/edit/FitTypePrintSection.tsx` (~180 lines). Reads catalog + product config via RTK hooks. Returns `null` when `focusedProduct` is null OR when the focused product's catalog `supports` lacks both `'fit_types'` and `'print_side'` (e.g. PopSocket → `supports: ['colors']`). Fit column renders only when catalog includes `'fit_types'`; Print column only when `'print_side'`. When only one is supported, that column takes full 12-col width; when both are supported, 6+6 split. Options come from the catalog entry (`fit_types_options`, `print_side_options`) — per-product variation works without code changes. Immediate PATCH via `setFitTypes(focusedProduct, nextList)` and `setPrintSide(focusedProduct, side)` — the per-product `controlSetters` from `useEditFormState`. Legacy hard-coded `MBA_FIT_TYPES` + `'front'|'back'` constants no longer used; catalog is the single source of truth. 6-test suite in `tests/FitTypePrintSection.test.tsx` (no focus → null, PopSocket → hidden, T-Shirt → Men/Women/Youth/Girls/Adult Unisex visible, Throw Pillow → print visible + fit hidden, toggling fit calls `setFitTypes` with next list, selecting print side calls `setPrintSide`).

- [x] Read `focusedProduct` entry from `products_config`
- [x] Render Fit Type checkboxes ONLY when catalog entry for focused product includes `fit_types` in `supports`
- [x] Render Print Side radios ONLY when catalog includes `print_side` in `supports`
- [x] Options come from catalog (`fit_types_options`, `print_side_options`)
- [x] Immediate PATCH via `controlSetters`
- [x] Tests: PopSocket → section hidden; T-Shirt → Men/Women/Youth/Girls/Adult Unisex visible

### P3: ColorGrid Rebuild

> Completed 2026-04-23. In-place rewrite at `partials/edit/ColorGrid.tsx` (~230 lines). Reads catalog + product config via RTK (skipToken when no `designId`). Palette = `catalog[focusedProduct].colors_options` — different products show different palettes. Selected = `products_config[focusedProduct].colors`. Click toggles color in that list and calls `setColors(focusedProduct, next)` — immediate PATCH via `editFormState.controlSetters.setColors`. Returns `null` when no product is focused OR when the focused product's catalog `supports` lacks `'colors'` (defensive; all MBA products support colors today but catalog evolution is cheap). Loading (skeleton) + error (Alert + Retry) paths preserved. Re-added to `EditView.tsx`. 9-test suite in `tests/ColorGrid.test.tsx` (no-focus null, T-Shirt full palette, different products show different palettes, no-colors-support null, selected state reflects config, click toggles via setColors, switching focus swaps baseline, loading skeleton, error + retry).

- [x] Palette source: focused product's `colors_options` from catalog (not global)
- [x] Selected colors = focused product's entry `colors[]`
- [x] Click → toggle in `colors[]` → immediate PATCH via `controlSetters`
- [x] Tests: different products show different palettes

### P4: MarketplacePricing Rebuild

> Completed 2026-04-23. In-place rewrite at `partials/edit/MarketplacePricing.tsx` (~230 lines). Reads catalog + product config via RTK (skipToken when no `designId`). Iterates over `catalog[focusedProduct].marketplaces`; one row per marketplace. Each row: checkbox (from `products_config` entry's `marketplaces[x].enabled`), controlled price input (local buffer scoped to `(designId, marketplaceType, focusedProduct)` so typing feels snappy while the 400ms hook-level debounce PATCHes), and a live royalty cell styled by tone. Royalty tone: `positive` (green, > 0), `negative` (red, < 0), `neutral` (muted, null or zero). Null display is `"—"`. **Merge fix**: the backend shallow-merges at entry level, so a one-item `marketplaces` PATCH was wiping siblings. `useEditFormState` now keeps a `productsConfigRef` (written via `useEffect` to satisfy `react-hooks/refs`) and merges single-row updates into the full list in both `priceSetters.setPrice` and the new `controlSetters.setMarketplaceEnabled(productKey, marketplace, enabled)`. `manualSave`'s price flush uses the same merge. `royaltyFor` (via `hooks/royaltyFor.ts`) no longer clamps negative values to 0 so the UI can surface losses; the single `clamps to 0` test flipped to `returns raw negative`. Re-added to `EditView.tsx` — all P1-P4 per-product sections now live again. 9-test suite in `tests/MarketplacePricing.test.tsx` (no-focus null, empty-marketplaces null, row-per-catalog-marketplace, state reflection, toggle, price keystrokes call setPrice, positive/negative/empty royalty + tone). Plus 2 new hook tests: priceSetters merges + setMarketplaceEnabled merges.

- [x] Row per marketplace in catalog entry's `marketplaces`
- [x] Each row: checkbox (enabled) + price input + live royalty cell
- [x] Price input: 400ms debounce via `priceSetters` (merges into full marketplaces array)
- [x] Royalty cell: `royaltyFor(productKey, marketplace, price)` — green if positive, red if negative, "—" when price empty
- [x] Tests: entering "19.99" on amazon.com shows computed royalty; entering "5" shows negative royalty in red

### P5: ListingField Refactor

> Completed 2026-04-23. In-place rewrite at `partials/edit/ListingField.tsx` (~190 lines). Decoupled from `react-hook-form`: new props `{ value, onChange(v), onBlur(v), maxChars, label, multiline?, rows?, errorMessage?, onOpenChat? }`. Local buffer synced with the server-provided `value` via derived-during-render + equality-guarded `setLastServerValue` — typing feels instant, scope/tab switches re-sync. Char counter thresholds unchanged (`getSeverity`: normal/amber ≥ floor(max*0.9) / red ≥ max). The orphaned per-field Generate button (from removed AC-6) is gone; the AC-72 PROJ-17 Chat hover icon survives — renamed from `onAiImprove` → `onOpenChat` with a `chat-open` class so it's orthogonal to the Phase P7 central AI-Improve button. `ListingFieldsSection.tsx` rewritten to bind each field via a tiny `bind(field, key)` factory that wires `(listing[key], textSetters.onChange(field, v), textSetters.onBlur(field, v))` — `brand_name`, `title`, `bullet_1`, `bullet_2`, `description`. Bullets 3-5 dropped (backend Phase I1 removed them). `KeywordChipsField` left in place for P6 to replace. `EditView.tsx` passes `listing` + `editFormState.textSetters` to the section; `listingForm.control` stays for the legacy chips field and translations. Tests: `tests/ListingField.test.tsx` rewritten (8 tests): render counter, keystroke onChange, blur without change → onBlur with unchanged value (hook layer owns the blur-if-dirty compare), blur after edit → onBlur with edited value, server-value re-sync on prop change, amber/red counter tiers, Chat hover icon click forwards buffer value, Chat icon omitted when no callback.

- [x] Remove field-specific generate button (orphaned from removed AC-6)
- [x] Keep PROJ-17 hover Chat icon (AC-72) — renamed `onOpenChat`
- [x] On-blur-if-dirty PATCH via `textSetters` (hook-level compare; component always fires onBlur)
- [x] Char counter thresholds unchanged (90% amber, 100% red)
- [x] Tests: blur without change → no PATCH (hook-level); blur after edit → onBlur with new value

### P6: KeywordContextField (new, replaces KeywordChipsField)

> Completed 2026-04-23. New plain 500-char textarea at `partials/editor/KeywordContextField.tsx` (~160 lines). Controlled component — `{ value, onChange(v), onBlur(v), maxChars?, rows?, label?, placeholder? }` — mirroring the `ListingField` P5 pattern (local buffer + derived-during-render server re-sync). Default cap `500` and default `rows=4`; both overridable. Same 90% amber / 100% red char-counter thresholds. Label + placeholder come from `publish.edit.fields.keywordContext*` i18n keys. `ListingFieldsSection` swapped: `KeywordChipsField` import + render block replaced by `<KeywordContextField {...bind('keyword_context', 'keyword_context')} />`. The `control` prop (last remaining react-hook-form coupling inside the section) dropped since no field needs it anymore; `EditView.tsx` no longer passes `listingForm.control` down. `partials/edit/KeywordChipsField.tsx` **deleted** outright — no other consumer, no dedicated test file. 7-test suite in `tests/KeywordContextField.test.tsx` (default 500 maxLength + textarea shape, keystroke calls onChange + counter updates, blur fires onBlur with buffer value, blur after edit flows edited value, rerender with new server value re-syncs buffer, amber/red counter tiers, override maxChars).

- [x] New component `views/publish/partials/editor/KeywordContextField.tsx`
- [x] Multiline TextField, 4 rows default, `maxLength=500`
- [x] Char counter (same thresholds as other fields)
- [x] On-blur-if-dirty PATCH via `textSetters` (hook-level compare)
- [x] Tests: render, type, blur → onBlur with buffered value; hook layer owns the `keyword_context` PATCH

### P7: AIImproveButton (new)

> Completed 2026-04-23. New component at `partials/editor/AIImproveButton.tsx` (~120 lines). MUI `IconButton` (cyan) with `AutoFixHighOutlined` icon; wrapped in a span so the Tooltip still resolves when the button is disabled. Props: `{ aiImprove, isImproving, hasListing, onTruncated? }`. Click handler `await aiImprove()` — on success: enqueues a `success` snackbar ("Listing improved with AI") and calls `onTruncated(result.truncated_fields)` so the parent can flip per-field chips. On rejection: `error` snackbar, no truncation update. Loading state swaps the icon for `CircularProgress` (size 18, `color: inherit`) and disables click. Disabled when `hasListing=false` with a different tooltip ("Create or convert listing first" per AC-71). EditView owns the `truncatedFields: string[]` state and renders the button in a right-aligned Stack above `ListingFieldsSection`. **Truncated chip**: `ListingField` and `KeywordContextField` each gain an optional `truncated?: boolean` prop that renders a small amber "AI truncated" MUI `Chip` with `ContentCutOutlined` icon next to the field label. `ListingFieldsSection` derives the per-field flag from a `Set(truncatedFields)` inside its `bind()` factory and spreads it alongside `value`/`onChange`/`onBlur`. i18n keys added under `publish.ai_improve.{tooltip, tooltipDisabled, buttonLabel, successSnackbar, errorSnackbar, truncatedChip}` + `publish.edit.fields.{openChat, keywordContext, keywordContextPlaceholder}`. Tests: 6 new in `tests/AIImproveButton.test.tsx` (render wand icon when enabled; click → aiImprove + success snackbar + onTruncated; rejection → error snackbar, no onTruncated; isImproving → spinner + disabled; `hasListing=false` → disabled; null aiImprove result → no side effects). 2 new in `tests/ListingField.test.tsx` (truncated chip render + absence). Covers the P7 spec: click → mutation → snackbar; truncated_fields → chips rendered.

- [x] New component `views/publish/partials/editor/AIImproveButton.tsx`
- [x] MUI IconButton with `AutoFixHighOutlined` icon
- [x] Tooltip: `t('publish.ai_improve.tooltip')`
- [x] Click → `aiImprove()` mutation
- [x] Loading: icon replaced by CircularProgress, button disabled
- [x] Success: snackbar "Listing improved with AI"
- [x] Truncation warnings: render inline chip on each truncated field (ListingField + KeywordContextField both gained a `truncated?: boolean` prop)
- [x] Disabled state with tooltip "Create or convert listing first" when listing missing for tab (AC-71)
- [x] Tests: click → mutation fires → snackbar; truncated_fields → chips rendered

### P8: Component Deletions

> Completed 2026-04-23. `KeywordChipsField.tsx` was already removed in P6 (replaced by `KeywordContextField`). `TMCheckDialog.tsx` was already removed in O1 (TM-Check endpoint deleted). P8 finishes the sweep by removing the residual TM-Check wiring: `TMCheckResult` interface dropped from `views/publish/types/index.ts`; local duplicate type alias + `handleTMCheck` no-op stub + `isChecking = false` constant stripped from `useListingEditor.ts` (return + deps lists cleaned); pass-through `isChecking` + `handleTMCheck` dropped from `useEditView.ts` return object; `EditView.g1.test.tsx` stub no longer defines them; the comment in `useListingEditor.test.ts` updated. OptionsTrademarksTabs still renders a disabled "Run TM Check" button inside the Trademarks tab — that entire tab goes in P9, so leaving it alone here.

- [x] Delete `views/publish/partials/editor/KeywordChipsField.tsx` + its test file (done in P6)
- [x] Delete `views/publish/partials/editor/TMCheckDialog.tsx` + its test file (done in O1)
- [x] Remove imports + usages in parent components (useListingEditor + useEditView + EditView.g1 stub)
- [x] Remove `KeywordChipsField` + `TMCheckDialog` types from `views/publish/types/index.ts` (`TMCheckResult` dropped; no `KeywordChipsField` type existed)

### P9: Options Tab Cleanup

> Completed 2026-04-23. `OptionsTrademarksTabs.tsx` renamed + rewritten as `OptionsSection.tsx` (~120 lines): dropped MUI Tabs chrome, state machine, Trademarks panel, retired "Run TM Check" button, `TmButton` styled, `GppMaybeOutlinedIcon` import, `useState`/`useCallback` tab-state plumbing, `listingId` prop, and `onOptionsClick` prop. Only `control: Control<MbaListingFormValues>` remains. Renders Availability + Publish radio groups in a 6+6 Grid, wrapped in `<section data-testid="OptionsSection">`. EditView call site updated (new import + minimal props). `EditView.g1.test.tsx` mock path + testid renamed via sed. i18n cleanup: deleted `publish.edit.options.tab`, `publish.edit.options.tabsLabel`, and the entire `publish.edit.trademarks.*` block (14 keys) from en translation; added new `publish.edit.options.sectionLabel` for the section-level aria-label. 4-test suite in `tests/OptionsSection.test.tsx` (both radios render + no Tabs + no Trademarks remnants; Availability default selection; selecting Private flips form state; selecting Draft flips publish_mode). Lint caught a minor `watch()`-in-render warning on the test harness — swapped for `useWatch({control, name})`.

- [x] Remove "Trademarks" tab from Options section MUI Tabs
- [x] Keep only Availability + Publish radio groups
- [x] Update tests

---

## Phase Q: Cross-cutting (Backend + Frontend) — i18n + Final Lint + QA (added 2026-04-23)

> Scope: String cleanup + type cleanup + full suite pass.

### Q0: Type/Schema legacy cleanup (option-B extension, 2026-04-23)

> Completed 2026-04-23. `@deprecated` flat fields (`bullet_3/4/5` + `backend_keywords`) removed from `Listing`, `ListingTranslation`, `LISTING_CHAR_LIMITS`, `MbaListingFormValues`, `MbaListingFieldName`, `MBA_LISTING_CHAR_LIMITS`, `mbaListingDefaultValues`. Unused `schemas/listingSchema.ts` deleted (no consumers). Consumers updated: `useEditView.listingToFormValues` + `parseBackendKeywords` helper, `useListingEditor.serializeFormValues`, `useCommandPalette.SECTION_CONTEXT_MAP`, `useListingEditor.test.ts` fixtures + assertions (`backend_keywords: 'cat, vintage'` → `keyword_context: 'cat, vintage'`). The retired Generate flow was fully stripped: `handleGenerate` stub in `useListingEditor`, `isGenerating` flag, `handleGenerateListing` helper in `useEditView`, `onAiGenerate` callback in `useCommandPalette` + `PublishView` + `useEditView`, `ai-generate` command palette entry. `useListingEditor` no longer takes `designId`. `ListingStateBanner` dropped the `Generate Listing` CTA — `notFound` state now shows a Convert-from-another-tab hint (matching the new creation flow); props reduced to `{ isLoading, isFetching, notFound, hasError, onRetry, marketplace }`. `useEditView` exposes `handleRetryListing = listingEditor.refetchListing` in place of `handleGenerateListing`.

- [x] Drop `@deprecated` flat fields from `Listing`, `ListingTranslation`
- [x] Drop entries from `LISTING_CHAR_LIMITS` + `MBA_LISTING_CHAR_LIMITS`
- [x] Drop `bullet_3/4/5` + `backend_keywords` from `mbaListingSchema`, `MbaListingFieldName`, `mbaListingDefaultValues`
- [x] Delete unused `schemas/listingSchema.ts`
- [x] Strip consumers (`useEditView`, `useListingEditor`, `useCommandPalette`, `PublishView`, test fixtures)
- [x] Retire the Generate flow (`handleGenerate` stub, `isGenerating`, `onAiGenerate`, Command Palette `ai-generate` entry, Banner Generate CTA)
- [x] `tsc --noEmit` clean, `eslint` clean, full Vitest suite green

### Q1: i18n Keys — Remove

> Completed 2026-04-23. The key prefixes listed by the spec (`publish.tm_*`, `publish.bullet_3`, etc.) were aspirational — the actual implementation used different namespaces. Actual removals in `en.json`:
>
> - `publish.listing.*` block trimmed from 30 keys → 6 survivors (`saveSuccess`, `saveError`, `saveDuplicate`, `saveNoListing`, `copied`, `copyError`). Dropped: `title`, `generate*`, `save`, `loadError`, `noListing`, `improve`, `copyMBA`, `brandName`, `titleField`, `bullet`, `description`, `keywords`, `addKeyword`, `add`, `kwFinder`, `availability`, `public`, `private`, `publishMode`, `live`, `draft`.
> - Entire `publish.tm.*` block (11 keys) — TM-Check flow retired.
> - `publish.edit.keywords.*` block (7 keys) — replaced by `publish.edit.fields.keywordContext*` in P6.
> - `publish.edit.listingState.{generate, generating}` — Generate CTA retired; `notFound` text rewritten for Convert-from-another-tab.
> - `publish.command.aiGenerate` — command palette entry removed.
>
> No matching `tm_` / `bullet_3-5` / `backend_keywords` / `kw_finder` / `kw_workbench` / `ai_generate_listing` keys existed in de/es/fr/it (those locales only covered a slim subset of the publish namespace). Locales stay JSON-valid (`python -m json.tool` passes on all five).

- [x] Remove legacy `publish.listing.*` keys (see list above)
- [x] Remove entire `publish.tm.*` block
- [x] Remove `publish.edit.keywords.*` block (superseded by `publish.edit.fields.keywordContext*`)
- [x] Remove `publish.edit.listingState.{generate, generating}` + rewrite `notFound` text
- [x] Remove `publish.command.aiGenerate`

### Q2: i18n Keys — Add

> Completed 2026-04-23. The spec's proposed key namespaces (`publish.keyword_context.*`, `publish.unsaved_banner.*`, `publish.royalty.*`) didn't match what P5-P9 actually shipped, which is more deeply nested under `publish.edit.*`. Functionally equivalent. Concrete keys now present in `en.json`:
>
> - `publish.edit.fields.{brand, title, bullet, description, openChat, keywordContext, keywordContextPlaceholder, aiImprove, sectionLabel}`
> - `publish.edit.unsaved.{message, discard, save, cancel, retry, saving, saved, failed, offline, offlineChip, queued, confirmDiscardTitle, confirmDiscardBody, autoSaving, autoSaved}`
> - `publish.ai_improve.{tooltip, tooltipDisabled, buttonLabel, successSnackbar, errorSnackbar, truncatedChip}`
> - `publish.edit.options.{sectionLabel, availability.*, publishMode.*}`
> - `publish.edit.marketplaces.{title, enable, priceFor, royalty}` (royalty is a label key used with inline `defaultValue` by P4 — dedicated `publish.royalty.*` namespace not required)
> - `publish.edit.products.{title, productType, selectedCount}` — already present from D5; labels for the 17+ catalog entries come from `MBA_PRODUCT_CATALOG.label` on the backend (single source of truth per AC-78; shipping catalog changes as a deploy rather than a translation sweep is a deliberate decision).
>
> de/es/fr/it parity: the other locales rely on the `defaultValue` fallback for any `publish.edit.*` key not explicitly translated. Same policy as other recent publish work; translation sweep deferred to post-MVP.

- [x] Keyword context keys present (`publish.edit.fields.keywordContext*` — P6)
- [x] AI Improve keys present (`publish.ai_improve.*` — P7)
- [x] Unsaved banner keys present (`publish.edit.unsaved.*` — O3)
- [x] Royalty label inline with defaultValue (`publish.edit.marketplaces.royalty` — P4)
- [x] Product type labels sourced from catalog (AC-78) — no frontend i18n keys required
- [x] Parity: en authoritative; de/es/fr/it fall back via `defaultValue`

### Q3: Lint + Test Suite

- [x] `npm run lint` — clean (no new errors; 2 pre-existing `EditorCanvas.tsx` warnings unchanged)
- [x] `tsc --noEmit` — clean
- [x] `npm run test:ci` (via `npx vitest run`) — **1005/1005** tests green across 116 files
- [ ] `ruff check django-app/` — not run (frontend-focused phase; backend-side Q checkboxes belong to the `/backend` agent)
- [ ] `pytest publish_app` — not run (same reason)

### Q4: QA Report Addendum

> Completed 2026-04-23. First pass: `/qa` wrote the Phase-I–Q3 addendum on unit-test + lint + typecheck evidence alone and signed off SHIP. Browser-smoke test (user-invoked) immediately crashed `ProductTypeScroller.tsx:107` on legacy config row `80752f2d-…` (pre-Phase-J2 shape missing `marketplaces`/`fit_types`/`colors`). Addendum revised to HOLD + P1 finding + P2 finding against the no-smoke-test QA process itself. Hot-fix applied to `ProductTypeScroller.tsx:107` + `MarketplacePricing.tsx:170/179` (defensive `?? []` + optional chain). Second pass: Playwright MCP smoke test against the legacy row confirmed Edit Page fully functional end-to-end (20 product cards render, marketplace-enable PATCH 200, price debounce 400ms PATCH 200, color toggle PATCH 200, tab-switch MBA↔Global no crash, reload persistence verified, 0 console errors). Verdict revised HOLD → SHIP. Incidental out-of-scope finds: P2 `X-Workspace-Id` header never sent (filed against PROJ-4); P3 data-migration follow-up for pre-J2 rows.

- [x] Write QA Report Addendum in spec covering Phases I–Q3 (AC-1, AC-37–AC-48, AC-64, AC-69–AC-80 + removed AC-6/10/34)
- [x] Hot-fix: `ProductTypeScroller.tsx:107` + `MarketplacePricing.tsx:170/179` defensive `marketplaces` access
- [x] Browser smoke test (Playwright MCP) against legacy-shape row
- [x] Verdict recorded (SHIP post-smoke-test) with P2/P3 follow-ups filed

### Q5: Spec + Docs Polish

- [x] `docs/tasks/PROJ-11-tasks.md` — Q0-Q3 completion notes + checkboxes in-place
- [x] `features/INDEX.md` status bump — stays `In Review` (PROJ-11 row already `In Review` since 2026-04-21; addendum verdict is SHIP → next flip to `Deployed` is `/deploy`'s responsibility, not `/qa`'s)
- [x] Spec header + QA Report block — `**Updated:** 2026-04-22` → `2026-04-23`; "QA Report Addendum — 2026-04-23" block appended

---

## Phase R: Backend — Listing Schema Extension + Per-Field Gates (added 2026-04-24)

> Covers AC-81, AC-82, AC-87, AC-109, AC-110, AC-119, AC-121, AC-123, AC-124.

### R1: Migration — Listing new fields

- [x] Add field `keywords` (JSONField, default=dict) to `Listing` model
- [x] Add field `type_flags` (JSONField, default=list) to `Listing` model
- [x] Add field `color_mode` (CharField max_length=10, blank=True, default='', choices=[black, white, colorful]) to `Listing` model
- [x] Add field `background_color_hex` (CharField max_length=7, blank=True, default='') to `Listing` model
- [x] Add field `category` (CharField max_length=200, blank=True, default='') to `Listing` model
- [x] Generate migration `publish_app/migrations/0013_listing_extend_global_displate_fields.py` with empty-default backfill
- [x] Run migration against local + CI DB; verify backfill on existing rows

### R2: Serializer gates (per-field marketplace_type validation)

- [x] Extend `ListingUpdateSerializer` with per-field `validate_<field>` methods enforcing the AC-82 matrix:
  - `keywords`: reject when `marketplace_type == 'mba'`
  - `type_flags`: reject when `marketplace_type == 'mba'`
  - `color_mode`: reject when `marketplace_type != 'global'`
  - `background_color_hex`: reject when `marketplace_type != 'displate'`
  - `category`: reject when `marketplace_type == 'displate'`
- [x] Hex validation regex `^#[0-9A-Fa-f]{6}$` on `background_color_hex`
- [x] Keyword-comma/semicolon rejection in `validate_keywords` (AC-110 backend guard)
- [x] Serializer output: hide fields on non-allowed marketplace_type responses (per-field `to_representation` or field-set per-tab)

### R3: Convert rule extension (AC-109)

- [x] Extend `ListingConvertView.convert()` to copy `brand_name` + `category` across tabs (respecting target's gate — drop `category` if target=displate)
- [x] Explicitly NOT copy `keywords`, `type_flags`, `color_mode`, `background_color_hex` (per AC-109)
- [x] Update `test_listing_convert.py` with new field transfer assertions

### R4: Tests

- [x] `tests/test_listing_schema_gates.py::test_mba_rejects_keywords` (400)
- [x] `tests/test_listing_schema_gates.py::test_global_accepts_keywords`
- [x] `tests/test_listing_schema_gates.py::test_displate_accepts_keywords`
- [x] `tests/test_listing_schema_gates.py::test_global_rejects_background_hex`
- [x] `tests/test_listing_schema_gates.py::test_displate_rejects_color_mode`
- [x] `tests/test_listing_schema_gates.py::test_displate_rejects_category`
- [x] `tests/test_listing_schema_gates.py::test_keywords_comma_rejected`
- [x] `tests/test_listing_schema_gates.py::test_hex_format_rejected`
- [x] Expected: `pytest publish_app/tests/test_listing_schema_gates.py` green

---

## Phase S: Backend — FlyingUpload Export Service + Template Stubs (added 2026-04-24)

> Covers AC-90, AC-92, AC-93, AC-94, AC-95, AC-96, AC-97, AC-101, AC-102, AC-103, AC-104, AC-105, AC-106, AC-107, AC-120, AC-122, AC-127, AC-136.

### S1: Template stubs

- [x] Copy byte-exact `FlyingUploadMultiLanguageMBA.xlsx` from `/Users/mariomuller/Downloads/Excel Standard v2.3/` → `publish_app/catalogs/flyingupload_mba_template.xlsx`
- [x] Copy byte-exact `FlyingUploadBasicMultiLanguage.xlsx` → `publish_app/catalogs/flyingupload_basic_template.xlsx`
- [x] Add `publish_app/catalogs/flyingupload_maps.py` with `LANG_MAP`, `MARKETPLACE_MAP`, `FLYINGUPLOAD_PRODUCT_MAP`, `FIT_TYPE_MAP` constants (AC-120 version-pin comment at top)
- [x] Add loader fixture helper in tests for template-stub byte comparison

### S2: Core export service — MBA

- [x] Create `publish_app/services/flyingupload_export.py` module scaffold
- [x] Implement `_color_mode_from_colors(color_keys)` (AC-93 V column derivation) — implemented as `derive_color_mode` in `catalogs/flyingupload_maps.py`
- [x] Implement `_safe_file_name(original, asset_uuid)` (AC-106 `<stem>-<uuid8>.<ext>` collision suffix)
- [x] Implement `_resolve_background_hex(design)` — looks up Displate listing's `background_color_hex` (AC-127)
- [x] Implement `build_mba_bundle(workspace_id, design_ids) -> (zip_bytes, preflight_summary)`:
  - Open template stub → copy → populate rows → save to BytesIO
  - Fan-out design × enabled products (AC-94)
  - Write 66 cols per AC-93 mapping (Image Path = `designs/<safe_name>`)
  - Fetch each referenced asset binary via `default_storage.open()` — skip on missing (AC-104 `image_unavailable`)
  - Pack XLSX + `designs/*` into ZIP (DEFLATED XLSX, STORED images)
  - Return (zip_bytes, summary)
- [x] Catalog-unknown product keys → row skipped + warning (AC-94, EC-48)
- [x] Over-10-colors → first 10 + preflight warning (EC-49)
- [x] `both` print_side → `front` + warning (EC-50)

### S3: Core export service — Basic

- [x] Implement `build_basic_bundle(workspace_id, design_ids) -> (zip_bytes, preflight_summary)`:
  - Open Basic stub → populate 9 cols per AC-96
  - 1 row per selected design (no fan-out)
  - `Type` column with `men→man, women→woman` legacy mapping
  - Pull Title/Desc/Tags from Global listing; skip designs without Global listing (AC-97 `no_global_listing`)
  - Same ZIP packaging as MBA

### S4: CSV format

- [x] Implement `build_mba_csv(workspace_id, design_ids) -> (csv_bytes, preflight_summary)`:
  - UTF-8 with BOM (`\xef\xbb\xbf` prefix)
  - RFC 4180 quoted-CSV via `csv.writer(quoting=csv.QUOTE_ALL)`
  - Same 66 columns as XLSX including empty gap columns
  - `Image Path` column = bare `file_name` (no `designs/` prefix, no ZIP) per AC-136
- [x] Implement `build_basic_csv(workspace_id, design_ids) -> (csv_bytes, preflight_summary)` — 9-col variant
- [x] Response: single `.csv` file, no ZIP wrap (AC-136)

### S5: Preflight service

- [x] Implement `preflight(workspace_id, design_ids, template, format) -> summary_dict`:
  - Returns `{total_designs, ready_rows, skipped, warnings}` without generating bytes
  - Walks the same branches as `build_*_bundle` but skips the actual write steps
- [x] 500-design hard cap → 400 `max_500_designs_per_export` (AC-107, EC-61)
- [x] Size-estimate cap (sum of file_size) → 400 `estimated_archive_too_large` with top-10 breakdown (AC-107, EC-62)

### S6: Size + streaming guardrails

- [x] Use `SpooledTemporaryFile(max_size=100MB)` for ZIP accumulation
- [ ] Stream response via `FileResponse` with `streaming_content` — deferred to Phase T (endpoint layer)
- [x] HTTP range support NOT required for MVP (archive is finite)

### S7: Tests

- [x] `tests/test_flyingupload_export_mba.py::test_sheet_name_and_headers`
- [x] `tests/test_flyingupload_export_mba.py::test_gap_columns_remain_empty` (B/W/BK)
- [x] `tests/test_flyingupload_export_mba.py::test_fan_out_one_row_per_enabled_product`
- [x] `tests/test_flyingupload_export_mba.py::test_image_path_relative_to_designs`
- [x] `tests/test_flyingupload_export_mba.py::test_brand_duplicated_to_all_6_language_columns`
- [x] `tests/test_flyingupload_export_mba.py::test_ja_language_maps_to_JP`
- [x] `tests/test_flyingupload_export_mba.py::test_amazon_com_maps_to_US`
- [x] `tests/test_flyingupload_export_mba.py::test_background_color_hex_from_displate_listing`
- [x] `tests/test_flyingupload_export_basic.py::test_9_columns_exact`
- [x] `tests/test_flyingupload_export_basic.py::test_men_maps_to_man`
- [x] `tests/test_flyingupload_export_basic.py::test_skips_missing_global_listing`
- [x] `tests/test_flyingupload_export_csv.py::test_utf8_bom_prefix`
- [x] `tests/test_flyingupload_export_csv.py::test_rfc4180_quoting`
- [x] `tests/test_flyingupload_export_csv.py::test_newlines_in_description_quoted`
- [x] `tests/test_flyingupload_preflight.py::test_ready_rows_post_fan_out`
- [x] `tests/test_flyingupload_preflight.py::test_no_listing_skip_reason`
- [x] `tests/test_flyingupload_preflight.py::test_no_enabled_products_skip_reason`
- [x] `tests/test_flyingupload_preflight.py::test_image_unavailable_skip_reason`
- [x] `tests/test_flyingupload_guards.py::test_max_500_cap`
- [x] `tests/test_flyingupload_guards.py::test_size_estimate_cap`
- [x] `tests/test_flyingupload_guards.py::test_filename_collision_suffix`

---

## Phase T: Backend — Endpoints + ExportLog + History (added 2026-04-24)

> Covers AC-90, AC-91, AC-111-118, AC-128 (URLs only).

### T1: ExportLog model + migration

- [ ] Create `ExportLog` model per Tech Design B) (workspace, created_by, template, format, design_ids, design_count, row_count, filename, output_size_bytes, created_at)
- [ ] DB index `(workspace, -created_at)`
- [ ] Append-only semantics (no UPDATE/DELETE paths in API)
- [ ] Generate migration `00XX_exportlog.py`

### T2: API views

- [ ] `FlyingUploadPreflightView` (POST `.../flyingupload/preflight/`) — wraps `services.flyingupload_export.preflight(...)`, returns summary JSON
- [ ] `FlyingUploadExportView` (POST `.../flyingupload/`) — wraps `build_*_bundle` or `build_*_csv`, streams response, writes `ExportLog` on success
- [ ] `ExportHistoryListView` (GET `.../history/`) — paginated ExportLog list, workspace-isolated, ordered `-created_at`, limit 50

### T3: Serializers

- [ ] `ExportPreflightRequestSerializer` — validates body shape (template, design_ids or collection_id, format)
- [ ] `ExportLogSerializer` — read-only, includes `created_by` nested user fields (id, first_name, last_name, avatar_url)
- [ ] Reject unknown `template` / `format` values with 400

### T4: URL registration

- [ ] Register 3 new routes in `publish_app/api/urls.py`
- [ ] All routes require `IsAuthenticated` + workspace-id header filter (404 on cross-workspace)

### T5: Tests

- [ ] `tests/test_export_history.py::test_append_only_on_successful_export`
- [ ] `tests/test_export_history.py::test_no_row_on_4xx_error`
- [ ] `tests/test_export_history.py::test_no_row_on_5xx_error`
- [ ] `tests/test_export_history.py::test_workspace_isolated_list`
- [ ] `tests/test_export_history.py::test_ordered_newest_first`
- [ ] `tests/test_export_history.py::test_cross_workspace_design_id_returns_404`
- [ ] `tests/test_flyingupload_views.py::test_preflight_no_side_effects`
- [ ] `tests/test_flyingupload_views.py::test_download_returns_zip_for_xlsx`
- [ ] `tests/test_flyingupload_views.py::test_download_returns_plain_csv_for_csv`
- [ ] `tests/test_flyingupload_views.py::test_content_disposition_rfc5987_for_unicode_workspace_name`

---

## Phase U: Frontend — Global Tab UI (added 2026-04-24)

> Covers AC-83-89, AC-108, AC-110, AC-119, AC-128-135.

### U1: Data layer — publishSlice additions

- [ ] Extend `Listing` type with the 5 new fields (nullable per marketplace_type)
- [ ] Add RTK Query endpoints: `previewExport`, `runExport`, `listExportHistory`
- [ ] Cache tag `ExportHistory` for invalidation on successful export
- [ ] `useEditFormState` hook: add `keywordsSetters.commitChip(lang, keyword)`, `keywordsSetters.removeChip(lang, idx)`, `keywordsSetters.setAll(lang, keywords)` for bulk ops; `colorModeSetter`, `bgHexSetter`, `categorySetter`

### U2: Keywords chip field

- [ ] Create `KeywordsChipField.tsx` using MUI Autocomplete freeSolo multiple
- [ ] Enter + comma commit buffer; strip mid-buffer commas; reject `,` and `;` in chip values (AC-110)
- [ ] Case-insensitive deduplication per language
- [ ] 50-char counter below field; amber ≥90%, red ≥100% (AC-85)
- [ ] Rejected-chip shake animation
- [ ] Immediate PATCH on add/remove, on-blur for any pending buffer

### U3: Keyword research links

- [ ] Create `KeywordResearchLinks.tsx` with KW Finder + "|" separator + KW Workbench
- [ ] KW Finder: `<Link>` to `/niches/research?niche=<id>&context=keywords`; disabled when design has no niche FK
- [ ] KW Workbench: disabled with tooltip `"Coming soon — ships with PROJ-10 Keyword Bank"`

### U4: Type + Color Options

- [ ] Create `TypeColorOptions.tsx`: Types checkbox group (Men/Women/Youth) + Color radio group (Black/White/Colorful)
- [ ] Bound to `type_flags` + `color_mode` via immediate PATCH
- [ ] Rendered in the Options section at the bottom of Global tab; not rendered on MBA/Displate

### U5: Tagging Options menu

- [ ] Create `TaggingOptionsMenu.tsx` anchored to "Tagging Options" button
- [ ] Action: "Copy EN keywords to all languages" → confirm dialog → bulk PATCH → snackbar
- [ ] Action: "Clear all keywords" → confirm dialog → bulk PATCH → snackbar
- [ ] Action: "Import keywords from CSV" → opens `ImportKeywordsCsvDialog`

### U6: Import Keywords CSV dialog

- [ ] Create `ImportKeywordsCsvDialog.tsx` with textarea + parse-preview
- [ ] Parse: split on `,` / `;` / newlines; trim; dedupe against existing; drop empties
- [ ] Count-of-rejected warning when 50-char limit forces drops (EC-78)
- [ ] Commit → append to active-lang keywords + PATCH + close dialog

### U7: Advanced Options dialog

- [ ] Create `AdvancedOptionsDialog.tsx` with Brand + Category TextFields
- [ ] Mount-on-open pattern
- [ ] Save button → single batched PATCH; Cancel → discard

### U8: Global tab composition

- [ ] Create `GlobalTabContent.tsx` that assembles Title + Description + KeywordsChipField + KeywordResearchLinks + Options section (TypeColorOptions) + header buttons (Tagging Options, Advanced Options)
- [ ] Lazy-create listing on first PATCH per AC-108
- [ ] Gate `EditView.tsx` to render `GlobalTabContent` when `activeMarketplace === 'global'`

### U9: Tests

- [ ] `KeywordsChipField.test.tsx` — commit, reject-comma, shake on duplicate, counter transition
- [ ] `TaggingOptionsMenu.test.tsx` — 3 actions fire correct mutations with confirm
- [ ] `ImportKeywordsCsvDialog.test.tsx` — parser splits + dedupes + 50-char limit
- [ ] `AdvancedOptionsDialog.test.tsx` — save batches PATCH, cancel discards
- [ ] `GlobalTabContent.test.tsx` — renders expected sections; hides MBA-specific sections

---

## Phase V: Frontend — Displate Tab UI (added 2026-04-24)

> Covers AC-123-127. Parallel to Phase U; shares KeywordsChipField, KeywordResearchLinks, TaggingOptionsMenu, AdvancedOptionsDialog with Global.

### V1: Background Color picker

- [ ] Add `react-colorful` to `package.json`
- [ ] Create `BackgroundColorPicker.tsx` wrapping `HexColorPicker` + hex text input + preview swatch
- [ ] Validate `^#[0-9A-Fa-f]{6}$` client-side with shake on invalid
- [ ] Immediate PATCH on valid hex commit

### V2: Displate tab composition

- [ ] Create `DisplateTabContent.tsx` with Title + Description + KeywordsChipField + KeywordResearchLinks + Options section (Types checkboxes + BackgroundColorPicker) + header buttons (Tagging Options, Advanced Options)
- [ ] Lazy-create listing on first PATCH per AC-126
- [ ] Gate `EditView.tsx` to render `DisplateTabContent` when `activeMarketplace === 'displate'`

### V3: Tests

- [ ] `BackgroundColorPicker.test.tsx` — valid hex commits, invalid rejected, picker + text input in sync
- [ ] `DisplateTabContent.test.tsx` — renders expected sections; hides MBA-specific + hides Global's Color radio

---

## Phase W: Frontend — Export UX (Palette + Preflight + History) (added 2026-04-24)

> Covers AC-90, AC-91, AC-98-100, AC-111-118, AC-137-140.

### W1: useExport hook

- [ ] Create `hooks/useExport.ts`
- [ ] Expose: `preflight(template, format, design_ids) -> summary`, `download(template, format, design_ids) -> void` (triggers browser download via anchor + URL.createObjectURL)
- [ ] Filename parsed from `Content-Disposition` header (RFC 5987 aware)
- [ ] Error surfacing via snackbar with backend error-code mapping (AC-113)
- [ ] 60-second timeout per AC-112

### W2: ExportPreflightDialog

- [ ] Create `ExportPreflightDialog.tsx` showing ready_rows + skipped list + warnings + Download button
- [ ] Mount-on-open pattern
- [ ] Disable Download when `ready_rows === 0` with tooltip (AC-111)
- [ ] "Edit N" shortcut on skipped rows with `no_listing` / `no_global_listing` reason → navigates to `/publish/edit?designs=<ids>`
- [ ] "Preparing archive" overlay spinner during download (AC-112)

### W3: Command palette wiring — Publish view

- [ ] Extend `useCommandPalette` with 3 new actions: `Export as XLSX (MBA)`, `Export as XLSX (Basic)`, `Export as CSV`
- [ ] Enable when `selectionCount >= 1`; otherwise disabled with tooltip
- [ ] On click: open `ExportPreflightDialog` with current selection

### W4: Command palette wiring — Edit view

- [ ] Register same 3 actions in `EditView.useCommandPalette` with `design_ids` source = URL `?designs=...`
- [ ] Suppress the "Edit 1" button in preflight when the skipped design is already the one open (EC-81)

### W5: Export History drawer

- [ ] Create `ExportHistoryDrawer.tsx` — opens from toolbar HistoryOutlined IconButton in `PublishView` (AC-117)
- [ ] Row: template chip, filename, design_count / row_count badge, creator avatar, relative timestamp
- [ ] Empty state "No exports yet in this workspace"
- [ ] Row hover → tooltip shows `design_ids` list

### W6: Re-run from History

- [ ] Add `ReplayOutlined` IconButton per row (AC-140)
- [ ] On click: open ExportPreflightDialog pre-filled with log's template + format + design_ids
- [ ] Confirm → re-runs preflight + download → writes fresh ExportLog row
- [ ] When all log designs deleted → preflight `ready_rows: 0` + disabled Download (EC-82)

### W7: Tests

- [ ] `useExport.test.ts` — preflight + download mutations, filename extraction, error mapping, timeout
- [ ] `ExportPreflightDialog.test.tsx` — skipped list renders, Edit shortcut navigates, Download disabled when 0 rows
- [ ] `ExportHistoryDrawer.test.tsx` — rows render, empty state, re-run opens preflight

---

## Phase X: Cross-cutting — i18n + Tests + Lint + QA (added 2026-04-24)

> Covers AC-119. Consolidates all remaining verification tasks.

### X1: i18n keys

- [ ] Add `publish.edit.global.*` branch to `frontend-ui/public/locales/en/translation.json` (Title, Description, Keywords, Types, Color labels + placeholders + counter messages + validation errors)
- [ ] Add `publish.edit.displate.*` branch (Background Color label, picker tooltips, Displate-specific placeholders)
- [ ] Add `publish.edit.tagging.*` branch (Copy EN, Clear all, Import CSV labels + confirm dialogs + snackbar messages)
- [ ] Add `publish.edit.advanced.*` branch (Brand, Category labels + modal title + Save/Cancel)
- [ ] Add `publish.export.*` branch (palette action labels, preflight dialog, snackbar messages, history drawer labels, error codes)
- [ ] Native DE translations for all error snackbars + preflight summary messages
- [ ] Other locales (es/fr/it) inherit EN via `fallbackLng` (documented per Round-5 Hotfix 2 sweep policy)

### X2: Tests — backend aggregate

- [ ] `docker compose exec web pytest publish_app` — aggregate run green
- [ ] `ruff check django-app/` — clean
- [ ] Coverage report — no new gaps in service/export files

### X3: Tests — frontend aggregate

- [ ] `npx vitest run` — full suite green (expect ~1050+ tests post this feature)
- [ ] `npm run lint` — clean (2 pre-existing EditorCanvas warnings OK)
- [ ] `tsc -b` — clean publish scope

### X4: QA smoke test (Playwright MCP)

- [ ] Verification Step 22-48 coverage (Global tab fields, Displate tab fields, export both formats, history drawer, re-run)
- [ ] Cross-workspace isolation test: 404 on foreign design_id
- [ ] Comma-in-keyword blocked test (EC-63)
- [ ] Advanced Options save + discard test (EC-84)
- [ ] Browser downloads the ZIP/CSV, unzip content matches expectations

### X5: Spec + docs polish

- [ ] `features/PROJ-11-listing-keyword-generator.md` — update `**Updated:** 2026-04-24` if needed (already set)
- [ ] `features/INDEX.md` — status stays `In Review` until `/deploy` ships
- [ ] QA Round addendum block appended to spec documenting Phase R-X completion

### X6: Handoff

- [ ] All Phase R-X checkboxes green
- [ ] `/deploy` ready to run
- [ ] PR description + migration notes written
