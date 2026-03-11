# PROJ-4: Workspace & Membership

**Status:** In Review
**Priority:** P0 (MVP)
**Created:** 2026-02-27
**Updated:** 2026-03-07

## Overview

Multi-tenant workspace layer + user profile self-management + billing info preparation for Polar.sh.
Users belong to at least one `Workspace`. All downstream data scopes to workspace via FK.
Membership roles: admin and member. Invitation via email.
Settings page (gear icon + sidebar) exposes: Profile tab, Billing tab, Workspace tab.

> **Role terminology:** "Admin" throughout this spec means **Workspace Admin** — a regular user with the `admin` role in a given `Membership` record. It has nothing to do with Django's `is_staff` / `is_superuser` flags or the Django Admin panel.

---

## User Stories

**Workspace:**
1. As a new user on first login, I want a personal workspace auto-created, so I can start immediately.
2. As an admin, I want to invite team members by email, so we can collaborate in the same workspace.
3. As an invited user, I want to accept/decline via email link, so I control workspace access.
4. As an admin, I want to change a member's role or remove them, so I manage access appropriately.
5. As an admin, I want to rename my workspace, so its name reflects my brand.
6. As a member, I want to see only my workspace's data, so other teams' data is never visible.

**User Profile:**
7. As a user, I want to view my profile (name, email, username, avatar).
8. As a user, I want to update my first name, last name, and username.
9. As a user, I want to upload an avatar image stored on the server.
10. As a user, I want to change my password inline (current + new + confirm).

**Billing Info (Polar.sh prep — all fields optional):**
11. As a user, I want to select account type: personal or business.
12. As a user, I want to fill a billing address (street, city, state/region, postal code, country).
13. As a business user, I want to add company name + VAT / tax ID.
14. My billing info is stored and will be passed to Polar.sh on subscription creation (deferred).
15. The country field supports all EU member states, US, CA, UK, AU, JP, SG, and common others.

---

## Acceptance Criteria

### Models
1. `Workspace`: UUID pk, name (max 100), slug (unique, max 110), owner FK → User, created_at.
2. `Membership`: workspace FK, user FK, role [admin|member], status [pending|active], invited_by FK (nullable), invited_at, accepted_at (nullable). Unique: (workspace, user).
3. `BillingProfile`: OneToOne → User, account_type [personal|business], company_name (nullable), vat_number (nullable), address_line1, address_line2 (nullable), city, state_region (nullable), postal_code, country (ISO 3166-1 alpha-2, CharField max 2), created_at, updated_at.
4. `User` model: add `avatar` field (URLField, blank=True) storing absolute URL served via `MEDIA_URL`.

### Workspace Endpoints
5. Auto-create personal workspace on user creation (post_save signal) if user has no memberships.
6. `GET /api/workspaces/me/` — return active workspaces + role for authenticated user.
7. `PATCH /api/workspaces/{id}/` — admin only; rename workspace (name field).
8. `POST /api/workspaces/{id}/invite/` — admin; create pending Membership; send signed token email.
9. `GET /api/workspaces/invite/accept/?token={token}` — public; activate membership.
10. `PATCH /api/workspaces/{id}/members/{user_id}/` — admin; change member role.
11. `DELETE /api/workspaces/{id}/members/{user_id}/` — admin; cannot remove owner.
12. All protected endpoints verify active membership; 403 if not member.

### User Profile Endpoints
13. `GET /api/users/me/` — return id, email, username, first_name, last_name, date_joined, avatar_url.
14. `PATCH /api/users/me/` — update username, first_name, last_name. Email read-only. Returns updated profile.
15. `POST /api/users/me/avatar/` — multipart/form-data; validate image (JPEG/PNG/WEBP, max 2MB); save to `MEDIA_ROOT/avatars/user_{id}/` via `FileSystemStorage`; store absolute URL on user.avatar; return `{ avatar_url }`.
16. `POST /api/auth/password/change/` — authenticated; validate current_password, new_password, confirm_password; update password; blacklist existing refresh token.

### Billing Endpoints
17. `GET /api/users/me/billing/` — return BillingProfile; create empty one if not exists (never 404).
18. `PUT /api/users/me/billing/` — upsert BillingProfile for request.user; all fields optional; validate country is valid ISO 3166-1 alpha-2.

