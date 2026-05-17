# PROJ-34: Design-Forge Prompt Engineering & Multi-Prompt Builder — Task Breakdown

> Spec: [features/PROJ-34-design-prompt-engineering.md](../../features/PROJ-34-design-prompt-engineering.md)
> Last updated: 2026-05-17

Each phase below maps to a coherent reviewable PR. Tasks are checked off by implementation skills (`/backend`, `/frontend`) as they land. Cross-references to AC-* / EC-* point back to the spec.

---

## Phase 1 — Backend Foundation (Migrations + Models)

- [x] 1.1 Add `background_color` CharField (choices=`Design.BackgroundColor`, default=`light_gray`) to `DesignGenerationRun` model — covers AC-4
- [x] 1.2 Add `prompt_polished` TextField (nullable, blank=True) to `DesignGenerationRun` — covers Tech Design row for debugging
- [x] 1.3 Add `polish_builder_prompts_enabled` BooleanField (default `True`) to `ProcessingSettings` — covers AC-17
- [x] 1.4 Create `BuilderPreset` model — fields & FK rules per **Appendix F**. UUID PK, workspace+project=CASCADE, created_by=SET_NULL, db_index on (project, is_deleted) — covers AC-41
- [x] 1.5 Add partial `UniqueConstraint(fields=['project','name'], condition=Q(is_deleted=False), name='builderpreset_unique_name_per_project_active')` — covers EC-19. Pattern in **Appendix F**
- [x] 1.6 Generate and apply migrations: `python manage.py makemigrations design_app && python manage.py migrate`
- [x] 1.7 Update Django admin: register `BuilderPreset` (list_display: workspace/project/name/created_by) for ops debugging
- [x] 1.8 Add `BuilderPresetSerializer` (ModelSerializer, `read_only_fields=['id','workspace','project','created_by','created_at','updated_at']`, validates `name` length ≤ 80 + non-empty)

## Phase 2 — System Prompt + BG-Color Plumbing

- [ ] 2.1 Define `DESIGN_GEN_SYSTEM_PROMPT` constant — use the **draft text in Appendix A** verbatim, adjust only if review feedback requires — covers AC-1
- [ ] 2.2 Modify `generate_image()` to always send `DESIGN_GEN_SYSTEM_PROMPT` as `{role: 'system'}` message before the user message — covers AC-2
- [ ] 2.3 Convert `MODEL_MAP` from flat `{db_value: openrouter_id}` to nested `{db_value: {real_id, supports_system_role}}` per **Appendix B**; threading verified by tests — covers AC-3
- [ ] 2.4 Modify `_build_content()` to append `"Background: solid {HEX}, saturated, no gradients, flat single color background"` (using `Design.BG_COLOR_HEX[background_color]`) as the final segment of the user message — covers AC-7
- [ ] 2.5 Add `background_color` parameter to `generate_image()` signature; thread through from `task_generate_design` — covers AC-6
- [ ] 2.6 Add `background_color` field to `StandaloneGenerateSerializer`, `GenerateFromPromptSerializer`, `IdeaGenerateSerializer` (already exists but verify) and persist onto `Run` — covers AC-5
- [ ] 2.7 Modify `task_generate_design()` to read `run.background_color` instead of guessing; pass to `generate_image()` — covers AC-6
- [ ] 2.8 Delete `_get_bg_from_prompt()` helper from `tasks.py`; `Design.background_color` now set directly from `run.background_color` — covers AC-8
- [ ] 2.9 Write unit test: `neon_pink` selection results in `#FF6EC7` in OpenRouter payload — covers AC-9
- [ ] 2.10 Write unit test: every payload contains the system message — covers AC-2
- [ ] 2.11 Add EC handling: log warning if system + user message exceeds Gemini context window (rare) — covers EC-4

## Phase 3 — Image-Analyzer Upgrade (Button-Triggered Only)

- [ ] 3.1 Replace `image_analyzer.SYSTEM_PROMPT` with 9-Architect-Rule framework copied from `docs/design-prompts/knowledge.md` lines 1–57 — covers AC-10
- [ ] 3.2 Verify 7-step JSON output schema unchanged by running existing `test_image_analyzer.py` — covers AC-11
- [ ] 3.3 Regression test against 3 sample reference images: assert `final_prompt` ≥600 chars and contains: `Vector Print Design`, quoted text, color-object binding, `breathing room` — covers AC-13
- [ ] 3.4 Verify NO change to `image_analyzer.analyze_image()` call site — analyzer remains button-triggered only — covers AC-14
- [ ] 3.5 Update Langfuse trace tags to mark this as the v2 Architect-upgrade analyzer (helps comparing pre/post quality)

## Phase 4 — Prompt-Polish Service

