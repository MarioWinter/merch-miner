import { Box, Stack } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { COLORS, DURATION, EASING } from '@/style/constants';

export const WorkspaceRoot = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: 'calc(100vh - 56px)',
  margin: '-24px',
  overflow: 'hidden',
});

export const HeaderBar = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  height: 56,
  flexShrink: 0,
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
  borderBottom: '1px solid',
  borderColor: theme.vars.palette.divider,
  backgroundColor: COLORS.inkPaper,
  ...theme.applyStyles('light', {
    backgroundColor: COLORS.white,
  }),
}));

export const TabButton = styled('button', {
  shouldForwardProp: (p) => p !== '$active',
})<{ $active: boolean }>(({ theme, $active }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 16px',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: '0.8125rem',
  fontWeight: 600,
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  backgroundColor: $active ? alpha(COLORS.red, 0.12) : 'transparent',
  color: $active
    ? theme.vars.palette.primary.main
    : theme.vars.palette.text.secondary,
  boxShadow: $active ? `0 0 12px ${alpha(COLORS.red, 0.18)}` : 'none',
  ...theme.applyStyles('light', {
    backgroundColor: $active ? alpha(COLORS.red, 0.08) : 'transparent',
  }),
  '&:hover': {
    backgroundColor: $active
      ? alpha(COLORS.red, 0.16)
      : theme.vars.palette.action.hover,
    color: $active
      ? theme.vars.palette.primary.main
      : theme.vars.palette.text.primary,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.vars.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

export const TabGroup = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: 4,
  borderRadius: 10,
  backgroundColor: COLORS.ink,
  border: '1px solid',
  borderColor: theme.vars.palette.divider,
  ...theme.applyStyles('light', {
    backgroundColor: COLORS.ash,
  }),
}));

export const ContentArea = styled(Box)({
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
  position: 'relative',
  display: 'flex',
});

export const CanvasColumn = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minWidth: 0,
  position: 'relative',
});
