import { Box, Divider, IconButton, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { COLORS, DURATION, EASING } from '@/style/constants';

export const BOTTOM_TOOLBAR_HEIGHT = 48;

export const ToolbarRoot = styled(Box)(({ theme }) => ({
  height: BOTTOM_TOOLBAR_HEIGHT,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  paddingLeft: theme.spacing(1.5),
  paddingRight: theme.spacing(1.5),
  borderTop: '1px solid',
  borderColor: theme.vars.palette.divider,
  backgroundColor: COLORS.ink,
  transition: `background-color ${DURATION.fast}ms ${EASING.standard}`,
  ...theme.applyStyles('light', {
    backgroundColor: COLORS.white,
  }),
}));

export const ToolButton = styled(IconButton, {
  shouldForwardProp: (p) => p !== '$active',
})<{ $active?: boolean }>(({ theme, $active }) => ({
  width: 32,
  height: 32,
  borderRadius: 8,
  color: $active
    ? theme.vars.palette.primary.main
    : theme.vars.palette.text.secondary,
  backgroundColor: $active ? alpha(COLORS.red, 0.12) : 'transparent',
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    backgroundColor: $active
      ? alpha(COLORS.red, 0.18)
      : alpha(COLORS.inkElevated, 0.6),
    color: $active
      ? theme.vars.palette.primary.main
      : theme.vars.palette.text.primary,
  },
  ...theme.applyStyles('light', {
    backgroundColor: $active ? alpha(COLORS.red, 0.08) : 'transparent',
    '&:hover': {
      backgroundColor: $active
        ? alpha(COLORS.red, 0.12)
        : theme.vars.palette.action.hover,
    },
  }),
}));

export const AiSparkleButton = styled(IconButton)(({ theme }) => ({
  width: 32,
  height: 32,
  borderRadius: 8,
  background: `linear-gradient(135deg, ${COLORS.red} 0%, ${COLORS.redDk} 100%)`,
  color: COLORS.white,
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    background: `linear-gradient(135deg, ${COLORS.redLt} 0%, ${COLORS.red} 100%)`,
    boxShadow: `0 0 12px ${alpha(COLORS.red, 0.4)}`,
  },
  ...theme.applyStyles('light', {
    '&:hover': {
      boxShadow: `0 0 12px ${alpha(COLORS.red, 0.3)}`,
    },
  }),
}));

export const ZoomText = styled(Typography)(({ theme }) => ({
  minWidth: 48,
  textAlign: 'center',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: theme.vars.palette.text.secondary,
  userSelect: 'none',
  cursor: 'default',
}));

export const ToolbarDivider = styled(Divider)(({ theme }) => ({
  height: 24,
  marginLeft: theme.spacing(0.5),
  marginRight: theme.spacing(0.5),
}));
