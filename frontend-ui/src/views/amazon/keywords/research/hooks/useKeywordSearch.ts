import { useState, useCallback, useRef } from 'react';
import { useLazyGetSynonymsQuery } from '@/store/keywordSlice';
import { useGetSuggestionsQuery } from '@/store/researchSlice';
import type { KeywordSearchResult, SuggestionCounts, SuggestionSource } from '../types';
import { apiClient } from '@/services/authService';

const AUTOCOMPLETE_MIN_CHARS = 2;

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
const POD_SUFFIXES = ['lover', 'gifts', 'for men'];

/** POD modifier prefixes — replace old alphabet-before with domain-specific words */
const BEFORE_MODIFIERS = [
  'funny', 'best', 'cool', 'awesome', 'retired',
  'proud', 'i love', "world's best", 'this is my', 'official',
];

/** Priority order for deduplication — lower index = higher priority */
const SOURCE_PRIORITY: SuggestionSource[] = [
  'listing', 'suggestion', 'after', 'before', 'synonym',
];

/**
 * Build a KeywordSearchResult from an autocomplete string + source tag.
 * Autocomplete only returns keyword strings, so remaining fields default to zero/null.
 */
const toResult = (keyword: string, source: SuggestionSource): KeywordSearchResult => ({
  keyword,
  source,
  in_product_count: 0,
  in_slogan_count: 0,
  js_data: null,
  amazon_product_count: null,
  product_count_fetched_at: null,
});

/**
 * Deduplicate results by keyword (case-insensitive). First occurrence by source priority wins.
 * Also removes the original search query from results.
 *
 * `listingResults` are pre-built KeywordSearchResult objects from the listing API
 * that already carry enriched data (in_product_count, in_slogan_count, js_data, etc.).
 * Other groups are plain string arrays converted via toResult().
 */
const deduplicateResults = (
  listingResults: KeywordSearchResult[],
  groups: Record<Exclude<SuggestionSource, 'listing'>, string[]>,
  originalQuery: string,
): KeywordSearchResult[] => {
  const seen = new Set<string>();
  const merged: KeywordSearchResult[] = [];
  const normalizedQuery = originalQuery.toLowerCase().trim();

  for (const source of SOURCE_PRIORITY) {
    if (source === 'listing') {
      for (const result of listingResults) {
        const normalized = result.keyword.toLowerCase().trim();
        if (!normalized || normalized === normalizedQuery || seen.has(normalized)) continue;
        seen.add(normalized);
        merged.push(result);
      }
    } else {
      for (const kw of groups[source]) {
        const normalized = kw.toLowerCase().trim();
        if (!normalized || normalized === normalizedQuery || seen.has(normalized)) continue;
        seen.add(normalized);
        merged.push(toResult(kw.trim(), source));
      }
    }
  }

  return merged;
};

/**
 * Safe extract: returns string[] from a settled promise, empty array on rejection.
 */
const extractSettled = (result: PromiseSettledResult<{ data: string[] }>): string[] =>
  result.status === 'fulfilled' ? result.value.data : [];

const EMPTY_COUNTS: SuggestionCounts = {
  all: 0, listing: 0, suggestion: 0, after: 0, before: 0, synonym: 0,
};

/**
 * Keyword search hook (Phase 15d — Listing Keywords + POD modifier Before).
 *
 * On executeSearch(), fires 5 GROUPS of parallel requests (47 total):
 * 1. Listing: 1 backend keyword search → source=listing (enriched data)
 * 2. Suggestions: 1 standard autocomplete "keyword" → source=suggestion
 * 3. After: 26 alphabet expansions "keyword a" … "keyword z" → source=after
 * 4. Before: 10 POD modifier prefixes "funny keyword" etc. → source=before
 * 5. Synonyms: 5 POD prefix + 3 suffix autocompletes + 1 Datamuse → source=synonym
 *
 * Results are empty until executeSearch() is called (lazy pattern).
 * Autocomplete dropdown suggestions remain live while typing.
 */
