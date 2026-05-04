import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useFilterState from '../hooks/useFilterState';
import { DEFAULT_FILTERS, DEFAULT_FILTER_ENABLED } from '../types';

describe('useFilterState', () => {
  it('initial state matches DEFAULT_FILTERS and DEFAULT_FILTER_ENABLED', () => {
    const { result } = renderHook(() => useFilterState());

    expect(result.current.filters).toEqual(DEFAULT_FILTERS);
    expect(result.current.enabled).toEqual(DEFAULT_FILTER_ENABLED);
  });

  it('setFilter updates a single filter value', () => {
    const { result } = renderHook(() => useFilterState());

    act(() => {
      result.current.setFilter('bsr_min', 500);
    });

    expect(result.current.filters.bsr_min).toBe(500);
    // Other filters unchanged
    expect(result.current.filters.bsr_max).toBe(DEFAULT_FILTERS.bsr_max);
  });

  it('setEnabled toggles per-filter switch', () => {
    const { result } = renderHook(() => useFilterState());

    act(() => {
      result.current.setEnabled('bsr_min', true);
    });

    expect(result.current.enabled.bsr_min).toBe(true);
    // Other enabled flags unchanged
    expect(result.current.enabled.rating_min).toBe(false);
  });

  it('resetFilters resets all to defaults', () => {
    const { result } = renderHook(() => useFilterState());

    act(() => {
      result.current.setFilter('bsr_min', 999);
      result.current.setFilter('price_max', 50);
      result.current.setEnabled('bsr_min', true);
      result.current.setEnabled('price_max', true);
    });

    expect(result.current.filters.bsr_min).toBe(999);

    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.filters).toEqual(DEFAULT_FILTERS);
    expect(result.current.enabled).toEqual(DEFAULT_FILTER_ENABLED);
  });

  it('activeFilterCount counts only enabled filters with non-default values', () => {
    const { result } = renderHook(() => useFilterState());

    // Initially zero
    expect(result.current.activeFilterCount).toBe(0);

    // Enable bsr_min but keep default value -> still 0
    act(() => {
      result.current.setEnabled('bsr_min', true);
    });
    expect(result.current.activeFilterCount).toBe(0);

    // Change bsr_min to non-default while enabled -> 1
    act(() => {
      result.current.setFilter('bsr_min', 5000);
    });
    expect(result.current.activeFilterCount).toBe(1);

    // Enable price_min + change value -> 2
    act(() => {
      result.current.setEnabled('price_min', true);
      result.current.setFilter('price_min', 10);
    });
    expect(result.current.activeFilterCount).toBe(2);

    // Disable bsr_min -> back to 1
    act(() => {
      result.current.setEnabled('bsr_min', false);
    });
    expect(result.current.activeFilterCount).toBe(1);
  });

  it('always-on range filter (e.g. reviews_min) counts immediately when value differs from default', () => {
    // Range filters are always-on as of the UI cleanup that removed per-filter Switches.
    // This test pins the new behavior: changing a value on an always-on filter is enough.
    const { result } = renderHook(() => useFilterState());

    act(() => {
      result.current.setFilter('reviews_min', 100);
    });

    expect(result.current.activeFilterCount).toBe(1);
  });

  it('toggle-gated filter (e.g. rating_min) requires both enable and non-default value', () => {
    const { result } = renderHook(() => useFilterState());

    act(() => {
      result.current.setFilter('rating_min', 4);
    });
    // rating_min default-enabled is false → still 0 even though value changed.
    expect(result.current.activeFilterCount).toBe(0);
  });
});
