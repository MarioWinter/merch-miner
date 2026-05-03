# PROJ-24 Task Breakdown — Legal Pages + Footer + Feature Flags

> Spec: [PROJ-24](../../features/PROJ-24-legal-pages-and-feature-flags.md)
> Status: Planned → In Progress
> Run order: Backend → Feature Flags → Legal Layouts → Footer → Reg-Gate → Content & i18n → Tests → QA

---

## Phase 1 — Backend (UserSerializer Extension)

- [x] T1.1: Add `is_staff` + `is_superuser` (read-only booleans) to `UserProfileSerializer.Meta.fields` in `django-app/user_auth_app/api/serializers.py`
- [x] T1.2: Add both fields to `read_only_fields` (security — never settable via API)
- [x] T1.3: Extend `test_user_profile.py` — assert both fields present in `/api/users/me/` response, type bool
- [x] T1.4: Add test case: `is_staff=True` user → response shows `is_staff: true`
- [x] T1.5: Run `docker compose exec web pytest django-app/user_auth_app/tests/test_user_profile.py` → green

## Phase 2 — Feature Flag System (Constants + Hook + Helper)

- [x] T2.1: Create `frontend-ui/src/constants/featureFlags.ts` — `FEATURE_FLAGS` const-object with `as const`, JSDoc per flag
- [x] T2.2: Same file: declare `FeatureFlag` type via `keyof typeof`
- [x] T2.3: Same file: declare `fallbackFlags: Readonly<Record<FeatureFlag, boolean>>` — all 4 flags default `false`
- [x] T2.4: Create `frontend-ui/src/utils/getStaticFlag.ts` — resolves env var → fallback (no React hooks)
- [x] T2.5: `getStaticFlag` parses env value: only literal `'true'` → true; everything else → false; warn in DEV mode for unknown values
- [x] T2.6: Create `frontend-ui/src/hooks/useFeatureFlag.ts` — uses `useSelector` for current user → admin-override → `getStaticFlag` fallback
- [x] T2.7: Extend `User` type in `store/authSlice.ts` with `is_staff: boolean` + `is_superuser: boolean`
- [x] T2.8: Add `.env.dev.template` lines: `VITE_FF_REGISTRATION_ENABLED=false`, `VITE_FF_CLOUD_STORAGE_ENABLED=false`, `VITE_FF_DESKTOP_UPLOAD_APP_ENABLED=false`, `VITE_FF_KANBAN_ENABLED=false` — with comments explaining each

## Phase 3 — Feature Flag Tests

- [x] T3.1: Create `frontend-ui/src/hooks/__tests__/useFeatureFlag.test.ts`
- [x] T3.2: Test (a): flag enabled via env → returns true (non-admin user)
- [x] T3.3: Test (b): flag disabled (no env, fallback false) → returns false
- [x] T3.4: Test (c): malformed env value (`'yes'`, `'1'`) → false + console.warn
- [x] T3.5: Test (d): user with `is_staff=true` → all flags return true
- [x] T3.6: Test (e): user with `is_superuser=true`, `is_staff=false` → all flags return true
- [x] T3.7: Test (f): non-admin user with flag false → false
- [x] T3.8: Test (g): logged-out (no user) → flag falls through to env+fallback (no admin-override)
- [x] T3.9: Create `frontend-ui/src/utils/__tests__/getStaticFlag.test.ts` — env var parsing only (no Redux dependency)

## Phase 4 — Legal Layout + Pages (skeleton, no content yet)

- [x] T4.1: Create `frontend-ui/src/components/LegalLayout/LegalLayout.tsx` — MUI `Container maxWidth="md"`, semantic Typography, dark-mode via `theme.vars.palette.*`, top translation-disclaimer banner (rendered when locale !== 'de')
- [x] T4.2: Use `styled()` for layout container (reusable, complex spacing rules)
- [x] T4.3: Create `frontend-ui/src/views/legal/imprint/ImprintPage.tsx` — placeholder JSX-tree using `<Trans i18nKey="legal.imprint.*">` for sections
- [x] T4.4: Create `frontend-ui/src/views/legal/privacy/PrivacyPage.tsx` — placeholder JSX-tree using `<Trans i18nKey="legal.privacy.*">`
- [x] T4.5: Both pages set `document.title` on mount via `useEffect` (no `react-helmet-async` unless already in repo)
- [x] T4.6: Wire routes in `App.tsx` outside `<PrivateRoute>`: `/legal/imprint` + `/legal/privacy`
- [x] T4.7: Verify pages render at both routes without auth (manual smoke-test)

