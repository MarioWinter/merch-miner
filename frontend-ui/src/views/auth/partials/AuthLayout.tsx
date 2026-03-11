import { Stack, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { alpha, styled } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../../../style/constants';

const AuthBackground = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: COLORS.ashDefault,
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
  position: 'relative',
  overflow: 'hidden',
  ...theme.applyStyles('dark', {
    backgroundColor: COLORS.ink,
  }),
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

const LogoSquare = styled(Box)(({ theme }) => ({
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

const AuthPaper = styled(Paper)(({ theme }) => ({
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

interface AuthLayoutProps {
  children: ReactNode;
}

const AuthLayout = ({ children }: AuthLayoutProps) => {
  const { t } = useTranslation();

  return (
    <AuthBackground>
      {/* Logo + Wordmark */}
      <Stack direction="row" alignItems="center" sx={{ gap: 1.5, mb: 4, zIndex: 1 }}>
        <LogoSquare aria-hidden="true">M</LogoSquare>
        <Typography
          variant="h5"
          sx={{ fontWeight: 700, color: 'text.primary', letterSpacing: '-0.02em' }}
        >
          {t('app.name')}
        </Typography>
      </Stack>

      {/* Auth Card */}
      <AuthPaper elevation={0}>
        {children}
      </AuthPaper>
    </AuthBackground>
  );
};

export default AuthLayout;
