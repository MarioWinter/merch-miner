/**
 * PROJ-31 — Pre-auth Google OAuth toggle. Same pattern as
 * `isRegistrationEnabled`: build-time ENV (`VITE_ENABLE_GOOGLE_LOGIN=true`)
 * because the Login page renders before any user is authenticated, so the
 * entitlement system cannot apply.
 */
export const isGoogleLoginEnabled = (): boolean => {
  const env = import.meta.env as Record<string, string | undefined>;
  return env.VITE_ENABLE_GOOGLE_LOGIN === 'true';
};
