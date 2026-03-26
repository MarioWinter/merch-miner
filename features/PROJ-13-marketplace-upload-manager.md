# PROJ-13: Desktop Upload App (Electron + Playwright)

**Status:** Planned
**Priority:** P1
**Created:** 2026-02-27
**Updated:** 2026-03-26

## Overview

Standalone Electron desktop application that executes MBA upload jobs from the Merch Miner backend. Receives upload jobs via **WebSocket**, automates the Amazon Merch on Demand upload form using **Playwright** with human-like behavior (streamed typing, mouse movements, randomized delays). Runs locally on the user's machine or a Remote Desktop.

The web app (PROJ-11 Publish) configures and queues upload jobs. This desktop app executes them. Separation ensures: CAPTCHA can be solved manually, no server-side Chromium needed, lighter Docker stack.

**Tech Stack:** Electron + TypeScript/React + Playwright + WebSocket

**Future:** Support for Spreadshirt, KDP (Kindle Direct Publishing) in addition to MBA.

## User Stories

### Connection & Setup
1. As a user, I want to install the Desktop Upload App on my Windows/Mac, so I can process upload jobs from Merch Miner.
2. As a user, I want to configure my Merch Miner server URL and authenticate with my workspace credentials, so the app connects securely.
3. As a user, I want the app to run in the system tray (minimized), so it doesn't clutter my taskbar.
4. As a user, I want to see the connection status (connected/disconnected) to my Merch Miner backend at a glance.

### MBA Authentication
5. As a user, I want to enter my MBA (Amazon Seller) credentials in the desktop app, so it can log in to upload.
6. As a user, I want the app to cache my MBA session cookie and reuse it across uploads, so I don't re-login every time.
7. As a user, I want the app to auto-detect expired sessions and re-login automatically.

### Upload Execution
8. As a user, I want the app to fill MBA upload forms with human-like typing (character by character, 50-150ms delay, randomized), so Amazon doesn't detect automation.
9. As a user, I want realistic mouse movements between form fields (Bezier curves, not instant jumps) and Tab-key navigation.
10. As a user, I want configurable delay between uploads (30-120s, randomized) to avoid detection patterns.
11. As a user, I want the app to process uploads sequentially from my job queue, so uploads happen one at a time in order.
12. As a user, I want bulk upload support — multiple designs queued and processed automatically in sequence.

### Controls
13. As a user, I want Start/Pause/Stop buttons to control the upload queue at any time.
14. As a user, I want to Schedule uploads (e.g. "Start at 2:00 AM") for off-peak processing.
15. As a user, I want to add or remove designs from the queue before/during processing (designs come from Merch Miner backend selection).

### Validation & Safety
16. As a user, I want a pre-upload validation check that verifies all data is complete (listing fields, design file, marketplace config) before starting, so I don't waste uploads on incomplete data.
17. As a user, I want a legal warning "Automated uploads may violate Amazon TOS" with a confirmation checkbox that I must check before the first upload, so I'm aware of the risk.

### Monitoring & Feedback
18. As a user, I want to see real-time progress: which design is currently uploading, which step (logging in / filling form / uploading file / submitting).
19. As a user, I want to see a summary of completed uploads: design name, marketplace, ASIN (if captured), status (success/failed).
20. As a user, I want an error log showing why an upload failed, with the exact error message and a screenshot of the MBA page at the moment of failure.
21. As a user, I want the ASIN automatically captured after successful upload and reported back to my Merch Miner backend, so my Product Lifecycle (PROJ-11) is updated.

### Error Handling
22. As a user, I want failed uploads to auto-retry once after a delay. If the retry also fails, the job is marked failed and I'm notified.
23. As a user, I want CAPTCHA detection — if Amazon shows a CAPTCHA, the app pauses the queue, brings the browser window to focus, and shows me a notification "CAPTCHA detected — please solve manually". After I solve it, the app continues.
24. As a user, I want a screenshot saved automatically when any upload fails, so I can debug the issue later.

### Marketplace Support
25. As a user, I want to select which marketplace to upload to (Amazon.com, .co.uk, .de, .fr, .it, .es, .co.jp) per job.
26. As a user, I want future support for additional marketplaces (Spreadshirt, KDP) without changing the core architecture.

## Acceptance Criteria

### Electron App

- [ ] AC-1: Electron app with system tray icon. Main window shows: connection status, queue overview, controls, settings.
- [ ] AC-2: Settings page: Server URL, workspace auth token, MBA email/password (stored encrypted locally via `safeStorage`), upload delay range (min/max seconds), auto-start on system boot toggle.
- [ ] AC-3: Auto-updater — checks for new versions on startup, prompts user to update.

### WebSocket Connection

- [ ] AC-4: WebSocket client connects to `ws://server/ws/upload-app/` (from PROJ-11). Authenticates with workspace token.
- [ ] AC-5: Receives new upload jobs in real-time. Job payload: listing snapshot, design file URL, template settings, marketplace.
- [ ] AC-6: Reports back to server: status updates (per step), ASIN on success, error message + screenshot URL on failure.
- [ ] AC-7: Auto-reconnect on disconnect with exponential backoff (1s, 2s, 4s, max 30s).

### Playwright Automation

