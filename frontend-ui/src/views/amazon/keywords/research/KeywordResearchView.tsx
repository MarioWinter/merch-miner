import { useState, useCallback, useMemo } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { useTranslation } from 'react-i18next';
import MarketplaceSelect from '@/components/MarketplaceSelect';
import { useKeywordSearch } from './hooks/useKeywordSearch';
import { useJSEnrich } from './hooks/useJSEnrich';
import { useKeywordExport } from './hooks/useKeywordExport';
import { useRecentSearches } from './hooks/useRecentSearches';
import { useModifierSuggestions } from './hooks/useModifierSuggestions';
import { KeywordSearchBar } from './partials/KeywordSearchBar';
import { SearchHistoryChips } from './partials/SearchHistoryChips';
import { SuggestionMultiplier } from './partials/SuggestionMultiplier';
import { WordSuggestions } from './partials/WordSuggestions';
import { KeywordChipCloud } from './partials/KeywordChipCloud';
import { SourceTabs, type SourceFilter } from './partials/SourceTabs';
import { KeywordTable } from './partials/KeywordTable';
import { ColumnPicker } from './partials/ColumnPicker';
import { FloatingActionBar } from './partials/FloatingActionBar';
import { TrendChart } from './partials/TrendChart';
import { EmptyState } from './partials/EmptyState';
import { loadColumnVisibility } from './utils/columnStorage';
import { DEFAULT_COLUMN_VISIBILITY } from './types';
import type { KeywordColumnVisibility, KeywordSearchResult, KeywordSource } from './types';

const DATABASE_SOURCES: KeywordSource[] = ['research', 'web_search', 'manual'];
const AMAZON_SOURCES: KeywordSource[] = ['amazon_search'];

