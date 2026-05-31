# FIX: Dashboard Widgets + Bug-Report Modal + Settings Merge + Polish

## Status: Planned
**Created:** 2026-05-31
**Last Updated:** 2026-05-31
**Type:** Mixed Bundle (1 new feature + 2 dashboard widgets + 1 settings consolidation + 4 polish/infra items). One PR, plus one cross-repo commit in `MarioWinter/Vane` fork for Item 8.
**Branch:** `fix/dashboard-bug-report-and-polish` (off main)
**Merge Strategy:** `--merge` (preserve individual conventional commits for release-please)

## Dependencies
- PROJ-1 (User Auth) — Deployed. `User.is_superuser` flag used as admin-gate for Items 1+5.
- PROJ-4 (Workspace & Membership) — Deployed. Bug-Report Modal persists `workspace_id` for context.
- PROJ-12 (Dashboard & Analytics) — In Review. Items 3+4 add panels to the existing Dashboard view.
- PROJ-20 (Chat UX Perplexity-Parity) — In Review. Item 9 reintroduces `chatBarSlice.searchMode` slot that was removed per PROJ-20 AC.
- FIX-chat-vane-bigfix — Deployed. Item 7 polishes the `tool_timeout` warning display added by it. Item 8 makes the in-container Vane timeout patch persistent across image rebuilds.

## Scope Summary

| # | Area | Type | Commit prefix |
|---|---|---|---|
| 1 | Topbar Bug/Feature Report Modal + Backend persistence + Email | Feature | `feat(feedback):` |
| 2 | DrawerLayoutToggle z-index fix — button no longer clipped by drawer tab-strip | Bug | `fix(drawer):` |
| 3 | Dashboard widget — upcoming-features roadmap (user-friendly) | Feature | `feat(dashboard):` |
| 4 | Dashboard widget — recent-changes changelog (LLM-translated to user-benefit copy) | Feature | `feat(dashboard):` |
| 5 | Version-info button: changelog link only for superusers, badge-only for others | Polish | `fix(ui):` |
| 6 | Settings consolidation — all 4 sections (profile/billing/workspace/usage) on ONE scrollable page | Refactor | `refactor(settings):` |
| 7 | Chat stage-UX — downgrade `tool_timeout` warning to info when LLM still produced a substantive answer | Polish | `fix(chat):` |
| 8 | Vane fork persistent timeout patch (10s → 120s) — cross-repo `MarioWinter/Vane` PR + GHCR rebuild | Infra | `fix(vane):` *(in fork repo)* |
| 9 | Speed-mode bypass knob — UI dropdown "Suchtiefe: Speed / Balanced / Quality" in chat input bar | Feature | `feat(chat):` |

**Estimated LOC:** ~700 across merch-miner + ~5 in MarioWinter/Vane fork.

---

## Item 1 — Topbar Bug/Feature Report Modal

### Context
There is no in-app channel for users to send Mario bug reports or feature requests. Today they must DM via external channels. A single click-through path inside the app would lower the friction massively and let Mario triage in a single dashboard widget.

### User Stories
- As a POD seller, I want to report a bug from inside the app so I don't have to leave my workflow to send a separate email.
- As a POD seller, I want to suggest a feature so my idea reaches the team without me having to know GitHub.
- As Mario (sole superuser today), I want every report to land in BOTH my inbox AND a dashboard widget so I can triage on-the-go OR systematically.

### Acceptance Criteria
- [x] AC-1-1: Topbar shows a new icon button positioned **between the notifications-bell (Glocke) and the profile-icon (Profil)**, right side. MUI Tooltip on hover reads `feedback.topbar.tooltip` ("Bug melden oder Feature vorschlagen" / "Report a bug or suggest a feature").
- [x] AC-1-2: Icon is `@mui/icons-material/Feedback` or `BugReport` (final pick during /frontend-design). Same IconButton sx as sibling topbar icons for visual consistency.
- [x] AC-1-3: Click opens an MUI `Dialog` modal centered, max-width 480px, with form fields:
  - Type — radio group (Bug | Feature)
  - Title — `TextField` required, max 200 chars, helper-text shows remaining chars
  - Description — `TextField multiline rows=6` required, max 4000 chars
  - Screenshot (optional) — file input accepting `image/png, image/jpeg, image/webp`, max 5 MB
