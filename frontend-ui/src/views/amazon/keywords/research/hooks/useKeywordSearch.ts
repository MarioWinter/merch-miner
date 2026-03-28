import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchKeywordsQuery } from '@/store/keywordSlice';
import { useGetSuggestionsQuery } from '@/store/researchSlice';
import type { KeywordSearchResult } from '../types';

const DEBOUNCE_MS = 300;

export const useKeywordSearch = () => {
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [marketplace, setMarketplace] = useState('amazon_com');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(inputValue);
      setPage(1);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Main search query (DB + merged results)
  const {
    data: searchData,
    isLoading: isSearching,
    isFetching: isSearchFetching,
    error: searchError,
  } = useSearchKeywordsQuery(
    { query: searchQuery, marketplace, page, page_size: pageSize },
    { skip: !searchQuery },
  );

  // Amazon autocomplete suggestions for the search input
  const { data: suggestions = [] } = useGetSuggestionsQuery(
    { q: inputValue, marketplace },
    { skip: inputValue.length < 2 },
  );

  const results: KeywordSearchResult[] = useMemo(
    () => searchData?.results ?? [],
    [searchData],
  );

  const totalCount = searchData?.count ?? 0;

  const handleSearch = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  return {
    inputValue,
    searchQuery,
    marketplace,
    setMarketplace,
    handleSearch,
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
