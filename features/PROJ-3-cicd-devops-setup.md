# PROJ-3: CI/CD & DevOps Setup

## Status: In Progress
**Created:** 2026-02-28
**Last Updated:** 2026-03-04

## Dependencies
- Requires: PROJ-1 (User Auth) — must be fully implemented before CI runs green
- Requires: PROJ-2 (Frontend Docker Integration) — existing container setup being refactored

---

## Overview
Three scoped goals:
1. **PROJ-1 verification** — run pending migrations + configure Google OAuth so PROJ-1 acceptance criteria can be confirmed
2. **CI/CD pipeline** — automated build/test/publish/deploy via GitHub Actions so every future feature ships with confidence
3. **Docker restructure** — move compose files to project root, run frontend in its own Caddy container, fix Caddy proxy so Django Admin CSS loads correctly

---

## User Stories

### Pre-test (PROJ-1 verification)
- As a developer, I want migrations to include allauth + sites tables so the Google OAuth flow works end-to-end
- As a developer, I want Google OAuth credentials wired into the local env so I can test the "Continue with Google" button
- As a developer, I want all existing pytest tests to pass after the URL migration so I know nothing is broken

### CI/CD
- As a developer, I want every push to trigger automated backend + frontend tests so broken code can't reach main
- As a developer, I want merging to main to automatically build and publish a Docker image to GHCR so deployment is reproducible
- As a developer, I want a successful publish to auto-deploy to the production server so releases require zero manual steps
- As a developer, I want weekly security scans (SAST, npm audit, container scan) so vulnerabilities surface early

### Docker Restructure
- As a developer, I want to run `docker compose up --build` from the project root so I don't have to `cd django-app` before every command
- As a developer, I want the frontend to run in its own serving container (Caddy) so it can be independently deployed and reasoned about
- As a developer, I want the Django Admin interface to display CSS correctly in production so I can use the admin dashboard
- As a developer, I want a single Caddy reverse proxy on `miner.mariowinter.com` routing all traffic so there is one clear entry point
- As a developer, I want HTTPS auto-provisioned by Caddy so there is no manual certificate management
- As a developer, I want frontend API calls to use relative paths so CORS is not required between frontend and backend (same origin via Caddy)

---

## Acceptance Criteria

### PROJ-1 Verification
- [ ] `docker compose exec web python manage.py migrate` exits 0; all allauth + sites migrations show `[X]`
- [ ] Google OAuth credentials (Client ID + Secret) are present in `django-app/.env`
- [ ] Django admin → Social Applications has a Google app linked to the correct site
- [ ] `http://localhost:8000/api/auth/google/` redirects to Google's OAuth consent screen
- [ ] `docker compose exec web pytest` exits 0 (no regressions)
- [ ] `npm run dev` serves login page at `localhost:5173` without console errors

### CI — `ci.yml`
- [ ] Runs on every push and pull request to `main`
- [ ] Backend job: `pytest` + `python manage.py migrate --check` + `ruff check`
- [ ] Frontend job: `npm run lint` + `npm run test:ci` + `npm run build`
- [ ] All jobs must pass before PR can merge

### Docker Publish — `docker-publish.yml`
- [ ] Triggers on merge to `main` (push event)
- [ ] Builds backend image from `django-app/backend.Dockerfile`
- [ ] Pushes to GHCR: `ghcr.io/<owner>/<repo>/backend:latest` + SHA tag
- [ ] Uses GHA layer cache for fast rebuilds

### Auto-deploy — `deploy.yml`
- [ ] Triggers after `docker-publish.yml` succeeds on `main`
- [ ] SSH into `/home/dev/merch-miner`, runs `git fetch origin main && git reset --hard origin/main` + `docker compose -f docker-compose.yml -f docker-compose.prod.yml pull && up -d --remove-orphans`
- [ ] Runs `manage.py migrate --no-input` + `collectstatic --no-input` post-deploy
- [ ] Deploys only if publish workflow concluded `success`

### Security — `security.yml`
- [ ] Runs weekly (Mon 9am UTC) and on every PR to `main`
- [ ] `bandit` SAST on `django-app/` (medium severity minimum)
- [ ] `npm audit --audit-level=high` on `frontend-ui/`
- [ ] `trivy` container scan on GHCR image (weekly only, HIGH + CRITICAL exit-code 1)

