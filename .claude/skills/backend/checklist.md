# Backend Implementation Checklist

## Core Checklist
- [ ] Checked existing models/views/serializers before creating new ones
- [ ] Django models created with appropriate fields and indexes
- [ ] Migrations created and applied (`makemigrations` + `migrate`)
- [ ] Foreign keys set with appropriate `on_delete` behavior
- [ ] All planned API endpoints implemented in the appropriate app's `api/views.py`
- [ ] Authentication: `CookieJWTAuthentication` on all protected views
- [ ] Permissions: `permission_classes = [IsAuthenticated]` on all protected endpoints
- [ ] Input validation with DRF serializer (`is_valid(raise_exception=True)`)
- [ ] Meaningful error messages with correct HTTP status codes
- [ ] No hardcoded secrets in source code
- [ ] Frontend connected to real API endpoints
- [ ] User has reviewed and approved

## Verification (run before marking complete)
- [ ] `docker compose exec web pytest` passes
- [ ] All acceptance criteria from feature spec addressed in API
- [ ] All API endpoints return correct status codes (test with curl or browser)
- [ ] `features/INDEX.md` status updated to "In Progress"
- [ ] Code committed to git

## Performance Checklist
- [ ] All frequently filtered columns have `db_index=True`
- [ ] No N+1 queries (use `select_related()`/`prefetch_related()` instead of loops)
- [ ] All list endpoints paginated (DRF pagination class configured)
- [ ] Serializer validation on all write endpoints
- [ ] Rate limiting on public-facing APIs (DRF throttle class)

## Background Jobs (if applicable)
- [ ] Long-running tasks in `tasks.py`, enqueued via `django_rq.enqueue()`
- [ ] Job failure handled with error logging
- [ ] Job status stored in model for frontend polling
