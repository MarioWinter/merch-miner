# Merch Miner

Business OS for Print on Demand sellers on Merch by Amazon — niche research → AI designs → published listings in one agentic workspace.

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
| Proxy | Caddy (prod) |
| Infra | Docker Compose |

---

## Project Structure

```
merch-miner/
├── .env.dev.template           dev-local env template (copy to .env)
├── .env.prod.template          server-prod env template (copy to .env)
├── docker-compose.yml          base services (redis, worker, web, frontend)
├── docker-compose.override.yml dev: local db + port bindings (auto-loaded)
├── docker-compose.prod.yml     prod: gunicorn + caddy
├── Caddyfile                   routing (miner.* → Django, merch-miner.* → SPA)
├── frontend-ui/                React + Vite SPA
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── assets/
│       ├── components/         Global reusable components (MUI wrappers, shared UI)
│       │   └── [compName]/
│       │       ├── hooks/
│       │       ├── types/
│       │       ├── partials/
│       │       ├── tests/
│       │       ├── utils/
│       │       └── schemas/
│       ├── hooks/              Global custom hooks
│       ├── i18n/               i18next setup + language JSON files
│       ├── services/           axios API calls → Django backend
│       ├── store/              Redux slices + RTK Query
│       ├── style/              MUI theme + global styles
│       ├── types/              Global TypeScript interfaces
│       ├── utils/              Pure helper functions
│       └── views/
│           └── [viewName]/
│               └── [sectionName]/
│                   ├── hooks/
│                   ├── types/
│                   ├── partials/
│                   ├── tests/
│                   ├── utils/
│                   └── schemas/
├── django-app/                 Django DRF API
│   ├── core/                   settings, URLs, WSGI
│   └── user_auth_app/          custom User model, JWT auth, OAuth2
├── scripts/
│   └── init-db.sh              idempotent Supabase DB setup
├── features/                   feature specs (PROJ-X-name.md)
└── docs/
    ├── PRD.md
    └── tasks/
```

---

## Dev Setup

```bash
# 1. Copy and fill credentials (minimum: SECRET_KEY)
cp .env.dev.template .env

# 2. Start the stack
docker compose up --build

# 3. Apply migrations (first time or after pulling new migration files)
docker compose exec web python manage.py migrate
```

Dev URLs: Django → `http://localhost:8000` · Vite → `http://localhost:5173` · Admin → `http://localhost:8000/admin/`

> **Cookie / Auth:** `VITE_API_URL` **must be empty** in `.env` for local dev. When empty, axios uses relative URLs through the Vite proxy — same origin → `HttpOnly` JWT cookies work. If set to `http://localhost:8000`, requests are cross-origin and browsers will not persist auth cookies.

---

## Prod Setup

```bash
# 1. Create external networks (once on server)
docker network create merch_net || true
docker network create supabase-net || true

# 2. Configure env
cp .env.prod.template .env
# Fill: SECRET_KEY, DB_*, ALLOWED_HOSTS, CSRF/CORS origins, FRONTEND_* URLs, EMAIL_*, GOOGLE_*, N8N/POLAR secrets

# 3. Init database (idempotent)
./scripts/init-db.sh

# 4. Deploy
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T web python manage.py migrate --no-input
```

**Prod routing (via Haupt-Caddy → app_caddy):**

| Domain | Target |
|--------|--------|
| `miner.mariowinter.com` | Django (API + Admin + static/media) |
| `merch-miner.mariowinter.com` | React SPA |

`VITE_API_URL` is baked into the GHCR frontend image at CI build time (GitHub Actions secret).

---

## Common Commands

**Backend** (from repo root):

```bash
docker compose exec web pytest                                    # all tests
docker compose exec web coverage run -m pytest && \
  docker compose exec web coverage report                        # coverage
docker compose exec web python manage.py makemigrations          # generate migration files
docker compose exec web python manage.py migrate                 # apply migrations
docker compose exec web python manage.py createsuperuser

# single test
docker compose exec web pytest path/to/test_file.py::TestClass::test_method
```

**Frontend** (from `frontend-ui/`):

```bash
npm run dev          # Dev server (localhost:5173)
npm run build        # tsc + vite build
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run test         # Vitest watch mode
npm run test:ci      # Vitest run --coverage --reporter=junit
npm run preview      # Preview production build
```

**Backend linting** (from repo root):

