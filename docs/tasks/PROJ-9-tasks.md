# PROJ-9: Design Generation (OpenRouter) — Implementation Tasks

## Key Technical Decisions (from architecture review 2026-03-27)

- **New Django app:** `design_app` — Design generation, image analysis, post-processing pipeline
- **2 frontend routes:** `/design-board/:ideaId` (idea-scoped board) + `/design-editor` (standalone batch tool)
- **Dedicated `worker-design`:** Queue `design` (30min timeout), parallel with research/slogan workers
- **Konva.js + Web Workers:** Client-side image editing tools (eraser, wand, filters, defringe)
- **Pica.js:** Client-side upscaling for images ≥3000px (Lanczos filter, free, fast)
- **rembg (u2net):** Self-hosted BG removal, 170MB model. External API as Settings-configurable fallback
- **Auto upscale mode:** ≥3000px → Pica.js (client), <3000px → external API. Configurable in Settings
- **Pipeline model:** JSONField with ordered tool+params list. Presets saveable/loadable
- **File storage:** Django FileField + media/ for MVP. S3 migration path available

---

## Phase A1: Backend Foundation

- [ ] Create `design_app/` Django app, register in `INSTALLED_APPS`
- [ ] Create `design_app/api/` + `design_app/services/` subpackages
- [ ] Wire into `core/urls.py` under `/api/designs/` and `/api/ideas/{id}/designs/`
- [ ] `DesignGenerationRun` model: UUID pk, `idea` FK, `model_name` choices (gemini_flash/gemini_pro/gpt_image/flux), `status` (pending/running/completed/failed), `triggered_by` FK, `prompt_used` TextField, `created_at`, `completed_at` (nullable), `error_message` TextField
- [ ] `Design` model: UUID pk, `workspace` FK, `idea` FK, `generation_run` FK (nullable), `image_file` FileField, `status` (pending/approved/rejected/failed), `is_manual` BooleanField, `background_color` choices (light_gray/neon_pink/neon_green), `source_image_url` URLField, `prompt_analysis` JSONField (7-step output), `upscaled_file` FileField (nullable), `bg_removed_file` FileField (nullable), `created_at`
- [ ] `DesignProcessingJob` model: UUID pk, `design` FK, `type` choices (upscale/bg_remove), `status` (pending/running/completed/failed), `result_file` FileField (nullable), `error_message` TextField, `created_at`, `completed_at` (nullable)
- [ ] `ProcessingSettings` model: `workspace` FK (OneToOne), `bg_removal_provider` (rembg/api), `bg_removal_api_key` EncryptedCharField, `upscale_provider` (pica/api/auto), `upscale_api_key` EncryptedCharField, `upscale_auto_threshold` IntegerField (default=3000)
- [ ] Indexes: `(workspace, idea)` on Design, `(design, type)` on DesignProcessingJob
- [ ] Initial migration
- [ ] Admin registration
- [ ] RQ queue `design` in `settings.py → RQ_QUEUES` (30-min timeout)
- [ ] `worker-design` Docker service in `docker-compose.yml` + bind-mount in `docker-compose.override.yml`
- [ ] `rembg` + `Pillow` in `requirements.txt`
- [ ] Media file storage: `MEDIA_ROOT` + `MEDIA_URL` in `settings.py`

---

## Phase A2: Image Analysis + Prompt Construction

- [ ] `services/image_analyzer.py`: Gemini 3 Architect 7-step analysis. Input: image URL. Output: structured JSON (text_dna, visual, spatial, style, color, tech, final_prompt). Uses OpenRouter (Gemini model)
- [ ] 9 Critical Rules embedded in system prompt for step 7 (final prompt synthesis)
- [ ] `services/prompt_builder.py`: Two paths — image-driven (from 7-step analysis) and idea-driven (from DB fields: slogan_text, visual_style, vibe, graphic_elements, tone)
- [ ] Background color injection as final prompt instruction (hex + "solid, saturated, no gradients")
- [ ] Fallback: image URL 403/404 → fall back to idea-driven prompt. Malformed analysis output → display raw in editor
- [ ] Reuse check: if product already has `prompt_analysis` from prior PROJ-7 "Analyze Design" → skip re-analysis

---

## Phase A3: Design Generation API

### CRUD + Board Context

- [ ] `GET /api/ideas/{id}/design-board/` — returns slogan, reference images (NicheResearchProduct with all analysis fields), existing designs. Workspace-scoped
- [ ] `GET /api/ideas/{id}/designs/` — list all designs for idea with status, ordered by created_at desc
- [ ] `PATCH /api/designs/{id}/` — update status (approved/rejected). Auto-reject previous approved when new one approved
- [ ] `GET /api/designs/{id}/download/` — returns image file (FileResponse or redirect to signed URL)
- [ ] `DELETE /api/designs/{id}/` — hard delete, workspace member or admin only

