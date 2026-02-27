# Security Audit Report
**Date:** 2026-02-27
**Auditor:** DevSecOps Skill
**Stack:** Django + Docker Compose
**Scope:** Secrets Detection — triggered by suspected accidental .env commit

---

## Executive Summary

| Severity | Count |
|----------|-------|
| Critical | 3     |
| High     | 1     |
| Medium   | 2     |
| Low      | 1     |
| Info     | 2     |

**Verdict:** CRITICAL ISSUES — Rotate credentials immediately before any further pushes.

---

## Findings

### [CRITICAL-001] Real Credentials in django-app/.env Committed to a Public GitHub Repository

- **Category:** Secrets
- **Severity:** Critical
- **Location:** `django-app/.env` (entire file) — remote: `git@github.com:MarioWinter/aI-coding-kit.git`
- **Description:** The `.env` file contains production credentials and is present on disk. The repository has a configured remote (`github.com:MarioWinter/aI-coding-kit`) and all 4 commits have been pushed (FETCH_HEAD matches HEAD: `5aeb26c`). The `.env` file exists at `django-app/.env` and is NOT excluded from the working tree. Even if currently gitignored, it may have been tracked in one of the 4 commits (`first commit`, `refactor: consolidate .gitignore`, `chore: remove unused i18n`, `feat: Add skill evaluation`). Because the `.gitignore` consolidation happened in the second commit (`87c4478`), the `.env` file could have been included in the first commit (`39938fb`) before `.gitignore` was corrected. Git history cannot be cleared without a force-push to rewrite history on GitHub.

  **Credentials found in `django-app/.env` that must be rotated immediately:**
  - `DJANGO_SUPERUSER_PASSWORD=werte1234` — admin panel password
  - `SECRET_KEY="django-insecure-(6or@t(ffo$j26w3tpud#&a$ad-t_q0&v%3m01%m($q6m60ix^)"` — Django signing key (used for sessions, CSRF tokens, password reset links)
  - `DB_PASSWORD=#Xwerte1234#X` — PostgreSQL database password
  - `EMAIL_HOST_PASSWORD=nvfzahwpvvaqzrdt` — Gmail App Password (SMTP credential)
  - `DJANGO_SUPERUSER_EMAIL=mariowinter.sg@gmail.com` — PII (email address)
  - `EMAIL_HOST_USER=mariowinter.sg@gmail.com` — PII + SMTP identity

- **Remediation:**
  1. Immediately revoke the Gmail App Password `nvfzahwpvvaqzrdt` at https://myaccount.google.com/apppasswords
  2. Change `DJANGO_SUPERUSER_PASSWORD` on all running instances
  3. Change `DB_PASSWORD` for the `videoflix_user` PostgreSQL user
  4. Generate a new Django `SECRET_KEY` (all existing sessions and password-reset links will be invalidated — acceptable)
  5. Purge the file from git history:
     ```bash
     git filter-repo --path django-app/.env --invert-paths
     # or:
     git filter-branch --force --index-filter \
       "git rm --cached --ignore-unmatch django-app/.env" \
       --prune-empty --tag-name-filter cat -- --all
     git push origin --force --all
     git push origin --force --tags
     ```
  6. After force-push, contact GitHub Support to purge cached views: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
  7. Verify `.env` is gitignored going forward (see CRITICAL-002)
- **Effort:** Medium

---

### [CRITICAL-002] Django SECRET_KEY Uses "django-insecure-" Prefix in Production

- **Category:** Secrets
- **Severity:** Critical
- **Location:** `django-app/.env` line 5
- **Description:** The `SECRET_KEY` value is `"django-insecure-(6or@t(ffo$j26w3tpud#&a$ad-t_q0&v%3m01%m($q6m60ix^)"`. Django's `django-insecure-` prefix is a marker that the key was auto-generated for development and has NOT been replaced with a production-strength key. While the key has sufficient entropy for cryptographic use, the `django-insecure-` prefix is also used by Django's system checks to warn about insecure keys — and signals that this is an original template value. Combined with the fact that it may already be public on GitHub (see CRITICAL-001), this key must be replaced.
- **Remediation:**
  ```python
  # Generate a new key:
  python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
  ```
  Replace the value in `.env` with the output. Do NOT use the `django-insecure-` prefix in production.
- **Effort:** Low

---

### [CRITICAL-003] Hardcoded Fallback Password in settings.py

- **Category:** Secrets / Code
- **Severity:** Critical
- **Location:** `django-app/core/settings.py` line 146
- **Description:** The `DATABASES` configuration has a hardcoded fallback password:
  ```python
  "PASSWORD": os.environ.get("DB_PASSWORD", default="supersecretpassword"),
  ```
  If `DB_PASSWORD` is ever missing from the environment (misconfiguration, deployment error), Django will silently connect to PostgreSQL with the string `supersecretpassword`. This is committed to the public GitHub repository. Any attacker who knows the database is accessible and sees this code can attempt this password. Hardcoded credentials in source code should never exist, even as fallbacks.
