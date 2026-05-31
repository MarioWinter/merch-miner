/**
 * Single source of truth for superuser-gated UI (FIX-dashboard Item 5).
 *
 * Reads `state.auth.user.is_superuser` from Redux and coerces any
 * undefined / null / loading-state value to `false` (fail-closed).
 * Use this hook everywhere instead of inlining the selector so all
 * superuser-gated UI flips together when auth state changes.
 */
import { useAppSelector } from '@/store/hooks';

export const useIsSuperuser = (): boolean => {
  return useAppSelector((s) => Boolean(s.auth.user?.is_superuser));
};
