# PROJ-9: Design Generation (OpenRouter)

**Status:** In Review
**Priority:** P0 (MVP)
**Created:** 2026-02-27

## Overview

**Project-based** AI design creation board + post-processing editor. Designs are organized into **Projects** (Kittl-style folders). The Design Board works independently — no idea, niche, or slogan required. Users can create projects, generate designs from scratch, and optionally link projects to niches.

**Three input modes:**

- **From prompt (standalone)** — user creates a new project, writes a prompt manually, selects model + background color, generates. No idea or niche context needed.
- **From idea (context-loaded)** — user navigates from an approved idea; a naming dialog asks whether to create a new project (named after niche/slogan/custom) or assign to an existing project. Board opens with idea context pre-loaded.
- **From image** — user uploads or drags a reference image onto the board; system runs image analysis → generates structured prompt → user reviews/edits → generates.

**Entry points:**
- `/designs` — Project Gallery (overview of all projects in workspace)
- `/designs/:projectId` — Design Workspace: unified view with two tab-modes
- `/designs/:projectId?ideaId=xxx` — Opens with idea context pre-loaded

The sidebar "Design Board" link goes to `/designs` (Project Gallery). When opening from niche/idea context, the workspace opens directly after the project naming dialog.

**Unified Design Workspace (two tab-modes, one page):**
- **Tab 1: Artboard Canvas** — Designs as freely movable artboards, AI generation, connections, right panel with tools/properties
- **Tab 2: Image Editor** — Pipeline bar, batch processing, pixel-level tools (Konva.js), export controls
- Both tabs are **fully independent** — no dependencies between them. Only context is shared (selected images transfer as batch input)
- Multi-select artboards on Canvas → switch to Editor tab → selected images pre-loaded as batch
- Tab switch via prominent, visually polished toggle buttons (not generic MUI Tabs)
- Each tab works standalone — Editor can be used without ever touching the Canvas, and vice versa

**Project model:**
- `DesignProject`: UUID pk, workspace FK, name, niche FK (nullable — optional binding), board_layout JSONField, created_at
- Design ↔ Project: **M2M relationship** (a design can belong to multiple projects, a project can have many designs)
- Default project auto-created on first design generation if none exists (user can rename)

After generation, approved designs can be batch-processed: upscaled to 4500×5400px at 300 DPI and background-removed, ready for MBA upload.

**SECURITY NOTE:** OpenRouter API key is currently visible in n8n workflow JSON committed to git. Key MUST be rotated and moved to env var `OPENROUTER_API_KEY` before development begins.

---

## Source Data Available (from Niche Research — LangGraph / Django ORM)

Every `NicheResearchProduct` row written by the LangGraph research workflow contains rich design-relevant fields available when constructing the board context:

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

### Design Projects
1a. As a member, I want a Project Gallery overview so I can see all my design projects, create new ones, and open existing ones.
1b. As a member, I want to create a new project from scratch (empty canvas, manual prompt + upload) so I can generate designs without needing a niche or idea.
1c. As a member, I want to open a project and see its Design Board canvas with all designs belonging to that project.
1d. As a member, I want to assign a design to multiple projects so I can organize designs flexibly (no limit).
1e. As a member, I want to optionally link a project to a niche so related designs are visible in the niche drawer, but this binding is independent from the board itself.
1f. As a member, I want a default project auto-created when I generate my first design without selecting a project, so I don't have to set up a project first. I can rename it later.

### Design Generation
1. As a member, I want a board/canvas view to create designs, so I can see reference images, prompts, and results side by side.
2. As a member, I want to jump from an approved idea directly to the design board, with a naming dialog asking me to create a new project (named after niche/slogan/custom) or assign to an existing project.
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

### PROJ-8 Integration (Deferred from PROJ-8)
32. As a member, I want to see a warning dialog when rejecting an idea that has an approved design, so I don't accidentally discard a design that's already been finalized.

### Canvas Board Interaction
33. As a member, I want to drag external images from my desktop onto the canvas as new reference nodes, so I can add custom references beyond the niche research products.
34. As a member, I want to create multiple generation flows from different subsets of references on the same board, so I can A/B test different design directions for the same idea.

### UI/UX Notes — Design Board (`/design-board/:projectId`)

