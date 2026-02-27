# Security Audit Report

**Date:** 2026-02-27
**Auditor:** DevSecOps Skill (claude-sonnet-4-6)
**Stack:** Django 5.2 + Docker Compose + Gunicorn (Caddy not yet configured)
**Scope:** Full pre-production audit — django-app/ and frontend-ui/

---

## Executive Summary

| Severity | Count |
|----------|-------|
| Critical | 3     |
| High     | 4     |
| Medium   | 5     |
| Low      | 3     |
| Info     | 4     |

**Verdict:** CRITICAL ISSUES — Do NOT go live until CRITICAL-001, CRITICAL-002, and CRITICAL-003 are resolved.

---

## Findings

### [CRITICAL-001] Real Credentials in `.env` File — Including Email App Password and DB Password

- **Category:** Secrets
- **Severity:** Critical
- **Location:** `django-app/.env` (lines 1–25)
- **Description:** The `.env` file contains real production credentials:
  - Superuser password: `werte1234`
  - Django `SECRET_KEY`: `django-insecure-(6or@t(ffo$j26w3tpud#...)`  (marked "insecure" in key itself)
  - Database password: `#Xwerte1234#X`
  - Gmail app password: `nvfzahwpvvaqzrdt`
  - Superuser email: `mariowinter.sg@gmail.com`

  Although `django-app/.env` is currently gitignored and not in git history, the file exists on disk with live credentials and the key is flagged as "django-insecure" by Django itself. The Gmail app password grants full email account access and should be rotated immediately if this repository is or has been shared. The `SECRET_KEY` is used to sign all sessions and JWTs — it must be rotated before production.