### GitHub Secrets
- [ ] All 5 secrets documented and added to repo Settings → Secrets → Actions:
  `SECRET_KEY`, `VITE_API_URL`, `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`
  (`DATABASE_URL` not needed — CI backend uses in-runner postgres with hardcoded test credentials)

### Docker Restructure — Root-Level Compose ✅ DONE
- [x] `docker compose up --build` from `merch-miner/` starts all services (redis, worker, web, frontend) without error
- [x] `docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d` from root starts prod stack without error
- [x] No docker-compose or Caddyfile remains in `django-app/` (all deleted)
- [x] All build contexts in root compose files point correctly to `./django-app` and `./frontend-ui`
- [x] Dev volume mount for hot-reload points to `./django-app:/app`
- [x] Root `.env` (not `django-app/.env`) — single env file at project root

### Docker Restructure — Frontend Container (Prod) ✅ DONE
- [x] `frontend` service in prod builds React SPA and runs a Caddy server on port 80
- [x] `frontend-ui/Caddyfile` configures Caddy to serve `/srv` with `try_files {path} /index.html` SPA fallback
- [x] Navigating directly to any frontend route (e.g. `/login`, `/dashboard`) returns the React app (no 404)
- [x] Built JS/CSS assets served with `Cache-Control: max-age=31536000`
- [x] `index.html` served with `Cache-Control: no-cache, no-store, must-revalidate`
- [x] Frontend container NOT directly exposed on any host port in prod

### Docker Restructure — Caddy Proxy (Prod) ✅ DONE
- [x] Root `Caddyfile`: `miner.mariowinter.com:80` (API+static/media) + `merch-miner.mariowinter.com:80` (SPA)
- [x] TLS terminated upstream by Haupt-Caddy (external, not managed by this stack)
- [x] `GET /api/*` + `GET /admin/*` reverse-proxied to `web:8000`
- [x] `GET /static/*` + `GET /media/*` served from volumes
- [x] All other requests on `merch-miner.mariowinter.com` proxied to `frontend:80`
- [x] Caddyfile uses service name `web`

### Docker Restructure — Dev Workflow Unchanged ✅ DONE
- [x] `docker compose up --build` (dev, from root) exposes frontend at `localhost:5173` with Vite HMR
- [x] Dev backend accessible at `localhost:8000`
- [x] No local `db` container — connects to Supabase via `supabase-net` external network

---

