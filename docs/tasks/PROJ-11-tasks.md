# PROJ-11: Publish (Listing + Upload Manager) — Implementation Tasks

## Key Technical Decisions (from architecture review 2026-03-27)

- **New Django app:** `publish_app` — merged listing + upload + lifecycle in one app
- **Django Channels** for WebSocket — Desktop App real-time communication
- **TM Check** via BrandBlacklist (PROJ-6 reuse), expandable to external API
- **`listing_snapshot`** on UploadJob — denormalized copy at queue time
- **`ProductLifecycle`** separate model — cross-cutting entity (Niche → ASIN)
- **`DesignAsset`** separate from PROJ-9 `Design` — manages files from any source
- **Single scrollable page** (Flying Upload pattern) + Command Palette (`Ctrl+K`)

---

## Phase 1: Backend Foundation

- [ ] Create `publish_app/` Django app, register in `INSTALLED_APPS`
- [ ] Create `publish_app/api/` + `publish_app/services/` subpackages
- [ ] Wire into `core/urls.py` under `/api/listings/`, `/api/designs/gallery/`, `/api/upload-jobs/`, `/api/upload-templates/`, `/api/niches/{id}/lifecycle/`
- [ ] `Listing` model: UUID pk, `idea` FK, `design` FK (nullable), `round` PositiveIntegerField, `brand_name` (max 50), `title` (max 60), `bullet_1..5` (max 256 each), `description` (max 2000), `backend_keywords` (max 500), `status` (draft/ready/published), `generated_by` (ai/manual), `availability` (public/private), `publish_mode` (live/draft), `language` CharField, `translations` JSONField, `created_at`, `updated_at`
- [ ] `UploadTemplate` model: UUID pk, `workspace` FK, `name`, `brand_name`, `product_types` JSONField, `fit_types` JSONField, `colors` JSONField, `marketplaces` JSONField, `print_side` (front/back/both), `created_by` FK, timestamps
- [ ] `UploadJob` model: UUID pk, `workspace` FK, `listing` FK, `design` FK, `template` FK, `listing_snapshot` JSONField, `marketplace` CharField, `status` (pending/validating/uploading/completed/failed/cancelled), `asin` (max 20), `upload_date` (nullable), `error_message`, `error_screenshot` URLField, `retry_count`, `queued_at`, `started_at`, `completed_at`, `created_by` FK
- [ ] `DesignAsset` model: UUID pk, `workspace` FK, `file_name`, `file_url` URLField, `source` (upload/google_drive/onedrive/generated), `source_file_id`, `thumbnail_url`, `dimensions` JSONField, `file_size`, `tags` JSONField, `listing` FK (nullable), `idea` FK (nullable), `niche` FK (nullable), `round`, `created_by` FK, `created_at`
- [ ] `ProductLifecycle` model: UUID pk, `niche` FK, `idea` FK (nullable), `design` FK (nullable), `listing` FK (nullable), `upload_job` FK (nullable), `asin`, `marketplace`, `upload_date`, `sales_units`, `sales_revenue`, `current_bsr`, `reviews_count`, `reviews_rating`, `round`, `updated_at`
- [ ] Indexes: `(workspace, status)` on Listing/UploadJob, `(niche, round)` on ProductLifecycle
- [ ] Initial migration
- [ ] Admin registration
- [ ] `channels` + `channels-redis` in `requirements.txt`
- [ ] ASGI config + Redis channel layer in `settings.py`
- [ ] OAuth2 env vars in `.env.template`

---

## Phase 2: Backend Services

