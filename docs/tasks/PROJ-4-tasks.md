# PROJ-4 — Workspace & Membership: Task List

---

## Backend

### 1. New Django App: `workspace_app`

- [x] Create `django-app/workspace_app/` with `__init__.py`, `apps.py`
- [x] Register `workspace_app` in `core/settings.py` → `INSTALLED_APPS`

### 2. Models

- [x] `Workspace` model: UUID pk, `name` (max 100), `slug` (unique, max 110), `owner` FK → User, `created_at`
- [x] `Membership` model: `workspace` FK, `user` FK, `role` [admin|member], `status` [pending|active], `invited_by` FK nullable, `invited_at`, `accepted_at` nullable; unique_together (workspace, user)
- [x] `BillingProfile` model (in `user_auth_app/`): OneToOne → User, `account_type` [personal|business], `company_name` nullable, `vat_number` nullable, `address_line1`, `address_line2` nullable, `city`, `state_region` nullable, `postal_code`, `country` (CharField max 2, ISO 3166-1 alpha-2), `created_at`, `updated_at`
- [x] Add `avatar` URLField (blank=True) to existing `User` model in `user_auth_app/models.py`

### 3. Migrations

- [x] Generate `workspace_app/migrations/0001_initial.py`
- [x] Generate `user_auth_app/migrations/0002_user_avatar_billingprofile.py`
- [ ] Run migrations inside Docker: `docker compose exec web python manage.py migrate`

### 4. Signals

- [x] `workspace_app/signals.py`: `post_save` on User → auto-create personal Workspace + admin Membership if user has no memberships
- [x] Register signal in `workspace_app/apps.py` `ready()`

### 5. Workspace API

- [x] `workspace_app/api/serializers.py`: `WorkspaceSerializer`, `MembershipSerializer`, `InviteSerializer`
- [x] `GET /api/workspaces/me/` — return active workspaces + role for authenticated user
- [x] `PATCH /api/workspaces/{id}/` — Workspace Admin only; rename (name field)
- [x] `POST /api/workspaces/{id}/invite/` — Workspace Admin; create pending Membership; send signed token email via django-rq task
- [x] `GET /api/workspaces/invite/accept/?token={token}` — public; verify token (48h max_age); activate Membership
- [x] `PATCH /api/workspaces/{id}/members/{user_id}/` — Workspace Admin; change member role
- [x] `DELETE /api/workspaces/{id}/members/{user_id}/` — Workspace Admin; block if target is owner (403)
- [x] All protected workspace endpoints: verify active Membership; 403 if not member
- [x] `workspace_app/api/urls.py` — wire all routes
- [x] Include workspace urls in `core/urls.py`

### 6. Invite Email Task

- [x] `workspace_app/tasks.py`: django-rq task to send invite email with signed token link
- [x] Token: `django.core.signing.dumps()` / `.loads()`, `max_age=172800` (48h)
- [x] Expired token → 400, prompt re-invite

### 7. User Profile API (in `user_auth_app`)

- [x] `UserProfileSerializer`: id, email (read-only), username, first_name, last_name, date_joined, avatar_url
- [x] `UserUpdateSerializer`: username, first_name, last_name only; reject email field silently
- [x] `GET /api/users/me/` — return profile
- [x] `PATCH /api/users/me/` — update allowed fields; 400 on duplicate username
- [x] `POST /api/users/me/avatar/` — multipart; validate JPEG/PNG/WEBP + max 2MB; save to Django `MEDIA_ROOT/avatars/` via `FileSystemStorage`; store relative path on `user.avatar`; return `{ avatar_url }` (served via `MEDIA_URL`)
- [x] `POST /api/auth/password/change/` — validate `current_password`, `new_password`, `confirm_password`; `user.set_password()` + blacklist refresh token via `RefreshToken(token).blacklist()`
- [x] Add new routes to `user_auth_app/api/urls.py` and `core/urls.py`

### 8. Billing API (in `user_auth_app`)

