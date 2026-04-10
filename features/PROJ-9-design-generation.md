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

#### Cloud Storage Manager
15. As a member, I want to browse my Google Drive folder structure and see all images (with thumbnails) in a table, so I can find reference images without leaving the app.
16. As a member, I want to browse my Microsoft OneDrive folder structure and see all images in a table, so I can use my preferred cloud storage.
17. As a member, I want to download individual cloud images or use them directly for AI tools in the editor, so I can work with cloud files on-demand without bulk-downloading.
18. As a member, I want to upload generated/processed images from the editor batch back to a selected cloud folder, so I can organize finished designs in my cloud storage.
19. As a member, I want to manage my cloud storage connections (connect/disconnect) in Settings, so I can control which accounts are linked.

**Cloud Storage Manager — Implementation Notes:**
- `CloudManagerDialog.tsx`: Tabbed (Google Drive | OneDrive), `maxWidth="md"`, fullscreen toggle
- Custom folder browser (breadcrumb nav) + image table (thumbnail, folder, filename, size, actions) — no native picker SDKs
- Actions per image: Download (browser) | Use for AI (fetch → File → onFilesAdded → Batch)
- Multi-select: checkboxes + bulk Download / Use for AI buttons
- Upload: select Batch images → choose cloud target folder → upload
- Google: OAuth2 External + Testing Mode (MVP), scope `drive.file`, Drive API. Env: `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY`. Production: Google Verification (~1-2 weeks)
- OneDrive: Personal accounts only (MVP), MSAL popup, scope `Files.ReadWrite`. Env: `VITE_ONEDRIVE_CLIENT_ID`. Later: Multi-tenant for Business
- Azure setup: App registration (SPA), redirect URI localhost:5173 + prod
- SDK loading: dynamic on dialog open (lazy). Missing env vars: "Not Configured" state with hint
- `CloudStorageSettings.tsx`: reusable section in Central App Settings + Design Editor Settings. Shows connection status, account email, connect/disconnect
- CloudManagerDialog inline fallback: "Connect" button if not connected
- File filter: images only (png/jpg/webp), no SVG. Max 25MB per file
- No backend changes needed — all client-side via provider APIs

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

### Upload-Ready Status & Drawer Integration

30b. As a member, I want to toggle an approved design as "Ready for Upload" so it's clear which designs are finalized and can move to the Listing/Publish workflow.
30c. As a member, I want to mark all designs in a project as "Ready for Upload" in one action, so I can batch-finalize an entire project.
30d. As a member, I want to see individual design thumbnails with a status badge (WIP / Ready) in the Niche Drawer's "Design Projects" section, so I can tell at a glance which designs are upload-ready without opening the project.
30e. As a member, I want to toggle the upload-ready status back to WIP if I change my mind, so the workflow is reversible.

### Niche Drawer — Pipeline Status Redesign

> REDESIGNED: 2026-04-08. Drawer = compact workflow pipeline overview per niche. Replaces scattered sections with unified pipeline cards.

The Niche Drawer keeps the existing **niche header** (name, keyword, status, round, edit) at the top. Below, the workflow pipeline is shown as **compact + expandable cards** — one card per pipeline step. Each card shows status + count and has context-specific action buttons to push items to the next workflow step.

**Pipeline Cards (in order):**

| Card | Status Sources | Expanded Content | Action Buttons |
|------|---------------|-----------------|----------------|
| 🔬 Deep Research | NicheResearch status/score | Summary: score, product count, date, top vibes/styles | [🔬 View] → navigates to `/niches/research?nicheId=...`. [🔄] → force refresh. If no research: [🔬 Start] |
| 🔑 Keywords | Keyword count from PROJ-10 | Top keywords preview | [🔑 View] → navigates to keyword page |
| ❤️ Collected Products | CollectedProduct count | **Thumbnail grid** (not carousel) — small images, 3 per row. BSR + Price under each. | Per product: [🔑→KW] [💡→Slogan] [🎨→Canvas] [🔍→Detail]. Multi-select: [Use N as Canvas References] |
| 💡 Slogans | Approved idea count | Approved slogan list with signal_type badge | Per slogan: [🎨→] (Add to Canvas). Bulk: [☑ Select All] [Forge N → 🎨] |
| 🎨 Designs | DesignProject count + design count | Project list with thumbnail grid (max 4 per project) | Per project: [📋→ Listings]. [→ Open Canvas] |
| 📋 Listings | Listing count by status | Listing summary (draft/ready/published counts) | [📋→ Open Publish Page] |
| 📤 Upload | UploadJob count by status | Upload summary (pending/completed/failed counts) | [📤→ Upload Queue] |

**Card States:**
- **Done** (✅): green badge, compact 1-line summary, chevron to expand
- **Active** (🔄): blue left-border accent, auto-expanded, items + actions visible
- **Pending** (⏳): grey, minimal — "No X yet" + hint what needs to happen first

**Collected Products — Grid Pattern (replaces Carousel):**
- Thumbnail grid (3 columns, ~80×80px thumbnails) instead of single-image carousel
- Below each thumbnail: BSR + Price in small text
- Inline icon chip actions per product (visible on hover or always): 🔑 🎨 💡 🔍
- Multi-select via checkboxes for batch actions
- Click thumbnail → full product detail (existing ProductDetailDrawer)

### Direct Action Buttons (Cross-View)

Action buttons exist in **both** the Drawer pipeline cards AND the source views themselves:
- **SloganGen View** (IdeaCard): [🎨→] icon button per approved slogan → ProjectNamingDialog → Canvas (already implemented)
- **Design Canvas** (Artboard): [📋→ Save to Listings] icon button per approved design → sends to Listing/Publish
- **Listing Page**: [📤→ Queue Upload] per listing → creates UploadJob
- Same dialog/flow regardless of entry point (Drawer or View)

### PROJ-8 Integration (Deferred from PROJ-8)
32. As a member, I want to see a warning dialog when rejecting an idea that has an approved design, so I don't accidentally discard a design that's already been finalized.

### Canvas Board Interaction
33. As a member, I want to drag external images from my desktop onto the canvas as new reference nodes, so I can add custom references beyond the niche research products.
34. As a member, I want to create multiple generation flows from different subsets of references on the same board, so I can A/B test different design directions for the same idea.

### Canvas Element Manipulation (Artboard Content)

#### Image Manipulation
35. As a member, I want to click an image inside an artboard to select it as a layer, so I can manipulate it independently from the artboard frame.
36. As a member, I want to scale an image inside an artboard with aspect ratio lock (default), so the image doesn't distort when resizing.
37. As a member, I want to double-click an image to enter free-transform mode (move, scale, rotate freely within the artboard), and click outside to exit, so I have precise control when needed but a simple default behavior.
38. As a member, I want image content to belong to its artboard — when I move the artboard, all content moves with it.

#### Text Tool
39. As a member, I want to select the Text tool and click on an artboard to insert editable text, so I can add slogans, titles, or labels directly on the canvas.
40. As a member, I want to choose font family, size, color, bold, and italic for text elements, so I can style text to match my design.
41. As a member, I want to adjust outline/stroke, shadow, letter-spacing, and line-height on text, so I can create visually polished text overlays.
42. As a member, I want to apply curved/arched text (text on a path), so I can create badge-style or circular text layouts common in POD designs.
43. As a member, I want text effects like gradient fill and 3D/emboss, so I can create eye-catching typography without external tools.

#### Shapes Tool
44. As a member, I want to insert basic shapes (rectangle, circle, triangle, line) onto an artboard with fill color and stroke, so I can create backgrounds, borders, and decorative elements.
45. As a member, I want to move and scale inserted shapes freely within the artboard, so I can position them precisely.
46. As a member, I want a Pen tool to draw custom vector paths (freeform shapes), so I can create unique design elements beyond basic shapes.

#### Brush / Freehand Drawing
47. As a member, I want a basic brush tool with configurable size and color, so I can make quick freehand markings or annotations on the canvas.

#### Emoji
48. As a member, I want to insert emojis onto an artboard via the native OS emoji picker, so I can quickly add emoji graphics to my designs.
49. As a member, I want inserted emojis to be rendered as image layers on the canvas (not text), so they scale cleanly and look consistent across devices.

#### Layer Management
50. As a member, I want a Layer Panel in the right sidebar showing all elements (images, text, shapes, emojis) of the selected artboard, so I can see and manage the stacking order.
51. As a member, I want to drag-reorder layers in the panel to change z-order, so I can control which elements appear in front of or behind others.
52. As a member, I want to toggle layer visibility (eye icon) and lock layers (lock icon), so I can protect finished elements while working on others.
53. As a member, I want to click a layer in the panel to select it on the canvas, and vice versa, so navigation between panel and canvas is seamless.

### Slogan → Design Forge Bulk Flow

54. As a member, I want to select multiple approved slogans in the Niche Drawer and send them to a new or existing Design Forge project in one action, so I can batch-generate designs from my slogan collection.
55. As a member, I want to see all slogans assigned to a project as a "Slogan Pool" in the RightPanel, so I can manage which slogans I'm working on and see their context (signal type, confidence, reference products).
56. As a member, I want to click "Auto-Prompt" on a slogan in the pool and get a ready-to-use AI generation prompt (built from slogan text + niche research data), so I don't have to write prompts from scratch.
57. As a member, I want to select multiple slogans and click "Generate Selected" to bulk-generate one design per slogan automatically, so I can produce designs for my entire slogan batch in one action.
58. As a member, I want to click a reference product thumbnail in a slogan's pool card and add it as a reference artboard on the canvas, so I can visually compare while generating.
59. As a member, I want the existing IdeaCard brush button to add the slogan to the project's pool (not just pass as URL param), so the slogan context is permanently available in the Design Forge.

#### Prompt Builder + Persistence

> REDESIGNED: 2026-04-08. Prompt Builder Dialog now uses tabbed layout inspired by MyDesigns.io Dream AI Prompt Builder, but with POD-specific data sources instead of generic dropdowns.

60. As a member, I want generated prompts saved persistently in my project (not lost when a dialog closes), so I can review, edit, and generate from them later.
61. As a member, I want a tabbed Prompt Builder dialog (MyDesigns.io style) where each tab controls a different aspect of the prompt, so I can fine-tune my design request step by step.
62. ~~As a member, I want to generate multiple prompt variants (1-5) from the same sources~~ — **REMOVED**: Variants slider already exists in the RightPanel (Images count slider).
63. As a member, I want to save my preferred source configurations as Prompt Presets ("Full Context", "Slogan Only", "Image Analysis Only"), so I don't have to re-configure every time.
64. As a member, I want to see all my project's artboards listed in the RightPanel with their context (prompt used, slogan, keywords, reference images), so I have a complete overview without clicking each artboard.
65. As a member, I want a "🖼 Analyze Image" button in the RightPanel that runs Gemini 3 Architect analysis on a selected image and generates a prompt from it, so I can create designs inspired by existing images.
66. As a member, I want to right-click an image artboard and choose "Analyze Image → Generate Prompt" to quickly get an AI-generated prompt from that image.

**Prompt Builder Dialog — Tab Structure (MyDesigns.io style, POD-adapted):**

