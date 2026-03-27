# PROJ-9: Design Generation (OpenRouter)

**Status:** Planned
**Priority:** P0 (MVP)
**Created:** 2026-02-27

## Overview

Board-based design creation experience for approved ideas. Three input modes:

- **From idea** — auto-loads slogan + reference product images from niche research; constructs prompt using the 7-step "Gemini 3 Architect" analysis of reference images plus idea DB fields (`visual_style`, `vibe`, `graphic_elements`, `tone`).
- **From image** — user uploads or selects a reference image; system runs image analysis → generates structured prompt → user reviews/edits → generates.
- **From prompt** — user writes prompt manually on the board.

The board is a dedicated full-page route (`/design-board/:ideaId`) with reference images, prompt editor, model selector, background color picker, and a generated design gallery — all visible side by side. Users can jump directly from the idea list card to the board, which pre-loads with the idea's context.

After generation, approved designs can be batch-processed: upscaled to 3000×3000px and background-removed, ready for MBA upload.

**SECURITY NOTE:** OpenRouter API key is currently visible in n8n workflow JSON committed to git. Key MUST be rotated and moved to env var `OPENROUTER_API_KEY` before development begins.

---

## Source Data Available (from n8n DB Schema)

Every `NicheResearchProduct` row written by n8n contains rich design-relevant fields available when constructing the board context:

| Field | Description |
|-------|-------------|
| `image` | URL to Amazon product image — usable as reference for Gemini 3 Architect analysis |
| `visual_style` | Overall visual style of the product (e.g., "vintage", "minimalist") |
| `graphic_elements` | Specific graphic components (e.g., "floral border", "bold serif") |
| `layout_composition` | Spatial layout pattern (e.g., "centered stacked", "diagonal split") |
| `vibe` | Emotional vibe (e.g., "cozy", "bold", "ironic") |
| `emotional_pattern` | Recurring emotional themes |
| `semantic_structure` | How text and image relate semantically |
| `key_elements` | The most visually dominant elements |
| `tone` | Copy/voice tone (e.g., "humorous", "inspirational") |
| `adaptation_formula` | Pattern for adapting the design to a new niche |
| `adaptation_examples` | Concrete adaptation examples |
| `customer_psychology` | Target buyer motivations |
| `sentiment_analysis` | Sentiment breakdown of reviews / listing copy |

These fields are read when a user opens `/design-board/:ideaId` and are used to auto-construct the idea-driven prompt.

---

## User Stories

### Design Generation
1. As a member, I want a board/canvas view to create designs, so I can see reference images, prompts, and results side by side.
2. As a member, I want to jump from an approved idea directly to the design board pre-loaded with that idea's slogan + reference images.
3. As a member, I want the system to auto-analyze reference images using the Gemini 3 Architect pipeline, so a high-quality prompt is generated without me writing one from scratch. If PROJ-7 "Analyze Design" was already run on this product, reuse that analysis instead of re-running.
4. As a member, I want to choose the background color (light gray / neon pink / neon green) for the generated design, so background removal works cleanly later.
5. As a member, I want to click "Generate Design" on an approved idea, so AI creates a T-shirt graphic based on the slogan.
6. As a member, I want to choose the AI model (e.g., Flux, GPT-Image), so I can compare output quality.
7. As a member, I want to see a progress indicator while the design is generating, so I know it's working.
8. As a member, I want to view generated designs in a gallery, so I can pick the best one.
9. As a member, I want to approve one design per idea and reject others, so the pipeline moves forward with the best image.
10. As a member, I want to download an approved design, so I can use it outside the app if needed.

### Post-Processing Pipeline (ReadyPixl-inspired)

#### Batch & Pipeline
11. As a member, I want to drag & drop multiple design images (100+) into the editor at once, so I can process my entire catalog in one session.
12. As a member, I want to chain multiple processing tools in my preferred order as a pipeline, so each image goes through the same steps automatically.
13. As a member, I want to save pipeline configurations as reusable presets, so I don't have to rebuild my workflow every time.
14. As a member, I want to apply conditional logic to pipeline steps (e.g. "upscale only if <5000px"), so the pipeline handles mixed-size batches intelligently.

#### Cloud Import
15. As a member, I want to import design images directly from Google Drive into the editor, so I don't have to download and re-upload.
16. As a member, I want to import design images directly from Microsoft OneDrive into the editor, so I can use my preferred cloud storage.

