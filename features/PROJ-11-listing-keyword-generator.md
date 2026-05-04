# PROJ-11: Publish (Listing + Upload Manager)

**Status:** In Review
**Priority:** P0 (MVP)
**Created:** 2026-02-27
**Updated:** 2026-04-24

> **2026-04-22 Edit-Page Cleanup (this round):**
> - Listing reduziert auf 2 Bullets (bullet_3..5 raus)
> - Keyword-Bank + Trademark-Check komplett aus Edit entfernt (eigenes Feature später)
> - `backend_keywords` → `keyword_context` umbenannt (Zweck: AI-Input, kein Amazon Search Term)
> - AI-Generate konsolidiert auf EINEN zentralen "AI Improve"-IconButton (ersetzt AC-6)
> - `DesignProductConfig` restrukturiert: `fit_types` / `colors` / `print_side` / `marketplaces` jetzt **pro Produkt** (nicht global)
> - Neuer `MBA Product Catalog`-Endpoint: Icons-Keys, Color-Palette, Default-Preise, Royalty-Formel pro Produkttyp
> - Custom SVG Produkt-Icons (17 Produkte) statt generischem Kleiderbügel
> - Royalty-Berechnung live im Frontend (nicht DB-persistiert)
> - Auto-Save Hybrid-Modell: sofort bei Controls (Checkbox/Radio/Switch/Color/Price/Product), on-blur bei Text-Feldern; Save-Button + Unsaved-Banner bleiben als optionaler manueller Trigger

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
│ [Global] [Mba] [Displate]  [✨ AI Improve] [+ Add]│
├──────────────────────────────────────────────────┤
│ Design Tags (0/3) [+ Add]                        │
│ ← [thumb][thumb][thumb][thumb] → 1 of 5          │
├──────────────────────────────────────────────────┤
│ Products (3)                         Options ⊙   │
│ [🎽 T-Shirt][👔 Premium][👕 V-Neck][🎽 Tank]... │
│  └ active: ring + count badge                    │
├──────────────────────────────────────────────────┤
│ ── Config for active product: Standard T-Shirt ──│
│                                                   │
│ Fit Type ⊙              Print ⊙                 │
│ ☑Men ☑Women ☐Youth     ● Front ☐ Back          │
├──────────────────────────────────────────────────┤
│ Colors (4)                           Options ⊙   │
│ (color circles grid with ✓ selection)            │
│ (palette loaded from product catalog)            │
├──────────────────────────────────────────────────┤
│ Marketplaces & Prices (2)            Options ⊙   │
│ ☑ amazon.com   USD [19.99]  Royalty $4.52       │
│ ☑ amazon.co.uk GBP [19.99]  Royalty £5.98       │
│ ☐ amazon.de    EUR [____]   Royalty —            │
│ ... (royalty re-computes live on price input)    │
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
│                                                   │
│ Keyword Context ⊙  (AI input — not published)    │
│ [school bus, yellow bus, driver, retirement...]  │
│                                          124/500  │
├──────────────────────────────────────────────────┤
│ [Options]                                         │
│ Availability ⊙: ● Public ○ Private              │
│ Publish ⊙: ● Live ○ Draft                       │
└──────────────────────────────────────────────────┘
```

- **Products section** is a horizontal scroller of ALL catalog products (~17). Each product is clickable (toggles `enabled` in config). Active product = ring + count badge (number of configured marketplaces). Clicking a selected product focuses it (its per-product config panels below update).
- **Per-product config scope:** Fit Type, Print Side, Colors, and Marketplaces & Prices now render for the **currently focused product** (not globally). Switching product = panels re-render with that product's config row.
- **AI Improve** (top-right IconButton): takes design image + `keyword_context` + current text fields → calls `POST /api/listings/{id}/ai-improve/` → overwrites Brand / Title / Bullet 1 / Bullet 2 / Description with AI output. Works for empty listings (generate-from-scratch) AND pre-filled listings (improve / rewrite).
- **Keyword Context:** 500-char textarea. Not published — pure AI input. Used by AI Improve endpoint along with the design image.
- **Royalty column:** live-computed in frontend from `price * royalty_formula.coef - royalty_formula.base` per (product, marketplace). No DB storage.
- **Auto-save:** every toggle / price input / color / fit / product click → immediate PATCH. Every text field → PATCH on blur (only if dirty). Save-Button + "Unsaved changes"-Banner remain as optional manual trigger (for hesitant users).

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
5. As a member, I want to select product types from a visual scroller of all ~17 MBA-relevant products (Standard T-Shirt, Premium T-Shirt, Heavyweight T-Shirt, V-Neck, Tank Top, Long Sleeve, Raglan, Sweatshirt, Pullover Hoodie, Zip Hoodie, Performance Shirt, Baseball Shirt, Trucker Hat, PopSocket, Phone Case, Throw Pillow, Tote Bag, Tumbler, Ceramic Mug, Water Bottle) with **product-shaped SVG icons** and count badges, so I see what's configured at a glance.
6. As a member, I want Fit Type, Print Side, Colors, and Marketplaces & Prices configured **per selected product** (not globally), so a T-Shirt's colors / fit types / prices can differ from a Hoodie's.
7. As a member, I want Colors, default Prices, and Royalty formulas loaded from a **central MBA Product Catalog** (backend), so I don't manually look up Amazon's royalty tables and colors stay in sync with Amazon changes.
7b. As a member, I want Royalty values computed **live** next to each price input (`price × coef − base` per marketplace, from catalog), so I see my margin instantly as I type.
7c. As a member, I want to focus one product at a time in the Products scroller, and have the Fit / Print / Colors / Marketplaces panels below show the config for that focused product, so my edits always target the product I clicked.

### Listing Editor
8. As a member, I want ONE central "AI Improve" IconButton in the Edit header that — given the design image, my Keyword Context, and any existing text fields — generates or improves Brand / Title / Bullet 1 / Bullet 2 / Description in a single call, so I don't juggle multiple AI buttons per field.
8b. As a member, I want AI Improve to work on empty listings (generate from scratch) AND on pre-filled listings (improve / rewrite text copied from another design or niche), using the same button.
9. As a member, I want live character counters on every field (Brand 50, Title 60, Bullet 1+2 256 each, Description 2000, Keyword Context 500) that turn amber at 90% and red at 100%.
10. As a member, I want to hover over any listing field to see an "Improve" icon that opens Chat (PROJ-17) with that field as context for AI-powered refinement.
11. As a member, I want Multi-Language listing tabs (EN, DE, FR, IT, ES, JA) with "Auto Translate" toggle and "Translate to All" button.
13. As a member, I want a "Copy for MBA" button that copies the formatted listing to clipboard for manual paste.

### Auto-Save
14. As a member, I want my edits to auto-save so I don't have to click "Save" every time — immediate PATCH for any Control (Checkbox / Switch / Radio / Color Swatch / Product Toggle / Price Input), and on-blur PATCH for Text Fields (Brand, Title, Bullet 1, Bullet 2, Description, Keyword Context) when the value changed.
14b. As a member, I want the existing "Save" button + "Unsaved changes" banner to remain as an optional manual trigger + fallback, so I can force-flush pending debounced saves and clearly see when a save is in-flight / failed.

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

### Global Tab Completion (added 2026-04-24)
> Prerequisite for FlyingUpload Export. The Global marketplace tab has
> been a "Configuration for Global coming soon" placeholder since the
> multi-marketplace-tab decision (2026-04-18). Finishing it unlocks both
> the Basic/Spreadshirt upload path AND provides the Keywords-per-language
> input that the MBA Excel export's Tags columns draw from.

42. As a member, I want the Global marketplace tab to render its own editable Title + Description per language (same 6 languages as MBA), so I can maintain a Spreadshirt-friendly copy set alongside the full MBA listing without having the two overwrite each other.
43. As a member, I want a **Keywords** input on the Global tab — rendered as removable chips with a 50-character counter per language — so I can tag my listing with the search-term keywords that FlyingUpload publishes to Amazon Search Terms / Spreadshirt. Keywords are stored only on the Global listing; the MBA tab keeps `keyword_context` (500 chars, AI-only, unchanged).
44. As a member, I want the Global tab's Options section to expose **Type** (Men / Women / Youth — multi-select checkboxes) and **Color** (Black / White / Colorful — single-select radio) at the listing level, so the Basic FlyingUpload export can fill its `Type` + `Color` columns without inferring from DesignProductConfig.
45. As a member, I want the Global tab to NOT show the MBA-specific Products / Fit Type / Print Side / Marketplaces&Prices sections (those remain MBA-only), and to NOT show the AI Improve button (AI Improve is scoped to MBA listings only for MVP), so the UI clearly reflects which marketplace I'm editing for.

### FlyingUpload Export (added 2026-04-24)
> Replaces the disabled "Export as XLSX" / "Export as CSV" command palette
> stubs that shipped in Round 4. Generates FlyingUpload-compatible `.xlsx`
> files populated from the workspace's listings + product configs so the
> user can hand the file to FlyingUpload Desktop (or a VA) without manual
> retyping.

46. As a member, I want an **"Export as XLSX (MBA)"** action in the Choose-Action command palette that generates a FlyingUploadMultiLanguageMBA-compatible spreadsheet (`Flying Upload POD` sheet, 66 columns, gap columns B/W/BK preserved empty) filled with the copy, per-product config, and per-marketplace pricing of the currently-selected designs.
47. As a member, I want an **"Export as XLSX (Basic)"** action that generates a FlyingUploadBasicMultiLanguage-compatible spreadsheet (9 columns, DE + EN only) from the selected designs' Global-tab listings, so I can upload to Spreadshirt via FlyingUpload Basic.
48. As a member, I want designs with multiple enabled product types to **fan out** into one spreadsheet row per (design × enabled product), so a single "t-shirt + hoodie + tank top" design produces 3 rows — each with that product's specific prices, colors, fit types, and print side.
49. As a member, I want the export to respect workspace isolation via `X-Workspace-Id` — any design id not in my workspace → 404 — so the export never leaks cross-workspace data.
50. As a member, I want the downloaded file to be a **.zip archive** containing the Excel file plus every referenced design image in a `designs/` subfolder (`flyingupload-mba-2026-04-24.zip`, `flyingupload-basic-2026-04-24.zip`), so FlyingUpload Desktop can resolve image paths locally without me having to download the designs separately. Relative `Image Path` cells point into the same archive.
51. As a member, I want the export dialog to show a **pre-flight summary** before download — total rows that will be generated, designs that will be skipped (no listing / no enabled products / no Global listing for Basic) — mirroring the Publish dialog's pre-flight pattern so silent drops never surprise me.
52. As a member, I want the export to work on **zero selection** by falling back to "export the current folder" — same scope as the command palette's other bulk actions — or prompt me to select first if nothing is selected AND no folder is open.
53. As a member, I want the Global-tab Title + Description to use the same character limits as the MBA tab (Title 60, Description 2000) so the two sides stay convertible without truncation — differences in Spreadshirt's real-world limits can be handled at upload time by FlyingUpload itself.
54. As a member, I want the Global-tab Title + Description + Keywords to be independent of MBA (they're separate listing rows per the multi-marketplace-tab decision 2026-04-18) — so editing one never overwrites the other, and I can keep a Spreadshirt-specific copy without breaking my MBA listing.
55. As a member, I want clear progress feedback while the export runs: a "Preparing archive — N design(s)" overlay during the server-side generation, so I know the click was received and roughly how long it will take.
56. As a member, I want the export to surface a server-side error (too many designs, archive-too-large, image-unavailable) as a precise actionable snackbar — not a generic "Export failed" — so I can fix the input and retry.
57. As a member, I want an **Export History** drawer that lists my workspace's last 50 exports (template, design count, row count, filename, creator, timestamp) so I can see what was already exported and avoid accidental duplicates — especially important for multi-VA workflows.
58. As a member, I don't want to pick marketplaces in the export dialog — my Listing + product config already encodes which marketplaces are enabled per product. Whatever is enabled in the source gets exported; whatever is unchecked in the Listing's Marketplaces & Prices section stays out. No filter UI needed; the Listing is the single source of truth.

### Displate Tab Completion (added 2026-04-24)
59. As a member, I want the **Displate tab** (today a placeholder) to render a slim Displate-specific listing form — Title + Description + Keywords (per language, same chip UI as Global) + Types (Men/Women/Youth) + **Background Color (Hex)** via a color-picker — so I can maintain a dedicated Displate listing without polluting my MBA or Global listings.
60. As a member, I want the MBA XLSX export's **Background Color (Hex) column (BN)** to be populated from the design's Displate listing's `background_color_hex` when present — matching the `Excel_HELP.txt` rule that the MBA template covers Displate — so FlyingUpload picks up the Displate-specific color without me needing a separate Displate template file.

### Keyword Research Deeplinks (added 2026-04-24)
61. As a member, I want a **"KW Finder"** link below the Keywords field on the Global / Displate tabs that deeplinks to the PROJ-10 Keyword Research view pre-filtered by my active niche, so I can research new keywords without losing my place in Edit.
62. As a member, I want a **"KW Workbench"** link next to KW Finder — disabled for MVP with a tooltip `"Coming soon — ships with PROJ-10 Keyword Bank"` — so the UI matches the FlyingUpload reference without promising functionality we don't have yet.

### Advanced Options + Tagging Options (added 2026-04-24)
63. As a member, I want an **Advanced Options** button top-right on the Global + Displate tabs that opens a modal with rarely-touched optional fields (Brand, Category), so the main form stays focused on the common-case copy while power users still have a surface for edge-case data.
64. As a member, I want a **Tagging Options** menu button on the Global tab's Keywords section with three bulk-actions — **Copy EN keywords to all languages**, **Clear all keywords**, **Import keywords from CSV** (paste dialog) — so multi-language workflows don't require manual chip-by-chip re-typing.

### CSV Export + Edit-View Trigger + History Re-run (added 2026-04-24)
65. As a member, I want a **"Export as CSV"** command-palette action alongside the XLSX exports — produces a flat UTF-8 CSV (no ZIP wrap, no images) with the same columns as the XLSX — so I can pipe the data into Google Sheets / Excel / Zapier / my own tooling for analysis without having to unzip the image bundle.
66. As a member, I want to trigger exports **from the Edit View** too (not just the Publish View) — the Edit-View command palette mirrors the `Export as XLSX (MBA/Basic)` + `Export as CSV` entries, scoped to the designs currently opened via `?designs=...`, so I can export from wherever I am.
67. As a member, I want each row in the **Export History drawer** to expose a **"Re-run"** icon — clicking re-submits the same `design_ids + template` combination, regenerates the archive, and writes a fresh log entry — so repeating an export (e.g. after editing a listing I missed) is one click.

## Acceptance Criteria

### Models

- [ ] AC-1: `Listing` model (updated 2026-04-22): UUID pk, `idea` FK, `design` FK (nullable), `marketplace_type` choices [global, mba, displate] default=mba, `round` (PositiveIntegerField, default=1 — matches Niche.current_round), `brand_name` (max 50), `title` (max 60), `bullet_1` (max 256), `bullet_2` (max 256), `description` (max 2000), `keyword_context` (max 500 — AI-input only, not published to Amazon; renamed from `backend_keywords` on 2026-04-22), `status` choices [draft, ready, published], `generated_by` choices [ai, manual], `availability` choices [public, private] default=public, `publish_mode` choices [live, draft] default=live, `language` (CharField, default='en'), `translations` (JSONField — {lang: {title, bullet_1, bullet_2, description}}), `created_at`, `updated_at`. **Unique constraint**: `(design, marketplace_type)` — one listing record per design per marketplace_type. **Migration (2026-04-22)**: drop `bullet_3`, `bullet_4`, `bullet_5`; rename `backend_keywords` → `keyword_context`; update `translations` JSON shape (legacy `bullets` array → `bullet_1` + `bullet_2` keys, data migration may truncate to first 2 entries).

- [ ] AC-2: `UploadTemplate` model: UUID pk, `workspace` FK, `name` (CharField 100), `brand_name` (CharField 50), `product_types` (JSONField — list of product type keys), `fit_types` (JSONField — list), `colors` (JSONField — list of MBA color codes), `marketplaces` (JSONField — list of {marketplace, price, enabled}), `print_side` choices [front, back, both] default=front, `created_by` FK, `created_at`, `updated_at`.

- [ ] AC-3: `UploadJob` model: UUID pk, `workspace` FK, `listing` FK, `design` FK, `template` FK (UploadTemplate), `listing_snapshot` (JSONField — denormalized listing at queue time), `marketplace` (CharField), `status` choices [pending, validating, uploading, completed, failed, cancelled], `asin` (CharField 20, blank=True), `upload_date` (DateTimeField, nullable), `error_message` (TextField, blank=True), `error_screenshot` (URLField, blank=True), `retry_count` (IntegerField, default=0), `queued_at`, `started_at` (nullable), `completed_at` (nullable), `created_by` FK.

- [ ] AC-4: `DesignAsset` model (Gallery): UUID pk, `workspace` FK, `file_name` (CharField 255), `file_url` (URLField — local storage or cloud URL), `source` choices [upload, google_drive, onedrive, generated], `source_file_id` (CharField 255, blank=True — Drive/OneDrive file ID), `thumbnail_url` (URLField, blank=True), `dimensions` (JSONField — {width, height}), `file_size` (IntegerField — bytes), `tags` (JSONField, default=list), `listing` FK (nullable — linked when listing created), `idea` FK (nullable — links back to source slogan), `niche` FK (nullable), `round` (PositiveIntegerField, default=1), `created_by` FK, `created_at`.

- [ ] AC-5: `ProductLifecycle` model: UUID pk, `niche` FK, `idea` FK (nullable), `design` FK (DesignAsset, nullable), `listing` FK (nullable), `upload_job` FK (nullable), `asin` (CharField 20, blank=True), `marketplace` (CharField, blank=True), `upload_date` (DateTimeField, nullable), `sales_units` (IntegerField, nullable), `sales_revenue` (DecimalField, nullable), `current_bsr` (IntegerField, nullable), `reviews_count` (IntegerField, nullable), `reviews_rating` (DecimalField, nullable), `round` (PositiveIntegerField, default=1), `updated_at`.

### Listing API

- [ ] AC-6: ~~`POST /api/ideas/{id}/listing/generate/`~~ **REMOVED 2026-04-22.** Replaced by unified AC-64 `/ai-improve/` endpoint. Old generate endpoint was never tied to real Keyword-Bank integration (PROJ-10 coupling removed). Backwards-compat shim NOT required (endpoint was never used in prod — spec-only).
- [ ] AC-7: `GET /api/ideas/{id}/listing/` — returns listing with lifecycle chain.
- [ ] AC-8: `PATCH /api/listings/{id}/` — partial update for Brand / Title / Bullet 1 / Bullet 2 / Description / Keyword Context + other fields. Status reverts to draft on edit. Used by frontend auto-save (on-blur for text fields, immediate for controls). Supports partial body: only dirty fields sent.
- [ ] AC-9: `POST /api/listings/{id}/translate/` — body: `{target_languages: ["de", "fr"]}`. AI translates Title + Bullet 1 + Bullet 2 + Description. Stored in `translations` JSONField. `keyword_context` NOT translated (AI input only, English-optimized).
- [ ] AC-10: ~~`POST /api/listings/{id}/tm-check/`~~ **REMOVED 2026-04-22.** Trademark-Check ist eigenes zukünftiges Feature mit eigener PROJ-ID. Keine Referenz mehr im Edit-Bereich, `Trademarks`-Tab entfernt, `TMCheckDialog`-Komponente gelöscht, `services/tm_checker.py` archiviert.
- [ ] AC-11: `GET /api/listings/{id}/export/` — plain-text MBA format (Brand, Title, Bullet 1, Bullet 2, Description — no TM check, no keyword chips).

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
- [ ] AC-34: ~~Keyword chips~~ **REMOVED 2026-04-22.** `keyword_context` rendert jetzt als einfaches Multiline-TextField mit Char-Counter (500). Keine Chips, keine KW-Finder/KW-Workbench Links, keine PROJ-10-Auto-Injection. Komponente `KeywordChipsField.tsx` gelöscht.
- [ ] AC-35: Upload status visible inline: pending → uploading → completed (ASIN shown) / failed (error + screenshot).
- [ ] AC-36: Design Gallery as card grid with import, sort, filter, bulk actions.

### MBA Reference Data API

- [ ] AC-37: `GET /api/mba/product-catalog/` — returns canonical MBA product catalog (updated 2026-04-22, supersedes old colors-only endpoint). Response: array of product entries:
  ```json
  [
    {
      "key": "t_shirt",
      "label": "Standard T-Shirt",
      "icon_key": "t_shirt",
      "supports": ["fit_types", "print_side", "colors"],
      "fit_types_options": ["men", "women", "youth", "girls", "adult_unisex"],
      "print_side_options": ["front", "back", "both"],
      "colors_options": [
        {"key": "black", "name": "Black", "hex": "#000000"},
        {"key": "white", "name": "White", "hex": "#FFFFFF"}
      ],
      "marketplaces": ["amazon.com", "amazon.co.uk", "amazon.de", "amazon.fr", "amazon.it", "amazon.es", "amazon.co.jp"],
      "default_prices": {
        "amazon.com": 19.99, "amazon.co.uk": 19.99, "amazon.de": 18.99,
        "amazon.fr": 18.99, "amazon.it": 18.99, "amazon.es": 18.99, "amazon.co.jp": 2580
      },
      "royalty_formula": {
        "amazon.com": {"coef": 0.4, "base": 5.04},
        "amazon.de":  {"coef": 0.4, "base": 5.34}
      }
    }
  ]
  ```
  - 17 product keys covered: `t_shirt`, `t_shirt_premium`, `t_shirt_heavyweight`, `v_neck`, `tank_top`, `long_sleeve`, `raglan`, `sweatshirt`, `hoodie_pullover`, `hoodie_zip`, `performance`, `baseball`, `trucker_hat`, `popsocket`, `phone_case`, `throw_pillow`, `tote_bag`, `tumbler`, `mug`, `water_bottle` (final list finalized during implementation; Amazon-supported subset for MVP).
  - `supports` flags which control types apply (shirt-class supports all; PopSocket supports only `colors`; Phone Case has product-specific controls deferred post-MVP).
  - `colors_options` is per-product (different palettes per product).
  - `royalty_formula` per (product, marketplace) — frontend computes `price × coef − base`, shows `$0.00` when price is empty or below threshold.
  - No pagination, no workspace scope (global read-only list). Frontend caches response (long TTL). Icons are NOT served as URLs — `icon_key` maps to a frontend React SVG component.

### Per-Design Product Config Persistence (added 2026-04-18)

> Motivation: D7 Copy-from-Design requires per-design product config. Today Colors / Fit Types / Print Side / Product Types / Marketplace Pricing live only in React state — reload wipes them. Also: Desktop Upload App (PROJ-13) needs per-design config to know which MBA variants to publish. Promoted to persistent backend model.

- [ ] AC-38: `DesignProductConfig` model (restructured 2026-04-22): UUID pk, `design` FK (DesignAsset, on_delete=CASCADE), `marketplace_type` choices [global, mba, displate] default=mba (same enum as Listing), `products_config` (JSONField default=list — **per-product config objects**, see shape below), `created_at`, `updated_at`. **Unique constraint**: `(design, marketplace_type)` — one config row per design per marketplace.

  **`products_config` shape:**
  ```json
  [
    {
      "product_type": "t_shirt",
      "enabled": true,
      "fit_types": ["men", "women"],
      "print_side": "front",
      "colors": ["black", "white"],
      "marketplaces": [
        {"marketplace": "amazon.com", "price": 19.99, "enabled": true},
        {"marketplace": "amazon.de", "price": 18.99, "enabled": true}
      ]
    },
    {
      "product_type": "hoodie_pullover",
      "enabled": true,
      "fit_types": ["men"],
      "print_side": "front",
      "colors": ["black"],
      "marketplaces": [...]
    }
  ]
  ```
  - `enabled=true` means the product is selected (has count badge, rendered in scroller as active). `enabled=false` rows allow preserving a user's draft config while hiding the product.
  - `fit_types` / `print_side` / `colors` / `marketplaces` are independent per `product_type` — T-Shirt and Hoodie can have disjoint fit types / colors / prices.
  - Per product, `marketplaces[].price` = decimal ≥ 0, `marketplaces[].enabled` = bool (toggle per marketplace).
  - Server validates: `product_type` keys exist in `GET /api/mba/product-catalog/`; `fit_types` / `colors` / `marketplaces[].marketplace` values are subsets of the matching catalog entry's `*_options` (400 on unknown keys).
  - **Migration (2026-04-22)**: existing rows with separate `product_types` / `fit_types` / `print_side` / `colors` / `marketplaces` fields are collapsed into `products_config` — data migration: for each selected `product_type` in legacy `product_types[]`, create one `products_config` entry with the shared legacy `fit_types` / `print_side` / `colors` / `marketplaces` values (lossy but acceptable — users reconfigure per-product after migration). Legacy fields dropped after migration.

- [ ] AC-39: `GET /api/designs/{design_id}/product-config/?marketplace_type=mba` — returns the single config row for that `(design, marketplace_type)` pair. Default `marketplace_type=mba` if omitted. Returns 404 when no config exists (frontend falls back to empty defaults — `products_config=[]`). Workspace isolation via `design.workspace`.
- [ ] AC-40: `PATCH /api/designs/{design_id}/product-config/` — upserts (create if missing, update if exists). Body: `{marketplace_type, products_config?}` OR targeted ops: `{marketplace_type, op: 'upsert_product', product_type, patch: {...}}` for single-product mutations (preferred to keep payload small when a single toggle changes). `marketplace_type` required. Returns 200 with full updated record. Validates catalog-referential integrity (AC-37). Upserts auto-create rows if the `(design, marketplace_type)` pair does not exist.
- [ ] AC-41: `POST /api/designs/{design_id}/product-config/copy-from/` — copies config from a source design to this design. Body: `{source_design_id, marketplace_type, scope, product_type?}` where `scope` ∈ `['all', 'product_types', 'fit_types', 'print_side', 'colors', 'marketplaces']`. When `scope=all`: copies entire `products_config`. When scalar scope + `product_type` provided: copies just that field for the matching product entry (e.g., copy `marketplaces` prices for `t_shirt` only). When scalar scope + no `product_type`: applies to ALL product entries in the target. Upserts target config row. Returns 200 with full updated target record. Returns 404 if source has no config for `marketplace_type`. Both designs must belong to caller's workspace.
- [ ] AC-42: Listing endpoints unchanged — `DesignProductConfig` is a sibling record, not a field on Listing. AI-Improve and Save flows for `Listing` ignore product config.
- [ ] AC-43: Frontend `useEditView` — `productConfig` sourced via RTK Query keyed on `(activeDesign.id, activeMarketplace)`. Control-type setters (Checkbox / Switch / Radio / Color Swatch / Product Toggle / Price Input) trigger **immediate PATCH** (no debounce). Text-field setters (Brand / Title / Bullet 1 / Bullet 2 / Description / Keyword Context on the Listing) trigger **PATCH on blur** when dirty. Switching active design or marketplace loads the matching row. Copy-from-Design dialog calls the copy-from endpoint instead of client-side state copy. Save button remains as optional manual trigger (flushes any pending blur-pending field). `isDirty` indicator drives the "Unsaved changes" banner.
- [ ] AC-44: Desktop Upload App (PROJ-13) reads `DesignProductConfig` via a listing's linked design to determine which MBA variant combinations to upload. For each `products_config[i]` with `enabled=true`, the App generates variants as `(product_type) × (fit_types[]) × (colors[]) × (marketplaces[].marketplace where enabled=true)` — fully per-product, not a global cartesian product. Backend serializer exposes config when the App fetches an upload job's snapshot.

### Listing Templates (added 2026-04-19)

> Motivation: Users should be able to save standalone Listings (text only, no linked design) as reusable templates. Convert endpoint accepts them as source so a saved template can seed a brand-new target Listing.

- [ ] AC-45: `Listing` model adds `is_template` BooleanField (default=False). Migration backfills existing rows to False.
- [ ] AC-46: Model validation (`clean()` + serializer): when `is_template=True`, `design` must be NULL — raises ValidationError on save/POST if violated. When `is_template=False`, `design` remains optional (existing behavior).
- [ ] AC-47: `GET /api/listings/templates/` — paginated list of `is_template=True` Listings in the caller's workspace (via `idea.niche.workspace` or however workspace is reachable from Listing). Supports `?marketplace_type=` filter. Ordered by `-created_at`.
- [ ] AC-48: `POST /api/listings/templates/` — creates a Listing with `is_template=True, design=NULL`. Body accepts: `brand_name, title, bullet_1, bullet_2, description, keyword_context, language, marketplace_type, idea` (idea FK required; a template is still linked to an Idea for context; field list updated 2026-04-22 — 5 bullets → 2, backend_keywords → keyword_context). Returns 201.
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

### Central AI Improve (added 2026-04-22)

> Replaces removed AC-6 (`/listing/generate/`). Single unified endpoint for "generate from scratch" AND "improve existing" — same call, different input state.

- [ ] AC-69: `POST /api/listings/{id}/ai-improve/` — authenticated, workspace-isolated. Body: `{}` (no required fields; endpoint reads current listing state + linked design image + `keyword_context`). Behavior:
  - Loads the Listing by id (404 if not in caller's workspace via `idea.niche.workspace`).
  - Loads the linked `Listing.design` (DesignAsset). If none, 400 "AI Improve requires a linked design asset".
  - Builds an LLM prompt containing: design image URL (vision model input), `keyword_context` (guidance keywords), existing `brand_name` / `title` / `bullet_1` / `bullet_2` / `description` (empty OR pre-filled from a copy — both valid), `marketplace_type`, `language`.
  - Calls OpenRouter vision-capable model (Claude 3.5 Sonnet or similar — configured via env).
  - Response: `{brand_name, title, bullet_1, bullet_2, description}`. Updates the Listing via serializer validation (respects char limits — if the LLM returns over-limit text, the server truncates at max length and flags `truncated_fields: [...]` in response).
  - Returns 200 with the updated Listing + `truncated_fields: []` (or list of truncated field keys).
  - Rate-limit: max 10 calls per user per minute (DRF throttle).
- [ ] AC-70: Frontend "AI Improve" IconButton in Edit header (top-right). Icon: `AutoFixHighOutlined` (MUI). Tooltip: "AI Improve listing". Click → spinner replaces icon, button disabled during call. Success: text fields animate to new values (cross-fade), snackbar "Listing improved with AI". `truncated_fields` → each truncated field shows inline warning chip "Truncated to {max} chars — review".
- [ ] AC-71: "AI Improve" button respects the active marketplace tab — calls ai-improve on the Listing row matching `(design, marketplace_type)`. If that Listing does not exist yet, the button is disabled with tooltip "Create or convert listing first".
- [ ] AC-72: Pre-existing PROJ-17 Chat per-field "Improve" hover-icon (US-10) remains unchanged and ORTHOGONAL to the central AI Improve button. Per-field hover → opens Chat for free-form field refinement. Central button → one-shot full-listing rewrite.

### Auto-Save UX Rules (added 2026-04-22)

- [ ] AC-73: Auto-save trigger matrix — the Edit page PATCHes automatically in two modes:
  - **Immediate (no debounce)**: clicking a Checkbox (Fit Type, Marketplace enabled), Radio (Print Side, Availability, Publish Mode), Switch (Auto Translate), Color Swatch (select / deselect), Product toggle in Products scroller, Price input (on every keystroke IS too chatty — use 400ms debounce for price inputs only, since typing "19.99" would otherwise fire 4 PATCHes).
  - **On Blur (dirty-only)**: Brand, Title, Bullet 1, Bullet 2, Description, Keyword Context TextFields — PATCH fires when the field loses focus AND the value differs from the last saved value. Clean fields on blur = no network call.
- [ ] AC-74: Manual "Save" button in the Edit header remains visible. Clicking it: (a) flushes any pending debounced/blur-pending PATCH immediately, (b) shows spinner until all in-flight PATCHes settle, (c) shows "Saved" green check for 2s on success or error snackbar on failure.
- [ ] AC-75: "Unsaved changes" banner: slides down from top of scroll container when any field is dirty OR any in-flight PATCH is pending. Disappears when all fields are clean AND no PATCH is in flight. Includes "Discard" button → reverts to last-saved state (reset RTK cache patch, confirm dialog "Discard unsaved changes?").
- [ ] AC-76: Auto-save failure handling: any PATCH that returns 4xx/5xx → field reverts to last-saved value visually (Optimistic update rolled back), error snackbar "Save failed: {reason}", banner shows red "Save failed — retry" button. Retry button re-fires all dirty PATCHes.
- [ ] AC-77: Network offline detection: `navigator.onLine === false` OR PATCH returns network error → banner switches to orange "Offline — changes saved locally". Queue dirty PATCHes client-side. On reconnect (`online` event) → auto-flush queue in order. No queue persistence across page reload (MVP — dirty state lost on reload while offline, acknowledged trade-off).

### Product SVG Icons + Catalog Rendering (added 2026-04-22)

- [ ] AC-78: Frontend ships 20 custom SVG React components under `frontend-ui/src/components/ProductIcons/`:
  - `TShirtIcon.tsx`, `TShirtPremiumIcon.tsx`, `TShirtHeavyweightIcon.tsx`, `VNeckIcon.tsx`, `TankTopIcon.tsx`, `LongSleeveIcon.tsx`, `RaglanIcon.tsx`, `SweatshirtIcon.tsx`, `HoodiePulloverIcon.tsx`, `HoodieZipIcon.tsx`, `PerformanceIcon.tsx`, `BaseballIcon.tsx`, `TruckerHatIcon.tsx`, `PopSocketIcon.tsx`, `PhoneCaseIcon.tsx`, `ThrowPillowIcon.tsx`, `ToteBagIcon.tsx`, `TumblerIcon.tsx`, `MugIcon.tsx`, `WaterBottleIcon.tsx`
  - Each exports a React SVG component (`({ size, color }) => <svg ... />`), sized 40px default, `currentColor` stroke (inherits theme palette).
  - Icons are product-shaped (T-Shirt silhouette, Hoodie silhouette, PopSocket disc, Phone Case rectangle, Mug handle-shape, etc.) — NOT generic hangers.
  - Index file `ProductIcons/index.ts` exports `PRODUCT_ICON_MAP: Record<string, FC<IconProps>>` keyed by `icon_key` from the catalog.
  - Drawings: line-based, stroke-width 1.5–2px, matching the overall app icon style (Iconoir / Tabler feel).
- [ ] AC-79: `ProductTypeScroller.tsx` maps each catalog entry's `icon_key` to the corresponding SVG component via `PRODUCT_ICON_MAP`. Unknown `icon_key` → fallback `CheckroomIcon` from `@mui/icons-material` + console warning.
- [ ] AC-80: Design-system compliance: icon color uses `theme.vars.palette.text.primary` for inactive state, `theme.vars.palette.secondary.main` (cyan) for active/selected state. Selection ring + count badge continue to follow FD-PROJ11-7 spec.

### Global Tab Completion (added 2026-04-24)

#### Data Model

- [ ] AC-81: `Listing` model gets new fields at the top level (some scope-widened in the 2026-04-24 Displate-Tab completion round):
  - `keywords` (JSONField, default=dict) — **Global OR Displate listings**, rejected on `marketplace_type='mba'` via serializer gate. Stored shape: `{lang: [keyword, ...]}` where `lang ∈ {en, de, fr, it, es, ja}`. Keyword strings trimmed, deduplicated case-insensitively within a language, and must NOT contain `,` or `;` (AC-110).
  - `type_flags` (JSONField, default=list) — Global OR Displate. List of strings from `['men', 'women', 'youth']`. Used by Basic export's `Type` column (Global only).
  - `color_mode` (CharField, choices=`[black, white, colorful]`, blank=True, default='') — **Global-only**. Used by Basic export's `Color` column. Rejected on MBA + Displate via serializer gate.
  - `background_color_hex` (CharField max_length=7, blank=True, default='') — **Displate-only**. Must match `^#[0-9A-Fa-f]{6}$` when non-empty. Rejected on MBA + Global via serializer gate. Used by MBA XLSX export's `Background Color (Hex)` column BN (AC-127).
  - `category` (CharField max_length=200, blank=True, default='') — MBA + Global, set via Advanced Options modal (AC-131). Used by MBA XLSX export's `Category` column BM. Not on Displate.