```
┌─ Prompt Builder ──────────────────────── ✕ ─┐
│                                              │
│ Concept  Context  Style  Format  Color       │
│ Background  Text  Output                     │
│ ─────────────────────────────────────────    │
│                                              │
│  (active tab content here)                   │
│                                              │
│                                              │
│ [Cancel]                  [Generate Prompt]  │
└──────────────────────────────────────────────┘
```

| Tab | Fields | Purpose |
|-----|--------|---------|
| **Concept** | Prompt Title (input), Slogan Selector (dropdown from pool — auto-fills Main Subject), Main Subject (textarea), Content Type (dropdown), Mood (dropdown) | Core idea — what to generate |
| **Context** | Toggle sections: ☑ Keywords (chips from PROJ-10), ☑ AI Research (visual_style, vibe, tone from Deep Research), ☑ Reference Products (thumbnail grid from collected products). Each toggleable on/off | *NEW* — inject real niche data into prompt. MyDesigns has nothing like this |
| **Style** | Style Category (dropdown: Vector, Vintage, Retro, Minimalist, Bold, Cartoon, etc.), Style (dropdown), "+ Add Style" button | Visual style direction |
| **Format** | Orientation (dropdown), Aspect Ratio (dropdown), Detail Level (dropdown), Composition (dropdown), Rendering Style (dropdown) | Technical params (merged MyDesigns Format + Composition tabs) |
| **Color** | Color swatches + "+ Add Color" + "From Research" auto-fill button (pulls dominant colors from niche research) | Color palette for the design |
| **Background** | Background Type dropdown (Transparent, Solid Color, Gradient) + BG Color Presets (Light Gray, Neon Pink, Neon Green — MBA post-processing optimized) | Background control |
| **Text** | Text Included? (dropdown: No Text, Slogan Text, Custom Text) + Text Preview (shows selected slogan if applicable) | Whether design contains text |
| **Output** | Use (dropdown), Avoid (dropdown), Print Requirements (MBA preset: "4500x5400, 300DPI, seamless edges, no bleed"), Final Feel (dropdown) | Output constraints + quality |

**Key differences from MyDesigns:**
- **Context tab is unique to Merch Miner** — real data from niche research pipeline
- **Slogan integration** in Concept tab (auto-fills from Slogan Pool)
- **"From Research" auto-fill** in Color tab
- **MBA Print Requirements** preset in Output tab
- **No Variants slider** — already in RightPanel (Images count)
- "Generate Prompt" → builds prompt text → fills RightPanel textarea → user reviews/edits → clicks Generate

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

**Right Panel (280px, always visible) — REDESIGNED 2026-04-08:**

> Inspired by MyDesigns.io Dream AI left panel — but positioned on the right. The PromptBar moves from the bottom into the RightPanel. The panel is the **primary prompt + generation control center**.

**Nothing selected (default state):**
```
┌─ RIGHT PANEL (280px) ─────────────┐
│ Model: [Flux ▾]    BG: [■ Gray ▾] │
│ Images: ─●── 4    Res: 1:1        │
│ ┌────────────────────────────────┐ │
│ │ Enter prompt...                │ │
│ │                                │ │
│ │                                │ │
│ └────────────────────────────────┘ │
│ [🖼 Analyze] [+ Prompt Builder]   │
│ [✨ Generate]                      │
│ ─────────────────────────────────  │
│ ▶ Saved Prompts (3)               │
│ ▶ Slogan Pool (3)                 │
│ ▶ Artboards (5)                   │
└────────────────────────────────────┘
```

- **Top zone:** Model selector dropdown, Background color, Images count slider, Resolution/Aspect ratio
- **Prompt zone:** Multiline textarea (pre-filled from analysis or auto-prompt). [🖼 Analyze Image] button + [+ Prompt Builder] button (opens dialog with source toggles: Slogan, Keywords, Research, Image)
- **Generate button:** Primary CTA below prompt. "Generate All" when multiple saved prompts exist
- **Accordion sections below:** Saved Prompts, Slogan Pool, Artboards — collapsible, scrollable

**Artboard selected:** Accordion sections shift. Element properties appear at top (Size, Layer, Color, Clip). Prompt zone stays accessible via scroll or collapse.

**Element selected (text/shape/brush):** Properties panel replaces top zone (font, color, stroke, etc.). Layer Panel visible. Prompt zone collapsed but accessible.

**Bottom Toolbar (48px):** (unchanged)
Fixed horizontal bar below canvas. Left side: cursor tool, move tool, shape tool (dropdown), brush tool, text tool, emoji picker. Separator. Undo/Redo. Separator. Zoom controls (-, percentage, +). Canvas resize button.

**PromptBar (bottom) — REMOVED:**
~~Chat / Prompt Bar at bottom~~ — merged into RightPanel. The bottom area is now only the Bottom Toolbar (tools + zoom).
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

## Frontend Design Decisions (2026-04-09 `/frontend-design` Session)

> **MANDATORY for `/architecture`:** These design decisions MUST be reflected 1:1 in the task file. Every styled component, token mapping, and animation specified here is a requirement, not a suggestion. The `/frontend` skill implements exactly what the tasks say.

### FD-0: Icon Strategy

**MUI Icons first** — check `@mui/icons-material` before creating custom icons. But when no fitting MUI icon exists (especially for pipeline steps, workflow actions, POD-specific concepts), create **custom SVG icons** as React components in `frontend-ui/src/assets/icons/`.

Custom icons must:
- Match MUI icon sizing conventions (default 24px viewBox, `fontSize` prop support)
- Use `currentColor` for fill/stroke (inherits from parent color)
- Be exported as named components: `export const NicheResearchIcon = (props: SvgIconProps) => ...`
- Follow the design system aesthetic: 1.5px stroke weight, rounded line caps, consistent with MUI Outlined style
- Reference: MyDesigns.io + Flying Upload use custom icons extensively for their pipeline/action buttons — we should match that polish level

**Where custom icons are likely needed:**
- Pipeline step icons (🔬 Research, 🔑 Keywords, ❤️ Products, 💡 Slogans, 🎨 Designs, 📋 Listings, 📤 Upload) — the emoji placeholders in this spec MUST be replaced with proper SVG icons
- Flow Button targets if MUI alternatives look too generic
- Prompt Builder tab icons (optional — tabs are text-only like MyDesigns, but icons could enhance)
- "Forge" / "Dream" / "Analyze" action concepts that have no good MUI equivalent

### FD-1: Pipeline Cards (Drawer)

**Replaces:** Current `Section` wrappers (bordered box with dark bg) in `DrawerResearchSection`, `CollectedProductsSection`, `CollectedItemsSection`, `DrawerDesignsSection`.

**Pattern:** Glassmorphism Status Cards with left color stripe as state indicator.

**Card Container:**
- bg: `alpha(COLORS.inkPaper, 0.60)` + `backdropFilter: 'blur(8px)'` (dark) / `theme.vars.palette.background.paper` (light)
- border: `theme.vars.palette.divider`
- border-radius: `theme.shape.borderRadius * 1.5` → 12px
- padding: `theme.spacing(1.5, 2)` → 12px 16px
- margin-bottom: `theme.spacing(1)`
- hover bg: `COLORS.inkElevated`
- transition: `DURATION.fast` + `EASING.standard`

**Left Status Stripe** (3px wide, border-radius left):
- Done: `COLORS.successDk` — solid
- Active: `COLORS.cyan` — pulse animation (opacity 0.5↔1.0, 1.2s infinite)
- Pending: `COLORS.snowDisabled` — solid, muted

**Card Header** (always visible, 40px):
- Icon: `theme.spacing(2.25)` → 18px, color matches stripe state
- Title: `theme.typography.subtitle2`
- Badge: `theme.typography.overline`, pill shape (`theme.shape.borderRadius * 0.75`)
  - Done: bg `alpha(COLORS.successDk, 0.12)`, color `COLORS.successDk`
  - Active: bg `alpha(COLORS.cyan, 0.10)`, color `COLORS.cyan`
  - Pending: bg `alpha(COLORS.snowDisabled, 0.12)`, color `COLORS.snowDisabled`
- Chevron: `ExpandMore` 18px, `text.disabled`, rotates 180° when expanded

**Expanded Content:**
- padding-top: `theme.spacing(1.5)`
- border-top: `theme.vars.palette.divider`
- Expand animation: `max-height` + `opacity`, `DURATION.default` + `EASING.enter`

**Card Order in Drawer:** 🔬 Deep Research → 🔑 Keywords → ❤️ Collected Products → 💡 Slogans → 🎨 Designs → 📋 Listings → 📤 Upload

**Animations:**
1. Expand/Collapse: `max-height` + `opacity`, 200ms enter / 150ms exit
2. Active stripe pulse: `@keyframes pulseCyan { 0%,100%{opacity:1} 50%{opacity:0.5} }` 1.2s
3. Badge count update: `scale 1.0→1.15→1.0`, `DURATION.fast`
4. Card hover: bg transition + `translateY(-1px)`, `DURATION.fast`

---

### FD-2: Collected Products Grid

**Replaces:** Current carousel (`CarouselContainer`, `CardSlide`, `NavArrow`, `DotRow`) in `CollectedProductsSection.tsx`.

**Grid:**
- CSS Grid: `repeat(3, 1fr)`, gap `theme.spacing(1.5)` → 12px
- Inside Pipeline Card expanded content
- Max 6 visible, scroll or "Show all" beyond

**Product Thumbnail Card:**
- bg: `COLORS.inkElevated` (dark) / `theme.vars.palette.background.paper` (light)
- border: `theme.vars.palette.divider`
- border-radius: `theme.shape.borderRadius` → 8px
- hover: border `alpha(COLORS.cyan, 0.30)`, `translateY(-1px)`
- selected: border `COLORS.cyan`, `box-shadow: 0 0 0 1px ${COLORS.cyan}`

**Image area:** `aspect-ratio: 1/1`, `object-fit: cover`

**Info bar** (under image):
- padding: `theme.spacing(0.75, 1)` → 6px 8px
- BSR: `theme.typography.caption`, TrendingUp icon 14px, color-coded (successDk <10k, warningDk 10-50k, text.secondary >50k)
- Price: `theme.typography.caption`, weight 600, `text.primary`, right-aligned

**Hover Action Overlay** (over image area only):
- bg: `alpha(COLORS.ink, 0.70)`, `backdrop-filter: blur(4px)`
- opacity 0→1, `DURATION.fast`, `EASING.enter`
- 4 Icon Buttons: `theme.spacing(4)` → 32px, `theme.shape.borderRadius` → 8px
- Default bg: `alpha('#fff', 0.10)`, color: `text.primary`
- Per-button hover:
  - 🔑 Keywords: bg `alpha(COLORS.warningDk, 0.20)`, color `COLORS.warningDk`
  - 💡 Slogan: bg `alpha(COLORS.cyan, 0.20)`, color `COLORS.cyan`
  - 🎨 Canvas: bg `alpha(COLORS.red, 0.20)`, color `COLORS.red`
  - 🔍 Detail: bg `alpha('#fff', 0.15)`, color `text.primary`

