import { Box, Card, Checkbox, Chip, Typography, IconButton, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useTranslation } from 'react-i18next';
import type { DesignAsset } from '../types';
import { DURATION, EASING } from '@/style/constants';

const StyledCard = styled(Card)(({ theme }) => ({
  position: 'relative',
  borderRadius: 12,
  border: '1px solid',
  borderColor: theme.vars.palette.divider,
  overflow: 'hidden',
  cursor: 'pointer',
  transition: `transform ${DURATION.fast}ms ${EASING.standard}, box-shadow ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: `0 4px 16px rgba(0,0,0,0.30)`,
  },
}));

const ThumbnailBox = styled(Box)({
  width: '100%',
  aspectRatio: '1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
});

interface DesignCardProps {
  design: DesignAsset;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClick: (design: DesignAsset) => void;
}

const DesignCard = ({ design, selected, onToggleSelect, onDelete, onClick }: DesignCardProps) => {
  const { t } = useTranslation();

  return (
    <StyledCard>
      <Box
        sx={{
          position: 'absolute',
          top: 8,
          left: 8,
          zIndex: 2,
        }}
      >
        <Checkbox
          checked={selected}
          onChange={() => onToggleSelect(design.id)}
          onClick={(e) => e.stopPropagation()}
          size="small"
          aria-label={t('publish.gallery.selectDesign')}
          sx={{
            bgcolor: 'background.paper',
            borderRadius: '4px',
            p: 0.25,
          }}
        />
      </Box>

      <Box
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 2,
        }}
      >
        <Tooltip title={t('publish.gallery.delete')}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(design.id);
            }}
            aria-label={t('publish.gallery.delete')}
            sx={{
              bgcolor: 'background.paper',
              '&:hover': { color: 'error.main' },
            }}
          >
            <DeleteOutlineIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Box onClick={() => onClick(design)}>
        <ThumbnailBox>
          {design.thumbnail_url || design.file_url ? (
            <img
              src={design.thumbnail_url || design.file_url}
              alt={design.file_name}
              loading="lazy"
            />
          ) : (
            <Typography variant="caption" color="text.disabled">
              {t('publish.gallery.noImage')}
            </Typography>
          )}
        </ThumbnailBox>

        <Box sx={{ p: 1.5 }}>
          <Typography variant="body2" noWrap title={design.file_name}>
            {design.file_name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
            {design.tags.slice(0, 3).map((tag) => (
              <Chip key={tag} label={tag} size="small" variant="outlined" />
            ))}
            {design.listing && (
              <Chip
                label={t('publish.gallery.hasListing')}
                size="small"
                color="success"
                variant="outlined"
              />
            )}
          </Box>
        </Box>
      </Box>
    </StyledCard>
  );
};

export default DesignCard;