#### Quality Control & Manual Correction
17. As a member, I want to use the Transparency Highlighter to visualize hidden semi-transparent pixels, so I can spot artifacts before downloading.
18. As a member, I want to correct individual images manually (eraser tool, magic wand) within a batch, so I can fix edge cases without reprocessing everything.
19. As a member, I want to browse through all images in my batch with preview before downloading, so I can quality-check each result.

#### Edge Cleanup & Defringe
20. As a member, I want to auto-detect color fringe after background removal and get a suggested shrink value, so cleanup is fast and accurate.
21. As a member, I want to manually shrink the design edge by 1-5px with live preview, so I can cleanly remove any remaining color halo.
22. As a member, I want to replace semi-transparent edge pixels with the nearest design color instead of removing them, so the design edge stays sharp.
23. As a member, I want multi-step edge smoothing after BG removal, so jagged edges become print-clean.

#### AI Processing & Export
24. As a member, I want to choose my AI processing providers (BG Remove, Upscaling) in Settings — self-hosted or external API — so I control cost vs. speed.
25. As a member, I want smart upscaling that uses client-side Pica.js for large images and AI upscaling only for low-res images, so I don't waste resources.
26. As a member, I want to compress processed images to <2MB without losing print quality, so uploads to MBA are fast.
27. As a member, I want to export with configurable format (PNG), DPI (300), and compression level, and download single images or all at once.
28. As a member, I want to choose between overwriting the original file or creating a new version, so I don't lose my source material.

#### Canvas & Positioning
29. As a member, I want my designs automatically formatted to 4500x5400px at 300 DPI (MBA standard), so they're upload-ready without manual calculation.
30. As a member, I want to position designs with Align-to-Top and configurable padding (default: 1 inch top/sides), so placement is consistent across my catalog.
31. As a member, I want the target canvas size to be configurable for other marketplaces, so I'm not locked to MBA dimensions.

### UI/UX Notes
- Full editor layout to be defined with `/frontend-design`. ReadyPixl (readypixl.com) serves as inspiration — see `reference_proj9_image_editor.md`.
- ReadyPixl UI reference: Pill-bar for pipeline tools on top, parameter panel on left, canvas center/right, thumbnail strip at bottom. Not prescriptive — designer decides.

---

## Acceptance Criteria

### Models

- [ ] AC-1: `DesignGenerationRun` model: UUID pk, `idea` FK, `model_name` choices [gemini_flash, gemini_pro, gpt_image, flux], `status` choices [pending, running, completed, failed], `triggered_by` FK, `prompt_used` TextField, `created_at`, `completed_at` (nullable), `error_message` TextField.
- [ ] AC-2: `Design` model: UUID pk, `workspace` FK, `idea` FK, `generation_run` FK (nullable), `image_file` FileField, `status` choices [pending, approved, rejected, failed], `is_manual` BooleanField, `background_color` choices [light_gray, neon_pink, neon_green] default=light_gray, `source_image_url` URLField, `prompt_analysis` JSONField (7-step output), `upscaled_file` FileField (nullable), `bg_removed_file` FileField (nullable), `created_at`.
- [ ] AC-3: `DesignProcessingJob` model: UUID pk, `design` FK, `type` choices [upscale, bg_remove], `status` choices [pending, running, completed, failed], `result_file` FileField (nullable), `error_message` TextField, `created_at`, `completed_at` (nullable).

### API

- [ ] AC-4: `GET /api/ideas/{id}/design-board/` — returns board context: slogan, reference product images (with all analysis fields), any existing designs for this idea. Requires workspace membership.
- [ ] AC-5: `POST /api/designs/{id}/analyze-image/` — triggers Gemini 3 Architect analysis on `source_image_url`; returns generated prompt (7-step structured output). Enqueued as django-rq task; poll via run status endpoint.
- [ ] AC-6: `POST /api/ideas/{id}/designs/generate/` — body: `{model, background_color, prompt}` → enqueues django-rq job → returns run record (status=pending).
- [ ] AC-7: `GET /api/designs/runs/{run_id}/` — poll run status.
- [ ] AC-8: `GET /api/ideas/{id}/designs/` — returns all designs for idea with status.
- [ ] AC-9: `PATCH /api/designs/{id}/` — update status (approved/rejected).
- [ ] AC-10: `GET /api/designs/{id}/download/` — returns image file (redirect to signed URL or file response).
- [ ] AC-11: `POST /api/designs/batch-process/` — body: `{design_ids: [...], steps: ["upscale", "bg_remove"]}` → enqueues one `DesignProcessingJob` per (design × step); returns list of job records.
- [ ] AC-12: `GET /api/designs/processing-jobs/{job_id}/` — poll batch job status.

