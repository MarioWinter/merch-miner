# PROJ-1: User Auth (Email/Password + Google OAuth2)

**Status:** In Review
**Priority:** P0 (MVP)
**Created:** 2026-02-27

## Overview

Extend the existing `user_auth_app` with Google OAuth2 social login via `django-allauth`. The email/password flow (registration, activation, login, logout, password reset, JWT via HttpOnly cookie) is already built and tested. This spec covers the Google OAuth2 addition and the corresponding frontend login/register pages.

## User Stories

1. As a new user, I want to register with email + password and receive an activation email, so that I can securely create an account.
2. As a returning user, I want to log in with email + password, so that I can access my workspace.
3. As a user, I want to click "Sign in with Google" and be redirected to Google's OAuth screen, so that I don't have to create a new password.
4. As a Google sign-in user, I want my account auto-created on first sign-in, so that onboarding is frictionless.
5. As a logged-in user, I want my session maintained via HttpOnly cookie (not localStorage), so that my credentials are protected from XSS.

## Acceptance Criteria

1. `django-allauth` `google` provider configured in `settings.py` with `SOCIALACCOUNT_PROVIDERS`.
2. Google OAuth credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) stored in `.env`, documented in `.env.template`.
3. Social login callback issues same `CookieJWT` as email/password login.
4. Existing email/password tests continue to pass.
5. Frontend Login page: email/password form + "Continue with Google" button (MUI).
6. Frontend Register page: email/password form + "Sign up with Google" option.
7. Auth state persisted in Redux `authSlice` (user, isAuthenticated, loading, error).
8. Axios interceptor redirects to `/login` on 401 and clears Redux auth state.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register/` | Email+password signup |
| POST | `/api/auth/login/` | Returns JWT cookie |
| GET | `/api/auth/google/` | Redirects to Google OAuth |
| GET | `/api/auth/google/callback/` | Receives code, issues JWT cookie, redirects to frontend |
| POST | `/api/auth/logout/` | Clears JWT cookie |
| POST | `/api/auth/token/refresh/` | Refresh JWT |
| POST | `/api/auth/password/reset/` | Email-based reset |

## Edge Cases

1. Google account email matches existing email/password account → link accounts; user can use both methods.
2. User denies Google OAuth consent → redirect back to login page with error message.
3. Google OAuth callback with invalid/expired code → 400 error; user shown "Login failed, try again."
4. Social login for a disabled/unactivated account → allow (social accounts skip email activation).
5. JWT expires during session → interceptor auto-refreshes silently.

## Dependencies

None — this is the root dependency for all other features.

## Implementation Notes

- `allauth.socialaccount.providers.google` added to `INSTALLED_APPS`
- Callback URL: `https://{domain}/api/auth/google/callback/`
- On social callback: check if email exists → link accounts; if new → auto-register + auto-activate + issue JWT cookie → redirect to `/` (frontend)
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` must be added to `env/.env.template`

---

## QA Report — v2 (Re-Audit)

**Date:** 2026-03-02
**Tester:** Claude Sonnet 4.6 (QA/Red-Team)
**Branch:** `001-user-auth-implement`
**Based on commits:** up to `77976f0` (Refactor Docker setup)
**Docker:** NOT running (backend pytest could not be executed live)

> v1 report (same date, earlier session) identified 7 bugs. This v2 re-audit verifies fixes, re-tests all acceptance criteria, and documents newly found issues.

---

### Summary

| Result | Count |
|--------|-------|
| PASS | 7 |
| PARTIAL | 1 |
| FAIL | 0 |
| **Total AC** | **8** |

**Open bugs (new): 3**
**Bugs fixed since v1: 6 of 7**
**Security issues open: 3**

---

### Acceptance Criteria Checklist

**AC-1: django-allauth google provider configured in settings.py** -- PASS
- `allauth`, `allauth.account`, `allauth.socialaccount`, `allauth.socialaccount.providers.google` all in `INSTALLED_APPS` (`settings.py:107-110`)
- `SOCIALACCOUNT_PROVIDERS` configured with `google` key, PKCE enabled (`settings.py:121-132`)
- `AUTHENTICATION_BACKENDS` includes allauth backend (`settings.py:116-119`)
- `AccountMiddleware` present in `MIDDLEWARE` (`settings.py:150`)
- `SOCIALACCOUNT_LOGIN_ON_GET = True`, `SOCIALACCOUNT_AUTO_SIGNUP = True`, `SOCIALACCOUNT_EMAIL_VERIFICATION = 'none'` set

**AC-2: Google OAuth credentials in .env and .env.template** -- PASS
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` read from env in `settings.py:60-61`
- Both present in `django-app/.env.template:16-17` with placeholder values `your-google-oauth2-client-id`
- Actual `.env` contains real values and is gitignored (verified by `.gitignore` check)

