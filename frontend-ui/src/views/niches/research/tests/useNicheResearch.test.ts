import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NicheResearchRun } from '../types';

// ---- Mocks ----

const mockEnqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }),
}));

const stableT = (key: string) => key;
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: stableT }),
}));

const mockTriggerResearch = vi.fn();
const mockGetLatestResearch = vi.fn();

vi.mock('../services/researchApi', () => ({
  researchApi: {
    triggerResearch: (...args: unknown[]) => mockTriggerResearch(...args),
    getLatestResearch: (...args: unknown[]) => mockGetLatestResearch(...args),
    listResearch: vi.fn(),
  },
}));

import { useNicheResearch } from '../hooks/useNicheResearch';

// ---- Fixtures ----

const pendingRun: NicheResearchRun = {
  id: 'run-1',
  status: 'pending',
  created_at: '2026-03-18T10:00:00Z',
  completed_at: null,
  completed_nodes: [],
  current_node: '',
  total_nodes: 6,
  marketplace: 'amazon_com',
  product_type: 't_shirt',
  retry_count: 0,
  brand_filtered_count: 0,
  analysis: null,
  keywords: null,
  products: [],
  related_niches: [],
};

const completedRun: NicheResearchRun = {
  ...pendingRun,
  status: 'completed',
  completed_at: '2026-03-18T10:05:00Z',
  analysis: {
    niche_summary: 'Test summary',
    sentiment: 'Positive',
    primary_emotions: ['Joy'],
    emotional_archetype: ['Explorer'],
    example_keywords: ['test'],
    pattern_analysis: [],
    emotional_reality: 'Test reality',
    design_concepts: 'Test concepts',
    dominant_design_aesthetics: 'Test aesthetics',
  },
  keywords: {
    main_short_tail: ['test'],
    main_long_tail: ['test long'],
    all_keywords_flat: 'test, test long',
    top_focus_keywords: ['test'],
    top_long_tail_keywords: ['test long'],
  },
};

const failedRun: NicheResearchRun = {
  ...pendingRun,
  status: 'failed',
  error_message: 'Node vision_analyze failed',
};

// ---- Tests ----

/**
 * Tests are split into two groups:
 * 1. Real-timer tests: for initial fetch, trigger, error handling
 *    (rely on actual promise resolution)
 * 2. Fake-timer tests: for polling lifecycle + timeout
 *    (need timer control for 5s intervals and 20min timeout)
 */

