import { useRef } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Divider,
  Skeleton,
  Stack,
  TextField,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { SettingsCard, SectionTitle } from '../../../components/SettingsCard';
import { useProfileForm } from './hooks/useProfileForm';

// ------------------------------------------------------------------
// Styled helpers
// ------------------------------------------------------------------

const AvatarWrapper = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),       // 16px — design-system §4 spacing token
  marginBottom: theme.spacing(3), // 24px
}));

const LargeAvatar = styled(Avatar)({
  width: 80,
  height: 80,
  fontSize: '2rem',
});

// ------------------------------------------------------------------

export default function ProfileSection() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    profile,
    loadingProfile,
    profileError,
    savingProfile,
    avatarUploading,
    profileForm,
    passwordForm,
    handleSaveProfile,
    handleAvatarUpload,
    handleChangePassword,
  } = useProfileForm();

  const {
    control: profileControl,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors },
  } = profileForm;

  const {
    control: passwordControl,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors },
  } = passwordForm;

  // ----------------------------------------------------------------
  // Loading state
  // ----------------------------------------------------------------
  if (loadingProfile) {
    return (
      <SettingsCard>
        <Skeleton variant="text" width={180} height={28} sx={{ mb: 3 }} />
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <Skeleton variant="circular" width={80} height={80} />
          <Skeleton variant="rounded" width={140} height={36} />
        </Stack>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={40} sx={{ mb: 2 }} />
        ))}
      </SettingsCard>
    );
  }

  // ----------------------------------------------------------------
  // Error state
  // ----------------------------------------------------------------
  if (profileError) {
    return (
      <SettingsCard>
        <Alert severity="error">{profileError}</Alert>
      </SettingsCard>
    );
  }

  const avatarInitial =
    profile?.first_name?.charAt(0)?.toUpperCase() ||
    profile?.email?.charAt(0)?.toUpperCase() ||
    '?';

  return (
    <Stack spacing={3}>
      {/* ---------------------------------------------------------- */}
      {/* Profile info card                                           */}
      {/* ---------------------------------------------------------- */}
      <SettingsCard aria-label={t('settings.profile.title')}>
        <form onSubmit={handleProfileSubmit(handleSaveProfile)}>
          <SectionTitle>{t('settings.profile.title')}</SectionTitle>

          {/* Avatar row */}
          <AvatarWrapper>
            <LargeAvatar
              src={profile?.avatar_url ?? undefined}
              alt={t('settings.profile.avatarAlt')}
            >
              {!profile?.avatar_url && avatarInitial}
            </LargeAvatar>

            <Box>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                aria-label={t('settings.profile.uploadAvatar')}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarUpload(file);
                  e.target.value = '';
                }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                startIcon={
                  avatarUploading ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : undefined
                }
              >
                {t('settings.profile.uploadAvatar')}
              </Button>
            </Box>
          </AvatarWrapper>

          {/* Editable fields */}
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Controller
                name="first_name"
                control={profileControl}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label={t('settings.profile.firstName')}
                    fullWidth
                    error={!!profileErrors.first_name}
                    helperText={profileErrors.first_name?.message}
                    slotProps={{ htmlInput: { 'aria-label': t('settings.profile.firstName') } }}
                  />
                )}
              />
              <Controller
                name="last_name"
                control={profileControl}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label={t('settings.profile.lastName')}
                    fullWidth
                    error={!!profileErrors.last_name}
                    helperText={profileErrors.last_name?.message}
                    slotProps={{ htmlInput: { 'aria-label': t('settings.profile.lastName') } }}
                  />
                )}
              />
            </Stack>

            <Controller
              name="username"
              control={profileControl}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={t('settings.profile.username')}
                  fullWidth
                  error={!!profileErrors.username}
                  helperText={profileErrors.username?.message}
                  slotProps={{ htmlInput: { 'aria-label': t('settings.profile.username') } }}
                />
              )}
            />

            <TextField
              label={t('settings.profile.email')}
              value={profile?.email ?? ''}
              disabled
              fullWidth
              helperText={t('settings.profile.emailDisabledHint')}
              slotProps={{ htmlInput: { 'aria-label': t('settings.profile.email') } }}
            />
          </Stack>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="submit"
              variant="contained"
              disabled={savingProfile}
              startIcon={
                savingProfile ? (
                  <CircularProgress size={16} color="inherit" />
                ) : undefined
              }
            >
              {t('settings.profile.save')}
            </Button>
          </Box>
        </form>
      </SettingsCard>

      {/* ---------------------------------------------------------- */}
      {/* Password change card                                        */}
      {/* ---------------------------------------------------------- */}
      <SettingsCard aria-label={t('settings.profile.passwordSection')}>
        <form onSubmit={handlePasswordSubmit(handleChangePassword)}>
          <SectionTitle>{t('settings.profile.passwordSection')}</SectionTitle>

          <Stack spacing={2}>
            <Controller
              name="current_password"
              control={passwordControl}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="password"
                  label={t('settings.profile.currentPassword')}
                  fullWidth
                  autoComplete="current-password"
                  error={!!passwordErrors.current_password}
                  helperText={passwordErrors.current_password?.message}
                />
              )}
            />
            <Divider />
            <Controller
              name="new_password"
              control={passwordControl}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="password"
                  label={t('settings.profile.newPassword')}
                  fullWidth
                  autoComplete="new-password"
                  error={!!passwordErrors.new_password}
                  helperText={passwordErrors.new_password?.message}
                />
              )}
            />
            <Controller
              name="confirm_password"
              control={passwordControl}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="password"
                  label={t('settings.profile.confirmPassword')}
                  fullWidth
                  autoComplete="new-password"
                  error={!!passwordErrors.confirm_password}
                  helperText={passwordErrors.confirm_password?.message}
                />
              )}
            />
          </Stack>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" variant="outlined">
              {t('settings.profile.changePassword')}
            </Button>
          </Box>
        </form>
      </SettingsCard>
    </Stack>
  );
}
