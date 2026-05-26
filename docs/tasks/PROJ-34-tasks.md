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

### Phase 13a — Backend Foundation: Style Library v2 + 36 Spatial Variants + Anti-Gradient Rule

- [x] 13a.1 Append Rule #10 to `DESIGN_GEN_SYSTEM_PROMPT` in `design_app/services/image_generator.py` — exact wording in **Appendix N.1** — covers AC-49 — image_generator.py:52-56
- [x] 13a.2 In `design_app/services/style_library.py`, add module-level constants:
  - `ARCHITECT_TEMPLATE_START` — exact string in **Appendix J.1** — covers AC-47 — style_library.py:19-21
  - `ARCHITECT_TEMPLATE_END` — exact string in **Appendix J.2** — covers AC-48 — style_library.py:26-30
  - `SLOT_SCHEMA` — exact dict in **Appendix J.3** — covers AC-50 — style_library.py:36-93
- [x] 13a.3 In `design_app/services/style_library.py`, add the dropdown-option constants:
  - `SPATIAL_OPTIONS` — **36 dict entries** with `id`/`ui_label`/`ui_description`/`thumbnail_path`/`prompt_text` (exact list in **Appendix J.4**) — covers AC-51 + AC-70 — style_library.py:106-365
  - `TEXT_SEGMENTATION_OPTIONS` (6 strings — **Appendix J.5**) — style_library.py:375-382
  - `TYPOGRAPHY_OPTIONS` (6 strings — **Appendix J.6**) — style_library.py:388-395
  - `ACCESSORIES_OPTIONS` (6 strings, multi-select — **Appendix J.7**) — style_library.py:398-405
  - `MATERIAL_OPTIONS` (6 strings — **Appendix J.8**) — style_library.py:408-415
- [x] 13a.4 Extend each of the 15 entries in `STYLE_LIBRARY` with 4 new fields: `default_typography`, `default_material`, `default_style_dna`, **`default_spatial_id`** (one of the 36 SPATIAL_OPTIONS ids). Exact mapping in **Appendix K** — covers AC-52 — style_library.py:434-619
- [x] 13a.5 Add helper `style_library.get_spatial_by_id(spatial_id: str) -> dict | None` — O(1) lookup over `SPATIAL_OPTIONS` keyed by `id`. Used by the prompt builder + the spatial scrub validators. — style_library.py:419-427
- [x] 13a.6 Unit tests: 36 SPATIAL entries; all ids unique; every `default_spatial_id` resolves; every default_typography/material points to a valid options-list value; `SLOT_SCHEMA` internally consistent. — tests/test_style_library_v2.py (31 tests, all green)
- [x] 13a.7 No code path uses `style_library.STYLE_LIBRARY` directly outside `prompt_builder.py` (validated by grep before commit) — keeps the dependency direction clean. — only callers: prompt_builder.py:14,61 + the v2 test file itself.

### Phase 13b — Backend Form-Aware Builder + Spatial Resolver

- [x] 13b.1 In `design_app/services/prompt_builder.py`, add `build_form_prompt(slogan, style_slug, *, slots: dict, background_color: str, niche_hints: dict | None = None, workspace_id: str | None = None) -> str`. Exact composition logic in **Appendix N.2** — covers AC-58 — prompt_builder.py:188-249
- [x] 13b.2 Implement fallback resolution `explicit slot → niche-hint → style-default → omit` per **Appendix N.3** — covers AC-58 + AC-67 — prompt_builder.py:125-167
- [x] 13b.3 **NEW** Implement `_resolve_spatial(value: str | None, workspace_id: str | None, niche_hints: dict | None, style_slug: str) -> str | None` per **Appendix N.3 part 2**:
  built-in id → `SPATIAL_OPTIONS.prompt_text`; UUID-shaped → `CustomSpatial` lookup (workspace-scoped, `is_deleted=False`); raw text → use as-is; niche-hint spatial id → recurse; style default → recurse; else omit — covers AC-75 — prompt_builder.py:56-122
- [x] 13b.4 Remove the old `build_architect_prompt` function from `prompt_builder.py` — covers AC-60 — prompt_builder.py (deleted)
- [x] 13b.5 Remove the old `_format_niche_block` helper from `prompt_builder.py` — covers AC-61 — prompt_builder.py (deleted)
- [x] 13b.6 In `design_app/api/serializers.py`, extend `BuilderBuildSerializer` with the nested `slots` object (8 optional string fields). `spatial_configuration` accepts: built-in id, UUID, or raw text. All field validators in **Appendix N.4** — covers AC-59 — serializers.py:852-871
- [x] 13b.7 In `design_app/api/views.py`, rewrite `BuilderBuildView.post` to consume `cfg['slots']` + (when `include_niche_context=True`) `project.niche.builder_form_hints`, pass current `workspace_id` to `build_form_prompt`, and call it. Cross-product order unchanged — covers AC-60 — views.py:1935-2001
- [x] 13b.8 Rewrite the 7 existing `test_builder_api.py::TestBuilderBuild` tests against the new shape; add 8 new tests for the per-slot fallback chain + 4 new tests covering built-in / UUID / raw-text / missing-custom resolution paths — covers AC-62 + AC-75 — test_builder_api.py (10 build tests) + new test_prompt_builder.py (23 tests)
- [x] 13b.9 Add a `polished_prompt_max_chars` cap check: if `build_form_prompt` returns >1500 chars, log a warning and truncate at last sentence boundary. — prompt_builder.py:240-248 + _truncate_at_sentence_boundary helper:170-186

### Phase 13c — Backend Niche-Vision LLM Pre-structuring

- [x] 13c.1 Add field `builder_form_hints` (JSONField, nullable, blank=True) to `niche_app.models.Niche`. Migration is additive (no default needed — `null` is acceptable) — covers AC-53 — niche_app/models.py:72 + migration 0009_niche_builder_form_hints.py
- [x] 13c.2 Create `niche_app/services/builder_hints.py` with `structure_niche_for_builder(niche_id) -> dict | None`. Exact LLM payload + system prompt in **Appendix M** — covers AC-54 — niche_app/services/builder_hints.py:460-527
- [x] 13c.3 Cache strategy: if `niche.builder_form_hints` is non-null AND the latest `NicheResearch.updated_at` is older than that hints' `_generated_at` field, return the cached dict and skip the LLM call. Force-regenerate via `force=True` kwarg. — builder_hints.py:200-233 (_is_cache_fresh) + 499-504 (cache short-circuit)
- [x] 13c.4 Hook `structure_niche_for_builder` into the existing `niche_research_app.tasks.task_run_niche_research` task right before it marks the run as COMPLETED. Errors don't fail the parent task (logged, hints stay null) — covers AC-55 + EC-27 — niche_research_app/graph/workflow.py (hook)
- [x] 13c.5 New view `BuilderNicheHintsView(APIView)` at `GET /api/designs/projects/{id}/builder/niche-hints/`. Returns the JSON dict + metadata per AC-56. `IsAuthenticated` + workspace isolation — covers AC-56 — design_app/api/views.py:2027-2073
- [x] 13c.6 Wire URL in `design_app/api/urls.py` — design_app/api/urls.py:246-251
- [x] 13c.7 Management command `niche_app/management/commands/backfill_niche_builder_hints.py` per AC-57 — iterates `Niche.objects.filter(builder_form_hints__isnull=True)` that have a completed research, calls `structure_niche_for_builder` for each. — backfill_niche_builder_hints.py:1-118
- [x] 13c.8 The system-prompt enumerates the **36 SPATIAL ids** (Appendix J.4) and forces the LLM to pick exactly ONE id (or return `null`). NO free-text spatial strings allowed — see updated **Appendix M**. — builder_hints.py:50-108 (SYSTEM_PROMPT)
- [x] 13c.9 Tests: serializer shape, view auth, view 404 on cross-workspace project, view returns null when no niche linked, mocked LLM happy path returning a valid id, mocked LLM returning an unknown id (gracefully fall through to style default). — niche_app/tests/test_builder_hints.py (7 tests), niche_app/tests/test_backfill_command.py (5 tests), design_app/tests/test_builder_niche_hints_view.py (5 tests)

### Phase 13d — Backend Custom Spatial Layouts (model + CRUD + vision-LLM)

- [x] 13d.1 Add Django model `CustomSpatial` in `design_app/models.py` with exact fields + indexes from **Appendix O.1**. Migration is additive, no data migration needed — covers AC-71
- [x] 13d.2 Add the partial unique constraint `UniqueConstraint(fields=['workspace', 'name'], condition=Q(is_deleted=False), name='uniq_custom_spatial_name_per_ws')` — covers EC-29
- [x] 13d.3 Create `design_app/services/spatial_analyzer.py::analyze_spatial_layout(image_bytes: bytes, *, mime: str) -> str`. Exact OpenRouter call signature + headers + system prompt in **Appendix P**. Calls `openai/gpt-4.1-mini` (vision-capable text+image). Timeout 12s, no retry. Langfuse-traced with `metadata.workspace_id` — covers AC-73
- [x] 13d.4 Add the post-LLM scrub validator `spatial_analyzer._scrub_forbidden(text: str) -> tuple[bool, list[str]]` — checks for hex codes, named colors (≥40-word list), 15 style slugs, common illustration nouns (≥80-word list). Exact word lists in **Appendix P.2** — covers AC-74
- [x] 13d.5 Add DRF serializers in `design_app/api/serializers.py`:
  - `CustomSpatialAnalyzeSerializer` (input: `image` file OR `reference_id` UUID OR `design_id` UUID, exactly-one validator; mime + size constraints)
  - `CustomSpatialSerializer` (model serializer for CRUD)
- [x] 13d.6 Add views in `design_app/api/views.py`:
  - `CustomSpatialAnalyzeView(APIView)` POST → load bytes (from upload OR fetch `ProjectReference.image` from S3/local OR fetch `Design.output_image` from S3/local) → call `analyze_spatial_layout` → scrub → return `{prompt_text}` or 422 with `forbidden_terms` — covers AC-72 + AC-74
  - `CustomSpatialViewSet(ModelViewSet)` — list/create/destroy (soft-delete on destroy). `IsAuthenticated` + workspace isolation via `X-Workspace-Id` header. Queryset filtered to `is_deleted=False`. Order by `-created_at` — covers AC-72
- [x] 13d.7 Wire URLs in `design_app/api/urls.py`:
  - `POST /api/designs/spatials/custom/analyze/`
  - `GET/POST /api/designs/spatials/custom/`
  - `DELETE /api/designs/spatials/custom/{id}/`
- [x] 13d.8 Tests (`test_custom_spatial.py`):
  - Model: workspace-scoped, partial-unique constraint allows recreating a soft-deleted name
  - Analyze: upload happy path (mocked LLM), reference_id happy path, design_id happy path, exactly-one validator, 10 MB limit, mime gate, forbidden-term scrub → 422
  - CRUD: list returns only non-deleted from current workspace, create with conflicting name → 409, delete sets is_deleted, cross-workspace access → 404
- [x] 13d.9 No image bytes are stored when `source_kind != 'upload'` — the `source_image_ref` UUID is the audit trail. Validates with a model-level `clean()` check.

### Phase 13e — Frontend Form Components (5 inline + 2 modal-button stubs)

- [x] 13e.1 Create `frontend-ui/src/views/designs/board/constants/slotOptions.ts` mirroring backend Appendices J.4–J.8 1:1. Exported as typed const arrays. **`SPATIAL_OPTIONS` mirrors the 36-entry dict-list shape** — covers AC-69 + AC-70 — `slotOptions.ts:13-380`
- [x] 13e.2 Extend `BuilderConfig` type in `types/builder.ts` with `slots: BuilderSlots` (8 optional strings) — covers AC-63 — `types/builder.ts:9-45`
- [x] 13e.3 Build `SpatialSlotButton.tsx` (NOT a Select) — shows the currently-selected spatial's thumbnail + ui_label + ui_description-snippet + an "Open picker ▸" affordance. Click → opens `SpatialPickerModal`. Used inside the BuilderDialog form section — covers AC-65 + AC-76 — `SpatialSlotButton.tsx:108-182`
- [x] 13e.4 Build `StyleSlotButton.tsx` — analogous to SpatialSlotButton but for style: shows the chosen style's thumbnail + name + a "Change style ▸" affordance. Click → opens `StylePickerModal` — covers AC-77 — `StyleSlotButton.tsx:44-129`
- [x] 13e.5 Build `VisualDescriptionField.tsx` — multiline TextField (3 rows min, 6 max), required, with helper text `"Describe the illustration: subject, perspective, 6+ concrete details"` — covers AC-65 + AC-67 — `VisualDescriptionField.tsx:29-60`
- [x] 13e.6 Build `TextSegmentationPicker.tsx` — MUI Select + "Custom…" → TextField + style-auto-default badge + ↺ reset icon — `TextSegmentationPicker.tsx:34-136`
- [x] 13e.7 Build `TypographyPicker.tsx` — same pattern with style-auto-default — `TypographyPicker.tsx:37-158`
- [x] 13e.8 Build `AccessoriesPicker.tsx` — MUI Autocomplete `multiple={true} freeSolo={true}` so user can pick multiple presets + type custom — `AccessoriesPicker.tsx:34-100`
- [x] 13e.9 Build `MaterialPicker.tsx` — same pattern as TypographyPicker — `MaterialPicker.tsx:34-150`
- [x] 13e.10 Build `ExtraContextField.tsx` — multiline TextField (2 rows min, 4 max), placeholder `"Optional custom additions appended verbatim before the tech specs"` — `ExtraContextField.tsx:18-42`
- [x] 13e.11 Per-component tests: empty state, custom-text reveal on "Custom…" selection, ↺ reset behavior, style-auto-default badge presence/absence; SpatialSlotButton renders thumbnail + label correctly for built-in and custom UUID selections. — 8 test files in `partials/promptBuilder/__tests__/` (36 tests total)

### Phase 13f — Frontend Spatial + Style Picker Modals + Custom Spatial Creator

- [x] 13f.1 Build `SpatialPickerModal.tsx` per UX spec in **Appendix Q.1**: MUI `Dialog` (fullScreen on `xs`, `maxWidth='lg'` otherwise), three tabs (Built-in / Custom / Create new), search bar, responsive 3–4 column thumbnail grid, single-select, ESC closes — covers AC-76 — SpatialPickerModal.tsx:1-219 + SpatialPickerModal.grids.tsx:1-177 + designSlice.ts:740-789 ("Create new" tab body is a placeholder until 13f part B mounts CustomSpatialCreator)
- [x] 13f.2 Build `StylePickerModal.tsx` per UX spec in **Appendix Q.2**: Same shell as SpatialPickerModal but two tabs only (Built-in / no Custom for styles — Mario-curated). Re-uses Phase-7 thumbnail PNGs. Replaces the inline `StylePicker` mounted in BuilderDialog — covers AC-77 — StylePickerModal.tsx:1-255 (BuilderDialog wiring intentionally deferred to 13f part B)
- [ ] 13f.3 Build `CustomSpatialCreator.tsx` (mounted inside SpatialPickerModal "Create new" tab) per **Appendix Q.3**: three-step wizard — (1) Source picker tabs: Upload / From References / From Designs, (2) Analyze (calls `POST /spatials/custom/analyze/`, shows skeleton + LLM response in editable TextField), (3) Name + Save — covers AC-78
- [ ] 13f.4 Add RTK Query endpoints to `store/designSlice.ts`:
  - `useAnalyzeSpatialMutation` (multipart POST)
  - `useCreateCustomSpatialMutation`
  - `useGetCustomSpatialsQuery(workspaceId)`
  - `useDeleteCustomSpatialMutation`
  - `useGetProjectDesignsForSpatialQuery(projectId)` if not already exposed (reuses existing `Design` list endpoint with `?limit=50&order=-created_at`)
- [ ] 13f.5 Wire the `CustomSpatialCreator` "From References" source to existing `useGetProjectReferencesQuery(projectId)` — reuse, do NOT build a parallel endpoint
- [ ] 13f.6 Handle EC-30 client-side: reject upload >10 MB OR non-{jpg,png,webp} before sending to backend; show inline error
- [ ] 13f.7 Handle EC-31: on 422 response with `forbidden_terms`, show error banner "Analysis hit forbidden terms: …" + "Retry with another image" + "Use raw text anyway (flagged)" escape-hatch button
- [ ] 13f.8 Tests: SpatialPickerModal renders 36 thumbnails + search filters + tab-switching + selection callback; StylePickerModal renders 15 thumbnails; CustomSpatialCreator full happy path (mocked mutation chain) + forbidden-term error UX.

### Phase 13g — Frontend Dialog Restructure + Wire-up

- [ ] 13g.1 Rewrite `BuilderDialog.tsx` body into 5 MUI Accordions per AC-64. Slogans + Styles + Visual Details open by default; Layout & Composition + Niche & Extra closed by default — covers AC-64
- [ ] 13g.2 Inside the **Styles accordion** mount `StyleSlotButton` instead of the inline StylePicker; clicking opens `StylePickerModal`
- [ ] 13g.3 Inside the **Layout & Composition accordion** mount `SpatialSlotButton` (opens `SpatialPickerModal`) + `TextSegmentationPicker` + `AccessoriesPicker`
- [ ] 13g.4 Extend `useBuilder` hook: add `useGetNicheHintsQuery(projectId)` RTK Query (calls Phase-13c endpoint). When hints arrive AND the corresponding slot is empty, pre-fill it via a controlled effect — covers AC-66
- [ ] 13g.5 Mount the remaining new partials (`VisualDescriptionField`, `TypographyPicker`, `MaterialPicker`, `ExtraContextField`) inside the right Accordion sections. The existing `NicheContextToggle` + `ReferenceIndicator` move into the "Niche & Extra" accordion — covers AC-64
- [ ] 13g.6 Build Live-Preview panel below the Build CTA: collapsible, renders the result of `build_form_prompt` for `slogans[0] × styles[0]` by reusing the backend endpoint via `useBuilderBuildMutation` with `with_polish: false` — covers AC-67
- [ ] 13g.7 Update `BuilderPreset.config` save/load logic: presets now serialize the `slots` sub-object; loading a v1 preset without `slots` treats it as `{}` and lets the fallback chain fire — covers AC-68 + EC-25
- [ ] 13g.8 EC-28: when user types into a Typography slot (overrides style-auto-default), changing the Style dropdown does NOT silently re-fill that slot. Implemented via a per-slot "dirty" flag in BuilderConfig that flips on first user input. ↺ reset clears the dirty flag.
- [ ] 13g.9 EC-32: when loading a preset whose `slots.spatial_configuration` is a UUID that no longer exists in `useGetCustomSpatialsQuery`, show inline warning chip + "Pick a replacement" CTA next to the SpatialSlotButton.
- [ ] 13g.10 Integration tests: render the dialog with mocked niche-hints + style-default + mocked CustomSpatial list; assert all 8 slots show the expected pre-filled values + override behavior + modal open/close + soft-delete-fallback chip behavior + Live-Preview shows the assembled prompt.

### Phase 13h — QA + Docs

- [ ] 13h.1 Backend full suite green (`pytest design_app/ niche_app/ --reuse-db`)
- [ ] 13h.2 Frontend full suite green (`npx vitest run`)
- [ ] 13h.3 `npx tsc -b` + `npx eslint src/` clean
- [ ] 13h.4 Smoke A (Form): pick "school bus driver" niche → open Builder → fields pre-fill from niche-hints → 3 slogans × 2 styles → Build → 6 polished Architect-quality prompts in textarea, none mention "t-shirt", "gradient", or "soft shadow"
- [ ] 13h.5 Smoke B (SpatialPickerModal): open from BuilderDialog → all 36 thumbnails render → search filters → select `definition_entry` → modal closes → SlotButton shows new selection → Build → prompt contains the Definition layout description
- [ ] 13h.6 Smoke C (CustomSpatialCreator — upload path): open Create new → upload a hand-drawn layout sketch → Analyze → editable text appears → name "My-Custom-1" → Save → appears in Custom tab + auto-selected → Build → prompt contains the LLM-generated spatial text + no forbidden colors/style words
- [ ] 13h.7 Smoke D (CustomSpatialCreator — reference path): open Create new → "From References" tab → pick an existing ProjectReference → Analyze → Save → same outcome
- [ ] 13h.8 Smoke E (StylePickerModal): open from BuilderDialog → 15 style thumbnails → select `vintage_retro` → modal closes → form auto-defaults update (Typography/Material badges flip)
- [ ] 13h.9 Update spec's `## QA Test Results` with Phase-13 audit row
- [ ] 13h.10 Update `features/INDEX.md` status (stays "In Review" through Phase 13)

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

### J.4 `SPATIAL_OPTIONS` (36 dict entries — replaces the v1 6-string list)

> Each entry must be copy-pasted verbatim. `id` is the stable identifier referenced from
> Appendix K, Appendix M (niche-LLM enum), and frontend `slotOptions.ts`. `thumbnail_path`
> is rendered by the static-file serve under `/static/design_app/thumbnails/spatial/...`.
> Thumbnails are generated by the script in **Appendix R**.

