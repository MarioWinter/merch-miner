# PROJ-10: Marketplace Upload Manager (MBA Automation)

**Status:** Planned
**Priority:** P1
**Created:** 2026-02-27

## Overview

Automated MBA upload pipeline via Selenium/Chromium. Users create reusable upload templates, assemble upload jobs (template + listing + Google Drive design file), preview a MBA-mirrored form, then queue jobs for headless browser automation. ASIN is captured automatically on completion.

## User Stories

1. As a workspace admin, I want to connect a Google Drive account so team members can browse design files stored there.
2. As a workspace admin, I want to store MBA login credentials securely at the workspace level so the team shares one upload account.
3. As a member, I want to create reusable upload templates (brand, product type, fit, colors, marketplace) so I don't re-enter shared settings for every upload.
4. As a member, I want to create an upload job by selecting a template, a listing from PROJ-7, and a design file from Google Drive so all upload data is assembled in one place.
5. As a member, I want to see a MBA-mirrored preview of the upload form pre-filled with my listing and template data before submitting, so I can spot errors.
6. As a member, I want to queue multiple upload jobs and have Selenium upload them sequentially, so I can batch-process uploads unattended.
7. As a member, I want to see the real-time status of each upload job (pending / downloading / uploading / completed / failed), so I know what's happening.
8. As a member, I want the ASIN captured automatically after upload success, so I don't have to track it manually.

## Acceptance Criteria

1. `UploadTemplate` CRUD with workspace isolation; required fields: name, brand_name (max 50), product_type, fit_type, colors (JSON array of MBA color codes), marketplace.
2. `WorkspaceMBACredential`: password stored encrypted (Fernet via `cryptography` library); never returned in API response — masked email + last_verified_at only.
3. Google Drive OAuth2 via `google-auth-oauthlib`; token stored in `WorkspaceGDriveToken`; access token auto-refreshed on expiry using refresh_token.
4. `GET /api/workspace/gdrive/files/` returns paginated list of `.png`/`.jpg` files in specified Drive folder (query param `folder_id`; default: root).
5. `POST /api/upload-jobs/` validates: template and listing both belong to same workspace; `drive_file_id` is non-empty.
6. On job creation, job is appended to workspace queue (position = last + 1); status set to `pending`.
7. Queue worker (`tasks.py: process_upload_queue`) runs as django-rq job; processes one job at a time per workspace; advances only after current completes or fails.
8. Job execution steps (all in worker):
   a. Set `status=downloading`; download design from Drive to temp file.
   b. Set `status=uploading`; launch headless Chromium (Selenium WebDriver via selenium service on port 4444); log in to MBA (reuse session cookie if valid).
   c. Fill MBA upload form fields from template + listing data (brand, title, bullets, description, keywords, product type, fit, colors).
   d. Upload temp design file via file input element.
   e. Submit form; wait for ASIN confirmation page.
   f. Capture ASIN; set `status=completed`; store `asin` on `UploadJob`; set `completed_at`.
   g. Delete temp file.
9. MBA-mirrored preview in frontend: read-only form matching MBA field layout (brand, title, bullets 1–5, description, backend keywords, product type, fit, colors); data sourced from selected template + listing.
10. Upload queue UI: MUI Table with columns — position, niche/slogan, template name, Drive file name, status badge, ASIN (editable after completion), actions (cancel, retry).
11. Job status polling: frontend polls `GET /api/upload-jobs/{id}/` every 5s while status is `pending`/`downloading`/`uploading`; stops on terminal state.
12. On Selenium failure (CAPTCHA, form error, timeout): set `status=failed`; store `error_message`; capture screenshot to `/tmp/upload_screenshot_{job_id}.png`; log error. No auto-retry — manual retry via UI.
13. On Drive download failure: retry up to 3 times with exponential backoff; if all fail, set `status=failed`.
14. Cancelled jobs (`status=cancelled`) are skipped by queue worker; remaining jobs shift queue positions.
15. New docker-compose service `selenium` using `selenium/standalone-chromium:latest`; accessible internally at `http://selenium:4444`; `shm_size: "2g"`.

## Models

### `UploadTemplate`
```
id            — UUID pk
workspace     — FK(Workspace, on_delete=CASCADE)
name          — CharField(100)
brand_name    — CharField(50)
product_type  — CharField choices [standard, premium]
fit_type      — CharField choices [men, women, unisex, youth]
colors        — JSONField (list of MBA color code strings)
marketplace   — CharField choices [amazon_com, amazon_de, amazon_uk]
created_by    — FK(User, on_delete=SET_NULL, null=True)
created_at    — auto
updated_at    — auto
```

