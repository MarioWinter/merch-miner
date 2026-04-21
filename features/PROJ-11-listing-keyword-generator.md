# PROJ-11: Publish (Listing + Upload Manager)

**Status:** Planned
**Priority:** P0 (MVP)
**Created:** 2026-02-27
**Updated:** 2026-03-26

## Overview

> REDESIGNED: 2026-04-08. Inspired by MyDesigns.io Listings Collection (folder system + grid) + Flying Upload Edit POD (listing editor). Replaces simple gallery with dual file system.

Two-view Publish area combining **Design Collection Management** (folder-based, MyDesigns style) with **Listing Editing** (Flying Upload style). The Cloud File Manager (formerly PROJ-19) is integrated directly into the Listing area as a second file system view.

**Two Main Views:**

### View 1: Design Collection (MyDesigns Listings Style)
The main listing overview. Designs organized in a **server-side folder system** (CollectionFolderFileSystem). Users can create folders, organize designs, and manage their catalog.

**Layout:**
```
┌─ PUBLISH ────────────────────────────────────────────┐
│ [0/0 ▾] [📁 Collections] [Choose Action ▾]           │
│ [≡ List][⊞ Grid] [Search...]                         │
│ [Template] [Upload] [Publish]                        │
├──────────────────────────────────────────────────────┤
│ 📁 Home > School Bus > Round 1                        │
│                                                       │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                 │
│ │ 🖼    │ │ 🖼    │ │ 🖼    │ │ 🖼    │                 │
│ │      │ │      │ │      │ │      │                 │
│ ├──────┤ ├──────┤ ├──────┤ ├──────┤                 │
│ │Title │ │Title │ │Title │ │Title │                 │
│ │Tags  │ │Tags  │ │Tags  │ │Tags  │                 │
│ │Date  │ │Date  │ │Date  │ │Date  │                 │
│ └──────┘ └──────┘ └──────┘ └──────┘                 │
│                                                       │
├──────────────────────────────────────────────────────┤
│ 0/11 ℹ │ ✏ Edit Designs │ ✓ Select All │             │
│ 📤 Upload History │ 📦 Upload Batch │ Options ▾ │ 🗑  │
└──────────────────────────────────────────────────────┘
```

- **Toolbar:** Select counter, Collections button (opens folder dialog), Choose Action (command palette), List/Grid toggle, Search, Template, Upload, Publish
- **Design Grid:** Card grid with thumbnails, title/tags label, import date. Designs from Canvas (PROJ-9), file upload, or Cloud import
- **Selection:** Click to select, Shift+Click multi-select, **lasso-select** (hold left mouse + drag over cards to select)
- **Bottom Action Bar:** Appears on selection — Edit Designs, Select All, Upload History, Upload Batch, Options, Delete

**Collections Dialog (folder management):**
```
┌─ Collections ──────────────────── ✕ ─┐
│ [⊞ Grid][≡ List]  Home               │
│ Search Listings...  Search Folder...  │
├───────────────┬──────────────────────┤
│ ≡Tree Explorer│ ┌──────┐ ┌──────┐   │
│ ○Recently Used│ │ (+)  │ │📁    │   │
│               │ │ Add  │ │Test  │   │
│ 📁 Home       │ │Folder│ │1 lst │   │
│  📁 Test (1)  │ └──────┘ └──────┘   │
│  📁 Niche1    │                      │
│  📁 Niche2    │                      │
├───────────────┴──────────────────────┤
│                      [Open Folder]   │
└──────────────────────────────────────┘
```

- Tree Explorer (left) + Folder grid (right) with "Add Folder" card
- Breadcrumb navigation, Search for listings + folders
- Grid/List view toggle

**"Choose Action" — Command Palette (searchable action menu):**
```
┌─ Search through actions... ──────────────────────┐
│                                                    │
│ LISTING          │ FILES           │ IMAGE          │
│ ✏ Edit in Bulk   │ 🗑 Delete Files │ 🎨 Resize     │
│ 🗑 Delete        │ ⬇ Download      │ 🖼 Remove BG   │
│ 📁 Move to Coll. │                 │ ⬆ Upscale     │
│ 📋 Duplicate     │ EXPORT          │ 🔄 Vectorize   │
│ 🔄 Bulk Sync     │ 📊 Export XLSX   │                │
│ ↕ Sort Listings  │ 📄 Export CSV    │                │
│                  │                 │                │
│ GENERAL          │ CLOUD           │                │
│ 🌐 Translate     │ ☁ Send to Cloud │                │
│ 🏷 Bulk Tags     │ ⬇ Import Cloud  │                │
│ 🤖 AI Generate   │                 │                │
│ ✏ Edit           │                 │                │
│ 🎨 Canvas        │                 │                │
└──────────────────────────────────────────────────┘
```

### View 2: Cloud File System (integrated from PROJ-19)
Browse OneDrive / Google Drive folders directly in the Listing area. Same UI pattern as the Collection view but connected to cloud providers.

**Navigation between views:** Tab-style switcher at top:
- **[📁 My Designs]** — Server Collection Folder System (default)
- **[☁ Cloud Storage]** — Cloud Folder File System (OneDrive / Google Drive)

**Transfer between file systems:**
- Select designs in My Designs → "Choose Action" → "☁ Send to Cloud" → folder picker → upload
- Browse Cloud Storage → select images → "Import to Collection" → folder picker → download to server
- Drag between views (future enhancement, not MVP)

### View 3: Design Edit Page (Flying Upload Style)
Opens when user clicks "Edit Designs" with selected designs. Single scrollable page with all listing fields.

**Layout (Flying Upload inspired, our design system):**
```
┌─ Edit Listing ───────────────────────────────────┐
│ [Global] [Mba] [Displate]     [+ Add] [Shortcuts]│
├──────────────────────────────────────────────────┤
│ Design Tags (0/3) [+ Add]                        │
│ ← [thumb][thumb][thumb][thumb] → 1 of 5          │
├──────────────────────────────────────────────────┤
│ Products (74)                        Options ⊙   │
│ [T-Shirt 7][Premium 2][Heavy 2][V-Neck 6]...    │
├──────────────────────────────────────────────────┤
│ Fit Type ⊙              Print ⊙                 │
│ ☑Men ☑Women ☐Youth     ● Front ☐ Back          │
├──────────────────────────────────────────────────┤
│ Colors (14)                          Options ⊙   │
│ (color circles grid with ✓ selection)            │
├──────────────────────────────────────────────────┤
│ Marketplaces & Prices                Options ⊙   │
│ Amazon.com ☑ 19.95  Amazon.co.uk ☑ 19.95  ...  │
│ Royalty $4.85       Royalty £5.98               │
├──────────────────────────────────────────────────┤
│ 🇬🇧EN 🇩🇪DE 🇫🇷FR 🇮🇹IT 🇪🇸ES 🇯🇵JA                    │
│ [Auto Translate ●]  [Translate to All ▾]         │
│                                                   │
│ Brand ⊙               Title ⊙                   │
│ [Best School Bus...]   [School Bus Driver...]    │
│                 46/50                      47/60  │
│                                                   │
│ Bulletpoint 1 ⊙        Bulletpoint 2 ⊙           │
│ [School Bus Driver...] [You live the real...]    │
│               242/256                   231/255  │
│                                                   │
│ Description ⊙                                    │
│ [School Bus Driver Funny I Feel Great...]        │
│                                          532/2000 │
├──────────────────────────────────────────────────┤
│ [Options] [Trademarks]                            │
│ Availability ⊙: ● Public ○ Private              │
│ Publish ⊙: ● Live ○ Draft                       │
└──────────────────────────────────────────────────┘
```

- **"Options ⊙" per section:** Opens the Command Palette filtered to that section's actions (Copy from..., Apply to all, Reset). This is the central bulk-edit mechanism
- **Horizontal Thumbnail Strip:** Navigate between designs with ← → arrows + "1 of 5" counter
- **Marketplace Tabs (Global/Mba/Displate) — Independent Listing Variants** (decided 2026-04-18):
  - Each tab holds its OWN Listing record per design — NOT a filter/view over one shared listing.
  - **Global**: for Spreadshirt + future simple-upload marketplaces. Schlanker Feld-Set.
  - **Mba**: for Merch by Amazon. Full complex field set (Brand, Title, 5 Bullets, Description, Backend Keywords, per-region pricing).
  - **Displate**: future placeholder.
  - **Conversion via Options ⊙** (bidirectional, user-triggered):
    - Global → MBA: maps Global text to Title/Brand/Bullet1 where possible, rest left empty.
    - MBA → Global: maps MBA fields back to Global's simpler shape.
    - If target tab already has data: confirmation dialog ("Overwrite existing MBA data?") — NO silent overwrite.
  - **Data Model Impact**: `Listing` model gets `marketplace_type` field (choices: `global`, `mba`, `displate`). Multiple Listing rows per Design allowed (one per marketplace_type). See AC-1.
- **Character counters:** Live count per field, amber at 90%, red at 100%
- **Language tabs:** EN, DE, FR, IT, ES, JA with Auto-Translate toggle
- **AI Generate:** One-click listing generation using slogan + design + keywords context
- **AI Improve:** Hover-icon on every text field → opens PROJ-17 Chat with field context

**Merges:** former PROJ-11 (Listing & Keyword Generator) + former PROJ-13 (Marketplace Upload Manager, web portion) + former PROJ-19 (Global Cloud Picker — cloud file system now embedded here).

## User Stories

### Design Collection (Server Folder System)
1. As a member, I want a Collection Folder system to organize my designs in folders (like MyDesigns.io Listings Collection), so I can group designs by niche, round, or campaign.
1b. As a member, I want to create, rename, move, and delete folders in a Collections dialog with Tree Explorer (left) and Folder Grid (right), so I can manage my folder structure.
1c. As a member, I want designs displayed as a card grid with thumbnails, title/tags label, and import date inside each folder, so I can browse visually.
1d. As a member, I want to place designs into folders — from file upload, from Canvas/Drawer ("Save to Listings" action), or by moving between folders.
2. As a member, I want to browse my Google Drive and OneDrive directly in a "Cloud Storage" tab (same UI as My Designs), so I can manage cloud files without leaving the app.
2b. As a member, I want to transfer images from Server Collection to Cloud Storage and vice versa ("Send to Cloud" / "Import from Cloud"), so I can sync between local and cloud.
3. As a member, I want to sort (newest, recently edited), filter (no listing, show duplicates), and search designs within a folder, so I find what I need quickly.
4. As a member, I want to select multiple designs via click, Shift+Click, or lasso-select (hold left mouse + drag over cards), and perform bulk actions via a bottom Action Bar.
4b. As a member, I want a "Choose Action" command palette (searchable, categorized: Listing, General, Files, Export, Image, Cloud) to perform any action on selected designs.

### Product Configuration
5. As a member, I want to select product types from a visual grid (Standard T-Shirt, Premium, V-Neck, Tank Top, Long Sleeve, Hoodie, PopSockets, Phone Cases, Mugs, etc.) with count badges, so I see what's configured at a glance.
6. As a member, I want to configure Fit Type (Men, Women, Youth, Girls, Adult Unisex), Print Side (Front/Back), and Colors from the full MBA color palette per design.
7. As a member, I want to set Marketplaces & Prices per marketplace (Amazon.com, .co.uk, .de, .fr, .it, .es, .co.jp) with toggle on/off, price input, and royalty display.

### Listing Editor
8. As a member, I want to generate an MBA-ready listing (Brand, Title, Bullets 1-5, Description, Backend Keywords) via AI with one click, using slogan + design + keywords as context.
9. As a member, I want live character counters on every field (Brand 50, Title 60, Bullets 256 each, Description 2000, Keywords 500) that turn amber at 90% and red at 100%.
10. As a member, I want to hover over any listing field to see an "Improve" icon that opens Chat (PROJ-17) with that field as context for AI-powered refinement.
11. As a member, I want Multi-Language listing tabs (EN, DE, FR, IT, ES, JA) with "Auto Translate" toggle and "Translate to All" button.
12. As a member, I want to inject keywords from the Keyword Bank (PROJ-10) into backend keywords. If keywords are assigned to this design via design_template (PROJ-10), they are pre-selected.
13. As a member, I want a "Copy for MBA" button that copies the formatted listing to clipboard for manual paste.
14. As a member, I want the Keywords displayed as removable chips (like Flying Upload) with "+ Add" and "KW Finder" link to PROJ-10.

