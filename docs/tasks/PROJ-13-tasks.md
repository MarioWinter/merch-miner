# PROJ-13: Desktop Upload App (Electron + Playwright) — Implementation Tasks

## Key Technical Decisions (from architecture review 2026-03-27)

- **Standalone Electron app** in `desktop-app/` (monorepo, alongside `frontend-ui/` and `django-app/`)
- **Playwright** for MBA form automation — human-like typing, Bezier mouse, Tab navigation
- **Sequential uploads** with randomized delay (30-120s) — safer than parallel
- **`safeStorage`** for encrypted credential storage (OS-level: Keychain/DPAPI)
- **WebSocket client** (`ws` package) — real-time job delivery from PROJ-11
- **Selectors in separate file** — updatable on Amazon form redesign without app rebuild
- **Session cookie reuse** — avoid re-login per upload, auto-detect expiry
- **No Django changes** — uses PROJ-11 WebSocket endpoint

---

## Phase 1: Electron App Shell

- [ ] Initialize `desktop-app/` with `package.json`, `tsconfig.json`, `electron-builder.yml`
- [ ] Electron main process entry (`src/main/index.ts`): create BrowserWindow, load renderer
- [ ] System tray icon (`src/main/tray.ts`): icon, context menu (Show/Hide, Start/Pause/Stop, Quit)
- [ ] IPC handlers (`src/main/ipc-handlers.ts`): bridge main ↔ renderer for settings, queue, connection status
- [ ] Auto-updater (`src/main/auto-updater.ts`): check GitHub Releases on startup, prompt user to update
- [ ] Window management: minimize to tray, restore on tray click, close = minimize (not quit)
- [ ] App icon + tray icon resources (`resources/`)

---

## Phase 2: Settings & Credential Storage

- [ ] `services/settings-store.ts`: read/write settings to local JSON file (non-sensitive) + `safeStorage` (credentials)
- [ ] Settings: server URL, workspace auth token, MBA email/password (encrypted), upload delay min/max (default 30-120s), auto-start on boot toggle, headless mode toggle
- [ ] First-run detection: if no settings → show Settings page on first launch
- [ ] Legal warning dialog (`renderer/components/LegalWarning.tsx`): "Automated uploads may violate Amazon TOS" + confirmation checkbox. Stored in settings. Must be checked before any upload

---

## Phase 3: WebSocket Client

- [ ] `services/websocket-client.ts`: connects to `ws://server/ws/upload-app/` with workspace auth token
- [ ] Authentication: send token on connect, server validates workspace membership
- [ ] Receive new upload jobs: parse job payload (listing_snapshot, design_file_url, template, marketplace)
- [ ] Send status updates: per-step progress (logging_in, filling_form, uploading_file, submitting, completed, failed, captcha_detected)
- [ ] Send ASIN on success, error message + screenshot URL on failure
- [ ] Auto-reconnect with exponential backoff (1s, 2s, 4s, max 30s)
- [ ] Connection status exposed via IPC to renderer
- [ ] Handle "Another app already connected" message from server → show in UI

---

## Phase 4: Queue Manager

- [ ] `services/queue-manager.ts`: maintains ordered job list (pending, active, completed, failed)
- [ ] Sequential processing: one job at a time, wait for completion before next
- [ ] Randomized delay between uploads: configurable range (default 30-120s)
- [ ] Start/Pause/Stop controls: Pause = finish current job, don't start next. Stop = abort current + pause
- [ ] Schedule: "Start at [time]" — timer waits until scheduled time, then starts queue
- [ ] Add/remove jobs in real-time (via WebSocket)
- [ ] Pre-upload validation per job: check listing_snapshot complete, design_file_url accessible, marketplace set. Skip invalid with error
- [ ] Expose queue state via IPC to renderer

---

## Phase 5: Playwright — Browser Manager + MBA Login

- [ ] `services/playwright/browser-manager.ts`: launch Chromium (visible or headless per settings). Persistent BrowserContext for session cookie reuse
- [ ] `services/playwright/mba-login.ts`: navigate to MBA login page, fill email/password with human-like typing, handle 2FA if present
- [ ] Session cookie cache: reuse across uploads in same BrowserContext. Auto-detect expiry (redirect to login page) → re-login
- [ ] Re-login failure (credentials changed) → pause queue, notify user via IPC
- [ ] `services/playwright/selectors.ts`: centralized MBA form selectors per marketplace. Separate object per marketplace (amazon_com, amazon_de, etc.)

---

## Phase 6: Playwright — Human-Like Form Filling

- [ ] `services/playwright/human-filler.ts`: core utility for human-like input
- [ ] Streamed typing: character-by-character, 50-150ms random delay per character (not `fill()`)
- [ ] Bezier mouse movements: smooth curves between fields, realistic speed (not instant teleport)
- [ ] Tab-key navigation: Tab between fields instead of clicking each one
- [ ] Section pauses: 1-3s randomized delay between form sections
- [ ] Smooth scrolling: scroll to element position, not instant jump
- [ ] `services/playwright/form-filler.ts`: MBA-specific form mapping — maps listing_snapshot fields to MBA form selectors. Calls human-filler for each field
- [ ] `services/playwright/file-uploader.ts`: `page.setInputFiles()` for design image upload. Download design from URL to temp file first

