# Security Report: Secrets Detection Audit

**Date:** 2026-02-27
**Repository:** /Users/mariomuller/dev/ai-coding-kit
**Scope:** Git history, .gitignore coverage, .env.template placeholder analysis

---

## 1. Git History — Leaked .env Files

### Finding: NO .env files were committed to git history

All 4 commits were scanned:

| Commit | Hash | Files with .env |
|--------|------|----------------|
| first commit | 39938fb | None |
| refactor: consolidate .gitignore | 87c4478 | None |
| chore: remove unused i18n files | e87e71e | None |
| feat: Add skill evaluation scripts | 5aeb26c | None |

Commands used to verify:
- `git log --all --full-history -- "django-app/.env"` — no results
- `git show 39938fb:django-app/.env` — object not found
- `git show 5aeb26c:django-app/.env` — object not found
- `git log --all --name-only --format="" | grep "\.env"` — only `.env.template` appeared

**Verdict: The actual `django-app/.env` was never committed to git.**

---

## 2. Sensitive Content in .env.template (Committed to Git)

**File:** `django-app/.env.template` (tracked in git, appeared in commits 39938fb and 5aeb26c)

### CRITICAL: Insecure Django SECRET_KEY in template

The `.env.template` contains a concrete (non-placeholder) Django secret key:

```
SECRET_KEY="django-insecure-lp6h18zq4@z30symy*oz)+hp^uoti48r_ix^qc-m@&yfxd7&hn"
```

This key is committed to the public git history. It was introduced in commit `39938fb` (first commit) and was also present in commit `5aeb26c`.

**Risk:** If any environment copies this value verbatim (instead of replacing it), the secret key is effectively public. Django uses `SECRET_KEY` for session signing, CSRF tokens, and password reset tokens. A known `SECRET_KEY` allows session forgery and CSRF bypass.

**The prefix `django-insecure-` is Django's own warning that this key is not production-safe.**

---

## 3. .gitignore Coverage

### Root `./.gitignore`

The root-level `.gitignore` includes:
```
.env
.env.local
.env.*.local
.env.production
```

### Verification

Running `git ls-files --others --ignored --exclude-standard | grep "\.env"` returned:
```
django-app/.env
```

This confirms `django-app/.env` is currently ignored by git and will not be accidentally staged.

### Current .env Status

`django-app/.env` is present on disk but correctly excluded from git tracking. It does NOT appear in `git status` as a tracked or staged file.

### Gap Identified

The `.gitignore` does NOT explicitly cover `.env.production`. While `django-app/.env` is covered by the bare `.env` rule, a file named `.env.production` at the root is covered, but `.env.production` inside a subdirectory (e.g., `django-app/.env.production`) is NOT covered unless the root rule applies recursively.

**Recommendation:** Add `**/.env.production` and `**/.env.staging` to `.gitignore` for defense in depth.

---

## 4. Current `django-app/.env` — Actual Secrets on Disk

The file exists locally and contains real credentials (NOT committed to git, but present on disk):

| Variable | Value | Concern |
|----------|-------|---------|
| `DJANGO_SUPERUSER_USERNAME` | `mario` | Personal username, not placeholder |
| `DJANGO_SUPERUSER_PASSWORD` | `werte1234` | Weak password pattern ("werte" = German for "values") |
| `DJANGO_SUPERUSER_EMAIL` | `mariowinter.sg@gmail.com` | Real personal email |
| `SECRET_KEY` | `"django-insecure-(...)"` | Contains `django-insecure-` prefix — NOT safe for production |
| `DEBUG` | `False` | Correct for production |
| `DB_PASSWORD` | `#Xwerte1234#X` | Similar weak password pattern |
| `EMAIL_HOST` | `smtp.gmail.com` | Real SMTP host |
| `EMAIL_HOST_USER` | `mariowinter.sg@gmail.com` | Real email address |
| `EMAIL_HOST_PASSWORD` | `nvfzahwpvvaqzrdt` | Looks like a Gmail App Password (16-char pattern) |

### High Severity Issues in Local .env

1. **`django-insecure-` SECRET_KEY in production config**: The file has `DEBUG=False` and production `ALLOWED_HOSTS`, but uses a `django-insecure-*` prefixed secret key. This key should be replaced with a cryptographically strong key generated via `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`.

2. **Gmail App Password exposed**: `EMAIL_HOST_PASSWORD=nvfzahwpvvaqzrdt` matches the 16-character Gmail App Password format. While this file is not in git, this credential should be treated as sensitive. If this password was ever in a different file that was committed, it should be rotated.

