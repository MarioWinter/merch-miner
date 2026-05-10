import { useCallback, useMemo } from 'react';
import {
  useListSearchHistoryQuery,
  useCreateSearchHistoryMutation,
  useDeleteSearchHistoryMutation,
  useClearSearchHistoryMutation,
  type SearchHistoryContext,
  type SearchHistoryEntry,
} from '../store/searchHistorySlice';

export interface RecentSearch {
  /** Backend row id — needed for delete-one. */
  id: string;
  keyword: string;
  marketplace: string;
}

interface UseUserSearchHistoryReturn {
  searches: RecentSearch[];
  /** Optimistic-friendly: API returns the upserted/new row; cache invalidation refreshes the list. */
  addSearch: (keyword: string, marketplace: string) => Promise<void>;
  /** index is the position in the displayed list (0 = newest). */
  removeSearch: (index: number) => Promise<void>;
  clearAll: () => Promise<void>;
  isLoading: boolean;
}

/**
 * Per-user persisted search history, scoped to a single research surface
 * (`amazon_research` or `keyword_drilling`). Wraps the searchHistoryApi
 * RTK Query slice so callers get the same minimal interface as the
 * legacy localStorage-only hooks they replace.
 *
 * Auth-required: returns empty list if user is not signed in (404/401
 * from the API surfaces as `searches: []`).
 */
const useUserSearchHistory = (
  context: SearchHistoryContext,
): UseUserSearchHistoryReturn => {
  const { data, isLoading } = useListSearchHistoryQuery({ context });
  const [createMutation] = useCreateSearchHistoryMutation();
  const [deleteMutation] = useDeleteSearchHistoryMutation();
  const [clearMutation] = useClearSearchHistoryMutation();

  const searches = useMemo<RecentSearch[]>(
    () =>
      (data ?? []).map((entry: SearchHistoryEntry) => ({
        id: entry.id,
        keyword: entry.keyword,
        marketplace: entry.marketplace,
      })),
    [data],
  );

  const addSearch = useCallback(
    async (keyword: string, marketplace: string) => {
      const trimmed = (keyword ?? '').trim();
      if (!trimmed) return;
      try {
        await createMutation({
          context,
          keyword: trimmed,
          marketplace: marketplace ?? '',
        }).unwrap();
      } catch {
        // Ignore — auth/network errors should not break the search flow.
        // Non-critical: history persistence is best-effort.
      }
    },
    [context, createMutation],
  );

  const removeSearch = useCallback(
    async (index: number) => {
      const target = searches[index];
      if (!target) return;
      try {
        await deleteMutation({ id: target.id, context }).unwrap();
      } catch {
        // Ignore (best-effort)
      }
    },
    [context, searches, deleteMutation],
  );

  const clearAll = useCallback(async () => {
    try {
      await clearMutation({ context }).unwrap();
    } catch {
      // Ignore (best-effort)
    }
  }, [context, clearMutation]);

  return { searches, addSearch, removeSearch, clearAll, isLoading };
};

export default useUserSearchHistory;
