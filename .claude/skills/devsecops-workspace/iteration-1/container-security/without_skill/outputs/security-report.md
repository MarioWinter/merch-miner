# Docker Security Audit Report

**Date:** 2026-02-27
**Scope:** django-app Docker configuration
**Files Audited:**
- `django-app/docker-compose.yml`
- `django-app/backend.Dockerfile`
- `django-app/backend.entrypoint.sh`
- `django-app/.env` and `.env.template`
- `django-app/core/settings.py`
- `django-app/requirements.txt`

---

## Critical Findings

### CRIT-1: Real Credentials Committed to Repository
**File:** `django-app/.env`
**Severity:** CRITICAL

The `.env` file containing real production credentials is present in the repository. The file contains:
- A real Django `SECRET_KEY` (not the insecure template one)
- A real database password: `#Xwerte1234#X`
- A real email app password: `nvfzahwpvvaqzrdt` (Gmail App Password)
- A real superuser email and password: `werte1234`
- A real domain name and email address: `mariowinter.sg@gmail.com`

While `.env` is listed in the root `.gitignore`, the `.env` file physically exists inside `django-app/`. The `.gitignore` at the repo root uses pattern `.env` which should match it, but the file's presence warrants verification that it has never been committed. Any past commit containing this file would permanently expose these credentials in git history.

**Recommended actions:**
1. Immediately rotate: Django SECRET_KEY, DB password, Gmail App Password, superuser password.
2. Verify `.env` has never appeared in `git log -- django-app/.env`.
3. If it has appeared, purge from history using `git filter-repo`.
4. Add a `django-app/.gitignore` with explicit `.env` entry as a belt-and-suspenders measure.

---

### CRIT-2: Hardcoded Fallback Secrets in settings.py
**File:** `django-app/core/settings.py` lines 146, 28
**Severity:** CRITICAL

`settings.py` has hardcoded fallback secrets:
```python
"PASSWORD": os.environ.get("DB_PASSWORD", default="supersecretpassword"),
```
And `SECRET_KEY = os.getenv('SECRET_KEY')` returns `None` if the env var is unset — Django will silently start with `SECRET_KEY=None`, which breaks signing but does not raise an error at startup. Neither is acceptable for production.

**Recommended actions:**
1. Remove all hardcoded credential fallbacks. Use `os.environ['DB_PASSWORD']` (raises `KeyError` on missing) or add an explicit startup check that refuses to start without required secrets.
2. Add a startup guard: `if not SECRET_KEY: raise ImproperlyConfigured("SECRET_KEY is not set")`.

---

### CRIT-3: Insecure Default Superuser in Entrypoint
**File:** `django-app/backend.entrypoint.sh` lines 28-30
**Severity:** CRITICAL

The entrypoint auto-creates a Django superuser with hardcoded fallback credentials:
```sh
username = os.environ.get('DJANGO_SUPERUSER_USERNAME', 'admin')
email = os.environ.get('DJANGO_SUPERUSER_EMAIL', 'admin@example.com')
password = os.environ.get('DJANGO_SUPERUSER_PASSWORD', 'adminpassword')
```
If the env vars are not set, a superuser with username `admin` and password `adminpassword` is silently created. Any container started without these env vars will have a known-credentials superuser account.

**Recommended actions:**
1. Remove hardcoded fallbacks. If the env vars are absent, skip creation or raise an error.
2. Consider removing auto-superuser creation from the entrypoint entirely; use a one-time management command or CI/CD pipeline step instead.

---

## High Findings

### HIGH-1: Untagged/Latest Image Tags — No CVE Pinning
**File:** `django-app/docker-compose.yml` lines 3, 12
**Severity:** HIGH

Both base images use `latest`:
```yaml
image: postgres:latest
image: redis:latest
```
`latest` is an alias that moves with every new release. This means:
- You cannot audit which version is running for CVEs.
- A `docker compose pull` can silently upgrade to a version with breaking changes or new vulnerabilities.
- Reproducible builds are impossible.

**Recommended actions:**
1. Pin to a specific version with a digest, e.g.: `postgres:17.2-alpine` and `redis:7.4.1-alpine`.
2. Use Trivy or Grype in CI to scan pinned images for CVEs on every build.

---

