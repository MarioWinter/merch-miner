import { useState } from 'react';
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';
import { IdeaCard } from './IdeaCard';
import type { Idea, SignalType, MarketConfidence } from '../types';
import type { UseIdeaInlineEditReturn } from '../hooks/useInlineEdit';

interface IdeaSourceGroupProps {
  sourceIdea: Idea;
  adaptedIdeas: Idea[];
  onApprove: (idea: Idea) => void;
  onReject: (idea: Idea) => void;
  onImprove: (idea: Idea) => void;
  onAdapt: (idea: Idea) => void;
  onDelete: (idea: Idea) => void;
  onRegenerate: (idea: Idea) => void;
  onDoubleClick?: (idea: Idea) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  inlineEdit?: UseIdeaInlineEditReturn;
}

const GroupRoot = styled(Box)(({ theme }) => ({
  borderRadius: 12,
  overflow: 'hidden',
  border: `1px solid ${theme.vars.palette.divider}`,
  borderLeft: `3px solid ${theme.vars.palette.primary.main}`,
}));

const GroupHeader = styled(Stack)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
  cursor: 'pointer',
  transition: 'background-color 150ms ease',
  '&:hover': {
    backgroundColor: alpha(COLORS.white, 0.02),
    ...theme.applyStyles('light', {
      backgroundColor: alpha(COLORS.ink, 0.02),
    }),
  },
}));

const SignalSectionHeader = styled(Stack, {
  shouldForwardProp: (prop) => prop !== 'signalColor',
})<{ signalColor: string }>(({ theme, signalColor }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: `${theme.spacing(1)} ${theme.spacing(2)}`,
  marginTop: theme.spacing(1),
  marginLeft: theme.spacing(4),
  marginRight: theme.spacing(2),
  borderRadius: 8,
  backgroundColor: alpha(signalColor, 0.06),
}));

const SignalDot = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'dotColor',
})<{ dotColor: string }>({
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: 'currentColor',
});

const CONFIDENCE_ORDER: Record<MarketConfidence, number> = {
  High: 0,
  Medium: 1,
  Low: 2,
};

const sortByConfidence = (a: Idea, b: Idea): number => {
  const aVal = a.market_confidence ? CONFIDENCE_ORDER[a.market_confidence] : 3;
  const bVal = b.market_confidence ? CONFIDENCE_ORDER[b.market_confidence] : 3;
  return aVal - bVal;
};

const groupBySignal = (ideas: Idea[]): Record<SignalType, Idea[]> => {
  const grouped: Record<SignalType, Idea[]> = { self: [], other: [] };
  for (const idea of ideas) {
    const key = idea.signal_type ?? 'self';
    grouped[key].push(idea);
  }
  grouped.self.sort(sortByConfidence);
  grouped.other.sort(sortByConfidence);
  return grouped;
};

const STATUS_COLORS: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  pending: 'default',
  approved: 'success',
  rejected: 'error',
  for_review: 'warning',
};