- [x] AC-1-4: Submit button disabled until type + title + description present and within limits. Submitting shows progress + disables form. Success → snackbar "Danke! Dein Hinweis ist angekommen." (via notistack), modal closes. Error → snackbar "Konnte Hinweis nicht senden — bitte später nochmal probieren." (notistack error variant), modal stays open with fields intact.
- [x] AC-1-5: Backend POST `/api/feedback/reports/` accepts JSON `{type, title, description, screenshot_id?}` (screenshot uploaded via separate POST `/api/feedback/screenshots/` returns id). Workspace + user inferred from `X-Workspace-Id` header + JWT, NOT submitted by client.
- [x] AC-1-6: New Django model `BugFeatureReport` with fields: `id (uuid pk)`, `workspace (FK)`, `user (FK)`, `type (choices=bug|feature)`, `title (200)`, `description (text)`, `screenshot (FK to FileField or inline ImageField)`, `created_at (auto)`, `status (choices=new|triaged|in_progress|done|wontfix, default=new)`, `admin_notes (text blank)`.
- [x] AC-1-7: On report creation, Django triggers an async django-rq job `send_feedback_email` that sends an email to `DEFAULT_FROM_EMAIL` recipient (initially Mario only; configurable via env `FEEDBACK_RECIPIENT_EMAIL`) with subject `[Merch Miner Feedback] <type>: <title>`, body containing description + user/workspace info + admin URL link to the report row.
- [x] AC-1-8: Email send failure does NOT block the API response — the report row is saved either way. Failed email retried via django-rq retry semantics (max 3 attempts).
- [x] AC-1-9: Screenshot stored under media path `feedback/screenshots/<uuid>.<ext>` with same access control as existing media (workspace-scoped read; only the uploading user + superusers can fetch).
- [x] AC-1-10: Workspace-isolation enforced at ORM level — listing reports filters by `workspace_id=request.workspace.id`. Only superusers see ALL workspaces.
- [x] AC-1-11: Frontend Modal component lives at `frontend-ui/src/components/FeedbackReportModal/` (reusable shape per memory `feedback_component_reuse_first` — could be opened from other surfaces later).
- [x] AC-1-12: Modal closes via "Schließen" button OR Escape OR backdrop click. Backdrop click with unsaved input shows a confirm dialog "Wirklich verwerfen?" before discarding.
- [x] AC-1-13: Form respects `prefers-reduced-motion`: no entrance animation when set.
- [x] AC-1-14: i18n: all UI strings via `useTranslation()` namespace `feedback.*`. German + English translations included.

### Edge Cases
- [x] EC-1-1: User submits without workspace selected (edge of multi-workspace user) → backend returns 400 "workspace_id missing"; frontend shows snackbar prompting user to select a workspace.
- [x] EC-1-2: User uploads non-image screenshot (e.g. PDF) → frontend filter rejects before submit + shows error helper-text on the upload field.
- [x] EC-1-3: Screenshot >5 MB → frontend shows "Maximum 5 MB" error; submit disabled until removed.
- [x] EC-1-4: SMTP unavailable (EMAIL_HOST_PASSWORD unset / blocked) → job-handler logs warning, retries 3x, gives up gracefully. Report row already persisted so admin widget still shows it.
- [x] EC-1-5: Rate-limit anti-abuse — same user submits >10 reports in 60s → backend throttle (DRF `ScopedRateThrottle` scope `feedback_create=10/min`) returns 429.
- [x] EC-1-6: User on `is_active=False` (account suspended) hits POST → 401 from `IsAuthenticated`. No report row created. (No special handling needed; existing auth guard covers this.)
- [x] EC-1-7: Title or description contains HTML/script — backend uses standard DRF serializer escaping; email body sends as plain text (`send_mail` default). No XSS path.

---

## Item 2 — DrawerLayoutToggle z-index fix

### Context
On Desktop the `DrawerLayoutToggle` (chevron circle button that switches drawer between `overlap` and `sideBySide`) gets visually clipped by the drawer's tab-strip (`Niche / Chat` tabs) which sits above it in stacking order. Screenshot 2026-05-31: red toggle button is half-covered by the dark tab area.

Code site: `frontend-ui/src/components/MultiPurposeDrawer/DrawerLayoutToggle.tsx:67`.

### User Stories
- As a desktop user, I want to see the drawer layout toggle fully so I can click it to switch modes without hunting for the partially-hidden button.

### Acceptance Criteria
- [x] AC-2-1: DrawerLayoutToggle's styled button receives an explicit `zIndex` value that places it ABOVE the drawer tab-strip (the Niche/Chat tablist).
- [x] AC-2-2: The z-index is referenced from `theme.zIndex` (e.g. `theme.zIndex.drawer + 2`) NOT hardcoded numeric value — keeps it composable if MUI re-tunes drawer z.
- [ ] AC-2-3: Visual verification on prod after deploy: button fully visible from any side (Side-by-Side mode AND overlap mode).
- [x] AC-2-4: No regression in stacking against: @-mention popover, slash-command palette, model-picker dropdown, attachment-preview overlay (all should still render ABOVE the toggle button, NOT below).

### Edge Cases
- [x] EC-2-1: Mobile / tablet viewports — toggle button is already hidden by `if (!isDesktop) return null;`. No change needed for those.
- [x] EC-2-2: Drawer is closed — toggle button transitions out via `drawerOpen` Redux state. z-index irrelevant then.

---

## Item 3 — Dashboard widget: upcoming-features roadmap

### Context
Users have no in-app visibility into what's planned. Showing "what's coming" builds trust and reduces "feature requests for things already on the roadmap".

### User Stories
- As a POD seller, I want to see what features are planned so I know my workflow is going to keep improving.
- As Mario, I want a simple way to communicate the roadmap without users needing to click out to GitHub.

### Acceptance Criteria
- [x] AC-3-1: New panel on the Dashboard view titled "Geplante Features" / "Upcoming Features" (i18n).
- [x] AC-3-2: Panel renders a vertical list of 5–10 roadmap items, each showing only:
  - Title — user-friendly, e.g. "Bulk-Upload für Listings" NOT "PROJ-13 Desktop Upload App"
  - 1-line description — benefit-oriented, e.g. "Bis zu 50 Listings gleichzeitig zu MBA hochladen" NOT "Electron + Playwright runner that automates the manual MBA upload form"