### Frontend — Settings Page (`/settings`)
19. Accessible via: gear icon in topbar + "Settings" entry at bottom of sidebar.
20. Settings layout: left nav tabs (Profile / Billing / Workspace) + right content panel, within full app shell.
21. **Profile tab (`/settings/profile`):**
    - Avatar: circular 80px preview + upload button (MUI `Button` outlined). On upload: `CircularProgress`.
    - Fields: First Name, Last Name, Username (editable). Email: read-only `TextField` with `disabled`.
    - Password section: Current Password, New Password, Confirm Password + "Change Password" button.
    - Save button (primary). Success/error via notistack.
22. **Billing tab (`/settings/billing`):**
    - Account type: MUI `ToggleButtonGroup` [Personal | Business].
    - Business-only fields: Company Name, VAT / Tax ID.
    - Address: Line 1, Line 2 (optional), City, State/Region, Postal Code.
    - Country: MUI `Autocomplete` with ISO 3166-1 country list.
    - All fields optional (helper text: "Required for paid plans"). Save button (primary).
23. **Workspace tab (`/settings/workspace`):**
    - Workspace name: editable TextField + Save (admin only; read-only for members).
    - Member table (Dense, 44px rows): Avatar | Name | Email | Role chip | Status chip | Actions.
    - Role chip: "Admin" (primary color) / "Member" (default). Status chip: "Active" (success) / "Pending" (warning).
    - Actions: role dropdown (admin) + remove IconButton (destructive style).
    - Invite row: email TextField + "Send Invite" button.
    - Owner row: remove button hidden/disabled.
24. All user-visible strings via `useTranslation()`.
25. Forms: react-hook-form + Zod schemas.
26. Inputs: MUI TextField outlined, 40px height.

---

## API Endpoints Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users/me/` | Member | Own profile (with avatar_url) |
| PATCH | `/api/users/me/` | Member | Update own profile |
| POST | `/api/users/me/avatar/` | Member | Upload avatar to Django FileSystemStorage |
| POST | `/api/auth/password/change/` | Member | Inline password change |
| GET | `/api/users/me/billing/` | Member | Get billing profile |
| PUT | `/api/users/me/billing/` | Member | Upsert billing profile |
| GET | `/api/workspaces/me/` | Member | List user's workspaces + role |
| PATCH | `/api/workspaces/{id}/` | Workspace Admin | Rename workspace |
| POST | `/api/workspaces/{id}/invite/` | Workspace Admin | Send invite email |
| GET | `/api/workspaces/invite/accept/` | Public | Accept invite via token |
| PATCH | `/api/workspaces/{id}/members/{user_id}/` | Workspace Admin | Change member role |
| DELETE | `/api/workspaces/{id}/members/{user_id}/` | Workspace Admin | Remove member |

---

## Edge Cases

**Workspace:**
1. User already a member → 409, no duplicate Membership created.
2. Token expired (>48h) → 400, prompt re-invite.
3. Owner removal attempt → 403 "Cannot remove workspace owner."
4. User removed from all workspaces → personal workspace remains.
5. Slug collision on workspace creation → append random 4-char suffix.
6. Non-admin tries to rename workspace → 403.

**Profile:**
7. PATCH with taken username → 400 field-level error.
8. Email field in PATCH body → ignored (read-only).
9. Avatar > 2MB or unsupported type → 400 with descriptive error.
10. Wrong current_password on password change → 400.

**Billing:**
11. Invalid country code → 400.
12. Business type without VAT → allowed (VAT is optional).
13. GET billing on new user → return empty object with defaults, not 404.

---

## Design System Alignment

- Layout: settings-style left nav + right content panel
- Topbar: gear icon (`SettingsOutlined`) → `/settings`
- Sidebar: "Settings" entry at bottom, icon = `SettingsOutlined`, route = `/settings`
- Cards: Standard Card wrapping each settings panel
- Buttons: Primary / Secondary / Destructive
- Inputs: MUI TextField outlined, 40px height
- Table: Dense Data Table (44px rows) for member list
- Chips: role + status badges (color-coded)
- Avatar upload progress: MUI `CircularProgress`
- Country: MUI `Autocomplete` with full ISO 3166-1 list