### HIGH-2: No Non-Root User in Dockerfile
**File:** `django-app/backend.Dockerfile`
**Severity:** HIGH

The Dockerfile does not create or switch to a non-root user:
```dockerfile
FROM python:3.12-alpine
WORKDIR /app
COPY . .
RUN ...
ENTRYPOINT [ "./backend.entrypoint.sh" ]
```
The container runs as root (UID 0). If a vulnerability in gunicorn, Django, or any dependency allows code execution, the attacker has root access inside the container and can more easily escape to the host if other container hardening is absent.

**Recommended actions:**
1. Add before `ENTRYPOINT`:
   ```dockerfile
   RUN addgroup -S appgroup && adduser -S appuser -G appgroup
   USER appuser
   ```
2. Adjust ownership of `/app`: `RUN chown -R appuser:appgroup /app`.

---

### HIGH-3: Entire Source Tree Bind-Mounted Into Running Container
**File:** `django-app/docker-compose.yml` line 26
**Severity:** HIGH

```yaml
volumes:
  - .:/app
```
The entire `django-app/` directory — including `.env`, `manage.py`, test files, and source code — is mounted read-write into the running container. This means:
- Any process inside the container can modify source files on the host.
- The `.env` file with real credentials is explicitly mounted into the container's filesystem at runtime.
- In development this is convenient, but it should be removed for production images where `COPY . .` in the Dockerfile already provides the source.

**Recommended actions:**
1. Remove the bind mount for production deployments.
2. Use named volumes only for media/static if needed.
3. If hot-reload is needed in development, scope the bind mount to source directories only (not `.env`).

---

### HIGH-4: Redis Has No Authentication
**File:** `django-app/docker-compose.yml` lines 12-16, `core/settings.py` line 155
**Severity:** HIGH

The Redis service has no password configured:
```yaml
redis:
    image: redis:latest
```
And the connection string is unauthenticated: `redis://redis:6379/1`.

Any container on the same Docker network can connect to Redis without credentials, read cached data (which may contain session tokens or JWT data), enqueue arbitrary background jobs, or flush the cache.

**Recommended actions:**
1. Add `--requirepass` via command or a `redis.conf`: `command: redis-server --requirepass ${REDIS_PASSWORD}`.
2. Update `REDIS_LOCATION` to include credentials: `redis://:${REDIS_PASSWORD}@redis:6379/1`.
3. Add `REDIS_PASSWORD` to `.env.template`.

---

### HIGH-5: makemigrations Run Automatically in Production Entrypoint
**File:** `django-app/backend.entrypoint.sh` line 18
**Severity:** HIGH

```sh
python manage.py makemigrations
python manage.py migrate
```
Running `makemigrations` in a production entrypoint is dangerous:
- It can silently generate new migration files if models have been changed, potentially creating incorrect or conflicting migrations across multiple container replicas.
- It obscures whether the correct migrations are committed to source control.
- `migrate` is safe to run on startup; `makemigrations` is not.

**Recommended actions:**
1. Remove `makemigrations` from the entrypoint. Migrations should be generated locally and committed to the repository.
2. Run only `migrate` on startup.

---

## Medium Findings

### MED-1: gunicorn Binds to All Interfaces (0.0.0.0)
**File:** `django-app/backend.entrypoint.sh` line 43
**Severity:** MEDIUM

```sh
exec gunicorn core.wsgi:application --bind 0.0.0.0:8000
```
Gunicorn listens on all network interfaces. Inside Docker this is generally mitigated by the port mapping being bound to `127.0.0.1:8000` in `docker-compose.yml`, but if Docker network rules are misconfigured or the container is run in `--network host` mode, port 8000 would be accessible externally.

**Recommended actions:**
1. Acceptable as-is given the `127.0.0.1:8000:8000` mapping in compose.
2. For production with a reverse proxy, the `ports:` entry should be removed and access provided via an internal Docker network only. The Caddy/Traefik proxy should be the only externally-exposed service.

---

### MED-2: Missing Security Headers in Settings
**File:** `django-app/core/settings.py`
**Severity:** MEDIUM