### Behavior

- [ ] AC-13: Only one design per idea can be status=approved at a time; approving a new one auto-rejects the previous.
- [ ] AC-14: Frontend polls run status every 3s; MUI Skeleton shown for pending designs; gallery shown on completion.
- [ ] AC-15: Background color selection on the board defaults to `light_gray`; selection is injected as final instruction in the prompt before generation.
- [ ] AC-16: Retry once on OpenRouter timeout; store content-policy refusals as Design(status=failed) with error_message.
- [ ] AC-17: Batch processing: one job fails → continue others; report individual failures per job in response.
- [ ] AC-18: Quick-jump button on idea list card navigates to `/design-board/:ideaId` — board auto-loads context.

### Post-Processing Pipeline

- [ ] AC-19: Drag & drop 100+ images into editor. Progress tracked per image. Thumbnail strip for batch browsing.
- [ ] AC-20: Pipeline tools as chainable "pills" in configurable order. Pipeline stored as `DesignPipeline` model (JSONField: ordered tool+params list). Presets saveable + loadable.
- [ ] AC-21: Conditional logic in pipeline steps (e.g. "upscale only if <5000px").
- [ ] AC-22: Client-side tools (Konva.js + Web Workers): Resize/Reposition, Color Removal/Adjustment, Trim, Rotate/Flip, Filters (brightness/contrast/saturation), Sprinkle Remover, Transparency Cleaner, Distress effects, Watermark (text+image).
- [ ] AC-23: Edge Cleanup tools (client-side): Auto-Detect Defringe (suggests shrink value), Manual Shrink (0-5px slider + live preview), Color Defringe (replaces semi-transparent edge pixels with design color), Edge Cleaner (multi-step smoothing).
- [ ] AC-24: Quality Control tools (client-side): Transparency Highlighter (visualizes hidden semi-transparent pixels), Built-in Compressor (<2MB without quality loss).
- [ ] AC-25: Manual Correction tools (Konva.js canvas): Eraser tool, Magic Wand (color similarity selection), per-image preview in batch before download.
- [ ] AC-26: AI Background Removal: Default `rembg` (u2net model, self-hosted, ~3-8s/image). Optional external API (e.g. remove.bg). Provider configurable in Settings UI.
- [ ] AC-27: AI Upscaling — Auto mode: ≥3000px → Pica.js (client-side, Lanczos), <3000px → external API (e.g. Deep-Image.ai). Provider configurable in Settings UI. User can override auto with fixed provider.
- [ ] AC-28: Cloud Import: Google Drive + Microsoft OneDrive direct import into editor.
- [ ] AC-29: Target canvas 4500x5400px at 300 DPI (MBA standard). Configurable for other marketplaces. Align-to-Top + configurable padding (default: 1 inch top/sides).
- [ ] AC-30: Export: configurable format (PNG default), DPI (300), compression level. Download single or all. Option to overwrite original or create new version.

### PROJ-7 Integration

- [ ] AC-31: "Analyze Design" button in PROJ-7 `ProductCard.tsx` / `ProductDetailPanel.tsx`. Triggers Gemini 3 Architect analysis (same `POST /api/designs/{id}/analyze-image/` endpoint). Stores result on product. When user later opens Design Board for an Idea from that product → reuses existing analysis (no re-run).

---

## Image Analysis Pipeline (Gemini 3 Architect)

### Purpose
Convert a reference Amazon product image into a high-quality structured text-to-image prompt without the user writing one from scratch.

### Flow
1. User opens the board and clicks "Analyze Image" on a reference image (sourced from `NicheResearchProduct.image`).
2. Backend enqueues a django-rq task: calls OpenRouter (Gemini model) with the 7-step analysis prompt + image URL.
3. The 7-step analysis produces a structured JSON:
   - **Step 1 — Text DNA:** Extract all text, fonts, and typographic hierarchy.
   - **Step 2 — Deep Visual:** Identify graphic elements, illustration style, color palette.
   - **Step 3 — Spatial Layout:** Map composition zones (top/center/bottom, focal weight).
   - **Step 4 — Style Cohesion:** Identify the unifying aesthetic (vintage, modern, hand-drawn, etc.).
   - **Step 5 — Color Strategy:** Primary/accent/background color roles and relationships.
   - **Step 6 — Tech Specs:** Resolution hints, edge treatment, transparency needs.
   - **Step 7 — Final Prompt:** Synthesize steps 1–6 into a single generation prompt following the 9 critical rules below.
