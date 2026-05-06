import { useCallback, useState } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { openNicheCreate, openNicheEdit } from '@/store/chatBarSlice';

type SwitchTarget = string | 'create';

interface UseNichePipelineSwitchOptions {
  isDirty: boolean;
  setUnsavedDialogOpen: (open: boolean) => void;
  discardAndClose: () => void;
}

/**
 * Adapter around the existing unsaved-changes dialog to also handle the
 * niche-selector header dropdown:
 *
 * - If the form is clean, dispatch the switch immediately.
 * - If dirty, stash the target and open the existing unsaved-changes dialog.
 *   When the user confirms "Discard" the queued switch executes; if they
 *   cancel, the queued switch is cleared so a later X-close behaves normally.
 *
 * Returns:
 * - `requestSwitchToNiche(id)` and `requestSwitchToCreate()` for the header.
 * - `unsavedConfirmAction` to override the dialog's discard handler when a
 *   switch is queued (consumer passes it to `<PipelineConfirmDialogs/>`).
 * - `wrappedSetUnsavedDialogOpen` so cancelling the dialog also clears the
 *   pending switch.
 */
export const useNichePipelineSwitch = ({
  isDirty,
  setUnsavedDialogOpen,
  discardAndClose,
}: UseNichePipelineSwitchOptions) => {
  const dispatch = useAppDispatch();
  const [pendingSwitch, setPendingSwitch] = useState<SwitchTarget | null>(null);

  const performSwitch = useCallback(
    (target: SwitchTarget) => {
      if (target === 'create') dispatch(openNicheCreate());
      else dispatch(openNicheEdit(target));
    },
    [dispatch],
  );

  const requestSwitchToNiche = useCallback(
    (id: string) => {
      if (isDirty) {
        setPendingSwitch(id);
        setUnsavedDialogOpen(true);
      } else {
        performSwitch(id);
      }
    },
    [isDirty, performSwitch, setUnsavedDialogOpen],
  );

  const requestSwitchToCreate = useCallback(() => {
    if (isDirty) {
      setPendingSwitch('create');
      setUnsavedDialogOpen(true);
    } else {
      performSwitch('create');
    }
  }, [isDirty, performSwitch, setUnsavedDialogOpen]);

  const confirmUnsavedSwitch = useCallback(() => {
    if (pendingSwitch === null) {
      discardAndClose();
      return;
    }
    const target = pendingSwitch;
    setPendingSwitch(null);
    setUnsavedDialogOpen(false);
    performSwitch(target);
  }, [pendingSwitch, discardAndClose, performSwitch, setUnsavedDialogOpen]);

  const wrappedSetUnsavedDialogOpen = useCallback(
    (open: boolean) => {
      if (!open) setPendingSwitch(null);
      setUnsavedDialogOpen(open);
    },
    [setUnsavedDialogOpen],
  );

  return {
    requestSwitchToNiche,
    requestSwitchToCreate,
    pendingSwitch,
    unsavedConfirmAction: pendingSwitch !== null ? confirmUnsavedSwitch : undefined,
    wrappedSetUnsavedDialogOpen,
  };
};