- [ ] 4.1 Create `design_app/services/prompt_polish.py` with `polish_prompt(raw: str, model: str = ...) -> str` — covers AC-15
- [ ] 4.2 Use polish model = `google/gemini-2.5-flash-lite` (pending user confirmation of Tech Note 1 — could be `3.1-flash-lite` once available)
- [ ] 4.3 Build polish system message: "polish grammar and flow only; preserve every concrete detail; output only the polished prompt, no preamble"
- [ ] 4.4 Set 5-second timeout via `httpx.AsyncClient` — covers AC-19
- [ ] 4.5 Implement retry-once on timeout (per existing pattern in `image_generator.py`)
- [ ] 4.6 Add Langfuse trace per polish call with input/output/usage — covers AC-20
- [ ] 4.7 On failure (timeout / 5xx / quota), return raw input + log WARN; never raise — covers AC-18 / EC-5 / EC-8
- [ ] 4.8 EC: if polished output > 2000 chars, truncate at last sentence boundary < 2000 — covers EC-5
- [ ] 4.9 EC: if polished output is empty or unchanged, fall through with raw input (no-op) — covers EC-6
- [ ] 4.10 Write unit tests covering happy path, timeout, 5xx, empty response, oversize response

## Phase 5 — Builder-Build API

- [ ] 5.1 Create `BuilderBuildSerializer` (input: `slogans: list[str]`, `styles: list[str slug]`, `warp?: str`, `background_color: str`, `with_polish: bool`, `include_niche_context: bool`)
- [ ] 5.2 Create `BuilderBuildView(APIView)` at `POST /api/designs/projects/{id}/builder/build/`
- [ ] 5.3 Add `build_architect_prompt(slogan, style_entry, warp?, niche_context?, bg_hex)` helper in `prompt_builder.py` — uses the **Builder template + placeholder mapping from Appendix C**. Returns a single string ≤ 1500 chars
- [ ] 5.4 In view: generate cross-product of slogans × styles → list of raw prompts via `build_architect_prompt`
- [ ] 5.5 In view: optionally inject niche-context per **Appendix D format** when `include_niche_context=True` AND `project.niche` has research data — covers AC-33
- [ ] 5.6 If `with_polish=True` AND workspace `polish_builder_prompts_enabled=True`: run polish in parallel via `asyncio.gather` — covers AC-16, AC-19
- [ ] 5.7 Response shape: `{prompts: list[str]}` in input order — covers AC-36
- [ ] 5.8 Permission check: requires `IsAuthenticated` + project workspace match — covers existing security pattern
- [ ] 5.9 Validation: 400 if no project niche AND `include_niche_context=True` — covers EC-23
- [ ] 5.10 Validation: 400 if `slogans=[]` OR `styles=[]` — covers EC-9, EC-10
- [ ] 5.11 Wire URL in `design_app/api/urls.py`
- [ ] 5.12 Write API tests: happy path 5×3, with/without polish, with/without niche-context, empty inputs

## Phase 6 — Builder-Preset API

- [ ] 6.1 Create `BuilderPresetViewSet(ModelViewSet)` with list / create / partial_update / destroy actions — covers AC-42
- [ ] 6.2 Override `destroy()` to soft-delete (`is_deleted=True`) instead of DB delete — covers AC-46
- [ ] 6.3 Filter queryset to `is_deleted=False` and `workspace=request.workspace` and `project=URL.pk` — security
- [ ] 6.4 Wire URL: `/api/designs/projects/{id}/builder-presets/` (router-based)
- [ ] 6.5 Add `Validation: unique name per project among non-deleted` — covers EC-19
- [ ] 6.6 Add `created_by` auto-set from `request.user` on create
- [ ] 6.7 Write API tests: CRUD happy path, soft-delete behaviour, unique-name conflict, cross-workspace isolation

## Phase 7 — Style Library + Build Script

- [ ] 7.1 Create `scripts/generate_style_thumbnails.py` with CLI args `--slug` (single) and `--force` (regenerate all)
- [ ] 7.2 Script iterates the 15 style slugs (per AC-22), calls `generate_image()` with fixed prompt: `"a smiling cartoon taco mascot, centered, isolated on white background, {STYLE_PROMPT_SUFFIX}"`
- [ ] 7.3 Save 1024×1024 PNGs to `frontend-ui/public/style-thumbnails/{slug}.png`
- [ ] 7.4 Re-compress PNGs via PIL with `optimize=True` + 8-bit quantize to palette (`.convert('P', palette=Image.ADAPTIVE, colors=256)`) targeting ≤80KB each — covers AC-24
- [ ] 7.5 Idempotency: skip styles whose thumbnail already exists unless `--force` — covers AC-25
- [ ] 7.6 Abort with clear error if `OPENROUTER_API_KEY` env missing — covers EC-22
- [ ] 7.7 Run script once; commit all 15 PNGs to git
- [ ] 7.8 Create `frontend-ui/src/views/designs/board/constants/styleLibrary.ts` populated from the **15-entry table in Appendix E** (slug + label + shortDescription + thumbnail path + promptSuffix) — covers AC-23