**Multi-Select:**
- Checkbox: absolute top-left, 20px, opacity 0→1 on hover or when any selected
- Checked: `COLORS.cyan` bg, white checkmark
- Bulk Action Button: outlined, full-width, border `alpha(COLORS.cyan, 0.30)`, color `COLORS.cyan`
- Bulk button slide-in: `translateY(8px)→0` + `opacity 0→1`, `DURATION.default`

**"Add Product" Card** (last grid item when <6):
- transparent bg, dashed border `alpha('#fff', 0.12)`, AddCircleOutline icon 32px
- hover: border `alpha(COLORS.cyan, 0.30)`

---

### FD-3: RightPanel (Dream AI-Style Prompt Center)

**Replaces:** Current `PanelNoneState.tsx` layout. PromptBar (bottom) merged into RightPanel.

**Two zones:** Sticky Generation Zone (top) + Scrollable Accordion Zone (below).

**Generation Zone (sticky top):**
- bg: `COLORS.inkPaper` (dark) / `theme.vars.palette.background.paper` (light)
- padding: `theme.spacing(2)` → 16px
- border-bottom: `theme.vars.palette.divider`

**Controls:**
- Model + BG selectors: 2-column grid, compact Select height `theme.spacing(4)` → 32px, bg `COLORS.inkElevated`, radius `theme.shape.borderRadius * 0.75` → 6px
- Images Slider: MUI Slider `size="small"`, color `secondary.main` (cyan), thumb 12px
- BG Color: dropdown with colored dot (10px square, radius 2px) before label

**Parallel Prompts Row:**
- MUI Switch `size="small"`, checked color `secondary.main`
- Label: `subtitle2`, `text.primary`, clickable
- Hint (when active): `caption`, `text.disabled`, "Each new line = separate image"
- Right side: two icon buttons with `theme.spacing(0.75)` gap

**[🖼] Analyze Image IconButton:**
- `theme.spacing(4)` → 32px, radius `theme.shape.borderRadius` → 8px
- border: `theme.vars.palette.divider`, bg transparent
- hover: bg `alpha(COLORS.cyan, 0.10)`, border `alpha(COLORS.cyan, 0.30)`, color `COLORS.cyan`
- icon: ImageSearch 18px
- Tooltip: "Generate prompt based on your image"

**[+] Prompt Builder IconButton:**
- `theme.spacing(4)` → 32px, radius `theme.shape.borderRadius` → 8px
- bg: `theme.vars.palette.secondary.main` (cyan), color '#fff'
- hover: bg `COLORS.cyanDk`, glow `0 0 12px ${alpha(COLORS.cyan, 0.30)}`
- icon: Add 18px
- Tooltip: "Open Prompt Builder"

**Prompt Textarea:**
- MUI TextField multiline, rows 4 min / 8 max
- bg: `alpha(COLORS.ink, 0.40)` (dark)
- border: `theme.vars.palette.divider`, focus: `primary.main`
- radius: `theme.shape.borderRadius` → 8px
- Placeholder changes with parallel switch state

**Generate Button:**
- full-width, height `theme.spacing(5)` → 40px
- bg: `linear-gradient(135deg, COLORS.red, COLORS.redDk)`
- icon: AutoAwesome 18px, color '#fff'
- hover: glow `0 0 24px ${alpha(COLORS.red, 0.30)}`
- loading: shimmer bg-position animation, 2s infinite
- "Generate All" variant: dropdown arrow, menu with count

**Scrollable Zone:**
- `overflow-y: auto`, `flex: 1`, padding `theme.spacing(1)`

**Accordion Section Pattern (shared):**
- MUI Accordion, transparent bg, no border, no shadow, no `&:before`
- Summary: min-height `theme.spacing(5)` → 40px, radius `theme.shape.borderRadius * 0.75`
- Title: `subtitle2`, `text.secondary`
- Count Badge: `overline`, bg `alpha(COLORS.cyan, 0.10)`, color `COLORS.cyan`, radius 6px
- Sections: Saved Prompts, Slogan Pool, Artboards, Layers (conditional)

**Context Switch (element selected):**
- Generation Zone collapses to single row (48px): Model + BG + Generate
- Element Properties panel appears between zones
- Transition: `DURATION.default` + `EASING.standard`

---

### FD-4: Prompt Builder Dialog (8 Tabs)

**Opened via:** [+] IconButton in RightPanel Generation Zone.

**Dialog:**
- MUI Dialog `maxWidth="md"` (900px), fullWidth
- bg: `COLORS.inkPaper` (dark), radius 16px (MuiDialog override)
- min-height 400px, max-height 80vh

**Header:**
- padding `theme.spacing(2.5, 3)` → 20px 24px
- Title: `theme.typography.h4` (18px, 600)
- Close: IconButton 32px

**Tab Navigation:**
- NOT MUI Tabs — custom text links with underline indicator
- flex wrap, gap `theme.spacing(0.5)`
- padding `theme.spacing(0, 3)`, border-bottom divider
- Tab item: `subtitle2`, `text.secondary`, padding `theme.spacing(1.5, 2)`
- Active: `secondary.main` (cyan) + 2px underline (`COLORS.cyan`)
- Hover: `text.primary`

**Tab Content:** padding `theme.spacing(3)`, min-height 220px

**Tabs:**

| Tab | Layout | Key Elements |
|-----|--------|-------------|
| **Concept** | Column, gap `theme.spacing(2.5)` | Prompt Title (TextField), Slogan Selector (Select — auto-fills Main Subject), Main Subject (multiline rows:3), 2-col grid: Content Type + Mood (both Select) |
| **Context** | Stacked source sections | Each section: glass card (`alpha(COLORS.inkElevated, 0.40)`), radius 8px, padding 16px. Master checkbox + title header. Unchecked: opacity 0.45 + blur(1px). **Keywords**: wrapped Chips `size="small"`, outlined, border `alpha(COLORS.cyan, 0.20)`. **AI Research**: grid with per-field checkboxes (label `caption` right-aligned, value `body2`). Master ☑ toggles all sub-checkboxes, indeterminate when partial. **Reference Products**: 4-col grid, thumbs 56px, selected: cyan border + glow |
| **Style** | 2-col: Style Category + Style | Select dropdowns + "+ Add Style" ghost button. Added styles as Chips: bg `alpha(COLORS.cyan, 0.10)`, color `COLORS.cyan`, deletable |
| **Format** | 2×2 grid + full-width row | Orientation, Aspect Ratio, Detail Level, Rendering Style (all Select, height 40px) + Composition (full-width Select) |
| **Color** | Flex wrap swatches | 40×40px, radius 8px, selected: border `COLORS.cyan` + glow. "+ Add Color" ghost btn. "🔬 From Research" ghost btn (cyan, pulls niche colors) |
| **Background** | Select + preset chips | Background Type Select (Transparent/Solid/Gradient) + Preset Chips (Light Gray, Neon Pink, Neon Green, Transparent). Selected chip: bg `alpha(COLORS.cyan, 0.10)`, border `COLORS.cyan` |
| **Text** | Select + preview | "Text Included?" (No/Slogan/Custom). Preview box: glass card, `body2` italic, `text.secondary` |
| **Output** | 2×2 grid + MBA chip | Use, Avoid, Print Requirements, Final Feel (all Select). MBA Preset Chip: toggleable, bg `alpha(COLORS.successDk, 0.10)`, color `COLORS.successDk` when active |

**Footer:**
- padding `theme.spacing(2, 3)`, border-top divider
- Cancel: ghost button, `text.secondary`
- Generate Prompt: contained, bg `secondary.main` (cyan), hover `COLORS.cyanDk` + glow

**Animations:**
1. Tab content switch: `opacity 0→1` + `translateX(8px)→0`, `DURATION.fast`
2. Tab underline: width 0→full, `DURATION.fast`
3. Source section enable/disable: opacity + blur transition, `DURATION.default`
4. Color swatch select: `scale(1.1)` + border, `DURATION.fast`
5. Dialog enter: Fade + `translateY(16px)→0`, `DURATION.slow`

---

### FD-5: Direct Action Buttons (Flow Buttons)

**Shared components:** `components/FlowButton/InlineFlowButton.tsx` + `BulkFlowButton.tsx`

**Target Color Mapping (constant in `FlowButton/constants.ts`):**

| Target | Icon | Color | Hover BG |
|--------|------|-------|----------|
| keywords | KeyOutlined | `COLORS.warningDk` | `alpha(COLORS.warningDk, 0.12)` |
| slogans | LightbulbOutlined | `COLORS.cyan` | `alpha(COLORS.cyan, 0.10)` |
| canvas | BrushOutlined | `COLORS.red` | `alpha(COLORS.red, 0.10)` |
| listings | ArticleOutlined | `COLORS.successDk` | `alpha(COLORS.successDk, 0.10)` |
| upload | CloudUploadOutlined | `COLORS.infoDk` | `alpha(COLORS.infoDk, 0.10)` |
| detail | OpenInNewOutlined | `text.secondary` | `alpha('#fff', 0.06)` |

**Inline Flow Button:**
- `theme.spacing(3.5)` → 28px, radius `theme.shape.borderRadius * 0.75` → 6px
- default: transparent bg, `text.disabled` color
- hover: target hover bg + target color + `translateX(2px)` rightward nudge
- Tooltip with action description

**Bulk Flow Button:**
- MUI Button `variant="outlined"` `size="small"`, full-width
- height `theme.spacing(4)` → 32px, radius `theme.shape.borderRadius` → 8px
- border + color: target color, icon as endIcon 16px
- hover: target subtle bg + glow `0 0 12px ${alpha(targetColor, 0.15)}`
- Appear animation: `translateY(4px)→0` + `opacity 0→1`, `DURATION.default`

**Placement:**
- Drawer Pipeline Cards: Inline per slogan/project row, Bulk under lists on selection
- SloganGen IdeaCard: Inline [🎨→] next to Approve/Reject (only when approved)
- Canvas Artboard: Context menu item "📋 Save to Listings" + Inline in RightPanel artboard row
- All use same `InlineFlowButton` / `BulkFlowButton` components with `target` prop

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
- [ ] AC-38: Bottom Toolbar (48px): cursor, shapes (dropdown), brush, text, emoji, AI sparkle, undo/redo, zoom controls (-, %, +). Canvas pan via Space+Drag or middle-mouse (no separate move tool).
- [ ] AC-39: Tools in right panel apply to selected artboard(s). Quick actions: BG Remove, Upscale, Flatten, Reframe. "Open in Editor →" navigates to `/design-editor`.
- [ ] AC-40: Board positions persisted to backend (`DesignProject.board_layout` JSONField). Restored on reload.
- [ ] AC-41: Connection arrows between source artboard and AI Image Board — thin 1px line, purely visual context.
- [ ] AC-42: Drag external images from desktop onto canvas → creates new artboard at drop position.
- [ ] AC-43: Canvas zoom: scroll wheel, pinch, +/- buttons. Grid dots visible at >30% zoom. Dark mode: `#1A1A2E` bg. Light mode: `#E8E8E8` bg. NO tools shown directly on artboards.
- [ ] AC-62: Artboard Canvas has its own export: export selected or all artboards, PNG 300 DPI, compression slider, single or ZIP download. Separate from Editor pipeline export.
- [ ] AC-63: Multi-select artboards (shift+click or drag-select) → "Open in Editor" in right panel → switches to Editor tab with selected images as batch. Context transfer only, no live binding.
- [ ] AC-64: Both tab-modes are fully independent — Editor works without Canvas data, Canvas works without Editor. No cross-dependencies.

