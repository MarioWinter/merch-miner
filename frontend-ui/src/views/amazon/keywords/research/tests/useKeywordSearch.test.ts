/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeywordSearch } from '../hooks/useKeywordSearch';
import type { KeywordSearchResult } from '../types';

// --- Mocks ---

const mockTriggerSynonyms = vi.fn();
const mockUnwrap = vi.fn();

vi.mock('@/store/keywordSlice', () => ({
  useLazyGetSynonymsQuery: () => [
    (...args: unknown[]) => {
      mockTriggerSynonyms(...args);
      return { unwrap: mockUnwrap };
    },
  ],
}));

vi.mock('@/store/researchSlice', () => ({
  useGetSuggestionsQuery: () => ({ data: [] }),
}));

const mockGet = vi.fn();
vi.mock('@/services/authService', () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args) },
}));

/** Build a listing API response with enriched KeywordSearchResult objects */
const makeListingResponse = (
  keywords: Array<{ keyword: string; in_product_count?: number; in_slogan_count?: number }>,
) => ({
  data: {
    count: keywords.length,
    results: keywords.map(
      (k): KeywordSearchResult => ({
        keyword: k.keyword,
        source: 'research', // backend returns KeywordSource; hook remaps to 'listing'
        in_product_count: k.in_product_count ?? 0,
        in_slogan_count: k.in_slogan_count ?? 0,
        js_data: null,
        amazon_product_count: null,
        product_count_fetched_at: null,
      }),
    ),
  },
});

/**
 * Setup API responses for the 47 parallel requests.
 *
 * Routes:
 * - /api/keywords/search/ → listing response
 * - /api/research/suggestions/ → autocomplete string[]
 */
