# Merch Miner

Business OS for Print on Demand sellers on Merch by Amazon.
Compresses the full creative pipeline — niche research → AI designs → published listings — into one agentic workspace.

---

## What It Does

| Core Loop Step | Tool |
|---|---|
| Research niches | n8n + ScraperOps |
| Generate ideas & slogans | n8n + AI |
| Generate designs | OpenRouter (via django-rq) |
| Create listings & keywords | Django + LLM |
| Upload to Merch by Amazon | Selenium automation |

---

## Tech Stack

### Frontend (`frontend-ui/`)

| | |
|---|---|
| Framework | React 19 + Vite + TypeScript |
| UI | MUI v7 |
| State | Redux Toolkit + RTK Query |
| Routing | React Router DOM v7 |
| Forms | react-hook-form + Zod |
| HTTP | axios |
| i18n | i18next |
| Notifications | notistack |
| DnD | dnd-kit |
| Tests | Vitest + Testing Library |

### Backend (`django-app/`)

| | |
|---|---|
| Framework | Django 5.2 + DRF |
| Auth | django-allauth (email + Google OAuth2) |
| Database | PostgreSQL 16 (self-hosted Supabase) |
| Queue | Redis 7 + django-rq |
| Background tasks | FFmpeg (HLS transcoding), n8n webhooks |
| Proxy | Caddy (prod) |
| Infra | Docker Compose |

---

## Project Structure

```
merch-miner/
├── frontend-ui/          React + Vite SPA
├── django-app/           Django DRF API
│   ├── core/             settings, URLs, WSGI
│   ├── user_auth_app/    custom User model, JWT auth, OAuth2
│   ├── content/          video management, HLS streaming
│   ├── docker-compose.yml          base services (db, redis, worker, web, frontend)
│   ├── docker-compose.override.yml dev: host port bindings (auto-loaded, git-tracked)
│   ├── docker-compose.prod.yml     prod: gunicorn + caddy (no host ports on web)
│   ├── Caddyfile                 static/media serving + reverse proxy
│   ├── backend.Dockerfile
│   ├── backend.entrypoint.sh     DB wait → migrate → superuser → exec
│   └── worker.entrypoint.sh      DB wait → exec
├── features/             feature specs (PROJ-X-name.md)
├── docs/
│   ├── PRD.md
│   └── tasks/
└── CLAUDE.md             AI workflow instructions
```

---

## Setup

### 1. Environment

```bash
cp django-app/env/.env.template django-app/.env
# fill in DB_NAME, DB_USER, DB_PASSWORD, SECRET_KEY, etc.
```

### 2. Frontend

```bash
cd frontend-ui
npm install
npm run dev       # http://localhost:5173
```

---

## Backend — Docker Commands

> All commands run from `django-app/`

### Dev

```bash
docker compose up --build
```

- Auto-loads `docker-compose.override.yml` → exposes ports 8000 + 5173 on host
- Django `runserver` on `http://localhost:8000`
- Vite dev server on `http://localhost:5173`
- Code changes hot-reload via volume mount
- Admin: `http://localhost:8000/admin/`

### Prod

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

- Explicit `-f` flags skip `override.yml` → no host port binding on `web`
- gunicorn on port 8000 (internal only)
- Caddy on ports 80/443 (public)
- Static files served by Caddy from `/srv/static/`

### Stop

```bash
# Dev
docker compose down

# Prod
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
```

---

## Common Backend Tasks

```bash
# Run all tests
docker compose exec web pytest

# Test coverage
docker compose exec web coverage run -m pytest && \
  docker compose exec web coverage report

# Create migrations (after adding/changing models)
docker compose exec web python manage.py makemigrations

# Apply migrations manually
docker compose exec web python manage.py migrate

# Create superuser manually
docker compose exec web python manage.py createsuperuser

# Single test
docker compose exec web pytest path/to/test_file.py::TestClass::test_method
```

> **Note:** `makemigrations` is NOT in the entrypoint. Run it manually when you change models.
> `migrate` runs automatically on every container start.

---

## Frontend Commands

```bash
cd frontend-ui

npm run dev        # Dev server (localhost:5173)
npm run build      # tsc + vite build
npm run lint       # ESLint
npm run test       # Vitest watch mode
npm run test:ci    # Vitest run --coverage --reporter=junit
npm run preview    # Preview production build
```

---

## Feature Roadmap

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| PROJ-1 | User Auth (Email + Google OAuth2) | P0 | In Progress |
| PROJ-2 | Frontend Docker Integration | P0 | In Progress |
| PROJ-3 | CI/CD & DevOps Setup | P0 | Planned |
| PROJ-4 | Workspace & Membership | P0 | Planned |
| PROJ-5 | Niche List | P0 | Planned |
| PROJ-6 | Niche Deep Research (n8n) | P0 | Planned |
| PROJ-7 | Amazon Product Research | P0 | Planned |
| PROJ-8 | Idea & Slogan Generation (n8n) | P0 | Planned |
| PROJ-9 | Design Generation (OpenRouter) | P0 | Planned |
| PROJ-10 | Niche Keyword Bank | P1 | Planned |
| PROJ-11 | Listing & Keyword Generator | P0 | Planned |
| PROJ-12 | Dashboard | P1 | Planned |
| PROJ-13 | Marketplace Upload Manager (Selenium) | P1 | Planned |
| PROJ-14 | Team Kanban | P1 | Planned |
| PROJ-15 | Analytics & Reporting | P2 | Planned |
| PROJ-16 | Amazon Product Scraper (Scrapy) | P2 | Planned |

Full specs in `features/`.

---

## Development Workflow

```
/requirements  →  feature spec (features/PROJ-X-name.md)
/architecture  →  tech design added to spec
/frontend      →  UI components
/backend       →  API + database
/qa            →  tests + security audit
/deploy        →  production-ready checks
```

All workflow phases require explicit user approval before proceeding.

---

## Key Constraints

- Workspace isolation enforced at ORM level on every protected endpoint
- n8n + Django share the same Supabase PostgreSQL instance
- `makemigrations` is manual — never runs automatically in the entrypoint
- OpenRouter API key must be rotated before PROJ-9 (currently hardcoded in n8n workflow JSON)
- `worker` service handles all background jobs via django-rq