---

## Dependencies

- PROJ-1 (User Auth) — post_save signal for workspace auto-creation; reuse `CookieJWTAuthentication`
- `MEDIA_ROOT/avatars/` directory auto-created by Django on first upload; served by Caddy in prod via `media_volume`
- Polar.sh integration deferred (post-MVP); billing data stored but not yet sent

---

## Implementation Notes

- New Django app: `workspace_app/` (models, views, serializers, urls, tasks, signals).
- `BillingProfile` lives in `user_auth_app/` (tightly coupled to User model).
- Avatar upload: `FileSystemStorage` saves to `MEDIA_ROOT/avatars/user_{id}/avatar.{ext}`; old file deleted before save; absolute URL built via `request.build_absolute_uri(MEDIA_URL + path)`; served by Caddy in prod.
- Password change: `user.set_password()` + `user.save()` + blacklist current refresh token via `RefreshToken(token).blacklist()`.
- Invite tokens: `django.core.signing.dumps()` / `.loads()`, `max_age=172800` (48h).
- Frontend: `views/settings/` shell with `ProfileSection`, `BillingSection`, `WorkspaceSection`.
- Country list: static ISO 3166-1 list in `data/countries.ts` — no package dependency.
- No new env vars required — uses existing `MEDIA_ROOT`/`MEDIA_URL` from Django settings.

---

## Files to Create / Modify

**Backend (new):**
- `django-app/workspace_app/__init__.py`
- `django-app/workspace_app/apps.py`
- `django-app/workspace_app/models.py` — Workspace, Membership
- `django-app/workspace_app/signals.py` — post_save auto-create workspace
- `django-app/workspace_app/tasks.py` — invite email via django-rq
- `django-app/workspace_app/api/__init__.py`
- `django-app/workspace_app/api/views.py`
- `django-app/workspace_app/api/serializers.py`
- `django-app/workspace_app/api/urls.py`
- `django-app/workspace_app/migrations/0001_initial.py`

**Backend (modify):**
- `django-app/user_auth_app/models.py` — add `avatar` URLField; add `BillingProfile` model
- `django-app/user_auth_app/api/views.py` — add ProfileView, AvatarUploadView, InlinePasswordChangeView, BillingView
- `django-app/user_auth_app/api/serializers.py` — add UserUpdateSerializer, BillingProfileSerializer, InlinePasswordChangeSerializer
- `django-app/user_auth_app/api/urls.py` — new routes
- `django-app/user_auth_app/migrations/0002_user_avatar_billingprofile.py`
- `django-app/core/settings.py` — add `workspace_app` to INSTALLED_APPS; `MEDIA_ROOT`/`MEDIA_URL` already configured
- `django-app/core/urls.py` — include workspace_app urls + InlinePasswordChangeView route; serve `/media/` in dev
- `docker-compose.override.yml` — add `./media:/app/media` volume for local dev persistence
- `django-app/requirements.txt` — no new packages

**Frontend (new):**
- `frontend-ui/src/components/AppLayout.tsx` — app shell with sidebar + topbar
- `frontend-ui/src/components/Sidebar.tsx` — nav sidebar with Settings entry
- `frontend-ui/src/components/Topbar.tsx` — topbar with gear icon
- `frontend-ui/src/views/settings/SettingsLayout.tsx` — settings left nav + right panel
- `frontend-ui/src/views/settings/profile/schemas/profileSchema.ts`
- `frontend-ui/src/views/settings/profile/hooks/useProfileForm.ts`
- `frontend-ui/src/views/settings/profile/ProfileSection.tsx`
- `frontend-ui/src/views/settings/billing/data/countries.ts`
- `frontend-ui/src/views/settings/billing/schemas/billingSchema.ts`
- `frontend-ui/src/views/settings/billing/hooks/useBillingForm.ts`
- `frontend-ui/src/views/settings/billing/BillingSection.tsx`
- `frontend-ui/src/views/settings/workspace/schemas/workspaceSchema.ts`
- `frontend-ui/src/views/settings/workspace/hooks/useWorkspaceForm.ts`
- `frontend-ui/src/views/settings/workspace/WorkspaceSection.tsx`
- `frontend-ui/src/services/workspaceService.ts`
- `frontend-ui/src/services/billingService.ts`
- `frontend-ui/src/store/workspaceSlice.ts`

