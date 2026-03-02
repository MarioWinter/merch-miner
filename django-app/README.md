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
cp env/.env.template .env
# fill in DB_NAME, DB_USER, DB_PASSWORD, SECRET_KEY, GOOGLE_CLIENT_ID, etc.
```

## Dev

```bash
docker compose up --build
```

- Django `runserver` on `http://localhost:8000`
- Vite dev server on `http://localhost:5173`
- Admin: `http://localhost:8000/admin/`

## Prod

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build
```

- gunicorn on port 8000 (internal)
- Caddy on ports 80/443 (public)

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

### Video Streaming

- `GET /api/video/` — list videos
- `GET /api/video/<id>/<resolution>/index.m3u8` — HLS manifest
- `GET /api/video/<id>/<resolution>/<segment>/` — video segment
