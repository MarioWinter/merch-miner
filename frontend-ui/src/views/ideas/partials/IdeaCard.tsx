import { useRef, useState, useEffect } from 'react';
import {
  Autocomplete,
  Box,
  Checkbox,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
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
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useListNichesQuery } from '@/store/nicheSlice';
import { COLORS } from '@/style/constants';
import { SignalTypeBadge } from './SignalTypeBadge';
import { MarketConfidenceBadge } from './MarketConfidenceBadge';
import type { Idea } from '../types';
import type { UseIdeaInlineEditReturn } from '../hooks/useInlineEdit';

interface IdeaCardProps {
  idea: Idea;
  onApprove: () => void;
  onReject: () => void;
  onImprove: () => void;
  onAdapt: () => void;
  onDelete: () => void;
  onRegenerate?: () => void;
  onDoubleClick?: () => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  inlineEdit?: UseIdeaInlineEditReturn;
  indented?: boolean;
}

const STATUS_COLORS: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  pending: 'default',
  approved: 'success',
  rejected: 'error',
  for_review: 'warning',
};

const CardRoot = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isOrphan' && prop !== 'indented',
})<{ isOrphan?: boolean; indented?: boolean }>(({ theme, isOrphan, indented }) => ({
  border: `1px ${isOrphan ? 'dashed' : 'solid'} ${theme.vars.palette.divider}`,
  borderRadius: 12,
  padding: theme.spacing(2),
  transition: 'border-color 150ms ease',
  ...(indented && { marginLeft: theme.spacing(4) }),
  '&:hover': {
    borderColor: alpha(COLORS.white, 0.14),
    ...theme.applyStyles('light', {
      borderColor: alpha(COLORS.ink, 0.14),
    }),
  },
}));

