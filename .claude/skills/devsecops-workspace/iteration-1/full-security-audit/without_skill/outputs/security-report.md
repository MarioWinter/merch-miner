# Full Security Audit Report
**Date:** 2026-02-27
**Project:** ai-coding-kit (Django backend + React frontend)
**Scope:** Production readiness security audit
**Auditor:** Claude Sonnet 4.6 (automated static analysis)

---

## Executive Summary

The application has a **moderate-to-high** pre-production risk profile. No secrets were found directly committed to git history, but several critical and high severity issues must be resolved before going live. The most pressing issues are: a real `.env` file with live credentials on disk, a hardcoded insecure `SECRET_KEY` in the committed `.env.template`, missing security headers, no rate limiting on auth endpoints, a path traversal vulnerability in HLS segment serving, and running Gunicorn on all interfaces inside the container.

---

## Severity Scale
- **CRITICAL** — Immediate exploitation possible; block deployment
- **HIGH** — Significant risk; fix before go-live
- **MEDIUM** — Should be fixed soon after go-live
- **LOW** — Best-practice improvement

---

## Findings

### CRITICAL-1: Live Credentials in `.env` File on Disk
**File:** `django-app/.env`

The `.env` file contains real production credentials:
- Django `SECRET_KEY` with value `django-insecure-(6or@t(ffo$j26w3...)` — the `django-insecure-` prefix means it was generated for development; this exact key should never be used in production
- Gmail App Password: `nvfzahwpvvaqzrdt`
- Database password: `#Xwerte1234#X`
- Superuser password: `werte1234`
- Real email address: `mariowinter.sg@gmail.com`
- Real domain names: `videoflix-backend.mariowinter.com`, `videoflix.mariowinter.com`

**Risk:** If this repository is ever pushed to a public host, or the filesystem is compromised, all credentials are exposed. The Gmail App Password is live and should be rotated immediately.

**Remediation:**
1. Rotate the Gmail App Password at https://myaccount.google.com/apppasswords immediately.
2. Generate a new, truly random `SECRET_KEY` (e.g., `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`) and update it in the production environment.
3. Change the database password in both the env file and the running database.
4. Change the superuser password after deployment.
5. The `.env` file is correctly excluded by `.gitignore` — confirm it is never committed.

---

### CRITICAL-2: Insecure `SECRET_KEY` Committed in `.env.template`
**File:** `django-app/.env.template` (committed to git in commit `39938fb`)

```
SECRET_KEY="django-insecure-lp6h18zq4@z30symy*oz)+hp^uoti48r_ix^qc-m@&yfxd7&hn"
```

The `django-insecure-` prefix is Django's own marker that this key is unsafe for production. This key is now permanently in git history. If a developer copies `.env.template` to `.env` without changing the key and deploys, the app runs with a known-public secret key.

**Risk:** Session forgery, CSRF bypass, password reset token forgery.

**Remediation:**
- Replace the value in `.env.template` with a placeholder: `SECRET_KEY=REPLACE_ME_generate_with_get_random_secret_key`
- Add a startup check in settings.py that raises `ImproperlyConfigured` if `SECRET_KEY` starts with `django-insecure-` and `DEBUG=False`.

---

### CRITICAL-3: Path Traversal in HLS Segment Endpoint
**File:** `django-app/content/api/views.py`, lines 106-120

```python
def get(self, request, movie_id, resolution, segment):
    ...
    hls_dir = os.path.join(media_root, f'videos/hls/{resolution}/{basename}')
    segment_path = os.path.join(hls_dir, segment)

    if not os.path.isfile(segment_path):
        raise Http404("HLS segment not found.")

    return FileResponse(open(segment_path, "rb"), ...)
```

The `resolution` URL parameter and `segment` URL parameter are used directly in `os.path.join` without any sanitization. An attacker authenticated to the API can craft a request like:

```
GET /api/video/1/../../../../../../etc/passwd/whatever/../passwd/
```

or via the `segment` parameter to traverse outside the HLS directory and read arbitrary files from the container filesystem.