```bash
ruff check django-app/                                   # check only
ruff check --fix django-app/                             # safe auto-fixes
ruff check --fix --unsafe-fixes django-app/              # incl. unused variables (F841)
```

---

## Amazon Product Scraper (PROJ-16)

Scrapy-basierter Amazon-Scraper mit ScraperOps Proxy, django-rq Background Jobs und Django Admin Management.

### Setup

```bash
# 1. Stack bauen + starten
docker compose up --build

# 2. Migrationen + Fixture laden
docker compose exec web python manage.py migrate
docker compose exec web python manage.py loaddata default_tiers

# 3. Superuser (falls noch nicht vorhanden)
docker compose exec web python manage.py createsuperuser
```

Setze `SCRAPEOPS_API_KEY=dein-key` in `.env` und restarte den Worker: `docker compose restart worker`

### Scheduler aktivieren (optional — fuer Scheduled Scrapes)

```bash
# Einmalig: Hourly-Job registrieren
docker compose exec web python manage.py setup_scheduler

# Scheduler-Prozess starten (laeuft dauerhaft)
docker compose exec worker python manage.py rqscheduler
```

### Manuell testen (Django Shell)

```bash
docker compose exec web python manage.py shell
```

```python
from scraper_app.models import Keyword, ProductSearchCache, ScrapeJob
from scraper_app.tasks import scrape_keyword_job
import django_rq

# Keyword + Job + Cache anlegen
kw, _ = Keyword.objects.get_or_create(keyword='funny bus driver', marketplace='amazon_com')
job = ScrapeJob.objects.create(mode='live', keyword=kw, marketplace='amazon_com', status='pending')
cache = ProductSearchCache.objects.create(keyword=kw, status='pending', scrape_job=job)

# In Queue stellen
queue = django_rq.get_queue('default')
rq_job = queue.enqueue(scrape_keyword_job, keyword_str='funny bus driver', marketplace='amazon_com', job_id=str(job.id))
job.rq_job_id = rq_job.id
job.save()
```

Dann im Admin unter **Scrape jobs** den Fortschritt beobachten.

### Admin Panel Bereiche

Unter `http://localhost:8000/admin/` → **SCRAPER_APP**:

| Bereich | Beschreibung |
|---------|-------------|
| **Scrape jobs** | Alle Jobs ueberwachen. Actions: Stop / Cancel / Retry |
| **Scrape tiers** | BSR-Bereiche + Intervalle inline editieren |
| **Scheduled scrape targets** | ASIN/Keyword-Pool. CSV Upload via Actions |
| **Amazon products** | Gescrapte Produkte durchsuchen |
| **BSR snapshots** | BSR-Verlauf pro Produkt |
| **Keywords** | Suchbegriffe |
| **Queue Health** | `/admin/scraper/queue-health/` — Queue-Status + Stop All |

### CSV Upload (Scheduled Scrape Pool befuellen)

Admin → **Scheduled scrape targets** → Action-Dropdown → "Upload ASIN CSV" oder "Upload Keyword CSV"

**ASIN CSV:**
```csv
asin,marketplace,tier
B0GPQKHSDY,amazon_com,Tier 1
B0TEST12345,amazon_com,
```

**Keyword CSV:**
```csv
keyword,marketplace,tier
funny bus driver,amazon_com,
school bus driver,amazon_com,Tier 2
```

Tier-Spalte optional — wenn leer wird Tier 3 zugewiesen, beim ersten Scrape automatisch nach BSR korrigiert.

### Fehler analysieren

Admin → **Scrape jobs** → Klick auf failed Job → `error_log` zeigt:
```
SELECTOR_ERROR: bsr_list | URL: https://www.amazon.com/dp/B0XYZ... | Marketplace: amazon_com | Status: 200 | BSR selector returned empty after 3 attempts
```

### Zweiten Worker aktivieren (bei bezahltem ScraperOps Plan)

```bash
docker compose --profile scale up -d worker-scraper
```

### Scraper Tests

```bash
docker compose exec web pytest scraper_app/ -v
```

---

## Feature Roadmap

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| PROJ-1 | User Auth (Email + Google OAuth2) | P0 | Deployed |
| PROJ-2 | Frontend Docker Integration | P0 | Deployed |
| PROJ-3 | CI/CD & DevOps Setup | P0 | Deployed |
| PROJ-4 | Workspace & Membership | P0 | Deployed |
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
| PROJ-16 | Amazon Product Scraper (Scrapy) | P0 | In Progress |

Full specs in `features/`.