- [x] AC-3-3: NO PROJ-IDs, NO tech jargon, NO links to GitHub or specs.
- [x] AC-3-4: Backend GET `/api/dashboard/roadmap/` returns the list as JSON `[{title, description, priority?}]`. Source: a CURATED file `docs/roadmap_user_facing.md` (Markdown front-matter list) that Mario edits when the roadmap changes. The file is NOT auto-derived from `features/INDEX.md` because INDEX uses tech-IDs; the user-facing copy is a separate hand-curated mirror.
- [x] AC-3-5: Panel order matches file order. Mario controls priority by reordering rows in `docs/roadmap_user_facing.md`.
- [x] AC-3-6: Panel has subtle "Letzte Aktualisierung: <date>" caption derived from the file's `git log -1 --format=%cd` of `docs/roadmap_user_facing.md` (or `mtime` fallback).
- [x] AC-3-7: Panel visible to ALL authenticated users in the workspace (no gating).
- [x] AC-3-8: Empty state — if file missing or empty, panel shows "Bald hier: unser nächster Roadmap-Eintrag" placeholder (i18n).

### Edge Cases
- [x] EC-3-1: `docs/roadmap_user_facing.md` malformed → backend returns empty list + logs warning. Panel shows empty state. No 500 to user.
- [x] EC-3-2: Roadmap list contains 20+ items → panel scrolls inside its card (max-height 320px) rather than blowing up the dashboard layout.
- [x] EC-3-3: Mario writes a description >200 chars → frontend truncates to first 200 + "…" with full text in title tooltip.

---

## Item 4 — Dashboard widget: recent-changes changelog (LLM-translated)

### Context
Users have no in-app way to learn about what's new. Today the `CHANGELOG.md` is generated by release-please from conventional commits ("feat(chat): niche-agent web_search now gets real sources via streaming (#100)") which is tech-jargon. Users won't read that. The widget translates each recent entry into user-benefit copy on-the-fly via a small LLM call so Mario doesn't have to hand-write each one.

### User Stories
- As a POD seller, I want to see what's new in the app so I know which improvements I can use right now.
- As Mario, I don't want to write user-facing release notes by hand every time; the LLM should do it.

### Acceptance Criteria
- [ ] AC-4-1: New panel on the Dashboard view titled "Was ist neu" / "What's new" (i18n).
- [x] AC-4-2: Backend GET `/api/dashboard/changelog/` reads `CHANGELOG.md` (the release-please generated file), extracts the 3 most-recent version sections, sends each commit-line to an LLM (OpenRouter, model from env `CHANGELOG_TRANSLATE_MODEL` default `openai/gpt-4o-mini` for cost), gets back user-benefit copy.
- [x] AC-4-3: LLM prompt explicitly: rewrite as ≤2 sentences in German, focus on user benefit not feature name, drop commit-shas + PR numbers + scope prefixes. Example in prompt: "feat(chat): niche-agent web_search now gets real sources via streaming (#100)" → "Chat-Suche liefert jetzt deutlich mehr und bessere Web-Quellen, ideal für tiefere Recherche."
- [x] AC-4-4: Result is CACHED for 6 hours in Redis keyed by `changelog_user:v<latest-tag>` so repeated dashboard loads don't re-bill the LLM. Cache invalidated on tag change.
- [ ] AC-4-5: Panel renders grouped by version: `v0.7.0 (vor 2 Tagen)` heading, then a bullet list of user-benefit copy. NO commit shas, NO PR numbers, NO GitHub links.
- [x] AC-4-6: Panel visible to ALL authenticated users (no gating). The technical detail link (PR numbers etc.) stays inside Item 5's superuser-only changelog popup.
- [ ] AC-4-7: Empty state — if CHANGELOG.md unavailable or LLM error, panel shows "Updates folgen in Kürze" (i18n).

### Edge Cases
- [x] EC-4-1: LLM call fails (OpenRouter down, rate-limit) → backend returns the most-recent version section title + a generic "Verbesserungen in v<x.y.z>" placeholder. Logs warning, retries next cache miss.
- [x] EC-4-2: CHANGELOG.md has 50+ versions → backend only processes top-3 versions to keep LLM cost bounded.
- [x] EC-4-3: Same release contains 20+ commits → LLM is given them all in a single batch prompt; result is a 3–5 bullet summary (not 1:1 per commit).
- [x] EC-4-4: User loads dashboard before any release exists → CHANGELOG.md missing → empty state.
- [ ] EC-4-5: LLM hallucinates English when prompted in German → cache validates with a quick language-detect (just `lang_in_first_word == 'de'`); on mismatch, retries once with stronger language directive.
- [x] EC-4-6: Cost overrun — at default frequency (cache 6h, top-3 versions, ~5 commits each = ~15 LLM lines per cache refresh × 4 refreshes per day = ~60 LLM calls/day) the cost is ~$0.003/day. Bounded by cache TTL.

---

## Item 5 — Version-info link only for superusers

### Context
Sidebar bottom shows a "v0.7.0 Beta" pill button that today opens a detailed technical changelog popup (commit shas, PR numbers, GitHub links). That popup is fine for Mario but exposes raw tech detail to end-users who don't need it (and could be confused / treat the GitHub URL as actionable). The widget from Item 4 already gives non-admin users a digestible "what's new". Item 5 hides the technical popup from non-admin users.

### User Stories
- As a POD seller, I want to see the app version I'm on (so I can report bugs accurately) but I don't need the technical commit history.
- As Mario (superuser), I want the detailed changelog popup still accessible from the version-pill so I can verify what's deployed.