**Risk:** Local File Read — exposes `/etc/passwd`, application source code, environment variables, SSH keys, etc.

**Remediation:**
```python
import re

VALID_RESOLUTION = re.compile(r'^(480p|720p|1080p)$')
VALID_SEGMENT = re.compile(r'^\d{3}\.ts$')

def get(self, request, movie_id, resolution, segment):
    if not VALID_RESOLUTION.match(resolution):
        raise Http404()
    if not VALID_SEGMENT.match(segment):
        raise Http404()
    ...
    # Also verify resolved path is inside media_root
    resolved = os.path.realpath(segment_path)
    if not resolved.startswith(os.path.realpath(media_root)):
        raise Http404()
```

Apply the same fix to `HLSManifestView` for the `resolution` parameter.

---

### HIGH-1: No Rate Limiting on Authentication Endpoints
**File:** `django-app/core/settings.py`, `django-app/user_auth_app/api/views.py`

None of the authentication endpoints (`/api/login/`, `/api/register/`, `/api/password_reset/`, `/api/token/refresh/`) have throttle classes applied. The global DRF config has no `DEFAULT_THROTTLE_CLASSES` setting.

**Risk:** Brute-force password attacks, credential stuffing, email enumeration via timing, DoS via token refresh flooding.

**Remediation:**
Add to `settings.py`:
```python
REST_FRAMEWORK = {
    ...
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '20/hour',
        'user': '1000/day',
        'login': '5/minute',
    },
}
```
Then add `throttle_classes = [ScopedRateThrottle]` with `throttle_scope = 'login'` on `LoginView`, `PasswordResetView`, and `RegisterView`.

---

### HIGH-2: Missing Django Security Headers
**File:** `django-app/core/settings.py`

The following security settings are absent from `settings.py`:

| Setting | Required Value | Risk of Absence |
|---------|---------------|-----------------|
| `SECURE_SSL_REDIRECT` | `True` | HTTP requests not redirected to HTTPS |
| `SECURE_HSTS_SECONDS` | `31536000` | No HSTS enforcement |
| `SECURE_HSTS_INCLUDE_SUBDOMAINS` | `True` | Subdomains unprotected |
| `SECURE_HSTS_PRELOAD` | `True` | Not in preload list |
| `SECURE_CONTENT_TYPE_NOSNIFF` | `True` | MIME-type sniffing attacks |
| `SECURE_BROWSER_XSS_FILTER` | `True` | Legacy XSS protection header |
| `X_FRAME_OPTIONS` | `'DENY'` | Clickjacking attacks |
| `SECURE_PROXY_SSL_HEADER` | `('HTTP_X_FORWARDED_PROTO', 'https')` | Required when behind Caddy/reverse proxy |

**Remediation:** Add all of the above settings, conditional on `not DEBUG` to avoid breaking local development.

---

### HIGH-3: `django-rq` Dashboard Exposed Without Authentication
**File:** `django-app/core/urls.py`, line 17

```python
path('django-rq/', include('django_rq.urls')),
```

The django-rq web dashboard is mounted with no authentication restriction. By default, django-rq's dashboard requires staff/superuser status, but this depends on the version and configuration. The dashboard exposes queue names, job IDs, job arguments (which may contain user data), and allows job deletion/requeueing.

**Remediation:**
Restrict explicitly or remove the dashboard URL in production:
```python
if settings.DEBUG or settings.ALLOW_RQ_DASHBOARD:
    urlpatterns += [path('django-rq/', include('django_rq.urls'))]
```
Or wrap with `staff_member_required` decorator.

---

### HIGH-4: Gunicorn Bound to All Interfaces (`0.0.0.0:8000`)
**File:** `django-app/backend.entrypoint.sh`, line 43

```sh
exec gunicorn core.wsgi:application --bind 0.0.0.0:8000
```

Combined with the Docker Compose port mapping `"127.0.0.1:8000:8000"`, the Docker host binding is correctly localhost-only, but **inside the container** Gunicorn listens on all interfaces, meaning any other container in the Docker network can reach it directly — bypassing a future reverse proxy if one is added at the network level.

