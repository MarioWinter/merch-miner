import { useCallback, useEffect, useRef, useState } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useDeleteDesignVersionMutation } from '@/store/designSlice';
import type { VersionSlot } from './useArtboardVersionSync';

export type PendingKey = `${string}:${VersionSlot}`;

interface UsePendingDeletionsReturn {
  pendingKeys: Set<PendingKey>;
  isPending: (designId: string, slot: VersionSlot) => boolean;
  requestDelete: (designId: string, slot: VersionSlot, projectId?: string) => void;
  undoDelete: (designId: string, slot: VersionSlot) => void;
}

const DELETE_DELAY_MS = 5000;

const makeKey = (designId: string, slot: VersionSlot): PendingKey =>
  `${designId}:${slot}` as PendingKey;

/**
 * Deferred-delete pattern with Undo window. When `requestDelete` is called,
 * the slot is marked pending and the chip should hide. If `undoDelete`
 * runs within 5s no backend call fires. Otherwise the timeout calls
 * `deleteDesignVersion` and clears the entry.
 */
export const usePendingDeletions = (): UsePendingDeletionsReturn => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [deleteDesignVersion] = useDeleteDesignVersionMutation();
  const [pendingKeys, setPendingKeys] = useState<Set<PendingKey>>(new Set());
  const timeoutsRef = useRef<Map<PendingKey, ReturnType<typeof setTimeout>>>(new Map());

  const clearKey = useCallback((key: PendingKey) => {
    setPendingKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    const handle = timeoutsRef.current.get(key);
    if (handle !== undefined) {
      clearTimeout(handle);
      timeoutsRef.current.delete(key);
    }
  }, []);

  const requestDelete = useCallback(
    (designId: string, slot: VersionSlot, projectId?: string) => {
      const key = makeKey(designId, slot);
      // Replace any pre-existing timer for the same slot (prevents double-fires).
      const existing = timeoutsRef.current.get(key);
      if (existing !== undefined) clearTimeout(existing);

      setPendingKeys((prev) => {
        if (prev.has(key)) return prev;
        const next = new Set(prev);
        next.add(key);
        return next;
      });

      const handle = setTimeout(() => {
        deleteDesignVersion({ designId, version: slot, projectId })
          .unwrap()
          .catch(() => {
            enqueueSnackbar(t('design.versions.deleteFailed'), { variant: 'error' });
          })
          .finally(() => {
            clearKey(key);
          });
      }, DELETE_DELAY_MS);
      timeoutsRef.current.set(key, handle);
    },
    [deleteDesignVersion, enqueueSnackbar, t, clearKey],
  );

  const undoDelete = useCallback(
    (designId: string, slot: VersionSlot) => {
      clearKey(makeKey(designId, slot));
    },
    [clearKey],
  );

  const isPending = useCallback(
    (designId: string, slot: VersionSlot) => pendingKeys.has(makeKey(designId, slot)),
    [pendingKeys],
  );

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      for (const handle of timeouts.values()) clearTimeout(handle);
      timeouts.clear();
    };
  }, []);

  return { pendingKeys, isPending, requestDelete, undoDelete };
};

export default usePendingDeletions;
