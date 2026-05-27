# PROJ-31: Entitlement & Permission Gating System

## Status: In Review
**Created:** 2026-05-15
**Last Updated:** 2026-05-15

## Dependencies
- None (extends existing User model + DRF auth)
- **Supersedes:** PROJ-24 build-time Feature Flag System (`useFeatureFlag`, `VITE_FF_*`) — removed in same PR
- **Prepares:** PROJ-32 (Polar.sh subscription integration) — Polar webhook will write to `user.subscription_tier` field

## Goal
Single runtime-driven gating system that hides UI elements per user. Replaces build-time feature flags. Foundation for paid tiers (Free/Pro/Premium/Business) and staff-only beta features. Backend is the security boundary; frontend hides + UX-disables.

Architecture pattern is fully spelled out in `docs/architecture-decisions.md` ADR-001 (2-Layer Entitlement + Permission model). This spec implements that contract.

## User Stories
- As Mario (Superuser), I want to see and use every feature in the app regardless of tier or beta state — no friction for the maintainer
- As a staff member, I want access to in-development features (`experimental.*`, `admin.*`) that regular users do not see
- As a Free tier user, I want to NOT see features I cannot use (no broken UI, no dead buttons)
- As a Pro tier user, I want all Pro features available without manual feature-flag toggles
- As a backend developer, I want a single `HasFeature('design.upscaler')` permission class that I can drop on any DRF view
- As a frontend developer, I want a `<Gate feature="x">` wrapper AND a `useCan('x')` hook so I can pick the right tool per situation

## Design Decisions (signed off via A/B/C)

| # | Question | Choice | Why |
|---|---|---|---|
| Q1 | Plan default for existing users | **B + Superuser bypass** — all existing users default to `'free'`; Mario (Superuser) gets `SUPERUSER_FEATURES = ['*']` wildcard | Realistic test of Free tier from day 1; Superuser bypass keeps Mario from being limited by his own gating |
| Q2 | `<Gate>` default UX when feature missing | **A now → B later** — Hide silently for MVP. After Beta phase, add opt-in `paywall` prop to `<Gate>` for "Upgrade to unlock" CTA on selected paywalled features | Simplest default. Forward-compatible: adding a prop later is non-breaking. |
| Q3 | Frontend API | **A — both `<Gate>` Wrapper + `useCan()` Hook** | Wrapper for declarative ("hide this block"), Hook for imperative ("disable button + tooltip") |
| Q4 | Feature-key naming | **A — `dotted.namespace.action`** (e.g. `design.upscaler`, `niche.bulk-edit`, `admin.scraper-debug`) | Grep-friendly, hierarchical, industry-standard |
| Q5 | PROJ-24 cleanup | **A — Complete removal in PROJ-31 PR** | Single source of truth. PROJ-24 marked "Superseded by PROJ-31" |
| Q6 | Config location | **A — `django-app/core/entitlements.py`** (single file) | Single source of truth; <150 LOC keeps file lean |
| Q7 | `/api/auth/me/` payload shape | **A — Flat** `{ subscription_tier, features: ['design.upscaler', ...] }` | `useCan(f)` is just `features.includes(f)`. Trivial frontend consumption |
| Q8 | Denied-access logging | **B — Backend Logger** with feature-key per 403 | Server-side audit trail for debugging + later analytics. Frontend events deferred |

### Wildcard handling (Superuser)
- `SUPERUSER_FEATURES = ['*']` — `resolve_features(user)` returns `['*']` for superusers; `useCan(anyFeature)` returns `true` when `features.includes('*')` OR `features.includes(feature)`. Frontend hook and backend permission class both handle the wildcard.

## Acceptance Criteria

### Backend