### `WorkspaceMBACredential`
```
workspace       — OneToOneField(Workspace, on_delete=CASCADE)
email           — CharField(255)
password        — BinaryField (Fernet-encrypted)
last_verified_at — DateTimeField(null=True, blank=True)
```

### `WorkspaceGDriveToken`
```
workspace     — OneToOneField(Workspace, on_delete=CASCADE)
access_token  — TextField (Fernet-encrypted)
refresh_token — TextField (Fernet-encrypted)
token_expiry  — DateTimeField
connected_by  — FK(User, on_delete=SET_NULL, null=True)
connected_at  — DateTimeField(auto_now_add=True)
```

### `UploadJob`
```
id            — UUID pk
workspace     — FK(Workspace, on_delete=CASCADE)
template      — FK(UploadTemplate, on_delete=PROTECT)
listing       — FK(Listing, null=True, blank=True, on_delete=SET_NULL)
listing_snapshot — JSONField (denormalized listing data captured at job creation)
drive_file_id — CharField(255)
drive_file_name — CharField(255)
status        — CharField choices [pending, downloading, uploading, completed, failed, cancelled]
asin          — CharField(20, blank=True)
error_message — TextField(blank=True)
queued_position — PositiveIntegerField
queued_at     — DateTimeField(auto_now_add=True)
started_at    — DateTimeField(null=True, blank=True)
completed_at  — DateTimeField(null=True, blank=True)
created_by    — FK(User, on_delete=SET_NULL, null=True)
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/upload-templates/` | List templates (workspace-scoped) |
| POST | `/api/upload-templates/` | Create template |
| GET | `/api/upload-templates/{id}/` | Template detail |
| PUT | `/api/upload-templates/{id}/` | Update template |
| DELETE | `/api/upload-templates/{id}/` | Delete (blocked if active jobs reference it) |
| POST | `/api/upload-jobs/` | Create + enqueue job |
| GET | `/api/upload-jobs/` | List jobs (paginated, filterable by status) |
| GET | `/api/upload-jobs/{id}/` | Job detail + live status |
| POST | `/api/upload-jobs/{id}/cancel/` | Cancel pending job |
| POST | `/api/workspace/gdrive/connect/` | Initiate Google Drive OAuth2 flow |
| GET | `/api/workspace/gdrive/callback/` | OAuth2 callback (store token) |
| GET | `/api/workspace/gdrive/files/` | Browse Drive files (query param: folder_id) |
| POST | `/api/workspace/mba-credentials/` | Save / update MBA credentials |
| GET | `/api/workspace/mba-credentials/status/` | Masked email + last_verified_at |

## Edge Cases

1. Drive OAuth token expired → auto-refresh before each file operation; if refresh fails → workspace admin notified (banner in UI), all pending jobs blocked until reconnected.
2. Design file moved/deleted from Drive → job fails with "Drive file not found"; user must update job with new file ID.
3. MBA session expired mid-upload → worker attempts re-login; if credentials invalid, job fails and admin is notified.
4. Multiple workspaces → each workspace has an independent per-workspace queue; Selenium sessions are serialized per workspace so they don't conflict.
5. Listing deleted after job created → `listing_snapshot` (JSONField) preserves listing data; job proceeds from snapshot. If snapshot is empty and listing FK is null, job fails gracefully.
6. Template deleted with pending jobs → `on_delete=PROTECT` prevents deletion; admin is shown list of dependent jobs before retry.
7. MBA form layout change (Amazon redesign) → Selenium selectors break; job fails with screenshot + error; requires manual selector update in code.
8. Temp file not cleaned after failure → worker startup cleanup task deletes `/tmp/upload_*` files older than 1 hour.

## New docker-compose Service

```yaml
selenium:
  image: selenium/standalone-chromium:latest
  ports:
    - "4444:4444"
  shm_size: "2g"
```

## Dependencies

- PROJ-2 (Workspace & Membership — workspace FK, admin role for credential/Drive management)
- PROJ-7 (Listing & Keyword Generator — listing data for upload form + snapshot)
- PROJ-6 (Design Generation — `worker` docker-compose service required)
- `selenium` docker-compose service (introduced in this feature)

## Unresolved Questions

- Persist MBA session cookies between jobs (avoid re-login per job) — yes or skip for MVP?
- Screenshot storage on failure: `/tmp` (ephemeral) or S3/Supabase bucket (persistent)?