- **Remediation:**
  ```python
  # Fail loudly instead of silently using a fallback:
  "PASSWORD": os.environ["DB_PASSWORD"],  # KeyError if missing — intentional
  ```
  Or use a sentinel that raises:
  ```python
  import sys
  DB_PASSWORD = os.environ.get("DB_PASSWORD")
  if not DB_PASSWORD:
      sys.exit("FATAL: DB_PASSWORD environment variable is not set")
  ```
- **Effort:** Low

---

### [HIGH-001] .env File Present on Disk — Git Tracking Status Unverifiable Without Shell Access

- **Category:** Secrets
- **Severity:** High
- **Location:** `django-app/.env`
- **Description:** The `.env` file exists on disk at `django-app/.env`. The root `.gitignore` includes `.env` as a pattern (line 4). However, the `.gitignore` consolidation only happened in commit `87c4478` (the second commit). The "first commit" (`39938fb`) predates the `.gitignore` consolidation — meaning the file may have been tracked before the ignore rule was added. Once a file is tracked by git, adding it to `.gitignore` does NOT stop tracking it; `git rm --cached` must be run explicitly. Without shell access to run `git ls-files django-app/.env`, the current tracked status cannot be confirmed from this audit. This is rated High (not Critical) only because the `.gitignore` entry exists — but this must be verified immediately.
- **Remediation:**
  ```bash
  # Verify current tracked status:
  git ls-files django-app/.env
  # If any output appears, the file IS tracked:
  git rm --cached django-app/.env
  git commit -m "chore: stop tracking .env file"
  git push origin main
  # Then rewrite history to remove it from all past commits (see CRITICAL-001)
  ```
- **Effort:** Low

---

### [MEDIUM-001] .env.template Contains a Real django-insecure SECRET_KEY Value

- **Category:** Secrets
- **Severity:** Medium
- **Location:** `django-app/.env.template` line 6
- **Description:** The template file contains:
  ```
  SECRET_KEY="django-insecure-lp6h18zq4@z30symy*oz)+hp^uoti48r_ix^qc-m@&yfxd7&hn"
  ```
  Template files are committed to git by design, so this key is intentionally public. However, if any developer copies this template and forgets to replace the value, a known secret key ends up in production. The template should contain a clearly non-functional placeholder instead of a real-looking key value.
- **Remediation:**
  Replace line 6 in `.env.template`:
  ```
  SECRET_KEY=REPLACE_WITH_OUTPUT_OF__python_-c_"from_django.core.management.utils_import_get_random_secret_key;_print(get_random_secret_key())"
  ```
  Or simply:
  ```
  SECRET_KEY=<generate-with: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())">
  ```
- **Effort:** Low

---

### [MEDIUM-002] Production .env Contains DEBUG=False but SECRET_KEY Uses Insecure Prefix

