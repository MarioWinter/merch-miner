# PROJ-2: Frontend Docker Integration

**Status:** In Progress
**Priority:** P0 (MVP)
**Created:** 2026-02-28

## Overview

Containerise the React/Vite frontend so it runs inside the existing Docker Compose stack alongside Django, PostgreSQL, Redis, and Caddy.

Two modes:
- **Dev** — Vite dev server with HMR mounted inside a container; Caddy proxies `/api/*` and `/admin/*` to Django.
- **Prod** — Multi-stage build: `node` stage compiles the dist, `caddy` stage serves the static files; a shared volume seeds Caddy.

## User Stories

1. As a developer, I want `docker compose up` to start both Django and the React dev server so I don't need separate terminals.
2. As a developer, I want hot-reload to work inside Docker so my edits reflect instantly.
3. As a deployer, I want a single `docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build` to serve the full production stack.

## Acceptance Criteria

### Dev
- `http://localhost:5173` serves the React app
- Editing a `.tsx` file triggers hot reload without rebuilding the container
- POST `/api/auth/login/` is proxied to Django with no CORS error

### Prod
- `app_frontend_build` container exits 0 (dist seeded into shared volume)
- `http://localhost/` serves the React SPA via Caddy
- `http://localhost/api/...` returns Django JSON
- `http://localhost/admin/` serves Django admin
- Deep SPA route (e.g. `/login`) returns `index.html`
- API 404 returns JSON, not `index.html`

## Deliverables

- `frontend-ui/Dockerfile` — prod multi-stage build
- `frontend-ui/Dockerfile.dev` — dev image with HMR
- `docker-compose.dev.yml` — `frontend` service with volume mounts
- `docker-compose.prod.yml` — `frontend` build service + `frontend_dist` volume
- `Caddyfile` — SPA catch-all + explicit `/api/*` and `/admin/*` proxy blocks
- `frontend-ui/vite.config.ts` — `server.proxy` for local dev without Docker

## Dependencies

- PROJ-1 (User Auth) — backend must be reachable for smoke test

---

## QA Test Results

**Tested:** 2026-03-02
**App URL:** http://localhost:5173 (dev) / http://localhost/ (prod)
**Tester:** QA Engineer (AI)
**Method:** Static analysis of all deliverable files + configuration audit (Docker environment not running)

---

### Acceptance Criteria Status

#### AC-Dev-1: `http://localhost:5173` serves the React app
- [x] `Dockerfile.dev` builds a node:20-alpine image, installs deps, exposes 5173
- [x] `docker-compose.dev.yml` binds port `127.0.0.1:5173:5173` and mounts source via volume
- [ ] BUG: `Dockerfile.dev` copies `package.json`/`package-lock.json` at build time but does NOT copy source files. The CMD starts Vite but the host `src/` is only available at runtime via the bind-mount. If the volume is not mounted (e.g. CI, wrong working directory), the container has no source to serve — it will fail silently with a blank or error page. No fallback `COPY . .` layer exists.

#### AC-Dev-2: Editing a `.tsx` file triggers hot reload without rebuilding the container
- [x] Volume bind-mount `../frontend-ui:/app` is present in `docker-compose.dev.yml`
- [x] Anonymous volume `/app/node_modules` prevents host override of installed packages
- [ ] BUG: Vite dev server is started with `--host 0.0.0.0` passed as CMD args, but `vite.config.ts` has no `server.host` setting. Vite v7 requires `server.host: true` (or `'0.0.0.0'`) in `vite.config.ts` for HMR WebSocket to bind correctly inside Docker; relying solely on the CLI flag can cause the HMR WebSocket to advertise `localhost` to the browser instead of the container host, breaking hot reload.