### Trademark Check
15. As a member, I want to run a TM Check on my listing text before uploading, so I don't accidentally use trademarked phrases.

### Bulk Operations
16. As a member, I want a Command Palette (`Ctrl+K`) with searchable actions: copy/apply listings, copy/apply colors, copy/apply fit types, copy/apply product settings between designs.
17. As a member, I want a bottom Action Bar when designs are selected showing contextual bulk actions: Edit Designs, Upload Batch, Apply Settings, Delete.
18. As a member, I want to save listing + product configurations as reusable Templates (brand, product types, fit, colors, marketplace, prices), so I don't reconfigure for every design.

### Upload Configuration
19. As a member, I want to set Availability (Public/Private) and Publish mode (Live/Draft) per listing.
20. As a member, I want a pre-upload validation that checks all required fields are filled, character limits met, design files present, and marketplace configured before allowing upload.
21. As a member, I want to queue upload jobs that are sent to the Desktop Upload App (PROJ-13) via WebSocket for execution.
22. As a member, I want to see upload progress, status (pending/uploading/completed/failed), and ASIN after successful upload — all on this page.

### Product Lifecycle
23. As a member, I want to see the full lifecycle chain per design: which Slogan → which Niche → which Listing → which ASIN + Marketplace + Upload Date, so I can trace every product back to its origin.
24. As a member, I want ASIN, upload date, and marketplace stored on the Listing/Design record after successful upload from the Desktop App.

### Agent Integration (PROJ-18)
25. As a member, I want the Listing Agent to generate listings, edit fields, mark as ready, and queue uploads autonomously (with permission controls).
26. As a member, I want the Publishing Agent to create upload jobs and track upload status.

### Round System
27. As a member, I want listings and uploads grouped by Round (Round 1, Round 2, etc.) matching the Niche round system, so I can track which batch of designs belongs to which campaign.

### Per-Design Product Config Persistence (added 2026-04-18)
28. As a member, I want product config (colors, fit types, print side, product types, marketplace pricing) to persist per design and per marketplace, so a page reload doesn't wipe my setup.
29. As a member, I want to copy product config from a sibling design in the same Edit tab — scoped per section (Copy Colors From, Copy Fit Types From, Copy Prices From, Copy Product Types From) — so I don't reconfigure from scratch.
30. As a member, I want each marketplace tab (Global / MBA / Displate) to keep its own product config per design, so MBA config doesn't leak into Displate.
31. As a Desktop Upload App user (PROJ-13), I want per-design product config read from the backend, so the app knows which MBA variant matrix (product_types × fit_types × colors × marketplaces) to publish per design.

### Listing Templates + MBA Defaults (added 2026-04-19)
32. As a member, I want to save a Listing as a "Listing Template" (without a linked design), so I can reuse its text (brand, title, bullets, description, keywords) as the source for future convert operations.
33. As a member, I want to list and delete my saved Listing Templates, so I can manage them over time.
34. As a member, I want to designate one `UploadTemplate` per marketplace as the Default, so my configured colors / fit types / prices / product types are auto-applied when I convert a Listing from Global to MBA and the target design has no product config yet.
35. As a member, I want my designated Default UploadTemplate to NOT overwrite a target's existing product config on Convert, so auto-fill never clobbers manual setup.

### Per-Card Quick Actions (added 2026-04-19)
36. As a member, I want a 3-dot menu on every DesignCard that exposes Edit, Duplicate, Move to Collection, Add Tags, and Delete actions for that single design, so I don't have to first select the card and hunt for the Action Bar.
37. As a member, I want to click "Add Tags" on a card (or from its 3-dot menu) to open an inline chip editor directly on the card, add/remove tags with keyboard, and have the tags persisted immediately (auto-save on blur or Enter).
38. As a member, I want "Edit" in the card 3-dot menu to navigate straight to `/publish/edit?designs=<id>` without requiring prior selection, so the single-card edit path is one click.

### Per-Card Menu Actions — Delete / Duplicate / Move (added 2026-04-20)
39. As a member, I want "Delete" in the card 3-dot menu to open a confirm dialog ("Delete {{file_name}}?") before removing the design, so I don't accidentally lose work. On confirm the card disappears immediately (optimistic) and a success snackbar appears.
40. As a member, I want "Duplicate" in the card 3-dot menu to create a copy of the design as a brand-new DesignAsset (new UUID, copied file, same tags, same Collection) with `listing` and `idea` cleared, so I can iterate on variants without touching the original's linkage.
41. As a member, I want "Move to Collection" in the card 3-dot menu to open a dedicated folder picker (not the browsing CollectionsDialog) so I can pick a target folder — including "Root" — and hit "Move Here" to relocate the single design.

## Acceptance Criteria

### Models

- [ ] AC-1: `Listing` model (updated 2026-04-18): UUID pk, `idea` FK, `design` FK (nullable), `marketplace_type` choices [global, mba, displate] default=mba (added 2026-04-18 — enables independent listing variants per design per marketplace), `round` (PositiveIntegerField, default=1 — matches Niche.current_round), `brand_name` (max 50), `title` (max 60), `bullet_1..5` (max 256 each), `description` (max 2000), `backend_keywords` (max 500), `status` choices [draft, ready, published], `generated_by` choices [ai, manual], `availability` choices [public, private] default=public, `publish_mode` choices [live, draft] default=live, `language` (CharField, default='en'), `translations` (JSONField — {lang: {title, bullets, description}}), `created_at`, `updated_at`. **Unique constraint**: `(design, marketplace_type)` — one listing record per design per marketplace_type.

- [ ] AC-2: `UploadTemplate` model: UUID pk, `workspace` FK, `name` (CharField 100), `brand_name` (CharField 50), `product_types` (JSONField — list of product type keys), `fit_types` (JSONField — list), `colors` (JSONField — list of MBA color codes), `marketplaces` (JSONField — list of {marketplace, price, enabled}), `print_side` choices [front, back, both] default=front, `created_by` FK, `created_at`, `updated_at`.

- [ ] AC-3: `UploadJob` model: UUID pk, `workspace` FK, `listing` FK, `design` FK, `template` FK (UploadTemplate), `listing_snapshot` (JSONField — denormalized listing at queue time), `marketplace` (CharField), `status` choices [pending, validating, uploading, completed, failed, cancelled], `asin` (CharField 20, blank=True), `upload_date` (DateTimeField, nullable), `error_message` (TextField, blank=True), `error_screenshot` (URLField, blank=True), `retry_count` (IntegerField, default=0), `queued_at`, `started_at` (nullable), `completed_at` (nullable), `created_by` FK.

- [ ] AC-4: `DesignAsset` model (Gallery): UUID pk, `workspace` FK, `file_name` (CharField 255), `file_url` (URLField — local storage or cloud URL), `source` choices [upload, google_drive, onedrive, generated], `source_file_id` (CharField 255, blank=True — Drive/OneDrive file ID), `thumbnail_url` (URLField, blank=True), `dimensions` (JSONField — {width, height}), `file_size` (IntegerField — bytes), `tags` (JSONField, default=list), `listing` FK (nullable — linked when listing created), `idea` FK (nullable — links back to source slogan), `niche` FK (nullable), `round` (PositiveIntegerField, default=1), `created_by` FK, `created_at`.

- [ ] AC-5: `ProductLifecycle` model: UUID pk, `niche` FK, `idea` FK (nullable), `design` FK (DesignAsset, nullable), `listing` FK (nullable), `upload_job` FK (nullable), `asin` (CharField 20, blank=True), `marketplace` (CharField, blank=True), `upload_date` (DateTimeField, nullable), `sales_units` (IntegerField, nullable), `sales_revenue` (DecimalField, nullable), `current_bsr` (IntegerField, nullable), `reviews_count` (IntegerField, nullable), `reviews_rating` (DecimalField, nullable), `round` (PositiveIntegerField, default=1), `updated_at`.

### Listing API

- [ ] AC-6: `POST /api/ideas/{id}/listing/generate/` — accepts `{design_id, extra_keywords, language}`. Creates Listing with AI. If design has PROJ-10 design_template keywords → auto-injected.
- [ ] AC-7: `GET /api/ideas/{id}/listing/` — returns listing with lifecycle chain.
- [ ] AC-8: `PATCH /api/listings/{id}/` — partial update. Status reverts to draft on edit.
- [ ] AC-9: `POST /api/listings/{id}/translate/` — body: `{target_languages: ["de", "fr"]}`. AI translates listing fields. Stored in `translations` JSONField.
- [ ] AC-10: `POST /api/listings/{id}/tm-check/` — checks title + bullets + description against TM database. Returns list of flagged terms.
- [ ] AC-11: `GET /api/listings/{id}/export/` — plain-text MBA format.

### Design Gallery API

- [ ] AC-12: `GET /api/designs/gallery/` — paginated design gallery for workspace. Filterable by tags, has_listing, sort_by.
- [ ] AC-13: `POST /api/designs/gallery/upload/` — direct file upload (multipart).
- [ ] AC-14: `POST /api/designs/gallery/import-drive/` — body: `{file_ids: [...], provider: "google_drive"|"onedrive"}`. Imports from cloud storage.
- [ ] AC-15: `DELETE /api/designs/gallery/{id}/` — remove design.
- [ ] AC-16: `PATCH /api/designs/gallery/{id}/` — update tags, link to niche/idea.

### Upload Job API

- [ ] AC-17: `POST /api/upload-jobs/` — create + queue upload job. Validates listing + design + template. Job sent to Desktop App via WebSocket.
- [ ] AC-18: `POST /api/upload-jobs/batch/` — body: `{design_ids: [...], template_id}`. Creates one job per design.
- [ ] AC-19: `GET /api/upload-jobs/` — list jobs (paginated, filterable by status).
- [ ] AC-20: `GET /api/upload-jobs/{id}/` — job detail + status.
- [ ] AC-21: `POST /api/upload-jobs/{id}/cancel/` — cancel pending job.
- [ ] AC-22: `PATCH /api/upload-jobs/{id}/` — Desktop App reports status, ASIN, errors, screenshot.

### Upload Template API

- [ ] AC-23: CRUD for `UploadTemplate`: `GET/POST /api/upload-templates/`, `GET/PATCH/DELETE /api/upload-templates/{id}/`.

### Bulk Operations API

- [ ] AC-24: `POST /api/designs/gallery/bulk-action/` — body: `{ids: [...], action: "apply_template"|"apply_listing"|"delete", source_id: "uuid"}`. Applies settings from one design to others.

### Product Lifecycle API

- [ ] AC-25: `GET /api/niches/{id}/lifecycle/` — returns full lifecycle chains for all designs in niche, grouped by round.
- [ ] AC-26: `PATCH /api/lifecycle/{id}/` — update sales data (from Extension or API).

### WebSocket (Desktop App Communication)

- [ ] AC-27: WebSocket endpoint `ws://server/ws/upload-app/` — authenticated per workspace. Pushes new upload jobs to connected Desktop App. Receives status updates.
- [ ] AC-28: If no Desktop App connected → upload jobs stay in `pending` status. UI shows: "Desktop App not connected. Start the Upload App to process jobs."

### Frontend

- [ ] AC-29: Single scrollable Publish page with all sections visible (not stepper).
- [ ] AC-30: Command Palette (`Ctrl+K`) with searchable actions for all copy/apply operations.
- [ ] AC-31: Bottom Action Bar on design selection with contextual bulk actions.
- [ ] AC-32: Chat hover-icon ("Improve") on every listing text field → opens Chat with field context.
- [ ] AC-33: MBA character counters: amber at 90%, red at 100%.
- [ ] AC-34: Keyword chips (removable, + Add) with link to PROJ-10 KW Finder.
- [ ] AC-35: Upload status visible inline: pending → uploading → completed (ASIN shown) / failed (error + screenshot).
- [ ] AC-36: Design Gallery as card grid with import, sort, filter, bulk actions.

### MBA Reference Data API