## Phase 8 — Frontend Builder Renovation

- [ ] 8.1 Remove from `PromptBuilderDialog.tsx`: `web_research` toggle, `keywords` toggle, `variant_index` mechanism, related dead code — covers AC-26
- [ ] 8.2 Layout `PromptBuilderDialog` per AC-27 structure (Preset Bar → Slogans → Styles → Warp → Niche-Toggle → Reference indicator → Build counter → Build CTA)
- [ ] 8.3 Build `SloganPicker.tsx`: MUI multi-select chip-list from `ProjectIdea` pool + multi-line `TextField` for free-text — covers AC-28
- [ ] 8.4 Build `StylePicker.tsx`: vertical list of 15 rows (56×56 thumbnail + label + 1-line desc); click toggles selection — covers AC-29
- [ ] 8.5 Build selected-style chip row above the StylePicker list — covers AC-30
- [ ] 8.6 Build `WarpPicker.tsx`: MUI `Select` with 4 options + 1 empty/none — covers AC-32
- [ ] 8.7 Build `NicheContextToggle.tsx`: MUI Switch with disabled-state tooltip — covers AC-33, EC-16, EC-23
- [ ] 8.8 Build `BuildCounter.tsx`: shows `Build {N×M} prompts`; disabled state when N=0 OR M=0 — covers AC-34
- [ ] 8.9 Build `BuildConfirmDialog.tsx`: shown only when N×M > 30 — covers AC-35, EC-11
- [ ] 8.10 RTK Query mutation `useBuildPromptsMutation` calling `POST /api/designs/projects/{id}/builder/build/`
- [ ] 8.11 On Build click: POST → join response with `; ` → replace textarea content → auto-toggle `Parallel Prompts` ON — covers AC-36
- [ ] 8.12 Manual-edit protection per **Appendix G**: hold `lastBuildOutput` in a `useRef<string|null>` inside `useWorkspaceGeneration`; on each Build click, compare `prompt === lastBuildOutput.current`. If different (user edited), show MUI Dialog `Replace your manual edits with newly-built prompts?` before overwriting — covers AC-40, EC-12
- [ ] 8.13 Reference indicator inside Builder shows current `sourceImageUrl` from RightPanel (read-only)

## Phase 9 — Frontend Generation-Zone Changes

- [ ] 9.1 Change Parallel-Prompts splitter from `\n` to `;` in `useGeneration.ts` (or wherever the multi-prompt expansion lives) — covers AC-37
- [ ] 9.2 Remove all references to newline-as-separator (backwards compat removed)
- [ ] 9.3 In `GenerationZone.tsx`: when textarea contains ≥2 `;`-separated entries AND `Parallel Prompts` ON, disable Images slider with MUI Tooltip `Locked to 1 while multi-prompt is active` — covers AC-38
- [ ] 9.4 Single-prompt mode + `Images > 1`: fire N parallel `generate_image` calls via N separate POSTs to `/api/designs/generate/` — covers AC-39
- [ ] 9.5 **Confirmed via OpenRouter probe (see Appendix H): ALL 5 image models support `seed` parameter.** Implement seed pass-through: backend `generate_image()` accepts `seed: int` kwarg, forwards to OpenRouter payload. Frontend sends deterministic seed `hash(run_id, variant_index)` per parallel call
- [ ] 9.6 ~~Style-modifier fallback~~ — **NOT NEEDED** given AC-39 user-confirmed "Beide kombiniert"; we keep prompt-suffix `(variation N of M)` as a soft hint AND seed for hard determinism. See **Appendix H** for the decision and a Re-Review flag for the user
- [ ] 9.7 Style-modifier pool constant — moved to optional/future; not in this PR's scope unless seed-variation proves insufficient in QA
- [ ] 9.8 Test: Images=4 single-prompt → 4 distinct designs in DB linked to 4 distinct Runs

## Phase 10 — Frontend Preset UI