- [ ] AC-1: `User` model has new `subscription_tier` CharField with choices (`'free' | 'pro' | 'premium' | 'business'`), default `'free'`, indexed
- [ ] AC-2: Migration backfills all existing users to `'free'` (Superusers keep `'free'` too — bypass works via `is_superuser` flag, not tier)
- [ ] AC-3: `django-app/core/entitlements.py` defines `TIER_FEATURES`, `STAFF_ONLY_FEATURES`, `SUPERUSER_FEATURES = ['*']`, and `resolve_features(user) -> list[str]`
- [ ] AC-4: `resolve_features(user)` returns: `TIER_FEATURES[tier] + (STAFF_ONLY_FEATURES if is_staff) + (['*'] if is_superuser)` — deduplicated
- [ ] AC-5: `/api/auth/me/` response includes `subscription_tier: str` and `features: list[str]` (flat) — backward compatible with existing fields
- [ ] AC-6: DRF permission class `HasFeature('feature.key')` exists; composable with existing `IsAuthenticated` and `IsWorkspaceMember`
- [ ] AC-7: `HasFeature` returns `True` if `'*' in resolve_features(user)` OR `feature in resolve_features(user)`; else `False` (causing 403)
- [ ] AC-8: 403 responses caused by `HasFeature` include log entry: `WARNING entitlement.denied user_id={id} feature={key} path={path}` for observability
- [ ] AC-9: Django Admin: User edit page shows `subscription_tier` field as dropdown
- [ ] AC-10: Tests: `resolve_features()` unit tests for each tier + staff + superuser; `/me/` payload test; `HasFeature` permission tests for granted + denied

### Frontend

- [ ] AC-11: Redux `authSlice` extended with `subscription_tier: string` and `features: string[]` (default `'free'` and `[]`)
- [ ] AC-12: `authService.fetchMe()` parses new fields into authSlice on login + on app boot
- [ ] AC-13: New hook `useCan(feature: string): boolean` in `frontend-ui/src/hooks/useCan.ts` — reads from authSlice; returns `true` when `features.includes('*')` OR `features.includes(feature)`
- [ ] AC-14: New component `<Gate feature="x">{children}</Gate>` in `frontend-ui/src/components/Gate.tsx` — renders children only if `useCan(feature) === true`; renders `null` otherwise
- [ ] AC-15: `<Gate>` accepts optional `fallback?: ReactNode` prop — renders when not entitled (for "Upgrade" CTAs added later, but works now for "use this instead" patterns)
- [ ] AC-16: PROJ-24 artifacts REMOVED in same PR: `useFeatureFlag` hook, `VITE_FF_*` env handling, related code in `frontend-ui/src/config/featureFlags.ts` (or wherever it lives). All existing usages migrated to `useCan` with new feature keys, OR deleted if obsolete
- [ ] AC-17: Vitest: `useCan` (granted, denied, wildcard); `<Gate>` (renders children when entitled, hidden when not, fallback when not + fallback provided); authSlice (parses features on /me/ payload)
- [ ] AC-18: TypeScript: `features` typed as `string[]` (NOT a string literal union — feature keys are runtime config, not compile-time)

### Cross-cutting

- [ ] AC-19: Existing Vitest suite stays green (`npm run test:ci`) — zero new failures
- [ ] AC-20: Backend pytest suite stays green — zero new failures
- [ ] AC-21: ESLint + Ruff pass (full project scope per `feedback_lint_full_scope.md`)
- [ ] AC-22: `docs/architecture-decisions.md` ADR-001 updated: status flips from "Decided (frontend Feature Flags shipping in PROJ-24; Entitlements layer is Post-MVP)" → "Decided (Entitlements layer = PROJ-31; build-time Flags removed; Polar.sh integration = PROJ-32)"
- [ ] AC-23: PROJ-24 status in `features/INDEX.md` and `docs/PRD.md` flips to "Superseded by PROJ-31"

## Edge Cases

- [ ] EC-1: User upgrades tier (admin sets `pro` → `business`) — frontend reflects new features on next `/me/` poll OR on next login. Document: NO real-time push for MVP; user refresh suffices
- [ ] EC-2: User downgrades tier (`business` → `free`) and is currently on a page using a removed feature — the UI element disappears on next render after `/me/` fetch; existing API calls in flight succeed (no mid-request 403)
- [ ] EC-3: Backend `TIER_FEATURES` is updated (new feature added to `pro`) — no migration needed; next `/me/` fetch returns updated list
- [ ] EC-4: Frontend has stale `features[]` cached in Redux while backend has updated tier — `HasFeature` server-side check is the security guarantee; UI may briefly show then hide a feature
- [ ] EC-5: User is `is_staff=True` but tier is `'free'` — they see `TIER_FEATURES['free']` + `STAFF_ONLY_FEATURES`. Combined list dedup'd
- [ ] EC-6: Superuser revoked (Mario sets `is_superuser=False` on himself in admin) — `resolve_features` returns only tier features. Wildcard `'*'` no longer in list. UI reflects on next `/me/`
- [ ] EC-7: Feature-key typo in `<Gate feature="design.upscalr">` — silently hides children (no error). Spec recommends adding eslint-rule or constant catalogue (Non-Goal for MVP — too much ceremony)
- [ ] EC-8: User unauthenticated calls `/me/` — returns 401; frontend resets authSlice including `features: []`. All `<Gate>` components return null
- [ ] EC-9: Existing PROJ-24 `useFeatureFlag('CLOUD_STORAGE_ENABLED')` callsites — migrate to `useCan('cloud.storage')` (or delete if obsolete). Pre-flight grep audit task in Phase 0
- [ ] EC-10: User belongs to two workspaces with different tiers — out-of-scope: tier is per-User, not per-Workspace (matches PROJ-4 design where billing is user-level). Document explicitly

