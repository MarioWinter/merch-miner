# Security Rules

## Secrets Management
- NEVER commit secrets, API keys, or credentials to git
- Frontend: use `.env` / `.env.local` (Vite reads both; `.env.local` overrides)
- Backend: use `django-app/.env` (copied from `env/.env.template`)
- Use `VITE_` prefix ONLY for values safe to expose in the browser
- Document all required env vars in `env/.env.template` with dummy values

## Input Validation
- Validate ALL user input on the server side with DRF serializers
- Never trust client-side validation alone
- Sanitize data before database insertion

## Authentication
- Always verify authentication before processing API requests
- Use Django `permission_classes = [IsAuthenticated]` as second line of defense
- Implement rate limiting on authentication endpoints

## Security Headers
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: origin-when-cross-origin
- Strict-Transport-Security with includeSubDomains

## Code Review Triggers
- Any changes to Django permission classes require explicit user approval
- Any changes to authentication flow require explicit user approval
- Any new environment variables must be documented in `env/.env.template`
