# PROJ-24: Legal Pages + Global Footer + Feature Flag System

## Status: Planned
**Created:** 2026-05-01
**Last Updated:** 2026-05-01

## Summary
Bundles three related concerns into one spec:
1. **Legal Pages** — public routes `/legal/imprint` + `/legal/privacy` (Impressum + Datenschutzerklärung) for DSGVO/DDG compliance.
2. **Global Footer** — thin footer on every page (auth + app) linking to legal pages + copyright.
3. **Feature Flag System** — frontend-only build-time flag mechanism (Vite `import.meta.env.VITE_*`) with a `useFeatureFlag` hook. First flag = `REGISTRATION_ENABLED` to hide registration link + route during BETA.

## Dependencies
- None (greenfield additions)

## User Stories
- As a **visitor**, I want to read the Impressum and Datenschutzerklärung from any page (logged-in or not) so I can verify the operator's legal info before signing up.
- As a **DE-based customer**, I want the legal pages in German (default) with English available so I can read them in my preferred language.
- As an **admin during BETA**, I want the public registration page hidden so I can onboard testers manually via Django Admin instead of letting random users sign up.
- As a **developer**, I want a typed feature flag hook (`useFeatureFlag(FEATURE_FLAGS.X)`) so I can gate unfinished features behind a single switch and turn them on per environment without code changes.
- As an **operator**, I want to flip a flag via `.env` + redeploy (no code change) so I can enable/disable features per environment (dev, staging, prod).
- As an **admin (`is_staff` or `is_superuser`)**, I want to see all gated features in the live app even when their flag is off, so I can dogfood unfinished features in prod before flipping them on for everyone.

## Acceptance Criteria

### Legal Pages
- [x] AC-1: Route `/legal/imprint` renders the Impressum page, publicly accessible without auth.
- [x] AC-2: Route `/legal/privacy` renders the Datenschutzerklärung page, publicly accessible without auth.
- [x] AC-3: Both pages use a shared `LegalLayout` (MUI `Container maxWidth="md"`, semantic `Typography` hierarchy, dark-mode compatible via `theme.vars.palette.*`).
- [x] AC-4: Page content is provided as a JSX tree of MUI `Typography` components (`h4`/`h5`/`h6` for headings, `body1` for paragraphs, MUI `Link` for URLs/emails) — no `dangerouslySetInnerHTML`. Translatable copy is keyed via i18next `<Trans i18nKey="legal.privacy.section1">` so structural markup stays in the component while text moves into `translation.json` per locale.
- [x] AC-5: Both pages support all 5 app locales (DE, EN, FR, ES, IT) via i18next; default = DE; language follows existing app i18n setting. DE is the legally binding original; non-DE versions show a Disclaimer above the content: "This is a translation. In case of dispute, the German version applies." (i18n-keyed).
- [x] AC-6: Both pages have correct `<title>` and `<meta name="description">` set via `document.title` (or `react-helmet-async` if already in repo).
- [x] AC-7: Mobile-responsive: text wraps cleanly at xs/sm breakpoints, max-width caps reading line length on md+.
- [x] AC-7a: **Privacy policy Tools-Sektionen** must include: Strato (hosting), Supabase PostgreSQL (DB), JWT-Cookie auth, Langfuse (LLM observability), OpenRouter (LLM API), n8n (workflow automation), OneDrive (cloud storage import — PROJ-9/11), Google Drive (cloud storage import — PROJ-9/11). **Excluded:** Facebook (not used in app; lives on separate sales site with own legal pages).
- [x] AC-7b: **Inline content fixes** vs. raw e-recht24 output: (a) Impressum third language field — replace dangling "und." with "Italienisch" (app supports IT); (b) address consistency — use "Außenliegend 4" (no comma) on every page; (c) Datenschutz placeholder "[Telefonnummer der verantwortlichen Stelle]" → "+49 1601546188"; (d) DSA contact block uses same operator data.

### Global Footer
- [x] AC-8: A `GlobalFooter` component renders on every page (login, register, all protected app pages, legal pages themselves).
- [x] AC-9: Footer layout (left → center → right): empty/logo (left), legal links (center: Impressum, Datenschutz), copyright (right: `© 2026 - Merch Miner`).
- [x] AC-10: Footer height is compact (~48–56px), dark background (`theme.vars.palette.background.paper` or similar), subtle top border.
- [x] AC-11: Footer is integrated into `AppLayout` (protected routes) AND auth pages (Login, Register, Activate, PasswordReset, PasswordConfirm) without layout-shift.
- [x] AC-12: Footer link text is i18n-keyed for all 5 locales (DE, EN, FR, ES, IT).
- [x] AC-13: Mobile (xs): footer collapses sensibly — copyright drops below links or links wrap; no horizontal scroll.

