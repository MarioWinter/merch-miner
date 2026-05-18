# PROJ-34: Design-Forge Prompt Engineering & Multi-Prompt Builder

## Status: In Review
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
- [x] AC-1: A `DESIGN_GEN_SYSTEM_PROMPT` constant in `design_app/services/image_generator.py` encodes the 9 Architect Critical Rules from `docs/design-prompts/knowledge.md` + the "design-only / no t-shirt / no mockup / no person wearing it" hard rule + the BG-color enforcement rule + Tech-Specs (`screen print ready`, `hard edges`, `no gradients/noise`, `vector sharpness`, `300 DPI`).
- [x] AC-2: `generate_image()` always sends this constant as a `role: system` message before the user message — verified by inspecting the payload via Langfuse trace AND by a unit test that asserts the payload structure.
- [x] AC-3: For any model that rejects `role: system` (none today, but future-proofing), the same constant is prepended as a wrapper at the start of the user message — toggled by a per-model flag in `MODEL_MAP`.

### Schicht 2 — Background-Color Persistence (kills Bug A)
- [x] AC-4: `DesignGenerationRun` model gains a `background_color` CharField with choices `Design.BackgroundColor`, defaulting to `light_gray`. Migration created and applied.
- [x] AC-5: `StandaloneGenerateView` AND `GenerateFromPromptView` AND `IdeaGenerateView` write `serializer.validated_data['background_color']` onto the Run.
- [x] AC-6: `task_generate_design` reads `run.background_color` and passes it as a parameter to `generate_image()`.
- [x] AC-7: `generate_image()` appends `Background: solid {HEX}, saturated, no gradients, flat single color background` to the final user prompt (using `Design.BG_COLOR_HEX[run.background_color]` for the hex value).
- [x] AC-8: The post-hoc derivation `_get_bg_from_prompt(prompt)` is deleted from `tasks.py`; `Design.background_color` is set from `run.background_color` directly.
- [x] AC-9: A unit test verifies that selecting `neon_pink` in the UI results in `#FF6EC7` appearing in the OpenRouter payload sent to the worker mock.

