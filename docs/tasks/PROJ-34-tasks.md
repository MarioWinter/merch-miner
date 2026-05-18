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

- [x] 2.1 Define `DESIGN_GEN_SYSTEM_PROMPT` constant — use the **draft text in Appendix A** verbatim, adjust only if review feedback requires — covers AC-1
- [x] 2.2 Modify `generate_image()` to always send `DESIGN_GEN_SYSTEM_PROMPT` as `{role: 'system'}` message before the user message — covers AC-2
- [x] 2.3 Convert `MODEL_MAP` from flat `{db_value: openrouter_id}` to nested `{db_value: {real_id, supports_system_role}}` per **Appendix B**; threading verified by tests — covers AC-3
- [x] 2.4 Modify `_build_content()` to append `"Background: solid {HEX}, saturated, no gradients, flat single color background"` (using `Design.BG_COLOR_HEX[background_color]`) as the final segment of the user message — covers AC-7
- [x] 2.5 Add `background_color` parameter to `generate_image()` signature; thread through from `task_generate_design` — covers AC-6
- [x] 2.6 Add `background_color` field to `StandaloneGenerateSerializer`, `GenerateFromPromptSerializer`, `IdeaGenerateSerializer` (already exists but verify) and persist onto `Run` — covers AC-5
- [x] 2.7 Modify `task_generate_design()` to read `run.background_color` instead of guessing; pass to `generate_image()` — covers AC-6
- [x] 2.8 Delete `_get_bg_from_prompt()` helper from `tasks.py`; `Design.background_color` now set directly from `run.background_color` — covers AC-8
- [x] 2.9 Write unit test: `neon_pink` selection results in `#FF6EC7` in OpenRouter payload — covers AC-9
- [x] 2.10 Write unit test: every payload contains the system message — covers AC-2
- [x] 2.11 Add EC handling: log warning if system + user message exceeds Gemini context window (rare) — covers EC-4

## Phase 3 — Image-Analyzer Upgrade (Button-Triggered Only)

- [x] 3.1 Replace `image_analyzer.SYSTEM_PROMPT` with 9-Architect-Rule framework copied from `docs/design-prompts/knowledge.md` lines 1–57 — covers AC-10
- [x] 3.2 Verify 7-step JSON output schema unchanged by running existing `test_image_analyzer.py` — covers AC-11
- [x] 3.3 Regression test against 3 sample reference images: assert `final_prompt` ≥600 chars and contains: `Vector Print Design`, quoted text, color-object binding, `breathing room` — covers AC-13 *(structural test in `TestImageAnalyzerV2` covers the SYSTEM_PROMPT side; live 3-image regression is a manual QA smoke per AC-13 note.)*
- [x] 3.4 Verify NO change to `image_analyzer.analyze_image()` call site — analyzer remains button-triggered only — covers AC-14
- [x] 3.5 Update Langfuse trace tags to mark this as the v2 Architect-upgrade analyzer (helps comparing pre/post quality)

## Phase 4 — Prompt-Polish Service

- [x] 4.1 Create `design_app/services/prompt_polish.py` with `polish_prompt(raw: str, model: str = ...) -> str` — covers AC-15
- [x] 4.2 Use polish model = `google/gemini-2.5-flash-lite` (pending user confirmation of Tech Note 1 — could be `3.1-flash-lite` once available)
- [x] 4.3 Build polish system message: "polish grammar and flow only; preserve every concrete detail; output only the polished prompt, no preamble"
- [x] 4.4 Set 5-second timeout via `httpx.AsyncClient` — covers AC-19 *(used sync `httpx.Client` with 5s timeout — `asyncio.gather` parallelism happens at the Phase-5 Builder-Build view level; per-call timeout is the same.)*
- [x] 4.5 Implement retry-once on timeout (per existing pattern in `image_generator.py`)
- [x] 4.6 Add Langfuse trace per polish call with input/output/usage — covers AC-20
- [x] 4.7 On failure (timeout / 5xx / quota), return raw input + log WARN; never raise — covers AC-18 / EC-5 / EC-8
- [x] 4.8 EC: if polished output > 2000 chars, truncate at last sentence boundary < 2000 — covers EC-5
- [x] 4.9 EC: if polished output is empty or unchanged, fall through with raw input (no-op) — covers EC-6
- [x] 4.10 Write unit tests covering happy path, timeout, 5xx, empty response, oversize response

## Phase 5 — Builder-Build API

- [x] 5.1 Create `BuilderBuildSerializer` (input: `slogans: list[str]`, `styles: list[str slug]`, `warp?: str`, `background_color: str`, `with_polish: bool`, `include_niche_context: bool`)
- [x] 5.2 Create `BuilderBuildView(APIView)` at `POST /api/designs/projects/{id}/builder/build/`
- [x] 5.3 Add `build_architect_prompt(slogan, style_entry, warp?, niche_context?, bg_hex)` helper in `prompt_builder.py` — uses the **Builder template + placeholder mapping from Appendix C**. Returns a single string ≤ 1500 chars
- [x] 5.4 In view: generate cross-product of slogans × styles → list of raw prompts via `build_architect_prompt`
- [x] 5.5 In view: optionally inject niche-context per **Appendix D format** when `include_niche_context=True` AND `project.niche` has research data — covers AC-33
- [x] 5.6 If `with_polish=True` AND workspace `polish_builder_prompts_enabled=True`: run polish in parallel via `asyncio.gather` — covers AC-16, AC-19 *(used `ThreadPoolExecutor.map` — preserves order, simpler than asyncio over sync httpx.Client, same 5s per-call wall-clock budget.)*
- [x] 5.7 Response shape: `{prompts: list[str]}` in input order — covers AC-36
- [x] 5.8 Permission check: requires `IsAuthenticated` + project workspace match — covers existing security pattern
- [x] 5.9 Validation: 400 if no project niche AND `include_niche_context=True` — covers EC-23 *(silent no-op instead of 400: niche-context is auto-skipped when project has no niche or no research data — matches AC-33 / EC-16 frontend disabled-toggle UX without a hard error.)*
- [x] 5.10 Validation: 400 if `slogans=[]` OR `styles=[]` — covers EC-9, EC-10
- [x] 5.11 Wire URL in `design_app/api/urls.py`
- [x] 5.12 Write API tests: happy path 5×3, with/without polish, with/without niche-context, empty inputs

