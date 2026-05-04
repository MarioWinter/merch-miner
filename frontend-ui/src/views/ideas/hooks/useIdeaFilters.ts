import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { IdeaStatus, SignalType, IdeaOrdering, IdeaFilters } from '../types';

export interface UseIdeaFiltersReturn {
  filters: IdeaFilters;
  setNicheId: (value: string) => void;
  setStatus: (value: IdeaStatus | '') => void;
  setSignalType: (value: SignalType | '') => void;
  setOrdering: (value: IdeaOrdering | '') => void;
  setPage: (value: number) => void;
  resetFilters: () => void;
  applyFilters: (partial: Partial<IdeaFilters>) => void;
  activeFilterCount: number;
}

const getParam = (params: URLSearchParams, key: string): string =>
  params.get(key) ?? '';

const getPageParam = (params: URLSearchParams): number => {
  const raw = params.get('page');
  const parsed = parseInt(raw ?? '1', 10);
  return isNaN(parsed) || parsed < 1 ? 1 : parsed;
};

export const useIdeaFilters = (): UseIdeaFiltersReturn => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: IdeaFilters = {
    niche_id: getParam(searchParams, 'niche_id'),
    status: getParam(searchParams, 'status') as IdeaStatus | '',
    signal_type: getParam(searchParams, 'signal_type') as SignalType | '',
    ordering: (getParam(searchParams, 'ordering') || '-created_at') as IdeaOrdering | '',
    page: getPageParam(searchParams),
  };

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

  const setNicheId = useCallback(
    (value: string) => setParam('niche_id', value),
    [setParam],
  );

  const setStatus = useCallback(
    (value: IdeaStatus | '') => setParam('status', value),
    [setParam],
  );

  const setSignalType = useCallback(
    (value: SignalType | '') => setParam('signal_type', value),
    [setParam],
  );

  const setOrdering = useCallback(
    (value: IdeaOrdering | '') => setParam('ordering', value),
    [setParam],
  );

  const setPage = useCallback(
    (value: number) => setParam('page', value > 1 ? String(value) : ''),
    [setParam],
  );

  const resetFilters = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  const applyFilters = useCallback(
    (partial: Partial<IdeaFilters>) => {
      setSearchParams(() => {
        const next = new URLSearchParams();
        if (partial.niche_id) next.set('niche_id', partial.niche_id);
        if (partial.status) next.set('status', partial.status);
        if (partial.signal_type) next.set('signal_type', partial.signal_type);
        if (partial.ordering) next.set('ordering', partial.ordering);
        return next;
      });
    },
    [setSearchParams],
  );

  const activeFilterCount = [
    filters.niche_id,
    filters.status,
    filters.signal_type,
  ].filter(Boolean).length;

  return {
    filters,
    setNicheId,
    setStatus,
    setSignalType,
    setOrdering,
    setPage,
    resetFilters,
    applyFilters,
    activeFilterCount,
  };
};
