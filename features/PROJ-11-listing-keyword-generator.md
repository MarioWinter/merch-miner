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
- **Marketplace Tabs:** Global / Mba / Displate (future marketplace support)
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

## Acceptance Criteria

### Models

- [ ] AC-1: `Listing` model (updated): UUID pk, `idea` FK, `design` FK (nullable), `round` (PositiveIntegerField, default=1 — matches Niche.current_round), `brand_name` (max 50), `title` (max 60), `bullet_1..5` (max 256 each), `description` (max 2000), `backend_keywords` (max 500), `status` choices [draft, ready, published], `generated_by` choices [ai, manual], `availability` choices [public, private] default=public, `publish_mode` choices [live, draft] default=live, `language` (CharField, default='en'), `translations` (JSONField — {lang: {title, bullets, description}}), `created_at`, `updated_at`.

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

**Products (MBA):** Horizontal scroll, product type cards 72px wide, product SVG icon 40px, `caption` label, count badge (18px pill, `COLORS.cyan` bg). Selected: `alpha(COLORS.cyan, 0.06)` bg, `COLORS.cyan` border. Thin scrollbar 3px.

**Fit Type + Print:** 2-col grid. Checkboxes `secondary.main` (cyan). Radio `primary.main` (coral).

**Colors:** Flex wrap, circles 36px, full border-radius. Selected: `COLORS.cyan` border + glow `alpha(COLORS.cyan, 0.30)` + `scale(1.1)`. Checkmark inside (white on dark colors, ink on light).

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
