import { useCallback, useMemo } from 'react';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { useTranslation } from 'react-i18next';
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
  const ids = selectedArtboards.map((a) => a.id);

  const aiCount = selectedArtboards.filter((a) => a.kind === 'ai').length;
  const regularCount = selectedArtboards.length - aiCount;

  const sendableDesignIds = useMemo(
    () => (getSendableDesignIds ? getSendableDesignIds(ids) : []),
    [getSendableDesignIds, ids],
  );

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
      </Section>
    </Box>
  );
};

export default PanelMultiState;
