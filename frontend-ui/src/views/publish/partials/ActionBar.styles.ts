import { Box, Button, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { COLORS, DURATION, EASING } from '@/style/constants';

export const Dock = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: theme.spacing(3),
  left: '50%',
  transform: 'translateX(-50%)',
  backgroundColor: alpha(COLORS.inkPaper, 0.9),
  backdropFilter: 'blur(20px)',
  border: `1px solid ${alpha('#fff', 0.12)}`,
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  boxShadow: `0 8px 32px ${alpha(COLORS.ink, 0.5)}`,
  padding: theme.spacing(1, 2),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  minWidth: theme.spacing(50),
  maxWidth: theme.spacing(87.5),
  zIndex: theme.zIndex.speedDial,
  [theme.breakpoints.down('sm')]: {
    minWidth: 'auto',
    padding: theme.spacing(1),
    gap: theme.spacing(0.5),
  },
}));

export const ActionButton = styled(Button)(({ theme }) => ({
  height: theme.spacing(4),
  fontSize: theme.typography.caption.fontSize,
  fontWeight: 500,
  color: theme.vars.palette.text.secondary,
  borderRadius: Number(theme.shape.borderRadius) * 0.75,
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  '& .MuiButton-startIcon': { '& > *': { fontSize: 16 } },
  '&:hover': {
    backgroundColor: alpha('#fff', 0.08),
    color: theme.vars.palette.text.primary,
  },
}));

export const CounterText = styled(Typography)({
  fontWeight: 600,
  color: COLORS.cyan,
  transition: `transform ${DURATION.fast}ms ${EASING.standard}`,
});

export const Separator = styled(Box)(({ theme }) => ({
  width: 1,
  height: theme.spacing(3),
  backgroundColor: alpha('#fff', 0.08),
  flexShrink: 0,
}));

/**
 * Stagger delay (ms) between children on enter animation.
 * Fast enough to feel snappy, slow enough to read the cascade.
 */
export const STAGGER_STEP_MS = 30;
