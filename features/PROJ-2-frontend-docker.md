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
