# PROJ-34: Design-Forge Prompt Engineering & Multi-Prompt Builder

## Status: Planned
**Created:** 2026-05-17
**Last Updated:** 2026-05-17

## Dependencies
- PROJ-9 (Design Generation) — provides the OpenRouter image-gen pipeline this feature wraps
- PROJ-6 (Niche Deep Research) — supplies niche style hints that get implicitly mixed into every Builder-generated prompt
- PROJ-8 (Idea & Slogan Generation) — supplies the `ProjectIdea` slogan pool that feeds the Builder's slogan multi-select

## User Stories

> Persona: **POD seller** generating MBA-ready designs in batches. Knows that t-shirt mockups are useless on Amazon — they need clean isolated designs (PNG with a flat background, no fabric, no person wearing it). Generates 10–50 designs per niche per week.

- **As a POD seller using the Generate button**, I want every single image-generation call to Gemini to be prefixed with strict design-only rules (no t-shirt substrate, no model wearing the shirt, no mockup framing) — encoded as a `role: system` message that I never see and cannot accidentally override — so the model defaults to producing print-ready isolated artwork even when my own typed prompt forgets to mention it. This kills the bug where Gemini regenerated a full t-shirt mockup when I asked it to "remix this".

- **As a POD seller picking a background color** in the Generation-panel's color dropdown (`light_gray` / `neon_pink` / `neon_green`), I want that selection to actually arrive at Gemini as a literal `Background: solid #HEX, saturated, no gradients, flat single color background` instruction. Today the value is silently dropped by `StandaloneGenerateView` and only retroactively guessed from the prompt text via `_get_bg_from_prompt(prompt)` — meaning my UI choice is a placebo. I waste credits regenerating to fix the bg I already selected.

- **As a POD seller working on one niche** (e.g. "school bus driver"), I want to open the Prompt Builder once, multi-select N slogans from the `ProjectIdea` pool of that project AND add additional free-text slogans (one per line), AND pick M visual styles from the curated style library, AND optionally pick one text-warp, AND click `Build` → see exactly N×M ready-to-fire prompts auto-inserted into the prompt textarea (joined by `;`), with the `Parallel Prompts` toggle auto-flipped to ON. Pressing Generate then fires N×M parallel image-gen runs. This replaces today's "type one prompt, click Generate, wait, repeat 15×" loop.

- **As a POD seller picking a style**, I want the style picker to show me **exactly 15 POD-relevant styles** as a vertical list of small cards (left: 56×56 thumbnail showing how a sample taco mascot looks in that style, right: style name + 1-line description). Click anywhere on a row toggles selection; selected styles appear as removable MUI Chips above the list. I'm tired of typing `"make this design vaporwave style"` and not knowing what vaporwave actually looks like in this generator — the 15-tile visual library is the whole library; no nested "More" modal.

- **As a POD seller using the Prompt Builder**, I want the N×M prompts the Builder writes into the textarea to be **automatically polished** by a small, cheap LLM (`google/gemini-3.1-flash-lite`) — grammar tightened, redundancies removed, every concrete detail preserved — *before* they land in the textarea, so the prompts I send to Gemini are well-structured even when my Architect-template-filling produces slightly clunky sentences. **This polish runs ONLY for Builder-generated prompts** — anything I freehand-type into the textarea myself goes through untouched. I want one workspace-level Toggle "Auto-polish Builder prompts" (default ON) to disable this if I'm cost-paranoid.

- **As a POD seller analyzing a competitor's product photo** as a design source, I want to keep using the existing `Analyze image` button (lupe icon under the prompt textarea) — but I want the underlying `image_analyzer.py` SYSTEM_PROMPT replaced 1:1 with my full "Gemini 3 Architect" framework (9 critical rules + 7-step framework + mandatory final-prompt template, all from `docs/design-prompts/knowledge.md`). The button + 7-step JSON contract already exist and work — only the system prompt text needs upgrading. After upgrade, the `final_prompt` field that fills my textarea should be as dense and structured as the Philip Anders reference examples (specific color-object binding, font-physicality, breathing-room instructions, etc). **Important: this is a button-triggered, user-initiated extraction — Gemini does NOT auto-extract design DNA on every Edit/Remix call.**

- **As a POD seller in single-prompt mode**, when I move the `Images` slider from 1 to e.g. 4, I want 4 seed-varied versions of the same prompt to fire as 4 parallel runs (different `seed` parameter each — or, for models that ignore seed, an appended `"Generate variation N of 4"` hint). When I'm in multi-prompt mode (Builder used, ≥2 `;`-separated prompts in textarea), the slider is **disabled** with tooltip `Locked to 1 while multi-prompt is active` — because 15 prompts × 4 variants = 60 calls is too expensive for one click.