- [ ] AC-37: `GET /api/mba/colors/` — returns canonical MBA garment color palette (added 2026-04-18). Response: array of `{ key, name, hex }` objects. No pagination, no workspace scope (global read-only list). Used by Edit Page ColorGrid component. Central source so frontend does not hardcode Amazon's color palette.

### Per-Design Product Config Persistence (added 2026-04-18)

> Motivation: D7 Copy-from-Design requires per-design product config. Today Colors / Fit Types / Print Side / Product Types / Marketplace Pricing live only in React state — reload wipes them. Also: Desktop Upload App (PROJ-13) needs per-design config to know which MBA variants to publish. Promoted to persistent backend model.

- [ ] AC-38: `DesignProductConfig` model: UUID pk, `design` FK (DesignAsset, on_delete=CASCADE), `marketplace_type` choices [global, mba, displate] default=mba (same enum as Listing), `product_types` (JSONField default=list — list of product type keys like `t_shirt`, `hoodie`, `tank_top`), `fit_types` (JSONField default=list — e.g. `men`, `women`, `youth`), `print_side` choices [front, back, both] default=front, `colors` (JSONField default=list — list of MBA color keys matching AC-37 palette), `marketplaces` (JSONField default=list — list of `{marketplace, price, enabled}` entries, one per Amazon marketplace like `amazon.com`, `amazon.de`), `created_at`, `updated_at`. **Unique constraint**: `(design, marketplace_type)` — one config row per design per marketplace.
- [ ] AC-39: `GET /api/designs/{design_id}/product-config/?marketplace_type=mba` — returns the config row for that `(design, marketplace_type)` pair. Default `marketplace_type=mba` if omitted. Returns 404 when no config exists (frontend falls back to empty defaults). Workspace isolation via `design.workspace`.
- [ ] AC-40: `PATCH /api/designs/{design_id}/product-config/` — upserts (create if missing, update if exists). Body: `{marketplace_type, product_types?, fit_types?, print_side?, colors?, marketplaces?}`. `marketplace_type` required; other fields optional (partial update). Returns 200 with full updated record. Validates `marketplace_type` against enum, `colors[]` against MBA palette keys (AC-37), `marketplaces[*].price` as decimal > 0.
- [ ] AC-41: `POST /api/designs/{design_id}/product-config/copy-from/` — copies config from a source design to this design. Body: `{source_design_id, marketplace_type, scope}` where `scope` ∈ `['all', 'colors', 'fit_types', 'print_side', 'product_types', 'marketplaces']`. `scope=all` copies every field; scalar scopes copy just that field. Upserts target config row. Returns 200 with full updated target record. Returns 404 if source has no config for `marketplace_type`. Both designs must belong to caller's workspace.
- [ ] AC-42: Listing endpoints unchanged — `DesignProductConfig` is a sibling record, not a field on Listing. Generate/Save flows for `Listing` ignore product config.
- [ ] AC-43: Frontend `useEditView` — `productConfig` sourced via RTK Query keyed on `(activeDesign.id, activeMarketplace)`. Setters trigger debounced `PATCH` (auto-save, same 1200ms pattern as listing). Switching active design or marketplace loads the matching row. Copy-from-Design dialog calls the copy-from endpoint instead of client-side state copy.
- [ ] AC-44: Desktop Upload App (PROJ-13) reads `DesignProductConfig` via a listing's linked design to determine which MBA variant combinations to upload (product_types × fit_types × colors × marketplaces). Backend serializer exposes config when the App fetches an upload job's snapshot.

### Listing Templates (added 2026-04-19)

> Motivation: Users should be able to save standalone Listings (text only, no linked design) as reusable templates. Convert endpoint accepts them as source so a saved template can seed a brand-new target Listing.

- [ ] AC-45: `Listing` model adds `is_template` BooleanField (default=False). Migration backfills existing rows to False.
- [ ] AC-46: Model validation (`clean()` + serializer): when `is_template=True`, `design` must be NULL — raises ValidationError on save/POST if violated. When `is_template=False`, `design` remains optional (existing behavior).
- [ ] AC-47: `GET /api/listings/templates/` — paginated list of `is_template=True` Listings in the caller's workspace (via `idea.niche.workspace` or however workspace is reachable from Listing). Supports `?marketplace_type=` filter. Ordered by `-created_at`.
- [ ] AC-48: `POST /api/listings/templates/` — creates a Listing with `is_template=True, design=NULL`. Body accepts: `brand_name, title, bullet_1..5, description, backend_keywords, language, marketplace_type, idea` (idea FK required; a template is still linked to an Idea for context). Returns 201.
- [ ] AC-49: `DELETE /api/listings/<id>/` — existing endpoint; must not 403 when the listing is a template. Workspace isolation still enforced.
- [ ] AC-50: `POST /api/listings/convert/` — unchanged contract, but `source_listing_id` may now refer to a template (`is_template=True, design=NULL`). Existing null-design behavior (always create new target) remains — the target Listing inherits the source's `design=NULL` unless a design FK is provided (future extension). Target Listing has `is_template=False` by default (converting a template materializes a non-template listing).
- [ ] AC-51: Regular listing list endpoints (`GET /api/ideas/<id>/listing/`) exclude templates from their default queryset so UI surfaces for active designs do not show templates.

### Default UploadTemplate + Convert Auto-Apply (added 2026-04-19)

> Motivation: When converting Global → MBA, the target design often has no `DesignProductConfig` yet. A workspace Default UploadTemplate (per marketplace) auto-fills colors / fit_types / print_side / product_types / marketplaces so the user does not redo per-design setup.

- [ ] AC-52: `UploadTemplate` model adds `is_default` BooleanField (default=False) AND `marketplace_type` CharField choices `[global, mba, displate]` default=`mba`. Migration backfills existing rows: `is_default=False`, `marketplace_type='mba'`.
- [ ] AC-53: DB-level partial unique index — at most one `UploadTemplate` per `(workspace, marketplace_type)` with `is_default=True`. Implement via Django `UniqueConstraint(fields=['workspace', 'marketplace_type'], condition=Q(is_default=True), name='upload_template_single_default')`.
- [ ] AC-54: `PATCH /api/upload-templates/<id>/` — when body sets `is_default=True`, view wraps the update in an atomic transaction and clears `is_default` on every other `UploadTemplate` in the same `(workspace, marketplace_type)` set before saving the target. Prevents IntegrityError from the partial unique index.
- [ ] AC-55: `POST /api/upload-templates/` — creation with `is_default=True` applies the same clear-then-set behavior.
- [ ] AC-56: `GET /api/upload-templates/default/?marketplace_type=mba` — returns the single default template for the caller's workspace + marketplace_type, or 404 if none set. Used by frontend "Default Template" indicator.
- [ ] AC-57: `POST /api/listings/convert/` — when `target_marketplace_type=mba` (or any supported marketplace) AND the target Listing has a linked design AND no `DesignProductConfig` exists for `(target.design, target_marketplace_type)`, then: (1) look up the workspace's default UploadTemplate matching `target_marketplace_type`; (2) if found, create a `DesignProductConfig` seeded from `default_template.colors / fit_types / print_side / product_types / marketplaces`; (3) if no default, leave product config empty (no row created). Convert response includes a `product_config_seeded: bool` flag indicating whether an auto-apply happened.
- [ ] AC-58: Auto-apply on Convert is a READ-ONLY operation against `UploadTemplate` — it does not modify the template. The seeded `DesignProductConfig` is an independent row; future edits to the template do NOT propagate back.
- [ ] AC-59: Convert to a target where `target.design` is NULL (null-design source+target) → skip product config auto-apply (no design to attach config to). Convert still succeeds.

### Per-Card Quick Actions (added 2026-04-19)

- [ ] AC-60: `DesignCard` MoreVert (3-dot) IconButton opens an MUI Menu anchored to the card with items: **Edit**, **Duplicate**, **Move to Collection**, **Add Tags**, **Delete**. Menu click `stopPropagation` so it does not trigger card selection. Each item fires a prop callback (`onEditSingle`, `onDuplicate`, `onMove`, `onAddTags`, `onDeleteSingle`). Icons: EditOutlined / ContentCopyOutlined / DriveFileMoveOutlined / LocalOfferOutlined / DeleteOutline. Delete item uses `error.main` color.
- [ ] AC-61: Card menu "Edit" navigates to `/publish/edit?designs=<this-card-id>` WITHOUT requiring prior selection. Clears any existing selection implicitly (query string is the source of truth for EditView).
- [ ] AC-62: Clicking "Add Tags" link (or menu item) on a card reveals an inline `Autocomplete freeSolo multiple` chip editor (MUI) anchored to the info strip. User types tag → Enter/comma commits → chip added. Blur or Enter persists via `PATCH /api/designs/gallery/<id>/` with `{tags: [...]}`. Escape cancels without save. Optimistic update on RTK cache.
- [ ] AC-63: Inline tag editor auto-focuses input on open. Empty string on blur closes without PATCH. Tags array enforces max length 20 chars per tag, max 10 tags total (serializer validation). Duplicate tags within a single design are deduplicated client-side.

### Per-Card Menu Actions — Delete / Duplicate / Move (added 2026-04-20)

