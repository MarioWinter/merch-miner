# Backend Development Rules

## Version Note
- Always use Django LTS. Current LTS: **5.2** (supported April 2028)
- `django-allauth` must be added to `requirements.txt` before auth work begins
- `openpyxl` must be added to `requirements.txt` before any Excel upload/download work

## Django DRF Patterns
- All API views: use DRF `APIView` or `ViewSet`
- Auth: use `CookieJWTAuthentication` (`api/authentication.py`) on all protected views
- Permission: set `permission_classes = [IsAuthenticated]` on all protected endpoints
- Never skip authentication checks

## Serializers
- Validate all inputs with DRF serializers (`serializer.is_valid(raise_exception=True)`)
- Never trust raw `request.data` without serializer validation
- Use `SerializerMethodField` for computed/derived fields

## Database — Django ORM
- Use `select_related()` and `prefetch_related()` to avoid N+1 queries
- Add `db_index=True` on columns used in `filter()`, `order_by()`
- Use `ForeignKey` with `on_delete=CASCADE` where appropriate
- Never run raw SQL unless ORM cannot express the query

## Background Jobs — django-rq
- Long-running tasks (e.g. FFmpeg transcoding, n8n calls) go in queue via `django_rq.enqueue()`
- Keep job functions in `tasks.py`
- Always handle job failure with proper error logging

## File Uploads & Exports
- CSV upload: DRF `FileField` + `csv.DictReader`; validate headers before processing
- Excel upload: use `openpyxl` (add to `requirements.txt`); validate sheet structure first
- CSV download: `StreamingHttpResponse` + `csv.writer` for large datasets
- Always validate file mime type and size before processing (max size in settings)
- Never execute file content; treat all uploaded data as untrusted

## n8n Integration (Webhook Pattern)
- Django → n8n: POST to n8n webhook URL (stored in env var `N8N_WEBHOOK_URL`)
  Use `httpx` or `requests` inside a django-rq task (never block a request/response cycle)
- n8n → Django: expose a `/api/n8n/callback/` endpoint protected by a shared secret header
  (`X-N8N-Secret: env var N8N_CALLBACK_SECRET`); validate secret on every inbound call
- Store n8n workflow results in a model (e.g. `WorkflowRun`) with status + result JSON
- Frontend polls `/api/n8n/status/<run_id>/` or use WebSocket for live updates

## API Design
- Return meaningful errors: use DRF's `ValidationError`, `PermissionDenied`, `NotFound`
- Paginate all list endpoints: use DRF `PageNumberPagination` or `LimitOffsetPagination`
- Use consistent response format: `{ data: ..., error: ... }`

## Payment — Polar.sh
- Expose `/api/payments/webhook/` endpoint (no auth, verified by Polar.sh signature header)
- Validate webhook signature before processing any event
- Handle: `subscription.created`, `subscription.updated`, `subscription.cancelled` events
- Store subscription state in a `Subscription` model linked to `User`

## Security
- Never hardcode secrets; use env vars from `python-dotenv` or `os.environ`
- Use CORS headers (`django-cors-headers`) restricted to frontend origin only
- Rate limiting: use DRF throttling classes on public/auth endpoints
- Input validation: `serializer.is_valid()` is first line of defense

## Environment
- Env vars template: `django-app/.env.template`
- Copy to `django-app/.env` before running Docker
- Never commit `.env` to git
- Required new vars: `N8N_WEBHOOK_URL`, `N8N_CALLBACK_SECRET`, `POLAR_WEBHOOK_SECRET`
