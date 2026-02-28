import axios from 'axios';
import { store } from '../store';
import { clearAuth, setUser } from '../store/authSlice';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// --- Token refresh queue ---
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

function processQueue(error: unknown) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(undefined);
    }
  });
  failedQueue = [];
}

// --- 401 interceptor ---
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/api/auth/token/refresh/')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => apiClient(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await apiClient.post('/api/auth/token/refresh/');
        processQueue(null);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        store.dispatch(clearAuth());
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// --- Auth API methods ---

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
}

export interface PasswordResetPayload {
  email: string;
}

export interface PasswordConfirmPayload {
  uid: string;
  token: string;
  new_password: string;
}

export const authService = {
  async login(payload: LoginPayload) {
    const { data } = await apiClient.post('/api/auth/login/', payload);
    return data;
  },

  async register(payload: RegisterPayload) {
    const { data } = await apiClient.post('/api/auth/register/', payload);
    return data;
  },

  async logout() {
    const { data } = await apiClient.post('/api/auth/logout/');
    return data;
  },

  async getMe() {
    const { data } = await apiClient.get('/api/auth/me/');
    return data;
  },

  async requestPasswordReset(payload: PasswordResetPayload) {
    const { data } = await apiClient.post('/api/auth/password/reset/', payload);
    return data;
  },

  async confirmPasswordReset(payload: PasswordConfirmPayload) {
    const { data } = await apiClient.post(
      '/api/auth/password/reset/confirm/',
      payload
    );
    return data;
  },

  googleLoginUrl(): string {
    return `${BASE_URL}/api/auth/google/`;
  },
};

// Hydrate Redux auth state from cookie session on app load
export async function hydrateAuth() {
  try {
    const data = await authService.getMe();
    store.dispatch(setUser({ id: data.id, email: data.email }));
  } catch {
    // No active session — stay unauthenticated
  }
}
