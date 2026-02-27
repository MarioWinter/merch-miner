# Security Audit Report
**Date:** 2026-02-27
**Auditor:** DevSecOps Skill
**Stack:** Django + Docker Compose (no Caddy yet)
**Scope:** Container security — Dockerfile hardening, docker-compose.yml, entrypoint, settings.py

## Executive Summary

| Severity | Count |
|----------|-------|
| Critical | 3     |
| High     | 4     |
| Medium   | 3     |
| Low      | 2     |
| Info     | 2     |

**Verdict:** CRITICAL ISSUES — Do not deploy to production without resolving Critical and High findings.

---

## Findings

### [CRITICAL-001] DEBUG Parsed as String — Always Truthy in Production
- **Category:** Code / Settings
- **Severity:** Critical
- **Location:** `django-app/core/settings.py:31`
- **Description:** `DEBUG = os.environ.get('DEBUG', 'False')` assigns the raw string `'False'` when the env var is unset. In Python, any non-empty string is truthy, so `if DEBUG:` evaluates to `True` always. This means Django runs in debug mode in production: full stack traces (including `SECRET_KEY`, database credentials, and all environment variables) are exposed publicly on any unhandled exception page. The Django debug toolbar, if installed, would also be enabled.
- **Remediation:**
  ```python
  # django-app/core/settings.py line 31 — replace with:
  DEBUG = os.environ.get('DEBUG', 'False') == 'True'
  ```
- **Effort:** Low

---

### [CRITICAL-002] Hardcoded Fallback Database Password in settings.py
- **Category:** Secrets / Code
- **Severity:** Critical
- **Location:** `django-app/core/settings.py:146`
- **Description:** `"PASSWORD": os.environ.get("DB_PASSWORD", default="supersecretpassword")` — the literal string `"supersecretpassword"` is committed to git as a fallback. If `DB_PASSWORD` is missing from the environment, Django silently connects using this known password. Any attacker who reads this public or semi-public repository immediately has a working database credential to try.
- **Remediation:**
  ```python
  # Fail loudly at startup if DB_PASSWORD is unset:
  "PASSWORD": os.environ["DB_PASSWORD"],
  ```
  Also apply the same pattern to `DB_NAME`, `DB_USER` — though those have less-sensitive defaults.
- **Effort:** Low

---

### [CRITICAL-003] Hardcoded Superuser Fallback Credentials in Entrypoint
- **Category:** Secrets / Container
- **Severity:** Critical
- **Location:** `django-app/backend.entrypoint.sh:28-30`
- **Description:** The entrypoint creates a Django superuser using fallback values:
  ```sh
  username = os.environ.get('DJANGO_SUPERUSER_USERNAME', 'admin')
  email    = os.environ.get('DJANGO_SUPERUSER_EMAIL', 'admin@example.com')
  password = os.environ.get('DJANGO_SUPERUSER_PASSWORD', 'adminpassword')
  ```
  If the three `DJANGO_SUPERUSER_*` env vars are not set, a superuser `admin / adminpassword` is created silently on every fresh deployment. This is a well-known default credential that automated scanners and attackers test within minutes of a server going online. The `.env.template` also ships `adminpassword` as the documented default value.
- **Remediation:** Remove all fallback defaults. Raise an explicit error if the vars are unset:
  ```sh
  if [ -z "$DJANGO_SUPERUSER_PASSWORD" ]; then
    echo "ERROR: DJANGO_SUPERUSER_PASSWORD is not set. Aborting." >&2
    exit 1
  fi
  ```
  Or eliminate automatic superuser creation from the entrypoint entirely and run it as a one-time manual step.
- **Effort:** Low

---

### [HIGH-001] gunicorn Binds to 0.0.0.0 Inside the Container
- **Category:** Container / Infrastructure
- **Severity:** High
- **Location:** `django-app/backend.entrypoint.sh:43`
- **Description:** `exec gunicorn core.wsgi:application --bind 0.0.0.0:8000` — binding to all interfaces inside the container means gunicorn is reachable on every network interface the container has, not just the interface facing the host. If any other misconfiguration (e.g., an accidental `ports: 0.0.0.0:8000:8000` in Compose) exposes the port, gunicorn is immediately reachable from the public internet without the reverse proxy in between. The correct practice is to bind to `127.0.0.1:8000` inside the container so only the reverse proxy can reach it.
- **Remediation:**
  ```sh
  exec gunicorn core.wsgi:application --bind 127.0.0.1:8000
  ```