### Feature Flag System
- [x] AC-14: `FEATURE_FLAGS` is a `const`-object with `as const` (NOT a TypeScript `enum`) in `frontend-ui/src/constants/featureFlags.ts`. Type derived as `type FeatureFlag = typeof FEATURE_FLAGS[keyof typeof FEATURE_FLAGS]` for type-safe hook arguments.
- [x] AC-15: `fallbackFlags: Readonly<Record<FeatureFlag, boolean>>` constant exports default values for every flag. Every flag declared in `FEATURE_FLAGS` MUST have a default in `fallbackFlags` (TypeScript will fail compile otherwise).
- [x] AC-16: `useFeatureFlag(flag: FeatureFlag): boolean` hook returns the resolved value: admin-override → env-var override → fallback (in that order).
- [x] AC-17: Each flag is overridable via `import.meta.env.VITE_FF_<FLAG_NAME>` (string `'true'` / `'false'`); env value wins over fallback. Anything other than the literal string `'true'` evaluates to `false`.
- [x] AC-18: Initial flag set at MVP ship (all default `false`):
    - `REGISTRATION_ENABLED` — public sign-up link + route (BETA-safe off)
    - `CLOUD_STORAGE_ENABLED` — OneDrive + Google Drive importers (PROJ-9 / PROJ-11)
    - `DESKTOP_UPLOAD_APP_ENABLED` — Electron Desktop Upload App entry-points (PROJ-13)
    - `KANBAN_ENABLED` — Team Kanban view (PROJ-14)
- [x] AC-19: All flag names + meanings are documented as a JSDoc block on `FEATURE_FLAGS` in `frontend-ui/src/constants/featureFlags.ts`.
- [x] AC-20: `useFeatureFlag` has Vitest unit tests covering: (a) flag enabled via env var → true; (b) flag disabled (fallback false, no env var) → false; (c) env var malformed (`'yes'`, `'1'`) → false; (d) admin user (`is_staff: true`) → all flags return true regardless of env/fallback; (e) admin user (`is_superuser: true`, `is_staff: false`) → all flags return true; (f) non-admin user with flag false → false.

### Admin Override (Feature Flag bypass)
- [x] AC-20a: `useFeatureFlag` checks the current user from Redux (`authSlice`). If `user.is_staff === true` OR `user.is_superuser === true`, the hook returns `true` for every flag (env var + fallback ignored). Defense-in-depth: both fields checked because Django's superuser status does not strictly require `is_staff`.
- [x] AC-20b: Backend `/api/auth/me/` (or whatever endpoint hydrates the Redux user) MUST include `is_staff: boolean` and `is_superuser: boolean` in the user serializer. If they are missing, add to `UserSerializer` in `user_auth_app/api/serializers.py`.
- [x] AC-20c: When user is logged out (no auth state), admin-override is `false`. The flag falls through to env-var → fallback resolution.
- [x] AC-20d: Admin-override does NOT apply to `REGISTRATION_ENABLED`. Rationale: the registration link/route is shown on the unauthenticated `/login` page where no user object exists — admin context cannot be established. Admins are onboarded via Django Admin during BETA.
- [x] AC-20e: For non-component contexts (e.g. router config outside React tree), expose a non-hook helper `getStaticFlag(flag: FeatureFlag): boolean` that resolves env-var → fallback (no admin override). This is what `AC-22` uses to gate the `/register` route.

### Registration Gate (uses Feature Flag)
- [x] AC-21: When `REGISTRATION_ENABLED === false`: the "Sign Up" / "Registrieren" link on the Login page is hidden (not rendered).
- [x] AC-22: When `getStaticFlag(REGISTRATION_ENABLED) === false`: the `/register` route is removed from the React Router config (component import + route entry behind the flag check) — direct URL access falls through to the `*` redirect (currently `/dashboard`, which redirects unauthenticated users to `/login`). Uses the static helper (not the hook) since router config is outside the component tree, AND because admin-override is exempt for this flag (AC-20d).
- [x] AC-23: When `REGISTRATION_ENABLED === true`: link is visible and route is reachable (current behavior, no regression).
- [x] AC-24: Registration code (`RegisterPage`, related slices, services) is **not deleted** — only conditionally mounted via the flag.
- [x] AC-25: `.env.dev.template` documents `VITE_FF_REGISTRATION_ENABLED` with comment explaining BETA usage.