- **Remediation:**
  1. Rotate the Gmail app password at https://myaccount.google.com/apppasswords immediately.
  2. Generate a new SECRET_KEY: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` and update `.env`.
  3. Change the superuser and database passwords to strong, unique values.
  4. Ensure the `.env` file is never stored in a shared location (e.g., cloud storage, Slack, email).
  5. Add a CI check to prevent `.env` commits: pre-commit hook using `detect-secrets` or `trufflehog`.
- **Effort:** Low (rotation) / Medium (process improvement)

---

### [CRITICAL-002] `DEBUG` Setting is Always `True` Due to Python String Truthiness Bug

- **Category:** Code / Configuration
- **Severity:** Critical
- **Location:** `django-app/core/settings.py:31`
- **Description:** The setting is:
  ```python
  DEBUG = os.environ.get('DEBUG', 'False')
  ```
  `os.environ.get()` returns a **string**, not a boolean. In Python, any non-empty string — including the string `'False'` — is truthy. Therefore `if DEBUG:` evaluates to `True` regardless of the env var value. This means:
  - Django debug pages (with full stack traces and environment variable dumps including `SECRET_KEY`) are exposed to the public internet.
  - `settings.MEDIA_URL` serving via `static()` is active in production.
  - `manage.py check --deploy` would flag this as a critical issue.
  - The `.env` currently sets `DEBUG=False` (string), which still results in `DEBUG` being truthy.
- **Remediation:**
  ```python
  DEBUG = os.environ.get('DEBUG', 'False') == 'True'
  ```
  This ensures `DEBUG` is a proper Python boolean. Any value other than the string `'True'` will result in `False`.
- **Effort:** Low (single-line fix)

---

### [CRITICAL-003] Path Traversal in HLS Segment Endpoint (`HLSSegmentView`)

- **Category:** Code
- **Severity:** Critical
- **Location:** `django-app/content/api/views.py:115`
- **Description:** The `segment` parameter from the URL is passed directly into `os.path.join()` without any sanitization:
  ```python
  segment_path = os.path.join(hls_dir, segment)
  if not os.path.isfile(segment_path):
      raise Http404("HLS segment not found.")
  return FileResponse(open(segment_path, "rb"), content_type="video/MP2T")
  ```
  An attacker who is authenticated (or if `IsAuthenticated` is bypassed) can pass an absolute path like `/etc/passwd` as the `segment` parameter. `os.path.join(hls_dir, '/etc/passwd')` returns `/etc/passwd` — completely discarding `hls_dir`. This allows arbitrary file read from the container filesystem.

  Tested locally:
  ```python
  os.path.join('/app/media/videos/hls/720p/test', '/etc/passwd')
  # => '/etc/passwd'
  ```
- **Remediation:**
  Validate that the resolved path stays within the intended directory:
  ```python
  import os

  segment_path = os.path.join(hls_dir, segment)
  # Resolve symlinks and normalize
  real_segment_path = os.path.realpath(segment_path)
  real_hls_dir = os.path.realpath(hls_dir)

  if not real_segment_path.startswith(real_hls_dir + os.sep):
      return Response({"error": "Invalid segment"}, status=400)

  if not os.path.isfile(real_segment_path):
      raise Http404("HLS segment not found.")

  return FileResponse(open(real_segment_path, "rb"), content_type="video/MP2T")
  ```
  Also validate that `segment` matches the expected `.ts` file pattern: `re.match(r'^\d{3}\.ts$', segment)`.
- **Effort:** Low

---

### [HIGH-001] Insecure `SECRET_KEY` in `.env.template` Committed to Git

- **Category:** Secrets
- **Severity:** High
- **Location:** `django-app/.env.template` (committed in git since commit `39938fb`)
- **Description:** The `.env.template` committed to git contains a full, real-looking `SECRET_KEY`:
  ```
  SECRET_KEY="django-insecure-lp6h18zq4@z30symy*oz)+hp^uoti48r_ix^qc-m@&yfxd7&hn"
  ```
  Even though it is labeled "insecure" and intended as a template, it contains a functional key that developers may copy and forget to change. If any developer used this key in production (even temporarily), all sessions/tokens signed with it are compromised. The key is now permanently in git history.
- **Remediation:**
  Replace the template value with a clearly non-functional placeholder:
  ```
  SECRET_KEY=REPLACE_ME_generate_with_get_random_secret_key
  ```
  Note: The key is in git history. Removing it requires `git filter-repo` or `BFG Repo Cleaner`. If this repo is or will be public, treat the template key as compromised.
- **Effort:** Low (template update) / High (git history rewrite)

---

### [HIGH-002] `django-rq` Dashboard Exposed Without Authentication at `/django-rq/`

- **Category:** Auth
- **Severity:** High
- **Location:** `django-app/core/urls.py:17`
- **Description:** The django-rq web dashboard is registered at `path('django-rq/', include('django_rq.urls'))` with no authentication guard. By default, the django-rq dashboard requires `is_staff=True` (Django admin login), but this only works if Django's session authentication is active and the admin URL is configured. If a user is not logged into the Django admin, the dashboard may be accessible. The queue dashboard exposes job payloads (which may contain video IDs, user IDs, file paths) and allows queue manipulation.
- **Remediation:**
  Either restrict the URL to staff-only with a decorator, or remove the dashboard entirely from production:
  ```python
  from django.contrib.admin.views.decorators import staff_member_required
  from django.urls import path, include

  # Option 1: Protect with staff_member_required
  # django-rq uses its own internal auth, but add an extra guard:
  # Move behind admin/ prefix or add to a production-conditional block

  # Option 2: Disable in production
  if settings.DEBUG:
      urlpatterns += [path('django-rq/', include('django_rq.urls'))]
  ```
  Verify django-rq's own authentication is active by checking `RQ_SHOW_ADMIN_LINK` and `LOGIN_URL` settings.
- **Effort:** Low

---

### [HIGH-003] Missing Rate Limiting on Authentication Endpoints

- **Category:** Auth
- **Severity:** High
- **Location:** `django-app/core/settings.py` — `REST_FRAMEWORK` config; `django-app/user_auth_app/api/views.py`
- **Description:** The login (`/api/login/`), register (`/api/register/`), password reset (`/api/password_reset/`), and token refresh (`/api/token/refresh/`) endpoints have no rate limiting configured. `REST_FRAMEWORK` in `settings.py` has no `DEFAULT_THROTTLE_CLASSES` or `DEFAULT_THROTTLE_RATES`. This allows unlimited brute-force attacks against user credentials and unlimited password reset emails (which can be used for email flooding/DoS).
- **Remediation:**
  Add DRF throttle classes to `settings.py`:
  ```python
  REST_FRAMEWORK = {
      # ... existing config ...
      'DEFAULT_THROTTLE_CLASSES': [
          'rest_framework.throttling.AnonRateThrottle',
          'rest_framework.throttling.UserRateThrottle',
      ],
      'DEFAULT_THROTTLE_RATES': {
          'anon': '20/min',
          'user': '100/min',
      }
  }
  ```
  For auth endpoints specifically, use a tighter custom throttle:
  ```python
  class LoginThrottle(AnonRateThrottle):
      rate = '5/min'

  class LoginView(APIView):
      throttle_classes = [LoginThrottle]
  ```
- **Effort:** Low

---

### [HIGH-004] `makemigrations` Runs in Production Entrypoint

- **Category:** Infra
- **Severity:** High
- **Location:** `django-app/backend.entrypoint.sh:18`
- **Description:** The container entrypoint runs `python manage.py makemigrations` on every startup. This command is intended for development only — it auto-generates migration files from model changes. In production this is dangerous: it can create unexpected migration files, fail silently on schema drift, and the generated files will not be persisted (container is ephemeral). It also adds startup latency. The correct production command is `migrate` only (which applies existing migration files).
- **Remediation:**
  Remove `makemigrations` from `backend.entrypoint.sh`:
  ```sh
  # Remove this line:
  python manage.py makemigrations

  # Keep only:
  python manage.py migrate
  ```
  Migration files should always be generated locally and committed to git.
- **Effort:** Low

---

### [MEDIUM-001] Missing Django Security Headers (`SECURE_HSTS_*`, `SECURE_SSL_REDIRECT`)

- **Category:** Headers
- **Severity:** Medium
- **Location:** `django-app/core/settings.py`
- **Description:** The following production security settings are absent:
  - `SECURE_HSTS_SECONDS` — not set (HSTS not enforced)
  - `SECURE_HSTS_INCLUDE_SUBDOMAINS` — not set
  - `SECURE_HSTS_PRELOAD` — not set
  - `SECURE_SSL_REDIRECT` — not set (HTTP requests not redirected to HTTPS)
  - `SECURE_CONTENT_TYPE_NOSNIFF` — not set
  - `SECURE_BROWSER_XSS_FILTER` — not set
  - `SECURE_REFERRER_POLICY` — not set

  `CSRF_COOKIE_SECURE = True` and `SESSION_COOKIE_SECURE = True` are correctly set.

  Without HSTS, users who visit the HTTP version of the site are vulnerable to downgrade attacks. Without `SECURE_SSL_REDIRECT`, Django itself will not enforce HTTPS (though Caddy/Nginx can handle this at the proxy layer).
- **Remediation:**
  Add to `settings.py` (conditional on `DEBUG` being `False`):
  ```python
  if not DEBUG:
      SECURE_HSTS_SECONDS = 31536000
      SECURE_HSTS_INCLUDE_SUBDOMAINS = True
      SECURE_HSTS_PRELOAD = True
      SECURE_SSL_REDIRECT = True
      SECURE_CONTENT_TYPE_NOSNIFF = True
      SECURE_BROWSER_XSS_FILTER = True
      SECURE_REFERRER_POLICY = 'origin-when-cross-origin'
  ```
  Note: Fix CRITICAL-002 (DEBUG boolean bug) before these conditionals will work correctly.
- **Effort:** Low

---

### [MEDIUM-002] No Caddyfile / Reverse Proxy Configuration Present

- **Category:** Infra / Headers
- **Severity:** Medium
- **Location:** Project root — no `Caddyfile` found
- **Description:** No `Caddyfile` exists in the project. The architecture calls for Caddy as the reverse proxy for HTTPS termination, security headers, and TLS. Without it:
  - HTTPS is not enforced at the proxy layer
  - Security headers (`Strict-Transport-Security`, `X-Frame-Options`, `Content-Security-Policy`) are not set at the edge
  - The Django `web` service is directly exposed on `127.0.0.1:8000` with no TLS

  Before production, a Caddy or Nginx configuration with HTTPS must be deployed.
- **Remediation:**
  Minimal hardened `Caddyfile` for production:
  ```caddyfile
  videoflix-backend.mariowinter.com {
      reverse_proxy 127.0.0.1:8000

      header {
          Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
          X-Frame-Options "DENY"
          X-Content-Type-Options "nosniff"
          Referrer-Policy "origin-when-cross-origin"
          Content-Security-Policy "default-src 'self'"
          -Server
      }
  }
  ```
  Add `caddy` as a service in `docker-compose.yml` with the Caddyfile volume-mounted.
- **Effort:** Medium

---

### [MEDIUM-003] Hardcoded Fallback DB Password in `settings.py`

- **Category:** Secrets
- **Severity:** Medium
- **Location:** `django-app/core/settings.py:146`
- **Description:** The database password has a hardcoded fallback:
  ```python
  "PASSWORD": os.environ.get("DB_PASSWORD", default="supersecretpassword"),
  ```
  If `DB_PASSWORD` is missing from the environment, Django will silently connect using the hardcoded value `supersecretpassword`. This could mask a misconfigured environment and connect to a database without the operator's awareness.
- **Remediation:**
  Remove the fallback or raise an error:
  ```python
  "PASSWORD": os.environ.get("DB_PASSWORD") or (_ for _ in ()).throw(
      ValueError("DB_PASSWORD environment variable is required")
  ),
  ```
  Or more simply, let the connection fail visibly if `DB_PASSWORD` is not set. Use `None` as the default:
  ```python
  "PASSWORD": os.environ.get("DB_PASSWORD"),
  ```
  Then add a startup check in `entrypoint.sh`:
  ```sh
  [ -z "$DB_PASSWORD" ] && echo "ERROR: DB_PASSWORD not set" && exit 1
  ```
- **Effort:** Low

---

### [MEDIUM-004] Redis Has No Password Authentication

- **Category:** Infra
- **Severity:** Medium
- **Location:** `django-app/docker-compose.yml` (redis service) and `django-app/core/settings.py`
- **Description:** The Redis service is started with no password:
  ```yaml
  redis:
      image: redis:latest
  ```
  The `REDIS_LOCATION` is `redis://redis:6379/1` — no credentials. While Redis is on an internal Docker network (not port-exposed), if any container in the stack is compromised, an attacker can connect to Redis without authentication. Redis can be used to escalate: reading job payloads (which may contain user data or file paths), injecting malicious jobs, or using `SLAVEOF` for data exfiltration.

  Also: `redis:latest` is used — unpinned image tags are a supply-chain risk.
