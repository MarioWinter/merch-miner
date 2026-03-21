import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useRecentSearches from '../hooks/useRecentSearches';

const STORAGE_KEY = 'mm-research-recent';

describe('useRecentSearches', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('starts with an empty list when localStorage is empty', () => {
    const { result } = renderHook(() => useRecentSearches());
    expect(result.current.searches).toEqual([]);
  });

  it('adds a search to an empty list', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.addSearch('hiking', 'amazon_com');
    });

    expect(result.current.searches).toEqual([
      { keyword: 'hiking', marketplace: 'amazon_com' },
    ]);
  });

  it('deduplicates: adding existing keyword+marketplace moves it to top', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.addSearch('hiking', 'amazon_com');
      result.current.addSearch('yoga', 'amazon_com');
      result.current.addSearch('hiking', 'amazon_com');
    });

    expect(result.current.searches).toEqual([
      { keyword: 'hiking', marketplace: 'amazon_com' },
      { keyword: 'yoga', marketplace: 'amazon_com' },
    ]);
  });

  it('does not dedup when marketplace differs', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.addSearch('hiking', 'amazon_com');
      result.current.addSearch('hiking', 'amazon_de');
    });

    expect(result.current.searches).toHaveLength(2);
    expect(result.current.searches[0]).toEqual({ keyword: 'hiking', marketplace: 'amazon_de' });
    expect(result.current.searches[1]).toEqual({ keyword: 'hiking', marketplace: 'amazon_com' });
  });

  it('enforces max 10 FIFO: 11th search removes oldest', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      for (let i = 1; i <= 11; i++) {
        result.current.addSearch(`kw-${i}`, 'amazon_com');
      }
    });

    expect(result.current.searches).toHaveLength(10);
    expect(result.current.searches[0].keyword).toBe('kw-11');
    expect(result.current.searches[9].keyword).toBe('kw-2');
  });

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.addSearch('camping', 'amazon_co_uk');
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual([{ keyword: 'camping', marketplace: 'amazon_co_uk' }]);
  });

  it('reads from localStorage on mount', () => {
    const seed = [{ keyword: 'dogs', marketplace: 'amazon_com' }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));

    const { result } = renderHook(() => useRecentSearches());
    expect(result.current.searches).toEqual(seed);
  });

  it('removes a search by index', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.addSearch('alpha', 'amazon_com');
      result.current.addSearch('beta', 'amazon_com');
      result.current.addSearch('gamma', 'amazon_com');
    });

    act(() => {
      result.current.removeSearch(1); // remove 'beta' (middle)
    });

    expect(result.current.searches).toEqual([
      { keyword: 'gamma', marketplace: 'amazon_com' },
      { keyword: 'alpha', marketplace: 'amazon_com' },
    ]);
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem(STORAGE_KEY, 'NOT_JSON');
    const { result } = renderHook(() => useRecentSearches());
    expect(result.current.searches).toEqual([]);
  });
});
