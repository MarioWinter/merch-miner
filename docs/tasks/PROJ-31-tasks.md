# PROJ-31 — Entitlement & Permission Gating — Task Breakdown

Spec: [`features/PROJ-31-entitlement-permission.md`](../../features/PROJ-31-entitlement-permission.md)
Branch: `feature/PROJ-31-entitlement-permission` (off main, already checked out)

> Every task is a `- [ ]` checkbox. `/backend` + `/frontend` flip them as completed; `/qa` verifies; `/deploy` checks all flipped before release.

---

## Phase 0 — Pre-flight Audit

- [ ] T0.1: Confirm on branch `feature/PROJ-31-entitlement-permission` (already created off main)
- [ ] T0.2: Run pytest + Vitest baseline — record current green count (so Phase 5 can compare)
- [ ] T0.3: Grep audit — every `useFeatureFlag` + `getStaticFlag` + `FEATURE_FLAGS` + `VITE_FF_` callsite catalogued in this task file (already in spec Tech Design "PROJ-24 cleanup map")
- [ ] T0.4: Inspect `views/amazon/research/partials/ControlsRow.tsx` — confirm exact flag(s) used, decide migration target
- [ ] T0.5: Verify `fallbackFlags` defaults (all 6 must be `false` today) — confirms zero net behaviour change for end-users post-migration

---

## Phase 1 — Backend Foundation

- [ ] T1.1: Add `subscription_tier` CharField to `user_auth_app/models.py` `User` model (choices: free/pro/premium/business; default `'free'`; `db_index=True`; max_length=16)
- [ ] T1.2: Generate migration `python manage.py makemigrations` → review SQL → verify DEFAULT `'free'` applies to existing rows
- [ ] T1.3: Apply migration in dev: `python manage.py migrate`
- [ ] T1.4: Confirm Mario (superuser account) gets `subscription_tier = 'free'` after migration (the wildcard `'*'` comes from `is_superuser`, not tier)
- [ ] T1.5: Create `django-app/core/entitlements.py`:
  - [ ] `TIER_FEATURES` dict with initial catalogue (free: 4 keys; pro/premium/business: placeholder for now)
  - [ ] `STAFF_ONLY_FEATURES` list (5 ex-PROJ-24 flags + 3 admin keys)
  - [ ] `SUPERUSER_FEATURES = ['*']`
  - [ ] `resolve_features(user) -> list[str]` with dedup logic
- [ ] T1.6: Create `user_auth_app/api/permissions.py` (or add to existing) — `HasFeature` DRF permission class with logging
- [ ] T1.7: Extend `UserProfileSerializer` (line 365 of `serializers.py`) — add `subscription_tier` (model field) and `features` (`SerializerMethodField` calling `resolve_features`)
- [ ] T1.8: Add `subscription_tier` to `UserAdmin` (`user_auth_app/admin.py`) as editable dropdown
- [ ] T1.9: pytest `test_entitlements.py` — covers each tier resolution, staff append, superuser wildcard, dedup
- [ ] T1.10: pytest `test_has_feature_permission.py` — granted (200), denied (403), wildcard (200), logging assertion
- [ ] T1.11: pytest extend `test_me_payload.py` — assert `subscription_tier` + `features[]` in response for each user type
- [ ] T1.12: Run `docker compose exec web pytest` — zero new failures

---

## Phase 2 — Frontend Primitives

- [ ] T2.1: Extend `frontend-ui/src/types/auth.ts` — `User` interface gains `subscription_tier: string` + `features: string[]`
- [ ] T2.2: Extend `frontend-ui/src/store/authSlice.ts`:
  - [ ] State shape adds `subscription_tier` + `features`
  - [ ] Reducer/action that sets these from `/me/` payload (likely existing `setUser` action — extend)
  - [ ] Default values: `subscription_tier: 'free'`, `features: []`
- [ ] T2.3: Update `services/authService.ts` `/me/` fetch — TypeScript types pass through new fields
- [ ] T2.4: Create `frontend-ui/src/constants/featureKeys.ts` — typed catalogue mirroring backend STAFF_ONLY + future tier keys
- [ ] T2.5: Create `frontend-ui/src/hooks/useCan.ts` — `useCan(feature: string): boolean` reads authSlice; handles wildcard
- [ ] T2.6: Vitest `hooks/__tests__/useCan.test.ts` — granted, denied, wildcard, empty features
- [ ] T2.7: Create `frontend-ui/src/components/Gate.tsx` — wrapper component:
  - [ ] Renders children when `useCan(feature) === true`
  - [ ] Renders `fallback` prop (optional, default null) otherwise
  - [ ] TypeScript prop interface
- [ ] T2.8: Vitest `components/__tests__/Gate.test.tsx` — renders, hides, fallback, wildcard
- [ ] T2.9: Run `npm run lint && npm run test:ci` (from `frontend-ui/`) — zero new failures

---

## Phase 3 — PROJ-24 Cleanup (Clean Cut Removal)

- [ ] T3.1: Rename ENV var `VITE_FF_REGISTRATION_ENABLED` → `VITE_ENABLE_REGISTRATION` in:
  - [ ] `frontend-ui/.env*` template files
  - [ ] `docs/` references if any
  - [ ] `frontend-ui/src/utils/getStaticFlag.ts` (trim to single-case API)