**Frontend (modify):**
- `frontend-ui/src/services/authService.ts` — add `patchProfile()`, `uploadAvatar()`, `changePassword()`
- `frontend-ui/src/store/index.ts` — add workspaceReducer
- `frontend-ui/src/App.tsx` — add `/settings/*` routes + AppLayout wrapper
- `frontend-ui/src/i18n/index.ts` — add settings translation keys

---

## Verification Checklist

1. `docker compose exec web pytest user_auth_app/ workspace_app/` — zero failures
2. `PATCH /api/users/me/` → 200, fields updated; email unchanged
3. `POST /api/users/me/avatar/` with valid image → 200, URL stored + returned
4. `POST /api/users/me/avatar/` >2MB → 400 error
5. `POST /api/auth/password/change/` correct current password → 200; wrong → 400
6. `GET /api/users/me/billing/` on new user → empty billing object, not 404
7. `PUT /api/users/me/billing/` with business + VAT → 200 stored
8. `PUT /api/users/me/billing/` invalid country code → 400
9. Workspace auto-created on user registration
10. Invite flow: POST → email → accept link → membership active
11. `PATCH /api/workspaces/{id}/` by admin → name updated; by member → 403
12. Admin removes non-owner member → 204; tries owner → 403
13. Frontend `/settings/profile` — upload avatar, preview updates, save name → snackbar
14. Frontend `/settings/billing` — toggle Business, fill VAT, save → snackbar
15. Frontend `/settings/workspace` — member table, invite, role change all work

---

## QA Report — 2026-03-11

**QA Engineer:** Claude (claude-sonnet-4-6)
**Branch:** `feature/PROJ-4-Workspace-&-Membership`

---

### 1. Tasks Checklist Status