**AC-3: Social login callback issues same CookieJWT as email/password** -- PASS
- `GoogleCallbackView.get()` (`views.py:333-339`) calls `RefreshToken.for_user(user)` then `set_jwt_cookies(redirect_response, access_token, refresh)` -- identical utility as `LoginView`
- Adapter forces correct callback URL via `CustomGoogleOAuth2Adapter.get_callback_url()` (`adapters.py:7-8`)
- Error paths redirect to `{FRONTEND_URL}/login?error=oauth_failed`

**AC-4: Existing email/password tests continue to pass** -- PARTIAL
- 12 test files confirmed present in `django-app/user_auth_app/tests/`
- Docker daemon not running; `pytest` could not be executed
- **NEW FINDING:** `test_register.py:19` asserts `'token' in response.data` -- this assertion is now stale because the token was correctly removed from the register response (v1 BUG-1 fix). This test will FAIL when Docker is run. See BUG-NEW-1.
- **NEW FINDING:** `test_login.py:26` asserts `response.data['user']['username']` -- the current `LoginView` returns `user.email` not `user.username` in the user object (`views.py:141`). This test will FAIL when Docker is run. See BUG-NEW-2.

**AC-5: Frontend Login page with email/password + Google button** -- PASS
- `LoginPage.tsx` has email/password form with `Controller` + `TextField` (MUI)
- "Continue with Google" button present with `GoogleIcon` from `@mui/icons-material` (`LoginPage.tsx:73-95`)
- Uses `react-hook-form` + Zod resolver (`loginSchema.ts`)
- All strings via `useTranslation()` (i18n compliant)
- Loading state with `CircularProgress`
- `slotProps={{ htmlInput: {...} }}` used correctly (MUI v7 pattern, `LoginPage.tsx:124`)
- Frontend now reads `data.user.id` and `data.user.email` correctly (`LoginPage.tsx:46`)

**AC-6: Frontend Register page with email/password + Google option** -- PASS
- `RegisterPage.tsx` has email + password + confirmPassword form
- "Sign up with Google" button present (`RegisterPage.tsx:75-97`)
- Uses same auth patterns (Zod schema, i18n, notistack)
- `setError` now dispatched on failure (`RegisterPage.tsx:52`)

**AC-7: Auth state in Redux authSlice** -- PASS
- `authSlice.ts` defines `AuthState` with `user`, `isAuthenticated`, `loading`, `error`
- Actions: `setUser`, `setLoading`, `setError`, `clearAuth` -- all implemented and tested
- `store/index.ts` registers `auth: authReducer`
- Typed hooks in `store/hooks.ts`

**AC-8: Axios interceptor redirects to /login on 401 and clears Redux** -- PASS
- 401 interceptor in `authService.ts:32-71` attempts silent token refresh first
- On refresh failure: `store.dispatch(clearAuth())` + `window.location.href = '/login'` (guarded by `pathname !== '/login'` check to prevent redirect loop)
- Interceptor correctly skips retry for `/api/auth/token/refresh/` URL
- `window.location.href` behavior accepted as a known trade-off (axios interceptor is outside the React tree)

---

### Bugs Fixed Since v1