4. The generated prompt is returned to the board and displayed in the editable prompt field.
5. User reviews/edits the prompt, selects background color, and clicks Generate.

### 9 Critical Rules for the Final Prompt
1. All text content wrapped in double quotes.
2. Describe physicality (weight, texture, dimension) of every element.
3. Never use the word "T-Shirt" in the prompt.
4. Use 4+ font adjectives (e.g., "chunky, weathered, slab-serif, uppercase").
5. Spatial anchoring: specify exact position for every text and graphic element.
6. Text segmentation: each text block described separately with its own style/position.
7. Color-object binding: every color tied to a specific element (not "use red" but "bold red outline on the bear graphic").
8. Deep visuals: describe background texture/pattern/gradient, not just a flat color.
9. Breathing room: specify negative space and margin treatment.

### Fallback
- If image URL returns 403/404 (Amazon CDN restriction) → skip analysis, fall back to idea-driven prompt construction using DB fields.
- If Gemini 3 analysis returns malformed output → display raw output to user in the prompt editor for manual correction.

---

## Prompt Construction

### Path 1 — Image-Driven (Gemini 3 Architect)
```
reference image URL → 7-step LLM analysis (OpenRouter) → structured prompt → user edits on board → inject background color → generate
```

### Path 2 — Idea-Driven (Auto-Constructed)
```
slogan_text + visual_style + vibe + graphic_elements + layout_composition + tone (from DB) → auto-constructed prompt following 9 critical rules → user edits on board → inject background color → generate
```

Both paths inject the background color instruction as the final sentence of the prompt, e.g.:
> "Generate on a solid neon pink (#FF10F0) background, fully saturated, no gradients."

---

## Background Color Strategy

| Key | Color | Hex |
|-----|-------|-----|
| `light_gray` | Light Gray (default) | `#F0F0F0` |
| `neon_pink` | Neon Pink | `#FF10F0` |
| `neon_green` | Neon Green | `#39FF14` |

- User selects on the board before generating (MUI ToggleButtonGroup).
- Selection stored on `Design.background_color`.
- Color injected as final instruction in the prompt.
- All three colors are optimized for clean automated background removal (high contrast with typical T-shirt design colors).

---

## Batch Post-Processing

After designs are approved, user can select multiple and trigger batch processing in two steps:

1. **Upscale** — resize to 4500×5400px (MBA-ready resolution). Upscaler: TBD (see unresolved questions). Result stored in `Design.upscaled_file`.
2. **Background Removal** — remove the solid background color using rembg (in-house, runs in the `worker` container). Result stored in `Design.bg_removed_file`.

Each step is a separate `DesignProcessingJob` enqueued via django-rq. Frontend polls individual job status. One failed job does not block others.