| # | Task | Status |
|---|------|--------|
| 1 | Create `workspace_app/` with `__init__.py`, `apps.py` | DONE |
| 2 | Register `workspace_app` in `INSTALLED_APPS` | DONE |
| 3 | `Workspace` model (UUID pk, name, slug, owner FK, created_at) | DONE |
| 4 | `Membership` model (all fields, unique_together) | DONE |
| 5 | `BillingProfile` model in `user_auth_app/` | DONE |
| 6 | `avatar` URLField on User | DONE |
| 7 | Migration `workspace_app/migrations/0001_initial.py` | DONE |
| 8 | Migration `user_auth_app/migrations/0002_user_avatar_billingprofile.py` | DONE |
| 9 | Run migrations in Docker | PENDING (env task, not verifiable in static audit) |
| 10 | `post_save` signal auto-creates personal Workspace + admin Membership | DONE |
| 11 | Signal registered in `apps.py ready()` | DONE |
| 12 | Workspace API serializers | DONE |
| 13 | `GET /api/workspaces/me/` | DONE |
| 14 | `PATCH /api/workspaces/{id}/` (admin only) | DONE |
| 15 | `POST /api/workspaces/{id}/invite/` | DONE |
| 16 | `GET /api/workspaces/invite/accept/` (public) | DONE |
| 17 | `PATCH /api/workspaces/{id}/members/{user_id}/` | DONE |
| 18 | `DELETE /api/workspaces/{id}/members/{user_id}/` | DONE |
| 19 | All protected endpoints verify active membership | DONE |
| 20 | `workspace_app/api/urls.py` wired | DONE |
| 21 | Workspace URLs included in `core/urls.py` | DONE |
| 22 | django-rq invite email task with signed token (48h) | DONE |
| 23 | Expired token → 400 | DONE |
| 24 | `UserProfileSerializer`, `UserUpdateSerializer` | DONE |
| 25 | `GET /api/users/me/` | DONE |
| 26 | `PATCH /api/users/me/` (username/names only; duplicate username → 400) | DONE |
| 27 | `POST /api/users/me/avatar/` (JPEG/PNG/WEBP, max 2MB, FileSystemStorage) | DONE |
| 28 | `POST /api/auth/password/change/` (inline; blacklist refresh token) | DONE |
| 29 | `BillingProfileSerializer` (all optional, ISO country validation) | DONE |
| 30 | `GET /api/users/me/billing/` (auto-create, never 404) | DONE |
| 31 | `PUT /api/users/me/billing/` (upsert) | DONE |
| 32 | Routes added to `user_auth_app/api/urls.py` and `core/urls.py` | DONE |
| 33 | `MEDIA_ROOT` + `MEDIA_URL` configured in settings | DONE |
| 34 | `/media/` served in dev via `urls.py` | DONE |
| 35 | `media/` volume in `docker-compose.override.yml` | **MISSING** |
| 36 | Remove unused Supabase env vars | DONE |
| 37 | Backend tests — all scenarios | DONE (131 passed per task log) |
| 38 | `AppLayout.tsx`, `Sidebar.tsx`, `Topbar.tsx` | DONE |
| 39 | Wrap authenticated routes with `<AppLayout>` | DONE |
| 40 | `SettingsLayout.tsx` with nav tabs + Outlet | DONE |
| 41 | `/settings/*` routes; default redirect to `/settings/profile` | DONE |
| 42 | `workspaceSlice.ts`, `workspaceService.ts`, `billingService.ts`, `profileService.ts` | DONE |
| 43 | `workspaceReducer` in `store/index.ts` | DONE |
| 44 | `ProfileSection.tsx` — avatar, fields, password section | DONE |
| 45 | `BillingSection.tsx` — toggle, business fields, country Autocomplete | DONE |
| 46 | `WorkspaceSection.tsx` — name, members table, invite row | DONE |
| 47 | EN i18n keys (all settings strings) | DONE |
| 48 | All strings use `useTranslation()` | DONE (2 hardcoded strings fixed per task log) |
| 49 | DE/FR/ES/IT translations | DONE (all 4 locales have 71/71 keys matching EN) |
| 50 | Frontend tests — ProfileSection, BillingSection, WorkspaceSection | DONE (28 tests, 0 failures) |
| 51 | `InviteAcceptView` frontend page | DONE |

**Summary: 50/51 tasks done. 1 pending (media volume mount).**

---

### 2. Acceptance Criteria Audit

| AC | Description | Result |
|----|-------------|--------|
| 1 | Workspace: UUID pk, name max 100, slug unique max 110, owner FK, created_at | PASS |
| 2 | Membership: all fields, unique (workspace, user) | PASS |
| 3 | BillingProfile: OneToOne User, all fields, ISO country max 2 | PASS |
| 4 | User.avatar URLField blank=True | PASS |
| 5 | Auto-create personal workspace on user creation (post_save signal) | PASS |
| 6 | `GET /api/workspaces/me/` returns active workspaces + role | PASS |
| 7 | `PATCH /api/workspaces/{id}/` admin only, rename | PASS |
| 8 | `POST /api/workspaces/{id}/invite/` admin; pending Membership; signed token email | PASS |
| 9 | `GET /api/workspaces/invite/accept/?token=` public; 48h max_age | PASS |
| 10 | `PATCH /api/workspaces/{id}/members/{user_id}/` admin; change role | PASS |
| 11 | `DELETE /api/workspaces/{id}/members/{user_id}/` admin; cannot remove owner | PASS |
| 12 | All protected endpoints verify active membership; 403 if not member | PASS |
| 13 | `GET /api/users/me/` returns id, email, username, names, date_joined, avatar_url | PASS |
| 14 | `PATCH /api/users/me/` updates username/names; email read-only | PASS |
| 15 | `POST /api/users/me/avatar/` JPEG/PNG/WEBP, max 2MB, FileSystemStorage | PASS |
| 16 | `POST /api/auth/password/change/` validates current+new+confirm; blacklists refresh | PASS |
| 17 | `GET /api/users/me/billing/` never 404 on new user | PASS |
| 18 | `PUT /api/users/me/billing/` upsert; invalid country → 400 | PASS |
| 19 | Settings accessible via gear icon (topbar ProfileMenu) + sidebar (via ProfileMenu) | PARTIAL — see BUG-1 |
| 20 | Settings layout: left nav tabs + right content panel | PARTIAL — see BUG-2 |
| 21 | Profile tab: avatar, fields, password section, save + notistack | PASS |
| 22 | Billing tab: ToggleButtonGroup, business fields conditional, Autocomplete country | PASS |
| 23 | Workspace tab: name (admin/member), member table, role/status chips, invite row | PASS |
| 24 | All user-visible strings via `useTranslation()` | PASS |
| 25 | Forms use react-hook-form + Zod schemas | PASS |
| 26 | Inputs: MUI TextField outlined | PASS |

