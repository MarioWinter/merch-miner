# PROJ-9: Design Generation (OpenRouter) — Implementation Tasks

## Key Technical Decisions (from architecture review 2026-03-27 + frontend-design 2026-03-30 + project refactor 2026-03-30 + artboard redesign 2026-03-31)

- **New Django app:** `design_app` — Design generation, image analysis, post-processing pipeline
- **DesignProject model:** Kittl-style project folders. Designs ↔ Projects = M2M. Optional niche binding. Board layout stored per project
- **2 frontend routes:** `/designs` (Project Gallery) + `/designs/:projectId` (Unified Design Workspace with 2 tab-modes)
- **Unified Design Workspace:** Tab 1 = Artboard Canvas (Konva.js), Tab 2 = Image Editor (Konva.js). Both independent, context-only transfer
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

## Phase A5: Frontend — Design Board (React Flow Canvas) — ⚠️ DEPRECATED

> **DEPRECATED 2026-03-31:** React Flow node-graph replaced by Kittl-style Artboard Canvas (Konva.js).
> All A5 work below was completed but will be replaced by Phase D (Unified Design Workspace).
> Hooks (useBoardContext, useGeneration, useDesignActions, useImageAnalysis) are KEPT and adapted.
> React Flow components (ReferenceNode, GenerateHubNode, VariantNode, GeneratingNode, BoardMinimap) will be REMOVED.
> PromptBar, ModelSelector, BackgroundColorPicker are KEPT and adapted for new layout.

### A5.1: Canvas Foundation

- [x] Install `@xyflow/react` package
- [x] `DesignBoardView.tsx`: REWRITE — React Flow canvas with dotted grid background, PromptBar, ConfigPanel, CanvasToolbar
- [x] `useBoardLayout.ts`: NEW — manage React Flow node positions, auto-layout on initial load (references left column, hub center)
- [x] `useBoardNodes.ts`: NEW — convert API data (references, designs, runs) into React Flow nodes + edges
- [x] `useImageAnalysis.ts`: NEW — trigger Gemini 3 analysis, poll, populate prompt
- [x] React Flow dark mode: dotted grid on #071E26, node borders rgba(255,255,255,0.08)
- [x] Route registered in `App.tsx`

### A5.2: Custom Nodes

- [x] `ReferenceNode.tsx`: NEW — thumbnail (120×120), title, "Analyze" button, right-side connection port, cyan dot
- [x] `GenerateHubNode.tsx`: NEW — central ⚡ Generate hub node, left ports (from refs), bottom ports (to variants)
- [x] `VariantNode.tsx`: NEW — generated design thumbnail (160×160), status chip, approve/reject buttons, quick actions (BG Remove, Upscale, Download), "Open in Editor →", coral glow on approved
- [x] `GeneratingNode.tsx`: NEW — skeleton/shimmer animation during generation, cancel button, transforms to VariantNode(s) on completion

### A5.3: Prompt Bar (Kittl-style, bottom fixed)

- [x] `PromptBar.tsx`: NEW — fixed bottom bar: header with slogan, source→result thumbnails, multiline prompt field, Prompt Builder accordion, controls row
- [x] Embed existing `PromptEditor.tsx` inside PromptBar (keep component, adapt layout)
- [x] Embed existing `ModelSelector.tsx` in controls row
- [x] Embed existing `BackgroundColorPicker.tsx` in controls row (3 swatches inline)
- [x] Generate button: AI Action Button style (coral gradient + shimmer)
- [x] Prompt Builder accordion: shows 7-step analysis breakdown when available

### A5.4: Config Panel + Toolbar

- [x] `ConfigPanel.tsx`: NEW — 320px right slide-in panel. Reference node click: full image, analysis fields, "Use as Reference", "Analyze Image". Variant node click: full image, generation details, approve/reject, BG Remove, Upscale, Download, "Open in Editor →"
- [x] `CanvasToolbar.tsx`: NEW — 40px bottom bar below canvas: zoom controls, fit-to-view, add node (upload image), minimap toggle, node count
- [x] `BoardMinimap.tsx`: NEW — React Flow MiniMap, togglable, hidden by default

### A5.5: Connections + Interactions