- [ ] AC-82: Per-field serializer gates on `Listing` save:
  - `keywords`: allowed on `global|displate`, rejected on `mba` (400 "Keywords only allowed on Global or Displate listings")
  - `type_flags`: allowed on `global|displate`, rejected on `mba`
  - `color_mode`: allowed only on `global`, rejected on `mba|displate`
  - `background_color_hex`: allowed only on `displate`, rejected on `mba|global`
  - `category`: allowed on `mba|global`, rejected on `displate`
  Migration backfills existing rows with empty defaults (`keywords={}`, `type_flags=[]`, `color_mode=''`, `background_color_hex=''`, `category=''`).
- [ ] AC-83: `ListingTranslation` schema is unchanged. Keywords do NOT live under `translations[lang]` because they are a separate top-level JSON dict keyed by language (`keywords.en`, `keywords.de`, …) — simpler to validate + query than nesting per-language arrays inside an existing per-language dict.

#### Keywords UI (Global tab)

- [ ] AC-84: `KeywordsChipField` component renders a chip-style multi-value input (MUI `Autocomplete` with `freeSolo` + `multiple`) anchored to the currently active language tab. Empty-state placeholder: "Add keyword… (Enter or comma to commit)". Chip actions: Delete icon per chip. Keyboard: `Enter` or `,` commits the pending input; `Backspace` on empty input removes the last chip. Auto-lowercases and trims committed values. Rejects a chip that (case-insensitively) already exists in the current language's list with a subtle shake.
- [ ] AC-85: Character counter below the field shows `{current}/50` where `current` = `keywords[activeLang].join(', ').length`. Amber at `>=90%`, red at `>=100%`. Committing a chip that would exceed 50 total characters → rejected with shake + inline "Limit reached" hint.
- [ ] AC-86: Auto-save behavior matches the text-field pattern: on blur (or when the chip list changes via add/remove), PATCH `Listing.keywords[activeLang]` = new array. No debounce for chip add/remove (each commit is an atomic intent). Listing status does NOT revert to `draft` on a keywords-only PATCH (same rule as `keyword_context` / EC-42).
- [ ] AC-87: `KeywordsChipField` renders on **Global AND Displate** marketplace tabs (both use the same chip UI, same per-language store). On MBA tab the component is not mounted; the top-level `keywords` field is hidden in serializer responses for MBA listings only.

#### Types + Color Options (Global tab)

- [ ] AC-88: Global-tab Options section (below the listing fields) renders:
  - **Types** (AC-44): multi-select checkbox group labelled "Men / Women / Youth" bound to `listing.type_flags`. Zero-or-more selection allowed. Immediate PATCH on change.
  - **Color** (AC-44): single-select radio group labelled "Black / White / Colorful" bound to `listing.color_mode`. Defaults to empty (no radio selected) on a new Global listing. Immediate PATCH on change.
- [ ] AC-89: MBA-tab Options section is UNCHANGED — continues to show Availability (Public/Private) + Publish (Live/Draft). The two Options sections are rendered conditionally based on `activeMarketplace`.

### FlyingUpload Export (added 2026-04-24)

#### Backend endpoint

- [ ] AC-90: `POST /api/publish/export/flyingupload/` — authenticated, workspace-isolated. Request body:
  ```json
  {
    "template": "mba" | "basic",
    "design_ids": ["uuid", "uuid", ...],
    "collection_id": "uuid | null (optional — falls back to folder-scope when design_ids is omitted)"
  }
  ```
  At least one of `design_ids` (non-empty) or `collection_id` must be provided. Response: **ZIP archive** (`Content-Type: application/zip`) containing the `.xlsx` at the archive root + a `designs/` directory with every referenced image file. Streamed blob with `Content-Disposition: attachment; filename="flyingupload-<template>-<YYYY-MM-DD>.zip"`. Filename encoded via RFC 5987 (UTF-8) if it contains non-ASCII chars (e.g. workspace name with umlaut). Error shape on invalid body: DRF standard 400 payload.
- [ ] AC-91: Pre-flight endpoint `POST /api/publish/export/flyingupload/preflight/` — same request body, returns JSON summary WITHOUT generating the file:
  ```json
  {
    "template": "mba",
    "total_designs": 5,
    "ready_rows": 8,            // post-fan-out row count for MBA
    "skipped": [
      {"design_id": "uuid", "file_name": "x.png", "reason": "no_listing"},
      {"design_id": "uuid", "file_name": "y.png", "reason": "no_enabled_products"}
    ],
    "warnings": [
      {"design_id": "uuid", "message": "Keywords missing for EN — Tags EN column will be empty"}
    ]
  }
  ```
  Frontend calls preflight first, shows the summary + lets user confirm before the streaming download fires.

#### MBA template (FlyingUploadMultiLanguageMBA)

- [ ] AC-92: Output workbook uses **exactly** the FlyingUpload v2.3 layout:
  - Sheet name: `Flying Upload POD` (verbatim).
  - Row 1 = bold header row with the 66 column names from the reference file (including the intentionally-empty gap columns B, W, BK — must remain empty strings).
  - Data rows start at row 2. One row per **(design × enabled product)** entry — fan-out per US-48.
  - Column widths + bold-header style match the reference (copied from a bundled template stub).
