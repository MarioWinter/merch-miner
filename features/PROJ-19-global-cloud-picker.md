# PROJ-19: Global Cloud Picker

## Status: Planned
**Created:** 2026-04-06
**Last Updated:** 2026-04-06

## Dependencies
- Requires: PROJ-9 (Design Generation) — Cloud Manager exists in Design Editor, will be extracted
- Requires: PROJ-1 (User Auth) — logged-in user for OAuth2 cloud connections

## Summary

Extract the Cloud Manager from the Design Editor (PROJ-9) into a **global, reusable Cloud Picker** component. Currently the Cloud Manager is tightly coupled to the Image Editor — it should be callable from any context in the app (Editor, Listings, Drawer, future features).

**Architecture: Hybrid (Settings + Picker)**
- **Cloud connections** (Connect/Disconnect, account status) → central App Settings page
- **Cloud Picker** → global dialog, callable from any view with context-specific actions
- **File filtering** → shows all folders for navigation, but only image files (PNG, JPG, JPEG, WebP, SVG)

## User Stories

- As a POD seller, I want to connect my OneDrive/Google Drive once in Settings and use it everywhere in the app, so I don't have to reconnect in each feature
- As a designer, I want to browse my cloud folders and pick images for the Design Editor, so I can import reference images or designs from my cloud storage
- As a listing creator, I want to attach product images from my cloud storage to a listing, so I don't have to download and re-upload files
- As a user, I want to see only image files (PNG, JPG, WebP, SVG) in the picker but navigate all folders, so the view is clean and relevant
- As a user, I want to upload generated designs from the app back to a specific cloud folder, so my cloud storage stays organized

## Acceptance Criteria

- [ ] AC-1: Cloud connection management (Connect/Disconnect, account email, status) is in the central App Settings page, not in the Editor
- [ ] AC-2: `CloudPicker` is a global reusable component in `components/CloudPicker/`, not in `views/designs/editor/`
- [ ] AC-3: CloudPicker shows all folders (full tree navigation via breadcrumbs) but filters files to images only (PNG, JPG, JPEG, WebP, SVG)
- [ ] AC-4: CloudPicker accepts a `context` prop that determines available actions (e.g. "Use for AI", "Attach to Listing", "Download")
- [ ] AC-5: CloudPicker works with both Google Drive and OneDrive (tabbed UI, same as current)
- [ ] AC-6: Cloud hooks (`useGoogleDrive`, `useOneDrive`) are moved to a global location (`hooks/` or `components/CloudPicker/hooks/`)
- [ ] AC-7: Design Editor still works — it calls the global CloudPicker instead of the old CloudManagerDialog
- [ ] AC-8: Auth state (connected account) persists across page navigation (localStorage via MSAL / gapi)
- [ ] AC-9: Folder listing is non-recursive — only current folder contents, user navigates manually
- [ ] AC-10: Multi-select with bulk actions (Download Selected, Use Selected)
- [ ] AC-11: Upload from app to cloud folder works (select target folder → upload)
- [ ] AC-12: SVG files are included in the file filter (in addition to PNG, JPG, JPEG, WebP)

## Edge Cases

- [ ] EC-1: Cloud provider not configured (env vars missing) → show "Not Configured" hint with setup instructions
- [ ] EC-2: OAuth token expired during browsing → silent refresh, fallback to re-auth popup
- [ ] EC-3: User disconnects cloud in Settings while CloudPicker is open → picker resets to disconnected state
- [ ] EC-4: Empty folder → show "No images in this folder" message, still show subfolders
- [ ] EC-5: File exceeds max size (25MB) → file is hidden from the list (not shown, no error)
- [ ] EC-6: Network error during folder listing → show error alert, allow retry
- [ ] EC-7: User tries to upload file with same name as existing file in cloud folder → overwrite (OneDrive/GDrive default behavior)

## Technical Requirements

- No backend changes — all cloud access is client-side (Graph API / Drive API)
- MSAL redirect bridge (`auth-redirect.html`) stays in `public/`
- Env vars: `VITE_ONEDRIVE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY`
- Performance: folder listing < 2s for folders with up to 200 items

## Future Scope (NOT in this PROJ)

> **Drawer Integration:** The CloudPicker may be integrated into the multi-purpose Drawer (PROJ-17 Deep Web Search defines a floating chat-bar + drawer pattern). Planning needed to define how CloudPicker fits into the Drawer UX — should it be a Drawer tab, a sub-panel, or triggered from within the Drawer? This needs a dedicated planning session.

> **Additional Contexts:** As new features are built (Kanban, Publish, Agent), more caller contexts will be added to the CloudPicker. The `context` prop pattern should make this extensible without changing the CloudPicker itself.

> **Thumbnail Previews:** Currently no thumbnails are shown in the file table. Future: fetch thumbnail URLs from Graph API / Drive API and show 48px previews.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
