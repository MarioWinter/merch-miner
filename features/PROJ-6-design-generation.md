# PROJ-6: Design Generation (OpenRouter)

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

1. As a member, I want a board/canvas view to create designs, so I can see reference images, prompts, and results side by side.
2. As a member, I want to jump from an approved idea directly to the design board pre-loaded with that idea's slogan + reference images.
3. As a member, I want the system to auto-analyze reference images using the Gemini 3 Architect pipeline, so a high-quality prompt is generated without me writing one from scratch.
4. As a member, I want to choose the background color (light gray / neon pink / neon green) for the generated design, so background removal works cleanly later.
5. As a member, I want to upscale and remove the background from approved designs in batch, so I can prepare multiple designs for upload at once.
6. As a member, I want to click "Generate Design" on an approved idea, so AI creates a T-shirt graphic based on the slogan.
7. As a member, I want to choose the AI model (e.g., Flux, GPT-Image), so I can compare output quality.
8. As a member, I want to see a progress indicator while the design is generating, so I know it's working.
9. As a member, I want to view generated designs in a gallery, so I can pick the best one.
10. As a member, I want to approve one design per idea and reject others, so the pipeline moves forward with the best image.
11. As a member, I want to download an approved design, so I can use it outside the app if needed.

---

## Acceptance Criteria

### Models

1. `DesignGenerationRun` — UUID pk, idea FK, model_name choices [gemini_flash, gemini_pro, gpt_image, flux], status choices [pending, running, completed, failed], triggered_by FK, prompt_used (TextField), created_at, completed_at (nullable), error_message (TextField, blank=True).

2. `Design` — UUID pk, idea FK, generation_run FK (nullable), image_file (FileField or URLField — TBD based on storage), status choices [pending, approved, rejected], is_manual (BooleanField, default=False), background_color choices [light_gray, neon_pink, neon_green] default=light_gray, source_image_url (URLField, blank=True), prompt_analysis (JSONField, blank=True — stores 7-step analysis output), upscaled_file (FileField, nullable), bg_removed_file (FileField, nullable), created_at.

3. `DesignProcessingJob` — UUID pk, design FK, type choices [upscale, bg_remove], status choices [pending, running, completed, failed], result_file (FileField, nullable), error_message (TextField, blank=True), created_at, completed_at (nullable).

### API

4. `GET /api/ideas/{id}/design-board/` — returns board context: slogan, reference product images (with all analysis fields), any existing designs for this idea. Requires workspace membership.
5. `POST /api/designs/{id}/analyze-image/` — triggers Gemini 3 Architect analysis on `source_image_url`; returns generated prompt (7-step structured output). Enqueued as django-rq task; poll via run status endpoint.
6. `POST /api/ideas/{id}/designs/generate/` — body: `{model, background_color, prompt}` → enqueues django-rq job → returns run record (status=pending).
7. `GET /api/designs/runs/{run_id}/` — poll run status.
8. `GET /api/ideas/{id}/designs/` — returns all designs for idea with status.
9. `PATCH /api/designs/{id}/` — update status (approved/rejected).
10. `GET /api/designs/{id}/download/` — returns image file (redirect to signed URL or file response).
11. `POST /api/designs/batch-process/` — body: `{design_ids: [...], steps: ["upscale", "bg_remove"]}` → enqueues one `DesignProcessingJob` per (design × step); returns list of job records.
12. `GET /api/designs/processing-jobs/{job_id}/` — poll batch job status.

### Behavior

13. Only one design per idea can be status=approved at a time; approving a new one auto-rejects the previous.
14. Frontend polls run status every 3s; MUI Skeleton shown for pending designs; gallery shown on completion.
15. Background color selection on the board defaults to `light_gray`; selection is injected as final instruction in the prompt before generation.
16. Retry once on OpenRouter timeout; store content-policy refusals as Design(status=failed) with error_message.
17. Batch processing: one job fails → continue others; report individual failures per job in response.
18. Quick-jump button on idea list card navigates to `/design-board/:ideaId` — board auto-loads context.

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

- PROJ-2 (Workspace & Membership — worker service in docker-compose; workspace isolation at ORM level)
- PROJ-5 (Idea & Slogan Generation — idea must exist with slogan)
- PROJ-4 (Niche Deep Research — `NicheResearchProduct` rows with image + analysis fields must exist)

---

## Environment Variables Required

```
OPENROUTER_API_KEY=       # Rotate existing key before adding — currently exposed in n8n workflow JSON
```

Document in `django-app/env/.env.template`. **Rotate the existing key before adding this.**

No additional keys needed for background removal (rembg, in-house) or image analysis (same OpenRouter key).

---

## Verification Steps

1. Open `/design-board/:ideaId` from an approved idea → board loads with slogan + reference images.
2. Click "Analyze Image" on a reference → Gemini 3 Architect prompt appears, editable on the board.
3. Select background color → choose neon pink → generate → image has neon pink background.
4. Approve design → select multiple approved designs → trigger batch process → both upscaled + bg removed.
5. Confirm batch job status polling works (each job polled independently).
6. Quick-jump button from idea list card → navigates to design board pre-loaded with idea context.

---

## Unresolved Questions

1. Upscaler: Real-ESRGAN (local docker service) or external API (e.g., Deep-Image.ai)?
2. rembg model: `u2net` (fast, ~170MB) or `u2net_human_seg`? (affects worker docker image size)