- [ ] AC-8: Playwright launches Chromium (visible or headless, configurable). Navigates to MBA upload page.
- [ ] AC-9: MBA login with credentials from settings. Session cookie cached in Playwright browser context. Reused across uploads. Auto-detect expiry → re-login.
- [ ] AC-10: Human-like form filling:
  - Character input: streamed, 50-150ms random delay per character (not `fill()`)
  - Mouse: Bezier-curve movements between fields, realistic speed
  - Navigation: Tab-key between fields, not direct click on every field
  - Pauses: 1-3s randomized delay between form sections
  - Scroll: smooth scroll to elements, not instant jump
- [ ] AC-11: File upload via Playwright `set_input_files()` for design image.
- [ ] AC-12: Form submission → wait for confirmation page → capture ASIN from response.
- [ ] AC-13: Upload throttling: configurable delay between uploads (default 30-120s, randomized within range).

### CAPTCHA Handling

- [ ] AC-14: CAPTCHA detection: check for known CAPTCHA elements on page after navigation/submission.
- [ ] AC-15: On CAPTCHA: pause queue, bring browser window to foreground, show desktop notification "CAPTCHA detected". Poll page every 2s for CAPTCHA resolution. When resolved → continue upload.

### Error Handling

- [ ] AC-16: On upload failure: capture full-page screenshot → save to local temp folder → upload screenshot URL to backend via WebSocket.
- [ ] AC-17: Auto-retry: 1 retry after 60s delay. If retry fails → mark job as failed, move to next job.
- [ ] AC-18: MBA session expired mid-upload → attempt re-login. If re-login fails (credentials changed) → pause queue, notify user.

### Queue Management

- [ ] AC-19: Queue UI shows all pending/active/completed/failed jobs with: design thumbnail, design name, marketplace, status, ASIN (if completed), error (if failed).
- [ ] AC-20: Start/Pause/Stop buttons in main window + tray menu.
- [ ] AC-21: Schedule: "Start at [time]" picker. App waits until scheduled time, then starts queue.
- [ ] AC-22: Add/remove jobs: reflects real-time changes from Merch Miner web app via WebSocket.

### Legal & Safety

- [ ] AC-23: First-run dialog: legal warning about automated uploads + confirmation checkbox. Must be checked before any upload. Stored in local settings.
- [ ] AC-24: Pre-upload validation per job: check listing_snapshot has all required fields, design file URL accessible, marketplace configured. Skip invalid jobs with error log.

## Architecture

```
Merch Miner Web App (PROJ-11)
        │
        │ WebSocket (ws://server/ws/upload-app/)
        │
        ▼
Desktop Upload App (Electron)
        │
        ├── WebSocket Client (receives jobs, reports status)
        ├── Queue Manager (sequential processing, scheduling)
        ├── Playwright Controller
        │     ├── MBA Login + Session Management
        │     ├── Human-like Form Filler (streamed typing, mouse, tabs)
        │     ├── File Uploader
        │     ├── ASIN Capturer
        │     └── CAPTCHA Detector + Pause Handler
        ├── Screenshot Manager (failure captures)
        ├── Settings Store (encrypted credentials, config)
        └── Tray Icon + UI (React)
```

## Edge Cases

- [ ] EC-1: WebSocket disconnected → app queues local retry, reconnects with backoff. Jobs received after reconnect.
- [ ] EC-2: MBA login fails (wrong credentials) → notify user, pause queue. Don't retry login in loop.
- [ ] EC-3: Design file URL expired/unreachable → job fails with "Design file not accessible". No retry.
- [ ] EC-4: MBA form layout changed (Amazon redesign) → Playwright selectors break, job fails with screenshot. Requires app update with new selectors.
- [ ] EC-5: CAPTCHA not solved within 10 minutes → mark current job as failed ("CAPTCHA timeout"), move to next job.
- [ ] EC-6: Multiple marketplace uploads for same design → separate jobs, each processed independently.
- [ ] EC-7: App closed during upload → current job marked as failed on next startup. Queue resumes from next pending job.
- [ ] EC-8: Two apps connected from same workspace → server sends jobs to first connected app only. Second app shows: "Another upload app is already connected."
- [ ] EC-9: App started but no jobs pending → idle state, tray icon shows "Waiting for jobs".
- [ ] EC-10: Internet connection lost during upload → Playwright timeout → job fails, retry on reconnect.

## Dependencies

- PROJ-11 (Publish — web app queues jobs, provides WebSocket endpoint + job data)
- PROJ-4 (Workspace & Membership — authentication token)

## Tech Stack

| Component | Technology |
|-----------|-----------|
| App Shell | Electron |
| UI | React + TypeScript (shared knowledge with frontend-ui) |
| Automation | Playwright (Chromium) |
| Communication | WebSocket (`ws` package) |
| Credential Storage | Electron `safeStorage` (OS-level encryption) |
| Auto-Update | `electron-updater` |
| Build | `electron-builder` (Windows + Mac installers) |

## Future Enhancements

- Spreadshirt marketplace support (different form, same Playwright pattern)
- KDP (Kindle Direct Publishing) support for book covers
- Browser Extension alternative (lighter than Electron, for users who don't want to install an app)
- Amazon Sales Data scraping from Seller Central (Extension, reuses login session)
- Parallel uploads (multiple browser contexts) — risky for detection, but possible
