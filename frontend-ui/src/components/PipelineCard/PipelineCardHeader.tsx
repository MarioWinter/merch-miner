import { Stack, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { SvgIconComponent } from '@mui/icons-material';
import type { PipelineCardState } from './types';
import { COLORS, DURATION, EASING, radius } from '../../style/constants';

// ── State color map ───────────────────────────────────────────────
const STATE_COLOR: Record<PipelineCardState, string> = {
  done: COLORS.successDk,
  active: COLORS.cyan,
  pending: COLORS.snowDisabled,
};

// ── Styled badge pill ─────────────────────────────────────────────
const BadgePill = styled('span', {
  shouldForwardProp: (p) => p !== 'state' && p !== 'pop',
})<{ state: PipelineCardState; pop: boolean }>(({ theme, state }) => {
  const color = STATE_COLOR[state];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 24,
    padding: theme.spacing(0, 0.75),
    borderRadius: radius(theme, 0.75),
    backgroundColor: alpha(color, 0.12),
    color,
    ...theme.typography.overline,
    fontSize: '0.6875rem',
    fontWeight: 600,
    lineHeight: '20px',
    letterSpacing: 0.5,
    transition: `transform ${DURATION.fast}ms ${EASING.standard}`,
    '@keyframes badgePop': {
      '0%': { transform: 'scale(1)' },
      '50%': { transform: 'scale(1.15)' },
      '100%': { transform: 'scale(1)' },
    },
    // pop class applied via transient prop — triggers once per badge change
    ...(false as boolean ? { animation: `badgePop ${DURATION.fast}ms ${EASING.standard}` } : {}),
  };
});

// ── Styled chevron ────────────────────────────────────────────────
const Chevron = styled(ExpandMoreIcon, {
  shouldForwardProp: (p) => p !== 'expanded',
})<{ expanded: boolean }>(({ theme, expanded }) => ({
  fontSize: 18,
  color: theme.vars.palette.text.disabled,
  transition: `transform ${DURATION.default}ms ${EASING.enter}`,
  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
}));

// ── Props ─────────────────────────────────────────────────────────
interface PipelineCardHeaderProps {
  icon: SvgIconComponent;
  title: string;
  badge?: string;
  state: PipelineCardState;
  expanded: boolean;
  onToggle: () => void;
}

// ── Component ─────────────────────────────────────────────────────
const PipelineCardHeader = ({
  icon: Icon,
  title,
  badge,
  state,
  expanded,
  onToggle,
}: PipelineCardHeaderProps) => {
  const color = STATE_COLOR[state];

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      onClick={onToggle}
      sx={{ height: 40, cursor: 'pointer', userSelect: 'none' }}
    >
      <Icon sx={{ fontSize: 18, color }} />

      <Typography variant="subtitle2" sx={{ flex: 1 }}>
        {title}
      </Typography>

      {badge != null && (
        <BadgePill state={state} pop={false}>
          {badge}
        </BadgePill>
      )}

      <Chevron expanded={expanded} />
    </Stack>
  );
};

export { STATE_COLOR };
export default PipelineCardHeader;
