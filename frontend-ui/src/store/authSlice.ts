import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface AuthUser {
  id: number;
  email: string;
  first_name: string;
  avatar_url: string | null;
  is_staff: boolean;
  is_superuser: boolean;
  // PROJ-31 — entitlement layer. `subscription_tier` mirrors the User model
  // field; `features` is the resolved feature-key list backing `useCan()` and
  // `<Gate>`. Wildcard `'*'` indicates superuser bypass.
  subscription_tier: string;
  features: string[];
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  loading: true,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.error = null;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.loading = false;
    },
    clearAuth(state) {
      state.user = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
    },
  },
});

export const { setUser, setLoading, setError, clearAuth } = authSlice.actions;
export default authSlice.reducer;