- [ ] 10.1 Build `PresetBar.tsx`: MUI Select dropdown for preset names + "Save as Preset" inline TextField + Delete icon
- [ ] 10.2 RTK Query for preset CRUD: `useListPresetsQuery`, `useCreatePresetMutation`, `useRenamePresetMutation`, `useDeletePresetMutation` — covers AC-42, AC-43
- [ ] 10.3 On preset select: load `config` JSON into Builder form fields — covers AC-43, AC-45
- [ ] 10.4 On "Save as Preset" click: open inline TextField for name; POST current Builder config → preset becomes selected — covers AC-44
- [ ] 10.5 On Delete icon click: `window.confirm("Delete preset \"{name}\"?")` → if confirmed, DELETE — covers AC-46
- [ ] 10.6 EC: silently drop missing slogans/styles from loaded preset + show snackbar `"X items from this preset were skipped..."` — covers EC-14, EC-15
- [ ] 10.7 Preset survives reload — tested by E2E

## Phase 11 — Workspace Settings UI for Polish Toggle

- [ ] 11.1 **Confirmed location (Appendix I)**: edit `frontend-ui/src/views/designs/workspace/ProcessingSettingsDialog.tsx` — the existing per-project Processing Settings dialog. (Note: `frontend-ui/src/views/settings/` exists but is for workspace-level entitlement / user settings — not the right home for design-pipeline toggles.)
- [ ] 11.2 Add MUI Switch `Auto-polish Builder prompts` bound to `ProcessingSettings.polish_builder_prompts_enabled` — covers AC-17
- [ ] 11.3 Add tooltip explaining purpose: "When enabled, prompts created by the Prompt Builder are polished by a small LLM before generation. Adds ≤5s per Build, costs sub-cent per Build. Does not affect free-typed prompts."
- [ ] 11.4 Extend the existing RTK Query `updateProcessingSettings` mutation in `designSlice.ts` to include the new field (no new endpoint needed — `ProcessingSettings` PATCH already supports field updates)
- [ ] 11.5 EC: if user turns polish OFF mid-session, next Build sends `with_polish: false` — covers EC-7

## Phase 12 — Tests, QA, Cleanup

- [ ] 12.1 Backend: end-to-end test for Builder Build flow (5 slogans × 3 styles, with polish ON, with niche-context ON) producing 15 polished prompts
- [ ] 12.2 Backend: regression test confirming `_get_bg_from_prompt` is gone and bg-color comes from Run
- [ ] 12.3 Backend: verify Langfuse traces appear for all polish calls (manual smoke test)
- [ ] 12.4 Frontend: component test for each new component (`SloganPicker`, `StylePicker`, `WarpPicker`, `NicheContextToggle`, `PresetBar`, `BuildCounter`, `BuildConfirmDialog`)
- [ ] 12.5 Frontend: integration test for full Builder → Build → textarea-insert → Generate flow
- [ ] 12.6 Frontend: integration test for Preset save → reload → load
- [ ] 12.7 Lint: `npm run lint` → 0 errors
- [ ] 12.8 Typecheck: `npx tsc -b` → 0 errors
- [ ] 12.9 Backend tests: `docker compose exec web pytest` → all green
- [ ] 12.10 Run `/qa` skill for full acceptance audit against spec AC-* + EC-* checklist
- [ ] 12.11 Manual smoke test on localhost: pick "school bus driver" project → open Builder → select 3 slogans + 2 styles → niche-context ON → Build → confirm 6 polished prompts in textarea → Generate → 6 designs land in the canvas
- [ ] 12.12 Run `/deploy` skill once QA passes

---

## Estimated Effort

| Phase | LOC (rough) | Backend | Frontend |
|---|---|---|---|
| 1 — Foundation | ~150 | ✓ | |
| 2 — System Prompt + BG | ~200 | ✓ | |
| 3 — Analyzer Upgrade | ~80 | ✓ | |
| 4 — Polish Service | ~150 | ✓ | |
| 5 — Build API | ~300 | ✓ | |
| 6 — Preset API | ~200 | ✓ | |
| 7 — Style Library | ~250 + 15 PNGs | ✓ | ✓ |
| 8 — Builder UI | ~800 | | ✓ |
| 9 — GenZone Changes | ~200 | | ✓ |
| 10 — Preset UI | ~400 | | ✓ |
| 11 — Settings UI | ~100 | | ✓ |
| 12 — Tests + QA | ~600 | ✓ | ✓ |
| **TOTAL** | **~3400 LOC** | | |

Realistic dev time (single-dev): **8–12 working days**. With Claude pair: **3–4 days**.

---

# Appendices — concrete drafts that implementation will copy/paste

> These appendices contain the actual text, structures, and mapping that the tasks above reference. Treat them as the source-of-truth drafts; if review finds something off, edit the appendix and the task will inherit.

---

## Appendix A — `DESIGN_GEN_SYSTEM_PROMPT` draft

> Goes into `design_app/services/image_generator.py` as a module-level constant. Sent as `role: system` message before the user message on every `generate_image()` call (per AC-2).

