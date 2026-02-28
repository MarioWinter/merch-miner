# PROJ-1: User Auth (Email/Password + Google OAuth2)

**Status:** Planned
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