> REDESIGNED: 2026-03-31 via `/frontend-design` session. Based on Kittl Artboards reference screenshots.
> Replaces previous React Flow node-graph design (deprecated — "das sieht kacke aus").

**Paradigm:** Kittl-style Artboard Canvas. Images live as freely movable artboards on an infinite zoom canvas. AI generation happens through a chat-like prompt bar at the bottom. Tools and properties shown in a right panel — never on the image itself.

**Library:** Konva.js (`react-konva`) for the infinite canvas + artboard rendering. NOT React Flow — this is a design canvas, not a node graph.

**Core Concept — Artboards:**
Each design image on the canvas is an "artboard" — a named, selectable, movable frame. Artboards can be:
- **Regular Artboard** — any uploaded or reference image
- **AI Image Board** — an AI-generated variant connected to a source artboard via a thin arrow

```
┌──────────────────────────────────────────────────────────────────────┐
│  TOPBAR (56px) — project name + back + actions                       │
├──────────────────────────────────────────────────────────┬───────────┤
│                                                          │           │
│                  INFINITE ZOOM CANVAS                    │   RIGHT   │
│                  (Konva.js Stage)                        │   PANEL   │
│                                                          │  (280px)  │
│   ┌─ Artboard 1 ─────┐        ┌─ AI Image Board ──┐    │           │
│   │ "school bus"      │   ──→  │ "school bus v2"   │    │  Search   │
│   │ ┌──────────────┐  │        │ ┌──────────────┐  │    │  ─────    │
│   │ │              │  │        │ │              │  │    │  Tools:   │
│   │ │  [IMAGE]     │  │        │ │  [AI IMAGE]  │  │    │  AI Image │
│   │ │              │  │        │ │              │  │    │  Flatten  │
│   │ └──────────────┘  │        │ └──────────────┘  │    │  Upscale  │
│   └───────────────────┘        │  ✦ Regenerate     │    │  Reframe  │
│                                └───────────────────┘    │  BG Remove│
│                                                          │           │
│   ┌─ Artboard 3 ─────┐                                  │  ─────    │
│   │ "variant"         │                                  │  (context │
│   │ ┌──────────────┐  │                                  │   panel   │
│   │ │  [IMAGE]     │  │                                  │   when    │
│   │ └──────────────┘  │                                  │   board   │
│   └───────────────────┘                                  │  selected)│
│                                                          │           │
├──────────────────────────────────────────────────────────┴───────────┤
│  BOTTOM TOOLBAR                                                      │
│  [▶cursor] [✦move] [□shapes▾] [🖌brush] [T text] [😊emoji]         │
│  [✨AI] | [↩undo] [↪redo] | [-] 13% [+] | ⊕ 6260               │
├──────────────────────────────────────────────────────────────────────┤
│  💬 CHAT / PROMPT BAR                                                │
│  ┌─ "Edit AI Image Board" ──────────────────────── ✖ ─┐             │
│  │  [src thumb] → [result thumb]                       │             │
│  │                                                     │             │
│  │  "Humorous vector design for T-shirts...           │             │
│  │   featuring a stylized Cartoon School Bus..."       │             │
│  │                                                     │             │
│  │  ⚙ Prompt builder                             ↗    │             │
│  │  ─────────────────────────────────────────────────  │             │
│  │  [⚙ Gemini Flash] [□ 1:1] [◆ Opaque]  [Generate]  │             │
│  └─────────────────────────────────────────────────────┘             │
│                                                                      │
│  OR (collapsed): ✨ "Describe what you want to create..."           │
└──────────────────────────────────────────────────────────────────────┘
```

**Canvas Behavior:**
- Dark mode: `#1A1A2E` canvas background (slightly warmer than page bg). Light mode: `#E8E8E8`
- Infinite pan (click-drag on empty canvas) + zoom (scroll wheel, pinch, +/- buttons)
- Artboards cast subtle drop shadows on the canvas (elevation.2)
- Grid dots visible at zoom >30% (subtle, `rgba(255,255,255,0.04)` dark / `rgba(0,0,0,0.04)` light)
- Zoom level shown in bottom toolbar (e.g. "13%"), fit-to-view on double-click toolbar button