### Acceptance Criteria
- [x] AC-5-1: Sidebar bottom pill displaying `v0.7.0 Beta` (or current version) remains visible to ALL authenticated users.
- [x] AC-5-2: For non-superuser: pill renders as a non-interactive Chip (`onClick` absent, `cursor: default`, no hover state). Aria-label is "App-Version v0.7.0 Beta" (no "click to open changelog").
- [x] AC-5-3: For superuser (Django `user.is_superuser === true`): pill renders as today — clickable IconButton, opens the detailed changelog Dialog with all the technical detail (commit shas, PR numbers, version tags, GitHub links).
- [x] AC-5-4: Superuser flag is fetched from `/api/user/me/` endpoint and stored in Redux `authSlice.user.is_superuser`. (Likely already there; verify in /architecture phase.)
- [x] AC-5-5: Conditional rendering uses the same `is_superuser` selector everywhere it gates UI (Items 1+5; reuse a single `useIsSuperuser()` hook).

### Edge Cases
- [x] EC-5-1: `is_superuser` flag missing on first render (auth slice still loading) → pill renders in non-interactive mode (fail-closed). After auth resolves, re-renders with link if applicable.
- [x] EC-5-2: A user is demoted from superuser mid-session → on next render the pill loses its link. No special re-fetch needed; Redux state already reflects current user via session refresh.
- [x] EC-5-3: When opened on a slow connection, the click action is a no-op for non-superusers — no spinner, no toast, just visually inert.

---

## Item 6 — Settings consolidation: all 4 sections on ONE scrollable page

### Context
Current state — 4 separate routes under `/settings`:
- `/settings/profile` → `ProfileSection`
- `/settings/billing` → `BillingSection` (likely a placeholder; PROJ-32 Polar.sh post-MVP)
- `/settings/workspace` → `WorkspaceSection`
- `/settings/usage` → `UsageSection`

SettingsLayout has a tabbed navigation to switch. User wants ONE scrollable page that shows all 4 sections back-to-back so there's no tab-clicking.

### User Stories
- As a user, I want to see all my settings on one page so I don't have to click tabs to find the right one.
- As a user with quick edits across multiple sections (e.g. "change my email AND invite a teammate"), I want to scroll instead of navigating away.

### Acceptance Criteria
- [x] AC-6-1: New consolidated route `/settings` (replaces the index redirect) renders a single page with ALL 4 sections rendered in this order: Profile → Billing → Workspace → Usage.
- [x] AC-6-2: Existing sub-routes `/settings/profile`, `/settings/billing`, `/settings/workspace`, `/settings/usage` STILL WORK — they redirect via `Navigate replace` to `/settings#<section-id>` so any deep link from old bookmarks/notifications keeps working AND scrolls to the right section.
- [ ] AC-6-3: Each section starts with a sticky `h2` heading + brief 1-line description. Section ids: `profile`, `billing`, `workspace`, `usage`. Anchor scroll uses smooth-scroll with header offset.
- [x] AC-6-4: Sidebar navigation within Settings (the existing tab strip) is REPLACED with a vertical anchor-link list showing the 4 section names. Clicking a link scrolls to that section. Active section highlighted as user scrolls (IntersectionObserver).
- [x] AC-6-5: SettingsLayout is refactored: no `<Outlet />`, no Route children. Just renders all 4 sections directly.
- [x] AC-6-6: Each existing section component (`ProfileSection`, `BillingSection`, `WorkspaceSection`, `UsageSection`) is reused unchanged — only the routing/layout container changes. Per memory `feedback_component_reuse_first`.
- [x] AC-6-7: Page title `<title>Einstellungen — Merch Miner</title>` (singular, not per-section).
- [x] AC-6-8: If a section requires async data (Workspace members, Usage stats), each section fetches independently. A section in error/loading state doesn't block the others from rendering.

### Edge Cases
- [x] EC-6-1: Billing section is a placeholder (no real Polar.sh integration yet) → still renders with a "Coming soon — Polar.sh integration arrives with payment rollout" message rather than being hidden. Mario investigates current `BillingSection` state during /architecture phase and decides whether to keep visible or hide via feature-flag.
- [x] EC-6-2: User's window is narrow (<768px mobile) → anchor link strip becomes a collapsed accordion at top instead of vertical sidebar. Sections still scroll one beneath the other.
- [x] EC-6-3: User deep-links to `/settings#workspace` from an external link → page loads, all sections render, scroll smoothly to workspace section after a beat (waits for sections to mount + layout to settle, ~150ms).
- [ ] EC-6-4: Workspace section requires admin (workspace-owner) to see member-management — if user is not owner, that subsection is hidden inline; other 3 sections still show.

---

## Item 7 — Chat stage-UX: downgrade tool_timeout warning when LLM answered anyway

### Context
PR #101 bumped `TOOL_TIMEOUT_SECONDS` from 30 → 90s, fixing the most common false-alarm. But edge cases still fire `tool_timeout` (ScraperOps very slow, etc.) AND the LLM produces a substantive answer anyway from RAG context. User sees both: an orange "⚠ Suche abgebrochen" stage row AND a real answer. Confusing dual-signal.

### User Stories
- As a chat user, I don't want to see "Search timed out" when the assistant actually gave me a real answer — that's a bug from my perspective.