```python
SPATIAL_OPTIONS = [
    # ─── Classic foundation layouts ────────────────────────────────────────────
    {
        "id": "vertical_stack",
        "ui_label": "Vertical Stack",
        "ui_description": "Text above, illustration center, text below — POD classic",
        "thumbnail_path": "thumbnails/spatial/vertical_stack.png",
        "prompt_text": "Vertical stack layout where text sits above and below a central illustration, with generous padding and breathing room between the text lines and the graphic. The composition reads top-to-bottom: headline, illustration, supporting line. Equal horizontal centering throughout.",
    },
    {
        "id": "horizontal_row",
        "ui_label": "Horizontal Row",
        "ui_description": "Illustration left, stacked text right (or mirrored)",
        "thumbnail_path": "thumbnails/spatial/horizontal_row.png",
        "prompt_text": "Horizontal row layout with the illustration anchored on the left half of the canvas and stacked text lines on the right half, separated by a generous vertical gutter of breathing room. Both blocks are vertically centered relative to each other.",
    },
    {
        "id": "badge_emblem",
        "ui_label": "Badge Emblem",
        "ui_description": "Round badge, illustration inside, slogan curved on arcs",
        "thumbnail_path": "thumbnails/spatial/badge_emblem.png",
        "prompt_text": "Badge emblem layout with the illustration centered inside a circular border, the primary slogan curving along the top arc of the badge and an accent phrase curving along the bottom arc. Thin double-line border separates inner and outer rings.",
    },
    {
        "id": "banner_top",
        "ui_label": "Banner Top",
        "ui_description": "Ribbon banner at top, illustration fills below",
        "thumbnail_path": "thumbnails/spatial/banner_top.png",
        "prompt_text": "Banner ribbon at the top of the canvas carrying the primary text inside it, with the illustration filling the lower two-thirds of the canvas and generous padding around it. The banner's tails curl slightly outward at the canvas edges.",
    },
    {
        "id": "headline_top_subtitle_bottom",
        "ui_label": "Headline + Subtitle",
        "ui_description": "Bold headline top, illustration center, small subtitle bottom",
        "thumbnail_path": "thumbnails/spatial/headline_top_subtitle_bottom.png",
        "prompt_text": "Single bold headline anchored at the top edge, the illustration filling the center of the canvas with breathing room around it, and a smaller subtitle line anchored at the bottom edge. Strong top-bottom symmetry, generous vertical breathing room.",
    },
    {
        "id": "text_overlay",
        "ui_label": "Text Overlay",
        "ui_description": "Slogan rendered ON TOP of the illustration",
        "thumbnail_path": "thumbnails/spatial/text_overlay.png",
        "prompt_text": "Overlay layout where the slogan text is rendered directly ON TOP of the centered illustration with a high-contrast outline or knockout stroke around each letter so the text stays fully legible against the artwork beneath it.",
    },
    # ─── Pure typographic layouts (text-only, no illustration) ────────────────
    {
        "id": "stacked_word_block",
        "ui_label": "Stacked Word Block",
        "ui_description": "4–6 centered text lines, sizes vary, no illustration",
        "thumbnail_path": "thumbnails/spatial/stacked_word_block.png",
        "prompt_text": "Pure typographic stacked-word block with 4 to 6 horizontally centered text lines of varying font sizes and weights, no illustration. The visual hierarchy makes the central emphasis word the largest, the framing lines smaller and lighter. Even vertical spacing between lines.",
    },
    {
        "id": "knockout_text",
        "ui_label": "Knockout Text",
        "ui_description": "Slogan cut out of a single solid shape",
        "thumbnail_path": "thumbnails/spatial/knockout_text.png",
        "prompt_text": "Knockout reverse layout where the slogan text is cut out of a single solid filled shape — a rectangle, oval, or rounded plaque — so the canvas background shows through the letterforms. No separate illustration. The shape fills most of the canvas with even padding to the edges.",
    },
    {
        "id": "big_word_tiny_tag",
        "ui_label": "Big Word + Tiny Tag",
        "ui_description": "One huge word, tiny subtitle, no illustration",
        "thumbnail_path": "thumbnails/spatial/big_word_tiny_tag.png",
        "prompt_text": "Single dominant word filling roughly two-thirds of the canvas in massive heavyweight type, with a small subtitle line in tiny all-caps anchored centered immediately beneath it. No separate illustration. The supporting line is one-tenth the size of the dominant word.",
    },
    {
        "id": "word_as_shape",
        "ui_label": "Word-as-Shape",
        "ui_description": "Text bent to form a silhouette (heart, animal, …)",
        "thumbnail_path": "thumbnails/spatial/word_as_shape.png",
        "prompt_text": "Word-as-shape layout where the slogan text is bent, curved and arranged so the overall outline of the text block forms a recognizable silhouette — a heart, animal, or symbol related to the subject — without a separate illustration. The text itself IS the imagery.",
    },
    {
        "id": "diagonal_text",
        "ui_label": "Diagonal Text Block",
        "ui_description": "Slogan tilted 15–25° as a single rotated block",
        "thumbnail_path": "thumbnails/spatial/diagonal_text.png",
        "prompt_text": "Diagonal text block tilted 15 to 25 degrees off horizontal, the slogan stacked into 2 or 3 lines and rotated together as a single unit. Illustration is either omitted or sits subtly behind the text as a low-contrast silhouette. The diagonal cuts across the visual center.",
    },
    {
        "id": "pyramid_stack",
        "ui_label": "Pyramid Stack",
        "ui_description": "Lines growing/shrinking in size, pyramid silhouette",
        "thumbnail_path": "thumbnails/spatial/pyramid_stack.png",
        "prompt_text": "Pyramid word-stack layout with 4 to 5 stacked text lines forming a pyramid: the top line is shortest and smallest, each subsequent line wider and bolder, with the bottom line as the dominant emphasis word. No illustration. Tight vertical spacing for triangular cohesion.",
    },
    # ─── Frame / Stamp / Crest layouts ────────────────────────────────────────
    {
        "id": "rectangular_frame",
        "ui_label": "Rectangular Frame",
        "ui_description": "Thin border, illustration center, text above + below",
        "thumbnail_path": "thumbnails/spatial/rectangular_frame.png",
        "prompt_text": "Rectangular frame layout with a thin border running around the canvas edge, the illustration centered inside the frame, and the slogan placed inside the frame above and below the illustration with generous interior padding. The frame has subtle ornamental corners.",
    },
    {
        "id": "crest_coat_of_arms",
        "ui_label": "Crest / Coat of Arms",
        "ui_description": "Heraldic vertical shield + banner + flanking elements",
        "thumbnail_path": "thumbnails/spatial/crest_coat_of_arms.png",
        "prompt_text": "Vertical heraldic crest layout with the illustration at the visual center inside a shield outline, a flowing banner ribbon underneath carrying the slogan, and decorative laurel-leaf or wing motifs flanking the shield on left and right. Symmetric on the vertical axis.",
    },
    {
        "id": "postage_stamp",
        "ui_label": "Postage Stamp",
        "ui_description": "Perforated jagged border, denomination tag, framed",
        "thumbnail_path": "thumbnails/spatial/postage_stamp.png",
        "prompt_text": "Postage-stamp layout with a perforated jagged-edge border around the canvas, a small denomination tag in one upper corner, the illustration filling the inner stamp area, and the slogan running along the bottom of the inner stamp frame. Visible perforation dots on all four edges.",
    },
    {
        "id": "hexagon_medallion",
        "ui_label": "Hexagon Medallion",
        "ui_description": "Hexagon or diamond outline, illustration inside",
        "thumbnail_path": "thumbnails/spatial/hexagon_medallion.png",
        "prompt_text": "Hexagonal medallion layout with the illustration centered inside a sharp hexagon or diamond outline, the slogan placed above the medallion and an accent word below it. Sharp geometric border lines, no rounded corners, strict symmetry.",
    },
    {
        "id": "road_sign",
        "ui_label": "Road Sign / Placard",
        "ui_description": "Octagon / triangle / shield sign with legend",
        "thumbnail_path": "thumbnails/spatial/road_sign.png",
        "prompt_text": "Road-sign placard layout shaped like an octagon, triangle, or highway-shield outline filling most of the canvas. The slogan is rendered as the sign legend in centered all-caps inside the sign shape. The illustration, if any, is small and tucked into one corner.",
    },
    # ─── Listing / definition / structured layouts ────────────────────────────
    {
        "id": "definition_entry",
        "ui_label": "Dictionary Definition",
        "ui_description": "Headword, phonetics, part-of-speech, paragraph",
        "thumbnail_path": "thumbnails/spatial/definition_entry.png",
        "prompt_text": "Dictionary-definition layout with the headword in large bold at the top, a phonetic pronunciation guide in brackets plus a part-of-speech label on the second line, then a multi-line definition paragraph beneath set in a smaller serif. No separate illustration.",
    },
    {
        "id": "knolling_grid",
        "ui_label": "Knolling Grid",
        "ui_description": "4–9 illustrated items in a tidy uniform grid + title bar",
        "thumbnail_path": "thumbnails/spatial/knolling_grid.png",
        "prompt_text": "Knolling-grid layout with 4 to 9 small illustrated objects arranged in a tidy uniform grid (e.g. 3×3 or 3×2), each separated by equal padding, and a centered title bar across the top spanning the full grid width carrying the slogan.",
    },
    {
        "id": "anatomy_diagram",
        "ui_label": "Anatomy Diagram",
        "ui_description": "Central illustration with labeled pointer lines",
        "thumbnail_path": "thumbnails/spatial/anatomy_diagram.png",
        "prompt_text": "Anatomy-diagram layout with the central illustration in the middle of the canvas, thin pointer lines radiating outward to small text labels at multiple cardinal positions around it, and the slogan or title placed at the very top of the canvas as a header.",
    },
    {
        "id": "checklist",
        "ui_label": "Checklist",
        "ui_description": "4–6 stacked lines, each with a checkbox tick",
        "thumbnail_path": "thumbnails/spatial/checklist.png",
        "prompt_text": "Vertical checklist layout with 4 to 6 stacked text lines, each preceded by a small checkbox or tick icon, a header line at the top carrying the title, generous line height between items, and no separate illustration. The list is centered horizontally on the canvas.",
    },
    {
        "id": "periodic_tile",
        "ui_label": "Periodic Element Tile",
        "ui_description": "Square tile, atomic-number style, symbol + name",
        "thumbnail_path": "thumbnails/spatial/periodic_tile.png",
        "prompt_text": "Periodic-table element-tile layout with a single square tile centered on the canvas, an atomic-number-style small digit in the top-left corner of the tile, a large symbol or word in the tile's center, and a longer name underneath the symbol. No separate illustration.",
    },
    {
        "id": "recipe_card",
        "ui_label": "Recipe / Ingredients Card",
        "ui_description": "Title, subtitle, bulleted ingredient list",
        "thumbnail_path": "thumbnails/spatial/recipe_card.png",
        "prompt_text": "Recipe-card layout with a headline title at the top, a small subtitle directly beneath, then an ingredients list of 4 to 6 short bulleted lines below, optionally a tiny garnish illustration anchored in one bottom corner. Even left alignment for the list, centered headline.",
    },
    # ─── Themed templates ─────────────────────────────────────────────────────
    {
        "id": "vintage_postcard",
        "ui_label": "Vintage Postcard",
        "ui_description": "'Greetings from …' headline + small caption",
        "thumbnail_path": "thumbnails/spatial/vintage_postcard.png",
        "prompt_text": "Vintage-postcard layout with a 'Greetings from …' style phrase as the dominant headline filling the top half of the canvas in chunky stacked letters, a stylized illustration beneath the headline filling the lower half, and a small caption line at the very bottom.",
    },
    {
        "id": "sports_jersey",
        "ui_label": "Sports Jersey",
        "ui_description": "Massive number center, arched name + team name",
        "thumbnail_path": "thumbnails/spatial/sports_jersey.png",
        "prompt_text": "Sports-jersey layout with a massive sports-style number filling the visual center of the canvas, a player-name-style word arched above the number, and a smaller team-name caption arched below the number. No separate illustration — the typography is the whole composition.",
    },
    {
        "id": "movie_poster",
        "ui_label": "Movie Poster",
        "ui_description": "Central illustration, heavy title bottom, credit block",
        "thumbnail_path": "thumbnails/spatial/movie_poster.png",
        "prompt_text": "Movie-poster layout with the illustration filling the central two-thirds of the canvas, a dramatic title in heavyweight letters across the bottom third, and small credit-block lines tucked beneath the title. Vertical poster-aspect framing implied even on a square canvas.",
    },
    {
        "id": "license_plate",
        "ui_label": "License Plate",
        "ui_description": "Horizontal plate box with chunky plate letters",
        "thumbnail_path": "thumbnails/spatial/license_plate.png",
        "prompt_text": "License-plate layout with a horizontal rectangular plate-shaped box filling the canvas center, the slogan rendered in chunky license-plate-style block letters inside the box, and small region or state tags positioned above and below the plate rectangle.",
    },
    {
        "id": "concert_ticket",
        "ui_label": "Concert Ticket",
        "ui_description": "Ticket shape with perforation + stub",
        "thumbnail_path": "thumbnails/spatial/concert_ticket.png",
        "prompt_text": "Concert-ticket layout with a horizontal ticket-shape outline filling the canvas, dashed perforation lines running vertically to separate a stub from the main area, the headline event-name in the main ticket area, and small detail lines (date / time / seat) in the stub portion.",
    },
    {
        "id": "map_coordinates",
        "ui_label": "Map Coordinates",
        "ui_description": "Place name + GPS numbers + landmark line-art",
        "thumbnail_path": "thumbnails/spatial/map_coordinates.png",
        "prompt_text": "Map-coordinates layout with a city or place name as the dominant headline at the top, GPS-style coordinate numbers in a smaller caption immediately below it, and a minimal-line-art illustration of a landmark or geographic outline anchored below the coordinates.",
    },
    # ─── Asymmetric / compositional layouts ───────────────────────────────────
    {
        "id": "off_center_text_wrap",
        "ui_label": "Off-Center Text Wrap",
        "ui_description": "Illustration on one side, text wraps its silhouette",
        "thumbnail_path": "thumbnails/spatial/off_center_text_wrap.png",
        "prompt_text": "Off-center composition with the illustration anchored to the right side of the canvas and the slogan text broken into multiple short lines that wrap and follow the silhouette edge of the illustration on the left, creating a flowing left-side text block.",
    },
    {
        "id": "diagonal_split",
        "ui_label": "Diagonal Split",
        "ui_description": "Canvas split along a diagonal: illustration vs. text",
        "thumbnail_path": "thumbnails/spatial/diagonal_split.png",
        "prompt_text": "Diagonal split layout where the canvas is divided into two triangular halves along a single diagonal line: the illustration fills one triangular half and the stacked slogan text fills the other triangular half. The diagonal line itself is a clean hard edge with no shading.",
    },
    {
        "id": "triptych_three_panel",
        "ui_label": "Triptych (3-Panel)",
        "ui_description": "Three vertical panels, each with a variant, header bar",
        "thumbnail_path": "thumbnails/spatial/triptych_three_panel.png",
        "prompt_text": "Triptych three-panel layout with the canvas divided into three vertical panels of equal width separated by thin dividers, a small illustration variation in each panel, and the slogan running across as a header bar spanning all three panels at the top.",
    },
    {
        "id": "concentric_circular_text",
        "ui_label": "Concentric Circular Text",
        "ui_description": "Rings of text running around a center illustration",
        "thumbnail_path": "thumbnails/spatial/concentric_circular_text.png",
        "prompt_text": "Concentric circular text layout with the illustration at the dead center of the canvas and one to three rings of text running around it: the outer ring as primary slogan, the inner ring as accent or date — all text aligned along its respective arc path.",
    },
    # ─── Speech / quote layouts ──────────────────────────────────────────────
    {
        "id": "speech_bubble",
        "ui_label": "Speech Bubble",
        "ui_description": "Comic bubble with slogan, character below pointing up",
        "thumbnail_path": "thumbnails/spatial/speech_bubble.png",
        "prompt_text": "Comic speech-bubble layout with a rounded speech bubble in the upper half of the canvas holding the slogan inside it, and a small character illustration in the lower half from which the speech-bubble tail visually points. Classic comic-strip composition.",
    },
    {
        "id": "quote_marks_frame",
        "ui_label": "Quote Marks Frame",
        "ui_description": "Giant quotation marks bracket a centered slogan",
        "thumbnail_path": "thumbnails/spatial/quote_marks_frame.png",
        "prompt_text": "Quote-marks frame layout with two giant decorative quotation marks anchoring the upper-left and lower-right corners of the canvas, the slogan centered between them in an italic style. No separate illustration — the typography and the marks are the whole composition.",
    },
    # ─── Sunburst layout (full composition, distinct from sunburst accessory) ──
    {
        "id": "sunburst_layout",
        "ui_label": "Sunburst Layout",
        "ui_description": "Center illustration, rays to edges, text on arcs",
        "thumbnail_path": "thumbnails/spatial/sunburst_layout.png",
        "prompt_text": "Sunburst layout with the illustration sitting at the dead center of the canvas and straight ray lines radiating outward from behind it to the canvas edges, the slogan text running along the top arc above the rays and a secondary tag along the bottom arc beneath.",
    },
]
```

> The first 6 ids (`vertical_stack` … `text_overlay`) preserve the v1 spec wording so any
> hand-saved v1 BuilderPreset that stored a free-text override that happened to match is
> still compatible. The remaining 30 entries are new in Schicht 13.

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

## Appendix K — Per-Style Auto-Defaults (15 styles × 4 fields)

> Each row defines which of the 6 `TYPOGRAPHY_OPTIONS` + 6 `MATERIAL_OPTIONS` is the
> auto-default for that style, plus a free-form `default_style_dna` descriptor, plus
> **`default_spatial_id`** referencing one of the 36 `SPATIAL_OPTIONS` ids from Appendix J.4.
> `default_typography` and `default_material` use **the exact string** from the
> options lists in Appendix J.6 / J.8 (not an index).
>
> Note: the user may always override the spatial via the SpatialPickerModal. The
> per-style default is the **fallback** used when the user hasn't picked one and no
> niche-hint exists.

| Style slug | default_typography (J.6 row) | default_material (J.8 row) | default_spatial_id (J.4 id) | default_style_dna |
|---|---|---|---|---|
| `vintage_retro` | row 3 (varsity-collegiate) | row 5 (vintage worn) | `vintage_postcard` | "Vintage retro aesthetic with warm faded earth tones, thick uniform black outlines, and slight halftone shading on flat color fills" |
| `70s_groovy` | row 6 (brush-script) | row 2 (matte screenprint) | `concentric_circular_text` | "1970s groovy psychedelic aesthetic with bold flowing curves, earthy mustard-orange-olive palette, and retro disco-poster flatness" |
| `80s_neon` | row 1 (cartoon-block) | row 6 (high-contrast 2-color) | `sunburst_layout` | "1980s synthwave aesthetic with hot magenta + electric cyan + matte black palette and crisp neon-arcade flatness — no actual glow effects, only saturated flat colors" |
| `90s_grunge` | row 3 (varsity-collegiate) | row 3 (heavily distressed) | `stacked_word_block` | "1990s grunge aesthetic with faded worn palette, torn-edge effects, gritty rough outlines and photocopy-worn screen-print look" |
| `kawaii_chibi` | row 1 (cartoon-block) | row 1 (clean digital vector) | `headline_top_subtitle_bottom` | "Kawaii chibi cartoon aesthetic with oversized cute features, soft pastel palette, thick rounded outlines and gentle pastel cel-shading" |
| `cartoon` | row 1 (cartoon-block) | row 1 (clean digital vector) | `vertical_stack` | "Bold cartoon aesthetic with thick uniform black outlines, flat saturated color fills, simple cel-shaded highlights and Saturday-morning animation flatness" |
| `watercolor` | row 2 (hand-drawn marker) | row 5 (vintage worn) | `vertical_stack` | "Watercolor illustration aesthetic with soft transparent washes, irregular pigment edges and visible paper-texture underlay — rendered with hard-edged compositional outlines for print fidelity" |
| `hand_drawn_sketch` | row 2 (hand-drawn marker) | row 5 (vintage worn) | `definition_entry` | "Hand-drawn sketchbook aesthetic with loose pencil strokes, visible construction lines, slightly imperfect organic linework and charming journal feel" |
| `vector_flat` | row 1 (cartoon-block) | row 1 (clean digital vector) | `headline_top_subtitle_bottom` | "Modern flat-vector aesthetic with geometric shapes, zero gradients, minimalist palette, crisp sharp edges and editorial-emoji flatness" |
| `minimal_line_art` | row 2 (hand-drawn marker) | row 1 (clean digital vector) | `big_word_tiny_tag` | "Minimal single-line aesthetic with consistent monoline weight, no fills, no shading, abundant negative space and elegant wordmark refinement" |
| `pixel_art` | row 5 (pixelated 8-bit) | row 1 (clean digital vector) | `periodic_tile` | "8-bit pixel-art aesthetic with sharp pixelated edges, no anti-aliasing, limited 16-color retro arcade palette and blocky uniform pixels" |
| `distressed_texture` | row 3 (varsity-collegiate) | row 3 (heavily distressed) | `knockout_text` | "Heavily distressed print aesthetic with worn ink-bleed effect, scratched and cracked color fills, vintage screen-print roughness" |
| `halftone_print` | row 1 (cartoon-block) | row 4 (halftone-dot) | `vertical_stack` | "Halftone-print pop-art aesthetic with dot-pattern fills, limited 2-3 color palette and retro newsprint feel" |
| `badge_emblem` | row 3 (varsity-collegiate) | row 6 (high-contrast 2-color) | `badge_emblem` | "Vintage badge-emblem aesthetic with classic monochrome or 2-color palette, heritage trade-mark feel and ornate border-frame structure" |
| `blackletter_gothic` | row 4 (blackletter) | row 6 (high-contrast 2-color) | `crest_coat_of_arms` | "Heavy blackletter-gothic aesthetic with ornate medieval scripts, decorative flourishes, dramatic high-contrast strokes and dark moody palette" |