**Artboard Behavior:**
- Each artboard: titled label above (e.g. "Artboard 1", "AI Image Board"), white background frame, image inside
- Click to select → dashed blue border (`#4A9EFF`) with resize handles at corners/edges
- Drag to move freely on canvas
- Right-click → context menu: "Add AI Image Board", "Duplicate", "Delete", "Bring to Front", "Send to Back"
- Double-click → opens image in fullscreen preview overlay
- NO tools shown directly on artboards (user explicitly dislikes this on laptop)

**AI Image Board:**
- Created from context menu on an existing artboard: "Add AI Image Board"
- Appears to the right of source artboard, connected by a thin horizontal arrow (1px, `text.secondary` color)
- Label shows "✦ AI Image Board" in cyan accent above the frame
- Selected AI Board shows "Regenerate" button below the frame (small, subtle)
- The connection arrow is purely visual context — not an interactive drag handle

**Right Panel (280px, always visible):**
- **Nothing selected:** Project search field at top. "Project Colors" section (extracted from designs). "Tools" section: AI Image Board, Flatten, Upscale, Reframe, BG Remove
- **Artboard selected:** Artboard properties — Size (W × H px, preset dropdown: Standard Square 1200×1200, MBA 4500×5400), Layer (opacity slider), Color (background hex), Clip Content toggle. Then "Tools" section
- **AI Image Board selected:** Same as artboard, but Tools also show "Regenerate" at top
- Tools in right panel are buttons: click = apply tool to selected artboard(s)

**Bottom Toolbar (48px):**
Fixed horizontal bar below canvas. Left side: cursor tool, move tool, shape tool (dropdown), brush tool, text tool, emoji picker, AI sparkle button. Separator. Undo/Redo. Separator. Zoom controls (-, percentage, +). Canvas resize button.

**Chat / Prompt Bar (bottom, collapsible):**
- **Collapsed state:** Single-line input: "✨ Describe what you want to create..." — clicking expands
- **Expanded state** (when AI Image Board is selected or user clicks AI sparkle):
  - Header: "Edit AI Image Board" + close (✖) button
  - Source → Result thumbnail pair (small, ~48px, with arrow between)
  - Multiline prompt text field (editable, pre-filled from analysis if available)
  - "Prompt builder" link (expands 7-step analysis accordion)
  - Bottom controls row: Model selector (dropdown), Aspect ratio (1:1, 4:5, etc.), Style selector (Opaque, etc.), Background color, **Generate/Regenerate** button
- Prompt bar sits ABOVE the bottom toolbar, overlaying the canvas from below
- Smooth slide-up animation (200ms ease)

**Board Persistence:** Artboard positions, sizes, and connections saved to `DesignProject.board_layout` JSONField. Restored on reload.

**External Drag-Drop:** Drag image files from desktop onto canvas → creates new artboard at drop position.

**Empty State:** Centered on canvas — large "+" icon with "Drop images here or create an AI Image Board" text. Browse Files button below.

**Multi-Select + Editor Handoff:**
- Shift+Click or drag-select rectangle to select multiple artboards
- Selection shown as blue dashed border on all selected
- Right panel shows bulk actions when multiple selected: "Open in Editor" button
- Clicking "Open in Editor" switches to Image Editor tab with selected images pre-loaded as batch
- Context transfer is one-way (images passed as list), no live binding between tabs

**Artboard Canvas Export:**
- Export button in bottom toolbar or right panel
- Export selected artboards or all artboards
- Format: PNG (default), DPI: 300, with compression slider
- Download individual or all as ZIP
- Separate from Image Editor export (which exports processed pipeline results)

### Unified Design Workspace — Tab Mode Switch

