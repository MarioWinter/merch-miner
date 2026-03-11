import { describe, it, expect } from 'vitest';
import authReducer, { setUser, setError, setLoading, clearAuth } from './authSlice';

describe('authSlice', () => {
  it('initializes with unauthenticated state', () => {
    const state = authReducer(undefined, { type: '@@INIT' });
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('setUser sets user, isAuthenticated, clears error', () => {
    const state = authReducer(undefined, setUser({ id: 1, email: 'a@b.com', first_name: 'Alice', avatar_url: null }));
    expect(state.user).toEqual({ id: 1, email: 'a@b.com', first_name: 'Alice', avatar_url: null });
    expect(state.isAuthenticated).toBe(true);
    expect(state.error).toBeNull();
  });

  it('setLoading sets loading flag', () => {
    const state = authReducer(undefined, setLoading(false));
    expect(state.loading).toBe(false);
  });

  it('setError sets error and loading false', () => {
    const state = authReducer(undefined, setError('Login failed'));
    expect(state.error).toBe('Login failed');
    expect(state.loading).toBe(false);
  });

  it('setError(null) clears error', () => {
    const withError = authReducer(undefined, setError('oops'));
    const state = authReducer(withError, setError(null));
    expect(state.error).toBeNull();
  });

  it('clearAuth resets all state', () => {
    const authenticated = authReducer(undefined, setUser({ id: 1, email: 'a@b.com', first_name: 'Alice', avatar_url: null }));
    const state = authReducer(authenticated, clearAuth());
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });
});