Backend task files: `design_app/api/tasks.py` — `task_upscale_design()`, `task_remove_background()`.

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/ideas/{id}/design-board/` | Member | Board context: slogan, reference images, existing designs |
| POST | `/api/designs/{id}/analyze-image/` | Member | Trigger Gemini 3 Architect analysis; returns generated prompt |
| POST | `/api/ideas/{id}/designs/generate/` | Member | Trigger image generation (enqueue job) |
| GET | `/api/designs/runs/{run_id}/` | Member | Poll generation run status |
| GET | `/api/ideas/{id}/designs/` | Member | List designs for idea |
| PATCH | `/api/designs/{id}/` | Member | Approve / reject design |
| GET | `/api/designs/{id}/download/` | Member | Download image |
| POST | `/api/designs/batch-process/` | Member | Enqueue batch upscale + bg_remove jobs |
| GET | `/api/designs/processing-jobs/{job_id}/` | Member | Poll batch job status |

---

## Supported Models (via OpenRouter)

| Key | Model | Use Case |
|-----|-------|----------|
| `gemini_flash` | Google Gemini Flash (image gen) | Fast iteration |
| `gemini_pro` | Google Gemini Pro (image gen) | Higher quality |
| `gpt_image` | OpenAI GPT Image | Creative styles |
| `flux` | Black Forest Labs Flux | Photorealistic |

Image analysis (Gemini 3 Architect pipeline) also uses OpenRouter — same API key, Gemini model variant.

---

## Edge Cases

1. Reference image URL returns 403/404 (Amazon CDN) → skip analysis; fall back to idea-driven prompt.
2. Gemini 3 analysis returns malformed JSON → display raw output in prompt editor for manual correction.
3. Background color not supported by selected model → warn user via snackbar; proceed with `light_gray` default.
4. OpenRouter returns content policy violation → `Design(status=failed, error_message="Content policy refusal")`.
5. OpenRouter API key expired/invalid → all runs fail immediately; surface error to member.
6. Worker service not running → job queued but never executed; surface in UI after timeout.
7. Batch processing: one design fails → continue others; report per-job failures in response.
8. Same idea generates multiple runs → all designs stored; board shows all in gallery.
9. Approving a new design when one is already approved → auto-reject previous approved.

---

## Dependencies

- PROJ-4 (Workspace & Membership — worker service in docker-compose; workspace isolation at ORM level)
- PROJ-8 (Idea & Slogan Generation — idea must exist with slogan)
- PROJ-6 (Niche Deep Research — `NicheResearchProduct` rows with image + analysis fields must exist)

## Amendments (PROJ-15/18/19 Harmonization)

### Vector DB Integration (PROJ-15)
- `Design` model itself is NOT embedded (images, not text). However:
  - `Design.prompt_analysis` (JSONField — 7-step Gemini analysis) is text-rich → embedded as part of the Idea's context.
  - `DesignGenerationRun.prompt_used` (the final prompt sent to the model) → embedded for "find designs with similar prompts" search.
- Approval/rejection patterns stored in Vector DB → Agent learns design preferences over time.

### PROJ-7 "Analyze Design" Reuse
- PROJ-7 adds an "Analyze Design" button per product that runs the 7-Step Gemini Architect analysis and produces a ready-to-use generation prompt.
- When user opens Design Board for an Idea whose source product already has a completed analysis → **reuse the existing prompt** instead of re-analyzing. `Design.prompt_analysis` is pre-populated from the PROJ-7 analysis.
- "Analyze Image" button on the Design Board still available for images without prior analysis (manual uploads, different reference images).
- Saves one LLM-call per design that originates from Product Research.

### Post-Processing Pipeline (ReadyPixl-inspired)
- Design Board gets a **Post-Processing section** with a chainable tool pipeline, inspired by ReadyPixl (readypixl.com).
- **Client-side tools** (Konva.js + Web Workers, run in browser):
  - Resize / Reposition
  - Color Removal / Color Adjustment
  - Trim (auto-crop excess whitespace)
  - Rotate / Flip
  - Filters (brightness, contrast, saturation etc.)
  - Sprinkle/Speckle Remover
  - Transparency Cleaner
  - Distress (vintage/used-look effects)
  - Watermark (text + image)
- **Edge Cleanup tools** (client-side):
  - Auto-Detect Defringe — erkennt Farbrand automatisch, schlägt Shrink-Wert vor
  - Manual Shrink — Slider "Shrink Edge: 0-5px" mit Live-Preview
  - Color Defringe — erkennt Hintergrundfarbe im Rand, ersetzt semi-transparente Randpixel mit Design-Farbe
  - Edge Cleaner — mehrstufige Kantenglättung nach BG Removal
- **Quality Control tools** (client-side):
  - Transparency Highlighter — markiert unsichtbare semi-transparente Pixel (Visualisierung, kein Edit)
  - Built-in Compressor — Dateigröße reduzieren (<2MB) ohne Druckqualität zu verlieren
- **Manual Correction tools** (client-side, Konva.js Canvas):
  - Radiergummi-Tool — manuell Pixel/Bereiche entfernen
  - Zauberstab — Bereichsauswahl nach Farbähnlichkeit
  - Per-Bild Vorschau im Batch — einzelne Bilder durchklicken und korrigieren VOR Batch-Download
- **Server-side AI tools** (django-rq worker OR external API — user-configurable in Settings):
  - AI Background Removal:
    - Option 1: `rembg` (self-hosted, CPU — ~3-8s/Bild, kostenlos)
    - Option 2: Professional API (e.g. remove.bg — schneller, Pay-per-Use)
    - Default: rembg. User kann in Settings auf API wechseln.
  - AI Upscaling — 3-Stufen-System, user-wählbar in Settings:
    - Option 1: `Pica.js` (client-side, Lanczos filter — für Bilder ≥3000px, kostenlos, schnell)
    - Option 2: `Real-ESRGAN` (self-hosted, GPU empfohlen — für Low-Res <3000px, beste Qualität)
    - Option 3: Professional API (e.g. Deep-Image.ai — wenn kein GPU-Server, Pay-per-Use)
    - Default-Preset (Auto): ≥3000px → Pica.js, <3000px + GPU → Real-ESRGAN, <3000px ohne GPU → API. User kann Default überschreiben und z.B. "immer API" oder "immer Pica.js" wählen.
  - Alle Provider-Einstellungen in Settings UI konfigurierbar, nicht nur via env var.
- **Pipeline concept** (ReadyPixl-inspired):
  - Plugin/Pill-basiertes System — jeder Bearbeitungsschritt ist ein "Pill" in einer Kette
  - User chains multiple tools in preferred order → creates a reusable pipeline
  - Pipeline stored as `DesignPipeline` model (JSONField with ordered tool+params list)
  - **Presets:** Pipeline-Konfigurationen speichern + laden (Name, Tool-Kette, Parameter)
  - **Konditionale Logik:** Tools können bedingt ausgeführt werden (z.B. "Upscale nur wenn <5000px")
  - **Overwrite-Option:** Original überschreiben oder neue Datei erstellen
- **Batch processing:**
  - Drag & Drop Massen-Upload (100+ Bilder gleichzeitig)
  - Einmaliges Setup — Pipeline-Parameter für ein Bild einstellen, auf alle anwenden
  - Individuelle Nachbearbeitung — einzelne Bilder durchklicken + manuell korrigieren VOR Batch-Download
  - Progress tracked per image in Batch-View
  - Export: Format (PNG default), DPI (300 default), Compression Level, Download einzeln oder ALL
- **Target Canvas:** 4500x5400 Pixel, 300 DPI (MBA-Standard). Configurable für andere Marktplätze.
- **Reposition:** Align-to-Top + konfigurierbares Padding (Default: 1 Zoll oben/seiten). Snap-to-Top für kleinere Designs.
- Tech stack reference: `reference_proj9_image_editor.md`

### Agent Integration (PROJ-18)
- Design Agent has tools: `get_design_board_context`, `analyze_reference_image`, `generate_design`, `read_design_status`, `approve_reject_design`, `trigger_batch_processing`, `apply_pipeline`.
- Agent can autonomously: analyze reference images, generate designs with chosen model + background color, apply post-processing pipelines, and trigger batch operations.
- Agent permission defaults: `generate_design` = Approve (LLM + image gen costs), `trigger_batch_processing` = Approve, `apply_pipeline` = Notify, `approve_reject_design` = Notify.

---

## Environment Variables Required

```
OPENROUTER_API_KEY=       # Rotate existing key before adding — currently exposed in n8n workflow JSON
```

> **AI Processing providers (BG Remove, Upscale) are configured in the Settings UI, not only via env vars.** Env vars serve as initial defaults. Settings model stores per-workspace provider choice + API keys (encrypted). This allows non-technical admins to switch providers without redeploying.

```
# Initial defaults (overridable in Settings UI):
BG_REMOVAL_PROVIDER=rembg           # choices: rembg, api
BG_REMOVAL_API_KEY=                 # only if provider=api (e.g. remove.bg key)
UPSCALE_PROVIDER=auto               # choices: pica (client), real_esrgan (server), api, auto
UPSCALE_API_KEY=                    # only if provider=api (e.g. Deep-Image.ai key)
UPSCALE_AUTO_THRESHOLD=3000         # pixel threshold for auto mode: >=threshold → Pica.js, <threshold → Real-ESRGAN/API
```

Document in `django-app/env/.env.template`. **Rotate the existing OpenRouter key before adding this.**

---

## Verification Steps

### Phase A: Design Generation
1. Open `/design-board/:ideaId` from an approved idea → board loads with slogan + reference images.
2. Click "Analyze Image" on a reference → Gemini 3 Architect prompt appears, editable on the board.
3. Select background color → choose neon pink → generate → image has neon pink background.
4. Generate with different models (Gemini Flash, GPT Image) → both return images.
5. Approve design → previous approved auto-rejected. Only 1 approved per idea.
6. Quick-jump button from idea list card → navigates to design board pre-loaded with idea context.
7. Reference image 403/404 → falls back to idea-driven prompt (no crash).
8. Content policy refusal → Design(status=failed) with error message shown.
9. "Analyze Design" button in PROJ-7 ProductCard → analysis saved → reused on Design Board.

### Phase B: Post-Processing
10. Drag & drop 100 images → all appear in thumbnail strip, progress tracked per image.
11. Create pipeline: chain Trim → Upscale → BG Remove → export as preset.
12. Apply saved preset to batch → all images processed in order.
13. Conditional logic: "upscale only if <5000px" → large images skip upscale step.
14. Manual correction: eraser tool removes artifact on single image in batch.
15. Transparency Highlighter shows semi-transparent pixels → user spots artifact.
16. Edge cleanup: auto-defringe suggests 2px shrink → user confirms → clean edges.
17. Export: PNG, 300 DPI, <2MB compression → download all as zip.
18. AI BG Remove (rembg): solid background removed, transparent PNG created.
19. AI Upscale (auto): <3000px image → API upscale; ≥3000px → Pica.js client-side.
20. Canvas reposition: 4500x5400, Align-to-Top, 1 inch padding → MBA-ready.
21. Workspace isolation: designs from other workspaces → 403.

---

## Resolved Questions

1. ~~Upscaler?~~ → **Auto mode:** Pica.js (client-side) for ≥3000px, External API for <3000px. No Real-ESRGAN/GPU in MVP — too complex for Docker setup. User can override in Settings UI.
2. ~~rembg model?~~ → **u2net** (170MB, fast). POD designs are graphics/text on solid backgrounds, not human segmentation. `u2net_human_seg` not needed.
3. ~~"Analyze Design" button location?~~ → **PROJ-9 builds the button in PROJ-7 UI** + backend logic. Reuses Gemini 3 Architect analysis on Design Board.

---

## Tech Design (Solution Architect)

> Decided: 2026-03-27 | Approved by user.

### A) Backend Architecture

**New Django app:** `design_app`

```
design_app/
├── models.py                           # DesignGenerationRun, Design, DesignProcessingJob,
│                                       #   DesignPipeline, ProcessingSettings
├── api/
│   ├── views.py                        # Board context, generate, analyze, batch, CRUD
│   ├── serializers.py                  # All serializers
│   └── urls.py                         # URL routing
├── services/
│   ├── prompt_builder.py               # Idea-driven + image-driven prompt construction
│   ├── image_analyzer.py               # Gemini 3 Architect 7-step analysis
│   ├── bg_remover.py                   # rembg wrapper + API fallback
│   └── upscaler.py                     # Auto-mode: Pica.js hint or API call
├── tasks.py                            # django-rq jobs: generate, analyze, upscale, bg_remove
├── admin.py
└── tests/
```

**Registered in:** `core/settings.py` INSTALLED_APPS, `core/urls.py`

---

### B) Frontend Architecture

**Routes:**
- `/design-board/:ideaId` — Design Board (full-page, idea-scoped)
- `/design-editor` — Post-Processing Editor (full-page, standalone batch tool)

```
views/design/
├── board/
│   ├── DesignBoardView.tsx             # Main board page
│   ├── hooks/
│   │   ├── useBoardContext.ts          # Load idea + references + existing designs
│   │   ├── useGeneration.ts            # Trigger + poll generation runs
│   │   └── useImageAnalysis.ts         # Trigger + poll Gemini 3 analysis
│   ├── partials/
│   │   ├── ReferencePanel.tsx          # Reference images from NicheResearchProduct
│   │   ├── PromptEditor.tsx            # Editable prompt field + 7-step analysis display
│   │   ├── ModelSelector.tsx           # Gemini Flash / Pro / GPT Image / Flux
│   │   ├── BackgroundColorPicker.tsx   # 3 color options (ToggleButtonGroup)
│   │   ├── DesignGallery.tsx           # Generated designs grid with approve/reject
│   │   ├── DesignCard.tsx              # Single design with status + actions
│   │   ├── GenerationProgress.tsx      # LinearProgress during generation
│   │   └── BatchProcessPanel.tsx       # Select designs → upscale + bg_remove
│   └── types/
│       └── index.ts
│
├── editor/
│   ├── DesignEditorView.tsx            # Post-processing editor (ReadyPixl-inspired)
│   ├── hooks/
│   │   ├── usePipeline.ts             # Pipeline state, tool ordering, presets
│   │   ├── useBatchImages.ts          # Drag-drop batch, thumbnail navigation
│   │   ├── useCanvasTools.ts          # Konva.js tool state (eraser, wand, etc.)
│   │   └── useProcessing.ts           # Server-side job triggering (BG remove, upscale)
│   ├── partials/
│   │   ├── PipelineToolbar.tsx         # Pill-bar for chainable tools
│   │   ├── PipelinePresetDropdown.tsx  # Save/load presets
│   │   ├── ToolParameterPanel.tsx      # Left panel: active tool settings
│   │   ├── EditorCanvas.tsx            # Konva.js canvas (center)
│   │   ├── BatchThumbnailStrip.tsx     # Bottom thumbnail strip
│   │   ├── TransparencyHighlighter.tsx # QC overlay
│   │   ├── DefringeControls.tsx        # Edge cleanup slider + preview
│   │   ├── ExportDialog.tsx            # Format, DPI, compression, download
│   │   └── CloudImportDialog.tsx       # Google Drive + OneDrive picker
│   └── types/
│       └── index.ts
│
└── tests/

