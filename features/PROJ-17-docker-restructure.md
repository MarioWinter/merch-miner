# PROJ-17: Docker Restructure — Root Compose, Frontend Container & Caddy Fix

## Status: Planned
**Created:** 2026-03-04
**Last Updated:** 2026-03-04

## Dependencies
- Requires: PROJ-2 (Frontend Docker Integration) — existing container setup being refactored
- Blocks: PROJ-3 (CI/CD & DevOps Setup) — CI must reference new compose file location at root

---

## Overview
Three infrastructure gaps to close in one atomic change:
1. **Root-level orchestration** — move all Docker Compose and Caddyfile out of `django-app/` to the project root so the project starts from `merch-miner/` with correct build contexts
2. **Frontend serving container** — replace the one-shot build-seed container with a real running Caddy container that serves the built React SPA
3. **Caddy proxy correctness** — fix wrong backend service name, add HTTPS domain, serve Django static/media volumes correctly so the Django Admin CSS loads

---

## User Stories

- As a developer, I want to run `docker compose up --build` from the project root so I don't have to `cd django-app` before every command
- As a developer, I want the frontend to run in its own serving container (Caddy) so it can be independently deployed, scaled, and reasoned about
- As a developer, I want the Django Admin interface to display CSS correctly in production so I can use the admin dashboard
- As a developer, I want a single Caddy reverse proxy on `miner.mariowinter.com` routing all traffic so there is one clear entry point to the system
- As a developer, I want HTTPS auto-provisioned by Caddy so there is no manual certificate management
- As a developer, I want API calls from the frontend to go through `miner.mariowinter.com` so CORS is not required between frontend and backend (same origin)

---

## Acceptance Criteria

### Root-Level Compose
- [ ] `docker compose up --build` from `merch-miner/` starts all services (db, redis, worker, web, frontend) without error
- [ ] `docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d` from root starts prod stack without error
- [ ] No docker-compose or Caddyfile remains in `django-app/` (deleted)
- [ ] All build contexts in root compose files point correctly to `./django-app` and `./frontend-ui`
- [ ] Dev volume mount for hot-reload points to `./django-app:/app`
- [ ] `django-app/.env` is referenced as `./django-app/.env` in all compose files

### Frontend Container (Prod)
- [ ] `frontend` service in prod builds React SPA and runs a Caddy server on port 80
- [ ] `frontend-ui/Caddyfile` configures Caddy to serve `/srv` with `try_files {path} /index.html` SPA fallback
- [ ] Navigating directly to any frontend route (e.g. `/login`, `/dashboard`) returns the React app (no 404)
- [ ] Built JS/CSS assets are served with `Cache-Control: public, max-age=31536000, immutable`
- [ ] `index.html` is served with `Cache-Control: no-cache, no-store, must-revalidate`
- [ ] Frontend container is NOT directly exposed on any host port in prod (traffic flows only via main Caddy)

### Caddy Proxy (Prod)
- [ ] Main `Caddyfile` at project root listens on `miner.mariowinter.com` (HTTPS auto-provisioned)
- [ ] `GET /api/*` is reverse-proxied to `web:8000` and returns Django responses
- [ ] `GET /admin/*` is reverse-proxied to `web:8000` and Django Admin loads with full CSS
- [ ] `GET /static/admin/css/base.css` returns HTTP 200 with content-type `text/css`
- [ ] `GET /media/*` serves uploaded files from the media volume
- [ ] `GET /` and all other paths are reverse-proxied to `frontend:80` and return the React SPA
- [ ] Main Caddy uses service name `web` (not container name `app_backend`) for backend DNS resolution

### CORS / Domain
- [ ] `miner.mariowinter.com` is added to `CORS_ALLOWED_ORIGINS` in `django-app/.env.template`
- [ ] `VITE_API_URL` is set to empty string in prod build args so axios uses relative paths

### Dev Workflow Unchanged
- [ ] `docker compose up --build` (dev, from root) still exposes frontend at `localhost:5173` with Vite HMR working
- [ ] Dev backend still accessible at `localhost:8000`
- [ ] Vite proxy still forwards `/api/*` and `/admin/*` to `web:8000` in dev

---

## Edge Cases

- **`merch_net` must exist** before prod stack starts (`docker network create merch_net`); if missing, Caddy/web containers fail to join the network — must be in deploy runbook
- **Caddy ACME on first boot**: port 443 must be externally reachable; if not, Caddy falls back to HTTP — acceptable during initial server setup but document as a prerequisite
- **Static files missing on fresh prod start**: if `collectstatic` hasn't run yet (e.g. first deploy), `/static/*` returns 404 — `backend.entrypoint.sh` already runs `collectstatic` before gunicorn, so this is handled as long as the entrypoint executes
- **`/app/node_modules` anonymous volume in dev**: must be declared to prevent the host bind-mount from shadowing the container's `node_modules`; already in base compose, must not be removed
- **Hot-reload (HMR) in dev**: `vite.config.ts` sets `hmr.clientPort: 5173` — this must match the exposed host port; do not change the port mapping
- **Frontend Caddyfile name collision**: `frontend-ui/Caddyfile` is a different file from the root `Caddyfile`; the frontend Dockerfile must `COPY Caddyfile /etc/caddy/Caddyfile` from the `frontend-ui/` build context

---

## Technical Requirements

- All compose files: Docker Compose v2 syntax (`services:` top-level, no `version:` field)
- Frontend serving image: `caddy:2-alpine`
- Main reverse proxy: `caddy:2-alpine`, ports 80 + 443 exposed in prod
- Backend: Gunicorn in prod (`--workers 3`), `runserver` in dev
- Static volume: mounted at `/app/static` in `web`, `/srv/static` in main Caddy
- Media volume: mounted at `/app/media` in `web`, `/srv/media` in main Caddy
- External network `merch_net` declared in `docker-compose.prod.yml` only (not base or override)
- No secrets in compose files; all credentials via `./django-app/.env`

---

## Files Changed

| Action | File |
|--------|------|
| CREATE | `merch-miner/docker-compose.yml` |
| CREATE | `merch-miner/docker-compose.override.yml` |
| CREATE | `merch-miner/docker-compose.prod.yml` |
| CREATE | `merch-miner/Caddyfile` |
| CREATE | `frontend-ui/Caddyfile` |
| MODIFY | `frontend-ui/Dockerfile` (swap alpine seed → caddy:2-alpine serving stage) |
| MODIFY | `django-app/.env.template` (add `miner.mariowinter.com` to `CORS_ALLOWED_ORIGINS`) |
| DELETE | `django-app/docker-compose.yml` |
| DELETE | `django-app/docker-compose.override.yml` |
| DELETE | `django-app/docker-compose.prod.yml` |
| DELETE | `django-app/Caddyfile` |
| MODIFY | `CLAUDE.md` (update compose commands to run from root) |

---

## Out of Scope
- CI/CD pipeline changes (PROJ-3)
- Staging environment
- Multiple Caddy instances (one main Caddy is sufficient for this domain)
- `backend.entrypoint.sh` changes (running `makemigrations` in prod is a known risk, addressed separately)

---

## Unresolved Questions
1. Does `merch_net` already exist on the prod host?
2. Should `acme_email` global option be set in the root Caddyfile for certificate provisioning?

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