- **Remediation:**
  1. Add a Redis password:
     ```yaml
     redis:
         image: redis:7.4-alpine
         command: redis-server --requirepass ${REDIS_PASSWORD}
     ```
  2. Add `REDIS_PASSWORD` to `.env.template` and update `REDIS_LOCATION`:
     ```
     REDIS_LOCATION=redis://:${REDIS_PASSWORD}@redis:6379/1
     ```
  3. Pin image tags: use `redis:7.4-alpine` instead of `redis:latest`.
- **Effort:** Low

---

### [MEDIUM-005] `postgres:latest` Image Tag Unpinned

- **Category:** Infra / Container
- **Severity:** Medium
- **Location:** `django-app/docker-compose.yml:2`
- **Description:** Both `postgres:latest` and `redis:latest` use unpinned `latest` tags. In production, this means a `docker compose pull` can silently upgrade the database to a new major version (e.g., Postgres 16 → 17), potentially breaking schema compatibility or introducing regressions. It also makes deployments non-reproducible.
- **Remediation:**
  Pin to specific patch versions:
  ```yaml
  db:
      image: postgres:17.2-alpine
  redis:
      image: redis:7.4-alpine
  ```
- **Effort:** Low

---

### [LOW-001] No Non-Root User in Dockerfile

- **Category:** Container
- **Severity:** Low
- **Location:** `django-app/backend.Dockerfile`
- **Description:** The Dockerfile does not define or switch to a non-root user. The container process runs as `root`. If the application is compromised (e.g., via the path traversal in CRITICAL-003 or an RCE in a dependency), the attacker has root access inside the container, making container escape easier and giving full read/write access to all mounted volumes including `/app/media`.
- **Remediation:**
  Add to `Dockerfile` after the `RUN` block:
  ```dockerfile
  RUN addgroup -S appgroup && adduser -S appuser -G appgroup
  USER appuser
  ```
  Ensure file ownership of `/app` is correct: `RUN chown -R appuser:appgroup /app`
