# Security Audit Report
**Date:** 2026-02-27
**Auditor:** DevSecOps Skill (claude-sonnet-4-6)
**Stack:** Django 5.2 + Docker Compose + python:3.12-alpine
**Scope:** Container security — CVE scanning, Dockerfile best practices, docker-compose.yml hardening

---

## Executive Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 2     |
| Medium   | 3     |
| Low      | 3     |
| Info     | 2     |

**Verdict:** NEEDS ATTENTION

The container setup is partially hardened. The web service port binding is correctly restricted to localhost only, and credentials are sourced from env vars. However, the entrypoint script contains a hardcoded fallback superuser password, `makemigrations` runs at boot (a production anti-pattern), gunicorn binds to `0.0.0.0`, and `postgres:latest` / `redis:latest` use unpinned floating tags. Trivy was not available for live CVE scanning — this is documented as a tooling gap.

---

## Findings

### [HIGH-001] Hardcoded Fallback Superuser Password in Entrypoint
- **Category:** Container / Secrets
- **Severity:** High
- **Location:** `django-app/backend.entrypoint.sh` line 30
- **Description:** The entrypoint shell script creates a Django superuser using `os.environ.get('DJANGO_SUPERUSER_PASSWORD', 'adminpassword')`. If the environment variable is not set, the password silently defaults to the hardcoded value `adminpassword`. Any deployment where `DJANGO_SUPERUSER_PASSWORD` is missing from `.env` will create an admin account with a trivially guessable password. This is a production-ready code path.
- **Remediation:**
  ```sh
  # Replace the fallback with an explicit failure:
  password = os.environ['DJANGO_SUPERUSER_PASSWORD']  # raises KeyError if missing
  # Or add an explicit check before the heredoc:
  if [ -z "$DJANGO_SUPERUSER_PASSWORD" ]; then
    echo "ERROR: DJANGO_SUPERUSER_PASSWORD is not set. Aborting."
    exit 1
  fi
  ```
  Also ensure `DJANGO_SUPERUSER_PASSWORD`, `DJANGO_SUPERUSER_USERNAME`, and `DJANGO_SUPERUSER_EMAIL` are defined in `django-app/env/.env.template` with placeholder values (e.g. `DJANGO_SUPERUSER_PASSWORD=changeme-set-in-production`).
- **Effort:** Low

---

### [HIGH-002] Unpinned Base Images (`postgres:latest`, `redis:latest`)
- **Category:** Container
- **Severity:** High
- **Location:** `django-app/docker-compose.yml` lines 2, 12
- **Description:** Both `postgres:latest` and `redis:latest` use floating tags. A `docker compose pull` will silently upgrade to any new major version. This can introduce breaking schema changes, incompatible wire protocols, or pull in newly discovered CVEs before they are evaluated. There is also no cryptographic digest pinning, so supply-chain substitution is possible.
- **Remediation:** Pin to a specific minor version and, optionally, a digest:
  ```yaml
  db:
    image: postgres:17.4-alpine   # pin to minor, prefer -alpine for smaller attack surface
  redis:
    image: redis:7.4-alpine
  ```
  Review release notes when upgrading. Add a monthly Dependabot or Renovate rule to track image updates.
- **Effort:** Low

---

### [MEDIUM-001] `makemigrations` Runs at Container Boot
- **Category:** Container / Operations
- **Severity:** Medium
- **Location:** `django-app/backend.entrypoint.sh` line 18
- **Description:** `python manage.py makemigrations` runs automatically on every container start. This is a production anti-pattern: auto-generated migration files will not be persisted (the container filesystem is ephemeral unless the project root is volume-mounted), and running `makemigrations` in production can silently swallow schema drift. The correct pattern is to run `migrate` only, and generate migration files locally during development.
- **Remediation:** Remove `makemigrations` from the entrypoint. Keep only `migrate`:
  ```sh
  python manage.py migrate
  ```
  Migration files should be committed to git and applied in CI/CD.
- **Effort:** Low

---

### [MEDIUM-002] Gunicorn Binds to `0.0.0.0` Inside Container
- **Category:** Container / Network
- **Severity:** Medium
- **Location:** `django-app/backend.entrypoint.sh` line 43
- **Description:** `exec gunicorn core.wsgi:application --bind 0.0.0.0:8000` binds gunicorn to all interfaces inside the container. While the docker-compose.yml correctly restricts the host-side port mapping to `127.0.0.1:8000:8000`, binding to `0.0.0.0` inside the container means gunicorn is reachable via any container-internal network path (e.g. from other services on the same Docker network without going through the host). In a compromised Redis or DB container, lateral movement to gunicorn is unrestricted.
- **Remediation:** Bind gunicorn to `127.0.0.1` inside the container:
  ```sh
  exec gunicorn core.wsgi:application --bind 127.0.0.1:8000
  ```
  Then update the port mapping in docker-compose.yml to `"127.0.0.1:8000:8000"` (already correct on the host side — this change would be in the entrypoint only).

  Note: If other containers (e.g., a Caddy reverse proxy container) need to reach gunicorn, use a named Docker network and bind to the container's internal IP or the service hostname instead of `0.0.0.0`.