- **Effort:** Low

---

### [HIGH-002] makemigrations Runs at Container Startup
- **Category:** Container / Infrastructure
- **Severity:** High
- **Location:** `django-app/backend.entrypoint.sh:18`
- **Description:** `python manage.py makemigrations` is executed every time the container starts. This is a production anti-pattern for two reasons: (1) it can auto-generate migration files based on the live codebase state and commit them to the running container's filesystem, causing schema drift that is invisible to version control; (2) in a multi-replica environment, two containers starting simultaneously can each generate conflicting migration files. Only `migrate` (which applies already-committed migrations) should run at startup. `makemigrations` is a developer-only command that must be run locally and the result committed to git.
- **Remediation:** Remove line 18 (`python manage.py makemigrations`) from `backend.entrypoint.sh`. Keep only `python manage.py migrate`.
- **Effort:** Low

---

### [HIGH-003] Redis Has No Authentication
- **Category:** Infrastructure / Container
- **Severity:** High
- **Location:** `django-app/docker-compose.yml` — `redis` service
- **Description:** The Redis service is defined with no `command:` override and no password. Any process on the same Docker network can connect to Redis without credentials, read or write all cached session data and application cache, and enqueue arbitrary background jobs via django-rq. In a compromised container scenario (e.g., a dependency with a remote code execution CVE), an attacker can pivot to Redis, poison the job queue, and achieve code execution in the worker process.
- **Remediation:**
  ```yaml
  redis:
    image: redis:latest
    command: redis-server --requirepass ${REDIS_PASSWORD}
    environment:
      - REDIS_PASSWORD=${REDIS_PASSWORD}
  ```
  Add `REDIS_PASSWORD` to `.env.template` and update `settings.py` `CACHES` and `RQ_QUEUES` to include the password in the connection string.
- **Effort:** Medium

---

### [HIGH-004] Insecure Secret Key Default — None Silently Accepted
- **Category:** Secrets / Code
- **Severity:** High
- **Location:** `django-app/core/settings.py:28`
- **Description:** `SECRET_KEY = os.getenv('SECRET_KEY')` — if `SECRET_KEY` is absent from the environment, this returns `None`. Django will start and operate with `SECRET_KEY = None`, breaking HMAC signing, session security, CSRF protection, and JWT token validation. The failure is silent; no exception is raised at startup. The `.env.template` also ships a real-looking insecure key (`django-insecure-lp6h18zq4@z30symy*oz)+hp^uoti48r_ix^qc-m@&yfxd7&hn`) that developers might copy directly into production.
- **Remediation:**
  ```python
  SECRET_KEY = os.environ['SECRET_KEY']  # KeyError at startup if unset — correct behavior
  ```
  Rotate the key value in `.env.template` to a placeholder like `REPLACE_WITH_STRONG_RANDOM_KEY`.
- **Effort:** Low

---

### [MEDIUM-001] No Docker Network Defined — Services Share Default Bridge
- **Category:** Infrastructure / Container
- **Severity:** Medium
- **Location:** `django-app/docker-compose.yml`
- **Description:** No explicit `networks:` section is defined. Docker Compose places all services on a shared default bridge network, which means every service (web, db, redis) can reach every other service on all ports. Defining an explicit named network and restricting which services join it limits lateral movement if any container is compromised.
- **Remediation:** Add an explicit network:
  ```yaml
  networks:
    backend:
      driver: bridge

  services:
    db:
      networks: [backend]
    redis:
      networks: [backend]
    web:
      networks: [backend]
  ```
- **Effort:** Low

---

### [MEDIUM-002] No Memory or CPU Limits on Any Service
- **Category:** Infrastructure / Container
- **Severity:** Medium
- **Location:** `django-app/docker-compose.yml`
- **Description:** No `deploy.resources.limits` or `mem_limit` / `cpus` constraints are set on any service. A single runaway process (or a denial-of-service against the web service) can exhaust all host memory and CPU, taking down all other services including the database.
- **Remediation:**
  ```yaml
  web:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"
  db:
    deploy:
      resources:
        limits:
          memory: 512M
  redis:
    deploy:
      resources:
        limits:
          memory: 128M
  ```