Django security middleware is included but explicit security headers are not configured in settings:
- `SECURE_HSTS_SECONDS` is not set (HSTS not enabled).
- `SECURE_CONTENT_TYPE_NOSNIFF` is not explicitly set (defaults to `True` in Django, but should be explicit).
- `X_FRAME_OPTIONS` defaults to `DENY` but is not explicit.
- `SECURE_BROWSER_XSS_FILTER` is not set.
- `SECURE_SSL_REDIRECT` is not set (should be `True` in production).

**Recommended actions:**
1. Add to `settings.py`:
   ```python
   SECURE_HSTS_SECONDS = 31536000
   SECURE_HSTS_INCLUDE_SUBDOMAINS = True
   SECURE_HSTS_PRELOAD = True
   SECURE_CONTENT_TYPE_NOSNIFF = True
   SECURE_SSL_REDIRECT = True  # behind reverse proxy, set SECURE_PROXY_SSL_HEADER too
   X_FRAME_OPTIONS = 'DENY'
   ```

---

### MED-3: DEBUG Flag Parsed as String, Not Boolean
**File:** `django-app/core/settings.py` line 31
**Severity:** MEDIUM

```python
DEBUG = os.environ.get('DEBUG', 'False')
```
This sets `DEBUG` to the **string** `'False'`, which is truthy in Python. Django's `DEBUG` setting expects a Python boolean. The string `'False'` evaluates as `True` in boolean context, meaning Django may behave as if `DEBUG=True` regardless of the env var value.

The actual `.env` file sets `DEBUG=False` (string), so `os.environ.get('DEBUG')` returns the string `'False'` — the setting is truthy.

**Recommended actions:**
1. Fix the parsing:
   ```python
   DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'
   ```

---

### MED-4: No Healthcheck Defined for Any Service
**File:** `django-app/docker-compose.yml`
**Severity:** MEDIUM

None of the three services (`db`, `redis`, `web`) define a Docker `healthcheck`. Without healthchecks:
- Docker cannot detect a crashed or hung service.
- Orchestrators (Swarm, ECS, Kubernetes) cannot restart failed containers automatically.
- The `depends_on` directive with `condition: service_healthy` cannot be used, which is more reliable than the manual `pg_isready` polling loop in the entrypoint script.

**Recommended actions:**
1. Add healthchecks for all services. Example for postgres:
   ```yaml
   healthcheck:
     test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
     interval: 10s
     timeout: 5s
     retries: 5
   ```
2. Use `depends_on: db: condition: service_healthy` in the `web` service instead of the polling loop.

---

### MED-5: No Resource Limits on Containers
**File:** `django-app/docker-compose.yml`
**Severity:** MEDIUM

No CPU or memory limits are set. A runaway process (e.g., an FFmpeg transcoding job, a memory leak in gunicorn) can consume all host resources, causing a denial of service for all services on the host.