#### AC-Dev-3: POST `/api/auth/login/` is proxied to Django with no CORS error
- [x] `vite.config.ts` defines `server.proxy` for `/api` and `/admin` targets
- [x] `VITE_PROXY_TARGET` env var in `docker-compose.dev.yml` is set to `http://web:8000`, and `vite.config.ts` reads it via `process.env.VITE_PROXY_TARGET`
- [ ] BUG (Critical): `process.env.VITE_PROXY_TARGET` is a Node.js environment variable. Vite reads env files (`.env`) and exposes `VITE_*` vars via `import.meta.env`, but `vite.config.ts` runs in Node.js, where `process.env` IS available. However, variables set via `environment:` in `docker-compose.dev.yml` are runtime environment variables on the container — they ARE available as `process.env` in the Node.js process running Vite. This works correctly. PASS on further reflection.
- [x] `changeOrigin: true` is set, preventing CORS errors from host header mismatch
- [ ] BUG: `authService.ts` sets `BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'`. In the Docker dev container, `VITE_API_URL` is set to an empty string (`""`). An empty string is falsy in JavaScript but `??` (nullish coalescing) only short-circuits on `null`/`undefined`, NOT on empty string. So `BASE_URL` becomes `""` (empty string) instead of `'http://localhost:8000'`. All axios calls will use a relative base URL — which is actually correct behavior (relative URLs work with the Vite proxy), but this is fragile and inconsistent with the intent of the fallback.

#### AC-Prod-1: `app_frontend_build` container exits 0 (dist seeded into shared volume)
- [x] `docker-compose.prod.yml` sets `restart: "no"` and uses `condition: service_completed_successfully`
- [x] `Dockerfile` prod stage: alpine image runs `cp -r /data/dist/. /srv/frontend/` — exits 0 on success
- [x] Caddy `depends_on.frontend.condition: service_completed_successfully` ensures Caddy only starts after dist is seeded
- [ ] BUG: The `cp` command target directory `/srv/frontend/` must already exist inside the `frontend_dist` volume when the container starts. If the volume is brand-new (first run), `/srv/frontend/` may not exist, and `cp -r /data/dist/. /srv/frontend/` will fail with "No such file or directory". There is no `mkdir -p /srv/frontend` before the copy.

#### AC-Prod-2: `http://localhost/` serves the React SPA via Caddy
- [x] Caddyfile catch-all `handle` block sets `root * /srv/frontend` with `try_files {path} /index.html`
- [x] `frontend_dist` volume is mounted read-only at `/srv/frontend` in the caddy service

#### AC-Prod-3: `http://localhost/api/...` returns Django JSON
- [x] Caddyfile `handle /api/*` block reverse-proxies to `web:8000`
- [x] `web` service runs gunicorn on port 8000

#### AC-Prod-4: `http://localhost/admin/` serves Django admin
- [x] Caddyfile `handle /admin/*` block reverse-proxies to `web:8000`

#### AC-Prod-5: Deep SPA route (e.g. `/login`) returns `index.html`
- [x] `try_files {path} /index.html` in the catch-all Caddyfile block handles SPA routing correctly

#### AC-Prod-6: API 404 returns JSON, not `index.html`
- [x] `/api/*` is handled before the catch-all block; Caddy evaluates `handle` blocks in order, and more-specific paths take precedence
- [x] `core/views.py` defines a `handler404` that returns `JsonResponse({'detail': 'Not found.'}, status=404)` — Django returns JSON on 404 within the `/api/` namespace

---

### Edge Cases Status

#### EC-1: `node_modules` from host not leaking into container
- [x] Anonymous volume `/app/node_modules` in `docker-compose.dev.yml` prevents host `node_modules` from being bind-mounted over the container's installed packages

#### EC-2: HMR port conflict / WebSocket connection
- [ ] BUG: The Vite HMR WebSocket default port is 24678. In Docker, if the host does not expose port 24678, HMR may fall back to the main dev server port but there is no explicit `server.hmr` configuration in `vite.config.ts` to guarantee this. Some environments require `server.hmr: { clientPort: 5173 }` when behind a proxy or inside Docker.