**Remediation:** This is lower risk given the host-side binding but is a defense-in-depth issue. If a CDN/WAF is intended to sit in front, ensure all external traffic routes through it.

---

### HIGH-5: `makemigrations` Runs in Production Entrypoint
**File:** `django-app/backend.entrypoint.sh`, line 18

```sh
python manage.py makemigrations
python manage.py migrate
```

`makemigrations` should never run in a production container. It auto-generates migration files based on model state, which can silently create schema differences between containers or leave uncommitted migration files inside the ephemeral container filesystem. Only `migrate` should run in production.

**Risk:** Schema divergence, silent data integrity issues, container crashes on multi-replica deployments.

**Remediation:** Remove `makemigrations` from the entrypoint. All migrations must be generated in development and committed.

---

### HIGH-6: `DEBUG` String Comparison Bug
**File:** `django-app/core/settings.py`, line 31

```python
DEBUG = os.environ.get('DEBUG', 'False')
```

This sets `DEBUG` to the **string** `'False'`, not the boolean `False`. In Python, any non-empty string is truthy, so `if settings.DEBUG:` will evaluate to `True` even when `DEBUG=False` is set in `.env`.

Django itself handles this correctly because it internally does `bool(DEBUG)`, but the URL config uses `if settings.DEBUG:` directly:

```python
# core/urls.py line 34
if settings.DEBUG:
    urlpatterns += static(...)
```

This means `MEDIA_URL` is always served by Django (not the reverse proxy), even in "production" mode.

**Remediation:**
```python
DEBUG = os.environ.get('DEBUG', 'False').lower() in ('true', '1', 'yes')
```

---

### MEDIUM-1: No File Type or Size Validation on Video/Image Uploads
**File:** `django-app/content/api/serializers.py`

`VideoUploadSerializer` and `ImageUploadSerializer` accept any file via `original_file` / `file` fields without checking MIME type or file size. The `VideoUploadSerializer` uses `FileField` which accepts any file type.

**Risk:** Malicious file uploads (e.g., PHP shells, ZIP bombs), excessive disk usage, FFmpeg vulnerabilities triggered by crafted media files.

**Remediation:**
```python
def validate_original_file(self, value):
    allowed_types = ['video/mp4', 'video/webm', 'video/quicktime']
    if value.content_type not in allowed_types:
        raise serializers.ValidationError("Unsupported file type.")
    max_size = 500 * 1024 * 1024  # 500 MB
    if value.size > max_size:
        raise serializers.ValidationError("File too large.")
    return value
```
Add `DATA_UPLOAD_MAX_MEMORY_SIZE` and `FILE_UPLOAD_MAX_MEMORY_SIZE` to settings.

---

### MEDIUM-2: Access Token Used as Email Activation / Password Reset Token
**File:** `django-app/user_auth_app/api/views.py`, lines 40-41 and 192-194

```python
refresh = RefreshToken.for_user(user)
activation_token = str(refresh.access_token)
```

JWT access tokens (30-minute lifetime) are being used as email activation and password reset tokens. These tokens are sent in email links and also have full API access scope. If the token is leaked (email interception, forwarded email, log file), an attacker gains both email activation AND authenticated API access simultaneously.

**Risk:** Token multi-use — a single intercepted token grants both account activation and API authentication.

**Remediation:** Use Django's built-in `PasswordResetTokenGenerator` or a separate one-time-use token mechanism for email workflows, completely separate from JWT auth tokens.

---

### MEDIUM-3: Registration Response Leaks Access Token in Body
**File:** `django-app/user_auth_app/api/views.py`, lines 46-52

```python
return Response({
    "user": {"id": user.id, "email": user.email},
    "token": activation_token   # <-- JWT access token in response body
}, status=status.HTTP_201_CREATED)
```

The API returns a valid JWT access token in the registration response body. A frontend JavaScript app receiving this will typically store it in memory or localStorage, where it is vulnerable to XSS.

**Remediation:** Do not return the activation token in the response body. The token is only needed in the email link. Remove it from the response.

---