- **Effort:** Low

---

### [MEDIUM-003] No Custom Docker Network Defined; No Resource Limits
- **Category:** Container / Infrastructure
- **Severity:** Medium
- **Location:** `django-app/docker-compose.yml` (entire file)
- **Description:** Two issues combined:
  1. No explicit `networks:` section is defined. Docker Compose creates a default bridge network, which is functional but not isolated by service group. A custom network makes network intent explicit and prevents accidental reuse of the default bridge by unrelated compose projects.
  2. No `deploy.resources.limits` (CPU/memory) are set on any service. An unconstrained container can exhaust host resources during a spike or attack, causing a denial-of-service across all services on the host.
- **Remediation:**
  ```yaml
  networks:
    backend_net:
      driver: bridge

  services:
    db:
      networks: [backend_net]
      deploy:
        resources:
          limits:
            memory: 512m
            cpus: "0.5"
    redis:
      networks: [backend_net]
      deploy:
        resources:
          limits:
            memory: 128m
            cpus: "0.25"
    web:
      networks: [backend_net]
      deploy:
        resources:
          limits:
            memory: 512m
            cpus: "1.0"
  ```
- **Effort:** Medium

---

### [LOW-001] No Non-Root USER Declared in Dockerfile
- **Category:** Container
- **Severity:** Low
- **Location:** `django-app/backend.Dockerfile`
- **Description:** The Dockerfile does not add a non-root user. The Django/gunicorn process runs as `root` inside the container. If the application is compromised, the attacker has root inside the container, which simplifies container escape attempts and is against the principle of least privilege.
- **Remediation:** Add a non-root user before `ENTRYPOINT`:
  ```dockerfile
  RUN addgroup -S appgroup && adduser -S appuser -G appgroup
  # Ensure app files are owned by appuser
  RUN chown -R appuser:appgroup /app
  USER appuser
  ENTRYPOINT ["./backend.entrypoint.sh"]
  ```
  Note: If the entrypoint script writes files (migrations, staticfiles), confirm the target directories are writable by `appuser`.
- **Effort:** Low

---

### [LOW-002] Entire Project Root Volume-Mounted into Web Container
- **Category:** Container
- **Severity:** Low
- **Location:** `django-app/docker-compose.yml` line 26 (`- .:/app`)
- **Description:** The development volume mount `- .:/app` binds the entire project directory (including `.git`, local `.env`, `env/` virtualenv, `node_modules` if present) into the container. In development this is intentional for hot-reload. However, if this compose file is reused in a staging or production environment, secrets and the git history become accessible inside the container at runtime, and any write the container performs is reflected on the host filesystem.
- **Remediation:** For production, remove this volume entirely and rely on `COPY` in the Dockerfile (which is already present). Consider a separate `docker-compose.prod.yml` that omits the volume mount. Add a comment to the existing compose file:
  ```yaml
  volumes:
    - .:/app   # DEV ONLY — remove for production
  ```
- **Effort:** Low

---

### [LOW-003] Dockerfile LABEL Contains an Incorrect Version String
- **Category:** Container / Hygiene
- **Severity:** Low
- **Location:** `django-app/backend.Dockerfile` line 5
- **Description:** The label reads `description="Python 3.14.0a7 Alpine 3.21"` but the base image is `python:3.12-alpine`. The version annotation is stale and refers to a pre-release Python version that is not in use. Stale metadata can mislead operators during incident response and audits.
- **Remediation:** Update the label to reflect the actual base image version in use:
  ```dockerfile
  LABEL description="Python 3.12 on Alpine Linux"
  ```
- **Effort:** Low

---

### [INFO-001] Trivy Not Installed — CVE Scan Not Performed
- **Category:** Tooling Gap
- **Severity:** Info
- **Location:** Audit environment
- **Description:** `trivy` was not found in PATH. A live CVE scan of the built Docker image layers (OS packages, pip packages) was not performed. This means CVEs in `python:3.12-alpine`'s Alpine apk packages (e.g., busybox, musl, openssl), in `ffmpeg`, or in the pip-installed packages cannot be reported from this audit.
- **Remediation:** Install trivy and rescan:
  ```bash
  brew install trivy            # macOS
  cd django-app
  docker compose build
  trivy image --severity HIGH,CRITICAL app_backend
  ```
  Integrate trivy into CI/CD (GitHub Actions):
  ```yaml
  - name: Run Trivy vulnerability scanner
    uses: aquasecurity/trivy-action@master
    with:
      image-ref: 'app_backend'
      format: 'table'
      severity: 'HIGH,CRITICAL'
      exit-code: '1'
  ```