**Recommended actions:**
1. Add `deploy.resources.limits` to each service:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '1.0'
         memory: 512M
   ```

---

### MED-6: No Read-Only Filesystem for Redis
**File:** `django-app/docker-compose.yml`
**Severity:** MEDIUM

Redis has no `read_only: true` on its container filesystem, and no memory-only configuration. If a vulnerability is exploited in Redis, an attacker can write to the container's writable layer.

---

### MED-7: Mismatch Between Dockerfile Label and Actual Base Image
**File:** `django-app/backend.Dockerfile` lines 1, 5
**Severity:** MEDIUM (Operational/Auditing Risk)

```dockerfile
FROM python:3.12-alpine
LABEL description="Python 3.14.0a7 Alpine 3.21"
```
The `FROM` instruction uses `python:3.12-alpine` but the label claims `Python 3.14.0a7`. This creates confusion during security audits about which Python version is actually running, making CVE tracking unreliable.

**Recommended actions:**
1. Pin the image to a specific digest: `FROM python:3.12.9-alpine3.21@sha256:<digest>`.
2. Keep labels consistent with the actual base image version.

---

## Low Findings

### LOW-1: collectstatic Run on Every Startup
**File:** `django-app/backend.entrypoint.sh` line 17
**Severity:** LOW

`python manage.py collectstatic --noinput` runs on every container start. While not a security issue by itself, it is a code execution step that processes template files and static assets at startup. If static directories are writable by untrusted sources, this could be exploited. It also slows startup unnecessarily.

---

### LOW-2: No .dockerignore File
**File:** `django-app/` root
**Severity:** LOW

There is no `.dockerignore` file in `django-app/`. The Dockerfile `COPY . .` therefore copies:
- `.env` (with real credentials) into the image layer
- `env/` virtual environment directory (large, unnecessary)
- Test files and fixtures
- `media/` directory
- Git history (if `.git` is present)

Any credentials baked into an image layer remain recoverable even after deletion from later layers using `docker history` or layer inspection tools.

**Recommended actions:**
1. Create `django-app/.dockerignore`:
   ```
   .env
   .env.*
   env/
   .git/
   media/
   __pycache__/
   *.pyc
   tests/
   .pytest_cache/
   htmlcov/
   ```

---

### LOW-3: rqworker Started as Background Process Without Supervision
**File:** `django-app/backend.entrypoint.sh` line 41
**Severity:** LOW

```sh
python manage.py rqworker default &
```
The RQ worker is started as a background `&` process within the entrypoint. If the worker crashes, it will not be restarted. There is no process supervision (supervisord, s6, etc.) and no way to detect or log the worker failure.

**Recommended actions:**
1. Run `rqworker` as a separate Docker service (`worker:`) in `docker-compose.yml` with its own container and restart policy.
2. Add `restart: unless-stopped` to the worker service.

---

### LOW-4: CSRF_COOKIE_SAMESITE and SESSION_COOKIE_SAMESITE Set to None
**File:** `django-app/core/settings.py` lines 45, 47
**Severity:** LOW

```python
CSRF_COOKIE_SAMESITE = None
SESSION_COOKIE_SAMESITE = None
```
Python's `None` is not the same as the string `'None'` for Django cookie SameSite. Django interprets Python `None` as "do not set the SameSite attribute", which means browsers apply their default policy (Lax). This may be intentional for cross-origin cookie sending, but it weakens CSRF protection. If cross-origin cookie sharing is required (e.g., frontend on a different domain), the string `'None'` with `Secure=True` is required — not Python `None`.

---

## Informational

### INFO-1: No docker-compose.override.yml for Dev/Prod Separation
The same `docker-compose.yml` is used for both development and production (as implied by bind-mounting source code). Using `docker-compose.override.yml` for development-specific settings (bind mounts, debug ports) and a clean base `docker-compose.yml` for production reduces the risk of development configurations leaking into production.

### INFO-2: gunicorn Lacks Production Tuning
`gunicorn` is started with no worker count, timeout, or logging configuration. Default worker count (1) will not handle concurrent requests well under load.

### INFO-3: psycopg2-binary in Production
`requirements.txt` uses `psycopg2-binary`. For production, the pure `psycopg2` compiled against the system's `libpq` is preferred for reliability and security patch control.

---

## Summary Table

| ID | Severity | Title |
|----|----------|-------|
| CRIT-1 | Critical | Real credentials in `.env` file in repository |
| CRIT-2 | Critical | Hardcoded fallback secrets in settings.py |
| CRIT-3 | Critical | Auto-superuser with hardcoded fallback password |
| HIGH-1 | High | Untagged `latest` image — no CVE pinning |
| HIGH-2 | High | Container runs as root |
| HIGH-3 | High | Full source bind-mount includes `.env` |
| HIGH-4 | High | Redis has no authentication |
| HIGH-5 | High | `makemigrations` runs automatically in production |
| MED-1 | Medium | gunicorn binds to 0.0.0.0 |
| MED-2 | Medium | Missing Django security headers |
| MED-3 | Medium | DEBUG parsed as truthy string |
| MED-4 | Medium | No Docker healthchecks |
| MED-5 | Medium | No container resource limits |
| MED-6 | Medium | No read-only filesystem for Redis |
| MED-7 | Medium | Dockerfile label/version mismatch |
| LOW-1 | Low | collectstatic on every startup |
| LOW-2 | Low | No .dockerignore — `.env` baked into image |
| LOW-3 | Low | rqworker unsupervised background process |
| LOW-4 | Low | CSRF/Session SameSite set to Python None |
| INFO-1 | Info | No dev/prod compose separation |
| INFO-2 | Info | gunicorn lacks production tuning |
| INFO-3 | Info | psycopg2-binary in production |