### MEDIUM-4: `AUTH_COOKIE_DOMAIN` Set to String `'None'` Instead of `None`
**File:** `django-app/core/settings.py`, line 84

```python
'AUTH_COOKIE_DOMAIN': 'None',
```

This is the string `'None'`, not Python `None`. The cookie will be set with `Domain=None` literally, which is invalid and may cause cookie rejection or unexpected behavior across browsers.

**Remediation:** Change to:
```python
'AUTH_COOKIE_DOMAIN': None,
```
Or set to the actual production domain: `'AUTH_COOKIE_DOMAIN': '.mariowinter.com'`.

---

### MEDIUM-5: Hardcoded Fallback Database Password in Settings
**File:** `django-app/core/settings.py`, line 146

```python
"PASSWORD": os.environ.get("DB_PASSWORD", default="supersecretpassword"),
```

If `DB_PASSWORD` is not set in the environment, the database falls back to `"supersecretpassword"`. In a misconfigured deployment this is a known default.

**Remediation:** Remove the default; raise `ImproperlyConfigured` if the variable is missing in production:
```python
"PASSWORD": os.environ["DB_PASSWORD"],  # Raises KeyError if not set; safer
```

---

### MEDIUM-6: Redis Exposed Without Authentication
**File:** `django-app/docker-compose.yml`, lines 12-16

```yaml
redis:
    image: redis:latest
    ports: (none — internal only)
```

Redis has no password configured. While it is only accessible within the Docker internal network (no external ports mapped), any compromised container in the same Docker network can access Redis, read/write the cache and job queues.

**Remediation:** Add `requirepass` to Redis via `command: redis-server --requirepass $REDIS_PASSWORD` and update `REDIS_LOCATION` and `RQ_QUEUES` settings to include the password.

---

### MEDIUM-7: `postgres:latest` and `redis:latest` Image Tags
**File:** `django-app/docker-compose.yml`, lines 3, 12

```yaml
image: postgres:latest
image: redis:latest
```

Using `latest` tags means the exact version pulled depends on when `docker pull` runs. A new major version of either service can break the application silently during a redeploy.

**Remediation:** Pin to specific versions: `postgres:17.5-alpine`, `redis:7.4-alpine`. Alpine variants are smaller and have a reduced attack surface.

---

### MEDIUM-8: `python:3.12-alpine` Base Image Not Pinned
**File:** `django-app/backend.Dockerfile`, line 1

```dockerfile
FROM python:3.12-alpine
```

`python:3.12-alpine` without a patch version can change on `docker pull`, introducing unreviewed OS-level changes.

**Remediation:** Pin to a digest or full patch version: `FROM python:3.12.10-alpine3.21@sha256:...`

---

### MEDIUM-9: Gunicorn Missing Workers and Timeout Configuration
**File:** `django-app/backend.entrypoint.sh`, line 43

```sh
exec gunicorn core.wsgi:application --bind 0.0.0.0:8000
```

No `--workers`, `--timeout`, `--max-requests`, or `--log-level` flags are set. Default Gunicorn configuration is not production-appropriate:
- Default 1 worker — no concurrency
- Default 30s timeout — may not be appropriate for video upload
- No `--max-requests` — workers never recycle, memory leaks grow indefinitely
- No access logging to stdout

**Remediation:**
```sh
exec gunicorn core.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers 3 \
  --timeout 120 \
  --max-requests 1000 \
  --max-requests-jitter 100 \
  --access-logfile - \
  --error-logfile -
```

---

### MEDIUM-10: `CSRF_COOKIE_SAMESITE = None` Without Accompanying Notes
**File:** `django-app/core/settings.py`, line 45

```python
CSRF_COOKIE_SAMESITE = None
SESSION_COOKIE_SAMESITE = None
```

`SameSite=None` requires `Secure=True` to be honored by browsers, and it allows the cookie to be sent in all cross-site requests. This is intentional for a cross-origin SPA setup, but increases CSRF attack surface if `CSRF_TRUSTED_ORIGINS` is ever misconfigured.

