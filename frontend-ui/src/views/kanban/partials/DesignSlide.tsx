import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { useTranslation } from 'react-i18next';
import type { Design } from '../types';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const SlideRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 220,
  maxWidth: 260,
  borderRadius: 12,
  border: `1px solid ${theme.vars.palette.divider}`,
  overflow: 'hidden',
  flexShrink: 0,
}));

const ImageBox = styled(Box)(({ theme }) => ({
  width: '100%',
  aspectRatio: '1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: theme.vars.palette.action.hover,
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getDesignStatus = (tags: string[]): 'approved' | 'rejected' | 'pending' => {
  if (tags.includes('approved')) return 'approved';
  if (tags.includes('rejected')) return 'rejected';
  return 'pending';
};

const STATUS_CHIP_COLORS: Record<string, string> = {
  approved: '#22D3A3',
  rejected: '#F43F3A',
  pending: '#F59E0B',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DesignSlideProps {
  design: Design;
  onApprove: (designId: string) => void;
  onReject: (designId: string, feedback: string) => void;
  onDelete: (designId: string) => void;
}

const DesignSlide = ({ design, onApprove, onReject, onDelete }: DesignSlideProps) => {
  const { t } = useTranslation();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState('');

  const status = getDesignStatus(design.tags);
  const chipColor = STATUS_CHIP_COLORS[status];

  const handleReject = () => {
    if (!feedbackOpen) {
      setFeedbackOpen(true);
      return;
    }
    onReject(design.id, feedback);
    setFeedbackOpen(false);
    setFeedback('');
  };

  return (
    <SlideRoot>
      <ImageBox>
        {design.thumbnail_url || design.file_url ? (
          <img
            src={design.thumbnail_url || design.file_url}
            alt={design.file_name}
            loading="lazy"
          />
        ) : (
          <ImageOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
        )}
      </ImageBox>

      <Box sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="caption" noWrap sx={{ maxWidth: 140 }}>
            {design.file_name}
          </Typography>
          <Chip
            label={t(`kanban.modal.designStatus.${status}`)}
            size="small"
            sx={{
              height: 18,
              fontSize: 10,
              fontWeight: 600,
              bgcolor: alpha(chipColor, 0.15),
              color: chipColor,
            }}
          />
        </Box>

        {/* Actions */}
        {status === 'pending' && (
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <Tooltip title={t('kanban.modal.approve')}>
              <IconButton
                size="small"
                color="success"
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove(design.id);
                }}
                aria-label={t('kanban.modal.approve')}
              >
                <CheckCircleOutlineIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('kanban.modal.reject')}>
              <IconButton
                size="small"
                color="error"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReject();
                }}
                aria-label={t('kanban.modal.reject')}
              >
                <CancelOutlinedIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('kanban.modal.delete')}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(design.id);
                }}
                aria-label={t('kanban.modal.delete')}
              >
                <DeleteOutlineIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        {feedbackOpen && (
          <Box sx={{ mt: 1, display: 'flex', gap: 0.5 }}>
            <TextField
              size="small"
              fullWidth
              placeholder={t('kanban.modal.feedbackPlaceholder')}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleReject();
              }}
              slotProps={{ input: { sx: { fontSize: 12 } } }}
            />
            <Button size="small" variant="contained" color="error" onClick={handleReject}>
              {t('kanban.modal.send')}
            </Button>
          </Box>
        )}
      </Box>
    </SlideRoot>
  );
};

export default DesignSlide;
