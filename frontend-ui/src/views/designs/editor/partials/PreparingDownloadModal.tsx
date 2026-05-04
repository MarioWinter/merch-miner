import {
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import type { CompressionLevel } from '../types';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const SpinnerWrapper = styled(Stack)({
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px 0 8px',
});

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const COMPRESSION_LABEL_KEYS: Record<CompressionLevel, string> = {
  off: 'design.export.compressionOff',
  low: 'design.export.compressionLow',
  medium: 'design.export.compressionMedium',
  high: 'design.export.compressionHigh',
  very_high: 'design.export.compressionVeryHigh',
};

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface PreparingDownloadModalProps {
  open: boolean;
  onCancel: () => void;
  compressionLevel: CompressionLevel;
  progress: number;
  currentImage: number;
  totalImages: number;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const PreparingDownloadModal = ({
  open,
  onCancel,
  compressionLevel,
  progress,
  currentImage,
  totalImages,
}: PreparingDownloadModalProps) => {
  const { t } = useTranslation();

  const subtitle = totalImages > 1
    ? t('design.export.processingImages', { current: currentImage, total: totalImages })
    : t('design.export.processingImage');

  return (
    <Dialog
      open={open}
      maxWidth="xs"
      fullWidth
      aria-labelledby="preparing-download-title"
    >
      <DialogContent>
        <Stack spacing={2.5} sx={{ py: 1 }}>
          <SpinnerWrapper>
            <CircularProgress size={48} />
          </SpinnerWrapper>

          <Typography
            id="preparing-download-title"
            variant="h5"
            align="center"
            fontWeight={600}
          >
            {t('design.export.preparingDownload')}
          </Typography>

          <Typography variant="body2" align="center" color="text.secondary">
            {subtitle}
          </Typography>

          <Stack direction="row" justifyContent="center">
            <Chip
              label={`${t('design.export.compressionLevel')}: ${t(COMPRESSION_LABEL_KEYS[compressionLevel])}`}
              size="small"
              variant="outlined"
            />
          </Stack>

          <LinearProgress
            variant="determinate"
            value={Math.min(progress, 100)}
            aria-label="Download progress"
          />

          <Stack direction="row" justifyContent="center">
            <Button
              variant="outlined"
              color="inherit"
              onClick={onCancel}
              size="small"
            >
              {t('design.export.cancel')}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};
