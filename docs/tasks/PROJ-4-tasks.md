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

- [ ] `workspace_app/api/serializers.py`: `WorkspaceSerializer`, `MembershipSerializer`, `InviteSerializer`
- [ ] `GET /api/workspaces/me/` — return active workspaces + role for authenticated user
- [ ] `PATCH /api/workspaces/{id}/` — Workspace Admin only; rename (name field)
- [ ] `POST /api/workspaces/{id}/invite/` — Workspace Admin; create pending Membership; send signed token email via django-rq task
- [ ] `GET /api/workspaces/invite/accept/?token={token}` — public; verify token (48h max_age); activate Membership
- [ ] `PATCH /api/workspaces/{id}/members/{user_id}/` — Workspace Admin; change member role
- [ ] `DELETE /api/workspaces/{id}/members/{user_id}/` — Workspace Admin; block if target is owner (403)
- [ ] All protected workspace endpoints: verify active Membership; 403 if not member
- [ ] `workspace_app/api/urls.py` — wire all routes
- [ ] Include workspace urls in `core/urls.py`

### 6. Invite Email Task

- [ ] `workspace_app/tasks.py`: django-rq task to send invite email with signed token link
- [ ] Token: `django.core.signing.dumps()` / `.loads()`, `max_age=172800` (48h)
- [ ] Expired token → 400, prompt re-invite

### 7. User Profile API (in `user_auth_app`)

- [ ] `UserProfileSerializer`: id, email (read-only), username, first_name, last_name, date_joined, avatar_url
- [ ] `UserUpdateSerializer`: username, first_name, last_name only; reject email field silently
- [ ] `GET /api/users/me/` — return profile
- [ ] `PATCH /api/users/me/` — update allowed fields; 400 on duplicate username
- [ ] `POST /api/users/me/avatar/` — multipart; validate JPEG/PNG/WEBP + max 2MB; PUT to Supabase `avatars/` bucket via REST using `SUPABASE_SERVICE_KEY`; store public URL on `user.avatar`; return `{ avatar_url }`
- [ ] `POST /api/auth/password/change/` — validate `current_password`, `new_password`, `confirm_password`; `user.set_password()` + blacklist refresh token via `RefreshToken(token).blacklist()`
- [ ] Add new routes to `user_auth_app/api/urls.py` and `core/urls.py`

### 8. Billing API (in `user_auth_app`)

- [ ] `BillingProfileSerializer`: all fields optional; validate country is valid ISO 3166-1 alpha-2
- [ ] `GET /api/users/me/billing/` — return BillingProfile; auto-create empty one if missing (never 404)
- [ ] `PUT /api/users/me/billing/` — upsert BillingProfile for `request.user`
- [ ] Add routes to `user_auth_app/api/urls.py`

### 9. Environment

- [ ] Add `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_STORAGE_BUCKET` to `django-app/.env.template`
- [ ] Add same vars to `django-app/.env` locally (never commit)
- [ ] Confirm Supabase storage bucket `avatars/` exists with public read policy

### 10. Backend Tests

- [ ] Test: Workspace auto-created on user registration (signal)
- [ ] Test: `GET /api/workspaces/me/` returns correct workspaces + roles
- [ ] Test: `PATCH /api/workspaces/{id}/` by Workspace Admin → 200; by member → 403
- [ ] Test: Invite flow end-to-end (POST → token → accept → membership active)
- [ ] Test: Expired token → 400
- [ ] Test: Remove non-owner member → 204; remove owner → 403
- [ ] Test: Duplicate invite → 409
- [ ] Test: `PATCH /api/users/me/` updates fields; email ignored; duplicate username → 400
- [ ] Test: `POST /api/users/me/avatar/` with valid image → 200; >2MB → 400; wrong type → 400
- [ ] Test: `POST /api/auth/password/change/` correct password → 200; wrong password → 400
- [ ] Test: `GET /api/users/me/billing/` on new user → empty object, not 404
- [ ] Test: `PUT /api/users/me/billing/` with invalid country → 400
- [ ] Run full suite: `docker compose exec web pytest user_auth_app/ workspace_app/`

---

## Frontend

### 11. App Shell