### Canvas Element Manipulation

#### Image Manipulation
- [ ] AC-65: Click image inside artboard → selects as layer (distinct from artboard selection). Resize handles appear on the image, not the artboard.
- [ ] AC-66: Image scaling defaults to aspect-ratio-locked. Hold Shift to free-scale (same pattern as artboard resize).
- [ ] AC-67: Double-click image → enters free-transform mode (move, scale, rotate within artboard). Click outside image → exits free-transform. Single click → select only (move + scale, no rotate).
- [ ] AC-68: All content elements (images, text, shapes, emojis) belong to their parent artboard. Moving the artboard moves all child elements together.

#### Text Tool
- [ ] AC-69: Text tool active → click on artboard → inserts editable text element at click position. Inline editing with blinking cursor. Click outside or press Escape → deselect.
- [ ] AC-70: Text properties panel (right sidebar when text selected): font family (dropdown, system fonts + Google Fonts subset), font size (slider + number input), color (picker), bold/italic toggles.
- [ ] AC-71: Advanced text: outline/stroke (color + width), drop shadow (color + offset + blur), letter-spacing (slider), line-height (slider).
- [ ] AC-72: Curved/arched text (text on path): arc slider (-180° to +180°). Preview updates live on canvas. Stored as path data in element.
- [ ] AC-73: ~~Text effects: gradient fill (2-color linear/radial), 3D/emboss (simple CSS-style shadow stack). Applied via effects dropdown in text properties panel.~~ **Deferred to post-MVP**

#### Shapes Tool
- [ ] AC-74: Shape tool dropdown (bottom toolbar): Rectangle, Circle, Triangle, Line. Click+drag on artboard → inserts shape with fill + stroke.
- [ ] AC-75: Shape properties (right sidebar): fill color, stroke color, stroke width. Rectangle: corner radius slider.
- [ ] AC-76: Pen tool (in shapes dropdown): click to add points, click first point to close path. Creates editable vector path. Double-click to finish open path.

#### Brush Tool
- [ ] AC-77: Brush tool active → draw freehand strokes on artboard. Properties: brush size (1-50px slider), color picker. Strokes rendered as Konva Line with tension smoothing.

#### Emoji
- [ ] AC-78: Emoji button → opens native OS emoji picker (`showPicker()` API, fallback: `input` focus trick). Selected emoji rendered as rasterized image layer (canvas `measureText` + `drawText` → toDataURL) on the artboard at center position.

#### Layer Panel
- [ ] AC-79: Right sidebar shows "Layers" section when an artboard is selected. Lists all child elements (images, text, shapes, brush strokes, emojis) with type icon + name/preview.
- [ ] AC-80: Drag-reorder layers in panel → updates z-order on canvas in real-time.
- [ ] AC-81: Eye icon per layer → toggles visibility (sets Konva node `visible`). Lock icon → prevents selection/move/edit (sets `draggable: false` + `listening: false`).
- [ ] AC-82: Click layer in panel → selects corresponding element on canvas. Select element on canvas → highlights corresponding layer in panel. Bidirectional sync.
- [ ] AC-83: Layer data persisted in `board_layout` JSONField (per-artboard `layers` array with type, position, properties). Restored on reload.

### Upload-Ready Status & Drawer Integration

- [ ] AC-84: `Design.status` extended with `listing_ready` choice. Status flow: `pending → approved → listing_ready`. Toggle via `PATCH /api/designs/{id}/` with `{status: "listing_ready"}` or `{status: "approved"}` (reversible).
- [ ] AC-85: "Ready for Upload" toggle button on each approved design in the Design Forge (Artboard Canvas). Only visible on designs with `status=approved` or `status=listing_ready`. Visual: filled icon when ready, outlined when WIP.
- [ ] AC-86: "Mark All Ready" bulk action on project level: `POST /api/designs/projects/{id}/mark-all-ready/` — sets all approved designs in the project to `listing_ready`. Reverse: `POST /api/designs/projects/{id}/unmark-all-ready/`.
- [ ] AC-87: Niche Drawer "Design Projects" section shows individual design thumbnails (not just project card). Each thumbnail has a status badge: green chip "Ready" for `listing_ready`, grey chip "WIP" for `approved`, no badge for `pending/rejected/failed`.
- [ ] AC-88: Niche Drawer project summary shows count: "Bingo Caller Designs — 2 designs (1 ready)".

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
- [ ] AC-28: Cloud Storage Manager: Google Drive + Microsoft OneDrive folder browser, image table with thumbnails, on-demand download, "Use for AI" import into editor, upload processed images back to cloud. Connection management in Settings (central + editor).
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

### Slogan → Design Forge Bulk Flow (PROJ-8 → PROJ-9 Bridge)

#### Slogan Pool (Data Model)
- [ ] AC-89: `DesignProjectIdea` through table: project FK, idea FK, position (ordering), added_at. M2M on `DesignProject.ideas`. A slogan can belong to multiple projects. Existing `Design.idea` FK unchanged (tracks individual design provenance).
- [ ] AC-90: Create project with slogans: `POST /api/designs/projects/` accepts optional `idea_ids: [uuid, ...]`. Creates project AND links slogans in one call.
- [ ] AC-91: Add slogans to existing project: `POST /api/designs/projects/{id}/ideas/` with `{idea_ids: [...]}`. Idempotent — duplicates ignored. Returns updated slogan list.
- [ ] AC-92: Remove slogan from project pool: `DELETE /api/designs/projects/{id}/ideas/{ideaId}/`. Removes link only, idea not deleted.
- [ ] AC-93: Board context includes slogan pool: `GET /api/designs/projects/{id}/board/` response extended with `ideas` array containing per-slogan: id, slogan_text, signal_type, market_confidence, emotional_archetype, pattern_used, why_it_works, niche_name, position, reference_products (from niche research), design_count (how many designs generated from this slogan in this project).

#### Drawer Multi-Select
- [ ] AC-94: CollectedItemsSection (Niche Detail Drawer) gets multi-select: checkboxes on approved slogan chips. "Select All" / "Deselect All" toggle.
- [ ] AC-95: Action bar appears when ≥1 slogan selected: "Forge N Slogans" button. Click opens ProjectNamingDialog with selected slogan IDs.
- [ ] AC-96: ProjectNamingDialog extended with `ideaIds` prop. On "Create new": creates project with slogans attached. On "Add to existing": adds slogans to chosen project's pool. After both: navigates to `/designs/:projectId`.

#### Slogan Pool in RightPanel
- [ ] AC-97: RightPanel "none" state (no artboard selected) shows SloganPoolSection when project has slogans. Lists each slogan as a card with: slogan text (truncated, tooltip full), signal_type badge, market_confidence badge, niche chip, reference product thumbnails (horizontal, max 4 visible), "Auto-Prompt" button, remove (✕) button.
- [ ] AC-98: Each slogan card has a checkbox for bulk selection. "Generate Selected (N)" button appears when ≥1 checked.
- [ ] AC-99: Reference product thumbnails clickable → adds product image as new artboard on canvas.
- [ ] AC-100: Slogan card expandable: reveals why_it_works, emotional_archetype, pattern_used details.

#### Auto-Prompt Generation
- [ ] AC-101: "Auto-Prompt" button on slogan card: calls `GET /api/designs/projects/{id}/ideas/{ideaId}/auto-prompt/` which uses `prompt_builder.build_from_idea()` server-side. Returns `{prompt: string}`. Prompt fills the PromptBar text field. User can edit before clicking Generate.
- [ ] AC-102: Auto-prompt fallback: if slogan has no niche research reference products, prompt is built from slogan metadata only (slogan_text + signal_type + emotional_archetype + pattern_used). No error, just simpler prompt.

#### Bulk Design Generation
- [ ] AC-103: "Generate Selected" button: `POST /api/designs/projects/{id}/bulk-generate/` with `{idea_ids, model, background_color}`. Creates one `DesignGenerationRun` per slogan. Auto-builds prompt per slogan via `prompt_builder.build_from_idea()`. Max 10 slogans per request.
- [ ] AC-104: Each generated design auto-linked to its source idea via `Design.idea` FK. Auto-added to the project via `DesignProjectDesign`.
- [ ] AC-105: Bulk generation progress: skeleton artboards appear on canvas (one per slogan). Each shows the slogan text as artboard label. Progress indicator per slogan card in RightPanel. Artboards fill in as generations complete (existing polling mechanism).
- [ ] AC-106: IdeaCard brush button (Slogan Refinery) now passes `ideaIds=[thisIdeaId]` to ProjectNamingDialog. On create/add, slogan is added to project pool. Same flow as bulk, just with 1 slogan.

#### ProjectPrompt Model + Prompt Persistence
- [ ] AC-107: `ProjectPrompt` model: UUID pk, project FK, prompt_text TextField, sources JSONField (which sources were used: `{slogan: bool, keywords: bool, research: bool, web_research: bool, image: bool}`), source_idea FK (nullable — which slogan this was built from), source_image_url URLField (nullable — reference image used), variant_index IntegerField (default=0 — for multi-variant batches), created_at, updated_at. Workspace isolation.
- [ ] AC-108: `POST /api/designs/projects/{id}/prompts/` — create prompt(s). Body: `{prompts: [{prompt_text, sources, source_idea?, source_image_url?, variant_index?}]}`. Returns created prompt records.
- [ ] AC-109: `PATCH /api/designs/projects/{id}/prompts/{promptId}/` — edit prompt text inline.
- [ ] AC-110: `DELETE /api/designs/projects/{id}/prompts/{promptId}/` — remove prompt.
- [ ] AC-111: `GET /api/designs/projects/{id}/board/` response extended with `prompts` array (all ProjectPrompts for this project, ordered by created_at desc).
- [ ] AC-112: `POST /api/designs/projects/{id}/prompts/{promptId}/generate/` — generate design from a saved prompt. Creates DesignGenerationRun, links to source_idea if present. Same as existing generate but uses a stored prompt. `DesignGenerationRun` gets a `project_prompt` FK (nullable) back-reference so prompt cards can show generated/un-generated status.
- [ ] AC-112b: `ProjectPrompt` tracks generation status via the back-reference: prompt card shows "Generated" badge when a linked `DesignGenerationRun` exists with `status=completed`. "Generate All" (AC-115) filters to prompts without a completed run.

#### RightPanel — Prompts Section (Command Center)
- [ ] AC-113: RightPanel "none" state shows 3 persistent sections: **Slogan Pool** (top), **Prompts** (middle), **Artboards** (bottom). All collapsible.
- [ ] AC-114: Prompts section lists all `ProjectPrompt` records for this project. Each prompt card shows: truncated prompt text (expandable), source tags (Slogan/Keywords/Research/Image as small chips), variant badge if multi-variant, "Generate" button, "Edit" (inline text edit), "Delete" (✕). 
- [ ] AC-115: "Generate All" button below prompt list — generates all un-generated prompts in one batch. Creates skeleton artboards on canvas per prompt.
- [ ] AC-116: Click a prompt card → prompt text loads into PromptBar for editing/generating. PromptBar shows "From saved prompt" indicator.

