/**
 * PROJ-24 — Feature flag hook (admin-aware).
 *
 * Resolution order:
 *   1. Admin-override — if the current Redux user has `is_staff === true`
 *      OR `is_superuser === true`, every flag returns `true` (env-var +
 *      fallback ignored). Lets admins dogfood gated features in prod.
 *   2. `getStaticFlag(flag)` — env-var (`VITE_FF_<FLAG>`) → fallback.
 *
 * EXEMPTION (AC-20d): `REGISTRATION_ENABLED` ignores the admin-override.
 * Rationale: the registration link/route is rendered on the unauthenticated
 * Login page where no user object exists, so admin context cannot be
 * established. Admins onboard via Django Admin during BETA.
 */
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { FEATURE_FLAGS, type FeatureFlag } from '../constants/featureFlags';
import { getStaticFlag } from '../utils/getStaticFlag';

export const useFeatureFlag = (flag: FeatureFlag): boolean => {
  const user = useSelector((state: RootState) => state.auth.user);

  // AC-20d — REGISTRATION_ENABLED is exempt from admin-override; route gating
  // happens via getStaticFlag in router config anyway, so the hook should
  // mirror that behavior on the Login page.
  if (flag === FEATURE_FLAGS.REGISTRATION_ENABLED) {
    return getStaticFlag(flag);
  }

  if (user?.is_staff === true || user?.is_superuser === true) {
    return true;
  }

  return getStaticFlag(flag);
};
