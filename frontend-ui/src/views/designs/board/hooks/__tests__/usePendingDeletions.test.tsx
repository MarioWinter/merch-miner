import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// notistack mock
const enqueueSnackbarMock = vi.fn();
vi.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: enqueueSnackbarMock, closeSnackbar: vi.fn() }),
}));

// i18next mock — return key as text
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// designSlice mock — capture trigger calls + control resolution
const unwrapMock = vi.fn(() => Promise.resolve({}));
const triggerMock = vi.fn(() => ({ unwrap: unwrapMock }));
vi.mock('@/store/designSlice', () => ({
  useDeleteDesignVersionMutation: () => [triggerMock, { isLoading: false }],
}));

import { usePendingDeletions } from '../usePendingDeletions';

describe('usePendingDeletions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    triggerMock.mockClear();
    unwrapMock.mockClear();
    unwrapMock.mockImplementation(() => Promise.resolve({}));
    enqueueSnackbarMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('requestDelete marks the slot pending and isPending returns true', () => {
    const { result } = renderHook(() => usePendingDeletions());
    act(() => result.current.requestDelete('d-1', 'upscaled'));
    expect(result.current.isPending('d-1', 'upscaled')).toBe(true);
    expect(result.current.pendingKeys.has('d-1:upscaled')).toBe(true);
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it('undoDelete clears the pending slot and skips backend call', async () => {
    const { result } = renderHook(() => usePendingDeletions());
    act(() => result.current.requestDelete('d-1', 'upscaled'));
    act(() => result.current.undoDelete('d-1', 'upscaled'));
    expect(result.current.isPending('d-1', 'upscaled')).toBe(false);
    // Advance past the would-be timeout — backend MUST NOT be called.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it('after 5s timeout fires deleteDesignVersion with correct args', async () => {
    const { result } = renderHook(() => usePendingDeletions());
    act(() => result.current.requestDelete('d-1', 'bg_removed', 'p-9'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(triggerMock).toHaveBeenCalledWith({
      designId: 'd-1',
      version: 'bg_removed',
      projectId: 'p-9',
    });
    expect(unwrapMock).toHaveBeenCalledTimes(1);
  });

  it('tracks two concurrent pending deletions on different slots independently', () => {
    const { result } = renderHook(() => usePendingDeletions());
    act(() => {
      result.current.requestDelete('d-1', 'upscaled');
      result.current.requestDelete('d-1', 'bg_removed');
    });
    expect(result.current.isPending('d-1', 'upscaled')).toBe(true);
    expect(result.current.isPending('d-1', 'bg_removed')).toBe(true);
    act(() => result.current.undoDelete('d-1', 'upscaled'));
    expect(result.current.isPending('d-1', 'upscaled')).toBe(false);
    expect(result.current.isPending('d-1', 'bg_removed')).toBe(true);
  });
});