- [ ] AC-64: Card menu "Delete" → opens `ConfirmDialog` with title "Delete {{file_name}}?" and warning color. On confirm fires `DELETE /api/designs/gallery/<id>/` via `useDeleteDesignMutation`. Optimistic removal from every active `listGallery` cache entry via `onQueryStarted` patch. On 4xx/5xx the patch reverts and an error snackbar appears; on success a success snackbar appears.
- [ ] AC-65: New backend endpoint `POST /api/designs/gallery/<id>/duplicate/` — authenticated, workspace-isolated. Loads the source asset, copies the underlying file to a fresh storage path (new object key, no overwrite), creates a new `DesignAsset` row with: new UUID, same `workspace`, same `file_name`, same `tags`, same `collection`, `source='upload'`, cleared `listing`, cleared `idea`, cleared `niche`, `file_size` + `dimensions` re-copied. Returns 201 with the new asset using `DesignAssetSerializer`. Cross-workspace source → 404.
- [ ] AC-66: Card menu "Duplicate" → `useDuplicateDesignMutation` fires `POST /api/designs/gallery/<id>/duplicate/`. Invalidates `GalleryList` tag so the new card appears on refetch. Success snackbar; error snackbar on failure.
- [ ] AC-67: Card menu "Move to Collection" → opens a dedicated `MovePickerDialog` (separate from browsing `CollectionsDialog`) showing: folder tree + "Root" pseudo-entry + single "Move Here" primary button. Select → click "Move Here" → `POST /api/designs/gallery/move/` with `{asset_ids: [id], collection_id: <target_or_null>}`. Optimistic patch of every active `listGallery` cache entry to reflect the new `collection` FK. Revert on error.
- [ ] AC-68: `MovePickerDialog` disables (greys out) the asset's current `collection` entry in the tree — selecting it is blocked, the "Move Here" button stays disabled until a different target is picked. "Root" entry is disabled only when the asset is already at root (`collection=null`).

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/ideas/{id}/listing/generate/` | Member | AI generate listing |
| GET | `/api/ideas/{id}/listing/` | Member | Get listing |
| PATCH | `/api/listings/{id}/` | Member | Edit listing |
| POST | `/api/listings/{id}/translate/` | Member | AI translate listing |
| POST | `/api/listings/{id}/tm-check/` | Member | Trademark check |
| GET | `/api/listings/{id}/export/` | Member | Export MBA format |
| GET | `/api/designs/gallery/` | Member | Design gallery |
| POST | `/api/designs/gallery/upload/` | Member | Upload design |
| POST | `/api/designs/gallery/import-drive/` | Member | Import from Drive/OneDrive |
| DELETE | `/api/designs/gallery/{id}/` | Member | Delete design |
| PATCH | `/api/designs/gallery/{id}/` | Member | Update design |
| POST | `/api/designs/gallery/bulk-action/` | Member | Bulk operations |
| POST | `/api/upload-jobs/` | Member | Create upload job |
| POST | `/api/upload-jobs/batch/` | Member | Batch create jobs |
| GET | `/api/upload-jobs/` | Member | List jobs |
| GET | `/api/upload-jobs/{id}/` | Member | Job detail |
| POST | `/api/upload-jobs/{id}/cancel/` | Member | Cancel job |
| PATCH | `/api/upload-jobs/{id}/` | Agent | Agent reports status |
| GET/POST/PATCH/DELETE | `/api/upload-templates/` | Member | Template CRUD |
| GET | `/api/niches/{id}/lifecycle/` | Member | Product lifecycle |
| GET | `/api/designs/{id}/product-config/` | Member | Get per-design product config (query `marketplace_type`) |
| PATCH | `/api/designs/{id}/product-config/` | Member | Upsert per-design product config |
| POST | `/api/designs/{id}/product-config/copy-from/` | Member | Copy config from sibling design |
| GET | `/api/listings/templates/` | Member | List workspace's Listing Templates |
| POST | `/api/listings/templates/` | Member | Create a Listing Template (null-design) |
| GET | `/api/upload-templates/default/` | Member | Get default UploadTemplate for `?marketplace_type=` |
| WS | `/ws/upload-app/` | App | Desktop Upload App WebSocket |

## Frontend Design Decisions (2026-04-09 `/frontend-design` Session)

> **MANDATORY for `/architecture`:** These design decisions MUST be reflected 1:1 in the task file. Every styled component, token mapping, and animation specified here is a requirement, not a suggestion. The `/frontend` skill implements exactly what the tasks say.

### FD-0: Icon Strategy (same as PROJ-9)

MUI Icons first. When no fitting MUI icon exists, create custom SVG icons in `frontend-ui/src/assets/icons/`. Custom icons: `currentColor`, 24px viewBox, 1.5px stroke, rounded caps, MUI Outlined style. Replace all emoji placeholders with proper SVGs.

---

### FD-PROJ11-1: Listings Toolbar

**2-Row sticky toolbar:** Row 1 = Actions, Row 2 = File System Tab-Switcher + Breadcrumbs.

**Row 1 (48px):**
- bg: `COLORS.inkPaper` (dark) / `theme.vars.palette.background.paper` (light)
- border-bottom: `theme.vars.palette.divider`
- padding: `theme.spacing(0, 3)`, flex, align center, gap `theme.spacing(1.5)`

**Left group:**
- Select Counter: Button outlined small, `theme.spacing(4)` height, checkbox icon + "0/11" + dropdown. Selected state: border `alpha(COLORS.cyan, 0.30)`, color `COLORS.cyan`, bg `alpha(COLORS.cyan, 0.06)`
- Collections: Button outlined small, FolderOutlined icon, `text.primary`. Opens Collections Dialog
- Choose Action: Button outlined small, BoltOutlined icon, dropdown arrow. Opens Command Palette

**Center (separator + view + search):**
- Separator: 1px × 24px `theme.vars.palette.divider`
- View Toggle: MUI ToggleButtonGroup small, ViewListOutlined / GridViewOutlined. Active: `alpha(COLORS.red, 0.12)` bg, `COLORS.red` color
- Search: TextField outlined small, 240px→320px on focus, `COLORS.inkElevated` bg, SearchOutlined adornment

**Right group (flex-end):**
- Template: Button outlined small, EditNoteOutlined icon
- Upload: Button outlined small, FileUploadOutlined icon
- Publish: Button **contained** small, `secondary.main` (cyan) bg, RocketLaunchOutlined icon. Hover: `COLORS.cyanDk` + glow `alpha(COLORS.cyan, 0.25)`

**Row 2 (40px) — File System Switcher + Breadcrumbs:**
- bg: transparent, border-bottom divider, flex space-between

**Tab Switcher (left):**
- Two tabs: [📁 My Designs] (default active) + [☁ Cloud Storage]
- Tab: `subtitle2`, `text.secondary`, padding `theme.spacing(1, 2.5)`, icon 18px + label
- Active: `secondary.main` (cyan) + 2px underline `COLORS.cyan` (slides horizontally on switch)
- Cloud tab connection dot: 8px absolute top-right, `COLORS.successDk` (connected) / `COLORS.warningDk` (disconnected, pulse animation)

**Breadcrumbs (right):**
- My Designs: `📁 Home › School Bus › Round 1`
- Cloud: Provider Chip (small, outlined, provider icon) + `☁ OneDrive › POD Designs › ...`
- Crumb: `body2`, `text.secondary`, hover `text.primary`. Active (last): weight 600, `text.primary`
- Separator: `›`, `caption`, `text.disabled`, margin `theme.spacing(0, 1)`

**Tab-context button changes:**
- Cloud tab: Collections→"Folders", Upload→"Import" (CloudDownloadOutlined), new "Send to Cloud" button (outlined, `COLORS.cyan`)

**Transfer pill (when items selected + tab switch):**
- Between tabs, `alpha(COLORS.cyan, 0.15)` bg, `alpha(COLORS.cyan, 0.30)` border, pill radius `theme.shape.borderRadius * 2`, `caption` + `COLORS.cyan`. Shows "→3→" (arrow + count). Click opens transfer dialog. Appear: `opacity + scale(0.9→1)`, `DURATION.fast`

**Animations:**
1. Tab underline slide: `left` transition, `DURATION.fast`, `EASING.standard`
2. Transfer pill appear: `opacity + scale`, `DURATION.fast`, `EASING.enter`
3. Connection dot pulse (disconnected): `opacity 0.5↔1.0`, 2s
4. Search expand on focus: width 240→320px, `DURATION.default`
5. Button label morph (Collections↔Folders): `opacity`, `DURATION.fast`

---

### FD-PROJ11-2: Design Card Grid

**Grid:** CSS Grid `repeat(auto-fill, minmax(240px, 1fr))`, gap `theme.spacing(2.5)`, responsive 5→4→3→2→1 columns.

**Card Container:**
- bg: `COLORS.inkPaper`, border `theme.vars.palette.divider`, radius `theme.shape.borderRadius * 1.5` → 12px
- hover: border `alpha('#fff', 0.16)`, `translateY(-2px)`, shadow `alpha(COLORS.ink, 0.40)`

**Thumbnail:** `aspect-ratio: 1/1`, `object-fit: contain` (NOT cover — shows full POD design), padding `theme.spacing(1.5)`, bg fallback `alpha(COLORS.ink, 0.30)`. Hover: `scale(1.03)`, `DURATION.default`

**Selection Checkbox (top-left, absolute):**
- Unchecked: 20px, radius 4px, `alpha('#fff', 0.40)` border, `alpha(COLORS.ink, 0.50)` bg + blur(4px)
- Checked: `COLORS.cyan` bg, '#fff' checkmark, glow `alpha(COLORS.cyan, 0.40)`
- Visibility: `opacity 0→1` on hover OR when any card selected. Checked = always visible

**Hover Action Icons (top-right, absolute):**
- 28px IconButtons, `alpha(COLORS.ink, 0.50)` bg + blur(4px), `text.primary`
- Duplicate (ContentCopyOutlined) + Move (DriveFileMoveOutlined)
- `opacity 0→1` on hover

**Glass Info Strip (bottom overlay):**
- `alpha(COLORS.inkPaper, 0.85)` + `blur(12px)`, border-top `alpha('#fff', 0.06)`, padding `theme.spacing(1.25, 1.5)`
- Title: `subtitle2`, `text.primary`, ellipsis + MoreVert IconButton 24px
- Tags: 20px height Chips, `alpha(COLORS.cyan, 0.10)` bg, `COLORS.cyan` color, radius 4px. "Add Tags" link when empty
- Date: `caption`, `text.disabled`

**Selection States:**
- Click: toggles, single select deselects others
- Shift+Click: range select
- Lasso: rubber band `COLORS.cyan` dashed 1.5px, bg `alpha(COLORS.cyan, 0.06)`, radius 4px
- Selected: 2px `COLORS.cyan` border, glow `alpha(COLORS.cyan, 0.20)`, title color → `COLORS.cyan`

**List View (toggle [≡]):**
- Rows 56px, checkbox always visible, thumb 40×40px contain, `subtitle2` title, tag chips, `caption` date
- Selected: bg `alpha(COLORS.cyan, 0.06)`, left border 2px `COLORS.cyan`

**"Add Designs" Card:** Dashed border `alpha('#fff', 0.12)`, AddCircleOutline 40px `text.disabled`, hover border `alpha(COLORS.cyan, 0.30)` + icon `COLORS.cyan`

**Storage Indicator:** `caption`, `text.disabled`, "11 Designs · 0.06GB of 500GB"

**Animations:**
1. Card hover: lift + shadow + border, `DURATION.fast`
2. Image zoom: `scale(1.03)`, `DURATION.default`
3. Checkbox appear: `opacity + scale(0.85→1)`, `DURATION.fast`
4. Selection glow: `box-shadow` fade, `DURATION.fast`
5. Lasso: live `requestAnimationFrame`, no transition
6. Card enter (staggered): `opacity + translateY(12px)→0`, `DURATION.default`, 30ms stagger (max 300ms)

---

### FD-PROJ11-4: Command Palette ("Choose Action")

**Trigger:** 
1. "Choose Action" toolbar button (click) — opens unfiltered (all categories)
2. `Ctrl+K` / `Cmd+K` (global shortcut) — opens unfiltered
3. **"Options ⊙" button on any Edit Page section** — opens **pre-filtered** to that section's actions only. E.g. "Options ⊙" on Colors → palette opens showing only: "Copy Colors From...", "Apply Colors to All", "Reset Colors". Same component, different `context` prop.

**Container:**
- bg: `alpha(COLORS.inkPaper, 0.95)` + `blur(24px)`, border `alpha('#fff', 0.10)`, radius `theme.shape.borderRadius * 1.5` → 12px
- shadow: `0 16px 64px ${alpha(COLORS.ink, 0.60)}`
- maxWidth `theme.spacing(112.5)` → 900px, width 90vw, maxHeight `theme.spacing(62.5)` → 500px
- Keyboard trigger: centered overlay with backdrop `alpha(COLORS.ink, 0.40)` + `blur(4px)`

**Search Header:**
- MUI InputBase (borderless), `body1` font, auto-focus
- SearchOutlined 20px start adornment, `text.disabled`
- Shortcut hint end adornment: "⌘K" `caption`, bg `alpha('#fff', 0.06)`, border `alpha('#fff', 0.08)`, radius 4px
- padding `theme.spacing(2, 2.5)`, border-bottom divider

**Action Grid:** 3-column CSS grid, gap `theme.spacing(3)`, padding `theme.spacing(2)`

**Category Header:** `overline` (11px, 600), `text.disabled`, uppercase

**Action Item:**
- padding `theme.spacing(0.875, 1.5)`, radius `theme.shape.borderRadius * 0.75` → 6px
- Icon 18px `text.secondary` + Label `body2` `text.primary`
- Hover: bg `alpha('#fff', 0.06)`. Keyboard active: bg `alpha(COLORS.cyan, 0.10)`, border `alpha(COLORS.cyan, 0.20)`, color `COLORS.cyan`
- Pro badge (future): WorkspacePremiumOutlined 14px, `COLORS.warningDk`
- Disabled: opacity 0.40, pointer-events none

**MVP Categories & Actions:**

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| **LISTING** | **FILES** | **TEMPLATES** |
| ✏ Edit in Bulk | 🗑 Delete Files | 📐 Apply Template |
| 🗑 Delete Listings | ⬇ Download | 📋 Copy Listing From... |
| 📁 Move to Collection | | 🎨 Copy Colors From... |
| 📋 Duplicate | **EXPORT** | 👕 Copy Fit Types From... |
| ↕ Sort Listings | 📊 Export as XLSX | 💰 Copy Prices From... |
| 🔄 Bulk Sync | 📄 Export as CSV | |
| **GENERAL** | **CLOUD** | |
| 🌐 Translate | ☁ Send to Cloud | |
| 🏷 Bulk Tags | ⬇ Import from Cloud | |
| 🤖 AI Generate Listing | | |

> **NOT MVP:** Image manipulation (Resize, Remove BG, Upscale, Vectorize, Overlays) → PROJ-9 Image Editor. Mockups → not scoped. Vision AI → PROJ-18. These may be added post-MVP as the palette is extensible.

**Search behavior:** Fuzzy match against label + category. Matched text highlighted `COLORS.cyan` + weight 600. Grid collapses to filtered single-column. "Recently Used" section (last 3 actions) shown when search empty, above categories.

**Animations:**
1. Open: `opacity + translateY(-8px)→0 + scale(0.98→1)`, `DURATION.default`, `EASING.enter`
2. Keyboard nav: active row bg slides, `DURATION.fast`
3. Search filter: items fade `opacity`, `DURATION.fast`
4. Action execute: flash `alpha(COLORS.cyan, 0.20)`, palette closes 150ms delay
5. Backdrop: `opacity 0→1`, `DURATION.default`

---

### FD-PROJ11-5: Bottom Action Bar

**Trigger:** Appears when selection count > 0, disappears when 0. Fixed floating bar.

**Container:**
- position fixed, bottom `theme.spacing(3)` → 24px, centered (`left 50%, translateX(-50%)`)
- bg: `alpha(COLORS.inkPaper, 0.90)` + `blur(20px)`
- border: `alpha('#fff', 0.12)`, radius `theme.shape.borderRadius * 1.5` → 12px
- shadow: `0 8px 32px ${alpha(COLORS.ink, 0.50)}`
- padding `theme.spacing(1, 2)`, flex center, gap `theme.spacing(1)`
- min-width `theme.spacing(50)` → 400px, max-width `theme.spacing(87.5)` → 700px
- z-index: `theme.zIndex.speedDial`

**Selection Counter (left, separated):**
- `subtitle2`, `COLORS.cyan` + InfoOutlined 14px `text.disabled`
- border-right `alpha('#fff', 0.08)`

**Action Buttons (shared style):**
- Button `variant="text"` `size="small"`, height `theme.spacing(4)` → 32px
- `caption` weight 500, `text.secondary`, icon 16px
- Hover: bg `alpha('#fff', 0.08)`, color `text.primary`
- radius `theme.shape.borderRadius * 0.75` → 6px

| Button | Icon | Special |
|--------|------|---------|
| Edit | EditOutlined | **Primary:** color `COLORS.cyan`, hover bg `alpha(COLORS.cyan, 0.12)` |
| All/None | CheckCircleOutline / RadioButtonUnchecked | Toggles icon + label |
| History | HistoryOutlined | Opens history drawer |
| Batch | CloudUploadOutlined | color `COLORS.successDk`, hover bg `alpha(COLORS.successDk, 0.10)` |
| Options ▾ | SettingsOutlined | Dropdown: Apply Template, Copy From, Apply Colors/Fit/Prices, Export Selected |

**Delete (far right, separated):**
- border-left `alpha('#fff', 0.08)`, IconButton 32px, DeleteOutline 18px
- `text.disabled` → hover `error.main` + bg `alpha(COLORS.errorDk, 0.10)`

**Animations:**
1. Enter: `translateY(100%)→0` + `opacity`, `DURATION.slow`, `EASING.enter`. Items stagger 30ms
2. Exit: `translateY(0→100%)` + `opacity`, `DURATION.default`, `EASING.exit`
3. Counter update: scale pop `1→1.15→1`, `DURATION.fast`
4. Delete hover: color + bg, `DURATION.fast`

**Responsive <600px:** Labels hidden, icons only, tooltips, min-width auto

---

### FD-PROJ11-6: Cloud Storage Tab

**Same card grid as FD-PROJ11-2** but browsing OneDrive/Google Drive. Only visible when "☁ Cloud Storage" tab active (FD-PROJ11-1 Row 2).

**Provider Switcher (breadcrumb area):**
- Clickable Chip `size="small"`, height `theme.spacing(3.5)` → 28px, bg `alpha(COLORS.inkElevated, 0.80)`, radius `theme.shape.borderRadius`
- Avatar: provider SVG icon 16px (OneDrive #0078D4, GDrive #4285F4)
- Label: `caption` weight 600. ExpandMore 14px
- Dropdown: provider list with connection status dot (6px: `COLORS.successDk` connected, `COLORS.warningDk` disconnected + pulse). "⚙ Manage Connections" link → Settings

**Connection States:**
- Not connected: CloudOffOutlined 64px `text.disabled`, "Connect {Provider}" `h5`, Connect button outlined `COLORS.cyan`
- Loading: Skeleton card grid (pulse)
- Empty folder: FolderOffOutlined 48px, "No images in this folder" `body2`

**Cloud File Card (modified FD-PROJ11-2):**
- Same card structure, `object-fit: contain`
- Cloud badge: absolute bottom-right of thumbnail, 20px, `alpha(COLORS.ink, 0.70)` bg, provider SVG 12px
- Info strip: filename `subtitle2`, modified date + file size `caption` (NO tags row)
- Hover actions: [⬇ Import] `alpha(COLORS.cyan, 0.20)` primary, [👁 Preview], [🔗 Copy URL]
- Selection: same checkbox + cyan border pattern

**Transfer — Import (cloud→server):**
- Trigger: hover [⬇ Import], bulk "Import N", Command Palette
- Flow: folder picker (FD-PROJ11-3 mini) → confirm → card shows CircularProgress overlay `COLORS.cyan` 40px on `alpha(COLORS.ink, 0.50)` → done: CheckCircle `COLORS.successDk`, fades after 1.5s

**Transfer — Send to Cloud (server→cloud):**
- Trigger: "Send to Cloud" toolbar button, Command Palette, transfer pill
- Flow: provider + folder picker → confirm → progress overlay on source cards → snackbar

**Cloud Infrastructure (absorbed from PROJ-19):**
- Cloud connection management (Connect/Disconnect, account email, status) lives in **central App Settings page** — NOT only in Listing area. Reusable `CloudStorageSettings.tsx` section
- File filter: only image files visible (PNG, JPG, JPEG, WebP, SVG). Folders always shown for navigation. Max 25MB per file (hidden if exceeded)
- Cloud hooks (`useGoogleDrive`, `useOneDrive`) in global `hooks/` or `components/CloudStorage/hooks/` — shared by PROJ-11 Cloud Tab AND PROJ-9 Design Editor (replaces old `CloudManagerDialog`)
- Auth: OAuth2 tokens persisted via localStorage (MSAL for OneDrive, gapi for Google). Persists across page navigation. Silent refresh on expiry, fallback re-auth popup
- PROJ-9 Design Editor: must call the same global cloud hooks instead of its own CloudManagerDialog. Migration required
- No backend changes — all cloud access client-side (Graph API / Drive API)
- MSAL redirect bridge (`auth-redirect.html`) stays in `public/`
- Env vars: `VITE_ONEDRIVE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY`
- Folder listing non-recursive (current folder only, user navigates manually)
- Performance: folder listing < 2s for up to 200 items

**Cloud Edge Cases (from PROJ-19):**
- Cloud provider env vars missing → "Not Configured" hint with setup instructions in Settings
- OAuth token expired during browsing → silent refresh, fallback to re-auth popup
- User disconnects cloud in Settings while Cloud tab open → tab resets to disconnected state
- Empty folder → "No images in this folder" + show subfolders
- File exceeds 25MB → hidden from list (not shown, no error)
- Network error during folder listing → error alert with retry button
- Upload file with same name exists in cloud → overwrite (provider default behavior)

---

### FD-PROJ11-7: Edit Page (Flying Upload Style)

**Single scrollable page.** Opens when "Edit Designs" clicked with selected designs. All listing fields visible, no wizard/stepper.

**Layout:** Fixed thumbnail strip (left 200px) + scrollable edit form (center) + sticky design preview (right 300px float).

**Page Header:**
- "← Back to Collection" ghost button + "[+ Add Designs]" outlined + "[Shortcut Guide]" text button

**Marketplace Tabs (under header):**
- MUI ToggleButtonGroup: [Global] [Mba] [Displate]. Active: `alpha(COLORS.red, 0.12)` bg, `COLORS.red` color. Height `theme.spacing(5)` → 40px

**Thumbnail Strip (fixed left, 200px):**
- Design Tags input ("0/3"), [Load] `COLORS.cyan` / [Clear] `COLORS.errorDk` buttons (28px)
- "1 of 5" counter with ← → arrows
- Active thumbnail: `aspect-ratio 1/1`, 2px `COLORS.cyan` border, number badge (24px, `alpha(COLORS.cyan, 0.85)` bg)
- Other thumbnails: 80×80px, `opacity 0.60`, hover `opacity 1`, click navigates

**"Options ⊙" Pattern (CENTRAL MECHANIC):**
- Every section has "Options ⊙" button (SettingsOutlined 14px + "Options" `caption`, `text.disabled`)
- Click → opens **Command Palette (FD-PROJ11-4) pre-filtered** to that section's context
- E.g. Colors "Options ⊙" → Palette shows only: "Copy Colors From...", "Apply Colors to All", "Reset Colors"
- Icon rotates 90° on click, `DURATION.fast`

**Section Specs:**

> **MBA Tab only** (decided 2026-04-18): The 4 Product Config sections below (Products, Fit Type + Print, Colors, Marketplaces & Prices) render **only when Marketplace Tab = Mba**. Global and Displate tabs show their own (future) field sets. On Global/Displate a placeholder "Configuration for {marketplace} coming soon" is shown instead.

**Products (MBA):** Horizontal scroll, product type cards 72px wide, product SVG icon 40px, `caption` label, count badge (18px pill, `COLORS.cyan` bg). Selected: `alpha(COLORS.cyan, 0.06)` bg, `COLORS.cyan` border. Thin scrollbar 3px.

**Fit Type + Print:** 2-col grid. Checkboxes `secondary.main` (cyan). Radio `primary.main` (coral).

**Colors:** Flex wrap, circles 36px, full border-radius. Selected: `COLORS.cyan` border + glow `alpha(COLORS.cyan, 0.30)` + `scale(1.1)`. Checkmark inside (white on dark colors, ink on light). **Palette source (decided 2026-04-18):** loaded from backend via `GET /api/mba/colors/` (AC-37) — NOT hardcoded in frontend. Amazon's canonical garment color list lives centrally so it can be updated without a frontend deploy.

**Marketplaces & Prices:** 4-col grid (responsive 3→2). Per cell: marketplace label `caption`, checkbox + price input (32px, `COLORS.inkElevated` bg, 96px wide, right-aligned text), royalty display `caption text.disabled`.

**Language Tabs:** Flag + code chips. Active: `alpha(COLORS.cyan, 0.10)` bg, `COLORS.cyan` color, 1px `alpha(COLORS.cyan, 0.20)` border. Auto Translate Switch `secondary.main`. "Translate to All" Select dropdown.

**Listing Fields (shared pattern):**
- Label `subtitle2` + InfoOutlined 14px + "Options ⊙" right-aligned
- TextField outlined, bg `COLORS.inkElevated`, radius 8px, `body2` font
- Char counter `caption`: normal `text.disabled`, ≥90% `COLORS.warningDk`, 100% `error.main`. Transition `DURATION.fast`
- AI Improve icon: `opacity 0→1` on field hover, AutoFixHighOutlined 16px `COLORS.cyan`, opens PROJ-17 Chat
- Layout: Brand+Title 2-col, Bullets 1+2 2-col, Bullets 3+4 2-col (or 5 full-width), Description full-width
- Keywords: Chip container (removable chips `alpha('#fff', 0.08)` bg), inline "+ Add" input, "21/50" counter, "KW Finder | KW Workbench" links `COLORS.cyan`

**Options/Trademarks Tabs (bottom):** MUI Tabs, 2px `COLORS.red` indicator. Availability + Publish radio groups. TM Check button outlined `COLORS.warningDk`.

**Design Preview (sticky right):** 300px width, `sticky top: 80px`, radius 12px, `contain`, meta info `caption text.disabled` ("4500x5400px / PNG / filename").

**Animations:**
1. Design switch (thumbnail nav): form cross-fade `opacity`, `DURATION.fast`
2. Char counter color: `DURATION.fast`
3. AI Improve appear: `opacity 0→1` on hover, `DURATION.fast`
4. Product/Color select: `scale + border`, `DURATION.fast`
5. Language tab switch: content fade, `DURATION.fast`
6. Options ⊙ icon: rotate 90°, `DURATION.fast`
7. "Unsaved changes" bar: slide down from top, amber bg, `DURATION.default`

---

## Edge Cases

- [ ] EC-1: Design file missing from Drive/OneDrive (deleted/moved) → import fails with "File not found", user notified.
- [ ] EC-2: MBA character limit exceeded → save as draft, highlight fields in red, block upload.
- [ ] EC-3: Desktop App disconnected → jobs stay pending, UI shows connection status.
- [ ] EC-4: Upload fails (CAPTCHA, form error) → status=failed, screenshot saved, retry available.
- [ ] EC-5: TM Check finds flagged term → warning shown, user can proceed (soft block) or edit.
- [ ] EC-6: Auto-Translate produces text exceeding char limit → flag translated field, user must trim.
- [ ] EC-7: Listing deleted after upload job created → `listing_snapshot` preserves data, job proceeds from snapshot.
- [ ] EC-8: Multiple uploads for same design to different marketplaces → separate upload jobs, each gets own ASIN.
- [ ] EC-9: Round 2 started → new designs/listings show as Round 2, old ones preserved as Round 1.
- [ ] EC-10: ASIN captured but sales data not yet available → lifecycle shows ASIN + "Awaiting sales data".
- [ ] EC-11: Design deleted while `DesignProductConfig` rows exist → cascade delete (FK on_delete=CASCADE, no orphans).
- [ ] EC-12: User switches marketplace tab in Edit view → frontend refetches `DesignProductConfig` for the new `(design, marketplace_type)` pair. Empty/404 → fall back to empty defaults, no error toast.
- [ ] EC-13: Copy-from source design has no config row for the active marketplace → endpoint returns 404, UI shows warning "Source has no config for {marketplace}". No target row written.
- [ ] EC-14: Concurrent PATCH from two browser tabs on the same `(design, marketplace_type)` pair → last-write-wins (no optimistic locking for MVP; matches Listing auto-save semantics).
- [ ] EC-15: Copy-from with `scope='colors'` on a source that has empty `colors=[]` → target's colors set to `[]` (copies the empty value, does not skip). Same rule for all scalar scopes.
- [ ] EC-16: POST/PATCH `Listing` with `is_template=True` AND non-null `design` → 400 ValidationError "Template listings cannot be linked to a design". Prevents malformed templates.
- [ ] EC-17: Delete the only default `UploadTemplate` in a `(workspace, marketplace_type)` set → no automatic promotion of a replacement. Next Convert to that marketplace seeds no ProductConfig (unchanged behavior, user must set a new default).
- [ ] EC-18: Set `is_default=True` on an `UploadTemplate` when another already holds the flag for the same `(workspace, marketplace_type)` → previous default atomically cleared before the new one is saved. User sees exactly one default at all times.
- [ ] EC-19: Convert to MBA where target design ALREADY has a `DesignProductConfig` → auto-apply skipped (AC-57 guard). Existing config is preserved, no overwrite.
- [ ] EC-20: Convert to MBA where workspace has NO default `UploadTemplate` set for MBA → Convert succeeds but `product_config_seeded=False`. Frontend can surface a hint ("Set an MBA default to auto-fill config").
- [ ] EC-21: Template Listing (is_template=True) cannot be edited to become a non-template (is_template flip to False would require design assignment; easier to disallow the flip). PATCH rejects `is_template` transitions with 400.
- [ ] EC-22: `GET /api/ideas/<id>/listing/` returning template Listings would break Edit page — queryset must filter `is_template=False`. Covered by AC-51 but listed here for test coverage.
- [ ] EC-23: Card 3-dot menu open while card gets deleted by another tab → menu gracefully closes (RTK tag invalidation causes card unmount, Menu closes automatically).
- [ ] EC-24: Inline tag editor open when user clicks a different card → blur commits pending tags on the original card, closes the editor, new card receives focus.
- [ ] EC-25: Add Tag input contains whitespace-only string or duplicate of existing tag → input rejects (no chip added), shows subtle shake. No PATCH fired.
- [ ] EC-26: PATCH tags when exceeding 10 total → backend returns 400, UI reverts the optimistic update + shows error snackbar.
- [ ] EC-27: Duplicate while the source asset is being deleted from another tab → backend returns 404, UI shows error snackbar ("Design no longer exists"), no phantom card inserted, gallery refetched.
- [ ] EC-28: Move target Collection was deleted mid-flow (stale picker) → backend returns 404 on the move call, UI shows error snackbar + invalidates `CollectionTree` so the picker rebuilds on next open.
- [ ] EC-29: Delete confirmed but DELETE request fails (5xx / network error) → optimistic removal reverts, error snackbar ("Failed to delete"), card reappears in its original position.
- [ ] EC-30: Duplicate server-side file copy fails (disk full, IO error, missing source file) → backend returns 500, no DB row created, UI shows error snackbar. Atomic: DB row and file copy either both succeed or neither persists.

## Dependencies

- PROJ-4 (Workspace & Membership)
- PROJ-8 (Idea & Slogan Generation — idea must exist)
- PROJ-9 (Design Generation — designs as input)
- PROJ-10 (Keyword Bank — keyword injection, design_template auto-select)
- PROJ-13 (Desktop Upload App — executes upload jobs)
- PROJ-15 (Vector DB — listing embeddings)
- PROJ-17 (Chat — "Improve" hover integration, Web Search keywords)
- PROJ-18 (Agent — Listing Agent + Publishing Agent tools)

## Environment Variables Required

```
# Existing (shared):
OPENROUTER_API_KEY=           # For AI listing generation + translation