---

### 3. Bugs Found

#### BUG-1 — Topbar gear icon not implemented as `SettingsOutlined` icon
**Severity:** Low
**AC:** #19 — "gear icon (`SettingsOutlined`) → `/settings`"
**Finding:** The topbar has no standalone `SettingsOutlined` gear icon button. Settings access is routed through the `ProfileMenu` dropdown (avatar button top-right), which contains Profile / Billing / Workspace menu items. The spec requires a dedicated gear icon in the topbar that navigates directly to `/settings`. Additionally, the `Sidebar` has no "Settings" entry at the bottom with `SettingsOutlined` icon — settings access is only via the `ProfileMenu` dropdown.
**Steps to reproduce:** Look at the topbar. There is no gear icon visible. Check `Sidebar.tsx` — no Settings nav item in the `sections` array.
**Priority:** Low (functionally accessible, design spec deviation only)

#### BUG-2 — SettingsLayout uses horizontal tab bar, not left nav panel
**Severity:** Low
**AC:** #20 — "Settings layout: left nav tabs + right content panel"
**Finding:** `SettingsLayout.tsx` renders a horizontal `<Tabs>` bar above the content, not a left-side vertical navigation panel. The spec explicitly states "left nav tabs + right content panel."
**Priority:** Low (cosmetic/layout deviation; all routes and content work correctly)

#### BUG-3 — Slug collision guard is a single attempt, not a retry loop
**Severity:** Low
**AC:** Edge Case #5 — "Slug collision on workspace creation → append random 4-char suffix"
**Finding:** `workspace_app/signals.py` generates one suffix attempt. If the suffixed slug also collides (statistically rare, ~1 in 1.68M users with identical email prefix), Django will raise an `IntegrityError` crashing workspace creation at registration time.
**File:** `/Users/mariomuller/dev/merch-miner/django-app/workspace_app/signals.py` lines 24-27
**Priority:** Low (near-impossible in practice, but no retry loop means silent crash path exists)

#### BUG-4 — `media/` volume missing from `docker-compose.override.yml`
**Severity:** Medium
**AC:** Task #35 — "Add `./media:/app/media` volume for local dev persistence"
**Finding:** `docker-compose.override.yml` does not contain a `media` volume mount for the `web` service. Avatar uploads in dev will be lost on container restart because they write to the container filesystem, not a bind-mounted host path.
**File:** `/Users/mariomuller/dev/merch-miner/docker-compose.override.yml`
**Priority:** Medium (data loss on restart in dev, no prod impact since Caddy serves from a separate media volume)

#### BUG-5 — Admin can demote themselves, creating a workspace with no admin
**Severity:** High
**AC:** Implicit — workspace must always have at least one admin
**Finding:** `PATCH /api/workspaces/{id}/members/{user_id}/` has no guard preventing an admin from changing their own role to `member`. Combined with the fact that removing the owner is blocked but demoting isn't, a workspace admin (who is not the owner) can demote themselves to `member`, and if they are the only admin, the workspace is left with no admin. The owner's membership can also be demoted via this endpoint since only the DELETE route checks for owner status.
**File:** `/Users/mariomuller/dev/merch-miner/django-app/workspace_app/api/views.py` lines 269-286
**Priority:** High (leaves workspaces permanently unmanageable; owner can be demoted to member)