- **Category:** Secrets / Configuration
- **Severity:** Medium
- **Location:** `django-app/.env` lines 5-6
- **Description:** `DEBUG=False` is correctly set, which is good. However the `SECRET_KEY` prefix `django-insecure-` causes Django's deployment check (`manage.py check --deploy`) to emit a warning. Additionally, Django's `settings.py` reads `DEBUG` as a raw string:
  ```python
  DEBUG = os.environ.get('DEBUG', 'False')
  ```
  This means `DEBUG` will always be a truthy string in Python (both `"True"` and `"False"` are truthy non-empty strings). The correct pattern is:
  ```python
  DEBUG = os.environ.get('DEBUG', 'False') == 'True'
  ```
  If `DEBUG` is never checked with `if DEBUG:` in settings (only passed to Django's core which handles string conversion), this may be benign — but it should be audited.
- **Remediation:**
  ```python
  # In settings.py:
  DEBUG = os.environ.get('DEBUG', 'False') == 'True'
  ```
- **Effort:** Low

---

### [LOW-001] No SECURE_HSTS, SECURE_SSL_REDIRECT, or X_FRAME_OPTIONS in settings.py

- **Category:** Headers / Configuration
- **Severity:** Low
- **Location:** `django-app/core/settings.py` — entire file
- **Description:** None of the following Django security settings are configured:
  - `SECURE_HSTS_SECONDS`
  - `SECURE_HSTS_INCLUDE_SUBDOMAINS`
  - `SECURE_SSL_REDIRECT`
  - `X_FRAME_OPTIONS`
  - `SECURE_CONTENT_TYPE_NOSNIFF`
  - `SECURE_BROWSER_XSS_FILTER`
  Note: `SESSION_COOKIE_SECURE = True` and `CSRF_COOKIE_SECURE = True` are present (lines 47-48), which is good. The missing settings should be added conditionally for production.
- **Remediation:**
  Add to `settings.py`:
  ```python
  if not DEBUG:
      SECURE_HSTS_SECONDS = 31536000
      SECURE_HSTS_INCLUDE_SUBDOMAINS = True
      SECURE_HSTS_PRELOAD = True
      SECURE_SSL_REDIRECT = True
      X_FRAME_OPTIONS = 'DENY'
      SECURE_CONTENT_TYPE_NOSNIFF = True
      SECURE_BROWSER_XSS_FILTER = True
  ```
- **Effort:** Low

---

### [INFO-001] trufflehog Not Installed — Full Git History Scan Not Performed

- **Category:** Missing Tool
- **Severity:** Info
- **Location:** Audit environment
- **Description:** `trufflehog` was not available in this audit session. A full verified-secrets scan of all git history blobs was not performed. The manual grep and git log checks are a partial substitute but may miss secrets in binary files, commit metadata, or encoded content.
- **Remediation:**
  ```bash
  brew install trufflehog
  trufflehog git file://. --only-verified
  ```
  Run this immediately to perform a complete scan.
- **Effort:** Low

---

### [INFO-002] Virtual Environment (django-app/env/) Present in Working Tree

- **Category:** Configuration
- **Severity:** Info
- **Location:** `django-app/env/`
- **Description:** A Python virtual environment exists at `django-app/env/`. The `.gitignore` includes `env/` so it should not be tracked. However, this directory contains pip packages and may include local configuration files. Confirm it is not tracked with `git ls-files django-app/env/`.
- **Remediation:**
  ```bash
  git ls-files django-app/env/ | head -5
  # Should return empty. If not: git rm -r --cached django-app/env/
  ```
- **Effort:** Low

---

## Missing Tools

| Tool | Purpose | Install |
|------|---------|---------|
| trufflehog | Verified secrets detection in git history | `brew install trufflehog` |
| bandit | Python SAST | `pip install bandit` |
| trivy | Container CVE scanning | `brew install trivy` |
| pip-audit | Python dependency CVE audit | `pip install pip-audit` |

---

## Passed Checks

- `settings.py` reads `SECRET_KEY` from environment (`os.getenv('SECRET_KEY')`) — no hardcode in source
- `settings.py` reads `EMAIL_HOST_PASSWORD` from environment — no hardcode
- `SESSION_COOKIE_SECURE = True` is set in `settings.py`
- `CSRF_COOKIE_SECURE = True` is set in `settings.py`
- `AUTH_COOKIE_SECURE: True` in `SIMPLE_JWT` settings
- `AUTH_COOKIE_HTTP_ONLY: True` in `SIMPLE_JWT` settings (prevents JS token access)
- `CORS_ALLOW_CREDENTIALS = True` with explicit `CORS_ALLOWED_ORIGINS` (not wildcard `*`)
- `DEBUG=False` in production `.env`
- `ALLOWED_HOSTS` in production `.env` is domain-restricted (no `*`)
- Root `.gitignore` has `.env`, `.env.local`, `.env.*.local`, `.env.production` entries
- `REST_FRAMEWORK` default permission class is `IsAuthenticated`
- `REST_FRAMEWORK` default authentication class is `CookieJWTAuthentication`

---

## Recommended Next Steps

Ordered by priority:

1. **IMMEDIATE — Rotate all credentials** (CRITICAL-001):
   - Revoke Gmail App Password `nvfzahwpvvaqzrdt` NOW
   - Change Django superuser password
   - Change PostgreSQL `videoflix_user` password
   - Generate new Django SECRET_KEY

2. **TODAY — Purge .env from git history** (CRITICAL-001, HIGH-001):
   - Run `git ls-files django-app/.env` to confirm tracking status
   - If tracked: run `git filter-repo` to rewrite history
   - Force-push to GitHub and request cache purge from GitHub Support

3. **TODAY — Remove hardcoded fallback password from settings.py** (CRITICAL-003):
   - Replace `default="supersecretpassword"` with an explicit failure

4. **THIS SPRINT — Replace insecure SECRET_KEY prefix** (CRITICAL-002):
   - Generate a proper key without the `django-insecure-` prefix

5. **THIS SPRINT — Fix DEBUG string comparison in settings.py** (MEDIUM-002):
   - Change to `DEBUG = os.environ.get('DEBUG', 'False') == 'True'`

6. **THIS SPRINT — Clean .env.template of real-looking key values** (MEDIUM-001)

7. **NEXT SPRINT — Add production security headers to settings.py** (LOW-001)

8. **ONGOING — Install and run trufflehog, bandit, trivy, pip-audit** (INFO-001)
