/**
 * PROJ-31 — `useCan` hook tests.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { useCan } from '../useCan';
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

const withFeatures = (features: string[]) => {
  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(setUser({ ...baseUser, features }));
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return { store, Wrapper };
};

describe('useCan', () => {
  it('returns false when no user is set', () => {
    const store = configureStore({ reducer: { auth: authReducer } });
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    const { result } = renderHook(() => useCan('niche.research'), { wrapper: Wrapper });
    expect(result.current).toBe(false);
  });

  it('returns false when features list is empty', () => {
    const { Wrapper } = withFeatures([]);
    const { result } = renderHook(() => useCan('niche.research'), { wrapper: Wrapper });
    expect(result.current).toBe(false);
  });

  it('returns true when feature is granted', () => {
    const { Wrapper } = withFeatures(['niche.research', 'design.gallery']);
    const { result } = renderHook(() => useCan('niche.research'), { wrapper: Wrapper });
    expect(result.current).toBe(true);
  });

  it('returns false when feature is not in list', () => {
    const { Wrapper } = withFeatures(['niche.research']);
    const { result } = renderHook(() => useCan('admin.scraper-debug'), { wrapper: Wrapper });
    expect(result.current).toBe(false);
  });

  it('returns true for any feature when wildcard "*" is present (superuser bypass)', () => {
    const { Wrapper } = withFeatures(['*']);
    const { result: r1 } = renderHook(() => useCan('niche.research'), { wrapper: Wrapper });
    const { result: r2 } = renderHook(() => useCan('admin.scraper-debug'), { wrapper: Wrapper });
    const { result: r3 } = renderHook(() => useCan('does.not.exist'), { wrapper: Wrapper });
    expect(r1.current).toBe(true);
    expect(r2.current).toBe(true);
    expect(r3.current).toBe(true);
  });
});