- **Effort:** Low

---

### [INFO-002] No Docker Secrets Section — Credentials via Environment Variables Only
- **Category:** Container / Secrets
- **Severity:** Info
- **Location:** `django-app/docker-compose.yml`
- **Description:** Credentials (DB password, Django secret key, etc.) are passed via `env_file: .env` and the `environment:` block. This is the standard approach for development and acceptable for most production deployments. However, Docker Compose `secrets:` provides an additional layer of protection by mounting credentials as files in `/run/secrets/` rather than environment variables, which are visible via `docker inspect`. For high-security environments, consider migrating to Docker secrets or an external secrets manager (HashiCorp Vault, AWS Secrets Manager).
- **Remediation (optional upgrade path):**
  ```yaml
  secrets:
    db_password:
      external: true   # pre-created with: echo "..." | docker secret create db_password -
  services:
    db:
      secrets: [db_password]
  ```
- **Effort:** High (architecture change; acceptable to defer)

---

## Passed Checks

The following checks found no issues:

- **Web port host binding:** `127.0.0.1:8000:8000` — correctly restricted to localhost only. The Django API is not exposed on `0.0.0.0`.
- **PostgreSQL port not externally exposed:** The `db` service has no `ports:` entry. Database is not reachable from outside Docker.
- **Redis port not externally exposed:** The `redis` service has no `ports:` entry. Redis is not reachable from outside Docker.
- **DB credentials from env vars:** `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` are all referenced as `${VAR}` — not hardcoded in compose.
- **Alpine base image used:** `python:3.12-alpine` is a minimal base image, significantly reducing the OS package attack surface vs. `python:3.12` (Debian-based).
- **Build deps cleaned up:** `apk del .build-deps` removes gcc, musl-dev, postgresql-dev after the pip install step, keeping the final layer smaller and reducing attack surface.
- **pip cache disabled:** `pip install --no-cache-dir` avoids leaving package caches in the image layer.
- **`.env` gitignored:** The root `.gitignore` includes `.env` and `.env.local`, preventing accidental credential commits.
- **No `ADD` misuse:** The Dockerfile uses `COPY` (not `ADD`) to copy project files, which is the secure practice.
- **`set -e` in entrypoint:** The entrypoint uses `set -e`, causing the script to exit on any command failure rather than silently continuing.

---

## Missing Tools

| Tool | Purpose | Install |
|------|---------|---------|
| trivy | Container CVE scanning | `brew install trivy` |
| trufflehog | Git history secrets detection | `brew install trufflehog` |
| bandit | Python SAST | `pip install bandit` |
| pip-audit | Python dependency CVE audit | `pip install pip-audit` |

---

## Recommended Next Steps

Ordered by priority:

1. **[HIGH-001] Fix hardcoded fallback password** — Add an explicit failure in the entrypoint if `DJANGO_SUPERUSER_PASSWORD` is unset. Zero tolerance: a hardcoded default password on a superuser account is an immediate risk in any non-local environment. Effort: Low.

2. **[HIGH-002] Pin postgres and redis image tags** — Replace `latest` with `postgres:17.4-alpine` and `redis:7.4-alpine`. Prevents silent major-version upgrades and keeps the attack surface auditable. Effort: Low.

3. **[INFO-001] Install and run trivy** — A live CVE scan may surface additional HIGH/CRITICAL findings from OS packages or pip packages that this manual audit cannot detect. Run before production deployment. Effort: Low.

4. **[MEDIUM-001] Remove `makemigrations` from entrypoint** — This is both a security issue and an operational reliability issue. Effort: Low.

5. **[MEDIUM-002] Bind gunicorn to `127.0.0.1`** — Reduces lateral movement surface if another container is compromised. Effort: Low.

6. **[LOW-001] Add non-root USER in Dockerfile** — Reduces blast radius of application-level exploits. Effort: Low.

7. **[MEDIUM-003] Add named Docker network and resource limits** — Prevents resource exhaustion DoS and makes network topology explicit. Effort: Medium.

8. **[LOW-002] Mark the volume mount as dev-only** — Prevents accidental production deployment with host filesystem exposed inside container. Effort: Low.