# New:
GOOGLE_DRIVE_CLIENT_ID=       # OAuth2 for Drive import (shared with PROJ-13 old spec)
GOOGLE_DRIVE_CLIENT_SECRET=
ONEDRIVE_CLIENT_ID=           # OAuth2 for OneDrive import
ONEDRIVE_CLIENT_SECRET=
```

---

## Verification Steps

1. Select approved design → click "Generate Listing" → AI produces Brand, Title, 5 Bullets, Description, Keywords. All fields within char limits.
2. Hover over Title → "Improve" icon → Chat opens with title as context.
3. Character counter turns amber at 90%, red at 100%.
4. Click "Translate to All" → DE/FR/IT/ES/JA tabs populated. Auto-translated fields flagged if over limit.
5. Inject keywords from PROJ-10 Keyword Bank → chips shown in Keywords field. Design template keywords pre-selected.
6. Run TM Check → flagged terms highlighted with warning.
7. Configure product types (T-Shirt, Hoodie) + colors + marketplaces + prices → saved on template.
8. Save configuration as UploadTemplate → load on different design → settings applied.
9. Queue upload job → status shows "pending". Desktop App connected → status transitions to "uploading" → "completed" with ASIN.
10. Desktop App not connected → UI shows "Desktop App not connected" message. Jobs stay pending.
11. Batch create jobs for 5 designs → 5 jobs created, each trackable independently.
12. Upload fails → status=failed, error screenshot saved, retry available.
13. Import design from Google Drive → file appears in Design Gallery with thumbnail.
14. `Ctrl+K` → Command Palette opens → search "copy listing" → apply to selected designs.
15. Product Lifecycle: Niche → Slogan → Design → Listing → ASIN → shows full chain.
16. "Copy for MBA" → formatted listing text in clipboard.
17. Workspace isolation: listings/designs from other workspaces → 403.

---

## Open Planning Items (2026-04-06)

> **Design → Listing Transition — DECIDED (2026-04-10):**
> - PROJ-9 Phase E (`listing_ready` status) **removed** — redundant with DesignAsset system
> - A design's existence as a `DesignAsset` in `publish_app` IS the "ready" signal
> - Flow: User clicks "Save to Listings" FlowButton on approved design → `DesignAsset` created in target Collection folder → design appears in Publish view
> - Drawer shows DesignAsset count per niche (not `listing_ready` badges)
> - **Still to plan in PROJ-11:** exact `DesignAsset` creation UX (auto-create vs dialog with folder picker), Drawer integration details

---

## Tech Design (Solution Architect)

> Decided: 2026-03-27 | Updated: 2026-04-09 — complete rebuild of frontend per FD-PROJ11-1 to FD-PROJ11-7. Backend extended with Collection Folder model.

### A) Backend Architecture

**Existing app:** `publish_app` (already implemented — 5 models, API views, serializers, WebSocket consumer)

**Backend changes needed for redesign:**
1. **NEW Model:** `DesignCollection` (folder system for organizing DesignAssets)
2. **Extended Model:** `DesignAsset` → add `collection` FK (nullable, for folder assignment)
3. **NEW API:** Collection CRUD (create/rename/move/delete folders, list folder contents)
4. **Cloud hooks migration:** Move cloud import logic from PROJ-9 `CloudManagerDialog` to shared service

```
publish_app/
├── models.py                           # EXISTING: Listing, UploadTemplate, UploadJob,
│                                       #   DesignAsset, ProductLifecycle
│                                       # NEW: DesignCollection (folder model)
├── api/
│   ├── views.py                        # EXISTING: all CRUD + AI + lifecycle
│   │                                   # NEW: CollectionView (CRUD + tree)
│   ├── serializers.py                  # NEW: CollectionSerializer, DesignAsset folder FK
│   └── urls.py                         # NEW: collection endpoints
├── services/                           # EXISTING: listing_generator, translator, tm_checker
│   ├── cloud_import.py                 # EXISTING
│   └── lifecycle_tracker.py            # EXISTING
├── consumers.py                        # EXISTING: WebSocket for Desktop App
├── routing.py                          # EXISTING
├── tasks.py                            # EXISTING
├── admin.py                            # UPDATE: register DesignCollection
└── tests/                              # NEW: collection tests
```

**New Model — DesignCollection:**

| Field | Type | Description |
|-------|------|-------------|
| id | UUID pk | |
| workspace | FK Workspace | Isolation |
| name | CharField(200) | Folder name |
| parent | FK self (nullable) | Parent folder (null = root) |
| position | IntegerField(default=0) | Sort order within parent |
| created_by | FK User | Creator |
| created_at | DateTimeField | |

**DesignAsset extension:**

| Field | Type | Description |
|-------|------|-------------|
| collection | FK DesignCollection (nullable) | Folder assignment (null = root "Home") |

**New API Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/collections/` | List root collections (workspace) |
| GET | `/api/collections/{id}/` | Collection detail with children + assets |
| POST | `/api/collections/` | Create folder: `{name, parent?}` |
| PATCH | `/api/collections/{id}/` | Rename or move: `{name?, parent?}` |
| DELETE | `/api/collections/{id}/` | Delete folder (assets move to parent or root) |
| GET | `/api/collections/tree/` | Full folder tree for Tree Explorer |
| POST | `/api/designs/gallery/move/` | Move assets to collection: `{asset_ids, collection_id}` |

