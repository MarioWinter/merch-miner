import {
  Box,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useTranslation } from 'react-i18next';
import type { Design, DesignStatus } from '../types';

interface DesignCardProps {
  design: Design;
  onApprove: () => void;
  onReject: () => void;
  onDownload: () => void;
  onDelete: () => void;
  selected?: boolean;
  onToggleSelect?: () => void;
}

const STATUS_COLORS: Record<
  DesignStatus,
  'default' | 'success' | 'error' | 'warning' | 'info'
> = {
  pending: 'default',
  approved: 'success',
  rejected: 'error',
  failed: 'warning',
};

const CardRoot = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isApproved' && prop !== 'isSelected',
})<{ isApproved?: boolean; isSelected?: boolean }>(
  ({ theme, isApproved, isSelected }) => ({
    borderRadius: 12,
    border: `1px solid ${alpha('#fff', 0.08)}`,
    overflow: 'hidden',
    transition: 'border-color 150ms ease, transform 150ms ease',
    cursor: 'pointer',
    ...(isApproved && {
      borderColor: theme.palette.success.main,
      borderWidth: 2,
    }),
    ...(isSelected && {
      borderColor: theme.palette.primary.main,
      borderWidth: 2,
    }),
    '&:hover': {
      borderColor: alpha('#fff', 0.18),
      transform: 'translateY(-1px)',
    },
    ...theme.applyStyles('light', {
      border: `1px solid ${alpha('#071E26', 0.08)}`,
      ...(isApproved && {
        borderColor: theme.palette.success.main,
        borderWidth: 2,
      }),
      ...(isSelected && {
        borderColor: theme.palette.primary.main,
        borderWidth: 2,
      }),
      '&:hover': {
        borderColor: alpha('#071E26', 0.18),
      },
    }),
  }),
);

const ImageWrapper = styled(Box)({
  width: '100%',
  aspectRatio: '1',
  overflow: 'hidden',
  backgroundColor: 'rgba(0,0,0,0.2)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
});

export const DesignCard = ({
  design,
  onApprove,
  onReject,
  onDownload,
  onDelete,
  selected,
  onToggleSelect,
}: DesignCardProps) => {
  const { t } = useTranslation();

  return (
    <CardRoot
      isApproved={design.status === 'approved'}
      isSelected={selected}
      role="article"
      aria-label={`Design ${design.id.slice(0, 8)}`}
      onClick={onToggleSelect}
    >
      <ImageWrapper>
        {design.image_file ? (
          <img
            src={design.image_file}
            alt={t('design.gallery.imageAlt')}
            loading="lazy"
          />
        ) : (
          <Typography variant="caption" color="text.disabled">
            {t('design.gallery.noImage')}
          </Typography>
        )}
      </ImageWrapper>

      <Box sx={{ p: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
          <Chip
            label={t(`design.status.${design.status}`)}
            size="small"
            color={STATUS_COLORS[design.status]}
            sx={{ borderRadius: '6px', fontSize: '0.6875rem', height: 22 }}
          />
          {design.generation_run && (
            <Typography variant="caption" color="text.secondary">
              {t(`design.model.${design.generation_run.model_name}`)}
            </Typography>
          )}
        </Stack>

        <Stack direction="row" spacing={0.25} alignItems="center">
          {design.status !== 'approved' && (
            <Tooltip title={t('design.gallery.approve')}>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onApprove(); }}
                color="success"
                aria-label={t('design.gallery.approve')}
              >
                <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {design.status !== 'rejected' && (
            <Tooltip title={t('design.gallery.reject')}>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onReject(); }}
                aria-label={t('design.gallery.reject')}
              >
                <HighlightOffIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {design.image_file && (
            <Tooltip title={t('design.gallery.download')}>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onDownload(); }}
                aria-label={t('design.gallery.download')}
              >
                <DownloadIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          <Box sx={{ flex: 1 }} />
          <Tooltip title={t('design.gallery.delete')}>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              sx={{ color: 'error.main' }}
              aria-label={t('design.gallery.delete')}
            >
              <DeleteOutlineIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    </CardRoot>
  );
};