- **Effort:** Low

---

### [LOW-002] Gunicorn Binds to `0.0.0.0` Inside Container

- **Category:** Infra
- **Severity:** Low
- **Location:** `django-app/backend.entrypoint.sh:43`
- **Description:** Gunicorn is started with `--bind 0.0.0.0:8000`. Inside the container this is expected (it must accept connections from the Docker network). However, because `docker-compose.yml` correctly maps the port as `127.0.0.1:8000:8000`, exposure is limited to the host loopback. This is acceptable if a reverse proxy (Caddy) is placed in front. Noted for completeness.
- **Remediation:** No action required if Caddy (MEDIUM-002) is deployed. Verify that no future change removes the `127.0.0.1:` binding prefix in `docker-compose.yml`.
- **Effort:** Info

---

### [LOW-003] `CSRF_COOKIE_SAMESITE = None` and `SESSION_COOKIE_SAMESITE = None`

- **Category:** Auth
- **Severity:** Low
- **Location:** `django-app/core/settings.py:45–47`
- **Description:** Both CSRF and session cookies are set to `SameSite=None`. This is required when the frontend and backend are on different origins (cross-site requests), but it reduces CSRF protection. With `SameSite=None`, cookies are sent on all cross-site requests, meaning CSRF attacks are theoretically possible if the CSRF token validation is misconfigured. The application uses DRF with JWT cookies (not session auth for API), so this is lower risk for the API itself. The Django admin panel (session-based) is a greater concern.
- **Remediation:**
  Restrict `SameSite=None` to only the JWT cookies (already set in `SIMPLE_JWT`). Consider whether the Django admin requires cross-site cookies at all — if not, set `SESSION_COOKIE_SAMESITE = 'Lax'` and `CSRF_COOKIE_SAMESITE = 'Lax'` for better protection of the admin panel.