---

### B) Frontend Architecture — COMPLETE REBUILD

> Old frontend (22 files, ~2800 lines in `views/publish/`) will be **replaced entirely**. New structure with 2 routes, folder system, and FD-PROJ11 design decisions.

**Routes:**
- `/publish` — Design Collection (folder browser + card grid + toolbar + action bar)
- `/publish/edit` — Edit Page (Flying Upload style listing editor)

```
views/publish/
├── PublishView.tsx                      # REBUILD: Collection browser (toolbar + grid + action bar)
├── EditView.tsx                         # NEW: Flying Upload-style edit page (thumbnail strip + form + preview)
├── hooks/
│   ├── useCollections.ts               # NEW: folder CRUD + tree navigation
│   ├── useDesignSelection.ts           # NEW: click/shift/lasso selection state
│   ├── useLassoSelect.ts              # NEW: rubber-band lasso drag logic
│   ├── useListingEditor.ts            # REBUILD: multi-design navigation, field state, AI generate
│   ├── useDesignGallery.ts            # REBUILD: folder-scoped gallery with sort/filter
│   ├── useUploadJobs.ts               # KEEP: job CRUD + WebSocket
│   ├── useCommandPalette.ts           # REBUILD: 3-column categories, context filtering, fuzzy search
│   └── useCloudStorage.ts             # NEW: cloud tab state, provider switch, transfer
├── partials/
│   ├── toolbar/
│   │   ├── PublishToolbar.tsx          # NEW: 2-row toolbar (FD-PROJ11-1)
│   │   ├── SelectCounter.tsx          # NEW: checkbox + count dropdown
│   │   ├── FileSystemTabs.tsx         # NEW: My Designs / Cloud Storage switcher
│   │   ├── BreadcrumbNav.tsx          # NEW: folder breadcrumbs + provider chip
│   │   └── TransferPill.tsx           # NEW: "→3→" transfer indicator between tabs
│   ├── grid/
│   │   ├── DesignCardGrid.tsx         # REBUILD: glassmorphism cards (FD-PROJ11-2)
│   │   ├── DesignCard.tsx             # REBUILD: thumbnail + glass info strip + hover actions
│   │   ├── DesignListRow.tsx          # NEW: list view variant
│   │   ├── CloudFileCard.tsx          # NEW: cloud file card with provider badge
│   │   ├── AddDesignsCard.tsx         # NEW: dashed "+" card
│   │   └── LassoOverlay.tsx           # NEW: rubber band selection rectangle
│   ├── collections/
│   │   ├── CollectionsDialog.tsx      # NEW: split-panel dialog (FD-PROJ11-3)
│   │   ├── FolderTree.tsx             # NEW: tree explorer (left panel)
│   │   ├── FolderGrid.tsx             # NEW: folder cards (right panel)
│   │   └── FolderCard.tsx             # NEW: single folder with tab detail
│   ├── command/
│   │   ├── CommandPalette.tsx         # REBUILD: 3-col glassmorphism (FD-PROJ11-4)
│   │   └── CommandAction.tsx          # NEW: single action row with icon
│   ├── ActionBar.tsx                   # REBUILD: floating dock (FD-PROJ11-5)
│   ├── cloud/
│   │   ├── CloudStorageTab.tsx        # NEW: cloud file browser (FD-PROJ11-6)
│   │   ├── ProviderSwitcher.tsx       # NEW: OneDrive/GDrive chip dropdown
│   │   ├── CloudConnectionState.tsx   # NEW: connected/disconnected/loading states
│   │   └── TransferProgress.tsx       # NEW: import/upload progress overlay
│   ├── editor/                         # Flying Upload-style edit page (FD-PROJ11-7)
│   │   ├── ThumbnailStrip.tsx         # NEW: left panel with design navigation
│   │   ├── EditForm.tsx               # NEW: scrollable form assembly
│   │   ├── DesignPreview.tsx          # NEW: sticky right preview image
│   │   ├── MarketplaceTabs.tsx        # REBUILD: Global/Mba/Displate toggle
│   │   ├── ProductTypeScroller.tsx    # REBUILD: horizontal scroll with count badges
│   │   ├── ColorGrid.tsx             # REBUILD: circle swatches with checkmarks
│   │   ├── MarketplacePricing.tsx     # REBUILD: per-marketplace grid
│   │   ├── ListingField.tsx           # REBUILD: char counter + AI Improve hover + Options ⊙
│   │   ├── KeywordChipsField.tsx      # REBUILD: removable chips + KW Finder link
│   │   ├── TranslationTabs.tsx        # REBUILD: flag tabs + Auto Translate
│   │   ├── OptionsButton.tsx          # NEW: "Options ⊙" → opens Command Palette filtered
│   │   └── SectionHeader.tsx          # NEW: shared section header with title + info + Options ⊙
│   ├── TMCheckDialog.tsx              # KEEP: trademark check
│   ├── UploadQueueSection.tsx         # KEEP: upload job list
│   ├── UploadJobRow.tsx               # KEEP: single job row
│   └── UploadTemplateDropdown.tsx     # KEEP: template save/load
├── types/
│   └── index.ts                        # REBUILD: new types for collections, cloud, selection
├── schemas/
│   └── listingSchema.ts               # KEEP: Zod validation
└── tests/

components/
├── CloudStorage/                       # NEW: global cloud hooks (shared by PROJ-11 + PROJ-9)
│   ├── hooks/
│   │   ├── useGoogleDrive.ts          # EXTRACT from PROJ-9 CloudManagerDialog
│   │   └── useOneDrive.ts             # EXTRACT from PROJ-9 CloudManagerDialog
│   ├── CloudStorageSettings.tsx       # NEW: reusable settings section (App Settings + inline)
│   └── index.ts

store/
└── publishSlice.ts                     # REBUILD: add collection endpoints, cloud state
```

