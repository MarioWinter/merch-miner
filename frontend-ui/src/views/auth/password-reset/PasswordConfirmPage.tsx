import { useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
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
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';

import {
  passwordConfirmSchema,
  type PasswordConfirmFormValues,
} from './schemas/passwordResetSchema';
import AuthLayout from '../partials/AuthLayout';
import { authService } from '../../../services/authService';

export default function PasswordConfirmPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);

  const uid = searchParams.get('uid') ?? '';
  const token = searchParams.get('token') ?? '';

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordConfirmFormValues>({
    resolver: zodResolver(passwordConfirmSchema),
    defaultValues: { new_password: '', confirmPassword: '' },
  });

  const onSubmit = async (values: PasswordConfirmFormValues) => {
    setLoading(true);
    try {
      await authService.confirmPasswordReset({
        uid,
        token,
        new_password: values.new_password,
        confirm_password: values.confirmPassword,
      });
      enqueueSnackbar(t('passwordReset.confirmSuccess'), { variant: 'success' });
      navigate('/login', { replace: true });
    } catch {
      enqueueSnackbar(t('passwordReset.confirmError'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <Stack spacing={0.5} sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" sx={{ color: 'text.primary' }}>
          {t('passwordReset.confirmTitle')}
        </Typography>
      </Stack>

      <Box
        component="form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        aria-label="Set new password form"
      >
        <Stack spacing={2}>
          <Controller
            name="new_password"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t('auth.newPassword')}
                type="password"
                autoComplete="new-password"
                autoFocus
                fullWidth
                error={!!errors.new_password}
                helperText={
                  errors.new_password ? t(errors.new_password.message as string) : undefined
                }
              />
            )}
          />

          <Controller
            name="confirmPassword"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t('auth.confirmNewPassword')}
                type="password"
                autoComplete="new-password"
                fullWidth
                error={!!errors.confirmPassword}
                helperText={
                  errors.confirmPassword
                    ? t(errors.confirmPassword.message as string)
                    : undefined
                }
              />
            )}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading || !uid || !token}
            aria-label={t('auth.setNewPassword')}
            sx={{ height: 42 }}
          >
            {loading ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              t('auth.setNewPassword')
            )}
          </Button>
        </Stack>
      </Box>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
        <Link
          component={RouterLink}
          to="/login"
          variant="body2"
          sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
        >
          {t('auth.backToLogin')}
        </Link>
      </Box>
    </AuthLayout>
  );
}