- **Effort:** Low

---

### [INFO-001] No Security Scanning Tools Installed

- **Category:** Process
- **Severity:** Info
- **Location:** Development environment
- **Description:** None of the standard security scanning tools are installed:
  - `trufflehog` — secrets detection in git history
  - `bandit` — Python SAST
  - `trivy` — container CVE scanning
  - `pip-audit` — Python dependency vulnerability scanner
- **Remediation:**
  ```bash
  # Install security tools
  pip install bandit pip-audit
  brew install trivy trufflehog   # macOS

  # Add to CI/CD pipeline (GitHub Actions example):
  # - run: pip install bandit pip-audit
  # - run: bandit -r django-app/ -x django-app/env
  # - run: pip-audit -r django-app/requirements.txt
  # - run: trivy image <image-name> --severity HIGH,CRITICAL
  ```
  Add these to a `.github/workflows/security.yml` CI job to run on every PR.
- **Effort:** Low

---

### [INFO-002] `npm audit` Not Executed (No Shell Access to Frontend)

- **Category:** Deps
- **Severity:** Info
- **Location:** `frontend-ui/`
- **Description:** Frontend dependency audit (`npm audit`) could not be run in this environment. The package versions pinned in `package.json` are recent (React 19.2.4, Vite 7.3.1, MUI 7.3.8, axios 1.13.5, etc.) and appear current as of the audit date. No obviously outdated packages were identified by version inspection.
- **Remediation:**
  Run locally: `cd frontend-ui && npm audit --audit-level=high`
  Add to CI/CD pipeline.
- **Effort:** Low

---

### [INFO-003] `COMPANY_NAME` and `ALLOWED_HOSTS` Defaults Not in `.env.template`

- **Category:** Config
- **Severity:** Info
- **Location:** `django-app/.env.template`
- **Description:** `COMPANY_NAME` is referenced in `settings.py` but not documented in `.env.template`. `CORS_ALLOWED_ORIGINS` is also missing from the template. These are minor documentation gaps that could cause confusion during deployment.
- **Remediation:** Add `COMPANY_NAME=My App` and `CORS_ALLOWED_ORIGINS=` to `.env.template`.
- **Effort:** Low

---

### [INFO-004] Django Admin Exposed at `/admin/` on Public Domain

- **Category:** Auth
- **Severity:** Info
- **Location:** `django-app/core/urls.py:16`
- **Description:** Django admin is at the default `/admin/` path. This is a well-known URL targeted by bots and automated scanners. It is protected by authentication, but the predictable path increases attack surface.
- **Remediation:** Consider moving to a non-default path (e.g., `/secret-dashboard-xyz/`):
  ```python
  path('secret-dashboard-xyz/', admin.site.urls),
  ```
  Also enable 2FA on the admin user (via `django-otp` or `django-allauth` MFA).
- **Effort:** Low

---

## Missing Tools

| Tool | Purpose | Install |
|------|---------|---------|
| `trufflehog` | Secrets in git history | `brew install trufflehog` |
| `bandit` | Python SAST | `pip install bandit` |
| `trivy` | Container CVE scanning | `brew install trivy` |
| `pip-audit` | Python dependency CVEs | `pip install pip-audit` |

---

## Passed Checks

