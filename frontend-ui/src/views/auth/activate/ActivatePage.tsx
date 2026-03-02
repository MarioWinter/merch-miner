import { useEffect, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useTranslation } from 'react-i18next';

import AuthLayout from '../partials/AuthLayout';
import { apiClient } from '../../../services/authService';

type ActivateStatus = 'loading' | 'success' | 'error';

export default function ActivatePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const uid = searchParams.get('uid');
  const token = searchParams.get('token');

  // If params are missing, start in error state — no effect needed
  const [status, setStatus] = useState<ActivateStatus>(
    uid && token ? 'loading' : 'error'
  );

  useEffect(() => {
    if (!uid || !token) return;

    let cancelled = false;

    apiClient
      .post('/api/auth/activate/', { uid, token })
      .then(() => {
        if (!cancelled) setStatus('success');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [uid, token]);

  return (
    <AuthLayout>
      <Stack spacing={3} alignItems="center" sx={{ py: 2, textAlign: 'center' }}>
        {status === 'loading' && (
          <>
            <CircularProgress color="primary" aria-label={t('activate.loading')} />
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              {t('activate.loading')}
            </Typography>
          </>
        )}

        {status === 'success' && (
          <>
            <Box
              sx={{
                width: 64,
                height: 64,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                bgcolor: 'rgba(34,211,163,0.12)',
              }}
            >
              <CheckCircleOutlineIcon sx={{ fontSize: 36, color: 'success.main' }} />
            </Box>
            <Typography variant="h4" component="h1" sx={{ color: 'text.primary' }}>
              {t('activate.title')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t('activate.success')}
            </Typography>
            <Button
              component={RouterLink}
              to="/login"
              variant="contained"
              aria-label={t('activate.goToLogin')}
            >
              {t('activate.goToLogin')}
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <Box
              sx={{
                width: 64,
                height: 64,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                bgcolor: 'rgba(244,63,58,0.12)',
              }}
            >
              <ErrorOutlineIcon sx={{ fontSize: 36, color: 'error.main' }} />
            </Box>
            <Typography variant="h4" component="h1" sx={{ color: 'text.primary' }}>
              {t('activate.title')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t('activate.error')}
            </Typography>
            <Button
              component={RouterLink}
              to="/login"
              variant="outlined"
              aria-label={t('activate.goToLogin')}
            >
              {t('activate.goToLogin')}
            </Button>
          </>
        )}
      </Stack>
    </AuthLayout>
  );
}