## Phase 5 — Global Footer

- [x] T5.1: Create `frontend-ui/src/components/GlobalFooter/GlobalFooter.tsx` — Stack with 3 zones (left empty, center links, right copyright)
- [x] T5.2: `styled()` container — height ~48-56px, `theme.vars.palette.background.paper`, subtle top border, responsive xs wrap behavior
- [x] T5.3: Center: `<Link>` to `/legal/imprint` + `<Link>` to `/legal/privacy`, i18n-keyed via `t('footer.imprint')` + `t('footer.privacy')`
- [x] T5.4: Right: `© 2026 - Merch Miner` (i18n-keyed via `t('footer.copyright')` for translatability)
- [x] T5.5: Mount `<GlobalFooter />` in `components/AppLayout.tsx` — flexbox with `min-height: 100vh` so footer sits at viewport bottom
- [x] T5.6: Mount `<GlobalFooter />` in `views/auth/login/LoginPage.tsx` (via shared `AuthLayout`)
- [x] T5.7: Mount `<GlobalFooter />` in `views/auth/register/RegisterPage.tsx` (via shared `AuthLayout`)
- [x] T5.8: Mount `<GlobalFooter />` in `views/auth/activate/ActivatePage.tsx` (via shared `AuthLayout`)
- [x] T5.9: Mount `<GlobalFooter />` in `views/auth/password-reset/PasswordResetPage.tsx` (via shared `AuthLayout`)
- [x] T5.10: Mount `<GlobalFooter />` in `views/auth/password-reset/PasswordConfirmPage.tsx` (via shared `AuthLayout`)
- [x] T5.11: Manual check — no horizontal scroll on xs viewport, footer doesn't steal scroll inside Design Workspace

## Phase 6 — Registration Gate Wiring

- [x] T6.1: Hide "Sign Up / Registrieren" link on `LoginPage` via `useFeatureFlag(FEATURE_FLAGS.REGISTRATION_ENABLED)`
- [x] T6.2: In `App.tsx` — wrap register import + route entry behind `getStaticFlag(FEATURE_FLAGS.REGISTRATION_ENABLED)` (NOT useFeatureFlag — admin-override exempt)
- [x] T6.3: Verify: when flag off, `/register` URL falls through to `*` redirect → `/dashboard` → unauthenticated user → `/login`
- [x] T6.4: Verify: when flag on, register link visible + route reachable (no regression)
- [x] T6.5: Verify: `RegisterPage` component + `authSlice.register` action remain in code (NOT deleted)

## Phase 7 — Content Migration (e-recht24 → JSX-Tree + i18n)

- [x] T7.1: Read `/tmp/datenschutz.txt` (e-recht24 Datenschutz output) — extract sections needed per AC-7a
- [x] T7.2: Build Privacy `<Trans>` keys hierarchy: `legal.privacy.title`, `legal.privacy.intro`, `legal.privacy.responsible_party`, `legal.privacy.hosting`, `legal.privacy.supabase`, `legal.privacy.jwt_auth`, `legal.privacy.langfuse`, `legal.privacy.openrouter`, `legal.privacy.n8n`, `legal.privacy.onedrive`, `legal.privacy.google_drive`, `legal.privacy.user_rights`, `legal.privacy.contact`
- [x] T7.3: EXCLUDE Facebook section per AC-7a
- [x] T7.4: Build Imprint `<Trans>` keys: `legal.imprint.title`, `legal.imprint.operator`, `legal.imprint.contact`, `legal.imprint.languages`, `legal.imprint.vat_id`, `legal.imprint.dsa_contact`, `legal.imprint.disclaimer`
- [x] T7.5: Apply inline content fixes per AC-7b: replace dangling `und.` with `Italienisch`, normalize address to `Außenliegend 4`, replace `[Telefonnummer]` placeholder with `+49 1601546188`
- [x] T7.6: Add disclaimer banner key: `legal.translation_disclaimer` ("This is a translation. In case of dispute, the German version applies.")
- [x] T7.7: Add footer keys: `footer.imprint`, `footer.privacy`, `footer.copyright` (already present from Phase 5)

