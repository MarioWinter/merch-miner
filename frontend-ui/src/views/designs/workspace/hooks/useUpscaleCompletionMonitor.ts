import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { recordCompletion } from '@/store/upscaleSlice';
import type { Design } from '../../board/types';
import type { WorkspaceTab } from './useWorkspaceTab';

interface UseUpscaleCompletionMonitorArgs {
  designs: Design[] | undefined;
  /**
   * Retained for backward compatibility with `DesignWorkspaceView`. The
   * workspace tab no longer influences this hook — completion snackbars are
   * fired by the app-level `useGlobalUpscaleNotifications` so they show up
   * regardless of which view the user navigated to.
   */
  activeTab?: WorkspaceTab;
}

/**
 * Workspace-level baseline monitor for single-design upscales.
 *
 * Watches `boardData.designs[*].upscaled_file` against the baseline observed
 * when each id first entered `processingDesignIds`. When the file flips, we
 * dispatch `recordCompletion`; the slice reducer also removes the id from the
 * processing set, which clears the canvas shimmer overlay even when the hook
 * that started the upscale (`useUpscaleSingle` inside the Editor) has since
 * unmounted.
 *
 * History — Phase B of FIX-canvas-editor-bugs-and-image-gen stripped the
 * snackbar reactor out of this hook. The snackbar moved to
 * `useGlobalUpscaleNotifications` (mounted in `App.tsx`) so that completions
 * surface even when the user has navigated away from the workspace entirely.
 */
export const useUpscaleCompletionMonitor = ({
  designs,
}: UseUpscaleCompletionMonitorArgs): void => {
  const dispatch = useAppDispatch();
  const processingDesignIds = useAppSelector(
    (s) => s.upscale.processingDesignIds,
  );

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
            // Workspace-level monitor has the design list but no per-design
            // projectId hand-off; the global notification hook falls back to
            // an action-less snackbar when projectId is null.
            projectId: null,
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
};

export default useUpscaleCompletionMonitor;