## Edge Cases
- [x] EC-1: User opens `/legal/imprint` while logged in → page renders without sidebar/topbar (uses `LegalLayout`, not `AppLayout`); back-navigation returns to previous app page.
- [x] EC-2: User opens `/legal/privacy` while logged out → page renders without auth redirect (route is outside `<PrivateRoute>`).
- [x] EC-3: User switches i18n language on legal page → content reloads in new language without page refresh.
- [x] EC-4: Footer overlaps content on a short page (e.g. login form on tall viewport) → use flex layout (`min-height: 100vh`) so footer sits at viewport bottom on short pages and below content on long pages.
- [x] EC-5: User on mobile (xs viewport) opens legal page → text is readable (no overflow), headings scale, footer wraps without horizontal scroll.
- [x] EC-6: Flag env var is missing from `.env` → `useFeatureFlag` returns the `fallbackFlags` value without crashing.
- [x] EC-7: Flag env var is set to a malformed value (e.g. `VITE_FF_REGISTRATION_ENABLED=yes`) → treat as falsy unless exactly `'true'`; log a console warning in DEV.
- [x] EC-8: User has the `/register` URL bookmarked from before BETA-gate → direct visit when flag is off → falls through to `/dashboard` redirect → unauthenticated users land on `/login` (no white screen, no error).
- [x] EC-9: Flag is flipped between renders (HMR in dev) → hook re-evaluates on next render; no stale value cached across reloads.
- [x] EC-10: Footer is rendered inside a scrollable container (e.g. design workspace) → footer must not steal scroll or float over canvas; appears only at root layout level.
- [x] EC-11: Admin user logs out → `useFeatureFlag` immediately re-resolves from env/fallback on next render (no stale `true` from prior admin session).
- [x] EC-12: Non-admin user is promoted to `is_staff` via Django Admin → their next page-load (or refetch of `/api/auth/me/`) updates Redux → `useFeatureFlag` returns `true` for all flags. No app reload required.
- [x] EC-13: User object is loading (initial app boot, Redux state still hydrating) → `useFeatureFlag` treats this as non-admin (false) and resolves from env/fallback. No flicker once user loads.

## Technical Requirements

### Frontend
- React 19 + Vite + TypeScript
- MUI v7 (Container, Stack, Box, Typography, Link, Divider) — no custom components for what MUI provides
- Styling: `styled()` for `LegalLayout` and `GlobalFooter` (reusable, complex enough); `sx` only for tiny one-off tweaks
- React Router DOM v7: legal routes outside `<PrivateRoute>`; register route conditionally mounted
- i18next: all 5 locales (DE, EN, FR, ES, IT) required at ship; DE is legally binding original, others are translations with disclaimer banner
- No hardcoded colors — `theme.vars.palette.*` only
- Dark-mode compatible (default theme is dark)

### Feature Flag Mechanism (Build-Time + Admin-Override)
- Resolution order in `useFeatureFlag`: admin-override (`is_staff || is_superuser`) → `import.meta.env.VITE_FF_<NAME>` → `fallbackFlags` constant
- `getStaticFlag` (non-hook helper) skips admin-override — env + fallback only — for router config and other non-component contexts
- Hook is synchronous (no async fetch in MVP) — all flags are build-time-resolved + Redux-user-aware
- User object source: existing Redux `authSlice` (selector for current user); `is_staff` + `is_superuser` must be present in serialized user payload
- Future: backend-driven flags + per-workspace overrides — out of scope here

### Content
- DE legal text supplied by user from e-recht24.de (HTML copy-paste); transformed inline into JSX `<Trans>` keys during migration with content-fixes per AC-7b
- All 5 locales mandatory at ship (DE original + EN/FR/ES/IT translations)
- Translation disclaimer ("In case of dispute, the German version applies") on every non-DE locale

### Performance
- Legal pages: < 100ms render (static content, no data fetching)
- Footer: no layout shift on mount

