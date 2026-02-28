# PROJ-1 — User Auth: Task List

## Backend

### URL Migration
- [x] Update `core/urls.py`: change `/api/register/` → `/api/auth/register/` (and all other auth paths)
- [x] Verify all existing tests still pass after path change (they use `reverse()` so should be zero-change)
- [x] Search Django email templates for any hardcoded `/api/register/` or `/api/login/` URLs and update

### Google OAuth — Settings
- [x] Add to `INSTALLED_APPS`: `django.contrib.sites`, `allauth`, `allauth.account`, `allauth.socialaccount`, `allauth.socialaccount.providers.google`
- [x] Add `allauth.account.middleware.AccountMiddleware` to `MIDDLEWARE`
- [x] Add `allauth.account.auth_backends.AuthenticationBackend` to `AUTHENTICATION_BACKENDS`
- [x] Add `SOCIALACCOUNT_PROVIDERS` block with Google client credentials (read from env vars)
- [x] Set `SITE_ID = 1` in settings (already set)

### Google OAuth — Views & URLs
- [x] Add `GoogleLoginView` to `user_auth_app/api/views.py` (redirects to Google via allauth)
- [x] Add `GoogleCallbackView` to `user_auth_app/api/views.py` (handles callback, issues JWT cookies, redirects to `FRONTEND_URL`)
- [x] Wire up `/api/auth/google/` and `/api/auth/google/callback/` in `core/urls.py`
- [x] Handle account linking: if email already exists, link OAuth account instead of creating duplicate (allauth handles this natively)

### Email Templates & Settings
- [x] Update `FRONTEND_ACTIVATION_URL` default in `core/settings.py`: `http://localhost:5500/pages/auth/activate.html` → `http://localhost:5173/activate`
- [x] Update `FRONTEND_CONFIRM_PASSWORD_URL` default in `core/settings.py`: `http://localhost:5500/pages/auth/confirm_password.html` → `http://localhost:5173/password-reset/confirm`
- [x] Add `FRONTEND_ACTIVATION_URL`, `FRONTEND_CONFIRM_PASSWORD_URL` to `env/.env.template` (currently missing)
- [x] Add `COMPANY_NAME=Merch Miner` to `env/.env.template` (used in both email templates)
- [ ] Verify `django-app/static/logo.png` exists — `emails.py` embeds it inline via CID; add a placeholder logo if missing or document that it must be provided before emails are sent
- [x] Note: email templates (`activation.html`, `password_reset.html`) contain no hardcoded API URLs — they use `{{ link }}` context var built in Python — no changes needed to template HTML

### Environment
- [x] Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FRONTEND_URL` to `django-app/.env.template`

### Session Hydration (resolve open question first)
- [x] Added `/api/auth/me/` — returns `{ id, email }`, protected by `CookieJWTAuthentication` + `IsAuthenticated`

### Migrations
- [ ] Run `docker compose exec web python manage.py migrate` to create allauth + sites tables

---

## Frontend

### Scaffold
- [x] Create `frontend-ui/src/store/index.ts` — configure Redux store
- [x] Create `frontend-ui/src/store/authSlice.ts` — `auth` slice with `setUser`, `setLoading`, `setError`, `clearAuth` actions
- [x] Create `frontend-ui/src/services/authService.ts` — axios instance (`withCredentials: true`, baseURL from `VITE_API_URL`), 401 interceptor with token refresh + queue, exported methods: `login`, `register`, `logout`, `requestPasswordReset`, `confirmPasswordReset`, `googleLoginUrl`
- [x] Create `frontend-ui/src/i18n/index.ts` — i18next setup with inline English translations (no JSON files)
- [x] Create `frontend-ui/src/style/theme.ts` — MUI `extendTheme()` with dark/light `colorSchemes`, no-uppercase buttons, rounded corners
- [x] Create `frontend-ui/src/style/constants.ts` — EASING, DURATION, MONO_FONT_STACK exports
- [x] Create `frontend-ui/src/components/PrivateRoute.tsx` — reads `isAuthenticated` from Redux; redirects to `/login` if false
- [x] Update `frontend-ui/src/main.tsx` — wrap app in `<Provider>`, `<ThemeProvider>`, `<SnackbarProvider>`, `<BrowserRouter>`
- [x] Update `frontend-ui/src/App.tsx` — replace PlaceholderPage with real page components, add `<PrivateRoute>` for `/`
- [x] Add session hydration call in `App.tsx` on mount (call `/api/auth/me/` to populate Redux from cookie)
- [x] Create `frontend-ui/.env.template` with `VITE_API_URL=http://localhost:8000`

### Shared Auth UI
- [x] Create `frontend-ui/src/views/auth/partials/AuthLayout.tsx` — centered MUI Paper card wrapper

### Login Page
- [x] Create `frontend-ui/src/views/auth/login/schemas/loginSchema.ts` — Zod schema (`email`, `password`)
- [x] Create `frontend-ui/src/views/auth/login/LoginPage.tsx` — form with email/password fields, submit dispatches to Redux, "Continue with Google" button

### Register Page
- [x] Create `frontend-ui/src/views/auth/register/schemas/registerSchema.ts` — Zod schema (`email`, `password`, `confirmPassword`)
- [x] Create `frontend-ui/src/views/auth/register/RegisterPage.tsx` — registration form, success → redirect to `/login` with message

### Activate Page
- [x] Create `frontend-ui/src/views/auth/activate/ActivatePage.tsx` — reads `?uid=&token=` from URL, calls activate endpoint on mount, shows success/error state

### Password Reset Pages
- [x] Create `frontend-ui/src/views/auth/password-reset/schemas/passwordResetSchema.ts` — Zod schemas for both request and confirm forms
- [x] Create `frontend-ui/src/views/auth/password-reset/PasswordResetPage.tsx` — email input form, calls `requestPasswordReset`
- [x] Create `frontend-ui/src/views/auth/password-reset/PasswordConfirmPage.tsx` — reads `?uid=&token=`, new password form, calls `confirmPasswordReset`

---

## Verification Checklist
- [ ] `npm run dev` → `/login` renders without errors
- [ ] Email login → cookie set → redirected to `/`
- [ ] Unauthenticated visit to `/` → redirected to `/login`
- [ ] Google button → browser redirects to Google OAuth
- [ ] Register → success message → redirect to `/login`
- [ ] Password reset email received → link → new password → login works
- [ ] `docker compose exec web pytest` → all existing tests pass