---

## Phase 7: Playwright — ASIN Capture + CAPTCHA

- [ ] `services/playwright/asin-capturer.ts`: after form submission → wait for confirmation/success page → extract ASIN from page content or URL
- [ ] `services/playwright/captcha-detector.ts`: check for known CAPTCHA elements after navigation/submission
- [ ] CAPTCHA handling: pause queue → bring browser window to foreground → desktop notification "CAPTCHA detected" → poll page every 2s for resolution → when resolved, continue upload
- [ ] CAPTCHA timeout: if not solved within 10 minutes → mark job failed ("CAPTCHA timeout"), move to next job
- [ ] `services/screenshot-manager.ts`: on any failure → capture full-page screenshot → save to local temp folder → return file path for upload to server

---

## Phase 8: Error Handling + Retry

- [ ] On upload failure: capture screenshot → save locally → report error + screenshot to server via WebSocket
- [ ] Auto-retry: 1 retry after 60s delay. If retry also fails → mark failed, move to next job
- [ ] MBA session expired mid-upload → attempt re-login. If fails → pause queue, notify user
- [ ] Internet connection lost → Playwright timeout → job fails, auto-retry on reconnect
- [ ] App closed during upload → on next startup, mark interrupted job as failed, resume queue from next pending

---

## Phase 9: Renderer UI (React)

- [ ] `renderer/App.tsx`: app shell with sidebar navigation (Queue, Settings, Log)
- [ ] `renderer/pages/QueuePage.tsx`: job list with status, design thumbnail, marketplace, ASIN. Current upload progress bar showing active step
- [ ] `renderer/pages/SettingsPage.tsx`: server URL, credentials (masked), delay range sliders, headless toggle, auto-start toggle, legal warning status
- [ ] `renderer/pages/LogPage.tsx`: error log list with timestamps, error messages, screenshot links (open local file)
- [ ] `renderer/components/ConnectionStatus.tsx`: green/red indicator + "Connected to {server}" / "Disconnected"
- [ ] `renderer/components/JobCard.tsx`: design thumbnail, name, marketplace flag, status chip, ASIN (if completed), error summary (if failed)
- [ ] `renderer/components/QueueControls.tsx`: Start/Pause/Stop buttons + Schedule time picker
- [ ] `renderer/components/ProgressBar.tsx`: current job steps: Logging in → Filling form → Uploading file → Submitting → Capturing ASIN
- [ ] `renderer/components/ValidationErrors.tsx`: pre-upload validation results (missing fields highlighted)
- [ ] `renderer/hooks/useQueue.ts`: queue state via IPC from main process
- [ ] `renderer/hooks/useConnection.ts`: WebSocket status via IPC
- [ ] `renderer/hooks/useSettings.ts`: settings read/write via IPC

---

## Phase 10: Build & Distribution

- [ ] `electron-builder.yml`: configure Windows (NSIS installer) + Mac (DMG) targets
- [ ] App signing config (code signing certificate for Mac + Windows)
- [ ] Auto-updater config: point to GitHub Releases
- [ ] GitHub Actions workflow: build on push to `desktop-app/` → publish installers as GitHub Release
- [ ] README with install instructions

---

## Phase 11: Tests

- [ ] WebSocket client: connect, receive job, send status, reconnect on disconnect
- [ ] Queue manager: sequential processing, pause/stop/resume, schedule, validation
- [ ] Settings store: read/write, encrypted credentials, legal warning flag
- [ ] Human-filler: typing delay within range, mouse movement generates Bezier points
- [ ] Form filler: maps listing_snapshot fields to selectors correctly
- [ ] CAPTCHA detector: identifies CAPTCHA elements, pause/resume flow
- [ ] Screenshot manager: captures and saves screenshot on failure
- [ ] Renderer: QueuePage renders jobs, SettingsPage saves settings, ConnectionStatus reflects state
- [ ] Build: Windows + Mac installers build successfully

---

## Verification Checklist

- [ ] Electron app installs and launches (Mac + Windows)
- [ ] System tray icon with context menu
- [ ] WebSocket connects to PROJ-11 server, receives jobs
- [ ] MBA login with session cookie reuse
- [ ] Human-like form filling (typing delay, mouse curves, Tab nav)
- [ ] Design file uploaded via Playwright
- [ ] ASIN captured and reported to server
- [ ] CAPTCHA detection pauses queue, manual solve continues
- [ ] Screenshot on failure, auto-retry once
- [ ] Schedule uploads for specific time
- [ ] Legal warning on first run
- [ ] Pre-upload validation skips invalid jobs
- [ ] Auto-updater checks GitHub Releases
- [ ] All tests pass
