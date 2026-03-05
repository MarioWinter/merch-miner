# PROJ-3 Tasks — CI/CD & DevOps Setup

## Status: In Progress

---

## Workstream A — Docker Restructure

### Root Compose Files
- [ ] Create `docker-compose.yml` at root (base: db, redis, worker, web, frontend; updated build contexts `./django-app` + `./frontend-ui`)
- [ ] Create `docker-compose.override.yml` at root (dev: expose `127.0.0.1:8000:8000` + `127.0.0.1:5173:5173`)
- [ ] Create `docker-compose.prod.yml` at root (prod: gunicorn command, static/media volumes, frontend Caddy container, main Caddy service, `merch_net`)
- [ ] Delete `django-app/docker-compose.yml`
- [ ] Delete `django-app/docker-compose.override.yml`
- [ ] Delete `django-app/docker-compose.prod.yml`

### Frontend Serving Container
- [ ] Create `frontend-ui/Caddyfile` (`:80`, `root * /srv`, `try_files {path} /index.html`, `file_server`, asset cache headers)
- [ ] Update `frontend-ui/Dockerfile` — replace alpine seed stage with `caddy:2-alpine` stage (`COPY dist → /srv`, `COPY Caddyfile`)

### Main Caddy
- [ ] Create root `Caddyfile` (`miner.mariowinter.com`, `/static/*` + `/media/*` from volumes, `/api/*` + `/admin/*` → `web:8000`, `/*` → `frontend:80`)
- [ ] Delete `django-app/Caddyfile`

### Docs
- [ ] Update `CLAUDE.md` — backend compose commands: change `run from django-app/` to `run from merch-miner/`

---

## Workstream B — PROJ-1 Verification

- [ ] Run `docker compose exec web python manage.py migrate` — confirm allauth + sites migrations show `[X]`
- [ ] Add Google OAuth Client ID + Secret to `django-app/.env`
- [ ] Django Admin → Social Applications → create Google app linked to correct site
- [ ] Confirm `GET /api/auth/google/` → redirects to Google OAuth consent screen
- [ ] Run `docker compose exec web pytest` — all tests exit 0

---

## Workstream C — GitHub Actions CI/CD

- [ ] Create `.github/workflows/ci.yml` (trigger: push + PR to main; backend: pytest + migrate check + ruff; frontend: lint + test:ci + build)
- [ ] Create `.github/workflows/docker-publish.yml` (trigger: push to main; build `django-app/backend.Dockerfile`; push to GHCR with `latest` + SHA tags; GHA layer cache)
- [ ] Create `.github/workflows/deploy.yml` (trigger: after docker-publish success; SSH in; `docker compose pull && up -d --remove-orphans`; run migrate + collectstatic)
- [ ] Create `.github/workflows/security.yml` (trigger: weekly Mon 9am + PR to main; bandit on `django-app/`; npm audit on `frontend-ui/`; trivy on GHCR image — schedule only)
- [ ] Add 6 GitHub Secrets: `SECRET_KEY`, `DATABASE_URL`, `VITE_API_URL`, `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`

---

## Verification Checklist

### Docker Restructure — Dev (run from `merch-miner/`)
- [ ] `docker compose up --build` → all 5 services start, no errors
- [ ] `http://localhost:5173` → React app loads
- [ ] Edit `.tsx` file → Vite HMR fires
- [ ] `POST localhost:5173/api/auth/login/` → proxied to Django (no CORS error)
- [ ] `http://localhost:8000/admin/` → Django Admin with CSS

### Docker Restructure — Prod (run from `merch-miner/`)
- [ ] `docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d` → clean start
- [ ] `https://miner.mariowinter.com/` → React SPA
- [ ] `https://miner.mariowinter.com/admin/` → Django Admin with full CSS
- [ ] `GET /static/admin/css/base.css` → HTTP 200, `content-type: text/css`
- [ ] `https://miner.mariowinter.com/api/auth/login/` → JSON response
- [ ] Navigate directly to `/login` → React app (no 404)
- [ ] No `docker-compose*.yml` or `Caddyfile` remaining in `django-app/`

### CI/CD
- [ ] Push to feature branch → `ci.yml` runs and passes
- [ ] Merge to `main` → `docker-publish.yml` pushes image to GHCR
- [ ] GHCR push → `deploy.yml` SSHs in and deploys cleanly
- [ ] Manual trigger `security.yml` → bandit + npm audit + trivy complete without HIGH/CRITICAL
