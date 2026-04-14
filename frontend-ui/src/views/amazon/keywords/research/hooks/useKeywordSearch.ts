import { useState, useMemo, useCallback } from 'react';
import { useLazySearchKeywordsQuery } from '@/store/keywordSlice';
import { useGetSuggestionsQuery } from '@/store/researchSlice';
import type { KeywordSearchResult } from '../types';

const AUTOCOMPLETE_MIN_CHARS = 2;

/**
 * Keyword search hook. Search fires ONLY on Enter key or Search button click (AC-5b).
 * Autocomplete dropdown suggestions remain live (debounced via RTK Query skip logic).
 * Same pattern as PROJ-7 useProductSearch.
 */
export const useKeywordSearch = () => {
  const [inputValue, setInputValue] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const [marketplace, setMarketplace] = useState('amazon_com');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Lazy search — only fires when explicitly triggered
  const [
    triggerSearch,
    { data: searchData, isLoading: isSearching, isFetching: isSearchFetching, error: searchError },
  ] = useLazySearchKeywordsQuery();

  // Amazon autocomplete suggestions — live while typing (RTK Query handles debounce via skip)
  const { data: suggestions = [] } = useGetSuggestionsQuery(
    { q: inputValue, marketplace },
    { skip: inputValue.length < AUTOCOMPLETE_MIN_CHARS },
  );

  const results: KeywordSearchResult[] = useMemo(
    () => searchData?.results ?? [],
    [searchData],
  );

  const totalCount = searchData?.count ?? 0;

  /** Update the text input without triggering search */
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  /** Execute search — called on Enter or Search button click */
  const executeSearch = useCallback(
    (query?: string) => {
      const q = (query ?? inputValue).trim();
      if (!q) return;
      setCommittedQuery(q);
      setPage(1);
      triggerSearch({ query: q, marketplace, page: 1, page_size: pageSize });
    },
    [inputValue, marketplace, pageSize, triggerSearch],
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      if (committedQuery) {
        triggerSearch({ query: committedQuery, marketplace, page: newPage, page_size: pageSize });
      }
    },
    [committedQuery, marketplace, pageSize, triggerSearch],
  );

  return {
    inputValue,
    committedQuery,
    marketplace,
    setMarketplace,
    handleInputChange,
    executeSearch,
    suggestions,
    results,
    totalCount,
    page,
    pageSize,
    handlePageChange,
    isSearching,
    isSearchFetching,
    searchError,
  };
};