#### BUG-6 — Avatar content-type check trusts client-supplied MIME type (no magic-byte validation)
**Severity:** Medium
**AC:** #15 — "validate image (JPEG/PNG/WEBP)"
**Finding:** `AvatarUploadView` validates `file.content_type`, which is supplied by the client in the multipart request and can be trivially spoofed (e.g., a PHP file uploaded with `Content-Type: image/jpeg` will pass validation and be saved to `MEDIA_ROOT`). No server-side magic-byte check (e.g., `imghdr`, `Pillow`) is performed.
**File:** `/Users/mariomuller/dev/merch-miner/django-app/user_auth_app/api/views.py` line 394
**Priority:** Medium (files are not executed by Django; Caddy serves `/media/` statically. Actual RCE risk is low, but arbitrary file storage is an abuse vector)

#### BUG-7 — Avatar stored as absolute URL (breaks in prod behind Caddy/domain change)
**Severity:** Medium
**AC:** #15 — "store absolute URL on user.avatar; return `{ avatar_url }`"
**Finding:** `AvatarUploadView` uses `request.build_absolute_uri()` to build the URL stored on `user.avatar`. In dev this produces `http://localhost:8000/media/avatars/...`. Behind Caddy in prod, if the `Host` header differs or the value was stored during dev, the stored URL becomes stale. The spec's implementation note says to use `request.build_absolute_uri(MEDIA_URL + path)` which matches the code, but storing an absolute URL means it is environment-dependent. The `WorkspaceMemberSerializer` exposes `avatar` (the raw stored value) directly with no URL-building step, so dev-stored URLs leak into production responses.
**File:** `/Users/mariomuller/dev/merch-miner/django-app/user_auth_app/api/views.py` line 417; `workspace_app/api/serializers.py` line 13
**Priority:** Medium

#### BUG-8 — Invite accept exposes JWT access token in browser URL bar
**Severity:** Medium
**AC:** #16 (invite flow)
**Finding:** `WorkspaceInviteAcceptView` returns `password_reset_token: str(refresh.access_token)` for new users who need to set a password. `InviteAcceptView.tsx` then navigates to `/password-reset/confirm?uid=...&token=<JWT>`, placing a valid JWT access token in the URL. This token is visible in browser history, server logs, and referrer headers for any subsequent navigation.
**File:** `/Users/mariomuller/dev/merch-miner/django-app/workspace_app/api/views.py` lines 203-206, 238-240; `/Users/mariomuller/dev/merch-miner/frontend-ui/src/views/invite/InviteAcceptView.tsx` line 73
**Priority:** Medium (token is short-lived access token; practical risk window is small but violates security best practice)

#### BUG-9 — No rate limiting on avatar upload or invite endpoints
**Severity:** Low
**AC:** Security rules — "Rate limiting on authentication endpoints"
**Finding:** `AvatarUploadView` and `WorkspaceInviteView` have no DRF throttle classes. An authenticated user can flood the invite endpoint to enumerate valid email addresses (via the 409 vs 201 response difference) or spam avatar uploads to fill disk.
**Priority:** Low (requires authenticated session; disk-fill risk is mitigated by 2MB cap)

---

### 4. Security Audit

| Check | Finding | Status |
|-------|---------|--------|
| Auth on all protected endpoints | `CookieJWTAuthentication` + `IsAuthenticated` on all workspace and profile views | PASS |
| Public endpoint scope correct | Only `WorkspaceInviteAcceptView` is `AllowAny`; correct | PASS |
| Workspace isolation at ORM level | All workspace queries filter by authenticated user's membership | PASS |
| Non-member cannot access workspace | Both `_get_admin_membership` and `_get_active_membership` helpers guard all views | PASS |
| Owner removal blocked | `DELETE` checks `target.user_id == workspace.owner_id` | PASS |
| Admin self-demotion blocked | No guard exists — owner can be demoted via PATCH | **FAIL (BUG-5)** |
| Duplicate invite returns 409 | Implemented correctly | PASS |
| Avatar MIME validation (magic bytes) | Client-supplied `content_type` only, no Pillow/imghdr | **FAIL (BUG-6)** |
| Avatar size enforced server-side | 2MB check via `file.size` | PASS |
| Password change requires current password | `InlinePasswordChangeSerializer.validate_current_password()` | PASS |
| Refresh token blacklisted on password change | Present in `InlinePasswordChangeView` | PASS |
| No secrets hardcoded | No secrets in any audited file | PASS |
| Invite token signed (django.core.signing) | 48h max_age enforced | PASS |
| Invalid/expired token → 400 | Both `SignatureExpired` and `BadSignature` caught | PASS |
| Country code validated server-side | `VALID_COUNTRY_CODES` set in serializer | PASS |
| Email field cannot be updated via PATCH | `UserUpdateSerializer` fields tuple excludes email | PASS |
| Input validated via DRF serializers | All endpoints use `serializer.is_valid(raise_exception=True)` | PASS |
| JWT access token in redirect URL | Invite accept flow puts JWT in URL bar for new users | **FAIL (BUG-8)** |
| Rate limiting on invite/avatar endpoints | No throttle classes on new endpoints | **FAIL (BUG-9)** |

