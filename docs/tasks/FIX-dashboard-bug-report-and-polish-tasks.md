# Tasks: FIX-dashboard-bug-report-and-polish

**Spec:** [features/FIX-dashboard-bug-report-and-polish.md](../../features/FIX-dashboard-bug-report-and-polish.md)
**Branch:** `fix/dashboard-bug-report-and-polish` (off main)
**Merge strategy:** `--merge`

> **Implementation rule** per `feedback_phase_by_phase_skill_invocation`: each Phase is invoked as one `/backend` or `/frontend` skill call with a HARD SCOPE LOCK and a "do NOT commit" instruction. The orchestrator commits after reviewing the diff. Skills MUST read `.claude/rules/` and flip the AC/EC checkboxes on the spec file as they go (per `feedback_skills_must_follow_rules`).

> **Phase ordering rationale**: Phase 1 (Vane fork) kicks off first because the GHCR cold-build takes ~20 min — other phases run in parallel while it bakes. Phase 5 (`useIsSuperuser`) is a prerequisite for Phase 6 (Feedback Modal widget gating). Phase 7 (Settings consolidation) is self-contained. Phases 10–11 (chat polish) come last because they touch the same files as the in-flight PR #101.

---

## Phase 0 — Setup

- [ ] T0.1: Confirm PR #101 status with user before starting (`fix/chat-focus-border-and-tool-timeout`). If still open, decide: rebase this branch on PR #101's branch OR wait for #101 to merge first to avoid conflict in `niche_chat_agent.py` and `ChatInputBar/index.tsx`.
- [ ] T0.2: `git checkout main && git pull --ff-only && git checkout -b fix/dashboard-bug-report-and-polish` (per `feedback_post_merge_branching`).
- [ ] T0.3: Read `.claude/rules/general.md`, `frontend.md`, `backend.md`, `security.md` before any code change. Each implementation skill MUST restate this.

---

## Phase 1 — Item 8: Vane fork persistent timeout patch *(cross-repo, START FIRST)*

Skill: manual + Bash. NOT a /backend or /frontend phase (separate repo).

- [x] T1.1: Clone `MarioWinter/Vane` fork locally (or use existing checkout). Switch to `merch-miner-patches` branch, pull latest.
- [x] T1.2: `grep -rn 'setTimeout.*abort.*10000' src/` to locate the SearXNG-fetch timeout source. Likely candidates: `src/lib/searxng.ts`, `src/lib/search.ts`, or similar. Note exact file:line.
- [x] T1.3: Change literal `10000` → `120000`. Add inline comment: `// 120s SearXNG fetch budget — Brave SPA via ScraperOps render_js=true can take 30-60s. See merch-miner/features/FIX-chat-vane-bigfix.md Item 5 + FIX-dashboard-bug-report-and-polish.md Item 8.`
- [x] T1.4: Commit + push to `merch-miner-patches`. GHA Docker Publish workflow auto-triggers (~20min cold / ~5min warm).
- [x] T1.5: Wait for GHCR build green. Image `ghcr.io/mariowinter/vane:merch-miner` updated.
- [x] T1.6: On server: `ssh root@212.132.102.96 'cd /srv/local-ai-packaged && docker compose pull vane && docker compose up -d --no-deps --force-recreate vane && sleep 12 && docker exec vane grep -c "abort(),12e4" /home/vane/.next/server/chunks/641.js'` — expect output `1`.
- [x] T1.7: Live verify in chat that a slow query (intentional complex multi-query) doesn't trigger the 10s abort anymore — full response within 90s tool-timeout.
- [x] T1.8: Update memory file `project_searxng_engine_config.md` — add "2026-05-31 update — Vane fork timeout patched in TS source" subsection, retire the in-container `sed` patch from the runbook.
- [x] T1.9: Update memory file `project_vane_custom_build.md` — record the patch commit SHA in the fork.
- [x] T1.10: Flip AC-8-1 through AC-8-7 in the spec to `[x]`. Flip EC-8-1 through EC-8-3 to `[x]` (documented, not retest-verified).

---

## Phase 2 — Item 2: DrawerLayoutToggle z-index fix *(quick win, 5min)*

Skill: `/frontend` with hard scope lock to ONLY `DrawerLayoutToggle.tsx`.

