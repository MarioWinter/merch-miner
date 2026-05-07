/**
 * PROJ-24 — Feature Flag definitions.
 *
 * Frontend build-time feature flags. Each flag is overridable via
 * `import.meta.env.VITE_FF_<FLAG_NAME>` (string literal `'true'` enables it,
 * anything else falls back to the value defined in `fallbackFlags`).
 *
 * Flags catalogue:
 *  - `REGISTRATION_ENABLED`   — public sign-up link + `/register` route. Off
 *    during BETA so admins onboard testers manually via Django Admin. NOTE:
 *    this flag is exempt from the admin-override in `useFeatureFlag` because
 *    the Login page has no logged-in user; gate the route via
 *    `getStaticFlag` instead.
 *  - `CLOUD_STORAGE_ENABLED`  — OneDrive + Google Drive importers (PROJ-9 / PROJ-11).
 *    Off until cloud-picker UX is finalized.
 *  - `DESKTOP_UPLOAD_APP_ENABLED` — Electron Desktop Upload App entry-points
 *    (PROJ-13). Off until the desktop binary ships.
 *  - `KANBAN_ENABLED`         — Team Kanban view (PROJ-14). Off until the
 *    collaboration board is feature-complete.
 *  - `MULTI_MARKETPLACE_ENABLED` — Selectable Amazon marketplaces other than
 *    amazon_com (DE / UK / FR / IT / ES). Off until per-marketplace selectors
 *    are wired into the spider; non-US options render disabled in dropdowns.
 *  - `KEYWORD_ENRICH_ENABLED` — JungleScout keyword-enrich UI (single-row +
 *    bulk Enrich button). Off until the JS API key is provisioned in the
 *    backend env; without the key the enrich endpoint returns 400.
 *
 * Convention: every flag added here MUST also have a default value in
 * `fallbackFlags` (TypeScript will fail to compile otherwise via
 * `Record<FeatureFlag, boolean>`).
 */
export const FEATURE_FLAGS = {
  REGISTRATION_ENABLED: 'REGISTRATION_ENABLED',
  CLOUD_STORAGE_ENABLED: 'CLOUD_STORAGE_ENABLED',
  DESKTOP_UPLOAD_APP_ENABLED: 'DESKTOP_UPLOAD_APP_ENABLED',
  KANBAN_ENABLED: 'KANBAN_ENABLED',
  MULTI_MARKETPLACE_ENABLED: 'MULTI_MARKETPLACE_ENABLED',
  KEYWORD_ENRICH_ENABLED: 'KEYWORD_ENRICH_ENABLED',
} as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

/**
 * Default values used when no env override is present (or the override is
 * malformed). All flags ship default-OFF in MVP — operators flip them on per
 * environment via `.env` + redeploy.
 */
export const fallbackFlags: Readonly<Record<FeatureFlag, boolean>> = {
  [FEATURE_FLAGS.REGISTRATION_ENABLED]: false,
  [FEATURE_FLAGS.CLOUD_STORAGE_ENABLED]: false,
  [FEATURE_FLAGS.DESKTOP_UPLOAD_APP_ENABLED]: false,
  [FEATURE_FLAGS.KANBAN_ENABLED]: false,
  [FEATURE_FLAGS.MULTI_MARKETPLACE_ENABLED]: false,
  [FEATURE_FLAGS.KEYWORD_ENRICH_ENABLED]: false,
};
