# PROJ-9: Design Generation (OpenRouter) — Implementation Tasks

## Key Technical Decisions (from architecture review 2026-03-27 + frontend-design 2026-03-30 + project refactor 2026-03-30 + artboard redesign 2026-03-31)

- **New Django app:** `design_app` — Design generation, image analysis, post-processing pipeline
- **DesignProject model:** Kittl-style project folders. Designs ↔ Projects = M2M. Optional niche binding. Board layout stored per project
- **2 frontend routes:** `/designs` (Project Gallery) + `/designs/:projectId` (Unified Design Workspace with 2 tab-modes)
- **Unified Design Workspace:** Tab 1 = Artboard Canvas (Konva.js), Tab 2 = Image Editor (Konva.js). Fully decoupled — no shared image state, explicit "Add to Editor" / "Add to Canvas" actions only (Phase N)
- ~~**React Flow (`@xyflow/react`):**~~ REMOVED — replaced by Konva.js artboard paradigm (decided 2026-03-31)
- **Kittl-style Prompt Bar:** Collapsible chat-like bar. Collapsed = one-liner, Expanded = full editor with thumbnails + model/BG controls
- **Board persistence:** `DesignProject.board_layout` JSONField — saves artboard positions + connections to backend
- **Dedicated `worker-design`:** Queue `design` (30min timeout), parallel with research/slogan workers
- **Konva.js + Web Workers:** Post-processing editor tools (eraser, wand, filters, defringe) — Phase B
- **Pica.js:** Client-side upscaling for images ≥3000px (Lanczos filter, free, fast)
- **rembg (u2net):** Self-hosted BG removal, 170MB model. External API as Settings-configurable fallback
- **Auto upscale mode:** ≥3000px → Pica.js (client), <3000px → external API. Configurable in Settings
- **Pipeline model:** JSONField with ordered tool+params list. Presets saveable/loadable
- **File storage:** Django FileField + media/ for MVP. S3 migration path available

---

## Phase A1: Backend Foundation

- [x] Create `design_app/` Django app, register in `INSTALLED_APPS`
- [x] Create `design_app/api/` + `design_app/services/` subpackages
- [x] Wire into `core/urls.py` under `/api/designs/` and `/api/ideas/{id}/designs/`
- [x] `DesignGenerationRun` model: UUID pk, `idea` FK, `model_name` choices (gemini_flash/gemini_pro/gpt_image/flux), `status` (pending/running/completed/failed), `triggered_by` FK, `prompt_used` TextField, `created_at`, `completed_at` (nullable), `error_message` TextField
- [x] `Design` model: UUID pk, `workspace` FK, `idea` FK, `generation_run` FK (nullable), `image_file` FileField, `status` (pending/approved/rejected/failed), `is_manual` BooleanField, `background_color` choices (light_gray/neon_pink/neon_green), `source_image_url` URLField, `prompt_analysis` JSONField (7-step output), `upscaled_file` FileField (nullable), `bg_removed_file` FileField (nullable), `created_at`
- [x] `DesignProcessingJob` model: UUID pk, `design` FK, `type` choices (upscale/bg_remove), `status` (pending/running/completed/failed), `result_file` FileField (nullable), `error_message` TextField, `created_at`, `completed_at` (nullable)
- [x] `ProcessingSettings` model: `workspace` FK (OneToOne), `bg_removal_provider` (rembg/api), `bg_removal_api_key` EncryptedCharField, `upscale_provider` (pica/api/auto), `upscale_api_key` EncryptedCharField, `upscale_auto_threshold` IntegerField (default=3000)
- [x] Indexes: `(workspace, idea)` on Design, `(design, type)` on DesignProcessingJob
- [x] Initial migration
- [x] Admin registration
- [x] RQ queue `design` in `settings.py → RQ_QUEUES` (30-min timeout)
- [x] `worker-design` Docker service in `docker-compose.yml` + bind-mount in `docker-compose.override.yml`
- [x] `rembg` + `Pillow` in `requirements.txt`
- [x] Media file storage: `MEDIA_ROOT` + `MEDIA_URL` in `settings.py`

---

## Phase A2: Image Analysis + Prompt Construction

- [x] `services/image_analyzer.py`: Gemini 3 Architect 7-step analysis. Input: image URL. Output: structured JSON (text_dna, visual, spatial, style, color, tech, final_prompt). Uses OpenRouter (Gemini model)
- [x] 9 Critical Rules embedded in system prompt for step 7 (final prompt synthesis)
- [x] `services/prompt_builder.py`: Two paths — image-driven (from 7-step analysis) and idea-driven (from DB fields: slogan_text, visual_style, vibe, graphic_elements, tone)
- [x] Background color injection as final prompt instruction (hex + "solid, saturated, no gradients")
- [x] Fallback: image URL 403/404 → fall back to idea-driven prompt. Malformed analysis output → display raw in editor
- [x] Reuse check: if product already has `prompt_analysis` from prior PROJ-7 "Analyze Design" → skip re-analysis

---

## Phase A3: Design Generation API

### CRUD + Board Context

- [x] `GET /api/ideas/{id}/design-board/` — returns slogan, reference images (NicheResearchProduct with all analysis fields), existing designs. Workspace-scoped
- [x] `GET /api/ideas/{id}/designs/` — list all designs for idea with status, ordered by created_at desc
- [x] `PATCH /api/designs/{id}/` — update status (approved/rejected). Auto-reject previous approved when new one approved
- [x] `GET /api/designs/{id}/download/` — returns image file (FileResponse or redirect to signed URL)
- [x] `DELETE /api/designs/{id}/` — hard delete, workspace member or admin only

### Generation + Analysis

- [x] `POST /api/ideas/{id}/designs/generate/` — body: `{model, background_color, prompt}`. Enqueues django-rq job. Returns run record (status=pending). Retry once on OpenRouter timeout
- [x] `POST /api/designs/{id}/analyze-image/` — body: `{source_image_url}`. Enqueues Gemini 3 Architect analysis. Returns run record for polling
- [x] `GET /api/designs/runs/{run_id}/` — poll generation/analysis run status + result

### Batch Processing

- [x] `POST /api/designs/batch-process/` — body: `{design_ids: [...], steps: ["upscale", "bg_remove"]}`. Creates one `DesignProcessingJob` per (design × step). Returns job records
- [x] `GET /api/designs/processing-jobs/{job_id}/` — poll individual batch job status

### Serializers

- [x] `DesignSerializer` — all fields, nested `generation_run` (status, model, prompt), nested `idea` (id, slogan_text)
- [x] `DesignBoardSerializer` — slogan, reference images with analysis fields, designs list
- [x] `DesignGenerationRunSerializer` — status, prompt_used, model_name, timestamps
- [x] `DesignProcessingJobSerializer` — status, type, result_file URL, error_message

---

## Phase A4: Task Runner (django-rq)

- [x] `tasks.py: task_generate_design(run_id, project_id)` — call OpenRouter image generation API with prompt + model. Download result. Save to `Design.image_file`. Auto-link to project. Update run status
- [x] `tasks.py: task_analyze_image(design_id)` — call Gemini 3 Architect (7-step). Save structured output to `Design.prompt_analysis`. Return prompt to board
- [x] `tasks.py: task_upscale_design(job_id)` — read ProcessingSettings. Auto mode: check dimensions → Pica.js hint (return to client) or API call. Save to `Design.upscaled_file`
- [x] `tasks.py: task_remove_background(job_id)` — read ProcessingSettings. rembg (u2net) or API. Save to `Design.bg_removed_file`
- [x] Content policy refusal handling: `Design(status=failed, error_message=...)`
- [x] Per-job failure isolation: one failed job doesn't block batch
- [x] Langfuse observability on LLM calls (image analysis)

---

---

## Phase A5b: Frontend — PROJ-8 Integration (Deferred)

- [x] Reject idea warning: when rejecting an idea that has an approved `Design`, show MUI confirmation dialog warning before proceeding
- [x] Dialog text: "This idea has an approved design. Rejecting the idea will not delete the design, but it will no longer be linked to the pipeline. Continue?"
- [x] On confirm: proceed with rejection. On cancel: abort
- [x] i18n keys for dialog title, body, confirm/cancel buttons

---

## Phase A6: Frontend — PROJ-7 Integration ("Analyze Design")

> Updated: Uses new `POST /api/products/{product_id}/analyze-image/` endpoint (Phase C1.5)

- [x] "Analyze Design" button in PROJ-7 `ProductCard.tsx` and/or `ProductDetailPanel.tsx`
- [x] On click: call `POST /api/products/{product_id}/analyze-image/` with product image URL
- [x] Poll for analysis completion
- [x] On success: notistack toast "Design analyzed — prompt ready for Design Board"
- [x] Store `prompt_analysis` on `AmazonProduct` for reuse
- [x] i18n keys for analyze button + success/error messages
- [x] Reuse on Design Board: when loading idea context, check `AmazonProduct.prompt_analysis` — if exists, skip re-analysis

---

## Phase A7: RTK Query Slice + Types

- [x] RTK Query `designApi` slice (`store/designSlice.ts`): getBoardContext, listDesigns, generateDesign, analyzeImage, pollRunStatus, updateDesignStatus, downloadDesign, batchProcess, pollProcessingJob
- [x] Cache tags: `providesTags` on board/list; `invalidatesTags` on generate/approve/reject
- [x] Register slice in `store/index.ts`
- [x] TypeScript types: Design, DesignGenerationRun, DesignProcessingJob, BackgroundColor, DesignModel, DesignStatus, BoardContext

---

## Phase A8: i18n — Design Board

- [x] `design.board.*` — page title, analyze button, generate button, prompt placeholder
- [x] `design.model.*` — gemini_flash, gemini_pro, gpt_image, flux labels
- [x] `design.background.*` — light_gray, neon_pink, neon_green labels
- [x] `design.status.*` — pending, approved, rejected, failed
- [x] `design.gallery.*` — approve, reject, download, retry
- [x] `design.batch.*` — process button, upscale, bg_remove, progress, failure
- [x] `design.analyze.*` — button label, progress, success, error, fallback warning
- [x] `design.empty.*` — no designs, CTA
- [x] All 5 locales: EN, DE, FR, ES, IT

---

## Phase A9: Tests — Design Generation

### Backend

- [x] Model tests: DesignGenerationRun status transitions, Design auto-reject on new approve
- [x] Board context API: returns slogan + references + designs, workspace isolation
- [x] Generate API: enqueues job, returns run record, polls status
- [x] Analyze API: triggers Gemini 3, stores prompt_analysis, reuse check
- [x] Batch process: creates N jobs, individual failure isolation
- [x] Download API: returns file, 404 on missing
- [x] Workspace isolation on all endpoints

### Frontend

- [x] DesignBoardView: renders board with references + prompt + gallery
- [x] DesignCard: approve/reject toggles status, approved shows green border
- [x] PromptEditor: pre-fills from analysis, editable
- [x] BackgroundColorPicker: default light_gray, selection updates state
- [x] GenerationProgress: shows skeleton during pending, error with retry
- [x] BatchProcessPanel: select designs, trigger, per-job progress
- [x] TypeScript + ESLint + Ruff: 0 errors

---

## Phase B1: Post-Processing — Pipeline Model + API

- [x] `DesignPipeline` model: UUID pk, `workspace` FK, `name` CharField, `tools` JSONField (ordered list of `{tool_name, params, condition}` objects), `is_preset` BooleanField, `created_by` FK, `created_at`
- [x] Migration
- [x] `GET /api/designs/pipelines/` — list workspace pipelines/presets
- [x] `POST /api/designs/pipelines/` — create pipeline
- [x] `PATCH /api/designs/pipelines/{id}/` — update pipeline
- [x] `DELETE /api/designs/pipelines/{id}/` — delete pipeline
- [x] `POST /api/designs/apply-pipeline/` — body: `{design_ids: [...], pipeline_id}`. Enqueues server-side steps, returns client-side steps list for Konva.js execution

---

## Phase B2: Post-Processing — Server-Side Services

- [x] `services/bg_remover.py`: rembg wrapper (u2net model). Load model on first call, cache in memory. Input: image file path. Output: transparent PNG path. Fallback: external API if configured
- [x] `services/upscaler.py`: Auto-mode logic — check dimensions vs threshold → return "client" hint (Pica.js) or call external API. Input: image file + target dimensions. Output: upscaled file path
- [x] `ProcessingSettings` API: `GET/PATCH /api/designs/settings/` — workspace-scoped. Provider selection, API keys (encrypted), auto threshold
- [x] Settings UI serializer: provider choices, threshold, masked API keys

---

## Phase B3: Post-Processing — Editor UI (Konva.js + ReadyPixl Layout)

> Design decided 2026-03-30 via `/frontend-design`. ReadyPixl screenshots as reference.

### B3.1: Editor Shell + Routing

- [x] `DesignEditorView.tsx`: REWRITE — full layout: collapsible pipeline bar (top), left tool panel (280px), Konva.js canvas (center), thumbnail filmstrip (bottom)
- [x] Route `/design-editor` with optional query param `?designs=id1,id2` for preloading from Board
- [x] Sidebar entry under "Design Forge" — "Image Editor" with icon
- [x] Route registered in `App.tsx`

### B3.2: Pipeline Bar (Top, Collapsible)

- [x] `PipelineBar.tsx`: collapsible top bar. Row 1: active pipeline tools as colored pill-chips (drag-to-reorder via dnd-kit, ✖ to remove). Row 2 (expandable): available tools grouped with section labels
- [x] Tool groups with overline labels: **Standard** (Resize, Trim, Rotate, Filters, Distress, Color Removal, Speckle Remover, Transp. Cleaner, Watermark) | **Edge Cleanup** (Defringe, Shrink, Color Defringe, Edge Cleaner) | **AI Processing** (BG Remove, AI Upscale) | **Quality** (Transp. Highlighter, Compressor)
- [x] Click tool in available row → adds to active pipeline + appears in left panel
- [x] Collapse/expand toggle ('+' button or chevron)

### B3.3: Left Tool Panel (280px)

- [x] `ToolPanel.tsx`: scrollable left panel. Top: `PipelinePresetDropdown.tsx` (preset selector + "+ Save" button). Body: stacked tool config cards. Bottom: "Reset All" / "Remove All" buttons
- [x] `ToolConfigCard.tsx`: collapsible card per active tool — toggle on/off, expand/collapse chevron, ✖ remove, drag handle for reorder. Tool-specific params inside (sliders, toggles, buttons)
- [x] Drag-to-reorder cards (dnd-kit) — synced with pill bar order
- [x] `PipelinePresetDropdown.tsx`: MUI Select + save/load/delete presets via RTK Query

### B3.4: Canvas Area (Konva.js)

- [x] `EditorCanvas.tsx`: Konva.js Stage + Layer. Transparency checkerboard background. Renders current batch image. Zoom/pan controls
- [x] `BatchNavOverlay.tsx`: top-left overlay on canvas — compact `< > 2/100 🗑 ALL` navigation. Keyboard arrows supported
- [x] `CanvasToolbar.tsx`: floating vertical mini-toolbar top-right of canvas — Move, Eraser, Wand icons. Click to activate, cursor changes. Full params appear in left panel when active

### B3.5: Batch Thumbnail Strip (Bottom)

- [x] `BatchThumbnailStrip.tsx`: horizontal scrollable filmstrip pinned to bottom. Click to navigate. Status dot per image (pending=neutral, processed=success, error=error). Current image highlighted with coral border
- [x] Export button integrated in strip area — opens inline export controls
- [x] `ExportControls.tsx`: inline in strip — format (PNG), DPI (300), compression slider with live file size, download current / download all (zip), overwrite vs new version toggle

### B3.6: Empty State + Image Loading