- [ ] `services/listing_generator.py`: AI listing generation via OpenRouter. Input: slogan_text, design context, extra_keywords, language. Output: brand, title, bullets 1-5, description, backend_keywords. Respects MBA char limits
- [ ] `services/translator.py`: AI translation via OpenRouter. Input: listing fields + target language. Output: translated fields. Flags if translated text exceeds char limits
- [ ] `services/tm_checker.py`: reuses `scraper_app/brand_filter.py` BrandBlacklist. Checks title + bullets + description against blacklist. Returns flagged terms + positions. Expandable to external TM API
- [ ] `services/cloud_import.py`: Google Drive OAuth2 + Picker API → download file → create DesignAsset. OneDrive: Microsoft Graph API → download → DesignAsset. Supports single + bulk import
- [ ] `services/lifecycle_tracker.py`: builds lifecycle chain for a niche/design. Aggregates Niche → Idea → Design → Listing → UploadJob → ASIN. Groups by round

---

## Phase 3: Listing API

- [ ] `POST /api/ideas/{id}/listing/generate/` — body: `{design_id, extra_keywords, language}`. Creates Listing via AI. PROJ-10 design_template keywords auto-injected. Returns listing
- [ ] `GET /api/ideas/{id}/listing/` — returns listing with lifecycle chain
- [ ] `PATCH /api/listings/{id}/` — partial update. Status reverts to draft on edit
- [ ] `POST /api/listings/{id}/translate/` — body: `{target_languages: ["de", "fr"]}`. AI translates. Stored in `translations` JSONField
- [ ] `POST /api/listings/{id}/tm-check/` — checks against BrandBlacklist. Returns flagged terms
- [ ] `GET /api/listings/{id}/export/` — plain-text MBA format (clipboard-ready)

---

## Phase 4: Design Gallery API

- [ ] AC-12: `GET /api/designs/gallery/` — paginated. Filterable: tags, has_listing, source. Sortable: newest, recently_edited. Workspace-scoped
- [ ] AC-13: `POST /api/designs/gallery/upload/` — multipart file upload. Creates DesignAsset with source=upload, generates thumbnail. Validate file type (PNG/JPG) + max size
- [ ] AC-14: `POST /api/designs/gallery/import-drive/` — body: `{file_ids, provider}`. Imports from Google Drive / OneDrive
- [ ] AC-15: `DELETE /api/designs/gallery/{id}/` — remove design
- [ ] AC-16: `PATCH /api/designs/gallery/{id}/` — update tags, link to niche/idea
- [ ] AC-24: `POST /api/designs/gallery/bulk-action/` — body: `{ids, action, source_id}`. Actions: apply_template, apply_listing, delete. Workspace-scoped

---

## Phase 5: Upload Job + Template API

- [ ] `POST /api/upload-jobs/` — create + queue job. Validates listing + design + template. Captures `listing_snapshot`
- [ ] `POST /api/upload-jobs/batch/` — body: `{design_ids, template_id}`. One job per design
- [ ] `GET /api/upload-jobs/` — paginated, filterable by status
- [ ] `GET /api/upload-jobs/{id}/` — detail + status
- [ ] `POST /api/upload-jobs/{id}/cancel/` — cancel pending job
- [ ] `PATCH /api/upload-jobs/{id}/` — Desktop App reports status, ASIN, errors, screenshot
- [ ] Upload Template CRUD: `GET/POST /api/upload-templates/`, `GET/PATCH/DELETE /api/upload-templates/{id}/`

---

## Phase 6: Product Lifecycle API

- [ ] AC-25: `GET /api/niches/{id}/lifecycle/` — full lifecycle chains grouped by round. Includes: Niche → Idea → Design → Listing → Upload → ASIN + sales data
- [ ] AC-26: `PATCH /api/lifecycle/{id}/` — update sales data (from browser extension or API)
- [ ] Auto-create/update lifecycle records when UploadJob completes (ASIN captured)

### Edge Case Handling

