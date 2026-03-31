import { useCallback } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
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

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface PanelMultiStateProps {
  selectedArtboards: ArtboardData[];
  onOpenInEditor: (ids: string[]) => void;
  onDeleteAll: (ids: string[]) => void;
  onExportSelected: (ids: string[]) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const PanelMultiState = ({
  selectedArtboards,
  onOpenInEditor,
  onDeleteAll,
  onExportSelected,
}: PanelMultiStateProps) => {
  const { t } = useTranslation();
  const ids = selectedArtboards.map((a) => a.id);

  const aiCount = selectedArtboards.filter((a) => a.kind === 'ai').length;
  const regularCount = selectedArtboards.length - aiCount;

  const handleOpenEditor = useCallback(() => {
    onOpenInEditor(ids);
  }, [ids, onOpenInEditor]);

  const handleDelete = useCallback(() => {
    onDeleteAll(ids);
  }, [ids, onDeleteAll]);

  const handleExport = useCallback(() => {
    onExportSelected(ids);
  }, [ids, onExportSelected]);

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
      </Section>

      {/* Bulk actions */}
      <Section>
        <Stack spacing={1}>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<OpenInNewIcon />}
            onClick={handleOpenEditor}
            fullWidth
            size="small"
          >
            {t('design.panel.openInEditor', 'Open in Editor')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<FileDownloadOutlinedIcon />}
            onClick={handleExport}
            fullWidth
            size="small"
          >
            {t('design.panel.exportSelected', 'Export Selected')}
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={handleDelete}
            fullWidth
            size="small"
          >
            {t('design.panel.deleteAll', 'Delete All')}
          </Button>
        </Stack>
      </Section>
    </Box>
  );
};

export default PanelMultiState;
