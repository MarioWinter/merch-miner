import { useCallback, useMemo, useState } from 'react';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useGetQuotaQuery } from '@/store/upscaleApi';
import {
  setActiveBatch,
  openDrawer,
  setCloudTarget as setCloudTargetAction,
} from '@/store/upscaleSlice';
import { useUpscaleBatch } from '../../hooks/useUpscaleBatch';
import UpscaleDestinationToggle from '../UpscaleDestinationToggle';
import UpscaleQuotaIndicator from '../UpscaleQuotaIndicator';
import BulkReUpscaleDialog from '../BulkReUpscaleDialog';
import PreflightQuotaDialog from '../PreflightQuotaDialog';
import PickCloudFolderDialog from '../PickCloudFolderDialog';
import type { ArtboardData } from '../../types';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const Section = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
}));

const InfoRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(1, 0),
}));

const ToolbarButton = styled(IconButton)(({ theme }) => ({
  width: 32,
  height: 32,
  color: theme.vars.palette.text.secondary,
  '&:hover': {
    color: theme.vars.palette.text.primary,
  },
}));

const DeleteButton = styled(IconButton)(({ theme }) => ({
  width: 32,
  height: 32,
  color: theme.vars.palette.error.main,
}));

const UpscaleControls = styled(Stack)(({ theme }) => ({
  marginTop: theme.spacing(1.5),
  paddingTop: theme.spacing(1.5),
  borderTop: `1px solid ${theme.vars.palette.divider}`,
  gap: theme.spacing(0.75),
}));

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface PanelMultiStateProps {
  selectedArtboards: ArtboardData[];
  onAddToEditor: (ids: string[]) => void;
  onOpenInEditor: (ids: string[]) => void;
  onDeleteAll: (ids: string[]) => void;
  onExportSelected: (ids: string[]) => void;
  /** PROJ-9 Phase O — resolves selected artboard IDs to approved design IDs eligible for Listings. */
  getSendableDesignIds?: (artboardIds: string[]) => string[];
  /** PROJ-9 Phase O — sends the approved design IDs to Listings. */
  onSendToListings?: (designIds: string[]) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const PanelMultiState = ({
  selectedArtboards,
  onAddToEditor,
  onOpenInEditor,
  onDeleteAll,
  onExportSelected,
  getSendableDesignIds,
  onSendToListings,
}: PanelMultiStateProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();
  const ids = selectedArtboards.map((a) => a.id);

  const aiCount = selectedArtboards.filter((a) => a.kind === 'ai').length;
  const regularCount = selectedArtboards.length - aiCount;

  const sendableDesignIds = useMemo(
    () => (getSendableDesignIds ? getSendableDesignIds(ids) : []),
    [getSendableDesignIds, ids],
  );

  // ---------------------------------------------------------------
  // PROJ-27 Bulk-Upscale wiring
  // ---------------------------------------------------------------

  const workspaceId = useAppSelector((s) => s.workspace.activeWorkspaceId);
  const activeBatchId = useAppSelector((s) => s.upscale.activeBatchId);

  const { data: quota } = useGetQuotaQuery();

  // Eligible design IDs for upscaling: any selected artboard that has a linked design.
  const upscalableDesignIds = useMemo(
    () => selectedArtboards.map((a) => a.designId).filter((d): d is string => !!d),
    [selectedArtboards],
  );

  const {
    triggerBulk,
    preflight,
    closePreflight,
    confirmPreflightFirstN,
    isTriggering,
  } = useUpscaleBatch({ activeBatchId });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingReplaceFlag, setPendingReplaceFlag] = useState(false);
  const [cloudPickerOpen, setCloudPickerOpen] = useState(false);

  // Pre-flight: any selected design that already has an upscaled_file.
  // We don't have upscaled_file on ArtboardData directly, so the user always
  // gets the option to confirm if there are AI-linked artboards in selection
  // (server-side will short-circuit if all are fresh).
  const hasMaybeUpscaled = upscalableDesignIds.length > 0 && aiCount > 0;

  const submitBulk = useCallback(
    async (replace: boolean) => {
      if (upscalableDesignIds.length === 0) {
        enqueueSnackbar(
          t('upscale.bulk.noEligible', {
            defaultValue: 'No upscalable designs in selection',
          }),
          { variant: 'info' },
        );
        return;
      }
      const result = await triggerBulk(upscalableDesignIds, { replace });
      const batchId = (result as unknown as { batch_id?: string })?.batch_id;
      if (batchId) {
        dispatch(setActiveBatch(batchId));
        dispatch(openDrawer());
      }
    },
    [dispatch, enqueueSnackbar, t, triggerBulk, upscalableDesignIds],
  );

  const handleBulkUpscaleClick = useCallback(() => {
    if (upscalableDesignIds.length === 0) {
      enqueueSnackbar(
        t('upscale.bulk.noEligible', {
          defaultValue: 'No upscalable designs in selection',
        }),
        { variant: 'info' },
      );
      return;
    }
    if (hasMaybeUpscaled) {
      setPendingReplaceFlag(false);
      setConfirmOpen(true);
      return;
    }
    void submitBulk(false);
  }, [enqueueSnackbar, hasMaybeUpscaled, submitBulk, t, upscalableDesignIds.length]);

  const handleConfirmReplace = useCallback(() => {
    setConfirmOpen(false);
    void submitBulk(true);
  }, [submitBulk]);

  const handleConfirmSkip = useCallback(() => {
    setConfirmOpen(false);
    void submitBulk(false);
  }, [submitBulk]);

  const handlePickCloudTarget = useCallback(() => {
    setCloudPickerOpen(true);
  }, []);

  // Quota over-cap → bulk button disabled.
  const isOverQuota = !!quota && !quota.is_unlimited && quota.limit !== null
    && quota.used >= quota.limit;
  const bulkDisabled = isTriggering || upscalableDesignIds.length === 0 || isOverQuota;
  const bulkTooltip = isOverQuota
    ? t('upscale.bulk.quotaExceededTooltip', {
        defaultValue: 'Monthly quota exceeded',
      })
    : t('upscale.bulk.tooltip', {
        defaultValue: 'Upscale to 4500×5400',
      });

  // ---------------------------------------------------------------
  // Existing toolbar handlers (untouched)
  // ---------------------------------------------------------------

  const handleAddEditor = useCallback(() => {
    onAddToEditor(ids);
  }, [ids, onAddToEditor]);

  const handleOpenEditor = useCallback(() => {
    onOpenInEditor(ids);
  }, [ids, onOpenInEditor]);

  const handleDelete = useCallback(() => {
    onDeleteAll(ids);
  }, [ids, onDeleteAll]);

  const handleExport = useCallback(() => {
    onExportSelected(ids);
  }, [ids, onExportSelected]);

  const handleSendToListings = useCallback(() => {
    onSendToListings?.(sendableDesignIds);
  }, [onSendToListings, sendableDesignIds]);

  const sendTooltip = sendableDesignIds.length === 0
    ? t('designs.sendToListings.noEligibleInSelection', 'No approved designs in selection')
    : t('designs.sendToListings.sendCount', { count: sendableDesignIds.length });

  return (
    <Box>
      {/* Selection summary */}
      <Section>
        <Typography variant="overline" color="text.secondary">
          {t('design.panel.selection', 'Selection')}
        </Typography>
        {regularCount > 0 && (
          <InfoRow>
            <Typography variant="body2" color="text.secondary">
              {t('design.panel.artboards', 'Artboards')}
            </Typography>
            <Typography variant="body2">{regularCount}</Typography>
          </InfoRow>
        )}
        {aiCount > 0 && (
          <InfoRow>
            <Typography variant="body2" color="text.secondary">
              {t('design.panel.aiBoards', 'AI Boards')}
            </Typography>
            <Typography variant="body2">{aiCount}</Typography>
          </InfoRow>
        )}

        {/* Action toolbar */}
        <Stack direction="row" sx={{ gap: 0.5, mt: 1 }}>
          <Tooltip title={t('design.panel.addToEditor', 'Add to Editor')}>
            <ToolbarButton onClick={handleAddEditor} aria-label={t('design.panel.addToEditor', 'Add to Editor')}>
              <AddPhotoAlternateOutlinedIcon sx={{ fontSize: 20 }} />
            </ToolbarButton>
          </Tooltip>
          <Tooltip title={t('design.panel.openInEditor', 'Open in Editor')}>
            <ToolbarButton onClick={handleOpenEditor} aria-label={t('design.panel.openInEditor', 'Open in Editor')}>
              <OpenInNewOutlinedIcon sx={{ fontSize: 20 }} />
            </ToolbarButton>
          </Tooltip>
          <Tooltip title={t('design.panel.exportSelected', 'Export')}>
            <ToolbarButton onClick={handleExport} aria-label={t('design.panel.exportSelected', 'Export')}>
              <FileDownloadOutlinedIcon sx={{ fontSize: 20 }} />
            </ToolbarButton>
          </Tooltip>
          {/* PROJ-27 — Bulk Upscale */}
          <Tooltip title={bulkTooltip}>
            <span>
              <ToolbarButton
                onClick={handleBulkUpscaleClick}
                disabled={bulkDisabled}
                aria-label={t('upscale.bulk.aria', 'Bulk upscale')}
              >
                <AutoFixHighIcon sx={{ fontSize: 20 }} />
              </ToolbarButton>
            </span>
          </Tooltip>
          {onSendToListings && (
            <Tooltip title={sendTooltip}>
              <span>
                <ToolbarButton
                  onClick={handleSendToListings}
                  disabled={sendableDesignIds.length === 0}
                  aria-label={t('designs.sendToListings.cta', 'Send to Listings')}
                >
                  <SendOutlinedIcon sx={{ fontSize: 20 }} />
                </ToolbarButton>
              </span>
            </Tooltip>
          )}
          <Tooltip title={t('design.panel.deleteAll', 'Delete')}>
            <DeleteButton onClick={handleDelete} aria-label={t('design.panel.deleteAll', 'Delete')}>
              <DeleteOutlineIcon sx={{ fontSize: 20 }} />
            </DeleteButton>
          </Tooltip>
        </Stack>

        {/* PROJ-27 — Destination toggle + quota indicator */}
        {upscalableDesignIds.length > 0 && (
          <UpscaleControls>
            <UpscaleDestinationToggle
              workspaceId={workspaceId}
              onPickCloudTarget={handlePickCloudTarget}
              disabled={isTriggering}
            />
            <UpscaleQuotaIndicator />
          </UpscaleControls>
        )}
      </Section>

      {/* PROJ-27 — Dialogs (render outside Section, MUI portals to body) */}
      <BulkReUpscaleDialog
        open={confirmOpen}
        totalCount={upscalableDesignIds.length}
        alreadyUpscaledCount={aiCount}
        onCancel={() => setConfirmOpen(false)}
        onSkipAlreadyUpscaled={handleConfirmSkip}
        onReupscaleAll={handleConfirmReplace}
      />
      <PreflightQuotaDialog
        open={preflight.open}
        selectedCount={preflight.selectedIds.length}
        remaining={Math.max(0, preflight.limit - preflight.used)}
        resetsOn={preflight.resets_on}
        onCancel={closePreflight}
        onConfirmFirstN={() => {
          void confirmPreflightFirstN(pendingReplaceFlag);
        }}
      />
      <PickCloudFolderDialog
        open={cloudPickerOpen}
        onClose={() => setCloudPickerOpen(false)}
        onPick={(target) => {
          if (workspaceId) {
            dispatch(setCloudTargetAction({ workspaceId, target }));
          }
          setCloudPickerOpen(false);
        }}
      />
    </Box>
  );
};

export default PanelMultiState;
