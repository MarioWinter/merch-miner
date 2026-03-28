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
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditNoteIcon from '@mui/icons-material/EditNote';
import BrushIcon from '@mui/icons-material/Brush';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { SignalTypeBadge } from './SignalTypeBadge';
import { MarketConfidenceBadge } from './MarketConfidenceBadge';
import type { Idea } from '../types';

interface IdeaCardProps {
  idea: Idea;
  onApprove: () => void;
  onReject: () => void;
  onImprove: () => void;
  onAdapt: () => void;
  onDelete: () => void;
  onRegenerate?: () => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

const STATUS_COLORS: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  pending: 'default',
  approved: 'success',
  rejected: 'error',
  for_review: 'warning',
};

const CardRoot = styled(Box)(({ theme }) => ({
  border: `1px solid ${alpha('#fff', 0.08)}`,
  borderRadius: 12,
  padding: theme.spacing(2),
  transition: 'border-color 150ms ease',
  '&:hover': {
    borderColor: alpha('#fff', 0.14),
  },
  ...theme.applyStyles('light', {
    border: `1px solid ${alpha('#071E26', 0.08)}`,
    '&:hover': {
      borderColor: alpha('#071E26', 0.14),
    },
  }),
}));

export const IdeaCard = ({
  idea,
  onApprove,
  onReject,
  onImprove,
  onAdapt,
  onDelete,
  onRegenerate,
  isSelected,
  onToggleSelect,
}: IdeaCardProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <CardRoot
      role="article"
      aria-label={`Idea: ${idea.slogan_text.slice(0, 50)}`}
      sx={isSelected ? { borderColor: 'primary.main' } : undefined}
    >
      <Stack spacing={1}>
        {/* Header: status + badges */}
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            label={t(`ideas.status.${idea.status}`)}
            size="small"
            color={STATUS_COLORS[idea.status]}
            sx={{ borderRadius: '6px', fontSize: '0.6875rem', height: 22 }}
          />
          {idea.signal_type && <SignalTypeBadge signalType={idea.signal_type} />}
          {idea.market_confidence && (
            <MarketConfidenceBadge confidence={idea.market_confidence} />
          )}
          {idea.pattern_used && (
            <Chip
              label={idea.pattern_used}
              size="small"
              variant="outlined"
              sx={{ borderRadius: '6px', fontSize: '0.6875rem', height: 22 }}
            />
          )}
          {idea.was_changed && (
            <Tooltip title={idea.change_reason || t('ideas.history.qualityChecked')}>
              <EditNoteIcon sx={{ fontSize: 16, color: 'warning.main' }} />
            </Tooltip>
          )}
          {onToggleSelect && (
            <Box
              sx={{ ml: 'auto', cursor: 'pointer' }}
              onClick={onToggleSelect}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={onToggleSelect}
                aria-label={t('ideas.bulk.selectIdea')}
              />
            </Box>
          )}
        </Stack>

        {/* Slogan text */}
        <Typography variant="body1" sx={{ fontWeight: 500 }}>
          {idea.slogan_text}
        </Typography>

        {/* Why it works */}
        {idea.why_it_works && (
          <Typography variant="body2" color="text.secondary">
            {idea.why_it_works}
          </Typography>
        )}

        {/* Actions row */}
        <Stack direction="row" spacing={0.5} alignItems="center">
          {idea.status !== 'approved' && (
            <Tooltip title={t('ideas.status.approved')}>
              <IconButton
                size="small"
                onClick={onApprove}
                color="success"
                aria-label={t('ideas.status.approved')}
              >
                <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {idea.status !== 'rejected' && (
            <Tooltip title={t('ideas.status.rejected')}>
              <IconButton
                size="small"
                onClick={onReject}
                aria-label={t('ideas.status.rejected')}
              >
                <HighlightOffIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={t('ideas.improve.button')}>
            <IconButton
              size="small"
              onClick={onImprove}
              aria-label={t('ideas.improve.button')}
            >
              <AutoFixHighIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          {idea.niche && (
            <Tooltip title={t('ideas.adapt.button')}>
              <IconButton
                size="small"
                onClick={onAdapt}
                color="secondary"
                aria-label={t('ideas.adapt.button')}
              >
                <AutoAwesomeIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {idea.status === 'rejected' && onRegenerate && (
            <Tooltip title={t('ideas.regenerate.button')}>
              <IconButton
                size="small"
                onClick={onRegenerate}
                aria-label={t('ideas.regenerate.button')}
              >
                <RefreshIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {idea.status === 'approved' && (
            <Tooltip title={t('design.board.jumpButton')}>
              <IconButton
                size="small"
                onClick={() => navigate(`/design-board/${idea.id}`)}
                color="secondary"
                aria-label={t('design.board.jumpButton')}
              >
                <BrushIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          <Box sx={{ flex: 1 }} />
          <Tooltip title={t('ideas.delete')}>
            <IconButton
              size="small"
              onClick={onDelete}
              aria-label={t('ideas.delete')}
              sx={{ color: 'error.main' }}
            >
              <DeleteOutlineIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </CardRoot>
  );
};