**Remediation:** This configuration is acceptable only when `CSRF_COOKIE_SECURE = True` (already set), `CORS_ALLOWED_ORIGINS` is correctly restricted (verify in production env), and the frontend strictly uses CSRF tokens. Add a comment documenting the intentionality.

---

### LOW-1: `UserProfileViewSet` Uses ModelViewSet (Exposes CRUD)
**File:** `django-app/user_auth_app/api/views.py`, lines 20-27

```python
class UserProfileViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
```

`ModelViewSet` exposes `list`, `create`, `retrieve`, `update`, `partial_update`, and `destroy` by default. While `get_queryset` correctly filters to the current user, `POST /api/users/me/` would attempt to create a new user via this viewset (bypassing the `RegisterView` flow).

**Remediation:** Use `viewsets.RetrieveUpdateAPIView` or a `GenericViewSet` with only `retrieve` and `update` mixins. Or at minimum add `http_method_names = ['get', 'patch', 'head', 'options']`.

---

### LOW-2: Error Detail Leaked in 500 Responses
**File:** `django-app/content/api/views.py`, lines 71-75

```python
except Exception as e:
    logger.error(f"Error in VideoListView: {e}", exc_info=True)
    return Response(
        {"error": "Unable to fetch videos", "detail": str(e)},
        ...
    )
```

`str(e)` is returned to the API client. Internal exception messages can reveal database schema, file paths, package versions, and other internal details useful for attackers.

**Remediation:** Log the full exception internally but only return a generic message to clients:
```python
return Response({"error": "Unable to fetch videos"}, status=500)
```

---

### LOW-3: `allauth` Installed but Not Configured
**File:** `django-app/core/settings.py`, `django-app/requirements.txt`

`django-allauth==65.9.0` is installed and `SITE_ID = 1` is set, but `allauth` is not in `INSTALLED_APPS` and no allauth URLs are included. This is harmless but wasteful, and if allauth is ever partially activated without full configuration it can introduce authentication bypasses.

**Remediation:** Either complete the allauth integration (add to `INSTALLED_APPS`, configure providers) or remove it from `requirements.txt`.

---

### LOW-4: `.env.template` Contains Superuser Credentials with Weak Defaults
**File:** `django-app/.env.template`

```
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_PASSWORD=adminpassword
```

These are committed to git. If a developer forgets to change them, the production superuser account will have password `adminpassword`.

**Remediation:** Replace with `DJANGO_SUPERUSER_PASSWORD=CHANGE_ME_REQUIRED` and add a check in the entrypoint that refuses to create the superuser if the password matches the placeholder.

---

### LOW-5: No `LOGGING` Configuration
**File:** `django-app/core/settings.py`

There is no `LOGGING` dictionary configured. Django defaults to printing to console, which is fine for Docker, but there is no structured log format, no log level controls per module, and security-relevant events (login failures, permission denials) are not explicitly captured at a log level that ensures they are retained.

**Remediation:** Add a `LOGGING` configuration that sends structured JSON logs to stdout/stderr, with at minimum `WARNING` level on Django's security middleware and `ERROR` on the root logger.

---

### LOW-6: `whitenoise` Commented Out
**File:** `django-app/core/settings.py`, line 108

```python
#'whitenoise.middleware.WhiteNoiseMiddleware',
```

WhiteNoise is in `requirements.txt` but disabled. Static files are only served when `DEBUG=True` (via `urlpatterns += static(...)`). In production (`DEBUG=False`), static files will return 404.

**Remediation:** Either enable WhiteNoise for static file serving, or configure the reverse proxy (Caddy) to serve the `STATIC_ROOT` directory directly.

---

### LOW-7: `backend.entrypoint.sh` Excluded from `.gitignore` via `*.sh` Rule
**File:** `.gitignore`, line 103

```
*.sh
```

All shell scripts (`*.sh`) are excluded from git. This means `backend.entrypoint.sh` is not tracked in git. If a developer modifies it locally, those changes will not be committed or reviewed. The entrypoint is part of the production container's behavior.