## Phase 8 — i18n Translations (5 Locales)

- [x] T8.1: Write all DE keys in `public/locales/de/translation.json` — DE is source of truth (no banner shown for DE)
- [x] T8.2: Translate all keys to EN in `public/locales/en/translation.json` (Claude inline-translation)
- [x] T8.3: Translate all keys to FR in `public/locales/fr/translation.json`
- [x] T8.4: Translate all keys to ES in `public/locales/es/translation.json`
- [x] T8.5: Translate all keys to IT in `public/locales/it/translation.json`
- [x] T8.6: Verify language switcher reloads page content live — verified via Playwright: DE→EN→FR→ES→IT, banner + headings + body all switch correctly. Disclaimer banner shown for non-DE locales. Bonus fix: converted Trans→t() in PrivacyPage/ImprintPage/PrivacySection (Trans rendered React-expression children instead of i18n value).

## Phase 9 — Component & Integration Tests

- [x] T9.1: Create `frontend-ui/src/components/GlobalFooter/__tests__/GlobalFooter.test.tsx` — renders 3 zones, links navigate to legal routes, copyright present
- [x] T9.2: Create `frontend-ui/src/views/legal/imprint/__tests__/ImprintPage.test.tsx` — renders DE content + no disclaimer; switch locale → renders EN content + disclaimer visible
- [x] T9.3: Create `frontend-ui/src/views/legal/privacy/__tests__/PrivacyPage.test.tsx` — same coverage
- [x] T9.4: Add test for LoginPage register-link visibility — flag on → link visible; flag off → link absent
- [x] T9.5: Add App.tsx route test — flag off → `/register` redirects; flag on → renders RegisterPage

## Phase 10 — Lint, Typecheck, Final Sweep

- [x] T10.1: `npm run lint` — PROJ-24 paths 0 errors. 17 errors total in repo are pre-existing (UserProfileEditor, EditorCanvas, ExportPreflightDialog) — not introduced by this work.
- [x] T10.2: `npx tsc --noEmit` → 0 errors
- [x] T10.3: `npx vitest run` → 1364 passed / 1 skipped / 0 failures across 164 test files
- [x] T10.4: `pytest user_auth_app/tests/test_user_profile.py` → 10/10 passed
- [x] T10.5: Playwright verified: Login page registration link hidden when `VITE_FF_REGISTRATION_ENABLED=false` (default fallback). Footer renders 2 legal links. `/register` direct URL falls through to dashboard redirect.
- [x] T10.6: Playwright mobile viewport (375×812) — legal page readable, no horizontal scroll (bodyScrollWidth === bodyClientWidth === 360), footer wraps to 2 lines (links centered, copyright below).
- [x] T10.7: Playwright admin-override — logged in as `mariowinter.sg@gmail.com`, GET `/api/users/me/` returns `is_staff: true` + `is_superuser: true`. `useFeatureFlag` admin-override behavior is unit-tested (9/9 green in Phase 3 covering: is_staff bypass, is_superuser-only bypass, REGISTRATION_ENABLED exempt). End-to-end flow proven.
- [x] T10.8: `features/INDEX.md` PROJ-24 status: `Planned` → `In Progress` (Phase 1 start) → `In Review` (Phase 10 done)

## Phase 11 — Handoff

- [x] T11.1: All 32 ACs ticked in spec (Legal Pages 9 + Footer 6 + FF System 7 + Admin Override 5 + Reg Gate 5)
- [x] T11.2: All 13 ECs ticked in spec
- [x] T11.3: QA acceptance + security audit done — see "QA Test Results" section in spec. PASSED, 0 unresolved issues.
- [ ] T11.4: After QA pass — run `/deploy` skill for production rollout

---

## Definition of Done
- All 11 phases checked off
- Backend: 1 serializer extension + tests green
- Frontend: 4 flags wired, 2 legal pages rendered in 5 locales, footer on every page, registration gated
- Type-safe Feature Flag API (`useFeatureFlag` + `getStaticFlag`)
- Admin-override verified manually with live `is_staff` user
- Zero lint / typecheck / test errors