## Technical Requirements

- **Backend:** Django 5.2, DRF, no new packages
- **Frontend:** React 19, MUI v7, no new packages
- **Migration:** one Django migration adding `subscription_tier` field with default `'free'`
- **Performance:** `/me/` response stays under 50KB; `resolve_features()` is pure-Python in-memory lookup (<1ms)
- **Security:** `HasFeature` permission class is the security boundary; `<Gate>` is UX-only and MUST NOT be trusted for security
- **Backward compat:** existing `/me/` fields unchanged; `subscription_tier` and `features` are additive
- **Observability:** Standard Django `logging` module — channel name `entitlement.denied`. No external service.

## Out of Scope (Non-Goals)

- **Polar.sh integration** — separate PROJ-32 (Polar webhook will write to `user.subscription_tier`)
- **Subscription model with billing history** — PROJ-32
- **Customer Portal / Upgrade flow UI** — PROJ-32
- **Credit-based limits / usage quotas** — separate concern; "Business gets credit limits" mentioned by user but will be solved with its own dedicated model (per-user, per-month counter) in a later PROJ, NOT via the binary entitlement system
- **A/B test framework**
- **Time-limited trials** (e.g., "30 days Pro free")
- **Frontend Analytics events** for `paywall-shown` (Q8 deferred to a later analytics PROJ if/when Polar.sh's built-in analytics is insufficient)
- **eslint-plugin for feature-key validation** — Q-EC-7 risk accepted for MVP
- **Per-workspace tier override** — tier is per-User globally (EC-10)
- **Tier upgrade in-app flow** — admin-only via Django Admin for PROJ-31; in-app flow comes with PROJ-32 Polar

---

## Open Questions for User

None — Q1–Q8 all answered, edge cases captured. Ready for `/architecture`.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Architecture decisions (Q1–Q8 from spec + Q-A1/Q-A2 from architecture phase)

| Decision | Choice | Why |
|---|---|---|
| Plan default for existing users | `'free'` for all; Mario via `is_superuser` wildcard | Realistic Free-tier test from day 1 |
| `<Gate>` UX | Hide silent by default; `paywall` prop added later (non-breaking) | Simplest default, forward-compatible |
| Frontend API | Both `<Gate>` wrapper AND `useCan()` hook | Declarative + imperative coverage |
| Feature-key naming | `dotted.namespace.action` | Hierarchical, grep-friendly |
| PROJ-24 cleanup | Complete removal in same PR | Single source of truth |
| Config location | Single file `core/entitlements.py` | <150 LOC, single SoT |
| `/me/` payload shape | Flat: `{ subscription_tier, features: [...] }` | Trivial frontend consumption |
| Denied-access logging | Backend logger `entitlement.denied` per 403 | Audit trail, no extra service |
| **Q-A1** REGISTRATION pre-auth flag | Keep as ENV `VITE_ENABLE_REGISTRATION` (1 special case) | Pre-auth flag, no entitlement possible |
| **Q-A2** Initial tier mapping | Conservative — all 5 migratable PROJ-24 flags → `STAFF_ONLY_FEATURES` first; later move into paid tiers when pricing finalised | Avoids premature pricing commitment |

### Backend data model (extension to existing `User` model)

| Field | Type | Default | Indexed | Notes |
|---|---|---|---|---|
| `subscription_tier` | CharField (choices: free/pro/premium/business), max_length=16 | `'free'` | yes | Polar webhook (PROJ-32) will write here |

No new model. One Django migration adds the field.

### Backend file structure

```
django-app/
├── core/
│   └── entitlements.py                       [NEW]
│       ├── TIER_FEATURES: dict[tier, list[feature_key]]
│       ├── STAFF_ONLY_FEATURES: list[feature_key]
│       ├── SUPERUSER_FEATURES = ['*']
│       └── resolve_features(user) -> list[str]
├── user_auth_app/
│   ├── models.py                             [MODIFY: add subscription_tier]
│   ├── migrations/00XX_subscription_tier.py  [NEW]
│   ├── admin.py                              [MODIFY: expose subscription_tier on UserAdmin]
│   ├── api/
│   │   ├── serializers.py                    [MODIFY: UserProfileSerializer adds subscription_tier + features]
│   │   ├── permissions.py                    [NEW: HasFeature class]
│   │   └── views.py                          [unchanged — UserProfileView auto-picks new serializer fields]
│   └── tests/
│       ├── test_entitlements.py              [NEW]
│       ├── test_has_feature_permission.py    [NEW]
│       └── test_me_payload.py                [MODIFY: assert subscription_tier + features in response]
```

### Backend API extension

| Endpoint | Method | Change |
|---|---|---|
| `/api/users/me/` | GET | Response gains `subscription_tier: str` + `features: list[str]` (resolved via `resolve_features(user)`) |

No new endpoints. No URL changes.

### Backend permission class behavior

`HasFeature('feature.key')`:
1. Requires authenticated user (else 401)
2. Calls `resolve_features(user)` → list of strings
3. Returns `True` if `'*' in features` OR `feature.key in features`
4. Returns `False` → DRF auto-emits 403
5. On `False`, logs `WARNING entitlement.denied user_id={id} feature={key} path={request.path}` via standard `logging` module, channel name `entitlement.denied`

Composes with existing classes: `permission_classes = [IsAuthenticated, IsWorkspaceMember, HasFeature('design.upscaler')]`.

### Frontend file structure

```
frontend-ui/src/
├── hooks/
│   ├── useCan.ts                             [NEW: useCan(feature) -> boolean]
│   └── __tests__/useCan.test.ts              [NEW]
├── components/
│   ├── Gate.tsx                              [NEW: <Gate feature> {children} </Gate>]
│   └── __tests__/Gate.test.tsx               [NEW]
├── store/
│   └── authSlice.ts                          [MODIFY: add subscription_tier + features[]; reducer for setMe]
├── services/
│   └── authService.ts                        [MODIFY: parse new /me/ fields]
├── types/
│   └── auth.ts                               [MODIFY: User interface adds subscription_tier + features]
├── constants/
│   └── featureKeys.ts                        [NEW: catalogue of all feature keys as typed constants]
├── utils/
│   └── getStaticFlag.ts                      [MODIFY: trim to single VITE_ENABLE_REGISTRATION case + comment]
└── hooks/
    └── useFeatureFlag.ts                     [DELETE]
└── constants/featureFlags.ts                 [DELETE]
└── hooks/__tests__/useFeatureFlag.test.tsx   [DELETE]
└── utils/__tests__/getStaticFlag.test.ts     [MODIFY: keep tests for single case]
```

### PROJ-24 cleanup map (per file)

| File | Action | Maps to |
|---|---|---|
| `App.tsx` line 29,44 — `getStaticFlag(FEATURE_FLAGS.REGISTRATION_ENABLED)` | KEEP as `getStaticFlag('REGISTRATION_ENABLED')` after refactor; env var renamed to `VITE_ENABLE_REGISTRATION` | Special pre-auth flag (Q-A1) |
| `views/auth/login/LoginPage.tsx` — uses REGISTRATION_ENABLED | KEEP as ENV-driven | Pre-auth special case |
| `views/auth/login/tests/LoginPage.test.tsx` | KEEP, update env var name | — |
| `components/MarketplaceSelect/index.tsx` — `useFeatureFlag(MULTI_MARKETPLACE_ENABLED)` | MIGRATE → `useCan('amazon.multi-marketplace')` | STAFF_ONLY (Q-A2) |
| `views/amazon/keywords/research/partials/EnrichButton.tsx` — KEYWORD_ENRICH_ENABLED | MIGRATE → `useCan('keyword.junglescout')` | STAFF_ONLY |
| `views/amazon/keywords/research/partials/FloatingActionBar.tsx` — KEYWORD_ENRICH_ENABLED | MIGRATE → `useCan('keyword.junglescout')` | STAFF_ONLY |
| `views/amazon/research/partials/ControlsRow.tsx` — KEYWORD_ENRICH_ENABLED or MULTI_MARKETPLACE | INSPECT + MIGRATE per actual usage | STAFF_ONLY |
| `store/authSlice.ts` — imports useFeatureFlag | REMOVE import, refactor any usage to direct flag-less code | — |
| `constants/featureFlags.ts` | DELETE | — |
| `hooks/useFeatureFlag.ts` | DELETE | — |
| `hooks/__tests__/useFeatureFlag.test.tsx` | DELETE | — |

### Initial feature catalogue (`django-app/core/entitlements.py`)

| Tier | Features |
|---|---|
| `free` | `niche.research`, `amazon.basic-search`, `design.gallery`, `slogan.basic` |
| `pro` | (free) + (placeholder — to be filled when pricing finalised) |
| `premium` | (free) + (placeholder) |
| `business` | (free) + (placeholder) |

| Group | Features |
|---|---|
| `STAFF_ONLY_FEATURES` | `amazon.multi-marketplace`, `keyword.junglescout`, `cloud.storage`, `desktop.upload`, `kanban`, `experimental.new-editor`, `admin.scraper-debug`, `admin.user-impersonate` |
| `SUPERUSER_FEATURES` | `['*']` |

Rationale: all 5 ex-PROJ-24 flags + 3 future admin keys start in STAFF_ONLY. As pricing tiers solidify, individual keys move from `STAFF_ONLY_FEATURES` into a paid tier in `TIER_FEATURES`. One-line edit per migration, no callsite changes.

### Frontend feature-key catalogue (`frontend-ui/src/constants/featureKeys.ts`)

Strongly-typed constants mirroring backend, so IDE can autocomplete + grep finds keys. Frontend does NOT contain tier-→-feature mapping (backend resolves), only the key names.

```
FEATURE_KEYS = {
  'amazon.multi-marketplace',
  'keyword.junglescout',
  'cloud.storage',
  'desktop.upload',
  'kanban',
  'experimental.new-editor',
  'admin.scraper-debug',
  'admin.user-impersonate',
  ...
}
```

### Test strategy

| Layer | What | Tool |
|---|---|---|
| Unit | `resolve_features()` per tier + staff + superuser + dedup | pytest |
| Unit | `HasFeature` permission: granted, denied with logging, wildcard | pytest |
| Unit | `/me/` payload includes `subscription_tier` + `features` | pytest (extends existing me-test) |
| Unit | `useCan` hook: granted, denied, wildcard | Vitest |
| Unit | `<Gate>` component: renders children entitled, hides when not, fallback prop | Vitest |
| Unit | authSlice: setMe parses features[] from /me/ payload | Vitest |
| Regression | Existing pytest + Vitest suites stay green | both |

### Dependencies (packages)

**None.** Existing Django 5.2 + DRF + React 19 + MUI v7 cover everything.

### Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Misnamed feature key in `<Gate feature="design.upscalr">` silently hides UI | MED | MED | `featureKeys.ts` const catalogue + TypeScript autocomplete + grep-based audit task |
| Existing user loses access after migration | LOW | HIGH | Mario as superuser is wildcarded; other users keep status-quo (all PROJ-24 flags were OFF anyway) |
| Stale `features[]` in Redux after admin upgrades user | MED | LOW | Document: refresh page after tier change. Real-time push out of scope. |
| `getStaticFlag` (REGISTRATION_ENABLED only remaining) becomes confusing dual system | LOW | LOW | Inline comment + 1-paragraph note in `useCan.ts` JSDoc explaining "Why two systems? Pre-auth case." |
| 5 PROJ-24 flags as STAFF_ONLY means non-staff users LOSE these UI elements compared to today | LOW | MED | Verify each flag's current `fallbackFlags` value — all 6 default to `false` (per `constants/featureFlags.ts`), so non-staff DO NOT see them today either. Net behaviour change: zero. |
| ADR-001 in `docs/architecture-decisions.md` references PROJ-24 as "shipping" | LOW | LOW | Phase 5 updates ADR status |

### Default-OFF audit (critical sanity check)

`fallbackFlags` in current code:
- REGISTRATION_ENABLED: `false` → users today DON'T see register link
- CLOUD_STORAGE_ENABLED: `false` → users today DON'T see cloud picker
- DESKTOP_UPLOAD_APP_ENABLED: `false` → users today DON'T see desktop link
- KANBAN_ENABLED: `false` → users today DON'T see kanban
- MULTI_MARKETPLACE_ENABLED: `false` → users today DON'T see other markets
- KEYWORD_ENRICH_ENABLED: `false` → users today DON'T see JungleScout button

**Conclusion:** Putting all 5 migrated flags into STAFF_ONLY produces ZERO net visible change for end-users. Staff (Mario) will continue to see them via STAFF_ONLY_FEATURES. Safe migration.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