```text
You are a Print-on-Demand (POD) vector design generator producing artwork for Merch-by-Amazon T-shirt listings. Your only output is a print-ready isolated graphic — never a t-shirt mockup, never a model wearing the design, never a product photograph, never a scene with the design in context. The output is the design itself, isolated, on the requested background color.

## Hard rules — never violate

1. NEVER produce a t-shirt, hoodie, mug, sticker mockup, or any other product as the output. Output ONLY the printable design / artwork / graphic itself.
2. NEVER include a person, body part, or model. The output is product-photo-free and human-free.
3. NEVER include scene context (no rooms, no backgrounds beyond a solid color, no environments).
4. ALWAYS render the design centered, with generous padding and breathing room around all elements — no edge-to-edge text or imagery.
5. ALWAYS honor the background color specified at the end of the user prompt (look for "Background: solid #HEX, ..."). The output background MUST be that exact solid color, flat, no gradients.
6. Text inside the design MUST be inside double quotes in the prompt; render it as a physical typographic element with material properties (matte vinyl, glossy plastisol ink, screenprint flat).
7. Use color-object binding: when a color is named, bind it to a specific element ("golden yellow bus body", "white hand-drawn marker font") rather than describing colors in isolation.
8. Maintain hard vector edges, no anti-aliasing softness, no JPEG noise, no film grain unless explicitly requested as part of a vintage/distressed style.
9. The output is print-ready: high contrast, clean outlines, commercial vector art, screen print ready, hard edges, no unnecessary gradients, vector sharpness, 300 DPI quality.

## Style adherence

If the user prompt names a style (e.g. "vintage retro", "kawaii chibi", "halftone print"), the entire design adopts that style consistently — typography, color palette, line treatment, shading, and texture all match the named style.

## Format reminder

The user prompt may include warp instructions (e.g. "Arc Lower warp: top straight, bottom curved") for text shaping. Apply the warp to the typographic element only, not to the illustration.

The user prompt ends with the background-color instruction. That line is NOT decorative — it is the exact color of the canvas behind the design.
```

**Notes:**
- ~330 words / ~2100 chars — well within Gemini's system-message budget.
- Encodes 9 of the Architect Critical Rules from `docs/design-prompts/knowledge.md` plus the design-only / no-person / no-mockup hard rules.
- If a future style requires breaking a rule (e.g. "intentionally distressed grain" violates Hard Rule 8), add an exception clause to the corresponding style entry's `promptSuffix` rather than weakening this constant.

---

## Appendix B — `MODEL_MAP` restructure

> Today `image_generator.MODEL_MAP` is `{db_value: openrouter_id}`. To carry the `supports_system_role` flag (and any future per-model flags), restructure to a nested mapping.

**Before** (existing):
```text
MODEL_MAP = {
    'google/gemini-3.1-flash-preview-image-generation':
        'google/gemini-3.1-flash-image-preview',
    'openai/gpt-5-image': 'openai/gpt-5-image',
    # ...
}
```

**After** (target):
```text
MODEL_MAP = {
    'google/gemini-3.1-flash-preview-image-generation': {
        'openrouter_id': 'google/gemini-3.1-flash-image-preview',
        'supports_system_role': True,
        'supports_seed': True,
    },
    'openai/gpt-5-image': {
        'openrouter_id': 'openai/gpt-5-image',
        'supports_system_role': True,
        'supports_seed': True,
    },
    # ...
}
```

**Migration steps inside the file:**
1. Update the dict definition.
2. Replace every `MODEL_MAP[db_value]` lookup with `MODEL_MAP[db_value]['openrouter_id']`.
3. Add `MODEL_MAP[db_value]['supports_system_role']` check in `_build_messages()` to decide system-vs-prepend strategy.
4. Add `MODEL_MAP[db_value]['supports_seed']` check in the seed-pass-through code path.

All current models support both flags (per Appendix H probe) — defaults are `True`. The flags exist to keep the code defensive against future model additions.

---

## Appendix C — `build_architect_prompt()` template + placeholder mapping

> The Builder produces N×M prompts. Each prompt is generated *deterministically* from the inputs (no LLM call yet — polish happens later as Phase 4). The template is derived from the Architect 7-step framework but ADAPTED for forward-construction (slogan + style → prompt) rather than reverse-engineering (image → prompt).

**Template (Python f-string-style, conceptual):**

```text
{style.label} t-shirt design centered on a {bg_hex} background. The design features the slogan text "{slogan}" rendered as a physical typographic element with {style.typography_hint}. {style.illustration_hint}. {warp_phrase if warp else ''} {niche_block if niche_context else ''} Color palette: {style.palette_hint}. Layout: centered composition with generous padding and breathing room between all elements. Materials: {style.material_hint}. High contrast, clean outlines, commercial vector art. Screen print ready, hard edges, vector sharpness, 300 DPI.
```