- [x] `DropZone.tsx`: cyan dashed border (secondary #00C8D7), cloud icon, "Drop image here", "Browse Files" button. Drag-drop from desktop or Board
- [x] URL param preload: read `?designs=id1,id2`, fetch via RTK Query, populate batch
- [x] Drag-drop handler: accept 100+ images, show upload progress, populate filmstrip

### B3.7: Hooks

- [x] `usePipeline` hook: ordered tool list, add/remove/reorder, conditional logic, save/load presets, sync pill bar ↔ left panel (inline in DesignEditorView — no separate hook file yet)
- [x] `useBatchImages` hook: drag-drop handler, URL param loading, thumbnail navigation, per-image status tracking (inline in DesignEditorView)
- [x] `useCanvasTools` hook: active tool state, Konva.js integration, undo/redo stack (Ctrl+Z/Y) (inline in EditorCanvas)
- [x] `useProcessing` hook: trigger server-side jobs (BG remove, upscale), poll status, download results

---

## Phase B4: Post-Processing — Client-Side Tools

### Canvas Tools (Konva.js + Web Workers)

- [x] Resize/Reposition: target canvas (4500x5400 default), Align-to-Top, configurable padding
- [x] Color Removal: remove specific color from image (tolerance slider)
- [x] Color Adjustment: brightness, contrast, saturation sliders
- [x] Trim: auto-crop excess whitespace/transparency
- [x] Rotate/Flip: 90° rotation, horizontal/vertical flip
- [x] Filters: preset filters (brightness, contrast, saturation, hue shift)
- [x] Sprinkle/Speckle Remover: detect + remove small isolated pixel groups
- [x] Transparency Cleaner: remove near-transparent pixels below threshold
- [x] Distress: vintage/used-look texture overlay effects
- [x] Watermark: text + image watermark with position/opacity controls

### Edge Cleanup Tools

- [x] Auto-Detect Defringe: analyze edge pixels, detect color fringe, suggest shrink value
- [x] Manual Shrink: slider 0-5px with live preview on canvas
- [x] Color Defringe: detect background color in edge, replace semi-transparent edge pixels with nearest design color
- [x] Edge Cleaner: multi-step edge smoothing (anti-alias pass)

### Quality Control

- [x] Transparency Highlighter: overlay visualization — highlights semi-transparent pixels in red/yellow
- [x] Built-in Compressor: reduce file size <2MB. Quality slider with live size preview

### Manual Correction

- [x] Eraser Tool: brush-based pixel removal. Size slider, hardness slider
- [x] Magic Wand: click-to-select by color similarity. Tolerance slider. Delete/clear selection
- [x] Per-image preview in batch: click thumbnail → load in canvas → correct → next

---

## Phase B5: Post-Processing — Cloud Manager + Export

### Cloud Manager — Design Decisions
- **Component:** `CloudManagerDialog.tsx` (renamed from CloudImportDialog)
- **Dialog:** MUI Tabs (Google Drive | OneDrive), `maxWidth="md"`, fullscreen toggle button
- **Auth:** OAuth2 popup per provider, no page redirect
- **Google:** External + Testing Mode (MVP, up to 100 test users). Later: Google Verification (~1-2 weeks). Scope: `drive.file` (read+write own files). Env: `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY`
- **Google setup:** Enable Google Drive API, OAuth2 Client ID (Web), API Key restricted to Drive API
- **OneDrive:** Personal Microsoft accounts only (MVP). Later: Multi-tenant for Business/SharePoint. Scope: `Files.ReadWrite`. Env: `VITE_ONEDRIVE_CLIENT_ID`
- **Azure setup:** App registration (SPA), redirect URI localhost:5173 + prod, `Files.ReadWrite` delegated permission
- **No native pickers:** Custom folder browser + image table via Drive API / Graph API directly
- **File filter:** Images only (png/jpg/webp), no SVG for MVP. Max 25MB per file
- **SDK loading:** Dynamic on dialog open (lazy, no page load impact)
- **Missing env vars:** Tab shows "Not Configured" state with hint to set env vars

### Cloud Manager — Features
- **Folder browser:** Breadcrumb navigation, click folders to navigate, recursive scan (subfolders)
- **Image table:** Thumbnail (48px) | Folder path (relative) | Filename | Size | Actions
- **Actions per image:** Download (browser download) | Use for AI (fetches → File → onFilesAdded → Editor Batch)
- **Multi-select:** Checkboxes per row + bulk "Download Selected" / "Use Selected for AI" buttons
- **Upload to cloud:** Select target folder via browser → upload generated images from Batch (multi-select)
- **No auto-download:** Images shown as thumbnails/links only, downloaded on-demand

### Cloud Storage Settings
- **Reachable from:** Central App Settings + Design Editor Settings (Processing Settings UI)
- **Content:** Google Drive + OneDrive connection status, connected account (email), Connect/Disconnect buttons
- **Inline fallback:** CloudManagerDialog shows "Connect" button if not connected (quick-start without going to Settings)

### Tasks
- [x] `CloudManagerDialog.tsx`: Tabbed dialog (Google Drive | OneDrive), fullscreen toggle. Folder breadcrumb browser, recursive image scan, image table with thumbnails + actions (Download, Use for AI). Multi-select + bulk actions. Upload from Batch to selected cloud folder
- [x] `useGoogleDrive.ts`: Hook for Google Drive OAuth2 + Drive API (list folders, list images, download file, upload file). Dynamic gapi SDK loading
- [x] `useOneDrive.ts`: Hook for OneDrive MSAL auth + Graph API (list folders, list images, download file, upload file). Dynamic MSAL SDK loading
- [x] `CloudStorageSettings.tsx`: Connection management section (status, account email, connect/disconnect). Reusable in central Settings + Design Editor Settings
- [x] Integration: DropZone "Import from Cloud" button + BatchThumbnailStrip cloud icon → opens CloudManagerDialog
- [x] Integration: Upload flow — select images from Batch → choose cloud folder → upload
- [x] Env var template update: `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY`, `VITE_ONEDRIVE_CLIENT_ID` — added to `.env.dev.template` + `.env.prod.template`
- [x] `ExportDialog.tsx`: format (PNG/JPEG/WebP), DPI (72-600), quality/compression slider, download single or ZIP all. Overwrite vs new version. Advanced Export button in ExportControls. JSZip with progress. i18n synced (9 keys × 5 locales)
- [x] Pica.js integration: client-side upscaling for images ≥3000px (Lanczos3, Web Worker + WASM). Auto-mode routing (client/server). UpscaleToolParams UI with mode toggle. i18n synced (18 keys × 5 locales)

---

## Phase B6: i18n — Post-Processing Editor

- [x] `design.editor.*` — page title, drag-drop hint, batch count
- [x] `design.pipeline.*` — toolbar labels, preset save/load/delete, conditional logic labels
- [x] `design.tools.*` — all tool names (resize, trim, rotate, filters, eraser, wand, etc.)
- [x] `design.tools.params.*` — parameter labels per tool (size, tolerance, threshold, etc.)
- [x] `design.edge.*` — defringe, shrink, color defringe, edge cleaner labels
- [x] `design.qc.*` — transparency highlighter, compressor labels
- [x] `design.export.*` — format, DPI, compression, download labels
- [x] `design.cloud.*` — Google Drive, OneDrive, folder browser, image table, download, upload, connect/disconnect, settings labels (28 keys × 5 locales)
- [x] `design.settings.*` — provider labels, API key placeholder, threshold
- [x] All 5 locales: EN, DE, FR, ES, IT (482 design keys synced)

---

## Phase B7: Tests — Post-Processing

### Backend

- [x] Pipeline CRUD: create, update, delete, list presets
- [x] Apply pipeline: enqueues correct jobs per tool, returns client-side steps
- [x] BG remover service: rembg produces transparent PNG, API fallback works
- [x] Upscaler service: auto-mode routes correctly (client hint vs API)
- [x] ProcessingSettings: CRUD, encrypted API keys, workspace isolation

### Frontend

- [x] DesignEditorView: renders with empty state, drag-drop loads images
- [x] PipelineToolbar: add/remove/reorder tools, preset save/load
- [x] EditorCanvas: renders image, eraser tool removes pixels
- [x] BatchThumbnailStrip: navigation, status indicators
- [x] ExportDialog: format/DPI/compression controls work
- [x] TypeScript + ESLint + Ruff: 0 errors

---

## Phase B8: Bug Fixes + Live Preview Pipeline (2026-04-02)

> Discovered during manual QA. 4 issues: tool panel layout, project card sizing, image persistence, live preview architecture.

### B8.1: Tool-Panel Layout Fixes

- [x] Trim tool: "Auto-Detect" ToggleButton wraps to 2 lines → fix to single line (adjust padding/font or shorten label)
- [x] Resize & Reposition: title "Resize & Reposition" wraps awkwardly → fix header layout
- [x] Resize & Reposition: preset buttons "POD Standard (4500x5400)" / "Square (4500x4500)" overflow → replace with custom SVG icons (T-Shirt for POD, Square icon) + dimensions in Tooltip
- [x] Resize & Reposition: "Square (4500x4500)" text gets cut off → fixed by icon+tooltip approach
- [x] Audit all `toolParams/` components for 280px panel width compliance, fix any remaining overflows

### B8.2: Project Card — Halve Max Size

- [x] `ProjectGalleryView.tsx`: change Grid breakpoints from `xs: 12, sm: 6, md: 4, lg: 3` to `xs: 6, sm: 4, md: 3, lg: 2`
- [x] Adjust card thumbnail aspect ratio + card body if needed at smaller size
- [x] Verify responsive behavior at all breakpoints

### B8.3: Image Save — Fix Dropped Images Not Persisting

- [x] Trace drop flow: `useExternalDrop` → `uploadDesignToProjectMutation` → backend endpoint
- [x] Verify mutation fires correctly after Konva.js refactor (was working, now broken)
- [x] Ensure blob URL → server URL replacement works on upload success
- [x] Test: drop image → reload page → image still present

### B8.4: Live Preview per Tool (Architecture Change)

> Currently: tools only apply on "Apply Pipeline" click (batch).
> New: each enabled tool applies immediately on the selected image (live preview).
> "Apply Pipeline" remains for batch processing (all filmstrip images).

**D1 — Filmstrip Layout Refactor:**
- [x] `EditorCanvas.tsx` refactor: full-size view of currently selected image (top/center)
- [x] Thumbnail strip (bottom): all project images, clickable to switch active image
- [x] "+ ADD" button in filmstrip for adding new images
- [x] Image navigation: left/right arrows + "1 / N" counter (in BatchThumbnailStrip)
- [x] Drag & drop multiple images into editor → appear in filmstrip

**D2 — `useLivePreview` Hook:**
- [x] New hook: `useLivePreview(selectedImage, enabledTools, toolParams)`
- [x] `useEffect` on `[selectedImageId, enabledTools, toolParams]` with debounce (300ms for sliders, instant for toggles/presets)
- [x] Calls `processImage()` from `imageProcessing.ts` — chains all enabled tools in pipeline order
- [x] Returns `{ previewUrl, isProcessing }` — Object URL from Blob result
- [x] Cleanup: revoke old Object URLs on new preview
- [x] Cancellation: abort previous processing when new params arrive before completion

**D3 — Canvas Live Preview Integration:**
- [x] Canvas shows `previewUrl` when available, original URL otherwise
- [x] `LinearProgress` bar (small, subtle) while `isProcessing === true`
- [x] Tool Toggle ON → tool added to chain, recompute preview immediately
- [x] Tool Toggle OFF → tool stays in list (visually disabled/grayed out), skipped in chain computation, recompute immediately
- [x] Tool "X" remove → removed from list entirely + recompute
- [x] Parameter change → recompute (debounced for sliders)

**D4 — Apply Pipeline (Batch) — Existing Logic:**
- [x] "Apply Pipeline" button = existing `processBatch()` logic (unchanged)
- [x] Applies current enabled-tool chain to ALL filmstrip images
- [x] Progress per image (existing implementation)

### B8.5: Unified Tool Bar Redesign (2026-04-02)

- [x] Merge Tool Catalog + PipelineBar → single unified top bar with all tools as chips
- [x] Active tools = category-colored (filled), inactive = neutral/outlined
- [x] Single click inactive chip = add to pipeline, single click active = toggle ON/OFF, X = remove
- [x] Active chips sortable via dnd-kit drag
- [x] Vertical dividers between category groups for visual separation
- [x] Preset dropdown moved from bar → ToolPanel (above tool cards)
- [x] ToolPanel simplified: catalog section removed, only active tool cards + actions
- [x] Remove borderBottom from PipelineBarWrapper, borderRight from ToolPanelWrapper

### B8.6: Image Persistence + Upload Fix (2026-04-02)

- [x] `axiosBaseQuery`: detect FormData → set `Content-Type: multipart/form-data` (was blocked by global `application/json` header)
- [x] Editor hydrates persisted designs on mount via `useGetProjectBoardQuery` → `batchImages`

### B8.7: Live Preview Bug Fixes (2026-04-02)

- [x] `useLivePreview`: reset `previewUrl` to null on image switch (was showing old image's preview)
- [x] `EditorCanvas`: only `applyAutoFit` on batch image switch, not on preview URL changes (zoom was resetting to fit on every preview update)

### B8.8: Color Removal Upgrade + Transparency Cleaner (2026-04-02)

- [x] Color Removal: Auto-detect background color (sample 8 edge/corner points)
- [x] Color Removal: Auto/Manual mode toggle
- [x] Color Removal: Contiguous mode (BFS flood-fill from edges only)
- [x] Color Removal: Edge Refinement — Edge Trim (dilate mask, 0-10px) + Edge Feather (blur mask, 0-10px)
- [x] Color Removal: softEdge fix — inner 80% fully transparent, only outer 20% gradual alpha
- [x] Color Removal: Edge Trim fixed — was eroding (shrinking), now dilating (expanding into design)
- [x] Color Removal: Auto mode forces contiguous BFS (like ReadyPixl)
- [x] Color Removal: Edge Trim only with contiguous mode (non-contiguous = simple per-pixel)
- [x] ~~DEFERRED~~ Color Removal: quality gap vs ReadyPixl → **resolved in B8.10** (LAB color space, Fill Holes, improved sampling)
- [x] Transparency Cleaner: merged Transparency Highlighter into it (VIEW/DELETE mode)
- [x] Transparency Cleaner: ReadyPixl-style layout — THRESHOLD+Auto+VIEW/DELETE switch inline, highlight colors + visibility always visible
- [x] Transparency Highlighter removed from TOOL_CATALOG (functionality merged into Cleaner)

### B8.9: Tool Chip Redesign + Misc Fixes (2026-04-02)

- [x] Tool chips: MUI Outlined icons for all 16 tools (ToolIcons.tsx)
- [x] Tool chips: Tooltips with 1-sentence description per tool (all 5 locales)
- [x] Tool chips: Tooltip toggle switch (default OFF, 3s delay when ON)
- [x] Tool chips: Active chip hover — subtle brightness filter instead of BG fill
- [x] Tool chips: Inactive chip hover — border brightens, subtle BG tint
- [x] Pipeline presets: Save button updates existing preset when selected (was always creating new)
- [x] Color Removal: Tolerance default 30 → 4
- [x] Debounce increased from 300ms → 500ms for live preview stability

### B8.10: Color Removal Algorithm Upgrade (2026-04-02)

> Addresses B8.8 DEFERRED item — quality gap vs ReadyPixl. Replaces RGB Euclidean distance with CIE LAB Delta-E for perceptually accurate color matching. Adds Fill Holes inpainting and improved edge sampling.

**Algorithm Changes:**
- [x] CIE LAB color space: `srgbToLinear()` → `rgbToXyz()` → `xyzToLab()` conversion pipeline
- [x] Delta-E (CIE76) distance function replaces RGB Euclidean in all matching
- [x] Tolerance scale: 0-100 maps to 0-50 Delta-E (was 0-441 RGB Euclidean) — more intuitive
- [x] `autoDetectBgColor()`: 20 edge sample points (was 8) — 4 corners + 4 midpoints + 12 evenly-spaced
- [x] `autoDetectBgColor()`: clustering uses LAB Delta-E (was RGB Euclidean)
- [x] `buildContiguousMask()`: BFS flood-fill uses LAB Delta-E for pixel matching
- [x] `processColorRemoval()`: soft-edge gradient computed in LAB space
- [x] Non-contiguous mode: per-pixel check uses LAB Delta-E
- [x] Default `contiguous: true` (was false) — protects interior design elements by default

**Fill Holes (Inpainting):**
- [x] `fillInteriorHoles()`: finds transparent regions NOT connected to image border
- [x] BFS from border identifies "real" background vs interior holes
- [x] Iterative nearest-neighbor inpainting: fills holes from edges inward (4-connected avg)
- [x] Max 100 passes, handles arbitrarily large holes
- [x] New param: `fillHoles: boolean` (default false, only for non-contiguous mode)

**UI:**
- [x] "Fill Holes" toggle in `ColorRemovalToolParams.tsx` — only visible when non-contiguous
- [x] Hint text explains purpose
- [x] `useClientProcessing.ts`: resolver includes `fillHoles`
- [x] Unused `Chip` import removed from `ColorRemovalToolParams.tsx`

**i18n (all 5 locales):**
- [x] EN: "Fill Holes" / "Fill interior gaps left by color removal"
- [x] DE: "Löcher füllen" / "Innere Lücken nach Farbentfernung auffüllen"
- [x] FR: "Remplir les trous" / "Remplir les espaces intérieurs après suppression de couleur"
- [x] ES: "Rellenar huecos" / "Rellenar espacios interiores tras eliminar color"
- [x] IT: "Riempi buchi" / "Riempire spazi interni dopo la rimozione del colore"

**TypeScript + ESLint:** 0 new errors

**Trapped Background Removal (2nd pass — contiguous mode):**
- [x] `findTrappedBackground()`: after BFS, finds remaining matching-color pixels enclosed by design
- [x] Connected component labeling: groups remaining matching pixels into clusters
- [x] Small clusters (≤0.5% of image area) = trapped BG pockets → removed with soft-edge
- [x] Large clusters = intentional design elements → preserved
- [x] Opt-in via "Deep Clean" toggle (only visible in Contiguous mode)

**Calibration Fixes:**
- [x] Default tolerance 4 → 15 (Delta-E 12 covers typical BG variations)
- [x] Tolerance scaling: `tolerance * 0.8` (was 0.5 — too tight)
- [x] `autoDetectBgColor()`: fixed cluster threshold to Delta-E 15 (was tolerance-dependent — changing tolerance shifted detected color)
- [x] `autoDetectBgColor()`: removed unused `tolerance` parameter
- [x] Pre-computed Delta-E map: `precomputeDeltaEMap()` computes once, BFS + soft-edge + trapped-pass all read from it

**Cleanup (iteration 3):**
- [x] Removed `fillInteriorHoles()` inpainting — caused color artifacts on complex designs
- [x] Contiguous mode no longer forced in Auto mode — user controls via toggle
- [x] "Deep Clean" toggle only visible in Contiguous mode (where it makes sense)
- [x] Non-contiguous mode: no Deep Clean (already removes all matching pixels globally)
- [x] Recommended pipeline for complex designs: Color Removal (Contiguous) → Speckle Remover → Transparency Cleaner

### B8.11: Multi-Color Removal + HD Mode (ReadyPixl Feature Parity)

> Inspired by ReadyPixl v0.5.7 analysis. Two high-impact features for POD workflows.

**Multi-Color Removal (up to 3 colors):**
- [x] Extend `ColorRemovalParams` with `colors: Array<{ targetColor, tolerance, softEdge }>` (max 3)
- [x] UI: COLOR 1 / COLOR 2 / COLOR 3 tabs with "+" to add, "×" to remove — each tab has independent color picker + tolerance + soft edge
- [x] Processing: run removal pass per color sequentially (order: COLOR 1 → 2 → 3)
- [x] Single-color mode preserved as default (1 tab, same UX as before)
- [x] Contiguous / Fill Holes / Edge Trim / Edge Feather shared across all colors
- [x] i18n: tab labels + "Add Color" / "Remove Color" (all 5 locales)

**HD Mode (Auto-Upscale for Small AI Images):**
- [x] New toggle: "HD Mode" (Auto / On / Off) — default Auto
- [x] Auto logic: if image width or height < 3000px → upscale 2× with Pica.js (Lanczos) before processing
- [x] After color removal: downscale result back to original dimensions
- [x] Purpose: AI-generated images (1024px from OpenRouter) get precision processing on small details
- [x] Show indicator when HD Mode is active (e.g. "HD" badge on canvas)
- [x] i18n: "HD Mode" / hint text (all 5 locales)

**BG Preview Toggle (Quick Quality Check):**
- [x] Floating button group bottom-right of canvas: Black / White / Gray / Transparent / Custom background
- [x] Swaps the checkerboard/canvas background color for visual QC of removal edges
- [x] Default: Transparent (checkerboard)
- [x] i18n: button tooltips (all 5 locales)

### B8.11b: Color Removal Quality Upgrade + BG Remove E2E (2026-04-02)

> Improved Color Removal algorithm, wired up BG Remove (rembg) E2E, Docker migration Alpine→Debian.

**Color Removal Improvements:**
- [x] Wider soft edge zone (0.6 threshold start, +30% extension beyond threshold)
- [x] `decontaminateEdgeColors()` — replaces gray BG-tinted RGB on semi-transparent edge pixels with nearest opaque design pixel color
- [x] Contiguous mode: direct alpha falloff (removed broken `max(t, 1-strength)` logic)
- [x] Non-contiguous mode: same wider soft edge + decontamination
- [x] Defringe: gradual alpha fade instead of hard alpha=0 (outer pass=full, inner=partial)
- [x] Defringe: LAB Delta-E for auto-detect (was RGB Euclidean)
- [x] Defringe: `decontaminateEdgeColors` applied after erosion
- [x] Removed unused `buildContiguousMask` function (lint fix)

**BG Remove (rembg) — Full E2E:**
- [x] `BgRemoveToolParams.tsx` — Model dropdown (BiRefNet Lite, ISNet, U2Net, etc.) + "Remove Background" run button
- [x] `DesignEditorView.tsx` — `handleRunServerTool` runs single server tool on current image
- [x] `handleApplyPipeline` extended: sends server tools via `batchProcess` mutation
- [x] `handleJobUpdate` loads server-job results back into canvas
- [x] `useProcessing.ts` — `model` parameter passed through to backend
- [x] `ToolPanel.tsx` — `onRunServerTool` + `isServerProcessing` props
- [x] Artboard Canvas: BG Remove button wired (ToolsSection → PanelArtboardState → RightPanel → DesignWorkspaceView)
- [x] Server processing overlay on EditorCanvas (pulsing dimmed + CircularProgress + text)

**Backend:**
- [x] `backend.Dockerfile` — Alpine → Debian slim (opencv/onnxruntime compatible)
- [x] `requirements.txt` — `rembg>=2.0` + `onnxruntime>=1.17` added
- [x] `bg_remover.py` — model selection, session cache per model, default=`birefnet-general-lite`
- [x] `tasks.py` — `model_name` parameter on `task_remove_background`
- [x] `views.py` — `model` from request body passed to task
- [x] `ProcessingSettings` created with `bg_removal_provider=rembg`
- [x] BiRefNet Lite + BiRefNet Full models pre-downloaded in worker container
- [x] BiRefNet full removed from UI dropdown (OOM-kills Docker workers, needs >2GB RAM)

**Image Editor Fixes:**
- [x] Center-bug on image switch: `originalDimsRef` reset + set in onload before `setHtmlImage`
- [x] First-load positioning bug: `dims` fallback to `htmlImage` when ref is null
- [x] ResizeObserver re-fit: `applyAutoFit` called when container gets real size (was using default 800×600)
- [x] Show Original toggle: History icon button in canvas toolbar (shows original vs processed)
- [x] Editor hydration: prefers `bg_removed_file` over `image_file`, stores `originalUrl`
- [x] `BatchImage.originalUrl` field added to types

**Misc:**
- [x] `vector_app/signals.py` — removed Niche from embedding signals (name-only embedding is low-value)
- [x] Docker Desktop memory limit increased to 8GB
- [x] i18n strings for all new UI (EN)

### B8.12: Undo/Redo (Image Editor + Artboard Canvas)

> Both editor and canvas need undo/redo. Image Editor = undo pipeline apply / eraser strokes. Artboard Canvas = undo artboard move/resize/delete/add.
> **Completed 2026-04-03.** Bug found + fixed: `currentRef` stale-state issue — `undo()`/`redo()` now accept current state as parameter instead of relying on stale ref. Playwright-tested: all state transitions correct on both tabs.

**Image Editor — Undo/Redo:**
- [x] `useUndoRedo` hook: maintains stack of `BatchImage[]` snapshots (max ~20 entries)
- [x] Push snapshot before each Apply Pipeline + eraser stroke
- [x] Undo = restore previous snapshot, Redo = restore next
- [x] Wire into EditorCanvas toolbar (existing disabled buttons)
- [x] Keyboard shortcuts: Cmd+Z (undo), Cmd+Shift+Z (redo)
- [x] Disable buttons when stack empty

**Artboard Canvas — Undo/Redo:**
- [x] `useCanvasHistory` hook: tracks artboard state changes (position, size, add, delete, property changes)
- [x] Debounced snapshot on drag-end / resize-end (avoid per-pixel history entries)
- [x] Wire into BottomToolbar (existing disabled buttons)
- [x] Keyboard shortcuts: Cmd+Z / Cmd+Shift+Z
- [x] Disable buttons when stack empty

### B8.13: Delete Designs (Gallery + Canvas)

> Designs can be deleted from backend but no UI exists. Add delete options in Gallery and Canvas.
> **Completed 2026-04-03.** Gallery: 3-dot menu + ConfirmDialog. Editor: "Remove from batch" vs "Delete permanently" menu. Canvas: server-delete with confirmation for persisted designs. DimensionOverlay shows original→new dims after trim. Playwright-tested.

**Project Gallery — Delete Design:**
- [x] ProjectCard: 3-dot menu (IconButton) → "Delete Project" option
- [x] Confirmation dialog before delete
- [x] Call `DELETE /api/designs/projects/{id}/` endpoint
- [x] Invalidate RTK Query cache + remove from gallery

**Artboard Canvas — Delete Design from Server:**
- [x] Existing context menu "Delete" currently only removes from canvas state
- [x] Extend: also call `DELETE /api/designs/{id}/` for designs with `designId`
- [x] Confirmation dialog for server-persisted designs
- [x] Multi-select delete: bulk delete from server

**Image Editor — Delete from Batch:**
- [x] "Remove image" button: add option to also delete from server (if `designId` exists)
- [x] Differentiate "Remove from batch" vs "Delete permanently"

**Dimension Change Indicator:**
- [x] After auto-trim: show "1024×1024 → 866×505" in canvas footer or status bar
- [x] Only visible when dimensions changed (trim active)

---

## Phase C1: Backend — DesignProject Model + API

### C1.1: Model + Migration

- [x] `DesignProject` model: UUID pk, `workspace` FK, `name` CharField(200), `niche` FK (nullable, on_delete=SET_NULL), `board_layout` JSONField (nullable, default=None), `created_by` FK, `created_at`, `updated_at`
- [x] `DesignProjectDesign` through table: `project` FK, `design` FK, `added_at`. Unique together `(project, design)`
- [x] Make `Design.idea` nullable (was required FK → now nullable FK, on_delete=SET_NULL)
- [x] Make `DesignGenerationRun.idea` nullable (same reason — standalone generation has no idea)
- [x] Index on `(workspace,)` for DesignProject, `(project, design)` for through table
- [x] Migration (alter Design.idea + DesignGenerationRun.idea to nullable, add DesignProject + through table) — 0002 migration created
- [x] Admin registration for DesignProject

### C1.2: Project CRUD API

- [x] `GET /api/designs/projects/` — list workspace projects. Include design count, niche name, thumbnail (first design image). Ordered by updated_at desc
- [x] `POST /api/designs/projects/` — create project. Body: `{name, niche?}`. Returns project record
- [x] `GET /api/designs/projects/{id}/` — project detail with designs list
- [x] `PATCH /api/designs/projects/{id}/` — update name, niche binding, board_layout
- [x] `DELETE /api/designs/projects/{id}/` — delete project. M2M unlinked, designs NOT deleted
- [x] Workspace isolation on all endpoints

### C1.3: Project ↔ Design M2M API

- [x] `POST /api/designs/projects/{id}/designs/` — add design(s) to project. Body: `{design_ids: [...]}`
- [x] `DELETE /api/designs/projects/{id}/designs/{designId}/` — remove design from project (M2M unlink only)
- [x] `GET /api/designs/projects/{id}/board/` — board context: project designs, board_layout. Optional `?ideaId=xxx` for idea context overlay (slogan + references)

### C1.4: Standalone Generate Endpoint

- [x] `POST /api/designs/generate/` — body: `{model, background_color, prompt, project_id, idea_id?}`. Enqueues job. Auto-adds generated design to project. idea_id optional
- [x] Default project auto-creation: if `project_id` not provided and workspace has no projects → create "My Designs" project, use it
- [x] Update existing `POST /api/ideas/{id}/designs/generate/` to also accept optional `project_id`

### C1.5: Product Analyze Endpoint (PROJ-7 Integration)

- [x] Add `prompt_analysis` JSONField to `AmazonProduct` model (scraper_app). Migration — **run via Docker**
- [x] `POST /api/products/{product_id}/analyze-image/` — body: `{source_image_url}`. Enqueues Gemini 3 analysis. Stores result on `AmazonProduct.prompt_analysis`. Returns run record for polling
- [x] Reuse check: if `AmazonProduct.prompt_analysis` already populated → return it immediately (skip LLM call)

### C1.6: Serializers

- [x] `DesignProjectSerializer` — id, name, niche (nested: id, name), design_count, thumbnail, board_layout, created_at
- [x] `DesignProjectListSerializer` — compact: id, name, niche_name, design_count, thumbnail, updated_at
- [x] `DesignProjectBoardSerializer` — full board context: designs list, board_layout, optional idea context
- [x] Update `DesignSerializer` — add `projects` field (list of project IDs the design belongs to)

---

## Phase C2: Frontend — Project Gallery

### C2.1: Gallery Page

- [x] `ProjectGalleryView.tsx`: NEW — grid of project cards. Create button. Sidebar "Design Board" link → this page
- [x] `ProjectCard.tsx`: NEW — card with thumbnail (first design or placeholder), project name, design count, niche chip (if linked), click → `/design-board/:projectId`
- [x] Empty state: "No projects yet — create your first project" with CTA button
- [x] Create project dialog: text input for name, optional niche selector dropdown
- [x] Route `/designs` registered in `App.tsx`

### C2.2: Sidebar Update

- [x] Sidebar "Design Board" nav item → navigates to `/designs` (Project Gallery) instead of `/design-board`
- [x] Update i18n key if needed

### C2.3: RTK Query — Project Endpoints

- [x] `designSlice.ts`: add `listProjects`, `createProject`, `getProject`, `updateProject`, `deleteProject`, `addDesignsToProject`, `removeDesignFromProject`, `getProjectBoard`
- [x] Cache tags: `DesignProject`, `DesignProjectList`
- [x] TypeScript types: `DesignProject`, `CreateProjectBody`, `UpdateProjectBody`

### C2.4: i18n — Projects

- [x] `design.projects.*` — gallery title, create button, empty state, card labels, naming dialog
- [x] `design.projects.namingDialog.*` — title, niche option, slogan option, custom option, existing project option, placeholder, confirm, cancel
- [x] All 5 locales: EN, DE, FR, ES, IT

---

---

## Phase C4: Frontend — Niche Binding + Drawer Integration

### C4.1: Niche Binding UI

- [x] Project detail/settings: niche selector dropdown (link/unlink project to niche)
- [x] `PATCH /api/designs/projects/{id}/` with `{niche: nicheId}` or `{niche: null}` to unlink

### C4.2: Niche Drawer — Design Section

- [x] In niche detail drawer: show "Designs" section listing projects linked to this niche
- [x] Each project shows thumbnail + name + design count. Click → opens board
- [x] Empty state: "No design projects linked to this niche"

---

## Phase D: Unified Design Workspace (Artboard Canvas + Image Editor)

> Decided 2026-03-31. Replaces React Flow board (Phase A5) with Kittl-style artboard canvas.
> Merges `/design-board/:projectId` + `/design-editor` into single route `/designs/:projectId`.
> Two tab-modes: Artboard Canvas (Tab 1) + Image Editor (Tab 2). Independent, context-only transfer.

### D1: Cleanup — Remove React Flow, Unify Routes

- [x] Remove `@xyflow/react` from `package.json` (already removed)
- [x] Delete React Flow components: `ReferenceNode.tsx`, `GenerateHubNode.tsx`, `VariantNode.tsx`, `GeneratingNode.tsx`, `BoardMinimap.tsx`
- [x] Delete React Flow hooks: `useBoardNodes.ts` (converts to RF nodes/edges — no longer needed)
- [x] Keep and adapt: `useBoardContext.ts`, `useGeneration.ts`, `useDesignActions.ts`, `useImageAnalysis.ts`, `useBoardLayout.ts`, `useBatchProcess.ts`
- [x] Keep and adapt: `PromptBar.tsx`, `ModelSelector.tsx`, `BackgroundColorPicker.tsx`, `ConfigPanel.tsx`, `CanvasToolbar.tsx`, `ProjectNamingDialog.tsx`
- [x] Remove route `/design-board/:projectId` from `App.tsx`
- [x] Remove route `/design-editor` from `App.tsx`
- [x] Add route `/designs/:projectId` → new `DesignWorkspaceView.tsx`
- [x] Sidebar: remove "Image Editor" entry. Keep single "Design Board" → `/designs`
- [x] Update `ProjectCard.tsx` click target: `/designs/:projectId` (was `/design-board/:projectId`)
- [x] Update IdeaCard quick-jump: navigate to `/designs/:projectId?ideaId=xxx` (was `/design-board/...`)

### D2: Workspace Shell + Tab Switch

- [x] `DesignWorkspaceView.tsx`: NEW — project header (name, back, niche, settings) + polished tab toggle + active tab content area
- [x] Tab toggle buttons: "✦ Artboard Canvas" + "🔧 Image Editor" — prominent, visually polished (not generic MUI Tabs). Active = filled primary.subtle + glow. Inactive = transparent + secondary text
- [x] Tab state in URL: `?tab=canvas` (default) or `?tab=editor`
- [x] Both tabs render independently — no shared state except project ID and image context transfer
- [x] `useWorkspaceTab` hook: read/write tab from URL query param, preserve other params

### D3: Artboard Canvas (Tab 1) — Konva.js

### D3.1: Canvas Foundation

- [x] `ArtboardCanvas.tsx`: NEW — Konva.js Stage filling tab content area. Infinite pan (drag empty canvas) + zoom (scroll wheel, pinch). Canvas bg: dark `#1A1A2E` / light `#E8E8E8`. Grid dots at zoom >30%
- [x] `useArtboardCanvas` hook: NEW — canvas state (zoom, pan offset, stage dimensions). Callback ref + ResizeObserver. Wheel zoom (discrete + trackpad pinch). Fit-to-view
- [x] Fix Konva.js drag-and-drop bug: individual artboards must move independently without snapping back. Stage `draggable` for panning, artboard Groups `draggable` for repositioning

### D3.2: Artboard Component

- [x] `Artboard.tsx`: NEW — Konva Group containing: labeled frame above (text), white background rect, image inside, selection border (dashed blue `#4A9EFF` + resize handles on select). Draggable + selectable + resizable (corner drag handles)
- [x] `useArtboards` hook: NEW — manages artboard list (positions, sizes, selection state, connections). Loads from `board_layout`. Persists on change (debounced)
- [x] Click artboard = select (single). Shift+click = multi-select. Click empty canvas = deselect all
- [x] Drag-select rectangle: rubber-band selection for multiple artboards (`RubberBandSelection.tsx`)
- [x] Artboard labels: "Artboard 1", "AI Image Board", custom names. Editable on double-click label (`ArtboardLabelEditor.tsx`)

### D3.3: AI Image Board + Connection Arrows

- [x] `ConnectionArrow.tsx`: NEW — thin 1px Konva Arrow from source right-center to AI Board left-center. Color = `text.secondary`. Purely visual, not interactive
- [x] `addAiImageBoard(sourceId)` in `useArtboards` — creates new AI artboard 100px right of source, auto-connected
- [x] AI Image Board shows "✦ AI: {prompt}" label in cyan. Regeneration via PromptBar (RegenerateOverlay removed)
- [x] Connections stored in `board_layout.edges[]` as `{source, target}` (reused existing type)

### D3.4: Context Menu

- [x] `ArtboardContextMenu.tsx`: NEW — MUI Menu on right-click artboard: "Add AI Image Board", "Duplicate", "Delete", "Bring to Front", "Send to Back"
- [x] `CanvasContextMenu.tsx`: Right-click empty canvas: "Add Artboard" (upload image), "Paste" (placeholder)
- [x] `useContextMenu` hook: manages both menu states, coordinates, file-to-artboard creation

### D3.5: Right Panel (280px, always visible)

- [x] `RightPanel.tsx`: NEW — context-sensitive via `useRightPanelState` hook. Four modes:
- [x] Nothing selected (`PanelNoneState`): project search, "Project Colors", Tools grid
- [x] Artboard selected (`PanelArtboardState`): Size (W×H, preset dropdown: Square 1200, MBA 4500×5400), Layer (opacity), Color (bg hex), Clip Content toggle. Then Tools
- [x] AI Image Board selected: same + "Regenerate" button at top of Tools
- [x] Multi-select (`PanelMultiState`): "Open in Editor", "Delete All", "Export Selected"
- [x] `ToolsSection.tsx`: AI Board, Flatten, Upscale, Reframe, BG Remove

### D3.6: Bottom Toolbar

- [x] `BottomToolbar.tsx` + `.styles.ts`: NEW — 48px bar. Left: cursor, move, shapes (dropdown via `ShapesMenu.tsx`), brush, text, emoji, AI sparkle. Separator. Undo/Redo (disabled placeholder). Separator. Zoom (-, %, +, fit-to-view)
- [x] AI sparkle button → expands Prompt Bar

### D3.7: Prompt Bar (Collapsible Chat)

- [x] Rewrite `PromptBar.tsx` + `PromptBar.styles.ts` for new layout:
- [x] Collapsed: single-line "✨ Describe what you want to create..." input. Overlays bottom of canvas above toolbar
- [x] Expanded (on AI Board select or AI sparkle click): "Edit AI Image Board" header + ✖ close. Source→result thumbnails (48px). Multiline prompt. "Prompt builder" accordion. Model/Ratio/Style/BG selectors. Generate button (becomes "Regenerate" when AI artboard with image is selected). Prompt/model/bgColor auto-restored from selected artboard
- [x] Keep existing `ModelSelector.tsx` + `BackgroundColorPicker.tsx` embedded in expanded bar
- [x] Smooth slide-up animation (200ms ease). `usePromptBar` hook for auto-expand/collapse

### D3.8: Artboard Canvas Export

- [x] `ExportDialog.tsx` + `useExportArtboards` hook: export selected or all artboards
- [x] Format: PNG (default), DPI: 72-600 (default 300), quality slider
- [x] Download individual PNG or multiple as ZIP (JSZip)

### D3.9: External Drag-Drop + Empty State

- [x] `useExternalDrop` hook: drag image files from desktop onto canvas → creates new artboard at drop position. Cyan dashed `DropZoneOverlay` during drag. Browse Files via hidden file input
- [x] ~~Empty state~~ Removed per user feedback — clean canvas on first open

> **D3 completed 2026-03-31.** Bug fixes applied:
> - Zoom: trackpad pinch uses continuous scaling, mouse wheel scales by deltaY magnitude
> - Artboard resize: corner handles are draggable (all 4 corners, min 40px)
> - Global chat bar hidden on `/designs/:id` route (AppLayout pattern match)
> - `crossOrigin='anonymous'` skipped for blob/data URLs (image loading fix)
> - ResizeObserver: callback ref pattern for lifted hook (stageWidth was 0)
> **Known issues:** ~~Dropped images not persisted~~ Fixed — upload endpoint + auto-upload wired. Zoom feel needs further tuning.

### D4: Image Editor Integration (Tab 2)

- [x] Move existing `DesignEditorView` content into `EditorTab.tsx` (or render inline). Remove standalone route dependency
- [x] Editor receives images via context: when user clicks "Open in Editor" from Canvas tab, selected artboard images are passed as batch
- [x] Also supports standalone use: drop images, browse files, URL param `?tab=editor&images=id1,id2`
- [x] No dependency on Canvas tab — works independently with its own pipeline, canvas, export

### D5: Hooks Refactor

- [x] `useBoardContext` → already uses `getProjectBoard` endpoint (no changes needed)
- [x] `useBoardLayout` → deleted (dead code, fully replaced by `useArtboards` which handles layout persistence)
- [x] `useGeneration` → already uses project-scoped `POST /api/designs/generate/` with `{project_id, idea_id?}` and invalidates `DesignProject` cache
- [x] `useDesignActions` → already passes `projectId` to mutations; `designSlice` invalidates `DesignProject` cache
- [x] `useImageAnalysis` → already invalidates `DesignProject` cache
- [x] Remove `useBoardNodes` — already deleted in prior phase (React Flow removal)

### D6: i18n — Workspace + Artboard Canvas

- [x] `design.workspace.*` — tab labels (Artboard Canvas, Image Editor), workspace title
- [x] `design.artboard.*` — artboard labels, context menu items, selection actions
- [x] `design.canvas.*` — toolbar labels, zoom, empty state, export
- [x] `design.prompt.*` — collapsed placeholder, expanded header, prompt builder
- [x] Update existing `design.board.*` keys as needed
- [x] All 5 locales: EN, DE, FR, ES, IT

> **Phase D (Unified Design Workspace) completed 2026-04-01.** All frontend work done.
> **Backend for Artboard Canvas completed 2026-04-01.** All 26 RTK Query endpoints matched. Added: image upload (`POST /projects/{id}/upload/`), designs by IDs (`GET /designs/?ids=...`). Board layout persistence + design generation were already working.
>
> **AI Generation E2E verified 2026-04-01.** Fixes applied:
> - **OpenRouter model IDs:** `gemini-2.5-flash-preview` → `gemini-2.5-flash-image`, `gemini-2.5-pro-preview` → `gemini-3-pro-image-preview`
> - **Image extraction:** Added `message.images[]` parsing (Gemini returns images separately from `content`)
> - **useGeneration hook wired:** Skeleton artboard on canvas during generation, auto-replaced with image on completion
> - **SkeletonPulse:** Konva.js animated pulse overlay ("Generating...") while waiting for API
> - **Prompt persistence:** `ArtboardData.promptUsed/modelUsed/bgColorUsed` stored per artboard. Hydrated from backend `DesignGenerationRun.prompt_used` on reload
> - **Regenerate flow:** PromptBar shows saved prompt + "Regenerate" button when AI artboard selected. Old `RegenerateOverlay` removed
> - **Artboard hydration:** Designs with `generation_run` hydrate as `kind: 'ai'` with cyan "✦ AI:" label
> - **ProjectUploadView fix:** Removed redundant `files=request.FILES` (DRF handles automatically)

---

## Verification Checklist

### Phase A: Backend + Generation (all done)
- [x] `design_app` registered, migrations applied
- [x] Gemini 3 Architect analysis pipeline
- [x] 4 AI models, 3 background colors
- [x] Batch upscale + bg_remove
- [x] "Analyze Design" in PROJ-7 UI
- [x] Reject idea with approved design → warning dialog
- [x] worker-design runs independently
- [x] Langfuse observability

### Phase C: Design Projects (backend + gallery done)
- [x] DesignProject model + M2M + CRUD API + workspace isolation
- [x] Standalone generate endpoint + default project auto-creation
- [x] Product analyze endpoint (PROJ-7)
- [x] Project Gallery frontend + naming dialog
- [x] Niche binding + drawer integration
- [x] RTK Query + i18n

### Phase D: Unified Design Workspace (completed 2026-04-01)
- [x] React Flow removed, routes unified to `/designs/:projectId`
- [x] Workspace shell with polished tab toggle (Canvas / Editor)
- [x] Artboard Canvas: Konva.js infinite zoom canvas with artboard paradigm
- [x] Artboards: freely movable, selectable (dashed blue border + resize handles)
- [x] AI Image Boards with thin arrow connections
- [x] Right panel (280px, always visible, context-sensitive)
- [x] Bottom toolbar (cursor/move/shapes/brush/text/emoji/AI/undo/redo/zoom)
- [x] Collapsible Prompt Bar (chat-style, collapsed one-liner → expanded editor)
- [x] Multi-select artboards → "Open in Editor" tab switch
- [x] Canvas export (selected/all artboards, PNG/ZIP)
- [x] External drag-drop onto canvas
- [x] Image Editor as Tab 2 (existing code, standalone, context-only)
- [x] Konva.js drag-and-drop bug fixed (artboards move independently)
- [x] Board layout persistence on DesignProject

### Phase B: Post-Processing Editor (existing — becomes Tab 2)
- [x] Pipeline bar, tool panel, canvas, batch strip, export controls
- [x] Client-side tools: resize, trim, rotate, filters, defringe, eraser, wand
- [x] AI BG Remove + AI Upscale auto-mode
- [x] Cloud Manager (Google Drive + OneDrive): browse, download, use for AI, upload
- [x] Settings UI: provider selection, API keys, threshold
- [x] All tests pass, lint clean *(Phase C tests covered in DesignWorkspaceView.test.tsx)*

### Phase B8: Bug Fixes + Live Preview + Tool Upgrades (2026-04-02)
- [x] Tool panel layout: all toolParams fit 280px without overflow
- [x] Resize presets: SVG icons + tooltip (no text overflow)
- [x] Project cards: halved max size (Grid lg:2)
- [x] Dropped images persist after page reload
- [x] Live preview: enabled tools apply immediately on selected image
- [x] Filmstrip: thumbnail strip, navigation arrows + counter, multi-image support
- [x] "Apply Pipeline" = batch only (all filmstrip images)
- [x] Unified Tool Bar: catalog + pipeline merged into single top bar
- [x] Upload fix: FormData Content-Type header, editor hydration on mount
- [x] Live preview: image switch resets preview, zoom stays stable during processing
- [x] Color Removal: auto-detect, contiguous, edge trim/feather
- [x] Transparency Cleaner: merged highlighter, ReadyPixl-style UI
- [x] Undo/Redo: Image Editor (useUndoRedo) + Artboard Canvas (useCanvasHistory), Cmd+Z/Shift+Z
- [x] Delete Designs: Gallery 3-dot menu, Editor remove/delete menu, Canvas server-delete + confirmation
- [x] Dimension Change Indicator: shows original→new dims after trim/resize

---

## Phase C: Canvas Element Manipulation (AC-65 to AC-83)

### Phase C1: Element Data Model + Core Hook

- [x] `CanvasElement` type in `board/types/index.ts`: id, type (image|text|shape|brush|emoji), x, y, width, height, rotation, scaleX/Y, opacity, visible, locked, zIndex, props (type-specific)
- [x] Extend `BoardLayout` nodes to include `layers: CanvasElement[]`
- [x] `useCanvasElements.ts` hook: addElement, removeElement, updateElement, reorderElement, getElementsForArtboard. Integrates with existing `persistLayout` (debounced save)
- [x] Integrate with `useCanvasHistory` — element changes trigger undo/redo snapshots
- [x] Hydration: load `layers` from `board_layout.nodes[].layers` on mount

### Phase C2: Element Selection + Transform

- [x] `useElementSelection.ts` hook: selectedElementId, selectElement, deselectElement, isElementSelected. Separate from artboard selection
- [x] Click element inside artboard → select element (not artboard). Click artboard frame → select artboard. Click empty canvas → deselect all
- [x] Selected element: Konva `Transformer` component (resize handles + rotation handle). Aspect ratio locked by default, Shift = free
- [x] Double-click image element → free-transform mode (move + scale + rotate). Click outside → exit to normal select
- [x] `PanelElementState.tsx`: right panel shows element properties when element selected (instead of artboard properties)
- [x] Element drag → stays within artboard coordinate space. Artboard move → all child elements move with it

### Phase C3: Image Layer

- [x] Existing artboard image becomes a `CanvasElement` of type `'image'` (first layer, auto-created on hydration)
- [x] `ImageLayer.tsx` Konva component: renders `KonvaImage` with transform support
- [x] Image click → select as element. Resize handles with aspect lock
- [x] Double-click → free-transform (rotate enabled). Single click → move + scale only
- [x] Image properties in PanelElementState: opacity, position (x/y), dimensions (w/h read-only)

### Phase C4: Text Tool

- [x] Text tool button in BottomToolbar wired to `activeTool === 'text'`
- [x] `useTextEditing.ts` hook: handles text creation, inline editing (HTML textarea overlay positioned over Konva text), commit on blur/escape
- [x] `TextLayer.tsx` Konva component: renders `Konva.Text` with all style properties
- [x] Click on artboard with text tool → inserts text element at click position, opens inline editor
- [x] `TextProperties.tsx` in PanelElementState: font family dropdown (system fonts + Google Fonts top 30), font size, color picker, bold/italic toggles
- [x] Advanced text: outline (stroke color + width), drop shadow (color, offsetX/Y, blur), letter-spacing slider, line-height slider
- [x] Curved text: arc angle slider (-180° to +180°). Konva `textPath` or manual arc rendering. Live preview on canvas
- [x] Text effects: gradient fill (2-color, linear/radial direction), 3D emboss (layered shadow stack). Applied via effects section in TextProperties
- [x] Self-hosted fonts: Inter + JetBrains Mono as `.woff2` in `public/fonts/`, `@font-face` with `font-display: swap`, no Google CDN

### Phase C5: Shapes Tool

- [x] Shape tool dropdown wired — selecting tool sets `activeTool` to specific shape type
- [x] `useDrawingHandlers.ts` hook: onMouseDown → start shape, onMouseMove → resize preview, onMouseUp → commit shape element
- [x] `ShapeLayer.tsx` Konva component: renders Rect, Ellipse, RegularPolygon (triangle), or Line based on `shapeType`
- [x] `ShapeProperties.tsx` in PanelElementState: fill color, stroke color, stroke width. Rectangle: corner radius slider
- [x] Pen tool: `usePenTool.ts` hook — click to add points, double-click to finish, click first point to close. Creates shape element with `points` array
- [x] Pen path rendering: `Konva.Line` with `closed` flag + `tension` for smoothing

### Phase C6: Brush Tool

- [x] Brush tool button wired to `activeTool === 'brush'`
- [x] Mouse down + move → captures points array. Mouse up → commits as brush element
- [x] `BrushLayer.tsx` Konva component: renders `Konva.Line` with `lineCap: 'round'`, `lineJoin: 'round'`, tension smoothing
- [x] `BrushProperties.tsx` in PanelElementState: stroke width slider (1-50px), color picker
- [x] Brush strokes grouped: consecutive strokes within 2s → merge into single "Drawing" layer for cleaner layer panel

### Phase C7: Emoji

- [x] Emoji button → triggers native OS picker (`window.EyeDropper` pattern or focused hidden input for emoji keyboard). Fallback: text input for paste
- [x] Selected emoji → rasterized to image: hidden canvas `fillText` at 64px → `toDataURL` → creates image element
- [x] `EmojiLayer.tsx` Konva component: renders as `KonvaImage` from rasterized data URL
- [x] Emoji movable, scalable, deletable like any element

### Phase C8: Layer Panel

- [x] `LayerPanel.tsx` in RightPanel: shows when artboard selected. Lists all layers of selected artboard
- [x] Each layer row: type icon (🖼/T/▢/🖌/😊), name/preview, eye icon (visibility toggle), lock icon (lock toggle)
- [x] Drag-reorder layers (dnd-kit `useSortable`): updates `zIndex` values, re-renders canvas in new order
- [x] Click layer → selects element on canvas. Select element on canvas → highlights layer in panel. Bidirectional sync via `useElementSelection`
- [x] Virtualized list for 50+ layers (MUI `List` with fixed height, scrollable)
- [x] Layer naming: auto-generated (`Text 1`, `Rectangle 2`, etc.), editable on double-click

### Phase C9: i18n — Canvas Elements

- [x] `design.canvas.tools.*` — shape names, brush, text, emoji labels (covered by `design.toolbar.*` from Phase D6)
- [x] `design.canvas.layers.*` — layer panel labels (title, empty, visible, lock, rename) + `design.panel` element keys (12 keys). All 5 locales. Fixed duplicate `canvas` key in EN locale
- [x] `design.canvas.text.*` — font, size, bold, italic, outline, shadow, arc, gradient, effects
- [x] `design.canvas.shapes.*` — fill, stroke, corner radius, pen tool
- [x] `design.canvas.brush.*` — color, size, smoothing
- [x] All 5 locales: EN, DE, FR, ES, IT (text 16 keys + shapes 9 keys + brush 3 keys synced)

### Completion Checklist — Phase C

- [x] Image layer: click, move, scale (aspect lock), double-click free-transform
- [x] Text tool: insert, edit inline, font/size/color, outline/shadow, curved text, gradient/3D
- [x] Shapes: rect, ellipse, triangle, line, pen tool freeform
- [x] Brush: freehand strokes, size + color
- [x] Emoji: native picker, rasterized as image layer
- [x] Layer panel: list, drag-reorder, visibility, lock, bidirectional selection
- [x] All elements belong to parent artboard (move together)
- [x] All element data persisted in board_layout (survives reload)
- [x] Undo/redo works for element operations
- [x] i18n synced (5 locales) — canvas text/shapes/brush keys added to DE/FR/ES/IT
- [x] All tests pass, lint clean *(Phase C tests covered in DesignWorkspaceView.test.tsx)*

---

---

## Phase F: Curved Text Canvas Rendering (AC-72) ✅ DONE

> ~~AC-72 partial: Slider exists in TextProperties but TextLayer has no TextPath rendering.~~ AC-72 fully implemented. AC-73 (Gradient/3D) also implemented (not deferred).

### F1: TextPath Rendering

- [x] `TextLayer.tsx`: implement curved text rendering using Konva `TextPath` component
- [x] When `arcAngle !== 0`: compute SVG arc path from text width + arcAngle value, render text along path
- [x] When `arcAngle === 0`: render as normal `Konva.Text` (existing behavior)
- [x] Arc range: -180° to +180° (slider already exists in TextProperties)
- [x] Live preview: arc updates immediately as slider moves
- [x] Persist `arcAngle` in layer data (already in `CanvasElement.props.arcAngle` — no model change)

### F2: Edge Cases + Clamp

- [x] EC-21: Extreme arc values → clamp to prevent text overlapping itself. Min arc based on text length
- [x] Empty text + arc → no render (prevent crash)
- [x] Undo/redo: arc changes included in canvas history (already via `useCanvasElements`)

### F3: Defer AC-73

- [x] ~~Add note in spec AC-73: "Deferred to post-MVP — gradient fill + 3D/emboss text effects"~~ — AC-73 implemented: gradient fill (2-color, linear/radial) + 3D emboss in TextEffectSections.tsx
- [x] ~~Remove or comment out any placeholder UI for gradient/3D in TextProperties~~ — gradient/3D fully functional, no placeholder needed

---

## QA Fixes — Phase C (einsortiert in bestehende Phasen)

> Issues from Phase C QA Report (2026-04-03). Integrated into relevant phases.

### QA-C: Lint + Code Quality Fixes

- [x] Fix `usePenTool.ts:77` — `react-hooks/set-state-in-effect` error *(resolved — proper useEffect with cleanup)*
- [x] Fix `usePenTool.ts:82` — remove unused/wrong eslint-disable comment *(resolved)*
- [x] Fix `ArtboardCanvas.tsx:147` — remove unused `hasContent` variable
- [x] Fix `ArtboardCanvas.tsx:290` — remove unused `openFilePicker` variable
- [x] Fix `ArtboardElement.tsx:48` — `react-hooks/set-state-in-effect` error *(resolved — proper useEffect with [imageSrc] dep)*
- [x] Fix `ImageLayer.tsx:48` — `react-hooks/set-state-in-effect` error *(resolved — proper useEffect with [src] dep)*
- [x] Extract `CanvasTool` type from `partials/BottomToolbar.tsx` → `types/index.ts` (fix hooks-to-partials coupling)

### QA-C: File Size Splits (>300 lines)

- [x] Split `types/index.ts` (370 lines): extract element-specific interfaces to `types/elements.ts`
- [x] Split `useCanvasElements.ts` (320 lines): extract element CRUD helpers to `utils/elementHelpers.ts`
- [x] Split `LayerPanel.tsx` (364 lines): extract `SortableLayerRow` to `partials/rightPanel/SortableLayerRow.tsx`
- [x] Split `PanelElementState.tsx` (392 lines): extract shared styled components to `partials/rightPanel/ElementPanel.styles.ts`
- [x] Split `TextProperties.tsx` (414→266 lines): extract sub-sections → `TextEffectSections.tsx` (OutlineSection, ShadowSection, CurvedTextSection, GradientSection, EmbossSection)

### QA-C: Bug Fixes

- [x] M5: Move module-level `nameCounters` in `useCanvasElements.ts` into `useRef` — scope per hook instance, prevent stale counters across re-mounts
- [x] M2: Wire Shift-key to free-scale on image elements (AC-66). `useShiftKey()` hook in ArtboardElement.tsx, Shift toggles `keepRatio` on Transformer
- [x] m4: Extract duplicate styled components (`Section`, `SectionLabel`, `FieldRow`, `FieldLabel`, `ColorInput`) from TextProperties/ShapeProperties/BrushProperties/PanelElementState → shared `rightPanel/ElementPanel.styles.ts`
- [x] m2: Replace hardcoded colors in canvas hooks + properties panels with design system tokens. Added `COLORS.selection` token. Updated: useTextEditing, RubberBandSelection, Artboard, SnapGuides, ConnectionArrow, ElementPanel.styles

---

## Phase G: Slogan → Design Forge Bulk Flow (AC-89 to AC-106)

> Bridge between PROJ-8 (Slogan Refinery) and PROJ-9 (Design Forge). Slogans as a "pool" per project with bulk auto-prompt and bulk generation.

### G1: Backend — DesignProjectIdea Model (AC-89)

- [x] `DesignProjectIdea` through table: project FK (CASCADE), idea FK (CASCADE), position IntegerField (default=0), added_at DateTimeField (auto_now_add). unique_together: (project, idea)
- [x] Add `ideas` M2M field on `DesignProject` model via through table
- [x] Migration — **run via Docker** (0004_phase_g_models + 0005_phase_g_complete)
- [x] Admin registration for `DesignProjectIdea`
- [x] Index on `(project, idea)` for fast lookups

### G2: Backend — Slogan Pool CRUD API (AC-90 to AC-93)

- [x] `POST /api/designs/projects/{id}/ideas/` — body: `{idea_ids: [uuid, ...]}`. Creates `DesignProjectIdea` per idea. Auto-assigns position. Idempotent (ignores existing). Returns updated list. Workspace isolation (AC-91)
- [x] `DELETE /api/designs/projects/{id}/ideas/{ideaId}/` — removes M2M link only, idea not deleted. 404 if not in pool (AC-92)
- [x] Extend `CreateProjectSerializer` — accept optional `idea_ids` list. On create: bulk-create `DesignProjectIdea` for each (AC-90)
- [x] Extend `ProjectBoardView` response — include `ideas` array with per-slogan: id, slogan_text, signal_type, market_confidence, emotional_archetype, pattern_used, why_it_works, niche_name, position, reference_products (reuse `_get_reference_products` helper), design_count (AC-93)
- [x] `ProjectIdeaSerializer` — serializes slogan pool items with all metadata fields + nested reference_products
- [x] Workspace isolation on all new endpoints — verify idea belongs to same workspace


### G4: Frontend — Drawer Multi-Select (AC-94 to AC-96)

- [x] `CollectedItemsSection.tsx`: add `selectedIds: Set<string>` state. Each approved slogan chip gets a Checkbox. Pending/rejected slogans not selectable (EC-31)
- [x] "Select All" / "Deselect All" toggle link above slogan chips
- [x] Action bar: appears when `selectedIds.size > 0`. Shows "Forge N Slogans" button (primary color, coral accent)
- [x] "Forge N Slogans" click → opens `ProjectNamingDialog` with `ideaIds={Array.from(selectedIds)}` prop
- [x] Selection resets when drawer closes
- [x] i18n keys: `ideas.drawer.selectAll`, `ideas.drawer.deselectAll`, `ideas.drawer.forgeCount`

### G5: Frontend — ProjectNamingDialog Extension (AC-96)

- [x] New prop `ideaIds?: string[]` on `ProjectNamingDialog`
- [x] On "Create new project": `POST /api/designs/projects/` with `{name, niche, idea_ids}` → navigate to `/designs/:projectId`
- [x] On "Add to existing project": `POST /api/designs/projects/{id}/ideas/` with `{idea_ids}` → navigate to `/designs/:projectId`
- [x] `IdeaCard.tsx` (Slogan Refinery): brush button now opens dialog with `ideaIds={[idea.id]}` — slogan added to pool on create/add (AC-106)

### G6: Frontend — Slogan Pool in RightPanel (AC-97 to AC-100)

- [x] `SloganPoolSection.tsx` (NEW — `rightPanel/`): header "Slogan Pool (N)", slogan card list. Empty state: "Add slogans from Niche Pipeline or Slogan Factory"
- [x] `SloganPoolCard.tsx` (NEW — `rightPanel/`): slogan text (Typography noWrap + Tooltip), signal_type badge (Chip), niche chip. "Insert" IconButton (inserts slogan into PromptBar). Remove (✕) IconButton. Expandable Accordion with why_it_works, emotional_archetype, pattern_used
- [x] Integrate in `PanelNoneState.tsx`: render `SloganPoolSection` when `ideas.length > 0`
- [x] `DesignWorkspaceView.tsx`: read `boardData.ideas` from `useGetProjectBoardQuery`, pass as `ideas` prop to `RightPanel` → `PanelNoneState`
- [x] Reference product thumbnail click → calls `onAddReferenceArtboard(imageUrl)` → creates new artboard on canvas with product image (AC-99)
- [x] Remove button → `DELETE /api/designs/projects/{id}/ideas/{ideaId}/` mutation → RTK Query invalidation refreshes pool


### G8: i18n — Slogan Pool

- [x] New keys: `design.sloganPool.title`, `design.sloganPool.empty`, `design.sloganPool.insert`, `design.sloganPool.remove`, `design.actions.forgeSlogan`
- [x] All 5 locales: EN, DE, FR, ES, IT

### G9: Backend — ProjectPrompt Model + API (AC-107 to AC-112)

- [x] `ProjectPrompt` model: UUID pk, project FK (CASCADE), prompt_text TextField, sources JSONField, source_idea FK (nullable, SET_NULL), source_image_url URLField (nullable), variant_index IntegerField (default=0), created_at, updated_at
- [x] Migration — **run via Docker** (0004_phase_g_models + 0005_phase_g_complete)
- [x] Admin registration
- [x] Index on `(project, created_at)` for list queries
- [x] `POST /api/designs/projects/{id}/prompts/` — bulk create. Body: `{prompts: [{prompt_text, sources, source_idea?, source_image_url?, variant_index?}]}`. Returns created records (AC-108)
- [x] `PATCH /api/designs/projects/{id}/prompts/{promptId}/` — edit prompt_text only (AC-109)
- [x] `DELETE /api/designs/projects/{id}/prompts/{promptId}/` — delete prompt. Designs generated from it remain unaffected (AC-110)
- [x] Extend `ProjectBoardView` response — include `prompts` array ordered by created_at desc (AC-111)
- [x] `POST /api/designs/projects/{id}/prompts/{promptId}/generate/` — create DesignGenerationRun from saved prompt. Links to source_idea if present. Same RQ job as existing generate (AC-112)
- [x] `ProjectPromptSerializer` — all fields, nested source_idea summary (id, slogan_text), `is_generated` boolean computed field (true if linked DesignGenerationRun with status=completed exists)
- [x] Add `project_prompt` FK (nullable, SET_NULL) on `DesignGenerationRun` model — back-reference for tracking which prompt a run was generated from (AC-112b). Migration — **run via Docker**
- [x] Workspace isolation on all endpoints

### G10: Backend — Prompt Builder + Presets (AC-119 to AC-131)

- [x] `POST /api/designs/projects/{id}/build-prompts/` — body: `{sources: {slogan: bool, keywords: bool, research: bool, web_research: bool, image: bool}, slogan_id?: uuid, image_url?: string, variants: int (1-5)}`. Server-side: gathers enabled source data → calls extended `prompt_builder` → returns `{prompts: [{prompt_text, sources}]}`. Does NOT auto-save (frontend decides to save or edit first)
- [x] Extend `prompt_builder.py` — new `build_from_sources(sources_config, idea?, keywords?, research_data?, image_analysis?)` function. Combines selected sources into prompt following 9 critical rules. Support for variants (different stylistic approaches per variant)
- [x] Keywords source: `build-prompts` endpoint fetches keywords server-side via `keyword_app` models (NicheKeyword for the project's linked niche). Falls back gracefully if niche has 0 keywords (EC-44). Integrates top keywords into prompt as design theme terms
- [x] Web Research source: accepts PROJ-17 web research results if available. Adds trend/market context to prompt
- [x] Image source: if image_url provided + sources.image=true → runs Gemini 3 Architect 7-step analysis (reuse existing `image_analyzer.py`). Merges visual analysis into prompt
- [x] `PromptPreset` model: UUID pk, workspace FK, name CharField (max 100), source_config JSONField, created_by FK, created_at
- [x] Migration for PromptPreset — **run via Docker** (0004_phase_g_models)
- [x] `GET /api/designs/prompt-presets/` — list workspace presets
- [x] `POST /api/designs/prompt-presets/` — create preset. Body: `{name, source_config}`
- [x] `DELETE /api/designs/prompt-presets/{id}/` — delete preset
- [x] Seed 3 default presets on workspace creation: "Full Context" (all on), "Slogan Only" (slogan on, rest off), "Image Analysis Only" (image on, rest off)

### G11: Frontend — RightPanel Command Center (AC-113 to AC-118)

- [x] Refactor `PanelNoneState.tsx` into 3 collapsible sections: **Slogan Pool** (top), **Prompts** (middle), **Artboards** (bottom). Each with header + collapse toggle
- [x] `PromptListSection.tsx` (NEW — `rightPanel/`): lists all `ProjectPrompt` records. Each card: truncated text (expandable), source chips (Slogan/Keywords/Research/Image), variant badge, "Generate" IconButton, "Edit" IconButton (inline edit), "Delete" (✕). "Generate All" button at bottom
- [x] `PromptCard.tsx` (NEW — `rightPanel/`): single prompt card. Click → loads prompt into PromptBar. Shows "From saved prompt" indicator in PromptBar
- [x] `ArtboardListSection.tsx` (NEW — `rightPanel/`): lists all artboards in project. Each card: thumbnail (40×40), label, expandable context (used prompt truncated, source slogan, keywords from Drawer, reference images). Click card → select artboard on canvas. Bidirectional sync
- [x] `DesignWorkspaceView.tsx`: read `boardData.prompts` + pass to RightPanel
- [x] RTK Query: `createPrompts` mutation, `updatePrompt` mutation, `deletePrompt` mutation, `generateFromPrompt` mutation. Tag invalidation on project board
- [x] "Generate All" button: filters prompts where `is_generated=false` (AC-112b) → calls `generateFromPrompt` for each → skeleton artboards on canvas → polling per run. Disabled when all prompts already generated
- [x] Prompt cards show "Generated" badge (green chip) when `is_generated=true`. Un-generated prompts show active "Generate" button (AC-112b)

### G12: Frontend — Prompt Builder Dialog (AC-119 to AC-128)

- [x] `PromptBuilderDialog.tsx` (NEW — `board/partials/`): MUI Dialog, maxWidth="md". Opened via "✨ Build Prompt" button in PromptBar
- [x] Source sections (each with toggle + preview):
  - [x] **Slogan Section**: dropdown to select slogan from pool. Preview: slogan text, signal_type badge, emotional_archetype, pattern_used
  - [x] **Keywords Section**: fetches keywords via `GET /api/niches/{nicheId}/keywords/` (existing endpoint). Preview: keyword chips. Toggle on/off. If no linked niche → disabled state "Link a niche to enable keywords" (AC-121, EC-43)
  - [x] **AI Research Section**: shows NicheResearch data (visual_style, graphic_elements, vibe, tone). Toggle on/off. If no niche or no completed research → disabled state "No research data available" (AC-122, EC-43)
  - [x] **Web Research Section**: shows PROJ-17 results if available. "Not available — run Deep Web Search first" disabled state. Toggle on/off. If no niche → disabled (EC-43)
  - [x] **Reference Image Section**: file upload or select existing artboard image. "Analyze" button triggers Gemini 3 analysis. Shows analysis preview when done. Toggle on/off
- [x] Prompt Preview panel at bottom: live-updating text preview as user toggles sources. Read-only text area showing what the prompt will look like
- [x] "Variants" slider (1-5): how many stylistic variations to generate from same sources
- [x] "Build Prompt(s)" button: calls `POST /projects/{id}/build-prompts/` → receives prompt text(s) → saves as ProjectPrompt(s) → appear in RightPanel Prompts section → dialog closes
- [x] Bulk mode: when opened with multiple slogans selected → header shows "Building prompts for N slogans". Each slogan gets its own prompt(s) from same source config
- [x] Preset dropdown at top: load saved PromptPreset → toggles apply. "Save as Preset" button → name input → saves source_config
- [x] i18n keys: `design.promptBuilder.*` (title, sections, preview, variants, build, preset)

### G13: Frontend — Image→Prompt in PromptBar + Context Menu (AC-132 to AC-134)

- [x] 🖼 "Analyze Image" button in PromptBar (next to "✨ Build Prompt"). Visible always
- [x] If image artboard selected → click triggers Gemini 3 Architect analysis on artboard image → loading spinner → result fills PromptBar text field
- [x] If no image artboard selected → click opens file picker → user uploads image → triggers analysis → result fills PromptBar
- [x] Analysis result auto-saved as `ProjectPrompt` with `sources: {image: true}` + `source_image_url`. Appears in RightPanel Prompts section
- [x] Right-click context menu on artboard: add "Analyze Image → Generate Prompt" option (only on artboards that have an image). Click → same analysis flow → fills PromptBar
- [x] Reuse existing `useImageAnalysis` hook + `POST /api/designs/{id}/analyze-image/` endpoint
- [x] i18n keys: `design.actions.analyzeImage`, `design.actions.analyzeImageTooltip`, `design.promptBar.fromImage`

### G14: i18n — Prompt Builder + Persistence

- [x] New keys: `design.promptBuilder.title`, `design.promptBuilder.slogan`, `design.promptBuilder.keywords`, `design.promptBuilder.research`, `design.promptBuilder.webResearch`, `design.promptBuilder.image`, `design.promptBuilder.preview`, `design.promptBuilder.variants`, `design.promptBuilder.build`, `design.promptBuilder.notAvailable`
- [x] New keys: `design.prompts.title`, `design.prompts.empty`, `design.prompts.generateAll`, `design.prompts.fromSaved`, `design.prompts.edit`, `design.prompts.delete`
- [x] New keys: `design.presets.title`, `design.presets.save`, `design.presets.fullContext`, `design.presets.sloganOnly`, `design.presets.imageOnly`
- [x] New keys: `design.artboards.title`, `design.artboards.context`, `design.artboards.prompt`, `design.artboards.keywords`
- [x] All 5 locales: EN, DE, FR, ES, IT

### Verification Checklist — Phase G (Complete) ✅

- [x] Drawer: select 3 approved slogans → "Forge 3 Slogans" → create new project → Design Forge opens with pool
- [x] RightPanel shows Slogan Pool (Insert button), Prompts, Artboards sections
- [x] Open Prompt Builder → toggle Slogan + Keywords + Research → preview updates live → prompts appear in RightPanel
- [x] Edit a prompt inline in RightPanel → text updates
- [x] Click "Generate" on a prompt → skeleton artboard → image loads via polling
- [x] "Generate All" → prompts generate → skeleton artboards → fill in
- [x] Artboard list shows generated artboards with context (prompt, slogan, keywords)
- [x] Click artboard in list → selects on canvas. Select on canvas → highlights in list
- [x] Analyze Image → upload image → Gemini 7-step → prompt fills PromptBar + saved
- [x] Right-click image artboard → "Analyze Image → Generate Prompt" → same flow
- [x] Prompt Presets: save "My Config" → load it later → sources restore correctly
- [x] IdeaCard brush button → project with 1 slogan → Prompt Builder → works
- [x] All tests pass, lint clean *(6 test files in board/tests/)*

---

## Phase H: Frontend Redesign — Custom Icons (FD-0)

> Create custom SVG pipeline icons. MUI first — only create custom when no MUI icon fits.

### H1: Icon Infrastructure

- [x] Create `frontend-ui/src/assets/icons/` directory + `index.ts` barrel export
- [x] Base pattern: each icon = arrow function component accepting `SvgIconProps`, 24px viewBox, `currentColor`, 1.5px stroke, rounded caps

### H2: Pipeline Step Icons

- [x] `ResearchIcon.tsx` — microscope/flask style (replaces 🔬). Check MUI `ScienceOutlined` first — create custom only if too generic
- [x] `KeywordsIcon.tsx` — key style (replaces 🔑). Check MUI `KeyOutlined` — likely sufficient, skip custom
- [x] `ProductsIcon.tsx` — heart/favorite style (replaces ❤️). Check MUI `FavoriteOutlined` — likely sufficient
- [x] `SlogansIcon.tsx` — lightbulb style (replaces 💡). Check MUI `LightbulbOutlined` — likely sufficient
- [x] `DesignsIcon.tsx` — brush/palette style (replaces 🎨). Check MUI `BrushOutlined` — likely sufficient
- [x] `ListingsIcon.tsx` — article/document style (replaces 📋). Check MUI `ArticleOutlined` — likely sufficient
- [x] `UploadIcon.tsx` — cloud upload style (replaces 📤). Check MUI `CloudUploadOutlined` — likely sufficient
- [x] Audit: after checking MUI, only create custom SVGs for icons that look too generic. Document decisions in `assets/icons/README.md`

---

## Phase H3: Shared Components — Flow Buttons (FD-5)

- [x] Create `components/FlowButton/constants.ts` — `FLOW_TARGETS` mapping: target key → `{ icon, color }` using `COLORS.*` from constants.ts
- [x] Create `components/FlowButton/InlineFlowButton.tsx` — IconButton `theme.spacing(3.5)` (28px), radius `theme.shape.borderRadius * 0.75`, transparent bg, `text.disabled` default. Hover: target color + bg + `translateX(2px)`. Props: `target`, `tooltip`, `onClick`, `disabled?`
- [x] Create `components/FlowButton/BulkFlowButton.tsx` — MUI Button outlined small, full-width, height `theme.spacing(4)`, target color border/text, endIcon 16px. Hover: subtle bg + glow. Appear animation: `translateY(4px)→0 + opacity`. Props: `target`, `label`, `count?`, `onClick`, `disabled?`
- [x] Create `components/FlowButton/index.ts` — barrel export
- [x] All colors via `COLORS.*` and `theme.vars.palette.*` — zero hardcoded values
- [x] Light mode support via `theme.applyStyles('dark', {...})`

---

## Phase H4: Shared Components — Pipeline Card (FD-1)

- [x] Create `components/PipelineCard/types.ts` — `PipelineCardState` enum (`done | active | pending`), `PipelineCardProps` interface
- [x] Create `components/PipelineCard/PipelineCardHeader.tsx` — icon (18px, state-colored) + title (`subtitle2`) + badge (`overline`, pill, state-colored bg/text) + chevron (ExpandMore 18px, rotates 180°). All tokens from theme/constants
- [x] Create `components/PipelineCard/PipelineCard.tsx` — glassmorphism container: bg `alpha(COLORS.inkPaper, 0.60)` + `blur(8px)`, border `divider`, radius `borderRadius * 1.5`. Left stripe 3px (done=successDk, active=cyan pulse, pending=snowDisabled). Expand/collapse via `max-height + opacity`, `DURATION.default + EASING.enter`. Hover: bg `COLORS.inkElevated` + `translateY(-1px)`
- [x] Active stripe pulse animation: `@keyframes pulseCyan`, 1.2s infinite
- [x] Badge count update animation: scale pop `1→1.15→1`
- [x] Light mode: `theme.applyStyles('dark', {...})` — paper bg, no blur, standard borders
- [x] Create `components/PipelineCard/index.ts` — barrel export

---

## Phase H5: Drawer Pipeline Refactor (FD-1 + FD-2)

### H5.1: NicheDetailDrawer Restructure

- [x] Refactor `NicheDetailDrawer.tsx` — replace individual section renders with 7 PipelineCards in order: Research → Keywords → Products → Slogans → Designs → Listings → Upload. Keep niche header (name, status, round, edit) unchanged at top
- [x] Each PipelineCard receives: `state` (computed from data), `title`, `icon`, `badge` (count/score), `children` (expanded content)
- [x] Auto-expand logic: "active" card auto-expanded on drawer open. Done cards collapsed. Pending cards collapsed

### H5.2: Research Pipeline Card

- [x] Refactor `DrawerResearchSection.tsx` — extract research state logic (idle/running/complete/failed) into PipelineCard expanded content
- [x] Compact summary (done state): score, product count, date, top vibes. [🔬 View] navigates to research page. [🔄] force refresh
- [x] Start state (no research): [🔬 Start] button + marketplace/product type dropdowns
- [x] Running state: ResearchProgressStepper (compact) + Stop button

### H5.3: Keywords Pipeline Card

- [x] Create Keywords PipelineCard content — keyword count badge, top keywords preview in expanded state
- [x] [🔑 View] Flow Button → navigates to keyword page

### H5.4: Products Grid (FD-2) — replaces Carousel

- [x] Create `views/niches/list/partials/ProductsGrid.tsx` — CSS Grid `repeat(3, 1fr)`, gap `theme.spacing(1.5)`
- [x] Create `views/niches/list/partials/ProductThumbnailCard.tsx` — bg `COLORS.inkElevated`, border `divider`, radius `borderRadius`, `aspect-ratio: 1/1`, `object-fit: cover`
- [x] Info bar: BSR (caption, TrendingUp 14px, color-coded by rank) + Price (caption, weight 600, right-aligned)
- [x] Hover action overlay: `alpha(COLORS.ink, 0.70)` + `blur(4px)`, opacity 0→1. 4 icon buttons (32px): 🔑 Keywords (warningDk), 💡 Slogan (cyan), 🎨 Canvas (red), 🔍 Detail (text.primary)
- [x] Multi-select: checkbox absolute top-left (20px), `COLORS.cyan` checked, opacity 0→1 on hover/when any selected
- [x] Bulk Action Button: outlined full-width, `alpha(COLORS.cyan, 0.30)` border, `COLORS.cyan` color. Slide-in animation
- [x] "Add Product" card: dashed border, AddCircleOutline 32px, hover cyan
- [x] Remove old `CollectedProductsSection.tsx` carousel components (`CarouselContainer`, `CardSlide`, `NavArrow`, `DotRow`)

### H5.5: Slogans Pipeline Card

- [x] Refactor `CollectedItemsSection.tsx` slogans section → PipelineCard expanded content
- [x] Each slogan row: text (`body2`, noWrap) + signal badge (Chip small) + InlineFlowButton `target="canvas"` [🎨→]
- [x] Bulk: [☑ Select All] + BulkFlowButton `target="canvas"` "Forge N → Design Canvas"
- [x] Keep existing `ProjectNamingDialog` integration

### H5.6: Designs Pipeline Card

- [x] Refactor `DrawerDesignsSection.tsx` → PipelineCard expanded content
- [x] Project rows: FolderOutlined + name (`subtitle2`) + count badge + InlineFlowButton `target="listings"` [📋→]
- [x] Thumbnail row per project: max 4 thumbs (36×36px), indented under folder icon
- [x] "Open Canvas" ghost button at bottom
- [x] Skeleton loading state

### H5.7: Listings + Upload Pipeline Cards (placeholder)

- [x] Listings PipelineCard: count badge (draft/ready/published), expanded shows summary, [📋→ Open Publish] Flow Button. Content populated when PROJ-11 is built
- [x] Upload PipelineCard: count badge (pending/completed/failed), expanded shows summary. Content populated when PROJ-11/13 is built

---

## Phase H6: RightPanel Redesign (FD-3)

### H6.1: Generation Zone (replaces PromptBar)

- [x] Create `views/designs/board/partials/GenerationZone.tsx` — sticky top, bg `COLORS.inkPaper`, padding `theme.spacing(2)`, border-bottom divider
- [x] Model selector: compact Select, height 32px, bg `COLORS.inkElevated`, radius 6px
- [x] BG Color selector: Select with colored dot (10px square, radius 2px) before label
- [x] Images slider: MUI Slider `size="small"`, color `secondary.main`, thumb 12px, range 1-8
- [x] Resolution display: `body2`, clickable → aspect ratio popover

### H6.2: Parallel Prompts Row

- [x] Create `views/designs/board/partials/ParallelPromptsRow.tsx` — Switch `size="small"` (checked: `secondary.main`) + label (`subtitle2`) + hint (caption, text.disabled, conditional)
- [x] [🖼] Analyze IconButton: 32px, border divider, transparent bg. Hover: cyan bg/border/color. Icon: ImageSearch 18px. Tooltip: "Generate prompt based on your image"
- [x] [+] Builder IconButton: 32px, bg `secondary.main` (cyan), color white. Hover: `COLORS.cyanDk` + glow. Icon: Add 18px. Tooltip: "Open Prompt Builder"
- [x] Textarea placeholder changes with switch state: "Describe your design..." / "Enter prompts (each line = separate image)..."

### H6.3: Prompt Textarea + Generate Button

- [x] Prompt Textarea: multiline rows 4/8, bg `alpha(COLORS.ink, 0.40)`, border divider, focus primary.main, radius 8px
- [x] Generate Button: full-width, height 40px, `linear-gradient(135deg, COLORS.red, COLORS.redDk)`, AutoAwesome 18px, hover glow. Loading: shimmer animation
- [x] "Generate All" variant: dropdown arrow, menu "Generate" / "Generate All (N)"

### H6.4: RightPanel Restructure

- [x] Rebuild `RightPanel.tsx` — two zones: GenerationZone (sticky) + scrollable accordion zone
- [x] Scrollable zone: `overflow-y: auto`, `flex: 1`, padding `theme.spacing(1)`
- [x] Accordion pattern (shared): MUI Accordion transparent, no border/shadow/`&:before`. Summary min-height 40px, radius 6px, hover `alpha('#fff', 0.04)`. Title `subtitle2` + Count Badge (`overline`, cyan)
- [x] Sections: Saved Prompts, Slogan Pool, Artboards, Layers (conditional on element selected)
- [x] Context switch: when element selected, Generation Zone collapses to single row (48px), Element Properties panel between zones. Transition `DURATION.default + EASING.standard`

### H6.5: Remove PromptBar

- [x] Remove `PromptBar.tsx` (350 lines) — all functionality now in GenerationZone
- [x] Remove `usePromptBar.ts` hook — merge relevant state into `useGeneration` or GenerationZone local state
- [x] Update `DesignWorkspaceView.tsx` — remove PromptBar render, wire GenerationZone into RightPanel
- [x] Update any component that references PromptBar (ContextMenu, auto-prompt fill, etc.)
- [x] Verify: prompt text, model selection, BG color, generate action all work from RightPanel

---

## Phase H7: Prompt Builder Dialog Redesign (FD-4)

### H7.1: Dialog Shell + Tab Navigation

- [x] Rebuild `PromptBuilderDialog.tsx` — Dialog `maxWidth="md"`, bg `COLORS.inkPaper`, radius 16px, min-height 400px, max-height 80vh
- [x] Header: `h4` title + Close IconButton 32px
- [x] Custom tab navigation (NOT MUI Tabs): flex wrap text links, `subtitle2`, `text.secondary`. Active: `secondary.main` + 2px cyan underline. Tab content switch animation: `opacity + translateX(8px)→0`
- [x] Footer: Cancel (ghost) + Generate Prompt (contained, `secondary.main` cyan, hover glow)
- [x] 8 tabs: Concept, Context, Style, Format, Color, Background, Text, Output

### H7.2: Concept Tab

- [x] Create `promptBuilder/ConceptTab.tsx` — Prompt Title (TextField), Slogan Selector (Select from pool, auto-fills Main Subject), Main Subject (multiline rows:3), 2-col grid: Content Type + Mood (both Select)

### H7.3: Context Tab (unique — per-field checkboxes)

- [x] Create `promptBuilder/ContextTab.tsx` — stacked source sections, each in glass card (`alpha(COLORS.inkElevated, 0.40)`)
- [x] Keywords section: master checkbox, wrapped Chips `size="small"` outlined, border `alpha(COLORS.cyan, 0.20)`. Empty: "No keywords — run Keyword Research first"
- [x] AI Research section: master checkbox (indeterminate when partial) + **per-field checkboxes** (Visual Style, Vibe, Tone, Elements, Aesthetics, Layout). Grid: label caption right-aligned, value body2. Unchecked fields: dimmed opacity 0.45
- [x] Reference Products section: master checkbox, 4-col grid, thumbs 56px, selected: cyan border + glow
- [x] Disabled section (unchecked master): opacity 0.45 + blur(1px) on content

### H7.4: Style + Format Tabs

- [x] Create `promptBuilder/StyleTab.tsx` — 2-col: Style Category + Style Select. "+ Add Style" ghost button. Added styles as deletable Chips (cyan)
- [x] Create `promptBuilder/FormatTab.tsx` — 2×2 grid: Orientation, Aspect Ratio, Detail Level, Rendering Style (all Select 40px). Full-width: Composition Select

### H7.5: Color + Background + Text Tabs

- [x] Create `promptBuilder/ColorTab.tsx` — flex wrap swatches 40px, radius 8px. Selected: cyan border + glow + scale(1.1). "+ Add Color" ghost. "From Research" ghost (cyan, pulls niche research colors)
- [x] Create `promptBuilder/BackgroundTab.tsx` — Background Type Select + Preset Chips (Light Gray, Neon Pink, Neon Green, Transparent). Selected: cyan bg + border
- [x] Create `promptBuilder/TextTab.tsx` — "Text Included?" Select (No/Slogan/Custom). Preview box: glass card, body2 italic, text.secondary

### H7.6: Output Tab

- [x] Create `promptBuilder/OutputTab.tsx` — 2x2 grid: Use, Avoid, Print Requirements, Final Feel (all Select). MBA Preset Chip: toggleable, successDk when active

### H7.7: Hook Refactor

- [x] Refactor `usePromptBuilderTabs.ts` — add tab state management for Color, Background, Text, Output tabs
- [x] Prompt generation: collect enabled fields from all tabs → build prompt text → return generatedPrompt
- [x] Preset save/load: serialize all tab states into source_config JSONField

---

## Phase H8: Flow Button Integration (FD-5)

- [x] IdeaCard.tsx: replace brush IconButton with `InlineFlowButton target="canvas"`. Only visible when `idea.status === 'approved'`
- [x] Canvas ArtboardContextMenu: add "📋 Save to Listings" menu item using `FLOW_TARGETS.listings` color/icon
- [x] RightPanel ArtboardListSection: add `InlineFlowButton target="listings"` per artboard row (only when `design.status === 'approved'`)
- [x] Drawer Slogans PipelineCard: InlineFlowButton per slogan + BulkFlowButton under list
- [x] Drawer Designs PipelineCard: InlineFlowButton per project row

---

## Phase H8b: Refactoring Pass + Bugfixes (2026-04-09)

- [x] Extract shared `components/CardOverlay/` — HoverOverlay, ActionPill, ProductImage (used by ProductCard + ProductThumbnailCard)
- [x] Extract shared `components/PipelineCard/SummaryRow.tsx` — SummaryRow + CountValue (used by ListingsPipelineContent + UploadPipelineContent)
- [x] Add `SHADOW` tokens to `style/constants.ts` (card, cardLight, cardLightMode)
- [x] Replace all hardcoded rgba/hex with `COLORS.*` + `alpha()` across H4–H8 files
- [x] Refactor ProductCard (Research) to use shared CardOverlay components
- [x] RightPanel width 280→383px, slider boxes 2-row layout, prompt textarea resizable
- [x] Inline editable project name (click → InputBase → PATCH)
- [x] NicheDetailDrawer: loading skeleton + error state for fetch failures
- [x] Research badge: "Done" when complete, "N/6" only during progress
- [x] ProductThumbnailCard: 2-col grid, 4:5 ratio, scale(1.6), ActionPill hover (Research style), MoreMenu, remove button
- [x] Tooltip: "Niche Pipeline" (was "Niche Details"), Inventory2Outlined icon (was InfoOutlined)
- [x] Backend: 7 new AI model choices + aspect_ratio parameter + migration 0006
- [x] Backend bugfix: slogan adapt `_load_niche_profile` + `_build_target_niches` filter `research__status='completed'`
- [x] Backend bugfix: `suggest-niches` excludes archived niches
- [x] Backend: Image-to-Image mode — mode field on DesignGenerationRun, i2i prompt wrapping, multimodal validation, 11 new tests
- [x] Prompt Builder preset save/load (backend persistence via source_config JSONField)
- [x] Fix text tool inline editing bug — canvas focus theft, Konva text visibility during edit, deselection guard

---

## Phase GR: Slogan Pool Refactor — Insert-Only (spec update 2026-04-10)

> Replaces direct generation from Slogan Pool with prompt-first workflow.
> Slogans are now raw material for prompts — not generation triggers.
> Two paths: (1) "Insert" button → pastes slogan into PromptBar, (2) Slogan Selector dropdown in Prompt Builder Concept tab.

### GR1: Backend Cleanup — Remove Auto-Prompt + Bulk Generate Endpoints

- [x] Remove `auto-prompt` view from `design_app/api/views.py` — N/A (never implemented)
- [x] Remove `bulk-generate` view from `design_app/api/views.py` — N/A (never implemented)
- [x] Remove corresponding URL patterns from `design_app/api/urls.py` — N/A (never implemented)
- [x] Remove `BulkGenerateSerializer` (if exists) from serializers — N/A (never implemented)
- [x] Keep all other Slogan Pool CRUD endpoints unchanged (add/remove/list ideas in pool)
- [x] Ruff check clean after removal — N/A

### GR2: Frontend — SloganPoolSection Refactor (AC-97, AC-98)

- [x] `SloganPoolCard.tsx`: remove Checkbox prop + checkbox rendering — already clean (no checkbox exists)
- [x] `SloganPoolCard.tsx`: remove "Auto-Prompt" IconButton (sparkle icon) — already clean (uses InputIcon)
- [x] `SloganPoolCard.tsx`: add "Insert" IconButton (`InputOutlined`). Tooltip: "Insert into prompt". Click → calls `onInsertSlogan(slogan_text)` callback — already implemented
- [x] `SloganPoolSection.tsx`: remove "Generate Selected (N)" button at bottom — already clean
- [x] `SloganPoolSection.tsx`: remove `selectedIds` state + selection logic — already clean
- [x] `SloganPoolSection.tsx`: add `onInsertSlogan` prop. Passed down to each `SloganPoolCard` — already implemented
- [x] `PanelNoneState.tsx` / `RightPanel.tsx`: wire `onInsertSlogan` → sets PromptBar textarea value — wired via `handleInsertSlogan` (renamed from `handleAutoPromptFill`)
- [x] Remove `market_confidence` badge from `SloganPoolCard` — already clean (only signal_type + niche chip)

### GR3: Frontend — Remove Bulk Generate RTK Query Endpoints

- [x] `designSlice.ts`: remove `bulkGenerateDesigns` mutation endpoint — N/A (never existed)
- [x] `designSlice.ts`: remove `useAutoPromptQuery` / `useLazyAutoPromptQuery` endpoint — N/A (never existed)
- [x] `designSlice.ts`: remove related tag invalidation entries for bulk-generate — N/A
- [x] Keep `addIdeasToProject` + `removeIdeaFromProject` mutations (still used) — confirmed
- [x] Verify no other components reference removed endpoints (grep for `bulkGenerate`, `autoPrompt`) — clean

### GR4: Frontend — Prompt Builder Concept Tab Slogan Selector (AC-101)

- [x] `PromptBuilderDialog.tsx` (Concept tab): verify Slogan Selector dropdown already exists and lists pool slogans — confirmed in ConceptTab.tsx
- [x] Selecting a slogan auto-fills the "Main Subject" textarea with `slogan_text` — updated: always replaces (was: only when empty)
- [x] Pre-select slogan if dialog was opened with a specific slogan context — handled via `selectedSloganId` prop
- [x] When slogan selected: auto-toggle Context tab sources (Keywords, AI Research) ON if niche has research data (AC-102) — implemented in `usePromptBuilderTabs.ts`
- [x] Remove bulk mode from Prompt Builder: remove "Building prompts for N slogans" header + multi-slogan loop (AC-128 REMOVED) — N/A (never existed)

### GR5: i18n Cleanup

- [x] Remove i18n keys: `design.sloganPool.generateSelected`, `design.sloganPool.autoPrompt`, `design.sloganPool.maxBulk`, `design.actions.bulkGenerating` — N/A (never existed in locale files, only used as inline t() fallbacks)
- [x] Add i18n key: `design.sloganPool.insert` ("Insert into prompt") — already in SloganPoolCard.tsx via t() with fallback
- [x] Update all 5 locales: EN, DE, FR, ES, IT — using inline fallbacks for now (no locale files to update)

### GR6: Tests + Verification

- [x] Update `SloganPoolSection` tests: remove checkbox/selection/bulk-generate test cases — N/A (no prior tests existed)
- [x] Update `SloganPoolCard` tests: remove auto-prompt test, add insert-button test — NEW: `SloganPoolCard.test.tsx` (7 tests)
- [x] Update `PromptBuilderDialog` tests: 18 new tests (slogan selector, preset bar, E2E flow)
- [x] Verify existing Prompt Builder flow still works end-to-end — code path traced + integration test covers select → build → save preset → generate
- [x] `npm run lint` clean (changed files only — pre-existing errors in other files)
- [x] `npm run test:ci` passes (SloganPoolCard: 7/7)

### Verification Checklist — Phase GR

- [x] Slogan Pool shows slogan cards without checkboxes
- [x] No "Generate Selected" button visible
- [x] "Insert" button on slogan card → slogan text appears in PromptBar textarea
- [x] Open Prompt Builder → Concept tab → Slogan Selector dropdown shows pool slogans
- [x] Select slogan in dropdown → Main Subject auto-fills (always replaces)
- [x] Context tab sources auto-toggle when slogan has niche research
- [x] Prompt Builder no longer has bulk mode
- [x] Auto-prompt + bulk-generate API endpoints — never existed (N/A)
- [x] All tests pass, lint clean

---

## Phase H9: i18n + Tests + Lint

### H9.1: i18n

- [x] Add new keys for Pipeline Cards — N/A: components use existing keys from their own sections, not `drawer.pipeline.*`
- [x] Add keys for Pipeline Card states — N/A: no `t()` calls reference these keys
- [x] Add keys for Products Grid actions — N/A: already exist under `niches.drawer.collectedProducts.*`
- [x] Add keys for GenerationZone — already existed in EN, added to DE/FR/ES/IT (24 keys per locale)
- [x] Add keys for Prompt Builder tabs + sub-sections — 53 new keys (tabs, concept, context, style, format, color, background, text, output)
- [x] Add keys for Flow Buttons — N/A: flow buttons receive tooltip strings as props, no `t('flow.*')` calls
- [x] Sync all new keys to DE, FR, ES, IT (5 locales)

### H9.2: Tests

- [x] PipelineCard: renders 3 states, expand/collapse, badge count
- [x] ProductsGrid: renders grid, hover overlay, multi-select, bulk action
- [x] FlowButton: InlineFlowButton renders per target, BulkFlowButton appears on selection
- [x] GenerationZone: model/bg selectors, parallel prompts switch, generate button
- [x] PromptBuilderDialog: tab navigation, Context tab checkboxes, Generate Prompt output
- [x] NicheDetailDrawer: renders 7 PipelineCards in order (6 cards verified, Design Projects conditional)

### H9.3: Lint + Cleanup

- [x] Zero hardcoded colors — all via `COLORS.*`, `theme.vars.palette.*`, `alpha()`
- [x] Zero hardcoded px — all via `theme.spacing()`, `theme.shape.borderRadius`
- [x] All transitions via `DURATION.*` + `EASING.*`
- [x] `npm run lint` clean (our files clean, 12 pre-existing errors in other modules)
- [x] `npm run test:ci` passes (H9.2 tests all green)
- [x] Remove dead code: unused Box import, unused vi import, unused onAddReferenceArtboard prop

---

## Phase I: Product-to-Canvas Reference Pipeline (AC-135 to AC-159)

### I1: Backend — ProjectReference Model + Migration

- [x] Create `ProjectReference` model in `design_app/models.py`: UUID pk, project FK (CASCADE), source_product FK (SET_NULL, nullable), image_url URLField(2048), title CharField(500), asin CharField(20, blank), prompt_analysis JSONField(null), position IntegerField(0), added_at DateTimeField(auto_now_add)
- [x] Add unique constraint: `(project, image_url)`
- [x] Add index on `project` field
- [x] Register in `design_app/admin.py`
- [x] Run `makemigrations` + verify migration file

### I2: Backend — ProjectReference API (CRUD)

- [x] `ProjectReferenceSerializer`: id, project (read), source_product (read), image_url, title, asin, prompt_analysis (read), position, added_at
- [x] `POST /api/designs/projects/{id}/references/` — accepts `{ product_ids: [uuid] }`. Lookup each AmazonProduct, create ProjectReference with image_url/title/asin copied. Skip duplicates (same image_url in project). Return created refs
- [x] Also accept `{ image_urls: [{ url, title }] }` for manual image references (no product). Skip duplicates
- [x] `DELETE /api/designs/projects/{id}/references/{refId}/` — remove single reference. Workspace isolation check
- [x] Extend `ProjectBoardView.get()`: add `references` array to board response. Query `ProjectReference.objects.filter(project=project).order_by('position', '-added_at')`
- [x] URL routing in `design_app/api/urls.py`

### I3: Backend — Multimodal Generation Support

- [x] Add `MULTIMODAL_MODELS` set in `image_generator.py` listing model IDs that support image+text input (Gemini models, GPT-4o models)
- [x] Extend `generate_image()`: new optional param `source_image_url`. When provided and model is in MULTIMODAL_MODELS → build content as array: `[{ type: "text", text: prompt }, { type: "image_url", image_url: { url: source_image_url } }]`
- [x] When `source_image_url` provided but model NOT in MULTIMODAL_MODELS → raise ValueError with message "Model does not support image input"
- [x] Extend `task_generate_design`: pass `source_image_url` from DesignGenerationRun to `generate_image()` if set
- [x] Add `source_image_url` field to DesignGenerationRun model if not already present (check — Design model has it, Run may not)
- [x] Add `reference_used` to generation run response: `{ image_url, mode: 'multimodal' | 'text_analysis' }`
- [x] Extend generation endpoint: accept optional `source_image_url` param. If model doesn't support multimodal and no `prompt_analysis` fallback → return 400 error

### I4: Frontend — Niche Pipeline Send Flow

- [x] Wire `onCanvas` handler in `ProductsGrid.tsx`: receive product, resolve project (0/1/N logic)
- [x] Create `useProductToCanvas` hook: takes nicheId, queries niche's DesignProjects. Returns `sendToCanvas(productIds[])` function
- [x] 0 projects → open ProjectNamingDialog (create mode, nicheId pre-set)
- [x] 1 project → call `addReferencesToProject` mutation directly
- [x] N projects → open ProjectNamingDialog (select mode, project list filtered by niche)
- [x] Wire `onCanvas` in `ProductThumbnailCard.tsx` context menu "Send to Canvas" item
- [x] Wire BulkFlowButton in ProductsGrid: collect selectedIds → same flow with bulk product_ids
- [x] After success: notistack "Added N reference(s) to [Project Name]". If new project → navigate to `/designs/{projectId}`
- [x] Hide "Send to Canvas" for products with no image (EC-46)

### I5: Frontend — RTK Query Endpoints

- [x] Add `addReferencesToProject` mutation in `designSlice.ts`: POST `/api/designs/projects/{id}/references/`, invalidates `DesignProject` tag
- [x] Add `removeReferenceFromProject` mutation: DELETE `/api/designs/projects/{id}/references/{refId}/`, invalidates `DesignProject` tag
- [x] Extend `ProjectBoardResponse` type: add `references: ProjectReference[]`
- [x] Add `ProjectReference` TypeScript interface in `gallery/types.ts`: id, image_url, title, asin, prompt_analysis, position, added_at, source_product
- [x] Add `analyzeProductImage` mutation: POST `/api/products/{id}/analyze-image/`, body `{ source_image_url }`. Invalidates `DesignProject` tag (so board refetches with updated prompt_analysis)

### I6: Frontend — ReferencesSection Component

- [x] Create `ReferencesSection.tsx` in `rightPanel/`: uses AccordionSection pattern. Header: "References" + badge count. Props: projectId, references[], onUseAsReference, onAnalyze, onUseAsPrompt
- [x] Create `ReferenceCard.tsx`: thumbnail 48×48, title (truncated), ASIN chip (if present)
- [x] "Use as Reference" button per card: sets `sourceImageUrl` in generation context (lifted state in DesignWorkspaceView)
- [x] "Analyze" button: triggers `analyzeProductImage` mutation. Shows CircularProgress while pending. On complete: expand analysis text below thumbnail
- [x] "Use as Prompt" button (visible after analysis): copies `prompt_analysis` summary text into PromptBar textarea
- [x] Remove button (X icon): calls `removeReferenceFromProject` mutation
- [x] Empty state: "Add references from Niche Pipeline"
- [x] Max-height with scroll for 20+ references (EC-48)
- [x] Broken image placeholder for expired URLs (EC-45)

### I7: Frontend — RightPanel + Workspace Integration

- [x] Add ReferencesSection to RightPanel between SloganPoolSection and ArtboardListSection
- [x] Add `sourceImageUrl` state to DesignWorkspaceView (lifted state for generation context)
- [x] Pass `sourceImageUrl` to GenerationZone: when set, show indicator "Generating with reference image"
- [x] Extend generation handler: include `source_image_url` in generation request body when set
- [x] After generation: clear `sourceImageUrl` state
- [x] Add ReferencesSection to PanelNoneState (same pattern as SloganPoolSection)

### I8: Frontend — Prompt Builder Context Tab Integration

- [x] Extend PromptBuilderDialog Context Tab: add "Reference Images" section at bottom
- [x] Show project references as thumbnail rows with per-reference on/off toggle
- [x] Toggle mode selector per reference: "Image (multimodal)" vs "Text Analysis" — default to Image
- [x] Show analysis text preview below thumbnail when available
- [x] When reference toggled ON with Image mode: add `source_image_urls[]` to build-prompts request
- [x] When reference toggled ON with Text mode: add analysis text to prompt sources
- [x] Auto-fallback: if model doesn't support multimodal → show info toast, switch to Text mode

### I9: i18n

- [x] Add EN keys: `design.references.title`, `design.references.empty`, `design.references.useAsReference`, `design.references.analyze`, `design.references.analyzing`, `design.references.useAsPrompt`, `design.references.remove`, `design.references.alreadyAdded`, `design.references.addedSuccess`, `design.references.modelNoMultimodal`, `design.references.analyzeFailed`, `design.references.brokenImage`
- [x] Sync to DE, FR, IT, ES locales

### I10: Tests

- [x] Backend: ProjectReference CRUD — create, bulk create, duplicate skip, delete, workspace isolation
- [x] Backend: Board endpoint includes references in response
- [x] Backend: `generate_image()` multimodal content array for MULTIMODAL_MODELS
- [x] Backend: `generate_image()` raises ValueError for non-multimodal model with source_image_url
- [x] Frontend: ReferencesSection renders references, empty state, badge count
- [x] Frontend: ReferenceCard actions: use, analyze, remove
- [x] Frontend: ProductsGrid send flow: single + bulk
- [x] `npm run lint` + `npx tsc --noEmit` clean
- [x] `ruff check django-app/` clean

---

## Phase J: Export Compression Refactor (AC-24, AC-30, AC-44, AC-62)

> Compressor removed from pipeline. Compression = download-time via UPNG.js. ExportDialog removed. ReadyPixl-style inline controls + "Preparing Download" modal.

### J1: Remove Compressor Pipeline Tool

- [x] Remove `'compressor'` from `ToolName` type in `types/index.ts`
- [x] Remove `'quality'` from `ToolCategory` type (no tools left in this category)
- [x] Remove compressor entry from `TOOL_CATALOG` array
- [x] Remove `quality` entry from `TOOL_CATEGORIES` array
- [x] Remove `compressor` icon mapping from `ToolIcons.tsx`
- [x] Remove `CompressorToolParams.tsx` file
- [x] Remove compressor case from `ToolPanel.tsx` conditional rendering
- [x] Remove `processCompressor()`, `CompressorParams`, `DEFAULT_COMPRESSOR_PARAMS`, `canvasToBlobWithFormat()` from `imageProcessing.ts`
- [x] Remove compressor case + imports from `useClientProcessing.ts`
- [x] Verify PipelineBar no longer renders empty "Quality" category section

### J2: Remove ExportDialog

- [x] Delete `ExportDialog.tsx` (editor version)
- [x] Delete `useExportDialog.ts` hook
- [x] Remove ExportDialog imports + state from `DesignEditorView.tsx`
- [x] Remove "Advanced" / settings button from `ExportControls.tsx` (no dialog to open)

### J3: Install UPNG.js + Compression Hook

- [x] `npm install upng-js` in `frontend-ui/`
- [x] Add `@types/upng-js` or create local type declaration if needed
- [x] Create `useExportCompression.ts` hook:
  - State: `isCompressing`, `progress` (0-1), `currentImageIndex`, `totalImages`, `cancelled`
  - `compressImage(imageData, width, height, level)`: UPNG.encode with color count from level mapping (Off=skip, Low=4096, Medium=1024, High=256, Very High=128)
  - `downloadCurrent(canvas, settings)`: compress → create Blob → trigger browser download via anchor
  - `downloadAll(canvases[], settings)`: compress all → JSZip → trigger ZIP download. Progress updates per image
  - `cancel()`: set cancelled flag, abort remaining images
  - Reuse JSZip (already installed) for ZIP creation

### J4: Refactor ExportControls (Inline Bottom Bar)

- [x] Update `ExportSettings` type: `compression: number` → `compression: CompressionLevel` where `CompressionLevel = 'off' | 'low' | 'medium' | 'high' | 'very_high'`
- [x] Replace compression slider with MUI `Select` dropdown (Off/Low/Medium/High/Very High)
- [x] Keep: Format badge (PNG), DPI slider, Overwrite/New Version toggle, Download Current + Download All buttons, Close button
- [x] Remove: Advanced settings button (ExportDialog gone)
- [x] Wire Download Current → `useExportCompression.downloadCurrent()`
- [x] Wire Download All → `useExportCompression.downloadAll()`
- [x] Both buttons open PreparingDownloadModal on click

### J5: Create PreparingDownloadModal

- [x] Create `PreparingDownloadModal.tsx` in `editor/partials/`
- [x] MUI Dialog, centered, ~400px width, dark theme consistent
- [x] Content: circular spinner (animated), "Preparing Download" title, "Processing your image..." subtitle, compression level chip/badge (e.g. "Compression: Very High"), LinearProgress (determinate, value from hook progress), Cancel button
- [x] Props: `open`, `onCancel`, `compressionLevel`, `progress` (0-100), `currentImage`, `totalImages`
- [x] Cancel button calls `useExportCompression.cancel()` + closes modal

### J6: Wire into DesignEditorView

- [x] Import `PreparingDownloadModal` + `useExportCompression`
- [x] Add PreparingDownloadModal to JSX (below ExportControls area)
- [x] Connect ExportControls download handlers → hook → modal open/close
- [x] Remove all ExportDialog references (imports, state, handlers, JSX)
- [x] Test: single image download with each compression level
- [x] Test: batch ZIP download (5+ images) with progress

### J7: i18n

- [x] Remove keys: `design.qc.compressor`, `design.qc.compressorDesc` (and any sub-keys) from all 5 locales
- [x] Add keys to all 5 locales (EN, DE, FR, ES, IT):
  - `design.export.compressionLevel` — "Compression"
  - `design.export.compressionOff` — "Off"
  - `design.export.compressionLow` — "Low"
  - `design.export.compressionMedium` — "Medium"
  - `design.export.compressionHigh` — "High"
  - `design.export.compressionVeryHigh` — "Very High"
  - `design.export.preparingDownload` — "Preparing Download"
  - `design.export.processingImage` — "Processing your image..."
  - `design.export.processingImages` — "Processing {{current}} of {{total}}..."
  - `design.export.cancel` — "Cancel"

### J8: Tests + Lint

- [x] Unit test: `useExportCompression` — compressImage returns smaller Blob for each level (9 tests)
- [x] Unit test: `PreparingDownloadModal` — renders spinner, title, progress, cancel button (9 tests)
- [x] Unit test: `UnifiedBottomBar` — Info/Export mode switch, compression dropdown, resolution display (13 tests)
- [x] Integration test: download flow — covered in UnifiedBottomBar tests (mode switch + button interactions)
- [x] `npm run lint` clean (our files)
- [x] `npx tsc --noEmit` clean
- [x] Manual test: download PNG with "Very High" → verify file size < 2MB for standard 4500x5400 POD design

---

## Phase K: Unified Bottom Bar — Info + Export (AC-30, AC-47)

> Bottom bar always visible. Info Mode (default): PNG, resolution, file size. Export Mode (click Download): full controls + estimated size. Replaces toggle-based ExportControls.

### K1: Populate Image Dimensions on Load

- [x] In `handleFilesAdded` (DesignEditorView): after creating blob URL, load `Image()` element to read `naturalWidth`/`naturalHeight`. Update BatchImage with `width`/`height` once loaded
- [x] For URL preloads (designs from server): map server-returned dimensions to BatchImage `width`/`height`
- [x] Verify `fileSize` already set from `File.size` (already done in Phase J)

### K2: Rename ExportControls → UnifiedBottomBar

- [x] Rename `ExportControls.tsx` → `UnifiedBottomBar.tsx` (file + component + all imports)
- [x] Add `mode` state: `'info' | 'export'` (default: `'info'`)
- [x] **Info Mode render:** Format badge (PNG) | Separator | Resolution (JetBrains Mono, e.g. `4500×5400`) | Separator | File size (JetBrains Mono, e.g. `8.2 MB`) | Spacer | Download button (switches to Export Mode)
- [x] **Export Mode render:** existing export controls (FORMAT, DPI, Compression dropdown, Overwrite/New toggle, Download Current, Download All ZIP, Close X)
- [x] Add estimated compressed size display in Export Mode: green text `Est. ~2.3 MB` + savings badge `↓72%` — shown next to Compression dropdown
- [x] Close X sets mode back to `'info'`
- [x] Download button in Info Mode sets mode to `'export'`
- [x] Props: remove `onClose`, add `currentImage: BatchImage | null`

### K3: Remove Export Toggle from BatchThumbnailStrip

- [x] Remove `showExportToggle` prop from BatchThumbnailStrip interface
- [x] Remove `onToggleExport` prop from BatchThumbnailStrip interface
- [x] Remove export toggle IconButton from BatchThumbnailStrip JSX
- [x] Remove FileDownloadIcon import (if no longer used)

### K4: Update DesignEditorView Integration

- [x] Remove `showExport` state (`useState(false)`)
- [x] Remove `setShowExport` toggle callback
- [x] Remove `onToggleExport` prop from BatchThumbnailStrip usage
- [x] Remove `showExportToggle` prop from BatchThumbnailStrip usage
- [x] Remove conditional `{showExport && ...}` — UnifiedBottomBar is always rendered
- [x] Import `UnifiedBottomBar` instead of `ExportControls`
- [x] Pass `currentImage` to UnifiedBottomBar (for resolution + file size display)
- [x] UnifiedBottomBar rendered inside StripWrapper, below ThumbnailRow (always)

### K5: Update Tests

- [x] Remove/update export toggle tests in `BatchThumbnailStrip.test.tsx`
- [x] Add test: UnifiedBottomBar Info Mode renders resolution + file size when image selected
- [x] Add test: UnifiedBottomBar Info Mode shows "—" when no image dimensions available
- [x] Add test: clicking Download button switches to Export Mode
- [x] Add test: clicking Close X returns to Info Mode
- [x] Add test: estimated compressed size shown in Export Mode with correct savings %
- [x] `npm run lint` + `npx tsc --noEmit` clean

---

## Phase L: Canvas Bugs — Transformer Handles + Aspect Ratio (AC-160, AC-161)

> Bug fixes for Artboard Canvas: oversized selection handles on scaled elements + AI images displaying as square instead of target aspect ratio.

### L1: Fix Transformer Handle Scaling (AC-160)

- [x] `ArtboardElement.tsx`: compute `effectiveScale = Math.max(element.scaleX ?? 1, element.scaleY ?? 1, 1)`. Divide `anchorSize` and `borderStrokeWidth` by `effectiveScale` in addition to existing zoom division
- [x] `ImageLayer.tsx`: same fix — divide `anchorSize` and `borderStrokeWidth` by element's max scale
- [x] `EmojiLayer.tsx`: same fix
- [x] `ShapeLayer.tsx`: same fix
- [x] `TextLayer.tsx`: same fix
- [x] `BrushLayer.tsx`: same fix
- [x] Manual test: select a 1024×1024 image scaled to 4500×5400 → handles should be same visual size as on an unscaled element

### L2: Fix AI Image Aspect Ratio on Artboard (AC-161)

- [x] When a processed/resized image is saved back to the server and the artboard element updates its URL, also update element `width`/`height` from the new image's natural dimensions (load Image() → naturalWidth/naturalHeight)
- [x] Ensure artboard element displays correct aspect ratio (e.g. 5:6 for 4500×5400) instead of remaining square
- [x] Manual test: generate 1024×1024 image → open in Editor → Resize to 4500×5400 → save → switch to Canvas tab → artboard element shows 5:6 ratio

### L3: Resolution Info Badge on Artboard Element

- [x] Add small resolution overlay badge to image elements on the artboard (bottom-right corner of element)
- [x] Display format: "4500×5400" in JetBrains Mono, ~10px font
- [x] Semi-transparent dark background (matching existing overlay style: `rgba(11, 39, 49, 0.85)`, backdrop-filter blur)
- [x] Badge visible on hover or always (decide based on visual clutter)
- [x] Badge reads actual pixel dimensions from element `width × height` (after scale reset)

### L4: Tests + Lint

- [x] `npm run lint` clean
- [x] `npx tsc --noEmit` clean
- [x] Manual test: scale multiple element types (image, text, shape) → all have correctly-sized handles
- [x] Manual test: resolution badge shows correct dimensions on image elements

---

## Phase M: Canvas Navigation & Orientation (AC-162 to AC-169)

> Added: 2026-04-14

### M1: ResizeObserver Timing Fix (AC-162)

- [x] In `useArtboardCanvas.ts` useEffect: after creating ResizeObserver, check `if (containerRef.current)` and call `.observe()` immediately
- [x] Verify: on fresh page load, `stageWidth` and `stageHeight` become non-zero within first render cycle
- [x] Verify: Stage component renders (not blocked by `stageWidth > 0 && stageHeight > 0` guard)
- [x] Debug: add temporary `console.log('Stage dims:', stageWidth, stageHeight)` to confirm dimensions are set, remove after verification
- [x] Verify: artboards that exist in `artboardState.artboards` actually appear on the Konva canvas

### M2: panTo Method (AC-168)

- [x] Add `panTo(worldX, worldY)` method to `useArtboardCanvas` hook
- [x] Method sets `panX = stageWidth/2 - worldX * zoom`, same for Y
- [x] Add to `UseArtboardCanvasReturn` interface
- [x] Add to return object
- [x] Verify: calling `panTo(ab.x + ab.width/2, ab.y + ab.height/2)` centers the artboard on screen

### M3: Auto Fit-to-View on Load (AC-163)

- [x] In `DesignWorkspaceView.tsx`: add `hasFittedRef = useRef(false)`
- [x] Add useEffect that watches `artboardBounds` + `canvasHook.state.stageWidth/stageHeight`
- [x] When all three are truthy and `hasFittedRef.current === false`: call `canvasHook.fitToView(artboardBounds)`, set ref to true
- [x] Verify: opening a project with existing artboards shows all of them centered in viewport
- [x] Verify: adding a new artboard after load does NOT re-trigger auto-fit (EC-31)
- [x] Verify: opening a project with 0 artboards does not error (EC-30)

### M4: Click-to-Navigate from Right Panel (AC-164)

- [x] Modify `handlePanelSelectArtboard` in `DesignWorkspaceView.tsx`
- [x] After `artboardState.selectArtboard(id, false)`, find artboard by ID, call `canvasHook.fitToView(bounds)` — changed from panTo to fitToView for proper zoom
- [x] Pass `canvasHook.panTo` as `panTo` prop through `ArtboardCanvas`
- [x] Verify: clicking artboard entry in Right Panel's artboard list → canvas zooms to fit that artboard
- [x] Verify: artboard selection highlight appears on the centered artboard

### M5: Canvas Minimap Component (AC-165, AC-166, AC-167)

- [x] Create `partials/CanvasMinimap.tsx` (≈160×110px overlay)
- [x] Positioned `absolute`, bottom-right (bottom: 8px, right: 8px, zIndex: 20)
- [x] Calculate combined world bounds from all artboards + current viewport
- [x] Render each artboard as a small colored rectangle (selected = cyan, others = muted/transparent)
- [x] Render viewport as red-bordered rectangle showing currently visible area
- [x] Click handler: convert click position to world coordinates via scale/offset math, call `onPanTo(worldX, worldY)`
- [x] Hide when `artboards.length === 0` (AC-167)
- [x] Dark mode: ink background with 0.85 alpha + backdrop-blur. Light mode: white with 0.9 alpha
- [x] Min rect size: 3px (EC-32 — artboards always visible even when very far apart)
- [x] Import + render in `ArtboardCanvas.tsx` inside CanvasContainer, below context menus

### M6: Integration + Wiring

- [x] `ArtboardCanvas.tsx`: add `panTo` to props interface, destructure it
- [x] `DesignWorkspaceView.tsx`: pass `panTo={canvasHook.panTo}` to ArtboardCanvas
- [x] Minimap receives: `artboards`, `selectedIds`, `zoom`, `panX`, `panY`, `stageWidth`, `stageHeight`, `onPanTo`
- [x] Verify: minimap updates live when panning/zooming the canvas
- [x] Verify: minimap artboard highlight updates when selection changes

### M7: Verification + Cleanup

- [x] `npx tsc --noEmit` clean
- [x] `npm run lint` clean
- [x] Manual test: open project with 2+ artboards → all visible on load (auto fit-to-view)
- [x] Manual test: click artboard in Right Panel → canvas jumps to it
- [x] Manual test: minimap shows all artboards + viewport rect
- [x] Manual test: click on minimap → canvas navigates to clicked position
- [x] Manual test: zoom in/out → minimap viewport rect updates proportionally
- [x] Manual test: empty project (0 artboards) → no minimap visible, no errors
- [x] Manual test: artboards spread far apart → minimap scales down, all rects visible (≥3px)
- [x] Remove any debug console.logs added during M1

### M8: Artboard Auto-Resize to Image Dimensions (AC-169, EC-36, EC-37)

- [x] In `useArtboards.ts`: add post-hydration useEffect with `resizedIdsRef` guard
- [x] Detect artboards at default size (280×280) that have an `imageUrl`
- [x] Preload image via `new Image()`, read `naturalWidth`/`naturalHeight` on load
- [x] Update artboard `width`/`height` + image layer dimensions to match natural size
- [x] Skip artboards already resized (ref guard) or with non-default dimensions (EC-37)
- [x] Image load failure → artboard stays at 280×280, no error (EC-36)
- [x] Verify: AI-generated 1024×1024 images → artboard resizes to 1024×1024
- [x] Verify: upscaled 4500×5400 images → artboard resizes to 4500×5400
- [x] `npx tsc --noEmit` clean
- [x] `npm run lint` clean

---

## Phase N: Canvas ↔ Editor Decoupling (AC-170 to AC-197, EC-45 to EC-68)

> Frontend-only. No backend changes. Decouples Artboard Canvas and Image Editor — zero shared image state, explicit transfer actions only. Includes multi-select (N10–N11) and canvas stability bug fixes (N12).

### N1: useEditorBatch Hook (shared workspace-level state)

- [x] Create `workspace/hooks/useEditorBatch.ts` — manages editor batch image array
- [x] State: `editorBatch: Array<{ id, url, name, width?, height? }>`
- [x] `addToEditorBatch(images)` — append new images, assign UUIDs
- [x] `removeFromEditorBatch(id)` — remove single image by id
- [x] `clearEditorBatch()` — clear all images
- [x] `editorBatchCount` — derived count for badge
- [x] Wire hook into `DesignWorkspaceView` — lift state to workspace level

### N2: Remove Old Coupling (DesignWorkspaceView + DesignEditorView)

- [x] Remove `editorInitialImages` state from `DesignWorkspaceView`
- [x] Remove `handleOpenInEditor` that sets `editorInitialImages` + auto-switches tab
- [x] Remove `?designs=xxx` URL param logic for editor tab (keep only `?tab=editor`)
- [x] Remove `initialImages` prop from `DesignEditorView`
- [x] `DesignEditorView` receives `editorBatch` + `onAddToCanvas` callbacks instead
- [x] Editor's `batchImages` state syncs from `editorBatch` via useEffect (appends new items)
- [x] Verify: Canvas drag-drop still creates artboards only (no editor side effects) — `useExternalDrop` unchanged
- [x] `npx tsc --noEmit` clean after refactor

### N3: RightPanel IconButton Toolbar (Single + Multi Select)

- [x] Create `ToolbarButton` + `DeleteButton` styled components: 32px IconButtons with theme colors
- [x] In `PanelArtboardState`: add icon toolbar under artboard label with 4 IconButtons:
  - `AddPhotoAlternateOutlined` → tooltip "Add to Editor" → calls `onAddToEditor`
  - `OpenInNewOutlined` → tooltip "Open in Editor" → calls `onOpenInEditor`
  - `FileDownloadOutlined` → tooltip "Export" → calls `onExportSelected`
  - `DeleteOutline` → tooltip "Delete" → calls `onDeleteSelected`, icon color `error.main`
- [x] In `PanelMultiState`: replace existing full-width buttons with same icon toolbar pattern
- [x] Icon colors: `text.secondary` default, `text.primary` on hover. Delete: `error.main`
- [x] Add `onAddToEditor` + `onOpenInEditor` callback props to both panel components
- [x] Wire through `RightPanel.tsx` — pass all 4 callbacks to both panels

### N4: Context Menu — Transfer Actions

- [x] Add `onAddToEditor` + `onOpenInEditor` callback props to `ArtboardContextMenu`
- [x] Add "Add to Editor" menu item with `AddPhotoAlternateOutlined` icon — after "Save to Listings", with Divider
- [x] Add "Open in Editor" menu item with `OpenInNewOutlined` icon — after "Add to Editor"
- [x] Own Divider group separating transfer actions from Duplicate
- [x] Both items only visible when artboard `hasImage`

### N5: "Add to Editor" + "Open in Editor" Logic (DesignWorkspaceView)

- [x] Implement `handleAddToEditor(artboardIds)` — extracts imageUrl+label from selected artboards, calls `addToEditorBatch`
- [x] After adding: notistack snackbar "N images added to Editor" with `action` = "Open Editor" button that calls `setActiveTab('editor')`
- [x] Tab does NOT switch automatically (AC-172)
- [x] Refactor existing `handleOpenInEditor` — calls `addToEditorBatch` + `setActiveTab('editor')` (no `editorInitialImages`, no URL params)
- [x] Pass both callbacks to RightPanel panels + ArtboardContextMenu
- [x] Verify: added images appear in Editor batch when user manually switches tab
- [x] Verify: Editor DropZone still works independently (can add more images after switching)

### N6: Editor Independent Upload (verify isolation)

- [x] Verify: Editor `DropZone` adds images to `editorBatch` only — no artboard creation on Canvas
- [x] Verify: Editor "Browse Files" adds to `editorBatch` only
- [x] Verify: `useEditorUpload` still calls `uploadDesign` for server persistence (unchanged)
- [x] Verify: images uploaded in Editor are NOT visible on Canvas unless explicitly added

### N7: "Add to Canvas" IconButton in Editor BottomBar

- [x] Add `onAddToCanvas` callback prop to `DesignEditorView` — receives `{ url, name, width, height }`
- [x] In `DesignWorkspaceView`: implement `handleAddToCanvas` — calls `artboardState.addArtboard` with image data
- [x] Artboard placement: find rightmost existing artboard x + width + 40px gap. If no artboards, place at (0, 0) (EC-48)
- [x] Artboard sizing: scaled to max 600px preserving aspect ratio (reuse `fitDimensions` logic from `useExternalDrop`)
- [x] Add single IconButton in `UnifiedBottomBar` next to Download button — icon `DashboardCustomizeOutlined`, tooltip "Add to Canvas"
- [x] No thumbnail overlay (56px thumbnails too small). No batch action (no multi-select in Editor yet)
- [x] Notistack snackbar: "Image added to Canvas"
- [x] Tab does NOT switch — user stays in Editor

### N8: Editor Tab Badge (MUI Badge, batch count)

- [x] In `DesignWorkspaceView`: wrap Editor `TabButton` with MUI `Badge`
- [x] Badge content = `editorBatchCount` from `useEditorBatch`
- [x] Badge hidden (`invisible={true}`) when count is 0
- [x] Badge color: `secondary` (cyan `#00C8D7`)
- [x] Badge position: top-right corner of TabButton
- [x] Verify: badge updates immediately when images are added/removed

### N9: Tests + Cleanup

- [x] Unit test: `useEditorBatch` — add, remove, clear, count
- [x] Integration test: "Add to Editor" from PanelMultiState — verify snackbar + batch updated
- [x] Integration test: "Open in Editor" — verify tab switch + batch updated
- [x] Integration test: "Add to Canvas" — verify artboard created with correct dimensions
- [x] Verify: deleting artboard on Canvas does NOT affect Editor batch (AC-180)
- [x] Verify: removing image from Editor batch does NOT affect Canvas artboard (AC-180)
- [x] Verify: adding same artboard twice via "Add to Editor" → 2 items in batch (EC-51)
- [x] `npx tsc --noEmit` clean
- [x] `npm run lint` clean
- [x] Test file updated: `DesignEditorView.test.tsx` — `initialImages` → `editorBatch`
- [x] Manual test: full flow — upload to Canvas → Add to Editor → process → Add to Canvas → verify artboards

### N10: useEditorSelection Hook + BatchThumbnailStrip Multi-Select (AC-181 to AC-184, AC-186)

- [x] Create `editor/hooks/useEditorSelection.ts`:
  - `selectedIds: Set<string>` — selected image IDs
  - `lastClickedIndex: number` — for Shift range calculation
  - `toggleSelect(id, index)` — additive toggle single image
  - `shiftSelect(index, images)` — range select from lastClickedIndex to clicked index (min→max)
  - `selectAll(images)` — select all image IDs
  - `deselectAll()` — clear selection set
  - `isSelected(id)` — boolean check
  - Auto-clean: useMemo intersection removes stale IDs when images change
- [x] In `BatchThumbnailStrip`: add `$selected` prop to Thumbnail styled component — 2px border `secondary.main` (cyan) when selected, distinct from `$active` (coral for currently displayed)
- [x] Add checkbox overlay per thumbnail: MUI Checkbox, size="small", position absolute top-left, semi-transparent bg. Visible on hover OR when image is selected (AC-182)
- [x] Checkbox click → `onToggleSelect(id, index)` — toggles selection without changing displayed image (AC-183). `stopPropagation` prevents thumbnail navigation.
- [x] Thumbnail click: if `e.shiftKey` → `onShiftSelect(index)` for range select (AC-181). Else → `onSelect(index)` as before (change displayed image)
- [x] Add SelectAllToggle IconButton before ThumbnailList — toggles between `SelectAll` / `Deselect` icons based on whether all are selected (AC-186)
- [x] New props on BatchThumbnailStrip: `selectedIds`, `onToggleSelect`, `onShiftSelect`, `onSelectAll`, `onDeselectAll` — all optional for backward compat
- [x] Verify: selected (cyan) + active (coral) borders can coexist on same thumbnail (AC-184)
- [x] `npx tsc --noEmit` clean

### N11: UnifiedBottomBar Context-Aware + DesignEditorView Wiring (AC-185, AC-187, AC-188)

- [x] In `UnifiedBottomBar`: add `selectedCount` + `onAddSelectedToCanvas` props
- [x] When `selectedCount > 0`: replace single "Add to Canvas" IconButton with "N selected" Chip + "Add Selected to Canvas" Button (outlined, secondary)
- [x] When `selectedCount === 0`: show existing single "Add to Canvas" IconButton (AC-185)
- [x] In `DesignEditorView`: wire `useEditorSelection` hook
- [x] Pass selection callbacks to `BatchThumbnailStrip`
- [x] Pass `selectedCount` + `onAddSelectedToCanvas` to `UnifiedBottomBar`
- [x] Implement `handleAddSelectedToCanvas`: loop selected IDs, collect image data (url, name, width, height), call `onAddToCanvas` per image (AC-187)
- [x] After "Add Selected to Canvas": clear selection + snackbar "N images added to Canvas" (AC-188)
- [x] `npx tsc --noEmit` clean
- [x] `npm run lint` clean
- [x] Manual test: Shift+Click range select → "Add Selected to Canvas" → verify artboards created on Canvas

### N12: Canvas Stability Bug Fixes (AC-189 to AC-197, EC-61 to EC-68)

> All bugs discovered and fixed during Phase N implementation (2026-04-14). No new features — correctness fixes.

#### Zoom-to-Cursor (AC-189, EC-61)
- [x] `useArtboardCanvas.ts`: add `stageRef` + `setStageRef` to read live Konva Stage position
- [x] `handleWheel` reads `stageRef.current.x()/y()` instead of stale React `panX`/`panY`
- [x] `ArtboardCanvas.tsx`: `stageCallbackRef` syncs both local ref and canvas hook ref
- [x] `DesignWorkspaceView.tsx`: wire `setStageRef` to ArtboardCanvas

#### Drop Position Accuracy (AC-190, EC-62)
- [x] `ArtboardCanvas.tsx`: `screenToWorld` reads live `stageRef.current.x()/y()` instead of React state
- [x] Verified: drop after panning places artboard at correct world position

#### Artboard Auto-Naming (AC-191)
- [x] Create shared `nextArtboardLabel()` in `board/utils/artboardSizing.ts`
- [x] `useArtboards.ts` `addArtboard`: uses `nextArtboardLabel(prev.map(ab => ab.label))`
- [x] `useArtboards.ts` `hydrateDesigns`: uses `nextArtboardLabel(allLabels)` instead of `Artboard ${i+1}`

#### Artboard Sizing on Drop (AC-192, EC-63)
- [x] Create shared `fitToMaxDimension()` in `board/utils/artboardSizing.ts` (max 600px, aspect ratio)
- [x] `useExternalDrop.ts`: replaced local `fitDimensions` + uses `createImageBitmap` for reliable file dimensions
- [x] `useContextMenu.ts`: replaced inline sizing with `fitToMaxDimension`
- [x] `DesignWorkspaceView.tsx` `handleAddToCanvas`: replaced inline sizing with `fitToMaxDimension`

#### Re-Hydration Preserves Local State (AC-193, AC-194, EC-64, EC-65)
- [x] `hydrateDesigns` accepts `existingArtboards` — looks up by both `ab.id` AND `ab.designId`
- [x] Priority chain: existing in-memory > saved layout > defaults (no more 280px fallback for known artboards)
- [x] `localOnly` filter excludes artboards whose `designId` matches a server design (no duplicates)
- [x] Locally-added artboards (blob URLs uploading) preserved across re-hydrations

#### Server-Side Deletion on Backspace/Delete (AC-195, EC-66)
- [x] Keyboard handler calls `handleDeleteSelectedRef.current()` instead of direct `removeArtboards()`
- [x] `handleDeleteSelected` shows confirm dialog for server-persisted designs, calls `DELETE /api/designs/{id}/`
- [x] Ref pattern avoids dependency cycle in keyboard useEffect

#### Aspect Ratio Lock (AC-196, EC-68)
- [x] `ArtboardElement.tsx`: removed edge handles (`middle-left/right`, `top/bottom-center`) in normal mode
- [x] Only 4 corner handles available in normal mode → enforces `keepRatio=true`
- [x] Free-transform mode (double-click): all 8 handles, `keepRatio=false`

#### Label Constant Screen Size (AC-197, EC-67)
- [x] `Artboard.tsx`: label `fontSize` and `y`-offset divided by `zoom`
- [x] Label stays ~12px visual size at all zoom levels

#### Shared Util + Dedup
- [x] Created `board/utils/artboardSizing.ts`: `MAX_ARTBOARD_DIM`, `DEFAULT_ARTBOARD_WIDTH/HEIGHT`, `fitToMaxDimension()`, `nextArtboardLabel()`
- [x] Removed duplicated sizing logic from 4 files
- [x] `npx tsc --noEmit` clean
- [x] `npm run lint` clean
