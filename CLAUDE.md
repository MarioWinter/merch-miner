# AI Coding Kit

## Workflow Rules
- After each skill (/requirements, /architecture, /frontend-design), 
  STOP and wait for explicit approval before proceeding.
- Never start implementation unless I explicitly say "implement" or "start coding".
- Task files always go to docs/tasks/PROJ-[N]-tasks.md before any code is written.

> In all interactions and commit messages, be extremely concise. Sacrifice grammar for concision.
> A React Typescript Vite and Django DRF template with an AI-powered development workflow using specialized skills for Requirements, Architecture, Frontend, Backend, QA, and Deployment.


## What This Repo Is

AI-powered development workflow template with two independently runnable projects:
- `frontend-ui/` — React 19 + Vite + TypeScript SPA
- `django-app/` — Django 5.2 + DRF REST API

## Tech Stack

### Frontend
- React 19, Vite, TypeScript
- **UI** MUI v7 — primary UI library
- **State** Redux Toolkit + React Redux
- **Routing** React Router DOM v7
- **Forms** react-hook-form + Zod
- **HTTP** axios
- **i18n** i18next + react-i18next
- **Notifications** notistack
- **DnD** dnd-kit
- **Tests** Vitest + Testing Library

### Backend
- Django 5.2 + DRF
- **Auth** django-allauth — email + Google OAuth2
- **Database** PostgreSQL 16 (self-hosted Supabase, shared with n8n)
- **AI / Agents** n8n (self-hosted, niche research + slogan gen) · OpenRouter (design gen)
- **Queue** Redis 7 + django-rq
- **Payment** Polar.sh — subscriptions (post-MVP)
- **Proxy** Caddy (reverse proxy + HTTPS)
- **Infra** Docker Compose — `web` · `db` · `redis` · `worker` · `caddy`



## Commands

**Frontend** (run from `frontend-ui/`):
```bash
npm run dev          # Dev server (localhost:5173)
npm run build        # tsc + vite build
npm run lint         # ESLint
npm run test         # Vitest watch mode
npm run test:ci      # Vitest run --coverage --reporter=junit
npm run preview      # Preview production build
```

**Backend** (Docker required; run from `merch-miner/` root):
```bash
# Prerequisite: supabase-net external network must exist (created by localai stack)
# If missing: docker network create supabase-net

# Dev — auto-loads docker-compose.override.yml (exposes ports 8000 + 5173)
docker compose up --build       # Start all services (web, db, redis, frontend)
docker compose up               # Start without rebuild

# Prod — explicit -f flags skip override.yml (no host port binding on web)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

docker compose exec web pytest  # Run all tests
docker compose exec web coverage run -m pytest && docker compose exec web coverage report
docker compose exec web python manage.py migrate
docker compose exec web python manage.py createsuperuser
```

Single test: `docker compose exec web pytest path/to/test_file.py::TestClass::test_method`

## Architecture

### Frontend Structure (`frontend-ui/src/`)
```
App.tsx
main.tsx
assets/           Static assets
components/       Global reusable components (MUI wrappers, shared UI)
hooks/            Global custom hooks
i18n/             i18next setup + language JSON files
services/         axios API calls → Django backend
store/            Redux slices + RTK Query
style/            MUI theme + global styles
types/            Global TypeScript interfaces
utils/            Pure helper functions
views/
  └── [viewName]/
      └── [sectionName]/
          ├── hooks/      # useForm submit hooks
          ├── types/      # Section-scoped types
          ├── partials/   # Section-specific components
          ├── tests/      # Vitest + RTL tests
          ├── utils/      # Section-scoped helpers
          └── schemas/    # Zod schemas (form source of truth)
```

Placement rules: global reuse → top-level dirs; feature-local code stays inside `views/[view]/[section]/`.

### Backend Structure (`django-app/`)
- **`core/`** — settings, root URLs, WSGI/ASGI
- **`user_auth_app/`** — custom User model, JWT auth, email-based activation, password reset
  - `api/authentication.py` — `CookieJWTAuthentication` (reads JWT from HttpOnly cookie)
  - `api/views.py` — register, login, logout, token refresh, password reset

### Background Jobs
django-rq processes async tasks (n8n triggers, design generation). Redis serves as both cache and job broker. Queue config in `settings.py → RQ_QUEUES`.

## Key Conventions

- **Feature IDs:** PROJ-1, PROJ-2, etc. (sequential)
- **Commits:** `feat(PROJ-X): description`, `fix(PROJ-X): description`
- **MUI first:** Check MUI before building any UI component
- **Single Responsibility:** One feature per spec file
- **Env vars:** Copy `django-app/.env.template` → `django-app/.env` before running Docker
- **Human-in-the-loop:** All workflows have user approval checkpoints

## Development Workflow (Skills)

1. `/requirements` — Create feature spec from idea
2. `/architecture` — Design tech architecture (PM-friendly, no code)
3. `/frontend` — Build UI components with MUI v7
4. `/backend` — Django API + database, RLS policies
5. `/qa` — Test against acceptance criteria + security audit
6. `/deploy` — production-ready checks

Feature tracking: `features/INDEX.md`. Specs: `features/PROJ-X-name.md`.

## Product Context

@docs/PRD.md

## Feature Overview

@features/INDEX.md

- At the end of each plan, give me a list of unresolved questions to answer, if any. 
  Make the questions extremely concise. Sacrifice grammar for the sake of concision.