---

### C) Tech Decisions (updated)

| Decision | Why |
|----------|-----|
| Complete frontend rebuild (not refactor) | Old UI is a single scrollable page. New design has 2 routes, folder system, dual file tabs, glassmorphism cards, lasso-select. Too many structural changes to refactor incrementally |
| `DesignCollection` as tree model (self-referential FK) | Simple folder hierarchy. `parent` FK = tree structure. No nested set or MPTT needed — folder depth is shallow (3-4 levels max) |
| 2 routes instead of 1 | Collection browser (`/publish`) and Edit page (`/publish/edit`) are distinct UX patterns. Flying Upload also separates "Designs" from "Edit" |
| Cloud hooks extracted to `components/CloudStorage/` | Shared by PROJ-11 Cloud Tab AND PROJ-9 Design Editor. Avoids duplicate OAuth logic |
| Command Palette reused for "Options ⊙" | Same component, `context` prop filters actions. One implementation, three triggers (toolbar, Ctrl+K, per-section) |
| Lasso select as dedicated hook | Complex mouse event logic (mousedown/move/up, intersection detection) doesn't belong in the grid component |
| `publish_app` backend kept, extended | Models are correct. Only DesignCollection model + collection API endpoints needed |

---

### D) Infrastructure Changes

| Change | Where |
|--------|-------|
| EXISTING: `publish_app` registered | Already in `INSTALLED_APPS` + `core/urls.py` |
| EXISTING: Django Channels + channels-redis | Already in `requirements.txt` |
| NEW: Migration for DesignCollection + DesignAsset.collection FK | `publish_app/migrations/` |
| NEW: Cloud OAuth env vars in `.env.template` | `VITE_ONEDRIVE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY` |
| NEW: MSAL redirect bridge | `frontend-ui/public/auth-redirect.html` |
| NEW: Route `/publish/edit` | `App.tsx` route config |

---

### E) New Packages

**Backend:** None — all packages already installed.

**Frontend:**

| Package | Purpose |
|---------|---------|
| `@microsoft/msal-browser` | OneDrive OAuth2 (if not already installed from PROJ-9 CloudManager) |
| `gapi-script` or direct `<script>` | Google Drive API (if not already loaded) |

> Check if PROJ-9 Design Editor already has these installed before adding.

---

## Tech Design Addendum — Per-Design Product Config (added 2026-04-18)

> Scope: AC-38 to AC-44, EC-11 to EC-15, US 28–31. Persistence for Colors / Fit Types / Print Side / Product Types / Marketplace Pricing. Blocks D7 Copy-from-Design for non-listing scopes and PROJ-13 upload matrix.

### A) Component Structure (Backend-Centric — No New UI)

No new screens. Existing Edit view sections (`ProductTypeScroller`, `FitTypePrintSection`, `ColorGrid`, `MarketplacePricing`, `CopyFromDesignDialog`) now read/write backend state instead of local state.

```
useEditView (refactor)
+-- productConfig  ← RTK Query keyed on (activeDesignId, activeMarketplace)
+-- setters        ← debounced auto-save PATCH (1200ms, same as listing)
+-- applyCopy      ← POST /product-config/copy-from/ instead of local state copy
```

### B) Data Model (plain language)

New model `DesignProductConfig` lives in `publish_app`. Sibling of `Listing` — both hang off a `DesignAsset`, keyed by `(design, marketplace_type)`.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID pk | |
| `design` | FK → DesignAsset | `on_delete=CASCADE` (EC-11) |
| `marketplace_type` | Choices `[global, mba, displate]` | default `mba`, same enum as Listing |
| `product_types` | JSONField list | e.g. `['t_shirt', 'hoodie']` |
| `fit_types` | JSONField list | e.g. `['men', 'women']` |
| `print_side` | Choices `[front, back, both]` | default `front` |
| `colors` | JSONField list | MBA color keys (validated against AC-37 palette) |
| `marketplaces` | JSONField list | `[{marketplace, price, enabled}, ...]` |
| `created_at`, `updated_at` | DateTime | |

**Unique constraint:** `(design, marketplace_type)` — one row per pair. Upsert on PATCH.

### C) API Endpoints

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/api/designs/{id}/product-config/?marketplace_type=mba` | Returns single config row. 404 when missing (frontend falls back to defaults). |
| PATCH | `/api/designs/{id}/product-config/` | Upsert. `marketplace_type` required in body. Partial update for all other fields. |
| POST | `/api/designs/{id}/product-config/copy-from/` | Copies from source design. Body: `{source_design_id, marketplace_type, scope}`. `scope` ∈ `[all, colors, fit_types, print_side, product_types, marketplaces]`. Returns target row. 404 when source has no matching config. |

### D) Tech Decisions

| Decision | Why |
|----------|-----|
| Separate model from `Listing` | Different lifecycle: product config is configured once per design; listing text is regenerated/edited. Keeps Listing serializer stable (AC-42). |
| `(design, marketplace_type)` unique constraint | Mirrors Listing's constraint (F1). Same mental model: one row per marketplace variant. |
| Upsert on PATCH (no explicit POST) | Simpler frontend auto-save path — one mutation regardless of row existence. |
| Server-side copy endpoint (not client-side fetch+patch) | Atomic — source + target served in one transaction. Avoids race with other auto-saves. Mirrors future F3 Listing convert semantics. |
| `colors[]` validated against MBA palette (AC-37) | Prevents drift between frontend MBA_COLORS and stored data. Rejects unknown color keys with 400. |
| Last-write-wins on concurrent PATCH (EC-14) | Matches Listing auto-save behavior. Optimistic locking postponed until multi-tab editing is proven painful. |
| RTK Query cache key `(designId, marketplace_type)` | Tab switch + design switch both trigger fresh query. Matches D7 Listing cache pattern. |

### E) Infrastructure Changes

| Change | Where |
|--------|-------|
| Migration for `DesignProductConfig` model | `publish_app/migrations/` |
| URL registration | `publish_app/api/urls.py` (nested under `designs/{id}/product-config/`) |
| RTK Query endpoints | `frontend-ui/src/store/publishSlice.ts` (3 new endpoints + `ProductConfig` tag) |
| PROJ-13 contract note | Upload job snapshot now includes product config JSON — flagged in PROJ-13 spec when it lands |

### F) New Packages
None.

---

## Tech Design Addendum — Listing Templates + MBA Defaults (added 2026-04-19)

> Scope: AC-45 to AC-59, EC-16 to EC-22, US 32–35. Extends existing `Listing` + `UploadTemplate` models with flags. No new models.

### A) Component Structure (Backend Only — No New UI for MVP)

No new screens. Extends existing `publish_app` endpoints. Frontend UI for Template management is deferred — API shipping first so Convert auto-apply works end-to-end via the Edit page.

```
publish_app/
+-- models.py
|   +-- Listing           ← add is_template flag
|   +-- UploadTemplate    ← add is_default + marketplace_type
+-- api/
    +-- serializers.py    ← template validation + default-clearing logic
    +-- views.py          ← 3 new views + Convert auto-apply integration
    +-- urls.py           ← 3 new routes
```

### B) Data Model (plain language)

**Listing — new field:**

| Field | Type | Notes |
|-------|------|-------|
| `is_template` | BooleanField | default=False; when True, `design` must be NULL (model.clean) |

**UploadTemplate — new fields:**

| Field | Type | Notes |
|-------|------|-------|
| `is_default` | BooleanField | default=False; at most one True per `(workspace, marketplace_type)` |
| `marketplace_type` | CharField choices `[global, mba, displate]` | default `mba`; mirrors Listing/DesignProductConfig enum |

**Partial unique constraint:** `UniqueConstraint(fields=['workspace', 'marketplace_type'], condition=Q(is_default=True))` — prevents two defaults for the same marketplace via DB-level guard.

### C) API Endpoints

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/api/listings/templates/` | Paginated list of `is_template=True` Listings in workspace. Filter: `?marketplace_type=`. |
| POST | `/api/listings/templates/` | Create Listing with `is_template=True, design=NULL`. Validates design stays null. |
| GET | `/api/upload-templates/default/?marketplace_type=mba` | Returns workspace's single default UploadTemplate for that marketplace, or 404. |
| PATCH | `/api/upload-templates/<id>/` | Existing endpoint — extended: setting `is_default=True` atomically clears the flag on siblings with same `(workspace, marketplace_type)`. |
| POST | `/api/upload-templates/` | Existing endpoint — same clear-then-set behavior when `is_default=True`. |
| POST | `/api/listings/convert/` | Existing endpoint — extended: on convert with non-null target.design + no existing ProductConfig, auto-seeds from workspace default UploadTemplate (if any). Response includes `product_config_seeded: bool`. |

