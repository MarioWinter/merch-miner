import { Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthBackground, LogoSquare, AuthPaper } from './AuthLayout.styles';

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