#### RightPanel — Artboard Context List
- [ ] AC-117: Artboards section lists all artboards in the project with expandable context cards. Each card shows: artboard label/thumbnail, used prompt (truncated), source slogan (if linked via Design.idea), keywords (from Drawer collected keywords for the niche), reference images.
- [ ] AC-118: Click artboard card → selects artboard on canvas + scrolls to it. Bidirectional: selecting artboard on canvas highlights card in list.

#### Prompt Builder Dialog (Multi-Source, mydesigns.io-inspired)
- [ ] AC-119: "✨ Build Prompt" button in PromptBar opens Prompt Builder Dialog. Dialog has source sections (not generic tabs): Slogan, Keywords, AI Niche Research, Web Research, Reference Image. Each section has a toggle (on/off) + preview of available data.
- [ ] AC-120: Slogan section: dropdown to select which slogan from the pool. Preview: slogan text, signal_type, emotional_archetype, pattern_used.
- [ ] AC-121: Keywords section: shows collected keywords from Drawer (for the linked niche). Keywords fetched via `GET /api/niches/{nicheId}/keywords/` (existing keyword_app endpoint). Preview: keyword chips. Toggle to include/exclude. If project has no linked niche → section shows "Link a niche to enable keywords" disabled state.
- [ ] AC-122: AI Niche Research section: shows NicheResearch data (visual_style, graphic_elements, layout_composition, vibe, tone). Toggle to include/exclude. If project has no linked niche or niche has no completed research → section shows "No research data available" disabled state.
- [ ] AC-123: Web Research section: shows PROJ-17 web research results if available. "Not available" state if no web research for this niche. Toggle to include/exclude.
- [ ] AC-124: Reference Image section: upload or select an existing artboard image. If image selected → shows "Analyze" button that triggers Gemini 3 Architect 7-step analysis. Analysis result shown as preview. Toggle to include/exclude.
- [ ] AC-125: Prompt Preview panel at bottom of dialog — live preview of the generated prompt text as user toggles sources on/off. Updates in real-time.
- [ ] AC-126: "Variants" slider (1-5): generates N prompt variants from the same sources with different stylistic approaches. Each variant = a separate `ProjectPrompt` record.
- [ ] AC-127: "Build Prompt(s)" button: calls server-side `prompt_builder` with selected sources → creates `ProjectPrompt` record(s) → prompts appear in RightPanel Prompts section. Dialog closes.
- [ ] AC-128: Prompt Builder also available for Bulk: when multiple slogans selected in Slogan Pool → "Build Prompts for Selected" → Prompt Builder opens → selected sources apply to ALL selected slogans → one prompt per slogan generated → all saved to Prompts section.

#### Prompt Presets
- [ ] AC-129: `PromptPreset` model: UUID pk, workspace FK, name CharField, source_config JSONField (which sources toggled on/off + any fixed parameters), created_by FK, created_at.
- [ ] AC-130: Prompt Builder Dialog has "Preset" dropdown at top — load a saved source configuration. "Save as Preset" button to save current toggles.
- [ ] AC-131: Presets listed as dropdown with search. Default presets: "Full Context" (all sources on), "Slogan Only", "Image Analysis Only".

#### Image → Prompt (Gemini 3 Architect in PromptBar + Context Menu)
- [ ] AC-132: 🖼 "Analyze Image" button in PromptBar (next to "✨ Build Prompt"). When clicked: if an image artboard is selected → triggers Gemini 3 Architect 7-step analysis on that image → result fills PromptBar as editable prompt. If no image artboard selected → opens file picker to upload an image for analysis.
- [ ] AC-133: Right-click context menu on image artboard: "Analyze Image → Generate Prompt" option. Same flow: triggers 7-step analysis → result fills PromptBar.
- [ ] AC-134: Analysis result is also saved as `ProjectPrompt` with `sources: {image: true}` and `source_image_url` set. Persists in RightPanel Prompts section.

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
| POST | `/api/designs/projects/{id}/ideas/` | Member | Add slogans to project pool. Body: `{idea_ids: [...]}`. Idempotent |
| DELETE | `/api/designs/projects/{id}/ideas/{ideaId}/` | Member | Remove slogan from project pool (M2M unlink) |
| GET | `/api/designs/projects/{id}/ideas/{ideaId}/auto-prompt/` | Member | Auto-generate prompt from slogan via `prompt_builder.build_from_idea()` |
| POST | `/api/designs/projects/{id}/bulk-generate/` | Member | Bulk generate: one design per slogan. Body: `{idea_ids, model, bg_color}`. Max 10 |
| POST | `/api/designs/projects/{id}/prompts/` | Member | Save prompt(s). Body: `{prompts: [{prompt_text, sources, source_idea?, variant_index?}]}` |
| PATCH | `/api/designs/projects/{id}/prompts/{promptId}/` | Member | Edit saved prompt text |
| DELETE | `/api/designs/projects/{id}/prompts/{promptId}/` | Member | Delete saved prompt |
| POST | `/api/designs/projects/{id}/prompts/{promptId}/generate/` | Member | Generate design from saved prompt |
| POST | `/api/designs/projects/{id}/build-prompts/` | Member | Prompt Builder: build prompt(s) from sources. Body: `{sources, slogan_id?, image_url?, variants}` |
| GET | `/api/designs/prompt-presets/` | Member | List prompt presets for workspace |
| POST | `/api/designs/prompt-presets/` | Member | Save new prompt preset. Body: `{name, source_config}` |
| DELETE | `/api/designs/prompt-presets/{id}/` | Member | Delete prompt preset |

---

## Supported Models (via OpenRouter)

### Legacy Models (existing DB records)
| Key | Model | Use Case |
|-----|-------|----------|
| `gemini_flash` | Google Gemini Flash (image gen) | Fast iteration |
| `gemini_pro` | Google Gemini Pro (image gen) | Higher quality |
| `gpt_image` | OpenAI GPT Image | Creative styles |
| `flux` | Black Forest Labs Flux | Photorealistic |

### New Models (added 2026-04-09, migration 0006)
| Key (full OpenRouter ID) | Frontend Label | Use Case |
|--------------------------|---------------|----------|
| `google/gemini-3.1-flash-preview-image-generation` | Nano Banana 2 | Fast iteration (default) |
| `google/gemini-3-pro-preview-image-generation` | Nano Banana Pro | Higher quality |
| `google/gemini-2.5-flash-preview-image-generation` | Nano Banana | Older Gemini flash |
| `openai/gpt-5-image` | GPT-5 Image | Creative styles |
| `openai/gpt-5-image-mini` | GPT-5 Mini | Budget creative |
| `black-forest-labs/flux-1.1-pro` | Flux 1.1 Pro | Photorealistic |
| `bytedance-seed/seedream-4.5` | Seedream 4.5 | Artistic/stylized |

