import { alpha, styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { COLORS } from '../../../style/constants';

export const AuthBackground = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: theme.palette.background.default,
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '-10%',
    right: '-5%',
    width: 480,
    height: 480,
    borderRadius: '50%',
    background: alpha(COLORS.red, 0.08),
    filter: 'blur(80px)',
    pointerEvents: 'none',
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: '-10%',
    left: '-5%',
    width: 480,
    height: 480,
    borderRadius: '50%',
    background: alpha(COLORS.cyan, 0.06),
    filter: 'blur(80px)',
    pointerEvents: 'none',
  },
}));

export const LogoSquare = styled(Box)(({ theme }) => ({
  width: 32,
  height: 32,
  borderRadius: '8px',
  backgroundColor: theme.palette.primary.main,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1.1rem',
  fontWeight: 700,
  color: COLORS.white,
  lineHeight: 1,
}));

export const AuthPaper = styled(Paper)(({ theme }) => ({
  width: '100%',
  maxWidth: 440,
  padding: theme.spacing(5),
  borderRadius: '16px',
  border: '1px solid',
  borderColor: alpha(COLORS.ink, 0.10),
  backgroundColor: theme.palette.background.paper,
  backdropFilter: 'none',
  zIndex: 1,
  ...theme.applyStyles('dark', {
    borderColor: alpha(COLORS.white, 0.10),
    backgroundColor: alpha(COLORS.inkPaper, 0.75),
    backdropFilter: 'blur(16px)',
  }),
}));
