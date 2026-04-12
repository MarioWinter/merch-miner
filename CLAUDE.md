# AI Coding Kit

## Workflow Rules
- Run each skill step manually. Always ask before proceeding to the next step. Additionally, ask when:
  - **Scope ambiguity** — spec has contradictions or missing info that can't be inferred
  - **Architecture trade-offs** — multiple valid approaches, need user preference (present as A/B/C)
  - **Breaking changes** — modifying deployed features, changing model schemas with data
  - **Cost decisions** — choosing paid APIs, adding new services
- Task files always go to docs/tasks/PROJ-[N]-tasks.md before any code is written.
- When done with a skill step, briefly summarize what was done and move to the next step.

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

## PROJ-9 Design Editor — Pipeline Tools (15 Tools) + Export Compression

### Standard (9 tools)
| Tool | Purpose |
|------|---------|
| **Resize & Reposition** | Scale to target (e.g. 4500×5400 MBA). Align within canvas, padding, aspect ratio, background fill |
| **Trim** | Auto-crop transparent/empty borders. Modes: Transparent (alpha) or Auto-Detect (dominant edge color). Threshold + padding |
| **Rotate** | 0°/90°/180°/270° rotation + horizontal/vertical flip |
| **Filters** | Brightness, contrast, saturation, hue shift sliders |
| **Distress** | Vintage look — grain, scratches, edge wear effects |
| **Color Removal** | Remove color → transparent. Auto-detect BG color (8 edge samples). Contiguous mode (flood-fill from edges). Edge Trim (dilate, 0-10px) + Edge Feather (blur, 0-10px) |
| **Speckle Remover** | Remove isolated pixel groups below minSize threshold (connected component labeling) |
| **Transp. Cleaner** | Clean semi-transparent pixels. DELETE mode = force alpha→0 below threshold. VIEW mode = highlight with color overlay (merged Transparency Highlighter) |
| **Watermark** | Text overlay with position, rotation, size, opacity, tiling |

### Edge Cleanup (4 tools)
| Tool | Purpose |
|------|---------|
| **Defringe** | Remove color halos at design edges after BG removal. Auto-detect + manual shrink |
| **Shrink** | Morphological erosion — eat N pixels from visible design edges |
| **Color Defringe** | Replace BG-colored edge pixels with nearest design color (subtler than Shrink) |
| **Edge Cleaner** | Multi-pass anti-aliasing on design edges — smooth jagged/pixelated outlines |

### AI Processing (2 tools — server-side)
| Tool | Purpose |
|------|---------|
| **BG Remove** | rembg (u2net) server-side background removal. Better than Color Removal for complex backgrounds |
| **AI Upscale** | Increase resolution. Client: Pica.js (Lanczos) for ≥3000px. External API for smaller |

### Export Compression (at download time — NOT a pipeline tool)
| Control | Detail |
|---------|--------|
| **Compression Dropdown** | Off / Low / Medium / High / Very High — UPNG.js PNG quantization (32bit→8bit) in browser |
| **"Preparing Download" Modal** | Spinner + compression badge + progress bar + cancel button (shown during compression/ZIP) |

### Typical POD Pipeline Order
Color Removal → Speckle Remover → Transp. Cleaner → Defringe/Shrink → Trim → Resize & Reposition → **Download with Compression**

## Architecture

### Frontend Structure (`frontend-ui/src/`)
```
App.tsx
main.tsx
assets/           Static assets
components/       Global reusable components (MUI wrappers, shared UI)
  └── [compName]/
      └-index
      ├── hooks/      # useForm submit hooks
      ├── types/      # Section-scoped types
      ├── partials/   # Section-specific components
      ├── tests/      # Vitest + RTL tests
      ├── utils/      # Section-scoped helpers
      └── schemas/    # Zod schemas (form source of truth)
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
- **MUI v7 only:** Use components from `@mui/material` and icons from `@mui/icons-material`; avoid custom re-implementations for standard controls.
- **No deprecated APIs:** Never use `GridLegacy`/`Grid2`, `Hidden`, `InputProps`, `@mui/lab` imports, or `createMuiTheme`; use v7 patterns (`Grid size={{...}}`, `slotProps`, `sx` breakpoints).
- **Single Responsibility:** One feature per spec file
- **Env vars:** Copy `django-app/.env.template` → `django-app/.env` before running Docker
- **Human-in-the-loop:** All workflows have user approval checkpoints
- **Reuse first:** Before creating new API endpoints, components, or utilities — check what already exists. Extend existing code over building new. Promote feature-local code to global when reusable.
- **No hardcoded colors:** All colors via design system tokens (`theme.vars.palette.*`). New colors → `docs/design-system.md` + MUI theme first.

## Development Workflow (Skills) — MANDATORY

**ALWAYS invoke skills via the `Skill` tool. NEVER manually replicate a skill's workflow.**
Skills have checklists and formatting rules that manual work does not guarantee.

### Workflow per Feature (in order)

| Step | Skill | When | Output |
|------|-------|------|--------|
| 1. Write/review spec | `/requirements` | New feature idea, spec review, fix ACs | `features/PROJ-X-name.md` |
| 2. Tech Design + Tasks | `/architecture` | After approved spec | Tech Design in spec + `docs/tasks/PROJ-X-tasks.md` |
| 3. UI Design | `/frontend-design` | When layout/design decisions needed | Design decisions |
| 4. Build frontend | `/frontend` | After approved architecture | Code in `frontend-ui/src/` |
| 5. Build backend | `/backend` | After frontend or in parallel | Code in `django-app/` |
| 6. QA + Security Audit | `/qa` | After implementation complete | QA Report in spec, bugs fixed |
| 7. Deploy | `/deploy` | After QA passed | Production-ready checks |

### Rules
- **Two skills minimum per feature:** `/requirements` → `/architecture`
- **Spec review = `/requirements`**, task files = `/architecture`
- **"Next PROJ-X"** = first `/requirements` (spec ok?), then `/architecture` (tasks)
- **Run manual** — execute each skill step, then stop and ask before proceeding to the next step
- **Never code without tasks** — task file must exist before implementation begins
- **Brief summary after each step** — state what was done, then continue to next skill

Feature tracking: `features/INDEX.md`. Specs: `features/PROJ-X-name.md`. Tasks: `docs/tasks/PROJ-X-tasks.md`.

## Product Context

@docs/PRD.md

## Feature Overview

@features/INDEX.md

- At the end of each plan, give me a list of unresolved questions to answer, if any. 
  Make the questions extremely concise. Sacrifice grammar for the sake of concision.