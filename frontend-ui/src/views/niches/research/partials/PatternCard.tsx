import { Box, Collapse, IconButton, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useState } from 'react';
import type { PatternItem } from '../types';

interface PatternCardProps {
  pattern: PatternItem;
}

const PATTERN_LABELS: Record<string, string> = {
  IDENTITY_DECLARATION: 'Identity Declaration',
  GROUP_LEADER: 'Group Leader',
  TRIBE_COMMUNITY: 'Tribe / Community',
  FUNNY_ACTIVITY: 'Funny Activity',
  CROSS_NICHE_EVENTS: 'Cross-Niche Events',
  CROSS_NICHE_MASHUP: 'Cross-Niche Mashup',
  ADDICTION_OBSESSION: 'Addiction / Obsession',
  VINTAGE_LEGACY: 'Vintage / Legacy',
  ACHIEVEMENT_GAMIFIED: 'Achievement / Gamified',
  JOB_PROFESSION_PARODY: 'Job / Profession Parody',
  RELATIONSHIP_HUMOR: 'Relationship Humor',
  BOUNDARY_GATEKEEPING: 'Boundary Gatekeeping',
  ENDURANCE_SURVIVAL: 'Endurance / Survival',
  COMPETENCE_EXPERTISE: 'Competence / Expertise',
  CHAOS_CONTROL: 'Chaos / Control',
  SELF_CARE_PRIORITIES: 'Self-Care Priorities',
};

const ActiveCard = styled(Box)(({ theme }) => ({
  background: theme.vars.palette.background.paper,
  border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
  borderRadius: 12,
  padding: theme.spacing(2, 2.5),
  transition: 'box-shadow 150ms ease',
  '&:hover': {
    boxShadow: `0 4px 16px ${alpha(theme.palette.success.main, 0.1)}`,
  },
}));

const InactiveCard = styled(Box)(({ theme }) => ({
  background: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 12,
  padding: theme.spacing(1.5, 2.5),
  opacity: 0.6,
  cursor: 'pointer',
  '&:hover': {
    opacity: 0.8,
  },
}));

export const PatternCard = ({ pattern }: PatternCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const label = PATTERN_LABELS[pattern.name] ?? pattern.name;

  if (pattern.present) {
    return (
      <ActiveCard>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <CheckCircleIcon color="success" sx={{ fontSize: 20 }} />
          <Typography variant="subtitle2" fontWeight={600}>
            {label}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {pattern.context}
        </Typography>
      </ActiveCard>
    );
  }

  return (
    <InactiveCard onClick={() => setExpanded((prev) => !prev)}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CancelIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
        <Typography variant="body2" color="text.disabled" sx={{ flex: 1 }}>
          {label}
        </Typography>
        <IconButton
          size="small"
          sx={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
          }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <ExpandMoreIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
      <Collapse in={expanded}>
        <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
          {pattern.context || 'Not detected in this niche.'}
        </Typography>
      </Collapse>
    </InactiveCard>
  );
};