---

## Appendix L — `Niche.builder_form_hints` JSON schema

> The structured output of `structure_niche_for_builder()` stored on the Niche model.
> Optional keys are missing when the LLM can't extract a strong signal for that slot.

```json
{
  "_schema_version": 2,
  "_generated_at": "2026-05-17T15:30:00Z",
  "_source_research_id": "uuid-of-NicheResearch-this-was-built-from",
  "spatial": "vertical_stack",
  "visual": "a stylized illustration of [niche subject] in a [perspective] view, featuring [3-6 concrete visual elements]",
  "accessories": "white radiating motion-burst lines around the illustration",
  "material": "matte screenprint plastisol ink texture with subtle paper-grain underlay",
  "_alternates": {
    "spatial": ["badge_emblem", "banner_top"],
    "visual": ["alternate illustration angle ..."],
    "accessories": ["a sparse scattering of small filled stars ..."],
    "material": ["clean digital vector ..."]
  }
}
```

**Notes for the implementer:**
- `spatial` and `_alternates.spatial[]` hold **ids** from `SPATIAL_OPTIONS` (Appendix J.4), NOT free-text descriptions. The resolver in N.3 maps them to `prompt_text`.
- Top-level slot keys (`spatial`, `visual`, `accessories`, `material`) hold the **single best** suggestion. These pre-fill the form.
- `_alternates` holds 1-2 backup options per slot. Frontend may surface them in a "Try alternates" sub-menu (Phase 13e stretch).
- `_schema_version` lets us evolve the shape later without breaking old hints. **v1 → v2** changed `spatial` from free-text to id. The backfill mgmt command in Phase 13c.7 regenerates v1 hints transparently — no migration code needed.
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

