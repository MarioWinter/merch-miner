import { apiClient } from './authService';

export interface UserProfile {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  date_joined: string;
  avatar_url: string | null;
}

export interface UpdateProfilePayload {
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export const profileService = {
  async getProfile(): Promise<UserProfile> {
    const { data } = await apiClient.get('/api/users/me/');
    return data;
  },

  async patchProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
    const { data } = await apiClient.patch('/api/users/me/', payload);
    return data;
  },

  async uploadAvatar(file: File): Promise<{ avatar_url: string }> {
    const form = new FormData();
    form.append('avatar', file);
    const { data } = await apiClient.post('/api/users/me/avatar/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async changePassword(payload: ChangePasswordPayload): Promise<void> {
    await apiClient.post('/api/auth/password/change/', payload);
  },
};
