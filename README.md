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
| Scraper | Scrapy 2.14 + ScraperOps SDK |
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
│       ├── components/         Global reusable components
│       ├── hooks/              Global custom hooks
│       ├── i18n/               i18next setup + language JSON files
│       ├── services/           axios API calls → Django backend
│       ├── store/              Redux slices + RTK Query
│       ├── style/              MUI theme + global styles
│       ├── types/              Global TypeScript interfaces
│       ├── utils/              Pure helper functions
│       └── views/              Feature views
├── django-app/                 Django DRF API
│   ├── core/                   settings, URLs, WSGI
│   ├── user_auth_app/          custom User model, JWT auth, OAuth2
│   ├── workspace_app/          Workspace + Membership
│   ├── niche_app/              Niche List
│   ├── scraper_app/            Amazon Product Scraper (Scrapy)
│   └── content/                Content management
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
# 1. Copy and fill credentials (minimum: SECRET_KEY, SCRAPEOPS_API_KEY)
cp .env.dev.template .env

# 2. Start the stack
docker compose up --build

# 3. Apply migrations + load fixtures
docker compose exec web python manage.py migrate
docker compose exec web python manage.py loaddata default_tiers

# 4. Create admin user
docker compose exec web python manage.py createsuperuser
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
# Fill: SECRET_KEY, DB_*, ALLOWED_HOSTS, CSRF/CORS origins, FRONTEND_* URLs,
#       EMAIL_*, GOOGLE_*, SCRAPEOPS_API_KEY

# 3. Init database (idempotent)
./scripts/init-db.sh

# 4. Deploy
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T web python manage.py migrate --no-input
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T web python manage.py loaddata default_tiers
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
docker compose exec web pytest scraper_app/ -v                    # scraper tests only
docker compose exec web coverage run -m pytest && \
  docker compose exec web coverage report                        # coverage
docker compose exec web python manage.py makemigrations          # generate migration files
docker compose exec web python manage.py migrate                 # apply migrations
docker compose exec web python manage.py createsuperuser
docker compose exec web python manage.py loaddata default_tiers  # load scraper tier config

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

Scrapy-based Amazon scraper with ScraperOps proxy, django-rq background jobs, Django Admin management. Scrapes Merch by Amazon product listings (T-Shirts, Hoodies, etc.) with BSR tracking.

### Admin Workflow

1. **Admin → Scrape jobs → Add Scrape Job**
2. Fill in: Keyword, Marketplace, Product type filter (T-Shirt/Hoodie/etc.), Pages total, Max items
3. Save → select job → Action: **"Start selected pending jobs"** → Go
4. Monitor: Status changes Pending → Running → Completed/Failed
5. View results: **Amazon products** shows scraped data

### Quick Test (Shell)

```bash
docker compose exec web bash -c 'cd /app && SCRAPY_SETTINGS_MODULE=scraper_app.scrapy_app.settings PYTHONPATH=/app scrapy crawl amazon_search_product -a keyword="school bus driver" -a marketplace=amazon_com -a max_pages=1 -a search_index=fashion-novelty -a seller_filter=ATVPDKIKX0DER -s CLOSESPIDER_ITEMCOUNT=5'
```

### Scheduler (for automatic re-scraping)

```bash
# Register hourly job (once)
docker compose exec web python manage.py setup_scheduler

# Start scheduler process (runs permanently)
docker compose exec worker python manage.py rqscheduler
```

### Admin Panel Sections

| Section | Description |
|---------|-------------|
| **Scrape jobs** | Monitor + control jobs. Actions: Start / Stop / Cancel / Retry |
| **Scrape tiers** | BSR ranges + re-scrape intervals (inline editable) |
| **Scheduled scrape targets** | Automatic re-scraping pool. CSV upload for bulk import |
| **Amazon products** | Browse scraped products. Search by ASIN, title, brand, bullets |
| **BSR snapshots** | BSR history per product |
| **Queue Health** | `/admin/scraper/queue-health/` — queue stats + Stop All |

### Job Status

| Status | Meaning |
|--------|---------|
| **Pending** | Created, waiting for "Start" action |
| **Running** | Scrapy subprocess active, PID tracked |
| **Completed** | Products saved to DB |
| **Failed** | Error or 0 products; check `error_log` for selector details |
| **Cancelled** | Stopped by admin/user; `cancelled_by` tracks source |

### CSV Upload

Admin → **Scheduled scrape targets** → Action: "Upload ASIN CSV" or "Upload Keyword CSV"

**ASIN CSV:** `asin,marketplace,tier` · **Keyword CSV:** `keyword,marketplace,tier` (tier optional)

### Scaling

```bash
# Activate second worker (paid ScraperOps plan)
docker compose --profile scale up -d worker-scraper
```

Set `SCRAPY_CONCURRENT_REQUESTS=10` in `.env` for parallel requests per spider.

---

## Feature Roadmap

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| PROJ-1 | User Auth (Email + Google OAuth2) | P0 | Deployed |
| PROJ-2 | Frontend Docker Integration | P0 | Deployed |
| PROJ-3 | CI/CD & DevOps Setup | P0 | Deployed |
| PROJ-4 | Workspace & Membership | P0 | Deployed |
| PROJ-5 | Niche List | P0 | Deployed |
| PROJ-6 | Niche Deep Research (LangGraph) | P0 | Planned |
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
