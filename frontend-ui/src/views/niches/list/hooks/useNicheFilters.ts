import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { NicheStatus, PotentialRating } from '../types';

export type StatusGroup = 'todo' | 'in_progress' | 'complete';
export type NicheOrdering =
  | 'name'
  | '-name'
  | 'created_at'
  | '-created_at'
  | 'updated_at'
  | '-updated_at'
  | 'position'
  | '-position';

export interface NicheFilters {
  search: string;
  status: NicheStatus | '';
  status_group: StatusGroup | '';
  potential_rating: PotentialRating | '';
  assigned_to: string;
  ordering: NicheOrdering | '';
  page: number;
}

export interface UseNicheFiltersReturn {
  filters: NicheFilters;
  setSearch: (value: string) => void;
  setStatus: (value: NicheStatus | '') => void;
  setStatusGroup: (value: StatusGroup | '') => void;
  setPotentialRating: (value: PotentialRating | '') => void;
  setAssignedTo: (value: string) => void;
  setOrdering: (value: NicheOrdering | '') => void;
  setPage: (value: number) => void;
  resetFilters: () => void;
  activeFilterCount: number;
}

const DEBOUNCE_MS = 300;

const getParam = (params: URLSearchParams, key: string): string =>
  params.get(key) ?? '';

const getPageParam = (params: URLSearchParams): number => {
  const raw = params.get('page');
  const parsed = parseInt(raw ?? '1', 10);
  return isNaN(parsed) || parsed < 1 ? 1 : parsed;
};

export const useNicheFilters = (): UseNicheFiltersReturn => {
  const [searchParams, setSearchParams] = useSearchParams();

  const readFilters = useCallback((): NicheFilters => ({
    search: getParam(searchParams, 'search'),
    status: getParam(searchParams, 'status') as NicheStatus | '',
    status_group: getParam(searchParams, 'status_group') as StatusGroup | '',
    potential_rating: getParam(searchParams, 'potential_rating') as PotentialRating | '',
    assigned_to: getParam(searchParams, 'assigned_to'),
    ordering: getParam(searchParams, 'ordering') as NicheOrdering | '',
    page: getPageParam(searchParams),
  }), [searchParams]);

  const filters = readFilters();

  // Local state for debounced search input
  const [searchInput, setSearchInput] = useState<string>(filters.search);

  // Sync searchInput when URL changes externally (e.g. back/forward)
  useEffect(() => {
    setSearchInput(getParam(searchParams, 'search'));
  }, [searchParams]);

  // Debounce search → URL
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (searchInput) {
          next.set('search', searchInput);
        } else {
          next.delete('search');
        }
        next.delete('page');
        return next;
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const setParam = useCallback(
    (key: string, value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
        if (key !== 'page') next.delete('page');
        return next;
      });
    },
    [setSearchParams],
  );

  const setSearch = useCallback((value: string) => {
    setSearchInput(value);
  }, []);

  const setStatus = useCallback(
    (value: NicheStatus | '') => setParam('status', value),
    [setParam],
  );

  const setStatusGroup = useCallback(
    (value: StatusGroup | '') => setParam('status_group', value),
    [setParam],
  );

  const setPotentialRating = useCallback(
    (value: PotentialRating | '') => setParam('potential_rating', value),
    [setParam],
  );

  const setAssignedTo = useCallback(
    (value: string) => setParam('assigned_to', value),
    [setParam],
  );

  const setOrdering = useCallback(
    (value: NicheOrdering | '') => setParam('ordering', value),
    [setParam],
  );

  const setPage = useCallback(
    (value: number) => setParam('page', value > 1 ? String(value) : ''),
    [setParam],
  );

  const resetFilters = useCallback(() => {
    setSearchInput('');
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  const activeFilterCount = [
    filters.search,
    filters.status,
    filters.status_group,
    filters.potential_rating,
    filters.assigned_to,
    filters.ordering,
  ].filter(Boolean).length;

  return {
    filters: { ...filters, search: searchInput },
    setSearch,
    setStatus,
    setStatusGroup,
    setPotentialRating,
    setAssignedTo,
    setOrdering,
    setPage,
    resetFilters,
    activeFilterCount,
  };
};