| ID | Description | Status |
|----|-------------|--------|
| BUG-1 | Activation token leaked in register response | FIXED (`views.py:48-53` no longer returns `token`) |
| BUG-2 | Login response shape mismatch | FIXED (frontend reads `data.user.id`/`data.user.email`; backend returns `user.email`) |
| BUG-3/SEC-3 | No rate limiting on auth endpoints | FIXED (`DEFAULT_THROTTLE_CLASSES` added to `REST_FRAMEWORK` in `settings.py:266-274`) |
| BUG-4 | Missing security headers | FIXED (`SECURE_CONTENT_TYPE_NOSNIFF`, `X_FRAME_OPTIONS`, `REFERRER_POLICY`, `SECURE_HSTS_*` added at `settings.py:277-281`) |
| BUG-5 | Register page does not dispatch setError | FIXED (`RegisterPage.tsx:52` now calls `dispatch(setError(...))`) |
| BUG-7 | Zero frontend tests | FIXED (13 tests added across `authSlice.test.ts`, `LoginPage.test.tsx`, `RegisterPage.test.tsx`; all pass) |

---

### Bugs Found (New — v2)

**BUG-NEW-1: test_register_user_success asserts removed `token` field**
- Severity: **HIGH**
- File: `django-app/user_auth_app/tests/test_register.py:19`
- Description: `assert 'token' in response.data` was written when `RegisterView` returned the activation token. After the BUG-1 fix (correct), the token is no longer in the response. This test assertion is now wrong and will fail when `pytest` is run, breaking AC-4.
- Steps to reproduce: Start Docker and run `docker compose exec web pytest user_auth_app/tests/test_register.py::test_register_user_success`
- Expected: `AssertionError: assert 'token' in {'user': {'id': ..., 'email': ...}}`
- Priority: P1 -- blocks backend test suite from passing

**BUG-NEW-2: test_login_user_success asserts non-existent `username` field**
- Severity: **HIGH**
- File: `django-app/user_auth_app/tests/test_login.py:26`
- Description: `assert response.data['user']['username'] == 'testuser@test.com'`. The current `LoginView` returns `user.email` in the user object (`views.py:141`), not `username`. The key `username` does not exist in the response. This test will fail with a `KeyError` when run.
- Steps to reproduce: Start Docker and run `docker compose exec web pytest user_auth_app/tests/test_login.py::test_login_user_success`
- Expected: `KeyError: 'username'`
- Priority: P1 -- blocks backend test suite from passing

**BUG-NEW-3: PrivateRoute renders null during auth hydration (blank flash)**
- Severity: **LOW**
- File: `frontend-ui/src/components/PrivateRoute.tsx:8`
- Description: `if (loading) return null` renders a blank white screen during the `hydrateAuth()` call on app load. There is no loading spinner or skeleton. On slow connections, users see a blank screen for 200-500ms before seeing the dashboard or being redirected to `/login`.
- Steps: Hard refresh `http://localhost:5173/` while authenticated. Observe blank white flash before dashboard renders.
- Priority: P3 -- cosmetic but poor UX

---

### Security Issues (Red-Team Audit — v2)

**SEC-2: No CSRF enforcement on state-changing auth endpoints** -- OPEN
- Risk: MEDIUM
- `AllowAny` views (login, register, logout, password reset) have no CSRF token validation. Only `CookieJWTAuthentication` is in `DEFAULT_AUTHENTICATION_CLASSES`; Django's `SessionAuthentication` (which enforces CSRF) is absent.
- In production: `AUTH_COOKIE_SAMESITE = 'None'` with `Secure=True` is set, which allows cross-origin cookie sending. A malicious origin can trigger state-changing requests.
- Mitigation: Production requires HTTPS (`Secure=True`), and CORS is restricted to known origins. Risk is partially mitigated by `CORS_ALLOW_CREDENTIALS = True` + `CORS_ALLOWED_ORIGINS` allowlist.
- Recommendation: Switch JWT cookies to `SameSite=Lax` in production for state-changing endpoints, or enforce CSRF tokens. Low-urgency for MVP but must be addressed before multi-tenant exposure.

**SEC-4: Password reset timing side-channel** -- OPEN (informational, low risk)
- Risk: LOW
- `PasswordResetView` (`views.py:218-228`) has different code paths for existing vs. non-existing users (sends email vs. no-op). A timing attack could confirm user existence.
- The view always returns HTTP 200, which is correct. However, timing difference between email-send and no-op is measurable.
- Recommendation: Use async email sending (django-rq task) to equalize timing. Low-urgency for MVP.

