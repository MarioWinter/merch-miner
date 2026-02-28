# PROJ-1 — User Auth: Task List

## Backend

### URL Migration
- [ ] Update `core/urls.py`: change `/api/register/` → `/api/auth/register/` (and all other auth paths)
- [ ] Verify all existing tests still pass after path change (they use `reverse()` so should be zero-change)
- [ ] Search Django email templates for any hardcoded `/api/register/` or `/api/login/` URLs and update

### Google OAuth — Settings
- [ ] Add to `INSTALLED_APPS`: `django.contrib.sites`, `allauth`, `allauth.account`, `allauth.socialaccount`, `allauth.socialaccount.providers.google`
- [ ] Add `allauth.account.middleware.AccountMiddleware` to `MIDDLEWARE`
- [ ] Add `allauth.account.auth_backends.AuthenticationBackend` to `AUTHENTICATION_BACKENDS`
- [ ] Add `SOCIALACCOUNT_PROVIDERS` block with Google client credentials (read from env vars)
- [ ] Set `SITE_ID = 1` in settings (if not already set)

### Google OAuth — Views & URLs
- [ ] Add `GoogleLoginView` to `user_auth_app/api/views.py` (redirects to Google via allauth)
- [ ] Add `GoogleCallbackView` to `user_auth_app/api/views.py` (handles callback, issues JWT cookies, redirects to `FRONTEND_URL`)
- [ ] Wire up `/api/auth/google/` and `/api/auth/google/callback/` in `core/urls.py`
- [ ] Handle account linking: if email already exists, link OAuth account instead of creating duplicate

### Email Templates & Settings
- [ ] Update `FRONTEND_ACTIVATION_URL` default in `core/settings.py`: `http://localhost:5500/pages/auth/activate.html` → `http://localhost:5173/activate`
- [ ] Update `FRONTEND_CONFIRM_PASSWORD_URL` default in `core/settings.py`: `http://localhost:5500/pages/auth/confirm_password.html` → `http://localhost:5173/password-reset/confirm`
- [ ] Add `FRONTEND_ACTIVATION_URL`, `FRONTEND_CONFIRM_PASSWORD_URL` to `env/.env.template` (currently missing)
- [ ] Add `COMPANY_NAME=Merch Miner` to `env/.env.template` (used in both email templates)
- [ ] Verify `django-app/static/logo.png` exists — `emails.py` embeds it inline via CID; add a placeholder logo if missing or document that it must be provided before emails are sent
- [ ] Note: email templates (`activation.html`, `password_reset.html`) contain no hardcoded API URLs — they use `{{ link }}` context var built in Python — no changes needed to template HTML

### Environment
- [ ] Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FRONTEND_URL` to `django-app/env/.env.template`

### Session Hydration (resolve open question first)
- [ ] Decide: use existing `/api/users/me/` or add `/api/auth/me/` for post-OAuth Redux hydration
- [ ] Ensure chosen endpoint returns `{ id, email }` and works with `CookieJWTAuthentication`

### Migrations
- [ ] Run `python manage.py migrate` to create allauth + sites tables

---

## Frontend

### Scaffold
- [ ] Create `frontend-ui/src/store/index.ts` — configure Redux store
- [ ] Create `frontend-ui/src/store/authSlice.ts` — `auth` slice with `setUser`, `setLoading`, `setError`, `clearAuth` actions
- [ ] Create `frontend-ui/src/services/authService.ts` — axios instance (`withCredentials: true`, baseURL from `VITE_API_URL`), 401 interceptor with token refresh + queue, exported methods: `login`, `register`, `logout`, `requestPasswordReset`, `confirmPasswordReset`, `googleLoginUrl`
- [ ] Create `frontend-ui/src/i18n/index.ts` — i18next setup with inline English translations (no JSON files)
- [ ] Create `frontend-ui/src/style/theme.ts` — MUI `createTheme()` with dark/light `colorSchemes`, no-uppercase buttons, rounded corners
- [ ] Create `frontend-ui/src/components/PrivateRoute.tsx` — reads `isAuthenticated` from Redux; redirects to `/login` if false
- [ ] Update `frontend-ui/src/main.tsx` — wrap app in `<Provider>`, `<ThemeProvider>`, `<SnackbarProvider>`, `<BrowserRouter>`
- [ ] Update `frontend-ui/src/App.tsx` — add all routes: `/login`, `/register`, `/activate`, `/password-reset`, `/password-reset/confirm`, and `<PrivateRoute>` for `/`
- [ ] Add session hydration call in `App.tsx` on mount (call `/api/auth/me/` or `/api/users/me/` to populate Redux from cookie)
- [ ] Create `frontend-ui/.env.template` with `VITE_API_URL=http://localhost:8000`

### Shared Auth UI
- [ ] Create `frontend-ui/src/views/auth/partials/AuthLayout.tsx` — centered MUI Paper card wrapper

### Login Page
- [ ] Create `frontend-ui/src/views/auth/login/schemas/loginSchema.ts` — Zod schema (`email`, `password`)
- [ ] Create `frontend-ui/src/views/auth/login/LoginPage.tsx` — form with email/password fields, submit dispatches to Redux, "Continue with Google" button

### Register Page
- [ ] Create `frontend-ui/src/views/auth/register/schemas/registerSchema.ts` — Zod schema (`email`, `password`, `confirmPassword`)
- [ ] Create `frontend-ui/src/views/auth/register/RegisterPage.tsx` — registration form, success → redirect to `/login` with message

### Activate Page
- [ ] Create `frontend-ui/src/views/auth/activate/ActivatePage.tsx` — reads `?uid=&token=` from URL, calls activate endpoint on mount, shows success/error state

### Password Reset Pages
- [ ] Create `frontend-ui/src/views/auth/password-reset/schemas/passwordResetSchema.ts` — Zod schemas for both request and confirm forms
- [ ] Create `frontend-ui/src/views/auth/password-reset/PasswordResetPage.tsx` — email input form, calls `requestPasswordReset`
- [ ] Create `frontend-ui/src/views/auth/password-reset/PasswordConfirmPage.tsx` — reads `?uid=&token=`, new password form, calls `confirmPasswordReset`

---

## Verification Checklist
- [ ] `npm run dev` → `/login` renders without errors
- [ ] Email login → cookie set → redirected to `/`
- [ ] Unauthenticated visit to `/` → redirected to `/login`
- [ ] Google button → browser redirects to Google OAuth
- [ ] Register → success message → redirect to `/login`
- [ ] Password reset email received → link → new password → login works
- [ ] `docker compose exec web pytest` → all existing tests pass