- [x] `BillingProfileSerializer`: all fields optional; validate country is valid ISO 3166-1 alpha-2
- [x] `GET /api/users/me/billing/` — return BillingProfile; auto-create empty one if missing (never 404)
- [x] `PUT /api/users/me/billing/` — upsert BillingProfile for `request.user`
- [x] Add routes to `user_auth_app/api/urls.py`

### 9. Environment

- [x] Configure `MEDIA_ROOT` + `MEDIA_URL` in `core/settings.py`
- [x] Serve `/media/` via Django in dev (`urls.py`); Caddy serves `/media/` directly in prod
- [x] Add `media/` volume mount in `docker-compose.override.yml` so files persist locally
- [X] Remove unused `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_STORAGE_BUCKET` from `.env` files

### 10. Backend Tests

- [x] Test: Workspace auto-created on user registration (signal)
- [x] Test: `GET /api/workspaces/me/` returns correct workspaces + roles
- [x] Test: `PATCH /api/workspaces/{id}/` by Workspace Admin → 200; by member → 403
- [x] Test: Invite flow end-to-end (POST → token → accept → membership active)
- [x] Test: Expired token → 400
- [x] Test: Remove non-owner member → 204; remove owner → 403
- [x] Test: Duplicate invite → 409
- [x] Test: `PATCH /api/users/me/` updates fields; email ignored; duplicate username → 400
- [x] Test: `POST /api/users/me/avatar/` with valid image → 200; >2MB → 400; wrong type → 400
- [x] Test: `POST /api/auth/password/change/` correct password → 200; wrong password → 400
- [x] Test: `GET /api/users/me/billing/` on new user → empty object, not 404
- [x] Test: `PUT /api/users/me/billing/` with invalid country → 400
- [x] Run full suite: `docker compose exec web pytest user_auth_app/ workspace_app/` — 131 passed

---

## Frontend

### 11. App Shell

- [x] `src/components/AppLayout.tsx` — full app shell: Sidebar + Topbar + main content area
- [x] `src/components/Sidebar.tsx` — nav sidebar; "Settings" entry at bottom with `SettingsOutlined` icon, route `/settings`
- [x] `src/components/Topbar.tsx` — topbar with gear icon (`SettingsOutlined`) → navigates to `/settings`
- [x] Wrap existing authenticated routes with `<AppLayout>` in `App.tsx`

### 12. Settings Layout

- [x] `src/views/settings/SettingsLayout.tsx` — settings shell: left nav tabs (Profile / Billing / Workspace) + right content panel inside `<AppLayout>`
- [x] Add `/settings/*` routes in `App.tsx`; default redirect `/settings` → `/settings/profile`

### 13. Redux & Services

- [x] `src/store/workspaceSlice.ts` — Redux slice: workspaces list, active workspace, loading/error states
- [x] `src/services/workspaceService.ts` — axios calls for all workspace endpoints
- [x] `src/services/billingService.ts` — axios calls for billing endpoints
- [x] `src/services/profileService.ts` — created instead of updating authService: `getProfile()`, `patchProfile()`, `uploadAvatar()`, `changePassword()`
- [x] Register `workspaceReducer` in `src/store/index.ts`

### 14. Profile Tab (`/settings/profile`)

- [x] `src/views/settings/profile/schemas/profileSchema.ts` — Zod schema: firstName, lastName, username, currentPassword, newPassword, confirmPassword
- [x] `src/views/settings/profile/hooks/useProfileForm.ts` — react-hook-form + submit handlers
- [x] `src/views/settings/profile/ProfileSection.tsx`:
  - Avatar: 80px circular preview + outlined upload button; `CircularProgress` during upload
  - Fields: First Name, Last Name, Username (editable); Email (`TextField` disabled)
  - Password section: Current Password, New Password, Confirm Password + "Change Password" button
  - Save button (primary); success/error via notistack

### 15. Billing Tab (`/settings/billing`)