- [ ] EC-1: Design file missing from Drive/OneDrive → import fails with "File not found", user notified
- [ ] EC-2: MBA char limit exceeded on save → status stays draft, fields highlighted red, upload blocked
- [ ] EC-4: Upload fails (CAPTCHA, form error) → status=failed, screenshot saved, retry available. Max 2 retries
- [ ] EC-6: Auto-translate exceeds char limit → translated field flagged, user must trim before ready
- [ ] EC-7: Listing deleted after upload job created → `listing_snapshot` preserves data, job proceeds from snapshot
- [ ] EC-8: Multiple uploads same design to different marketplaces → separate jobs, each gets own ASIN
- [ ] Gallery file upload validation: max 25MB, PNG/JPG only. Reject with clear error message

---

## Phase 7: WebSocket (Desktop App)

- [ ] `consumers.py`: WebSocket consumer — authenticated per workspace. On new UploadJob → push job data to connected Desktop App. On status update from App → update UploadJob
- [ ] `routing.py`: WebSocket URL `ws/upload-app/`
- [ ] ASGI routing in `core/asgi.py`
- [ ] Connection status tracking: UI shows "Desktop App connected/disconnected"
- [ ] No Desktop App connected → jobs stay pending, UI shows info message

---

## Phase 8: django-rq Tasks

- [ ] `tasks.py: task_generate_listing(listing_id)` — AI generation via OpenRouter. Saves result to Listing
- [ ] `tasks.py: task_translate_listing(listing_id, target_languages)` — AI translation. Saves to `translations` JSONField
- [ ] `tasks.py: task_tm_check(listing_id)` — BrandBlacklist check. Returns flagged terms
- [ ] `tasks.py: task_import_cloud_files(asset_ids, provider)` — Download from Drive/OneDrive, create thumbnails

---

## Phase 9: Frontend — State & Services

- [ ] RTK Query `publishApi` slice (`store/publishSlice.ts`): generateListing, getListing, updateListing, translateListing, tmCheck, exportListing, listGallery, uploadDesign, importDrive, deleteDesign, updateDesign, bulkAction, createJob, batchJobs, listJobs, getJob, cancelJob, templateCRUD, getLifecycle
- [ ] Cache tags: `Listings`, `Gallery`, `UploadJobs`, `Templates`, `Lifecycle`
- [ ] WebSocket hook: `useUploadWebSocket` — connects to `ws/upload-app/`, receives status updates, updates RTK cache
- [ ] Register slice in `store/index.ts`
- [ ] TypeScript types: Listing, UploadTemplate, UploadJob, DesignAsset, ProductLifecycle, ListingStatus, UploadStatus

---

## Phase 10: Frontend — Publish Page

- [ ] `PublishView.tsx`: single scrollable page. Sections: Gallery → Product Config → Listing Editor → Upload Queue
- [ ] `DesignGallerySection.tsx`: MUI Grid card layout. Import button, sort/filter controls, bulk select
- [ ] `DesignCard.tsx`: thumbnail, tags, lifecycle badge (niche → ASIN chain), selection checkbox
- [ ] `ProductConfigSection.tsx`: product type grid + fit type + colors + marketplace pricing
- [ ] `ProductTypeGrid.tsx`: visual grid with count badges per product type
- [ ] `MarketplacePricing.tsx`: marketplace toggles + price input + royalty display per marketplace
- [ ] `ListingEditorSection.tsx`: all listing fields stacked vertically
- [ ] `ListingField.tsx` (reusable): MUI TextField + char counter (amber 90%, red 100%) + "Improve" hover icon → opens Chat (PROJ-17)
- [ ] `KeywordChipsField.tsx`: removable keyword chips + "+ Add" + "KW Finder" link (PROJ-10)
- [ ] `TranslationTabs.tsx`: language tabs (EN/DE/FR/IT/ES/JA) + Auto-Translate toggle + "Translate to All" button
- [ ] `TMCheckDialog.tsx`: MUI Dialog with flagged terms highlighted. Soft block (user can proceed)
- [ ] `UploadQueueSection.tsx`: list of UploadJobs with status
- [ ] `UploadJobRow.tsx`: status chip (pending/uploading/completed/failed), ASIN display, retry button, error screenshot link
- [ ] `UploadTemplateDropdown.tsx`: MUI Menu — save/load/delete templates
- [ ] `CommandPalette.tsx`: `Ctrl+K` modal. Searchable action list (copy listing, apply colors, apply template, etc.)
- [ ] `ActionBar.tsx`: fixed bottom bar on selection. Bulk actions: Edit, Upload Batch, Apply Settings, Delete
- [ ] `CloudImportDialog.tsx`: Google Drive + OneDrive picker (OAuth2 flow)
- [ ] `LifecycleChain.tsx`: visual chain: Niche → Slogan → Design → Listing → ASIN with status icons
- [ ] `EmptyState.tsx`: no designs → CTA to import or generate
- [ ] Route `/publish` registered in `App.tsx`