export const useKeywordSearch = () => {
  const [inputValue, setInputValue] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const [marketplace, setMarketplace] = useState('amazon_com');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<unknown>(null);
  const [results, setResults] = useState<KeywordSearchResult[]>([]);
  const [suggestionCounts, setSuggestionCounts] = useState<SuggestionCounts>({
    ...EMPTY_COUNTS,
  });

  const abortRef = useRef<AbortController | null>(null);
  const [triggerSynonyms] = useLazyGetSynonymsQuery();

  // Amazon autocomplete suggestions — live while typing (for dropdown)
  const { data: suggestions = [] } = useGetSuggestionsQuery(
    { q: inputValue, marketplace },
    { skip: inputValue.length < AUTOCOMPLETE_MIN_CHARS },
  );

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  /** Fire a single autocomplete request, returning string[] */
  const fetchSuggestions = useCallback(
    (q: string, signal: AbortSignal) =>
      apiClient.get<string[]>('/api/research/suggestions/', {
        params: { q, marketplace },
        signal,
      }),
    [marketplace],
  );

  /** Fetch listing keywords from backend keyword search API */
  const fetchListingKeywords = useCallback(
    (q: string, signal: AbortSignal) =>
      apiClient.get<{ count: number; results: KeywordSearchResult[] }>(
        '/api/keywords/search/',
        { params: { query: q, marketplace }, signal },
      ),
    [marketplace],
  );

  /** Execute search — fires 47 parallel requests, merges + deduplicates */
  const executeSearch = useCallback(
    async (query?: string) => {
      const q = (query ?? inputValue).trim();
      if (!q) return;

      // Cancel any in-flight search
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;

      setCommittedQuery(q);
      setPage(1);
      setIsSearching(true);
      setSearchError(null);

      try {
        // Group 1 — Listing keywords (1 request)
        const listingPromise = fetchListingKeywords(q, signal);

        // Group 2 — Suggestions (1 request)
        const suggestionPromise = fetchSuggestions(q, signal);

        // Group 3 — After: "keyword a" … "keyword z" (26 requests)
        const afterPromises = ALPHABET.map((letter) =>
          fetchSuggestions(`${q} ${letter}`, signal),
        );

        // Group 4 — Before: POD modifier prefixes (10 requests)
        const beforePromises = BEFORE_MODIFIERS.map((mod) =>
          fetchSuggestions(`${mod} ${q}`, signal),
        );

        // Group 5 — Synonyms: 5 POD prefix + 3 suffix autocompletes + 1 Datamuse (9 requests)
        const podPrefixPromises = ['funny', 'best', 'retro', 'vintage', 'cute'].map(
          (prefix) => fetchSuggestions(`${prefix} ${q}`, signal),
        );
        const podSuffixPromises = POD_SUFFIXES.map((suffix) =>
          fetchSuggestions(`${q} ${suffix}`, signal),
        );
        const synonymPromise = triggerSynonyms({ query: q }).unwrap();

        // Fire all 47 requests in parallel
        const LISTING_IDX = 0;
        const SUGGESTION_IDX = 1;
        const AFTER_START = 2;
        const AFTER_END = AFTER_START + 25; // 2-27
        const BEFORE_START = AFTER_END + 1; // 28
        const BEFORE_END = BEFORE_START + BEFORE_MODIFIERS.length - 1; // 37
        const POD_PREFIX_START = BEFORE_END + 1; // 38
        const POD_PREFIX_END = POD_PREFIX_START + 4; // 42
        const POD_SUFFIX_START = POD_PREFIX_END + 1; // 43
        const POD_SUFFIX_END = POD_SUFFIX_START + 2; // 45
        const DATAMUSE_IDX = POD_SUFFIX_END + 1; // 46

        const allSettled = await Promise.allSettled([
          listingPromise,               // 0
          suggestionPromise,            // 1
          ...afterPromises,             // 2-27
          ...beforePromises,            // 28-37
          ...podPrefixPromises,         // 38-42
          ...podSuffixPromises,         // 43-45
          synonymPromise,               // 46
        ]);

        if (signal.aborted) return;

        // --- Extract listing results (pre-built KeywordSearchResult[]) ---
        let listingResults: KeywordSearchResult[] = [];
        const listingSettled = allSettled[LISTING_IDX];
        if (listingSettled.status === 'fulfilled') {
          const resp = (listingSettled.value as { data: { count: number; results: KeywordSearchResult[] } }).data;
          listingResults = resp.results.map((r) => ({ ...r, source: 'listing' as const }));
        }

        // --- Extract autocomplete string groups ---
        const suggestionWords = extractSettled(
          allSettled[SUGGESTION_IDX] as PromiseSettledResult<{ data: string[] }>,
        );

        const afterWords: string[] = [];
        for (let i = AFTER_START; i <= AFTER_END; i++) {
          afterWords.push(
            ...extractSettled(allSettled[i] as PromiseSettledResult<{ data: string[] }>),
          );
        }

        const beforeWords: string[] = [];
        for (let i = BEFORE_START; i <= BEFORE_END; i++) {
          beforeWords.push(
            ...extractSettled(allSettled[i] as PromiseSettledResult<{ data: string[] }>),
          );
        }

        const synonymWords: string[] = [];
        for (let i = POD_PREFIX_START; i <= POD_PREFIX_END; i++) {
          synonymWords.push(
            ...extractSettled(allSettled[i] as PromiseSettledResult<{ data: string[] }>),
          );
        }
        for (let i = POD_SUFFIX_START; i <= POD_SUFFIX_END; i++) {
          synonymWords.push(
            ...extractSettled(allSettled[i] as PromiseSettledResult<{ data: string[] }>),
          );
        }
        const datamuseResult = allSettled[DATAMUSE_IDX];
        if (datamuseResult.status === 'fulfilled') {
          synonymWords.push(...(datamuseResult.value as { words: string[] }).words);
        }

        const groups = {
          suggestion: suggestionWords,
          after: afterWords,
          before: beforeWords,
          synonym: synonymWords,
        };

        const merged = deduplicateResults(listingResults, groups, q);

        // Count per source (after dedup)
        const counts: SuggestionCounts = { ...EMPTY_COUNTS };
        for (const r of merged) {
          const src = r.source as SuggestionSource;
          if (src in counts) counts[src]++;
        }
        counts.all = merged.length;

        setResults(merged);
        setSuggestionCounts(counts);
      } catch (err) {
        if (!signal.aborted) {
          setSearchError(err);
          setResults([]);
          setSuggestionCounts({ ...EMPTY_COUNTS });
        }
      } finally {
        if (!signal.aborted) {
          setIsSearching(false);
        }
      }
    },
    [inputValue, triggerSynonyms, fetchSuggestions, fetchListingKeywords],
  );

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const clearResults = useCallback(() => {
    abortRef.current?.abort();
    setResults([]);
    setCommittedQuery('');
    setPage(1);
    setSuggestionCounts({ ...EMPTY_COUNTS });
  }, []);

  const totalCount = results.length;

  return {
    inputValue,
    committedQuery,
    marketplace,
    setMarketplace,
    handleInputChange,
    executeSearch,
    clearResults,
    suggestions,
    results,
    totalCount,
    page,
    pageSize,
    handlePageChange,
    suggestionCounts,
    isSearching,
    isSearchFetching: isSearching,
    searchError,
  };
};