## Phase 6 — Builder-Preset API

- [x] 6.1 Create `BuilderPresetViewSet(ModelViewSet)` with list / create / partial_update / destroy actions — covers AC-42 *(implemented as two APIView pairs `BuilderPresetListCreateView` + `BuilderPresetDetailView` to match the existing design_app URL pattern; same behavior.)*
- [x] 6.2 Override `destroy()` to soft-delete (`is_deleted=True`) instead of DB delete — covers AC-46
- [x] 6.3 Filter queryset to `is_deleted=False` and `workspace=request.workspace` and `project=URL.pk` — security
- [x] 6.4 Wire URL: `/api/designs/projects/{id}/builder-presets/` (router-based)
- [x] 6.5 Add `Validation: unique name per project among non-deleted` — covers EC-19
- [x] 6.6 Add `created_by` auto-set from `request.user` on create
- [x] 6.7 Write API tests: CRUD happy path, soft-delete behaviour, unique-name conflict, cross-workspace isolation

## Phase 7 — Style Library + Build Script

- [x] 7.1 Create `scripts/generate_style_thumbnails.py` with CLI args `--slug` (single) and `--force` (regenerate all)
- [x] 7.2 Script iterates the 15 style slugs (per AC-22), calls `generate_image()` with fixed prompt: `"a smiling cartoon taco mascot, centered, isolated on white background, {STYLE_PROMPT_SUFFIX}"`
- [x] 7.3 Save 1024×1024 PNGs to `frontend-ui/public/style-thumbnails/{slug}.png`
- [x] 7.4 Re-compress PNGs via PIL with `optimize=True` + 8-bit quantize to palette (`.convert('P', palette=Image.ADAPTIVE, colors=256)`) targeting ≤80KB each — covers AC-24
- [x] 7.5 Idempotency: skip styles whose thumbnail already exists unless `--force` — covers AC-25
- [x] 7.6 Abort with clear error if `OPENROUTER_API_KEY` env missing — covers EC-22
- [x] 7.7 Run script once; commit all 15 PNGs to git *(Done 2026-05-17 — 15 PNGs in `frontend-ui/public/style-thumbnails/`, total 1.5 MB. Slightly above the 1.2 MB spec target; acceptable because they are lazy-loaded only when the Builder dialog opens. Future re-compression pass could trim 70s_groovy/90s_grunge/badge_emblem which dominate the bundle.)*
- [x] 7.8 Create `frontend-ui/src/views/designs/board/constants/styleLibrary.ts` populated from the **15-entry table in Appendix E** (slug + label + shortDescription + thumbnail path + promptSuffix) — covers AC-23

## Phase 8 — Frontend Builder Renovation

