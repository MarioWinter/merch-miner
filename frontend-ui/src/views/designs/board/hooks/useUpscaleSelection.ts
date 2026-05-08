import { useCallback, useState } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useGetQuotaQuery } from '@/store/upscaleApi';
import {
  setCloudTarget as setCloudTargetAction,
} from '@/store/upscaleSlice';
import type { UpscaleCloudTarget } from '@/store/upscaleApi';
import { useUpscaleBatch } from './useUpscaleBatch';

// -----------------------------------------------------------------
// Shared upscale-selection logic — used by both PanelMultiState
// (multi-select) and PanelArtboardState (single-select). Both panels
// render their own icon button + the destination/quota inline section,
// while the dialogs live with the consuming panel as JSX.
// -----------------------------------------------------------------

interface UseUpscaleSelectionArgs {
  /** All eligible upscalable design IDs from the current selection. */
  designIds: string[];
  /**
   * Whether the selection contains AI-linked designs that *might* already
   * have an upscaled_file. Triggers the Re-Upscale confirm dialog. The
   * server is the authoritative gate (filters already-upscaled when
   * replace=false), so we only need a heuristic here.
   */
  hasMaybeUpscaled: boolean;
}

export interface UseUpscaleSelectionReturn {
  /** Handler for the icon-button click (wired to whatever icon the panel chooses). */
  handleClick: () => void;
  /** Whether the icon button should be disabled. */
  disabled: boolean;
  /** Tooltip string for the icon button. */
  tooltip: string;
  /** Whether a trigger / poll request is currently in flight. */
  isTriggering: boolean;
  /** Active workspace id (passed to <UpscaleDestinationToggle />). */
  workspaceId: string | null;
  /** Open the cloud folder picker dialog. */
  openCloudPicker: () => void;
  /** Close the cloud folder picker dialog. */
  closeCloudPicker: () => void;
  /** Apply a picked cloud target into Redux + close picker. */
  applyCloudTarget: (target: UpscaleCloudTarget) => void;
  /** Whether the bulk re-upscale confirm dialog is open. */
  confirmOpen: boolean;
  /** Close the bulk re-upscale confirm dialog. */
  closeConfirm: () => void;
  /** Confirm "skip already upscaled" path → triggers without replace. */
  confirmSkip: () => void;
  /** Confirm "re-upscale all" path → triggers with replace. */
  confirmReplace: () => void;
  /** Whether the cloud folder picker dialog is open. */
  cloudPickerOpen: boolean;
  /** Pre-flight quota state (for the over-quota dialog). */
  preflight: ReturnType<typeof useUpscaleBatch>['preflight'];
  /** Close the pre-flight quota dialog. */
  closePreflight: () => void;
  /** Confirm the "first N" path from the pre-flight dialog. */
  confirmPreflightFirstN: (replace?: boolean) => Promise<void>;
}

/**
 * Manages the click handler, trigger state, and dialog visibility for an
 * Upscale icon button placed in a selection toolbar.
 *
 * Returns flags + handlers that the consuming component wires into:
 *   - one icon button (in their toolbar Stack)
 *   - the shared <UpscaleDestinationToggle /> + <UpscaleQuotaIndicator />
 *   - three dialogs: BulkReUpscaleDialog, PreflightQuotaDialog,
 *     PickCloudFolderDialog
 */
export const useUpscaleSelection = ({
  designIds,
  hasMaybeUpscaled,
}: UseUpscaleSelectionArgs): UseUpscaleSelectionReturn => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();

  const workspaceId = useAppSelector((s) => s.workspace.activeWorkspaceId);
  const activeBatchId = useAppSelector((s) => s.upscale.activeBatchId);
  const { data: quota } = useGetQuotaQuery();

  const {
    triggerBulk,
    preflight,
    closePreflight,
    confirmPreflightFirstN,
    isTriggering,
  } = useUpscaleBatch({ activeBatchId });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cloudPickerOpen, setCloudPickerOpen] = useState(false);

  const submitBulk = useCallback(
    async (replace: boolean) => {
      if (designIds.length === 0) {
        enqueueSnackbar(
          t('upscale.bulk.noEligible', {
            defaultValue: 'No upscalable designs in selection',
          }),
          { variant: 'info' },
        );
        return;
      }
      await triggerBulk(designIds, { replace });
    },
    [designIds, enqueueSnackbar, t, triggerBulk],
  );

  const handleClick = useCallback(() => {
    if (designIds.length === 0) {
      enqueueSnackbar(
        t('upscale.bulk.noEligible', {
          defaultValue: 'No upscalable designs in selection',
        }),
        { variant: 'info' },
      );
      return;
    }
    if (hasMaybeUpscaled) {
      setConfirmOpen(true);
      return;
    }
    void submitBulk(false);
  }, [designIds.length, enqueueSnackbar, hasMaybeUpscaled, submitBulk, t]);

  const confirmSkip = useCallback(() => {
    setConfirmOpen(false);
    void submitBulk(false);
  }, [submitBulk]);

  const confirmReplace = useCallback(() => {
    setConfirmOpen(false);
    void submitBulk(true);
  }, [submitBulk]);

  const closeConfirm = useCallback(() => {
    setConfirmOpen(false);
  }, []);

  const openCloudPicker = useCallback(() => setCloudPickerOpen(true), []);
  const closeCloudPicker = useCallback(() => setCloudPickerOpen(false), []);

  const applyCloudTarget = useCallback(
    (target: UpscaleCloudTarget) => {
      if (workspaceId) {
        dispatch(setCloudTargetAction({ workspaceId, target }));
      }
      setCloudPickerOpen(false);
    },
    [dispatch, workspaceId],
  );

  const isOverQuota = !!quota
    && !quota.is_unlimited
    && quota.limit !== null
    && quota.used >= quota.limit;
  const disabled = isTriggering || designIds.length === 0 || isOverQuota;
  const tooltip = isOverQuota
    ? t('upscale.bulk.quotaExceededTooltip', {
        defaultValue: 'Monthly quota exceeded',
      })
    : t('upscale.bulk.tooltip', {
        defaultValue: 'Upscale to 4500×5400',
      });

  return {
    handleClick,
    disabled,
    tooltip,
    isTriggering,
    workspaceId,
    openCloudPicker,
    closeCloudPicker,
    applyCloudTarget,
    confirmOpen,
    closeConfirm,
    confirmSkip,
    confirmReplace,
    cloudPickerOpen,
    preflight,
    closePreflight,
    confirmPreflightFirstN,
  };
};
