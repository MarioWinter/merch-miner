import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';

import { registerSchema, type RegisterFormValues } from './schemas/registerSchema';
import AuthLayout from '../partials/AuthLayout';
import { authService } from '../../../services/authService';

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setLoading(true);
    try {
      await authService.register({
        email: values.email,
        password: values.password,
        confirmed_password: values.confirmPassword,
      });
      enqueueSnackbar(t('register.success'), { variant: 'success' });
      navigate('/login', { replace: true });
    } catch {
      enqueueSnackbar(t('register.error'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = () => {
    window.location.href = authService.googleLoginUrl();
  };

  return (
    <AuthLayout>
      <Stack spacing={0.5} sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" sx={{ color: 'text.primary' }}>
          {t('register.title')}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('register.subtitle')}
        </Typography>
      </Stack>

      {/* Google OAuth */}
      <Button
        fullWidth
        variant="outlined"
        startIcon={<GoogleIcon />}
        onClick={handleGoogleRegister}
        aria-label={t('auth.googleRegister')}
        sx={{
          mb: 3,
          borderColor: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(255,255,255,0.16)'
              : 'rgba(7,30,38,0.20)',
          color: 'text.primary',
          '&:hover': {
            bgcolor: (theme) =>
              theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(7,30,38,0.04)',
          },
        }}
      >
        {t('auth.googleRegister')}
      </Button>

      <Divider sx={{ mb: 3 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', px: 1 }}>
          {t('auth.orDivider')}
        </Typography>
      </Divider>

      <Box
        component="form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        aria-label="Create account form"
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

          <Controller
            name="password"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t('auth.password')}
                type="password"
                autoComplete="new-password"
                fullWidth
                error={!!errors.password}
                helperText={errors.password ? t(errors.password.message as string) : undefined}
              />
            )}
          />

          <Controller
            name="confirmPassword"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t('auth.confirmPassword')}
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
            disabled={loading}
            aria-label={t('auth.register')}
            sx={{ height: 42 }}
          >
            {loading ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              t('auth.register')
            )}
          </Button>
        </Stack>
      </Box>

      <Typography
        variant="body2"
        align="center"
        sx={{ mt: 3, color: 'text.secondary' }}
      >
        {t('auth.haveAccount')}{' '}
        <Link
          component={RouterLink}
          to="/login"
          sx={{ color: 'primary.main', fontWeight: 600 }}
        >
          {t('auth.signInLink')}
        </Link>
      </Typography>
    </AuthLayout>
  );
}