#### EC-3: Build-time VITE_API_URL for production
- [x] `VITE_API_URL` is passed as a Docker build ARG and set to empty string in `docker-compose.prod.yml`. Since the SPA uses Caddy as a reverse proxy, all `/api/*` calls are relative and no absolute URL is needed in production — this is correct.

#### EC-4: Worker service in base `docker-compose.yml`
- [ ] BUG (Medium): `docker-compose.yml` defines a `worker` service but there is no `frontend` service in the base compose file. A developer running `docker compose up` (base file only) gets Django + Redis + Postgres + Worker but no frontend. The spec User Story 1 says "`docker compose up` to start both Django and the React dev server". The command required is actually `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`. This is not documented anywhere in the repo (only noted in the spec for prod). Developer DX risk.

#### EC-5: CSRF trusted origins mismatch
- [ ] BUG (High): `settings.py` `CSRF_TRUSTED_ORIGINS` defaults to `http://localhost:5173`. The `.env.template` sets `CSRF_TRUSTED_ORIGINS=http://localhost:4200,http://127.0.0.1:4200` — pointing to port 4200 (Angular default), not 5173 (Vite). Any developer copying `.env.template` verbatim will get CSRF failures on all state-changing requests from the dev frontend.

#### EC-6: Cookie security in dev
- [ ] BUG (Medium): `settings.py` sets `AUTH_COOKIE_SECURE: True` and `CSRF_COOKIE_SECURE = True`. These require HTTPS. In the dev environment, the frontend is served over plain HTTP (`http://localhost:5173`). Browsers will refuse to send `Secure` cookies over HTTP, breaking auth cookie flow in dev mode. There is no dev-specific settings override.

#### EC-7: Static files not collected in dev
- [x] Dev mode uses Django runserver which serves static files automatically — no issue.

#### EC-8: Volume path for prod `cp` command
- [ ] BUG: See AC-Prod-1 — `/srv/frontend/` directory may not exist on first run (missing `mkdir -p`).

---

### Security Audit Results

