import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setActiveBatch } from '@/store/upscaleSlice';
import { useLazyGetBatchStatusQuery } from '@/store/upscaleApi';

/**
 * One-shot verification on app mount: if the upscale slice was rehydrated
 * with an activeBatchId from localStorage, hit the server to confirm the
 * batch is still active. If 404 (canceled / pruned) OR is_terminal=true
 * (already finished while tab was closed), clear the slice so the topbar
 * pill doesn't show stale state.
 *
 * Mounted once at the App level. Subsequent activeBatchId changes during
 * the session are managed by the bulk-trigger flow.
 */
export const useVerifyActiveBatch = () => {
  const dispatch = useAppDispatch();
  const activeBatchId = useAppSelector((s) => s.upscale.activeBatchId);
  const [fetchBatch] = useLazyGetBatchStatusQuery();

  useEffect(() => {
    if (!activeBatchId) return;
    let cancelled = false;
    void fetchBatch(activeBatchId)
      .unwrap()
      .then((batch) => {
        if (cancelled) return;
        if (batch.is_terminal) {
          dispatch(setActiveBatch(null));
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = (err as { status?: number })?.status;
        if (status === 404) {
          dispatch(setActiveBatch(null));
        }
        // Other errors (network down) → leave activeBatchId; user retry on next mount.
      });
    return () => {
      cancelled = true;
    };
    // Intentionally only on mount — re-runs only when activeBatchId changes
    // due to user action (which already implies it's valid).
  }, [activeBatchId, dispatch, fetchBatch]);
};