export const IdeaSourceGroup = ({
  sourceIdea,
  adaptedIdeas,
  onApprove,
  onReject,
  onImprove,
  onAdapt,
  onDelete,
  onRegenerate,
  onDoubleClick,
  selectedIds,
  onToggleSelect,
  inlineEdit,
}: IdeaSourceGroupProps) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [selfVisible, setSelfVisible] = useState(true);
  const [otherVisible, setOtherVisible] = useState(true);
  const grouped = groupBySignal(adaptedIdeas);
  const totalAdapted = adaptedIdeas.length;

  return (
    <GroupRoot>
      {/* Collapsed header */}
      <GroupHeader
        direction="column"
        spacing={0.75}
        onClick={() => setExpanded(!expanded)}
        role="button"
        aria-expanded={expanded}
        aria-label={expanded ? t('ideas.sourceGroup.collapse') : t('ideas.sourceGroup.expand')}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%' }}>
          <IconButton size="small" aria-label="Toggle group" sx={{ p: 0.25 }}>
            {expanded ? (
              <ExpandMoreIcon sx={{ fontSize: 20 }} />
            ) : (
              <ChevronRightIcon sx={{ fontSize: 20 }} />
            )}
          </IconButton>
          <Typography variant="body1" sx={{ fontWeight: 600, flex: 1 }} noWrap>
            {sourceIdea.slogan_text}
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ pl: 4.5 }} flexWrap="wrap" useFlexGap>
          {sourceIdea.niche_name && (
            <Chip
              label={sourceIdea.niche_name}
              size="small"
              sx={{
                borderRadius: '6px',
                fontSize: '0.6875rem',
                height: 22,
                border: 'none',
                backgroundColor: alpha(COLORS.cyan, 0.10),
                color: 'secondary.main',
                fontWeight: 500,
              }}
            />
          )}
          <Chip
            label={t(`ideas.status.${sourceIdea.status}`)}
            size="small"
            color={STATUS_COLORS[sourceIdea.status]}
            sx={{ borderRadius: '6px', fontSize: '0.6875rem', height: 22 }}
          />
          {totalAdapted > 0 && (
            <Chip
              label={`${totalAdapted} ${t('ideas.sourceGroup.adapted')}`}
              size="small"
              sx={{
                borderRadius: '6px',
                fontSize: '0.6875rem',
                height: 22,
                border: 'none',
                backgroundColor: alpha(COLORS.cyan, 0.10),
                color: 'text.secondary',
              }}
            />
          )}
        </Stack>
      </GroupHeader>

      {/* Expanded content */}
      <Collapse in={expanded}>
        <Box sx={{ pb: 2 }}>
          {/* Source idea card */}
          <Box sx={{ px: 2, pt: 1 }}>
            <IdeaCard
              idea={sourceIdea}
              onApprove={() => onApprove(sourceIdea)}
              onReject={() => onReject(sourceIdea)}
              onImprove={() => onImprove(sourceIdea)}
              onAdapt={() => onAdapt(sourceIdea)}
              onDelete={() => onDelete(sourceIdea)}
              onRegenerate={() => onRegenerate(sourceIdea)}
              onDoubleClick={() => onDoubleClick?.(sourceIdea)}
              isSelected={selectedIds.has(sourceIdea.id)}
              onToggleSelect={() => onToggleSelect(sourceIdea.id)}
              inlineEdit={inlineEdit}
            />
          </Box>

          {/* SELF signal group */}
          {grouped.self.length > 0 && (
            <>
              <SignalSectionHeader
                signalColor={COLORS.red}
                onClick={(e) => { e.stopPropagation(); setSelfVisible((v) => !v); }}
                sx={{ cursor: 'pointer' }}
              >
                <SignalDot dotColor={COLORS.red} sx={{ color: 'primary.main' }} />
                <Typography
                  variant="overline"
                  sx={{ color: 'primary.main', letterSpacing: '0.08em', flex: 1 }}
                >
                  {t('ideas.signal.self')} ({grouped.self.length})
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  {selfVisible ? '▾' : '▸'}
                </Typography>
              </SignalSectionHeader>
              {selfVisible && (
                <Stack spacing={1} sx={{ px: 2, pt: 1 }}>
                  {grouped.self.map((idea) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      indented
                      onApprove={() => onApprove(idea)}
                      onReject={() => onReject(idea)}
                      onImprove={() => onImprove(idea)}
                      onAdapt={() => onAdapt(idea)}
                      onDelete={() => onDelete(idea)}
                      onRegenerate={() => onRegenerate(idea)}
                      onDoubleClick={() => onDoubleClick?.(idea)}
                      isSelected={selectedIds.has(idea.id)}
                      onToggleSelect={() => onToggleSelect(idea.id)}
                      inlineEdit={inlineEdit}
                    />
                  ))}
                </Stack>
              )}
            </>
          )}

          {/* OTHER signal group */}
          {grouped.other.length > 0 && (
            <>
              <SignalSectionHeader
                signalColor={COLORS.cyan}
                onClick={(e) => { e.stopPropagation(); setOtherVisible((v) => !v); }}
                sx={{ cursor: 'pointer' }}
              >
                <SignalDot dotColor={COLORS.cyan} sx={{ color: 'secondary.main' }} />
                <Typography
                  variant="overline"
                  sx={{ color: 'secondary.main', letterSpacing: '0.08em', flex: 1 }}
                >
                  {t('ideas.signal.other')} ({grouped.other.length})
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  {otherVisible ? '▾' : '▸'}
                </Typography>
              </SignalSectionHeader>
              {otherVisible && (
                <Stack spacing={1} sx={{ px: 2, pt: 1 }}>
                  {grouped.other.map((idea) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      indented
                      onApprove={() => onApprove(idea)}
                      onReject={() => onReject(idea)}
                      onImprove={() => onImprove(idea)}
                      onAdapt={() => onAdapt(idea)}
                      onDelete={() => onDelete(idea)}
                      onRegenerate={() => onRegenerate(idea)}
                      onDoubleClick={() => onDoubleClick?.(idea)}
                      isSelected={selectedIds.has(idea.id)}
                      onToggleSelect={() => onToggleSelect(idea.id)}
                      inlineEdit={inlineEdit}
                    />
                  ))}
                </Stack>
              )}
            </>
          )}
        </Box>
      </Collapse>
    </GroupRoot>
  );
};