**Placeholder → Source mapping:**

| Placeholder | Source |
|---|---|
| `{style.label}` | `styleLibrary.ts[slug].label` (e.g. "Vintage Retro") |
| `{slogan}` | One slogan string from the Builder's slogan list |
| `{bg_hex}` | `Design.BG_COLOR_HEX[background_color]` (e.g. `#FF6EC7`) |
| `{style.typography_hint}` | Substring from `style.promptSuffix` covering font/typography aspect (extracted by structured `promptSuffix` schema — see Appendix E) |
| `{style.illustration_hint}` | Substring from `style.promptSuffix` covering illustration/graphic aesthetic |
| `{style.palette_hint}` | Substring from `style.promptSuffix` covering colors |
| `{style.material_hint}` | Substring from `style.promptSuffix` covering texture/material |
| `{warp_phrase}` | Mapping below (4 options) |
| `{niche_block}` | Per Appendix D |

**Warp → prompt-phrase mapping** (per `docs/design-prompts/knowledge.md`):

| Warp slug | Phrase |
|---|---|
| `arc_lower` | `The text uses an 'Arc Lower' warp: the headline remains straight at the top but arches downwards at the bottom to frame the illustration.` |
| `concave_squeeze` | `The typography uses a concave 'bowtie' warp, with massive tall letters on the far left and right flanks that strictly taper down to a smaller size in the center.` |
| `bulge` | `The typography features a convex bulge, making the center words massive and dominant while the edges taper off.` |
| `flag_wave` | `The text flows in a sinuous 'flag wave' motion, rising on the left and dipping on the right.` |

**Implementation note:** Since the `style.promptSuffix` is currently a single string (per Appendix E), the `build_architect_prompt()` initial implementation will use it as a single block in place of the four `{style.*_hint}` placeholders. The structured-suffix refactor (splitting into typography/illustration/palette/material sub-fields) is a follow-up if Builder output quality is insufficient.

**Simpler initial template** (recommended for Phase 5):
```text
{style.label} t-shirt vector design centered on a {bg_hex} background. The design features the slogan text "{slogan}" as the primary typographic element. {style.promptSuffix}. {warp_phrase if warp else ''}. {niche_block if niche_context else ''} Layout: centered composition with generous padding and breathing room. High contrast, clean outlines, commercial vector art. Screen print ready, hard edges, vector sharpness, 300 DPI.
```

This produces ~300–500-char prompts depending on style — well within Gemini's input budget. Polish step (Phase 4) tightens grammar/flow before reaching the image model.

---

## Appendix D — Niche-context block format

> When the Builder build endpoint is called with `include_niche_context=True` AND the project's linked niche has research data (PROJ-6 output), one parenthetical block is appended per prompt.

**Source** (Django): `project.niche.latest_research_data` is a JSONField. We use top 3 each of:
- `visual_styles` (list of strings)
- `vibes` (list of strings)
- `tones` (list of strings)

**Output format** (single line, parenthetical, embedded in each prompt):

```text
(Niche style cues — visual styles: {top 3 comma-separated}; vibes: {top 3 comma-separated}; tones: {top 3 comma-separated})
```

**Concrete example** for niche "school bus driver":
```text
(Niche style cues — visual styles: cartoon, vintage retro, badge emblem; vibes: nostalgic, humorous, proud; tones: warm, playful, self-deprecating)
```

**Empty-handling:**
- If a particular field is missing or empty → omit that part. E.g. `(Niche style cues — vibes: nostalgic, humorous, proud)` if only vibes are populated.
- If ALL three fields are empty / missing → omit the entire block (no parentheticals).
- If `project.niche` is None → omit the entire block + (frontend) disable the toggle with the existing EC-23 tooltip.

**Where it sits in the prompt:** Inserted as the placeholder `{niche_block}` in the Builder template (Appendix C), right before "Color palette: ...".

---

## Appendix E — Style Library: 15 entries

> Populates `frontend-ui/src/views/designs/board/constants/styleLibrary.ts` (per AC-23). Each entry has `slug`, `label`, `shortDescription` (≤55 chars for UI), `thumbnail` (deterministic path), `promptSuffix` (≈140–220 chars to feed `build_architect_prompt`).