---

### 5. Test Results

**Backend:** 131 tests passed (per task log — cannot run without Docker). All required test scenarios present and verified by code review:
- Workspace auto-create signal
- `GET /api/workspaces/me/` including role and pending exclusion
- `PATCH /api/workspaces/{id}/` admin 200 / member 403 / non-member 403
- Invite flow end-to-end
- Expired token → 400
- Remove non-owner → 204 / remove owner → 403
- Duplicate active invite → 409 / pending resend → 200
- Profile PATCH (fields updated, email ignored, duplicate username → 400)
- Avatar upload valid → 200 / too large → 400 / wrong type → 400
- Password change correct → 200 / wrong → 400
- Billing GET new user → 200 / invalid country PUT → 400

**Frontend:** 28 tests, 0 failures, 0 errors (vitest --run --coverage --reporter=junit)

| Suite | Tests | Failures |
|-------|-------|---------|
| authSlice.test.ts | 6 | 0 |
| LoginPage.test.tsx | 4 | 0 |
| RegisterPage.test.tsx | 3 | 0 |
| ProfileSection.test.tsx | 5 | 0 |
| BillingSection.test.tsx | 5 | 0 |
| WorkspaceSection.test.tsx | 5 | 0 |

**Coverage gaps noted (not blocking):**
- `useProfileForm.ts` — 68% (avatar upload and password paths partially uncovered)
- `useWorkspaceSection.ts` — 53% (role change, remove member handlers not tested)
- `WorkspaceSelector.tsx` — 57% (multi-workspace switching not tested)

---

### 6. i18n Status

| Locale | Keys present / EN total | Status |
|--------|------------------------|--------|
| EN | 71/71 | DONE |
| DE | 71/71 | DONE |
| FR | 71/71 | DONE |
| ES | 71/71 | DONE |
| IT | 71/71 | DONE |

All 5 locales are complete. The task file marked DE/FR/ES/IT as pending but the translations are present and complete in `/frontend-ui/public/locales/`.

---

### 7. Summary

**Go/No-Go:** NO-GO — BUG-5 (admin self-demotion / owner demotion) is a High severity security gap that must be fixed before merge. The remaining bugs are Medium/Low priority.

**Must fix before merge:**
- BUG-5: Add guard to `PATCH /api/workspaces/{id}/members/{user_id}/` blocking demotion of the workspace owner and preventing the last admin from demoting themselves.

**Should fix before merge:**
- BUG-4: Add `./media:/app/media` volume to `docker-compose.override.yml` `web` service.
- BUG-6: Add server-side magic-byte validation (Pillow or `imghdr`) in `AvatarUploadView`.

**Can fix post-merge (Low):**
- ~~BUG-1: Add `SettingsOutlined` gear icon to topbar + Settings entry at bottom of Sidebar.~~ — intentional design, not a bug; reverted.
- ~~BUG-2: Convert `SettingsLayout` tabs from horizontal to left-side vertical nav.~~ — intentional design, not a bug; reverted.
- BUG-3: Add retry loop for slug collision in `signals.py`.
- BUG-7: Store relative avatar path; build absolute URL at serialization time.
- BUG-8: Pass invite password-setup token via POST body or short-lived session, not URL param.
- BUG-9: Add DRF throttle classes to avatar upload and invite endpoints.