### Acceptance Criteria
- [ ] AC-7-1: Frontend chatBarSlice `done` reducer detects: (a) any prior stage in current thinking row was marked `warning` with reason starting `tool_timeout`, AND (b) final answer length > 200 chars (heuristic for "substantive answer").
- [ ] AC-7-2: When both conditions match: downgrade ALL such warning stages to `info` status with message rewritten to "Suche länger als erwartet — Antwort aus alternativen Quellen" (i18n).
- [ ] AC-7-3: Stage row icon changes from warning (orange ⚠) to info (subtle gray ℹ), matching existing `info` stage style.
- [ ] AC-7-4: If condition (b) NOT met (LLM gave a tiny "could not find" answer ≤200 chars) → warning stage stays warning (the timeout IS the relevant signal).
- [ ] AC-7-5: Downgrade happens only at `done`-time, not optimistically during stream. Persisted on the ChatMessage row's `thinking_stages` JSON field — surviving reload.
- [ ] AC-7-6: Unit tests cover: (1) warning + substantive answer → downgraded, (2) warning + tiny answer → not downgraded, (3) no warning → no change.

### Edge Cases
- [ ] EC-7-1: 200-char threshold is brittle for languages with different verbosity (e.g. a meaningful 180-char German answer would be falsely flagged). Track as a follow-up if it becomes a complaint.
- [ ] EC-7-2: Multiple `tool_timeout` events in the same response (rare — different tools) → ALL downgraded if final answer was substantive.
- [ ] EC-7-3: User reloads chat history after the fact → persisted `thinking_stages` already has the downgraded text → renders identically. (i.e. the rewrite is persisted, not just runtime.)

---

## Item 8 — Vane fork persistent timeout patch (10s → 120s)

### Context
The chat-vane-bigfix work used `sed -i 'abort\(\),1e4 → abort(),12e4'` inside the running Vane container to bump the SearXNG-fetch timeout from 10s to 120s. This is a runtime hack:
- Survives container restart (changes the on-disk file inside the container layer)
- Does NOT survive a `docker pull vane:latest` + container recreate (image layer overrides)

This item makes the fix persistent by patching the Vane TypeScript source in `MarioWinter/Vane:merch-miner-patches` fork branch. After push, the GHCR pipeline auto-builds a new image with the fix baked in; `docker compose pull vane` on the server picks it up.

### User Stories
- As an operator, I want the 120s SearXNG timeout to survive routine `docker pull` so I don't have to re-apply it after every image refresh.

### Acceptance Criteria
- [x] AC-8-1: Identify the TypeScript source file in `MarioWinter/Vane` fork that compiles to the current `chunks/641.js` 10s SearXNG-fetch timeout. Grep candidates: `src/lib/searxng.ts`, `src/utils/searxng.ts`, or similar. Pinpoint the exact `setTimeout(()=>controller.abort(), 10000)` line.
- [x] AC-8-2: Change the literal `10000` to `120000` in that source file.
- [x] AC-8-3: Add an inline code comment explaining why (cross-reference to this FIX-spec + the 2026-05-30 in-container patch).
- [x] AC-8-4: Commit + push to `merch-miner-patches` branch in `MarioWinter/Vane` fork. CI auto-builds new Docker image tagged `ghcr.io/mariowinter/vane:merch-miner` (latest) + `:merch-miner-<sha>`.
- [x] AC-8-5: On the server: `docker compose pull vane` followed by `docker compose up -d --no-deps --force-recreate vane`. Then `docker exec vane grep -c 'abort(),12e4' /home/vane/.next/server/chunks/641.js` returns 1 (the bake-in is visible in compiled output).
- [x] AC-8-6: Live verification on prod: send a slow chat query that previously triggered the 10s abort → no abort, full Vane response within 90s.
- [x] AC-8-7: Update memory file `project_searxng_engine_config.md` adding a "2026-05-31 update — timeout patched in fork source" subsection. Note that the in-container `sed` patch can now be removed if anyone is following the runbook.

### Edge Cases
- [x] EC-8-1: Vane upstream changes the file path or constant name in a future fork rebase → next time fork merges upstream-main, the patch must be re-applied. Tracked in fork-rebase memory (`project_vane_custom_build.md`).
- [x] EC-8-2: Some queries genuinely take >120s (very slow ScraperOps day) → still abort. This is by design; 120s already 12x the original.
- [x] EC-8-3: GHCR rebuild fails (CI broken in fork) → keep the in-container `sed` patch as runtime fallback until fork CI is fixed. Document the rollback procedure in the memory file.

---

## Item 9 — Speed-mode bypass: UI dropdown for deeper search

### Context
The FIX-chat-vane-bigfix work hardcoded `mode='speed'` for ALL Vane calls to cap ScraperOps cost (49 calls → ~5 calls per chat). For occasional deep-research queries ("comprehensive market analysis for camping niche"), the user has no way to opt back into the slower-but-more-thorough `balanced` or `quality` modes. Item 9 reintroduces a UI dropdown in the chat input bar that lets the user pick per-session.

### User Stories
- As a POD seller doing deep research occasionally, I want to opt into more thorough search at the cost of more credits / longer wait.
- As a cost-conscious operator, I want the default to stay `speed` so casual chats don't burn credits.

### Acceptance Criteria
- [ ] AC-9-1: New IconButton + dropdown in the chat input bar's right-side cluster, positioned BETWEEN the Model-Picker and the Attachment button. Icon: `@mui/icons-material/Speed` or `Tune`.
- [ ] AC-9-2: Click opens a popover with 3 radio options:
  - **Schnell** (default) — "1 ScraperOps credit pro Chat, sofortige Antwort"
  - **Ausgewogen** — "2-5 credits, breitere Quellen-Abdeckung"
  - **Tief** — "5-10 credits, umfassende Recherche, längere Antwortzeit"