- **Effort:** Low

---

### [MEDIUM-003] No Non-Root User Defined in Dockerfile
- **Category:** Container
- **Severity:** Medium
- **Location:** `django-app/backend.Dockerfile`
- **Description:** The Dockerfile does not create or switch to a non-root user. The application process (gunicorn, rqworker) runs as `root` inside the container. If any dependency or request handler has a code execution vulnerability, the attacker immediately has root inside the container, making container escape and host filesystem access significantly easier.
- **Remediation:** Add before `ENTRYPOINT`:
  ```dockerfile
  RUN addgroup -S appgroup && adduser -S appuser -G appgroup
  USER appuser
  ```
  Ensure the working directory and files are owned by this user: `RUN chown -R appuser:appgroup /app`
- **Effort:** Low

---

### [LOW-001] Unpinned Base Image Tags (latest / no digest)
- **Category:** Container / Dependencies
- **Severity:** Low
- **Location:** `django-app/docker-compose.yml` — `postgres:latest`, `redis:latest`; `django-app/backend.Dockerfile:1` — `python:3.12-alpine`
- **Description:** `postgres:latest` and `redis:latest` will silently pull a different (potentially newer, breaking, or vulnerable) image on the next `docker compose pull`. Unpinned images make builds non-reproducible and can introduce CVEs from upstream updates without a controlled review process. `python:3.12-alpine` is better but still lacks a digest pin.
- **Remediation:** Pin to a specific version and ideally a digest:
  ```yaml
  image: postgres:16.3-alpine
  image: redis:7.2-alpine
  ```
  ```dockerfile
  FROM python:3.12-alpine3.21
  ```
- **Effort:** Low

---

### [LOW-002] COPY . . Before Dependency Install — Cache Inefficiency and Surface Area
- **Category:** Container
- **Severity:** Low
- **Location:** `django-app/backend.Dockerfile:9`
- **Description:** `COPY . .` copies all application files before `pip install`. This means every code change invalidates the pip cache layer, forcing a full reinstall of all dependencies on every build. More importantly, it also means any file that is not excluded by `.dockerignore` ends up in the image layer before dependencies are installed. While the `.dockerignore` covers `.env` and `.git`, a future developer might not know to update it.
- **Remediation:** Split the COPY into two steps — copy only requirements first, install dependencies, then copy the rest:
  ```dockerfile
  COPY requirements.txt .
  RUN pip install --no-cache-dir -r requirements.txt
  COPY . .
  ```
- **Effort:** Low

---

### [INFO-001] No Caddyfile — HTTPS and Security Headers Not Configured
- **Category:** Headers / Infrastructure
- **Severity:** Info
- **Location:** Project root (no Caddyfile found)
- **Description:** No Caddyfile was found in the repository. There is no reverse proxy configured, meaning HTTPS termination, security headers (`Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Content-Security-Policy`), and TLS enforcement are absent. For local development this is acceptable. For production, a reverse proxy with HTTPS is mandatory.
- **Remediation:** Add a `Caddyfile` to the project. Minimal hardened example:
  ```
  yourdomain.com {
    reverse_proxy 127.0.0.1:8000

    header {
      Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
      X-Frame-Options DENY
      X-Content-Type-Options nosniff
      Referrer-Policy origin-when-cross-origin
      Content-Security-Policy "default-src 'self'"
      -Server
    }
  }
  ```
- **Effort:** Low

---

### [INFO-002] Django Security Settings Not Conditionally Applied
- **Category:** Settings
- **Severity:** Info
- **Location:** `django-app/core/settings.py`
- **Description:** Production security settings (`SECURE_HSTS_SECONDS`, `SECURE_SSL_REDIRECT`, `SECURE_HSTS_INCLUDE_SUBDOMAINS`, `SECURE_HSTS_PRELOAD`, `SECURE_CONTENT_TYPE_NOSNIFF`) are not defined anywhere in `settings.py`. `SESSION_COOKIE_SECURE` and `CSRF_COOKIE_SECURE` are hardcoded to `True` (which is correct for production) but this will cause issues in local HTTP development. The recommended pattern is to gate these on `if not DEBUG:` — but note that this requires CRITICAL-001 to be fixed first so `DEBUG` is actually `False` in production.
- **Remediation:** After fixing CRITICAL-001, add:
  ```python
  if not DEBUG:
      SECURE_HSTS_SECONDS = 31536000
      SECURE_HSTS_INCLUDE_SUBDOMAINS = True
      SECURE_HSTS_PRELOAD = True
      SECURE_SSL_REDIRECT = True
      SECURE_CONTENT_TYPE_NOSNIFF = True
  ```