store/
└── designSlice.ts                      # RTK Query: board, generate, analyze, batch, CRUD
```

---

### C) Data Flow

```
Phase A — Design Generation:
  Idea Card [Approve] → Quick-Jump → /design-board/:ideaId
    → Load board context (slogan + reference images + existing designs)
    → "Analyze Image" → Gemini 3 Architect → structured prompt → editable
    → OR auto-construct prompt from DB fields (idea-driven)
    → Select model + background color → Generate → poll → gallery
    → Approve best design → batch upscale + bg_remove

Phase B — Post-Processing:
  Design Editor → drag-drop images (or import from cloud/approved designs)
    → Build pipeline (tool pills in order)
    → Apply to batch → per-image progress
    → Manual correction on individual images
    → QC: transparency highlighter, edge cleanup
    → Export: PNG, 300 DPI, <2MB, MBA-ready canvas
```

---

### D) Tech Decisions

| Decision | Why |
|----------|-----|
| `design_app` separate from `idea_app` | Single Responsibility — design generation + image processing is distinct from slogan management |
| 2 separate routes (Board + Editor) | Board = idea-scoped (1 idea → N designs). Editor = batch tool (N images from any source) |
| Konva.js for client-side canvas tools | Proven for browser-based image editing. Web Workers for non-blocking processing. Used by ReadyPixl |
| Pica.js for client-side upscaling (≥3000px) | Lanczos filter quality, runs in browser, no server cost. Only low-res needs AI upscaling |
| rembg (u2net) self-hosted default | Free, 170MB model, 3-8s/image. POD designs = graphics on solid bg = perfect match |
| External API as configurable fallback | Settings UI lets admin switch provider without redeploy. API keys encrypted in DB |
| Pipeline as JSONField | Flexible tool ordering, conditional logic, presets — no rigid schema needed |
| File storage: Django FileField + media/ | Simple for MVP. Can migrate to S3/Supabase Storage later |
| Separate RQ queue `design` | Generation jobs can be long (30s+ per image). Don't block research/slogan workers |

---

### E) Infrastructure Changes

| Change | Where |
|--------|-------|
| New RQ queue `design` (30min timeout) | `settings.py → RQ_QUEUES` |
| New Docker service `worker-design` | `docker-compose.yml` + `docker-compose.override.yml` |
| `rembg` + `u2net` model in worker image | `requirements.txt` + Dockerfile (model auto-downloads on first run) |
| `design_app` registered | `INSTALLED_APPS` + `core/urls.py` |
| Media file storage configured | `settings.py → MEDIA_ROOT`, `MEDIA_URL` |

---

### F) New Packages

**Backend:**

| Package | Purpose |
|---------|---------|
| `rembg` | AI background removal (u2net model) |
| `Pillow` | Image manipulation (resize, format conversion) — likely already installed |

**Frontend:**

| Package | Purpose |
|---------|---------|
| `konva` + `react-konva` | Canvas-based image editor for post-processing tools |
| `pica` | Client-side image upscaling (Lanczos filter) |
| `tinycolor2` | Color manipulation for defringe/color tools |