3. **Weak DB/superuser passwords**: `werte1234` and `#Xwerte1234#X` are dictionary-adjacent weak passwords. They appear to use the same root ("werte1234"), suggesting a pattern that could be guessed.

---

## 5. `.env.template` — Placeholder Analysis

**File:** `django-app/.env.template` (committed to git)

| Variable | Value | Type |
|----------|-------|------|
| `DJANGO_SUPERUSER_USERNAME` | `admin` | Placeholder (acceptable) |
| `DJANGO_SUPERUSER_PASSWORD` | `adminpassword` | Placeholder (acceptable for template) |
| `DJANGO_SUPERUSER_EMAIL` | `admin@example.com` | Placeholder (acceptable) |
| `COMPANY_NAME` | `My App` | Placeholder (acceptable) |
| `SECRET_KEY` | `"django-insecure-lp6h18zq4@z30symy*oz)+hp^uoti48r_ix^qc-m@&yfxd7&hn"` | **REAL KEY — should be a placeholder like `your-secret-key-here`** |
| `DEBUG` | `True` | Acceptable for template |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | Placeholder (acceptable) |
| `DB_NAME` | `your_database_name` | Placeholder (acceptable) |
| `DB_USER` | `your_database_user` | Placeholder (acceptable) |
| `DB_PASSWORD` | `your_database_password` | Placeholder (acceptable) |
| `EMAIL_HOST` | `smtp.example.com` | Placeholder (acceptable) |
| `EMAIL_HOST_USER` | `your_email_user` | Placeholder (acceptable) |
| `EMAIL_HOST_PASSWORD` | `your_email_user_password` | Placeholder (acceptable) |
| `DEFAULT_FROM_EMAIL` | `default_from_email` | Placeholder (acceptable) |

**Summary:** The only problematic entry in the template is the `SECRET_KEY` — it uses a real-looking insecure key rather than a descriptive placeholder string.

The template is missing several variables that appear in the actual `.env`:
- `CORS_ALLOWED_ORIGINS`
- `FRONTEND_ACTIVATION_URL`
- `FRONTEND_CONFIRM_PASSWORD_URL`

---

## 6. Summary of Findings

| Severity | Finding |
|----------|---------|
| INFO | No `.env` files were committed to git history |
| HIGH | `.env.template` (in git) contains a real `django-insecure-` SECRET_KEY instead of a placeholder |
| HIGH | Local `.env` uses a `django-insecure-` prefixed SECRET_KEY despite being a production config (`DEBUG=False`) |
| MEDIUM | Gmail App Password (`nvfzahwpvvaqzrdt`) in local `.env` — not in git, but should be verified not reused elsewhere |
| MEDIUM | Weak password pattern `werte1234` used for both superuser and DB credentials |
| LOW | `.gitignore` does not cover `**/.env.production` or `**/.env.staging` in subdirectories |
| LOW | `.env.template` missing `CORS_ALLOWED_ORIGINS`, `FRONTEND_ACTIVATION_URL`, `FRONTEND_CONFIRM_PASSWORD_URL` |

---

## 7. Recommended Actions

1. **Rotate SECRET_KEY immediately** — generate a new key and update the production deployment. The `django-insecure-` prefix means the current key was created by `django-admin startproject` and was never meant for production.

2. **Fix `.env.template`** — replace the actual `SECRET_KEY` value with a placeholder string such as `your-secret-key-change-this`.

3. **Rotate Gmail App Password** if there is any concern it was inadvertently shared or if it appeared in other files.

4. **Strengthen DB and superuser passwords** in production — avoid the `werte1234` pattern.

5. **Expand `.gitignore`** — add `**/.env.production` and `**/.env.staging` to the root `.gitignore`.

6. **Complete `.env.template`** — add all variables present in the actual `.env` so new developers know what is required.

---

## Appendix: Commands Run

```bash
# Git history for .env files
git log --all --full-history -- "django-app/.env" "frontend-ui/.env" ".env"
git log --all --name-only --format="" | grep "\.env"
git show 39938fb:django-app/.env
git show 5aeb26c:django-app/.env

# Search for specific secret patterns in git history
git log --all -S "SECRET_KEY" --format="%H %s"
git log --all -S "nvfzahwpvvaqzrdt" --format="%H %s"
git log --all -S "werte1234" --format="%H %s"
git log --all -S "django-insecure" --format="%H %s"
git log --all -G "django-insecure-lp6h18zq4" --format="%H %s"

# Verify gitignore coverage
git ls-files --others --ignored --exclude-standard | grep "\.env"

# Template content
git show 39938fb:django-app/.env.template
```