- [ ] T3.2: Update `App.tsx` line 44 — replace `getStaticFlag(FEATURE_FLAGS.REGISTRATION_ENABLED)` with new minimal `getStaticFlag('REGISTRATION_ENABLED')` (or directly `import.meta.env.VITE_ENABLE_REGISTRATION === 'true'`)
- [ ] T3.3: Update `views/auth/login/LoginPage.tsx` + its test — same env var rename
- [ ] T3.4: MIGRATE `components/MarketplaceSelect/index.tsx` — replace `useFeatureFlag(MULTI_MARKETPLACE_ENABLED)` with `useCan('amazon.multi-marketplace')`
- [ ] T3.5: MIGRATE `views/amazon/keywords/research/partials/EnrichButton.tsx` — replace KEYWORD_ENRICH_ENABLED with `useCan('keyword.junglescout')`
- [ ] T3.6: MIGRATE `views/amazon/keywords/research/partials/FloatingActionBar.tsx` — same migration
- [ ] T3.7: MIGRATE `views/amazon/research/partials/ControlsRow.tsx` — per Phase 0 inspection result
- [ ] T3.8: REMOVE references to `useFeatureFlag` in `store/authSlice.ts`
- [ ] T3.9: DELETE `frontend-ui/src/hooks/useFeatureFlag.ts`
- [ ] T3.10: DELETE `frontend-ui/src/hooks/__tests__/useFeatureFlag.test.tsx`
- [ ] T3.11: DELETE `frontend-ui/src/constants/featureFlags.ts` (keep only the `REGISTRATION_ENABLED` key if `getStaticFlag` still needs it, else delete entirely and inline the string)
- [ ] T3.12: Update or DELETE `frontend-ui/src/utils/__tests__/getStaticFlag.test.ts` — keep tests for the single REGISTRATION_ENABLED case; delete the rest
- [ ] T3.13: Grep verify — zero remaining `useFeatureFlag` imports anywhere in `src/`
- [ ] T3.14: Run `npm run lint && npm run test:ci` — zero new failures, zero unused-import warnings

---

## Phase 4 — Apply Gates to Known Staff Features (Pilot)

> Small first pass to verify end-to-end. Bulk migration of other features (e.g., admin-only buttons across the app) is OUT OF SCOPE for PROJ-31 — handled per-feature when those features touch their owning PROJ.

- [ ] T4.1: Pilot — wrap an existing admin-only UI element (e.g., scraper debug button in admin views) with `<Gate feature="admin.scraper-debug">`
- [ ] T4.2: Apply `HasFeature` to one backend endpoint matching the pilot (e.g., scraper debug admin endpoint)
- [ ] T4.3: Manual test: as `subscription_tier='free'` non-staff user, verify element hidden + endpoint returns 403; as superuser (Mario), verify element visible + endpoint succeeds
- [ ] T4.4: Document in spec: bulk gate-application for other features deferred to per-PROJ work

---

## Phase 5 — Final Verification + PR

- [ ] T5.1: Run `docker compose exec web pytest` — all green (Phase 1 baseline)
- [ ] T5.2: Run `npm run test:ci` (frontend-ui/) — all green
- [ ] T5.3: Run `docker compose exec web ruff check django-app/` — zero new errors (full scope)
- [ ] T5.4: Run `npm run lint` (frontend-ui/) — zero new errors (full scope)
- [ ] T5.5: Grep verify — zero `useFeatureFlag` imports, zero `VITE_FF_` env references (except renamed `VITE_ENABLE_REGISTRATION`)
- [ ] T5.6: Update `docs/architecture-decisions.md` ADR-001 status line:
  - [ ] FROM: "Decided (frontend Feature Flags shipping in PROJ-24; Entitlements layer is Post-MVP, Permissions exist per feature)"
  - [ ] TO: "Decided (Entitlements = PROJ-31; build-time Feature Flags removed; Polar.sh integration = PROJ-32)"
- [ ] T5.7: Update `features/INDEX.md`:
  - [ ] PROJ-24 status: "In Review" → "Superseded by PROJ-31"
  - [ ] PROJ-31 status: "Planned" → "In Review"
- [ ] T5.8: Update `docs/PRD.md` roadmap table: same status flips
- [ ] T5.9: Commit each phase as standalone commit (`feat(PROJ-31): phase 1 — ...`); final PR title: `feat(PROJ-31): runtime entitlement + permission gating (replaces PROJ-24 build-time FF)`
- [ ] T5.10: Open PR against `main`; reference spec + ADR; QA checklist in PR description
- [ ] T5.11: Manual smoke after merge: visit prod, verify Mario sees admin features, register a test free-tier user, confirm they don't see staff features

---

## Estimated Effort

| Phase | Tasks | Effort |
|---|---|---|
| 0 — Audit | 5 | 30 min |
| 1 — Backend | 12 | 3 h |
| 2 — Frontend Primitives | 9 | 3 h |
| 3 — PROJ-24 Cleanup | 14 | 3 h |
| 4 — Pilot Gate | 4 | 1 h |
| 5 — Verification + PR | 11 | 1 h |
| **Total** | **55** | **~11 h** |