## Edge Cases
- If `manage.py migrate --check` fails in CI, fail the build immediately (don't run tests against stale schema)
- If Google OAuth callback receives an error param, redirect to `/login?error=oauth_failed` (already implemented in `GoogleCallbackView`)
- If `deploy.yml` SSH step fails, keep the old container running (Docker Compose `up -d` is non-destructive)
- If `logo.png` is missing from `django-app/static/`, emails send but HTML email has broken image — pre-production TODO, not a blocker
- Container trivy scan only runs on `schedule` (not PR) to avoid failing PRs when GHCR image doesn't exist yet on feature branches
- **`merch_net` must exist** before prod stack starts (`docker network create merch_net`); if missing, Caddy/web containers fail to join the network — must be in deploy runbook
- **Caddy ACME on first boot**: port 443 must be externally reachable; if not, Caddy falls back to HTTP
- **Static files on fresh prod start**: `backend.entrypoint.sh` runs `collectstatic` before gunicorn; volume populated before Caddy serves requests
- **`/app/node_modules` anonymous volume in dev**: must be declared to prevent host bind-mount shadowing container's `node_modules`
- **Frontend Caddyfile name collision**: `frontend-ui/Caddyfile` is distinct from root `Caddyfile`; Dockerfile copies from `frontend-ui/` build context

---

## Technical Requirements
- GitHub Actions runners: `ubuntu-latest`
- Registry: GitHub Container Registry (GHCR) — free, no extra account needed
- Production app path: `/home/dev/merch-miner`
- Django version check: CI uses native Python 3.12 + GHA postgres service (not Docker Compose — avoids `supabase-net` dependency on runner)
- Frontend Node version: 20 LTS
- All compose files: Docker Compose v2 syntax (`services:` top-level, no `version:` field)
- Frontend serving image: `caddy:2-alpine`
- Main reverse proxy: `caddy:2-alpine`, ports 80 + 443 exposed in prod
- Static volume: mounted at `/app/static` in `web`, `/srv/static` in main Caddy
- Media volume: mounted at `/app/media` in `web`, `/srv/media` in main Caddy
- External network `merch_net` declared in `docker-compose.prod.yml` only
- No secrets in compose files; all credentials via `./django-app/.env`

---

## Files Changed (Docker Restructure)

| Action | File |
|--------|------|
| CREATE | `merch-miner/docker-compose.yml` |
| CREATE | `merch-miner/docker-compose.override.yml` |
| CREATE | `merch-miner/docker-compose.prod.yml` |
| CREATE | `merch-miner/Caddyfile` |
| CREATE | `frontend-ui/Caddyfile` |
| MODIFY | `frontend-ui/Dockerfile` (swap alpine seed → caddy:2-alpine serving stage) |
| DELETE | `django-app/docker-compose.yml` |
| DELETE | `django-app/docker-compose.override.yml` |
| DELETE | `django-app/docker-compose.prod.yml` |
| DELETE | `django-app/Caddyfile` |
| MODIFY | `CLAUDE.md` (update compose commands to run from root) |

---

## Out of Scope
- Staging environment (production only for MVP)
- Slack/email notifications on deploy failure (can add post-MVP)
- Multiple Caddy instances (one main Caddy is sufficient)
- `backend.entrypoint.sh` refactor (running `makemigrations` in prod is a known risk, addressed separately)

---

## Known Production Details
- Server path: `/home/dev/merch-miner` ✅ confirmed
- Domains: `miner.mariowinter.com` (API) / `merch-miner.mariowinter.com` (SPA) ✅ confirmed
- TLS: terminated by Haupt-Caddy (external to this stack — Caddyfile uses `:80`) ✅ confirmed
- DB: Supabase PostgreSQL in `localai` stack, accessed via `supabase-net` ✅ confirmed
- `merch_net` external Docker network used in prod compose

## Unresolved Questions
- SSH username on prod server (needed for `SERVER_USER` secret)
- Does `merch_net` already exist on the prod host? (must `docker network create merch_net` if not)
- `DB_SCHEMA=public` in CI — verify no test relies on `merch_miner` schema-specific behavior

---

## Tech Design (Solution Architect)

### Overview
PROJ-3 has three independent but sequentially ordered workstreams. All are infrastructure/DevOps — no frontend UI components or new Django apps are added.

```
Workstream A: Docker Restructure     (prerequisite for B + C)
Workstream B: PROJ-1 Verification    (prerequisite for C)
Workstream C: CI/CD GitHub Actions   (runs last)
```

---

### A — Docker Restructure

#### Service Architecture (Prod)

```
Internet
   │
   ▼
Haupt-Caddy (external, handles TLS for *.mariowinter.com)
   │
   ├── miner.mariowinter.com:80
   │     ├── /static/*  ──► Volume: static_volume
   │     ├── /media/*   ──► Volume: media_volume
   │     └── /*         ──► web:8000 (Gunicorn / Django)
   │
   └── merch-miner.mariowinter.com:80
         └── /*         ──► frontend:80 (Caddy serving React SPA)

Internal services (no host ports exposed):
   web:8000     ← Django + Gunicorn (3 workers)
   frontend:80  ← Caddy serving built React dist
   redis:6379   ← Redis 7
   worker       ← django-rq background jobs
   (no local db — Supabase PostgreSQL via supabase-net external network)
```

#### Service Architecture (Dev)

```
localhost:5173  ──► frontend container (Vite dev server + HMR)
                      └── /api/*  ──► proxy ──► localhost:8000
                      └── /admin/* ──► proxy ──► localhost:8000
localhost:8000  ──► web container (Django runserver)
```
Dev has no Caddy. Vite's built-in proxy handles API routing. Django's `DEBUG=True` serves static files directly.

#### File Layout After Restructure

```
merch-miner/                         ← All compose commands run from here
├── docker-compose.yml               ← Base: 5 services (db, redis, worker, web, frontend)
├── docker-compose.override.yml      ← Dev: expose ports 8000 + 5173 to localhost
├── docker-compose.prod.yml          ← Prod: gunicorn, frontend Caddy, main Caddy, merch_net
├── Caddyfile                        ← Main reverse proxy (domain, routing, TLS)
├── django-app/
│   ├── backend.Dockerfile           ← unchanged
│   ├── backend.entrypoint.sh        ← unchanged (runs collectstatic + migrate)
│   └── .env                         ← secrets (not in git)
└── frontend-ui/
    ├── Dockerfile                   ← Multi-stage: Node build → Caddy serve
    ├── Caddyfile                    ← Frontend-only: SPA fallback + cache headers
    └── Dockerfile.dev               ← unchanged (Vite dev server)
```

#### Why Caddy for Frontend (not nginx)?
Caddy is already the main reverse proxy. Using `caddy:2-alpine` for the frontend serving container keeps the toolchain uniform — one mental model, one config language. nginx would add a second config syntax for no benefit.

#### Why One Main Caddy (not separate per service)?
`miner.mariowinter.com` is a single domain. One Caddy handles TLS termination, static file serving, and proxying — simpler ops, fewer moving parts. TLS is automatic via ACME (Let's Encrypt).

#### Why `VITE_API_URL=""`?
Frontend and backend share the same domain via Caddy. Axios uses relative paths (`/api/...`), which resolve to `miner.mariowinter.com/api/...` in the browser. No CORS headers needed between frontend and backend.

---

### B — PROJ-1 Verification

No new files. Verification steps:
1. Run existing migrations to confirm allauth + sites tables apply cleanly
2. Add Google OAuth credentials to `django-app/.env`
3. Create Social Application record via Django Admin
4. Manual smoke test of OAuth redirect

---

### C — CI/CD Pipeline

#### Workflow Trigger Map

```
Any push / PR to main
   └── ci.yml
         ├── backend-tests  (pytest, migrate --check, ruff)
         └── frontend-tests (lint, test:ci, build)

Merge to main (push)
   └── docker-publish.yml
         └── Build + push backend image to GHCR
               └── on success → deploy.yml
                     └── SSH to server: docker compose pull + up -d

Every Monday 9am UTC + every PR to main
   └── security.yml
         ├── bandit (Django SAST)
         ├── npm audit (frontend deps)
         └── trivy (container scan — schedule only)
```

#### Registry
GitHub Container Registry (GHCR) — free, integrated with GitHub permissions, no separate account.

#### Image Tags
- `latest` — always points to most recent `main` merge
- `sha-<commit>` — immutable tag for rollbacks

#### Secrets Required (5 total)

| Secret | Used by |
|--------|---------|
| `SECRET_KEY` | CI backend tests |
| `VITE_API_URL` | CI frontend build |
| `SERVER_HOST` | deploy.yml SSH |
| `SERVER_USER` | deploy.yml SSH |
| `SERVER_SSH_KEY` | deploy.yml SSH |

`DATABASE_URL` not needed — CI uses in-runner postgres (`localhost:5432`) with hardcoded test credentials.

---

### Data Storage
No new database tables. No new Django models. No frontend state changes. This is pure infrastructure.

### Dependencies / Tools
| Tool | Purpose |
|------|---------|
| `caddy:2-alpine` | Frontend SPA serving + main reverse proxy |
| GitHub Actions | CI/CD automation (free tier) |
| GHCR | Docker image registry |
| `bandit` | Python SAST scanner |
| `trivy` | Container vulnerability scanner |
| `ruff` | Python linter (already in pyproject.toml) |

## QA Test Results

**QA Date:** 2026-03-05
**Auditor:** /qa skill (Claude Sonnet 4.6)
**Branch:** `feature/ci-cd`
**Scope:** GHCR production deployment + local Docker development validation

---

### Summary

| Category | Result |
|----------|--------|
| Total acceptance criteria tested | 26 |
| Passed | 18 |
| Failed | 8 |
| Critical bugs | 1 |
| High bugs | 4 |
| Medium bugs | 2 |
| Low bugs | 1 |
| Production Deployment Ready | NO |
| Local Docker Development Ready | NO |

---

### Deployment Architecture (as audited)

Production flow:
1. Push to `main` triggers `ci.yml` (tests) in parallel with `docker-publish.yml` (image build)
2. `docker-publish.yml` builds backend image (`django-app/backend.Dockerfile`) and frontend image (`frontend-ui/Dockerfile` target `prod`) and pushes both to GHCR
3. `deploy.yml` triggers on `docker-publish.yml` success; SSHs to `/home/dev/merch-miner`; runs `git pull --ff-only` then `docker compose -f docker-compose.yml -f docker-compose.prod.yml pull && up -d`
4. `docker-compose.prod.yml` overrides `web` and `worker` with `image: ${BACKEND_IMAGE}` and `frontend` with `image: ${FRONTEND_IMAGE}`; adds `caddy` service; uses `merch_net` + `supabase-net` external networks
5. Root `Caddyfile` routes `miner.mariowinter.com:80` (API+static/media) and `merch-miner.mariowinter.com:80` (SPA) through to services

Local development flow:
1. `docker compose up --build` from root uses `docker-compose.yml` (base) + auto-loaded `docker-compose.override.yml` (dev ports)
2. Base compose uses `build:` directives for all services; override exposes `127.0.0.1:8000` and `127.0.0.1:5173`
3. Frontend service built with `target: dev` which runs Vite dev server
4. Backend runs `python manage.py runserver`; both services share `supabase-net` external network

---

### Acceptance Criteria Test Results

#### CI — `ci.yml`

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| CI-1 | Runs on every push and pull request to `main` | PASS | `on: push: branches: [main]` + `pull_request: branches: [main]` |
| CI-2 | Backend job: `pytest` + `migrate --check` + `ruff check` | PASS | All three steps present |
| CI-3 | Frontend job: `npm run lint` + `npm run test:ci` + `npm run build` | PASS | All three steps present |
| CI-4 | All jobs must pass before PR can merge | FAIL | No branch protection rule is enforced at workflow level; requires manual GitHub repo settings config (not in any file) — see BUG-1 |

#### Docker Publish — `docker-publish.yml`

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| DP-1 | Triggers on merge to `main` | PASS | `on: push: branches: [main]` |
| DP-2 | Builds backend image from `django-app/backend.Dockerfile` | PASS | `context: django-app`, `file: django-app/backend.Dockerfile` |
| DP-3 | Pushes to GHCR with `latest` + SHA tag | PASS | `type=sha` + `type=raw,value=latest` |
| DP-4 | Uses GHA layer cache | PASS | `cache-from: type=gha`, `cache-to: type=gha,mode=max` |
| DP-5 | Builds frontend image and pushes to GHCR | PASS | Second job `build-and-push-frontend` present |

#### Auto-deploy — `deploy.yml`

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| DEP-1 | Triggers after `docker-publish.yml` succeeds on `main` | PASS | `workflow_run` + `conclusion == 'success'` + `branches: [main]` |
| DEP-2 | SSH path `/home/dev/merch-miner` correct | PASS | Confirmed in diff |
| DEP-3 | Runs `docker compose pull` then `up -d` (no `--build`) | PASS | `pull` + `up -d --remove-orphans` — no `--build` flag |
| DEP-4 | Runs `migrate` + `collectstatic` post-deploy | PASS | Both exec commands present |
| DEP-5 | Production does NOT use `--build` | PASS | Verified |
| DEP-6 | `git pull --ff-only` in deploy script | FAIL | Deployment depends on source code checkout on server — violates "production should not depend on git pull" principle — see BUG-2 |

#### Security — `security.yml`

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| SEC-1 | Runs weekly Mon 9am UTC + every PR to `main` | PASS | `cron: '0 9 * * 1'` + `pull_request: branches: [main]` |
| SEC-2 | `bandit` SAST medium severity | PASS | `--severity-level medium` |
| SEC-3 | `npm audit --audit-level=high` | PASS | Present |
| SEC-4 | `trivy` weekly only on GHCR image | PASS | `if: github.event_name == 'schedule'` |

#### Production — `docker-compose.prod.yml`

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| PRD-1 | `web` uses `image:` not `build:` | PASS | `image: ${BACKEND_IMAGE}` |
| PRD-2 | `frontend` uses `image:` not `build:` | PASS | `image: ${FRONTEND_IMAGE}` |
| PRD-3 | `worker` uses `image:` not `build:` | PASS | `image: ${BACKEND_IMAGE}` |
| PRD-4 | `caddy` service present | PASS | Service declared |
| PRD-5 | `merch_net` external network declared | PASS | `external: true, name: merch_net` |
| PRD-6 | `env_file` for `web` and `worker` in prod | FAIL | `docker-compose.prod.yml` overrides `web` and `worker` but does NOT include `env_file`; the base `docker-compose.yml` sets `env_file: ./.env` only on `worker` and `web`, but in prod override the `worker` service block has no `env_file` at all — the override only sets `image:`, `restart:`, `networks:` — see BUG-3 |

#### Local Development

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| LD-1 | `docker compose up --build` from root works without GHCR | PASS | `build:` directives present in base compose |
| LD-2 | `supabase-net` declared as external in base compose | PASS | `external: true` |
| LD-3 | Dev volumes for hot-reload mounted in override | PASS | `./django-app:/app` + `./frontend-ui:/app` |
| LD-4 | `node_modules` anonymous volume declared | PASS | `/app/node_modules` anonymous volume in override |
| LD-5 | Frontend built with `target: dev` | PASS | `target: dev` in base compose |
| LD-6 | `frontend` service `env_file` in dev | FAIL | Base `docker-compose.yml` sets `env_file: ./.env` for `frontend` service, but `VITE_*` vars only work as build-args, not runtime env for the Vite dev container — not a blocker but see BUG-4 |
| LD-7 | Dev works without GHCR access | FAIL | `supabase-net` external network must exist on developer machine — a macOS developer without the localai Supabase stack running will get a network-not-found error on `docker compose up` — no fallback or documentation of this requirement — see BUG-5 |

---

### Bugs Found

#### BUG-1 — GHCR Image Name Mismatch Between CI and `.env` / `.env.template`
**Severity:** HIGH
**Category:** Configuration Consistency

`docker-publish.yml` constructs image names as:
```
ghcr.io/${{ github.repository }}/backend
ghcr.io/${{ github.repository }}/frontend
```
`github.repository` is `MarioWinter/merch-miner` (owner/repo format).
This produces: `ghcr.io/mariowinter/merch-miner/backend:latest`

`.env.template` has inconsistent placeholder values:
```
BACKEND_IMAGE=ghcr.io/username/merch-miner/backend:latest   # wrong placeholder username
FRONTEND_IMAGE=ghcr.io/mariowinter/merch-miner/frontend:latest  # different owner format
```
The `BACKEND_IMAGE` placeholder uses `username` (generic) while `FRONTEND_IMAGE` uses `mariowinter`. The actual CI-produced tag will be `ghcr.io/mariowinter/merch-miner/backend:latest`. If a new developer copies `.env.template` as-is, `BACKEND_IMAGE` will point to a non-existent GHCR path and prod deployment will fail with image-not-found error.

**Steps to reproduce:**
1. Copy `.env.template` to `.env` on a production server
2. Run `docker compose -f docker-compose.yml -f docker-compose.prod.yml pull`
3. Docker daemon attempts to pull `ghcr.io/username/merch-miner/backend:latest` — fails

**Priority:** Fix before first production deployment

---

#### BUG-2 — Production Deployment Depends on `git pull` of Source Code
**Severity:** HIGH
**Category:** Deployment Architecture

`deploy.yml` SSH script runs `git pull --ff-only` before pulling GHCR images. This creates a dependency on the server having a git clone of the repository with:
- The correct remote configured
- A clean working tree (no local modifications)
- The server user having git access

The original acceptance criterion in the spec states the deploy should work via `docker compose pull + up -d` without requiring application source code (the whole point of GHCR images). The current implementation still requires compose files and the Caddyfile from the git repo, which is a legitimate reason to run `git pull` — but this is not documented and creates a silent failure mode: if `git pull --ff-only` fails (e.g. due to local modifications), the entire deploy fails but the _old_ container keeps running without any error notification.

Additionally, the acceptance criterion in the spec (line 68) explicitly says the deploy runs `git pull + docker compose ... up --build` but the implemented deploy does NOT use `--build` (correct). However, the spec criterion still documents `--build` which is now stale.

**Steps to reproduce:**
1. Make a local modification on the server in `/home/dev/merch-miner`
2. Push a commit to `main` on GitHub
3. `deploy.yml` runs `git pull --ff-only` — fails with "not possible to fast-forward"
4. Deploy exits non-zero but old containers still run — no alert

**Priority:** Document the git dependency explicitly; add error handling or consider alternative

---

#### BUG-3 — `worker` Service Missing `env_file` in `docker-compose.prod.yml`
**Severity:** HIGH
**Category:** Production Deployment

The `worker` service block in `docker-compose.prod.yml` only defines:
```yaml
worker:
  image: ${BACKEND_IMAGE}
  restart: unless-stopped
  networks:
    - default
    - supabase-net
```
It does not include `env_file: ./.env`. The base `docker-compose.yml` defines `env_file: ./.env` on the `worker` service. Docker Compose merges files by service key — when an override file redefines a service, scalar fields from the base are NOT automatically inherited if the override service block exists and the override doesn't repeat the field.

In practice, Docker Compose v2 DOES merge `env_file` from base + override because it's a list-type field. However, command-level testing is needed to confirm. If the merge works correctly this is medium. If not (implementation-dependent), the worker container starts with no DB credentials and crashes immediately.

**Steps to reproduce:**
1. Run `docker compose -f docker-compose.yml -f docker-compose.prod.yml config` and inspect the merged `worker` service
2. Verify `env_file` appears in the merged output

**Priority:** High — explicitly add `env_file` to prod override worker block to remove ambiguity

---

#### BUG-4 — `backend.entrypoint.sh` Runs `makemigrations` in Production
**Severity:** HIGH
**Category:** Security / Deployment

`django-app/backend.entrypoint.sh` line 12 runs `python manage.py makemigrations` before `migrate`. Running `makemigrations` in a production container is a well-known anti-pattern and security risk:
- Can generate spurious migration files inside the container (ephemeral but still runs)
- If the container filesystem is writable, migration files could accumulate
- In the worst case, a misconfigured `MODEL` in a Django app could cause `makemigrations` to auto-generate a migration that modifies the database schema unexpectedly when `migrate` runs immediately after
- The spec itself (line 166) flags this as a "known risk addressed separately" but the code has not been changed

This is the entrypoint for both dev and prod (the `web` and `worker` services both use this Dockerfile). The `worker.entrypoint.sh` does NOT run `makemigrations`, but `backend.entrypoint.sh` does.

**Steps to reproduce:**
1. Deploy production container
2. Observe `makemigrations` output in `web` container logs

**Priority:** Should be removed before production deployment

---

#### BUG-5 — `supabase-net` External Network Breaks Local Dev on macOS Without Supabase Stack
**Severity:** MEDIUM
**Category:** Local Development

`docker-compose.yml` declares `supabase-net` as an external network (required by `worker` and `web` services). On a macOS developer machine that does not have the localai Supabase stack running, this network does not exist. Running `docker compose up --build` will fail at network validation:
```
network supabase-net declared as external, but could not be found
```
There is no documentation in the README or spec about the prerequisite. A new developer cloning the repo has no indication they need to create this network or have Supabase running.

**Steps to reproduce:**
1. Clone repo on fresh macOS machine
2. Run `docker compose up --build` from root
3. Error: external network `supabase-net` not found

**Priority:** Medium — document prerequisite or add fallback network creation to setup instructions

---

#### BUG-6 — Spec Acceptance Criterion for `deploy.yml` Documents `--build` Flag (Stale)
**Severity:** LOW
**Category:** Documentation

Spec line 68:
```
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d --remove-orphans
```
Actual implementation in `deploy.yml` correctly omits `--build`. The spec criterion is stale and contradicts the correct implementation. This will confuse future auditors.

**Priority:** Low — update spec only

---

#### BUG-7 — `.env.template` Missing Production Override Section
**Severity:** MEDIUM
**Category:** Documentation / Security

The `.env.template` diff shows the production overrides section was removed (the commented-out `DEBUG=False`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, etc.). The live `.env` file still has these commented-out production overrides, but `.env.template` does not. A developer using `.env.template` as their reference will not know they need to set production-specific values before deploying, and they will deploy with `DEBUG=True` and local `ALLOWED_HOSTS`.

The `django-app/.env.prod` file exists as a separate template for production, but this file is not referenced in documentation.

**Priority:** Medium — re-add production override comments to `.env.template` or document `.env.prod` usage

---

#### BUG-8 — `backend.entrypoint.sh` Creates Superuser with Default Credentials
**Severity:** CRITICAL (Security)
**Category:** Security

`backend.entrypoint.sh` lines 15-28 run a Django shell script on every container start that creates a superuser if one does not exist, using env vars that default to:
- username: `admin`
- email: `admin@example.com`
- password: `adminpassword`

If `DJANGO_SUPERUSER_PASSWORD` is not set in the production `.env`, a superuser with password `adminpassword` is created. The production env template (`django-app/.env.prod`) does set `DJANGO_SUPERUSER_PASSWORD=CHANGE-THIS` as a placeholder, but this placeholder is a literal string — if a deployer copies the file without changing it, they create a superuser with password `CHANGE-THIS` (still a weak, known default).

Furthermore, this superuser creation runs on EVERY container restart, not just first boot. While it only creates if the user doesn't exist, it still executes the Django shell invocation each time, adding unnecessary startup overhead and surface area.

**Steps to reproduce (security test):**
1. Deploy without setting `DJANGO_SUPERUSER_PASSWORD` env var
2. Container creates admin user with password `adminpassword`
3. Navigate to `/admin/` and log in with `admin` / `adminpassword`

**Priority:** Fix before production — at minimum, fail fast if default password is detected, or move superuser creation to a separate one-time management command

---

### Security Audit (Red Team Perspective)

| Check | Finding | Severity |
|-------|---------|----------|
| Secrets in git | `.env` correctly gitignored; `.env.template` committed with dummy values — OK | PASS |
| `.env.prod` in git | File is gitignored (`.env.prod` matches `.env*` pattern in `.gitignore`) — confirmed not tracked | PASS |
| `frontend-ui/.env` in git | Not tracked (confirmed via `git ls-files`) | PASS |
| Hardcoded credentials in scripts | `backend.entrypoint.sh` defaults `adminpassword` — see BUG-8 | CRITICAL |
| GHCR token | Uses `GITHUB_TOKEN` (ephemeral, auto-rotated) — correct | PASS |
| SSH key exposure | SSH key only in GitHub Secret, never logged | PASS |
| `DEBUG=True` in prod risk | `.env` has `DEBUG=True` with commented-out override — risk if deployer forgets | MEDIUM |
| `rqworker` in entrypoint | `backend.entrypoint.sh` spawns `rqworker` as background process inside `web` container — worker is not separated from web process in dev — not a security issue but an architectural concern | LOW |
| Google OAuth credentials | `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` present in local `.env` (not tracked by git) — OK | PASS |
| Gmail app password | `EMAIL_HOST_PASSWORD=nvfzahwpvvaqzrdt` in local `.env` — not tracked by git — OK (but rotate if compromised) | PASS |

---

### Regression Check — PROJ-1 (User Auth) and PROJ-2 (Frontend Docker)

PROJ-1 and PROJ-2 acceptance criteria that could be affected by PROJ-3 Docker restructure:

| Check | Status | Notes |
|-------|--------|-------|
| `docker compose up --build` starts all services | NOT TESTED (requires live Supabase/localai stack) | Blocked by BUG-5 on fresh machine |
| `frontend` service at `localhost:5173` | Config correct — ports mapped in override | LIKELY PASS |
| Django API at `localhost:8000` | Config correct | LIKELY PASS |
| `supabase-net` requirement documented | FAIL | Not documented for new devs |
| Dev volume hot-reload | Config correct in override | LIKELY PASS |

---

### Production-Ready Decision

**Production Deployment Ready: NO**

Blocking issues:
- BUG-8 (Critical): default superuser password `adminpassword` is created if env var missing
- BUG-1 (High): `.env.template` has wrong `BACKEND_IMAGE` placeholder — new deployers will get image-not-found on first deploy
- BUG-3 (High): `worker` service missing explicit `env_file` in prod override — ambiguous merge behavior
- BUG-4 (High): `makemigrations` runs in production entrypoint

**Local Docker Development Ready: NO**

Blocking issues:
- BUG-5 (Medium): `supabase-net` external network prerequisite undocumented — fresh macOS developer cannot start the stack

## Deployment
_To be added by /deploy_