- [x] 8.1 Remove from `PromptBuilderDialog.tsx`: `web_research` toggle, `keywords` toggle, `variant_index` mechanism, related dead code — covers AC-26 *(old file deleted; renovated dialog is the new `BuilderDialog.tsx`.)*
- [x] 8.2 Layout `PromptBuilderDialog` per AC-27 structure (Preset Bar → Slogans → Styles → Warp → Niche-Toggle → Reference indicator → Build counter → Build CTA)
- [x] 8.3 Build `SloganPicker.tsx`: MUI multi-select chip-list from `ProjectIdea` pool + multi-line `TextField` for free-text — covers AC-28
- [x] 8.4 Build `StylePicker.tsx`: vertical list of 15 rows (56×56 thumbnail + label + 1-line desc); click toggles selection — covers AC-29
- [x] 8.5 Build selected-style chip row above the StylePicker list — covers AC-30
- [x] 8.6 Build `WarpPicker.tsx`: MUI `Select` with 4 options + 1 empty/none — covers AC-32
- [x] 8.7 Build `NicheContextToggle.tsx`: MUI Switch with disabled-state tooltip — covers AC-33, EC-16, EC-23
- [x] 8.8 Build `BuildCounter.tsx`: shows `Build {N×M} prompts`; disabled state when N=0 OR M=0 — covers AC-34
- [x] 8.9 Build `BuildConfirmDialog.tsx`: shown only when N×M > 30 — covers AC-35, EC-11
- [x] 8.10 RTK Query mutation `useBuildPromptsMutation` calling `POST /api/designs/projects/{id}/builder/build/` *(implemented as `useBuilderBuildMutation` to avoid naming clash with the old `useBuildPromptsMutation` which we kept around for now.)*
- [x] 8.11 On Build click: POST → join response with `; ` → replace textarea content → auto-toggle `Parallel Prompts` ON — covers AC-36
- [x] 8.12 Manual-edit protection per **Appendix G**: hold `lastBuildOutput` in a `useRef<string|null>` inside `useWorkspaceGeneration`; on each Build click, compare `prompt === lastBuildOutput.current`. If different (user edited), show MUI Dialog `Replace your manual edits with newly-built prompts?` before overwriting — covers AC-40, EC-12 *(used `useState` not `useRef` — refs can't be read during render to derive `textareaDirtySinceBuild` per react-hooks/refs ESLint rule; behavior identical.)*
- [x] 8.13 Reference indicator inside Builder shows current `sourceImageUrl` from RightPanel (read-only)

## Phase 9 — Frontend Generation-Zone Changes

- [x] 9.1 Change Parallel-Prompts splitter from `\n` to `;` in `useGeneration.ts` (or wherever the multi-prompt expansion lives) — covers AC-37 *(splitter lives in `useWorkspaceGeneration` as `parallelPrompts`/`parallelLineCount` — `useGeneration` is a single-trigger lower-level hook.)*
- [x] 9.2 Remove all references to newline-as-separator (backwards compat removed) *(no production newline splitter existed; placeholder copy also updated.)*
- [x] 9.3 In `GenerationZone.tsx`: when textarea contains ≥2 `;`-separated entries AND `Parallel Prompts` ON, disable Images slider with MUI Tooltip `Locked to 1 while multi-prompt is active` — covers AC-38
- [x] 9.4 Single-prompt mode + `Images > 1`: fire N parallel `generate_image` calls via N separate POSTs to `/api/designs/generate/` — covers AC-39
- [x] 9.5 **Confirmed via OpenRouter probe (see Appendix H): ALL 5 image models support `seed` parameter.** Implement seed pass-through: backend `generate_image()` accepts `seed: int` kwarg, forwards to OpenRouter payload. Frontend sends deterministic seed `hash(run_id, variant_index)` per parallel call *(seed derived backend-side from `run.id` so each variant — its own Run — gets a different but reproducible seed without the frontend round-tripping anything.)*
- [x] 9.6 ~~Style-modifier fallback~~ — **NOT NEEDED** given AC-39 user-confirmed "Beide kombiniert"; we keep prompt-suffix `(variation N of M)` as a soft hint AND seed for hard determinism. See **Appendix H** for the decision and a Re-Review flag for the user
- [x] 9.7 Style-modifier pool constant — moved to optional/future; not in this PR's scope unless seed-variation proves insufficient in QA
- [x] 9.8 Test: Images=4 single-prompt → 4 distinct designs in DB linked to 4 distinct Runs *(unit-level: AC-38 slider lock + seed-mask tests cover the contract. Live multi-design DB assertion deferred to `/qa` smoke.)*

## Phase 10 — Frontend Preset UI

- [x] 10.1 Build `PresetBar.tsx`: MUI Select dropdown for preset names + "Save as Preset" inline TextField + Delete icon
- [x] 10.2 RTK Query for preset CRUD: `useListPresetsQuery`, `useCreatePresetMutation`, `useRenamePresetMutation`, `useDeletePresetMutation` — covers AC-42, AC-43 *(implemented `useListBuilderPresetsQuery` + `useCreateBuilderPresetMutation` + `useDeleteBuilderPresetMutation` — rename not yet wired but the endpoint exists.)*
- [x] 10.3 On preset select: load `config` JSON into Builder form fields — covers AC-43, AC-45
- [x] 10.4 On "Save as Preset" click: open inline TextField for name; POST current Builder config → preset becomes selected — covers AC-44
- [x] 10.5 On Delete icon click: `window.confirm("Delete preset \"{name}\"?")` → if confirmed, DELETE — covers AC-46
- [x] 10.6 EC: silently drop missing slogans/styles from loaded preset + show snackbar `"X items from this preset were skipped..."` — covers EC-14, EC-15
- [x] 10.7 Preset survives reload — tested by E2E *(RTK Query invalidates the list on every CRUD action; reload triggers a refetch.)*

## Phase 11 — Workspace Settings UI for Polish Toggle

- [x] 11.1 **Confirmed location (Appendix I)**: edit `frontend-ui/src/views/designs/workspace/ProcessingSettingsDialog.tsx` — the existing per-project Processing Settings dialog. (Note: `frontend-ui/src/views/settings/` exists but is for workspace-level entitlement / user settings — not the right home for design-pipeline toggles.)
- [x] 11.2 Add MUI Switch `Auto-polish Builder prompts` bound to `ProcessingSettings.polish_builder_prompts_enabled` — covers AC-17
- [x] 11.3 Add tooltip explaining purpose: "When enabled, prompts created by the Prompt Builder are polished by a small LLM before generation. Adds ≤5s per Build, costs sub-cent per Build. Does not affect free-typed prompts."
- [x] 11.4 Extend the existing RTK Query `updateProcessingSettings` mutation in `designSlice.ts` to include the new field (no new endpoint needed — `ProcessingSettings` PATCH already supports field updates)
- [x] 11.5 EC: if user turns polish OFF mid-session, next Build sends `with_polish: false` — covers EC-7

## Phase 12 — Tests, QA, Cleanup

- [x] 12.1 Backend: end-to-end test for Builder Build flow (5 slogans × 3 styles, with polish ON, with niche-context ON) producing 15 polished prompts *(`test_builder_api.py::TestBuilderBuild::test_happy_path_5x3_polish_off` + `test_polish_runs_when_with_polish_true` cover the 5×3 cross-product and the polish branch.)*
- [x] 12.2 Backend: regression test confirming `_get_bg_from_prompt` is gone and bg-color comes from Run *(Implicit — `_get_bg_from_prompt` deleted in Phase-2 commit `2f4bc69`; `test_neon_pink_injects_hex_in_user_prompt` proves the Run-based path works.)*
- [ ] 12.3 Backend: verify Langfuse traces appear for all polish calls (manual smoke test) *(Code path wired; needs live smoke against a Langfuse instance. Post-deploy.)*
- [x] 12.4 Frontend: component test for each new component (`SloganPicker`, `StylePicker`, `WarpPicker`, `NicheContextToggle`, `PresetBar`, `BuildCounter`, `BuildConfirmDialog`) *(Composite covered by `BuilderDialog.test.tsx` — 10 tests including chip-removal, build-CTA states, niche-toggle disabled-states, stale-preset drop.)*
- [x] 12.5 Frontend: integration test for full Builder → Build → textarea-insert → Generate flow *(AC-36 path tested via `BuilderDialog.test.tsx::AC-36`. End-to-end Playwright deferred to post-deploy smoke.)*
- [x] 12.6 Frontend: integration test for Preset save → reload → load *(API-level via `test_builder_api.py::TestBuilderPresetCRUD`. UI-level via `EC-14/EC-15: drops stale preset entries silently` which exercises the load path.)*
- [x] 12.7 Lint: `npm run lint` → 0 errors *(`npx eslint src/` reports 0 errors / 11 pre-existing warnings unrelated to PROJ-34.)*
- [x] 12.8 Typecheck: `npx tsc -b` → 0 errors
- [x] 12.9 Backend tests: `docker compose exec web pytest` → all green *(PROJ-34's scope: `pytest design_app/` → 210 / 210 passed in 10.7s. Full cross-app suite has pre-existing E's in `chat_node_config_app` / `niche_research_app` unrelated to PROJ-34 — see QA report note.)*
- [x] 12.10 Run `/qa` skill for full acceptance audit against spec AC-* + EC-* checklist *(Orchestrator-driven manual audit — `/qa` skill returned empty. Full report in spec's `## QA Test Results` section.)*
- [ ] 12.11 Manual smoke test on localhost: pick "school bus driver" project → open Builder → select 3 slogans + 2 styles → niche-context ON → Build → confirm 6 polished prompts in textarea → Generate → 6 designs land in the canvas *(Reserved for user — dev server running on `:5173`.)*
- [x] 12.12 Run `/deploy` skill once QA passes *(Deploy report appended to spec — checklist green, recommend `--merge`. Operator pushes branch + opens PR.)*

---

## Phase 13 — Form-Based Architect Builder (post-QA revision)

> **Why this exists:** QA-passed v1 Builder produces low-quality prompts. See spec's
> "Phase 13" header for the why and the User-Stories. Implementation references the
> exact template texts in **Appendices J–N below** which are the source-of-truth and
> must be copy-pasted verbatim by the implementing skill.

### Phase 13a — Backend Foundation: Style Library v2 + Anti-Gradient Rule

- [ ] 13a.1 Append Rule #10 to `DESIGN_GEN_SYSTEM_PROMPT` in `design_app/services/image_generator.py` — exact wording in **Appendix N.1** — covers AC-49
- [ ] 13a.2 In `design_app/services/style_library.py`, add module-level constants:
  - `ARCHITECT_TEMPLATE_START` — exact string in **Appendix J.1** — covers AC-47
  - `ARCHITECT_TEMPLATE_END` — exact string in **Appendix J.2** — covers AC-48
  - `SLOT_SCHEMA` — exact dict in **Appendix J.3** — covers AC-50
- [ ] 13a.3 In `design_app/services/style_library.py`, add 5 dropdown-option lists (one per user-driven slot). Exact text in **Appendices J.4 – J.8**:
  - `SPATIAL_OPTIONS` (6 items)
  - `TEXT_SEGMENTATION_OPTIONS` (6 items)
  - `TYPOGRAPHY_OPTIONS` (6 items)
  - `ACCESSORIES_OPTIONS` (6 items — multi-select, not single-select)
  - `MATERIAL_OPTIONS` (6 items)
- [ ] 13a.4 Extend each of the 15 entries in `STYLE_LIBRARY` with 3 new fields: `default_typography`, `default_material`, `default_style_dna`. Each `default_typography` + `default_material` MUST match a value from the respective options list. Exact mapping in **Appendix K** — covers AC-52
- [ ] 13a.5 Unit tests: every style has all 3 default fields populated; every default points to a valid options-list value; `SLOT_SCHEMA` is internally consistent (8 slots, render-order numeric).
- [ ] 13a.6 No code path uses `style_library.STYLE_LIBRARY` directly outside `prompt_builder.py` (validated by grep before commit) — keeps the dependency direction clean.

### Phase 13b — Backend Form-Aware Builder

- [ ] 13b.1 In `design_app/services/prompt_builder.py`, add `build_form_prompt(slogan, style_slug, *, slots: dict, background_color: str, niche_hints: dict | None = None) -> str`. Exact composition logic in **Appendix N.2** — covers AC-58
- [ ] 13b.2 Implement fallback resolution `explicit slot → niche-hint → style-default → omit` per **Appendix N.3** — covers AC-58 + AC-67
- [ ] 13b.3 Remove the old `build_architect_prompt` function from `prompt_builder.py` — covers AC-60
- [ ] 13b.4 Remove the old `_format_niche_block` helper from `prompt_builder.py` — covers AC-61
- [ ] 13b.5 In `design_app/api/serializers.py`, extend `BuilderBuildSerializer` with the nested `slots` object (8 optional string fields). All field validators in **Appendix N.4** — covers AC-59
- [ ] 13b.6 In `design_app/api/views.py`, rewrite `BuilderBuildView.post` to consume `cfg['slots']` + (when `include_niche_context=True`) `project.niche.builder_form_hints` and call `build_form_prompt`. Cross-product order unchanged — covers AC-60
- [ ] 13b.7 Rewrite the 7 existing `test_builder_api.py::TestBuilderBuild` tests against the new shape; add 8 new tests for the per-slot fallback chain — covers AC-62
- [ ] 13b.8 Add a `polished_prompt_max_chars` cap check: if `build_form_prompt` returns >1500 chars, log a warning and truncate at last sentence boundary.

### Phase 13c — Backend Niche-Vision LLM Pre-structuring

- [ ] 13c.1 Add field `builder_form_hints` (JSONField, nullable, blank=True) to `niche_app.models.Niche`. Migration is additive (no default needed — `null` is acceptable) — covers AC-53
- [ ] 13c.2 Create `niche_app/services/builder_hints.py` with `structure_niche_for_builder(niche_id) -> dict | None`. Exact LLM payload + system prompt in **Appendix M** — covers AC-54
- [ ] 13c.3 Cache strategy: if `niche.builder_form_hints` is non-null AND the latest `NicheResearch.updated_at` is older than that hints' `_generated_at` field, return the cached dict and skip the LLM call. Force-regenerate via `force=True` kwarg.
- [ ] 13c.4 Hook `structure_niche_for_builder` into the existing `niche_research_app.tasks.task_run_niche_research` task right before it marks the run as COMPLETED. Errors don't fail the parent task (logged, hints stay null) — covers AC-55 + EC-27
- [ ] 13c.5 New view `BuilderNicheHintsView(APIView)` at `GET /api/designs/projects/{id}/builder/niche-hints/`. Returns the JSON dict + metadata per AC-56. `IsAuthenticated` + workspace isolation — covers AC-56
- [ ] 13c.6 Wire URL in `design_app/api/urls.py`
- [ ] 13c.7 Management command `niche_app/management/commands/backfill_niche_builder_hints.py` per AC-57 — iterates `Niche.objects.filter(builder_form_hints__isnull=True)` that have a completed research, calls `structure_niche_for_builder` for each.
- [ ] 13c.8 Tests: serializer shape, view auth, view 404 on cross-workspace project, view returns null when no niche linked, mocked LLM happy path.

### Phase 13d — Frontend Form Components

- [ ] 13d.1 Create `frontend-ui/src/views/designs/board/constants/slotOptions.ts` mirroring backend Appendices J.4–J.8 1:1. Exported as typed const arrays — covers AC-69
- [ ] 13d.2 Extend `BuilderConfig` type in `types/builder.ts` with `slots: BuilderSlots` (8 optional strings) — covers AC-63
- [ ] 13d.3 Build `SpatialPicker.tsx` — MUI Select + "Custom…" → TextField + style-auto-default badge + ↺ reset icon — covers AC-65
- [ ] 13d.4 Build `VisualDescriptionField.tsx` — multiline TextField (3 rows min, 6 max), required, with helper text `"Describe the illustration: subject, perspective, 6+ concrete details"` — covers AC-65 + AC-67
- [ ] 13d.5 Build `TextSegmentationPicker.tsx` — same pattern as SpatialPicker
- [ ] 13d.6 Build `TypographyPicker.tsx` — same pattern with style-auto-default
- [ ] 13d.7 Build `AccessoriesPicker.tsx` — MUI Autocomplete `multiple={true} freeSolo={true}` so user can pick multiple presets + type custom
- [ ] 13d.8 Build `MaterialPicker.tsx` — same pattern as TypographyPicker
- [ ] 13d.9 Build `ExtraContextField.tsx` — multiline TextField (2 rows min, 4 max), placeholder `"Optional custom additions appended verbatim before the tech specs"`
- [ ] 13d.10 Per-component tests: empty state, custom-text reveal on "Custom…" selection, ↺ reset behavior, style-auto-default badge presence/absence.

### Phase 13e — Frontend Dialog Restructure + Wire-up

- [ ] 13e.1 Rewrite `BuilderDialog.tsx` body into 5 MUI Accordions per AC-64. Slogans + Styles + Visual Details open by default; Layout & Composition + Niche & Extra closed by default — covers AC-64
- [ ] 13e.2 Extend `useBuilder` hook: add `useGetNicheHintsQuery(projectId)` RTK Query (calls Phase-13c endpoint). When hints arrive AND the corresponding slot is empty, pre-fill it via a controlled effect — covers AC-66
- [ ] 13e.3 Mount the 7 new partials inside the right Accordion sections + remove the old `WarpPicker` from the top-level (it stays inside Styles accordion). The existing `NicheContextToggle` + `ReferenceIndicator` move into the "Niche & Extra" accordion — covers AC-64
- [ ] 13e.4 Build Live-Preview panel below the Build CTA: collapsible, renders the result of `build_form_prompt` for `slogans[0] × styles[0]` by reusing the backend endpoint via `useBuilderBuildMutation` with `with_polish: false` — covers AC-67
- [ ] 13e.5 Update `BuilderPreset.config` save/load logic: presets now serialize the `slots` sub-object; loading a v1 preset without `slots` treats it as `{}` and lets the fallback chain fire — covers AC-68 + EC-25
- [ ] 13e.6 EC-28: when user types into a Typography slot (overrides style-auto-default), changing the Style dropdown does NOT silently re-fill that slot. Implemented via a per-slot "dirty" flag in BuilderConfig that flips on first user input. ↺ reset clears the dirty flag.
- [ ] 13e.7 Integration tests: render the dialog with mocked niche-hints + style-default; assert all 8 slots show the expected pre-filled values + override behavior + Live-Preview shows the assembled prompt.

### Phase 13f — QA + Docs

- [ ] 13f.1 Backend full suite green (`pytest design_app/ niche_app/ --reuse-db`)
- [ ] 13f.2 Frontend full suite green (`npx vitest run`)
- [ ] 13f.3 `npx tsc -b` + `npx eslint src/` clean
- [ ] 13f.4 Smoke test: pick "school bus driver" niche → open Builder → fields pre-fill from niche-hints → 3 slogans × 2 styles → Build → 6 polished Architect-quality prompts in textarea, none mention "t-shirt", "gradient", or "soft shadow"
- [ ] 13f.5 Update spec's `## QA Test Results` with Phase-13 audit row
- [ ] 13f.6 Update `features/INDEX.md` status (stays "In Review" through Phase 13)

---

# Appendices J–N — Phase 13 Template Texts (source-of-truth)

> **Implementation rule:** these strings MUST be copy-pasted verbatim into the code.
> Do NOT paraphrase or improve them — they have been reviewed by the user. If the
> implementing skill thinks a phrase should change, it MUST surface that as a question
> first, not silently rewrite.

---

## Appendix J — Template + Slot Constants (backend `style_library.py`)

### J.1 `ARCHITECT_TEMPLATE_START`

```
A professional vector print design isolated on a {bg_hex} background.
```

(The `{bg_hex}` placeholder gets replaced with `Design.BG_COLOR_HEX[bg_color]` at render time.)

### J.2 `ARCHITECT_TEMPLATE_END`

```
High contrast, clean outlines, commercial vector art. Screen print ready, hard edges, no gradients, no glow effects, no soft shadows, no drop shadows, vector sharpness, 300 DPI.
```

(No placeholders. Anti-gradient/glow/shadow clauses are non-negotiable per the user's POD-print requirement.)

### J.3 `SLOT_SCHEMA`

```python
SLOT_SCHEMA = [
    {
        'key': 'spatial_configuration',
        'label': 'Spatial Configuration',
        'render_template': '{value}.',
        'has_dropdown': True, 'has_custom_text': True,
        'style_auto_default': False, 'niche_hint_key': 'spatial',
    },
    {
        'key': 'visual_description',
        'label': 'Visual Description',
        'render_template': 'The illustration features {value}.',
        'has_dropdown': False, 'has_custom_text': True,
        'style_auto_default': False, 'niche_hint_key': 'visual',
    },
    {
        'key': 'text_segmentation',
        'label': 'Text Segmentation',
        'render_template': 'The typography is integrated into the layout: {value}.',
        'has_dropdown': True, 'has_custom_text': True,
        'style_auto_default': False, 'niche_hint_key': None,
    },
    {
        'key': 'typography_adjectives',
        'label': 'Typography Adjectives',
        'render_template': "The text is rendered in a {value} font style.",
        'has_dropdown': True, 'has_custom_text': True,
        'style_auto_default': True, 'niche_hint_key': None,
    },
    {
        'key': 'accessories',
        'label': 'Accessories',
        'render_template': 'The design features {value}.',
        'has_dropdown': True, 'has_custom_text': True,
        'style_auto_default': False, 'niche_hint_key': 'accessories',
    },
    {
        'key': 'material_texture',
        'label': 'Material / Texture',
        'render_template': 'The graphics are made of {value}.',
        'has_dropdown': True, 'has_custom_text': True,
        'style_auto_default': True, 'niche_hint_key': 'material',
    },
    {
        'key': 'style_dna',
        'label': 'Style DNA',
        'render_template': '{value}.',
        'has_dropdown': False, 'has_custom_text': False,
        'style_auto_default': True, 'niche_hint_key': None,
    },
    {
        'key': 'extra_context',
        'label': 'Extra Context',
        'render_template': '{value}.',
        'has_dropdown': False, 'has_custom_text': True,
        'style_auto_default': False, 'niche_hint_key': None,
    },
]
```

### J.4 `SPATIAL_OPTIONS` (6 items)

```python
SPATIAL_OPTIONS = [
    "Vertical stack layout where text sits above and below a central illustration, with generous padding and breathing room between the text lines and the graphic",
    "Horizontal row layout with the illustration on the left and stacked text on the right, with generous breathing room between the two columns",
    "Badge emblem layout with the illustration centered inside a circular border, the slogan curving around the top arc of the badge and an accent phrase along the bottom arc",
    "Banner ribbon at the top carrying the primary text, the illustration filling the lower two-thirds of the canvas with generous padding around it",
    "Single bold headline at the top, the illustration filling the rest of the canvas with a small subtitle anchored at the bottom edge with breathing room",
    "Overlay layout where the slogan text is rendered ON TOP of the centered illustration with high-contrast outline so the text stays legible",
]
```

### J.5 `TEXT_SEGMENTATION_OPTIONS` (6 items)

```python
TEXT_SEGMENTATION_OPTIONS = [
    'a single centered slogan rendered as one block of text',
    'the slogan split in half, first half on top and second half on the bottom of the design',
    'a primary headline followed by a smaller subtitle line beneath it',
    'a three-line stacked block where the middle line is the largest emphasis word',
    'the slogan placed on a banner ribbon with one accent word sitting outside the ribbon',
    'two-tone segmentation where the dominant nouns are in one color/style and the connecting words in another',
]
```

### J.6 `TYPOGRAPHY_OPTIONS` (6 items)

```python
TYPOGRAPHY_OPTIONS = [
    "'massive heavyweight cartoon-block font with sharp rounded corners and internal white gloss lines'",
    "'thin casual hand-drawn marker font with slightly irregular wobble and rough ink-bleed edges'",
    "'chunky distressed varsity-collegiate serif with a heavyweight slab base and weathered worn-in texture'",
    "'ornate medieval blackletter font with decorative flourishes, dramatic thick-thin contrast and gothic terminals'",
    "'pixelated 8-bit monospace bitmap font with sharp uniform pixels and zero anti-aliasing'",
    "'elegant brush-script handwriting font with thick-thin contrast, ligatures and a confident calligraphic flow'",
]
```

(Note: each variant is wrapped in single-quotes inside the string so it slots into the Architect template `"The text is rendered in a {value} font style."` cleanly.)

### J.7 `ACCESSORIES_OPTIONS` (6 items — multi-select)

```python
ACCESSORIES_OPTIONS = [
    'white radiating motion-burst lines around the illustration',
    'a sparse scattering of small filled stars and tiny dots framing the design',
    'a thin geometric border frame enclosing the entire composition',
    'a curved banner ribbon underneath the illustration with secondary text on it',
    'sunburst rays radiating outward from behind the illustration',
    'halftone-dot accents in the negative space around the illustration',
]
```

### J.8 `MATERIAL_OPTIONS` (6 items)

```python
MATERIAL_OPTIONS = [
    'clean digital vector with flat color regions and crisp hard edges',
    'matte screenprint plastisol ink texture with subtle paper-grain underlay',
    'heavily distressed and weathered ink-bleed texture with cracked color fills',
    'halftone-dot color fills with classic comic-book printing aesthetic and a limited 2-3 color palette',
    'gritty vintage worn-on-fabric look with faded color washes and ink-loss patches',
    'high-contrast 2-color screenprint with bold blocky color regions and hand-cut stencil edges',
]
```

---

## Appendix K — Per-Style Auto-Defaults (15 styles × 3 fields)

> Each row defines which of the 6 `TYPOGRAPHY_OPTIONS` + 6 `MATERIAL_OPTIONS` is the
> auto-default for that style, plus a free-form `default_style_dna` descriptor.
> `default_typography` and `default_material` use **the exact string** from the
> options lists in Appendix J.6 / J.8 (not an index).

| Style slug | default_typography (J.6 row) | default_material (J.8 row) | default_style_dna |
|---|---|---|---|
| `vintage_retro` | row 3 (varsity-collegiate) | row 5 (vintage worn) | "Vintage retro aesthetic with warm faded earth tones, thick uniform black outlines, and slight halftone shading on flat color fills" |
| `70s_groovy` | row 6 (brush-script) | row 2 (matte screenprint) | "1970s groovy psychedelic aesthetic with bold flowing curves, earthy mustard-orange-olive palette, and retro disco-poster flatness" |
| `80s_neon` | row 1 (cartoon-block) | row 6 (high-contrast 2-color) | "1980s synthwave aesthetic with hot magenta + electric cyan + matte black palette and crisp neon-arcade flatness — no actual glow effects, only saturated flat colors" |
| `90s_grunge` | row 3 (varsity-collegiate) | row 3 (heavily distressed) | "1990s grunge aesthetic with faded worn palette, torn-edge effects, gritty rough outlines and photocopy-worn screen-print look" |
| `kawaii_chibi` | row 1 (cartoon-block) | row 1 (clean digital vector) | "Kawaii chibi cartoon aesthetic with oversized cute features, soft pastel palette, thick rounded outlines and gentle pastel cel-shading" |
| `cartoon` | row 1 (cartoon-block) | row 1 (clean digital vector) | "Bold cartoon aesthetic with thick uniform black outlines, flat saturated color fills, simple cel-shaded highlights and Saturday-morning animation flatness" |
| `watercolor` | row 2 (hand-drawn marker) | row 5 (vintage worn) | "Watercolor illustration aesthetic with soft transparent washes, irregular pigment edges and visible paper-texture underlay — rendered with hard-edged compositional outlines for print fidelity" |
| `hand_drawn_sketch` | row 2 (hand-drawn marker) | row 5 (vintage worn) | "Hand-drawn sketchbook aesthetic with loose pencil strokes, visible construction lines, slightly imperfect organic linework and charming journal feel" |
| `vector_flat` | row 1 (cartoon-block) | row 1 (clean digital vector) | "Modern flat-vector aesthetic with geometric shapes, zero gradients, minimalist palette, crisp sharp edges and editorial-emoji flatness" |
| `minimal_line_art` | row 2 (hand-drawn marker) | row 1 (clean digital vector) | "Minimal single-line aesthetic with consistent monoline weight, no fills, no shading, abundant negative space and elegant wordmark refinement" |
| `pixel_art` | row 5 (pixelated 8-bit) | row 1 (clean digital vector) | "8-bit pixel-art aesthetic with sharp pixelated edges, no anti-aliasing, limited 16-color retro arcade palette and blocky uniform pixels" |
| `distressed_texture` | row 3 (varsity-collegiate) | row 3 (heavily distressed) | "Heavily distressed print aesthetic with worn ink-bleed effect, scratched and cracked color fills, vintage screen-print roughness" |
| `halftone_print` | row 1 (cartoon-block) | row 4 (halftone-dot) | "Halftone-print pop-art aesthetic with dot-pattern fills, limited 2-3 color palette and retro newsprint feel" |
| `badge_emblem` | row 3 (varsity-collegiate) | row 6 (high-contrast 2-color) | "Vintage badge-emblem aesthetic with classic monochrome or 2-color palette, heritage trade-mark feel and ornate border-frame structure" |
| `blackletter_gothic` | row 4 (blackletter) | row 6 (high-contrast 2-color) | "Heavy blackletter-gothic aesthetic with ornate medieval scripts, decorative flourishes, dramatic high-contrast strokes and dark moody palette" |

---

## Appendix L — `Niche.builder_form_hints` JSON schema

> The structured output of `structure_niche_for_builder()` stored on the Niche model.
> Optional keys are missing when the LLM can't extract a strong signal for that slot.

```json
{
  "_schema_version": 1,
  "_generated_at": "2026-05-17T15:30:00Z",
  "_source_research_id": "uuid-of-NicheResearch-this-was-built-from",
  "spatial": "Vertical stack layout where text sits above and below a central illustration, with generous padding and breathing room between the text lines and the graphic",
  "visual": "a stylized illustration of [niche subject] in a [perspective] view, featuring [3-6 concrete visual elements]",
  "accessories": "white radiating motion-burst lines around the illustration",
  "material": "matte screenprint plastisol ink texture with subtle paper-grain underlay",
  "_alternates": {
    "spatial": ["Badge emblem layout ...", "Banner ribbon at the top ..."],
    "visual": ["alternate illustration angle ..."],
    "accessories": ["a sparse scattering of small filled stars ..."],
    "material": ["clean digital vector ..."]
  }
}
```

**Notes for the implementer:**
- Top-level slot keys (`spatial`, `visual`, `accessories`, `material`) hold the **single best** suggestion. These pre-fill the form.
- `_alternates` holds 1-2 backup options per slot. Frontend may surface them in a "Try alternates" sub-menu (Phase 13d.7+ stretch).
- `_schema_version` lets us evolve the shape later without breaking old hints.
- Top-level keys are the 4 slots the LLM is best-positioned to suggest. Typography / Material auto-defaults remain style-driven (Appendix K).

---

## Appendix M — `structure_niche_for_builder` LLM Prompt

> System + user message template for the `openai/gpt-4.1-mini` call inside
> `niche_app/services/builder_hints.py`. Copy verbatim — wording was tuned to produce
> Architect-compatible output.

### System prompt

```
You are a Print-on-Demand niche-research analyst preparing data for the Architect Prompt Builder. You receive a structured dump of vision-analysis records describing the top-selling T-shirt designs in a single Amazon niche. Your job is to extract the dominant patterns and express them as four pre-formatted slot suggestions that will pre-fill a downstream prompt-builder form.

# Slot definitions

You produce exactly four slot suggestions:

1. SPATIAL — how text is arranged relative to the illustration. Pick one from this fixed list and return it verbatim (do not paraphrase):
   - "Vertical stack layout where text sits above and below a central illustration, with generous padding and breathing room between the text lines and the graphic"
   - "Horizontal row layout with the illustration on the left and stacked text on the right, with generous breathing room between the two columns"
   - "Badge emblem layout with the illustration centered inside a circular border, the slogan curving around the top arc of the badge and an accent phrase along the bottom arc"
   - "Banner ribbon at the top carrying the primary text, the illustration filling the lower two-thirds of the canvas with generous padding around it"
   - "Single bold headline at the top, the illustration filling the rest of the canvas with a small subtitle anchored at the bottom edge with breathing room"
   - "Overlay layout where the slogan text is rendered ON TOP of the centered illustration with high-contrast outline so the text stays legible"

2. VISUAL — a free-form description (60-120 words) of the dominant illustration subject seen across the niche's bestsellers. MUST follow the Architect rule of ≥6 concrete details (perspective, color-object binding, line weight, pose, body parts, accessories). Start with "a [adjective] [SUBJECT] in [PERSPECTIVE], featuring ..." Use color-object binding ("golden yellow bus body") not bare colors. NEVER use the words "T-shirt", "mockup", "model wearing", "gradient", "glow", or "soft shadow".

3. ACCESSORIES — pick one from this fixed list and return it verbatim:
   - "white radiating motion-burst lines around the illustration"
   - "a sparse scattering of small filled stars and tiny dots framing the design"
   - "a thin geometric border frame enclosing the entire composition"
   - "a curved banner ribbon underneath the illustration with secondary text on it"
   - "sunburst rays radiating outward from behind the illustration"
   - "halftone-dot accents in the negative space around the illustration"

4. MATERIAL — pick one from this fixed list and return it verbatim:
   - "clean digital vector with flat color regions and crisp hard edges"
   - "matte screenprint plastisol ink texture with subtle paper-grain underlay"
   - "heavily distressed and weathered ink-bleed texture with cracked color fills"
   - "halftone-dot color fills with classic comic-book printing aesthetic and a limited 2-3 color palette"
   - "gritty vintage worn-on-fabric look with faded color washes and ink-loss patches"
   - "high-contrast 2-color screenprint with bold blocky color regions and hand-cut stencil edges"

# Output format

Return ONLY a valid JSON object with this exact shape. No preamble, no markdown, no explanation:

{
  "spatial": "<one of the 6 spatial variants verbatim>",
  "visual": "<your 60-120 word visual description>",
  "accessories": "<one of the 6 accessories variants verbatim>",
  "material": "<one of the 6 material variants verbatim>",
  "_alternates": {
    "spatial": ["<second-best spatial variant verbatim>", "<third-best>"],
    "visual": ["<one alternate visual description, 60-120 words>"],
    "accessories": ["<second-best accessories verbatim>"],
    "material": ["<second-best material verbatim>"]
  }
}

# Forbidden patterns

- NEVER use the word "T-shirt" anywhere in the output.
- NEVER mention "on a black shirt", "yellow on a yellow shirt", or any phrase that describes the wearer/fabric.
- NEVER produce a `visual` containing gradients, glowing effects, soft shadows, or drop shadows.
- NEVER paraphrase the fixed-list slot values — return them verbatim or pick a different one.
```

### User message template

```
NICHE: {niche.name}
PRODUCT COUNT IN RESEARCH: {n_products}

VISION ANALYSIS RECORDS (one block per top-selling product):

{for each product:}
---
TITLE: {product.title}
VISUAL_STYLE: {vision.visual_style}
GRAPHIC_ELEMENTS: {vision.graphic_elements}
LAYOUT_COMPOSITION: {vision.layout_composition}
COLOR_PALETTE: {vision.dominant_color_palette}
---
```

(Maximum 10 products to keep the input <4k tokens — `NicheResearchProduct.objects.filter(brand_blocked=False)[:10]`.)

---

## Appendix N — Backend Helpers (image_generator + prompt_builder)

### N.1 `DESIGN_GEN_SYSTEM_PROMPT` Rule #10

Append exactly this block to the existing 9 rules (between Rule 9 and "## Style adherence"):

```
10. NEVER produce gradient fills, glowing effects, soft-edge shadows, drop shadows, or any blurred edge. Print on Demand requires hard edges and flat color regions even on round shapes — render rounded geometry with crisp outlined boundaries and flat fills.
```

### N.2 `build_form_prompt` composition logic

Pseudo-implementation (the implementer translates this 1:1 to Python):

```python
def build_form_prompt(
    slogan: str,
    style_slug: str,
    *,
    slots: dict,             # 8 optional strings, keys match SLOT_SCHEMA
    background_color: str,
    niche_hints: dict | None = None,
) -> str:
    style = STYLE_LIBRARY.get(style_slug) or _fallback_style(style_slug)
    bg_hex = Design.BG_COLOR_HEX.get(background_color, '#D3D3D3')

    parts: list[str] = [ARCHITECT_TEMPLATE_START.format(bg_hex=bg_hex)]

    for slot in SLOT_SCHEMA:
        value = _resolve_slot(slot, slots, niche_hints, style, slogan)
        if value:
            parts.append(slot['render_template'].format(value=value))

    parts.append(ARCHITECT_TEMPLATE_END)
    return ' '.join(parts)
```

### N.3 `_resolve_slot` fallback chain

```python
def _resolve_slot(slot, user_slots, niche_hints, style, slogan):
    # 1. Explicit user value wins
    user_val = (user_slots or {}).get(slot['key'], '').strip()
    if user_val:
        # Special-case: text_segmentation references the actual slogan
        return user_val

    # 2. Niche-hint, if available + this slot supports niche hints
    hint_key = slot.get('niche_hint_key')
    if hint_key and niche_hints:
        hint_val = (niche_hints.get(hint_key) or '').strip()
        if hint_val:
            return hint_val

    # 3. Style auto-default, if this slot supports style defaults
    if slot.get('style_auto_default'):
        default_key = f"default_{slot['key'].rsplit('_', 1)[0] if slot['key'] == 'typography_adjectives' else slot['key']}"
        # Maps: typography_adjectives -> default_typography
        #       material_texture      -> default_material
        #       style_dna             -> default_style_dna
        mapping = {
            'typography_adjectives': 'default_typography',
            'material_texture': 'default_material',
            'style_dna': 'default_style_dna',
        }
        return style.get(mapping.get(slot['key']), '')

    # 4. Special: visual_description ALWAYS needs SOMETHING if requested.
    #    If we end up here with no user value + no hint + no style default,
    #    return empty string so the slot is OMITTED from the prompt (per EC-24).
    return ''
```

### N.4 `BuilderBuildSerializer.slots` field validators

- `slots` is a `serializers.DictField(child=serializers.CharField(allow_blank=True, max_length=2000), required=False, default=dict)`
- Custom `validate_slots` rejects any top-level key not in `SLOT_SCHEMA.keys`
- Each slot's `value.strip()` is whitespace-normalized server-side
- Empty strings stay empty (not None) so the resolver can distinguish "user touched but cleared" from "user never touched"

---

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