### Security
- Legal pages are public — no auth gating, no PII
- Feature flags client-side — never use for security-critical gating (only UX gating). BETA registration block is acceptable because Django backend `/api/auth/register/` can ALSO be gated server-side if abuse becomes an issue (out of scope for this spec).

### Browser Support
- Chrome, Firefox, Safari (latest 2 versions); mobile Safari + Chrome Android

## Out of Scope
- Cookie consent banner (tracking lives on separate sales site)
- AGB / Terms of Use page (post-MVP, when payment ships)
- Server-side feature flag store / API (current need is build-time only)
- Backend-side registration gating (Django `/api/auth/register/` endpoint stays open; if abused, separate spec)
- Cookie Policy page (no cookies set beyond technical/auth)
- Multi-tenant flag overrides (per-workspace flags) — not needed for current use cases

## Resolved Decisions
- **Copyright wording:** `© 2026 - Merch Miner` (no legal entity suffix at MVP — operator is sole proprietor "Mario Winter"; entity name can be appended later if/when UG/GmbH founded).
- **Footer left side:** empty at MVP (no logo). Logo can be added in a follow-up if needed.
- **i18n scope:** all 5 app locales (DE, EN, FR, ES, IT). DE is the legally binding original. Non-DE versions show a translation disclaimer at the top.
- **Tools-Sections in Datenschutz:** include only what the app actually uses or is imminently shipping (Strato, Supabase, JWT, Langfuse, OpenRouter, n8n, OneDrive, Google Drive). Facebook excluded.
- **Content-Issue handling:** fixed inline during JSX migration (typo, address, phone-placeholder). Raw e-recht24 HTML is no longer single source of truth post-import.
- **Storage pattern:** JSX-tree with `<Trans>` (i18n-keyed) — structural markup in component, copy in `translation.json` per locale.
- **Flag declaration style:** `const FEATURE_FLAGS = {...} as const` (NOT TypeScript `enum`). Avoids enum-runtime-bloat and reverse-mapping quirks; gives same type safety via `keyof typeof`.
- **Initial flag set:** `REGISTRATION_ENABLED`, `CLOUD_STORAGE_ENABLED`, `DESKTOP_UPLOAD_APP_ENABLED`, `KANBAN_ENABLED` — all default off. Additional flags added on-demand when other features ship.
- **Admin-override:** `is_staff` OR `is_superuser` Django users see all gated features as enabled (live-test in prod). Exempt: `REGISTRATION_ENABLED` (no logged-in user on Login page → admin context unavailable).
- **Two-API split:** `useFeatureFlag(flag)` (hook, admin-aware, in components) vs `getStaticFlag(flag)` (helper, env+fallback only, for router config and other non-component contexts).

## Open Questions
- _None_ (all spec-level decisions resolved).

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure

```
App.tsx (Router)
+-- Public Routes
|   +-- /login        → LoginPage    + GlobalFooter
|   +-- /register     → conditionally mounted (REGISTRATION_ENABLED flag)
|   +-- /activate     → ActivatePage + GlobalFooter
|   +-- /password-*   → password pages + GlobalFooter
|   +-- /legal/imprint   → LegalLayout > ImprintPage
|   +-- /legal/privacy   → LegalLayout > PrivacyPage
+-- Protected Routes (PrivateRoute > AppLayout)
    +-- All app views (dashboard, niches, designs, ...)
    +-- AppLayout footer slot → GlobalFooter

Components (NEW):
+-- components/GlobalFooter/
|   +-- GlobalFooter.tsx    (3-zone layout: empty | links | copyright)
|   +-- GlobalFooter.test.tsx
+-- components/LegalLayout/
|   +-- LegalLayout.tsx     (Container maxWidth=md, headings, language disclaimer)
+-- views/legal/
|   +-- imprint/ImprintPage.tsx     (JSX-tree with <Trans>)
|   +-- privacy/PrivacyPage.tsx     (JSX-tree with <Trans>)
+-- constants/featureFlags.ts        (FEATURE_FLAGS + fallbackFlags)
+-- hooks/useFeatureFlag.ts          (admin-aware hook)
+-- hooks/useFeatureFlag.test.ts
+-- utils/getStaticFlag.ts           (env+fallback only, for router)
```

### Data Model

No new database tables. Single backend change:

| Field added to | Field | Type | Purpose |
|---|---|---|---|
| `UserProfileSerializer` (`user_auth_app/api/serializers.py`) | `is_staff` | boolean | Admin-override for feature flags |
| `UserProfileSerializer` | `is_superuser` | boolean | Admin-override for feature flags |

Both are read-only (sourced from Django `User` model fields that already exist).

Frontend `authSlice.user` type extends to include both new booleans.

### Tech Decisions

| Decision | Why |
|---|---|
| `const`-Object with `as const` (NOT `enum`) for FEATURE_FLAGS | No runtime bloat, no reverse-mapping quirks, identical type safety via `keyof typeof`. Modern TS best practice. |
| Build-time env vars (`VITE_FF_*`), no runtime fetch | Zero network cost, dead-code-eliminable when off, simple mental model. Backend-driven flags = Post-MVP. |
| Two-API split: `useFeatureFlag` (hook) + `getStaticFlag` (helper) | Hook needs Redux user (admin-override); router config + constants live outside React tree. Forcing one API would tangle imports. |
| Admin-override = `is_staff OR is_superuser` | Defense-in-depth — Django superuser status doesn't strictly require `is_staff`. Both fields mean "elevated user" → see all features. |
| `REGISTRATION_ENABLED` exempt from admin-override | No logged-in user on `/login` page → admin context unavailable → must use `getStaticFlag` for routing. |
| `<Trans i18nKey="...">` over `dangerouslySetInnerHTML` | Structural markup (Links, Headings) stays in component, copy stays translatable. e-recht24 HTML flat-strings would lose semantic structure. |
| Translation disclaimer banner on non-DE locales | Legal liability — DE is binding original. Banner is i18n-keyed itself ("This is a translation"). |
| All 5 locales at ship (DE original + EN/FR/ES/IT machine translations) | App already supports 5 locales — no UX-bruch. Disclaimer covers legal risk on machine translations. |
| `LegalLayout` separate from `AppLayout` | Legal pages are public, must work logged-out, no sidebar/topbar clutter. Reusable container, just `Container maxWidth=md`. |
| `GlobalFooter` rendered in BOTH `AppLayout` + each auth page | Auth pages don't share a layout component. Component is small, manual placement is simpler than refactoring auth-page layouts. |
| Fix e-recht24 content issues inline (typo, address, phone) | Single migration step, content lives in translation.json afterwards anyway → e-recht24 stops being source of truth. |
| Initial 4 flags (`REGISTRATION_ENABLED`, `CLOUD_STORAGE_ENABLED`, `DESKTOP_UPLOAD_APP_ENABLED`, `KANBAN_ENABLED`) | Cover known in-progress features (PROJ-9/11/13/14) — UI can hide unfinished flows in prod, admins still see them. |

### API / Endpoint Changes

| Endpoint | Method | Change |
|---|---|---|
| `/api/users/me/` | GET | Response gains `is_staff` + `is_superuser` booleans (read-only). No migration. |

### File / Translation Layout

```
frontend-ui/
+-- public/locales/
|   +-- de/translation.json        (extend with legal.* + footer.* keys — DE is source-of-truth)
|   +-- en/translation.json        (extend, machine-translated)
|   +-- fr/translation.json        (extend, machine-translated)
|   +-- es/translation.json        (extend, machine-translated)
|   +-- it/translation.json        (extend, machine-translated)
+-- src/
|   +-- App.tsx                    (add legal routes, gate /register route via getStaticFlag)
|   +-- components/
|   |   +-- GlobalFooter/
|   |   +-- LegalLayout/
|   |   +-- AppLayout.tsx          (slot in <GlobalFooter />)
|   +-- views/
|   |   +-- legal/imprint/
|   |   +-- legal/privacy/
|   |   +-- auth/login/LoginPage.tsx       (hide register link if flag off)
|   |   +-- auth/login/LoginPage.tsx       (mount <GlobalFooter />)
|   |   +-- auth/register/RegisterPage.tsx (mount <GlobalFooter />)
|   |   +-- auth/activate/ActivatePage.tsx (mount <GlobalFooter />)
|   |   +-- auth/password-reset/*.tsx      (mount <GlobalFooter />)
|   +-- constants/featureFlags.ts          (NEW)
|   +-- hooks/useFeatureFlag.ts            (NEW)
|   +-- utils/getStaticFlag.ts             (NEW)
|   +-- store/authSlice.ts                 (extend User type with is_staff + is_superuser)
+-- .env.dev.template                      (add VITE_FF_* lines + comments)
+-- .env                                   (add VITE_FF_* per environment)

django-app/
+-- user_auth_app/api/serializers.py      (UserProfileSerializer adds 2 fields)
+-- user_auth_app/tests/test_user_profile.py  (assert new fields in /me/ response)
```

