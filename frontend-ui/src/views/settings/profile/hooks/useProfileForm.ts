import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  profileSchema,
  passwordSchema,
  type ProfileFormValues,
  type PasswordFormValues,
} from '../schemas/profileSchema';
import {
  profileService,
  type UserProfile,
} from '../../../../services/profileService';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const useProfileForm = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { first_name: '', last_name: '', username: '' },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  });

  useEffect(() => {
    async function load() {
      try {
        const data = await profileService.getProfile();
        setProfile(data);
        profileForm.reset({
          first_name: data.first_name,
          last_name: data.last_name,
          username: data.username,
        });
      } catch {
        setProfileError('Failed to load profile');
      } finally {
        setLoadingProfile(false);
      }
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveProfile = async (values: ProfileFormValues) => {
    setSavingProfile(true);
    try {
      const updated = await profileService.patchProfile(values);
      setProfile(updated);
      enqueueSnackbar(t('settings.profile.saveSuccess'), {
        variant: 'success',
      });
    } catch {
      enqueueSnackbar(t('settings.profile.saveError'), { variant: 'error' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      enqueueSnackbar(t('settings.profile.avatarBadType'), {
        variant: 'error',
      });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      enqueueSnackbar(t('settings.profile.avatarTooLarge'), {
        variant: 'error',
      });
      return;
    }

    setAvatarUploading(true);
    try {
      const { avatar_url } = await profileService.uploadAvatar(file);
      setProfile((prev) => (prev ? { ...prev, avatar_url } : prev));
      enqueueSnackbar(t('settings.profile.avatarSuccess'), {
        variant: 'success',
      });
    } catch {
      enqueueSnackbar(t('settings.profile.avatarError'), { variant: 'error' });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleChangePassword = async (values: PasswordFormValues) => {
    try {
      await profileService.changePassword(values);
      passwordForm.reset();
      enqueueSnackbar(t('settings.profile.passwordSuccess'), {
        variant: 'success',
      });
    } catch {
      enqueueSnackbar(t('settings.profile.passwordError'), {
        variant: 'error',
      });
    }
  };

  return {
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
  };
};