describe('useNicheResearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // Group 1: Real timers (initial fetch, trigger)
  // ============================================

  it('returns initial state when nicheId is null', () => {
    const { result } = renderHook(() => useNicheResearch(null));

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isPolling).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('fetches latest on mount', async () => {
    mockGetLatestResearch.mockResolvedValue(completedRun);

    const { result } = renderHook(() => useNicheResearch('niche-1'));

    await waitFor(() => {
      expect(result.current.data).toEqual(completedRun);
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isPolling).toBe(false);
    expect(mockGetLatestResearch).toHaveBeenCalledWith('niche-1');
  });

  it('handles 404 as no-research', async () => {
    mockGetLatestResearch.mockRejectedValue({
      response: { status: 404 },
    });

    const { result } = renderHook(() => useNicheResearch('niche-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('sets error on non-404 failure', async () => {
    mockGetLatestResearch.mockRejectedValue({
      response: { status: 500 },
    });

    const { result } = renderHook(() => useNicheResearch('niche-1'));

    await waitFor(() => {
      expect(result.current.error).toBe('research.errors.fetchFailed');
    });
  });

  it('starts polling when status is non-terminal', async () => {
    mockGetLatestResearch.mockResolvedValue(pendingRun);

    const { result } = renderHook(() => useNicheResearch('niche-1'));

    await waitFor(() => {
      expect(result.current.isPolling).toBe(true);
    });
    expect(result.current.data?.status).toBe('pending');
  });

  it('skips polling when status is terminal', async () => {
    mockGetLatestResearch.mockResolvedValue(completedRun);

    const { result } = renderHook(() => useNicheResearch('niche-1'));

    await waitFor(() => {
      expect(result.current.data?.status).toBe('completed');
    });
    expect(result.current.isPolling).toBe(false);
  });

  it('trigger sends POST and starts polling', async () => {
    mockGetLatestResearch.mockRejectedValue({
      response: { status: 404 },
    });

    const { result } = renderHook(() => useNicheResearch('niche-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    mockTriggerResearch.mockResolvedValueOnce(pendingRun);
    // Subsequent getLatest calls return pending (for polling)
    mockGetLatestResearch.mockResolvedValue(pendingRun);

    await act(async () => {
      await result.current.triggerResearch();
    });

    expect(mockTriggerResearch).toHaveBeenCalledWith('niche-1', undefined);
    expect(result.current.data).toEqual(pendingRun);
    expect(result.current.isPolling).toBe(true);
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      'research.notifications.triggered',
      { variant: 'info' },
    );
  });

  it('handles 409 on trigger', async () => {
    mockGetLatestResearch.mockRejectedValue({
      response: { status: 404 },
    });

    const { result } = renderHook(() => useNicheResearch('niche-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    mockTriggerResearch.mockRejectedValueOnce({
      response: { status: 409 },
    });

    await act(async () => {
      await result.current.triggerResearch();
    });

    expect(result.current.error).toBe('research.errors.alreadyRunning');
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      'research.errors.alreadyRunning',
      { variant: 'warning' },
    );
  });

  it('handles generic trigger failure', async () => {
    mockGetLatestResearch.mockRejectedValue({
      response: { status: 404 },
    });

    const { result } = renderHook(() => useNicheResearch('niche-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    mockTriggerResearch.mockRejectedValueOnce({
      response: { status: 500 },
    });

    await act(async () => {
      await result.current.triggerResearch();
    });

    expect(result.current.error).toBe('research.errors.triggerFailed');
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      'research.errors.triggerFailed',
      { variant: 'error' },
    );
  });

  it('trigger does nothing when nicheId is null', async () => {
    const { result } = renderHook(() => useNicheResearch(null));

    await act(async () => {
      await result.current.triggerResearch();
    });

    expect(mockTriggerResearch).not.toHaveBeenCalled();
  });

  it('clears timers on unmount during polling', async () => {
    mockGetLatestResearch.mockResolvedValue(pendingRun);

    const { result, unmount } = renderHook(() => useNicheResearch('niche-1'));

    await waitFor(() => {
      expect(result.current.isPolling).toBe(true);
    });

    // Should not throw after unmount
    unmount();
  });

  it('refetch restarts polling if non-terminal', async () => {
    const runningRun: NicheResearchRun = {
      ...pendingRun,
      status: 'running',
    };

    mockGetLatestResearch.mockResolvedValue(completedRun);

    const { result } = renderHook(() => useNicheResearch('niche-1'));

    await waitFor(() => {
      expect(result.current.data?.status).toBe('completed');
    });
    expect(result.current.isPolling).toBe(false);

    mockGetLatestResearch.mockResolvedValue(runningRun);

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.data?.status).toBe('running');
    expect(result.current.isPolling).toBe(true);
  });

  // ============================================
  // Group 2: Fake timers (polling transitions)
  // ============================================

  describe('polling with fake timers', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('stops polling when status transitions to completed', async () => {
      let returnCompleted = false;
      mockGetLatestResearch.mockImplementation(() =>
        Promise.resolve(returnCompleted ? completedRun : pendingRun),
      );

      const { result } = renderHook(() => useNicheResearch('niche-1'));

      // Flush initial fetch (small advance — NOT runAllTimers which fires timeout too)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      expect(result.current.isPolling).toBe(true);

      returnCompleted = true;

      // Advance past one poll interval (5s)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_200);
      });

      expect(result.current.data?.status).toBe('completed');
      expect(result.current.isPolling).toBe(false);
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        'research.notifications.completed',
        { variant: 'success' },
      );
    });

    it('stops polling when status transitions to failed', async () => {
      let returnFailed = false;
      mockGetLatestResearch.mockImplementation(() =>
        Promise.resolve(returnFailed ? failedRun : pendingRun),
      );

      const { result } = renderHook(() => useNicheResearch('niche-1'));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      expect(result.current.isPolling).toBe(true);

      returnFailed = true;

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_200);
      });

      expect(result.current.data?.status).toBe('failed');
      expect(result.current.isPolling).toBe(false);
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        'Node vision_analyze failed',
        { variant: 'error' },
      );
    });

    it('sets timeout error after 20 minutes', async () => {
      mockGetLatestResearch.mockImplementation(() =>
        Promise.resolve(pendingRun),
      );

      const { result } = renderHook(() => useNicheResearch('niche-1'));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      expect(result.current.isPolling).toBe(true);

      // Advance past timeout (20 min)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20 * 60 * 1_000 + 1_000);
      });

      expect(result.current.error).toBe('research.errors.timeout');
      expect(result.current.isPolling).toBe(false);
    });
  });
});
