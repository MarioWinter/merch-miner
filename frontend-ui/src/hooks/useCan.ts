/**
 * PROJ-31 — `useCan(feature)` hook.
 *
 * Returns `true` when the current user has the given feature key in their
 * resolved entitlement list (from `/api/auth/me/`). Handles the wildcard
 * `'*'` which is granted to superusers (see `core/entitlements.py`).
 *
 * Frontend hide is UX-only — every protected endpoint MUST also enforce
 * the equivalent check via the backend `HasFeature` permission class.
 */
import { useAppSelector } from '@/store/hooks';

export const useCan = (feature: string): boolean => {
  const features = useAppSelector((s) => s.auth.user?.features);
  if (!features || features.length === 0) return false;
  return features.includes('*') || features.includes(feature);
};
