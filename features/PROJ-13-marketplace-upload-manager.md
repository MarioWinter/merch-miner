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

## Verification Steps

1. Install Desktop App on Mac/Windows → launches, tray icon visible
2. Configure server URL + workspace token → connection status shows "Connected"
3. Enter MBA credentials → stored encrypted, test login succeeds
4. Queue upload job from PROJ-11 web app → job appears in Desktop App queue via WebSocket
5. Start queue → Playwright opens Chromium, navigates to MBA, logs in with cached session
6. Form filling: typing is character-by-character (50-150ms), mouse moves in curves, Tab between fields
7. Design file uploaded → form submitted → ASIN captured → reported back to server
8. Upload delay: 30-120s randomized between consecutive uploads
9. CAPTCHA appears → queue pauses, browser window focused, notification shown. Solve manually → queue continues
10. Upload fails → screenshot saved → error reported to server → auto-retry once after 60s
11. Retry also fails → job marked failed, next job starts
12. Schedule "Start at 2:00 AM" → app waits, starts at scheduled time
13. WebSocket disconnects → auto-reconnect with exponential backoff (1s, 2s, 4s, max 30s)
14. Two apps from same workspace → second shows "Another upload app is already connected"
15. Pre-upload validation: incomplete listing → job skipped with error log
16. First-run legal warning: must check confirmation before any upload
17. Pause/Stop → queue halts. Start → resumes from next pending job

---

## Tech Design (Solution Architect)

> Decided: 2026-03-27 | Approved by user.

### A) Project Structure

**Location:** `desktop-app/` in monorepo (alongside `frontend-ui/` and `django-app/`)

```
desktop-app/
├── package.json                        # Electron + Playwright + React deps
├── electron-builder.yml                # Build config (Win + Mac installers)
├── tsconfig.json
├── src/
│   ├── main/                           # Electron main process
│   │   ├── index.ts                    # App entry, tray icon, window management
│   │   ├── tray.ts                     # System tray icon + menu
│   │   ├── auto-updater.ts            # electron-updater check + prompt
│   │   └── ipc-handlers.ts            # IPC bridge (main ↔ renderer)
│   │
│   ├── services/                       # Core services (main process)
│   │   ├── websocket-client.ts         # WebSocket connection + reconnect
│   │   ├── queue-manager.ts            # Sequential job processing + scheduling
│   │   ├── settings-store.ts           # Encrypted credential storage (safeStorage)
│   │   ├── screenshot-manager.ts       # Failure screenshot capture + local storage
│   │   └── playwright/
│   │       ├── browser-manager.ts      # Chromium launch + session management
│   │       ├── mba-login.ts            # MBA authentication + session cookie cache
│   │       ├── human-filler.ts         # Streamed typing, Bezier mouse, Tab nav
│   │       ├── form-filler.ts          # MBA form field mapping + filling
│   │       ├── file-uploader.ts        # Design image upload via set_input_files
│   │       ├── asin-capturer.ts        # Post-submit ASIN extraction
│   │       ├── captcha-detector.ts     # CAPTCHA detection + pause + poll
│   │       └── selectors.ts            # MBA form selectors (updatable per marketplace)
│   │
│   ├── renderer/                       # Electron renderer (React UI)
│   │   ├── App.tsx                     # Main app shell
│   │   ├── pages/
│   │   │   ├── QueuePage.tsx           # Job queue overview + controls
│   │   │   ├── SettingsPage.tsx        # Server URL, credentials, delays
│   │   │   └── LogPage.tsx             # Error log + screenshots
│   │   ├── components/
│   │   │   ├── ConnectionStatus.tsx    # Connected/disconnected indicator
│   │   │   ├── JobCard.tsx             # Single job: thumbnail, status, ASIN, error
│   │   │   ├── QueueControls.tsx       # Start/Pause/Stop + Schedule picker
│   │   │   ├── ProgressBar.tsx         # Current upload step progress
│   │   │   ├── LegalWarning.tsx        # First-run dialog with checkbox
│   │   │   └── ValidationErrors.tsx    # Pre-upload validation results
│   │   └── hooks/
│   │       ├── useQueue.ts             # Queue state via IPC
│   │       ├── useConnection.ts        # WebSocket status via IPC
│   │       └── useSettings.ts          # Settings read/write via IPC
│   │
│   └── shared/
│       └── types.ts                    # Shared types (job, status, settings)
│
├── resources/                          # App icons, tray icons
└── build/                              # electron-builder output
```

---

### B) Communication Flow

```
PROJ-11 Web App                     Desktop Upload App
     │                                     │
     │  WebSocket (ws://server/ws/upload-app/)
     │  ──── new job payload ──────────▶   │
     │                                     ├── Queue Manager receives job
     │                                     ├── Validates listing_snapshot
     │                                     ├── Downloads design file
     │                                     ├── Playwright: login → fill → upload → capture ASIN
     │  ◀── status: "uploading" ─────────  │
     │  ◀── status: "completed" + ASIN ──  │
     │  ◀── status: "failed" + error ────  │
     │                                     │
     │  If CAPTCHA:                        │
     │  ◀── status: "captcha_detected" ──  │
     │       ... user solves manually ...   │
     │  ◀── status: "uploading" ─────────  │
```

---

### C) Tech Decisions

| Decision | Why |
|----------|-----|
| Standalone Electron app (not browser extension) | Playwright needs full browser control. Extensions can't automate form filling reliably. Electron = full Chromium + Node.js access |
| `desktop-app/` in monorepo | Shared TypeScript types with frontend. Simpler CI/CD. Single repo for team |
| Playwright (not Puppeteer/Selenium) | Best API for human-like input (keyboard.type with delay, mouse.move). Built-in CAPTCHA-friendly patterns. Cross-browser |
| Human-like filling (streamed typing, Bezier mouse) | Amazon detection avoidance. Instant fill() is easily detectable. Character-by-character + mouse curves mimics real user |
| Sequential uploads (not parallel) | Parallel = higher detection risk. Sequential + randomized delay = safer pattern |
| `safeStorage` for credentials | OS-level encryption (Keychain on Mac, DPAPI on Windows). Industry standard for Electron credential storage |
| WebSocket client (not HTTP polling) | Real-time job delivery + status reporting. PROJ-11 already has the WebSocket server |
| Selectors in separate file (`selectors.ts`) | MBA form layout can change. Centralized selectors = single file update on Amazon redesign |
| Session cookie reuse | Avoids re-login per upload. Cookie cached in Playwright BrowserContext. Auto-detect expiry |

---

### D) New Packages (desktop-app)

| Package | Purpose |
|---------|---------|
| `electron` | Desktop app shell |
| `electron-builder` | Build Windows + Mac installers |
| `electron-updater` | Auto-update check + prompt |
| `playwright` | Browser automation (Chromium) |
| `ws` | WebSocket client |
| `react` + `react-dom` | Renderer UI |
| `typescript` | Type safety |

---

### E) Infrastructure

| Change | Where |
|--------|-------|
| `desktop-app/` directory | Monorepo root |
| No Docker needed | Runs on user's machine, not server |
| No Django changes | Uses PROJ-11 WebSocket endpoint (already built) |
| GitHub Releases | Electron-builder publishes installers. Auto-updater checks releases |

## Future Enhancements

- Spreadshirt marketplace support (different form, same Playwright pattern)
- KDP (Kindle Direct Publishing) support for book covers
- Browser Extension alternative (lighter than Electron, for users who don't want to install an app)
- Amazon Sales Data scraping from Seller Central (Extension, reuses login session)
- Parallel uploads (multiple browser contexts) — risky for detection, but possible