- [x] T2.1: Read `frontend-ui/src/components/MultiPurposeDrawer/DrawerLayoutToggle.tsx` to confirm the styled-button definition.
- [x] T2.2: Add `zIndex: theme.zIndex.drawer + 2` to the styled-button block (via the `theme` callback). NO hardcoded numeric value.
- [x] T2.3: Restart Vite dev OR rely on TS check; visual-verify in dev that the chevron-button no longer gets clipped by drawer tab-strip.
- [x] T2.4: `npm run lint && npx tsc --noEmit && npm run test -- --run` — zero failures.
- [x] T2.5: Update existing test if it asserts no `zIndex` was set; otherwise no new test (1-line CSS fix doesn't warrant a unit test).
- [x] T2.6: Flip AC-2-1 through AC-2-4 to `[x]`. Mark AC-2-3 as "to verify after prod deploy".

---

## Phase 3 — Item 5: `useIsSuperuser()` hook + VersionBadge gating

Skill: `/frontend` with hard scope lock to: NEW `hooks/useIsSuperuser.ts` + EDIT `components/sidebar/VersionBadge.tsx` + unit tests.

- [x] T3.1: Create `frontend-ui/src/hooks/useIsSuperuser.ts` — thin wrapper that reads `state.auth.user.is_superuser` via `useAppSelector`. Returns `boolean` (default `false` when user not loaded). Add JSDoc with single-source-of-truth comment.
- [x] T3.2: Create `frontend-ui/src/hooks/__tests__/useIsSuperuser.test.tsx` — tests: (a) returns `true` when superuser, (b) returns `false` when not, (c) returns `false` when auth.user is null/loading.
- [x] T3.3: Read `frontend-ui/src/components/sidebar/VersionBadge.tsx` to understand current shape.
- [x] T3.4: Refactor VersionBadge: import `useIsSuperuser`. When `false`, render `<Chip>` (no onClick, cursor default, no hover). When `true`, render existing IconButton + Dialog logic unchanged.
- [x] T3.5: Update VersionBadge test: add cases for both branches (superuser sees link, non-superuser sees plain chip).
- [x] T3.6: `npm run lint && npx tsc --noEmit && npm run test -- --run`.
- [x] T3.7: Flip AC-5-1 through AC-5-5 to `[x]`. Flip EC-5-1 through EC-5-3 to `[x]`.

---

## Phase 4 — Item 1 backend: BugFeatureReport model + API + email job

Skill: `/backend` with hard scope lock to NEW `feedback_app/` ONLY.

- [x] T4.1: Create new Django app `feedback_app/`. Add to `INSTALLED_APPS` in `core/settings.py`. Add `feedback_app.api.urls` include in `core/urls.py`.
- [x] T4.2: Models per spec:
  - `BugFeatureReport` (id uuid pk, workspace FK CASCADE, user FK SET_NULL, type choices, title CharField(200), description TextField, screenshot FK nullable, status choices default 'new', admin_notes TextField blank, created_at).
  - `FeedbackScreenshot` (id uuid, image ImageField upload_to='feedback/screenshots/', uploaded_by FK User, uploaded_at).
- [x] T4.3: Migration `0001_initial.py` — additive only. Indexes on `(workspace, created_at)` and `(status, created_at)`.
- [x] T4.4: Serializers: `BugFeatureReportSerializer` (read-only fields for status+admin_notes+id+created_at; write fields type, title, description, screenshot_id). `FeedbackScreenshotSerializer`. Validation: title ≤200, description ≤4000, image mime in (png/jpeg/webp), image size ≤5MB.
- [x] T4.5: Views:
  - `ReportViewSet` (DRF ModelViewSet, `IsAuthenticated`).
    - `list`: filter by `workspace_id` from header. Non-superusers see only their workspace's reports.
    - `create`: enforce same workspace as session. Calls `tasks.send_feedback_email.delay(report_id)` after save.
    - `partial_update` (PATCH): only allowed for superusers; updates `status` + `admin_notes`.
    - `retrieve` / others as needed.
  - `ScreenshotUploadView` (APIView POST): handles multipart, returns id.
- [x] T4.6: DRF throttle: register scope `feedback_create=10/min`. Apply to POST endpoints only (GET list is fine at default rate).
- [x] T4.7: `tasks.py: send_feedback_email(report_id)` — fetches the report, builds plain-text email (subject `[Merch Miner Feedback] <type>: <title>`, body with user/workspace info + admin URL), sends via `django.core.mail.send_mail`. Recipient = env `FEEDBACK_RECIPIENT_EMAIL` (default `mariowinter.sg@gmail.com`). On failure: log warning, raise to let django-rq retry (max 3 attempts).
- [x] T4.8: Django admin registration for both models (list_display: type, title, status, workspace, user, created_at; search_fields: title, description; list_filter: type, status).
- [x] T4.9: Tests:
  - `test_models.py`: workspace cascade on workspace delete; user SET_NULL on user delete.
  - `test_api.py`: POST creates row + enqueues job; cross-workspace read denial; superuser sees all; PATCH gated on superuser; 5MB+ screenshot rejected; non-image rejected; rate limit triggers 429.
  - `test_email_job.py`: email build correctness + retry on SMTP failure (mock `send_mail`).
- [x] T4.10: Add `FEEDBACK_RECIPIENT_EMAIL` to `django-app/.env.template` with `mariowinter.sg@gmail.com` placeholder.
- [x] T4.11: `docker compose exec web python manage.py migrate feedback_app` + run pytest.
- [x] T4.12: Flip AC-1-5 through AC-1-10 + EC-1-1 through EC-1-7 to `[x]` (frontend ACs come in Phase 5).

---

## Phase 5 — Item 1 frontend: FeedbackReportModal + topbar button

Skill: `/frontend` with hard scope lock. Depends on Phase 4 API + Phase 3 `useIsSuperuser` hook.

- [x] T5.1: Locate existing topbar component file (`grep -n 'topbar-open-chat' frontend-ui/src/`) and identify where to insert the new icon-button (between notifications-bell e31 + profile-icon e35 per snapshot).
- [x] T5.2: Create `components/FeedbackReportButton.tsx` — IconButton with `Feedback` or `BugReport` icon, Tooltip, click handler that dispatches `setFeedbackModalOpen(true)` or local state.
- [x] T5.3: Create `components/FeedbackReportModal/` directory:
  - `index.tsx` — MUI Dialog wrapper, controlled open state, escape/backdrop close with confirm-discard.
  - `partials/FeedbackForm.tsx` — react-hook-form with zod schema. Fields: type (radio), title (TextField with chars-remaining helper), description (multiline TextField), screenshot upload.
  - `partials/ScreenshotUpload.tsx` — file input with size + mime client-side validation, preview thumbnail, remove button.
  - `schemas/feedbackReportSchema.ts` — zod schema (type required, title 1-200, description 1-4000).
  - `hooks/useFeedbackReport.ts` — useForm + RTK Query mutation hook.
  - `__tests__/FeedbackReportModal.test.tsx` — covers happy path, validation errors, screenshot upload, screenshot rejected (oversize / wrong mime), backdrop-close confirm dialog.
- [x] T5.4: Add `store/feedbackSlice.ts` — RTK Query endpoints for `createReport`, `uploadScreenshot`. Use existing axios setup pattern.
- [x] T5.5: Add i18n keys under `feedback.*` in `de.json` + `en.json` (modal title, form labels, button text, snackbar messages, validation errors).
- [x] T5.6: Wire FeedbackReportButton into the topbar component identified in T5.1. Verify position is correct visually (between e31 + e35).
- [x] T5.7: Snackbar (notistack) on success/error per AC-1-4.
- [x] T5.8: `npm run lint && npx tsc --noEmit && npm run test -- --run`.
- [x] T5.9: Flip AC-1-1 through AC-1-4, AC-1-11 through AC-1-14 to `[x]`.

---

## Phase 6 — Item 6: Settings consolidation

Skill: `/frontend` with hard scope lock to SettingsLayout + sub-section component touches + App.tsx routes.

- [x] T6.1: Read `frontend-ui/src/views/settings/SettingsLayout.tsx` + 4 sections (ProfileSection, BillingSection, WorkspaceSection, UsageSection) to confirm they render independently with no Outlet-coupling.
- [x] T6.2: Investigate BillingSection state (per EC-6-1): is it placeholder or real Polar.sh stub? Decide whether to keep visible with "Coming soon" message or hide via feature-flag. Document decision inline.
- [ ] T6.3: Refactor `SettingsLayout.tsx`:
  - Drop `<Outlet />` + tab-strip.
  - Render `<ProfileSection />` `<BillingSection />` `<WorkspaceSection />` `<UsageSection />` in order, each wrapped in a `<section id="profile|billing|workspace|usage">` with sticky h2 heading + 1-line description.
  - Smooth-scroll behavior via CSS `scroll-behavior: smooth` on the scroll container, with `scroll-margin-top` to clear sticky topbar.
- [x] T6.4: Create `views/settings/partials/SettingsAnchorNav.tsx` — vertical list of 4 anchor links. IntersectionObserver tracks active section; the active link gets a highlighted style.
- [x] T6.5: Create `views/settings/partials/SettingsMobileAccordion.tsx` — collapsed accordion variant of SettingsAnchorNav for viewport <768px (use MUI useMediaQuery + theme breakpoints).
- [x] T6.6: Update `App.tsx` settings routes:
  - `/settings` → renders `SettingsLayout` (now all-in-one page) directly (no Outlet).
  - `/settings/profile`, `/settings/billing`, `/settings/workspace`, `/settings/usage` → each redirects via `<Navigate to="/settings#<id>" replace />`.
- [x] T6.7: Tests:
  - Existing per-section tests still pass.
  - New test for SettingsLayout: all 4 sections render; anchor nav present on desktop, accordion on mobile.
  - Redirect test for old sub-routes.
- [x] T6.8: Update Title via React Helmet or document.title pattern (whatever the project uses): "Einstellungen — Merch Miner".
- [x] T6.9: `npm run lint && npx tsc --noEmit && npm run test -- --run`.
- [x] T6.10: Flip AC-6-1 through AC-6-8 + EC-6-1 through EC-6-4 to `[x]`.

---

## Phase 7 — Item 3 backend + frontend: Roadmap widget

Skill: `/backend` then `/frontend`, separately invoked.

### Phase 7a — Backend
- [ ] T7.1: Create `docs/roadmap_user_facing.md` with seed content (3-5 items Mario chooses). Front-matter parsed by `pyyaml`.
- [ ] T7.2: Create `dashboard_app/services/roadmap_loader.py` — reads + parses the markdown file. Returns list of dicts. Handles missing file / malformed YAML gracefully (returns empty list + logs warning).
- [ ] T7.3: Add `dashboard_app/api/views.py::RoadmapView` (APIView GET). `IsAuthenticated`. Returns parsed list + last-mtime caption.
- [ ] T7.4: Tests: `test_roadmap_loader.py` — happy path, malformed file, missing file, item without optional `priority`.
- [ ] T7.5: Register URL pattern in `dashboard_app/api/urls.py`.
- [ ] T7.6: Manual verify in Django shell.

### Phase 7b — Frontend
- [ ] T7.7: Create `views/dashboard/partials/RoadmapWidget/`:
  - `index.tsx` — MUI Card with title + 1-line caption + List of items.
  - `hooks/useRoadmap.ts` — RTK Query endpoint for `/api/dashboard/roadmap/`.
  - `__tests__/RoadmapWidget.test.tsx` — loading / data / empty states.
- [ ] T7.8: Mount RoadmapWidget in the existing Dashboard view layout. Decide grid position together with Phase 8 ChangelogWidget for visual balance.
- [ ] T7.9: i18n keys under `dashboard.roadmap.*`.
- [ ] T7.10: Flip AC-3-1 through AC-3-8 + EC-3-1 through EC-3-3 to `[x]`.

---

## Phase 8 — Item 4 backend + frontend: Changelog widget (LLM-translated)

Skill: `/backend` then `/frontend`, separately invoked.

### Phase 8a — Backend
- [ ] T8.1: Create `dashboard_app/services/changelog_translator.py`:
  - Reads `CHANGELOG.md` (relative to BASE_DIR), extracts top-3 version sections via regex.
  - For each version, batch-calls `niche_research_app.graph.llm.invoke()` with a prompt that asks for ≤2-sentence German user-benefit copy per commit, returns as a list.
  - Redis-cache results keyed by `changelog_user:v<latest-tag>` with 6h TTL (use Django cache backend already on Redis).
  - Returns shape: `[{version, date, items: ["bullet1", "bullet2", …]}]`.
  - Robust error path: LLM failure → fallback `[{version, date, items: ["Verbesserungen in dieser Version"]}]`. Logs warning.
- [ ] T8.2: Add `dashboard_app/api/views.py::ChangelogView` (APIView GET). `IsAuthenticated`. Calls the translator service.
- [ ] T8.3: Add env var `CHANGELOG_TRANSLATE_MODEL` to `core/settings.py` + `.env.template` (default `openai/gpt-4o-mini`).
- [ ] T8.4: Tests: `test_changelog_translator.py` — mocks LLM, asserts top-3 versions selected, cache key shape, fallback on LLM error, language-detect retry.
- [ ] T8.5: Register URL in `dashboard_app/api/urls.py`.

### Phase 8b — Frontend
- [ ] T8.6: Create `views/dashboard/partials/ChangelogWidget/`:
  - `index.tsx` — MUI Card with title + versioned sections + bullet lists.
  - `hooks/useChangelog.ts` — RTK Query endpoint for `/api/dashboard/changelog/`.
  - `__tests__/ChangelogWidget.test.tsx`.
- [ ] T8.7: Mount in Dashboard view next to RoadmapWidget.
- [ ] T8.8: i18n keys under `dashboard.changelog.*`.
- [ ] T8.9: Flip AC-4-1 through AC-4-7 + EC-4-1 through EC-4-6 to `[x]`.

---

## Phase 9 — Item 9: Speed-mode bypass UI dropdown

Skill: `/frontend` (primary) + `/backend` mini-edit (niche-agent test update).

- [ ] T9.1: Re-add `chatBarSlice.searchMode: 'speed' | 'balanced' | 'quality'` slot (was removed per PROJ-20 spec). Default `'speed'`. Add reducer `setSearchMode`. Persist via existing localStorage middleware keyed `${workspaceId}:chat-search-mode`.
- [ ] T9.2: Create `components/MultiPurposeDrawer/panels/ChatInputBar/partials/SearchDepthPicker.tsx` — IconButton + Popover + 3 radio options with cost-per-chat hints per spec AC-9-2. Tooltip text per AC-9-7. Badge when non-default (Sources-button pattern).
- [ ] T9.3: Wire SearchDepthPicker into ChatInputBar's right cluster (between Model-Picker + Attachment).
- [ ] T9.4: Update `useSendMessageStream.ts` to read `chatBarSlice.searchMode` and append `&optimization_mode=<mode>` to stream URL (GET) and include in body (POST).
- [ ] T9.5: Cost-warning snackbar shown ONCE on first switch away from speed per session (use `useRef` + localStorage flag `seen-cost-warning`).
- [ ] T9.6: Backend `niche_chat_agent.py:web_search` — remove hardcoded `mode='speed'`; read from per-message param via the existing `model_override` plumbing OR add a new `search_mode` parameter to the tool's closure context. Document in code.
- [ ] T9.7: Update existing test `test_calls_vane_with_speed_mode_for_cost_control` in `test_niche_chat_agent.py` to either assert speed-default OR assert mode-pass-through (whichever T9.6 implements).
- [ ] T9.8: Add unit test for SearchDepthPicker: 3 options selectable, state persists, badge shows when non-default.
- [ ] T9.9: i18n keys under `chatBar.searchDepth.*`.
- [ ] T9.10: `npm run lint && npx tsc --noEmit && npm run test -- --run` + backend `pytest agent_app/tests/test_niche_chat_agent.py`.
- [ ] T9.11: Flip AC-9-1 through AC-9-8 + EC-9-1 through EC-9-3 to `[x]`.

---

## Phase 10 — Item 7: Chat stage-UX downgrade polish

Skill: `/frontend` with hard scope lock to `chatBarSlice` + unit tests.

- [ ] T10.1: Locate `chatBarSlice.ts` `done` reducer (or wherever the stream-done action is handled).
- [ ] T10.2: Add downgrade logic: scan current `thinking_stages`; for each stage with `status === 'warning'` AND `reason.startsWith('tool_timeout')` AND `final_answer.length > 200`: set status `'info'`, rewrite message to i18n key `chatBar.stages.timeoutDowngradedMessage`.
- [ ] T10.3: Ensure the rewritten stages are PERSISTED in the action payload that the backend reads back on session reload (verify `thinking_stages` JSON is overwritten on session save).
- [ ] T10.4: Unit tests:
  - Warning + substantive answer (>200 chars) → downgraded.
  - Warning + tiny answer (≤200 chars) → stays warning.
  - No warning → no change.
  - Multiple warning stages → all downgraded together.
- [ ] T10.5: Add i18n keys `chatBar.stages.timeoutDowngradedMessage` in de/en.
- [ ] T10.6: `npm run lint && npx tsc --noEmit && npm run test -- --run`.
- [ ] T10.7: Flip AC-7-1 through AC-7-6 + EC-7-1 through EC-7-3 to `[x]`.

---

## Phase 11 — QA + final verification

Skill: `/qa`.

- [ ] T11.1: Read latest spec (`features/FIX-dashboard-bug-report-and-polish.md`). Re-verify EVERY AC + EC checkbox by running the relevant assertion on the latest code (frontend + backend tests, manual Playwright on dev).
- [ ] T11.2: Security audit checklist:
  - Workspace isolation on `/api/feedback/reports/` list endpoint (cross-workspace cannot read).
  - Superuser-only PATCH on report status/admin_notes.
  - Screenshot upload size + mime validated server-side (NOT just client-side).
  - Rate-limit on POST `/api/feedback/reports/` triggers 429.
  - No raw HTML/script escapes into the email body.
- [ ] T11.3: Playwright on dev environment: submit a bug report end-to-end. Verify report row appears in admin. Verify email job ran (check django-rq dashboard).
- [ ] T11.4: Playwright on dev: open chat, switch search-depth to "Tief", verify backend logs reflect `optimization_mode=quality`. Switch back to Speed.
- [ ] T11.5: Playwright on dev: as non-superuser → version-pill is non-clickable. Switch to superuser → pill is clickable with full changelog.
- [ ] T11.6: Playwright on dev: navigate to `/settings`, scroll through all 4 sections, anchor nav highlights active section. Old `/settings/billing` redirects to `/settings#billing`.
- [ ] T11.7: Visual verify on dev: DrawerLayoutToggle no longer clipped by drawer tab-strip.
- [ ] T11.8: Visual verify on dev: chat-streaming border (existing PR #101 fix) NOT covered by red focus border (assuming PR #101 is merged before this).
- [ ] T11.9: Add QA section to spec file with results table (pass / fail per Item).
- [ ] T11.10: Status flip `features/INDEX.md` from `Planned` → `In Review` once QA pass.

---

## Phase 12 — Open PR + deploy

- [ ] T12.1: Confirm all branch commits land in expected order (1 commit per Phase per `feedback_phase_by_phase_skill_invocation`).
- [ ] T12.2: `git push -u origin fix/dashboard-bug-report-and-polish`.
- [ ] T12.3: `gh pr create --title "fix(dashboard): bug-report modal + widgets + settings consolidation + chat polish (9 items)" --body "$(cat features/FIX-dashboard-bug-report-and-polish.md | head -60)"`. Reference all 9 items + cross-repo Item 8 fork-PR url.
- [ ] T12.4: Wait for CI green.
- [ ] T12.5: `gh pr merge --merge --delete-branch` (preserve commits for release-please).
- [ ] T12.6: Monitor deploy chain (CI → Docker Publish → Deploy).
- [ ] T12.7: Live verify on prod after deploy: smoke test from Phase 11 list run again on prod URL.
- [ ] T12.8: Status flip `features/INDEX.md` → `Deployed`.

---

## Phase summary table

| Phase | Item | Skill | Files touched (rough) | LOC est. |
|---|---|---|---|---|
| 1 | 8 — Vane fork patch | manual + Bash | 1 file in fork | 5 |
| 2 | 2 — z-index | `/frontend` | 1 file | 3 |
| 3 | 5 — useIsSuperuser hook + VersionBadge | `/frontend` | 2 new + 2 edit + tests | 80 |
| 4 | 1 backend | `/backend` | new app, ~10 files | 350 |
| 5 | 1 frontend | `/frontend` | new component dir, ~10 files | 250 |
| 6 | 6 — settings consolidation | `/frontend` | 3 new + 4 edit + tests | 200 |
| 7a/b | 3 — roadmap widget | `/backend` + `/frontend` | 1 new file + 1 service + 1 widget | 150 |
| 8a/b | 4 — changelog widget | `/backend` + `/frontend` | 1 service + 1 widget + LLM call | 200 |
| 9 | 9 — speed-mode bypass | `/frontend` + small `/backend` | 1 new component + slice slot + 1 test update | 180 |
| 10 | 7 — stage downgrade | `/frontend` | 1 slice edit + tests | 70 |
| 11 | QA | `/qa` | spec updates | — |
| 12 | Open PR + deploy | manual | — | — |

**Total LOC estimate**: ~1500 in merch-miner + ~5 in MarioWinter/Vane fork.

## Reminders for implementation skills

- Each skill invocation MUST start by reading `.claude/rules/general.md`, `frontend.md`, `backend.md`, `security.md`.
- Each skill MUST flip the corresponding AC/EC checkboxes in the spec file as it completes work.
- NO commits inside skills — the orchestrator commits after diff review.
- HARD SCOPE LOCK in every delegation prompt: name the exact files allowed to be touched.
- English content per `feedback_english_only_files`.
- No hardcoded colors / strings: use theme tokens + i18n.
- MUI v7 patterns only (no `Grid item`, no `InputProps`, no `@mui/lab`).
- Per memory `feedback_component_reuse_first`: grep before creating new components.