**SEC-5: AUTH_COOKIE_SAMESITE fixed behavior across environments** -- PARTIALLY MITIGATED
- Risk: LOW (was MEDIUM in v1, now reassessed)
- `AUTH_COOKIE_SAMESITE = 'None' if not DEBUG else 'Lax'` (`settings.py:88`). In production (`DEBUG=False`): `SameSite=None; Secure=True` -- correct for cross-origin setups. In development (`DEBUG=True`): `SameSite=Lax` -- correct and safe.
- The logic was flipped from the v1 finding. The current code IS correct and uses `Lax` in development. v1 finding was based on a different code state.
- Status: No action needed. Logic is correct.

---

### Frontend Test Results (Vitest)

`npm run test:ci` executed at `/Users/mariomuller/dev/merch-miner/frontend-ui/`

**Result: 13 passed, 0 failed, 0 errors**

| Suite | Tests | Result |
|-------|-------|--------|
| `authSlice.test.ts` | 6 | PASS |
| `LoginPage.test.tsx` | 4 | PASS |
| `RegisterPage.test.tsx` | 3 | PASS |

**Coverage:**
| File | Statements | Branches | Functions |
|------|-----------|---------|-----------|
| `authSlice.ts` | 100% | 100% | 100% |
| `LoginPage.tsx` | 95.83% | 58.33% | 85.71% |
| `RegisterPage.tsx` | 95.65% | 50% | 87.5% |
| `AuthLayout.tsx` | 100% | 50% | 100% |

Missing coverage: `LoginPage.tsx:58` (`handleGoogleLogin`), `RegisterPage.tsx:60` (`handleGoogleRegister`) -- Google OAuth redirect handlers are not tested. Low priority (they are one-liners that set `window.location.href`).

---

### Backend Test Status

- Docker not running during this audit session
- 12 test files exist; expected failures identified at:
  - `test_register.py:19` (BUG-NEW-1)
  - `test_login.py:26` (BUG-NEW-2)
- No `test_google_*.py` file exists -- GoogleLoginView and GoogleCallbackView have no backend tests

---

### Cross-Browser / Responsive Assessment

- All auth pages use MUI components (`Stack`, `TextField`, `Button`) which are responsive by default
- `AuthLayout` card: `maxWidth: 440`, `p: 5` (40px padding), `px: 2` on outer container
- At 375px viewport: card becomes `width: 100%` minus `px: 2` (16px total) = ~343px available. Card padding (`p: 5` = 40px each side) leaves 263px for content. Form fields remain usable.
- Google button: `fullWidth` -- scales correctly at all breakpoints
- No custom `Hidden` component used (correct per MUI v7 rules)
- No CSS modules or Tailwind (correct per project conventions)
- Cross-browser rendering not testable without running dev server

---

### Production-Ready Decision

**NOT READY**

Two backend tests are now broken (BUG-NEW-1 and BUG-NEW-2). AC-4 cannot be marked PASS until Docker runs clean. These must be fixed before marking the feature Deployed.

---

### Recommendations (Prioritized)

1. **P1** -- Fix `test_register.py:19`: remove `assert 'token' in response.data` (BUG-NEW-1)
2. **P1** -- Fix `test_login.py:26`: change `response.data['user']['username']` to `response.data['user']['email']` (BUG-NEW-2)
3. **P1** -- Start Docker and run full pytest suite to confirm all 12 test files pass
4. **P2** -- Add backend tests for `GoogleLoginView` and `GoogleCallbackView` (no test file exists)
5. **P3** -- Add loading spinner to `PrivateRoute` during hydration (BUG-NEW-3)
6. **P3** -- Add frontend tests for `ActivatePage`, `PasswordResetPage`, `PasswordConfirmPage`, `PrivateRoute`, `authService.hydrateAuth` (not tested; coverage target per project conventions)

---
*QA Report v2 generated 2026-03-02 by Claude Sonnet 4.6*
