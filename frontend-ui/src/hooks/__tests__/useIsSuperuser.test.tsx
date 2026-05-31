/**
 * FIX-dashboard Item 5 — `useIsSuperuser` hook tests.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { useIsSuperuser } from '../useIsSuperuser';
import authReducer, { setUser, type AuthUser } from '@/store/authSlice';

const baseUser: AuthUser = {
  id: 1,
  email: 'u@test.com',
  first_name: '',
  avatar_url: null,
  is_staff: false,
  is_superuser: false,
  subscription_tier: 'free',
  features: [],
};

const withUser = (user: AuthUser | null) => {
  const store = configureStore({ reducer: { auth: authReducer } });
  if (user) store.dispatch(setUser(user));
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return { store, Wrapper };
};

describe('useIsSuperuser', () => {
  it('returns true when user.is_superuser is true', () => {
    const { Wrapper } = withUser({ ...baseUser, is_superuser: true });
    const { result } = renderHook(() => useIsSuperuser(), { wrapper: Wrapper });
    expect(result.current).toBe(true);
  });

  it('returns false when user.is_superuser is false', () => {
    const { Wrapper } = withUser({ ...baseUser, is_superuser: false });
    const { result } = renderHook(() => useIsSuperuser(), { wrapper: Wrapper });
    expect(result.current).toBe(false);
  });

  it('returns false when auth.user is null (loading / not authenticated)', () => {
    const { Wrapper } = withUser(null);
    const { result } = renderHook(() => useIsSuperuser(), { wrapper: Wrapper });
    expect(result.current).toBe(false);
  });
});
