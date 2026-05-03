/**
 * PROJ-24 — Static (non-React) feature flag resolver.
 *
 * Resolves a feature flag from `import.meta.env.VITE_FF_<FLAG>` with
 * fallback to `fallbackFlags`. Use this in non-component contexts (router
 * config, module-level constants, plain utilities) where the React tree —
 * and therefore Redux + admin-override — is unavailable.
 *
 * Resolution order:
 *   1. `import.meta.env[`VITE_FF_${flag}`]` literal `'true'`  → true
 *   2. `import.meta.env[`VITE_FF_${flag}`]` literal `'false'` → fallback (false by convention)
 *   3. Missing / unknown value                                → fallback + DEV warn
 */
import { fallbackFlags, type FeatureFlag } from '../constants/featureFlags';

export const getStaticFlag = (flag: FeatureFlag): boolean => {
  const envKey = `VITE_FF_${flag}`;
  const env = import.meta.env as Record<string, string | undefined>;
  const raw = env[envKey];

  if (raw === 'true') {
    return true;
  }
  if (raw === 'false' || raw === undefined || raw === '') {
    return fallbackFlags[flag];
  }

  if (import.meta.env.DEV) {
    console.warn(
      `[featureFlags] Malformed value for ${envKey}: "${raw}". ` +
        `Expected literal 'true' or 'false'. Falling back to ${fallbackFlags[flag]}.`,
    );
  }
  return fallbackFlags[flag];
};
