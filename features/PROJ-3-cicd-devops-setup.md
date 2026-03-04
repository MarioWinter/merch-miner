# PROJ-3: CI/CD & DevOps Setup

## Status: Planned
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
- [ ] SSH into production server, runs `docker compose pull && docker compose up -d --remove-orphans`
- [ ] Runs `manage.py migrate --no-input` + `collectstatic --no-input` post-deploy
- [ ] Deploys only if publish workflow concluded `success`

### Security — `security.yml`
- [ ] Runs weekly (Mon 9am UTC) and on every PR to `main`
- [ ] `bandit` SAST on `django-app/` (medium severity minimum)
- [ ] `npm audit --audit-level=high` on `frontend-ui/`
- [ ] `trivy` container scan on GHCR image (weekly only, HIGH + CRITICAL exit-code 1)

### GitHub Secrets
- [ ] All 6 secrets documented and added to repo Settings → Secrets → Actions:
  `SECRET_KEY`, `DATABASE_URL`, `VITE_API_URL`, `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`

### Docker Restructure — Root-Level Compose
- [ ] `docker compose up --build` from `merch-miner/` starts all services (db, redis, worker, web, frontend) without error
- [ ] `docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d` from root starts prod stack without error
- [ ] No docker-compose or Caddyfile remains in `django-app/` (all deleted)
- [ ] All build contexts in root compose files point correctly to `./django-app` and `./frontend-ui`
- [ ] Dev volume mount for hot-reload points to `./django-app:/app`
- [ ] `django-app/.env` referenced as `./django-app/.env` in all compose files

### Docker Restructure — Frontend Container (Prod)
- [ ] `frontend` service in prod builds React SPA and runs a Caddy server on port 80
- [ ] `frontend-ui/Caddyfile` configures Caddy to serve `/srv` with `try_files {path} /index.html` SPA fallback
- [ ] Navigating directly to any frontend route (e.g. `/login`, `/dashboard`) returns the React app (no 404)
- [ ] Built JS/CSS assets served with `Cache-Control: public, max-age=31536000, immutable`
- [ ] `index.html` served with `Cache-Control: no-cache, no-store, must-revalidate`
- [ ] Frontend container NOT directly exposed on any host port in prod

### Docker Restructure — Caddy Proxy (Prod)
- [ ] Root `Caddyfile` listens on `miner.mariowinter.com` (HTTPS auto-provisioned by Caddy ACME)
- [ ] `GET /api/*` reverse-proxied to `web:8000` and returns Django responses
- [ ] `GET /admin/*` reverse-proxied to `web:8000`; Django Admin loads with full CSS
- [ ] `GET /static/admin/css/base.css` returns HTTP 200 `text/css`
- [ ] `GET /media/*` serves uploaded files from the media volume
- [ ] `GET /` and all other paths reverse-proxied to `frontend:80` returning the React SPA
- [ ] Caddyfile uses service name `web` (not container name `app_backend`)

### Docker Restructure — Dev Workflow Unchanged
- [ ] `docker compose up --build` (dev, from root) exposes frontend at `localhost:5173` with Vite HMR
- [ ] Dev backend accessible at `localhost:8000`
- [ ] Vite proxy forwards `/api/*` and `/admin/*` to `web:8000`

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
- Production app path: `/opt/app` (adjust to actual server path)
- Django version check: CI uses Docker Compose (same image as production, not bare Python)
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

## Unresolved Questions
- SSH username on production server
- App path on server (`/opt/app` assumed — confirm)
- Production `DATABASE_URL` connection string
- Does `merch_net` already exist on the prod host?
- Should `acme_email` global option be set in root Caddyfile for cert provisioning?

## Known Production Details
- Domain: `merch-miner.mariowinter.com` (frontend) / `miner.mariowinter.com` (alias)
- `merch_net` external Docker network used in prod compose

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
