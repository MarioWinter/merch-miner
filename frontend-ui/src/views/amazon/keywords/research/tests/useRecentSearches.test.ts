import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecentSearches } from '../hooks/useRecentSearches';

const STORAGE_KEY = 'mm-keyword-recent';

describe('useRecentSearches', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty array when localStorage is empty', () => {
    const { result } = renderHook(() => useRecentSearches());
    expect(result.current.searches).toEqual([]);
  });

  it('adds a search to the front', () => {
    const { result } = renderHook(() => useRecentSearches());
    act(() => result.current.addSearch('funny shirts', 'amazon_com'));
    expect(result.current.searches).toEqual([
      { keyword: 'funny shirts', marketplace: 'amazon_com' },
    ]);
  });

  it('deduplicates existing keyword+marketplace', () => {
    const { result } = renderHook(() => useRecentSearches());
    act(() => {
      result.current.addSearch('cats', 'amazon_com');
      result.current.addSearch('dogs', 'amazon_com');
      result.current.addSearch('cats', 'amazon_com');
    });
    expect(result.current.searches).toHaveLength(2);
    expect(result.current.searches[0].keyword).toBe('cats');
    expect(result.current.searches[1].keyword).toBe('dogs');
  });

  it('caps at 10 items', () => {
    const { result } = renderHook(() => useRecentSearches());
    act(() => {
      for (let i = 0; i < 12; i++) {
        result.current.addSearch(`kw-${i}`, 'amazon_com');
      }
    });
    expect(result.current.searches).toHaveLength(10);
    expect(result.current.searches[0].keyword).toBe('kw-11');
  });

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useRecentSearches());
    act(() => result.current.addSearch('test', 'amazon_de'));
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(stored).toEqual([{ keyword: 'test', marketplace: 'amazon_de' }]);
  });

  it('removes a search by index', () => {
    const { result } = renderHook(() => useRecentSearches());
    act(() => {
      result.current.addSearch('a', 'amazon_com');
      result.current.addSearch('b', 'amazon_com');
    });
    act(() => result.current.removeSearch(0));
    expect(result.current.searches).toHaveLength(1);
    expect(result.current.searches[0].keyword).toBe('a');
  });

  it('clears all searches', () => {
    const { result } = renderHook(() => useRecentSearches());
    act(() => {
      result.current.addSearch('a', 'amazon_com');
      result.current.addSearch('b', 'amazon_com');
    });
    act(() => result.current.clearAll());
    expect(result.current.searches).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('recovers from corrupted JSON in localStorage (EC-17)', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json{{{');
    const { result } = renderHook(() => useRecentSearches());
    expect(result.current.searches).toEqual([]);
  });

  it('recovers from non-array JSON in localStorage', () => {
    localStorage.setItem(STORAGE_KEY, '{"not":"array"}');
    const { result } = renderHook(() => useRecentSearches());
    expect(result.current.searches).toEqual([]);
  });

  it('filters out malformed items from localStorage', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { keyword: 'valid', marketplace: 'amazon_com' },
        { bad: 'data' },
        42,
        null,
      ]),
    );
    const { result } = renderHook(() => useRecentSearches());
    expect(result.current.searches).toHaveLength(1);
    expect(result.current.searches[0].keyword).toBe('valid');
  });
});
