/**
 * PROJ-24 — useFeatureFlag hook tests (AC-20).
 *
 * Covers resolution order: admin-override → env-var → fallback, plus the
 * REGISTRATION_ENABLED exemption (AC-20d) and the logged-out path (AC-20c).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer, { setUser, type AuthUser } from '../../store/authSlice';
import { FEATURE_FLAGS } from '../../constants/featureFlags';
import { useFeatureFlag } from '../useFeatureFlag';

const buildUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 1,
  email: 'user@example.com',
  first_name: 'Test',
  avatar_url: null,
  is_staff: false,
  is_superuser: false,
  ...overrides,
});

const renderWithStore = <T,>(
  hook: () => T,
  user: AuthUser | null = null,
) => {
  const store = configureStore({ reducer: { auth: authReducer } });
  if (user) {
    store.dispatch(setUser(user));
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return renderHook(hook, { wrapper });
};

describe('useFeatureFlag', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    warnSpy.mockRestore();
  });

  // (a) flag enabled via env → true (non-admin)
  it('returns true for a non-admin when env var is "true"', () => {
    vi.stubEnv('VITE_FF_KANBAN_ENABLED', 'true');
    const { result } = renderWithStore(
      () => useFeatureFlag(FEATURE_FLAGS.KANBAN_ENABLED),
      buildUser(),
    );
    expect(result.current).toBe(true);
  });

  // (b) flag disabled (no env, fallback false) → false
  it('returns false for a non-admin when env var is missing and fallback is false', () => {
    vi.stubEnv('VITE_FF_CLOUD_STORAGE_ENABLED', '');
    const { result } = renderWithStore(
      () => useFeatureFlag(FEATURE_FLAGS.CLOUD_STORAGE_ENABLED),
      buildUser(),
    );
    expect(result.current).toBe(false);
  });

  // (c) malformed env value → false + console.warn (DEV mode is true under vitest)
  it('returns false and warns for malformed env value "yes"', () => {
    vi.stubEnv('VITE_FF_DESKTOP_UPLOAD_APP_ENABLED', 'yes');
    const { result } = renderWithStore(
      () => useFeatureFlag(FEATURE_FLAGS.DESKTOP_UPLOAD_APP_ENABLED),
      buildUser(),
    );
    expect(result.current).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('returns false and warns for malformed env value "1"', () => {
    vi.stubEnv('VITE_FF_KANBAN_ENABLED', '1');
    const { result } = renderWithStore(
      () => useFeatureFlag(FEATURE_FLAGS.KANBAN_ENABLED),
      buildUser(),
    );
    expect(result.current).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  // (d) is_staff=true → admin override wins (except REGISTRATION_ENABLED)
  it('returns true for an is_staff user even when env var is missing or false', () => {
    vi.stubEnv('VITE_FF_KANBAN_ENABLED', 'false');
    vi.stubEnv('VITE_FF_CLOUD_STORAGE_ENABLED', '');
    const { result: kanban } = renderWithStore(
      () => useFeatureFlag(FEATURE_FLAGS.KANBAN_ENABLED),
      buildUser({ is_staff: true }),
    );
    const { result: cloud } = renderWithStore(
      () => useFeatureFlag(FEATURE_FLAGS.CLOUD_STORAGE_ENABLED),
      buildUser({ is_staff: true }),
    );
    const { result: desktop } = renderWithStore(
      () => useFeatureFlag(FEATURE_FLAGS.DESKTOP_UPLOAD_APP_ENABLED),
      buildUser({ is_staff: true }),
    );
    expect(kanban.current).toBe(true);
    expect(cloud.current).toBe(true);
    expect(desktop.current).toBe(true);
  });

  // (e) is_superuser=true (is_staff=false) → admin override wins
  it('returns true for an is_superuser user (is_staff=false) for non-exempt flags', () => {
    vi.stubEnv('VITE_FF_KANBAN_ENABLED', 'false');
    const { result } = renderWithStore(
      () => useFeatureFlag(FEATURE_FLAGS.KANBAN_ENABLED),
      buildUser({ is_staff: false, is_superuser: true }),
    );
    expect(result.current).toBe(true);
  });

  // (f) non-admin user with flag false → false
  it('returns false for a non-admin user when env var is "false"', () => {
    vi.stubEnv('VITE_FF_KANBAN_ENABLED', 'false');
    const { result } = renderWithStore(
      () => useFeatureFlag(FEATURE_FLAGS.KANBAN_ENABLED),
      buildUser(),
    );
    expect(result.current).toBe(false);
  });

  // (g) logged-out (no user) → falls through to env+fallback (no admin override)
  it('falls through to env+fallback when user is null (logged out)', () => {
    vi.stubEnv('VITE_FF_KANBAN_ENABLED', 'true');
    const { result: enabled } = renderWithStore(
      () => useFeatureFlag(FEATURE_FLAGS.KANBAN_ENABLED),
      null,
    );
    expect(enabled.current).toBe(true);

    vi.stubEnv('VITE_FF_CLOUD_STORAGE_ENABLED', '');
    const { result: disabled } = renderWithStore(
      () => useFeatureFlag(FEATURE_FLAGS.CLOUD_STORAGE_ENABLED),
      null,
    );
    expect(disabled.current).toBe(false);
  });

  // (h) REGISTRATION_ENABLED — admin user does NOT bypass (AC-20d)
  it('does NOT apply admin-override to REGISTRATION_ENABLED (AC-20d)', () => {
    vi.stubEnv('VITE_FF_REGISTRATION_ENABLED', 'false');
    const { result: staffResult } = renderWithStore(
      () => useFeatureFlag(FEATURE_FLAGS.REGISTRATION_ENABLED),
      buildUser({ is_staff: true }),
    );
    const { result: superResult } = renderWithStore(
      () => useFeatureFlag(FEATURE_FLAGS.REGISTRATION_ENABLED),
      buildUser({ is_superuser: true }),
    );
    expect(staffResult.current).toBe(false);
    expect(superResult.current).toBe(false);

    // And honors env override regardless of admin status
    vi.stubEnv('VITE_FF_REGISTRATION_ENABLED', 'true');
    const { result: enabledForStaff } = renderWithStore(
      () => useFeatureFlag(FEATURE_FLAGS.REGISTRATION_ENABLED),
      buildUser({ is_staff: true }),
    );
    expect(enabledForStaff.current).toBe(true);
  });
});
