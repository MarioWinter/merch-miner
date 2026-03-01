# PROJ-3: CI/CD & DevOps Setup

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-1 (User Auth) — must be fully implemented before CI runs green

## Overview
Two scoped goals:
1. **PROJ-1 verification** — run pending migrations + configure Google OAuth so PROJ-1 acceptance criteria can be confirmed
2. **CI/CD pipeline** — automated build/test/publish/deploy via GitHub Actions so every future feature ships with confidence

---

## User Stories

### Pre-test (PROJ-1 verification)
- As a developer, I want migrations to include allauth + sites tables so the Google OAuth flow works end-to-end
- As a developer, I want Google OAuth credentials wired into the local env so I can test the "Continue with Google" button
- As a developer, I want all existing pytest tests to pass after the URL migration so I know nothing is broken

### CI/CD
- As a developer, I want every push to trigger automated backend + frontend tests so broken code can't reach main
- As a developer, I want merging to main to automatically build and publish a Docker image to GHCR so deployment is reproducible
- As a developer, I want a successful publish to auto-deploy to the production server so releases require zero manual steps
- As a developer, I want weekly security scans (SAST, npm audit, container scan) so vulnerabilities surface early

---

## Acceptance Criteria

### PROJ-1 Verification
- [ ] `docker compose exec web python manage.py migrate` exits 0; all allauth + sites migrations show `[X]`
- [ ] Google OAuth credentials (Client ID + Secret) are present in `django-app/.env`
- [ ] Django admin → Social Applications has a Google app linked to the correct site
- [ ] `http://localhost:8000/api/auth/google/` redirects to Google's OAuth consent screen
- [ ] `docker compose exec web pytest` exits 0 (no regressions)
- [ ] `npm run dev` serves login page at `localhost:5173` without console errors

### CI — `ci.yml`
- [ ] Runs on every push and pull request to `main`
- [ ] Backend job: `pytest` + `python manage.py migrate --check` + `ruff check`
- [ ] Frontend job: `npm run lint` + `npm run test:ci` + `npm run build`
- [ ] All jobs must pass before PR can merge

### Docker Publish — `docker-publish.yml`
- [ ] Triggers on merge to `main` (push event)
- [ ] Builds backend image from `django-app/backend.Dockerfile`
- [ ] Pushes to GHCR: `ghcr.io/<owner>/<repo>/backend:latest` + SHA tag
- [ ] Uses GHA layer cache for fast rebuilds

### Auto-deploy — `deploy.yml`
- [ ] Triggers after `docker-publish.yml` succeeds on `main`
- [ ] SSH into production server, runs `docker compose pull && docker compose up -d --remove-orphans`
- [ ] Runs `manage.py migrate --no-input` + `collectstatic --no-input` post-deploy
- [ ] Deploys only if publish workflow concluded `success`

### Security — `security.yml`
- [ ] Runs weekly (Mon 9am UTC) and on every PR to `main`
- [ ] `bandit` SAST on `django-app/` (medium severity minimum)
- [ ] `npm audit --audit-level=high` on `frontend-ui/`
- [ ] `trivy` container scan on GHCR image (weekly only, HIGH + CRITICAL exit-code 1)

### GitHub Secrets
- [ ] All 6 secrets documented and added to repo Settings → Secrets → Actions:
  `SECRET_KEY`, `DATABASE_URL`, `VITE_API_URL`, `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`

---

## Edge Cases
- If `manage.py migrate --check` fails in CI, fail the build immediately (don't run tests against stale schema)
- If Google OAuth callback receives an error param, redirect to `/login?error=oauth_failed` (already implemented in `GoogleCallbackView`)
- If `deploy.yml` SSH step fails, keep the old container running (Docker Compose `up -d` is non-destructive)
- If `logo.png` is missing from `django-app/static/`, emails send but HTML email has broken image — document as pre-production TODO, not a blocker
- Container trivy scan only runs on `schedule` (not PR) to avoid failing PRs when GHCR image doesn't exist yet on feature branches

---

## Technical Requirements
- GitHub Actions runners: `ubuntu-latest`
- Registry: GitHub Container Registry (GHCR) — free, no extra account needed
- Production app path: `/opt/app` (adjust to actual server path)
- Django version check: CI uses Docker Compose (same image as production, not bare Python)
- Frontend Node version: 20 LTS

---

## Out of Scope
- Traefik / Caddy Caddyfile configuration (separate infra task)
- Staging environment (production only for MVP)
- Slack/email notifications on deploy failure (can add post-MVP)
- Frontend Docker image (served via `npm run build` + static hosting or Caddy, not a container)

---

## Unresolved Questions
- Production server IP/domain (needed for `SERVER_HOST` secret + Google OAuth redirect URI)
- SSH username on production server
- App path on server (`/opt/app` assumed — confirm)
- Production `DATABASE_URL` connection string

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
