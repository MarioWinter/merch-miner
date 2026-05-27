/**
 * PROJ-30 T1.6 — useResponsiveLayout hook tests.
 *
 * Mocks `@mui/material/useMediaQuery` so each call sequence simulates a
 * specific viewport tier. The hook calls useMediaQuery in this order:
 *   1. down('xxs')   → isPhoneTiny
 *   2. down('sm')    → isMobile
 *   3. between('sm','md') → isTablet
 *   4. up('md')      → isDesktop
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Hoist the mock so it's wired up before the hook module is imported.
const mediaQueryFn = vi.fn<(query: unknown) => boolean>();

vi.mock('@mui/material/useMediaQuery', () => ({
  default: (query: unknown) => mediaQueryFn(query),
}));

import { useResponsiveLayout } from '../useResponsiveLayout';

const queueResults = (...results: boolean[]) => {
  mediaQueryFn.mockReset();
  results.forEach((r) => mediaQueryFn.mockReturnValueOnce(r));
};

describe('useResponsiveLayout', () => {
  beforeEach(() => {
    mediaQueryFn.mockReset();
  });

  it('reports isPhoneTiny=true on a <400px viewport', () => {
    // <xxs is also <sm, so both flags are true; tablet/desktop false.
    queueResults(true, true, false, false);
    const { result } = renderHook(() => useResponsiveLayout());
    expect(result.current.isPhoneTiny).toBe(true);
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);
  });

  it('reports isMobile=true on a 400–599px viewport (not phone-tiny)', () => {
    queueResults(false, true, false, false);
    const { result } = renderHook(() => useResponsiveLayout());
    expect(result.current.isPhoneTiny).toBe(false);
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);
  });

  it('reports isTablet=true on a 600–899px viewport', () => {
    queueResults(false, false, true, false);
    const { result } = renderHook(() => useResponsiveLayout());
    expect(result.current.isPhoneTiny).toBe(false);
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isDesktop).toBe(false);
  });

  it('reports isDesktop=true on a ≥900px viewport', () => {
    queueResults(false, false, false, true);
    const { result } = renderHook(() => useResponsiveLayout());
    expect(result.current.isPhoneTiny).toBe(false);
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(true);
  });
});
