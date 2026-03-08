import { Box, Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../../../style/constants';

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
            color: COLORS.white,
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
        sx={(theme) => ({
          width: '100%',
          maxWidth: 440,
          p: 5,
          borderRadius: '16px',
          border: '1px solid',
          borderColor: alpha(COLORS.ink, 0.10),
          bgcolor: 'background.paper',
          backdropFilter: 'none',
          zIndex: 1,
          ...theme.applyStyles('dark', {
            borderColor: alpha(COLORS.white, 0.10),
            bgcolor: alpha(COLORS.inkPaper, 0.75),
            backdropFilter: 'blur(16px)',
          }),
        })}
      >
        {children}
      </Paper>
    </Box>
  );
}