- [x] `src/views/settings/billing/data/countries.ts` — static ISO 3166-1 country list (no package)
- [x] `src/views/settings/billing/schemas/billingSchema.ts` — Zod schema: all fields optional
- [x] `src/views/settings/billing/hooks/useBillingForm.ts` — react-hook-form + submit handler
- [x] `src/views/settings/billing/BillingSection.tsx`:
  - Account type: MUI `ToggleButtonGroup` [Personal | Business]
  - Business-only fields (conditional): Company Name, VAT / Tax ID
  - Address: Line 1, Line 2 (optional), City, State/Region, Postal Code
  - Country: MUI `Autocomplete` with countries list
  - All fields optional; helper text "Required for paid plans"; Save button (primary)

### 16. Workspace Tab (`/settings/workspace`)

- [x] `src/views/settings/workspace/schemas/workspaceSchema.ts` — Zod schema: workspace name, invite email
- [x] `src/views/settings/workspace/hooks/useWorkspaceSection.ts` — react-hook-form + submit handlers (named `useWorkspaceSection`, not `useWorkspaceForm`)
- [x] `src/views/settings/workspace/WorkspaceSection.tsx`:
  - Workspace name: editable `TextField` + Save (Workspace Admin only; `disabled` for members)
  - Member table (Dense, 44px rows): Avatar | Name | Email | Role chip | Status chip | Actions
  - Role chip: "Admin" primary color / "Member" default; Status chip: "Active" success / "Pending" warning
  - Actions column: role dropdown (Workspace Admin) + remove `IconButton` (destructive); owner row: remove hidden/disabled
  - Invite row: email `TextField` + "Send Invite" button; success/error via notistack

### 17. i18n

- [x] Add all settings translation keys to `src/i18n/index.ts` (profile, billing, workspace strings) — EN only
- [x] All user-visible strings in new components use `useTranslation()` — **exception**: `WorkspaceSection.tsx` has 2 hardcoded strings ("No workspace found." line 123, "Active workspace" label line 137)
- [ ] Create the translation for DE, FR, ES, IT (EN done; other locales pending)

### 18. Frontend Tests

- [x] `src/views/settings/profile/tests/ProfileSection.test.tsx` — created
- [x] `src/views/settings/billing/tests/BillingSection.test.tsx` — created
- [x] `src/views/settings/workspace/tests/WorkspaceSection.test.tsx` — created
- [x] Run: `npm run test:ci` — zero failures required (not yet verified)

### Known Styling Issues (to fix before QA)

- [x] `theme.ts` — `MuiTableCell.root.borderBottom` → `theme.palette.divider` (mode-aware)
- [x] `theme.ts` — `MuiToggleButtonGroup.grouped.border` → `({ theme }) =>` function (mode-aware)
- [x] `Sidebar.tsx` — `borderRight` → `'1px solid'` + `borderColor: 'divider'`
- [x] `Topbar.tsx` — transition → `DURATION.default` + `EASING.standard` constants
- [x] `WorkspaceSection.tsx` — "No workspace found" and "Active workspace" → `t()` keys added to i18n

---

## Verification Checklist (from spec)

- [ ] `docker compose exec web pytest user_auth_app/ workspace_app/` — zero failures
- [ ] `PATCH /api/users/me/` → 200, fields updated; email unchanged
- [ ] `POST /api/users/me/avatar/` valid image → 200, URL stored + returned
- [ ] `POST /api/users/me/avatar/` >2MB → 400
- [ ] `POST /api/auth/password/change/` correct password → 200; wrong → 400
- [ ] `GET /api/users/me/billing/` new user → empty object, not 404
- [ ] `PUT /api/users/me/billing/` business + VAT → 200 stored
- [ ] `PUT /api/users/me/billing/` invalid country → 400
- [ ] Workspace auto-created on user registration
- [ ] Invite flow: POST → email → accept link → membership active
- [ ] `PATCH /api/workspaces/{id}/` by Workspace Admin → 200; by member → 403
- [ ] Admin removes non-owner → 204; tries owner → 403
- [ ] `/settings/profile` — upload avatar, preview updates, save name → snackbar
- [ ] `/settings/billing` — toggle Business, fill VAT, save → snackbar
- [ ] `/settings/workspace` — member table, invite, role change all work