### Generation + Analysis

- [ ] `POST /api/ideas/{id}/designs/generate/` — body: `{model, background_color, prompt}`. Enqueues django-rq job. Returns run record (status=pending). Retry once on OpenRouter timeout
- [ ] `POST /api/designs/{id}/analyze-image/` — body: `{source_image_url}`. Enqueues Gemini 3 Architect analysis. Returns run record for polling
- [ ] `GET /api/designs/runs/{run_id}/` — poll generation/analysis run status + result

### Batch Processing

- [ ] `POST /api/designs/batch-process/` — body: `{design_ids: [...], steps: ["upscale", "bg_remove"]}`. Creates one `DesignProcessingJob` per (design × step). Returns job records
- [ ] `GET /api/designs/processing-jobs/{job_id}/` — poll individual batch job status

### Serializers

- [ ] `DesignSerializer` — all fields, nested `generation_run` (status, model, prompt), nested `idea` (id, slogan_text)
- [ ] `DesignBoardSerializer` — slogan, reference images with analysis fields, designs list
- [ ] `DesignGenerationRunSerializer` — status, prompt_used, model_name, timestamps
- [ ] `DesignProcessingJobSerializer` — status, type, result_file URL, error_message

---

## Phase A4: Task Runner (django-rq)

- [ ] `tasks.py: task_generate_design(run_id)` — call OpenRouter image generation API with prompt + model. Download result. Save to `Design.image_file`. Update run status
- [ ] `tasks.py: task_analyze_image(design_id)` — call Gemini 3 Architect (7-step). Save structured output to `Design.prompt_analysis`. Return prompt to board
- [ ] `tasks.py: task_upscale_design(job_id)` — read ProcessingSettings. Auto mode: check dimensions → Pica.js hint (return to client) or API call. Save to `Design.upscaled_file`
- [ ] `tasks.py: task_remove_background(job_id)` — read ProcessingSettings. rembg (u2net) or API. Save to `Design.bg_removed_file`
- [ ] Content policy refusal handling: `Design(status=failed, error_message=...)`
- [ ] Per-job failure isolation: one failed job doesn't block batch
- [ ] Langfuse observability on LLM calls (image analysis)

---

## Phase A5: Frontend — Design Board

- [ ] `DesignBoardView.tsx`: Full-page route `/design-board/:ideaId`. Split layout: reference panel (left), prompt + controls (center), gallery (right)
- [ ] `useBoardContext` hook: load idea + references + existing designs via RTK Query
- [ ] `useGeneration` hook: trigger generation, poll every 3s, auto-stop on terminal state
- [ ] `useImageAnalysis` hook: trigger Gemini 3 analysis, poll, populate prompt editor
- [ ] `ReferencePanel.tsx`: reference images from NicheResearchProduct. Click "Analyze Image" per image. Shows analysis fields (visual_style, vibe, etc.)
- [ ] `PromptEditor.tsx`: MUI TextField (multiline, editable). Pre-filled from analysis or auto-constructed. Shows 7-step breakdown as expandable accordion
- [ ] `ModelSelector.tsx`: MUI Select — Gemini Flash / Gemini Pro / GPT Image / Flux
- [ ] `BackgroundColorPicker.tsx`: MUI ToggleButtonGroup — 3 color swatches (light_gray, neon_pink, neon_green). Default: light_gray
- [ ] `DesignGallery.tsx`: MUI Grid of DesignCards. Shows all generated designs for this idea
- [ ] `DesignCard.tsx`: image thumbnail, status chip (pending/approved/rejected/failed), approve/reject buttons, download button. Approved = green border
- [ ] `GenerationProgress.tsx`: MUI LinearProgress + Skeleton during pending. Error state with retry button
- [ ] `BatchProcessPanel.tsx`: select multiple approved designs → "Upscale + Remove BG" button. Per-job progress. Individual failure display
- [ ] Route registered in `App.tsx`
- [ ] Quick-jump button on IdeaCard (PROJ-8): navigates to `/design-board/:ideaId`

---

## Phase A6: Frontend — PROJ-7 Integration ("Analyze Design")

- [ ] "Analyze Design" button in PROJ-7 `ProductCard.tsx` and/or `ProductDetailPanel.tsx`
- [ ] On click: call `POST /api/designs/{id}/analyze-image/` with product image URL
- [ ] Poll for analysis completion
- [ ] On success: notistack toast "Design analyzed — prompt ready for Design Board"
- [ ] Store `prompt_analysis` on product (or associated record) for reuse
- [ ] i18n keys for analyze button + success/error messages

---

## Phase A7: RTK Query Slice + Types

