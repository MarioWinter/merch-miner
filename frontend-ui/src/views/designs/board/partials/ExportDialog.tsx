import { useCallback, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { useTranslation } from 'react-i18next';
import type { ArtboardData } from '../types';
import useExportArtboards from '../hooks/useExportArtboards';
import type { ExportSettings } from '../hooks/useExportArtboards';

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  artboards: ArtboardData[];
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const ExportDialog = ({ open, onClose, artboards }: ExportDialogProps) => {
  const { t } = useTranslation();
  const { exportArtboards, isExporting, progress } = useExportArtboards();

  const [dpi, setDpi] = useState(300);
  const [quality, setQuality] = useState(92);

  const handleExport = useCallback(async () => {
    const settings: ExportSettings = { dpi, quality };
    await exportArtboards(artboards, settings);
    onClose();
  }, [dpi, quality, artboards, exportArtboards, onClose]);

  const count = artboards.length;
  const isZip = count > 1;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {t('design.export.titleCount', 'Export {{count}} Artboard', { count })}
        {count > 1 ? 's' : ''}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ pt: 1 }}>
          {/* Format info */}
          <Typography variant="body2" color="text.secondary">
            {isZip
              ? t('design.export.formatZip', 'PNG files bundled as ZIP')
              : t('design.export.formatPng', 'PNG file')}
          </Typography>

          {/* DPI */}
          <TextField
            label={t('design.export.dpi', 'DPI')}
            type="number"
            size="small"
            value={dpi}
            onChange={(e) => setDpi(Math.max(72, Math.min(600, Number(e.target.value) || 72)))}
            slotProps={{ htmlInput: { min: 72, max: 600, step: 1 } }}
          />

          {/* Quality */}
          <Box>
            <Typography variant="body2" gutterBottom>
              {t('design.export.quality', 'Quality')}: {quality}%
            </Typography>
            <Slider
              value={quality}
              onChange={(_, v) => setQuality(v as number)}
              min={10}
              max={100}
              step={1}
              size="small"
            />
          </Box>

          {/* Progress */}
          {isExporting && (
            <Box>
              <LinearProgress variant="determinate" value={progress} />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                {progress}%
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isExporting}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          variant="contained"
          startIcon={<FileDownloadOutlinedIcon />}
          onClick={handleExport}
          disabled={isExporting || count === 0}
        >
          {isExporting
            ? t('design.export.exporting', 'Exporting...')
            : t('design.export.download', 'Download')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExportDialog;
