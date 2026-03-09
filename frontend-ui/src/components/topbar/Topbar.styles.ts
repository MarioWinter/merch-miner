import { styled } from '@mui/material/styles';
import { alpha } from '@mui/material';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import { COLORS, DURATION, EASING } from '@/style/constants';

export const TopbarRoot = styled(AppBar)(({ theme }) => ({
  height: 56,
  zIndex: theme.zIndex.drawer + 1,
  backgroundColor: alpha(COLORS.white, 0.85),
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  left: 0,
  right: 0,
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: 0,
    left: 'var(--sidebar-w, 0px)',
    right: 0,
    height: '1px',
    backgroundColor: theme.palette.divider,
    transition: `left ${DURATION.default}ms ${EASING.standard}`,
  },
  ...theme.applyStyles('dark', {
    backgroundColor: alpha(COLORS.inkPaper, 0.75),
  }),
}));

export const TopbarToolbar = styled(Toolbar)({
  height: 56,
  minHeight: '56px !important',
  paddingLeft: 24,
  paddingRight: 24,
  display: 'flex',
  alignItems: 'center',
  position: 'relative',
});
