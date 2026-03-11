# Merch Miner Backend

Django DRF API for the Merch Miner POD Business OS.

## Tech Stack

| | |
|---|---|
| Framework | Django 5.2 + DRF |
| Auth | django-allauth (email + Google OAuth2) |
| Database | PostgreSQL 16 (self-hosted Supabase) |
| Queue | Redis 7 + django-rq |
| Proxy | Caddy (prod) |
| Infra | Docker Compose |

## Prerequisites

- Docker Desktop
- Git

## Setup

```bash
# from repo root
cp .env.dev.template .env
# fill in SECRET_KEY (+ OAuth/Email vars if used)
```

Prod server setup uses:

```bash
# from repo root
cp .env.prod.template .env
# fill in SECRET_KEY, DB_PASSWORD, ALLOWED_HOSTS, CSRF/CORS, FRONTEND_* URLs, EMAIL_*, GOOGLE_*, N8N/POLAR secrets
```

## Dev

```bash
docker compose up --build
```

- Auto-loads `docker-compose.override.yml` → exposes ports 8000 + 5173 on host
- Django `runserver` on `http://localhost:8000`
- Vite dev server on `http://localhost:5173`
- Admin: `http://localhost:8000/admin/`

## Prod

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans
```

- Explicit `-f` flags skip `override.yml` → no host port binding on `web`
- gunicorn on port 8000 (internal only)
- Caddy on ports 80/443 (public)

## Stop

```bash
# Dev
docker compose down

# Prod
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
```

## Common Tasks

```bash
# Run all tests
docker compose exec web pytest

# Test coverage
docker compose exec web coverage run -m pytest && \
  docker compose exec web coverage report

# Create migrations (after changing models)
docker compose exec web python manage.py makemigrations

# Apply migrations manually
docker compose exec web python manage.py migrate

# Create superuser
docker compose exec web python manage.py createsuperuser

# Single test
docker compose exec web pytest path/to/test_file.py::TestClass::test_method
```

> `makemigrations` is NOT in the entrypoint — run it manually when you change models.
> `migrate` runs automatically on every container start.

## API Endpoints

### Auth

- `POST /api/auth/register/` — register
- `GET /api/auth/activate/<uidb64>/<token>/` — email activation
- `POST /api/auth/login/` — login (sets HttpOnly JWT cookie)
- `POST /api/auth/logout/` — logout
- `POST /api/auth/token/refresh/` — refresh JWT
- `POST /api/auth/password_reset/` — request password reset
- `POST /api/auth/password_confirm/<uidb64>/<token>/` — confirm password reset

