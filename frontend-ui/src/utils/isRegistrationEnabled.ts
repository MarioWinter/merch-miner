/**
 * PROJ-31 — Pre-auth registration toggle.
 *
 * Special-case helper. Registration gating runs BEFORE login, so the runtime
 * entitlement system (`useCan` reading `/api/auth/me/`) cannot be used here:
 * there is no authenticated user. This single flag remains build-time, driven
 * by `VITE_ENABLE_REGISTRATION` ('true' enables — anything else disables).
 *
 * Why a helper and not direct `import.meta.env` access at callsites:
 *   - Single place to interpret/log malformed values
 *   - One grep target (`isRegistrationEnabled`) for future migrations
 */
export const isRegistrationEnabled = (): boolean => {
  const env = import.meta.env as Record<string, string | undefined>;
  return env.VITE_ENABLE_REGISTRATION === 'true';
};
