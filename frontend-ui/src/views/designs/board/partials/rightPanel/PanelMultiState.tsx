import { useCallback, useMemo, useState } from 'react';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SendToListingsIcon from '../SendToListingsIcon';
import PhotoSizeSelectLargeIcon from '@mui/icons-material/PhotoSizeSelectLarge';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import { useTranslation } from 'react-i18next';
import { useGetDesignsByIdsQuery } from '@/store/designSlice';
import { useUpscaleSelection } from '../../hooks/useUpscaleSelection';
import UpscaleDestinationToggle from '../UpscaleDestinationToggle';
import UpscaleQuotaIndicator from '../UpscaleQuotaIndicator';
import BulkReUpscaleDialog from '../BulkReUpscaleDialog';
import PreflightQuotaDialog from '../PreflightQuotaDialog';
import PickCloudFolderDialog from '../PickCloudFolderDialog';
import UpscaleCompareModal from '../UpscaleCompareModal';
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
  onOpenInEditor,
  onDeleteAll,
  onExportSelected,
  getSendableDesignIds,
  onSendToListings,
}: PanelMultiStateProps) => {
  const { t } = useTranslation();
  const ids = selectedArtboards.map((a) => a.id);

  const aiCount = selectedArtboards.filter((a) => a.kind === 'ai').length;
  const regularCount = selectedArtboards.length - aiCount;

  const sendableDesignIds = useMemo(
    () => (getSendableDesignIds ? getSendableDesignIds(ids) : []),
    [getSendableDesignIds, ids],
  );

  // PROJ-27 — Bulk-Upscale wiring via shared hook (also used by single-select panel).
  const upscalableDesignIds = useMemo(
    () => selectedArtboards.map((a) => a.designId).filter((d): d is string => !!d),
    [selectedArtboards],
  );

  // PROJ-27 — Compare carousel: pull design metadata for selection so we can
  // build the items array for the modal. RTK Query caches by id. Moved BEFORE
  // useUpscaleSelection so we can drive `hasMaybeUpscaled` from real
  // `upscaled_file` data instead of an AI-kind heuristic (bug-fix 2026-05-31
  // — the heuristic fired the confirm dialog on every bulk upscale because
  // every AI artboard counts, even ones never upscaled).
  const { data: linkedDesigns } = useGetDesignsByIdsQuery(
    upscalableDesignIds,
    { skip: upscalableDesignIds.length === 0 },
  );

  const upscale = useUpscaleSelection({
    designIds: upscalableDesignIds,
    hasMaybeUpscaled: (linkedDesigns ?? []).some((d) => !!d.upscaled_file),
  });
  const compareItems = useMemo(
    () =>
      (linkedDesigns ?? [])
        .filter((d) => !!d.upscaled_file)
        .map((d) => ({
          beforeUrl: d.image_file ?? '',
          afterUrl: d.upscaled_file ?? '',
          label: d.id.slice(0, 8),
        })),
    [linkedDesigns],
  );
  const [compareOpen, setCompareOpen] = useState(false);

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
    ? t('designs.sendToListings.noEligibleInSelection', 'No designs in selection')
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
          <Tooltip title={upscale.tooltip}>
            <span>
              <ToolbarButton
                onClick={upscale.handleClick}
                disabled={upscale.disabled}
                aria-label={t('upscale.bulk.aria', 'Bulk upscale')}
              >
                <PhotoSizeSelectLargeIcon sx={{ fontSize: 20 }} />
              </ToolbarButton>
            </span>
          </Tooltip>
          {/* PROJ-27 — Compare carousel (only when ≥1 selected design has upscaled_file) */}
          {compareItems.length > 0 && (
            <Tooltip
              title={t('upscale.compare.bulkTooltip', {
                defaultValue: 'Compare {{count}} upscaled design(s)',
                count: compareItems.length,
              })}
            >
              <span>
                <ToolbarButton
                  onClick={() => setCompareOpen(true)}
                  aria-label={t('upscale.compare.aria', 'Compare upscale')}
                >
                  <CompareArrowsIcon sx={{ fontSize: 20 }} />
                </ToolbarButton>
              </span>
            </Tooltip>
          )}
          {onSendToListings && (
            <Tooltip title={sendTooltip}>
              <span>
                <ToolbarButton
                  onClick={handleSendToListings}
                  disabled={sendableDesignIds.length === 0}
                  aria-label={t('designs.sendToListings.cta', 'Send to Listings')}
                >
                  <SendToListingsIcon />
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
              workspaceId={upscale.workspaceId}
              onPickCloudTarget={upscale.openCloudPicker}
              disabled={upscale.isTriggering}
            />
            <UpscaleQuotaIndicator />
          </UpscaleControls>
        )}
      </Section>

      {/* PROJ-27 — Dialogs (MUI portals to body) */}
      <BulkReUpscaleDialog
        open={upscale.confirmOpen}
        totalCount={upscalableDesignIds.length}
        alreadyUpscaledCount={
          (linkedDesigns ?? []).filter((d) => !!d.upscaled_file).length
        }
        onCancel={upscale.closeConfirm}
        onSkipAlreadyUpscaled={upscale.confirmSkip}
        onReupscaleAll={upscale.confirmReplace}
      />
      <PreflightQuotaDialog
        open={upscale.preflight.open}
        selectedCount={upscale.preflight.selectedIds.length}
        remaining={Math.max(0, upscale.preflight.limit - upscale.preflight.used)}
        resetsOn={upscale.preflight.resets_on}
        onCancel={upscale.closePreflight}
        onConfirmFirstN={() => {
          void upscale.confirmPreflightFirstN(false);
        }}
      />
      <PickCloudFolderDialog
        open={upscale.cloudPickerOpen}
        onClose={upscale.closeCloudPicker}
        onPick={upscale.applyCloudTarget}
      />
      <UpscaleCompareModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        items={compareItems}
      />
    </Box>
  );
};

export default PanelMultiState;
