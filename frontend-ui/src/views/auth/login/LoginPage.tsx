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

import { loginSchema, type LoginFormValues } from './schemas/loginSchema';
import AuthLayout from '../partials/AuthLayout';
import GoogleButton from '../partials/GoogleButton';
import { authService } from '../../../services/authService';
import { useAppDispatch } from '../../../store/hooks';
import { setUser, setError } from '../../../store/authSlice';

const LoginPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setLoading(true);
    dispatch(setError(null));
    try {
      const data = await authService.login(values);
      dispatch(setUser({ id: data.user.id, email: data.user.email, first_name: data.user.first_name ?? '', avatar_url: data.user.avatar_url ?? null }));
      enqueueSnackbar(t('login.success'), { variant: 'success' });
      navigate('/', { replace: true });
    } catch {
      dispatch(setError(t('login.error')));
      enqueueSnackbar(t('login.error'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = authService.googleLoginUrl();
  };

  return (
    <AuthLayout>
      <Stack spacing={0.5} sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" sx={{ color: 'text.primary' }}>
          {t('login.title')}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('login.subtitle')}
        </Typography>
      </Stack>

      {/* Google OAuth */}
      <GoogleButton
        fullWidth
        variant="outlined"
        startIcon={<GoogleIcon />}
        onClick={handleGoogleLogin}
        aria-label={t('auth.googleLogin')}
      >
        {t('auth.googleLogin')}
      </GoogleButton>

      <Divider sx={{ mb: 3 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', px: 1 }}>
          {t('auth.orDivider')}
        </Typography>
      </Divider>

      {/* Email/Password form */}
      <Box
        component="form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        aria-label="Sign in form"
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
                slotProps={{ htmlInput: { 'aria-describedby': errors.email ? 'email-error' : undefined } }}
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
                autoComplete="current-password"
                fullWidth
                error={!!errors.password}
                helperText={errors.password ? t(errors.password.message as string) : undefined}
              />
            )}
          />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Link
              component={RouterLink}
              to="/password-reset"
              variant="caption"
              sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
            >
              {t('auth.forgotPassword')}
            </Link>
          </Box>

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading}
            aria-label={t('auth.login')}
            sx={{ height: 42 }}
          >
            {loading ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              t('auth.login')
            )}
          </Button>
        </Stack>
      </Box>

      <Typography
        variant="body2"
        align="center"
        sx={{ mt: 3, color: 'text.secondary' }}
      >
        {t('auth.noAccount')}{' '}
        <Link
          component={RouterLink}
          to="/register"
          sx={{ color: 'primary.main', fontWeight: 600 }}
        >
          {t('auth.signUpLink')}
        </Link>
      </Typography>
    </AuthLayout>
  );
};

export default LoginPage;