- [ ] AC-9-3: Selected state persists in Redux `chatBarSlice.searchMode: 'speed' | 'balanced' | 'quality'` (re-add this slot that was REMOVED in PROJ-20 — per its spec comment).
- [ ] AC-9-4: Frontend sends `&optimization_mode=<value>` query param on stream URL (GET) or in body (POST). Backend already validates + maps to Vane's `optimizationMode`.
- [ ] AC-9-5: Default state = `'speed'`. Saved in localStorage per workspace so user's preference survives reload.
- [ ] AC-9-6: When mode != `'speed'`, the dropdown icon shows a small badge (similar to Sources-button) indicating "active non-default". Badge gone on `'speed'`.
- [ ] AC-9-7: Tooltip on the button: "Suchtiefe — derzeit: <mode>". On hover.
- [ ] AC-9-8: The niche-chat-agent's `web_search` tool currently hardcodes `mode='speed'`. Update to respect the per-message setting via existing `model_override` plumbing OR add a new `search_mode` parameter through the same path. Per `feedback_skills_must_follow_rules`, the agent test that asserts `mode='speed'` must be updated to accept the param.

### Edge Cases
- [ ] EC-9-1: Old chat session was created with a saved `search_mode` that's no longer valid (typo / removed) → frontend falls back to `'speed'`. localStorage cleaned on next save.
- [ ] EC-9-2: User picks `'quality'` and the resulting search takes >120s (Vane SearXNG-timeout, even with fork-patch) → standard `tool_timeout` handling kicks in. Tooltip warns: "Tiefere Recherche kann länger als 2 Min dauern".
- [ ] EC-9-3: Cost-warning shown ONCE on first switch away from `'speed'` (snackbar "Achtung: jede Anfrage verbraucht mehr Credits"). Dismissible, never shown again.

---

## Cross-cutting decisions (locked via /requirements multi-choice)

| Decision | Value | Affects |
|---|---|---|
| Admin-gate flag for Items 1 (widget visibility) + 5 (changelog link) | Django `user.is_superuser` | UI gating consistency |
| Settings consolidation scope | All 4 sections on ONE scrollable page | Item 6 |
| Vane fork timeout patch | Done as part of THIS spec (cross-repo PR) | Item 8 |
| Changelog widget source | LLM auto-translation of `CHANGELOG.md` | Item 4 |
| Bug-Report icon position in topbar | Between notifications-bell and profile-icon | Item 1 |

## Out of scope
- Polar.sh payment integration (PROJ-32 post-MVP). Item 6 BillingSection stays as placeholder.
- Bug-report routing per workspace (Mario gets ALL reports regardless of workspace).
- Detailed analytics on bug-report submissions (categorization, count-over-time charts).
- Translation between German/English in bug-report user input.
- Auto-classification of bugs vs features by LLM (Mario triages manually).
- A "release notes" full-page view (the dashboard widget + superuser popup are enough).

## Notes
- Workspace isolation enforced at ORM level on every protected endpoint per `feedback_security` rules.
- All UI strings via `useTranslation()`; both German + English provided.
- All components defined as arrow functions; MUI v7 only; `styled()` first; no hardcoded colors.
- Branch `fix/dashboard-bug-report-and-polish` off main. Per `feedback_post_merge_branching`: start from latest main after PR #101 is merged or stay parallel.
- After /requirements approval, /architecture writes `docs/tasks/FIX-dashboard-bug-report-and-polish-tasks.md` with phase-by-phase checkboxes per Item. Each Item becomes its own commit when implemented (per `feedback_phase_by_phase_skill_invocation`).

---

# Tech Design (Solution Architect)

## Component Structure

```
Topbar (existing)
└── Item 1: <FeedbackReportButton />        ← NEW, between Glocke + Profil
    └── opens <FeedbackReportModal />       ← NEW component, MUI Dialog

ChatInputBar (existing — partials/)
├── Item 9: <SearchDepthPicker />           ← NEW, between Model-Picker + Attachment

Sidebar (existing — components/sidebar/)
└── Item 5: <VersionBadge />                ← EXISTING, refactor: gate click behavior on useIsSuperuser()

Dashboard (existing view)
├── Item 3: <RoadmapWidget />               ← NEW panel
└── Item 4: <ChangelogWidget />             ← NEW panel
    └── (uses cached LLM-translated changelog from backend)

SettingsLayout (existing — refactor)
└── Item 6: drop Outlet + Tabs; render all 4 sections inline
    ├── <ProfileSection /> (reuse, unchanged)
    ├── <BillingSection /> (reuse, unchanged)
    ├── <WorkspaceSection /> (reuse, unchanged)
    └── <UsageSection /> (reuse, unchanged)
    plus <SettingsAnchorNav /> ← NEW left-rail anchor links
    plus <SettingsMobileAccordion /> ← NEW mobile collapse

MultiPurposeDrawer (existing)
└── Item 2: <DrawerLayoutToggle /> z-index bumped (CSS-only, no new component)

Backend (Django)
├── NEW app: feedback_app/
│   ├── models.py        — BugFeatureReport, FeedbackScreenshot
│   ├── api/views.py     — POST /reports/, POST /screenshots/, GET /reports/ (superuser-only list)
│   ├── api/serializers.py
│   └── tasks.py         — send_feedback_email (django-rq job)
├── REUSE: dashboard_app/api/views.py
│   ├── + GET /api/dashboard/roadmap/    — reads docs/roadmap_user_facing.md
│   └── + GET /api/dashboard/changelog/  — reads CHANGELOG.md, LLM-translates, Redis-caches
├── REUSE: niche_research_app/graph/llm.py — OpenRouter client for Item 4 translation
└── REUSE: search_app/services/vane_service.py — already accepts mode= param for Item 9

Cross-repo (Item 8)
└── MarioWinter/Vane:merch-miner-patches branch
    └── grep TS source for setTimeout(...,10000) → change to 120000 → push → GHCR auto-build
```