- [ ] `src/components/AppLayout.tsx` — full app shell: Sidebar + Topbar + main content area
- [ ] `src/components/Sidebar.tsx` — nav sidebar; "Settings" entry at bottom with `SettingsOutlined` icon, route `/settings`
- [ ] `src/components/Topbar.tsx` — topbar with gear icon (`SettingsOutlined`) → navigates to `/settings`
- [ ] Wrap existing authenticated routes with `<AppLayout>` in `App.tsx`

### 12. Settings Layout

- [ ] `src/views/settings/SettingsLayout.tsx` — settings shell: left nav tabs (Profile / Billing / Workspace) + right content panel inside `<AppLayout>`
- [ ] Add `/settings/*` routes in `App.tsx`; default redirect `/settings` → `/settings/profile`

### 13. Redux & Services

- [ ] `src/store/workspaceSlice.ts` — Redux slice: workspaces list, active workspace, loading/error states
- [ ] `src/services/workspaceService.ts` — axios calls for all workspace endpoints
- [ ] `src/services/billingService.ts` — axios calls for billing endpoints
- [ ] Update `src/services/authService.ts` — add `patchProfile()`, `uploadAvatar()`, `changePassword()`
- [ ] Register `workspaceReducer` in `src/store/index.ts`

### 14. Profile Tab (`/settings/profile`)

- [ ] `src/views/settings/profile/schemas/profileSchema.ts` — Zod schema: firstName, lastName, username, currentPassword, newPassword, confirmPassword
- [ ] `src/views/settings/profile/hooks/useProfileForm.ts` — react-hook-form + submit handlers
- [ ] `src/views/settings/profile/ProfileSection.tsx`:
  - Avatar: 80px circular preview + outlined upload button; `CircularProgress` during upload
  - Fields: First Name, Last Name, Username (editable); Email (`TextField` disabled)
  - Password section: Current Password, New Password, Confirm Password + "Change Password" button
  - Save button (primary); success/error via notistack

### 15. Billing Tab (`/settings/billing`)

- [ ] `src/views/settings/billing/data/countries.ts` — static ISO 3166-1 country list (no package)
- [ ] `src/views/settings/billing/schemas/billingSchema.ts` — Zod schema: all fields optional
- [ ] `src/views/settings/billing/hooks/useBillingForm.ts` — react-hook-form + submit handler
- [ ] `src/views/settings/billing/BillingSection.tsx`:
  - Account type: MUI `ToggleButtonGroup` [Personal | Business]
  - Business-only fields (conditional): Company Name, VAT / Tax ID
  - Address: Line 1, Line 2 (optional), City, State/Region, Postal Code
  - Country: MUI `Autocomplete` with countries list
  - All fields optional; helper text "Required for paid plans"; Save button (primary)

### 16. Workspace Tab (`/settings/workspace`)

- [ ] `src/views/settings/workspace/schemas/workspaceSchema.ts` — Zod schema: workspace name, invite email
- [ ] `src/views/settings/workspace/hooks/useWorkspaceForm.ts` — react-hook-form + submit handlers
- [ ] `src/views/settings/workspace/WorkspaceSection.tsx`:
  - Workspace name: editable `TextField` + Save (Workspace Admin only; `disabled` for members)
  - Member table (Dense, 44px rows): Avatar | Name | Email | Role chip | Status chip | Actions
  - Role chip: "Admin" primary color / "Member" default; Status chip: "Active" success / "Pending" warning
  - Actions column: role dropdown (Workspace Admin) + remove `IconButton` (destructive); owner row: remove hidden/disabled
  - Invite row: email `TextField` + "Send Invite" button; success/error via notistack

### 17. i18n

- [ ] Add all settings translation keys to `src/i18n/` JSON files (profile, billing, workspace strings)
- [ ] All user-visible strings in new components use `useTranslation()`

### 18. Frontend Tests

- [ ] `ProfileSection` — loading state, avatar upload success, avatar >2MB error, save name success, wrong current password error
- [ ] `BillingSection` — toggle Personal/Business shows/hides company fields, save with invalid country error, save success
- [ ] `WorkspaceSection` — member table renders, invite flow success, role change by admin, non-admin sees disabled controls
- [ ] Run: `npm run test:ci` — zero failures required

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
