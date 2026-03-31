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

- [x] `tasks.py: task_generate_design(run_id)` — call OpenRouter image generation API with prompt + model. Download result. Save to `Design.image_file`. Update run status
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

## Phase D: Unified Design Workspace (Artboard Canvas + Image Editor)

> Decided 2026-03-31. Replaces React Flow board (Phase A5) with Kittl-style artboard canvas.
> Merges `/design-board/:projectId` + `/design-editor` into single route `/designs/:projectId`.
> Two tab-modes: Artboard Canvas (Tab 1) + Image Editor (Tab 2). Independent, context-only transfer.

### D1: Cleanup — Remove React Flow, Unify Routes

- [ ] Remove `@xyflow/react` from `package.json` (run `npm uninstall @xyflow/react`)
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

- [ ] `ArtboardCanvas.tsx`: NEW — Konva.js Stage filling tab content area. Infinite pan (drag empty canvas) + zoom (scroll wheel, pinch). Canvas bg: dark `#1A1A2E` / light `#E8E8E8`. Grid dots at zoom >30%
- [ ] `useArtboardCanvas` hook: NEW — canvas state (zoom, pan offset, stage dimensions). Resize observer. Wheel zoom handler. Fit-to-view
- [ ] Fix Konva.js drag-and-drop bug: individual artboards must move independently without snapping back. Stage `draggable` for panning, artboard Groups `draggable` for repositioning

### D3.2: Artboard Component

- [ ] `Artboard.tsx`: NEW — Konva Group containing: labeled frame above (text), white background rect, image inside, selection border (dashed blue `#4A9EFF` + resize handles on select). Draggable + selectable
- [ ] `useArtboards` hook: NEW — manages artboard list (positions, sizes, selection state, connections). Loads from `board_layout`. Persists on change (debounced)
- [ ] Click artboard = select (single). Shift+click = multi-select. Click empty canvas = deselect all
- [ ] Drag-select rectangle: rubber-band selection for multiple artboards
- [ ] Artboard labels: "Artboard 1", "AI Image Board", custom names. Editable on double-click label

### D3.3: AI Image Board + Connection Arrows

- [ ] `ConnectionArrow.tsx`: NEW — thin 1px line (Konva Arrow) from source artboard edge to AI Board edge. Color = `text.secondary`. Purely visual, not interactive
- [ ] "Add AI Image Board" via context menu on source artboard → creates new artboard to the right, auto-connected
- [ ] AI Image Board shows "✦ AI Image Board" label in cyan. "Regenerate" button below frame when selected
- [ ] Connections stored in `board_layout.connections[]` as `{sourceId, targetId}`

### D3.4: Context Menu

- [ ] `ArtboardContextMenu.tsx`: NEW — MUI Menu on right-click artboard: "Add AI Image Board", "Duplicate", "Delete", "Bring to Front", "Send to Back"
- [ ] Right-click empty canvas: "Add Artboard" (upload image), "Paste"

### D3.5: Right Panel (280px, always visible)

- [ ] `RightPanel.tsx`: NEW — context-sensitive. Three states:
- [ ] Nothing selected: project search, "Project Colors" (extracted from designs), Tools list (AI Image Board, Flatten, Upscale, Reframe, BG Remove)
- [ ] Artboard selected: Artboard Size (W×H, preset dropdown: Square 1200, MBA 4500×5400), Layer (opacity), Color (bg hex), Clip Content toggle. Then Tools
- [ ] AI Image Board selected: same + "Regenerate" button at top of Tools
- [ ] Multi-select: bulk actions — "Open in Editor" button, "Delete All", "Export Selected"
- [ ] Tool buttons in right panel = apply to selected artboard(s)

### D3.6: Bottom Toolbar

- [ ] `BottomToolbar.tsx`: NEW — 48px horizontal bar. Left: cursor, move, shapes (dropdown), brush, text, emoji, AI sparkle. Separator. Undo/Redo. Separator. Zoom (-, %, +). Canvas resize
- [ ] AI sparkle button → expands Prompt Bar (same as clicking an AI Image Board)

### D3.7: Prompt Bar (Collapsible Chat)