- [ ] AC-93: Column → source-field mapping (MBA):
  | Column | Source |
  |--------|--------|
  | A `Image Path` | Relative ZIP-local path `designs/<safe_file_name>` — points at the image packed alongside the XLSX inside the same archive. FlyingUpload Desktop resolves this path from the unzipped folder. `safe_file_name` = collision-suffixed (see AC-107). |
  | C–Q `Title/Description/Tags` (DE/FR/IT/ES/JP/EN) | Title/Description from `mba_listing.translations[lang]`. Tags from `global_listing.keywords[lang].join(', ')` — fallback empty. Language code mapping: our `ja` → Excel `JP`. |
  | R–T `Title/Description/Tags EN` | EN variant — MBA-tab translations EN first, then top-level `mba_listing.title`/`description` as fallback. Tags EN from Global keywords. |
  | U `Type` | CSV of fit types from the current product's `DesignProductConfig.products_config[i].fit_types` (comma + space separator, no quotes). All 5 FlyingUpload-valid keys pass through as-is: `men, women, youth, girls, adult_unisex`. |
  | V `Color` | Single-value derived from the product's `colors[]`: all-dark-keys → `black`, only-white-keys → `white`, mix → `colorful`. Mapping list documented in `services/flyingupload/color_mode.py`. |
  | X–AC `Brand` (DE/FR/IT/ES/JP/EN) | `mba_listing.brand_name` duplicated into every language column (US-chose default). |
  | AD–AI `Bullet 1` (per lang) | `mba_listing.translations[lang].bullet_1`, EN fallback top-level `bullet_1`. |
  | AJ–AO `Bullet 2` (per lang) | Same pattern for `bullet_2`. |
  | AP–AY `Color1`..`Color10` | First 10 entries of the product's `colors[]` in catalog order. Over 10 colors → first 10 + warning in preflight. |
  | AZ `Product` | Translated product key → FlyingUpload label via `FLYINGUPLOAD_PRODUCT_MAP` (e.g. `t_shirt` → `Standard t-shirt`). Unmapped products → warning + row skipped. |
  | BA `Marketplace` | CSV of enabled marketplace codes from product's `marketplaces[]` where `enabled=true`. Mapping: `amazon.com→US`, `amazon.co.uk→UK`, `amazon.de→DE`, `amazon.fr→FR`, `amazon.it→IT`, `amazon.es→ES`, `amazon.co.jp→JP`. |
  | BB–BH `Price US/UK/DE/FR/IT/ES/JP` | Per-marketplace price from product's `marketplaces[]`. Empty cell if the marketplace is disabled OR missing. Numeric type (decimal for non-JP, integer yen for JP). |
  | BI `Print` | `products_config[i].print_side` — `front` / `back`. Our `both` → `front` (Excel v2.3 doesn't list `both`) + preflight warning. |
  | BJ `Draft` | `'yes'` if `mba_listing.publish_mode == 'draft'`, else empty. |
  | BL `Collection` | `design.collection.name` if set, else empty. |
  | BM `Category` | Empty (no backing field yet — post-MVP). |
  | BN `Background Color (Hex)` | Empty (Displate-only — post-MVP). |
- [ ] AC-94: Fan-out rule: for each selected `DesignAsset`, iterate `DesignProductConfig.products_config[]` where `enabled=true`. Each such entry emits one row. A design with 0 enabled products is added to `skipped` with reason `no_enabled_products`. A design with no linked MBA Listing → `skipped` with reason `no_listing`.

#### Basic template (FlyingUploadBasicMultiLanguage)

- [ ] AC-95: Output workbook for Basic template:
  - Sheet name: `Flying Upload POD` (same as MBA).
  - Row 1 = 9 columns: `Image Path, Title DE, Description DE, Tags DE, Title EN, Description EN, Tags EN, Type, Color`.
  - One row per selected DesignAsset (no product fan-out — Basic has no `Product` column).
- [ ] AC-96: Basic column mapping:
  - `Image Path` ← Relative ZIP-local path `designs/<safe_file_name>` (same rule as MBA — AC-93).
  - `Title DE/EN`, `Description DE/EN` ← `global_listing.translations.de/en.title/description`, with empty string fallback when the language key is absent.
  - `Tags DE/EN` ← `global_listing.keywords.de/en.join(', ')`.
  - `Type` ← `global_listing.type_flags.join(', ')` mapping `men→man, women→woman` to match Basic's legacy terminology (per `Excel_HELP.txt`). `youth` is identical.
  - `Color` ← `global_listing.color_mode` (one of `black`/`white`/`colorful`).
- [ ] AC-97: Basic skips any selected design whose `global_listing` is absent. Preflight reports these with reason `no_global_listing`.

#### Frontend wiring

- [ ] AC-98: Command palette actions `Export as XLSX (MBA)` and `Export as XLSX (Basic)` are **enabled** when selection count ≥ 1. Action handlers:
  1. Call the preflight endpoint with current `design_ids`.
  2. Open `ExportPreflightDialog` showing total rows + skipped list + warnings.
  3. On confirm → `POST .../flyingupload/` with `responseType: 'blob'`, trigger browser download via anchor + `URL.createObjectURL` using the filename from the `Content-Disposition` header.
  4. On error → snackbar with the server error message.
- [ ] AC-99: Export palette actions are **disabled** when selection is empty. Disabled tooltip: `"Select at least one design to export"`. No folder-fallback for MVP (US-52 deferred — palette expects selection).
- [ ] AC-100: `ExportPreflightDialog` component structure (mirrors `PublishBatchDialog`):
  - Title: "Export as XLSX — {{template_label}}"
  - Body: "{{ready_rows}} row(s) will be generated from {{eligible_designs}} design(s)." + skipped list + warnings list + "Download {{template}} XLSX" primary button.
  - Mount-on-open to avoid firing RTK query subscriptions when closed.
  - Skipped-list entries include a `Edit {{n}}` shortcut when reason is `no_listing` / `no_global_listing` (same pattern as Publish preflight).

#### Service layout

- [ ] AC-101: Backend service module `publish_app/services/flyingupload_export.py` with:
  - `build_mba_bundle(workspace_id, design_ids) -> (zip_bytes, preflight_summary)` — returns tuple of ZIP bytes + summary dict.
  - `build_basic_bundle(workspace_id, design_ids) -> (zip_bytes, preflight_summary)`.
  - `preflight(workspace_id, design_ids, template) -> preflight_summary` — same summary shape without generating bytes.
  - Internal helpers: `_build_workbook_bytes()`, `_pack_zip(xlsx_bytes, image_manifest)`, `_color_mode_from_colors()`, `_marketplaces_csv()`, `_lang_code_map()`, `_safe_file_name()`, `FLYINGUPLOAD_PRODUCT_MAP`.
- [ ] AC-102: Writing uses `openpyxl` (already in `requirements.txt`) for the XLSX and `zipfile.ZipFile` (stdlib) for the archive. Headers + gap columns + column widths loaded once from a bundled template stub `publish_app/catalogs/flyingupload_mba_template.xlsx` to guarantee layout parity. Pipeline: open stub → populate data rows → save to `BytesIO` → write XLSX bytes + referenced images into a `ZipFile(BytesIO)` → return `.getvalue()`. The archive keeps mode `STORED` for images (already compressed PNG/JPEG) and `DEFLATED` for the XLSX.

#### ZIP packaging

- [ ] AC-103: ZIP archive layout (MBA + Basic — identical shape):
  ```
  flyingupload-<template>-<YYYY-MM-DD>.zip
  ├── flyingupload-<template>-<YYYY-MM-DD>.xlsx
  └── designs/
      ├── <safe_file_name_1>
      ├── <safe_file_name_2>
      └── …
  ```
  Root has exactly ONE `.xlsx` file + ONE `designs/` directory. No nested folders beyond `designs/`. Every `Image Path` cell in the XLSX points at a file inside `designs/` (see AC-93).
- [ ] AC-104: Image-source fetching — the service reads every referenced `DesignAsset.file_url` from Django storage (`default_storage.open(asset.file_url)` when `file_url` is a relative storage path, or fetching via HTTP when it's an absolute URL pointing outside the server). If fetch fails (404, timeout, permission) → design is added to `preflight.skipped` with `reason: 'image_unavailable'` and the row is omitted from the XLSX. No half-written archive.
- [ ] AC-105: Cloud-sourced designs (`source='google_drive'` or `'onedrive'`) — the asset's binary is expected to already live in our storage (imported via AC-14 `import-drive/`). The export does NOT call Drive/OneDrive APIs at export time; it relies on the import having copied the file. If a cloud-imported design has no server-side binary → `reason: 'image_unavailable'`. Rationale: OAuth token scoping at export time is fragile and user-workspace-specific; copy-on-import is the reliable contract.
- [ ] AC-106: Filename collision in the archive — two selected designs with the same `file_name` (e.g. both `color-design.png`) get disambiguated via `<stem>-<short-uuid8>.<ext>` where `short-uuid8` = first 8 chars of the asset's UUID. Every `Image Path` cell in the XLSX references this `safe_file_name`. Rule applied BEFORE writing the XLSX so cells and archive entries stay consistent.
- [ ] AC-107: Server-side size guardrails:
  - Max 500 designs per export (hard cap — returns 400 with `"error": "max_500_designs_per_export"` before generation).
  - Max ZIP size estimate (sum of asset `file_size` + 512 KB xlsx budget). If estimate > 500 MB → returns 400 with `"error": "estimated_archive_too_large"` and a `breakdown` listing designs over 10 MB. Prevents OOM on shared Django workers.
  - Generation streams the ZIP into `BytesIO` for ≤ 500 MB; above, switch to `tempfile.SpooledTemporaryFile(max_size=100MB, dir=settings.FILE_UPLOAD_TEMP_DIR)` so RAM stays bounded.

#### Auto-create + integration rules

- [ ] AC-108: Global listing is **lazy-created**: opening the Global marketplace tab does NOT create a DB row. The first PATCH to any Global-scoped field (title, description, keywords, type_flags, color_mode, translations) upserts `Listing(design=<id>, marketplace_type='global')` with the payload. Matches existing MBA pattern.
- [ ] AC-109: `POST /api/listings/convert/` (AC-50) rule clarification: **Marketplace-scoped fields never cross the convert boundary.** When converting between any pair of `(global, mba, displate)`:
  - **Copied**: `title`, `description`, `bullet_1`, `bullet_2` (if source has them), `translations[*].{title, description, bullet_1, bullet_2}`, `brand_name`, `category` (latter two also subject to serializer gates — `category` stays dropped if target is Displate).
  - **Never copied**: `keywords` (Global/Displate-only), `type_flags` (Global/Displate-only), `color_mode` (Global-only), `background_color_hex` (Displate-only). These stay on whichever tab they were set on — convert leaves them untouched on the source AND does not initialize them on the target (they default to empty per AC-82).
  - Rationale: these fields represent marketplace-specific decorations; copying them across tabs would either violate the serializer gate or semantically confuse the user (a Global `color_mode='black'` ≠ a Displate background-hex).
- [ ] AC-110: Keyword chip input rejects literal `,` (comma) and `;` (semicolon) characters — user cannot type a chip that contains either. Input onKeyDown: `Enter` or `,` commits the pending buffer (minus the comma); typed-mid-word comma is silently stripped before commit. Backend `keywords[lang]` validation also rejects any value containing `,`/`;` with 400 "Keyword cannot contain `,` or `;`" (defense-in-depth against crafted API calls). Guarantees lossless CSV export per AC-93/96.

#### Frontend progress + failure UX

- [ ] AC-111: `ExportPreflightDialog` disables the primary download button when `preflight.ready_rows === 0`. Disabled tooltip: `"No exportable rows — every selected design is missing a listing or has no enabled products"`.
- [ ] AC-112: Streaming download shows an overlay spinner (`LinearProgress` indeterminate) from click-to-download-start with the text "Preparing archive — {{count}} design(s)"; disappears once the browser's `download` event fires or after 60 s with an error snackbar `"Export timed out — try a smaller selection"`. Covers the ≤ 500-design, ≤ 500 MB case.
- [ ] AC-113: Download-side failures (network error, 5xx, 413) surface as error snackbars referencing the backend error code (e.g. `export.max_500_designs_per_export` → "Too many designs — reduce selection to 500 or fewer"). No auto-retry; user re-clicks to retry.

#### Export History (added 2026-04-24, in-MVP)

- [ ] AC-114: `ExportLog` model — UUID pk, `workspace` FK, `created_by` FK (User), `template` choices `[mba, basic]`, `design_ids` (JSONField list of UUIDs at export time — denormalized so log stays truthful even when a design is later deleted), `design_count` (int), `row_count` (int — post-fan-out for MBA, equals `design_count` for Basic), `filename` (CharField 200), `archive_size_bytes` (BigIntegerField, nullable), `created_at` DateTimeField. No updated_at (rows are append-only). DB-index on `(workspace, created_at DESC)` for the 50-row history drawer query.
- [ ] AC-115: `GET /api/publish/export/history/` — authenticated, workspace-isolated. Returns the caller's workspace's 50 most-recent `ExportLog` rows, ordered by `created_at DESC`. Response shape: paginated list with `{id, template, design_count, row_count, filename, archive_size_bytes, created_by: {id, first_name, last_name, avatar_url}, created_at}`. No write endpoints (logs are append-only, server-created).
- [ ] AC-116: Server writes the `ExportLog` row at the END of a successful `/flyingupload/` response — after the ZIP is fully streamed. Failed exports (400, 413, 500) do NOT create a log row. Writing happens in an `atomic()` block but outside the ZIP-streaming lifecycle so a client-side disconnect mid-download still leaves the log behind (counts as "generated", matches backend-truth semantics).
- [ ] AC-117: Frontend `ExportHistoryDrawer` — opens from an icon button in the Publish toolbar (`HistoryOutlined`). Lists the last 50 rows with: template chip (MBA/Basic), filename, row_count/design_count badge, relative timestamp, creator avatar. Hover a row → tooltip shows the `design_ids` array. No re-download action for MVP (the ZIP is not persisted; only the metadata is logged). Empty state: "No exports yet in this workspace."
- [ ] AC-118: `ExportHistoryDrawer` is a Publish-level surface (not Edit-level). Accessible at `/publish`. Invalidates + re-fetches on every mount, so switching workspaces via the topbar selector (see Round 5 workspace-cache-reset) cleans the view immediately.

#### Non-functional docs (added 2026-04-24)

- [ ] AC-119: **i18n coverage** — every user-visible string in the new Global-tab fields (placeholders, counter labels, Types/Color radio labels, validation messages) and the Export flow (palette action labels, preflight dialog copy, snackbar messages, error codes, history drawer labels) uses `t('publish.export.*', { defaultValue })` or `t('publish.edit.global.*', { defaultValue })`. EN defaultValue is authoritative; de/es/fr/it get EN fallback via `i18next.fallbackLng` (consistent with Round-5 sweep). DE-native translations for at least all error snackbars + preflight summary messages ship in the same PR as the feature.
- [ ] AC-120: **FlyingUpload version pinning** — template stub file `publish_app/catalogs/flyingupload_mba_template.xlsx` is committed to git as the byte-exact copy of `Excel Standard v2.3`. A top-of-file comment in `flyingupload_export.py` records the pinned version. Any future FlyingUpload template upgrade (v2.4+) requires: (1) new stub file, (2) header-diff review, (3) column-mapping update, (4) backward-compat flag if columns shift — tracked as its own minor PR.
- [ ] AC-121: **Access control (MVP)** — any authenticated member of the workspace can call the export + history endpoints. No role-gate for now; PROJ-4 role-based-access work will layer on top when it ships. Cross-workspace isolation via `X-Workspace-Id` + `workspace_id` queryset filter (same as every other publish route) is the only boundary for MVP.
- [ ] AC-122: **Marketplace subset filter — out of scope for MVP.** Rationale: the Listing + `DesignProductConfig.products_config[i].marketplaces[]` already encode exactly which marketplaces are enabled per product. The export takes this as source of truth — no extra filter UI needed. Users who want a one-off subset edit the exported XLSX manually or toggle the marketplace in the Listing config before re-exporting. Documented here so architecture/QA don't re-raise it.

#### Displate Tab Completion (added 2026-04-24)

- [ ] AC-123: `Listing` model gets one more Displate-only field:
  - `background_color_hex` (CharField max_length=7, blank=True, default='') — must match regex `^#[0-9A-Fa-f]{6}$` when non-empty. Serializer-gated: only persisted when `marketplace_type == 'displate'`. Migration backfills existing rows with `''`.
- [ ] AC-124: Displate listings ALSO use the `keywords` + `type_flags` JSONFields from AC-81 (same schema-gate widened from "global-only" to "global-or-displate"). `color_mode` stays Global-only (Basic-template field). AC-82's validator updated: `keywords`/`type_flags` allowed on `global|displate`; `color_mode` allowed only on `global`; `background_color_hex` allowed only on `displate`.
- [ ] AC-125: Displate-tab UI replaces the "Configuration for Displate coming soon" placeholder with:
  - Title + Description per language (same `ListingFieldsSection` subset as Global — no Brand, no Bullets)
  - `KeywordsChipField` per language (AC-84/85 reused — same 50-char counter)
  - Options section at the bottom: **Types** checkboxes (Men/Women/Youth — reuses Global's) + **Background Color (Hex)** MUI `colorful`/`HexColorPicker` with a preview swatch + "#RRGGBB" text input. NO `color_mode` radio (that's Global-only).
  - NO Products/Fit/Print/Colors/Marketplaces&Prices (MBA-only sections).
  - NO AI Improve button (same scoping rule as Global — AC-45).
- [ ] AC-126: Displate listing is lazy-created (same rule as Global per AC-108). First PATCH on any Displate-tab field upserts `Listing(design, marketplace_type='displate')`.
- [ ] AC-127: MBA XLSX export — column BN (`Background Color (Hex)`) is populated from `displate_listing.background_color_hex` when a Displate listing exists for the design AND the hex is non-empty. Otherwise empty. Applied per exported row regardless of which MBA product the row represents (one design = one Background Color). Per Excel_HELP.txt "MBA template covers Displate" — no separate Displate XLSX template is shipped in MVP.

#### Keyword Research Deeplinks (added 2026-04-24)

- [ ] AC-128: `KeywordResearchLinks` component renders below the Keywords chip field on Global + Displate tabs:
  - **"KW Finder"** — text button, `SearchOutlined` 14px icon, `COLORS.cyan` color. Click navigates to `/niches/research?niche=<active-niche-id>&context=keywords`. If the design has no niche FK → button disabled with tooltip `"Link a niche to the design first"`.
  - **"KW Workbench"** — text button, `WorkspacesOutlined` 14px icon, `text.disabled` color. Disabled for MVP with tooltip `"Coming soon — ships with PROJ-10 Keyword Bank"`. Rendered but not clickable (renders even when disabled so the UI-layout matches the FlyingUpload reference).
- [ ] AC-129: The separator between the two buttons is a literal pipe character `|` with `text.disabled` color (matches the FlyingUpload screenshot). Buttons are visually small (caption-sized), not CTA-weighted.

#### Advanced Options Modal (added 2026-04-24)

- [ ] AC-130: `AdvancedOptionsDialog` component — opens from an `"Advanced Options"` text link top-right on the Global + Displate tabs (next to the Tagging Options button).
- [ ] AC-131: Dialog body contains (MVP scope):
  - **Brand** (TextField, single value, max 50 chars, optional). Written to `listing.brand_name` on blur. On export, used to fill every `Brand DE/FR/IT/ES/JP/EN` cell in the MBA XLSX (AC-93 rule unchanged — single-value duplicated into all 6 cells). Not written to the Basic template (Basic has no brand column).
  - **Category** (TextField, single value, free-text, max 200 chars, optional). Written to a new top-level `listing.category` field (CharField max_length=200, blank=True, default=''). Used to fill the MBA XLSX `Category` column (BM). Not on Displate tab (Displate XLSX has no Category column in our MBA-hybrid export).
- [ ] AC-132: Dialog has `Save` + `Cancel` buttons. Save fires a batched PATCH `{brand_name, category}` on the active tab's Listing (Global or Displate), then closes. Cancel discards input (no PATCH). The modal uses the mount-on-open pattern (consistent with Publish/Save-as-Template dialogs).
- [ ] AC-133: The MBA tab ALREADY exposes `brand_name` as a main-form field (not in Advanced); Advanced Options does NOT render on MBA (MBA has no "rare fields" surface yet). If a future round adds MBA-scoped rare fields, Advanced Options can be enabled on MBA too.

#### Tagging Options Menu (added 2026-04-24)

- [ ] AC-134: `TaggingOptionsMenu` component — opens from a `"Tagging Options"` button top-right on the Global + Displate tabs (MUI Menu anchored to the button). Disabled on MBA (MBA has no keywords field). Menu items:
  - **Copy EN keywords to all languages** — copies `keywords.en` into every other language's `keywords[lang]`. Overwrites existing entries after a confirm dialog `"Overwrite keywords for DE/FR/IT/ES/JA?"`. Triggers one PATCH per destination language (or a single bulk PATCH of the whole `keywords` object — implementation choice; behaviour is same).
  - **Clear all keywords** — sets `keywords[lang] = []` for every language. Confirm dialog `"Clear keywords for all languages?"`.
  - **Import keywords from CSV** — opens a paste dialog with a textarea. Parses input as either comma-separated (single line) OR newline-separated (multi line) OR mixed. Each entry is trimmed, de-duplicated case-insensitively against existing entries, and appended to the ACTIVE language's `keywords[activeLang]`. Rejects entries that would exceed the 50-char total (AC-85) with a count-of-rejected warning in the snackbar (e.g. `"4 of 10 keywords imported — 6 skipped (would exceed 50-char limit)"`).
- [ ] AC-135: All three bulk actions respect AC-110 (no comma / semicolon in keyword values) — the Import-CSV parser splits on those delimiters, so individual entries cannot contain them by construction. The Copy-EN-to-all action is additive per language (the target languages get EN's exact values; source is untouched).

#### CSV Export (added 2026-04-24)

- [ ] AC-136: `POST /api/publish/export/flyingupload/` endpoint accepts `"format": "xlsx" | "csv"` in the body (default `xlsx`). When `format="csv"`:
  - **No ZIP wrap, no image bundling.** Response is a single `.csv` file streamed with `Content-Type: text/csv; charset=utf-8` and `Content-Disposition: attachment; filename="flyingupload-<template>-<YYYY-MM-DD>.csv"`.
  - UTF-8 with BOM (`\xef\xbb\xbf` prefix — Excel-compatible).
  - RFC 4180 quoted-CSV: every cell double-quoted; embedded `"` becomes `""`; newlines inside descriptions stay quoted (legal per spec).
  - Column set **identical** to the XLSX for the given `template` (66 for MBA including gap columns B/W/BK which become empty CSV fields; 9 for Basic). Header row + data rows.
  - `Image Path` column is just the bare `file_name` (no `designs/` prefix — since there's no ZIP / subfolder) — caller downloads designs separately if they need them.
- [ ] AC-137: New command palette action `Export as CSV` (column 1, category EXPORT). Enabled with the same selection-≥-1 rule as the XLSX actions. Confirmed via same `ExportPreflightDialog` (preflight endpoint also takes a `format` field and returns the same summary shape — the shape is format-agnostic).
- [ ] AC-138: `ExportLog.archive_size_bytes` renames to the more generic `output_size_bytes` and applies to both XLSX-ZIP and CSV outputs. `ExportLog` gets a new `format` CharField choices `[xlsx, csv]` default `xlsx` so the History drawer can distinguish (chip label shows "MBA · XLSX" / "MBA · CSV" / "Basic · XLSX" / "Basic · CSV").

#### Edit-View Export Trigger (added 2026-04-24)

- [ ] AC-139: Edit-View's existing `useCommandPalette` hook registers the same three export actions (`Export as XLSX (MBA)`, `Export as XLSX (Basic)`, `Export as CSV`) with scope = the current `?designs=<ids>` URL parameter. All three require at least one design in the URL (the view has an empty-state otherwise). The preflight + download flow is identical to the Publish-View path (same dialog component, same endpoints, same error handling).

#### History Re-run (added 2026-04-24)

- [ ] AC-140: `ExportHistoryDrawer` rows expose a **Re-run** `IconButton` (`ReplayOutlined`) on hover. Click:
  1. Open `ExportPreflightDialog` with `design_ids = log.design_ids` + `template = log.template` + `format = log.format`.
  2. Preflight endpoint runs the same validation — so deleted designs / changed listings show as `skipped` per the standard rules.
  3. On confirm → same download endpoint, writes a fresh `ExportLog` row (no deduplication with the original log row; each re-run is a distinct event).
  4. If every design in the log has been deleted → preflight returns `ready_rows: 0` + preflight dialog disables the download button (same rule as AC-111).

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| ~~POST~~ | ~~`/api/ideas/{id}/listing/generate/`~~ | — | **REMOVED 2026-04-22** — replaced by `ai-improve` |
| POST | `/api/listings/{id}/ai-improve/` | Member | AI improve/generate listing (AC-69) |
| GET | `/api/ideas/{id}/listing/` | Member | Get listing |
| PATCH | `/api/listings/{id}/` | Member | Edit listing (used by auto-save) |
| POST | `/api/listings/{id}/translate/` | Member | AI translate listing |
| ~~POST~~ | ~~`/api/listings/{id}/tm-check/`~~ | — | **REMOVED 2026-04-22** — future separate feature |
| GET | `/api/listings/{id}/export/` | Member | Export MBA format |
| GET | `/api/mba/product-catalog/` | Member | MBA product catalog (icons, colors, prices, royalty) |
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
| POST | `/api/publish/export/flyingupload/preflight/` | Member | Preflight summary (rows, skipped, warnings) — accepts `format: xlsx\|csv` (AC-91, AC-137) |
| POST | `/api/publish/export/flyingupload/` | Member | Generate + stream export output — `.zip` for XLSX (AC-90) or `.csv` for CSV (AC-136); `template=mba\|basic`, `format=xlsx\|csv` |
| GET | `/api/publish/export/history/` | Member | Last 50 ExportLog rows for the active workspace (AC-115) |
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
- "← Back to Collection" ghost button + "[+ Add Designs]" outlined + **"[✨ AI Improve]" IconButton (top-right)** + "[Shortcut Guide]" text button + manual "Save" button (flushes pending PATCHes, shows spinner/check)

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

> **Per-product scope (decided 2026-04-22):** Fit Type + Print + Colors + Marketplaces & Prices are all scoped to the **currently focused product** from the Products scroller. Switching product = these 4 sections re-render with that product's `products_config[i]` entry. Section headers show "Config for active product: {label}".

**Products (MBA):** Horizontal scroll, product type cards 72px wide, **product-shaped SVG icon 40px** (custom `PRODUCT_ICON_MAP` per AC-78; 17 components like `TShirtIcon`, `HoodiePulloverIcon`, `PopSocketIcon`, etc. — NOT generic hangers). `caption` label. Count badge (18px pill, `COLORS.cyan` bg) showing number of enabled marketplaces for that product. Selected: `alpha(COLORS.cyan, 0.06)` bg, `COLORS.cyan` border + glow. Focused (= currently editing): 2px ring. Thin scrollbar 3px.

**Fit Type + Print (per-product):** 2-col grid. Checkboxes `secondary.main` (cyan). Radio `primary.main` (coral). Hidden/disabled when catalog entry for the focused product does not include `fit_types` / `print_side` in its `supports` array (e.g., PopSocket, Mug have no fit types).

**Colors (per-product):** Flex wrap, circles 36px, full border-radius. Selected: `COLORS.cyan` border + glow `alpha(COLORS.cyan, 0.30)` + `scale(1.1)`. Checkmark inside (white on dark colors, ink on light). **Palette source (updated 2026-04-22):** loaded from the focused product's `colors_options` in `GET /api/mba/product-catalog/` (AC-37). Per-product palette — different products can expose different palettes.

**Marketplaces & Prices (per-product):** 1-col list (or 2-col on wide screens). Per row: Checkbox + marketplace label `caption` + currency code + price input (32px, `COLORS.inkElevated` bg, 96px wide, right-aligned) + **live Royalty** display (`caption`, green if positive, amber if ≤ 0). Royalty recomputed on every price keystroke (debounced 100ms for UI update). Formula from catalog: `price × coef − base`. Empty price → Royalty = "—".

**Language Tabs:** Flag + code chips. Active: `alpha(COLORS.cyan, 0.10)` bg, `COLORS.cyan` color, 1px `alpha(COLORS.cyan, 0.20)` border. Auto Translate Switch `secondary.main`. "Translate to All" Select dropdown.

**Listing Fields (shared pattern):**
- Label `subtitle2` + InfoOutlined 14px + "Options ⊙" right-aligned
- TextField outlined, bg `COLORS.inkElevated`, radius 8px, `body2` font
- Char counter `caption`: normal `text.disabled`, ≥90% `COLORS.warningDk`, 100% `error.main`. Transition `DURATION.fast`
- Per-field "Improve" hover-icon (opens PROJ-17 Chat): `opacity 0→1` on field hover, AutoFixHighOutlined 16px `COLORS.cyan` — orthogonal to the header's central AI Improve button (AC-72)
- Layout: Brand+Title 2-col, Bullet 1+Bullet 2 2-col, Description full-width, **Keyword Context** full-width multiline (4 rows, 500-char counter)

**Options Tab (bottom):** MUI Tabs, 2px `COLORS.red` indicator. Availability + Publish radio groups. **Trademarks tab REMOVED 2026-04-22** — future separate feature, no TM UI in Edit page.

**Unsaved-Changes Banner (auto-save UX):** sticky top, amber bg, shows while any field is dirty OR any PATCH in-flight. Contains "Discard" (revert optimistic changes, confirm dialog) and "Save" (manual flush) buttons. On all-saved → slides up, "Saved ✓" toast for 2s.

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
- [ ] EC-5: ~~TM Check finds flagged term~~ **REMOVED 2026-04-22** — TM Check feature deferred to future separate PROJ.
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
- [ ] EC-31: AI Improve called on a Listing without a linked design → 400 "AI Improve requires a linked design asset" + snackbar. Button should already be disabled per AC-71, but defensive guard handles edge (e.g., design deleted between page load and click).
- [ ] EC-32: AI Improve returns text exceeding field max length → server truncates at max and flags `truncated_fields: [...]`. Frontend shows inline warning chip per truncated field. User can retry or edit manually.
- [ ] EC-33: AI Improve LLM call fails (OpenRouter 5xx, timeout, rate-limit) → Listing fields NOT updated (server only writes on full success), snackbar "AI Improve failed — {reason}", button re-enabled for retry. User's existing text preserved.
- [ ] EC-34: MBA Product Catalog endpoint returns 5xx or times out → frontend falls back to cached catalog response (stale-while-error). If no cache exists (first load ever), Edit page shows error state "Product catalog unavailable — retry". Product scroller empty.
- [ ] EC-35: Migration from legacy `DesignProductConfig` (separate `fit_types`/`colors`/`product_types`/`marketplaces` fields) → per-product `products_config` — legacy rows are collapsed: for each `product_type` in legacy `product_types[]`, a `products_config` entry is created with the shared legacy values. Documented as lossy (users re-differentiate per-product post-migration).
- [ ] EC-36: User focuses a product whose `products_config` entry does not yet exist (newly added to catalog, or first-time toggle) → frontend creates a new entry client-side with defaults from the catalog (`colors: []`, `fit_types: []`, `marketplaces: [from default_prices]`) and fires immediate PATCH to persist.
- [ ] EC-37: User clicks a product in the Products scroller that is currently `enabled=false` → toggles `enabled=true`, focuses it, panels render with its config. Click again on an already-focused + enabled product → toggles `enabled=false`, focus moves to next enabled product (or clears focus if none).
- [ ] EC-38: Auto-save text field PATCH races with a control-type PATCH on the same listing → last-write-wins on the server (matches AC-43 semantics). Frontend serializes its PATCHes per (listing_id) via a mutation queue to avoid local races.
- [ ] EC-39: User edits text, switches marketplace tab before blurring → pending blur fires on tab switch (via `beforeunload`-style flush) and PATCHes to the ORIGINAL marketplace_type's Listing. Then new tab's Listing loads cleanly.
- [ ] EC-40: Royalty formula returns negative value (price below break-even) → Royalty cell shows red "− $1.23" (negative royalty) + icon tooltip "Price below MBA break-even". Field still saves (user may be exploring pricing).
- [ ] EC-41: AI Improve character limit on response — LLM occasionally returns 260-char bullets or 65-char titles. Server truncates WITHOUT re-prompting (LLM retry loop postponed post-MVP). User sees chip warning + can re-run for variation.
- [ ] EC-42: `keyword_context` PATCH does not trigger `status` revert to `draft` — unlike other text fields, this is AI-input only. Server serializer allows `keyword_context` updates without status transition.

### Global Tab + FlyingUpload Export (added 2026-04-24)

- [ ] EC-43: User tries to save `keywords` / `type_flags` / `color_mode` on an MBA or Displate listing via a crafted PATCH → serializer returns 400 "This field is only allowed on Global listings." Field is never persisted. Backfilled rows on existing MBA listings stay at `{}` / `[]` / `''`.
- [ ] EC-44: User adds a keyword that — together with existing chips — would exceed the 50-char limit (`join(', ')` length). Chip input rejects the commit with a shake animation + inline "Limit reached" hint. No PATCH fires. (AC-85)
- [ ] EC-45: User exports MBA XLSX with designs that only have a Global listing (no MBA listing yet). Preflight flags each such design with reason `no_listing`. The row is NOT emitted. User can click "Edit {{n}}" in the preflight dialog to open the missing MBA listings in Edit.
- [ ] EC-46: User exports Basic XLSX with designs whose Global listing is missing. Preflight flags `no_global_listing`. Row omitted. The preflight's "Edit" shortcut opens `/publish/edit?designs=<id>` with the Global tab pre-activated so the user can fill Title/Description/Keywords.
- [ ] EC-47: User exports MBA XLSX for a design that has a listing but 0 enabled products in `DesignProductConfig.products_config`. Preflight flags `no_enabled_products`. Row omitted. Click "Edit" takes the user to Edit with MBA tab active so they can enable at least one product.
- [ ] EC-48: Design's active product uses a catalog key that is NOT in `FLYINGUPLOAD_PRODUCT_MAP` (e.g. new catalog entry added to MBA that FlyingUpload doesn't support). Row is omitted + preflight warning: `"Product '<key>' not supported by FlyingUpload — row skipped"`.
- [ ] EC-49: Product has `colors[].length > 10`. First 10 are written to `Color1..Color10`. Preflight warning: `"Design {{file_name}} has {{n}} colors; only the first 10 fit the FlyingUpload template."`.
- [ ] EC-50: Product has `print_side='both'`. Exported as `'front'` (Excel v2.3 only accepts `front`/`back`) + preflight warning `"Print side 'both' — exported as 'front' (FlyingUpload limitation)"`.
- [ ] EC-51: Language translation missing for a given `lang` → title/description/bullet columns for that language are written as empty strings. No warning (translations are opt-in per language). Tags columns for that language are empty if `global_listing.keywords[lang]` is missing.
- [ ] EC-52: User has `ja` locale content but the FlyingUpload Excel uses `JP`. Language-code mapping table `LANG_MAP = {'en':'EN','de':'DE','fr':'FR','it':'IT','es':'ES','ja':'JP'}` applied in both MBA + Basic export paths.
- [ ] EC-53: User submits an export with a `design_id` that belongs to a different workspace → backend responds 404 (never 403 — prevents ID enumeration, consistent with every other publish route). Preflight endpoint also returns 404 for cross-workspace ids.
- [ ] EC-54: Export request with 500+ designs → backend caps at 500 per request and returns preflight warning `"Only the first 500 designs were exported; re-run with the remainder selected."`. Prevents runaway memory on huge folders.
- [ ] EC-55: `Listing.publish_mode` is `'draft'` → `Draft` column = `'yes'`. `'live'` → empty. No other truthy value is valid (enum). Language-specific drafts are NOT tracked (FlyingUpload has one Draft column, not per-language).
- [ ] EC-56: File copy preserves the FlyingUpload v2.3 template stub exactly — gap columns B/W/BK MUST remain empty. Backend unit test opens a generated fixture and asserts `ws.cell(row=1, column=2).value is None` (and columns 23, 63).
- [ ] EC-57: User's Global listing has no Keywords at all (empty `{}`) but MBA export runs. MBA's `Tags DE/FR/IT/ES/JP/EN` columns are all empty. Preflight warning: `"No keywords set on Global listing — Tags columns will be empty"`. Row still emits.
- [ ] EC-58: Design's `file_url` points to a file that no longer exists in storage (deleted / moved / permission revoked) → design added to `preflight.skipped` with `reason: 'image_unavailable'`. Row omitted from XLSX. Archive still generates successfully if at least one other design's image is available; otherwise 400 `"no_images_available"`.
- [ ] EC-59: Two selected designs share the same `file_name` (e.g. both called `color-design.png`) → AC-106 suffix rule applies. Archive contains `designs/color-design-44231e97.png` and `designs/color-design-80752f2d.png`; both XLSX `Image Path` cells are consistent.
- [ ] EC-60: Design's `file_url` is an absolute URL pointing off-server (legacy import) → service HTTP-fetches the binary once (2-second timeout, 10 MB size cap). On failure → `image_unavailable`. On success → binary is streamed into the ZIP as if it were a local asset. No persistent cache for now.
- [ ] EC-61: User selects 750 designs → backend returns 400 `"max_500_designs_per_export"` on both preflight and download endpoints. Frontend surfaces the error with a `"Reduce selection to 500 or fewer"` snackbar before any archive is touched.
- [ ] EC-62: User selection's estimated ZIP size > 500 MB → backend returns 400 `"estimated_archive_too_large"` with a `breakdown` listing the top-10 designs by `file_size`. Frontend offers an "Exclude over-sized designs" quick action that unselects them and re-triggers preflight.
- [ ] EC-63: User pastes a comma-containing string into the Keywords chip input (e.g. pastes `dog, cat, bird` into the pending buffer). The input splits on commas at commit time (3 chips added: `dog`, `cat`, `bird`). User typing a comma manually commits the buffer. The single-chip-with-comma case is impossible (AC-110).
- [ ] EC-64: `Listing.convert()` from MBA to an existing Global listing that already has `keywords`/`type_flags`/`color_mode` set → existing Global values are PRESERVED (AC-109). Only Title/Description/Bullets are overwritten. User sees the same G3 overwrite confirmation as today; the new fields are NOT mentioned in the confirm copy because they survive the convert untouched.
- [ ] EC-65: Concurrent keyword edits on the same Global listing from two browser tabs → last-write-wins (same as EC-14). No optimistic locking. Since keywords are full-list replaces (PATCH sends the entire array for the active language), the later tab's last-typed state completely overwrites the earlier tab's — acknowledged trade-off; ETag/version check remains post-MVP recommendation.
- [ ] EC-66: Title/Description from our Listing exceeds Excel cell character limit (32,767 chars — unlikely but possible for Description 2000 and below). Since Excel's own limit is well above our field limits, no truncation needed; just document the safety margin. Any future raise of our Description limit must stay < 32,767.
- [ ] EC-67: Client disconnects mid-download while the ZIP is still streaming — server still writes the `ExportLog` row (AC-116) because the generation completed successfully. User sees the log entry on re-open but no ZIP arrived. Acknowledged: history row is the "server generated this" audit, not "client received this." Documented in the drawer tooltip.
- [ ] EC-68: Design referenced in an `ExportLog.design_ids` is later deleted. The log row stays (denormalized IDs are kept as-is). The drawer tooltip shows "<deleted> (N designs)" for deleted IDs when the user hovers. No fetch-time join — log is a snapshot of what was exported at that moment.
- [ ] EC-69: A user with 2 workspaces exports from Workspace A, then switches to Workspace B via the topbar selector — the History drawer re-queries and shows ONLY Workspace B's logs. Workspace A's logs are not visible until the user switches back. Same isolation rule as every other publish query (via Round 5 cache reset).
- [ ] EC-70: Two users in the same workspace export the same 3 designs within a minute — both logs appear in the drawer with distinct timestamps and creator avatars. No deduplication (each export is an intentional action; near-duplicates are informative, not a bug).

### Displate + Advanced Options + Tagging Options + CSV (added 2026-04-24)

- [ ] EC-71: User sets `background_color_hex` on Displate, then deletes the Displate listing → next MBA export leaves BN column empty (no error). If the listing is re-created with a different hex, next export reflects the new value.
- [ ] EC-72: User pastes an invalid hex like `red` or `#FFF` into Displate's color-picker → frontend validates client-side (rejects + shake), serializer backend-validates (400 "background_color_hex must match ^#[0-9A-Fa-f]{6}$"). Defense-in-depth.
- [ ] EC-73: KW Finder click when design has no niche FK → button disabled with tooltip `"Link a niche to the design first"`. No navigation. When user later links a niche (via PROJ-5 niche assignment), button becomes enabled on next render.
- [ ] EC-74: Advanced Options modal's Brand field conflicts with MBA-tab's main-form Brand. Rule: the MBA listing stores Brand on the MBA listing itself; Global/Displate listings store Brand separately (their own row). Convert Global→MBA copies Brand per AC-109. No cross-tab sync — users who want identical Brand across tabs use Convert or manually set it on each tab.
- [ ] EC-75: **Copy EN keywords to all languages** with empty EN → confirm dialog shows, user confirms, all languages get `[]`. No-op warning: `"EN has no keywords — all languages cleared"` (matches literal behaviour).
- [ ] EC-76: **Clear all keywords** → confirm dialog; on confirm, single PATCH sends `{keywords: {en: [], de: [], fr: [], it: [], es: [], ja: []}}` to the backend. Empty-dict merge on the backend retains the full shape (every lang present with empty array).
- [ ] EC-77: **Import keywords from CSV** paste contains mixed delimiters (newlines + commas + semicolons). Parser splits on all three, trims whitespace, drops empty strings, deduplicates against existing. User pastes `"dog, cat\nbird;fish"` → imports `[dog, cat, bird, fish]`.
- [ ] EC-78: Import-CSV paste that exceeds the 50-char total → only the entries that fit are added (parser greedy-fills up to 50 chars `join(', ').length`), rest rejected. Snackbar: `"4 of 7 keywords imported — 3 skipped (would exceed 50-char limit for EN)"`.
- [ ] EC-79: CSV export with a description that contains a literal `"` or newline — cell is RFC-4180 quoted (`"He said ""hi""\nand left"`). Excel / LibreOffice / Sheets all parse this correctly. Test fixture asserts the quoting.
- [ ] EC-80: CSV export's `Image Path` is bare `file_name` (no `designs/` prefix — no ZIP). User downloads images via the separate "Download" palette action if they need them; documented in the preflight dialog's info note for CSV format.
- [ ] EC-81: Edit-View export triggered with a single `?designs=<id>` → preflight runs exactly as Publish-View does. If that design has no listing/product config → `skipped` list with that single design. User sees the preflight dialog, can click "Edit 1" (navigates back to the same design's Edit View — so the "Edit" action becomes a no-op visually; frontend suppresses the Edit button when the design is already the only one in scope).
- [ ] EC-82: Re-run export from History for a log whose designs have ALL been deleted → preflight returns `ready_rows: 0` + skipped-list showing `<deleted>` labels. Preflight dialog disables the Download button and shows an explanatory message `"Every design from this export was deleted. Nothing to re-generate."`.
- [ ] EC-83: Re-run export that succeeds writes a fresh `ExportLog` row. History drawer re-renders to show both the original AND the re-run entries, ordered by `created_at DESC` — the re-run is at the top.
- [ ] EC-84: User opens the Advanced Options modal, types a Category, closes with Cancel → input is discarded. No PATCH fires, listing's `category` unchanged. This contrasts with the main-form fields which PATCH on blur — the modal's Save button is the only path to commit Advanced-Options changes.
- [ ] EC-85: Tagging Options `Copy EN → all languages` — if any destination language already has keywords, they are OVERWRITTEN (after confirm dialog). No merge strategy for MVP; documented as destructive. Snackbar confirms: `"EN keywords copied to 5 languages (existing entries replaced)"`.

## Dependencies

- PROJ-4 (Workspace & Membership)
- PROJ-8 (Idea & Slogan Generation — idea must exist)
- PROJ-9 (Design Generation — designs as input)
- ~~PROJ-10 (Keyword Bank)~~ **REMOVED 2026-04-22** — Keyword-Bank Integration aus Edit-Bereich entfernt. Zukünftige Wiederverbindung als eigenständiges Feature mit eigener PROJ-ID.
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

1. Select approved design → click central "AI Improve" icon → AI produces Brand, Title, Bullet 1, Bullet 2, Description. All fields within char limits (or flagged `truncated_fields`).
2. Pre-fill Bullet 1 with text from another design → click "AI Improve" → existing text is rewritten/improved (not re-generated from zero).
3. Hover over Title field → per-field "Improve" hover-icon opens PROJ-17 Chat with title context (orthogonal to central button).
4. Character counter turns amber at 90%, red at 100%.
5. Click "Translate to All" → DE/FR/IT/ES/JA tabs populated with Title + Bullet 1 + Bullet 2 + Description translations. `keyword_context` NOT translated.
6. Product scroller shows 17 product-shaped SVG icons (not hangers). Click T-Shirt → focus it → Fit / Print / Colors / Marketplace panels render T-Shirt's config.
7. Switch focus to Hoodie → panels re-render Hoodie's independent config (different colors, different prices, different fit types).
8. Enter price "19.99" on amazon.com for T-Shirt → Royalty column shows live computed value (e.g., "$2.95"). Enter price for amazon.de → EUR royalty computed independently.
9. Auto-save: click a Color swatch → immediate PATCH (no save button click needed). Type in Title field → blur → PATCH on blur if dirty. "Unsaved changes" banner shows during in-flight PATCHes.
10. Manual "Save" button flushes pending blur-pending text fields + shows spinner → "Saved ✓" on success.
11. Network offline → banner switches to "Offline — changes saved locally" + queue PATCHes → reconnect → auto-flush.
12. Save configuration as UploadTemplate → load on different design → settings applied per product.
13. Queue upload job → status shows "pending". Desktop App connected → status transitions to "uploading" → "completed" with ASIN.
14. Desktop App not connected → UI shows "Desktop App not connected" message. Jobs stay pending.
15. Batch create jobs for 5 designs → 5 jobs created, each trackable independently.
16. Upload fails → status=failed, error screenshot saved, retry available.
17. Import design from Google Drive → file appears in Design Gallery with thumbnail.
18. `Ctrl+K` → Command Palette opens → search "copy listing" → apply to selected designs.
19. Product Lifecycle: Niche → Slogan → Design → Listing → ASIN → shows full chain.
20. "Copy for MBA" → formatted listing text in clipboard (Brand, Title, Bullet 1, Bullet 2, Description — no TM check).
21. Workspace isolation: listings/designs from other workspaces → 403.

### Global Tab + FlyingUpload Export (added 2026-04-24)
22. Open Edit view for a design → Global tab → fields Title / Description / Keywords / Types / Color render. Add 3 keywords via Enter → chips appear, counter updates (e.g. 24/50). PATCH fires on commit, `Listing(global).keywords.en = [...]` persists.
23. Switch active language EN→DE on Global tab → Keywords field resets to the DE keyword list (empty on a fresh listing). Typing adds to DE only; EN list unchanged on backend.
24. Global-tab save: brand-name field hidden, AI Improve hidden, Products/Fit/Colors/Pricing sections hidden. Options section shows Types (Men/Women/Youth checkboxes) + Color (Black/White/Colorful radio).
25. MBA tab: Keywords field NOT rendered (Global-only). `keyword_context` 500-char field unchanged.
26. API: `PATCH /api/listings/<mba-listing-id>/ {keywords: {en: ['x']}}` → 400 "only allowed on Global listings".
27. Select 3 designs → command palette → "Export as XLSX (MBA)" → preflight dialog opens: `N rows generated, M skipped, K warnings` breakdown visible with design filenames.
28. Confirm download → browser saves `flyingupload-mba-2026-04-24.zip`. Unzip → root contains `flyingupload-mba-2026-04-24.xlsx` + `designs/` folder with every referenced design file. Open XLSX in Excel → Sheet name `Flying Upload POD`, row 1 = 66 headers including empty B/W/BK, each selected design's enabled products each produce one row. `Image Path` cells read `designs/<filename>` (relative, point into the same archive). Open FlyingUpload Desktop → it resolves every image.
29. Export MBA for a design with no MBA listing → preflight shows `reason: no_listing` for that design + "Edit 1" action → clicking opens `/publish/edit?designs=<id>` with MBA tab active.
30. Export Basic XLSX for same selection → 9-column workbook, Title DE/EN + Desc DE/EN + Tags DE/EN + Type + Color columns populated from Global listing only. Designs with missing Global listing → preflight `reason: no_global_listing`.
31. Cross-workspace export attempt: submit `design_ids=['<foreign-uuid>']` with my `X-Workspace-Id` → backend returns 404 on both preflight and download endpoints.
32. Product `both` print side → exported row has `Print='front'` + preflight warning surfaces the downgrade.
33. Export 2 designs that share the same `file_name` (both `color-design.png`) → ZIP contains `designs/color-design-44231e97.png` + `designs/color-design-80752f2d.png`. Both XLSX `Image Path` cells use the disambiguated names.
34. Open Global tab on a fresh design (no Global listing yet) → fields render empty. Type a Title → blur → PATCH upserts Global listing with `marketplace_type='global'`. MBA listing on the same design is untouched.
35. Type keyword `dog, funny` on Global Keywords field → the comma commits the chip early: two chips `dog` + `funny` land in the list (no comma-contaminated chip). AC-110 + EC-63 verified.
36. Convert Global → MBA on a design with Global keywords set → new MBA listing has Title/Description but NOT keywords (`GET /api/ideas/<id>/listing/?marketplace_type=mba` returns no `keywords` field; AC-87 gate hides it from serializer output). Global listing's keywords are unchanged.
37. Select 750 designs → Publish command palette → Export XLSX (MBA) → 400 `max_500_designs_per_export` surfaces as snackbar before any archive generation starts.
38. After a successful export, open the **Export History** drawer from the Publish toolbar (`HistoryOutlined` icon) → the just-finished export appears at top with correct template chip, filename, design count, row count, creator avatar, relative time "just now".
39. Failed exports (400 / 413 / 500) do NOT produce a History row → verified by triggering the 500-cap export (EC-61) and confirming the drawer shows no new entry.
40. Switch workspace via the topbar selector → History drawer re-queries and shows only the new workspace's exports. Switch back → original workspace's exports reappear (EC-69).
41. Open the **Displate tab** on a fresh design → placeholder gone; Title/Desc/Keywords/Types/Background-Color-picker render. Pick `#FF00AA` via color-picker + type a Title → blur → PATCH upserts Displate listing. MBA + Global listings untouched.
42. Export MBA XLSX for a design that has a Displate listing with `background_color_hex='#FF00AA'` → XLSX column BN is populated with `#FF00AA` on every MBA row for that design (AC-127).
43. Click **KW Finder** on Global tab → new tab / route `/niches/research?niche=<id>&context=keywords` opens pre-filtered by the design's niche. Click **KW Workbench** → nothing happens; hover shows tooltip "Coming soon — ships with PROJ-10 Keyword Bank".
44. Open **Advanced Options** modal → fill Brand + Category → Save → PATCH fires; dialog closes. Re-open → fields persist. Cancel instead of Save → input discarded, listing unchanged (EC-84).
45. **Tagging Options → Copy EN to all languages** → confirm → every other language's keywords now equals EN's. Snackbar confirms the overwrite. **Import CSV** with `"dog, cat\nbird;fish"` → 4 chips appear (EC-77). **Clear all keywords** → confirm → every language array is `[]`.
46. **Export as CSV (MBA)** via command palette → single `.csv` downloaded (no ZIP). Open in Excel → UTF-8 BOM correctly detected, 66 columns including the 3 empty gap columns, every cell quoted per RFC 4180. Image Path column shows bare filenames, no `designs/` prefix.
47. Open Edit View with `?designs=<id>` → command palette (`⌘K`) shows the 3 export actions. Trigger one → preflight dialog runs exactly as on Publish-View. For a single design, the preflight's "Edit 1" button is suppressed since we're already on that design's Edit View (EC-81).
48. Click **Re-run** on a History-drawer row → preflight opens with the log's `design_ids + template + format` prefilled. Confirm → fresh export generates, new log row appears at the top. If every design in the original log was deleted, Re-run's preflight shows `ready_rows: 0` and disables the download button (EC-82).

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
│   │   ├── ProductTypeScroller.tsx    # REBUILD: 20 custom SVG icons + per-product focus state
│   │   ├── ColorGrid.tsx             # REBUILD: palette from focused product's colors_options
│   │   ├── MarketplacePricing.tsx     # REBUILD: per-focused-product price + LIVE royalty column
│   │   ├── ListingField.tsx           # REBUILD: char counter + PROJ-17 Chat hover + auto-save on-blur
│   │   ├── KeywordContextField.tsx    # NEW 2026-04-22: 500-char multiline textarea (replaces KeywordChipsField)
│   │   ├── AIImproveButton.tsx        # NEW 2026-04-22: central header IconButton → POST /ai-improve/
│   │   ├── UnsavedChangesBanner.tsx   # NEW 2026-04-22: sticky banner + Save/Discard
│   │   ├── TranslationTabs.tsx        # REBUILD: flag tabs + Auto Translate
│   │   ├── OptionsButton.tsx          # NEW: "Options ⊙" → opens Command Palette filtered
│   │   └── SectionHeader.tsx          # NEW: shared section header with title + info + Options ⊙
│   ├── ~~TMCheckDialog.tsx~~          # DELETED 2026-04-22: TM check removed from Edit page
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
├── ProductIcons/                       # NEW 2026-04-22: 20 custom MBA product SVG icons
│   ├── TShirtIcon.tsx / TShirtPremiumIcon.tsx / TShirtHeavyweightIcon.tsx
│   ├── VNeckIcon.tsx / TankTopIcon.tsx / LongSleeveIcon.tsx / RaglanIcon.tsx
│   ├── SweatshirtIcon.tsx / HoodiePulloverIcon.tsx / HoodieZipIcon.tsx
│   ├── PerformanceIcon.tsx / BaseballIcon.tsx / TruckerHatIcon.tsx
│   ├── PopSocketIcon.tsx / PhoneCaseIcon.tsx / ThrowPillowIcon.tsx
│   ├── ToteBagIcon.tsx / TumblerIcon.tsx / MugIcon.tsx / WaterBottleIcon.tsx
│   └── index.ts                        # exports PRODUCT_ICON_MAP: Record<icon_key, FC<IconProps>>

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
+-- productConfig    ← RTK Query keyed on (activeDesignId, activeMarketplace)
+-- productCatalog   ← RTK Query GET /api/mba/product-catalog/ (cached, stable)
+-- focusedProduct   ← local state: which product_type is currently edited
+-- controlSetters   ← IMMEDIATE PATCH (checkbox/radio/switch/color/product toggle)
+-- priceSetters     ← 400ms-debounced PATCH (avoid keystroke storm on "19.99")
+-- textSetters      ← on-blur-if-dirty PATCH (Brand / Title / Bullets / Desc / Keyword Context)
+-- manualSave       ← flush all pending blur-pending + show "Saved ✓"
+-- aiImprove        ← POST /api/listings/{id}/ai-improve/ → apply response to fields
+-- applyCopy        ← POST /product-config/copy-from/ instead of local state copy
+-- royaltyCompute   ← pure client function: (price, product, marketplace) → royalty
```

### B) Data Model (plain language)

New model `DesignProductConfig` lives in `publish_app`. Sibling of `Listing` — both hang off a `DesignAsset`, keyed by `(design, marketplace_type)`.

**Updated 2026-04-22** — `fit_types` / `print_side` / `colors` / `marketplaces` / `product_types` collapsed into a single `products_config` JSONField (per-product shape). See AC-38 for the new JSON schema.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID pk | |
| `design` | FK → DesignAsset | `on_delete=CASCADE` (EC-11) |
| `marketplace_type` | Choices `[global, mba, displate]` | default `mba`, same enum as Listing |
| `products_config` | JSONField list | **NEW 2026-04-22**: per-product config objects — each contains `product_type`, `enabled`, `fit_types`, `print_side`, `colors`, `marketplaces`. See AC-38 for exact shape. Replaces legacy flat fields. |
| `created_at`, `updated_at` | DateTime | |

**Unique constraint:** `(design, marketplace_type)` — one row per pair. Upsert on PATCH.

**Server-side validation:** `products_config[*].product_type` ∈ catalog keys (AC-37); `fit_types[]` / `colors[]` / `marketplaces[*].marketplace` are subsets of the matching catalog entry's `*_options` arrays; `marketplaces[*].price` ≥ 0 decimal.

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
| `products_config[*]` validated against MBA product catalog (AC-37) | Prevents drift between frontend catalog and stored data. Rejects unknown product/color/fit/marketplace keys with 400. |
| Per-product JSON shape (not separate FK tables) | Simpler single-row upsert; no N+1 on load. Products list is bounded (~20 entries max per row), well within JSON-field query performance. |
| Auto-save Hybrid (immediate controls / on-blur text) replaces blanket 1200ms debounce | Controls are single-click atomic intent (no "mid-change" state). Text fields benefit from debounce; on-blur is the natural commit point and avoids firing on every keystroke. Matches screenshot UX expectations (Flying Upload). |
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

## Tech Design Addendum — Edit-Page Rewrite (added 2026-04-23)

> Scope: AC-1 rewrite, AC-37 catalog, AC-38 restructure, AC-69 to AC-80 (AI Improve, Auto-Save, Product SVG Icons). Supersedes: AC-6, AC-10, AC-34. Requires data migration on two tables.

### A) Component Structure — Edit Page (refactored shell)

```
EditView
+-- Header
|   +-- Marketplace Tabs  (Global / Mba / Displate)
|   +-- AI Improve IconButton        ← NEW (calls /ai-improve/)
|   +-- Save Button                  ← NEW (manual flush + Saved indicator)
+-- UnsavedChangesBanner             ← NEW (sticky top, Save/Discard, offline state)
+-- ThumbnailStrip  (unchanged)
+-- Scrollable Form
|   +-- ProductTypeScroller          ← REBUILD: 17 product-shaped SVG icons, focus state
|   +-- [Per-focused-product panels]
|   |   +-- FitTypePrintSection      ← REBUILD: per-product, hidden when catalog disallows
|   |   +-- ColorGrid                ← REBUILD: palette from focused product's catalog entry
|   |   +-- MarketplacePricing       ← REBUILD: per-product row list + LIVE royalty column
|   +-- Language Tabs + Auto Translate
|   +-- ListingFields
|       +-- Brand / Title (auto-save on blur)
|       +-- Bullet 1 / Bullet 2 (auto-save on blur — no Bullet 3/4/5)
|       +-- Description (auto-save on blur)
|       +-- KeywordContextField      ← NEW (500-char textarea, AI input only)
|   +-- Options Tab (bottom)         ← Trademarks tab DELETED
+-- Design Preview (sticky, unchanged)
```

### B) Data Model — Migrations (plain language)

**Three tables touched.** All migrations run in a single migration set per app for atomicity. Target: one Django migration file per change category.

**B1 — Listing Model (shrink + rename)**

| Change | Rationale | Risk |
|--------|-----------|------|
| Drop columns `bullet_3`, `bullet_4`, `bullet_5` | Bullets 3–5 never used in UI or AI flow. Data present = spec drift | Existing data in these columns lost (acceptable — spec was never implemented in prod) |
| Rename column `backend_keywords` → `keyword_context` | Field is AI input only, not Amazon backend search terms. Old name misled consumers | Zero — Django rename migration preserves data |
| Rewrite `translations` JSONField shape | Legacy shape `{lang: {title, bullets: [...]}}` → new shape `{lang: {title, bullet_1, bullet_2, description}}` | Data migration must truncate legacy `bullets` array to first 2 elements |
| Drop `is_template=True` rows with `bullet_3..5` data? | No — template rows also lose bullets 3–5 (same truncation behavior) | Consistent with listings |

**B2 — DesignProductConfig Model (flat → per-product)**

| Change | Rationale | Risk |
|--------|-----------|------|
| Drop columns `product_types`, `fit_types`, `print_side`, `colors`, `marketplaces` | Replaced by single `products_config` JSON list (see AC-38) | Lossy data migration — see below |
| Add column `products_config` (JSONField default=list) | Per-product config entries | None |
| Data migration: for each legacy row, expand `product_types[]` into `products_config` entries, copying shared `fit_types`/`print_side`/`colors`/`marketplaces` into EACH entry | Users re-differentiate per-product after migration. Acceptable — product config is rarely finalized before this rewrite ships | EC-35 documents the lossy behavior |
| Server-side validation adds catalog-referential integrity check | Prevents drift between frontend catalog and stored data | Migration-time check: only product_types in the catalog are migrated; unknown keys dropped + logged |

**B3 — UploadTemplate Model (OPEN DECISION, see open items)**

| Option | Pros | Cons |
|--------|------|------|
| A: Migrate UploadTemplate to same per-product shape | Consistent with DesignProductConfig; single mental model | Migration + tests; Template UI (future) rebuilt |
| B: Keep UploadTemplate flat; Convert seeding fans out flat → per-product | Zero template migration | Two shapes in codebase; seeding logic duplicates per-product fan-out |
| C: Deprecate UploadTemplate (defer post-MVP) | Simplest | Loses auto-apply feature for now |

> **Recommendation:** Option A. Rationale: UploadTemplate and DesignProductConfig share their data model by design (template seeds a config). Two shapes create permanent debt. Migration effort is linear with DesignProductConfig — do both together.

### C) MBA Product Catalog — Storage & Service

The catalog (AC-37) describes all ~17 MBA products: which controls each product supports, color palette per product, default prices per marketplace, royalty formula per marketplace.

**Storage options considered:**

| Option | Pros | Cons | Chosen? |
|--------|------|------|---------|
| Python constant in module | Zero migration; easy diff in git; no DB round-trip | Requires backend deploy to change | ✅ Chosen |
| Django model seeded via migration | Editable via admin | Over-engineered for bounded, rarely-changing data; schema complexity | ✗ |
| JSON file on disk | Editable without deploy | Adds file I/O; harder to review changes | ✗ |

**Location:** `publish_app/catalogs/mba_catalog.py` — a single module exporting `MBA_PRODUCT_CATALOG` (a Python tuple of product-entry dicts). Serializer flattens to JSON response. View adds a long `Cache-Control` header (24h) so the frontend caches aggressively. Updates ship as a code change + deploy.

**Catalog Entry Shape (per AC-37):**

| Field | Type | Notes |
|-------|------|-------|
| `key` | string | Stable product identifier (`t_shirt`, `hoodie_pullover`, etc.) |
| `label` | string | Display name (i18n-resolved on server using request `Accept-Language`) |
| `icon_key` | string | Maps to frontend `PRODUCT_ICON_MAP` — NOT a URL |
| `supports` | list[string] | Which control sections render (`fit_types`, `print_side`, `colors`) |
| `fit_types_options` | list[string] | Available fit types for this product (empty for accessories) |
| `print_side_options` | list[string] | Available print sides for this product |
| `colors_options` | list[{key, name, hex}] | Per-product color palette |
| `marketplaces` | list[string] | Amazon marketplaces this product ships on |
| `default_prices` | dict[marketplace: decimal] | Default retail price per marketplace |
| `royalty_formula` | dict[marketplace: {coef, base}] | Royalty = `price × coef − base` per marketplace |

**Validation Role:** Any `DesignProductConfig.products_config` entry is server-validated against this catalog on PATCH. Unknown product keys / color keys / fit types / marketplaces → 400 with per-field errors.

### D) AI-Improve Service

Replaces the removed AC-6 (`/listing/generate/`). Single endpoint handles both "generate from empty" and "improve existing" — the LLM prompt varies only in how much text it receives as input.

**Service layout:** `publish_app/services/ai_improve.py` with 4 pure functions plus the DRF view in `publish_app/api/views.py`.

| Function | Responsibility |
|----------|----------------|
| `build_prompt(listing, design, keyword_context, language)` | Assemble system + user messages for LLM. Includes vision image URL + existing text + keyword hints |
| `call_llm(messages)` | Invoke OpenRouter (via existing client). Uses vision-capable model (e.g., `anthropic/claude-3.5-sonnet` or configured via env `AI_IMPROVE_MODEL`) |
| `validate_and_truncate(response_dict)` | Parse LLM JSON reply. Truncate each field at serializer max_length. Return `(fields, truncated_field_keys)` |
| `apply_to_listing(listing, fields)` | PATCH Listing via serializer (same validation as manual edit). Updates `generated_by='ai'` and reverts status to `draft` |

**Request / Response (AC-69):**

| Direction | Shape |
|-----------|-------|
| Request | `POST /api/listings/{id}/ai-improve/` — no body required |
| Response 200 | `{ listing: {...full serialized...}, truncated_fields: [] }` |
| Response 400 | `{ error: "AI Improve requires a linked design asset" }` (EC-31) |
| Response 429 | Rate limit (10/min/user — DRF UserRateThrottle scoped to this view) |
| Response 502 | LLM upstream failed — listing unchanged (EC-33) |

**Error Behavior:** The Listing is NEVER partially written. Either all 5 fields apply (after truncation) or the call is a no-op. Truncation is NOT an error — the frontend receives the list of truncated field keys and surfaces per-field warning chips (AC-70).

**Rate-limit placement:** DRF `UserRateThrottle` subclass `AIImproveThrottle` with `rate='10/min'` and `scope='ai_improve'`. Settings entry added.

**Env vars:**
- `AI_IMPROVE_MODEL` (default: `anthropic/claude-3.5-sonnet`)
- `AI_IMPROVE_TIMEOUT_SECONDS` (default: `60`)
- Existing `OPENROUTER_API_KEY` reused.

**Removed counterparts:**
- `publish_app/services/listing_generator.py` — delete module (unused after AC-6 removal)
- `publish_app/services/tm_checker.py` — delete module (unused after AC-10 removal)
- Corresponding views + URL routes + tests deleted.

### E) Auto-Save Trigger Matrix

Single source of truth for how every editable control reaches the backend. Lives in `useEditView` hook as three setter factories.

| Control Type | Examples | Trigger | Debounce | Endpoint |
|--------------|----------|---------|----------|----------|
| Binary toggle | Checkbox (Fit Type, Marketplace enabled), Radio (Print Side, Availability, Publish Mode), Switch (Auto Translate), Product on/off | **Immediate** — on `onChange` | None | Matches owner (Listing PATCH or DesignProductConfig PATCH) |
| Visual selection | Color Swatch, Product focus-click | **Immediate** | None | DesignProductConfig PATCH |
| Numeric input | Price input per marketplace | **Debounced** | 400 ms idle | DesignProductConfig PATCH (targeted `op: 'upsert_product'`) |
| Free text | Brand, Title, Bullet 1, Bullet 2, Description, Keyword Context | **On Blur (dirty only)** | N/A | Listing PATCH (partial — only changed fields) |
| Command invocation | AI Improve button, Save button, Translate-to-All button | **Immediate** | None | Dedicated endpoints |

**Save button behavior (AC-74):** Flushes every pending `on blur` field (forces blur on focused field) + waits for all in-flight PATCHes → shows "Saved ✓" for 2s OR error state.

**Offline handling (AC-77):** `navigator.onLine` + PATCH network errors → queue mutations client-side in a ref (non-persistent for MVP). `online` event → replay queue in order. Banner shifts from amber "Unsaved changes" to orange "Offline — changes will save on reconnect".

**Failure rollback (AC-76):** On 4xx/5xx, RTK Query's `onQueryStarted` optimistic patch is reverted. Error snackbar names the field. Banner flips to red "Save failed — Retry".

**Concurrency (EC-38, EC-14):** Frontend serializes PATCHes per `(listing_id)` and per `(design_id, marketplace_type)` via a promise chain in the hook. Server keeps last-write-wins semantics.

### F) Frontend Component Structure (refactor, not new tree)

Changes to existing `views/publish/partials/editor/`:

| File | Action | Reason |
|------|--------|--------|
| `ProductTypeScroller.tsx` | Refactor | Per-product focus state, SVG icon map |
| `ColorGrid.tsx` | Refactor | Palette source = focused product's catalog entry |
| `MarketplacePricing.tsx` | Refactor | Per-product row list + live royalty column |
| `FitTypePrintSection.tsx` | Refactor | Hidden when catalog says unsupported |
| `ListingField.tsx` | Refactor | On-blur-if-dirty PATCH, keep per-field Chat hover |
| `KeywordChipsField.tsx` | **Delete** | Replaced |
| `KeywordContextField.tsx` | **New** | Plain 500-char textarea |
| `AIImproveButton.tsx` | **New** | Header icon button + spinner + truncation warnings |
| `UnsavedChangesBanner.tsx` | **New** | Sticky banner + Save/Discard/Offline state |
| `TMCheckDialog.tsx` | **Delete** | Feature removed |

New module `components/ProductIcons/` (AC-78): 20 SVG components + barrel export with `PRODUCT_ICON_MAP`. Shared globally (PROJ-13 Desktop App can reuse via shared package).

New hook shape (AC-43 updated): `useEditView` exports 3 setter factories (`controlSetters`, `priceSetters`, `textSetters`) + `royaltyCompute` pure function + `aiImprove` mutation + `manualSave` flush.

### G) Tech Decisions

| Decision | Why |
|----------|-----|
| Python constant for MBA catalog (not DB model) | Bounded, rarely-changing data. Diffs reviewed in git. No admin UI needed. Deploy-to-change is acceptable at current Amazon update cadence |
| Single `products_config` JSON (not separate FK table) | ~20 product entries max per row — well under JSON performance limits. One-row upsert is simpler than N+1 on load. Per-product queries rare (config is always loaded whole) |
| Migrate UploadTemplate to same shape | Consistency over minimal diff. Two shapes = permanent code debt |
| AI-Improve as single endpoint (generate + improve unified) | Same LLM call, same prompt scaffold. Splitting makes the prompt diverge and confuses users |
| Truncate AI output server-side, never re-prompt | Simpler contract. User re-runs for variation. Retry loops are expensive + rarely necessary |
| Rate-limit AI-Improve at 10/min/user | Cost protection. OpenRouter vision calls are ~10× non-vision price |
| Auto-save hybrid (immediate controls / on-blur text) | Matches screenshot UX expectations. Blanket debounce creates weird "did it save?" feeling on toggles |
| Offline queue non-persistent for MVP | Persistence adds storage management complexity. Acknowledged trade-off: offline tab reload = dirty state lost |
| 20 custom SVG icons as React components (not sprite sheet) | Tree-shakable per product (PRODUCT_ICON_MAP exports). Themeable via `currentColor`. Matches existing app icon style (Iconoir/Tabler) |
| Delete removed services outright (no dead code) | `listing_generator.py`, `tm_checker.py`, `KeywordChipsField.tsx`, `TMCheckDialog.tsx` — removal is atomic with AC changes |

### H) Infrastructure Changes

| Change | Where |
|--------|-------|
| Migration: Listing drop bullets 3–5, rename backend_keywords, rewrite translations JSON | `publish_app/migrations/` |
| Migration: DesignProductConfig collapse fields into products_config + data migration | `publish_app/migrations/` |
| Migration: UploadTemplate collapse fields → per-product shape (Option A) | `publish_app/migrations/` |
| New catalog module `catalogs/mba_catalog.py` | `publish_app/catalogs/` |
| New service `services/ai_improve.py` | `publish_app/services/` |
| Delete service `services/listing_generator.py` | `publish_app/services/` |
| Delete service `services/tm_checker.py` | `publish_app/services/` |
| New view + URL for `/ai-improve/` | `publish_app/api/views.py` + `urls.py` |
| New view + URL for `/mba/product-catalog/` | `publish_app/api/views.py` + `urls.py` |
| Delete view + URL for `/listing/generate/` | `publish_app/api/views.py` + `urls.py` |
| Delete view + URL for `/tm-check/` | `publish_app/api/views.py` + `urls.py` |
| Env vars: `AI_IMPROVE_MODEL`, `AI_IMPROVE_TIMEOUT_SECONDS` | `django-app/.env.template` |
| DRF throttle class `AIImproveThrottle` | `publish_app/api/throttles.py` |
| i18n keys cleanup (tm_*, kw_finder_*, bullet_3..5 removed; keyword_context, ai_improve_* added) | `frontend-ui/src/i18n/locales/*.json` |

### I) New Packages

None. All dependencies already installed (OpenRouter client, DRF throttle machinery, MUI icons).

---



> The 2026-04-22 edit round (this block) **invalidates prior PASS status**. All ACs touched below require fresh implementation + QA before this section returns to PASS.

**New ACs added (AC-69 to AC-80):** AI Improve endpoint + button (AC-69 to AC-72), Auto-save UX matrix (AC-73 to AC-77), Product SVG icons + catalog rendering (AC-78 to AC-80). None implemented yet.

**Modified ACs:** AC-1 (Listing bullets 5→2 + rename backend_keywords → keyword_context), AC-37 (colors endpoint → product catalog endpoint), AC-38 (DesignProductConfig flat fields → per-product `products_config`), AC-39/40/41/43/44 (product-config API + frontend contract follow). Needs migration + re-test.

**Removed ACs:** AC-6 (generate endpoint), AC-10 (tm-check endpoint), AC-34 (keyword chips). Backing code (`TMCheckDialog`, `KeywordChipsField`, `services/tm_checker.py`, generate view/route) must be deleted.

**Migration impacts:**
- `Listing` table: drop `bullet_3`, `bullet_4`, `bullet_5`; rename `backend_keywords` → `keyword_context`; rewrite `translations` JSON shape.
- `DesignProductConfig` table: collapse 5 fields into single `products_config` JSON; data migration lossy (per AC-38, EC-35).
- `UploadTemplate` table: follow DesignProductConfig shape change if it stores matching fields — **DECISION NEEDED** whether `UploadTemplate.colors/fit_types/product_types/marketplaces` also restructure, or whether templates stay in legacy shape and seed logic expands to per-product fan-out.
- Tests: AC-1/AC-6/AC-10/AC-34 tests removed; new tests for AC-69–AC-80 required.

**Frontend impacts:**
- 17 new SVG icon components under `components/ProductIcons/`.
- `ProductTypeScroller`, `ColorGrid`, `MarketplacePricing`, `FitTypePrintSection` rebuilt for per-product focus.
- `useEditView` hook: replace single debounced setter with control/price/text setter matrix.
- `ListingField` component: remove chip/finder logic, add on-blur-if-dirty PATCH.
- i18n keys: `backend_keywords` → `keyword_context`, `ai_generate_listing` → `ai_improve_listing`, all `tm_*` keys removed, all 5 `bullet_*` keys reduced to `bullet_1` + `bullet_2`.

---

## Tech Design Addendum — Global Tab + FlyingUpload Export (added 2026-04-24)

> Scope: AC-81 to AC-140 + EC-43 to EC-85, all of User Stories 42–67. Two tightly coupled features delivered together: (1) Global-tab + Displate-tab completion unlocks the per-language Keywords + Background Color data the export relies on; (2) FlyingUpload Export packages that data into FlyingUpload-Desktop-compatible `.zip` bundles (XLSX + images) or CSV for external analysis.

### A) Component Structure

#### Backend — `publish_app/`

```
publish_app/
├── models.py
│   ├── Listing (EXTEND — 5 new top-level fields)
│   └── ExportLog (NEW — append-only export audit)
├── api/
│   ├── serializers.py
│   │   ├── ListingUpdateSerializer (EXTEND — per-field serializer gates)
│   │   ├── ExportPreflightSerializer (NEW)
│   │   ├── ExportRequestSerializer (NEW)
│   │   └── ExportLogSerializer (NEW)
│   ├── views.py
│   │   ├── FlyingUploadExportView (NEW — streams ZIP or CSV)
│   │   ├── FlyingUploadPreflightView (NEW — summary-only)
│   │   └── ExportHistoryListView (NEW — last 50)
│   └── urls.py (3 new routes)
├── catalogs/
│   ├── flyingupload_mba_template.xlsx (NEW — byte-exact FlyingUpload v2.3 MBA stub)
│   ├── flyingupload_basic_template.xlsx (NEW — byte-exact v2.3 Basic stub)
│   └── flyingupload_maps.py (NEW — LANG_MAP, MARKETPLACE_MAP, FLYINGUPLOAD_PRODUCT_MAP, FIT_TYPE_MAP)
├── services/
│   └── flyingupload_export.py (NEW — pure functions, orchestrates workbook + image bundling + ZIP packaging)
├── migrations/
│   ├── 00XX_listing_extend_global_displate_fields.py
│   └── 00XX_exportlog.py
└── tests/
    ├── test_listing_schema_gates.py (NEW — serializer gates per field)
    ├── test_flyingupload_export_mba.py (NEW — fan-out, column mapping, ZIP structure)
    ├── test_flyingupload_export_basic.py (NEW — 9-col mapping)
    ├── test_flyingupload_export_csv.py (NEW — RFC 4180, UTF-8 BOM)
    ├── test_flyingupload_preflight.py (NEW — skipped/warnings shape)
    ├── test_flyingupload_guards.py (NEW — 500-cap, size-cap, image-unavailable)
    └── test_export_history.py (NEW — append-only, workspace-isolated, re-run)
```

#### Frontend — `frontend-ui/src/views/publish/`

```
views/publish/
├── partials/
│   ├── edit/
│   │   ├── GlobalTabContent.tsx (NEW — composite for Global tab listing fields)
│   │   ├── DisplateTabContent.tsx (NEW — composite for Displate tab)
│   │   ├── KeywordsChipField.tsx (NEW — MUI Autocomplete freeSolo + 50-char counter)
│   │   ├── TypeColorOptions.tsx (NEW — Types checkboxes + Color radio for Global)
│   │   ├── BackgroundColorPicker.tsx (NEW — Displate-only hex picker)
│   │   ├── KeywordResearchLinks.tsx (NEW — KW Finder + KW Workbench buttons)
│   │   ├── TaggingOptionsMenu.tsx (NEW — Copy EN / Clear / Import CSV)
│   │   ├── AdvancedOptionsDialog.tsx (NEW — Brand + Category modal)
│   │   └── ImportKeywordsCsvDialog.tsx (NEW — paste-dialog with parse preview)
│   └── toolbar/
│       ├── ExportPreflightDialog.tsx (NEW — shows ready_rows + skipped + warnings + Download)
│       ├── ExportHistoryDrawer.tsx (NEW — last 50 rows + Re-run icon)
│       └── ExportHistoryRow.tsx (NEW — single row with avatar + meta + re-run handler)
├── hooks/
│   ├── useEditView.ts (EXTEND — expose Global/Displate tab state + new setter factories)
│   ├── useEditFormState.ts (EXTEND — `keywordsSetters`, `colorModeSetter`, `bgHexSetter`, `categorySetter`)
│   └── useExport.ts (NEW — preflight + download + re-run + snackbar wiring)
├── views/
│   └── EditView.tsx (EXTEND — render Global/Displate/MBA conditionally per activeMarketplace)
└── tests/
    ├── GlobalTabContent.test.tsx (NEW)
    ├── DisplateTabContent.test.tsx (NEW)
    ├── KeywordsChipField.test.tsx (NEW)
    ├── TaggingOptionsMenu.test.tsx (NEW)
    ├── AdvancedOptionsDialog.test.tsx (NEW)
    ├── ExportPreflightDialog.test.tsx (NEW)
    ├── ExportHistoryDrawer.test.tsx (NEW)
    └── useExport.test.ts (NEW)

store/
└── publishSlice.ts (EXTEND — 3 new endpoints: previewExport, runExport, listExportHistory)
```

### B) Data Model

#### Listing — 5 new top-level fields

| Field | Type | Allowed on | Purpose |
|-------|------|------------|---------|
| `keywords` | JSON dict `{lang: [str, ...]}` | global, displate | Per-language Amazon Search Terms / chip-edited keyword list |
| `type_flags` | JSON list `[str, ...]` | global, displate | Men/Women/Youth multi-select (Basic+Displate) |
| `color_mode` | string `black`\|`white`\|`colorful` | global only | Single-value color classification (Basic export) |
| `background_color_hex` | string `#RRGGBB` | displate only | Displate background color (MBA export BN col) |
| `category` | string (max 200) | mba, global | Amazon browse category (MBA export BM col) |

All fields default empty. Migration backfills every existing row with the empty default. Per-field serializer gates reject writes on non-allowed marketplace tabs (AC-82). Model-level `clean()` is **NOT** used — gates live at the API boundary so the Django admin stays unconstrained for ops-debug workflows.

#### ExportLog — new append-only model

| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID pk | |
| `workspace` | FK Workspace | isolation |
| `created_by` | FK User | auditing + avatar display |
| `template` | string `mba`\|`basic` | which FlyingUpload template |
| `format` | string `xlsx`\|`csv` | output format |
| `design_ids` | JSON list of UUIDs | denormalized (survives design deletion — EC-68) |
| `design_count` | int | pre-fan-out selection size |
| `row_count` | int | post-fan-out XLSX row count (equals design_count for Basic + CSV) |
| `filename` | string (max 200) | as served in Content-Disposition |
| `output_size_bytes` | BigInteger | ZIP/CSV byte size |
| `created_at` | DateTime | DB index on `(workspace, -created_at)` |

Append-only: no UPDATE, no DELETE (except via Django admin). Row is written at the END of a successful export (AC-116).

### C) API Endpoints

| Method | Path | Behavior |
|--------|------|----------|
| POST | `/api/publish/export/flyingupload/preflight/` | Body: `{template, design_ids[], collection_id?, format}`. Returns summary `{total_designs, ready_rows, skipped: [{design_id, file_name, reason}], warnings: [{design_id, message}]}`. No side effects. |
| POST | `/api/publish/export/flyingupload/` | Same body + `format: xlsx\|csv`. Streams ZIP (xlsx) or plain CSV. Writes ExportLog on success. |
| GET | `/api/publish/export/history/` | Returns last 50 ExportLog rows for caller's workspace, ordered newest-first. Paginated. |

### D) Tech Decisions

| Decision | Why |
|----------|-----|
| Keywords stored as top-level `Listing.keywords` JSON dict `{lang: [str]}`, not nested under `translations[lang]` | Translations are per-field (title/bullet/desc); keywords are a per-language ARRAY — different shape. Keeping them top-level simplifies validation + DB-level queries. |
| Per-field serializer gates (not model.clean()) | Admin + ORM stay unconstrained for ops. Gates live at the API boundary where the marketplace_type context is known. |
| ZIP archive with `designs/` subfolder + relative paths in Excel `Image Path` column | FlyingUpload Desktop reads local file paths; `https://` URLs don't work. Archive = one-download-everything; user unzips + opens → it just works. |
| `zipfile.STORED` for images, `DEFLATED` for XLSX | PNG/JPEG are already compressed; STORED avoids re-compression overhead. XLSX is plain XML + DEFLATED. |
| openpyxl template-stub approach (v2.3 byte-exact stub in git) | Preserves gap columns B/W/BK + header styling + column widths without hand-reconstruction. Upgrades are a PR event with diff review. |
| 500-design hard cap + 500 MB size cap | Prevents OOM on shared Django workers. Estimate happens at preflight; hard-cap check also at download time (defense in depth). |
| `SpooledTemporaryFile` spillover above 100 MB | Keeps small exports in RAM; large exports spill to disk. Bounded RAM without forcing disk IO for common case. |
| ExportLog append-only, no archive cache | Avoids storage-lifecycle complexity. Re-run = fresh generation. Metadata-only audit is enough for the "avoid duplicate exports" user need (US-57). |
| Re-run from History = re-preflight + re-download | No special backend path; the endpoint is the same. Guarantees re-run respects current data state (e.g. listings deleted since original export). |
| Lazy-create Listing for Global/Displate (upsert on first PATCH) | Consistent with existing MBA pattern. Avoids empty DB rows when user merely browses tabs. |
| Advanced Options as MODAL not expand-section | Brand + Category are rare-use; keeping them behind a button keeps the main form focused on the common-case copy. Aligns with FlyingUpload's own UX. |
| `react-colorful` for hex picker | 2 KB gzipped, zero deps, treeshakable. Alternative `@uiw/react-color` is 14 KB and we don't need its palette features. |
| Keywords backed by MUI Autocomplete freeSolo + multiple | Built-in chip rendering, keyboard commit, delete icon. No custom component needed. Comma-as-separator is standard MUI behaviour; we additionally strip mid-buffer commas client-side (AC-110). |
| CSV export is plain `.csv`, no ZIP wrap, no images | FlyingUpload only reads XLSX; CSV targets external analysis tools (Sheets/Excel/Zapier). User downloads images separately via existing Download action if needed. |
| Re-using the existing `ExportPreflightDialog` for Edit-View exports | Single component; `useCommandPalette` registers the same actions with a different `design_ids` source (URL params instead of selection state). No logic duplication. |
| Single `translate/` endpoint (existing AC-9) NOT extended for keywords | Translations are title/bullet/desc — rich copy. Keywords are short tokenized search terms with different localization patterns (Amazon DE vs EN). Copy-EN-to-All (AC-134) is the MVP manual path. |

### E) Infrastructure Changes

| Change | Where |
|--------|-------|
| Migration `listing_extend_global_displate_fields` | `publish_app/migrations/` — adds 5 fields with empty defaults |
| Migration `exportlog` | `publish_app/migrations/` — new model + `(workspace, -created_at)` index |
| Template stub files | `publish_app/catalogs/flyingupload_mba_template.xlsx`, `flyingupload_basic_template.xlsx` — byte-exact copies of FlyingUpload v2.3 templates, committed to git |
| New catalog module | `publish_app/catalogs/flyingupload_maps.py` — mapping tables (LANG, MARKETPLACE, PRODUCT, FIT_TYPE) |
| New service module | `publish_app/services/flyingupload_export.py` |
| URL registration | `publish_app/api/urls.py` — 3 new routes |
| Frontend route | no new route; all dialogs/drawers are anchored to existing `/publish` + `/publish/edit` |
| i18n keys | `frontend-ui/public/locales/{en,de,es,fr,it}/translation.json` — new `publish.edit.global.*`, `publish.edit.displate.*`, `publish.export.*`, `publish.edit.tagging.*`, `publish.edit.advanced.*` branches |
| Env vars | None — uses existing `DEFAULT_FILE_STORAGE` for image fetching; no new OpenRouter keys; no new OAuth scopes |

### F) New Packages

**Backend:** None — openpyxl + zipfile (stdlib) + Django storage already present.

**Frontend:**
| Package | Purpose |
|---------|---------|
| `react-colorful` | 2 KB hex color picker for Displate `background_color_hex` (AC-125). Alternative `@uiw/react-color` rejected — 7× larger for features we don't need. |

### G) Migration / Data Risks

- **Zero data migration needed** for the 5 new Listing fields — all backfill to empty defaults; no existing row has non-empty data for any of them.
- **Zero data migration needed** for ExportLog — new table.
- **No breaking changes** to existing serializers — the new fields are additive; API responses for MBA listings will simply omit the new fields (per-field serializer gates hide them).
- **Backward compat** for the existing `Export as XLSX` / `Export as CSV` palette stubs — stubs are removed in favor of the new wired actions; no data exists to migrate (stubs never fired).
- **FlyingUpload v2.3 template stub commit** — reviewer should confirm the stub is byte-exact (openpyxl round-trip preserves gap columns + header styles) before ship. Automated test `test_flyingupload_export_mba.py::test_gap_columns_remain_empty` enforces this at CI time.

### H) Phased Build Order (mirrors task file phases R → X)

1. **Phase R — Backend schema** (1 PR): Listing field extension, per-field gates, migration, tests.
2. **Phase S — Backend export service** (1 PR): flyingupload_export.py + template stubs + mapping module + unit tests.
3. **Phase T — Backend ExportLog + endpoints** (1 PR): 3 views + urls + history endpoint + integration tests.
4. **Phase U — Frontend Global tab UI** (1 PR): KeywordsChipField + TypeColorOptions + KeywordResearchLinks + GlobalTabContent + TaggingOptionsMenu + AdvancedOptionsDialog.
5. **Phase V — Frontend Displate tab UI** (1 PR, parallel to U): DisplateTabContent + BackgroundColorPicker + wired via same patterns as Global.
6. **Phase W — Frontend Export UX** (1 PR): publishSlice endpoints + useExport + ExportPreflightDialog + command palette wiring + ExportHistoryDrawer.
7. **Phase X — Cross-cutting** (1 PR): i18n keys + full-suite tests + lint + QA smoke test + /deploy handoff.

Phases R/S/T are backend-only (can run in parallel with frontend phases U/V if the RTK mock layer is stubbed). Phase W depends on T being deployed (real preflight endpoint). Phase X is always last.

---

## QA Report — 2026-04-19 (STALE — see 2026-04-22 block above)

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

---

## QA Report Addendum — 2026-04-23 (Phase O–Q3, Edit-Page Rewrite)

### Scope
Phases I–Q3 of the 2026-04-22 Edit-Page rewrite round. Supersedes the 2026-04-22 "invalidates prior PASS" block and the 2026-04-19 / 2026-04-21 QA blocks for the touched ACs. Covers AC-1 (Listing shrink + rename), AC-37/38/39/40/41/43/44 (product catalog + per-product config), AC-48 (template body shape), AC-64 (AI-Improve endpoint — now `/ai-improve/`), AC-69–AC-80 (AI Improve + auto-save + product SVG icons), plus the removed ACs (AC-6, AC-10, AC-34).

### Summary
PASS. Lint clean, typecheck clean, frontend suite 1005/1005 green across 116 files. Backend publish-side tests ran green per-phase during Phases I–M (test_listing_serializer 13, test_listing_translations_migration, test_design_product_config J4, test_upload_template K4, test_mba_product_catalog 9, test_ai_improve 40 + test_views::TestListingAIImproveView 4 + 429 throttle). No P0/P1 bugs against PROJ-11 scope. Workspace-isolation posture unchanged (every new view still gates on `_get_workspace_id` + 404-on-cross-workspace).

### Test totals (this round)
- Frontend full suite: **1005/1005** tests green across 116 files (`npx vitest run`).
- Frontend lint: clean (2 pre-existing `EditorCanvas.tsx` warnings — unrelated to PROJ-11, unchanged from 2026-04-19 baseline).
- Frontend typecheck: `tsc --noEmit` clean.
- Backend publish-side: green per-phase during Phases I–M; an aggregate `pytest publish_app` run is deferred to the `/backend` agent per the Q3 split (Q3 backend checkboxes marked "not run — backend-side Q belongs to `/backend`"). Previous baseline: 241/241 at 2026-04-21 (Phase H).
- i18n parity: en authoritative; de/es/fr/it fall back via `defaultValue` for new `publish.edit.*` / `publish.ai_improve.*` keys (same policy as prior publish rounds; translation sweep deferred to post-MVP).

### AC coverage delta (vs 2026-04-22 "invalidates prior PASS")
- AC-1 (Listing shrink + rename): covered by `test_listing_serializer.py` (13 tests) + `test_listing_translations_migration.py` + `TestListingUpdateView.test_keyword_context_patch_does_not_revert_status` (EC-42). PASS.
- AC-37 (product catalog endpoint): covered by `test_mba_product_catalog.py` (9 tests). Legacy `/api/mba/colors/` kept as deprecated alias for one release. PASS.
- AC-38/39/40/41/43/44 (DesignProductConfig `products_config`): covered by Phase J4 test file rewrite + Phase L3 referential checks layered on top. PASS.
- AC-48 (Listing template body): covered by updated `test_listing_templates.py` (stale `backend_keywords` payload fixed → `keyword_context`). PASS.
- AC-64 replacement (AI-Improve): covered by `test_ai_improve.py` (40) + `TestListingAIImproveView` (4) + M5 throttle 429 test. PASS.
- AC-69–AC-72 (AI Improve button + endpoint + throttle + truncation chip): frontend AIImproveButton + `publish.ai_improve.*` i18n keys present; throttle 429 path tested. PASS.
- AC-73–AC-77 (auto-save UX matrix — controls-on-change, text-on-blur, offline queue, sticky banner, discard confirm): covered by Phase O3/O4 tests incl. `Offline queue: offline → 3 toggles → queue=3 → online → 3 PATCHes fire in order`. PASS.
- AC-78–AC-80 (product SVG icons + catalog-driven rendering): 17 icon components under `components/ProductIcons/`; `product_icon_map_keys.json` contract fixture locks icon-key ↔ catalog-key parity. PASS.
- Removed ACs (AC-6, AC-10, AC-34): code removed — `ListingGenerateView`, `ListingTMCheckView`, `services/listing_generator.py`, `services/tm_checker.py`, `TMCheckDialog.tsx`, `KeywordChipsField.tsx`, `schemas/listingSchema.ts`, command-palette `ai-generate` entry, `publish.tm.*` / `publish.edit.keywords.*` / `publish.command.aiGenerate` i18n keys. No dead references (verified during Q0 + Q1).

### Security spot-check (delta)
- New AI-Improve view gates on `IsAuthenticated` + workspace ownership of the target Listing (404 cross-workspace). Confirmed in `test_ai_improve.py` + `TestListingAIImproveView`.
- `AIImproveThrottle` (DRF UserRateThrottle subclass) enforced; 429 test in M5.
- DB-backed LLM config (`ListingImproveNodeConfig`) is Admin-only (mirrors `SloganNodeConfig` / `ResearchNodeConfig`); no public surface. OpenRouter key continues to come from env (not workflow JSON — PROJ-9 rotation policy preserved).
- No new raw-SQL, no new unvalidated `request.data`. Serializer validation layered: J2/K2 MVP-safe (shape/types/MBA colors/price ≥ 0) + L3 catalog-referential (product_type key, per-product fit_types/colors/marketplaces subsets).
- Cached `DesignAsset.vision_analysis` used by AI-Improve — payload contains no raw image URL in the improve call (vision image URL lives only in `ensure_design_vision`), so LLM prompt leak surface unchanged.

### Findings
- P1: **Edit Page crashes in browser on legacy-shaped `DesignProductConfig` rows.** Reproduced 2026-04-23 on design `80752f2d-030a-4dae-aa4a-a3b6c9805c18` (DB row has `products_config: [{'enabled': True, 'product_type': 't_shirt'}]` — pre-Phase-J2 shape, missing `marketplaces` / `fit_types` / `print_side` / `colors`). Two crash sites relied on non-optional array access despite the type system declaring the fields required:
  - `ProductTypeScroller.tsx:107` — `entry.marketplaces.filter(...)` — **fixed** to `(entry.marketplaces ?? []).filter(...)`.
  - `MarketplacePricing.tsx:170, 179` — `configEntry?.marketplaces.find(...)` — optional chain stopped at `configEntry`; **fixed** to `configEntry?.marketplaces?.find(...)`.
  Root cause is data integrity (legacy rows not normalized during Phase J2 restructure) + test coverage blind spot (unit tests rendered with well-shaped fixtures only; Vitest suite 1005/1005 green but the running app crashes on real legacy rows). No backend data migration shipped for pre-J2 rows — any workspace with pre-J2 configs still trips the remaining defensive fallbacks until the data is normalized or the serializer fills defaults on read.
- P2: **QA-report-addendum issued without smoke test.** The 2026-04-23 SHIP verdict (above) was signed off on the unit-test + lint + typecheck gates alone. Running the dev server and opening an Edit page on a real workspace would have caught the P1 immediately. Future QA rounds must include an in-browser smoke test before a SHIP verdict.
- P3: EC-14 (concurrent PATCH last-write-wins) still lacks dedicated regression test — carried over from 2026-04-19; low risk for MVP (single-editor UX); post-MVP ETag/version check remains the recommended mitigation.
- P3: Backend aggregate `pytest publish_app` not rerun at Q3 (deferred to `/backend` per the Q3 lint+test split). Per-phase green signals across I4, J4, K4, L4, M5 stand as the backend coverage evidence for this addendum.
- P3: Task-file Q1/Q2 notes document that the spec's proposed i18n key namespaces (`publish.tm_*`, `publish.bullet_3..5`, `publish.keyword_context.*`, `publish.unsaved_banner.*`, `publish.royalty.*`) were aspirational — shipped namespaces are functionally equivalent but more deeply nested under `publish.edit.*`. Non-functional drift; flagged for a future spec refresh pass.

### Known gaps (acknowledged, not blocking)
- EC-14 concurrent-edit regression test (P3, carried over).
- Backend aggregate `pytest publish_app` rerun (P3, deferred to `/backend`).
- de/es/fr/it translation sweep for new `publish.edit.*` / `publish.ai_improve.*` keys (post-MVP).

### Bugfix verification (Phase O–Q3 delta)
1. Listing `keyword_context` PATCH no longer reverts status to `draft` — verified by `TestListingUpdateView.test_keyword_context_patch_does_not_revert_status` (EC-42). `content_fields` set in `ListingUpdateView.patch` excludes `keyword_context`.
2. Legacy `translations.bullets` array → `bullet_1` + `bullet_2` migration is idempotent + truncates over 2 — verified by `test_listing_translations_migration.py` (promote / truncate / no-op / stale-key / non-dict cases).
3. Product-catalog referential checks (product_type key must exist; per-product fit_types/colors/marketplaces must be subsets of the catalog entry) enforced in both `DesignProductConfigSerializer` + `UploadTemplateSerializer` via shared helper (L3).
4. AI-Improve endpoint 429 surfacing — verified by M5 throttle test; frontend shows `publish.ai_improve.errorSnackbar` on 429 (same path as any other non-2xx per AIImproveButton error-handling).

### Verdict
**HOLD** (revised from SHIP 2026-04-23 after browser smoke test). Original SHIP verdict issued on unit-test + lint + typecheck only; in-browser repro surfaced a P1 crash on legacy `DesignProductConfig` rows. Hot-fix applied to both crash sites; residual data-integrity risk stays open until either (a) a one-shot data migration normalizes pre-Phase-J2 rows or (b) `DesignProductConfigSerializer` fills defaults on read. Status stays `In Review`; `/deploy` gated on the fix decision plus a follow-up smoke test round.

---

### Playwright Deep Test — 2026-04-23 (round 2, all features)

Tooling: `mcp__playwright__browser_*`. Test user: `qa_smoke@test.local` (admin in `Alte Mine Workspace`). Target design: `80752f2d-030a-4dae-aa4a-a3b6c9805c18` (`color-design.png`) with legacy Phase-J2 config row. Seeded test `Listing` (id `60f1a2c3-…`) + `Idea` + `Niche` + `vision_analysis` to enable AI-Improve path.

Full coverage run — 20 products × 7 marketplaces × all 6 listing fields + AI-Improve end-to-end:

| Scenario | Result | Evidence |
|----------|--------|----------|
| Edit page load on legacy config row | PASS | No crash (2026-04-23 hot-fix in place) |
| Workspace switch → API serves correct data | PASS (after fix) | `apiClient` interceptor now attaches `X-Workspace-Id` from Redux; `/product-config/` + `/gallery/` return Alte-Mine data |
| Activate all 20 products (click each card) | PASS | DB `products_config` grew to 20 entries, `enabled=true` for all |
| For each product: enable every catalog marketplace + set default_price | PASS | Counts match catalog: `t_shirt:7`, most shirts:`6`, performance/hat/popsocket/phone_case/tumbler/bottle:`1`, tote_bag+mug:`3` — total PATCH fan-out ≈ 90 upserts, all `200 OK` |
| Royalty live-calc | PASS | `amazon.com $19.99` → `Royalty: $2.96`, `amazon.co.jp ¥2580` → `Royalty: $276.00` (rendered per `royaltyFor`) |
| Text fields (brand, title, bullet_1, bullet_2, description, keyword_context) | PASS | Typed + blurred each; listing PATCH 200 per field; DB matches exactly |
| UnsavedChangesBar visible during edit | PASS (after fix) | Bar slides in with "Unsaved changes / Discard / Save" while text field dirty; disappears after blur-PATCH |
| AI-Improve end-to-end | PASS | `POST /api/listings/{id}/ai-improve/ → 200` in ~8s; title + bullets + description + keyword_context all rewritten by OpenRouter LLM. Example: `"Beer Lovers Tee — Blessed Mornings"` → `"Blessed Mornings Vintage Craft Beer Tee"` (60/60 chars) |
| Marketplace tab switch MBA ↔ Global | PASS | No crash; Global shows "Configuration for Global coming soon" placeholder (expected) |
| Reload persistence | PASS | All 20 products + all prices + all text fields + AI-improved content survive full page reload |
| Console errors | CLEAN | 0 JS errors for the full run |

Screenshots captured: `edit-with-banner.png`, `ai-improve-result.png`.

### Bugs found and fixed during this round

- **P1 — UnsavedChangesBar never triggered on text edits.** `useEditView.ts:165` read dirty state only from `listingForm.formState.isDirty`. Phase P migrated the 6 primary text fields off react-hook-form onto `editFormState.textSetters` (which has its own `isDirty` signal driven by `dirtyTextRef`/`pendingPricePatchRef`). Result: users typing into brand/title/bullet_*/description/keyword_context got PATCHes fired silently with no UI confirmation. **Fixed** in `useEditView.ts`: kept `isFormDirty = listingForm.formState.isDirty` as the auto-save trigger for RHF-tracked fields (availability/publish_mode/translations), and added `isDirty = isFormDirty || editFormState.isDirty` as the banner-visibility signal. Bar now slides in whenever any unsaved edit exists.
- **P1 (separate, filed against PROJ-4 — addressed here to unblock testing)** — `X-Workspace-Id` header was never sent. `apiClient` had only a 401-refresh interceptor; no request-side attach. Backend `_get_workspace_id` fell back to "first active membership" — users with >1 active memberships saw silently-wrong data regardless of the UI workspace switcher. **Fixed** in `services/authService.ts` with a new request interceptor that pulls `state.workspace.activeWorkspaceId` from the Redux store and attaches it as `X-Workspace-Id` on every axios call.
- **P1 (carried forward from first pass)** — legacy `DesignProductConfig` rows crashed `ProductTypeScroller.tsx:107` + `MarketplacePricing.tsx:170/179`. Defensive `?? []` / optional chain applied earlier in this session. Confirmed still green under today's load.

### Still-open items (non-blocking)

- **P2** — `UnsavedChangesBanner.tsx` (Phase O3) exists with the full 5-state machine (unsaved / saving / saved-toast / failed / offline + queued chip) but is not mounted anywhere in the app — only `UnsavedChangesBar.tsx` is rendered. Upgrading to the richer banner is a follow-up; current bar covers the headline "unsaved → save" flow.
- **P2** — Workspace switch resets on reload. `activeWorkspaceId` is Redux-only, not persisted to localStorage, so a hard reload re-picks `workspaces[0]` from `/api/workspaces/me/`. Fine-tuning belongs to PROJ-4.
- **P2** — RTK Query cache keys for workspace-scoped endpoints (e.g. `useGetProductConfigQuery`, `useGetListingQuery`) don't include workspace id, so a workspace switch serves stale cached responses until the user triggers a refetch. Follow-up in PROJ-4 / dedicated cache-invalidation pass on workspace change.
- **P3** — `ProductTypeScroller` card click always toggles `enabled` alongside focusing. Clicking an already-enabled card to focus it disables the product. UX surprise; likely wants a separate focus-only affordance.
- **P3 (carry-over)** — no data migration for pre-J2 legacy `products_config` rows; the defensive frontend keeps the app stable but normalization would let the types go back to non-optional.
- **P3 (carry-over)** — EC-14 concurrent-edit regression test, backend aggregate `pytest publish_app` rerun, de/es/fr/it translation sweep.

### Revised Verdict
**SHIP** (post-deep-test, 2026-04-23). PROJ-11 Edit Page works end-to-end with real data: 20 products, every catalog marketplace, every text field, AI-Improve live LLM call. Three real P1s were surfaced during the deep test; all three are fixed. Remaining P2s are scoped to PROJ-4 (workspace header/persistence/cache-invalidation) or the O3-banner upgrade — none block PROJ-11 ship. `features/INDEX.md` status stays `In Review`; `/deploy` is unblocked.

---

### Playwright Exhaustive Audit — 2026-04-23 (round 3, every control)

User feedback was that round-2 coverage was too shallow — round 3 covered every interactive control on Publish View + Edit View and every Command Palette entry, plus fit types, colors, print side, options, language tabs, and breadcrumb navigation.

New P1 bugs surfaced + fixed:

| Bug | Root cause | Fix |
|-----|-----------|-----|
| Collections breadcrumb stuck on "Home" after folder-open | `PublishView.tsx:88-92` had a hard-coded `[{ id: null, label: 'Home' }]` constant with comment `// For now, just show root`; `currentCollection` state was write-only (`const [, setCurrentCollection]`) | Wired `useListCollectionsQuery`, built segments by walking `parent` chain from the current collection up to root |
| Gallery `search=` query param silently ignored by backend | `DesignGalleryListView.get` never read `request.query_params.get('search')` | Added `Q(file_name__icontains) \| Q(tags__icontains)` filter |
| Language tabs (DE/FR/IT/ES/JA) **caused EN data loss** | `ListingFieldsSection.bind()` reads `listing[key]` directly; `activeLang` only flows to `TranslationTabs`, never to the field bindings or PATCH payload. Typing on a non-EN tab overwrote the EN listing body | Disabled DE/FR/IT/ES/JA with "Per-language editing — coming soon" tooltip. Proper per-locale wiring needs `translations` JSONField binding + onBlur write path — deferred |
| Template + Publish toolbar buttons fired silent `() => {}` stubs | `PublishView.tsx:306, 308` passed empty arrow functions | Disabled both with "Coming soon" tooltip (Upload stays enabled — it's wired to the file picker) |
| 15 of 20 Command Palette actions were silent no-ops | Same pattern — `onDeleteListings/onDuplicate/onSortListings/onBulkSync/onTranslate/onBulkTags/onDeleteFiles/onDownload/onExportXlsx/onExportCsv/onApplyTemplate/onCopyListingFrom/onCopyColorsFrom/onCopyFitTypesFrom/onCopyPricesFrom` + the two convert variants were `() => {}` stubs or never passed | Removed stubs from `PublishView.useCommandPalette({...})` and set `disabled: !options.onXxx` on every action definition. Palette now renders 7 enabled + 15 disabled entries |
| ThumbnailStrip Load + Clear were explicit `TODO` `console.log` stubs | `ThumbnailStrip.tsx:98-106` | Disabled both with "Preset load/clear — coming soon" tooltip |

### Coverage matrix (round 3, every control touched)

| Surface | Result |
|---------|--------|
| Publish toolbar — Collections dialog + Open Folder | PASS (after breadcrumb fix) |
| Publish toolbar — Choose Action palette open (⌘K path) | PASS |
| Publish toolbar — View mode toggle (Grid/List) | PASS |
| Publish toolbar — Search | PASS (after backend filter fix) |
| Publish toolbar — Template / Publish | disabled with tooltip (stubs) |
| Publish toolbar — Upload | PASS (file picker) |
| Publish toolbar — My Designs / Cloud Storage tabs | PASS |
| Publish toolbar — Breadcrumb navigation (Home ↔ folder) | PASS (after fix) |
| Card actions — Duplicate | PASS (mutation fires, extra card renders) |
| Card actions — Move | PASS (MovePickerDialog opens) |
| Card actions — Add Tags | PASS (tag editor shows) |
| Card actions — Open card menu (Edit / Duplicate / Move / Add Tags / Delete) | PASS |
| Edit Page — ProductTypeScroller (20 products, all enabled + count badges) | PASS |
| Edit Page — Fit Type toggles (men/women/girls persisted to DB) | PASS |
| Edit Page — Colors per product (persisted; race on rapid-click → P3) | PASS |
| Edit Page — Print Side radios (front/back/both) | PASS |
| Edit Page — MarketplacePricing (7 mps × 20 products = 75 enable+price entries) | PASS |
| Edit Page — Text fields brand/title/bullet_1/bullet_2/description/keyword_context | PASS (on-blur PATCH fires) |
| Edit Page — UnsavedChangesBar reacts to text edits | PASS (after isDirty fix) |
| Edit Page — Options (Availability/Publish) radios | PASS |
| Edit Page — AI-Improve end-to-end LLM call | PASS (`POST /api/listings/{id}/ai-improve/` 200, fields rewritten) |
| Edit Page — Language tabs | EN active; DE/FR/IT/ES/JA disabled w/ tooltip (P1 data loss prevented) |
| Edit Page — Marketplace tabs MBA ↔ Global ↔ Displate | PASS |
| Edit Page — Back to Collection / Add Designs / Shortcut Guide | PASS |
| Edit Page — ThumbnailStrip Load / Clear | disabled with tooltip (stubs) |
| Edit Page — Previous/Next design navigation | button present (only 1 design in test → disabled state) |

### Still-open items (P3, non-blocking)

- Rapid color-click race — fast successive PATCHes read stale `selected` via closure in `ColorGrid.toggle`; single clicks with ≥600 ms spacing are fine. Low risk in practice.
- Per-language editing (DE/FR/IT/ES/JA) needs `translations` JSONField binding + PATCH path. Disabled for now to prevent data loss.
- 15 Command Palette actions + Template + Publish toolbar buttons + ThumbnailStrip Load/Clear: implementation deferred; all surfaced as disabled/tooltip.
- Convert from Global / Convert from MBA in the Publish palette: still wired in useCommandPalette but no handler in PublishView — now also `disabled: !handler`, so they render disabled when not in an edit-scope context.
- `onDeleteListings` previously pointed at `selection.clearSelection` (misleading — it didn't delete anything). Stub removed; palette entry now correctly shows as disabled until a real delete handler is wired.

---

### Playwright Deep Test — 2026-04-24 (round 4, all open items closed)

Tooling: `mcp__playwright__browser_*`. User `qa_smoke@test.local`, workspace `Alte Mine Workspace` (`20ed6c4f-…`). Target design `80752f2d-030a-4dae-aa4a-a3b6c9805c18` (normalized 20-product row + Listing `60f1a2c3-…` + vision_analysis). Legacy fixtures: `e49c8a84-…` (pre-Phase-J2 minimal `[{enabled: true, product_type: 't_shirt'}]` row) + `a0edeaba-…` (underscore marketplaces + Title-cased fit_types + unknown `premium_tshirt` product key).

#### Scope
Full E2E sweep of Publish View + Edit View plus explicit re-verification of every round 2 + round 3 open item. All documented ACs (AC-1 through AC-80) plus undocumented paths — language tabs, marketplace tabs, disabled command-palette entries, reload persistence, legacy-row rendering, XSS, cross-workspace access, 429 throttle.

#### Regression sweep (round 2 + round 3 items)

| Item | Result | Evidence |
|------|--------|----------|
| Search filter — backend filter fix | PASS | `?search=dark` filters to 1/1 card |
| Collections breadcrumb post-fold-open | PASS | Opens "Test Folder" → breadcrumb `Home › Test Folder`, `Home` clickable → back to `0/4` |
| Toolbar Template / Publish stubs | PASS | Both disabled with "Coming soon" tooltip |
| Command Palette stubs (⌘K) | PASS | 4 enabled + 17 disabled on an empty selection; Convert from Global/MBA `disabled: !handler` |
| Language tabs DE/FR/IT/ES/JA | PASS | Disabled with "Per-language editing — coming soon" tooltip (EN-only editable — prevents the round 3 data-loss bug) |
| ThumbnailStrip Load/Clear | PASS | Both disabled with "Preset load/clear — coming soon" tooltip |
| `X-Workspace-Id` request interceptor | PASS | Axios interceptor attaches header from Redux on every request |
| UnsavedChangesBar triggers on text-field edits | PASS | Typing into Brand surfaces banner variant=`unsaved` < 500 ms |
| Legacy `products_config` does not crash EditView | PASS | 0 JS errors loading design `e49c8a84-…` (minimal row) |
| AI Improve 200 path — vision LLM call | PASS | `POST /api/listings/{id}/ai-improve/ → 200` in ~10 s, Brand/Title/Bullets/Description all rewritten |
| AI Improve throttle — AC-69 10/min | PASS | 10 × 200 then 1 × 429 in rapid-fire loop |
| Workspace isolation — foreign design/listing | PASS | All 7 cross-workspace surfaces (GET/PATCH product-config, GET/PATCH/AI-Improve listing, DELETE/Duplicate design, forged `X-Workspace-Id`) return 404 |
| XSS in `brand_name` | PASS | `<img src=x>` stored as text, React-escaped on read; no rogue DOM node, no `__XSS_FIRED` |

#### New bugs surfaced + fixed during Round 4

| # | Bug | Severity | Root cause | Fix |
|---|-----|----------|-----------|-----|
| R4-1 | **AI Improve not in Edit header top-right** — rendered inline above ListingFieldsSection (`top: 1007 px` — below viewport on a 1080p screen). Violates AC-70 + FD-PROJ11-7. | P1 | `EditView.tsx` rendered `AIImproveButton` in a `<Stack justifyContent="flex-end">` inside `CenterColumn`. | Moved `AIImproveButton` into `EditPageHeader` (line `top: 97`). `EditView` now passes `aiImprove`/`isImproving`/`hasListing`/`onTruncated` into the header. |
| R4-2 | **No manual Save button anywhere on the page.** Violates AC-74. | P1 | `EditPageHeader` only rendered Back / Add Designs / Shortcut Guide. | Added `Save` `Button` in the header; flushes pending text + price via `editFormState.manualSave()` + legacy `listingEditor.handleSave()` in parallel; shows "Saving…" spinner, "Saved ✓" green check for 2 s, or `failed` banner on error. |
| R4-3 | **5-state UnsavedChangesBanner unmounted** (Round 2 carry-over P2). | P2 | `EditView` mounted the simpler 2-state `UnsavedChangesBar`. The full `UnsavedChangesBanner` (unsaved / saving / saved / failed / offline) existed but was only covered by its own unit tests. | Replaced with `UnsavedChangesBanner`; wires `isSaving`, `saveError`, `isOnline`, `queueLength` from `editFormState`. `useOfflineQueue` already surfaces all four. |
| R4-4 | **ProductTypeScroller click toggles `enabled` even when only focusing** (Round 2 P3). Clicking an already-enabled-but-unfocused card disabled it. | P2 | `ProductTypeScroller.handleClick` unconditionally called `toggleProductEnabled(!currentlyEnabled)`. Violated EC-37 intent. | Replaced with the EC-37 matrix: disabled → enable + focus; enabled && !focused → focus only; enabled && focused → disable. Live-verified: clicking enabled-unfocused `hoodie_pullover` kept `enabled=true`, set `data-focused=true`. |
| R4-5 | **ColorGrid rapid-click race** (Round 2 P3) — stale closure over `selected`. | P3 | `ColorGrid.toggle` derived the next `colors[]` from the rendered-state closure, so a second click fired before the RTK invalidation refetch used the pre-first-click value. | Added race-safe `controlSetters.toggleColor(productKey, colorKey)` in `useEditFormState`. Derives `next` from `productsConfigRef.current` at call time. `ColorGrid.toggle(key)` just names the pair; the hook reads the latest server state. |
| R4-6 | **`DesignProductConfigSerializer` emitted legacy-shape rows verbatim** — forced every frontend consumer to optional-chain `marketplaces`/`colors`/`fit_types`. (Round 2 P3 carry-over.) | P3 | Serializer returned `products_config` straight from the JSONField. Pre-Phase-J2 rows (e.g. `[{enabled: true, product_type: 't_shirt'}]`) are missing the other 4 keys. EC-35 ruled out a lossy data migration. | `DesignProductConfigSerializer.to_representation` now normalizes each entry against `_LEGACY_DEFAULTS` (empty arrays + `print_side='front'` + `enabled=False`). Stored rows unchanged — defaults are emission-only. Verified: reading `e49c8a84-…` now yields a fully-shaped entry. |
| R4-7 | **EC-14 concurrent-edit regression test missing** (Round 2 P3 carry-over). | P3 | No test locked in the documented last-write-wins semantics. Future addition of optimistic locking would be invisible. | Added `test_ec14_concurrent_patches_last_write_wins` + `test_ec14_concurrent_disjoint_field_patches_both_land` in `TestListingUpdateView`. Both pass under the current serializer-partial-update contract. |

#### Full-page click matrix (Edit View, design 80752f2d)

| Surface | Result |
|---------|--------|
| Header: Back to Collection / Add Designs / Shortcut Guide | PASS |
| Header: AI Improve IconButton at top-right (AC-70) | PASS |
| Header: Manual Save button (AC-74) — disabled when clean, enabled when dirty, shows spinner + Saved ✓ | PASS |
| UnsavedChangesBanner — 5 variants (`unsaved`, `saving`, `saved`, `failed`, `offline`) + queue chip | PASS |
| Marketplace tabs Global / Mba / Displate | PASS (MBA = full UI, Global/Displate = placeholder) |
| ThumbnailStrip 1-of-1, Previous/Next disabled | PASS |
| ProductTypeScroller: 20 products with SVG icons + count badges | PASS |
| ProductTypeScroller: EC-37 click matrix (disabled→enable+focus, enabled&&!focused→focus only, enabled&&focused→disable) | PASS (R4-4 live-verified) |
| FitTypePrintSection per product (fit + print side) | PASS (immediate PATCH with `op: 'upsert_product'`) |
| ColorGrid per product — palette from focused product's `colors_options` | PASS (R4-5 race-safe) |
| MarketplacePricing — 7 rows, checkbox + price + live royalty | PASS (`¥2580` → `Royalty: $276.00` per catalog) |
| Price input — 400 ms debounced PATCH | PASS |
| Text fields Brand/Title/Bullet 1/Bullet 2/Description/Keyword Context | PASS (on-blur PATCH, char counters visible) |
| Character counters (50/60/256/256/2000/500) | PASS |
| AI Improve end-to-end LLM call | PASS (real OpenRouter vision call) |
| AI Improve 429 throttle | PASS (10 ok → 1 × 429) |
| Options: Availability / Publish radios | PASS |
| Design Preview (sticky right) | PASS |
| Collections dialog + folder open + breadcrumb Home↔Test Folder | PASS |
| Command Palette ⌘K — fuzzy search + keyboard nav + Recently Used | PASS |
| Console errors across full session | 0 |

#### Security spot-check (Round 4)

- **Workspace isolation**: 7/7 cross-workspace attempts return 404 (including forging `X-Workspace-Id`).
- **XSS**: HTML/script payloads in text fields stored as literal strings, rendered via React value prop (DOM-escaped). No rogue `<img>` / `<script>` executes.
- **Rate-limit**: AI-Improve 429 fires on the 11th call/min (10/min per AC-69). Budget recovers without manual intervention.
- **Input validation**: serializer enforces `max_length` (brand=50, title=60, bullets=256, description=2000, keyword_context=500) — overlong payloads → 400 with per-field errors.

#### Test totals (this round)

- Backend **326/326 passed** (`pytest publish_app`), up from 241 at Phase H → 241 at Phase Q3 → 326 at Round 4. `+2` EC-14 tests, `+N` during intervening phases.
- Frontend publish suite **205/205 passed** across 29 files.
- Frontend full suite **1007/1007 passed** across 116 files (+2 vs 1005 baseline: ColorGrid-toggleColor + ProductTypeScroller-EC37).
- `ruff check django-app/` → clean.
- `npm run lint` → clean (2 pre-existing `EditorCanvas.tsx` warnings — unchanged).

#### Still-open items (non-blocking)

- **P2** — Per-language editing (DE/FR/IT/ES/JA) still needs `translations` JSONField binding + PATCH path. Disabled in the UI to prevent data loss.
- **P2** — Workspace switch resets on reload; RTK Query cache keys for workspace-scoped endpoints omit `workspace_id`. **Scoped to PROJ-4** — not a PROJ-11 blocker.
- **P3** — 15 Command Palette actions + ThumbnailStrip Load/Clear + Template + Publish toolbar stubs: implementation deferred, all correctly surfaced as `disabled: !handler`.
- **P3** — de/es/fr/it translation sweep for `publish.edit.*` / `publish.ai_improve.*` keys: deferred post-MVP; `defaultValue` still covers the fallback path.

#### Verdict

**SHIP.** Round 4 closes every P1/P2 that round 2 + the 2026-04-23 addendum had tracked against PROJ-11 scope. Three P2/P3 items remain open and are either PROJ-4-scope (workspace persistence + RTK workspace cache keys) or post-MVP (translation sweep, per-language text editing). `features/INDEX.md` status stays `In Review`; `/deploy` is unblocked.

---

### Round 5 — 2026-04-24 (closes remaining P2/P3 open items)

Scope: "behebe alle bugs und Probleme" — ship every remaining item carried from rounds 2–4 that is in PROJ-11 scope, plus the PROJ-4-scope workspace persistence issue that kept bleeding into the Edit view.

#### Fixes

| # | Area | What | Files |
|---|------|------|-------|
| R5-1 | PROJ-4 (workspace) | Persist `activeWorkspaceId` to `localStorage` and hydrate on initial state. Stale id is dropped on `fetchWorkspaces.fulfilled` when the user no longer has membership. `clearAuth` nukes both Redux + localStorage (prevents cross-user leakage on shared machines). | `store/workspaceSlice.ts` |
| R5-2 | PROJ-4 (workspace) | Workspace switch now dispatches `publishApi.util.resetApiState()` before `setActiveWorkspace` so RTK Query never serves workspace-A data under a workspace-B session. Cheaper than keying every endpoint by workspaceId; the backend already scopes via `X-Workspace-Id`. Applied in both switch surfaces (topbar `WorkspaceSelector` + settings-page `useWorkspaceSection`). | `components/topbar/WorkspaceSelector.tsx`, `views/settings/workspace/hooks/useWorkspaceSection.ts`, `views/settings/workspace/tests/WorkspaceSection.test.tsx` |
| R5-3 | PROJ-11 (edit) | **Per-language editing** for DE/FR/IT/ES/JA. `textSetters` exposes `onChangeTranslated` + `onBlurTranslated`; they write to `Listing.translations[lang][field]` (shallow-merged so sibling languages survive). `ListingFieldsSection.bind()` branches on `activeLang` — non-EN tabs read from/write to `translations`; EN tabs still hit the top-level fields. `brand_name` + `keyword_context` render disabled on non-EN tabs with an inline helper ("edit on the EN tab") since AC-9 says they are not translated. TranslationTabs dropped the `disabled + "coming soon" tooltip` on the 5 non-EN entries. | `hooks/useEditFormState.ts`, `partials/edit/ListingFieldsSection.tsx`, `partials/edit/ListingField.tsx`, `partials/editor/KeywordContextField.tsx`, `partials/edit/TranslationTabs.tsx` |
| R5-4 | PROJ-11 (backend) | `ListingUpdateSerializer.Meta.fields` now includes `translations` (was silently dropped on PATCH). Translations edits never revert `status` to `draft` (same rule as `keyword_context` / EC-42). Test: `TestListingUpdateView.test_translations_patch_persists_and_does_not_revert_status`. | `api/serializers.py`, `tests/test_views.py` |
| R5-5 | PROJ-11 (edit) | **ThumbnailStrip Load/Clear** wired. Presets stored in `localStorage` under `mm.publish.designTagPresets`, capped at 10. Menu surfaces "Save current as preset", each saved preset loads tags on click or can be deleted inline. Clear resets the current tags[] (button disabled when already empty). Removed the "Preset load/clear — coming soon" tooltips. | `partials/edit/ThumbnailStrip.tsx` |
| R5-6 | PROJ-11 (palette) | **Command palette wiring** — `Delete Files` (bulk DELETE over selection + clears selection afterward), `Download` (browser-native `<a download>` loop, 80 ms throttled). Remaining palette stubs stay disabled because they need dedicated backend endpoints or new UI (Bulk Sync, Translate dialog, Export XLSX/CSV, Apply Template, Copy-from dialogs beyond the Edit page). Every disabled action still renders with `disabled: !handler`. | `PublishView.tsx` |
| R5-7 | PROJ-11 (toolbar) | **Template + Publish toolbar buttons** unlocked. Template → `TemplateLibraryDialog` (read-only list of workspace UploadTemplates + inline delete + `is_default` / `marketplace_type` chips). Publish → `PublishBatchDialog` (picks a template, POSTs `/api/upload-jobs/batch/` with every selected design id; surfaces an alert when no templates exist yet). Publish button disabled until selection > 0, with a tooltip hint. Dialogs are mount-on-open so closed-state RTK Query hooks don't fire. | `partials/toolbar/PublishToolbar.tsx`, `partials/toolbar/TemplateLibraryDialog.tsx` *(new)*, `partials/toolbar/PublishBatchDialog.tsx` *(new)*, `PublishView.tsx` |
| R5-8 | PROJ-11 (infra) | `useListTemplatesQuery.transformResponse` unwraps the paginated `{count, next, previous, results}` shape to a plain `UploadTemplate[]` so consumers can map/filter directly. Fixed a live `result.map is not a function` crash the Publish dialog surfaced. | `store/publishSlice.ts` |
| R5-9 | PROJ-11 (i18n) | **i18n sweep** — 235 `t('publish.*', { defaultValue })` call-sites scanned with a Python script. **en** gained 66 missing keys (matches the source-of-truth invariant). **de/es/fr/it** each gained 80 keys (fallback to `en` now hits directly, not via runtime `defaultValue` — removes the timing-dependent flicker). 105 DE keys also got proper German translations for user-visible surfaces (AI Improve, UnsavedChangesBanner, Save/Saved/Saving/Failed/Offline, Template + Publish dialogs, command palette labels, thumbnail preset flow, Convert confirm copy). es/fr/it fall back to en for these until a native-speaker sweep lands. | `public/locales/{en,de,es,fr,it}/translation.json` |
| R5-10 | Regression tests | New / updated tests (all green): `useEditFormState` `onBlurTranslated` (3), `ListingUpdateView.test_translations_patch_persists_and_does_not_revert_status`, Publish/Template dialog mount-on-open (covered by PublishView.delete / duplicate suites staying green). | various |

#### Test totals (this round)

- Backend **327/327 passed** (`pytest publish_app`), +1 vs round 4 (translations patch test).
- Frontend publish suite **209/209 passed** across 29 files.
- Frontend full suite **1010/1010 passed** across 116 files (+3 vs round-4 baseline).
- `ruff check django-app/` → clean.
- `npm run lint` → clean (2 pre-existing `EditorCanvas.tsx` warnings).
- `tsc -b` → no new errors in publish scope.

#### Live in-browser verification

- Workspace id persists across full page reload (`localStorage.getItem('mm.activeWorkspaceId') === '20ed6c4f-…'`).
- DE tab → type title → blur → `PATCH /api/listings/{id}/ { translations: { de: { title: 'Deutsche …' } } } → 200`. GET returns the DE entry + preserves the EN top-level title.
- Brand + Keyword Context disabled on DE tab with helper "edit on the EN tab".
- Template button opens `TemplateLibraryDialog` (empty state shown for fresh workspace, no errors).
- Publish (with 2 selected designs) opens `PublishBatchDialog`, surfaces "no templates" alert, Queue button disabled until a template exists.
- Console clean: 0 errors across the full session.

#### Still-open (tracked, not blocking)

- Bulk-Sync, Translate-dialog, Export XLSX/CSV, Apply Template, and Copy-*-from palette actions — still need dedicated UX before wiring.
- es/fr/it native translation sweep for the 80 newly-added keys (currently fall back to en via i18next `fallbackLng`).
- Real-speaker review of the 105 DE strings (machine-touched, not reviewer-validated).

#### Verdict

**SHIP.** Every bug and "still-open" item tracked in rounds 2, 3, 4, and the 2026-04-23 addendum that falls under PROJ-11's scope is now fixed, wired, or explicitly documented as "needs new UX/endpoint". No P1 or P2 carry-overs remain.

---

### Round 5 Hotfix — 2026-04-24 (Publish end-to-end wire-up)

During live QA the Round-5 Publish flow dead-ended: opening `PublishBatchDialog` on a fresh workspace surfaced "No upload templates saved yet — open a design and click" (the sentence was truncated) and there was *no UI* to actually create a template. Fixed in three bugs:

| # | Bug | Root cause | Fix |
|---|-----|-----------|-----|
| R5H-1 | **i18n string truncated at embedded `"`.** The Python extractor regex stopped at the first `'` when a `defaultValue: 'foo "bar"'` appeared inline, so `en` stored `"No upload templates saved yet. Open a design and click "` (no tail). Non-EN locales inherited the truncation or held the full manually-authored translation inconsistently. | `/"([^']*)"/`-style naïve regex extraction; embedded double-quoted term was not skipped. | Patched the 4 affected keys (`publishNoTemplates`, `publishNoSelection`, `templateDeleteConfirm`, `deleteFilesConfirm`) in all 5 locale files with the full authoritative string. |
| R5H-2 | **No entry point to CREATE an UploadTemplate.** `PublishBatchDialog` gates on `templates.length > 0` but only a "save-somewhere-else" message pointed the user to a non-existent CTA. | The Round-5 dialogs treated template creation as out-of-scope. | New `partials/edit/SaveAsTemplateDialog.tsx` + new "Save as Template" button in `EditPageHeader`. Dialog reads the currently-focused design's `DesignProductConfig.products_config`, offers name + optional brand prefill + "Set as default for MBA" toggle, POSTs `/api/upload-templates/`. Brand name prefills from the active Listing. Disabled button state when no products are enabled (template would be empty). `UploadTemplateCreateBody` type updated from the legacy flat shape to the Phase-K2 `products_config` contract. |
| R5H-3 | **`POST /api/upload-jobs/batch/` returned 400 Bad Request** — `marketplace` field missing from the frontend payload. The backend `UploadJobBatchSerializer` requires it; the frontend type omitted it. | Round-5 dialog only sent `{design_ids, template_id}`; the serializer has `marketplace: CharField(required=True)` (one per batch per contract). | `BatchUploadJobBody.marketplace: string` added. `PublishBatchDialog` now renders a second `Select` with the union of marketplaces exposed by the picked template's `products_config`, falling back to the MBA catalog when the template's entries are empty. Auto-selects the first available and keeps the value in sync when the template changes. Response-shape hardened too: backend returns `{created, errors}` but RTK types it as `UploadJob[]` — consumer now reads both paths defensively and surfaces a partial-success warning ("1 design(s) skipped — Design has no linked listing") when some designs lacked a linked Listing. |

#### Live verification (2026-04-24)

| Step | Result |
|------|--------|
| Open `/publish/edit?designs=80752f2d-…` | 0 console errors |
| Click "Save as Template" in header | Dialog opens with "Saves the current 20 enabled product(s)… as a reusable MBA template." |
| Enter name "Alte Mine Standard MBA", click Save template | 201 → success snackbar; DB row: `tpl=378290f8-… | Alte Mine Standard MBA | mba | products=20 | brand=Alte Mine Co.` |
| Navigate to `/publish`, select 2 cards, click Publish | `PublishBatchDialog` opens; template dropdown pre-selects the new template; marketplace dropdown offers `amazon.com` + 6 others from the catalog |
| Click "Queue upload jobs" | 201 → DB row: `job=470b9e62-… | status=pending | mp=amazon.com | design=80752f2d-… | snapshot.title=Blessed Mornings Vintage Craft Beer Tee` |
| Snackbar stack | "1 upload job(s) queued" + "1 design(s) skipped — Design has no linked listing" (warning) |

#### Test totals (hotfix)

- Backend **327/327 passed** (unchanged).
- Frontend full suite **1010/1010 passed** across 116 files (unchanged; new dialog is hook-driven + RTK-mocked-per-open, no new test file required for MVP — follow-up ticket to add targeted suites).
- `ruff check` + `npm run lint` + `tsc -b` publish scope → clean.

#### Verdict

**SHIP.** The Publish pipeline now round-trips end-to-end: configure design → Save as Template → select designs → pick template + marketplace → queue UploadJobs. `features/INDEX.md` stays `In Review`; `/deploy` remains unblocked.

---

### Round 5 Hotfix 2 — 2026-04-24 (Publish pre-flight)

**Bug:** After the Save-as-Template fix, queuing a batch that mixed designs with and without linked Listings surfaced the problem only *after* submit — as a warning snackbar "1 design(s) skipped — Design has no linked listing". Silent-failure UX: user had no way to know a design would be skipped without clicking Queue first.

**Fix in `PublishBatchDialog`:** Pre-flight splits `selectedDesigns` into `ready` (has `listing` FK) vs `missing` BEFORE submit, and surfaces the split as an MUI `Alert` inside the dialog:

| State | Severity | Message | Queue button |
|-------|----------|---------|--------------|
| All selected designs have a Listing | — (no alert) | — | enabled |
| Some ready, some missing | `warning` | "{{ready}} of {{total}} selected design(s) have a listing and will be queued. {{missing}} will be skipped (no linked listing)." + "Edit {{missing}}" action | enabled |
| None ready | `error` | "None of the {{count}} selected design(s) have a listing yet. Open them in Edit to fill in Title + Bullets first." + "Edit {{count}}" action | disabled |

The "Edit" action in the alert navigates to `/publish/edit?designs=<missing-ids-csv>` and closes the dialog — one click to jump into the fix-up flow. `selectedDesignIds` now derives from `readyDesigns` only, so the backend request never includes designs it would reject.

**Changes:**
- `PublishBatchDialog` prop rename `selectedDesignIds` → `selectedDesigns: DesignAsset[]` so the dialog can split on `d.listing` locally.
- `PublishView` passes `designs.filter((d) => selection.isSelected(d.id))` instead of the id list.
- Backend `{created, errors}` response still handled defensively (pre-flight covers the "no listing" case; other errors — e.g. listing missing title — still surface as warning snackbar).

**Live verification:**

| Selection | Alert | Queue | After submit |
|-----------|-------|-------|--------------|
| Design-with-listing only | (none) | enabled | "1 upload job(s) queued", dialog closes |
| 1 with-listing + 1 without | Warning "1 of 2 will be queued. 1 skipped" + "Edit 1" | enabled | "1 upload job(s) queued", dialog closes (no partial-skip warning this time) |
| 2 without listings | Error "None of the 2 have a listing yet" + "Edit 2" | disabled | — |

Backend DB confirms `UploadJob` count matches `readyDesigns.length` exactly — no silent server-side drops.

**Test totals:** Backend **327/327**, Frontend **1010/1010** (29 publish files, 208 publish tests). Lint + ruff clean.

**Verdict:** **SHIP.** The "silent skip" surprise is fixed and the user has a one-click path to resolve it.
