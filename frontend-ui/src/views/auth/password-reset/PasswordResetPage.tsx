import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Box,
  Button,
  CircularProgress,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';

import {
  passwordResetSchema,
  type PasswordResetFormValues,
} from './schemas/passwordResetSchema';
import AuthLayout from '../partials/AuthLayout';
import { authService } from '../../../services/authService';

const PasswordResetPage = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordResetFormValues>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: PasswordResetFormValues) => {
    setLoading(true);
    try {
      await authService.requestPasswordReset(values);
      setSubmitted(true);
      enqueueSnackbar(t('passwordReset.success'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('passwordReset.error'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <Stack spacing={0.5} sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" sx={{ color: 'text.primary' }}>
          {t('passwordReset.title')}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('passwordReset.subtitle')}
        </Typography>
      </Stack>

      {submitted ? (
        <Stack spacing={3} alignItems="center" sx={{ textAlign: 'center', py: 2 }}>
          <Typography variant="body1" sx={{ color: 'success.main' }}>
            {t('passwordReset.success')}
          </Typography>
          <Link
            component={RouterLink}
            to="/login"
            sx={{ color: 'primary.main', fontWeight: 600 }}
          >
            {t('auth.backToLogin')}
          </Link>
        </Stack>
      ) : (
        <Box
          component="form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          aria-label="Password reset form"
        >
          <Stack spacing={2}>
            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={t('auth.email')}
                  type="email"
                  autoComplete="email"
                  autoFocus
                  fullWidth
                  error={!!errors.email}
                  helperText={errors.email ? t(errors.email.message as string) : undefined}
                />
              )}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              aria-label={t('auth.resetPassword')}
              sx={{ height: 42 }}
            >
              {loading ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                t('auth.resetPassword')
              )}
            </Button>
          </Stack>
        </Box>
      )}

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
        <Link
          component={RouterLink}
          to="/login"
          variant="body2"
          sx={{
            color: 'text.secondary',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            '&:hover': { color: 'text.primary' },
          }}
        >
          <ArrowBackIcon sx={{ fontSize: 16 }} />
          {t('auth.backToLogin')}
        </Link>
      </Box>
    </AuthLayout>
  );
};

export default PasswordResetPage;