## Data Model

### NEW: BugFeatureReport (feedback_app)

| Field | Type | Notes |
|---|---|---|
| id | UUID, primary key | |
| workspace | FK → Workspace, on_delete CASCADE | Read-isolation per workspace except superusers |
| user | FK → User, on_delete SET_NULL | Allows user account deletion without losing the report |
| type | CharField choices=`bug`/`feature` | Required |
| title | CharField(200) | Required |
| description | TextField, max 4000 chars enforced at serializer | Required |
| screenshot | FK → FeedbackScreenshot, nullable | Optional upload |
| status | CharField choices=`new`/`triaged`/`in_progress`/`done`/`wontfix` | Default `new`, only superusers can change |
| admin_notes | TextField, blank | Notes only superusers see |
| created_at | DateTimeField auto_now_add | |

### NEW: FeedbackScreenshot (feedback_app)

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| image | ImageField, upload_to=`feedback/screenshots/<uuid>.<ext>` | Validates mime + size at serializer level |
| uploaded_by | FK → User | For audit/cleanup |
| uploaded_at | DateTimeField | |

### NEW file: `docs/roadmap_user_facing.md` (Item 3 source)

Hand-curated Markdown with YAML front-matter list. Mario edits when roadmap changes. Backend just reads + parses.

```
---
items:
  - title: "Bulk-Upload für Listings"
    description: "Bis zu 50 Listings gleichzeitig zu MBA hochladen"
    priority: 1
  - title: "Team-Kanban Board"
    description: "Tickets im Team koordinieren, ohne Tool-Wechsel"
    priority: 2
---
(optional free-text Markdown below front-matter — ignored by API)
```

### Reuse: CHANGELOG.md (Item 4 source)

Generated by release-please. Top-3 versions extracted by regex. LLM-translated per-version, Redis-cached 6h.

### NEW Redux slot: `chatBarSlice.searchMode` (Item 9)

```
searchMode: 'speed' | 'balanced' | 'quality'  (default: 'speed')
```

Persisted in localStorage keyed by `${workspaceId}:chat-search-mode`.

## API Endpoints

| Endpoint | Method | Body / Query | Auth | Throttle | Behavior |
|---|---|---|---|---|---|
| `/api/feedback/screenshots/` | POST | multipart/form-data: image | IsAuthenticated | feedback_create=10/min | Upload, returns id |
| `/api/feedback/reports/` | POST | json: type, title, description, screenshot_id? | IsAuthenticated | feedback_create=10/min | Creates row, enqueues email job, returns 201 |
| `/api/feedback/reports/` | GET | query: status?, type?, page? | IsAuthenticated + superuser-only filter for cross-workspace | default DRF | List, paginated. Non-superuser: own workspace only. Superuser: all workspaces. |
| `/api/feedback/reports/<id>/` | PATCH | json: status?, admin_notes? | IsAuthenticated + IsSuperuser | default | Triage update (status, notes). Superuser only. |
| `/api/dashboard/roadmap/` | GET | — | IsAuthenticated | default | Returns parsed roadmap items as `[{title, description, priority}]` |
| `/api/dashboard/changelog/` | GET | — | IsAuthenticated | default | Returns LLM-translated changelog as `[{version, date, items:[]}]`. Cache 6h |

## Tech Decisions

| Decision | Why |
|---|---|
| New Django app `feedback_app` rather than extend `user_auth_app` | Keep auth concerns separate from feedback. Easier to test/maintain. Aligns with project pattern (1 app = 1 domain) |
| Email sent via `django-rq` async, NOT synchronous | API must respond <200ms. SMTP can take seconds. Failed email retries without blocking user. |
| Screenshot upload as separate POST (returns id), THEN referenced in report POST | Standard pattern in this project (mirrors chat-attachments). Allows progress bar on upload while form is still being filled. |
| Roadmap source = hand-curated markdown file (NOT auto-derived from features/INDEX.md) | INDEX uses tech-IDs (PROJ-X) and developer language. User-facing copy needs different voice + ordering. Mario controls the file. |
| Changelog widget = LLM auto-translate (NOT hand-written CHANGELOG_USER.md) | Mario doesn't want to write notes per release. LLM cost ~$0.003/day cached. Translation can be re-tuned via prompt without re-writing files. |
| Reuse existing `niche_research_app/graph/llm.py` OpenRouter client for Item 4 | Single OpenRouter integration point; no duplicate config / error handling. |
| Settings consolidation = scrollable single-page (NOT tabs) | User explicit request. Anchor-nav gives navigation affordance without tab-clicking. Mobile collapses to accordion. |
| `useIsSuperuser()` hook wraps existing `authSlice.user.is_superuser` selector | Centralizes the check — single source of truth for all gating (Items 1+5+future items). Easier to mock in tests. |
| z-index via `theme.zIndex.drawer + 2` (NOT hardcoded) | MUI may re-tune zIndex tokens. Symbolic reference stays correct. |
| Item 8 (Vane fork) handled cross-repo as first phase | GHCR cold-build ~20min. Kick off first, do other Items while it bakes. |
| Item 7 (stage downgrade) is frontend-only in `chatBarSlice` reducer | Backend already persists `thinking_stages` JSON — frontend rewrite is enough. No backend change. |
| Speed-mode bypass (Item 9) uses existing backend `optimization_mode` param | Backend already accepts it (see search_app/api/views.py:828). Only frontend + niche-agent tool need changes. |
| LLM translation cached in Redis 6h keyed by latest git tag | Bounded cost: ~4 cache misses/day × $0.001 = $0.004/day. Invalidates automatically on next release. |
| Cross-repo fork-patch via grep-then-edit at implementation time, NOT planned here | Don't try to architect what we don't have local. Grep finds the line. 5min edit. |