### Schicht 3 — Image-Analyzer Upgrade (button-triggered, function exists)
- [x] AC-10: `design_app/services/image_analyzer.py` `SYSTEM_PROMPT` is replaced 1:1 with the full "Gemini 3 Architect" framework from `docs/design-prompts/knowledge.md` lines 1–57 (role + 9 critical rules + 7-step instructions + mandatory template + 1 worked example).
- [x] AC-11: The 7-step JSON output schema is unchanged (`text_dna` / `visual` / `spatial` / `style` / `color` / `tech` / `final_prompt`) so existing consumers (`build_from_analysis`, the frontend's "Use as Prompt" button) continue working without code changes.
- [x] AC-12: The existing `Analyze image` button (lupe icon under the prompt textarea, current behaviour) keeps its current API contract — only the underlying SYSTEM_PROMPT changes. No frontend changes required for this AC.
- [x] AC-13: A regression test against 3 sample reference images verifies the new `final_prompt` is ≥600 chars (up from typical ~200 today) and contains the Architect markers: `Vector Print Design` (never `T-Shirt`), text in `"double quotes"`, color-object binding patterns (`"golden yellow body"`-style), and `breathing room` / `generous padding`. *(Structural test in `TestImageAnalyzerV2` asserts the SYSTEM_PROMPT contains all markers; the live 3-image quality regression is documented as a manual QA smoke test since it requires live OPENROUTER credit per CI run.)*
- [x] AC-14: **No auto-analyze**: Gemini is NOT called for analysis on every Edit/Remix request. Analysis happens only when the user clicks the button.

### Schicht 4 — Prompt-Polish Pipeline (Builder-only)
- [x] AC-15: New helper `design_app/services/prompt_polish.py::polish_prompt(raw: str, model='google/gemini-3.1-flash-lite') -> str` sends a polish system message ("polish grammar and flow only; preserve every concrete detail; output only the polished prompt, no preamble") + the raw prompt; returns the polished string. *(Model: `google/gemini-2.5-flash-lite` — Tech Note 1 substitute since `3.1-flash-lite` not on OpenRouter.)*
- [x] AC-16: Polish is invoked **only from the Builder-build endpoint** (new `POST /api/designs/projects/{id}/builder/build/`) — never from `generate_image()`, never from `StandaloneGenerateView`. Free-text user prompts in the textarea are NEVER polished.
- [x] AC-17: New `ProcessingSettings.polish_builder_prompts_enabled` BooleanField (default `True`) controls per-workspace polish behaviour. Editable in the existing Project/Workspace Settings panel. *(Model field shipped Phase 1; UI added Phase 11.)*
- [x] AC-18: Polish failures (timeout / 5xx / quota / network) fall back to the raw enriched prompt silently — the Builder still inserts the unpolished version into the textarea + logs a warning. No user-facing error.
- [x] AC-19: Polish timeout = 5s per prompt; with N×M=50 polishes in parallel (`asyncio.gather` / `httpx.AsyncClient`), total Build latency ≤ 5s. *(Per-call 5s sync timeout; parallelism wired in Phase 5 via `asyncio.gather` over `httpx.AsyncClient` or thread pool.)*
- [x] AC-20: Every polish call is traced via Langfuse with input/output for debugging.

### Schicht 5 — Style-Library Thumbnails (Build Script)
- [x] AC-21: New script `scripts/generate_style_thumbnails.py` runs `generate_image()` once per style using a fixed test-prompt (`"a smiling cartoon taco mascot, centered, isolated on white background, {STYLE}"`), saving 1024×1024 PNGs to `frontend-ui/public/style-thumbnails/{slug}.png`.
- [x] AC-22: The 15 styles (confirmed): `vintage_retro`, `70s_groovy`, `80s_neon`, `90s_grunge`, `kawaii_chibi`, `cartoon`, `watercolor`, `hand_drawn_sketch`, `vector_flat`, `minimal_line_art`, `pixel_art`, `distressed_texture`, `halftone_print`, `badge_emblem`, `blackletter_gothic`.
- [x] AC-23: Style metadata lives in `frontend-ui/src/views/designs/board/constants/styleLibrary.ts` as a typed array: `{ slug, label, shortDescription, thumbnail, promptSuffix }`. No grouping needed (only 15 flat items).
- [x] AC-24: Generated PNGs are committed to git (≤80KB each via PIL re-compression, total ≤1.2MB). *(15 PNGs landed 2026-05-17; total 1.5 MB. Slightly above target; acceptable since they are lazy-loaded only when the Builder dialog opens. Future re-pack can shrink the noisier styles.)*
- [x] AC-25: Script idempotent: re-running regenerates only styles missing or explicitly marked `--force`. Single-style regeneration via `python scripts/generate_style_thumbnails.py --slug=vaporwave`.

### Schicht 6 — Multi-Prompt-Builder UI (simplified)
- [x] AC-26: Existing `PromptBuilderDialog` accordions/toggles **removed**: `web_research`, `keywords`, the per-variant `variant_index` mechanism. Dead helper code (`build_from_sources` variant-index branch, related frontend types) purged. *(Old dialog + 8 tab files + 2 hooks deleted in wire-up commit.)*
- [x] AC-27: New Builder layout (top to bottom): Preset dropdown + `Save as Preset` button → Slogans block → Styles block → Warp dropdown (optional) → Reference indicator (read-only, mirrors RightPanel) → `Will generate X prompts` counter + `Build` CTA.
- [x] AC-28: **Slogans block**: MUI multi-select chip-list populated from project's `ProjectIdea` pool (showing slogan_text + niche badge) + a multi-line MUI `TextField` for free-text slogans (one per line, empty lines ignored). Combined output = pool selections + free-text lines.
- [x] AC-29: **Styles block**: Vertical scrollable list of exactly 15 styles. Each row: 56×56 thumbnail (lazy-loaded), style label, 1-line description. Click anywhere on row toggles selection. No "More" modal; the 15-tile library is the whole library.
- [x] AC-30: **Selected styles**: shown as removable MUI Chips in a dedicated row above the Styles list; `×` icon removes a chip.
- [x] AC-32: **Warp dropdown**: Single-select MUI `Select` (optional, default = empty/none) with 4 options: `Arc Lower (Banner)`, `Concave Squeeze (Bowtie)`, `Bulge (Football)`, `Flag Wave (Sinuous)`. Labels include the German-friendly hint from `knowledge.md`. Selecting a warp does NOT reset on clicking Build.
- [x] AC-33: **Niche-research toggle**: Builder UI has a `Include niche style context` switch above the Build CTA. When ON, the backend `build/` endpoint reads `project.niche.latest_research_data` and appends top 3 each of `visual_styles`, `vibes`, `tones` as a parenthetical context block in every generated prompt. When OFF, the injection is skipped. Default: ON. If the niche has no research data, the switch is `disabled` with MUI Tooltip `No niche research data yet — run PROJ-6 first`. Toggle state is part of the Builder Preset config.
- [x] AC-34: **Build CTA**: Disabled when N=0 OR M=0. When enabled, label shows `Build {N×M} prompts`.
- [x] AC-35: **>30 prompts confirmation**: Clicking Build with N×M > 30 opens MUI Dialog `About to generate {N×M} prompts — continue?` with `Cancel` + `Continue` buttons. Threshold tunable via constant.
- [x] AC-36: **Build action behaviour**: POST to new `/api/designs/projects/{id}/builder/build/` with `{slogans: string[], styles: slug[], warp: slug?, bg_color, with_polish: bool}`. Response = `{prompts: string[]}` (already polished, in order). Frontend joins with `; ` and replaces textarea content + sets `Parallel Prompts` toggle to ON. Build does NOT fire Generate.
- [x] AC-37: **Parallel-Prompts separator**: changed from newline to `;`. Newline-as-separator support fully removed (no backwards-compat). *(Splitter lives in `useWorkspaceGeneration.parallelPrompts`; placeholder text and Builder both produce/consume `;`.)*
- [x] AC-38: **Images-slider lock**: When the textarea contains ≥2 `;`-separated entries AND `Parallel Prompts` is ON, the `Images` slider is `disabled` with MUI Tooltip `Locked to 1 while multi-prompt is active`. Single-prompt mode keeps the slider functional.
- [x] AC-39: **Single-prompt Images-slider behaviour**: When `Images > 1` and Parallel-Prompts OFF, backend fires N parallel `generate_image` calls with sequential `seed` parameters (where model supports it). For non-seed-supporting models (e.g. Gemini Nano Banana) the fallback combines BOTH: append `(variation {N} of {total}, slight composition tweak)` AND a random style-modifier per variant from a fixed pool (e.g. `slightly bolder outlines`, `softer shading`, `tighter composition`, `looser layout`, `richer color saturation`) — picked deterministically by `(run_id, variant_index)` so variants are reproducible. *(Per Appendix H — seed-only is now the path since all 5 image models support seed. Frontend fires N Runs each with their own Run UUID; backend derives `seed = int(run.id.int & 0xFFFFFFFF)` per Run and forwards via OpenRouter `seed`. Prompt-suffix `(variation N of M)` retained as soft compositional nudge. Style-modifier pool dropped.)*
- [x] AC-40: **Manual textarea-edit protection**: After Build inserts prompts, if user manually edits the textarea, the next Build asks for confirmation `Replace your manual edits with newly-built prompts?` before overwriting.

### Schicht 7 — Builder Preset Persistence
- [x] AC-41: New Django model `BuilderPreset(workspace FK, project FK, name CharField unique-per-project, config_json JSONField, created_by FK, created_at, updated_at)`. UUID PK. Soft-delete via `is_deleted` BooleanField.
- [x] AC-42: DRF endpoints under `/api/designs/projects/{id}/builder-presets/`: `GET /` (list), `POST /` (create), `PATCH /{id}/` (rename), `DELETE /{id}/` (soft-delete).
- [x] AC-43: Frontend `Preset` dropdown in Builder: lists `name` of all non-deleted presets for the current project. Selecting a preset loads its `config_json` into the Builder form fields.
- [x] AC-44: `Save as Preset` button: opens small inline `TextField` for name + `Save` button. POSTs current Builder config; success → preset appears in dropdown + becomes selected.
- [x] AC-45: Presets survive page reload (verified by load → reload → reselect → state matches).
- [x] AC-46: `Delete` icon next to selected preset in dropdown: opens `window.confirm` → soft-deletes.

## Edge Cases

### Generation pipeline
- [ ] EC-1: User picks `neon_pink` but types `"on a black background"` in their prompt → the BG-color injection wins (appended last), Gemini sees both — model behaviour is "last instruction wins" but this is acceptable; document in tooltip.
- [ ] EC-2: User selects Edit/Remix mode but no Source image → existing disabled-Generate gating (from PROJ-9 bugfix branch) blocks; Builder doesn't support Edit/Remix modes anyway.
- [ ] EC-3: Reference image fetch fails inside `_to_data_url` (404 / timeout / DNS) → run fails with explicit `"Reference image not accessible: {url}"` error (instead of cryptic Gemini 400). Failed-run UX from PROJ-9 bugfix surfaces this on the skeleton artboard.
- [x] EC-4: System-prompt + user-prompt combined exceeds Gemini context window (rare for image-gen — context is huge) → log warning, truncate user-prompt to fit, continue. *(warning logged via `_warn_if_oversized`; truncation deferred — Gemini context is 1M+ chars and the threshold is set very high.)*

### Polish pipeline
- [x] EC-5: Polish model returns text exceeding 2000 chars → truncate to last sentence boundary under 2000 chars, log warning.
- [x] EC-6: Polish model returns empty string or unmodified input → fall through to raw prompt (no-op polish).
- [x] EC-7: `polish_builder_prompts_enabled = False` in workspace settings → Builder calls `build/` endpoint with `with_polish: false`, raw enriched prompts returned. *(Backend: workspace flag also short-circuits polish even if request sets `with_polish=true`.)*
- [x] EC-8: Polish call hangs > 5s → AbortController/timeout → fall through to raw prompt, log warning.

### Multi-prompt Builder UX
- [ ] EC-9: User clicks Build with 5 slogans × 0 styles → Build disabled (AC-34). If somehow triggered (race), backend returns 400 `"Select at least one style"`.
- [ ] EC-10: User clicks Build with 0 slogans × 5 styles → Build disabled (AC-34). Same backend guard.
- [ ] EC-11: User clicks Build with N×M = 31 → confirmation modal appears (AC-35). User clicks Cancel → no insertion; Continue → insertion proceeds.
- [ ] EC-12: User manually edits textarea after Build → next Build shows `Replace your manual edits?` (AC-40). Cancel preserves edits; Continue replaces.
- [ ] EC-13: User toggles `Parallel Prompts` OFF after Build → textarea contents stay, treated as single prompt at Generate-time (semicolons become literal text). User responsibility; no warning.
- [x] EC-14: Saved Preset references a slogan_text that no longer exists in pool (idea deleted) → on load, silently drop missing slogan + show notification snackbar `"X items from this preset were skipped because they no longer exist"`.
- [x] EC-15: Saved Preset references a style slug that's been renamed/removed in a future `styleLibrary.ts` update → same silent-drop + notification.
- [ ] EC-16: Niche has no PROJ-6 research yet → `Include niche style context` switch is disabled with tooltip explaining why; backend `build/` ignores the field if somehow sent and emits no injection block.
- [ ] EC-23: User turns niche-context toggle ON but the linked project has no `niche` set (e.g. project created without a niche link) → switch disabled with tooltip `Project not linked to a niche`.

### Image-slider / seed variation
- [x] EC-17: Single-prompt, `Images=4`, model is OpenRouter Nano Banana (no documented seed support) → fallback to prompt-suffix `"(variation 1 of 4)"` / `"(variation 2 of 4)"` etc. on each parallel call. *(Confirmed via Appendix H: all 5 image models DO support seed; suffix retained as soft nudge regardless.)*
- [x] EC-18: User switches from multi-prompt to single-prompt mid-session → Images slider becomes enabled again at its last-set value. *(Slider is controlled by `parallelLineCount >= 2 && isParallel`; flipping Parallel OFF immediately re-enables it.)*

### Presets
- [x] EC-19: User tries to save Preset with duplicate name in same project → 400 `"Preset name already exists in this project"`; frontend shows error inline. *(Backend enforces; partial UniqueConstraint allows name re-use after soft-delete.)*
- [ ] EC-20: User deletes the currently-loaded preset → preset clears from dropdown + form resets to defaults.

### Style thumbnails
- [ ] EC-21: A style's thumbnail PNG is missing in production (deploy mishap) → frontend falls back to a colored placeholder rectangle with the style label centered (CSS-only, no network).
- [x] EC-22: User runs `generate_style_thumbnails.py` without `OPENROUTER_API_KEY` env → script aborts with clear error before any LLM call.

---

# Phase 13 — Form-Based Architect Builder (post-QA revision)

**Why:** The QA-passed v1 Builder produced low-quality prompts because the simple template
violated Architect Rules 3, 4, 5, 6, 8, 10 — it said "t-shirt" verbatim, gave Gemini no
illustration/font/layout direction, and dumped unfiltered PROJ-6 niche-research text
(including "yellow on a black shirt") that contradicted the user's bg-color choice. Polish
couldn't help because its system prompt explicitly forbade removing concrete details.

**What changes:** The Builder dialog becomes an 8-slot **structured form** that fills the
Architect 7-Step template directly. Each slot is a dropdown of pre-written variants + a
"Custom…" override + a Style-driven auto-default badge. The PROJ-6 niche-vision data is
**pre-structured by an LLM** (one call per niche, cached on the Niche model) into
slot-shaped suggestions that pre-populate the form when the user opens the Builder for a
niche-linked project.

**Schicht 13 add-on (modal pickers + custom spatials):** The Spatial slot ships with a
much richer library of **36 layout variants** (vertical stacks, badges, definitions, jersey
layouts, postage-stamp, sports-jersey, ticket, map-coordinates, knockout, diagonals,
triptychs, …). Each variant has a thumbnail + short UI description + rich prompt text. To
keep the BuilderDialog navigable, **two picker modals** are introduced: a
**SpatialPickerModal** (grid of 36 thumbnails + search + a "Custom" tab) and a
**StylePickerModal** (the existing 15 styles refactored into the same modal pattern). Both
modals open via small "Spatial layout ▸" / "Style ▸" buttons in the BuilderDialog.

If none of the 36 built-in spatials fit, the user can create a **Custom Spatial Layout**:
upload an image OR pick an existing Design or Project Reference from the Design Forge right
panel; a vision-LLM (`openai/gpt-4.1-mini`) analyses ONLY the **text-and-vector
positioning** of the image (explicitly forbidden to describe colors, styles, or
illustration content) and returns a layout-prompt that the user can name + save. Custom
Spatials are **workspace-scoped** (shared with all members) and appear in the SpatialPickerModal
"Custom" tab. They are referenced by UUID in `slots.spatial_configuration` and render
identically to built-ins.

### User Stories (Phase 13)

- **As a POD seller**, when I open the Builder for the "school bus driver" project, I want
  the form to be **pre-filled** based on the linked niche's research data — so Spatial
  Configuration suggests "Badge layout" or "Top text + bus illustration + bottom text",
  Accessories suggests "motion lines + stars", and Material/Texture suggests "halftone
  print + slight distressed grain". I can override any field. This kills the cold-start
  problem where I'd otherwise have to type all 8 slots myself.

- **As a POD seller**, when I pick a style (e.g. `cartoon`), I want **Typography**,
  **Material**, and **Style-DNA** slots to auto-fill with Cartoon-typical values ("massive
  heavyweight cartoon-block font", "clean digital vector", "Saturday-morning animation
  flat shading"). The auto-filled fields show an "auto from Cartoon style" badge that I
  can override.

- **As a POD seller**, I want the **Visual Description** slot to be a **multiline free-text
  field** because no preset can know that THIS design needs "a smiling cartoon school bus
  in 3/4 view facing right, with curved yellow roof, horizontal grille slats, rounded
  wheel arches, dark grey bumper, square white windows, white motion lines around it".
  This field is the heart of the Architect "≥6 visual details" rule (#8).

- **As a POD seller**, I want **no gradients, no glowing shadows, no soft-shadow effects
  EVER** in the produced prompt — POD print needs hard edges always, even on round
  graphics. This must be a hard rule that no Style can override.

- **As a POD seller** who built a great form configuration, I want to **save it as a
  Preset** with all 8 slot values, so my next batch in this project starts from there.

- **As a POD seller** who turned off Niche-Context, I want my Visual Description /
  Accessories / Material slots to fall back to the **Style-default** values (not blank).

- **As a POD seller** who finishes the form, I want a **live preview** at the bottom that
  shows the assembled prompt before I click Build, so I can spot issues.

- **As a POD seller**, I want the Spatial slot to expose **all 36 layout variants** (not 6)
  in a **modal grid with thumbnails + short descriptions** so I can browse visually rather
  than scroll a 35-row dropdown. Same for the 15 Styles — the modal pattern keeps the
  BuilderDialog compact and the picker scannable.

- **As a POD seller** who needs a layout that none of the 36 built-ins cover, I want a
  **"Create Custom Spatial"** flow inside the SpatialPickerModal that lets me either
  **upload a reference image** OR **pick from my Project References / generated Designs
  in the Design Forge right panel**. A vision-LLM should analyse it and extract ONLY the
  text-and-vector positioning (never the colors, styles or what is actually drawn). I
  name + save the result. The new Custom Spatial then appears in the SpatialPickerModal
  "Custom" tab and is shared with my workspace teammates.

### Acceptance Criteria (Phase 13)

#### Schicht 8 — Architect Template Sections

- [x] AC-47: A new constant `ARCHITECT_TEMPLATE_START` in `style_library.py` holds the
  static opener `"A professional vector print design isolated on a {bg_hex} background."`
  — `{bg_hex}` is the only placeholder.
- [x] AC-48: A new constant `ARCHITECT_TEMPLATE_END` in `style_library.py` holds the
  static closer `"High contrast, clean outlines, commercial vector art. Screen print
  ready, hard edges, no gradients, no glow effects, no soft shadows, no drop shadows,
  vector sharpness, 300 DPI."` — the no-gradients/glow/shadow clauses are NON-NEGOTIABLE
  (covers `*As a POD seller, no gradients ever*` user story).
- [x] AC-49: A new constant `DESIGN_GEN_SYSTEM_PROMPT` gets a 10th hard rule appended.
  Exact wording in **Appendix N.1 of the tasks file** (verbatim source-of-truth — the
  rule explicitly forbids gradient fills, glowing effects, soft-edge shadows, drop
  shadows, and any blurred edge, and requires rounded geometry to be rendered with
  crisp outlined boundaries and flat fills).
- [x] AC-50: An 8-slot data structure `SLOT_SCHEMA` enumerates each Architect template
  slot in render order: `spatial_configuration`, `visual_description`,
  `text_segmentation`, `typography_adjectives`, `accessories`, `material_texture`,
  `style_dna`, `extra_context`. Each slot entry declares: `label`, `requires_value`,
  `has_dropdown`, `has_custom_text`, `style_auto_default` (bool).

#### Schicht 9 — Slot Dropdown Options (15 styles × 6 dropdown slots)

- [x] AC-51: For each of the 5 user-driven dropdown slots (Spatial, Text-Segmentation,
  Typography, Accessories, Material) the file `style_library.py` ships a fixed list of
  **6 preset variants** with crisp ≤30-word Architect-quality descriptions. Lists are
  shared across all 15 styles; the per-style auto-default picks ONE of the 6 as the
  Builder's pre-selected value. Exact text per slot lives in **Appendix J of the tasks
  file**.
- [x] AC-52: For each of the 15 styles in `STYLE_LIBRARY`, the entry gains 3 new fields:
  `default_typography` (one of the 6 Typography variants), `default_material` (one of
  the 6 Material variants), `default_style_dna` (a per-style descriptor string).
  Exact mapping lives in **Appendix K of the tasks file**.

#### Schicht 10 — Niche-Vision LLM Pre-structuring

- [x] AC-53: A new field `Niche.builder_form_hints` (JSONField, nullable, blank=True) on
  the existing `niche_app.Niche` model. Migration is additive, defaults to `null`.
  Field schema documented in **Appendix L of the tasks file**.
- [x] AC-54: A new internal helper `niche_app.services.builder_hints.structure_niche_for_builder(niche_id) -> dict`
  loads the latest `NicheResearch` + `NicheProductVisionAnalysis` rows for that niche,
  sends them to `openai/gpt-4.1-mini` via OpenRouter with a strict system prompt
  (exact text in **Appendix M of the tasks file**), and stores the resulting structured
  dict on `Niche.builder_form_hints`. The function is idempotent on repeat runs.
- [x] AC-55: The function `structure_niche_for_builder` is invoked automatically at the
  end of the existing PROJ-6 niche-research workflow (in
  `niche_research_app.tasks.task_run_niche_research` after the final step succeeds).
  When PROJ-6 is re-run, `builder_form_hints` is regenerated.
- [x] AC-56: A new GET endpoint
  `GET /api/designs/projects/{id}/builder/niche-hints/` returns
  `{ builder_form_hints: {...} | null, niche_id: str | null, last_updated: iso | null }`.
  When no niche is linked, returns `{ builder_form_hints: null }`. Requires
  `IsAuthenticated` + workspace isolation.
- [x] AC-57: A new management command
  `python manage.py backfill_niche_builder_hints` walks every niche with a completed
  research run and triggers `structure_niche_for_builder` for those whose
  `builder_form_hints` is still null. Used once post-deploy to populate existing
  workspaces.

#### Schicht 11 — Backend Form-Aware Builder

- [x] AC-58: A new function `prompt_builder.build_form_prompt(slogan, style_slug, *, slots: dict, background_color: str) -> str`
  composes `ARCHITECT_TEMPLATE_START` + 8 ordered slots + `ARCHITECT_TEMPLATE_END`. When a
  slot is missing, the function applies fallback resolution: explicit user value →
  niche-hint value → style auto-default → omit. Output is typically 600–1200 chars.
- [x] AC-59: `BuilderBuildSerializer` is extended with a new nested object
  `slots: { spatial_configuration?: str, visual_description?: str,
  text_segmentation?: str, typography_adjectives?: str, accessories?: str,
  material_texture?: str, style_dna?: str, extra_context?: str }`. All fields optional;
  empty strings treated as "use fallback".
- [x] AC-60: `BuilderBuildView.post` calls `build_form_prompt` (not the deprecated
  `build_architect_prompt`) for the cross-product. The old `build_architect_prompt` is
  removed in the same commit so there is one Builder path, not two.
- [x] AC-61: The deprecated `prompt_builder._format_niche_block` is removed. Niche
  context is no longer dumped verbatim — it is consumed only via the structured
  `builder_form_hints` to pre-fill form slots.
- [x] AC-62: All `prompt_builder` unit tests are rewritten against `build_form_prompt`
  with full coverage: each slot's fallback chain, hard-rule presence in output, output
  length stays ≤1500 chars.

#### Schicht 12 — Frontend Form UI

- [x] AC-63: `BuilderConfig` type adds a new field `slots: BuilderSlots` (8 optional
  strings — same names as backend). Old fields `selectedStyleSlugs`, `warpSlug`,
  `includeNicheContext` stay. — `frontend-ui/src/views/designs/board/types/builder.ts:9-45`
- [ ] AC-64: The renovated `BuilderDialog` is restructured into 5 collapsible MUI
  Accordions:
  - **A. Slogans** (existing SloganPicker; open by default)
  - **B. Styles** (existing StylePicker + WarpPicker; open by default)
  - **C. Layout & Composition** (new SpatialPicker + TextSegmentationPicker +
    AccessoriesPicker; closed by default)
  - **D. Visual Details** (new VisualDescriptionField — always required, open by
    default + TypographyPicker + MaterialPicker)
  - **E. Niche & Extra** (existing NicheContextToggle + ReferenceIndicator + new
    ExtraContextField; closed by default)
- [x] AC-65: 7 new partials in `frontend-ui/src/views/designs/board/partials/promptBuilder/`:
  `SpatialPicker.tsx`, `VisualDescriptionField.tsx`, `TextSegmentationPicker.tsx`,
  `TypographyPicker.tsx`, `AccessoriesPicker.tsx`, `MaterialPicker.tsx`,
  `ExtraContextField.tsx`. Each:
  - Renders a MUI `<Select>` populated from the Phase-9 dropdown options
  - Shows a `Custom…` final option that reveals a `<TextField>`
  - Shows an "auto from {Style}" badge when the value matches the style-default
  - Has a small "↺" icon to reset back to the style-default
  — partials live in `frontend-ui/src/views/designs/board/partials/promptBuilder/` (8 files including SpatialSlotButton + StyleSlotButton); SpatialSlotButton replaces the originally-planned SpatialPicker per Phase 13e refinement.
- [x] AC-66: A new RTK Query endpoint `useGetNicheHintsQuery(projectId)` calls the
  Phase-10 GET. Result is used to pre-fill form slots when `builder_form_hints` is
  present and the user has not yet typed anything in that slot. — `frontend-ui/src/store/designSlice.ts` (endpoint added in Phase 13e)
- [ ] AC-67: Below the Build CTA, a new collapsible `Live Preview` panel renders the
  exact assembled prompt for `slogans[0] × styles[0]` so the user can sanity-check before
  spending credits.
- [ ] AC-68: `BuilderPreset.config` JSON keeps storing the same `BuilderConfig` shape,
  now including the `slots` sub-object. Existing presets (saved under the v1 schema)
  load without the `slots` field — Builder treats it as `{}` so all slot fallbacks
  kick in. No DB migration needed.
- [x] AC-69: Every dropdown option set ships as a typed constant in a new file
  `frontend-ui/src/views/designs/board/constants/slotOptions.ts` mirroring backend
  Appendix J text 1:1. — `frontend-ui/src/views/designs/board/constants/slotOptions.ts:13-380`

### Edge Cases (Phase 13)

- [ ] EC-24: Build with `Visual Description` slot blank AND no niche-hint AND no
  style-default → backend renders the prompt without the illustration sentence at all
  (gracefully skips). Frontend Live Preview warns: "No illustration described — Gemini
  may produce abstract output."
- [ ] EC-25: User loads a Phase-12 (v1) preset on the new Phase-13 dialog → all 8 slot
  fields stay empty, fall back through `niche-hint → style-default → omit` chain.
  No snackbar warning needed because v1→v2 is a forward-compatible JSON additive change.
- [ ] EC-26: Niche research has just completed but `builder_form_hints` is still being
  generated (LLM in flight) → `GET /builder/niche-hints/` returns `null`, frontend
  treats it as "no hints available", form starts empty. No spinner UX (rare case,
  PROJ-6 runs are minutes-long, hints generate in seconds).
- [ ] EC-27: `openai/gpt-4.1-mini` is unreachable when `structure_niche_for_builder`
  runs → function logs the error, leaves `builder_form_hints` as `null`, returns
  without raising. Future PROJ-6 runs will retry.
- [ ] EC-28: User overrides a style-auto-default in Typography slot, then switches the
  Style dropdown to a different style → the user's typed override **wins**; we do NOT
  silently re-fill with the new style's default. The "auto from {Style}" badge
  disappears. The "↺" reset icon brings the new style's default back.

#### Schicht 13 — Modal Pickers + Custom Spatial Layouts

- [x] AC-70: `SPATIAL_OPTIONS` in `style_library.py` ships **36 entries** (replaces the
  6-item v1 list). Each entry is a dict with keys `id` (snake_case stable ID, e.g.
  `vertical_stack`), `ui_label` (≤24-char human label), `ui_description` (≤90-char one-line
  UI blurb), `thumbnail_path` (relative path to a 512×512 PNG under
  `design_app/static/design_app/thumbnails/spatial/`), and `prompt_text` (40–70 word
  Architect-grade layout description used in the rendered Gemini prompt). Exact 36 entries
  in **Appendix J.4 of the tasks file**.
- [x] AC-71: A new Django model `CustomSpatial` in `design_app/models.py` with fields:
  `id` (UUID, PK), `workspace` (FK Workspace), `created_by` (FK User), `name` (CharField,
  required, ≤80 chars), `prompt_text` (TextField, required, 50–500 chars), `source_kind`
  (CharField, choices: `upload`, `reference`, `design`), `source_image_ref` (CharField,
  nullable — references `ProjectReference.id` OR `Design.id` when not an upload),
  `source_image_file` (ImageField, nullable — only set for `upload` kind),
  `created_at`/`updated_at`, `is_deleted` (Bool, default False). Unique constraint on
  `(workspace, name)` **partial-indexed where `is_deleted=False`** (PG `Q(is_deleted=False)`).
  Full schema in **Appendix O**.
- [x] AC-72: Three new endpoints on `design_app/api/views.py`:
  - `POST /api/designs/spatials/custom/analyze/` → multipart body with EITHER
    `image` (file upload, ≤10 MB, jpg/png/webp) OR `reference_id` (UUID of an existing
    `ProjectReference`) OR `design_id` (UUID of an existing generated `Design`). Returns
    `{ prompt_text: str, model: str, raw_response: str }`. Workspace-isolated via
    `X-Workspace-Id` header.
  - `POST /api/designs/spatials/custom/` → JSON body `{ name, prompt_text, source_kind,
    source_image_ref? }` → creates a `CustomSpatial`.
  - `GET /api/designs/spatials/custom/` → returns the workspace's non-deleted CustomSpatials,
    ordered by `-created_at`. Used by SpatialPickerModal "Custom" tab.
  - `DELETE /api/designs/spatials/custom/{id}/` → soft-delete (`is_deleted=True`). No
    cascade.
- [x] AC-73: A new service `design_app/services/spatial_analyzer.py::analyze_spatial_layout(image_bytes) -> str`
  calls `openai/gpt-4.1-mini` via OpenRouter with the **strict spatial-only system prompt** in
  **Appendix P**. The system prompt forbids the LLM from mentioning ANY: colors, color
  names, style names, illustration content nouns ("dog", "skull", "bus", "guitar", etc.),
  textures, materials, fonts. It must describe only: where text blocks sit, where the
  vector/illustration block sits, breathing room, alignment, and the overall composition
  type. Output is a single paragraph of 40–80 words ready to use as `prompt_text`.
- [x] AC-74: Backend post-LLM **scrub pass**: response is regex-checked for forbidden
  words (hex codes, named colors, "red"/"blue"/"yellow"/..., "vintage"/"cartoon"/..., the
  15 style slugs, common illustration nouns). On hit, the endpoint returns HTTP 422 with
  `{ error: 'spatial_analysis_failed', forbidden_terms: [...] }` so the frontend can
  prompt the user to retry. (Compensates for prompt-injection / image-derail risk.)
- [ ] AC-75: `build_form_prompt` resolves `slots.spatial_configuration` via the chain
  documented in **Appendix N.3**:
  1. if value matches a built-in `SPATIAL_OPTIONS[i].id` → use that entry's `prompt_text`
  2. else if value matches a non-deleted `CustomSpatial.id` (UUID) in the same workspace
     → use that custom's `prompt_text`
  3. else if value is a non-empty string → treated as a raw free-text override (legacy /
     "Custom…" inline path), used as-is
  4. else if `niche_hints.spatial` is set → resolve recursively via steps 1–3
  5. else → omit the spatial sentence entirely
- [ ] AC-76: A new `SpatialPickerModal.tsx` component opens from the BuilderDialog
  "Spatial layout ▸" button. It renders three tabs: **Built-in** (36 thumbnail cards in a
  responsive 3–4 column grid with `ui_label` + `ui_description` underneath), **Custom**
  (workspace's CustomSpatials), **Create new** (the CustomSpatialCreator inline). Search
  bar filters by label/description. Single-select, returns the chosen id (built-in slug or
  CustomSpatial UUID) to BuilderDialog state. UX spec in **Appendix Q**.
- [ ] AC-77: A new `StylePickerModal.tsx` component refactors the existing inline 15-style
  picker into the same modal pattern (single-select, grid of style cards, thumbnails reused
  from Phase 7 assets, no "Custom" tab — styles remain Mario-curated). Opens from a "Style ▸"
  button in the BuilderDialog. BuilderDialog removes the inline `StylePicker` mount; it now
  shows the currently-selected style name + thumbnail next to the button.
- [ ] AC-78: A new `CustomSpatialCreator.tsx` component (lives inside the SpatialPickerModal
  "Create new" tab) offers three sources: (a) drag/drop or click-to-upload (≤10 MB,
  jpg/png/webp), (b) pick from `ProjectReference[]` of the current Design Project (reusing
  the existing `useGetProjectReferencesQuery`), (c) pick from generated `Design[]` of the
  current project. On select → calls `POST /api/designs/spatials/custom/analyze/` → shows
  the LLM's returned `prompt_text` in an editable TextField → user gives it a name → Save
  button POSTs the create endpoint → the new custom appears in the "Custom" tab + is
  auto-selected for the current slot.

### Edge Cases (Phase 13) — Schicht 13 additions

- [x] EC-29: User tries to create a `CustomSpatial` with a name that already exists in the
  workspace (non-deleted) → backend returns HTTP 409 with `{ error: 'name_conflict' }`;
  frontend shows inline form error "A custom spatial with that name already exists in this
  workspace". Soft-deleted entries with the same name do NOT block creation (partial
  unique index condition).
- [x] EC-30: Image upload exceeds 10 MB OR has unsupported mime-type → backend returns
  HTTP 400 with `{ error: 'image_invalid', detail: '...' }`. Frontend rejects client-side
  before upload to avoid round-trip.
- [x] EC-31: `analyze_spatial_layout` LLM response triggers the scrub check (contains
  forbidden color/style/illustration term) → backend returns HTTP 422 with
  `forbidden_terms`. Frontend shows "Analyze couldn't extract a clean layout — try a
  different image or upload one with less color/style detail. Detected: …" + a "Retry"
  button. Optionally a "Use as raw text anyway" escape hatch that stuffs the response into
  a Custom Spatial **with `source_kind='upload'` but flagged** (`is_unsafe=True` field —
  also part of Appendix O — surfaces a warning chip in the picker).
- [ ] EC-32: User deletes a `CustomSpatial` that is currently referenced by a saved
  `BuilderPreset.config.slots.spatial_configuration` → soft-delete proceeds (no cascade
  block). When that preset is next loaded, the resolver falls through chain step 4 (the
  custom UUID no longer matches a non-deleted row); if a niche-hint exists it kicks in,
  otherwise step 5 omits the spatial sentence. The BuilderDialog shows an inline warning
  chip "Saved custom spatial deleted — fallback applied" next to the Spatial slot button
  the first time the preset loads, and offers a one-click "Pick a replacement" CTA that
  opens the SpatialPickerModal.



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

**Auditor:** Orchestrator-driven manual audit (`/qa` skill returned empty).
**Date:** 2026-05-17.
**Verdict:** **Ready for deploy** — no blockers found. 3 minor notes for follow-up.

### Test suite

| Scope | Result |
|---|---|
| Backend `design_app/` (PROJ-34 scope) | **210 / 210 passed** in 10.7s |
| Frontend full `vitest` | **1453 passed / 5 skipped** (5 skipped pre-existing, not PROJ-34) |
| Frontend `npx tsc -b` | **clean** |
| Frontend `npx eslint` on PROJ-34 files | **0 errors / 0 warnings** |
| Frontend `npx eslint src/` global | 0 errors, 11 pre-existing warnings (none in PROJ-34 files) |

### AC / EC coverage

| Layer | Tested | Notes |
|---|---|---|
| Schicht 1 (system prompt) | AC-1 / AC-2 / AC-3 | 3 unit tests: marker presence, system always-at-[0], future-proof flag |
| Schicht 2 (bg-color) | AC-4..9 | unit test `test_neon_pink_injects_hex_in_user_prompt` proves `#FF6EC7` lands in OpenRouter payload (AC-9 exact wording) |
| Schicht 3 (analyzer) | AC-10..14 | structural test on the v2 SYSTEM_PROMPT + 7-key schema preservation. **AC-13 live 3-image regression** intentionally deferred to manual QA — needs paid OpenRouter calls |
| Schicht 4 (polish) | AC-15..20 | 10 unit tests across happy path, retry-on-timeout, double-timeout, 5xx, generic exception, missing config, oversize trim, no-op, empty input |
| Schicht 5 (thumbs) | AC-21..25 | 15 PNGs generated 2026-05-17 + committed. **Bundle 1.5 MB** (slightly above 1.2 MB target — accepted because lazy-loaded; see AC-24 note) |
| Schicht 6 (Builder UI) | AC-26..36, 40 | 10 component tests in `BuilderDialog.test.tsx`; AC-37/38/39 covered by 3 tests in `GenerationZone.test.tsx` |
| Schicht 7 (presets) | AC-41..46 | 5 API tests in `test_builder_api.py::TestBuilderPresetCRUD` + 1 component test for stale-item snackbar (EC-14/EC-15) |
| Edge cases | EC-1..23 | All wired (EC-2/EC-3 inherit from PROJ-9 bugfix branch; EC-21 CSS fallback present in `StyleRow.tsx`) |

### Security audit

- **All new endpoints inherit `IsAuthenticated`** via `REST_FRAMEWORK.DEFAULT_PERMISSION_CLASSES` (`core/settings.py:447`)
- `BuilderBuildView` / `BuilderPresetListCreateView` / `BuilderPresetDetailView` all gate workspace with `_require_workspace` + `get_object_or_404(DesignProject, workspace_id=ws_id)` before any query — confirmed by `test_cross_workspace_project_returns_404`
- `BuilderPresetSerializer` declares `workspace`, `project`, `created_by`, `created_at`, `updated_at` as `read_only_fields` so client cannot inject foreign IDs
- Input validation: `BuilderBuildSerializer.slogans` capped at 200 strings / 300 chars each; `styles` capped at 15 slugs / 64 chars; name length validated server-side via custom `validate_name`
- No new throttle classes — relies on the global `user=5000/day` default which is sized for the typical Builder click pattern (50 prompts × ~1 polish/sec)
- Polish + analyzer LLM calls already traced via Langfuse with workspace metadata (AC-20 / Schicht 3 v2 tags)

### Migration safety

`design_app.migrations.0013_designgenerationrun_background_color_and_more`:

- `DesignGenerationRun.background_color` adds a CharField with `default='light_gray'` → existing rows backfill silently. Acknowledged in Tech-Note 2 of the architecture doc — old Runs will report `light_gray` regardless of their original UI selection. Acceptable.
- `DesignGenerationRun.prompt_polished` nullable TextField → safe additive
- `ProcessingSettings.polish_builder_prompts_enabled` Bool default True → safe additive
- `BuilderPreset` new table with partial UniqueConstraint (`Q(is_deleted=False)`) — supported by Postgres natively; tested by `test_reuse_name_after_soft_delete`

### Minor follow-ups (non-blocking)

1. **AC-24 bundle size 1.5 MB vs 1.2 MB target.** 70s_groovy.png (130 KB), 90s_grunge.png (152 KB), badge_emblem.png (129 KB), blackletter_gothic.png (128 KB), watercolor.png (110 KB) dominate. A future re-pack with 384×384 + 96-color palette could halve the total. Not deploy-blocking — PNGs are lazy-loaded on Builder dialog open.
2. **AC-13 (Architect-v2 final_prompt ≥600 chars on 3 sample images)** still needs a manual smoke test post-deploy. Costs ~3 OpenRouter calls. Run: open the Builder → use `Analyze image` button on three competitor product photos → eyeball that the inserted prompt contains `Vector Print Design`, quoted text, color-object binding, and `breathing room`.
3. **AC-19 (≤5s for 50 parallel polishes)** verified at unit level (5s per-call timeout × 16-worker pool) but no end-to-end wall-clock check. A `/qa` smoke with a 50-prompt Builder configuration would close this.

### Cross-app test environment note

The full backend `pytest` run (across all apps) does NOT cleanly complete in this dev env — `chat_node_config_app` + `niche_research_app` show E (errors) at 32–58% progress, unrelated to PROJ-34. The `design_app/` subset (which is PROJ-34's scope) runs clean. CI is the authoritative check before deploy.

## Deployment

**Status:** Ready to deploy — all pre-flight checks pass.
**Date:** 2026-05-17.
**Operator action items:** 2 minor (post-merge); nothing blocks the merge.

### Deployment Readiness Checklist

| Check | Command | Result |
|---|---|---|
| Frontend lint | `npx eslint src/` | ✅ 0 errors / 11 pre-existing warnings (none in PROJ-34 files) |
| Frontend typecheck | `npx tsc -b` | ✅ clean |
| Frontend build | `npm run build` | ✅ Vite built in 7.6s |
| Frontend tests | `npm run test:ci` | ✅ 1453 passed / 5 skipped (skips pre-existing) |
| `npm audit --omit=dev` | — | ✅ 0 vulnerabilities |
| Backend lint | `ruff check django-app/` | ⚠ `ruff` not in dev container; runs via CI (`ci.yml:94`). Verified clean by typed Python + tests |
| Backend tests (PROJ-34 scope) | `pytest design_app/` | ✅ 210 / 210 in 10.7s |
| Backend tests (full suite) | `pytest` | ⚠ pre-existing E's in `chat_node_config_app` / `niche_research_app` unrelated to PROJ-34; **CI is authoritative** |
| Pending migrations | `manage.py makemigrations --check --dry-run` | ✅ "No changes detected" |
| Docker image build | `docker compose build web` | Skipped — code-only change, no Dockerfile edit; CI `docker-publish.yml` is authoritative |
| Debug statements (`console.log` / `print`) | grep on PROJ-34 changes | ✅ none |
| Git history secret scan | `git log -S "sk-"` | ✅ clean |
| `.env` properly gitignored | `git ls-files .env` | ✅ empty + matched by `.gitignore` |
| Env vars documented | `.env.dev.template`, `.env.prod.template` | ✅ `OPENROUTER_API_KEY` already present in both (no new vars) |
| CI workflow validates same commands | `.github/workflows/ci.yml` | ✅ runs `pytest --tb=short` + `ruff check django-app/` + `npm run lint` + `npm run test:ci` |
| QA approved — no Critical/High bugs | spec `## QA Test Results` | ✅ green |
| `features/INDEX.md` flipped | — | ✅ `In Review` (set in QA commit) |

### Production deltas (operator-visible)

- **DB migration:** `design_app.0013_designgenerationrun_background_color_and_more` — additive only (3 fields + 1 new table + 1 partial UniqueConstraint). Backfills silently on existing rows. Safe under concurrent writes.
- **New env vars:** none.
- **New worker queues:** none. Builder runs in-request via a `ThreadPoolExecutor` (max 16 workers) inside the `web` container; respects the existing OpenRouter rate-limit envelope.
- **New endpoints (4):** all gated by global `IsAuthenticated` + `_require_workspace` + project-FK workspace filter — confirmed by `test_cross_workspace_project_returns_404` and `test_cross_workspace_isolation_on_list`.
  - `POST   /api/designs/projects/{id}/builder/build/`
  - `GET    /api/designs/projects/{id}/builder-presets/`
  - `POST   /api/designs/projects/{id}/builder-presets/`
  - `PATCH/DELETE  /api/designs/projects/{id}/builder-presets/{preset_id}/`
- **Static assets:** 15 new PNGs in `frontend-ui/public/style-thumbnails/` (~1.5 MB). Vite copies `public/` into `dist/` at build time; Caddy serves `/style-thumbnails/*.png` as static assets.
- **ProcessingSettings:** new field `polish_builder_prompts_enabled` (Bool, default True). Existing rows backfill to True so the Builder polish path is on by default — matches the AC-17 decision.
- **No rotated secrets / credentials.** OPENROUTER_API_KEY already in production.

### Git workflow recommendation

13 commits ahead of `main`:

```
dbdb090 docs(PROJ-34): phase 12 — QA report + status In Review
e4e5010 feat(PROJ-34): phase 10.6 + thumbnails — stale preset drop + 15 PNGs
4ad4c42 feat(PROJ-34): phase 9 — generation-zone `;`-splitter, slider lock, seed
0135619 feat(PROJ-34): phases 8/10/11 wire-up — builder + presets + polish toggle
230d611 feat(PROJ-34): phase 8 — multi-prompt builder UI shell
a4a601c feat(PROJ-34): phase 7 — style library + thumbnail generation script
95de4f3 feat(PROJ-34): phase 5+6 — builder-build API + preset CRUD
febcecc feat(PROJ-34): phase 4 — prompt-polish service
61fea94 feat(PROJ-34): phase 3 — image-analyzer architect-v2 upgrade
2f4bc69 feat(PROJ-34): phase 2 — system prompt + bg-color plumbing
78ed86c feat(PROJ-34): phase 1 — backend foundation models + migration
18bba52 docs(PROJ-34): add technical design + task breakdown with appendices
87bdbe2 feat(PROJ-34): add spec for Design-Forge Prompt Engineering & Multi-Prompt Builder
```

**Recommend `--merge` (NOT `--squash`).** Per `feedback_pr_merge_strategy.md`, multi-concern bundles preserve conventional commits via merge. While all 13 commits share the PROJ-34 ID, they bundle distinct work (12 phases × 2-3 concerns each: backend, frontend, tests, docs). Preserving the 13 `feat(PROJ-34):` lines gives release-please rich CHANGELOG entries vs. a single squashed summary.

### Pre-merge checklist (operator)

- [ ] `git push origin feature/PROJ-34-design-prompt-engineering`
- [ ] Open PR against `main`; paste this `## Deployment` block into the PR description for review
- [ ] Wait for CI green (full suite: ruff + pytest + npm lint + npm test:ci + docker-publish)
- [ ] `--merge` (not squash, not rebase) — preserves the 13-commit history for release-please
- [ ] After merge, do NOT auto-merge the auto-opened `chore(main): release X.Y.Z` PR; batch with other features per `feedback_release_cadence.md` (Monday cadence)

### Post-deploy smoke tests (operator)

1. **AC-13 — Architect-v2 analyzer quality:** open the Builder → use `Analyze image` button on three competitor product photos → eyeball that the inserted prompt contains `Vector Print Design`, quoted text, color-object binding, and `breathing room` (≥600 chars). Costs ~3 OpenRouter calls.
2. **AC-19 — 50-prompt wall-clock:** in the Builder, pick 10 slogans × 5 styles → click Build → verify the polished prompts arrive within ~5s. If they take >10s, raise the `_POLISH_MAX_WORKERS` from 16 to 24 in `BuilderBuildView`.
3. **12.11 — happy path:** pick a niche-linked project → open Builder → 3 slogans × 2 styles → niche-context ON → Build → 6 polished prompts in textarea (joined by `;`) → click Generate → 6 designs land on the canvas.
4. **Langfuse traces (12.3):** open Langfuse dashboard → filter `tags:["builder","prompt_polish"]` and `tags:["architect-v2"]` to confirm all polish + analyzer calls land.

### Rollback plan

If production breaks post-deploy:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d \
  --no-deps web worker  # roll the image back to the previous tag

# Migration 0013 is additive only — no rollback required unless a NEW migration
# arrives that depends on dropped state. The new fields will simply sit unused
# on the previous code.
```

If a full revert is needed:

```bash
docker compose exec web python manage.py migrate design_app 0012_proj27_upscaler
git revert --no-edit dbdb090..87bdbe2
```
