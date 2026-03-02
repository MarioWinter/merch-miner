# PROJ-2 Tasks — Frontend Docker Integration

## Status: In Progress

## Tasks

- [x] Create `frontend-ui/Dockerfile` (prod multi-stage)
- [x] Create `frontend-ui/Dockerfile.dev` (dev HMR)
- [x] Move web + frontend services to `docker-compose.yml` (base); delete `docker-compose.dev.yml`
- [x] Add `frontend` service + `frontend_dist` volume to `docker-compose.prod.yml`
- [x] Update `Caddyfile` — SPA routing + explicit `/api/*` and `/admin/*` proxy blocks
- [x] Add `server.proxy` to `vite.config.ts`
- [x] Smoke test dev stack: `docker compose up --build`
- [x] Smoke test prod stack: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d`
- [x] Fix prod port conflict: move host port bindings to `docker-compose.override.yml` (auto-loaded dev only)

## Verification Checklist

### Dev
- [x] `http://localhost:5173` → React app
- [x] Edit `.tsx` → hot reload fires
- [x] POST `/api/auth/login/` → proxied to Django (no CORS error)

### Prod
- [x] `app_frontend_build` container exits 0 (dist seeded)
- [x] `http://localhost/` → React app via Caddy
- [x] `http://localhost/api/...` → Django JSON
- [x] `http://localhost/admin/` → Django admin
- [x] Deep SPA route (e.g. `/login`) → returns `index.html`
- [x] API 404 returns JSON, not `index.html`