### D) Tech Decisions

| Decision | Why |
|----------|-----|
| `is_template` flag on Listing (not separate model) | Template Listings share 100% of fields with regular Listings. A flag is cheapest; no serializer duplication. FK already nullable — minimal migration. |
| `is_default` on UploadTemplate (not new `MbaDefaults` model) | `UploadTemplate` already stores every field needed (colors, fit_types, colors, marketplaces, print_side, product_types). Adding a flag avoids duplicating the schema. User picks one of their templates — no new concept to learn. |
| DB-level partial unique constraint | Single source of truth that "only one default per marketplace". Prevents drift even if serializer logic is bypassed (admin, shell). |
| Atomic clear-then-set on `is_default=True` | Partial unique constraint would raise IntegrityError if we set the new flag before clearing the old. Transaction + clear-then-set keeps the invariant without losing DB-level guarantees. |
| Auto-apply reads from UploadTemplate, never writes back | Convert seeds a NEW `DesignProductConfig` row from the template's values. Future edits to either side are independent — no surprise propagation. |
| `product_config_seeded: bool` in Convert response | Lets frontend surface a hint when no default is set ("Set an MBA default to auto-fill"). No silent behavior difference. |
| Template queryset filtered from regular listing endpoints | `GET /api/ideas/<id>/listing/` excludes `is_template=True` to keep Edit page UI clean. Templates only appear in dedicated template endpoints. |
| Disallow `is_template` flip after creation | Flipping True→False would require assigning a design (constraint AC-46). Simpler to make `is_template` write-once at creation time. |

### E) Infrastructure Changes

| Change | Where |
|--------|-------|
| Migration: `Listing.is_template` | `publish_app/migrations/` |
| Migration: `UploadTemplate.is_default` + `UploadTemplate.marketplace_type` + partial unique constraint | `publish_app/migrations/` |
| URL registration | `publish_app/api/urls.py` — 3 new routes |
| Convert view extended | `ListingConvertView` in `views.py` calls new seeding helper |

### F) New Packages
None.

---

## QA Report — 2026-04-19

### Summary
PASS. All 59 ACs + 22 ECs covered by automated tests. No blocking bugs. Security posture (workspace isolation, 404-on-cross-workspace) verified. Ready for deploy pending two acknowledged minor gaps.

### Coverage
- Backend Phase A–F: all ACs exercised via `publish_app/tests/` (serializers, views, permissions, conversion seeding, template defaults, workspace scoping).
- Frontend Phase B–G + Config: Edit view flows, Listing tabs (Global/MBA/Displate), marketplace conversion confirm dialog, Collections/Folders, Send-to-Cloud, TM check, upload jobs list.
- Cross-cutting: i18n parity 341/341 publish keys in en/de/es/fr/it.

### Test totals
- Backend: 218/218 pass (`pytest publish_app`).
- Frontend publish scope: 88/88 pass across 16 files.
- Frontend full suite: 844/844 pass across 102 files.
- `ruff check django-app/`: clean.
- `npm run lint`: clean (2 pre-existing `EditorCanvas` warnings unrelated to PROJ-11).

### Findings
- No P0/P1 bugs open against PROJ-11 scope.
- P3: task file reports 833 tests vs actual 844 — stale count, non-functional.
- P3: EC-14 (concurrent PATCH last-write-wins on Listing) has no dedicated regression test; behaviour documented and acknowledged in the task file. Low risk for MVP (single-editor UX); recommend adding ETag/version check post-MVP.

### Security spot-check
- Every new view in `django-app/publish_app/api/views.py` calls `_get_workspace_id(request)` and filters querysets by workspace before any object access.
- Cross-workspace access returns 404 (not 403) to prevent ID enumeration — confirmed in test cases for Listing, DesignAsset, Collection, UploadTemplate, and conversion endpoints.
- `permission_classes = [IsAuthenticated]` present on all publish routes; `CookieJWTAuthentication` unchanged.
- No secrets, no raw SQL, no unvalidated `request.data` paths introduced.

### Bugfix verification
1. **borderRadius sx number scaling (128px corners)** — fixed by wrapping numeric values in `"${N}px"` strings so MUI `sx` does not multiply by `theme.shape.borderRadius` (8). Verified across all 6 call sites:
   - `frontend-ui/src/views/publish/partials/collections/CollectionsDialog.tsx:139`
   - `frontend-ui/src/views/publish/partials/grid/DesignCardGrid.tsx:93`
   - `frontend-ui/src/views/publish/partials/collections/FolderGrid.tsx:43`
   - `frontend-ui/src/views/publish/partials/cloud/SendToCloudDialog.tsx:251`
   - `frontend-ui/src/views/publish/partials/cloud/CloudConnectionState.tsx:59`
   - `frontend-ui/src/views/publish/partials/edit/TMCheckDialog.tsx:133`
   No remaining bare-number `borderRadius` values in publish scope.
2. **`listUploadJobs` URL** — `frontend-ui/src/store/publishSlice.ts` now targets `/api/upload-jobs/list/` (GET). Previous `/api/upload-jobs/` is POST-only and would 405. Confirmed against backend URL conf in `publish_app/api/urls.py`.
3. **`useEditView` hook order** — `fetchSourceListing` and `copyProductConfigFrom` are declared before `handleConvertFrom` so the `useCallback` dependency array resolves without TDZ. Verified in `frontend-ui/src/views/publish/hooks/useEditView.ts`; ordering preserved after refactor.

### Known gaps (acknowledged, not blocking)
- EC-14 concurrent-edit test coverage (see Findings).
- Task-file test count drift (833 → 844).

### Verdict
Ship. Two P3 items tracked for post-merge cleanup.

### Update 2026-04-21 — Phase H (Per-Card Menu Actions)

**Added AC coverage:** AC-60 through AC-68 (3-dot menu + Edit + Add Tags + Delete + Duplicate + Move), EC-23 through EC-30 (menu unmount, concurrent delete, storage failure, etc.).

**Test totals:**
- Backend: 241/241 passed (was 218 pre-Phase H; +9 `test_design_tags.py`, +9 `test_design_duplicate.py`, +5 Phase F6 trailing — recount delta +23)
- Frontend publish suite: 108/108 passed across 20 files (+14 vs 94; net new: DesignCard menu tests + PublishView.delete + PublishView.duplicate + MovePickerDialog)
- Frontend full suite: 864/864 passed across 106 files
- `ruff check django-app/`: clean
- `npm run lint`: clean (2 pre-existing unrelated `EditorCanvas.tsx` warnings)

**Live-verified via Playwright (2026-04-21):**
- Delete: menu → ConfirmDialog ("Delete design?") → DELETE `/api/designs/gallery/<id>/` → card removed, backend confirms 3 designs remain.
- Duplicate: menu → POST `/api/designs/gallery/<id>/duplicate/` → 4th card appears with today's `created_at` while source retains original date.
- Move: menu → MovePickerDialog (Home + Test Folder + disabled current collection) → pick folder → "Move Here" → POST `/api/designs/gallery/move/` → backend confirms `collection_name: "Test Folder"`.

**Known gaps unchanged:** EC-14 concurrent-edit test (P3), task-file test count now synced at 864.

---

## Tech Design Addendum — Per-Card Menu Actions (added 2026-04-20)

> Scope: US 39–41, AC-64 to AC-68, EC-27 to EC-30. Adds Delete live verification, a new Duplicate backend endpoint + frontend mutation, and a dedicated MovePickerDialog for single-card relocation. Delete is already code-complete; Duplicate and Move are the net-new work.

### Component Structure

```
PublishView
+-- DesignCardGrid
|   +-- DesignCard (existing)
|       +-- DesignCardMenu (3-dot) — existing (H2)
+-- ConfirmDialog (Delete) — existing, needs live verification
+-- MovePickerDialog (NEW)
    +-- FolderTree (reused from collections/)
    |   +-- "Root" pseudo-entry (NEW)
    +-- "Move Here" primary button
```

### Data Model Changes

| Change | Layer | Why |
|--------|-------|-----|
| No model changes | — | Duplicate creates a new DesignAsset row using existing schema; Move updates the existing `collection` FK; Delete unchanged |
| New storage path on Duplicate | Filesystem | Source file is streamed to a fresh object key via `default_storage.save()` so S3-readiness is preserved and overwrites are impossible |

### API Endpoints

| Method | Path | Behavior |
|--------|------|----------|
| DELETE | `/api/designs/gallery/<id>/` | **Existing** — Delete the asset. Workspace-isolated. 404 cross-workspace. Used by AC-64 + EC-29. |
| POST | `/api/designs/gallery/<id>/duplicate/` | **New** — Duplicate the asset. Copies file via `default_storage`, inherits `tags` + `collection`, clears `listing`/`idea`/`niche`. Atomic (DB + file both succeed or both fail). Returns 201 with new asset. Used by AC-65, AC-66, EC-27, EC-30. |
| POST | `/api/designs/gallery/move/` | **Existing** — Bulk move, called with a single-id array for single-card move. Used by AC-67, EC-28. |

### Frontend State + Wiring

| Component | Responsibility |
|-----------|----------------|
| `PublishView` | Owns `deleteTargetId` (existing), new `moveTargetId`, `duplicate()` handler; passes handlers into `DesignCardGrid` |
| `MovePickerDialog` (new) | Receives `assetId` + `currentCollectionId`; renders FolderTree with "Root" pseudo-entry; disables current collection; "Move Here" button calls `useMoveAssetsMutation` |
| `useDuplicateDesignMutation` (new RTK endpoint) | POST to duplicate URL; invalidates `GalleryList`; optimistic NOT used (new UUID is server-generated — wait for response) |

### Tech Decisions

| Decision | Why |
|----------|-----|
| Separate `MovePickerDialog` (not CollectionsDialog mode-prop) | CollectionsDialog is browse-focused (picks a folder to navigate into). Move is a destructive choice (relocates a design). Distinct UX, distinct test surface, <150 lines new code |
| Inherit `collection` + `tags` on Duplicate | Matches US 40 ("same tags, same Collection"). Clearing `listing`/`idea` prevents dangling FK references (a new asset should not inherit another's listing) |
| `default_storage.save()` for file copy | Works with local filesystem today AND remote storage (S3/GCS) tomorrow without code change. Stream-based → handles large files |
| Atomic `transaction.atomic()` on Duplicate | DB row creation and file copy must succeed together. On file-copy failure we raise, transaction rolls back, no orphan row (EC-30) |
| Single-card scope only | Batch duplicate deferred — Action Bar already has "Batch" for upload; bulk-duplicate API can be added later if telemetry justifies it |
| Optimistic delete, server-round-trip duplicate | Delete removal is safe to mirror immediately; duplicate's new UUID comes from the server so optimistic would show a placeholder with a temp ID (complexity not worth the ~300ms saving) |

### Dependencies (packages)

- None new. Backend uses existing `django.core.files.storage` and `transaction.atomic`. Frontend uses existing MUI + RTK Query primitives.

### File Structure (new files only)

```
django-app/publish_app/
├── api/views.py              # + DesignAssetDuplicateView (30 LOC)
├── api/urls.py               # + duplicate/ route
└── tests/test_design_duplicate.py  # NEW — 8 tests

frontend-ui/src/views/publish/partials/grid/
└── MovePickerDialog.tsx      # NEW — ~150 LOC

frontend-ui/src/store/publishSlice.ts  # + useDuplicateDesignMutation
frontend-ui/src/views/publish/PublishView.tsx  # + wire handlers
```