| Slug | Label | Short description | Prompt suffix |
|---|---|---|---|
| `vintage_retro` | Vintage Retro | Warm faded tones, thick outlines, distressed grain | Vintage retro aesthetic with warm faded earth tones (mustard yellow, burnt orange, dusty teal, cream), thick uniform black outlines, slightly distressed grain texture overlay, halftone shading on flat color fills, weathered screen-print feel |
| `70s_groovy` | 70s Groovy | Earthy psychedelic palette, flowing curves | 1970s groovy psychedelic vibe with bold flowing curved typography, earthy palette of mustard, burnt orange, olive, cream and rust, thick black outlines, soft halftone dot accents, retro disco poster aesthetic |
| `80s_neon` | 80s Neon Synthwave | Hot magenta + cyan + chrome glow | 1980s neon synthwave aesthetic with hot magenta, electric cyan, vibrant purple and matte black, chrome reflective typography, vaporwave grid background motifs, glowing neon outlines, retro arcade vibe |
| `90s_grunge` | 90s Grunge | Distressed ink-bleed, faded high-contrast | 1990s grunge style with distressed ink-bleed textures, faded high-contrast palette of worn black, cream and faded red, torn-edge effects, gritty rough outlines, photocopy-worn screen-print look |
| `kawaii_chibi` | Kawaii Chibi | Cute oversized heads, sparkly eyes, pastels | Kawaii chibi cartoon style with oversized cute heads, big sparkly black eyes with white highlights, soft pastel palette (baby pink, mint, lavender, butter yellow), thick rounded outlines, gentle pastel cell-shading, adorable expression |
| `cartoon` | Cartoon | Thick outlines, flat fills, playful shapes | Bold cartoon style with thick uniform black outlines, flat saturated color fills, simple cel-shaded highlights, expressive exaggerated features, playful vibrant palette, Saturday-morning animation aesthetic |
| `watercolor` | Watercolor | Soft transparent washes, organic edges | Watercolor illustration style with soft transparent color washes, irregular pigment edges, visible paper texture, organic flowing brush strokes, layered translucent pigment, hand-painted artisan feel |
| `hand_drawn_sketch` | Hand-Drawn Sketch | Loose pencil strokes, imperfect linework | Hand-drawn sketch style with loose pencil and pen strokes, visible construction lines, slightly imperfect organic linework, monochrome or muted color accents, charming sketchbook journal aesthetic |
| `vector_flat` | Vector Flat | Clean modern flat shapes, no gradients | Clean modern flat vector style with geometric shapes, zero gradients, smart minimalist palette, crisp sharp edges, contemporary commercial design aesthetic, editorial Apple-emoji flatness |
| `minimal_line_art` | Minimal Line Art | Single-line monoline, lots of negative space | Minimal single-line illustration with consistent monoline weight, no fills, no shading, elegant continuous lines, abundant negative space, refined editorial wordmark aesthetic |
| `pixel_art` | Pixel Art | 8-bit pixelated, 16-color retro palette | Pixel art 8-bit gaming style with sharp pixelated edges, no anti-aliasing, limited 16-color retro arcade palette, blocky uniform pixels, nostalgic NES/Game Boy aesthetic |
| `distressed_texture` | Distressed Texture | Worn ink, scratched fills, screenprint roughness | Heavily distressed print texture with worn ink-bleed effect, scratched and cracked color fills, vintage screen-print roughness, aged-on-fabric look, rough rustic typography |
| `halftone_print` | Halftone Print | Dot-pattern fills, comic book look | Halftone print style with dot-pattern color fills (varying dot sizes), classic comic-book printing aesthetic, limited 2-3 color palette, retro newsprint feel, pop-art flatness |
| `badge_emblem` | Badge / Emblem | Circular emblem, banner ribbons, heritage crest | Vintage badge emblem layout with circular or shield-shaped border, banner ribbons above and below, central crest illustration, classic monochrome or 2-color palette, heritage trade-mark feel |
| `blackletter_gothic` | Blackletter Gothic | Heavy medieval typography, dark mood | Heavy blackletter gothic typography with ornate medieval scripts, dramatic high-contrast strokes, decorative flourishes, dark moody palette, often paired with skull / raven / cross / banner motifs |

**Thumbnail path:** `/style-thumbnails/{slug}.png` (served from `frontend-ui/public/style-thumbnails/`).

**Generate-thumbnail master prompt** (for `scripts/generate_style_thumbnails.py`):
```text
a smiling cartoon taco mascot, centered, isolated on white background, {promptSuffix}
```

---

## Appendix F — Django UniqueConstraint with condition (for soft-delete safety)

> Standard Django pattern for "unique among non-deleted rows". Used on `BuilderPreset` (task 1.5).

**Pattern (conceptual — actual code added during Phase 1):**

```text
from django.db import models
from django.db.models import Q, UniqueConstraint

class BuilderPreset(models.Model):
    # ... fields ...
    is_deleted = models.BooleanField(default=False)

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=['project', 'name'],
                condition=Q(is_deleted=False),
                name='builderpreset_unique_name_per_project_active',
            ),
        ]
        indexes = [
            models.Index(fields=['project', 'is_deleted'], name='builderpreset_active_idx'),
        ]
```

