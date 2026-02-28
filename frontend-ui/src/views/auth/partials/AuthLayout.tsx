import { Box, Paper, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
        // Background gradient blobs
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
          background: 'rgba(255,90,79,0.08)',
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
          background: 'rgba(0,200,215,0.06)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        },
      }}
    >
      {/* Logo + Wordmark */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          mb: 4,
          zIndex: 1,
        }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '8px',
            bgcolor: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.1rem',
            fontWeight: 700,
            color: '#fff',
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          M
        </Box>
        <Typography
          variant="h5"
          sx={{ fontWeight: 700, color: 'text.primary', letterSpacing: '-0.02em' }}
        >
          {t('app.name')}
        </Typography>
      </Box>

      {/* Auth Card */}
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 440,
          p: 5,
          borderRadius: '16px',
          border: '1px solid',
          borderColor: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(255,255,255,0.10)'
              : 'rgba(7,30,38,0.10)',
          bgcolor: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(11,39,49,0.75)'
              : 'background.paper',
          backdropFilter: (theme) =>
            theme.palette.mode === 'dark' ? 'blur(16px)' : 'none',
          zIndex: 1,
        }}
      >
        {children}
      </Paper>
    </Box>
  );
}
