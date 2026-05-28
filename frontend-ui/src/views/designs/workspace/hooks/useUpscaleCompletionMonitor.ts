import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { recordCompletion } from '@/store/upscaleSlice';
import type { Design } from '../../board/types';
import type { WorkspaceTab } from './useWorkspaceTab';

interface UseUpscaleCompletionMonitorArgs {
  designs: Design[] | undefined;
  activeTab: WorkspaceTab;
}

/**
 * Phase-10 fix — workspace-level upscale watcher.
 *
 * Two responsibilities folded into one hook because they share `lastCompletion`:
 *
 * 1. Per-id baseline monitor: while `processingDesignIds` is non-empty, watch
 *    `boardData.designs` for an `upscaled_file` change relative to the
 *    baseline observed when the id first entered the set. On change,
 *    dispatch `recordCompletion`; the slice reducer also clears the id from
 *    `processingDesignIds`, which removes the shimmer overlay on the canvas.
 *    This survives Editor↔Canvas tab switches that would otherwise unmount
 *    `useUpscaleSingle`.
 *
 * 2. Cross-tab snackbar: react to `lastCompletion` (deduped by ts) and fire
 *    the appropriate same-tab vs cross-tab snackbar based on `activeTab`,
 *    so the user is informed regardless of which tab is showing.
 */
export const useUpscaleCompletionMonitor = ({
  designs,
  activeTab,
}: UseUpscaleCompletionMonitorArgs): void => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();
  const processingDesignIds = useAppSelector(
    (s) => s.upscale.processingDesignIds,
  );
  const lastCompletion = useAppSelector((s) => s.upscale.lastCompletion);

  // -- Baseline monitor --
  const baselinesRef = useRef<Map<string, string | null>>(new Map());
  useEffect(() => {
    if (!designs) return;
    const baselines = baselinesRef.current;
    for (const id of processingDesignIds) {
      const d = designs.find((x) => x.id === id);
      if (!d) continue;
      if (!baselines.has(id)) {
        baselines.set(id, d.upscaled_file ?? null);
        continue;
      }
      const current = d.upscaled_file ?? null;
      const baseline = baselines.get(id) ?? null;
      if (current && current !== baseline) {
        baselines.delete(id);
        dispatch(
          recordCompletion({
            designId: id,
            kind: 'success',
            ts: Date.now(),
          }),
        );
      }
    }
    for (const id of Array.from(baselines.keys())) {
      if (!processingDesignIds.includes(id)) baselines.delete(id);
    }
  }, [designs, processingDesignIds, dispatch]);

  // -- Snackbar reactor --
  const handledTsRef = useRef<number | null>(null);
  useEffect(() => {
    if (!lastCompletion) return;
    if (handledTsRef.current === lastCompletion.ts) return;
    handledTsRef.current = lastCompletion.ts;
    const onEditorTab = activeTab === 'editor';
    if (lastCompletion.kind === 'success') {
      enqueueSnackbar(
        onEditorTab
          ? t('upscale.single.success', { defaultValue: 'Upscaled to 4500×5400' })
          : t('upscale.single.successCrossTab', { defaultValue: 'Upscale completed' }),
        { variant: 'success' },
      );
      return;
    }
    if (lastCompletion.reason === 'timeout') {
      enqueueSnackbar(
        t('upscale.single.timeout', {
          defaultValue: 'Upscale is taking longer than expected — check back later.',
        }),
        { variant: 'warning' },
      );
      return;
    }
    enqueueSnackbar(
      onEditorTab
        ? t('upscale.single.error', { defaultValue: 'Failed to start upscale' })
        : t('upscale.single.errorCrossTab', { defaultValue: 'Upscale failed' }),
      { variant: 'error' },
    );
  }, [activeTab, enqueueSnackbar, lastCompletion, t]);
};

export default useUpscaleCompletionMonitor;
