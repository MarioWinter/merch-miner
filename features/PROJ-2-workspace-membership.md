# PROJ-2: Workspace & Membership

**Status:** Planned
**Priority:** P0 (MVP)
**Created:** 2026-02-27

## Overview

Multi-tenant workspace layer. Every user belongs to at least one `Workspace`. All data models (niches, designs, listings) are scoped to a workspace via FK. Membership roles: admin (owner-level) and member. Invitation flow via email. Also includes: Django bump 5.1 → 5.2, addition of `worker` service to docker-compose for django-rq jobs.

## User Stories

1. As a new user completing registration/first login, I want a personal workspace auto-created for me, so that I can start immediately without setup.
2. As an admin, I want to invite team members by email, so that we can collaborate in the same workspace.
3. As an invited user, I want to accept or decline an invitation via a link in my email, so that I control workspace access.
4. As an admin, I want to change a member's role or remove them from the workspace, so that I manage access appropriately.
5. As a member, I want to see only data belonging to my workspace, so that other teams' data is never visible to me.

## Acceptance Criteria

1. `Workspace` model: UUID pk, name (max 100), slug (unique), owner FK (User), created_at.
2. `Membership` model: workspace FK, user FK, role choices [admin, member], status choices [pending, active], invited_by FK (nullable), invited_at, accepted_at (nullable). Unique together: (workspace, user).
3. On first login (email or social), a workspace is auto-created if the user has no memberships.
4. `POST /api/workspaces/{id}/invite/` sends invitation email with signed token link; creates Membership with status=pending.
5. `GET /api/workspaces/invite/accept/?token={token}` sets membership status=active and redirects to workspace.
6. `GET /api/workspaces/me/` returns current user's active workspaces + membership role.
7. `PATCH /api/workspaces/{id}/members/{user_id}/` — admin only; change role.
8. `DELETE /api/workspaces/{id}/members/{user_id}/` — admin only; remove member (cannot remove owner).
9. All protected endpoints check workspace membership before returning data; return 403 if not a member.
10. Django version bumped to 5.2 in `requirements.txt`.
11. `worker` service added to `docker-compose.yml` (runs `python manage.py rqworker`).

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/workspaces/me/` | Member | List user's workspaces |
| POST | `/api/workspaces/{id}/invite/` | Admin | Send invite email |
| GET | `/api/workspaces/invite/accept/` | Public | Accept invite via token |
| PATCH | `/api/workspaces/{id}/members/{user_id}/` | Admin | Update member role |
| DELETE | `/api/workspaces/{id}/members/{user_id}/` | Admin | Remove member |

## Edge Cases

1. User invited to workspace they're already a member of → return 409, no duplicate Membership.
2. Invitation token expired (>48h) → 400; prompt to request a new invite.
3. Admin tries to remove themselves (owner) → 403 with message "Cannot remove workspace owner."
4. User belongs to 0 active workspaces after removal → they still have their personal workspace.
5. Slug collision on workspace creation → append random suffix.

## Dependencies

- PROJ-1 (User Auth) — workspace auto-creation hooks into post-login signal.

## Implementation Notes

- Workspace isolation: all ViewSets filter queryset by `request.user.memberships.filter(status='active').values_list('workspace_id', flat=True)`.
- Invitation tokens: use Django's `signing.dumps()` / `signing.loads()` with `max_age=172800` (48h).
- Worker service: `command: python manage.py rqworker default`; shares same `DATABASE_URL` + `REDIS_URL` env vars.
- `DJANGO_VERSION` in requirements: `Django>=5.2,<6.0`.