- [ ] RTK Query `designApi` slice (`store/designSlice.ts`): getBoardContext, listDesigns, generateDesign, analyzeImage, pollRunStatus, updateDesignStatus, downloadDesign, batchProcess, pollProcessingJob
- [ ] Cache tags: `providesTags` on board/list; `invalidatesTags` on generate/approve/reject
- [ ] Register slice in `store/index.ts`
- [ ] TypeScript types: Design, DesignGenerationRun, DesignProcessingJob, BackgroundColor, DesignModel, DesignStatus, BoardContext

---

## Phase A8: i18n — Design Board

- [ ] `design.board.*` — page title, analyze button, generate button, prompt placeholder
- [ ] `design.model.*` — gemini_flash, gemini_pro, gpt_image, flux labels
- [ ] `design.background.*` — light_gray, neon_pink, neon_green labels
- [ ] `design.status.*` — pending, approved, rejected, failed
- [ ] `design.gallery.*` — approve, reject, download, retry
- [ ] `design.batch.*` — process button, upscale, bg_remove, progress, failure
- [ ] `design.analyze.*` — button label, progress, success, error, fallback warning
- [ ] `design.empty.*` — no designs, CTA
- [ ] All 5 locales: EN, DE, FR, ES, IT

---

## Phase A9: Tests — Design Generation

### Backend

- [ ] Model tests: DesignGenerationRun status transitions, Design auto-reject on new approve
- [ ] Board context API: returns slogan + references + designs, workspace isolation
- [ ] Generate API: enqueues job, returns run record, polls status
- [ ] Analyze API: triggers Gemini 3, stores prompt_analysis, reuse check
- [ ] Batch process: creates N jobs, individual failure isolation
- [ ] Download API: returns file, 404 on missing
- [ ] Workspace isolation on all endpoints

### Frontend

- [ ] DesignBoardView: renders board with references + prompt + gallery
- [ ] DesignCard: approve/reject toggles status, approved shows green border
- [ ] PromptEditor: pre-fills from analysis, editable
- [ ] BackgroundColorPicker: default light_gray, selection updates state
- [ ] GenerationProgress: shows skeleton during pending, error with retry
- [ ] BatchProcessPanel: select designs, trigger, per-job progress
- [ ] TypeScript + ESLint + Ruff: 0 errors

---

## Phase B1: Post-Processing — Pipeline Model + API

- [ ] `DesignPipeline` model: UUID pk, `workspace` FK, `name` CharField, `tools` JSONField (ordered list of `{tool_name, params, condition}` objects), `is_preset` BooleanField, `created_by` FK, `created_at`
- [ ] Migration
- [ ] `GET /api/designs/pipelines/` — list workspace pipelines/presets
- [ ] `POST /api/designs/pipelines/` — create pipeline
- [ ] `PATCH /api/designs/pipelines/{id}/` — update pipeline
- [ ] `DELETE /api/designs/pipelines/{id}/` — delete pipeline
- [ ] `POST /api/designs/apply-pipeline/` — body: `{design_ids: [...], pipeline_id}`. Enqueues server-side steps, returns client-side steps list for Konva.js execution

---

## Phase B2: Post-Processing — Server-Side Services

- [ ] `services/bg_remover.py`: rembg wrapper (u2net model). Load model on first call, cache in memory. Input: image file path. Output: transparent PNG path. Fallback: external API if configured
- [ ] `services/upscaler.py`: Auto-mode logic — check dimensions vs threshold → return "client" hint (Pica.js) or call external API. Input: image file + target dimensions. Output: upscaled file path
- [ ] `ProcessingSettings` API: `GET/PATCH /api/designs/settings/` — workspace-scoped. Provider selection, API keys (encrypted), auto threshold
- [ ] Settings UI serializer: provider choices, threshold, masked API keys

---

## Phase B3: Post-Processing — Editor UI (Konva.js)

- [ ] `DesignEditorView.tsx`: Full-page route `/design-editor`. Layout: pipeline toolbar (top), tool params (left), canvas (center), thumbnail strip (bottom)
- [ ] `usePipeline` hook: ordered tool list, add/remove/reorder tools, conditional logic, save/load presets
- [ ] `useBatchImages` hook: drag-drop handler (100+ images), thumbnail navigation, per-image status tracking
- [ ] `useCanvasTools` hook: active tool state, Konva.js integration, undo/redo stack
- [ ] `useProcessing` hook: trigger server-side jobs (BG remove, upscale), poll status, download results
- [ ] `PipelineToolbar.tsx`: horizontal pill-bar — each tool as a chip/pill. Drag to reorder. Click to configure. Add/remove buttons
- [ ] `PipelinePresetDropdown.tsx`: MUI Menu — save current pipeline as preset, load existing presets, delete presets
- [ ] `ToolParameterPanel.tsx`: left panel — shows params for active tool (sliders, toggles, color pickers). Context-sensitive per tool type
- [ ] `EditorCanvas.tsx`: Konva.js Stage + Layer. Renders current image. Tool overlays (eraser cursor, wand selection). Zoom/pan controls
- [ ] `BatchThumbnailStrip.tsx`: horizontal scrollable strip. Click to navigate. Status indicators per image (pending/processed/error). Current image highlighted
- [ ] Route registered in `App.tsx`