**Why this matters:** Without the `condition`, a normal `UniqueConstraint` would block re-using a name after soft-delete. With the condition, two rows can share `(project, name)` as long as one is `is_deleted=True`.

**Migration note:** The migration auto-generated by `makemigrations` includes the constraint with the `Q(is_deleted=False)` condition; PostgreSQL supports partial unique indexes natively, so no manual SQL needed.

---

## Appendix G — Manual-edit tracking design (AC-40 / EC-12)

> Goal: after a user clicks Build → prompts inserted into textarea, then user manually tweaks the textarea, then clicks Build again → ask before overwriting.

**Mechanism:**

1. `useWorkspaceGeneration` hook adds a `lastBuildOutputRef = useRef<string | null>(null)`.
2. On successful Build → call `setPrompt(joinedPrompts)` AND set `lastBuildOutputRef.current = joinedPrompts`.
3. Before the NEXT Build → compare `prompt` (current textarea value) against `lastBuildOutputRef.current`:
   - If equal: no manual edit → proceed silently.
   - If different (user manually edited): open MUI Dialog `Replace your manual edits with newly-built prompts?` — Cancel → abort Build, preserve textarea. Continue → overwrite + update `lastBuildOutputRef.current`.
4. When user navigates away from the Builder (Dialog close) → `lastBuildOutputRef.current` stays in scope; only resets on full Builder remount.

**Why a `useRef` and not state:**
- Comparison doesn't trigger re-renders.
- We only need it on Build click (event-time), not during render.
- Survives component re-renders without dependency-array gymnastics.

**EC-12 maps directly:** "User manually edits the textarea AFTER a Build → no auto-overwrite on subsequent Build until user clicks Build again (explicit re-trigger)" — that's exactly the Dialog-confirm flow above.

---

## Appendix H — Seed support across image models (RESEARCHED 2026-05-17)

> Live-probe of `https://openrouter.ai/api/v1/models` confirms ALL 5 image-output models we use support the `seed` parameter:

| Model | `supports_seed` |
|---|---|
| `google/gemini-3.1-flash-image-preview` | ✅ |
| `google/gemini-3-pro-image-preview` | ✅ |
| `google/gemini-2.5-flash-image` | ✅ |
| `openai/gpt-5-image` | ✅ |
| `openai/gpt-5-image-mini` | ✅ |

**Implication for AC-39 (seed-variation fallback):**

User answered "Beide kombiniert" (suffix + random style-modifier) under the assumption that Gemini Nano Banana does NOT support `seed`. **It does.** That changes the design:

- **Recommended (simpler):** drop the random style-modifier branch. Use seed-only for variation. Reproducibility is automatic; designs are deterministically different per `seed`.
- **Keep the suffix as soft hint** (`"(variation N of M)"`) — Gemini may still produce nearly-identical outputs for very similar seeds; the suffix adds compositional nudge cheaply.
- **No style-modifier pool needed** in this PR.

**Final decision (user-confirmed 2026-05-17):** Seed + Suffix-Hint combo. Drop the random style-modifier pool branch — not needed.

- Pass deterministic `seed = hash((str(run.id), variant_index)) & 0xFFFFFFFF` (32-bit) to OpenRouter per parallel call.
- ALSO append soft suffix `(variation {N} of {total})` to each variant's prompt as a compositional nudge — costs nothing, helps Gemini differentiate similar seeds.
- No style-modifier pool. If QA reveals seed+suffix produces near-identical designs, revisit and add the style-modifier branch as a follow-up PR.

---

## Appendix I — Settings panel location (CONFIRMED)

> Polish toggle home is `frontend-ui/src/views/designs/workspace/ProcessingSettingsDialog.tsx`.

**Why this file (and NOT `frontend-ui/src/views/settings/`):**

- `views/settings/` hosts WORKSPACE-level user/account settings (PROJ-31 Entitlement, password, profile, OAuth links).
- `views/designs/workspace/ProcessingSettingsDialog.tsx` is the existing per-project design-pipeline settings dialog (already hosts upscaler defaults, post-processing toggles). The polish toggle is conceptually a design-pipeline setting, so it belongs there.

**Per-workspace persistence note:** `ProcessingSettings` is a per-workspace singleton (already established pattern). So even though the dialog is opened from a project workspace context, the toggle saves to the workspace. Mention this in the dialog's hint copy: "This setting applies to the entire workspace."

**Component touch list:**
- `ProcessingSettingsDialog.tsx` — add `Auto-polish Builder prompts` MUI Switch.
- `designSlice.ts` — extend existing `updateProcessingSettings` RTK Query mutation type to include the new field (no new endpoint).
- Backend `ProcessingSettingsSerializer` — add the field to `fields = [...]`.
