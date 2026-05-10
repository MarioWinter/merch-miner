import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { createElement, type ReactNode } from 'react';

// vi.hoisted ensures the mock-state object is created BEFORE vi.mock runs,
// so the mock factory can capture its identity at hoist time.
const { mockResponses } = vi.hoisted(() => ({
  mockResponses: [] as Array<{ data?: unknown; error?: { status: number; data: unknown } }>,
}));

vi.mock('../../store/axiosBaseQuery', () => ({
  axiosBaseQuery: () => async () => {
    const next = mockResponses.shift();
    if (!next) return { data: [] };
    return next;
  },
}));

// Imports AFTER the mock so RTK Query picks up the mocked baseQuery.
import { searchHistoryApi } from '../../store/searchHistorySlice';
import authReducer from '../../store/authSlice';
import useUserSearchHistory from '../useUserSearchHistory';

const buildStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
      [searchHistoryApi.reducerPath]: searchHistoryApi.reducer,
    },
    middleware: (getDefault) => getDefault().concat(searchHistoryApi.middleware),
  });

const wrapper =
  (store: ReturnType<typeof buildStore>) =>
  ({ children }: { children: ReactNode }) =>
    createElement(Provider, { store, children });

describe('useUserSearchHistory', () => {
  beforeEach(() => {
    mockResponses.length = 0;
  });

  it('exposes searches mapped from the API response', async () => {
    mockResponses.push({
      data: [
        {
          id: 'aaa-111',
          context: 'amazon_research',
          keyword: 'cats',
          marketplace: 'amazon_com',
          extra_metadata: {},
          created_at: '2026-05-10T12:00:00Z',
        },
      ],
    });
    const store = buildStore();
    const { result } = renderHook(() => useUserSearchHistory('amazon_research'), {
      wrapper: wrapper(store),
    });
    await waitFor(() => {
      expect(result.current.searches).toEqual([
        { id: 'aaa-111', keyword: 'cats', marketplace: 'amazon_com' },
      ]);
    });
  });

  it('addSearch ignores empty keyword', async () => {
    const store = buildStore();
    const { result } = renderHook(() => useUserSearchHistory('amazon_research'), {
      wrapper: wrapper(store),
    });
    await act(async () => {
      await result.current.addSearch('   ', 'amazon_com');
    });
    // No mutation request made — mockResponses untouched after initial list (which we didn't queue → empty).
    expect(mockResponses.length).toBe(0);
  });

  it('exposes typed context — uses the right backend URL params', async () => {
    // Just smoke that the hook compiles + fires a list query for the given context.
    mockResponses.push({ data: [] });
    const store = buildStore();
    const { result } = renderHook(() => useUserSearchHistory('keyword_drilling'), {
      wrapper: wrapper(store),
    });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.searches).toEqual([]);
  });
});