```
┌──────────────────────────────────────────────────────────────┐
│  [← Back]  Bingo Caller Designs        [🔗 Niche] [⚙]      │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │  ✦ Artboard     │  │  🔧 Image       │                   │
│  │    Canvas       │  │    Editor       │    (polished       │
│  │  ▔▔▔▔▔▔▔▔▔▔▔▔▔ │  │                 │     toggle btns)  │
│  └─────────────────┘  └─────────────────┘                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│              Active tab content fills here                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

- Toggle buttons are visually prominent — not small text tabs
- Active tab: filled background (primary.subtle), text in primary color, slight glow
- Inactive tab: transparent background, secondary text color
- Both tabs share the project header (name, niche, settings)
- Tab state preserved in URL query param: `?tab=canvas` or `?tab=editor`

### UI/UX Notes — Post-Processing Editor (Tab 2 in Design Workspace)

> Decided: 2026-03-30 via `/frontend-design` session. Updated 2026-03-31: merged into unified Design Workspace as Tab 2.

**Paradigm:** ReadyPixl-style bulk image editing pipeline, now embedded as "Image Editor" tab within the Design Workspace. Fully independent from Artboard Canvas — only receives images as context input.
**Library:** Konva.js (`react-konva`) for canvas, Web Workers for heavy pixel ops.

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│ PIPELINE BAR (collapsible)                                │
│ Active: [Transp.Cleaner ✖] [Color Removal ✖] [Defringe ✖]│
│ + Add tool ▾                                              │
│ ┌─STANDARD─────────────────────────────────────────────┐  │
│ │ Resize │ Trim │ Rotate │ Filters │ Distress │ ...    │  │
│ ├─EDGE CLEANUP─────────────────────────────────────────┤  │
│ │ Defringe │ Shrink │ Color Defringe │ Edge Cleaner    │  │
│ ├─AI PROCESSING────────────────────────────────────────┤  │
│ │ BG Remove │ AI Upscale                               │  │
│ ├─QUALITY──────────────────────────────────────────────┤  │
│ │ Transp. Highlight │ Compressor                       │  │
│ └──────────────────────────────────────────────────────┘  │
├──────────┬───────────────────────────────────┬───────────┤
│ LEFT     │  CANVAS (Konva.js)                │           │
│ PANEL    │  < > 2/100 🗑 ALL (top-left)     │  [✛]      │
│ (280px)  │                                   │  [◯] mini │
│          │                                   │  [✦] tools│
│ Presets  │       [IMAGE]                     │           │
│ ▾ + Save │                                   │           │
│          │                                   │           │
│ ┌Tool 1┐ │                                   │           │
│ │params│ │                                   │           │
│ └──────┘ │                                   │           │
│ ┌Tool 2┐ │                                   │           │
│ │params│ │                                   │           │
│ └──────┘ │                                   │           │
│          │                                   │           │
│ Reset All│                                   │           │
│ Remove   ├───────────────────────────────────┤           │
│          │ [■][□][□][✓][✓]... 23/100 │ Export│           │
└──────────┴───────────────────────────────────┴───────────┘
```

**Pipeline Bar:** Top, collapsible. Active pipeline tools as colored pill-chips (drag-to-reorder, ✖ to remove). Expand to show available tools grouped with section labels: Standard, Edge Cleanup, AI Processing, Quality.

**Left Panel (~280px):** Preset dropdown + Save. Stacked collapsible tool config cards (toggle on/off, expand/collapse, drag-to-reorder — synced with pill bar). Each card has tool-specific params (sliders, toggles, buttons). Bottom: Reset All / Remove All.

**Canvas (center):** Konva.js Stage + Layer. Transparency checkerboard background. Top-left: compact batch nav overlay (< > 2/100 🗑 ALL). Top-right: floating mini-toolbar (Move, Eraser, Wand) — click to activate, full params appear in left panel.

**Bottom Thumbnail Strip:** Horizontal scrollable filmstrip. Click to navigate. Status dot per image (pending/processed/error). Current image highlighted. Export button integrated in strip area.

**Export:** Button in bottom strip → inline export controls: format (PNG), DPI (300), compression slider with live file size, download single/all (zip), overwrite vs new version.