- **As a POD seller running repeat-niche batches**, I want to save my Builder configuration (selected slogans + selected styles + warp + bg-color) as a **named Preset per project** (e.g. "School Bus Set v1") via a `Save as Preset` button → text input → Save. Next week when I come back to the same project, I pick the preset from a dropdown above the Builder, the form auto-populates, I tweak 1–2 slogans, click Build, done. Preset CRUD is per-project, presets are not shared across projects.

- **As a POD seller working inside a project linked to a niche** (`project.niche`), I want a single **toggle in the Prompt Builder** — `Include niche style context` — that decides whether the niche's research output from PROJ-6 (`visual_styles`, `vibes`, `tones`, top 3 each) gets mixed into the Builder-generated prompts. When ON, the research data is appended as a parenthetical context block to every prompt the Builder creates that session. When OFF, prompts are generated from slogans + styles only. This lets me opt-in to niche-coherence when I want it, but opt-out for one-off experiments. If the linked niche has no research yet, the toggle is disabled with tooltip `No niche research data yet — run PROJ-6 first`.

- **As a POD seller picking text shape**, I want a single optional `Text Warp` dropdown in the Builder with the 4 options from `docs/design-prompts/knowledge.md`: `Arc Lower` (banner with curved bottom), `Concave Squeeze` (bowtie / hourglass), `Bulge` (football / convex), `Flag Wave` (sinuous flag motion). The selected warp gets translated into the matching prompt phrase (e.g. `"The text uses an 'Arc Lower' warp: the headline remains straight at the top but arches downwards at the bottom to frame the illustration"`) and appended to every prompt the Builder generates in that session.

- **As a POD seller** familiar with today's overstuffed Prompt-Builder dialog, I want the simplified Builder to **remove** the toggles I never use: `web_research`, `keywords`, and the 5-way `variant_index` (which produced "bold/vintage/minimal/hand-drawn" stylistic noise). Niche-research data stays — but moves to implicit-injection (above). Builder UI is reduced to Slogans + Styles + Warp + Reference + Save/Load Preset.

- **As a POD seller**, before the Builder inserts prompts into the textarea, I want to see a **live count** `Will generate {N×M} prompts` next to the Build button. If N×M > 20, clicking Build opens a confirmation modal `About to generate {N×M} prompts — continue?` so I don't accidentally fire 50 image-gen calls because I forgot I had 10 styles selected.

## Acceptance Criteria

### Schicht 1 — System Prompt (Hard Rules, always-on)
- [ ] AC-1: A `DESIGN_GEN_SYSTEM_PROMPT` constant in `design_app/services/image_generator.py` encodes the 9 Architect Critical Rules from `docs/design-prompts/knowledge.md` + the "design-only / no t-shirt / no mockup / no person wearing it" hard rule + the BG-color enforcement rule + Tech-Specs (`screen print ready`, `hard edges`, `no gradients/noise`, `vector sharpness`, `300 DPI`).
- [ ] AC-2: `generate_image()` always sends this constant as a `role: system` message before the user message — verified by inspecting the payload via Langfuse trace AND by a unit test that asserts the payload structure.
- [ ] AC-3: For any model that rejects `role: system` (none today, but future-proofing), the same constant is prepended as a wrapper at the start of the user message — toggled by a per-model flag in `MODEL_MAP`.

### Schicht 2 — Background-Color Persistence (kills Bug A)
- [ ] AC-4: `DesignGenerationRun` model gains a `background_color` CharField with choices `Design.BackgroundColor`, defaulting to `light_gray`. Migration created and applied.
- [ ] AC-5: `StandaloneGenerateView` AND `GenerateFromPromptView` AND `IdeaGenerateView` write `serializer.validated_data['background_color']` onto the Run.
- [ ] AC-6: `task_generate_design` reads `run.background_color` and passes it as a parameter to `generate_image()`.
- [ ] AC-7: `generate_image()` appends `Background: solid {HEX}, saturated, no gradients, flat single color background` to the final user prompt (using `Design.BG_COLOR_HEX[run.background_color]` for the hex value).
- [ ] AC-8: The post-hoc derivation `_get_bg_from_prompt(prompt)` is deleted from `tasks.py`; `Design.background_color` is set from `run.background_color` directly.
- [ ] AC-9: A unit test verifies that selecting `neon_pink` in the UI results in `#FF6EC7` appearing in the OpenRouter payload sent to the worker mock.