export const IdeaCard = ({
  idea,
  onApprove,
  onReject,
  onImprove,
  onAdapt,
  onDelete,
  onRegenerate,
  onDoubleClick,
  isSelected,
  onToggleSelect,
  inlineEdit,
  indented,
}: IdeaCardProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isOrphan = !idea.niche;

  const isEditingText =
    inlineEdit?.activeCell?.ideaId === idea.id &&
    inlineEdit?.activeCell?.column === 'slogan_text';

  const isEditingNiche =
    inlineEdit?.activeCell?.ideaId === idea.id &&
    inlineEdit?.activeCell?.column === 'niche';

  return (
    <CardRoot
      role="article"
      aria-label={`Idea: ${idea.slogan_text.slice(0, 50)}`}
      isOrphan={isOrphan}
      indented={indented}
      onDoubleClick={onDoubleClick}
      sx={isSelected ? { borderColor: 'primary.main' } : undefined}
    >
      <Stack spacing={1}>
        {/* Header: status + badges + checkbox */}
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
          <StatusChip
            idea={idea}
            inlineEdit={inlineEdit}
            onApprove={onApprove}
            onReject={onReject}
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
          <NicheChip
            idea={idea}
            isEditing={isEditingNiche}
            inlineEdit={inlineEdit}
          />
          {idea.was_changed && (
            <Tooltip title={idea.change_reason || t('ideas.history.qualityChecked')}>
              <EditNoteIcon sx={{ fontSize: 16, color: 'warning.main' }} />
            </Tooltip>
          )}
          {onToggleSelect && (
            <Box sx={{ ml: 'auto' }}>
              <Checkbox
                size="small"
                checked={isSelected}
                onChange={onToggleSelect}
                aria-label={t('ideas.bulk.selectIdea')}
                sx={{ p: 0.5 }}
              />
            </Box>
          )}
        </Stack>

        {/* Slogan text (inline editable) */}
        {isEditingText ? (
          <InlineSloganEdit
            ideaId={idea.id}
            initialValue={idea.slogan_text}
            inlineEdit={inlineEdit!}
          />
        ) : (
          <Typography
            variant="body1"
            sx={{
              fontWeight: 500,
              cursor: inlineEdit ? 'pointer' : 'default',
              '&:hover': inlineEdit ? { opacity: 0.8 } : undefined,
            }}
            onClick={() => inlineEdit?.activateCell(idea.id, 'slogan_text')}
          >
            {idea.slogan_text}
          </Typography>
        )}

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
          {idea.niche ? (
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
          ) : (
            <Tooltip title={t('ideas.noNicheTooltip')}>
              <span>
                <IconButton
                  size="small"
                  disabled
                  aria-label={t('ideas.adapt.button')}
                >
                  <AutoAwesomeIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
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

/* ----------- Inline slogan text edit ----------- */
const InlineSloganEdit = ({
  ideaId,
  initialValue,
  inlineEdit,
}: {
  ideaId: string;
  initialValue: string;
  inlineEdit: UseIdeaInlineEditReturn;
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void inlineEdit.saveSloganText(ideaId, value);
    } else if (e.key === 'Escape') {
      inlineEdit.deactivateCell();
    }
  };

  const handleBlur = () => {
    if (value.trim() && value.trim() !== initialValue) {
      void inlineEdit.saveSloganText(ideaId, value);
    } else {
      inlineEdit.deactivateCell();
    }
  };

  return (
    <TextField
      inputRef={inputRef}
      size="small"
      fullWidth
      multiline
      maxRows={4}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      disabled={inlineEdit.isSaving}
      slotProps={{
        input: {
          endAdornment: inlineEdit.isSaving ? (
            <CircularProgress size={14} />
          ) : undefined,
        },
      }}
      sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.875rem' } }}
    />
  );
};

/* ----------- Niche chip (all ideas — clickable to change) ----------- */
const NicheChip = ({
  idea,
  isEditing,
  inlineEdit,
}: {
  idea: Idea;
  isEditing: boolean;
  inlineEdit?: UseIdeaInlineEditReturn;
}) => {
  const { t } = useTranslation();
  const { data: nichesData } = useListNichesQuery(
    { page_size: 100 },
    { skip: !isEditing },
  );
  const niches = nichesData?.results ?? [];
  const isOrphan = !idea.niche;

  if (isEditing && inlineEdit) {
    return (
      <Autocomplete
        size="small"
        options={niches}
        getOptionLabel={(option) => option.name}
        defaultValue={niches.find((n) => n.id === idea.niche) ?? null}
        onChange={(_e, val) => {
          void inlineEdit.saveNiche(idea.id, val?.id ?? null);
        }}
        onClose={() => inlineEdit.deactivateCell()}
        openOnFocus
        autoHighlight
        renderInput={(params) => (
          <TextField
            {...params}
            autoFocus
            placeholder={t('ideas.filter.allNiches')}
            size="small"
          />
        )}
        sx={{ width: 200 }}
      />
    );
  }

  if (isOrphan) {
    return (
      <Chip
        icon={<LinkOffIcon sx={{ fontSize: 14 }} />}
        label={t('ideas.noNicheChip')}
        size="small"
        color="warning"
        onClick={() => inlineEdit?.activateCell(idea.id, 'niche')}
        sx={{
          borderRadius: '6px',
          fontSize: '0.6875rem',
          height: 22,
          cursor: 'pointer',
          border: 'none',
          backgroundColor: alpha(COLORS.warningDk, 0.10),
          color: 'warning.main',
          '& .MuiChip-icon': { color: 'warning.main' },
        }}
      />
    );
  }

  return (
    <Chip
      label={idea.niche_name}
      size="small"
      onClick={() => inlineEdit?.activateCell(idea.id, 'niche')}
      sx={{
        borderRadius: '6px',
        fontSize: '0.6875rem',
        height: 22,
        cursor: inlineEdit ? 'pointer' : 'default',
        border: 'none',
        backgroundColor: alpha(COLORS.cyan, 0.10),
        color: 'secondary.main',
        fontWeight: 500,
      }}
    />
  );
};

/* ----------- Status chip (clickable to change) ----------- */
const STATUS_CYCLE: Record<string, string> = {
  pending: 'approved',
  approved: 'rejected',
  rejected: 'for_review',
  for_review: 'pending',
};

const StatusChip = ({
  idea,
  inlineEdit,
  onApprove,
  onReject,
}: {
  idea: Idea;
  inlineEdit?: UseIdeaInlineEditReturn;
  onApprove: () => void;
  onReject: () => void;
}) => {
  const { t } = useTranslation();

  const handleClick = () => {
    if (!inlineEdit) return;
    const next = STATUS_CYCLE[idea.status];
    if (next === 'approved') onApprove();
    else if (next === 'rejected') onReject();
    else void inlineEdit.saveStatus?.(idea.id, next);
  };

  return (
    <Chip
      label={t(`ideas.status.${idea.status}`)}
      size="small"
      color={STATUS_COLORS[idea.status]}
      onClick={inlineEdit ? handleClick : undefined}
      sx={{
        borderRadius: '6px',
        fontSize: '0.6875rem',
        height: 22,
        cursor: inlineEdit ? 'pointer' : 'default',
      }}
    />
  );
};