## File Structure (changes only)

```
django-app/
├── feedback_app/                      ← NEW
│   ├── __init__.py
│   ├── apps.py
│   ├── models.py                      — BugFeatureReport, FeedbackScreenshot
│   ├── admin.py                       — Django admin registration
│   ├── api/
│   │   ├── __init__.py
│   │   ├── views.py                   — ReportViewSet, ScreenshotUploadView
│   │   ├── serializers.py
│   │   └── urls.py
│   ├── tasks.py                       — send_feedback_email (django-rq job)
│   ├── tests/
│   │   ├── test_models.py
│   │   ├── test_api.py
│   │   └── test_email_job.py
│   └── migrations/
│       └── 0001_initial.py
├── dashboard_app/
│   ├── api/
│   │   └── views.py                   ← EXTEND with RoadmapView + ChangelogView
│   ├── services/                      ← NEW directory
│   │   ├── __init__.py
│   │   ├── roadmap_loader.py          — parses docs/roadmap_user_facing.md
│   │   └── changelog_translator.py    — reads CHANGELOG.md, calls LLM, caches
│   └── tests/
│       ├── test_roadmap_loader.py     ← NEW
│       └── test_changelog_translator.py ← NEW (mocks LLM)
├── agent_app/agents/niche_chat_agent.py   ← EDIT: read per-message mode instead of hardcoded 'speed'
└── core/
    ├── settings.py                    ← ADD: INSTALLED_APPS += 'feedback_app', env FEEDBACK_RECIPIENT_EMAIL, CHANGELOG_TRANSLATE_MODEL
    └── urls.py                        ← ADD: include feedback_app.api.urls

docs/
├── roadmap_user_facing.md             ← NEW (hand-curated)
└── tasks/
    └── FIX-dashboard-bug-report-and-polish-tasks.md  ← NEW (this skill creates)

frontend-ui/src/
├── components/
│   ├── FeedbackReportModal/           ← NEW (Item 1)
│   │   ├── index.tsx
│   │   ├── partials/
│   │   │   ├── FeedbackForm.tsx
│   │   │   └── ScreenshotUpload.tsx
│   │   ├── schemas/
│   │   │   └── feedbackReportSchema.ts
│   │   ├── hooks/
│   │   │   └── useFeedbackReport.ts
│   │   └── __tests__/
│   │       └── FeedbackReportModal.test.tsx
│   ├── topbar/                        (existing — check actual path)
│   │   └── FeedbackReportButton.tsx   ← NEW IconButton trigger
│   ├── sidebar/
│   │   └── VersionBadge.tsx           ← EDIT: gate click on useIsSuperuser()
│   └── MultiPurposeDrawer/
│       └── DrawerLayoutToggle.tsx     ← EDIT: bump zIndex
├── views/
│   ├── dashboard/
│   │   ├── partials/
│   │   │   ├── RoadmapWidget/         ← NEW (Item 3)
│   │   │   └── ChangelogWidget/       ← NEW (Item 4)
│   │   └── …
│   └── settings/
│       ├── SettingsLayout.tsx         ← REFACTOR (Item 6: drop Outlet+tabs)
│       ├── partials/
│       │   ├── SettingsAnchorNav.tsx  ← NEW
│       │   └── SettingsMobileAccordion.tsx ← NEW
│       └── (existing 4 sections reused unchanged)
├── components/MultiPurposeDrawer/panels/ChatInputBar/partials/
│   └── SearchDepthPicker.tsx          ← NEW (Item 9)
├── hooks/
│   └── useIsSuperuser.ts              ← NEW (Item 5)
├── store/
│   ├── chatBarSlice.ts                ← EDIT: re-add searchMode slot + done-reducer downgrade logic (Item 7)
│   ├── dashboardSlice.ts              ← EDIT: add RTK endpoints for roadmap + changelog
│   └── feedbackSlice.ts               ← NEW (Item 1): RTK Query for feedback endpoints
├── i18n/
│   ├── de.json                        ← ADD: feedback.*, dashboard.roadmap.*, dashboard.changelog.*, settings.*, chatBar.searchDepth.*
│   └── en.json                        ← ADD: same keys
├── App.tsx                            ← EDIT: settings routes → redirects to /settings#<id>
└── …

MarioWinter/Vane (separate repo)         ← NEW cross-repo commit (Item 8)
└── src/lib/searxng.ts (path TBD via grep) — change 10000 → 120000
```

## Dependencies (packages to install)

NONE new on the Django side. NONE new on the frontend side. All Item implementations use existing project dependencies:
- Django side: `django-rq` (already), `httpx` (already, for LLM call), Django built-in `send_mail`, `django.core.files` for screenshots
- Frontend side: MUI v7 components (Dialog, Popover, Chip, Tabs already used), `react-hook-form` + `zod` (already), `notistack`, RTK Query

Single optional addition if not present: a Markdown front-matter parser for Python. Recommendation: use `pyyaml` (very likely already installed via Django; verify in /backend phase).