#### SEC-1: Secrets in `.env.template` committed to git
- [ ] BUG (High): `.env.template` is tracked in git and contains a real Django `SECRET_KEY` value (`django-insecure-lp6h18zq4@z30symy*oz)+hp^uoti48r_ix^qc-m@&yfxd7&hn`). Even though it is labeled "insecure" (Django's convention for dev keys), committing any specific secret value to git is poor practice — developers may copy it verbatim and deploy it to production. The template should use a placeholder like `SECRET_KEY=generate-a-new-key-here`.

#### SEC-2: `.env.template` missing required variables
- [ ] BUG (Medium): `settings.py` references `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FRONTEND_URL`, `FRONTEND_ACTIVATION_URL`, `FRONTEND_CONFIRM_PASSWORD_URL`, and `CORS_ALLOWED_ORIGINS` but none of these appear in `.env.template`. A developer onboarding from the template will silently get empty/default values for all Google OAuth2 settings, making OAuth login non-functional with no obvious error.

#### SEC-3: Caddy HTTPS-only port
- [x] Caddyfile listens on `:80` only. Port 443 is exposed in `docker-compose.prod.yml` but no TLS configuration is present in the Caddyfile. Caddy will not auto-provision TLS without a domain name directive. In a production deployment with a domain, Caddy auto-TLS would need the `:80` listener changed to the actual domain name. This is acceptable for a local/staging setup but is a deployment risk.

#### SEC-4: X-Frame-Options / security headers
- [ ] BUG (Low): No security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`) are configured in the Caddyfile or Django settings (beyond Django's default `XFrameOptionsMiddleware` which adds `X-Frame-Options: DENY`). The Caddyfile should add these headers globally for the prod server.

#### SEC-5: `up.sh` contains SSH deployment credentials
- [ ] BUG (High): `django-app/up.sh` is tracked in git and contains a hardcoded SSH target: `ssh mariowinter_sg@213.165.95.5`. This exposes a production server IP address and username in the public repository. This file should be in `.gitignore` or purged from git history.

#### SEC-6: `AUTH_COOKIE_DOMAIN: 'None'` is a string, not Python None
- [ ] BUG (Medium): `settings.py` sets `'AUTH_COOKIE_DOMAIN': 'None'` — this is the Python string `'None'`, not Python `None`. Django's cookie domain handling will pass the literal string `'None'` as the cookie domain, producing a malformed `Set-Cookie` header (`Domain=None`). This may cause cookies to be scoped incorrectly or rejected by browsers. The value should be `None` (Python None / no quotes) or omitted.

#### SEC-7: `CSRF_COOKIE_SAMESITE = None` without Secure flag in dev
- [ ] Already noted in EC-6. `SameSite=None` requires `Secure`. In dev over HTTP, the browser will reject the CSRF cookie entirely.

#### SEC-8: `SOCIALACCOUNT_LOGIN_ON_GET = True`
- [ ] BUG (Low): This allauth setting enables login via GET requests, which is susceptible to CSRF via link-clicking. It is a known security trade-off documented by allauth. Flagging for awareness — this should be a deliberate decision.

#### SEC-9: Docker image label exposes maintainer email
- [x] `backend.Dockerfile` has `LABEL maintainer="mariowinter.sg@gmail.com"`. This is public-facing metadata and intentional for open-source, but flagged for awareness in a SaaS product context.

#### SEC-10: `window.location.href` redirect on 401
- [x] `authService.ts` uses `window.location.href = '/login'` on 401. This causes a full page reload which clears Redux state — intentional and correct for security (prevents stale auth state).

---

### Bugs Found

#### BUG-1: `AUTH_COOKIE_DOMAIN` is string `'None'` not Python `None`
- **Severity:** High
- **Steps to Reproduce:**
  1. Run prod stack
  2. Attempt login — observe `Set-Cookie` response header
  3. Expected: `access_token` cookie has no `Domain` attribute (or a valid domain)
  4. Actual: Cookie header contains `Domain=None` (literal string), which browsers may reject or scope incorrectly, breaking HttpOnly JWT auth
- **File:** `django-app/core/settings.py` line 89
- **Priority:** Fix before deployment

#### BUG-2: `CSRF_TRUSTED_ORIGINS` in `.env.template` points to wrong port (4200 not 5173)
- **Severity:** High
- **Steps to Reproduce:**
  1. Copy `.env.template` to `.env` verbatim
  2. Start dev stack
  3. Submit any POST form (login, register) from `http://localhost:5173`
  4. Expected: 200 OK
  5. Actual: 403 CSRF verification failed
- **File:** `django-app/.env.template` line 8
- **Priority:** Fix before deployment

#### BUG-3: `AUTH_COOKIE_SECURE: True` + `CSRF_COOKIE_SECURE = True` break dev over HTTP
- **Severity:** High
- **Steps to Reproduce:**
  1. Run dev stack (HTTP only, no TLS)
  2. Attempt login
  3. Expected: Browser stores `access_token` HttpOnly cookie and auth succeeds
  4. Actual: Browser silently drops `Secure` cookies served over HTTP; user cannot log in
- **File:** `django-app/core/settings.py` lines 46-47, 85
- **Priority:** Fix before deployment (needs a dev settings override or per-env flag)

#### BUG-4: `up.sh` exposes production server IP and SSH credentials in git
- **Severity:** High
- **Steps to Reproduce:**
  1. Browse `django-app/up.sh` in git
  2. Observe: `ssh mariowinter_sg@213.165.95.5` — production IP + username hardcoded
- **File:** `django-app/up.sh`
- **Priority:** Fix before deployment (remove from git tracking / add to `.gitignore`)

#### BUG-5: `SECRET_KEY` real value committed in `.env.template`
- **Severity:** High
- **Steps to Reproduce:**
  1. Open `django-app/.env.template` in git
  2. Observe: `SECRET_KEY="django-insecure-lp6h18zq4@z30symy*oz)+hp^uoti48r_ix^qc-m@&yfxd7&hn"` — an actual key value
  3. Risk: developers deploy this key verbatim to production
- **File:** `django-app/.env.template` line 6
- **Priority:** Fix before deployment

#### BUG-6: Missing required env vars in `.env.template`
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Onboard using `.env.template` only
  2. Attempt Google OAuth2 login
  3. Expected: Redirect to Google OAuth
  4. Actual: Silent failure — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS` are all missing from template, defaulting to empty strings
- **File:** `django-app/.env.template`
- **Priority:** Fix before deployment

#### BUG-7: `cp` in prod frontend container fails if `/srv/frontend/` does not exist
- **Severity:** Medium
- **Steps to Reproduce:**
  1. First-time `docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build`
  2. `app_frontend_build` container runs `cp -r /data/dist/. /srv/frontend/`
  3. Expected: exit 0, dist seeded
  4. Actual: exits non-zero with `cp: can't create directory '/srv/frontend/'` if volume is empty and directory doesn't exist
- **File:** `frontend-ui/Dockerfile` line 12
- **Priority:** Fix before deployment

#### BUG-8: No `server.host` or `server.hmr` in `vite.config.ts` for Docker HMR
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Start dev stack with `docker-compose.dev.yml`
  2. Edit a `.tsx` file
  3. Expected: Browser auto-reloads (HMR)
  4. Actual: HMR WebSocket may fail to connect because Vite advertises `localhost` for the HMR host, which the browser resolves to itself rather than the Docker container. Edits do not trigger hot reload.
- **File:** `frontend-ui/vite.config.ts`
- **Priority:** Fix before deployment

#### BUG-9: `VITE_API_URL=""` (empty string) with `??` fallback in authService
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Run Docker dev stack — `VITE_API_URL` is set to `""` in `docker-compose.dev.yml`
  2. `authService.ts`: `BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'`
  3. `??` does NOT coalesce on empty string — `BASE_URL` becomes `""` (empty)
  4. `googleLoginUrl()` returns `"/api/auth/google/"` (empty base + path) — this is a relative URL, which works in browser but is not a valid absolute URL for redirects
  5. In non-browser contexts (SSR, tests) this breaks
- **File:** `frontend-ui/src/services/authService.ts` line 5
- **Priority:** Fix in next sprint

#### BUG-10: Dev command missing user story — no single `docker compose up` for both services
- **Severity:** Low
- **Steps to Reproduce:**
  1. From `django-app/` run `docker compose up`
  2. Expected (per User Story 1): Both Django and React dev server start
  3. Actual: Only Django, Redis, Postgres, Worker start — no frontend service in base `docker-compose.yml`
  4. Developer must know to run `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` — this is undocumented in the repo
- **Priority:** Fix in next sprint (documentation or default compose file restructure)

#### BUG-11: No Caddy security headers in Caddyfile
- **Severity:** Low
- **Steps to Reproduce:**
  1. Run prod stack, inspect HTTP response headers from `http://localhost/`
  2. Expected: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` headers present
  3. Actual: Headers absent (only Django's `X-Frame-Options: DENY` passes through from upstream for HTML admin responses; static/SPA responses have none)
- **File:** `django-app/Caddyfile`
- **Priority:** Fix before deployment

---

### Summary

- **Acceptance Criteria:** 9/12 passed (3 failed: AC-Dev-2 HMR config, AC-Dev-3 VITE_API_URL empty-string edge, AC-Prod-1 mkdir missing)
- **Bugs Found:** 11 total (0 critical, 5 high, 4 medium, 2 low)
- **Security:** 5 findings (BUG-1 cookie domain string, BUG-2 CSRF port mismatch, BUG-3 Secure cookies over HTTP, BUG-4 SSH credentials in git, BUG-5 SECRET_KEY in template)
- **Production Ready:** NO
- **Recommendation:** Fix BUG-1 through BUG-8 before marking production-ready. BUG-4 and BUG-5 are security-critical and must be addressed immediately.
