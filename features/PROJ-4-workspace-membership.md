# PROJ-4: Workspace & Membership

**Status:** Planned
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
