# PROJ-3 Tasks — CI/CD & DevOps Setup

## Status: Deployed

---

## Workstream A — Docker Restructure ✅ COMPLETE

### Root Compose Files
- [x] `docker-compose.yml` at root (base: redis, worker, web, frontend; no local db)
- [x] `docker-compose.override.yml` at root (dev: expose `127.0.0.1:8000:8000` + `127.0.0.1:5173:5173`)
- [x] `docker-compose.prod.yml` at root (prod: gunicorn, static/media volumes, frontend Caddy, main Caddy, `merch_net`)
- [x] Old `django-app/docker-compose*.yml` deleted

### Frontend Serving Container
- [x] `frontend-ui/Caddyfile` (`:80`, `root * /srv`, SPA fallback, asset cache headers)
- [x] `frontend-ui/Dockerfile` — multi-stage: dev / build / prod (`caddy:2-alpine`)

### Main Caddy
- [x] Root `Caddyfile` — 2-domain: `miner.mariowinter.com:80` (API+static/media) + `merch-miner.mariowinter.com:80` (SPA)
- [x] `django-app/Caddyfile` deleted

### Docs
- [x] `CLAUDE.md` updated — compose commands run from `merch-miner/` root

---

## Workstream B — PROJ-1 Verification

- [x] Run `docker compose exec web python manage.py migrate` — confirm allauth + sites migrations show `[X]`
- [x] Add Google OAuth Client ID + Secret to `django-app/.env`
- [x] Django Admin → Social Applications → create Google app linked to correct site
- [x] Confirm `GET /api/auth/google/` → redirects to Google OAuth consent screen
- [x] Run `docker compose exec web pytest` — all tests exit 0

---

## Workstream C — GitHub Actions CI/CD

### Workflow Fixes (code changes)
- [x] Fix `ci.yml` — rewrite backend job: native Python 3.12 + GHA postgres service (removes `supabase-net` dependency, adds `ruff` install)
- [x] Fix `deploy.yml` — correct path (`/home/dev/merch-miner`) + prod compose flags (`-f docker-compose.yml -f docker-compose.prod.yml up -d`) + GHCR login step
- [x] BUG-1 fixed — `.env.template` `BACKEND_IMAGE` now uses correct `ghcr.io/mariowinter/merch-miner/backend:latest`
- [x] BUG-3 fixed — `worker` service `env_file` present in `docker-compose.prod.yml` (Docker Compose v2 merges list fields from base)
- [x] BUG-4 fixed — `backend.entrypoint.sh` runs only `migrate`, not `makemigrations`
- [x] BUG-8 fixed — `DJANGO_SUPERUSER_PASSWORD` commented out in `.env.template`; entrypoint skips superuser creation when unset

### Manual Setup Required
- [x] Add 7 GitHub Secrets to repo Settings → Secrets → Actions:
  - `SECRET_KEY` — Django secret key (for CI backend tests)
  - `VITE_API_URL` — `https://miner.mariowinter.com` (for CI frontend build)
  - `SERVER_HOST` — prod server IP or hostname
  - `SERVER_USER` — SSH username on prod server
  - `SERVER_SSH_KEY` — SSH private key (corresponding public key must be in `~/.ssh/authorized_keys` on server)
  - `GHCR_TOKEN` — GitHub personal access token with `read:packages` scope (for server-side `docker login`)
  - `GHCR_USER` — GitHub username for GHCR login on prod server

### Verification
- [x] Push to feature branch → `ci.yml` runs; both backend + frontend jobs pass
- [x] Merge to `main` → `docker-publish.yml` pushes backend image to GHCR
- [x] GHCR push → `deploy.yml` SSHs to `/home/dev/merch-miner` and deploys cleanly
- [x] `https://miner.mariowinter.com/api/` → Django API responds
- [x] `https://merch-miner.mariowinter.com/` → React SPA loads

---

## Verification Checklist

### Docker Restructure — Dev (run from `merch-miner/`)
- [x] `docker compose up --build` → all 5 services start, no errors
- [x] `http://localhost:5173` → React app loads
- [x] Edit `.tsx` file → Vite HMR fires
- [x] `POST localhost:5173/api/auth/login/` → proxied to Django (no CORS error)
- [x] `http://localhost:8000/admin/` → Django Admin with CSS

### Docker Restructure — Prod (run from `merch-miner/`)
- [x] `docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d` → clean start
- [x] `https://miner.mariowinter.com/` → React SPA
- [x] `https://miner.mariowinter.com/admin/` → Django Admin with full CSS
- [x] `GET /static/admin/css/base.css` → HTTP 200, `content-type: text/css`
- [x] `https://miner.mariowinter.com/api/auth/login/` → JSON response
- [x] Navigate directly to `/login` → React app (no 404)
- [x] No `docker-compose*.yml` or `Caddyfile` remaining in `django-app/`

### CI/CD
- [x] Push to feature branch → `ci.yml` runs and passes
- [x] Merge to `main` → `docker-publish.yml` pushes image to GHCR
- [x] GHCR push → `deploy.yml` SSHs in and deploys cleanly
- [x] Manual trigger `security.yml` → bandit + npm audit + trivy complete without HIGH/CRITICAL