**Empty State:** Cyan dashed border drop zone (secondary #00C8D7), cloud icon, "Drop image here", "Browse Files" button.

**Board → Editor:** URL param preload `/design-editor?designs=id1,id2`. RTK Query fetches on mount. Also supports empty state (fresh drag-drop).

**Sidebar:** Single entry "Design Board" under Pipeline section — opens Project Gallery. Image Editor is a tab within each project workspace (no separate sidebar entry).

**Tool reorder:** Drag in both pill bar AND left panel cards. Both stay synced via shared pipeline state.

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

### Design Projects

- [ ] AC-52: `DesignProject` model: UUID pk, workspace FK, name CharField, niche FK (nullable), board_layout JSONField (nullable), created_at. M2M to Design via `DesignProjectDesign` through table.
- [ ] AC-53: `/designs` — Project Gallery page listing all workspace projects. Create new project button. Click project → opens `/design-board/:projectId`.
- [ ] AC-54: Sidebar "Design Board" link navigates to `/designs` (Project Gallery).
- [ ] AC-55: `/design-board/:projectId` renders the canvas board scoped to a project. Loads all designs belonging to that project. PromptBar, model selector, BG color picker, Generate button always functional.
- [ ] AC-56: When opening from idea context (quick-jump), a naming dialog appears: name after niche / name after slogan / enter custom name / assign to existing project. Then opens board directly.
- [ ] AC-57: Default project auto-created on first design generation if user has no projects. Name = "My Designs" (renameable).
- [ ] AC-58: `POST /api/designs/generate/` — accepts `{model, background_color, prompt, project_id, idea_id?}`. Returns run record. Generated design auto-added to the project.
- [ ] AC-59: Design ↔ Project is M2M: a design can belong to multiple projects, a project can have unlimited designs.
- [ ] AC-60: Optional niche binding on project: `PATCH /api/designs/projects/{id}/` with `{niche: nicheId}`. Linked projects' designs visible in niche drawer.
- [ ] AC-61: `?ideaId=xxx` query param on board route: pre-loads idea context (slogan, references) into the project board. Idea context is additive, not exclusive.

### Canvas Board (Kittl Artboard-style — Konva.js)

- [ ] AC-33: Design Board uses Konva.js (`react-konva`) infinite zoom canvas with artboard paradigm — images as freely movable, selectable frames. NOT React Flow node-graph.
- [ ] AC-34: Artboards: titled label above frame, white background, image inside. Click to select (dashed blue border + resize handles). Drag to reposition. Right-click context menu.
- [ ] AC-35: "Add AI Image Board" from context menu on source artboard → new artboard appears to the right, connected by thin arrow. Shows "Regenerate" button when selected.
- [ ] AC-36: Chat/Prompt Bar (bottom, collapsible): collapsed = single-line "Describe what you want to create...". Expanded = source→result thumbnails, editable prompt, Prompt Builder accordion, model/ratio/style/BG selectors, Generate button.
- [ ] AC-37: Right Panel (280px, always visible): context-sensitive — nothing selected = project colors + tools list. Artboard selected = size/layer/color properties + tools. Tools: AI Image Board, Flatten, Upscale, Reframe, BG Remove.
- [ ] AC-38: Bottom Toolbar (48px): cursor, move, shapes, brush, text, emoji, AI sparkle, undo/redo, zoom controls (-, %, +), canvas resize.
- [ ] AC-39: Tools in right panel apply to selected artboard(s). Quick actions: BG Remove, Upscale, Flatten, Reframe. "Open in Editor →" navigates to `/design-editor`.
- [ ] AC-40: Board positions persisted to backend (`DesignProject.board_layout` JSONField). Restored on reload.
- [ ] AC-41: Connection arrows between source artboard and AI Image Board — thin 1px line, purely visual context.
- [ ] AC-42: Drag external images from desktop onto canvas → creates new artboard at drop position.
- [ ] AC-43: Canvas zoom: scroll wheel, pinch, +/- buttons. Grid dots visible at >30% zoom. Dark mode: `#1A1A2E` bg. Light mode: `#E8E8E8` bg. NO tools shown directly on artboards.
- [ ] AC-62: Artboard Canvas has its own export: export selected or all artboards, PNG 300 DPI, compression slider, single or ZIP download. Separate from Editor pipeline export.
- [ ] AC-63: Multi-select artboards (shift+click or drag-select) → "Open in Editor" in right panel → switches to Editor tab with selected images as batch. Context transfer only, no live binding.
- [ ] AC-64: Both tab-modes are fully independent — Editor works without Canvas data, Canvas works without Editor. No cross-dependencies.

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

### Editor Layout (ReadyPixl-inspired)

- [ ] AC-44: Pipeline bar at top, collapsible. Active tools as colored pill-chips (drag-to-reorder, ✖ to remove). Expand to show available tools grouped with section labels (Standard, Edge Cleanup, AI Processing, Quality).
- [ ] AC-45: Left panel (~280px): preset dropdown + Save, stacked collapsible tool config cards (toggle, expand/collapse, drag-to-reorder synced with pill bar), Reset All / Remove All at bottom.
- [ ] AC-46: Canvas center (Konva.js): transparency checkerboard background. Top-left: compact batch nav overlay (< > N/Total 🗑 ALL). Top-right: floating mini-toolbar (Move, Eraser, Wand) — full params in left panel when active.
- [ ] AC-47: Bottom thumbnail filmstrip: horizontal scrollable, click to navigate, status dot per image, current highlighted. Export button integrated in strip.
- [ ] AC-48: Tool reorder via drag in both pill bar and left panel cards. Both synced.
- [ ] AC-49: Canvas → Editor handoff via tab switch: multi-select artboards → "Open in Editor" → switches to Editor tab with images pre-loaded. Also via URL: `?tab=editor&images=id1,id2`.
- [ ] AC-50: Empty state: cyan dashed border drop zone, cloud icon, "Drop image here", "Browse Files" button.
- [ ] AC-51: Unified Design Workspace: single page with two tab-modes (Artboard Canvas + Image Editor). Polished toggle buttons, not generic tabs. Single sidebar entry "Design Board" → Project Gallery.

### PROJ-7 Integration

- [ ] AC-31: "Analyze Design" button in PROJ-7 `ProductCard.tsx` / `ProductDetailPanel.tsx`. Triggers Gemini 3 Architect analysis via `POST /api/products/{product_id}/analyze-image/` (new lightweight endpoint — no Design record needed). Stores `prompt_analysis` JSONField on `AmazonProduct` model. When user later opens Design Board for an Idea from that product → reuses existing analysis (no re-run). Also usable from standalone board when user adds a product image as reference.

### PROJ-8 Integration (Deferred)

- [ ] AC-32: Rejecting an idea that has an approved design shows a MUI confirmation dialog warning the user that an approved design exists before proceeding. If confirmed, idea is rejected and design status unchanged.

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

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/designs/projects/` | Member | List all projects in workspace |
| POST | `/api/designs/projects/` | Member | Create project. Body: `{name, niche?}` |
| PATCH | `/api/designs/projects/{id}/` | Member | Update project (name, niche binding, board_layout) |
| DELETE | `/api/designs/projects/{id}/` | Member | Delete project (designs remain, just unlinked) |
| GET | `/api/designs/projects/{id}/board/` | Member | Board context: project designs, board_layout. Optional `?ideaId=` for idea context |
| POST | `/api/designs/projects/{id}/designs/` | Member | Add existing design(s) to project (M2M) |
| DELETE | `/api/designs/projects/{id}/designs/{designId}/` | Member | Remove design from project (M2M unlink, design not deleted) |
| GET | `/api/ideas/{id}/design-board/` | Member | Idea context: slogan, reference images, existing designs |
| POST | `/api/designs/{id}/analyze-image/` | Member | Trigger Gemini 3 Architect analysis; returns generated prompt |
| POST | `/api/designs/generate/` | Member | Generate design. Body: `{model, bg_color, prompt, project_id, idea_id?}` |
| POST | `/api/products/{product_id}/analyze-image/` | Member | Analyze product image (PROJ-7). Stores on AmazonProduct |
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

- [ ] EC-1: Reference image URL returns 403/404 (Amazon CDN) → skip analysis; fall back to idea-driven prompt.
- [ ] EC-2: Gemini 3 analysis returns malformed JSON → display raw output in prompt editor for manual correction.
- [ ] EC-3: Background color not supported by selected model → warn user via snackbar; proceed with `light_gray` default.
- [ ] EC-4: OpenRouter returns content policy violation → `Design(status=failed, error_message="Content policy refusal")`.
- [ ] EC-5: OpenRouter API key expired/invalid → all runs fail immediately; surface error to member.
- [ ] EC-6: Worker service not running → job queued but never executed; surface in UI after timeout.
- [ ] EC-7: Batch processing: one design fails → continue others; report per-job failures in response.
- [ ] EC-8: Same idea generates multiple runs → all designs stored; board shows all in gallery.
- [ ] EC-9: Approving a new design when one is already approved → auto-reject previous approved.
- [ ] EC-10: Rejecting an idea with an approved design → confirmation dialog before proceeding (PROJ-8 deferred).
- [ ] EC-11: Project Gallery empty state — no projects yet → show "Create your first project" CTA.
- [ ] EC-12: Delete project with designs — designs remain in workspace (M2M unlinked), not deleted.
- [ ] EC-13: Idea quick-jump with no existing projects — naming dialog offers create new only (no "assign to existing" option).
- [ ] EC-14: Design in multiple projects — deleting from one project doesn't affect the other.

---

## Dependencies

- PROJ-4 (Workspace & Membership — worker service in docker-compose; workspace isolation at ORM level)
- PROJ-8 (Idea & Slogan Generation — **optional**: idea context enhances the board but is not required for standalone mode)
- PROJ-6 (Niche Deep Research — **optional**: reference images from research enhance the board but are not required)

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
  - Auto-Detect Defringe — detects color fringe automatically, suggests shrink value
  - Manual Shrink — slider "Shrink Edge: 0-5px" with live preview
  - Color Defringe — detects background color in edge, replaces semi-transparent edge pixels with nearest design color
  - Edge Cleaner — multi-step edge smoothing after BG removal
- **Quality Control tools** (client-side):
  - Transparency Highlighter — visualizes hidden semi-transparent pixels (read-only overlay, no edit)
  - Built-in Compressor — reduce file size (<2MB) without losing print quality
- **Manual Correction tools** (client-side, Konva.js Canvas):
  - Eraser tool — manually remove pixels/areas
  - Magic Wand — area selection by color similarity
  - Per-image preview in batch — click through individual images and correct before batch download
- **Server-side AI tools** (django-rq worker OR external API — user-configurable in Settings):
  - AI Background Removal:
    - Option 1: `rembg` (self-hosted, CPU — ~3-8s/image, free)
    - Option 2: Professional API (e.g. remove.bg — faster, pay-per-use)
    - Default: rembg. User can switch to API in Settings.
  - AI Upscaling — 2-tier system (MVP), user-selectable in Settings:
    - Option 1: `Pica.js` (client-side, Lanczos filter — for images ≥3000px, free, fast)
    - Option 2: Professional API (e.g. Deep-Image.ai — for low-res <3000px, pay-per-use)
    - Default (Auto): ≥3000px → Pica.js, <3000px → API. User can override to "always API" or "always Pica.js".
    - _Future: Real-ESRGAN (self-hosted, GPU) as Option 3 when GPU server available._
  - All provider settings configurable in Settings UI, not only via env vars.
- **Pipeline concept** (ReadyPixl-inspired):
  - Plugin/pill-based system — each processing step is a "pill" in a chain
  - User chains multiple tools in preferred order → creates a reusable pipeline
  - Pipeline stored as `DesignPipeline` model (JSONField with ordered tool+params list)
  - **Presets:** save + load pipeline configurations (name, tool chain, parameters)
  - **Conditional logic:** tools can run conditionally (e.g. "upscale only if <5000px")
  - **Overwrite option:** overwrite original or create new file
- **Batch processing:**
  - Drag & drop bulk upload (100+ images at once)
  - One-time setup — configure pipeline parameters for one image, apply to all
  - Individual post-processing — click through individual images and correct before batch download
  - Progress tracked per image in batch view
  - Export: format (PNG default), DPI (300 default), compression level, download single or all
- **Target Canvas:** 4500x5400px, 300 DPI (MBA standard). Configurable for other marketplaces.
- **Reposition:** Align-to-Top + configurable padding (default: 1 inch top/sides). Snap-to-Top for smaller designs.
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
UPSCALE_PROVIDER=auto               # choices: pica (client), api, auto
UPSCALE_API_KEY=                    # only if provider=api (e.g. Deep-Image.ai key)
UPSCALE_AUTO_THRESHOLD=3000         # pixel threshold for auto mode: >=threshold → Pica.js, <threshold → API
```

Document in `django-app/env/.env.template`. **Rotate the existing OpenRouter key before adding this.**

---

## Verification Steps

### Phase A: Design Generation
1. Open "Design Board" in sidebar → Project Gallery with all projects listed.
2. Create new project → opens empty board with PromptBar, generate works.
3. Write manual prompt → generate → design added to project.
4. Drag-drop reference images → creates reference nodes → analyze works.
5. Quick-jump from approved idea → naming dialog → choose project name/existing → board opens with idea context.
5. Click "Analyze Image" on a reference → Gemini 3 Architect prompt appears, editable on the board.
6. Select background color → choose neon pink → generate → image has neon pink background.
7. Generate with different models (Gemini Flash, GPT Image) → both return images.
8. Approve design → previous approved auto-rejected. Only 1 approved per idea.
9. Quick-jump button from idea list card → navigates to design board pre-loaded with idea context.
10. Reference image 403/404 → falls back to idea-driven prompt (no crash).
11. Content policy refusal → Design(status=failed) with error message shown.
12. "Analyze Design" button in PROJ-7 ProductCard → analysis saved → reused on Design Board.

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
- `/designs` — Project Gallery (overview of all design projects)
- `/designs/:projectId` — Design Workspace (unified: Artboard Canvas + Image Editor tabs)
- `/designs/:projectId?ideaId=xxx` — Workspace with idea context pre-loaded
- `/designs/:projectId?tab=editor&images=id1,id2` — Opens directly in Editor tab with pre-selected images

```
views/design/
├── board/
│   ├── DesignBoardView.tsx             # Konva.js artboard canvas + PromptBar + RightPanel
│   ├── hooks/
│   │   ├── useBoardContext.ts          # Load idea + references + existing designs
│   │   ├── useGeneration.ts            # Trigger + poll generation runs
│   │   ├── useDesignActions.ts         # Approve, reject, delete mutations
│   │   ├── useBatchProcess.ts          # Batch upscale + bg_remove
│   │   ├── useImageAnalysis.ts         # Trigger + poll Gemini 3 analysis
│   │   ├── useBoardLayout.ts           # Artboard positions, canvas zoom/pan state
│   │   └── useBoardArtboards.ts        # Convert API data → artboard objects
│   ├── partials/
│   │   ├── ArtboardCanvas.tsx           # Konva.js infinite canvas with artboards
│   │   ├── Artboard.tsx                # Single artboard frame (image + label + selection)
│   │   ├── ConnectionArrow.tsx         # Thin arrow between source → AI Image Board
│   │   ├── PromptBar.tsx               # Bottom collapsible chat/prompt bar
│   │   ├── RightPanel.tsx              # Always-visible right panel (280px) — properties + tools
│   │   ├── BottomToolbar.tsx           # Cursor/move/shapes/brush/text/emoji/AI/undo/redo/zoom
│   │   ├── ArtboardContextMenu.tsx     # Right-click menu: Add AI Board, Duplicate, Delete
│   │   ├── ProjectNamingDialog.tsx     # Naming dialog for idea→project flow
│   │   ├── ModelSelector.tsx           # Embedded in PromptBar
│   │   └── BackgroundColorPicker.tsx   # Embedded in PromptBar
│   └── types/
│       └── index.ts                    # Artboard types, canvas state
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
  Path 1 (Standalone): Sidebar → /designs (Gallery) → New Project → /design-board/:projectId
    → Empty canvas, manual prompt, upload references
    → Select model + background color → Generate → poll → designs added to project

  Path 2 (From Idea): Idea Card [Quick-Jump] → Naming Dialog → /design-board/:projectId?ideaId=xxx
    → Load idea context (slogan + reference images + existing designs) into project board
    → "Analyze Image" → Gemini 3 Architect → structured prompt → editable
    → OR auto-construct prompt from DB fields (idea-driven)
    → Select model + background color → Generate → poll → designs added to project
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
| 3 routes (Gallery + Board + Editor) | Gallery = project list. Board = project-scoped artboard canvas. Editor = batch tool (N images from any source) |
| Konva.js (`react-konva`) for Design Board | Artboard-style canvas like Kittl. Free image positioning, selection, resize handles. Shared with post-processing editor. React Flow removed — node-graph paradigm was wrong for design canvas |
| Konva.js for post-processing editor canvas | Proven for browser-based pixel manipulation. Web Workers for non-blocking processing. Used by ReadyPixl |
| Kittl-style bottom Prompt Bar | Chat-like prompt entry with source→result thumbnails. Keeps canvas clean, prompt always accessible |
| `DesignProject` model with M2M to Design | Kittl-style project folders. Designs can belong to multiple projects. Optional niche binding. Board layout per project |
| `DesignProject.board_layout` JSONField | Save node positions + connections per project. Restore board state on reload |
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
| ~~`@xyflow/react`~~ | ~~React Flow~~ — REMOVED. Design Board now uses Konva.js (same as editor). Artboard paradigm, not node-graph |
| `konva` + `react-konva` | Canvas-based image editor for post-processing tools (Phase B) |
| `pica` | Client-side image upscaling (Lanczos filter) |
| `tinycolor2` | Color manipulation for defringe/color tools |
