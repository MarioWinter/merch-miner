import { useState } from 'react';
import {
  Box,
  Collapse,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useTranslation } from 'react-i18next';
import { IdeaCard } from './IdeaCard';
import type { Idea, SignalType, MarketConfidence } from '../types';

interface IdeaSourceGroupProps {
  sourceIdea: Idea;
  adaptedIdeas: Idea[];
  onApprove: (idea: Idea) => void;
  onReject: (idea: Idea) => void;
  onImprove: (idea: Idea) => void;
  onAdapt: (idea: Idea) => void;
  onDelete: (idea: Idea) => void;
  onRegenerate: (idea: Idea) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}

const GroupRoot = styled(Box)(({ theme }) => ({
  border: `1px solid ${alpha('#fff', 0.06)}`,
  borderRadius: 12,
  overflow: 'hidden',
  ...theme.applyStyles('light', {
    border: `1px solid ${alpha('#071E26', 0.06)}`,
  }),
}));

const GroupHeader = styled(Stack)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: alpha('#fff', 0.02),
  },
  ...theme.applyStyles('light', {
    '&:hover': {
      backgroundColor: alpha('#071E26', 0.02),
    },
  }),
}));

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

export const IdeaSourceGroup = ({
  sourceIdea,
  adaptedIdeas,
  onApprove,
  onReject,
  onImprove,
  onAdapt,
  onDelete,
  onRegenerate,
  selectedIds,
  onToggleSelect,
}: IdeaSourceGroupProps) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const grouped = groupBySignal(adaptedIdeas);
  const totalAdapted = adaptedIdeas.length;

  return (
    <GroupRoot>
      <GroupHeader
        direction="row"
        alignItems="center"
        spacing={1}
        onClick={() => setExpanded(!expanded)}
        role="button"
        aria-expanded={expanded}
      >
        <IconButton size="small" aria-label="Toggle group">
          {expanded ? (
            <ExpandLessIcon sx={{ fontSize: 20 }} />
          ) : (
            <ExpandMoreIcon sx={{ fontSize: 20 }} />
          )}
        </IconButton>
        <Typography variant="body1" sx={{ fontWeight: 600, flex: 1 }}>
          {sourceIdea.slogan_text}
        </Typography>
        {totalAdapted > 0 && (
          <Typography variant="caption" color="text.secondary">
            {totalAdapted} {t('ideas.adapted')}
          </Typography>
        )}
      </GroupHeader>

      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 2 }}>
          {/* Source idea card */}
          <IdeaCard
            idea={sourceIdea}
            onApprove={() => onApprove(sourceIdea)}
            onReject={() => onReject(sourceIdea)}
            onImprove={() => onImprove(sourceIdea)}
            onAdapt={() => onAdapt(sourceIdea)}
            onDelete={() => onDelete(sourceIdea)}
            onRegenerate={() => onRegenerate(sourceIdea)}
            isSelected={selectedIds.has(sourceIdea.id)}
            onToggleSelect={() => onToggleSelect(sourceIdea.id)}
          />

          {/* SELF signal group */}
          {grouped.self.length > 0 && (
            <>
              <Divider sx={{ my: 1.5 }}>
                <Typography variant="overline" color="primary.main">
                  SELF
                </Typography>
              </Divider>
              <Stack spacing={1}>
                {grouped.self.map((idea) => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    onApprove={() => onApprove(idea)}
                    onReject={() => onReject(idea)}
                    onImprove={() => onImprove(idea)}
                    onAdapt={() => onAdapt(idea)}
                    onDelete={() => onDelete(idea)}
                    onRegenerate={() => onRegenerate(idea)}
                    isSelected={selectedIds.has(idea.id)}
                    onToggleSelect={() => onToggleSelect(idea.id)}
                  />
                ))}
              </Stack>
            </>
          )}

          {/* OTHER signal group */}
          {grouped.other.length > 0 && (
            <>
              <Divider sx={{ my: 1.5 }}>
                <Typography variant="overline" color="secondary.main">
                  OTHER
                </Typography>
              </Divider>
              <Stack spacing={1}>
                {grouped.other.map((idea) => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    onApprove={() => onApprove(idea)}
                    onReject={() => onReject(idea)}
                    onImprove={() => onImprove(idea)}
                    onAdapt={() => onAdapt(idea)}
                    onDelete={() => onDelete(idea)}
                    onRegenerate={() => onRegenerate(idea)}
                    isSelected={selectedIds.has(idea.id)}
                    onToggleSelect={() => onToggleSelect(idea.id)}
                  />
                ))}
              </Stack>
            </>
          )}
        </Box>
      </Collapse>
    </GroupRoot>
  );
};