- **Effort:** Low

---

## Missing Tools

The following security tools were not installed. Their absence means automated CVE scanning and SAST were not performed.

| Tool | Purpose | Install |
|------|---------|---------|
| trivy | Container CVE scanning (OS packages + pip deps) | `brew install trivy` |
| bandit | Python SAST — SQL injection, shell injection, hardcoded passwords | `pip install bandit` |
| trufflehog | Git history secret scanning | `brew install trufflehog` |
| pip-audit | Python dependency CVE audit | `pip install pip-audit` |

Priority: install `trivy` and `bandit` first. Run trivy against the built image:
```bash
cd django-app && docker compose build
trivy image --severity HIGH,CRITICAL app_backend
```

---

## Passed Checks

- `.dockerignore` exists and correctly excludes `.env`, `.git/`, `env/` (virtualenv), `__pycache__`, `*.pyc`, `db.sqlite3`
- `docker-compose.yml` web service port is bound to `127.0.0.1:8000:8000` — not exposed on `0.0.0.0`
- PostgreSQL port is NOT exposed externally in `docker-compose.yml` (no `ports:` on the `db` service)
- Redis port is NOT exposed externally in `docker-compose.yml` (no `ports:` on the `redis` service)
- All database credentials in `docker-compose.yml` come from env vars (`${DB_NAME}`, `${DB_USER}`, `${DB_PASSWORD}`) — not hardcoded
- `web` service uses `env_file: .env` — no plaintext secrets in the Compose file itself
- `.env` file is NOT tracked in git (`.dockerignore` and presumably `.gitignore` exclude it)
- JWT cookies configured with `HTTP_ONLY: True` and `SECURE: True` in `settings.py`
- `CORS_ALLOW_CREDENTIALS = True` combined with specific `CORS_ALLOWED_ORIGINS` (not `*`)
- `CSRF_COOKIE_SECURE = True` and `SESSION_COOKIE_SECURE = True` are set
- Global DRF default `permission_classes = [IsAuthenticated]` — all endpoints protected by default
- Global DRF default `authentication_classes = [CookieJWTAuthentication]` — consistent auth mechanism
- Python 3.12-alpine base image — minimal attack surface (Alpine over Debian/Ubuntu)
- `set -e` in entrypoint — script aborts on any command failure
- Build dependencies (`gcc`, `musl-dev`, `postgresql-dev`) are removed via `apk del .build-deps` after install

---

## Recommended Next Steps

Fix in this order:

1. **CRITICAL-001** — Fix `DEBUG` string parsing (`== 'True'`) — 5 minutes
2. **CRITICAL-002** — Remove `"supersecretpassword"` fallback, use `os.environ["DB_PASSWORD"]` — 5 minutes
3. **CRITICAL-003** — Remove superuser credential fallbacks from entrypoint — 10 minutes
4. **HIGH-001** — Change gunicorn bind to `127.0.0.1:8000` — 2 minutes
5. **HIGH-002** — Remove `makemigrations` from entrypoint — 2 minutes
6. **HIGH-003** — Add Redis `--requirepass` — 15 minutes (requires settings.py update too)
7. **HIGH-004** — Change `SECRET_KEY` to `os.environ['SECRET_KEY']` and rotate template placeholder — 5 minutes
8. **MEDIUM-003** — Add non-root user to Dockerfile — 10 minutes
9. **MEDIUM-001** — Add explicit Docker network — 10 minutes
10. **MEDIUM-002** — Add resource limits — 10 minutes
11. Install `trivy` and `bandit`, re-run audit after fixes

**After fixing Critical and High items, run `/devsecops` again to confirm.**