**Remediation:** Remove `*.sh` from `.gitignore`, or specifically add `!django-app/backend.entrypoint.sh` as an exception. Verify via `git ls-files django-app/backend.entrypoint.sh` — if empty, the file is untracked.

---

## Git History Secrets Scan Summary

| Check | Result |
|-------|--------|
| `.env` ever committed | Not found in git objects |
| Hardcoded secrets in `settings.py` | Not found (uses `os.getenv`) |
| Hardcoded secrets in `*.py` files | Not found |
| `django-insecure` key in `.env.template` (committed) | **FOUND** in commit `39938fb` |
| Real credentials in `.env.template` | Not found (uses placeholder values) |
| `.env` in `.gitignore` | Yes — correctly excluded |

---

## Dependency Vulnerability Summary

All versions cited are as of `requirements.txt`. No CVE database lookup was performed (no internet access), but the following observations apply:

| Package | Version | Notes |
|---------|---------|-------|
| `Django` | `>=5.2,<5.3` | Current LTS — good |
| `djangorestframework` | `3.16.0` | Recent |
| `djangorestframework_simplejwt` | `5.5.0` | Recent |
| `psycopg2-binary` | `2.9.10` | Binary distribution acceptable for containers |
| `pillow` | `11.3.0` | Pillow historically has image parsing CVEs — keep updated |
| `moviepy` | `2.2.1` | Depends on FFmpeg; untrusted video files processed by FFmpeg represent attack surface |
| `gunicorn` | `23.0.0` | Recent |
| `pytest` / `coverage` | in requirements.txt | **Should be dev-only dependencies** — remove from production image |

**Action required:** Move `pytest==8.4.1`, `pytest-django==4.11.1`, `coverage==7.10.0` to a separate `requirements-dev.txt` and exclude from the production Docker build.

---

## Frontend Security Summary (brief)

The frontend (`frontend-ui/`) is a static SPA with no server-side code. Key observations:

| Item | Status |
|------|--------|
| Axios used for API calls | Acceptable — no JWT in localStorage per project rules |
| No `VITE_` secrets in code | Verify no API keys in `.env.local` or committed `.env` |
| `uuid` v13 | Recent |
| React 19 | Current |
| `papaparse` | CSV parsing — validate inputs before processing on backend |
| `zod` v4 | Current |

No critical frontend security issues found from static analysis. The main risk is if any `VITE_` prefixed env vars contain secrets (they would be bundled into the JS output).

---

## Priority Fix Order

| Priority | Issue | Severity |
|----------|-------|----------|
| 1 | Rotate Gmail App Password immediately | CRITICAL |
| 2 | Replace production `SECRET_KEY` with fresh generated key | CRITICAL |
| 3 | Fix path traversal in HLS segment/manifest endpoints | CRITICAL |
| 4 | Add rate limiting to auth endpoints | HIGH |
| 5 | Add Django security headers (`SECURE_SSL_REDIRECT`, HSTS, etc.) | HIGH |
| 6 | Remove `makemigrations` from production entrypoint | HIGH |
| 7 | Fix `DEBUG` string comparison bug | HIGH |
| 8 | Restrict or remove django-rq dashboard URL | HIGH |
| 9 | Fix `AUTH_COOKIE_DOMAIN: 'None'` string value | MEDIUM |
| 10 | Add file type/size validation to upload serializers | MEDIUM |
| 11 | Remove activation token from registration response body | MEDIUM |
| 12 | Separate JWT tokens from email activation tokens | MEDIUM |
| 13 | Pin Docker image tags | MEDIUM |
| 14 | Configure Redis authentication | MEDIUM |
| 15 | Move test deps to requirements-dev.txt | MEDIUM |
| 16 | Enable WhiteNoise or configure Caddy for static files | LOW |
| 17 | Fix `UserProfileViewSet` HTTP method exposure | LOW |
| 18 | Remove internal error details from API error responses | LOW |

---

*Report generated via static analysis of source files. Dynamic testing (DAST), container image scanning (Trivy/Grype), and dependency CVE scanning (Safety/pip-audit) are recommended as follow-up steps.*