- `.env` file is gitignored and not in git history (current HEAD)
- `CSRF_COOKIE_SECURE = True` is set
- `SESSION_COOKIE_SECURE = True` is set
- `JWT AUTH_COOKIE_SECURE = True` and `AUTH_COOKIE_HTTP_ONLY = True` are set
- `JWT ROTATE_REFRESH_TOKENS = True` and `BLACKLIST_AFTER_ROTATION = True` are set (proper token rotation)
- All content API views explicitly set `permission_classes = [IsAuthenticated]`
- `UserProfileViewSet` inherits global `DEFAULT_PERMISSION_CLASSES = [IsAuthenticated]`
- CORS is not set to wildcard (`*`) — specific origins only
- `CORS_ALLOW_CREDENTIALS = True` is paired with specific origin list (not wildcard)
- Database port is NOT exposed in `docker-compose.yml` (no `ports:` on `db` service)
- Redis port is NOT exposed in `docker-compose.yml`
- Django `web` port is bound to `127.0.0.1:8000` (not `0.0.0.0`)
- Dockerfile uses `python:3.12-alpine` (minimal image, not `python:latest`)
- Build dependencies (`gcc`, `musl-dev`, `postgresql-dev`) are cleaned up in the same RUN layer (`apk del .build-deps`)
- `AllowAny` is only used on public-facing auth endpoints (register, login, logout, activate, password reset/confirm, token refresh) — appropriate
- subprocess in `content/api/utils.py` uses a list argument (not shell=True) — not shell-injectable via Python
- `AUTH_PASSWORD_VALIDATORS` includes all 4 standard Django validators
- No raw SQL found — ORM used throughout

---

## Recommended Next Steps

Ordered by priority:

### Before Going Live (Blockers)

1. **Fix CRITICAL-002:** Change `DEBUG = os.environ.get('DEBUG', 'False')` to `DEBUG = os.environ.get('DEBUG', 'False') == 'True'`. This single-line fix unblocks multiple downstream security settings.

2. **Fix CRITICAL-003:** Add path traversal validation to `HLSSegmentView.get()`. Validate that `real_segment_path.startswith(real_hls_dir + os.sep)` and optionally enforce a `.ts` extension regex.

3. **Fix CRITICAL-001:** Rotate the Gmail app password and Django `SECRET_KEY` immediately. Generate a new key with `get_random_secret_key()`. Verify `.env` is not accessible to anyone outside the deployment environment.

4. **Fix HIGH-001:** Replace the `SECRET_KEY` value in `.env.template` with a non-functional placeholder string.

5. **Fix HIGH-003:** Add DRF `DEFAULT_THROTTLE_CLASSES` and `DEFAULT_THROTTLE_RATES` to `settings.py` with tight limits on auth endpoints.

6. **Fix HIGH-004:** Remove `makemigrations` from `backend.entrypoint.sh`.

### Sprint 1 After Launch

7. **Fix HIGH-002:** Protect or disable the `django-rq` dashboard URL in production.

8. **Fix MEDIUM-001:** Add `SECURE_HSTS_*`, `SECURE_SSL_REDIRECT`, and `SECURE_CONTENT_TYPE_NOSNIFF` to settings (requires CRITICAL-002 fix first).

9. **Fix MEDIUM-002:** Create a `Caddyfile` with HTTPS and security headers. Add to Docker Compose.

10. **Fix MEDIUM-003:** Remove the hardcoded `supersecretpassword` DB fallback.

11. **Fix MEDIUM-004:** Add Redis password authentication and pin image tags.

12. **Fix MEDIUM-005:** Pin `postgres` and `redis` image tags to specific versions.

### Ongoing / Best Practices

13. **LOW-001:** Add a non-root user to the Dockerfile.

14. **INFO-001:** Install `bandit`, `pip-audit`, `trivy`, `trufflehog` and add them to the CI/CD pipeline.

15. **INFO-002:** Run `npm audit` on frontend dependencies.

16. Schedule re-audit after fixing all Critical/High findings. Run `/devsecops` again before next major release.

---

## Checklist

- [x] Secrets detection run (trufflehog fallback: git log + grep)
- [x] `.env` files confirmed not in git (`.env` gitignored, `.env.template` tracked)
- [ ] Bandit SAST run on Python code — **tool not installed**
- [ ] `manage.py check --deploy` executed — **Docker not running**
- [ ] Trivy container scan — **tool not installed** (Dockerfile manually audited)
- [ ] `npm audit` run for frontend — **shell access denied**
- [ ] `pip-audit` run for backend — **tool not installed**
- [x] `docker-compose.yml` audited for port exposure and hardening
- [x] Caddyfile audited — **absent, documented as MEDIUM-002**
- [x] Django security settings verified in `settings.py`
- [x] API views checked for missing auth/permissions
- [x] CORS configuration verified
- [x] `.env` values checked for placeholder defaults