- [x] Auto-connect: references → hub on load via animated dashed cyan edges (#00C8D7)
- [x] Hub → variants: solid edges branching to each generated variant
- [x] Manual connect: drag from unconnected reference port to hub
- [x] Drag external images from desktop onto canvas → creates new reference node
- [x] Multiple Generate Hub nodes: user can add new hub for A/B testing
- [x] Board position persistence: save node positions to backend on change (debounced)

### A5.6: Backend — Board Layout Persistence

- [x] Add `board_layout` JSONField to `Idea` model (nullable, default=None) — stores node positions + edges
- [x] Migration for new field
- [x] `PATCH /api/ideas/{id}/` — accept `board_layout` in request body
- [x] `GET /api/ideas/{id}/design-board/` — include `board_layout` in response

### A5.7: Deprecate Old Partials

- [x] Remove or archive: `DesignGallery.tsx` (replaced by VariantNode on canvas)
- [x] Remove or archive: `DesignCard.tsx` (replaced by VariantNode)
- [x] Remove or archive: `ReferencePanel.tsx` (replaced by ConfigPanel)
- [x] Adapt `GenerationProgress.tsx` for embedding in GeneratingNode
- [x] Move `BatchProcessPanel.tsx` into ConfigPanel section

### A5.8: Quick-jump

- [x] Quick-jump button on IdeaCard (PROJ-8): navigates to `/design-board/:ideaId`

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

## Phase B5: Post-Processing — Cloud Import + Export

- [ ] `CloudImportDialog.tsx`: Google Drive picker (OAuth2 + Google Picker API) + OneDrive picker (Microsoft Graph API). Import selected images into batch
- [ ] `ExportDialog.tsx`: format (PNG default), DPI (300 default), compression level slider, download single or all (zip). Option: overwrite original or create new version
- [ ] Pica.js integration: client-side upscaling for images ≥ threshold. Web Worker for non-blocking. Quality comparison (before/after preview)

---

## Phase B6: i18n — Post-Processing Editor

- [x] `design.editor.*` — page title, drag-drop hint, batch count
- [x] `design.pipeline.*` — toolbar labels, preset save/load/delete, conditional logic labels
- [x] `design.tools.*` — all tool names (resize, trim, rotate, filters, eraser, wand, etc.)
- [x] `design.tools.params.*` — parameter labels per tool (size, tolerance, threshold, etc.)
- [x] `design.edge.*` — defringe, shrink, color defringe, edge cleaner labels
- [x] `design.qc.*` — transparency highlighter, compressor labels
- [x] `design.export.*` — format, DPI, compression, download labels
- [ ] `design.cloud.*` — Google Drive, OneDrive, import button labels
- [x] `design.settings.*` — provider labels, API key placeholder, threshold
- [x] All 5 locales: EN, DE, FR, ES, IT (482 design keys synced)

---

## Phase B7: Tests — Post-Processing

### Backend

- [ ] Pipeline CRUD: create, update, delete, list presets
- [ ] Apply pipeline: enqueues correct jobs per tool, returns client-side steps
- [ ] BG remover service: rembg produces transparent PNG, API fallback works
- [ ] Upscaler service: auto-mode routes correctly (client hint vs API)
- [ ] ProcessingSettings: CRUD, encrypted API keys, workspace isolation

### Frontend

- [ ] DesignEditorView: renders with empty state, drag-drop loads images
- [ ] PipelineToolbar: add/remove/reorder tools, preset save/load
- [ ] EditorCanvas: renders image, eraser tool removes pixels
- [ ] BatchThumbnailStrip: navigation, status indicators
- [ ] ExportDialog: format/DPI/compression controls work
- [ ] TypeScript + ESLint + Ruff: 0 errors

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
- [ ] Migration (alter Design.idea + DesignGenerationRun.idea to nullable, add DesignProject + through table) — **run via Docker**
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

## Phase C3: Frontend — Board Refactor (ideaId → projectId) — ⚠️ SUPERSEDED BY PHASE D

> **SUPERSEDED 2026-03-31:** Route + view changes, layout persistence, generate flow, and naming dialog
> are all handled in Phase D (Unified Design Workspace). ProjectNamingDialog already implemented.
> Hooks already updated to use projectId. Phase D completes the remaining integration.

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
- [ ] Cloud import (Google Drive + OneDrive)
- [x] Settings UI: provider selection, API keys, threshold
- [ ] All tests pass, lint clean

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
