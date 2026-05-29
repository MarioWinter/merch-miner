/**
 * PROJ-17 Phase 6 — useSearchHealth tests
 *
 * Mocks `useHealthCheckQuery` from searchSlice (avoids circular import via
 * authService). Tests derived flags, pollingInterval forwarding, and statusColor
 * computation across vane/crawl4ai online/offline combinations.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { mockUseHealthCheckQuery } = vi.hoisted(() => ({
  mockUseHealthCheckQuery: vi.fn(),
}));

vi.mock('@/store/searchSlice', () => ({
  searchApi: {
    reducerPath: 'searchApi',
    util: { invalidateTags: vi.fn() },
  },
  useHealthCheckQuery: (
    arg: undefined,
    opts?: { pollingInterval?: number },
  ) => mockUseHealthCheckQuery(arg, opts),
}));

import { useSearchHealth } from '../useSearchHealth';

beforeEach(() => {
  mockUseHealthCheckQuery.mockReset();
});

describe('useSearchHealth', () => {
  it('loading state: isLoading=true, no data → vane/crawl4ai both false', () => {
    mockUseHealthCheckQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    const { result } = renderHook(() => useSearchHealth());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.vaneOnline).toBe(false);
    expect(result.current.crawl4aiOnline).toBe(false);
    expect(result.current.allOnline).toBe(false);
    expect(result.current.allOffline).toBe(true);
    expect(result.current.statusColor).toBe('error');
  });

  it('both online → statusColor success, allOnline true', () => {
    mockUseHealthCheckQuery.mockReturnValue({
      data: { vane: 'online', crawl4ai: 'online' },
      isLoading: false,
      isError: false,
    });
    const { result } = renderHook(() => useSearchHealth());

    expect(result.current.vaneOnline).toBe(true);
    expect(result.current.crawl4aiOnline).toBe(true);
    expect(result.current.allOnline).toBe(true);
    expect(result.current.allOffline).toBe(false);
    expect(result.current.partial).toBe(false);
    expect(result.current.statusColor).toBe('success');
  });

  it('vane online + crawl4ai offline → statusColor warning, partial true', () => {
    mockUseHealthCheckQuery.mockReturnValue({
      data: { vane: 'online', crawl4ai: 'offline' },
      isLoading: false,
      isError: false,
    });
    const { result } = renderHook(() => useSearchHealth());

    expect(result.current.vaneOnline).toBe(true);
    expect(result.current.crawl4aiOnline).toBe(false);
    expect(result.current.allOnline).toBe(false);
    expect(result.current.allOffline).toBe(false);
    expect(result.current.partial).toBe(true);
    expect(result.current.statusColor).toBe('warning');
  });

  it('vane offline + crawl4ai online → statusColor warning, partial true', () => {
    mockUseHealthCheckQuery.mockReturnValue({
      data: { vane: 'offline', crawl4ai: 'online' },
      isLoading: false,
      isError: false,
    });
    const { result } = renderHook(() => useSearchHealth());

    expect(result.current.vaneOnline).toBe(false);
    expect(result.current.crawl4aiOnline).toBe(true);
    expect(result.current.partial).toBe(true);
    expect(result.current.statusColor).toBe('warning');
  });

  it('both offline → statusColor error, allOffline true', () => {
    mockUseHealthCheckQuery.mockReturnValue({
      data: { vane: 'offline', crawl4ai: 'offline' },
      isLoading: false,
      isError: false,
    });
    const { result } = renderHook(() => useSearchHealth());

    expect(result.current.allOffline).toBe(true);
    expect(result.current.allOnline).toBe(false);
    expect(result.current.statusColor).toBe('error');
  });

  it('uses 60s healthy poll interval and skips offline poll when allOnline', () => {
    mockUseHealthCheckQuery.mockReturnValue({
      data: { vane: 'online', crawl4ai: 'online' },
      isLoading: false,
      isError: false,
    });
    renderHook(() => useSearchHealth());

    // Bootstrap query: 60s healthy poll
    expect(mockUseHealthCheckQuery).toHaveBeenNthCalledWith(
      1,
      undefined,
      expect.objectContaining({ pollingInterval: 60_000 }),
    );
    // Recovery query: 5s offline poll, but skipped while everything is healthy
    expect(mockUseHealthCheckQuery).toHaveBeenNthCalledWith(
      2,
      undefined,
      expect.objectContaining({ pollingInterval: 30_000, skip: true }),
    );
  });

  it('enables 5s offline poll (skip=false) when any service is offline', () => {
    mockUseHealthCheckQuery.mockReturnValue({
      data: { vane: 'offline', crawl4ai: 'online' },
      isLoading: false,
      isError: false,
    });
    renderHook(() => useSearchHealth());

    expect(mockUseHealthCheckQuery).toHaveBeenNthCalledWith(
      2,
      undefined,
      expect.objectContaining({ pollingInterval: 30_000, skip: false }),
    );
  });

  it('forwards isError flag from RTK Query result', () => {
    mockUseHealthCheckQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });
    const { result } = renderHook(() => useSearchHealth());

    expect(result.current.isError).toBe(true);
  });

  it('returns the raw health data via `health` field', () => {
    const data = { vane: 'online' as const, crawl4ai: 'offline' as const };
    mockUseHealthCheckQuery.mockReturnValue({
      data,
      isLoading: false,
      isError: false,
    });
    const { result } = renderHook(() => useSearchHealth());

    expect(result.current.health).toEqual(data);
  });
});