### Schicht 3 — Image-Analyzer Upgrade (button-triggered, function exists)
- [ ] AC-10: `design_app/services/image_analyzer.py` `SYSTEM_PROMPT` is replaced 1:1 with the full "Gemini 3 Architect" framework from `docs/design-prompts/knowledge.md` lines 1–57 (role + 9 critical rules + 7-step instructions + mandatory template + 1 worked example).
- [ ] AC-11: The 7-step JSON output schema is unchanged (`text_dna` / `visual` / `spatial` / `style` / `color` / `tech` / `final_prompt`) so existing consumers (`build_from_analysis`, the frontend's "Use as Prompt" button) continue working without code changes.
- [ ] AC-12: The existing `Analyze image` button (lupe icon under the prompt textarea, current behaviour) keeps its current API contract — only the underlying SYSTEM_PROMPT changes. No frontend changes required for this AC.
- [ ] AC-13: A regression test against 3 sample reference images verifies the new `final_prompt` is ≥600 chars (up from typical ~200 today) and contains the Architect markers: `Vector Print Design` (never `T-Shirt`), text in `"double quotes"`, color-object binding patterns (`"golden yellow body"`-style), and `breathing room` / `generous padding`.
- [ ] AC-14: **No auto-analyze**: Gemini is NOT called for analysis on every Edit/Remix request. Analysis happens only when the user clicks the button.

### Schicht 4 — Prompt-Polish Pipeline (Builder-only)
- [ ] AC-15: New helper `design_app/services/prompt_polish.py::polish_prompt(raw: str, model='google/gemini-3.1-flash-lite') -> str` sends a polish system message ("polish grammar and flow only; preserve every concrete detail; output only the polished prompt, no preamble") + the raw prompt; returns the polished string.
- [ ] AC-16: Polish is invoked **only from the Builder-build endpoint** (new `POST /api/designs/projects/{id}/builder/build/`) — never from `generate_image()`, never from `StandaloneGenerateView`. Free-text user prompts in the textarea are NEVER polished.
- [ ] AC-17: New `ProcessingSettings.polish_builder_prompts_enabled` BooleanField (default `True`) controls per-workspace polish behaviour. Editable in the existing Project/Workspace Settings panel.
- [ ] AC-18: Polish failures (timeout / 5xx / quota / network) fall back to the raw enriched prompt silently — the Builder still inserts the unpolished version into the textarea + logs a warning. No user-facing error.
- [ ] AC-19: Polish timeout = 5s per prompt; with N×M=50 polishes in parallel (`asyncio.gather` / `httpx.AsyncClient`), total Build latency ≤ 5s.
- [ ] AC-20: Every polish call is traced via Langfuse with input/output for debugging.

### Schicht 5 — Style-Library Thumbnails (Build Script)
- [ ] AC-21: New script `scripts/generate_style_thumbnails.py` runs `generate_image()` once per style using a fixed test-prompt (`"a smiling cartoon taco mascot, centered, isolated on white background, {STYLE}"`), saving 1024×1024 PNGs to `frontend-ui/public/style-thumbnails/{slug}.png`.
- [ ] AC-22: The 15 styles (confirmed): `vintage_retro`, `70s_groovy`, `80s_neon`, `90s_grunge`, `kawaii_chibi`, `cartoon`, `watercolor`, `hand_drawn_sketch`, `vector_flat`, `minimal_line_art`, `pixel_art`, `distressed_texture`, `halftone_print`, `badge_emblem`, `blackletter_gothic`.
- [ ] AC-23: Style metadata lives in `frontend-ui/src/views/designs/board/constants/styleLibrary.ts` as a typed array: `{ slug, label, shortDescription, thumbnail, promptSuffix }`. No grouping needed (only 15 flat items).
- [ ] AC-24: Generated PNGs are committed to git (≤80KB each via PIL re-compression, total ≤1.2MB).
- [ ] AC-25: Script idempotent: re-running regenerates only styles missing or explicitly marked `--force`. Single-style regeneration via `python scripts/generate_style_thumbnails.py --slug=vaporwave`.

### Schicht 6 — Multi-Prompt-Builder UI (simplified)
- [ ] AC-26: Existing `PromptBuilderDialog` accordions/toggles **removed**: `web_research`, `keywords`, the per-variant `variant_index` mechanism. Dead helper code (`build_from_sources` variant-index branch, related frontend types) purged.
- [ ] AC-27: New Builder layout (top to bottom): Preset dropdown + `Save as Preset` button → Slogans block → Styles block → Warp dropdown (optional) → Reference indicator (read-only, mirrors RightPanel) → `Will generate X prompts` counter + `Build` CTA.
- [ ] AC-28: **Slogans block**: MUI multi-select chip-list populated from project's `ProjectIdea` pool (showing slogan_text + niche badge) + a multi-line MUI `TextField` for free-text slogans (one per line, empty lines ignored). Combined output = pool selections + free-text lines.
- [ ] AC-29: **Styles block**: Vertical scrollable list of exactly 15 styles. Each row: 56×56 thumbnail (lazy-loaded), style label, 1-line description. Click anywhere on row toggles selection. No "More" modal; the 15-tile library is the whole library.
- [ ] AC-30: **Selected styles**: shown as removable MUI Chips in a dedicated row above the Styles list; `×` icon removes a chip.
- [ ] AC-32: **Warp dropdown**: Single-select MUI `Select` (optional, default = empty/none) with 4 options: `Arc Lower (Banner)`, `Concave Squeeze (Bowtie)`, `Bulge (Football)`, `Flag Wave (Sinuous)`. Labels include the German-friendly hint from `knowledge.md`. Selecting a warp does NOT reset on clicking Build.
- [ ] AC-33: **Niche-research toggle**: Builder UI has a `Include niche style context` switch above the Build CTA. When ON, the backend `build/` endpoint reads `project.niche.latest_research_data` and appends top 3 each of `visual_styles`, `vibes`, `tones` as a parenthetical context block in every generated prompt. When OFF, the injection is skipped. Default: ON. If the niche has no research data, the switch is `disabled` with MUI Tooltip `No niche research data yet — run PROJ-6 first`. Toggle state is part of the Builder Preset config.
- [ ] AC-34: **Build CTA**: Disabled when N=0 OR M=0. When enabled, label shows `Build {N×M} prompts`.
- [ ] AC-35: **>30 prompts confirmation**: Clicking Build with N×M > 30 opens MUI Dialog `About to generate {N×M} prompts — continue?` with `Cancel` + `Continue` buttons. Threshold tunable via constant.
- [ ] AC-36: **Build action behaviour**: POST to new `/api/designs/projects/{id}/builder/build/` with `{slogans: string[], styles: slug[], warp: slug?, bg_color, with_polish: bool}`. Response = `{prompts: string[]}` (already polished, in order). Frontend joins with `; ` and replaces textarea content + sets `Parallel Prompts` toggle to ON. Build does NOT fire Generate.
- [ ] AC-37: **Parallel-Prompts separator**: changed from newline to `;`. Newline-as-separator support fully removed (no backwards-compat).
- [ ] AC-38: **Images-slider lock**: When the textarea contains ≥2 `;`-separated entries AND `Parallel Prompts` is ON, the `Images` slider is `disabled` with MUI Tooltip `Locked to 1 while multi-prompt is active`. Single-prompt mode keeps the slider functional.
- [ ] AC-39: **Single-prompt Images-slider behaviour**: When `Images > 1` and Parallel-Prompts OFF, backend fires N parallel `generate_image` calls with sequential `seed` parameters (where model supports it). For non-seed-supporting models (e.g. Gemini Nano Banana) the fallback combines BOTH: append `(variation {N} of {total}, slight composition tweak)` AND a random style-modifier per variant from a fixed pool (e.g. `slightly bolder outlines`, `softer shading`, `tighter composition`, `looser layout`, `richer color saturation`) — picked deterministically by `(run_id, variant_index)` so variants are reproducible.
- [ ] AC-40: **Manual textarea-edit protection**: After Build inserts prompts, if user manually edits the textarea, the next Build asks for confirmation `Replace your manual edits with newly-built prompts?` before overwriting.

### Schicht 7 — Builder Preset Persistence
- [ ] AC-41: New Django model `BuilderPreset(workspace FK, project FK, name CharField unique-per-project, config_json JSONField, created_by FK, created_at, updated_at)`. UUID PK. Soft-delete via `is_deleted` BooleanField.
- [ ] AC-42: DRF endpoints under `/api/designs/projects/{id}/builder-presets/`: `GET /` (list), `POST /` (create), `PATCH /{id}/` (rename), `DELETE /{id}/` (soft-delete).
- [ ] AC-43: Frontend `Preset` dropdown in Builder: lists `name` of all non-deleted presets for the current project. Selecting a preset loads its `config_json` into the Builder form fields.
- [ ] AC-44: `Save as Preset` button: opens small inline `TextField` for name + `Save` button. POSTs current Builder config; success → preset appears in dropdown + becomes selected.
- [ ] AC-45: Presets survive page reload (verified by load → reload → reselect → state matches).
- [ ] AC-46: `Delete` icon next to selected preset in dropdown: opens `window.confirm` → soft-deletes.

## Edge Cases

### Generation pipeline
- [ ] EC-1: User picks `neon_pink` but types `"on a black background"` in their prompt → the BG-color injection wins (appended last), Gemini sees both — model behaviour is "last instruction wins" but this is acceptable; document in tooltip.
- [ ] EC-2: User selects Edit/Remix mode but no Source image → existing disabled-Generate gating (from PROJ-9 bugfix branch) blocks; Builder doesn't support Edit/Remix modes anyway.
- [ ] EC-3: Reference image fetch fails inside `_to_data_url` (404 / timeout / DNS) → run fails with explicit `"Reference image not accessible: {url}"` error (instead of cryptic Gemini 400). Failed-run UX from PROJ-9 bugfix surfaces this on the skeleton artboard.
- [ ] EC-4: System-prompt + user-prompt combined exceeds Gemini context window (rare for image-gen — context is huge) → log warning, truncate user-prompt to fit, continue.

### Polish pipeline
- [ ] EC-5: Polish model returns text exceeding 2000 chars → truncate to last sentence boundary under 2000 chars, log warning.
- [ ] EC-6: Polish model returns empty string or unmodified input → fall through to raw prompt (no-op polish).
- [ ] EC-7: `polish_builder_prompts_enabled = False` in workspace settings → Builder calls `build/` endpoint with `with_polish: false`, raw enriched prompts returned.
- [ ] EC-8: Polish call hangs > 5s → AbortController/timeout → fall through to raw prompt, log warning.

### Multi-prompt Builder UX
- [ ] EC-9: User clicks Build with 5 slogans × 0 styles → Build disabled (AC-34). If somehow triggered (race), backend returns 400 `"Select at least one style"`.
- [ ] EC-10: User clicks Build with 0 slogans × 5 styles → Build disabled (AC-34). Same backend guard.
- [ ] EC-11: User clicks Build with N×M = 31 → confirmation modal appears (AC-35). User clicks Cancel → no insertion; Continue → insertion proceeds.
- [ ] EC-12: User manually edits textarea after Build → next Build shows `Replace your manual edits?` (AC-40). Cancel preserves edits; Continue replaces.
- [ ] EC-13: User toggles `Parallel Prompts` OFF after Build → textarea contents stay, treated as single prompt at Generate-time (semicolons become literal text). User responsibility; no warning.
- [ ] EC-14: Saved Preset references a slogan_text that no longer exists in pool (idea deleted) → on load, silently drop missing slogan + show notification snackbar `"X items from this preset were skipped because they no longer exist"`.
- [ ] EC-15: Saved Preset references a style slug that's been renamed/removed in a future `styleLibrary.ts` update → same silent-drop + notification.
- [ ] EC-16: Niche has no PROJ-6 research yet → `Include niche style context` switch is disabled with tooltip explaining why; backend `build/` ignores the field if somehow sent and emits no injection block.
- [ ] EC-23: User turns niche-context toggle ON but the linked project has no `niche` set (e.g. project created without a niche link) → switch disabled with tooltip `Project not linked to a niche`.

### Image-slider / seed variation
- [ ] EC-17: Single-prompt, `Images=4`, model is OpenRouter Nano Banana (no documented seed support) → fallback to prompt-suffix `"(variation 1 of 4)"` / `"(variation 2 of 4)"` etc. on each parallel call.
- [ ] EC-18: User switches from multi-prompt to single-prompt mid-session → Images slider becomes enabled again at its last-set value.

### Presets
- [ ] EC-19: User tries to save Preset with duplicate name in same project → 400 `"Preset name already exists in this project"`; frontend shows error inline.
- [ ] EC-20: User deletes the currently-loaded preset → preset clears from dropdown + form resets to defaults.

### Style thumbnails
- [ ] EC-21: A style's thumbnail PNG is missing in production (deploy mishap) → frontend falls back to a colored placeholder rectangle with the style label centered (CSS-only, no network).
- [ ] EC-22: User runs `generate_style_thumbnails.py` without `OPENROUTER_API_KEY` env → script aborts with clear error before any LLM call.

## Technical Requirements

- **Backend:**
  - `DESIGN_GEN_SYSTEM_PROMPT` constant in one place (`image_generator.py`), reused everywhere.
  - Migration: `DesignGenerationRun.background_color` (CharField, choices=BackgroundColor, default=light_gray).
  - Migration: `ProcessingSettings.polish_builder_prompts_enabled` (Bool, default=True).
  - Migration: new `BuilderPreset` table.
  - New service `prompt_polish.py` (httpx, `gemini-3.1-flash-lite`, 5s timeout, retry-once-on-timeout).
  - New endpoint `POST /api/designs/projects/{id}/builder/build/` returns `{prompts: string[]}`.
  - New ViewSet for `BuilderPreset` (DRF ModelViewSet).
  - All polish + image-gen + analyze calls traced via Langfuse with `metadata.workspace_id` + `metadata.project_id`.

- **Frontend:**
  - MUI v7 only. New components in `frontend-ui/src/views/designs/board/partials/promptBuilder/`: `StylePicker.tsx`, `StyleMoreModal.tsx`, `WarpPicker.tsx`, `PresetDropdown.tsx`, `BuildCounter.tsx`.
  - Existing `PromptBuilderDialog.tsx` simplified — remove web_research / keywords / variant_index code paths.
  - Style-library constants typed: `frontend-ui/src/views/designs/board/constants/styleLibrary.ts`.
  - RTK Query for `BuilderPreset` CRUD.
  - Style-thumbnail PNGs in `frontend-ui/public/style-thumbnails/{slug}.png` (Vite serves from public/).

- **Performance:**
  - Polish: ≤5s per Build with up to 50 parallel polishes.
  - Style-thumbnail bundle: ≤1.2MB total in `public/`.
  - Builder open → first interaction-ready: ≤500ms (don't block on preset list; show empty + populate async).

- **Observability:**
  - Langfuse traces: every image-gen + polish + analyze call with full input/output.
  - Console warnings: polish-failure fallbacks, truncations, missing-preset-items.

- **Browser Support:** Chrome, Firefox, Safari (current evergreen).

## Resolved Decisions

| # | Decision | Outcome |
|---|---|---|
| 1 | Build with 0 slogans OR 0 styles | Build button **disabled** (AC-34) |
| 2 | Confirm-modal threshold for N×M prompts | `> 30` (AC-35, EC-11) |
| 3 | Auto-polish Builder prompts default | `True` (AC-17) |
| 4 | Style-library list | 15 styles as proposed (AC-22) |
| 5 | Preset delete confirmation | Native `window.confirm()` (AC-46) |
| 6 | Seed-variation fallback for non-seed models | BOTH: `(variation N of M)` suffix + deterministic random style-modifier from fixed pool (AC-39) |
| 7 | Niche-context toggle default | `ON` (AC-33) |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### What we're building (in 3 sentences)

This feature has two halves. **Quality half:** every image we send to Gemini is now wrapped in strict rules ("only the design, never a t-shirt mockup, honor the background color the user picked") so we stop wasting credits on unusable mockups — plus the existing "Analyze Image" button gets a smarter system prompt that pulls Philip-Anders-quality DNA out of competitor photos. **Pipeline half:** the Prompt Builder gets a major simplification — only Slogans + Styles + Warp + Niche-Toggle remain — and gains a *cross-product mode*: pick 5 slogans × 3 styles, click Build, get 15 polished prompts inserted into the textarea ready to fire in parallel, with optional save-as-Preset for repeat batches.

### Component Tree (Prompt-Builder area)

```
Design Forge Workspace (existing)
+-- Top Bar (existing)
+-- Center Canvas (existing)
+-- Right Panel (existing)
    +-- Generation Controls (existing)
    |   +-- Mode dropdown (existing)
    |   +-- Model + BG-Color selectors (existing)
    |   +-- Images slider (NEW: locked + tooltip when multi-prompt active)
    |   +-- Resolution slider (existing)
    |   +-- Prompt textarea (existing; "Parallel Prompts" toggle behaviour changes)
    |   +-- Generate button (existing)
    +-- Prompt Builder Dialog (RENOVATED — removed accordions; new flow)
        +-- Preset Bar
        |   +-- Preset dropdown
        |   +-- "Save as Preset" button
        |   +-- Delete-preset icon (uses window.confirm)
        +-- Slogan Picker
        |   +-- Multi-select chip-list (from project's ProjectIdea pool)
        |   +-- Free-text textarea (one slogan per line)
        +-- Style Picker
        |   +-- Selected-styles chip row (above)
        |   +-- Vertical list of 15 style cards (thumbnail + name + 1-line desc)
        +-- Warp dropdown (optional)
        +-- "Include niche style context" switch (default ON)
        +-- Reference indicator (read-only — mirrors RightPanel state)
        +-- Build counter ("Will generate X prompts")
        +-- Build CTA
        +-- Build Confirm Dialog (only when N×M > 30)
```

### Data Model (new + extended)

**New table — `BuilderPreset`** (project-scoped Builder configurations):

| Field | Type | Purpose |
|---|---|---|
| id | UUID | Primary key |
| workspace | FK → Workspace | Tenant isolation |
| project | FK → DesignProject | Preset belongs to one project |
| name | Text (max 80, unique-per-project) | User-given name e.g. "School Bus Set v1" |
| config | JSON | Slogans + styles + warp + bg_color + niche_context_enabled |
| created_by | FK → User | Audit |
| is_deleted | Boolean | Soft-delete flag |
| created_at / updated_at | Timestamps | Audit |

**Extended table — `DesignGenerationRun`** (add 2 fields):

| Field | Type | Purpose |
|---|---|---|
| background_color | Enum (light_gray / neon_pink / neon_green) | Persists user's UI selection so it reaches Gemini (kills the placebo bug) |
| prompt_polished | Text (nullable) | The final polished version sent to Gemini — stored for debugging |

**Extended table — `ProcessingSettings`** (add 1 field):

| Field | Type | Purpose |
|---|---|---|
| polish_builder_prompts_enabled | Boolean (default True) | Workspace-level toggle to enable/disable auto-polish |

### API Endpoints (new)

| Endpoint | Method | What it does |
|---|---|---|
| `/api/designs/projects/{id}/builder/build/` | POST | Take a Builder config (slogans + styles + warp + bg + niche-toggle + polish flag), return N×M polished prompts in order |
| `/api/designs/projects/{id}/builder-presets/` | GET | List all non-deleted presets for the project |
| `/api/designs/projects/{id}/builder-presets/` | POST | Create a new preset from current Builder config |
| `/api/designs/projects/{id}/builder-presets/{pid}/` | PATCH | Rename a preset |
| `/api/designs/projects/{id}/builder-presets/{pid}/` | DELETE | Soft-delete a preset |

Existing endpoints (`/api/designs/generate/`, `/api/designs/projects/{id}/prompts/{pid}/generate/`) gain an additional `background_color` request field that's now persisted onto the Run.

### Tech Decisions

| Decision | Why |
|---|---|
| System prompt sent as `role: system` (not prepended in user message) | Gemini Nano Banana family treats system messages as higher-priority than user messages — exactly what we need for hard rules the user shouldn't be able to override |
| Polish model = `google/gemini-2.5-flash-lite` (instead of the user-requested `3.1-flash-lite`) | The `3.1` lite variant doesn't exist in OpenRouter's lineup today. `2.5-flash-lite` is the closest equivalent — same cost band, sub-second latency, identical purpose. **Flag for user confirmation.** |
| Background-color injected as final line of user message (not in system prompt) | Lets the polish step reformulate it if needed; system prompt stays static. Also: easier to debug in Langfuse traces (visible at the bottom of every prompt) |
| Style thumbnails generated once via build-script, committed to git as PNGs | No runtime LLM call needed when user opens Builder. Frontend ships <1.2MB total. Manual regenerate via `--slug=foo` flag when a style doesn't satisfy you |
| Polish runs ONLY at Builder-build time, never at Generate-time | User clarification: free-typed prompts in textarea stay untouched. Polish is opt-in via Builder usage |
| Parallel-Prompts separator = `;` only (newline removed) | Single source of truth; no ambiguity. Builder always produces `;`-joined output. Old newline-based prompts in saved state migrate transparently (we treat newline as whitespace) |
| `BuilderPreset.config` stored as JSON blob (not normalized) | Builder config is small (<2KB), changes shape as we iterate styles, and is only used by one consumer. Normalizing into 3 tables would be over-engineering |
| `BuilderPreset` uses soft-delete | Preserves audit trail; later we may add "recently deleted" recovery. Cost: ~zero |
| `ProcessingSettings.polish_builder_prompts_enabled` lives per workspace | Toggle moves once for whole team. Existing `ProcessingSettings` is already a per-workspace singleton — no new pattern needed |
| Image-Slider seed-variation fallback for Nano Banana = suffix + random style-modifier combined | Per user's pick. Modifier pool is fixed (5 entries); variant index → modifier mapping is deterministic so repeated runs are reproducible |
| Style picker is flat 15 items, no "More" modal | Per user clarification — 15 *is* the entire library; future additions ship in new releases |

### Dependencies (packages)

No new backend Python packages — `httpx`, `Langfuse` are already installed.
No new frontend NPM packages — using existing MUI v7 + RTK Query.
No new external services — only OpenRouter (already wired).

### File Structure (what gets added/changed)

```
django-app/
+-- design_app/
|   +-- services/
|   |   +-- image_generator.py        (CHANGE: add DESIGN_GEN_SYSTEM_PROMPT + role:system wiring + bg-color injection)
|   |   +-- image_analyzer.py         (CHANGE: replace SYSTEM_PROMPT with 9-Architect-Rule version from knowledge.md)
|   |   +-- prompt_polish.py          (NEW: polish_prompt() helper + Langfuse trace)
|   |   +-- prompt_builder.py         (CHANGE: drop variant_index branch; ADD: build_architect_prompt() for the 9-rule template)
|   +-- models.py                     (CHANGE: DesignGenerationRun + ProcessingSettings extensions; NEW: BuilderPreset)
|   +-- api/
|   |   +-- views.py                  (CHANGE: persist bg_color on Run; NEW: BuilderBuildView + BuilderPresetViewSet)
|   |   +-- serializers.py            (NEW: BuilderBuildSerializer, BuilderPresetSerializer)
|   |   +-- urls.py                   (NEW: builder/build/ + builder-presets/ routes)
|   +-- tasks.py                      (CHANGE: read run.background_color; DELETE: _get_bg_from_prompt)
|   +-- migrations/                   (NEW: 3 migrations — DesignGenerationRun fields, ProcessingSettings field, BuilderPreset table)

frontend-ui/
+-- public/style-thumbnails/          (NEW: 15 PNG files, ~80KB each)
+-- src/views/designs/board/
|   +-- constants/styleLibrary.ts     (NEW: 15-entry array with slug/label/desc/thumbnail/promptSuffix)
|   +-- partials/promptBuilder/
|   |   +-- PromptBuilderDialog.tsx   (RENOVATED: remove web_research/keywords/variant accordions)
|   |   +-- PresetBar.tsx             (NEW)
|   |   +-- SloganPicker.tsx          (NEW: pool multi-select + free-text)
|   |   +-- StylePicker.tsx           (NEW: 15-tile list + chip row)
|   |   +-- WarpPicker.tsx            (NEW: 4-option select)
|   |   +-- NicheContextToggle.tsx    (NEW: switch with disabled-state tooltip)
|   |   +-- BuildCounter.tsx          (NEW)
|   |   +-- BuildConfirmDialog.tsx    (NEW)
|   +-- partials/GenerationZone.tsx   (CHANGE: Images-slider lock when multi-prompt active)
|   +-- hooks/useGeneration.ts        (CHANGE: parallel-prompts split on ; only; single-prompt seed-variation logic)
+-- src/store/designSlice.ts          (CHANGE: add RTK Query endpoints for builder/build + builder-presets)

scripts/
+-- generate_style_thumbnails.py      (NEW: one-shot PNG generator using existing image_generator)
```

### Phase Plan (12 phases)

The detailed checklist of tasks per phase lives in [`docs/tasks/PROJ-34-tasks.md`](../docs/tasks/PROJ-34-tasks.md).

| # | Phase | Outcome |
|---|---|---|
| 1 | Backend Foundation | Migrations applied: bg_color + prompt_polished on Run, polish_builder_prompts_enabled on Settings, BuilderPreset table |
| 2 | System Prompt + BG-Color Plumbing | Every image-gen call sends 9-rule system prompt + actual user-selected bg-color; placebo bug fixed |
| 3 | Image-Analyzer Upgrade | Analyze button produces Philip-Anders-quality prompts |
| 4 | Polish Service | `prompt_polish.py` ready; Langfuse-traced |
| 5 | Builder-Build API | POST endpoint returns N×M polished prompts |
| 6 | Builder-Preset API | CRUD endpoints + soft-delete |
| 7 | Style Library + Build Script | 15 PNGs generated and committed; metadata constants in place |
| 8 | Frontend Builder Renovation | New PromptBuilderDialog UI: PresetBar + SloganPicker + StylePicker + WarpPicker + NicheToggle + BuildCounter + BuildConfirm |
| 9 | Frontend Generation-Zone Changes | Parallel-Prompts splits on `;`; Images-slider locked in multi-prompt mode; seed-variation logic for single-prompt |
| 10 | Frontend Preset UI | Save/Load/Delete preset flow wired |
| 11 | Settings UI | Workspace `Auto-polish` toggle visible + editable |
| 12 | Tests + QA | Backend unit tests, frontend component tests, E2E smoke test for full Builder→Build→Generate flow |

### Open Tech Notes (flag for user)

1. **Polish model:** user requested `google/gemini-3.1-flash-lite` — that exact ID isn't on OpenRouter today. Proposal: use `google/gemini-2.5-flash-lite` (closest equivalent, same cost band). Confirm before Phase 4.
2. **Migration ordering risk:** adding `background_color` to `DesignGenerationRun` is safe (defaults to `light_gray`). Existing rows backfill silently — no data loss, but old Runs will all show `light_gray` regardless of what they actually used.
3. **Preset name uniqueness scope:** unique-per-project (not per-workspace) — two projects can both have "Set v1".

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
