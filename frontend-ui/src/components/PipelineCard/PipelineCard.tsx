import { useState } from 'react';
import { Box, Collapse } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import type { PipelineCardProps, PipelineCardState } from './types';
import PipelineCardHeader from './PipelineCardHeader';
import { COLORS, DURATION, EASING, radius } from '../../style/constants';

// ── Stripe color per state ────────────────────────────────────────
const STRIPE_COLOR: Record<PipelineCardState, string> = {
  done: COLORS.successDk,
  active: COLORS.cyan,
  pending: COLORS.snowDisabled,
};

// ── Glassmorphism card container ──────────────────────────────────
const CardRoot = styled(Box, {
  shouldForwardProp: (p) => p !== 'cardState',
})<{ cardState: PipelineCardState }>(({ theme, cardState }) => ({
  position: 'relative',
  borderRadius: radius(theme, 1.5),
  border: `1px solid ${theme.vars.palette.divider}`,
  padding: theme.spacing(1.5, 2),
  paddingLeft: theme.spacing(2.75), // extra space for left stripe
  marginBottom: theme.spacing(1),
  backgroundColor: alpha(COLORS.inkPaper, 0.6),
  backdropFilter: 'blur(8px)',
  transition: [
    `background-color ${DURATION.fast}ms ${EASING.standard}`,
    `transform ${DURATION.fast}ms ${EASING.standard}`,
  ].join(', '),
  overflow: 'hidden',

  '&:hover': {
    backgroundColor: COLORS.inkElevated,
    transform: 'translateY(-1px)',
  },

  // Left status stripe
  '&::before': {
    content: '""',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: STRIPE_COLOR[cardState],
    borderRadius: `${radius(theme, 1.5)}px 0 0 ${radius(theme, 1.5)}px`,
    ...(cardState === 'active' && {
      animation: 'pulseCyan 1.2s infinite',
    }),
  },

  '@keyframes pulseCyan': {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.5 },
  },

  // Light mode overrides
  ...theme.applyStyles('light', {
    backgroundColor: theme.vars.palette.background.paper,
    backdropFilter: 'none',
    '&:hover': {
      backgroundColor: theme.vars.palette.action.hover,
      transform: 'translateY(-1px)',
    },
  }),
}));

// ── Expanded content divider ──────────────────────────────────────
const ContentWrapper = styled(Box)(({ theme }) => ({
  paddingTop: theme.spacing(1.5),
  borderTop: `1px solid ${theme.vars.palette.divider}`,
}));

// ── Component ─────────────────────────────────────────────────────
const PipelineCard = ({
  state,
  icon,
  title,
  badge,
  defaultExpanded,
  children,
}: PipelineCardProps) => {
  const [expanded, setExpanded] = useState(
    defaultExpanded ?? state === 'active',
  );

  return (
    <CardRoot cardState={state}>
      <PipelineCardHeader
        icon={icon}
        title={title}
        badge={badge}
        state={state}
        expanded={expanded}
        onToggle={() => setExpanded((prev) => !prev)}
      />

      <Collapse
        in={expanded}
        timeout={{
          enter: DURATION.default,
          exit: DURATION.fast,
        }}
        easing={{
          enter: EASING.enter,
          exit: EASING.exit,
        }}
      >
        {children && <ContentWrapper>{children}</ContentWrapper>}
      </Collapse>
    </CardRoot>
  );
};

export default PipelineCard;
