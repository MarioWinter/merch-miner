# PROJ-11: Publish (Listing + Upload Manager)

**Status:** Planned
**Priority:** P0 (MVP)
**Created:** 2026-02-27
**Updated:** 2026-03-26

## Overview

Unified "Publish" page combining Listing Generation (formerly standalone PROJ-11) and Upload Configuration (formerly PROJ-13) into a single scrollable flow — inspired by Flying Upload (flyingupload.com). One page, all sections visible: Design Selection → Product Config → Listing Editor → Upload Queue.

Includes a **Design Library/Gallery** for managing designs imported from Google Drive / OneDrive or generated via PROJ-9. All listing fields have AI-powered generation and "Improve" hover-icons. Bulk operations via **Command Palette** (`Ctrl+K`) and **Action Bar** (on selection). Template system for reusable configurations.

**Multi-Language** support with per-marketplace listings and Auto-Translate toggle.

**Product Lifecycle Tracking** traces the full chain: Niche → Slogan → Design → Listing → Upload (ASIN + Marketplace + Date) → Sales Data. Visible in Niche List (PROJ-5), Drawer, and Kanban (PROJ-14).

**TM Check** (Trademark) validates listing text before upload.

Upload execution happens via the **Desktop Upload App** (PROJ-13 Electron App) — this page configures and queues jobs, the desktop app executes them.

**Merges:** former PROJ-11 (Listing & Keyword Generator) + former PROJ-13 (Marketplace Upload Manager, web portion).

## User Stories

### Design Library / Gallery
1. As a member, I want a Design Gallery view showing all my designs as a card grid with thumbnails, so I can browse and manage my catalog.
2. As a member, I want to import designs from Google Drive or Microsoft OneDrive (single or bulk), so I can bring in designs from my cloud storage.
3. As a member, I want to sort (newest, recently edited), filter (no listing, show duplicates), and search designs, so I find what I need quickly.
4. As a member, I want to select multiple designs and perform bulk actions (edit, upload batch, delete) via a bottom Action Bar, so I can manage efficiently.

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

## Tech Design (Solution Architect)

> Decided: 2026-03-27 | Approved by user.

### A) Backend Architecture

**New Django app:** `publish_app`

```
publish_app/
├── models.py                           # Listing, UploadTemplate, UploadJob,
│                                       #   DesignAsset, ProductLifecycle
├── api/
│   ├── views.py                        # Listing CRUD + generate + translate + TM check,
│   │                                   #   Gallery CRUD + import, Upload jobs, Templates, Lifecycle
│   ├── serializers.py                  # All serializers
│   └── urls.py                         # URL routing
├── services/
│   ├── listing_generator.py            # AI listing generation (OpenRouter)
│   ├── translator.py                   # AI translation (OpenRouter)
│   ├── tm_checker.py                   # Trademark check (BrandBlacklist reuse + expandable)
│   ├── cloud_import.py                 # Google Drive + OneDrive file import
│   └── lifecycle_tracker.py            # Product lifecycle chain builder
├── consumers.py                        # WebSocket consumer for Desktop App communication
├── routing.py                          # WebSocket URL routing
├── tasks.py                            # django-rq jobs: generate, translate, TM check
├── admin.py
└── tests/
```

**Registered in:** `core/settings.py` INSTALLED_APPS, `core/urls.py`, WebSocket routing in `core/asgi.py`

---

### B) Frontend Architecture

**Route:** `/publish` — single scrollable page with all sections

```
views/publish/
├── PublishView.tsx                      # Main page assembly (scrollable)
├── hooks/
│   ├── useListingGeneration.ts         # AI generate + poll
│   ├── useDesignGallery.ts             # Gallery CRUD + import + filter
│   ├── useUploadJobs.ts                # Job CRUD + WebSocket status updates
│   ├── useCommandPalette.ts            # Ctrl+K actions
│   └── useLifecycle.ts                 # Product lifecycle chain
├── partials/
│   ├── DesignGallerySection.tsx         # Card grid with import, filter, sort, bulk select
│   ├── DesignCard.tsx                   # Thumbnail + tags + lifecycle badge
│   ├── ProductConfigSection.tsx         # Product types grid + fit + colors + marketplaces
│   ├── ProductTypeGrid.tsx              # Visual product type selector with count badges
│   ├── MarketplacePricing.tsx           # Marketplace toggles + price inputs + royalty display
│   ├── ListingEditorSection.tsx         # All listing fields with char counters + Improve icons
│   ├── ListingField.tsx                 # Reusable: TextField + char counter + Improve hover
│   ├── KeywordChipsField.tsx            # Removable keyword chips + Add + KW Finder link
│   ├── TranslationTabs.tsx             # Multi-language tabs + Auto-Translate toggle
│   ├── TMCheckDialog.tsx                # Trademark check results
│   ├── UploadQueueSection.tsx           # Upload jobs list with status
│   ├── UploadJobRow.tsx                 # Single job: status chip + ASIN + retry + screenshot
│   ├── UploadTemplateDropdown.tsx       # Save/load templates
│   ├── CommandPalette.tsx               # Ctrl+K modal with searchable actions
│   ├── ActionBar.tsx                    # Bottom bar on selection (bulk actions)
│   ├── CloudImportDialog.tsx            # Google Drive + OneDrive picker
│   ├── LifecycleChain.tsx              # Visual lifecycle: Niche → Slogan → Design → Listing → ASIN
│   └── EmptyState.tsx
├── types/
│   └── index.ts
├── schemas/
│   └── listingSchema.ts                # Zod: all field max lengths
└── tests/

store/
└── publishSlice.ts                     # RTK Query: listing, gallery, jobs, templates, lifecycle
```

---

### C) Tech Decisions

| Decision | Why |
|----------|-----|
| `publish_app` (merged listing + upload + lifecycle) | Single page = single app. Listing and Upload are tightly coupled — same models, same workflow |
| Django Channels for WebSocket | Desktop App needs real-time bidirectional communication. Channels is the standard Django solution |
| TM Check via BrandBlacklist (PROJ-6 reuse) | Start with existing trademark brand list. Expandable to external TM API later |
| `listing_snapshot` JSONField on UploadJob | Denormalized copy of listing at queue time. If listing is edited after queueing, upload uses the snapshot |
| `ProductLifecycle` as separate model | Cross-cutting entity spanning Niche → Idea → Design → Listing → Upload. Separate model avoids complex JOINs |
| Single scrollable page (not wizard/stepper) | Flying Upload pattern — all sections visible, user scrolls. Faster than step-by-step for experienced users |
| Command Palette (`Ctrl+K`) | Power-user pattern. Searchable actions for copy/apply operations across designs |
| `DesignAsset` separate from PROJ-9 `Design` | Gallery manages files from any source (upload, cloud, PROJ-9). Different lifecycle than generation |

---

### D) Infrastructure Changes

| Change | Where |
|--------|-------|
| `publish_app` registered | `INSTALLED_APPS` + `core/urls.py` |
| Django Channels + channels-redis | `requirements.txt` |
| ASGI config for WebSocket | `core/asgi.py` |
| Redis channel layer | `settings.py → CHANNEL_LAYERS` |
| OAuth2 env vars (Drive + OneDrive) | `.env.template` |

---

### E) New Packages

**Backend:**

| Package | Purpose |
|---------|---------|
| `channels` | Django WebSocket support (Desktop App communication) |
| `channels-redis` | Redis channel layer for Channels |

**Frontend:** No new packages.