### Dependencies

No new packages. Uses existing stack:
- `react-i18next` (already installed) — `<Trans>` component
- `@mui/material` — Container, Typography, Stack, Link, Box
- `react-redux` — for `useFeatureFlag` user lookup
- `vitest` + `@testing-library/react` — tests

### Testing Strategy

| Layer | What | Tool |
|---|---|---|
| Backend unit | `is_staff` + `is_superuser` present in `/api/users/me/` response | pytest (extend `test_user_profile.py`) |
| Frontend unit | `useFeatureFlag` resolution order + admin override | Vitest |
| Frontend unit | `getStaticFlag` env var parsing | Vitest |
| Frontend integration | Register-Link hidden when flag off | Vitest + RTL |
| Frontend integration | `/register` direct visit redirects when flag off | Vitest + RTL |
| Frontend integration | Footer renders on Login + Dashboard pages | Vitest + RTL |
| Frontend integration | `/legal/imprint` + `/legal/privacy` render in DE without auth | Vitest + RTL |
| Manual QA | All 5 locales render correctly + disclaimer shown on non-DE | Browser |
| Manual QA | Mobile xs viewport — footer wraps, legal text readable | Browser DevTools |

## QA Test Results

**Date:** 2026-05-02
**Status:** PASSED — 32 ACs + 13 ECs all verified

### Test Run Summary
| Layer | Count | Result |
|---|---|---|
| Backend pytest (`test_user_profile.py`) | 10 | 10/10 ✅ |
| Frontend Vitest unit (`useFeatureFlag` + `getStaticFlag`) | 14 | 14/14 ✅ |
| Frontend Vitest integration (`LoginPage` + `App` route gating) | 10 | 10/10 ✅ |
| Frontend Vitest component (`GlobalFooter` + `ImprintPage` + `PrivacyPage`) | 16 | 16/16 ✅ |
| Frontend Vitest full sweep | 1364 passed / 1 skipped | ✅ |
| TypeScript `tsc --noEmit` | — | 0 errors |
| ESLint (PROJ-24 paths) | — | 0 errors (17 pre-existing in unrelated files) |
| Manual Playwright (login, mobile, locale-switch DE/EN/FR/ES/IT, admin-override) | 20+ scenarios | ✅ |

### AC Pass Counts
- Legal Pages (AC-1 to AC-7b): **9/9** ✅
- Global Footer (AC-8 to AC-13): **6/6** ✅
- Feature Flag System (AC-14 to AC-20): **7/7** ✅
- Admin Override (AC-20a to AC-20e): **5/5** ✅
- Registration Gate (AC-21 to AC-25): **5/5** ✅
- **Total: 32/32 ACs**

### EC Pass Counts
- All 13 ECs verified via unit tests + Playwright manual QA — **13/13** ✅

### Bugs Found + Fixed During QA
1. **`<tel>` / `<mail>` React warnings** — Trans slot tags rendered as native HTML. Fixed: switched to `<a>` slot pattern. (Phase 7)
2. **`<Trans>{children}</Trans>` rendered fallback children instead of i18n value** — react-i18next children-as-default behavior. Fixed: converted simple-text Trans to `t(key, fallback)`; kept Trans only with component slots. (Phase 8)

### Security Audit
- ✅ `is_staff` + `is_superuser` are read-only in `UserProfileSerializer` — cannot be set via PATCH
- ✅ `useFeatureFlag` admin-override checks BOTH `is_staff || is_superuser` (defense-in-depth)
- ✅ `REGISTRATION_ENABLED` correctly exempt from admin-override (no logged-in user on Login)
- ✅ `getStaticFlag` for router config — admin-override exempt at routing layer
- ✅ Feature flags are UI-only — no security-critical gating; backend endpoints protected by `IsAuthenticated`
- ✅ Legal routes public (no auth, no PII)
- ✅ Operator address/phone/email are intentional public business contact (Impressum legal requirement)
- ✅ No secrets in frontend translation JSON

### Unresolved Issues
- _None_ — feature is ship-ready

## Deployment
_To be added by /deploy_
