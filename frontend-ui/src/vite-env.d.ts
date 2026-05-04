/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** SemVer string injected by Vite at build time from `package.json#version`. */
  readonly APP_VERSION: string
  /** ISO 8601 UTC timestamp injected by Vite at build time. */
  readonly BUILD_DATE: string
  /** Backend base URL — set per environment. */
  readonly VITE_API_URL?: string
  /** OneDrive (MSAL public client) — frontend-only OAuth flow. */
  readonly VITE_ONEDRIVE_CLIENT_ID?: string
  /** Vite dev server proxy target — used by `npm run dev` only. */
  readonly VITE_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