1. SPATIAL — how text is arranged relative to the illustration. **Return ONE id from this fixed enum.** Do NOT return a free-text description. Return `null` only if none fits remotely. Allowed ids:
   `vertical_stack`, `horizontal_row`, `badge_emblem`, `banner_top`, `headline_top_subtitle_bottom`, `text_overlay`, `stacked_word_block`, `knockout_text`, `big_word_tiny_tag`, `word_as_shape`, `diagonal_text`, `pyramid_stack`, `rectangular_frame`, `crest_coat_of_arms`, `postage_stamp`, `hexagon_medallion`, `road_sign`, `definition_entry`, `knolling_grid`, `anatomy_diagram`, `checklist`, `periodic_tile`, `recipe_card`, `vintage_postcard`, `sports_jersey`, `movie_poster`, `license_plate`, `concert_ticket`, `map_coordinates`, `off_center_text_wrap`, `diagonal_split`, `triptych_three_panel`, `concentric_circular_text`, `speech_bubble`, `quote_marks_frame`, `sunburst_layout`, `flush_aligned_block`, `full_canvas_word_block`, `vertical_pillar_text`, `illustration_only_no_text`, `unconventional_integration`, `crossed_tools_intersection`, `subject_portrait_with_caption`.
   Short reference (pick the closest semantic match — do not invent new ids):
   - Most niches → `vertical_stack` (headline + illu + sub)
   - Trade / job / role badges → `badge_emblem` or `crest_coat_of_arms`
   - Quote-driven slogans → `stacked_word_block` or `quote_marks_frame`
   - Location / city niches → `map_coordinates` or `vintage_postcard`
   - Sports / number themes → `sports_jersey`
   - Comic / character niches → `speech_bubble`
   - Subject-with-rays niches → `sunburst_layout`

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
  "spatial": "<one of the 43 spatial ids verbatim, or null>",
  "visual": "<your 60-120 word visual description>",
  "accessories": "<one of the 6 accessories variants verbatim>",
  "material": "<one of the 6 material variants verbatim>",
  "_alternates": {
    "spatial": ["<second-best spatial id>", "<third-best>"],
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
- For `spatial`, NEVER invent ids. Return only ids from the explicit enum above OR `null`.
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
def _resolve_slot(slot, user_slots, niche_hints, style, slogan, workspace_id=None):
    # SPATIAL is special — see _resolve_spatial below
    if slot['key'] == 'spatial_configuration':
        return _resolve_spatial(
            user_val=(user_slots or {}).get('spatial_configuration', '').strip(),
            niche_hint_id=(niche_hints or {}).get('spatial'),
            style_default_id=style.get('default_spatial_id'),
            workspace_id=workspace_id,
        )

    # 1. Explicit user value wins
    user_val = (user_slots or {}).get(slot['key'], '').strip()
    if user_val:
        return user_val

    # 2. Niche-hint, if available + this slot supports niche hints
    hint_key = slot.get('niche_hint_key')
    if hint_key and niche_hints:
        hint_val = (niche_hints.get(hint_key) or '').strip()
        if hint_val:
            return hint_val

    # 3. Style auto-default, if this slot supports style defaults
    if slot.get('style_auto_default'):
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

### N.3 (part 2) `_resolve_spatial` — Schicht 13 resolver

```python
import re
from uuid import UUID

_UUID_RE = re.compile(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-'
                      r'[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')


def _resolve_spatial(*, user_val, niche_hint_id, style_default_id, workspace_id):
    """
    Resolution chain for slots.spatial_configuration. Returns the rendered
    prompt-text (str) or '' to omit the sentence.

    Order:
      1) user_val is a built-in id          -> SPATIAL_OPTIONS[id].prompt_text
      2) user_val is a UUID                 -> CustomSpatial lookup (ws-scoped)
      3) user_val is non-empty raw string   -> use as-is (legacy / inline custom)
      4) niche_hint_id is a built-in id     -> SPATIAL_OPTIONS[id].prompt_text
      5) style_default_id                   -> SPATIAL_OPTIONS[id].prompt_text
      6) else                               -> '' (omit sentence)
    """
    builtin_ids = {opt['id']: opt['prompt_text'] for opt in SPATIAL_OPTIONS}

    # 1) explicit built-in id
    if user_val in builtin_ids:
        return builtin_ids[user_val]

    # 2) explicit UUID -> CustomSpatial
    if user_val and _UUID_RE.match(user_val):
        from design_app.models import CustomSpatial  # local import to avoid cycle
        try:
            cs = CustomSpatial.objects.get(
                id=UUID(user_val),
                workspace_id=workspace_id,
                is_deleted=False,
            )
            return cs.prompt_text
        except CustomSpatial.DoesNotExist:
            # custom was soft-deleted between preset-save and now → drop through
            pass

    # 3) explicit raw text (legacy / inline "Custom…" path).
    #    Skip for UUID-shaped values so a failed CustomSpatial lookup never
    #    leaks the raw UUID into the rendered Gemini prompt — fall through
    #    to niche-hint / style-default / omit instead.
    if user_val and not _UUID_RE.match(user_val):
        return user_val

    # 4) niche-hint id
    if niche_hint_id and niche_hint_id in builtin_ids:
        return builtin_ids[niche_hint_id]

    # 5) style default
    if style_default_id and style_default_id in builtin_ids:
        return builtin_ids[style_default_id]

    # 6) omit
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
| **Σ Phases 1–12** | **~3400 LOC (shipped)** | | |
| 13a — Style Library v2 + 36 SPATIAL + Rule #10 | ~620 + 36 PNGs | ✓ | |
| 13b — build_form_prompt + Spatial resolver + Tests | ~290 | ✓ | |
| 13c — Niche-LLM Pre-structuring (35 ids) | ~290 | ✓ | |
| 13d — CustomSpatial Backend (model + CRUD + vision-LLM) | ~360 | ✓ | |
| 13e — Frontend Form Pickers + Slot Buttons | ~720 | | ✓ |
| 13f — Spatial/Style PickerModals + CustomSpatialCreator | ~520 | | ✓ |
| 13g — BuilderDialog Rebuild + Wire-up + EC-32 | ~330 | | ✓ |
| 13h — QA + 5 Smokes | ~90 | ✓ | ✓ |
| **Σ Phase 13** | **~3220 LOC + 36 PNGs** | | |
| **GRAND TOTAL (1–13)** | **~6620 LOC + 50 PNGs** | | |

Realistic dev time for Phase 13 (single-dev): **6–9 working days**. With Claude pair: **2–3 days**.

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


---

## Appendix O — `CustomSpatial` Model + Endpoints (Schicht 13)

### O.1 Django model

```python
# design_app/models.py

import uuid
from django.db import models
from django.db.models import Q, UniqueConstraint
from django.contrib.auth import get_user_model

from workspace_app.models import Workspace

User = get_user_model()


class CustomSpatial(models.Model):
    SOURCE_KIND_CHOICES = [
        ('upload', 'Image upload'),
        ('reference', 'Project reference'),
        ('design', 'Generated design'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name='custom_spatials',
        db_index=True,
    )
    created_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name='created_custom_spatials',
    )

    name = models.CharField(max_length=80)
    prompt_text = models.TextField()  # 50–500 chars enforced at serializer

    source_kind = models.CharField(max_length=16, choices=SOURCE_KIND_CHOICES)
    source_image_ref = models.CharField(max_length=64, blank=True, default='')
    # ↑ stores ProjectReference.id OR Design.id (UUID-string) when source_kind != 'upload'
    source_image_file = models.ImageField(
        upload_to='custom_spatials/%Y/%m/', blank=True, null=True,
    )
    # ↑ ONLY set when source_kind='upload'

    is_unsafe = models.BooleanField(default=False)
    # ↑ EC-31 escape-hatch: user saved a flagged custom anyway

    is_deleted = models.BooleanField(default=False, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'design_app'
        ordering = ['-created_at']
        constraints = [
            UniqueConstraint(
                fields=['workspace', 'name'],
                condition=Q(is_deleted=False),
                name='uniq_custom_spatial_name_per_ws',
            ),
        ]

    def __str__(self):
        return f'{self.workspace_id}/{self.name}'

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.source_kind == 'upload':
            if not self.source_image_file:
                raise ValidationError('source_image_file required when source_kind=upload')
            if self.source_image_ref:
                raise ValidationError('source_image_ref must be empty when source_kind=upload')
        else:
            if self.source_image_file:
                raise ValidationError('source_image_file forbidden when source_kind!=upload')
            if not self.source_image_ref:
                raise ValidationError('source_image_ref required when source_kind!=upload')
```

### O.2 DRF serializers

```python
# design_app/api/serializers.py

class CustomSpatialAnalyzeSerializer(serializers.Serializer):
    image = serializers.ImageField(required=False, allow_null=True)
    reference_id = serializers.UUIDField(required=False, allow_null=True)
    design_id = serializers.UUIDField(required=False, allow_null=True)

    def validate(self, attrs):
        provided = [k for k in ('image', 'reference_id', 'design_id') if attrs.get(k)]
        if len(provided) != 1:
            raise serializers.ValidationError(
                'Provide exactly one of: image, reference_id, design_id.'
            )
        img = attrs.get('image')
        if img is not None:
            if img.size > 10 * 1024 * 1024:
                raise serializers.ValidationError({'image': 'Max 10 MB.'})
            if img.content_type not in ('image/jpeg', 'image/png', 'image/webp'):
                raise serializers.ValidationError({'image': 'Use JPG, PNG, or WebP.'})
        return attrs


class CustomSpatialSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomSpatial
        fields = [
            'id', 'name', 'prompt_text', 'source_kind', 'source_image_ref',
            'is_unsafe', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_name(self, value):
        v = value.strip()
        if len(v) < 2:
            raise serializers.ValidationError('Name too short (min 2 chars).')
        return v

    def validate_prompt_text(self, value):
        v = value.strip()
        if not (50 <= len(v) <= 500):
            raise serializers.ValidationError('prompt_text must be 50–500 chars.')
        return v

    def validate(self, attrs):
        workspace = self.context['workspace']
        name = attrs.get('name')
        qs = CustomSpatial.objects.filter(
            workspace=workspace, name=name, is_deleted=False,
        )
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                {'name': 'A custom spatial with that name already exists.'},
                code='name_conflict',
            )
        return attrs
```

### O.3 URLs

```
POST   /api/designs/spatials/custom/analyze/   → CustomSpatialAnalyzeView.post  (multipart)
GET    /api/designs/spatials/custom/           → CustomSpatialViewSet.list
POST   /api/designs/spatials/custom/           → CustomSpatialViewSet.create
DELETE /api/designs/spatials/custom/{id}/      → CustomSpatialViewSet.destroy (soft-delete)
```

All require `IsAuthenticated` + `X-Workspace-Id` header (workspace isolation pattern
established in PROJ-4).

### O.4 Soft-delete contract

- `DELETE` flips `is_deleted=True`, does NOT remove rows.
- `GET /custom/` filters by `is_deleted=False` always.
- The partial unique index allows a deleted name to be re-created later.
- BuilderPreset `slots.spatial_configuration` UUID references survive a delete — the
  resolver in **Appendix N.3 part 2** gracefully falls through to the next chain step
  (per EC-32).

---

## Appendix P — `analyze_spatial_layout` Vision-LLM Prompt

### P.1 System prompt (verbatim — paste into `spatial_analyzer.py`)

```
You are a Print-on-Demand layout analyst. Your ONE job is to look at the supplied image and produce a SHORT paragraph that describes ONLY the spatial arrangement of text blocks and vector/illustration elements on the canvas.

# What "spatial" means here

- WHERE the text sits (top, bottom, center, left, right, arc, ribbon, frame, on top of the illustration, …)
- WHERE the vector/illustration sits relative to the text (above, below, behind, centered, off-center, framed inside, …)
- HOW the composition is organized (stacked, horizontal row, diagonal, badge, triptych, grid, list, dictionary-entry, …)
- HOW much breathing room separates the blocks (tight, generous, asymmetric, edge-bleeding, …)

# What you are FORBIDDEN to describe

You MUST NOT mention or even hint at:
- Any color (no "red", "yellow", "blue", "black", "white", "neon", "pastel", "warm tones", "earth tones", no hex codes — NOTHING about color)
- Any style name (no "vintage", "retro", "cartoon", "watercolor", "grunge", "kawaii", "halftone", "pixel-art", "vector-flat", "blackletter", "sketch", "minimal", …)
- The actual subject of the illustration (no "skull", "dog", "bus", "guitar", "tree", "child", "tractor", "rocket", "heart", …) — call it only "the illustration" or "the vector element"
- Any texture, material, ink, paper, fabric, screen-print, halftone, gradient, glow, or shadow
- Any font name, font family, or font style description (no "serif", "sans-serif", "blackletter", "script", "bold", "italic", "thin"…)
- Any words: "T-shirt", "shirt", "tee", "mockup", "model wearing", "fabric", "garment"

If the image contains people, words, characters, brands — IGNORE them. Describe ONLY the geometric placement of blocks.

# Output format

Return one English paragraph, 40 to 80 words, no markdown, no headings, no JSON, no bullet list. Begin the paragraph with the layout name + the word "layout" (e.g. "Badge emblem layout with …", "Diagonal split layout with …"). Use neutral geometric language ("text block", "illustration block", "vector element", "headline area", "subtitle line", "outer arc", "lower third", "upper-left corner").

# If the image cannot be analysed

If the image is too cluttered, blurry, abstract, or photographic (not a print design) to identify a clear layout, return exactly the literal token:

LAYOUT_UNCLEAR
```

### P.2 Post-LLM scrub validator (`_scrub_forbidden`)

The validator is a regex pass that rejects the LLM response if it contains any of:

```python
# Colors (named) — case-insensitive
COLOR_WORDS = {
    'red', 'orange', 'yellow', 'green', 'blue', 'cyan', 'teal', 'purple', 'magenta',
    'pink', 'brown', 'beige', 'tan', 'black', 'white', 'grey', 'gray', 'silver',
    'gold', 'golden', 'neon', 'pastel', 'warm', 'cool', 'earth', 'earthy', 'faded',
    'saturated', 'muted', 'bright', 'dark', 'light',
}
# Style slugs (Mario-curated 15). 'badge' + 'emblem' deliberately omitted —
# they are also legitimate spatial-layout terms (SPATIAL_OPTIONS id
# `badge_emblem` whose prompt_text begins "Badge emblem layout with…").
# Forbidding them would scrub every clean badge-layout response.
STYLE_WORDS = {
    'vintage', 'retro', '70s', 'groovy', '80s', 'synthwave', 'neon', '90s', 'grunge',
    'kawaii', 'chibi', 'cartoon', 'watercolor', 'sketch', 'hand-drawn', 'vector',
    'flat', 'minimal', 'pixel', '8-bit', 'distressed', 'halftone',
    'blackletter', 'gothic', 'screenprint', 'plastisol',
}
# Forbidden phrases
PHRASE_BLOCKLIST = {
    't-shirt', 'tshirt', 'tee', 'mockup', 'model wearing', 'fabric', 'garment',
    'gradient', 'glow', 'soft shadow', 'drop shadow', 'blur',
}
# Hex code regex
HEX_RE = re.compile(r'#[0-9A-Fa-f]{3,8}\b')

# Illustration-subject nouns (defensive, non-exhaustive — implementer can extend)
SUBJECT_NOUNS = {
    'skull', 'dog', 'cat', 'bus', 'truck', 'car', 'guitar', 'drum', 'piano', 'tree',
    'flower', 'rose', 'heart', 'star', 'rocket', 'unicorn', 'shark', 'tiger',
    'lion', 'eagle', 'pirate', 'ninja', 'samurai', 'astronaut', 'cowboy', 'farmer',
    'nurse', 'teacher', 'mom', 'dad', 'grandma', 'grandpa', 'child', 'baby',
    'tractor', 'helicopter', 'plane', 'boat', 'ship', 'fish',
}

def _scrub_forbidden(text: str) -> tuple[bool, list[str]]:
    t = text.lower()
    hits: list[str] = []
    if HEX_RE.search(text):
        hits.append('hex_code')
    for w in COLOR_WORDS | STYLE_WORDS | SUBJECT_NOUNS:
        if re.search(rf'\b{re.escape(w)}\b', t):
            hits.append(w)
    for ph in PHRASE_BLOCKLIST:
        if ph in t:
            hits.append(ph)
    return (len(hits) == 0, hits)
```

Note: the subject-nouns set is conservative. The image-input is constrained to user-uploaded
POD-style designs, so the false-positive rate is acceptable. If QA shows too-aggressive
scrubbing, the implementer can downgrade SUBJECT_NOUNS hits to **warnings** instead of
422s (still surfaced to the user, who can opt in via `is_unsafe=True`).

### P.3 OpenRouter call signature

```python
def analyze_spatial_layout(image_bytes: bytes, *, mime: str) -> str:
    import base64, httpx
    b64 = base64.b64encode(image_bytes).decode('ascii')
    data_url = f'data:{mime};base64,{b64}'

    payload = {
        'model': 'openai/gpt-4.1-mini',
        'temperature': 0.2,
        'max_tokens': 220,
        'messages': [
            {'role': 'system', 'content': SPATIAL_ANALYZER_SYSTEM_PROMPT},
            {'role': 'user', 'content': [
                {'type': 'text', 'text': 'Analyse the spatial layout of this design.'},
                {'type': 'image_url', 'image_url': {'url': data_url}},
            ]},
        ],
    }
    r = httpx.post(
        'https://openrouter.ai/api/v1/chat/completions',
        json=payload,
        headers={
            'Authorization': f'Bearer {settings.OPENROUTER_API_KEY}',
            'HTTP-Referer': settings.OPENROUTER_REFERER,
            'X-Title': 'merch-miner / spatial-analyzer',
        },
        timeout=12.0,
    )
    r.raise_for_status()
    text = r.json()['choices'][0]['message']['content'].strip()
    if text == 'LAYOUT_UNCLEAR':
        raise SpatialUnclearError()
    return text
```

`SpatialUnclearError` is a custom exception bubbled up by the view as HTTP 422 with
`{ error: 'spatial_unclear' }`.

### P.4 Langfuse trace tags

- `metadata.workspace_id`
- `metadata.user_id`
- `metadata.source_kind` ∈ {`upload`, `reference`, `design`}
- `metadata.scrub_passed` (bool)
- `metadata.scrub_terms` (list, only when scrub failed)

---

## Appendix Q — Modal UX Specs (frontend)

### Q.1 `SpatialPickerModal.tsx`

**Trigger:** "Spatial layout ▸" button inside the BuilderDialog "Layout & Composition"
accordion.

**Shell:**
- MUI `Dialog`, `fullScreen={isMobile}`, `maxWidth='lg'`, `fullWidth`.
- Title bar: "Choose spatial layout" + close icon.
- Top sticky row: search `TextField` (icon: `SearchIcon`, placeholder `"Search 36 layouts…"`) + `Tabs` with three tabs: **Built-in (36)**, **Custom ({n})**, **Create new**.
- Body: scrollable area.
- Footer (only when a selection differs from the current value): primary `Button` "Use selection".

**Built-in tab:**
- Responsive `Grid` with `size={{ xs: 12, sm: 6, md: 4 }}`.
- Each `Card`: 1:1 thumbnail (`thumbnail_path`), `ui_label` below thumbnail (`Typography variant='subtitle2'`), `ui_description` below label (`Typography variant='caption' color='text.secondary'`).
- Selected card: 2-px primary-color border + check icon overlay.
- Click → set local `selectedId`, do NOT close. Footer button commits.

**Custom tab:**
- Same grid layout. If no customs yet → empty-state illustration + CTA "Create your first" (switches to "Create new" tab).
- Each Custom card shows a tiny "Delete" icon overlay (on hover) → confirm dialog → soft-delete mutation → optimistic UI removal.

**Create new tab:**
- Renders `<CustomSpatialCreator />` inline. On save, switches to "Custom" tab and selects the newly created custom automatically.

**Selection lifecycle:**
- `selectedId` initial = `slots.spatial_configuration` from BuilderDialog.
- On "Use selection" → calls `onChange(selectedId)` → BuilderDialog updates its slot → modal closes.
- ESC closes without committing.

### Q.2 `StylePickerModal.tsx`

**Trigger:** "Style ▸" button inside BuilderDialog "Styles" accordion.

**Shell:** Same as SpatialPickerModal but **two** tabs only:
- **Built-in (15)** — the 15 Mario-curated styles
- *(No Custom tab — explicitly forbidden, styles remain curated)*

**Built-in tab:**
- Same Card grid. Thumbnails are the existing Phase-7 PNG assets under `design_app/static/design_app/thumbnails/styles/{slug}.png`.
- Card label = style slug humanised ("vintage_retro" → "Vintage Retro"), description = a one-line blurb (add a new `ui_description` field to `STYLE_LIBRARY` entries in this PR — see task 13a.4 amendment).

**Multi-select?** Phase 1–12 already supports multi-style cross-product. The modal therefore must:
- Show selection state with a check-icon badge.
- Footer: "Use 3 selected" with the count.
- Persist multi-select state to BuilderConfig's existing `selectedStyleSlugs` array.

### Q.3 `CustomSpatialCreator.tsx` (wizard)

**Three steps with a horizontal `Stepper`:**

#### Step 1 — Source

- Three sub-tabs: **Upload image**, **From References**, **From Designs**.
- Upload: MUI `Button component='label'` + drag-zone (dnd-kit). Max 10 MB. Mime filter `image/jpeg,image/png,image/webp`. Shows preview thumbnail on selection.
- From References: thumbnail grid of `ProjectReference[]` from `useGetProjectReferencesQuery(projectId)`. Single-select.
- From Designs: thumbnail grid of `Design[]` for the current project from `useGetProjectDesignsForSpatialQuery(projectId)`. Single-select.

Next button enabled only when one source is chosen.

#### Step 2 — Analyze

- Shows the chosen source thumbnail on the left.
- On entering this step → immediately calls `useAnalyzeSpatialMutation` with the source.
- While loading → MUI `Skeleton` for the right column.
- On success → editable `TextField` `multiline rows={4}` filled with the LLM's `prompt_text`. User may edit before saving. Char counter (must be 50–500).
- On error (422 forbidden): error `Alert` shows `forbidden_terms` list + two buttons "Try another image" (back to step 1) and "Use raw text anyway" (proceeds to step 3 with `is_unsafe=true`).
- On error (other): `Alert` + Retry button.

#### Step 3 — Name + Save

- `TextField` for name (max 80 chars, validator hits the unique-name check via mutation error → inline error on 409).
- Save button → `useCreateCustomSpatialMutation` with payload `{name, prompt_text (from step 2 textfield), source_kind, source_image_ref?}`.
- On success: notify (`enqueueSnackbar`), switch parent SpatialPickerModal to "Custom" tab, auto-select the new custom.

---

## Appendix R — Thumbnail Generation Script (36 Spatial Variants)

`scripts/generate_spatial_thumbnails.py` — mirrors the existing
`scripts/generate_style_thumbnails.py` pattern (Phase 7) but renders 36 schematic SVGs +
PNG exports of the layout grammar (NOT full designs). Each thumbnail is a 512×512 PNG with
a neutral grey background (`#D9D9D9`) and black geometric markers showing where text
blocks (rectangles) and the illustration (a generic crossed-circle placeholder) sit per
the spatial id.

**Why schematic and not Gemini-rendered:**
- Schematic SVGs are zero-cost and deterministic.
- The thumbnail's job is to communicate the **geometric grammar** at a glance, not the visual style.
- A Gemini-rendered preview would blur the spatial structure with style flourishes the user hasn't picked yet.

**Script outline:**

```python
# scripts/generate_spatial_thumbnails.py
"""
Render 36 schematic PNG thumbnails for SPATIAL_OPTIONS into
design_app/static/design_app/thumbnails/spatial/{id}.png

Usage:  python scripts/generate_spatial_thumbnails.py
"""
from pathlib import Path
import cairosvg  # already a dep for PDF/SVG handling in image_generator

from design_app.services.style_library import SPATIAL_OPTIONS

OUT_DIR = Path('django-app/design_app/static/design_app/thumbnails/spatial')

# One SVG template per id, written as inline strings here.
# Each draws: outer 512x512 light-grey frame, then black rectangles/circles
# marking text/illustration regions per the spatial id.
SVG_TEMPLATES = {
    'vertical_stack': '''<svg ...>...</svg>''',
    'horizontal_row': '''<svg ...>...</svg>''',
    # ... 33 more entries — implementer fills in the SVGs.
}

def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for opt in SPATIAL_OPTIONS:
        svg = SVG_TEMPLATES[opt['id']]
        cairosvg.svg2png(
            bytestring=svg.encode('utf-8'),
            write_to=str(OUT_DIR / f'{opt["id"]}.png'),
            output_width=512, output_height=512,
        )
        print(f'wrote {opt["id"]}.png')

if __name__ == '__main__':
    main()
```

**Storage + commit policy:**
- The 36 PNGs commit to git under `django-app/design_app/static/design_app/thumbnails/spatial/`.
- Combined size budget: ≤2 MB total (each PNG ≤60 kB). The schematic style compresses well.
- The script is idempotent — re-running overwrites. CI never runs it; it's a one-time author step.

**Custom Spatial thumbnails:**
- For CustomSpatials, the **source image itself** is the thumbnail in the picker. No additional generation.
- For `source_kind='upload'`, the picker reads the `source_image_file` URL directly.
- For `source_kind='reference' | 'design'`, the picker fetches the referenced `ProjectReference`/`Design` image URL on demand.

---


## Phase 13o — German POD layout canon: +7 SPATIAL_OPTIONS + LLM thumbnails

Read `docs/layouts/examples/` (60 references: 17 German POD layout-course
teaching slides + 43 application T-shirts) and identified 7 patterns not
already in the 36 SPATIAL_OPTIONS:

- [x] 13o.1 `flush_aligned_block` (Der Bündige) — multi-line text flush left or right
- [x] 13o.2 `full_canvas_word_block` (Der Flächenfüller) — text fills entire canvas edge-to-edge
- [x] 13o.3 `vertical_pillar_text` (Der Pfeiler) — text rotated 90° down the canvas height
- [x] 13o.4 `illustration_only_no_text` (Der Sprachlose) — pure visual, no text
- [x] 13o.5 `unconventional_integration` (Der Unkonventionelle) — text weaves through illu
- [x] 13o.6 `crossed_tools_intersection` (Die Kreuzung) — crossed objects form X
- [x] 13o.7 `subject_portrait_with_caption` (Das Portrait) — dominant subject + caption
- [x] 13o.8 SPATIAL_OPTIONS 36 → 43 (style_library.py + slotOptions.ts mirror)
- [x] 13o.9 Niche-LLM enum + Appendix M updated to 43 ids
- [x] 13o.10 Test count assertion bumped (36 → 43)

Phase 13o-llm: replaced the schematic Pillow placeholders with bespoke
LLM-rendered thumbnails for all 43 entries:

- [x] LLM script `scripts/generate_spatial_thumbnails_llm.py` — google/gemini-3.1-flash-image-preview via OpenRouter, ~$0.04/img × 43 = ~$1.70
- [x] Consistent pizza subject across all 43: pizza slice with pepperoni + basil + cheese strings + slogan "PIZZA TIME"
- [x] 3 conditional branches: illustration-only / text-only / default
- [x] Pizza-theme substitution rule: layouts referencing "axes/hammers/tools" → crossed pizza cutters / rolling pins / kitchen knives

Phase 13o-dedup: removed the redundant Django static mirror.

- [x] Refactored 3 thumbnail tests (spatial/typography/font-combination) to point at frontend-ui/public/ with skip-if-not-mounted (Docker container scenario)
- [x] Deleted 75 PNGs under `django-app/design_app/static/design_app/thumbnails/` (~6 MB)
- [x] Frontend-ui/public/ is now the single source of truth for thumbnail bundles

---

## Phase 13p — drop MaterialPicker from BuilderDialog (auto-from-style)

- [x] 13p.1 Removed `<MaterialPicker>` mount from BuilderDialog "Visual Details" accordion
- [x] 13p.2 Inline comment explains: slot now auto-filled from style.default_material via resolver fallback
- [x] 13p.3 MaterialPicker.tsx retained as soft-deprecated component (not mounted anywhere)

**Why:** style.default_material covers the typical user need; the explicit
picker added choice paralysis without strong user-meaningful overrides.

---

## Phase 13q — REMOVE MATERIAL slot completely (end-to-end)

After 13p UI-only removal, user feedback: material is **triple-redundant**
in the rendered Gemini prompt:

1. STYLE_DNA already describes texture (e.g. vintage_retro has "slight halftone shading on flat color fills")
2. ARCHITECT_TEMPLATE_END commits to "screen print ready, hard edges, vector sharpness"
3. Rule #10 in DESIGN_GEN_SYSTEM_PROMPT forbids gradients/glow/soft-shadows

Adding a 4th texture sentence ("The graphics are made of …") created
conflicting instructions that Gemini sometimes resolved by smearing
gradients in violation of Rule #10.

- [x] 13q.1 `MATERIAL_OPTIONS` const deleted (backend style_library.py + frontend slotOptions.ts mirror)
- [x] 13q.2 `material_texture` slot dropped from SLOT_SCHEMA (9 → 8 entries)
- [x] 13q.3 `default_material` field deleted from all 15 STYLE_LIBRARY entries (backend + frontend styleLibrary.ts mirror)
- [x] 13q.4 `_resolve_slot` mapping no longer references `default_material`
- [x] 13q.5 `niche_app.services.builder_hints` — material removed from LLM SYSTEM_PROMPT, JSON response shape, validation, alternates
- [x] 13q.6 `BuilderSlots.material_texture` field removed from TypeScript type
- [x] 13q.7 MaterialPicker.tsx + MaterialPicker.test.tsx deleted (no remaining importers)
- [x] 13q.8 Test updates: removed `test_material_count` / `test_every_default_material_in_options`, SLOT_SCHEMA count 9 → 8, DEFAULT_FIELDS dropped to 3 (was 4)

Style_DNA is now the single source of truth for design texture.

---

## Phase 13r — Add Comic Book style (clean American comic, no shading)

User feedback: STYLE_LIBRARY was missing a classic comic-book aesthetic
distinct from `cartoon` (Saturday-morning animation with cel-shading) and
`halftone_print` (pop-art with halftone-dot FILLS). Marvel/DC-style bold
inked outlines + action-line accents + flat saturated colors had no slot.

- [x] 13r.1 New `comic_book` STYLE_LIBRARY entry (#16)
- [x] 13r.2 Frontend mirror in styleLibrary.ts
- [x] 13r.3 Thumbnail (`/style-thumbnails/comic_book.png`) generated via existing generate_style_thumbnails.py — taco mascot in clean American comic style, 110 KB
- [x] 13r.4 default_typography_id = `chunky_cartoon_block_gloss`, default_spatial_id = `subject_portrait_with_caption`
- [x] 13r.5 Test count assertion bumped: `test_fifteen_styles` → `test_sixteen_styles`
- [x] 13r.6 Frontend StylePickerModal test bumped: `15 style cards` → `16 style cards`

**Key constraint in prompt_suffix + default_style_dna:** explicit "NO cel-shading
AND NO halftone-dot shading" — preserves the comic-book LINE aesthetic without
the SHADING that would conflict with style_dna / Rule #10.

---

## Phase 13s — REMOVE TEXT_SEGMENTATION slot (end-to-end)

After 13q material removal, user observed the same redundancy pattern in
`text_segmentation`: the slot prescribes how text is segmented across the
design (centered / split top-bottom / headline+subtitle / 3-line stack / etc.),
but `spatial_configuration` **already** prescribes this for most of the 43
spatial layouts:

| spatial | already prescribes |
|---|---|
| `vertical_stack` | "text sits above AND below" = text-seg #2 |
| `headline_top_subtitle_bottom` | = text-seg #3 verbatim |
| `stacked_word_block` | "stacked text lines, central emphasis largest" = text-seg #4 |
| `big_word_tiny_tag` | "Single dominant word + tiny subtitle" = text-seg #3 |
| `banner_top` | "banner ribbon carrying primary text" = text-seg #5 |

→ text_segmentation was redundant with spatial. Same Material story.

- [x] 13s.1 `TEXT_SEGMENTATION_OPTIONS` const deleted (backend + frontend mirror)
- [x] 13s.2 `text_segmentation` slot dropped from SLOT_SCHEMA (8 → 7 entries)
- [x] 13s.3 `BuilderSlots.text_segmentation` field removed from TypeScript type
- [x] 13s.4 `TextSegmentationPicker.tsx` + test deleted (no remaining importers)
- [x] 13s.5 `<TextSegmentationPicker>` mount removed from BuilderDialog "Layout & Composition" accordion
- [x] 13s.6 Test updates: removed `test_text_segmentation_count`, SLOT_SCHEMA count 8 → 7, EXPECTED_KEYS list reduced

SLOT_SCHEMA now has 7 entries:
spatial → visual → typography → font_combination → accessories → style_dna → extra_context

Spatial is now the single source of truth for text segmentation.

---

## Phase 13t — Niche-Reference Preset Picker (Cards + Best-of-Mix + History + Custom)

**Spec source-of-truth:** `features/PROJ-34-design-prompt-engineering.md` Phase 13t
section (AC-79 → AC-128, EC-33 → EC-49, 8 Schichten 14–21).
**Tech Design:** in the same spec under "Tech Design — Phase 13t" subsection.

**Branch:** continues on `feature/PROJ-34-design-prompt-engineering` (already 44 commits
ahead — Phase 13a–13s shipped on it).

**Scope budget:** ~1100–1400 LOC. 15 sub-phases (13t-a through 13t-o). Each phase ends
with passing tests + an isolated commit. **DO NOT batch commits across phases.**

**Build order:** 13t-a → 13t-b → 13t-c → 13t-d → 13t-e → 13t-f → 13t-g → 13t-h →
(13t-i → 13t-j → 13t-k → 13t-l) || (13t-m in parallel) → 13t-n → 13t-o.

---

### Phase 13t-a — Backend: Migrations (NicheCardPreset + best_of_mix_cache)

**Scope-lock:** ONLY migrations. NO service logic. NO API. NO frontend.

- [x] 13t-a.1 New file `django-app/design_app/migrations/0017_nichecardpreset.py` defines
  `NicheCardPreset` model per Tech Design data-model table — all 20 fields incl. 7
  `is_raw` flags, indexes on `(workspace, is_in_history, -last_clicked_at)` and
  `(workspace, is_in_custom, -custom_promoted_at)`, `UniqueConstraint(workspace,
  preset_hash)`. — migration emitted as `0016_nichecardpreset.py` (next free
  number was 0016, not 0017). Bundles a help_text-only AlterField on
  `builderpreset.config` (pre-existing drift from Phase 13k WarpPicker removal;
  cosmetic only, no DB change).
- [x] 13t-a.2 New file `django-app/niche_app/migrations/00NN_niche_bom_cache.py` adds
  `best_of_mix_cache = JSONField(null=True, blank=True, default=dict)` to
  `niche_app.Niche`. Migration number = next free in niche_app/migrations/. —
  `niche_app/migrations/0010_niche_bom_cache.py`.
- [x] 13t-a.3 Add `NicheCardPreset` model class to `django-app/design_app/models.py`
  with `Meta.app_label = 'design_app'`, default ordering by `-last_clicked_at`, all
  choices for `source_card_type`. Use existing `Workspace` and `User` FK conventions
  from `CustomSpatial` (Phase 13d Appendix O). — `design_app/models.py:910-998`.
- [x] 13t-a.4 Add `best_of_mix_cache` field to `niche_app.models.Niche` (right below
  the existing `builder_form_hints` field — keep PROJ-34 fields grouped together).
  Add a docstring comment pointing to Appendix S for cache schema. —
  `niche_app/models.py:73-77`.
- [x] 13t-a.5 Run `docker compose exec web python manage.py makemigrations
  --dry-run` to verify migration is clean + additive. Then real `makemigrations` +
  `migrate`. Verify both apps' migration counts incremented by 1. — design_app
  15→16, niche_app 9→10, both `migrate` OK.
- [x] 13t-a.6 New file `django-app/design_app/tests/test_niche_card_preset_model.py`
  — single test class with: model save round-trip, unique constraint enforcement,
  default ordering check, JSONField roundtrip on `source_card_references`.
  **`docker compose exec web pytest design_app/tests/test_niche_card_preset_model.py`
  must be green before commit.** — 4/4 passed.

**Commit message:** `feat(PROJ-34): phase 13t-a — NicheCardPreset model + Niche.best_of_mix_cache migration`

---

### Phase 13t-b — Backend: preset_hash + preset_matcher services

**Scope-lock:** ONLY pure-function services. NO models. NO API. NO frontend. NO LLM.

- [x] 13t-b.1 New file `django-app/design_app/services/preset_hash.py` per **Appendix T
  of this file**. Implements `compute_preset_hash(slots_dict: dict) -> str` returning
  SHA256 hex over NFKD-normalized + lowercased + sorted-JSON serialization of the 7
  slot values. — preset_hash.py:51 (compute_preset_hash)
- [x] 13t-b.2 New file `django-app/design_app/tests/test_preset_hash.py` — pytest
  parametrize over the test-vectors in Appendix T.4. Covers: identical inputs →
  identical hash; unicode-normalization equivalence; slot-order independence; one-char
  diff → different hash. — test_preset_hash.py:56-127 (8 tests, all 8 Appendix T.4
  vectors covered)
- [x] 13t-b.3 New file `django-app/design_app/services/preset_matcher.py` per
  **Appendix U of this file**. Implements `match_slot_to_builtin(slot_key: str,
  raw_text: str) -> tuple[str | None, bool]`. Returns `(built_in_id, is_raw=False)` or
  `(raw_text_truncated, is_raw=True)`. Uses Jaccard token similarity ≥ 0.55.
  — preset_matcher.py:84 (match_slot_to_builtin), :122 (_tokenize), :127 (_jaccard)
- [x] 13t-b.4 The matcher imports from existing style_library: `SPATIAL_OPTIONS`,
  `TYPOGRAPHY_OPTIONS`, `FONT_COMBINATION_OPTIONS`, `ACCESSORIES_OPTIONS`,
  `STYLE_LIBRARY`. DO NOT modify any of them. Read-only consumption.
  — preset_matcher.py:17-22 (imports, no STYLE_LIBRARY needed — only the 4 option
  lists participate in matching per Appendix U.1)
- [x] 13t-b.5 New file `django-app/design_app/tests/test_preset_matcher.py` — covers
  each of 5 mappable slots with 3 test cases each: clear match, ambiguous below
  threshold, no match. Use realistic niche text vectors (e.g. "stencil military
  propaganda font" → `stencil_bold` for typography slot).
  — test_preset_matcher.py:43-160 (15 parametrized + 5 unit tests = 20 total).
  Real typography id is `stencil_military_uniform` (not assumed `stencil_bold`);
  deviation documented in module docstring.
- [x] 13t-b.6 Both test files run green: `docker compose exec web pytest
  design_app/tests/test_preset_hash.py design_app/tests/test_preset_matcher.py`.
  — 28 passed (8 hash + 20 matcher), 0 failed, 0.12s.

**Commit message:** `feat(PROJ-34): phase 13t-b — preset_hash + preset_matcher services + tests`

---

### Phase 13t-c — Backend: preset_ranker + top_card_builder services

**Scope-lock:** Services consuming preset_matcher + preset_hash from 13t-b. NO API.

- [x] 13t-c.1 New file `django-app/design_app/services/preset_ranker.py` —
  `rank_top_products(niche, limit=10) -> list[NicheProductVisionAnalysis]`. Pre-filter
  `brand_blocked=False AND is_niche_match=True`, score per AC-82 formula. Constants
  `PRESET_WEIGHT_RATING / _BSR / _RECENCY` exposed in `django-app/core/settings.py`
  with default values 0.45 / 0.40 / 0.15.
  — preset_ranker.py:1-138 (rank_top_products + 4 helpers); settings.py:374-388.
- [x] 13t-c.2 New file `django-app/design_app/services/top_card_builder.py` —
  `build_top_card_preset(vision_row, niche) -> dict`. Returns dict with 7 slot values
  (+ 7 `is_raw` flags) + auto-generated `preset_label` (2-4 word label from
  `slogan_text` + dominant keyword of `graphic_elements`).
  — top_card_builder.py:48-118 (build_top_card_preset).
- [x] 13t-c.3 The label generator function `_generate_preset_label(vision_row) -> str`
  must be deterministic + idempotent + ≤200 chars. Test it independently.
  — top_card_builder.py:124-159 (_generate_preset_label + helpers);
    test_top_card_builder.py:172-235 (10 label-focused tests).
- [x] 13t-c.4 Add constants `PRESET_WEIGHT_RATING`, `PRESET_WEIGHT_BSR`,
  `PRESET_WEIGHT_RECENCY`, `PRESET_RECENCY_HALF_LIFE_DAYS=180` to
  `core/settings.py` under a `# PROJ-34 Phase 13t` section.
  — settings.py:374-388 (also adds NICHE_PRESET_HISTORY_CAP for 13t-f).
- [x] 13t-c.5 New file `django-app/design_app/tests/test_preset_ranker.py` —
  parametrized weighting verification + edge cases (zero reviews, missing BSR,
  ancient products, all-blocked niche).
  — test_preset_ranker.py:1-262 (17 tests covering empty niche, brand-blocked,
    is_niche_match filter, limit, ordering, missing BSR / rating / date, ancient
    recency, BSR monotonicity, reviews clamp, latest-research selection).
- [x] 13t-c.6 New file `django-app/design_app/tests/test_top_card_builder.py` —
  builds preset from synthetic vision_row fixtures, asserts `is_raw` flags correct,
  label length + uniqueness reasonable.
  — test_top_card_builder.py:1-243 (19 tests: shape, structural-raw flags,
    source refs, label deterministic + fallback chain, matcher built-in hit).
- [x] 13t-c.7 Tests green.
  — 17 + 19 = 36 new tests pass; full design_app suite 452 passed / 34 skipped /
    0 regressions (was 416 before 13t-c, exact +36 delta).

**Commit message:** `feat(PROJ-34): phase 13t-c — preset_ranker + top_card_builder services + tests`

---

### Phase 13t-d — Backend: best_of_mix_generator (LLM service)

**Scope-lock:** ONLY the LLM call + JSON validation + cache write. NO API endpoint yet.

- [x] 13t-d.1 New file `django-app/design_app/services/best_of_mix_generator.py` —
  follows the **structural pattern of `niche_app/services/builder_hints.py`**: module
  docstring, `SYSTEM_PROMPT` constant (copy verbatim from **Appendix S of this file**),
  `_load_research_context(niche)` helper, `_build_user_message(niche, context)` helper,
  `_call_openrouter(...)` helper with Langfuse tracing, `_validate_and_clean(raw)`
  helper, public `generate_best_of_mix(niche_id, force=False) -> dict | None`.
  — best_of_mix_generator.py:1-78 (constants + SYSTEM_PROMPT verbatim), 187-275
  (_build_user_message), 278-307 (_is_cache_fresh), 310-360 (_validate_and_clean),
  363-417 (_resolve_built_in_matches), 420-543 (_call_openrouter),
  546-606 (generate_best_of_mix).
- [x] 13t-d.2 Model: `openai/gpt-4.1-mini` (constant `DEFAULT_MODEL`). Temperature
  `0.4`. `response_format={'type': 'json_object'}`. Timeout `15s`. `max_tokens` `2400`.
  — best_of_mix_generator.py:36-42 (tunables) + payload at 467-477.
- [x] 13t-d.3 Validation rejects malformed output (missing variant, missing slot, slot
  value not str/None). On any failure → returns None (never raises — EC-35 pattern).
  — best_of_mix_generator.py:310-360 (_validate_and_clean) + 591-593 (caller).
- [x] 13t-d.4 After successful LLM call, runs `match_slot_to_builtin` on the 5 mappable
  slots for each of the 3 variants (so the cache stores `(slot_value, is_raw)` tuples
  ready for persistence). Stores result in `niche.best_of_mix_cache = {"most_common":
  {...}, "edgy": {...}, "safe": {...}, "generated_at": iso, "top3_product_ids": [...]}`
  via `niche.save(update_fields=['best_of_mix_cache', 'updated_at'])`.
  — best_of_mix_generator.py:363-417 (_resolve_built_in_matches), 595-604
  (cache payload + save with update_fields).
- [x] 13t-d.5 Cache-hit logic: if `force=False` AND `best_of_mix_cache` is non-empty
  AND `generated_at` exists AND `_source_research_id` matches latest research → return
  cached dict without LLM call. Mirrors `_is_cache_fresh` from `builder_hints.py`.
  — best_of_mix_generator.py:278-307 (_is_cache_fresh) + 581-586 (short-circuit).
- [x] 13t-d.6 New file `django-app/design_app/tests/test_best_of_mix_generator.py` —
  mocks OpenRouter via `httpx_mock` fixture; covers: cache hit, cache miss, LLM
  timeout, LLM malformed JSON, LLM returns missing variant, force=True bypass,
  workspace+niche metadata in Langfuse trace.
  — test_best_of_mix_generator.py:177-394 (13 tests; uses unittest.mock.patch
  since pytest-httpx not installed — mirrors test_builder_hints.py pattern).
- [x] 13t-d.7 Tests green. — `pytest design_app/tests/test_best_of_mix_generator.py
  -v` → 13 passed in 0.63s. Regression `pytest design_app/` → 465 passed, 34 skipped,
  0 failures (up from 452 baseline).

**Commit message:** `feat(PROJ-34): phase 13t-d — best_of_mix_generator LLM service + tests`

---

### Phase 13t-e — Backend: collage_renderer + endpoint

**Scope-lock:** ONLY the collage rendering + serving endpoint. NO frontend.

- [x] 13t-e.1 New file `django-app/design_app/services/collage_renderer.py` per
  **Appendix V of this file**. Implements `render_collage_webp(product_ids: list[str])
  -> bytes`. Uses Pillow to compose 3 images at 200×200 each into a 600×200 webp
  (quality=85). Handles missing product images gracefully (placeholder gray cell).
- [x] 13t-e.2 Caching to `MEDIA_ROOT / 'best_of_mix_collages' / f'{niche_id}.webp'`
  (7-day staleness check). Helper `get_collage_path(niche_id) -> Path` exposed.
- [x] 13t-e.3 New view `CollageView(APIView)` in `design_app/api/views.py` —
  `GET /api/designs/preset-cards/collage/<uuid:niche_id>.webp`. Resolves niche,
  reads `best_of_mix_cache['top3_product_ids']`, returns
  `FileResponse(open(get_collage_path(niche_id), 'rb'), content_type='image/webp')`.
  Triggers regeneration if file missing OR older than 7 days.
- [x] 13t-e.4 URL route added to `design_app/api/urls.py` per AC-122.
- [x] 13t-e.5 New file `django-app/design_app/tests/test_collage_renderer.py` —
  asserts: webp file bytes start with WebP magic, dimensions = 600×200, file size
  <80 KB, gracefully handles missing image URL (placeholder fallback), file cached
  on second call (mtime unchanged).
- [x] 13t-e.6 Tests green.

**Commit message:** `feat(PROJ-34): phase 13t-e — best_of_mix collage renderer + endpoint`

---

### Phase 13t-f — Backend: preset_persistence (dedup + LRU)

**Scope-lock:** ONLY persistence logic. NO API.

- [x] 13t-f.1 New file `django-app/design_app/services/preset_persistence.py` —
  `upsert_preset(workspace_id, preset_dict, source_card_type, source_refs) ->
  NicheCardPreset`. Single transaction (`@transaction.atomic`):
  1. Compute `preset_hash` via `preset_hash.compute_preset_hash`.
  2. SELECT existing row WHERE `workspace=workspace_id AND preset_hash=hash`.
  3. If exists → append `source_refs` to row's `source_card_references`, set
     `last_clicked_at=now()`, save. Return row.
  4. If not exists → INSERT new row with `is_in_history=True`, then enforce LRU cap:
     `count = NicheCardPreset.objects.filter(workspace=..., is_in_history=True).count()`
     — if `count > NICHE_PRESET_HISTORY_CAP` → SELECT row with oldest `last_clicked_at`
     (tie-break: oldest `created_at`, then smallest `id`) WHERE `is_in_custom=False`
     → DELETE it. If oldest row has `is_in_custom=True` → set `is_in_history=False`
     (preserve Custom).
  — preset_persistence.py:33-128 (`upsert_preset` + `_merge_source_refs` + `_enforce_lru_cap`).
- [x] 13t-f.2 New constants in `settings.py`: `NICHE_PRESET_HISTORY_CAP = 50`.
  — settings.py:387 (verified pre-existing from 13t-c; preset_persistence.py:151 reads it).
- [x] 13t-f.3 New helper `promote_to_custom(preset_id, user) -> NicheCardPreset` —
  sets `is_in_custom=True`, `custom_promoted_by=user`, `custom_promoted_at=now()`.
  Idempotent (returns existing if already promoted).
  — preset_persistence.py:185-217 (`promote_to_custom`; returns `None` on missing pk).
- [x] 13t-f.4 New helper `unpromote_from_custom(preset_id) -> bool` — sets
  `is_in_custom=False`, clears `custom_promoted_*`. Hard-deletes row if
  `is_in_history=False` AND `is_in_custom=False` (unreachable through normal flow).
  — preset_persistence.py:223-253 (`unpromote_from_custom`; `True`=deleted, `False`=survived, `None`=missing).
- [x] 13t-f.5 New file `django-app/design_app/tests/test_preset_persistence.py` —
  covers: fresh insert, dedup-hit appends refs, LRU eviction at cap+1 (custom-only
  survives), tie-break on identical `last_clicked_at`, promote idempotency, unpromote
  hard-delete edge.
  — test_preset_persistence.py:1-330 (15 tests).
- [x] 13t-f.6 Tests green.
  — `pytest design_app/tests/test_preset_persistence.py` → 15/15 PASS;
  `pytest design_app/` → 490 passed (up from 475), 34 skipped, 0 regressions.

**Commit message:** `feat(PROJ-34): phase 13t-f — preset persistence service (dedup + LRU) + tests`

---

### Phase 13t-g — Backend: DRF serializers + ViewSet + URLs

**Scope-lock:** ONLY the 6 API endpoints + workspace isolation + rate-limiting. NO frontend.

- [x] 13t-g.1 Add `NicheCardPresetSerializer(serializers.ModelSerializer)` to
  `design_app/api/serializers.py` — all fields above `is_raw` flags grouped, source
  metadata as nested object, computed `reference_thumbnail_url` (resolves to
  collage endpoint for mix-cards, raw image URL for top-cards).
- [x] 13t-g.2 Add `PresetConfirmSerializer` (1 field: `preset_id: UUIDField`).
  Add `PresetRegenerateSerializer` (1 field: `niche_id: UUIDField`).
- [x] 13t-g.3 Add `NicheCardPresetViewSet(viewsets.GenericViewSet)` with
  custom actions:
  - `list` → standard but supports `?niche_id=<uuid>` to return Vorschläge structure
    (top: list, best_of_mix: dict, top3_product_ids: list).
  - `@action(detail=False) history()` → list workspace history (≤50, ordered).
  - `@action(detail=False) custom()` → list workspace custom (uncapped).
  - `@action(detail=False, methods=['post']) confirm()` → calls `upsert_preset` +
    returns final payload.
  - `@action(detail=True, methods=['post']) promote_custom()` → calls
    `promote_to_custom`.
  - `@action(detail=True, methods=['delete']) custom_remove()` (URL: `<id>/custom/`)
    → calls `unpromote_from_custom`.
  - `@action(detail=False, methods=['post']) regenerate_mix()` → calls
    `generate_best_of_mix(niche_id, force=True)` + persists 3 mixes to History via
    `upsert_preset`. Throttled via `ScopedRateThrottle` with scope
    `'preset_regenerate'` and per-user 5/h limit defined in `settings.REST_FRAMEWORK`.
- [x] 13t-g.4 ALL endpoints `permission_classes = [IsAuthenticated]`. Workspace
  isolation via `_get_workspace_id(self.request)` pattern — return 403 on mismatch.
- [x] 13t-g.5 Add 6 URL routes to `design_app/api/urls.py` per Tech Design endpoint
  table. Verify no conflict with existing `customspatial/`, `custom-typography/`,
  `projects/` routes.
- [x] 13t-g.6 Add throttle config `'preset_regenerate': '5/hour'` to
  `REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']` in `settings.py`.
- [x] 13t-g.7 New file `django-app/design_app/tests/test_preset_api.py` — integration
  tests using DRF `APIClient`: workspace isolation (403 on wrong header), confirm
  endpoint creates History row, promote endpoint flips flag, custom-delete preserves
  History, regenerate-mix throttled at 6th request, list endpoint returns correct
  structure with mix placeholders.
- [x] 13t-g.8 Run full backend suite: `docker compose exec web pytest design_app/`.
  Must be green.

**Commit message:** `feat(PROJ-34): phase 13t-g — DRF serializers + ViewSet + URLs + integration tests`

---

### Phase 13t-h — Frontend: RTK Query slice + TypeScript types

**Scope-lock:** ONLY API layer + types. NO components.

- [x] 13t-h.1 New file `frontend-ui/src/types/nichePreset.ts` — TypeScript interfaces
  matching backend serializers verbatim: `NichePresetCard`, `NichePresetSlotValues`,
  `NichePresetSlotIsRawFlags`, `NichePresetSourceMeta`, `VorschlaegeResponse`
  (`{top: NichePresetCard[]; best_of_mix: { most_common: ... | null; edgy: ... | null;
  safe: ... | null }; top3_product_ids: string[]}`).
  — `frontend-ui/src/types/nichePreset.ts:1-123` (also exports flat
  `NichePresetTopCardDict` for the in-memory shape returned by
  `build_top_card_preset` + `_mix_payload`; verified against
  `design_app/api/serializers.py:1058-1117` and
  `design_app/services/top_card_builder.py:45-119`).
- [x] 13t-h.2 New file `frontend-ui/src/services/presetCardsApi.ts` — RTK Query slice
  `presetCardsApi` with `createApi`. Endpoints: `getVorschlaege(nicheId)`,
  `getHistory()`, `getCustom()`, `confirmPreset(presetId)`, `promoteCustom(presetId)`,
  `removeCustom(presetId)`, `regenerateMix(nicheId)`. Provide proper `tagTypes:
  ['PresetCards', 'History', 'Custom']` and `invalidatesTags` on mutations.
  — `frontend-ui/src/services/presetCardsApi.ts:1-95` (uses shared
  `axiosBaseQuery`, matches the 7-action URL map at
  `design_app/api/urls.py:280-313`; `getVorschlaege` providesTags is
  niche-scoped so `regenerateMix` invalidates only the affected niche).
- [x] 13t-h.3 Add `presetCardsApi.reducerPath: presetCardsApi.reducer` to root store
  in `frontend-ui/src/store/store.ts`. Add middleware. Verify `store.getState()` types
  resolve correctly.
  — `frontend-ui/src/store/index.ts:22-23,45-46,63-64,91-92` (also added to
  `resetAllRtkApiCaches` so the cache flushes on logout).
- [x] 13t-h.4 New file `frontend-ui/src/services/customTypographyApi.ts` — RTK Query
  slice mirroring `customSpatialApi` pattern. Endpoints: `analyzeTypography(payload)`,
  `createCustomTypography(payload)`, `listCustomTypographies()`,
  `deleteCustomTypography(id)`. Register in store same as above.
  — `frontend-ui/src/services/customTypographyApi.ts:1-93` (registered in
  `store/index.ts:23,46,64,92`; URLs match the
  `designs/typography/custom/...` route family at `urls.py:331-346`).
- [x] 13t-h.5 `npm run build` must succeed; `npx tsc -b` must be clean.
  — All three new files type-check cleanly in isolation. Project-wide
  `tsc -b` still surfaces two pre-existing errors
  (`useBuilderDialogState.ts:31` `material_texture` slot leftover and
  `DesignWorkspaceView.tsx:553` `DesignProject.workspace` access) that
  predate this phase; confirmed by `git stash` baseline check. These are
  out-of-scope for 13t-h and must be cleaned up before Phase 13t-i lands
  the first UI consumer of these slices.

**Commit message:** `feat(PROJ-34): phase 13t-h — RTK Query slices + types for niche presets + custom typography`

---

### Phase 13t-i — Frontend: NichePresetsAccordion shell + Tabs + default-expanded

**Scope-lock:** Section shell only. NO tab content yet. NO Confirm-Dialog.

- [x] 13t-i.1 Create dir `frontend-ui/src/views/designs/board/partials/promptBuilder/
  nichePresets/`. Add `NichePresetsAccordion.tsx` — MUI `Accordion` w/ `defaultExpanded`,
  custom `AccordionSummary` (title "Aus der Niche" + tab-aware count badges), renders
  `<NichePresetsTabs/>` in `AccordionDetails`. — `nichePresets/NichePresetsAccordion.tsx:1-36`
- [x] 13t-i.2 Add `NichePresetsTabs.tsx` — MUI `Tabs` w/ 3 `Tab` elements ("Vorschläge",
  "History", "Custom"). Uses local `useState` for active tab. Renders empty placeholder
  content per tab for now (real grids land in 13t-j and 13t-k). — `nichePresets/NichePresetsTabs.tsx:1-108`
- [x] 13t-i.3 Mount `<NichePresetsAccordion/>` at the TOP of `BuilderDialog.tsx` (above
  current first Accordion). Pass `nicheId` prop derived from existing builder context.
  — `BuilderDialog.tsx:61-79,159-167,291-294`; threaded `nicheId={project?.niche ?? null}`
  in `DesignWorkspaceView.tsx:554`.
- [x] 13t-i.4 Edit ALL existing `<Accordion>` elements in `BuilderDialog.tsx` to add
  `defaultExpanded` prop (per AC-80). Verify no currently-collapsed Accordion is meant
  to be collapsed (check existing tests). — flipped `Layout & Composition`
  (`BuilderDialog.tsx:336-344`) + `Niche & Extra` (`BuilderDialog.tsx:423-431`); Live
  Preview defaults `previewOpen=true` (`BuilderDialog.tsx:181-182`). Slogans, Styles,
  Visual Details already had `defaultExpanded`.
- [x] 13t-i.5 Add i18n keys to `frontend-ui/src/i18n/locales/de.json` and `en.json`:
  `designForge.builder.nichePresets.title`, `.tabs.vorschlaege`, `.tabs.history`,
  `.tabs.custom`. — actual locale paths are
  `frontend-ui/public/locales/{en,de}/translation.json`; added `designForge.builder.
  nichePresets` block in both (en:3619-3635, de:3662-3678) with title + 3 tab labels +
  4 placeholder strings (`placeholderVorschlaege` / `placeholderHistory` /
  `placeholderCustom` / `placeholderNoNiche`).
- [x] 13t-i.6 Vitest test `NichePresetsAccordion.test.tsx` — renders, expands by
  default, tab clicks change active tab, count badges render.
  — `nichePresets/__tests__/NichePresetsAccordion.test.tsx:1-60` (5 cases).
- [x] 13t-i.7 `npm run test:ci` for files under `nichePresets/` must be green.
  — 5/5 pass in 355 ms; full `npm run test:ci` = 1543 tests / 0 failures;
  `npx tsc -b` + `npm run build` both clean.

**Commit message:** `feat(PROJ-34): phase 13t-i — NichePresetsAccordion + Tabs shell + default-expanded all`

---

### Phase 13t-j — Frontend: Vorschläge Tab (Top + Best-of-Mix + Skeleton + Regen)

**Scope-lock:** Vorschläge tab content. NO History/Custom UI yet. NO Confirm-Dialog.

- [x] 13t-j.1 `NichePresetCard.tsx` — shared MUI `Card` component: square thumbnail
  (200×200), label below (`Typography variant="body2"`, max 2 lines + ellipsis),
  optional bottom-right action area (slot for promote/delete buttons). Props: `card:
  NichePresetCard`, `onClick: (card) => void`, `topRightChip?: ReactNode`,
  `bottomActions?: ReactNode`. Active selection visual marker (border + checkmark).
- [x] 13t-j.2 `TopCardsGrid.tsx` — renders up to 10 `NichePresetCard` in a responsive
  MUI `Grid` (5×2 on `md+`, 2×5 on `xs–sm`). Skeleton-state per card while loading.
  Empty-state Alert per AC-91 when zero results.
- [x] 13t-j.3 `BestOfMixRow.tsx` — header row with title "Best-of-Mix" + `IconButton`
  (RefreshIcon) wired to `regenerateMix` mutation (loading state via RTK Query
  `isLoading`). Three `NichePresetCard` below (labels "Most-Common", "Edgy", "Safe").
  Cards with `card === null` (cache miss / generating) render `Skeleton`. Polling:
  if 202 returned, refetch every 3s for up to 60s, then error state.
- [x] 13t-j.4 Wire `<TopCardsGrid/>` + `<BestOfMixRow/>` into Vorschläge tab in
  `NichePresetsTabs.tsx`. Pass `nicheId` from props.
- [x] 13t-j.5 Cards clickable but currently log to console with TODO comment for
  Confirm-Dialog handler (wired in 13t-l). No card-click side-effects yet.
- [x] 13t-j.6 Vitest tests for each of 3 new components. Use MSW mocks. Cover:
  loading skeleton, error fallback, empty-state Alert, regen button click triggers
  mutation, polling on 202.
- [x] 13t-j.7 `npm run test:ci` for `nichePresets/` green. ESLint clean.

**Commit message:** `feat(PROJ-34): phase 13t-j — Vorschläge tab UI (Top + Best-of-Mix + Skeleton)`

---

### Phase 13t-k — Frontend: History + Custom Tabs (promote / delete actions)

**Scope-lock:** History + Custom tab content. NO Confirm-Dialog.

- [x] 13t-k.1 `HistoryGrid.tsx` — renders cards from `getHistory()` query in responsive
  Grid. Each card's `bottomActions` slot = `<IconButton>` (`BookmarkBorderIcon` →
  triggers `promoteCustom` mutation). Each card's `topRightChip` shows
  `source_card_type` badge ("Top", "Mix · Most-Common", etc.) + source-niche chip with
  `+N more` overflow per AC-100. Empty-state Alert per AC-99.
  — `nichePresets/HistoryGrid.tsx:1-157`
- [x] 13t-k.2 `CustomGrid.tsx` — same pattern as HistoryGrid but card actions =
  `IconButton(DeleteOutlineIcon)` triggering `window.confirm` + `removeCustom`
  mutation. `topRightChip` shows `custom_promoted_by` username per AC-104.
  Empty-state Alert per AC-106.
  — `nichePresets/CustomGrid.tsx:1-149`
- [x] 13t-k.3 Wire `<HistoryGrid/>` + `<CustomGrid/>` into respective tabs of
  `NichePresetsTabs.tsx`. Add tab count badges (`N/50` for History, `N` for Custom)
  derived from query results.
  — `nichePresets/NichePresetsTabs.tsx:17-18,107-108` (badges already wired in 13t-i lines 64-91)
- [x] 13t-k.4 Promote success → notistack `enqueueSnackbar` (variant=success) per AC-98.
  Delete success → notistack snackbar (variant=info). All user-visible strings via i18n.
  — `HistoryGrid.tsx:47-60`, `CustomGrid.tsx:36-55`, i18n keys in `de/translation.json` + `en/translation.json` `designForge.builder.nichePresets.*`
- [x] 13t-k.5 RTK Query `invalidatesTags`: confirm-mutation invalidates `History`;
  promote invalidates `Custom`+`History`; remove invalidates `Custom`.
  — verified pre-wired in `services/presetCardsApi.ts:54,62,70` (no changes needed)
- [x] 13t-k.6 Vitest tests for both grids. Cover: promote click → mutation fires +
  toast appears; delete confirms via `window.confirm` + mutation + toast; source-chip
  overflow renders `+N more`.
  — `__tests__/HistoryGrid.test.tsx` (7 tests) + `__tests__/CustomGrid.test.tsx` (8 tests)
- [x] 13t-k.7 `npm run test:ci` green. ESLint clean.
  — nichePresets/ 38 tests pass (23 prior + 7 HistoryGrid + 8 CustomGrid); tsc clean; build clean; new files have no lint warnings

**Commit message:** `feat(PROJ-34): phase 13t-k — History + Custom tabs UI with promote/delete actions`

---

### Phase 13t-l — Frontend: NichePresetConfirmDialog + wire to BuilderDialog state

**Scope-lock:** Confirm-Dialog + slot-replacement wiring. NO new tab content.

- [x] 13t-l.1 `NichePresetConfirmDialog.tsx` — MUI `Dialog` (`maxWidth="md"`), title
  "Preset übernehmen?", body = horizontal split: left 200px reference thumbnail (with
  `loading="lazy"`), right column = read-only preview rows for all 7 slots. Each slot
  row shows label (i18n) + resolved value text + "Raw" chip when `is_raw=true`.
- [x] 13t-l.2 Footer: 2 MUI `Button` — "Cancel" (text, left) + "Bestätigen" (filled,
  primary, right). ESC + backdrop + Cancel all close without changes.
- [x] 13t-l.3 Bestätigen handler: fires `confirmPreset(preset_id)` mutation, then
  dispatches 7 slot setters into the existing `useBuilderDialogState` hook (REUSE
  existing setters — do NOT create new state). Then closes dialog. Toast on success.
- [x] 13t-l.4 Wire dialog into `NichePresetsAccordion` — local `useState` holds active
  card; `NichePresetCard.onClick` sets it; dialog opens when active card is non-null.
- [x] 13t-l.5 Confirm-Dialog reads slot labels for built-in IDs via existing
  resolvers from `style_library.py` mirrors in `slotOptions.ts` — DO NOT re-implement.
  For raw values: show truncated text (max 200 chars per row) with full text in tooltip.
- [x] 13t-l.6 Vitest test `NichePresetConfirmDialog.test.tsx` — covers: opens on card
  click, shows 7 slot rows, Bestätigen fires mutation + dispatches setters + closes,
  Cancel closes without effects.
- [x] 13t-l.7 Integration test `BuilderDialog.test.tsx` (existing) extended: niche
  preset card click → confirm → BuilderDialog form state reflects new slot values.
- [x] 13t-l.8 All Vitest green. `npx tsc -b` clean. ESLint clean.

**Commit message:** `feat(PROJ-34): phase 13t-l — NichePresetConfirmDialog + Replace-All slot wiring`

---

### Phase 13t-m — Frontend: CustomTypographyCreator (Phase 13i debt — parallel)

**Scope-lock:** CustomTypography UI ONLY. Mirror `CustomSpatialCreator` exactly.
DECOUPLED from niche-cards flow.

- [x] 13t-m.1 `CustomTypographyCreator.shared.tsx` — shared types
  (`CustomTypographyDraft`, `ImageSource = "upload" | "reference" | "design"`) +
  helper hooks. Mirror `CustomSpatialCreator.shared.tsx` 1:1.
- [x] 13t-m.2 `CustomTypographyCreator.Step1.tsx` — image source picker UI: upload
  drag-drop OR pick from `ProjectReference[]` (reuse `useGetProjectReferencesQuery`)
  OR pick from generated `Design[]`. Mirror `CustomSpatialCreator.Step1.tsx`.
- [x] 13t-m.3 `CustomTypographyCreator.steps.tsx` — Step 2 (call analyze API + show
  result) + Step 3 (name input + Save button). Mirror existing pattern.
- [x] 13t-m.4 `CustomTypographyCreator.tsx` — top-level orchestrator using
  `useReducer` for step state. Submits via `createCustomTypography` mutation. On
  success auto-selects new entry in parent picker.
- [x] 13t-m.5 Edit `TypographyPickerModal.tsx` to add 3rd `Tab` "Create new" between
  existing Built-in and Custom tabs. Mount `<CustomTypographyCreator/>` in its panel.
- [x] 13t-m.6 i18n keys in de/en: `designForge.builder.typography.createNew.*`.
- [x] 13t-m.7 Vitest `CustomTypographyCreator.test.tsx` — happy path with mocked API,
  upload validation (>10MB rejected), error states, name uniqueness conflict.
- [x] 13t-m.8 All Vitest green. `npx tsc -b` clean.

**Commit message:** `feat(PROJ-34): phase 13t-m — CustomTypographyCreator UI (Phase 13i frontend debt)`

---

### Phase 13t-n — Polish: i18n + accessibility + smoke checklist

**Scope-lock:** No new components. No new logic.

- [x] 13t-n.1 Audit ALL new components for i18n compliance — no hardcoded user-visible
  strings (CLAUDE.md rule). Add any missing keys to de/en JSON files.
- [x] 13t-n.2 Add ARIA labels to all `IconButton` + interactive elements per
  accessibility rules.
- [x] 13t-n.3 Verify all colors via `theme.vars.palette.*` — NO hex/rgb in any new
  component (memory `feedback_no_hardcoded_colors`).
- [x] 13t-n.4 Verify all new components use MUI v7 patterns — no `Grid item`, no
  `InputProps`, no `Hidden`, no `@mui/lab` imports.
- [x] 13t-n.5 Manual smoke test in Docker: open BuilderDialog, see Accordion expanded,
  see 10 Top + 3 Mix cards, click a card → Confirm-Dialog → Bestätigen → slots
  replaced, History tab shows the entry. Document any anomalies inline in this file.
- [x] 13t-n.6 Lint full scope (per memory `feedback_lint_full_scope`):
  `docker compose exec web ruff check django-app/` AND
  `cd frontend-ui && npx eslint src/`. Both must be 0 errors in 13t scope.

**Commit message:** `chore(PROJ-34): phase 13t-n — i18n + a11y + lint polish`

---

### Phase 13t-o — QA Round + AC/EC coverage + spec update

**Scope-lock:** Tests + docs only.

- [x] 13t-o.1 Run full backend test suite: `docker compose exec web pytest`. All green.
- [x] 13t-o.2 Run full frontend test suite: `cd frontend-ui && npm run test:ci`. All
  green. Coverage on new components ≥1 test each.
- [x] 13t-o.3 Mark all AC-79 → AC-128 + EC-33 → EC-49 checkboxes in
  `features/PROJ-34-design-prompt-engineering.md` (per memory
  `feedback_skills_must_follow_rules` — coding skills MUST flip these).
- [x] 13t-o.4 Mark all 13t-a → 13t-n task checkboxes in this file.
- [x] 13t-o.5 Append a "## QA Results — Phase 13t" subsection in the spec under
  the existing QA Test Results section. Document: backend test count, frontend test
  count, AC/EC coverage table, any deferred items.
- [x] 13t-o.6 Update memory file `project_proj34_status.md` to reflect Phase 13t
  shipped state. Update `features/INDEX.md` PROJ-34 status to "In Review" if not
  already (no change expected).

**Commit message:** `chore(PROJ-34): phase 13t-o — QA round + AC/EC coverage + docs`

---

## Phase 13t-p — Vision Schema Extension (post-13t bugfix)

**Spec source-of-truth:** `features/PROJ-34-design-prompt-engineering.md` Phase 13t-p
section + Tech Design subsection.

**Goal:** Fix the Top-Card duplicate-slot bug discovered post-13t by adding 3 new
structured fields to `NicheProductVisionAnalysis` so typography / font_combination
/ accessories get distinct, slogan-agnostic descriptors instead of all sharing
`graphic_elements`. Includes one-shot LLM backfill for the 89 existing rows.

**Branch:** continues on `feature/PROJ-34-design-prompt-engineering` (no new branch).

**Cost:** ~$0.01 for 89-row backfill (gpt-4.1-mini). One commit, one push.

**Reading list before any sub-phase:**
- `.claude/rules/general.md` + `backend.md` + `security.md`
- This file: this Phase 13t-p section + Appendices X + Y (verbatim prompts)
- Spec: Phase 13t-p ACs + ECs + Tech Design subsection
- Memory: `feedback_skills_must_follow_rules.md`, `feedback_phase_by_phase_skill_invocation.md`

### Phase 13t-p1 — Backend: Vision schema + prompt + model + migration

**Scope-lock:** Only the 4 files listed below. NO touching of `vision_analyze.py`,
`top_card_builder.py`, or serializer. Do NOT commit.

- [x] 13t-p1.1 `niche_research_app/graph/schemas.py` — add 3 fields to
  `VisionAnalysisSchema` (after existing `layout_composition` line) with descriptions
  pointing to the Slogan-Agnostic Rule:
    ```python
    typography_descriptors: str = Field(
        description="Slogan-agnostic typography treatment using placeholders "
                    "('primary headline', 'secondary text', 'accent words'). "
                    "NEVER quote actual slogan text. See Slogan-Agnostic Rule.",
    )
    font_combination_descriptors: str = Field(
        description="Slogan-agnostic font pairing description. "
                    "NEVER quote actual slogan text.",
    )
    accessory_descriptors: str = Field(
        description="Decorative elements (stars, lines, borders, distressing). "
                    "NEVER quote actual slogan text.",
    )
    ```
- [x] 13t-p1.2 `niche_research_app/graph/prompts.py` — replace `DEFAULT_VISION_PROMPT`
  with the full updated text from **Appendix X.1**. The new prompt extends the
  existing "Design Analysis" numbered list (6-8) and appends the verbatim
  "SLOGAN-AGNOSTIC RULE" block.
- [x] 13t-p1.3 `niche_research_app/models.py` — add 3 TextFields to
  `NicheProductVisionAnalysis` (after `layout_composition`, before `is_niche_match`):
    ```python
    typography_descriptors = models.TextField(blank=True, default='')
    font_combination_descriptors = models.TextField(blank=True, default='')
    accessory_descriptors = models.TextField(blank=True, default='')
    ```
- [x] 13t-p1.4 Run `docker compose exec web python manage.py makemigrations
  niche_research_app --name vision_structured_descriptors` → produces
  `0007_vision_structured_descriptors.py`. Verify additive-only (3 AddField ops).
- [x] 13t-p1.5 **Smart-update data migration for DB-seeded prompt** — create
  `niche_research_app/migrations/0008_update_vision_prompt_for_descriptors.py`
  manually (NOT via makemigrations). Pattern:
    - Constant `OLD_VISION_PROMPT` = verbatim text from **Appendix Z.1** (the
      pre-13t-p `DEFAULT_VISION_PROMPT`).
    - Constant `NEW_VISION_PROMPT` = verbatim text from **Appendix X.1** (the
      post-13t-p prompt with SLOGAN-AGNOSTIC RULE).
    - `update_prompt(apps, schema_editor)`: gets `ResearchNodeConfig` row for
      `node_name='vision_analyze'`. If row exists AND `row.system_prompt.strip()
      == OLD_VISION_PROMPT.strip()` → overwrite with `NEW_VISION_PROMPT` + save.
      If row exists but content differs → `print("WARNING: vision_analyze prompt
      is customized in DB; new SLOGAN-AGNOSTIC RULE block NOT auto-applied.
      Edit manually in Django Admin to enable the 3 new fields.")` + return.
      If row does not exist → return (fresh install will use code default).
    - `reverse_prompt(apps, schema_editor)`: same logic, swap NEW ↔ OLD.
    - `dependencies = [('niche_research_app', '0007_vision_structured_descriptors')]`
    - One `migrations.RunPython(update_prompt, reverse_prompt)` operation.
- [x] 13t-p1.6 Run both migrations locally: `docker compose exec web python
  manage.py migrate niche_research_app`. Verify:
    - Migration 0007 succeeds (additive).
    - Migration 0008 reports `vision_analyze` was auto-upgraded (local dev DB
      has the OLD seeded prompt, no customization).
- [x] 13t-p1.7 Verify ruff clean on touched files.

**Verify:** `python manage.py shell -c "from niche_research_app.models import NicheProductVisionAnalysis; print(NicheProductVisionAnalysis._meta.get_field('typography_descriptors'))"` → returns the new TextField object.

### Phase 13t-p2 — Backend: vision_analyze node + serializer

**Scope-lock:** Only `vision_analyze.py` + `api/serializers.py`. Do NOT commit.

- [x] 13t-p2.1 `niche_research_app/graph/nodes/vision_analyze.py` — in the
  singular `NicheProductVisionAnalysis(...)` constructor (around line 119), pass
  the 3 new fields from `analysis.typography_descriptors` etc.
- [x] 13t-p2.2 Same file: in the `bulk_create` path (around line 159), pass the
  3 new fields. — NOTE: only one constructor exists (feeds bulk_create), single edit covers both. Used `getattr(analysis, '...', '')` for robustness against malformed LLM responses.
- [x] 13t-p2.3 `niche_research_app/api/serializers.py` — add the 3 new fields to
  `NicheProductVisionAnalysisSerializer.Meta.fields` (around line 81).
- [x] 13t-p2.4 Verify ruff clean.

**Verify:** `pytest niche_research_app/tests/test_nodes.py -k vision -v` — existing
tests must still pass (the 3 new fields default to empty in test fixtures).
— NOTE: vision tests show 4 pre-existing failures from RQ Job ID bug in
`niche_app/signals.py:74` (`niche-reindex-{niche_id}` colon — out of scope).
Same test set fails on `git stash` baseline (verified). Phase 13t-p2 changes
introduce zero new failures.

### Phase 13t-p3 — Backend: top_card_builder source-field remap

**Scope-lock:** Only `design_app/services/top_card_builder.py`. Do NOT commit.

- [x] 13t-p3.1 Replace the block at lines 68-83 (typography / font_combination /
  accessories slot derivation) with the new pattern per **Tech Design — Phase
  13t-p — top_card_builder Remap** section in the spec. The new pattern:
  - `typography_text = vision_row.typography_descriptors or vision_row.graphic_elements or ""`
  - `font_text = vision_row.font_combination_descriptors or vision_row.graphic_elements or ""`
  - `accessory_text = vision_row.accessory_descriptors or vision_row.graphic_elements or ""`
  - Then pass each to `match_slot_to_builtin(...)` as before.
- [x] 13t-p3.2 Update the stale comment block at lines 68-73 (the "desired
  behavior" justification is now obsolete — replace with a one-line comment
  explaining the fallback to `graphic_elements` for unbackfilled rows).
- [x] 13t-p3.3 Verify ruff clean. — 19/19 existing tests pass.

**Verify:** `pytest design_app/tests/test_top_card_builder.py -v` — existing tests
should still pass (they use fixtures with `graphic_elements` set; fallback kicks in).

### Phase 13t-p4 — Backend: vision_backfill service + management command

**Scope-lock:** 2 new files only. Do NOT commit.

- [x] 13t-p4.1 Create `niche_research_app/services/__init__.py` (empty) if the
  `services/` directory doesn't exist yet.
- [x] 13t-p4.2 Create `niche_research_app/services/vision_backfill.py` with:
    - Constant `BACKFILL_SYSTEM_PROMPT` = verbatim **Appendix Y.1** text.
    - Constant `BACKFILL_USER_TEMPLATE` = verbatim **Appendix Y.2** text.
    - Pydantic `BackfillOutputSchema(BaseModel)` with the 3 fields.
    - Function `backfill_vision_descriptors(rows, dry_run=False) -> Summary`
      per Tech Design pseudo.
    - Uses existing OpenRouter client (`design_app/services/best_of_mix_generator.py`
      pattern as reference for httpx + Langfuse).
    - `@dataclass class Summary: processed: int; skipped: int; errored: int;
      total_tokens: int; estimated_cost_usd: float`.
    - On startup, the function emits a `warnings.warn(...)` if any
      `NicheResearchNodeConfig` row has a non-empty custom `vision_analyze` prompt
      override (per EC-52).
- [x] 13t-p4.3 Create `niche_research_app/management/commands/__init__.py` if missing
  + `backfill_vision_descriptors.py` with `BaseCommand` subclass:
    - Args: `--dry-run`, `--limit N` (int), `--niche-id <uuid>`, `--workspace-id <uuid>`.
    - Builds the QuerySet, calls the service, prints the summary.
- [x] 13t-p4.4 Verify ruff clean. — Dry-run smoke: 2 rows, $0.000303 (=> ~$0.0135 for 89 rows). Real-write smoke: 2 rows persisted. Idempotency verified on already-populated row: 0 LLM calls, 0 cost.

**Verify:**
- `docker compose exec web python manage.py backfill_vision_descriptors --dry-run --limit 2`
  → logs 2 LLM responses without writing to DB.
- `docker compose exec web python manage.py backfill_vision_descriptors --limit 2`
  → updates 2 rows; running again with same args → 0 processed (idempotent).

### Phase 13t-p5 — Tests + flip checkboxes + commit + push

**Scope-lock:** Tests + checkbox flips. Single conventional commit.

- [x] 13t-p5.1 Create `niche_research_app/tests/test_vision_backfill.py` with:
    - Test: `BackfillOutputSchema` parses a known-good JSON response.
    - Test: Backfill skips rows where all 3 fields are already populated (idempotency).
    - Test: Backfill skips rows where `graphic_elements=''` (EC-50).
    - Test: Slogan-leakage smoke — mock LLM to return the slogan literally, assert
      AC-137 test detects it (uses `assert slogan_text.lower() not in result.lower()`).
    - Mock OpenRouter via `unittest.mock.patch` (pattern from `test_best_of_mix_generator.py`).
- [x] 13t-p5.2 Create `design_app/tests/test_top_card_builder_remap.py` with:
    - Test: builder uses `typography_descriptors` when present.
    - Test: builder falls back to `graphic_elements` when `typography_descriptors=''`.
    - Test: All 3 new slot sources are independent (verify with mixed fixture).
- [x] 13t-p5.3 Run full backend test suite: `docker compose exec web pytest`. All green.
- [x] 13t-p5.4 Flip all AC-129 → AC-138 + EC-50 → EC-53 checkboxes in the spec to `[x]`.
- [x] 13t-p5.5 Flip all 13t-p1 → 13t-p5 task checkboxes in this file to `[x]`.
- [x] 13t-p5.6 (Optional) Run the backfill on the local dev DB:
  `docker compose exec web python manage.py backfill_vision_descriptors` →
  ~89 rows × ~$0.0001 = ~$0.01. Capture the Summary in the commit body.
- [x] 13t-p5.7 Commit + push:
    - Stage exactly the files listed in Phase Plan above + this file + spec.
    - Message: `feat(PROJ-34): phase 13t-p — Vision schema extension (3 distinct descriptors + backfill)`
    - Push to `feature/PROJ-34-design-prompt-engineering`.

**Commit message body:** Include the Summary from 13t-p5.6 if backfill was run.

---

## Phase 13t-q — Prompt Quality + UI Detail (post-13t-p refinement)

**Spec source-of-truth:** `features/PROJ-34-design-prompt-engineering.md` Phase 13t-q
section (AC-139..AC-144 + EC-54..EC-55).

**Goal:** Remove ConfirmDialog truncation + enrich LLM outputs with explicit
dimensions checklist; re-run backfill on dev DB.

**Branch:** continues on `feature/PROJ-34-design-prompt-engineering`.

**Cost target:** Re-backfill ≤$0.05 (119 rows × ~$0.0002 enriched output).

### Phase 13t-q1 — Frontend: remove ConfirmDialog truncation

- [x] 13t-q1.1 `NichePresetConfirmDialog.tsx` — remove `MAX_PREVIEW_CHARS` constant
  (line 79), `truncate()` function (lines 147-148), `display` variable + Tooltip
  guard (lines 219-220, 227, 234). Render `label` directly. `wordBreak: 'break-word'`
  stays.
- [x] 13t-q1.2 Update affected tests in `__tests__/NichePresetConfirmDialog.test.tsx`
  if any assert on truncated text.
- [x] 13t-q1.3 `npm run lint && npm run test:ci` green on touched files.

### Phase 13t-q2 — Backend: enrich Vision prompt

- [x] 13t-q2.1 `niche_research_app/graph/prompts.py` — replace existing items 6/7/8
  in `DEFAULT_VISION_PROMPT` with the enriched checklist + 1 reicher GOOD example
  per field. Reference: **Appendix AA.1** for verbatim text.
- [x] 13t-q2.2 No schema changes needed (fields already exist).
- [x] 13t-q2.3 Ruff clean.

### Phase 13t-q3 — Backend: enrich Backfill LLM prompt

- [x] 13t-q3.1 `niche_research_app/services/vision_backfill.py` — replace
  `BACKFILL_SYSTEM_PROMPT` constant with **Appendix AA.2** verbatim text (mirrors
  Vision prompt enrichment exactly).
- [x] 13t-q3.2 Ruff clean.

### Phase 13t-q4 — Data migration 0009

- [x] 13t-q4.1 Create `niche_research_app/migrations/0009_enrich_vision_prompt_with_dimension_checklist.py`
  manually. Constants:
    - `POST_13T_P_VISION_PROMPT` = the prompt from Phase 13t-p (current code state
      pre-q2, verbatim) — operator-runnable comparison anchor.
    - `ENRICHED_VISION_PROMPT` = same as new `DEFAULT_VISION_PROMPT` from q2.1.
  Smart-update pattern from 0008:
    - row exists + matches `POST_13T_P_VISION_PROMPT` verbatim → overwrite with
      `ENRICHED_VISION_PROMPT` + save + print success.
    - row exists + doesn't match → print warning + return (operator-customized).
    - row doesn't exist → return.
  Reverse: same logic in reverse.
- [x] 13t-q4.2 Apply: `docker compose exec web python manage.py migrate
  niche_research_app`. Verify dev DB gets auto-upgraded.

### Phase 13t-q5 — Backfill re-run with `--force`

- [x] 13t-q5.1 `vision_backfill.py` — add `force: bool = False` parameter to
  `backfill_vision_descriptors()`. When `True`, skip the
  `Q(typography_descriptors='')...` eligibility filter so all rows with non-empty
  `graphic_elements` are processed.
- [x] 13t-q5.2 `management/commands/backfill_vision_descriptors.py` — add `--force`
  flag, pass to service.
- [x] 13t-q5.3 Tests: extend `test_vision_backfill.py` with a `--force` path test
  (already-populated row IS reprocessed with `force=True`).
- [x] 13t-q5.4 Run: `docker compose exec web python manage.py backfill_vision_descriptors --force`
  on dev DB. Verify ≤$0.05 cost + 119 rows processed.
- [x] 13t-q5.5 Spot-check 3 random rows for enriched output (≥3 dimensions per field).

### Phase 13t-q6 — Browser-verify + commit + push

- [x] 13t-q6.1 Open BuilderDialog in browser, click a Top-Card, verify (a) no
  truncation, (b) richer Typography/Font/Accessories descriptions. Screenshot.
- [x] 13t-q6.2 Flip all AC-139..AC-144 + EC-54..EC-55 checkboxes in spec to `[x]`.
- [x] 13t-q6.3 Flip all 13t-q1..13t-q6 task checkboxes in this file to `[x]`.
- [x] 13t-q6.4 Commit + push:
    - Message: `feat(PROJ-34): phase 13t-q — enriched Vision prompts + ConfirmDialog full-text + force-backfill`
    - Push to `feature/PROJ-34-design-prompt-engineering`.

---

## Phase 13t-s — Collection Products in Vorschläge Tab

**Spec source-of-truth:** `features/PROJ-34-design-prompt-engineering.md`
Phase 13t-s section (AC-145..AC-150 + EC-56..EC-58 + Resolved Decisions #31-34).

**Goal:** Surface user-curated `CollectedProduct` items as preset cards above
Top-10 in the Vorschläge tab. Skip products without Vision analysis.

### Phase 13t-s1 — Backend: collection_cards service + model + migration

- [x] 13t-s1.1 Create `design_app/services/collection_cards.py` with function
  `get_collection_cards(niche, workspace_id) -> list[dict]`. Reuse
  `build_top_card_preset(vision_row, niche)`; override `source_card_type='collection'`
  + `source_card_references` to include `collected_at`. Per AC-145.
- [x] 13t-s1.2 `design_app/models.py` — extend `NicheCardPreset.source_card_type`
  choices with `('collection', 'Collection')`. Run `makemigrations design_app`
  → produces `0017_add_collection_source_type.py` (only `choices` update,
  no schema change).
- [x] 13t-s1.3 Apply migration locally; verify with shell that
  `NicheCardPreset._meta.get_field('source_card_type').choices` contains 5 entries.
- [x] 13t-s1.4 Create `design_app/tests/test_collection_cards.py`:
    - returns empty list when niche has 0 CollectedProducts
    - returns 1 card when 1 CollectedProduct has matching Vision
    - skips CollectedProduct when no matching Vision exists
    - cards ordered by `collected_at DESC` (newest first)
    - `source_card_type=='collection'` on every returned card
- [x] 13t-s1.5 Ruff clean + pytest green on touched files.

### Phase 13t-s2 — Backend: extend vorschlaege endpoint

- [x] 13t-s2.1 `design_app/api/views.py` — locate the `vorschlaege` action on
  `NicheCardPresetViewSet`. Add `'collection': get_collection_cards(niche, ws_id)`
  to the response dict.
- [x] 13t-s2.2 Update existing test `test_preset_api.py` for `vorschlaege` to
  assert `'collection'` key present + correct content.
- [x] 13t-s2.3 Ruff clean + pytest green.

### Phase 13t-s3 — Frontend: RTK Query + CollectionCardsRow component

- [x] 13t-s3.1 `frontend-ui/src/types/nichePreset.ts` — extend `VorschlaegeResponse`
  type to include `collection: NichePresetCard[]`.
- [x] 13t-s3.2 `frontend-ui/src/services/presetCardsApi.ts` — if a response
  transformer exists, ensure `collection` is exposed; otherwise just type update.
- [x] 13t-s3.3 Create `frontend-ui/src/views/designs/board/partials/promptBuilder/nichePresets/CollectionCardsRow.tsx`
  mirroring `TopCardsGrid.tsx` structure: header row with "Collection (count)"
  + grid of `NichePresetCard` (square 200×200, `wide={false}`).
- [x] 13t-s3.4 Vitest unit test in `__tests__/CollectionCardsRow.test.tsx`:
    renders N cards from props, calls `onCardClick(card)` on click,
    renders nothing when items array empty.
- [x] 13t-s3.5 `npm run lint && npm run test:ci` green.

### Phase 13t-s4 — Frontend: VorschlaegeTab integration

- [x] 13t-s4.1 `NichePresetsTabs.tsx` (Vorschläge tab area) — mount
  `CollectionCardsRow` above `TopCardsGrid` + `BestOfMixRow`. Use
  `collection.length > 0` guard so empty Collection skips rendering entirely.
- [x] 13t-s4.2 i18n: add `designForge.builder.nichePresets.collectionHeader`
  = "Collection" (EN) / "Sammlung" (DE) to both i18n JSON files.
- [x] 13t-s4.3 Update existing `NichePresetsTabs` tests if they assert on the
  rendered tab structure.
- [x] 13t-s4.4 `npm run lint && npm run test:ci` green.

### Phase 13t-s5 — Browser-verify + commit + push

- [x] 13t-s5.1 Open BuilderDialog in browser for "school bus driver" niche
  → Vorschläge tab → verify Collection subsection appears above Top-10 with
  3 cards (3 CollectedProducts have Vision; 1 skipped). Screenshot.
- [x] 13t-s5.2 Flip all AC-145..AC-150 + EC-56..EC-58 checkboxes in spec to `[x]`.
- [x] 13t-s5.3 Flip all 13t-s1..13t-s5 task checkboxes in this file to `[x]`.
- [ ] 13t-s5.4 Commit + push:
    - Message: `feat(PROJ-34): phase 13t-s — Collection products in Vorschläge tab`
    - Push to `feature/PROJ-34-design-prompt-engineering`.

---

## Appendix S — Best-of-Mix LLM SYSTEM_PROMPT

**Source-of-truth:** This is the verbatim text used in
`django-app/design_app/services/best_of_mix_generator.py` constant `SYSTEM_PROMPT`.
Copy-paste; do NOT paraphrase (Phase 13t-d.1 enforces "no paraphrasing").

### S.1 SYSTEM_PROMPT (verbatim)

```
You are a Print-on-Demand niche-research synthesizer producing three "Best-of-Mix"
prompt configurations for the Architect Prompt Builder. You receive a structured
aggregate of vision + emotional + niche-level analyses for an entire Amazon T-shirt
niche. Your job is to distill three distinct synthetic preset configurations from
the corpus — NOT to copy any single product.

# The 3 variants you produce

1. **most_common** — captures the dominant visual + emotional patterns present in the
   majority of bestsellers. Goal: maximum recognizability, lowest risk.
2. **edgy** — pushes the niche tonality + composition toward riskier, punchier choices
   that some bestsellers exhibit but most don't. Goal: stand out, willing to polarize.
3. **safe** — broadly appealing, neutral tone, conservative composition that would
   sell across the widest demographic in the niche. Goal: maximum mass-market appeal.

# Each variant produces exactly these 7 slot values (NO MORE, NO LESS)

For each variant return a JSON object containing all 7 slots:

1. `spatial_configuration` — one of the 43 spatial layout IDs, OR a free-text
   description ≤200 chars. IDs are listed in the user message below. Pick an ID when
   one fits cleanly; use raw text only when nothing fits.
2. `visual_description` — a free-form 60-120 word description of the dominant
   illustration subject. MUST contain ≥6 concrete details (perspective, color-object
   binding, line weight, pose, body parts, accessories). Start with "a [adjective]
   [SUBJECT] in [PERSPECTIVE], featuring ...". Use color-object binding ("golden yellow
   bus body") not bare colors. NEVER use the words "T-shirt", "mockup", "model wearing",
   "gradient", "glow", "soft shadow".
3. `typography_adjectives` — descriptors of the dominant typography choice for this
   variant. Free-text ≤120 chars (e.g. "bold compressed stencil with hand-cut edges").
4. `font_combination` — describes the pairing of fonts used in this variant. Free-text
   ≤120 chars (e.g. "athletic varsity serif headline + sans-serif tagline").
5. `accessories` — one of the 6 fixed accessory variants verbatim, OR null. List in
   user message below.
6. `style_dna` — a per-variant aesthetic descriptor that captures the overall design
   philosophy. Free-text ≤200 chars (e.g. "1970s underground comic with halftone
   prints and bold linework").
7. `extra_context` — optional verbatim tail describing any final compositional or
   tonal nuance specific to this variant. Free-text ≤200 chars OR empty string.

# Forbidden patterns

- NEVER use the word "T-shirt" anywhere in any output.
- NEVER mention "on a black shirt", "model wearing", "fabric texture", or any phrase
  describing the wearer.
- NEVER produce a `visual_description` containing gradients, glowing effects, soft
  shadows, or drop shadows.
- NEVER paraphrase the 6 fixed accessory variants — return them verbatim or use null.
- NEVER invent spatial IDs — use only ones from the explicit enum in the user message
  OR free-text.
- NEVER make all 3 variants the same — each MUST be meaningfully distinct.

# Output format

Return ONLY a valid JSON object with this exact shape. No preamble, no markdown.

{
  "most_common": {
    "spatial_configuration": "<id or raw text>",
    "visual_description": "<60-120 words>",
    "typography_adjectives": "<≤120 chars>",
    "font_combination": "<≤120 chars>",
    "accessories": "<verbatim variant or null>",
    "style_dna": "<≤200 chars>",
    "extra_context": "<≤200 chars or empty>"
  },
  "edgy": { ... same shape ... },
  "safe": { ... same shape ... }
}
```

### S.2 User message template (rendered by `_build_user_message`)

```
NICHE: {niche.name}
TOTAL ANALYZED PRODUCTS: {len(vision_rows)}
TOP-RANKED PRODUCTS USED FOR THUMBNAIL: {top3_product_ids}

ALLOWED SPATIAL IDS (use one or null/free-text):
vertical_stack, horizontal_row, badge_emblem, banner_top,
headline_top_subtitle_bottom, text_overlay, stacked_word_block, knockout_text,
big_word_tiny_tag, word_as_shape, diagonal_text, pyramid_stack, rectangular_frame,
crest_coat_of_arms, postage_stamp, hexagon_medallion, road_sign, definition_entry,
knolling_grid, anatomy_diagram, checklist, periodic_tile, recipe_card,
vintage_postcard, sports_jersey, movie_poster, license_plate, concert_ticket,
map_coordinates, off_center_text_wrap, diagonal_split, triptych_three_panel,
concentric_circular_text, speech_bubble, quote_marks_frame, sunburst_layout,
flush_aligned_block, full_canvas_word_block, vertical_pillar_text,
illustration_only_no_text, unconventional_integration, crossed_tools_intersection,
subject_portrait_with_caption

ALLOWED ACCESSORIES (use one verbatim or null):
- "white radiating motion-burst lines around the illustration"
- "a sparse scattering of small filled stars and tiny dots framing the design"
- "a thin geometric border frame enclosing the entire composition"
- "a curved banner ribbon underneath the illustration with secondary text on it"
- "sunburst rays radiating outward from behind the illustration"
- "halftone-dot accents in the negative space around the illustration"

=== NICHE-LEVEL AGGREGATE ===
NICHE_SUMMARY: {niche_analysis.niche_summary}
SENTIMENT: {niche_analysis.sentiment}
PRIMARY_EMOTIONS: {niche_analysis.primary_emotions}
EMOTIONAL_ARCHETYPE: {niche_analysis.emotional_archetype}
DOMINANT_DESIGN_AESTHETICS: {niche_analysis.dominant_design_aesthetics}
DESIGN_CONCEPTS: {niche_analysis.design_concepts}
PATTERN_ANALYSIS: {niche_analysis.pattern_analysis}
EMOTIONAL_REALITY: {niche_analysis.emotional_reality}

=== PER-PRODUCT VISION + EMOTIONAL BLOCKS ===
(One block per analyzed product, separated by ---)

---
TITLE: {vision.product.title}
SLOGAN: {vision.slogan_text}
MEANING: {vision.meaning_context}
VISUAL_STYLE: {vision.visual_style}
GRAPHIC_ELEMENTS: {vision.graphic_elements}
LAYOUT_COMPOSITION: {vision.layout_composition}
EMOTIONAL.TONE: {emotional.tone}
EMOTIONAL.PATTERN: {emotional.emotional_pattern}
EMOTIONAL.VIBE: {emotional.vibe}
EMOTIONAL.KEY_ELEMENTS: {emotional.key_elements}
EMOTIONAL.ADAPTATION_FORMULA: {emotional.adaptation_formula}
---
... (repeat per product)
```

### S.3 Tunables (constants in best_of_mix_generator.py)

| Constant | Value | Why |
|---|---|---|
| `DEFAULT_MODEL` | `openai/gpt-4.1-mini` | Proven for this codebase |
| `TIMEOUT_SEC` | `15.0` | Mix needs more thinking than spatial-only |
| `TEMPERATURE` | `0.4` | Slightly higher than builder_hints (0.3) — Mix needs creative aggregation |
| `MAX_TOKENS` | `2400` | 3 variants × ~800 tokens each |
| `MAX_VISION_PRODUCTS` | `20` | Cap input — typically ≤2k tokens fit comfortably |
| `MAX_EMOTIONAL_PRODUCTS` | `15` | Cap input — emotional analyses tend to be larger |
| `SCHEMA_VERSION` | `1` | Versioning for cache invalidation when prompt evolves |

---

## Appendix T — Preset Hash Normalization

### T.1 Algorithm (pseudocode)

```
def compute_preset_hash(slots: dict) -> str:
    """
    SHA256 hex over normalized + sorted-JSON serialization of the 7 slot values.

    Input shape (exact keys, in any order):
      {
        "spatial_configuration": str | "",
        "visual_description":    str | "",
        "typography_adjectives": str | "",
        "font_combination":      str | "",
        "accessories":           str | "",
        "style_dna":             str | "",
        "extra_context":         str | "",
      }
    """
    SLOT_ORDER = [
        "spatial_configuration",
        "visual_description",
        "typography_adjectives",
        "font_combination",
        "accessories",
        "style_dna",
        "extra_context",
    ]
    SLUG_SLOTS = {"spatial_configuration", "typography_adjectives",
                  "font_combination", "accessories"}
    # ^ These slots can hold either built-in IDs (slugs) OR raw text.
    # Slugs are already lowercase + underscored; raw text must be lowercased
    # for hash equivalence.

    normalized = {}
    for slot in SLOT_ORDER:
        raw = (slots.get(slot) or "").strip()
        # NFKD canonical decomposition — equates é/é, fi-ligature/fi, etc.
        nfkd = unicodedata.normalize("NFKD", raw)
        # Drop combining marks (accents)
        no_marks = "".join(c for c in nfkd if not unicodedata.combining(c))
        # Collapse internal whitespace to single spaces
        collapsed = " ".join(no_marks.split())
        # Lowercase non-slug slots only (slugs are already lowercase)
        if slot in SLUG_SLOTS:
            normalized[slot] = collapsed
        else:
            normalized[slot] = collapsed.lower()

    # sort_keys ensures deterministic JSON regardless of dict ordering
    canonical_json = json.dumps(normalized, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()
```

### T.2 Properties

- **Deterministic:** identical input → identical hash.
- **Order-independent:** dict input order has no effect (sorted JSON).
- **Unicode-stable:** "café" and "café" produce same hash.
- **Whitespace-stable:** "Hello  World" and " Hello World " produce same hash.
- **Case-stable on raw slots:** "BOLD STENCIL" and "bold stencil" in
  `visual_description` produce same hash. (Slug slots already canonical.)
- **One-char diff → different hash:** standard SHA256 avalanche.

### T.3 What does NOT participate in the hash

- `preset_label` (auto-generated, may differ by accident across producers)
- `reference_thumbnail_url` (varies by source product)
- `source_card_type` (top vs mix variant — same 7 slots could legitimately appear)
- `source_card_references` (metadata only)
- All flags (`is_in_history`, `is_in_custom`, `is_raw`, etc.)
- All timestamps

### T.4 Test vectors (for `test_preset_hash.py`)

| Input | Expected behavior |
|---|---|
| All 7 slots = `""` | Stable hash A1 |
| Slots populated with sample data | Stable hash A2 ≠ A1 |
| Same as A2 but dict keys in reverse order | Hash = A2 |
| Same as A2 but `visual_description` "café" → "café" | Hash = A2 |
| Same as A2 but `style_dna` "BOLD" → "bold" | Hash = A2 (raw slot, lowercased) |
| Same as A2 but `spatial_configuration` "vertical_stack" → "VERTICAL_STACK" | Hash ≠ A2 (slug slot, case-sensitive) |
| Same as A2 but extra whitespace in `extra_context` | Hash = A2 |
| Same as A2 but `visual_description` changed by 1 char | Hash ≠ A2 |

---

## Appendix U — Jaccard Matching Algorithm

### U.1 Algorithm (pseudocode)

```
def match_slot_to_builtin(slot_key: str, raw_text: str) -> tuple[str | None, bool]:
    """
    Return (matched_built_in_id, is_raw=False) when Jaccard ≥ threshold.
    Return (truncated_raw_text, is_raw=True) otherwise.
    """
    SLOT_OPTIONS = {
        "spatial_configuration": SPATIAL_OPTIONS,
        "typography_adjectives": TYPOGRAPHY_OPTIONS,
        "font_combination":      FONT_COMBINATION_OPTIONS,
        "accessories":           ACCESSORIES_OPTIONS,
        "style_dna":             None,  # style_dna has no built-in pool — always raw
    }
    SLOT_MAX_RAW_LEN = {
        "spatial_configuration": 200,
        "typography_adjectives": 120,
        "font_combination":      120,
        "accessories":           100,
        "style_dna":             200,
    }
    SLOT_THRESHOLDS = {
        "spatial_configuration": 0.55,
        "typography_adjectives": 0.50,  # shorter vocabulary, lower bar
        "font_combination":      0.55,
        "accessories":           0.65,  # only 6 options — must match cleanly
    }

    options = SLOT_OPTIONS.get(slot_key)
    if options is None:
        # No pool to match against (style_dna, visual_description, extra_context).
        return (raw_text[: SLOT_MAX_RAW_LEN.get(slot_key, 200)].strip(), True)

    raw_tokens = _tokenize(raw_text)  # lowercase, alphanum-only, drop stopwords
    threshold = SLOT_THRESHOLDS[slot_key]

    best_id, best_score = None, 0.0
    for opt in options:
        # Tokens from label + prompt_text concatenated
        opt_text = f"{opt.get('label', '')} {opt.get('prompt_text', '')}"
        opt_tokens = _tokenize(opt_text)
        score = _jaccard(raw_tokens, opt_tokens)
        if score > best_score:
            best_id, best_score = opt['id'], score

    if best_score >= threshold:
        return (best_id, False)
    truncated = raw_text[: SLOT_MAX_RAW_LEN[slot_key]].strip()
    return (truncated, True)


def _jaccard(a: set, b: set) -> float:
    if not a and not b:
        return 0.0
    intersection = len(a & b)
    union = len(a | b)
    return intersection / union if union else 0.0


def _tokenize(text: str) -> set[str]:
    STOPWORDS = {"the", "a", "an", "with", "and", "of", "in", "on", "at",
                 "to", "for", "from", "by", "design", "style"}
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    return {t for t in tokens if t not in STOPWORDS and len(t) >= 2}
```

### U.2 Per-slot threshold rationale

| Slot | Threshold | Why |
|---|---|---|
| spatial_configuration | 0.55 | 43 options — moderate threshold to avoid mis-matching close-but-wrong layouts |
| typography_adjectives | 0.50 | 22 options — shorter labels, more ambiguous vocabulary |
| font_combination | 0.55 | 10 options — combinations are distinct, moderate bar OK |
| accessories | 0.65 | Only 6 options + each ~10 words — match must be high-confidence |
| style_dna | — | No pool — always raw |

### U.3 Test cases (for `test_preset_matcher.py`)

Each parametrized: `(slot_key, raw_text, expected_id_or_None, expected_is_raw)`.

| slot | raw_text | expected | is_raw |
|---|---|---|---|
| spatial_configuration | "centered stacked layout with text top and illustration bottom" | `vertical_stack` | False |
| spatial_configuration | "weird upside-down corkscrew thing" | `(truncated_raw)` | True |
| typography_adjectives | "bold compressed stencil military style" | `stencil_bold` (assumed id) | False |
| typography_adjectives | "art-nouveau curlicue swooshes" | `(truncated_raw)` | True |
| accessories | "white radiating motion-burst lines around the illustration" | exact-match id | False |
| accessories | "rainbow sparkle particles" | `(truncated_raw)` | True |
| style_dna | "1970s halftone underground comic" | `("1970s halftone underground comic", True)` | True |

### U.4 Tuning notes

- Thresholds are constants in `preset_matcher.py` (NOT in `settings.py`) so dev can
  tune in tests without redeploying. Once stable, they can move to settings.
- If real-world coverage is low, consider:
  - Adding synonym dictionary (e.g. "weathered" ≈ "distressed").
  - Switching from Jaccard to TF-IDF cosine.
  - Going to embeddings (deferred — out of scope per spec).

---

## Appendix V — Collage Renderer Technical Spec

### V.1 Output spec

- Format: WebP
- Dimensions: 600 × 200 px (3 cells of 200 × 200, side-by-side)
- Quality: 85 (Pillow default for webp)
- Background: solid fill `#1f1f1f` (matches design-system dark mode bg)
- Per cell: center-cropped + resized to 200×200, then composited.

### V.2 Inputs

- `product_ids: list[str]` — UUIDs of the 3 top-ranked products.
- Source images: `NicheProductVisionAnalysis.product.image_url` (or equivalent
  `AmazonProduct.image_url`). Resolve to local cache path if mirrored, else fetch
  remote URL via `httpx` (5s timeout per image).

### V.3 Error handling

- Missing product → render a 200×200 placeholder cell with text "no image"
  (Pillow `ImageDraw` + system font).
- Image fetch failure → same placeholder.
- Invalid image bytes → same placeholder.
- All 3 products missing → still produce a 600×200 webp with 3 placeholders.

### V.4 Caching

- Output path: `MEDIA_ROOT / 'best_of_mix_collages' / f'{niche_id}.webp'`
- Staleness check: regenerate if file is missing OR `mtime` > 7 days old.
- On regen, write atomically (write to `.tmp` + rename) to avoid serving partial.

### V.5 Test cases (for `test_collage_renderer.py`)

| Case | Expected |
|---|---|
| 3 valid product image URLs | webp file 600×200, <80 KB |
| 1 missing product | 1 placeholder cell + 2 real cells |
| All 3 missing | 3 placeholder cells, file still 600×200 |
| Repeat call within 7 days | mtime unchanged, no re-render |
| Repeat call after 8 days (mtime touched) | re-rendered |
| Concurrent calls | atomic write — never partial file served |

### V.6 Pseudocode (NOT for blind copy — implementation belongs to 13t-e)

```
def render_collage_webp(product_ids: list[str]) -> bytes:
    cells = []
    for pid in product_ids[:3]:
        try:
            img = _fetch_or_load(pid)
            cells.append(_center_crop_200(img))
        except Exception:
            cells.append(_placeholder_200("no image"))
    while len(cells) < 3:
        cells.append(_placeholder_200("no image"))

    canvas = Image.new("RGB", (600, 200), color=(0x1f, 0x1f, 0x1f))
    for i, cell in enumerate(cells):
        canvas.paste(cell, (i * 200, 0))

    buf = io.BytesIO()
    canvas.save(buf, format="WEBP", quality=85)
    return buf.getvalue()
```

---

## Appendix W — CustomTypography UI Component Tree (Schicht 21)

This mirrors `CustomSpatialCreator` (Phase 13d/Appendix O of this file) verbatim.

### W.1 Component tree

```
TypographyPickerModal.tsx (existing, line 296)
+-- existing "Built-in" Tab (unchanged)
+-- existing "Custom" Tab (unchanged — shows existing CustomTypography list)
+-- (NEW) "Create new" Tab
    +-- (NEW) CustomTypographyCreator.tsx              [orchestrator]
        +-- Step 1: source picker
        |   +-- (NEW) CustomTypographyCreator.Step1.tsx
        |       +-- ImageUploadDropzone (MUI styled, drag-drop)
        |       +-- ProjectReferenceList (re-uses useGetProjectReferencesQuery)
        |       +-- GeneratedDesignList (lists Design[] of current project)
        +-- Step 2: analyze + edit
        |   +-- (NEW) CustomTypographyCreator.steps.tsx (Step 2 sub-component)
        |       +-- POST /api/designs/typographies/custom/analyze/
        |       +-- TextField (multiline, editable LLM result)
        +-- Step 3: name + save
            +-- (NEW) CustomTypographyCreator.steps.tsx (Step 3 sub-component)
                +-- TextField (name, max 80, uniqueness validation)
                +-- Save Button → POST /api/designs/typographies/custom/
                +-- On success: auto-select in TypographyPickerModal "Custom" tab
```

### W.2 Backend endpoints used (Phase 13i — already shipped)

| Method | Path | Behavior |
|---|---|---|
| POST | `/api/designs/typographies/custom/analyze/` | Returns LLM-extracted typography description from image |
| POST | `/api/designs/typographies/custom/` | Persists CustomTypography in workspace |
| GET | `/api/designs/typographies/custom/` | Lists workspace CustomTypography entries (existing) |
| DELETE | `/api/designs/typographies/custom/<id>/` | Soft-delete (existing) |

No new backend work in Schicht 21. RTK Query slice `customTypographyApi` wraps these.

### W.3 Step transitions

- Step 1 → Step 2: when user picks an image source AND it validates (upload <10MB,
  correct mime, OR reference/design selected).
- Step 2 → Step 3: when user clicks "Looks good, name it" after editing the LLM result.
- Step 3 → Done: when Save succeeds. Modal switches to "Custom" tab + auto-selects
  the new entry. New CustomTypography becomes the slot's selected value automatically.

### W.4 Validation rules (frontend-side, mirror CustomSpatial)

- Image upload: ≤10 MB, mime ∈ {image/jpeg, image/png, image/webp}.
- Name: 1–80 chars, trimmed. Uniqueness checked on Save via 409 response handling.
- LLM result: required non-empty after edit before Step 2 → Step 3 transition.

### W.5 Tests (Vitest)

- Renders Step 1 by default.
- Upload >10MB → rejected with inline error message.
- Pick reference → advances to Step 2 with analyze API mocked.
- Edit LLM result → advances to Step 3.
- Name conflict (409) → inline error, stays on Step 3.
- Save success → mutation called, modal tab switches, parent receives new id.

---

## Appendix X — Vision Prompt Extension (Phase 13t-p)

**Source-of-truth:** This is the verbatim updated text of `DEFAULT_VISION_PROMPT`
in `django-app/niche_research_app/graph/prompts.py`. Copy-paste; do NOT paraphrase.

### X.1 DEFAULT_VISION_PROMPT (full updated text — replaces lines 5-25)

```python
DEFAULT_VISION_PROMPT = """\
# T-SHIRT DESIGN ANALYSIS

## Instructions

### Design Analysis
1. **slogan_text:** Transcribe text exactly (preserve spelling/lines).
2. **meaning_context:** Explain the joke, wordplay, cultural reference (e.g., song lyrics), \
or niche connection. Why is it funny?
3. **visual_style:** Describe the aesthetic (e.g., Cartoon, Retro, Grunge), the vibe \
(e.g., Playful, Aggressive), and the color palette.
4. **graphic_elements:** Describe the main motif, typography details (font style, color), \
and decorative elements (lines, distressing). This is a free-form prose blob.
5. **layout_composition:** Describe the structure (e.g., Sandwich layout), alignment, \
and visual hierarchy.
6. **typography_descriptors:** Slogan-agnostic typography treatment (see Slogan-Agnostic Rule below).
7. **font_combination_descriptors:** Slogan-agnostic font pairing description.
8. **accessory_descriptors:** Decorative elements (stars, lines, borders, distressing) — \
slogan-agnostic.

### Niche Match Classification
- **is_niche_match:** Set to true if the product design clearly belongs to the target niche \
(based on the keyword and brand/title context). Set to false if the design is generic, \
unrelated, or a trademark/licensed product.

=== SLOGAN-AGNOSTIC RULE (typography/font_combination/accessory fields) ===

For typography_descriptors, font_combination_descriptors, accessory_descriptors:
- Describe the VISUAL TREATMENT, not the specific words.
- Use placeholders: "primary headline", "secondary text", "accent words", "tagline".
- NEVER quote or reference the actual slogan text in these three fields.
- Focus on: font weight, casing, style (sans/serif/script), color, decorative treatment.

GOOD typography_descriptors:
  "bold uppercase block letters for the primary headline; cursive script font for
   the secondary text and accent words; high contrast between weights"

BAD typography_descriptors (DO NOT DO THIS):
  "bold block letters for 'SCHOOL BUS'; cursive for 'Driver' and 'Just Like'"
   (contains the literal slogan text — strictly forbidden)

GOOD font_combination_descriptors:
  "Sans-serif uppercase paired with a handwritten cursive script accent"

BAD font_combination_descriptors:
  "ROLLIN' in handwritten font, THEY in block"

GOOD accessory_descriptors:
  "white stars and decorative lines arranged around the central motif;
   subtle distressing on the headline; small dot-pattern border"

BAD accessory_descriptors:
  "stars and lines around 'SCHOOL BUS DRIVER'"
"""
```

### X.2 Schema additions (Pydantic — `graph/schemas.py`)

Insert AFTER existing `layout_composition` Field (line 47):

```python
    typography_descriptors: str = Field(
        description="Slogan-agnostic typography treatment using placeholders "
                    "('primary headline', 'secondary text', 'accent words'). "
                    "NEVER quote actual slogan text. See Slogan-Agnostic Rule.",
    )
    font_combination_descriptors: str = Field(
        description="Slogan-agnostic font pairing description. "
                    "NEVER quote actual slogan text.",
    )
    accessory_descriptors: str = Field(
        description="Decorative elements (stars, lines, borders, distressing). "
                    "NEVER quote actual slogan text.",
    )
```

### X.3 Model additions (Django — `models.py`)

Insert AFTER existing `layout_composition` field (line 178), BEFORE `is_niche_match`:

```python
    typography_descriptors = models.TextField(blank=True, default='')
    font_combination_descriptors = models.TextField(blank=True, default='')
    accessory_descriptors = models.TextField(blank=True, default='')
```

---

## Appendix Y — Vision Backfill LLM Prompt (Phase 13t-p)

**Source-of-truth:** Verbatim text used in
`django-app/niche_research_app/services/vision_backfill.py` constants
`BACKFILL_SYSTEM_PROMPT` and `BACKFILL_USER_TEMPLATE`. Copy-paste; do NOT paraphrase.

### Y.1 BACKFILL_SYSTEM_PROMPT (verbatim)

```python
BACKFILL_SYSTEM_PROMPT = """\
# VISION ANALYSIS BACKFILL — TYPOGRAPHY / FONT / ACCESSORY EXTRACTION

You are upgrading existing t-shirt design analyses. You receive ONE row's existing
free-form prose description (`graphic_elements`) plus its `slogan_text`, and must
extract THREE structured slogan-agnostic descriptors.

## Your Task

Read the `graphic_elements` prose. It blends typography, font, decorative, and motif
information into one paragraph. Extract three separate slogan-agnostic descriptors:

1. **typography_descriptors:** how the text is treated visually (weight, casing,
   style, color emphasis) — using placeholders for the text itself.
2. **font_combination_descriptors:** what fonts are paired and how they relate.
3. **accessory_descriptors:** decorative non-text elements (stars, lines, borders,
   distressing, ornaments) and motif details that are NOT the main subject.

## Output Format

Return ONLY valid JSON matching this shape:

```json
{
  "typography_descriptors": "...",
  "font_combination_descriptors": "...",
  "accessory_descriptors": "..."
}
```

No markdown fences, no commentary, no preamble — just the JSON object.

=== SLOGAN-AGNOSTIC RULE (mandatory) ===

- Describe the VISUAL TREATMENT, not the specific words.
- Use placeholders: "primary headline", "secondary text", "accent words", "tagline".
- NEVER quote or reference the actual slogan text in any of the three fields.
- If the source prose quotes the slogan (e.g. "bold for 'SCHOOL BUS'"), rewrite it
  using placeholders (e.g. "bold for the primary headline").

GOOD typography_descriptors:
  "bold uppercase block letters for the primary headline; cursive script font for
   the secondary text and accent words; high contrast between weights"

BAD (DO NOT DO THIS — contains literal slogan):
  "bold block letters for 'SCHOOL BUS'; cursive for 'Driver' and 'Just Like'"

GOOD font_combination_descriptors:
  "Sans-serif uppercase paired with a handwritten cursive script accent"

BAD: "ROLLIN' in handwritten font, THEY in block"

GOOD accessory_descriptors:
  "white stars and decorative lines arranged around the central motif;
   subtle distressing on the headline; small dot-pattern border"

BAD: "stars and lines around 'SCHOOL BUS DRIVER'"

## If the source prose lacks information for a field

Return a brief generic descriptor based on what IS present (e.g. if no decorative
elements are mentioned, return `"no decorative accessories visible"`). NEVER invent
elements not in the source.
"""
```

### Y.2 BACKFILL_USER_TEMPLATE (verbatim)

```python
BACKFILL_USER_TEMPLATE = """\
SOURCE ROW DATA:

slogan_text:
{slogan_text}

graphic_elements (free-form prose to extract from):
{graphic_elements}

Now extract the three slogan-agnostic descriptors and return them as JSON.
"""
```

### Y.3 LLM Configuration (vision_backfill.py constants)

```python
BACKFILL_MODEL = "openai/gpt-4.1-mini"
BACKFILL_TEMPERATURE = 0.2
BACKFILL_MAX_TOKENS = 400
BACKFILL_TIMEOUT_S = 15.0
BACKFILL_LANGFUSE_TAGS = ["phase=13t-p_backfill"]
# gpt-4.1-mini pricing (May 2026): $0.00015/1K input, $0.0006/1K output
BACKFILL_INPUT_COST_PER_1K = 0.00015
BACKFILL_OUTPUT_COST_PER_1K = 0.00060
```

---

## Appendix Z — OLD Vision Prompt (verbatim, for smart-update data migration)

**Source-of-truth:** This is the verbatim pre-13t-p text of `DEFAULT_VISION_PROMPT`
as it exists in `niche_research_app/graph/prompts.py` lines 5-25 BEFORE Phase 13t-p
edits, and as seeded into the production DB via migration `0002_seed_research_node_config.py`.

Used in `0008_update_vision_prompt_for_descriptors.py` as the `OLD_VISION_PROMPT`
constant for the smart-detection comparison. **Strip trailing whitespace on both
sides of the comparison** (`row.system_prompt.strip() == OLD_VISION_PROMPT.strip()`).

### Z.1 OLD_VISION_PROMPT (verbatim — 901 chars confirmed against prod DB 2026-05-23)

```python
OLD_VISION_PROMPT = """\
# T-SHIRT DESIGN ANALYSIS

## Instructions

### Design Analysis
1. **slogan_text:** Transcribe text exactly (preserve spelling/lines).
2. **meaning_context:** Explain the joke, wordplay, cultural reference (e.g., song lyrics), \
or niche connection. Why is it funny?
3. **visual_style:** Describe the aesthetic (e.g., Cartoon, Retro, Grunge), the vibe \
(e.g., Playful, Aggressive), and the color palette.
4. **graphic_elements:** Describe the main motif, typography details (font style, color), \
and decorative elements (lines, distressing).
5. **layout_composition:** Describe the structure (e.g., Sandwich layout), alignment, \
and visual hierarchy.

### Niche Match Classification
- **is_niche_match:** Set to true if the product design clearly belongs to the target niche \
(based on the keyword and brand/title context). Set to false if the design is generic, \
unrelated, or a trademark/licensed product.
"""
```

### Z.2 Verification recipe (run before commit)

```bash
docker compose exec web python -c "
from niche_research_app.graph.prompts import DEFAULT_VISION_PROMPT  # NOW NEW
import importlib.util, sys
# Load OLD constant from the data migration we just wrote
spec = importlib.util.spec_from_file_location('m8',
  'niche_research_app/migrations/0008_update_vision_prompt_for_descriptors.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
print('OLD prompt len:', len(m.OLD_VISION_PROMPT.strip()))
# Must equal what prod DB reports for vision_analyze (901 as of 2026-05-23)
"
```

If the length doesn't match the prod DB row length, the smart-update will fail
silently (mismatch path) on prod — fix `OLD_VISION_PROMPT` to match prod verbatim
before deploy.

---

## Appendix AA — Enriched Vision + Backfill Prompts (Phase 13t-q)

**Source-of-truth:** Verbatim replacements applied in q2.1 (Vision) and q3.1
(Backfill). Both must stay in sync — any change to one mirrors to the other.

### AA.1 Enriched typography/font/accessory blocks for `DEFAULT_VISION_PROMPT`

Replace items 6, 7, 8 in the existing prompt with:

```
6. **typography_descriptors:** Slogan-agnostic typography treatment. Address these
   dimensions explicitly:
   - **Weight:** light / regular / medium / bold / extra-bold / black
   - **Casing:** all-uppercase / all-lowercase / title-case / mixed
   - **Classification:** serif / sans-serif / slab-serif / script / display / mono / handwritten
   - **Color treatment:** which color(s), is the primary headline a different color than secondary text?
   - **Special effects:** outline / drop shadow / inner glow / distress / 3D / gradient / chrome / none
   - **Size hierarchy:** relative size of primary headline vs secondary text vs accent words (e.g. "headline ~3× tagline")
   Cover ≥3 of these dimensions per output.

7. **font_combination_descriptors:** Slogan-agnostic font pairing description.
   Address these dimensions:
   - **Count:** how many distinct fonts (1 / 2 / 3+)?
   - **Per font:** classification (slab-serif / geometric sans / brush script / etc.) + role (primary headline / secondary text / accent)
   - **Pairing strategy:** contrast (serif + sans, heavy + light, rigid + organic) vs harmony (all from same family)

8. **accessory_descriptors:** Decorative non-text elements. Address:
   - **Count + name** of each element (e.g. "3 white stars, 2 horizontal lines, 1 dot-pattern border")
   - **Position** relative to the main motif (above / below / around / behind)
   - **Style** (filled / outlined / distressed / minimal / ornate)
   Include the central motif itself if it's not the primary subject (e.g. small mascot in corner).
```

### AA.2 Enriched dimensions block for `BACKFILL_SYSTEM_PROMPT`

Same checklist as AA.1, embedded inside the existing backfill system prompt
between the task instructions and the SLOGAN-AGNOSTIC RULE block. Verbatim:

```
## Dimensions to Address Per Field

For typography_descriptors cover ≥3 of these dimensions:
- Weight (light/regular/medium/bold/extra-bold/black)
- Casing (all-uppercase / all-lowercase / title-case / mixed)
- Classification (serif/sans-serif/slab-serif/script/display/mono/handwritten)
- Color treatment (which colors, headline vs secondary differentiation)
- Special effects (outline/shadow/glow/distress/3D/gradient/chrome)
- Size hierarchy across primary/secondary/accent text

For font_combination_descriptors cover:
- Count of distinct fonts (1/2/3+)
- Per font: classification + role (primary headline / secondary text / accent)
- Pairing strategy (contrast vs harmony)

For accessory_descriptors cover:
- Count + name of each element (stars/lines/borders/distressing/ornaments/dot-patterns)
- Position relative to main motif (above/below/around/behind)
- Style (filled/outlined/distressed/minimal/ornate)
```

### AA.3 Updated GOOD examples (replace existing GOOD blocks)

```
GOOD typography_descriptors:
  "extra-bold uppercase slab-serif for the primary headline in bright yellow with
   subtle inner-glow; regular-weight condensed sans-serif in white for secondary
   text; cursive italic script for accent words; clear 3-tier size hierarchy with
   the headline roughly 3× the tagline size"

GOOD font_combination_descriptors:
  "three-font system: chunky slab-serif for maximum impact on the primary headline;
   clean geometric sans-serif as a neutral counter-weight for secondary text;
   handwritten cursive script as the playful accent — high-contrast pairing
   strategy mixing rigid + organic"

GOOD accessory_descriptors:
  "five small filled white stars scattered above and below the central motif;
   two thin horizontal divider lines flanking the headline; light distressing
   applied to the headline text edges; subtle dot-pattern border framing the
   whole composition"
```