---

## Phase B4: Post-Processing — Client-Side Tools

### Canvas Tools (Konva.js + Web Workers)

- [ ] Resize/Reposition: target canvas (4500x5400 default), Align-to-Top, configurable padding
- [ ] Color Removal: remove specific color from image (tolerance slider)
- [ ] Color Adjustment: brightness, contrast, saturation sliders
- [ ] Trim: auto-crop excess whitespace/transparency
- [ ] Rotate/Flip: 90° rotation, horizontal/vertical flip
- [ ] Filters: preset filters (brightness, contrast, saturation, hue shift)
- [ ] Sprinkle/Speckle Remover: detect + remove small isolated pixel groups
- [ ] Transparency Cleaner: remove near-transparent pixels below threshold
- [ ] Distress: vintage/used-look texture overlay effects
- [ ] Watermark: text + image watermark with position/opacity controls

### Edge Cleanup Tools

- [ ] Auto-Detect Defringe: analyze edge pixels, detect color fringe, suggest shrink value
- [ ] Manual Shrink: slider 0-5px with live preview on canvas
- [ ] Color Defringe: detect background color in edge, replace semi-transparent edge pixels with nearest design color
- [ ] Edge Cleaner: multi-step edge smoothing (anti-alias pass)

### Quality Control

- [ ] Transparency Highlighter: overlay visualization — highlights semi-transparent pixels in red/yellow
- [ ] Built-in Compressor: reduce file size <2MB. Quality slider with live size preview

### Manual Correction

- [ ] Eraser Tool: brush-based pixel removal. Size slider, hardness slider
- [ ] Magic Wand: click-to-select by color similarity. Tolerance slider. Delete/clear selection
- [ ] Per-image preview in batch: click thumbnail → load in canvas → correct → next

---

## Phase B5: Post-Processing — Cloud Import + Export

- [ ] `CloudImportDialog.tsx`: Google Drive picker (OAuth2 + Google Picker API) + OneDrive picker (Microsoft Graph API). Import selected images into batch
- [ ] `ExportDialog.tsx`: format (PNG default), DPI (300 default), compression level slider, download single or all (zip). Option: overwrite original or create new version
- [ ] Pica.js integration: client-side upscaling for images ≥ threshold. Web Worker for non-blocking. Quality comparison (before/after preview)

---

## Phase B6: i18n — Post-Processing Editor

- [ ] `design.editor.*` — page title, drag-drop hint, batch count
- [ ] `design.pipeline.*` — toolbar labels, preset save/load/delete, conditional logic labels
- [ ] `design.tools.*` — all tool names (resize, trim, rotate, filters, eraser, wand, etc.)
- [ ] `design.tools.params.*` — parameter labels per tool (size, tolerance, threshold, etc.)
- [ ] `design.edge.*` — defringe, shrink, color defringe, edge cleaner labels
- [ ] `design.qc.*` — transparency highlighter, compressor labels
- [ ] `design.export.*` — format, DPI, compression, download labels
- [ ] `design.cloud.*` — Google Drive, OneDrive, import button labels
- [ ] `design.settings.*` — provider labels, API key placeholder, threshold
- [ ] All 5 locales: EN, DE, FR, ES, IT

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

## Verification Checklist

### Phase A: Design Generation
- [ ] `design_app` registered, migrations applied
- [ ] Board loads with idea context (slogan + references + designs)
- [ ] Gemini 3 Architect analysis produces structured prompt
- [ ] Idea-driven prompt auto-constructs from DB fields
- [ ] 4 AI models selectable (Gemini Flash/Pro, GPT Image, Flux)
- [ ] 3 background colors work (light_gray, neon_pink, neon_green)
- [ ] Only 1 approved design per idea (auto-reject previous)
- [ ] Batch upscale + bg_remove with per-job status
- [ ] "Analyze Design" button in PROJ-7 UI works + reuses analysis on board
- [ ] worker-design runs independently

### Phase B: Post-Processing
- [ ] Pipeline: chain tools, save preset, load preset, conditional logic
- [ ] Drag-drop 100+ images, thumbnail strip navigation
- [ ] Client-side tools: resize, trim, rotate, filters, defringe, eraser, wand
- [ ] AI BG Remove (rembg u2net) produces clean transparent PNG
- [ ] AI Upscale auto-mode routes correctly
- [ ] Export: PNG 300 DPI, <2MB compression, single/all download
- [ ] Cloud import (Google Drive + OneDrive)
- [ ] Settings UI: provider selection, API keys, threshold
- [ ] All tests pass, lint clean
