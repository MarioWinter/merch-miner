import { Box, Grid, Typography } from '@mui/material';
import BrushIcon from '@mui/icons-material/Brush';
import { useTranslation } from 'react-i18next';
import { DesignCard } from './DesignCard';
import type { Design } from '../types';

interface DesignGalleryProps {
  designs: Design[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
}

export const DesignGallery = ({
  designs,
  onApprove,
  onReject,
  onDownload,
  onDelete,
  selectedIds,
  onToggleSelect,
}: DesignGalleryProps) => {
  const { t } = useTranslation();

  if (designs.length === 0) {
    return (
      <Box
        sx={{
          py: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <BrushIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
        <Typography variant="h5" color="text.secondary">
          {t('design.empty.noDesigns')}
        </Typography>
        <Typography variant="body2" color="text.disabled">
          {t('design.empty.cta')}
        </Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={2}>
      {designs.map((design) => (
        <Grid key={design.id} size={{ xs: 6, sm: 4, md: 3 }}>
          <DesignCard
            design={design}
            onApprove={() => onApprove(design.id)}
            onReject={() => onReject(design.id)}
            onDownload={() => onDownload(design.id)}
            onDelete={() => onDelete(design.id)}
            selected={selectedIds.includes(design.id)}
            onToggleSelect={() => onToggleSelect(design.id)}
          />
        </Grid>
      ))}
    </Grid>
  );
};