const setupSearchResponses = (opts: {
  listing?: Array<{ keyword: string; in_product_count?: number; in_slogan_count?: number }>;
  suggestion?: string[];
  afterResults?: Record<string, string[]>;
  beforeResults?: Record<string, string[]>;
  podResults?: Record<string, string[]>;
  datamuse?: string[];
}) => {
  const {
    listing = [],
    suggestion = [],
    afterResults = {},
    beforeResults = {},
    podResults = {},
    datamuse = [],
  } = opts;

  mockGet.mockImplementation((url: string, config: { params: { q?: string; query?: string } }) => {
    // Listing keywords endpoint
    if (url === '/api/keywords/search/') {
      return Promise.resolve(makeListingResponse(listing));
    }

    // Autocomplete suggestions endpoint
    const q = config.params.q ?? '';

    // Check exact matches first (for specific test data)
    if (afterResults[q]) return Promise.resolve({ data: afterResults[q] });
    if (beforeResults[q]) return Promise.resolve({ data: beforeResults[q] });
    if (podResults[q]) return Promise.resolve({ data: podResults[q] });

    // Standard suggestion (no prefix/suffix pattern)
    const hasTrailingLetter = / [a-z]$/.test(q);
    const isPodModifier = /^(funny|best|cool|awesome|retired|proud|i love|world's best|this is my|official) /.test(q);
    const isPodSynonym = /^(funny|best|retro|vintage|cute) /.test(q);
    const isPodSuffix = / (lover|gifts|for men)$/.test(q);

    if (!hasTrailingLetter && !isPodModifier && !isPodSynonym && !isPodSuffix) {
      return Promise.resolve({ data: suggestion });
    }

    // Default: empty array for unmatched expansions
    return Promise.resolve({ data: [] });
  });

  mockUnwrap.mockResolvedValueOnce({ words: datamuse });
};

describe('useKeywordSearch — 5-group pattern', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fires 47 apiClient.get calls + 1 synonym trigger', async () => {
    // 1 listing + 1 suggestion + 26 after + 10 before + 5 POD prefix + 3 POD suffix = 46 get calls
    // + 1 Datamuse via triggerSynonyms = 47 total promises, 46 mockGet + 1 mockTriggerSynonyms
    setupSearchResponses({});

    const { result } = renderHook(() => useKeywordSearch());

    await act(async () => {
      await result.current.executeSearch('test');
    });

    // 1 listing + 1 suggestion + 26 after + 10 before + 5 POD prefix + 3 POD suffix = 46
    expect(mockGet).toHaveBeenCalledTimes(46);
    expect(mockTriggerSynonyms).toHaveBeenCalledTimes(1);
  });

  it('listing results preserve in_product_count + in_slogan_count from API', async () => {
    setupSearchResponses({
      listing: [
        { keyword: 'camping shirt', in_product_count: 42, in_slogan_count: 7 },
        { keyword: 'camping hoodie', in_product_count: 15, in_slogan_count: 3 },
      ],
    });

    const { result } = renderHook(() => useKeywordSearch());

    await act(async () => {
      await result.current.executeSearch('camping');
    });

    const campingShirt = result.current.results.find((r) => r.keyword === 'camping shirt');
    expect(campingShirt).toBeDefined();
    expect(campingShirt?.source).toBe('listing');
    expect(campingShirt?.in_product_count).toBe(42);
    expect(campingShirt?.in_slogan_count).toBe(7);

    const campingHoodie = result.current.results.find((r) => r.keyword === 'camping hoodie');
    expect(campingHoodie).toBeDefined();
    expect(campingHoodie?.in_product_count).toBe(15);
    expect(campingHoodie?.in_slogan_count).toBe(3);
  });

  it('listing keywords win dedup over suggestion (same keyword in both)', async () => {
    setupSearchResponses({
      listing: [{ keyword: 'camping shirt', in_product_count: 10, in_slogan_count: 2 }],
      suggestion: ['camping shirt', 'camping gear'],
    });

    const { result } = renderHook(() => useKeywordSearch());

    await act(async () => {
      await result.current.executeSearch('camping');
    });

    const campingShirt = result.current.results.find((r) => r.keyword === 'camping shirt');
    expect(campingShirt?.source).toBe('listing');
    // Enriched data preserved (not zeroed by suggestion's toResult)
    expect(campingShirt?.in_product_count).toBe(10);

    // camping gear still appears as suggestion
    const campingGear = result.current.results.find((r) => r.keyword === 'camping gear');
    expect(campingGear?.source).toBe('suggestion');
  });

  it('before fires POD modifier requests, not alphabet', async () => {
    // Use modifiers unique to Before group (not overlapping with Synonym POD prefix)
    setupSearchResponses({
      beforeResults: {
        'cool camping': ['cool camping shirt'],
        'awesome camping': ['awesome camping mug'],
        'retired camping': ['retired camping lover'],
        'proud camping': [],
        'i love camping': ['i love camping shirt'],
        "world's best camping": [],
        'this is my camping': [],
        'official camping': [],
      },
    });

    const { result } = renderHook(() => useKeywordSearch());

    await act(async () => {
      await result.current.executeSearch('camping');
    });

    // Verify that Before-only modifiers were called (cool, awesome, retired, proud,
    // i love, world's best, this is my, official — not alphabet "a camping", "b camping")
    const modifiers = ['cool', 'awesome', 'retired', 'proud', 'i love', "world's best", 'this is my', 'official'];
    for (const mod of modifiers) {
      const found = mockGet.mock.calls.some(
        ([url, config]: [string, { params: { q?: string } }]) =>
          url === '/api/research/suggestions/' &&
          config.params.q === `${mod} camping`,
      );
      expect(found, `expected call with "${mod} camping"`).toBe(true);
    }

    // No old-style alphabet-before calls like "a camping", "b camping"
    const alphabetBeforeCalls = mockGet.mock.calls.filter(
      ([url, config]: [string, { params: { q?: string } }]) =>
        url === '/api/research/suggestions/' &&
        /^[a-z] camping$/.test(config.params.q ?? ''),
    );
    expect(alphabetBeforeCalls.length).toBe(0);

    // Results from before group are present
    const beforeResultItems = result.current.results.filter((r) => r.source === 'before');
    const keywords = beforeResultItems.map((r) => r.keyword);
    expect(keywords).toContain('cool camping shirt');
    expect(keywords).toContain('awesome camping mug');
    expect(keywords).toContain('retired camping lover');
    expect(keywords).toContain('i love camping shirt');
  });

  it('counts include listing field', async () => {
    setupSearchResponses({
      listing: [
        { keyword: 'alpha listing', in_product_count: 5 },
        { keyword: 'bravo listing', in_product_count: 3 },
      ],
      suggestion: ['charlie suggestion'],
      afterResults: { 'test d': ['delta after'] },
      datamuse: ['echo synonym'],
    });

    const { result } = renderHook(() => useKeywordSearch());

    await act(async () => {
      await result.current.executeSearch('test');
    });

    expect(result.current.suggestionCounts).toEqual({
      all: 5,
      listing: 2,
      suggestion: 1,
      after: 1,
      before: 0,
      synonym: 1,
    });
  });

  it('removes the original search query from results', async () => {
    setupSearchResponses({
      listing: [{ keyword: 'camping' }],
      suggestion: ['camping', 'camping shirt'],
      afterResults: { 'camping a': ['camping accessories'] },
    });

    const { result } = renderHook(() => useKeywordSearch());

    await act(async () => {
      await result.current.executeSearch('camping');
    });

    const keywords = result.current.results.map((r) => r.keyword);
    expect(keywords).not.toContain('camping');
    expect(keywords).toContain('camping shirt');
    expect(keywords).toContain('camping accessories');
  });

  it('deduplicates case-insensitively, keeping first occurrence casing', async () => {
    setupSearchResponses({
      listing: [{ keyword: 'Camping Shirt', in_product_count: 8 }],
      suggestion: ['camping shirt'],
    });

    const { result } = renderHook(() => useKeywordSearch());

    await act(async () => {
      await result.current.executeSearch('camping');
    });

    const campingResults = result.current.results.filter(
      (r) => r.keyword.toLowerCase() === 'camping shirt',
    );
    expect(campingResults).toHaveLength(1);
    // Listing wins (higher priority) and keeps its casing
    expect(campingResults[0].keyword).toBe('Camping Shirt');
    expect(campingResults[0].source).toBe('listing');
  });

  it('applies full priority: listing > suggestion > after > before > synonym', async () => {
    // "dog shirt" only in after + synonym → should be source=after
    setupSearchResponses({
      suggestion: [],
      afterResults: { 'dog s': ['dog shirt'] },
      datamuse: ['dog shirt'],
    });

    const { result } = renderHook(() => useKeywordSearch());

    await act(async () => {
      await result.current.executeSearch('dog');
    });

    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0].source).toBe('after');
  });

  it('includes POD variation results in synonym group', async () => {
    // Use modifiers unique to Synonym group (retro, vintage, cute are only in POD prefix synonyms,
    // not in BEFORE_MODIFIERS). Also test suffix "lover" which is in POD_SUFFIXES.
    setupSearchResponses({
      podResults: {
        'retro camping': ['retro camping shirt'],
        'camping lover': ['camping lover gift'],
      },
    });

    const { result } = renderHook(() => useKeywordSearch());

    await act(async () => {
      await result.current.executeSearch('camping');
    });

    const synonymResults = result.current.results.filter((r) => r.source === 'synonym');
    const keywords = synonymResults.map((r) => r.keyword);
    expect(keywords).toContain('retro camping shirt');
    expect(keywords).toContain('camping lover gift');
  });
});