### Aspect Ratio (added 2026-04-09)
All generate endpoints accept `aspect_ratio` parameter: `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `3:2`, `2:3`. Default: `1:1` (1024x1024).

Image analysis (Gemini 3 Architect pipeline) also uses OpenRouter — same API key, Gemini model variant.

---

## Implementation Status (as of 2026-04-09)

### Completed Phases
| Phase | Description | Status |
|-------|-------------|--------|
| A1–A6 | Design Generation backend + frontend | Done |
| B1–B5 | Post-Processing Editor + Cloud Manager | Done |
| C1–C9 | Canvas Element Manipulation | Done |
| G1–G13 | Design Board features (batch, prompts, slogans, artboards) | Done |
| **H4** | PipelineCard shared component | Done |
| **H5** | Drawer Pipeline Refactor (7 PipelineCards) | Done |
| **H6** | RightPanel Redesign (GenerationZone + AccordionSection) | Done |
| **H7** | Prompt Builder Dialog (8-tab redesign) | Done |
| **H8** | Flow Button Integration | Done |

### New Shared Components (2026-04-09)
- `components/PipelineCard/` — PipelineCard, PipelineCardHeader, SummaryRow, CountValue
- `components/CardOverlay/` — HoverOverlay, ActionPill, ProductImage (shared between Research + Drawer cards)
- `components/FlowButton/` — InlineFlowButton, BulkFlowButton (pipeline navigation)
- `style/constants.ts` — added `SHADOW` tokens (card, cardLight, cardLightMode)

### Backend Changes (2026-04-09)
- 7 new AI model choices (full OpenRouter IDs) + legacy compatibility
- `aspect_ratio` parameter on all generate endpoints
- Migration `0006_expand_model_choices` (model_name max_length 20→64)
- Bugfix: `_load_niche_profile` + `_build_target_niches` filter `research__status='completed'`
- Bugfix: `suggest-niches` excludes archived niches

### Open Items
- [ ] Image-to-Image mode: frontend UI exists (Mode select), backend NOT implemented
- [ ] Preset save/load in Prompt Builder: needs backend persistence (source_config JSONField)
- [ ] Text tool inline editing bug (textarea focus issue, from Phase C)
- [ ] H9: i18n sync + tests + lint pass
- [ ] Old CollectedProductsSection carousel components not yet deleted

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
- [ ] EC-15: Text element with empty string — prevent inserting empty text. Show placeholder "Type here" on creation, remove if user deletes all text and clicks away.
- [ ] EC-16: Shape drag outside artboard bounds — if clipContent enabled, shape is visually clipped. If disabled, shape extends beyond frame (user's choice).
- [ ] EC-17: Pen tool — user closes browser mid-path → discard incomplete path (no save of partial vectors).
- [ ] EC-18: Layer panel with 50+ elements — virtualized list to prevent scroll lag. Group brush strokes into single "Drawing" layer.
- [ ] EC-19: Font loading failure (Google Fonts offline) → fallback to system font stack, show warning.
- [ ] EC-20: Emoji picker not supported (older browsers) → fallback: text input field where user can paste emoji.
- [ ] EC-21: Curved text with extreme arc values → clamp to prevent text overlapping itself.
- [ ] EC-22: Free-transform rotate on image → rotation angle persisted in layer data, restored on reload.
- [ ] EC-23: Toggling `listing_ready` on a non-approved design → action disabled, only approved designs can be marked ready.
- [ ] EC-24: "Mark All Ready" on project with no approved designs → snackbar info "No approved designs to mark".
- [ ] EC-25: Design marked `listing_ready` then rejected → status resets to `rejected`, loses ready state.

### Slogan → Design Forge Bulk Flow
- [ ] EC-26: Slogan deleted from idea_app after added to project pool → CASCADE removes `DesignProjectIdea`. Frontend refreshes pool list. Already-generated designs from that slogan remain (Design.idea set to null via SET_NULL).
- [ ] EC-27: Same slogan added to multiple projects → allowed by M2M. Each project has its own pool entry.
- [ ] EC-28: Bulk generate with > 10 slogans → API returns 400 "Maximum 10 slogans per bulk request". Frontend disables "Generate Selected" button when selection > 10.
- [ ] EC-29: Auto-prompt for slogan with no niche research (no reference products) → fallback prompt built from slogan metadata only (slogan_text, signal_type, emotional_archetype, pattern_used). No error shown.
- [ ] EC-30: Existing `?ideaId=` URL param → backward-compatible. idea_context still returned by API. Additionally, slogan is auto-added to project pool if not already there.
- [ ] EC-31: Drawer "Forge N Slogans" with only pending/rejected slogans selected → action bar hidden (only approved slogans selectable).
- [ ] EC-32: Bulk generate while previous generation still running → new runs queued. Multiple skeleton artboards can be in-progress simultaneously.
- [ ] EC-33: ProjectNamingDialog "Add to existing project" with slogans already in that pool → idempotent, duplicates ignored, no error.

### Prompt Builder + Persistence
- [ ] EC-34: Prompt Builder with no sources toggled on → "Build Prompt" button disabled. Minimum 1 source required.
- [ ] EC-35: Prompt Builder with "Web Research" toggled on but no PROJ-17 data available → section shows "No web research data for this niche. Run Deep Web Search first." Toggle disabled.
- [ ] EC-36: Reference Image analysis fails (403/malformed) → fallback: prompt built from other sources only. Error toast shown.
- [ ] EC-37: Generate from saved ProjectPrompt that was already generated → allowed (creates new design, not duplicate). User may want to re-generate with different model.
- [ ] EC-38: Delete a ProjectPrompt that has generated designs → prompt deleted, designs remain (no cascade). Design still has prompt_used in DesignGenerationRun.
- [ ] EC-39: Prompt variants (5 requested) → all 5 saved as ProjectPrompt with variant_index 0-4. Each independently editable/deletable.
- [ ] EC-40: Prompt Preset deleted → prompts already generated from that preset unaffected. Preset is just a config template.
- [ ] EC-41: RightPanel Artboards section with 50+ artboards → virtualized list or "Show more" pagination to prevent scroll lag.
- [ ] EC-42: Prompt Builder opened while PromptBar has manually typed text → dialog does NOT clear PromptBar. "Build Prompt" result replaces PromptBar text (user can undo via Cmd+Z in the text field).
- [ ] EC-43: Prompt Builder for project without linked niche → Keywords, AI Research, Web Research sections show disabled state "Link a niche to enable". Only Slogan (from pool) and Reference Image remain usable.
- [ ] EC-44: `build-prompts` endpoint called with `sources.keywords=true` but niche has 0 keywords → prompt built without keyword context. No error, just simpler prompt.

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
│   │   ├── GenerationZone.tsx           # Sticky generation controls (model, bg, mode, sliders, prompt, generate)
│   │   ├── RightPanel.tsx              # Always-visible right panel (383px) — GenerationZone + accordion sections
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
│   │   ├── CloudManagerDialog.tsx       # Google Drive + OneDrive folder browser, image table, upload
│   │   └── CloudStorageSettings.tsx    # Connection management (reused in central + editor settings)
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
| `@fontsource/*` or Google Fonts API | Font loading for text tool |

---

### G) Canvas Element Manipulation — Tech Design

> Added: 2026-04-05 | Covers AC-65 to AC-83, User Stories 35-53

#### Data Model — Canvas Elements

Each artboard has a `layers` array in `board_layout`. Every element on the artboard is a layer:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique element ID |
| `type` | enum | `'image' \| 'text' \| 'shape' \| 'brush' \| 'emoji'` |
| `x, y` | number | Position relative to artboard origin |
| `width, height` | number | Bounding box |
| `rotation` | number | Degrees (0-360) |
| `scaleX, scaleY` | number | Scale factors (default 1) |
| `opacity` | number | 0-100 |
| `visible` | boolean | Layer visibility |
| `locked` | boolean | Prevents selection/editing |
| `zIndex` | number | Render order (higher = front) |

**Type-specific properties (stored in `props` object):**

| Element Type | Properties |
|-------------|------------|
| **image** | `src` (URL), `cropRect?` |
| **text** | `text`, `fontFamily`, `fontSize`, `fontStyle` (bold/italic), `fill`, `stroke`, `strokeWidth`, `shadowColor`, `shadowOffsetX/Y`, `shadowBlur`, `letterSpacing`, `lineHeight`, `arcAngle` (curved text, 0 = straight), `gradientFill?` (start/end color + type) |
| **shape** | `shapeType` (rect/ellipse/triangle/line), `fill`, `stroke`, `strokeWidth`, `cornerRadius?`, `points?` (for line/pen paths) |
| **brush** | `points` (array of x,y coordinates), `strokeColor`, `strokeWidth`, `tension` (smoothing) |
| **emoji** | `emoji` (character), `src` (rasterized data URL) |

#### Persistence

All layer data stored in `board_layout.nodes[].layers` JSONField — same save mechanism as artboard properties (debounced `persistLayout`). No backend model changes needed.

```
board_layout: {
  nodes: [
    {
      id, x, y, label, width, height, backgroundColor, opacity, clipContent,
      layers: [ { id, type, x, y, ... props } ]
    }
  ],
  edges: [...]
}
```

#### Component Tree (New/Modified)

```
ArtboardCanvas (existing)
├── Artboard (modified — renders child layers)
│   ├── BackgroundRect (existing)
│   ├── ContentGroup (existing — add layer rendering here)
│   │   ├── ImageLayer          ← NEW: selectable/transformable image
│   │   ├── TextLayer           ← NEW: editable text with rich props
│   │   ├── ShapeLayer          ← NEW: rect/ellipse/triangle/line/pen path
│   │   ├── BrushLayer          ← NEW: freehand stroke
│   │   └── EmojiLayer          ← NEW: rasterized emoji image
│   ├── SelectionBorder (existing)
│   └── ResizeHandles (existing)
│
RightPanel (modified)
├── PanelArtboardState (modified — add Layer Panel section)
│   ├── Name / Size / Layer / Color / ClipContent (existing)
│   └── LayerPanel              ← NEW: layer list with reorder/visibility/lock
├── PanelElementState           ← NEW: properties for selected element
│   ├── TextProperties          ← NEW: font, size, color, effects
│   ├── ShapeProperties         ← NEW: fill, stroke, corner radius
│   └── BrushProperties         ← NEW: stroke width, color
│
BottomToolbar (existing — wire tool handlers)
```

#### Hooks (New)

| Hook | Purpose |
|------|---------|
| `useCanvasElements` | CRUD for layers within selected artboard. Add/remove/update/reorder elements. Integrates with undo/redo |
| `useDrawingHandlers` | Mouse event handlers for shape/brush/text drawing. Dispatches to useCanvasElements |
| `useElementSelection` | Track which element within an artboard is selected. Double-click = free-transform mode |
| `useTextEditing` | Inline text editing (cursor, selection, keyboard input). Konva textarea overlay |
| `usePenTool` | Point-by-point path creation for custom vector shapes |

#### Tech Decisions

| Decision | Why |
|----------|-----|
| Layers in JSONField (not DB) | Canvas elements are ephemeral design state, not business entities. No query/filter needs. Keeps API simple |
| Konva Transformer for free-transform | Built-in Konva component handles resize/rotate handles with aspect lock. No custom math needed |
| Text as Konva.Text + HTML overlay for editing | Konva.Text renders on canvas. Double-click opens positioned HTML textarea for actual editing (cursor/selection). Standard Konva pattern |
| Pen tool as Konva.Line with points array | Simple data model, smoothing via tension param. No complex SVG path parsing |
| Emoji rasterized to image | Ensures cross-platform consistency. OS emoji picker → canvas drawText → toDataURL → Image layer |
| Google Fonts via CSS injection | Load font CSS on demand when user selects font. No npm package per font |

---

### H) Slogan → Design Forge Bulk Flow — Tech Design

> Added: 2026-04-07 | Covers AC-89 to AC-106, User Stories 54-59

#### Data Model — DesignProjectIdea

New through table linking projects to their slogan pool:

| Field | Type | Description |
|-------|------|-------------|
| `project` | FK → DesignProject | CASCADE |
| `idea` | FK → idea_app.Idea | CASCADE |
| `position` | IntegerField (default=0) | Order in pool |
| `added_at` | DateTimeField (auto_now_add) | When added |

- `unique_together: (project, idea)`
- `DesignProject.ideas` M2M via through table
- Existing `Design.idea` FK unchanged — tracks per-design provenance
- File: `django-app/design_app/models.py`

#### API Endpoints

| Method | Endpoint | Behavior |
|--------|----------|----------|
| POST | `/api/designs/projects/` | Extended: accepts optional `idea_ids` on create |
| POST | `/api/designs/projects/{id}/ideas/` | Add slogans to pool. Idempotent |
| DELETE | `/api/designs/projects/{id}/ideas/{ideaId}/` | Remove from pool (M2M unlink) |
| GET | `/api/designs/projects/{id}/board/` | Extended: response includes `ideas` array |
| GET | `/api/designs/projects/{id}/ideas/{ideaId}/auto-prompt/` | Returns `{prompt}` via `prompt_builder.build_from_idea()` |
| POST | `/api/designs/projects/{id}/bulk-generate/` | One run per idea. Max 10. Body: `{idea_ids, model, bg_color}` |

#### Component Tree (New/Modified)

```
CollectedItemsSection (modified — add multi-select + action bar)
├── Checkbox per approved slogan chip
├── "Select All / Deselect All" toggle
└── ActionBar (visible when selection > 0)
    └── "Forge N Slogans" button → ProjectNamingDialog

ProjectNamingDialog (modified — accepts ideaIds prop)
├── On create: POST /projects/ with idea_ids
└── On existing: POST /projects/{id}/ideas/ with idea_ids

PanelNoneState (modified — renders SloganPoolSection)
│
SloganPoolSection (NEW)
├── Slogan list header with count
├── SloganPoolCard (NEW, per slogan)
│   ├── Checkbox (bulk select)
│   ├── Slogan text (truncated + tooltip)
│   ├── Badges: signal_type, market_confidence
│   ├── Niche chip
│   ├── Reference product thumbnails (horizontal, max 4)
│   │   └── Click → add as reference artboard on canvas
│   ├── "Auto-Prompt" button → fills PromptBar
│   ├── Remove (✕) button
│   └── Expandable: why_it_works, emotional_archetype, pattern_used
└── "Generate Selected (N)" button

DesignWorkspaceView (modified — reads boardData.ideas, passes to RightPanel)

PromptBar (modified — accepts onAutoPromptFill callback)

IdeaCard (modified — passes ideaIds=[thisIdeaId] to ProjectNamingDialog)
```

#### Tech Decisions

| Decision | Why |
|----------|-----|
| M2M through table (not JSONField) | Referential integrity, queryable from both sides, CASCADE on idea delete, supports ordering |
| Auto-prompt server-side | `prompt_builder.build_from_idea()` already exists. Needs niche research data only available on server |
| Dedicated bulk-generate endpoint | Reduces HTTP overhead vs N sequential calls. Backend can batch-fetch ideas + references |
| Slogan pool embedded in board response | Avoids extra roundtrip on page load. Pool always needed when board loads |
| Selection state as local React state | Ephemeral — resets when drawer closes or page navigates. No Redux needed |
| Max 10 per bulk request | Prevents overwhelming the generation queue. User can generate in batches |

#### Dependencies (No new packages)

All required packages already installed. Uses existing RTK Query, MUI, Konva.js infrastructure.

---

### I) Prompt Builder + Persistence + Image→Prompt — Tech Design

> Added: 2026-04-07 | Covers AC-107 to AC-134, User Stories 60-66

#### Data Models

**ProjectPrompt** — saved prompt for a project (not ephemeral):

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID pk | Auto-generated |
| `project` | FK → DesignProject | CASCADE |
| `prompt_text` | TextField | The generated/edited prompt text |
| `sources` | JSONField | `{slogan: bool, keywords: bool, research: bool, web_research: bool, image: bool}` |
| `source_idea` | FK → Idea (nullable) | Which slogan this prompt was built from |
| `source_image_url` | URLField (nullable) | Reference image used for image analysis |
| `variant_index` | IntegerField (default=0) | For multi-variant batches (0-4) |
| `created_at` | DateTimeField | Auto |
| `updated_at` | DateTimeField | Auto |

**PromptPreset** — saved source configuration template:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID pk | Auto-generated |
| `workspace` | FK → Workspace | CASCADE |
| `name` | CharField (max 100) | User-given name |
| `source_config` | JSONField | `{slogan: bool, keywords: bool, ...}` |
| `created_by` | FK → User | CASCADE |
| `created_at` | DateTimeField | Auto |

**DesignGenerationRun modification:**

| Field | Type | Description |
|-------|------|-------------|
| `project_prompt` | FK → ProjectPrompt (nullable) | SET_NULL. Back-reference: which saved prompt generated this run |

#### API Endpoints (G9-G14)

| Method | Endpoint | Behavior |
|--------|----------|----------|
| POST | `/api/designs/projects/{id}/prompts/` | Bulk create prompts. Body: `{prompts: [...]}` |
| PATCH | `/api/designs/projects/{id}/prompts/{promptId}/` | Edit prompt text |
| DELETE | `/api/designs/projects/{id}/prompts/{promptId}/` | Delete prompt (designs remain) |
| POST | `/api/designs/projects/{id}/prompts/{promptId}/generate/` | Generate design from saved prompt |
| POST | `/api/designs/projects/{id}/build-prompts/` | Prompt Builder: sources → prompt text(s). Server gathers data |
| GET | `/api/designs/prompt-presets/` | List workspace presets |
| POST | `/api/designs/prompt-presets/` | Create preset |
| DELETE | `/api/designs/prompt-presets/{id}/` | Delete preset |

#### Component Tree (G9-G14)

```
PanelNoneState (refactored — 3 collapsible sections)
├── SloganPoolSection (existing from Phase H)
│
├── PromptListSection (NEW)
│   ├── PromptCard (NEW, per prompt)
│   │   ├── Truncated text (expandable)
│   │   ├── Source chips (Slogan/Keywords/Research/Image)
│   │   ├── "Generated" badge (green) or "Generate" button
│   │   ├── "Edit" inline edit
│   │   └── "Delete" (✕)
│   └── "Generate All" button (un-generated only)
│
└── ArtboardListSection (NEW)
    └── ArtboardContextCard (NEW, per artboard)
        ├── Thumbnail + label
        └── Expandable: prompt, slogan, keywords, ref images

PromptBuilderDialog (NEW — board/partials/)
├── Preset dropdown + "Save as Preset"
├── Source sections (each toggle + preview):
│   ├── Slogan (dropdown from pool)
│   ├── Keywords (from keyword_app API, disabled if no niche)
│   ├── AI Research (from NicheResearch, disabled if no niche/research)
│   ├── Web Research (from PROJ-17, disabled if unavailable)
│   └── Reference Image (upload or select artboard, "Analyze" button)
├── Prompt Preview (live-updating)
├── Variants slider (1-5)
└── "Build Prompt(s)" button

PromptBar (modified)
├── "✨ Build Prompt" button → opens PromptBuilderDialog
├── "🖼 Analyze Image" button → Gemini 3 analysis
└── "From saved prompt" indicator
```

#### Data Flow

```
Prompt Builder Dialog → POST /build-prompts/ (server builds text)
                      → returns prompt text(s)
                      → frontend saves via POST /prompts/
                      → RightPanel PromptListSection updates (RTK Query invalidation)

Generate from Prompt  → POST /prompts/{id}/generate/
                      → creates DesignGenerationRun (linked to ProjectPrompt)
                      → skeleton artboard on canvas
                      → polling → artboard fills in

Image Analysis        → POST /designs/{id}/analyze-image/ (existing)
                      → result → auto-save as ProjectPrompt
                      → fills PromptBar
```

#### Tech Decisions

| Decision | Why |
|----------|-----|
| `ProjectPrompt` as DB model (not JSONField) | CRUD, searchable, survives across sessions. Backend can track generation status via FK |
| `project_prompt` FK on DesignGenerationRun | Enables "generated/un-generated" badge on prompt cards without extra queries |
| Keywords fetched server-side in `build-prompts` | `keyword_app` data is in DB, not on client. Server gathers all source data in one call |
| Prompt Builder does NOT auto-save | User may want to see the preview first, edit, then explicitly save. Frontend saves via separate POST |
| 3 default presets seeded | Reduces friction for new users. Can be deleted/modified |
| Prompt Preview is server-rendered | Live preview calls `build-prompts` on each toggle change (debounced 500ms). Ensures preview matches final output exactly |

---

### QA Report: Phase C — Canvas Element Manipulation
> Date: 2026-04-03 | Tester: QA Bot (Claude Opus 4.6)

#### 1. TypeScript Status

**PASS** — `npx tsc --noEmit` exits cleanly with zero errors. All Phase C files compile without type errors.

#### 2. Lint Status

**13 errors, 5 warnings total** across the project. Phase C specific:

| File | Rule | Severity | Classification |
|------|------|----------|----------------|
| `hooks/usePenTool.ts:77` | `react-hooks/set-state-in-effect` | error | **NEW (Phase C)** |
| `hooks/usePenTool.ts:82` | unused eslint-disable directive | warning | **NEW (Phase C)** |
| `partials/ArtboardCanvas.tsx:147` | `no-unused-vars` (`hasContent`) | error | **NEW (Phase C)** |
| `partials/ArtboardCanvas.tsx:290` | `no-unused-vars` (`openFilePicker`) | error | **NEW (Phase C)** |
| `partials/ArtboardElement.tsx:48` | `react-hooks/set-state-in-effect` | error | **NEW (Phase C)** |
| `partials/layers/ImageLayer.tsx:48` | `react-hooks/set-state-in-effect` | error | **NEW (Phase C)** |

Pre-existing (not Phase C):
- `usePolling.ts` (PROJ-7): 2 errors (ref access during render)
- `useArtboards.ts` (Phase B): 1 error (setState in effect)
- `EditorCanvas.tsx`: 1 error (ref immutability)
- `DesignWorkspaceView.tsx`: 2 errors (unused vars)
- `ProcessingSettingsDialog.tsx`: 1 error (setState in effect)
- `ProjectGalleryView.tsx`, `IdeaListView.tsx`, `useBoardData.ts`, `CommentInput.tsx`: 4 warnings (useMemo deps)

**Summary: 6 new Phase C lint issues (4 errors, 1 warning, 1 error in ArtboardElement).**

#### 3. File Structure Review

**All 19 files exist.** Structure follows project conventions (hooks/, partials/layers/, partials/rightPanel/, utils/).

Import from `../partials/BottomToolbar` for `CanvasTool` type in 3 hooks is a minor coupling concern (hooks importing from partials). Consider extracting `CanvasTool` type to `types/index.ts`. No circular dependencies detected.

#### 4. Line Count Compliance

| File | Lines | Status |
|------|-------|--------|
| `types/index.ts` | 351 | **FAIL (>300)** |
| `hooks/useCanvasElements.ts` | 320 | **FAIL (>300)** |
| `hooks/useElementSelection.ts` | 80 | PASS |
| `hooks/useTextEditing.ts` | 215 | PASS |
| `hooks/useDrawingHandlers.ts` | 173 | PASS |
| `hooks/usePenTool.ts` | 206 | PASS |
| `hooks/useBrushTool.ts` | 155 | PASS |
| `hooks/useEmojiPicker.ts` | 84 | PASS |
| `partials/layers/ImageLayer.tsx` | 192 | PASS |
| `partials/layers/TextLayer.tsx` | 185 | PASS |
| `partials/layers/ShapeLayer.tsx` | 233 | PASS |
| `partials/layers/BrushLayer.tsx` | 158 | PASS |
| `partials/layers/EmojiLayer.tsx` | 186 | PASS |
| `partials/rightPanel/LayerPanel.tsx` | 364 | **FAIL (>300)** |
| `partials/rightPanel/PanelElementState.tsx` | 392 | **FAIL (>300)** |
| `partials/rightPanel/TextProperties.tsx` | 414 | **FAIL (>300)** |
| `partials/rightPanel/ShapeProperties.tsx` | 195 | PASS |
| `partials/rightPanel/BrushProperties.tsx` | 158 | PASS |
| `utils/rasterizeEmoji.ts` | 26 | PASS |

**5 of 19 files exceed the 300-line limit.** TextProperties.tsx is the worst at 414 lines.

#### 5. Acceptance Criteria Coverage

| AC | Description | Status | Notes |
|----|-------------|--------|-------|
| AC-65 | Click image inside artboard selects as layer, resize handles on image | **PASS** | ImageLayer renders Transformer on selection, `e.cancelBubble = true` prevents artboard selection |
| AC-66 | Image scaling defaults to aspect-ratio-locked, Shift to free-scale | **PARTIAL** | `keepRatio={!isFreeTransform}` locks aspect ratio. However, Shift key is not wired — free-scale requires double-click (free-transform mode), not Shift. AC says "Hold Shift to free-scale" |
| AC-67 | Double-click image enters free-transform (rotate). Single click = select only | **PASS** | `useElementSelection` has `enterFreeTransform`/`exitFreeTransform`. Transformer enables rotation only in free-transform |
| AC-68 | All elements belong to parent artboard, move together | **PASS** | Elements stored in `artboard.layers[]`, rendered relative to artboard Group position |
| AC-69 | Text tool click on artboard inserts editable text, Escape deselects | **PASS** | `useTextEditing` creates positioned textarea overlay with blur/Escape/Enter handlers |
| AC-70 | Text properties: font family, font size, color, bold/italic | **PASS** | TextProperties has font dropdown (20 fonts), size input, color picker, bold/italic toggles |
| AC-71 | Advanced text: outline/stroke, drop shadow, letter-spacing, line-height | **PASS** | TextProperties has Outline accordion (color + width), Shadow accordion (color + offset + blur), letter-spacing/line-height sliders |
| AC-72 | Curved/arched text (-180 to +180 arc slider) | **PARTIAL** | TextProperties has arcAngle slider. However, `TextLayer.tsx` does NOT render arc — no TextPath implementation. Comment on line 385: "TODO: arcAngle rendering -- TextPath along computed SVG arc". **UI only, no canvas rendering** |
| AC-73 | Text effects: gradient fill, 3D/emboss | **FAIL** | Not implemented. No gradient fill or 3D/emboss controls in TextProperties |
| AC-74 | Shape tool: Rectangle, Circle, Triangle, Line. Click+drag inserts | **PASS** | `useDrawingHandlers` handles all 4 shapes with click-to-insert and drag-to-draw |
| AC-75 | Shape properties: fill, stroke, stroke width, corner radius for rect | **PASS** | ShapeProperties renders fill/stroke/strokeWidth. Corner radius slider for rect only |
| AC-76 | Pen tool: click to add points, click first to close, double-click finish | **PASS** | `usePenTool` implements close-snap detection (12px), double-click finish, Escape cancel |
| AC-77 | Brush tool: freehand strokes, brush size 1-50px, color picker, tension smoothing | **PASS** | `useBrushTool` + BrushProperties (size 1-50, color, tension/smoothing slider) |
| AC-78 | Emoji picker via OS API, rasterized as image layer | **PASS** | `useEmojiPicker` creates hidden input for OS picker. `rasterizeEmoji` converts emoji to data URL via canvas |
| AC-79 | Layers panel shows child elements with type icon + name | **PASS** | LayerPanel lists layers sorted by zIndex desc with type icons (Image/Text/Shape/Brush/Emoji) |
| AC-80 | Drag-reorder layers updates z-order on canvas | **PASS** | dnd-kit SortableContext with vertical list. `handleDragEnd` calls `onReorderElement` |
| AC-81 | Eye icon toggles visibility, Lock icon prevents selection/move | **PASS** | Visibility/Lock toggle buttons in SortableLayerRow. Locked elements have `draggable: false` in all Layer components |
| AC-82 | Click layer in panel selects on canvas, bidirectional sync | **PASS** | `selectedElementId` prop flows to both LayerPanel and Layer components |
| AC-83 | Layer data persisted in board_layout JSONField | **PASS** | `ArtboardData.layers: CanvasElement[]` included in `BoardLayoutNode.layers`. `useArtboards` hydrates from `savedLayout` |

**Summary: 15 PASS, 2 PARTIAL, 1 FAIL out of 19 ACs.**

#### 6. Security Audit

| Check | Status | Notes |
|-------|--------|-------|
| Hardcoded secrets/tokens | **PASS** | No secrets, API keys, or tokens found |
| XSS vectors | **PASS** | No `innerHTML`, `dangerouslySetInnerHTML`, or `eval()` usage |
| User input sanitization | **PASS** | Text editing uses textarea value (not HTML). Emoji input is filtered (trim check) |
| Hardcoded colors | **WARN** | 20+ instances of hardcoded hex/rgba values. See issues below |

#### 7. Issues Found

**CRITICAL**
- None

**MAJOR**

| # | Issue | File(s) | Priority |
|---|-------|---------|----------|
| M1 | AC-72 curved text has UI slider but NO canvas rendering (TODO comment). Users can change arcAngle but nothing happens visually | `TextLayer.tsx`, `TextProperties.tsx:385` | P1 |
| M2 | AC-66 Shift-to-free-scale not implemented. Free-scale only via double-click (free-transform mode). AC explicitly says "Hold Shift to free-scale" | All Layer components | P2 |
| M3 | AC-73 gradient fill + 3D/emboss text effects not implemented at all | `TextProperties.tsx` | P2 |
| M4 | 5 files exceed 300-line limit (types/index.ts=351, useCanvasElements=320, LayerPanel=364, PanelElementState=392, TextProperties=414) | Multiple | P2 |
| M5 | Module-level `nameCounters` object in `useCanvasElements.ts` is a singleton shared across all hook instances. If multiple boards are open or component re-mounts, counters persist incorrectly and names like "Image 47" appear on first use | `hooks/useCanvasElements.ts:10-16` | P2 |

**MINOR**

| # | Issue | File(s) | Priority |
|---|-------|---------|----------|
| m1 | 6 new lint errors from Phase C (4 `set-state-in-effect`, 2 `no-unused-vars`). Must fix before merge | Multiple | P3 |
| m2 | 20+ hardcoded colors (hex #000000, #FFFFFF, #00C8D7, #FF5A4F, #22D3A3, #4A9EFF, rgba values). Violates "no hardcoded colors" rule. Canvas tool defaults and color picker fallbacks should use design system tokens | Multiple hooks + properties panels | P3 |
| m3 | `CanvasTool` type imported from `partials/BottomToolbar` in 3 hooks. Should be in `types/index.ts` to avoid hooks-to-partials coupling | `usePenTool`, `useBrushTool`, `useDrawingHandlers` | P3 |
| m4 | Duplicate styled components (`Section`, `SectionLabel`, `FieldRow`, `FieldLabel`, `ColorInput`) copy-pasted across TextProperties, ShapeProperties, BrushProperties, PanelElementState. Should be shared | 4 files | P3 |
| m5 | `useTextEditing` manipulates DOM directly (createElement, appendChild, removeChild) instead of using React Portal. Works but fragile — no React lifecycle management for the textarea | `hooks/useTextEditing.ts` | P3 |
| m6 | `usePenTool.ts:82` has an unused eslint-disable comment (the disable was applied but the rule name is wrong — it disables `set-state-in-effect` but the error is still reported on line 77) | `hooks/usePenTool.ts` | P4 |

#### 8. Recommendations

1. **Fix lint errors** (m1) before merge — the 4 `set-state-in-effect` issues can be resolved by moving state resets into cleanup functions or using `useSyncExternalStore` pattern.
2. **Decide on AC-72 and AC-73** — either implement curved text rendering and gradient/3D effects, or explicitly defer them in the spec with a note (currently AC-72 slider exists but does nothing).
3. **Split oversized files** (M4) — extract `SortableLayerRow` from `LayerPanel.tsx`, extract shared styled components, split `TextProperties.tsx` into sub-sections.
4. **Move `nameCounters` into hook state** (M5) — use `useRef` for the counter map to scope it per hook instance.
5. **Extract `CanvasTool` type** to `types/index.ts` (m3).
6. **Address hardcoded colors** (m2) — some are legitimate canvas defaults (shape fills), but the textarea border `#4A9EFF` and background `rgba(0,0,0,0.7)` in `useTextEditing` should use theme tokens.

---

### I) Frontend Redesign — Tech Design (2026-04-09)

> Covers FD-0 through FD-5 from `/frontend-design` session. Frontend-only — no backend changes. No new API endpoints. No model changes.

#### What Gets Rebuilt vs. Refactored

| Component | Action | Lines Affected |
|-----------|--------|---------------|
| `CollectedProductsSection.tsx` (417 lines) | **Rebuild** → `ProductsGrid.tsx` inside PipelineCard | Replace carousel with grid + hover overlay |
| `DrawerResearchSection.tsx` (337 lines) | **Refactor** → extract into PipelineCard wrapper | Keep research logic, replace Section wrapper |
| `CollectedItemsSection.tsx` (263 lines) | **Refactor** → split slogans into PipelineCard, keywords into PipelineCard | Add Flow Buttons per slogan |
| `DrawerDesignsSection.tsx` (177 lines) | **Refactor** → PipelineCard wrapper + Flow Buttons | Add project thumbnails + [📋→] buttons |
| `NicheDetailDrawer.tsx` (196 lines) | **Refactor** → render PipelineCards instead of individual sections | Niche header stays, sections become cards |
| `PromptBar.tsx` (350 lines) | **Remove** → merge into RightPanel | Generation controls move to RightPanel |
| `RightPanel.tsx` (202 lines) | **Rebuild** → Generation Zone + Accordion Zone | Dream AI-style prompt center |
| `PanelNoneState.tsx` (184 lines) | **Rebuild** → part of new RightPanel | Sections become Accordions |
| `PromptBuilderDialog.tsx` (579 lines) | **Rebuild** → 8-tab tabbed dialog | MyDesigns-style tabs with POD data sources |
| `usePromptBuilder.ts` (282 lines) | **Refactor** → adapt for 8-tab structure | Add tab state, per-field checkboxes for Context tab |
| `IdeaCard.tsx` (474 lines) | **Minor** → swap brush icon for FlowButton | Use shared InlineFlowButton component |

#### New Components (to create)

```
components/
├── FlowButton/
│   ├── InlineFlowButton.tsx        ← 28px icon button, target-colored
│   ├── BulkFlowButton.tsx          ← outlined full-width button
│   └── constants.ts                ← FLOW_TARGETS color/icon mapping
│
├── PipelineCard/
│   ├── PipelineCard.tsx            ← glassmorphism card, stripe, expand/collapse
│   ├── PipelineCardHeader.tsx      ← icon + title + badge + chevron
│   └── types.ts                    ← PipelineCardState enum, PipelineCardProps
│
assets/
└── icons/
    ├── ResearchIcon.tsx            ← custom SVG for 🔬
    ├── KeywordsIcon.tsx            ← custom SVG for 🔑
    ├── ProductsIcon.tsx            ← custom SVG for ❤️
    ├── SlogansIcon.tsx             ← custom SVG for 💡
    ├── DesignsIcon.tsx             ← custom SVG for 🎨
    ├── ListingsIcon.tsx            ← custom SVG for 📋
    ├── UploadIcon.tsx              ← custom SVG for 📤
    └── index.ts                    ← barrel export

views/niches/list/partials/
├── ProductsGrid.tsx                ← replaces CollectedProductsSection carousel
└── ProductThumbnailCard.tsx        ← single product card with hover overlay

views/designs/board/partials/
├── GenerationZone.tsx              ← sticky prompt controls (was PromptBar)
├── ParallelPromptsRow.tsx          ← switch + icon buttons
├── AccordionSection.tsx            ← shared accordion pattern
├── PromptBuilderDialog.tsx         ← REBUILT: 8 tabs
└── promptBuilder/
    ├── ConceptTab.tsx
    ├── ContextTab.tsx              ← unique: keyword chips, research checkboxes, product grid
    ├── StyleTab.tsx
    ├── FormatTab.tsx
    ├── ColorTab.tsx
    ├── BackgroundTab.tsx
    ├── TextTab.tsx
    └── OutputTab.tsx
```

#### Tech Decisions (new)

| Decision | Why |
|----------|-----|
| `PipelineCard` as shared component in `components/` | Reused 7× in drawer — one component, different content per card. Not feature-local |
| `FlowButton` as shared component in `components/` | Used across drawer, SloganGen, Canvas, Listings. Must be consistent everywhere |
| Custom SVG icons in `assets/icons/` | Pipeline steps need distinctive icons. Emoji placeholders not production-quality. MUI has no POD-specific icons |
| PromptBar removed, not hidden | Generation controls are ONLY in RightPanel now. No duplicate state. PromptBar hooks merged into RightPanel hooks |
| Prompt Builder 8 tabs as separate files | Each tab is 80-150 lines. One file would be 800+ lines. Single Responsibility |
| Context tab per-field checkboxes | User requested granular control — not all research fields are relevant for every prompt. Master checkbox for quick toggle-all |
| No new RTK Query endpoints | All data already fetched by existing queries (board, projects, keywords, research). No backend changes needed |

#### Dependencies (no new packages)

All required packages already installed: `@mui/material`, `react-konva`, `@dnd-kit/*`. No new npm installs needed for this redesign.
