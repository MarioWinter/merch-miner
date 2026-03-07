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
| Background tasks | n8n webhooks, design generation (django-rq) |
| Proxy | Caddy (prod) |
| Infra | Docker Compose |

---

## Project Structure

```
merch-miner/
├── .env.template               single source of truth for all env vars
├── docker-compose.yml          base services (redis, worker, web, frontend)
├── docker-compose.override.yml dev: local db + port bindings (auto-loaded, git-tracked)
├── docker-compose.prod.yml     prod: gunicorn + caddy
├── Caddyfile                   app_caddy routing (miner.* → Django, merch-miner.* → SPA)
├── frontend-ui/          React + Vite SPA
│   └── Caddyfile         SPA static serving (prod frontend container, port 80)
├── django-app/           Django DRF API
│   ├── core/             settings, URLs, WSGI
│   ├── user_auth_app/    custom User model, JWT auth, OAuth2
│   ├── content/          legacy models (not in MVP)
│   ├── backend.Dockerfile
│   ├── backend.entrypoint.sh     DB wait → collectstatic → migrate → exec
│   └── worker.entrypoint.sh      DB wait → exec
├── scripts/
│   └── init-db.sh        idempotent Supabase DB setup
├── features/             feature specs (PROJ-X-name.md)
├── docs/
│   ├── PRD.md
│   ├── supabase-db-setup.md
│   └── tasks/
└── CLAUDE.md             AI workflow instructions
```

---

## Setup

### First Time (Dev)

No external Supabase or `supabase-net` needed — the override file spins up a local postgres container.

```bash
# 1. Copy and fill in credentials
cp .env.template .env
# Minimum required: SECRET_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, EMAIL_*
# DB_* vars are overridden by docker-compose.override.yml for local dev — no Supabase needed

# 2. Start the stack (creates local db + supabase-net automatically)
docker compose up --build

# 3. First-time migrations (only needed once, or after pulling new migration files)
docker compose exec web python manage.py migrate
```

> **Prod / server setup:** see the Prod section below. Prod connects to Supabase via `supabase-net` (external network from `localai` stack).

### Frontend (standalone)

```bash
cd frontend-ui
npm install
npm run dev       # http://localhost:5173
```

> **Cookie / Auth gotcha:** `VITE_API_URL` **must be empty** in `.env` for local dev.
> When empty, axios uses relative URLs (`/api/...`) which go through the Vite proxy
> on the same origin → `HttpOnly` JWT cookies work correctly.
> If set to `http://localhost:8000`, requests are cross-origin and browsers will not
> persist the auth cookies → users are logged out on every page reload.
> In prod, set it to the public domain (e.g. `https://miner.example.com`) — same-origin
> via Caddy, so cookies work there too.
>
> ```dotenv
> # .env — local dev
> VITE_API_URL=        # leave empty
>
> # .env — production
> VITE_API_URL=https://miner.mariowinter.com
> ```

---

## Backend — Docker Commands

> All commands run from repo root (`merch-miner/`)

### Dev

```bash
docker compose up --build
```

- Auto-loads `docker-compose.override.yml`:
  - Creates local `supabase-net` network (no external dependency)
  - Starts `db` (postgres:16) as local DB stand-in
  - Overrides `DB_HOST/DB_NAME/DB_USER/DB_PASSWORD` on `web` + `worker` → point to local `db`
  - Exposes ports 8000 + 5173 on host
- Django `runserver` → `http://localhost:8000`
- Vite dev server → `http://localhost:5173`
- Admin → `http://localhost:8000/admin/`

### Prod

```bash
# Once on server — create external networks
docker network create merch_net

# Pull, configure, deploy
git pull
cp .env.template .env
# Fill .env: DEBUG=False, ALLOWED_HOSTS, CORS, FRONTEND_URL, VITE_API_URL, DB_PASSWORD, SECRET_KEY, ...

./scripts/init-db.sh

docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

**Prod routing (via Haupt-Caddy → app_caddy):**

| Domain | Target |
|--------|--------|
| `miner.mariowinter.com` | Django (API + Admin + static/media) |
| `merch-miner.mariowinter.com` | React SPA |

- No host port bindings on `web` — gunicorn on :8000 (internal only)
- TLS handled by Haupt-Caddy (`localai` stack); `app_caddy` listens on :80 only
- `VITE_API_URL` baked into frontend bundle at build time (from root `.env`)

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

> **Note:** `migrate` runs automatically on every container start. Run `makemigrations` manually to generate migration files before committing.

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
| PROJ-1 | User Auth (Email + Google OAuth2) | P0 | Deployed |
| PROJ-2 | Frontend Docker Integration | P0 | Deployed |
| PROJ-3 | CI/CD & DevOps Setup | P0 | Deployed |
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

- **Env:** single `/.env` (from `/.env.template`) — no sub-directory env files
- **`VITE_API_URL` must be empty in dev** — Vite proxy handles routing to backend; if set to `http://localhost:8000`, cross-origin cookie storage breaks auth (see Setup section above)
- **Database (dev):** local `db` (postgres:16) container, schema `public` — no Supabase or external network required; `supabase-net` created locally by override
- **Database (prod):** Django connects to Supabase PostgreSQL (`localai` stack) via `supabase-net` (external), schema `merch_miner`
- n8n + Django share same Supabase instance (prod only — n8n: `public` schema, Django: `merch_miner` schema)
- Workspace isolation enforced at ORM level on every protected endpoint
- `migrate` auto-runs in entrypoint; run `makemigrations` manually only to generate files for commit
- OpenRouter API key must be rotated before PROJ-9 (currently hardcoded in n8n workflow JSON)
- `worker` service handles all background jobs via django-rq