- [ ] Rewrite `PromptBar.tsx` for new layout:
- [ ] Collapsed: single-line "✨ Describe what you want to create..." input. Overlays bottom of canvas above toolbar
- [ ] Expanded (on AI Board select or AI sparkle click): "Edit AI Image Board" header + ✖ close. Source→result thumbnails (48px). Multiline prompt. "Prompt builder" accordion. Model/Ratio/Style/BG selectors. Generate/Regenerate button
- [ ] Keep existing `ModelSelector.tsx` + `BackgroundColorPicker.tsx` embedded in expanded bar
- [ ] Smooth slide-up animation (200ms ease)

### D3.8: Artboard Canvas Export

- [ ] Export in right panel or toolbar: export selected artboards or all
- [ ] Format: PNG (default), DPI: 300, compression slider
- [ ] Download individual or all as ZIP

### D3.9: External Drag-Drop + Empty State

- [ ] Drag image files from desktop onto canvas → creates new artboard at drop position
- [ ] Empty state: centered "+" icon + "Drop images here or create an AI Image Board" + Browse Files button

### D4: Image Editor Integration (Tab 2)

- [ ] Move existing `DesignEditorView` content into `EditorTab.tsx` (or render inline). Remove standalone route dependency
- [ ] Editor receives images via context: when user clicks "Open in Editor" from Canvas tab, selected artboard images are passed as batch
- [ ] Also supports standalone use: drop images, browse files, URL param `?tab=editor&images=id1,id2`
- [ ] No dependency on Canvas tab — works independently with its own pipeline, canvas, export

### D5: Hooks Refactor

- [ ] `useBoardContext` → adapt to use `getProjectBoard` endpoint (if not already done)
- [ ] `useBoardLayout` → save/load artboard positions to `DesignProject.board_layout` (replaces React Flow node positions)
- [ ] `useGeneration` → use project-scoped `POST /api/designs/generate/` with `{project_id, idea_id?}`
- [ ] `useDesignActions` → invalidate `DesignProject` cache (not `DesignBoard`)
- [ ] `useImageAnalysis` → invalidate `DesignProject` cache
- [ ] Remove `useBoardNodes` (React Flow specific)

### D6: i18n — Workspace + Artboard Canvas

- [ ] `design.workspace.*` — tab labels (Artboard Canvas, Image Editor), workspace title
- [ ] `design.artboard.*` — artboard labels, context menu items, selection actions
- [ ] `design.canvas.*` — toolbar labels, zoom, empty state, export
- [ ] `design.prompt.*` — collapsed placeholder, expanded header, prompt builder
- [ ] Update existing `design.board.*` keys as needed
- [ ] All 5 locales: EN, DE, FR, ES, IT

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

### Phase D: Unified Design Workspace (NEW — to implement)
- [ ] React Flow removed, routes unified to `/designs/:projectId`
- [ ] Workspace shell with polished tab toggle (Canvas / Editor)
- [ ] Artboard Canvas: Konva.js infinite zoom canvas with artboard paradigm
- [ ] Artboards: freely movable, selectable (dashed blue border + resize handles)
- [ ] AI Image Boards with thin arrow connections
- [ ] Right panel (280px, always visible, context-sensitive)
- [ ] Bottom toolbar (cursor/move/shapes/brush/text/emoji/AI/undo/redo/zoom)
- [ ] Collapsible Prompt Bar (chat-style, collapsed one-liner → expanded editor)
- [ ] Multi-select artboards → "Open in Editor" tab switch
- [ ] Canvas export (selected/all artboards, PNG/ZIP)
- [ ] External drag-drop onto canvas
- [ ] Image Editor as Tab 2 (existing code, standalone, context-only)
- [ ] Konva.js drag-and-drop bug fixed (artboards move independently)
- [ ] Board layout persistence on DesignProject

### Phase B: Post-Processing Editor (existing — becomes Tab 2)
- [x] Pipeline bar, tool panel, canvas, batch strip, export controls
- [ ] Client-side tools: resize, trim, rotate, filters, defringe, eraser, wand
- [ ] AI BG Remove + AI Upscale auto-mode
- [ ] Cloud import (Google Drive + OneDrive)
- [ ] Settings UI: provider selection, API keys, threshold
- [ ] All tests pass, lint clean