---

## Phase 11: i18n

- [ ] `publish.page.*` — page title, section headers
- [ ] `publish.gallery.*` — import, sort, filter, bulk action labels
- [ ] `publish.product.*` — product type names, fit types, print side, color labels
- [ ] `publish.marketplace.*` — marketplace names, price, royalty labels
- [ ] `publish.listing.*` — field labels (brand, title, bullets, description, keywords), generate button, char counter warnings
- [ ] `publish.translate.*` — language names, auto-translate, translate all
- [ ] `publish.tm.*` — check button, flagged terms warning, proceed/edit labels
- [ ] `publish.upload.*` — queue button, status labels, ASIN, retry, desktop app not connected
- [ ] `publish.template.*` — save, load, delete labels
- [ ] `publish.command.*` — palette title, action names
- [ ] `publish.lifecycle.*` — chain labels, round labels
- [ ] `publish.empty.*` — no designs, CTA
- [ ] All 5 locales: EN, DE, FR, ES, IT

---

## Phase 12: Tests

### Backend

- [ ] Listing generation: AI produces valid listing within char limits, keywords auto-injected
- [ ] Listing translation: translates to target languages, flags over-limit
- [ ] TM Check: detects blacklisted brands, returns flagged terms
- [ ] Gallery CRUD: upload, import, delete, bulk actions, workspace isolation
- [ ] Upload Job: create, batch create, cancel, status transitions
- [ ] Upload Template CRUD: save, load, delete
- [ ] WebSocket consumer: authenticates, pushes jobs, receives status updates
- [ ] Product Lifecycle: builds correct chain, groups by round
- [ ] listing_snapshot: preserved after listing edit
- [ ] Workspace isolation on all endpoints

### Frontend

- [ ] PublishView: renders all sections, scrollable
- [ ] ListingField: char counter amber/red at correct thresholds
- [ ] DesignGallerySection: grid renders, import/filter/sort work
- [ ] CommandPalette: opens on Ctrl+K, searchable actions
- [ ] ActionBar: appears on selection, bulk actions work
- [ ] UploadJobRow: status transitions reflected, ASIN shown
- [ ] TranslationTabs: language switching, auto-translate
- [ ] TypeScript + ESLint + Ruff: 0 errors

---

## Verification Checklist

- [ ] `publish_app` registered, migrations applied
- [ ] AI listing generation within MBA char limits
- [ ] Character counters: amber at 90%, red at 100%
- [ ] TM Check flags blacklisted terms
- [ ] Multi-language translation with limit warnings
- [ ] PROJ-10 keywords auto-injected from design_template
- [ ] Design Gallery: upload, cloud import, filter, bulk actions
- [ ] Upload Template save/load
- [ ] WebSocket: Desktop App receives jobs, reports status + ASIN
- [ ] Command Palette (`Ctrl+K`) with searchable actions
- [ ] Product Lifecycle chain (Niche → ASIN) visible
- [ ] Round system: designs/listings grouped by round
- [ ] Workspace isolation on all endpoints
- [ ] All tests pass, lint clean