const KeywordResearchView = () => {
  const { t } = useTranslation();

  // Search state
  const {
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
  } = useKeywordSearch();

  // Recent searches
  const { searches, addSearch, removeSearch, clearAll } = useRecentSearches();

  // Modifier suggestions
  const {
    suggestions: modifierSuggestions,
    isGenerating: isGeneratingModifiers,
    generate: generateModifiers,
  } = useModifierSuggestions();

  // Enrich (always disabled)
  const { enrichSingle, isEnriching } = useJSEnrich(marketplace);

  // Export
  const { exportCSV, isExporting } = useKeywordExport();

  // Column visibility
  const [columnVisibility, setColumnVisibility] = useState<KeywordColumnVisibility>(
    () => loadColumnVisibility() ?? DEFAULT_COLUMN_VISIBILITY,
  );

  // Selection
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);

  // Filters
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [chipFilter, setChipFilter] = useState<string | null>(null);

  // Trend chart
  const [trendKeyword, setTrendKeyword] = useState<string | null>(null);

  // Handle history chip select
  const handleHistorySelect = useCallback(
    (keyword: string, mp: string) => {
      handleInputChange(keyword);
      setMarketplace(mp);
      executeSearch(keyword);
    },
    [handleInputChange, setMarketplace, executeSearch],
  );

  // Execute search and record in history
  const handleSearch = useCallback(
    (query?: string) => {
      executeSearch(query);
      const q = (query ?? inputValue).trim();
      if (q) addSearch(q, marketplace);
    },
    [executeSearch, inputValue, marketplace, addSearch],
  );

  // Word click -> append to search bar
  const handleWordClick = useCallback(
    (word: string) => {
      const newValue = inputValue.trim() ? `${inputValue.trim()} ${word}` : word;
      handleInputChange(newValue);
    },
    [inputValue, handleInputChange],
  );

  // Modifier generate
  const handleModifierGenerate = useCallback(
    (prefixes: string[], suffixes: string[]) => {
      generateModifiers(committedQuery || inputValue, prefixes, suffixes, marketplace);
    },
    [generateModifiers, committedQuery, inputValue, marketplace],
  );

  // Add modifier suggestion to search
  const handleAddModifierSuggestion = useCallback(
    (keyword: string) => {
      handleInputChange(keyword);
      executeSearch(keyword);
      addSearch(keyword, marketplace);
    },
    [handleInputChange, executeSearch, addSearch, marketplace],
  );

  const handleKeywordClick = useCallback((keyword: string) => {
    setTrendKeyword(keyword);
  }, []);

  // Client-side filtering
  const filteredResults = useMemo(() => {
    let filtered: KeywordSearchResult[] = results;

    // Source filter
    if (sourceFilter === 'database') {
      filtered = filtered.filter((r) => DATABASE_SOURCES.includes(r.source));
    } else if (sourceFilter === 'amazon') {
      filtered = filtered.filter((r) => AMAZON_SOURCES.includes(r.source));
    }

    // Chip filter
    if (chipFilter) {
      filtered = filtered.filter((r) => r.keyword === chipFilter);
    }

    return filtered;
  }, [results, sourceFilter, chipFilter]);

  const hasResults = results.length > 0;
  const showEmptyState = committedQuery && !isSearching && !hasResults;

  return (
    <Box>
      {/* Page Header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Typography variant="h4" fontWeight={700}>
          {t('keywords.page.title')}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            size="small"
            variant="outlined"
            startIcon={<FileDownloadIcon sx={{ fontSize: 16 }} />}
            onClick={() => exportCSV(committedQuery, marketplace)}
            disabled={isExporting || !committedQuery}
          >
            {t('keywords.export.buttonLabel')}
          </Button>
        </Stack>
      </Stack>

      {/* Search Controls */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
        <KeywordSearchBar
          value={inputValue}
          suggestions={suggestions}
          onChange={handleInputChange}
          onSearch={handleSearch}
          isSearching={isSearching || isSearchFetching}
        />
        <MarketplaceSelect value={marketplace} onChange={setMarketplace} />
        <ColumnPicker visibility={columnVisibility} onChange={setColumnVisibility} />
      </Stack>

      {/* Search History */}
      <SearchHistoryChips
        searches={searches}
        onSelect={handleHistorySelect}
        onRemove={removeSearch}
        onClearAll={clearAll}
      />

      {/* Suggestion Multiplier */}
      {(committedQuery || inputValue.trim()) && (
        <Box sx={{ mb: 1.5 }}>
          <SuggestionMultiplier
            keyword={committedQuery || inputValue.trim()}
            suggestions={modifierSuggestions}
            isGenerating={isGeneratingModifiers}
            onGenerate={handleModifierGenerate}
            onAddSuggestion={handleAddModifierSuggestion}
          />
        </Box>
      )}

      {/* Word Suggestions */}
      {suggestions.length > 0 && (
        <Box sx={{ mb: 1.5 }}>
          <WordSuggestions
            suggestions={suggestions}
            searchTerm={inputValue}
            onWordClick={handleWordClick}
          />
        </Box>
      )}

      {/* Chip Cloud */}
      <KeywordChipCloud
        results={results}
        activeFilter={chipFilter}
        onFilterChange={setChipFilter}
      />

      {/* Source Tabs */}
      {hasResults && (
        <SourceTabs
          results={results}
          value={sourceFilter}
          onChange={setSourceFilter}
        />
      )}

      {/* Results or Empty State */}
      {showEmptyState ? (
        <EmptyState hasQuery={!!committedQuery} />
      ) : (
        (hasResults || isSearching || isSearchFetching) && (
          <KeywordTable
            rows={filteredResults}
            totalCount={chipFilter || sourceFilter !== 'all' ? filteredResults.length : totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            columnVisibility={columnVisibility}
            isLoading={isSearching}
            selectedKeywords={selectedKeywords}
            onSelectionChange={setSelectedKeywords}
            onEnrichSingle={enrichSingle}
            isEnriching={isEnriching}
            onKeywordClick={handleKeywordClick}
            marketplace={marketplace}
          />
        )
      )}

      {/* Initial state */}
      {!committedQuery && !isSearching && <EmptyState hasQuery={false} />}

      {/* Floating Action Bar */}
      <FloatingActionBar
        selectedCount={selectedKeywords.length}
        selectedKeywords={selectedKeywords}
        onClearSelection={() => setSelectedKeywords([])}
      />

      {/* Trend Chart Dialog */}
      <TrendChart
        keyword={trendKeyword}
        marketplace={marketplace}
        open={trendKeyword !== null}
        onClose={() => setTrendKeyword(null)}
      />
    </Box>
  );
};

export default KeywordResearchView;
