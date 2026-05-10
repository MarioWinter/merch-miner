import { useState, useCallback, useMemo } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { useTranslation } from 'react-i18next';
import MarketplaceSelect from '@/components/MarketplaceSelect';
import { useKeywordSearch } from './hooks/useKeywordSearch';
import { useJSEnrich } from './hooks/useJSEnrich';
import { useKeywordExport } from './hooks/useKeywordExport';
import useUserSearchHistory from '@/hooks/useUserSearchHistory';
import { KeywordSearchBar } from './partials/KeywordSearchBar';
import { SearchHistoryChips } from '@/components/SearchHistory/SearchHistoryChips';
import { KeywordChipCloud } from './partials/KeywordChipCloud';
import { SuggestionTabs, type SuggestionFilter } from './partials/SuggestionTabs';
import { KeywordTable } from './partials/KeywordTable';
import { ColumnPicker } from './partials/ColumnPicker';
import { FloatingActionBar } from './partials/FloatingActionBar';
import { TrendChart } from './partials/TrendChart';
import { EmptyState } from './partials/EmptyState';
import { loadColumnVisibility } from './utils/columnStorage';
import { DEFAULT_COLUMN_VISIBILITY } from './types';
import type { KeywordColumnVisibility, KeywordSearchResult } from './types';

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
    suggestionCounts,
  } = useKeywordSearch();

  // Recent searches — DB-backed, per-user, shared model with Amazon Research.
  const { searches, addSearch, removeSearch, clearAll } =
    useUserSearchHistory('keyword_drilling');

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
  const [sourceFilter, setSourceFilter] = useState<SuggestionFilter>('all');
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

  const handleKeywordClick = useCallback((keyword: string) => {
    setTrendKeyword(keyword);
  }, []);

  // Row action: re-execute search with the clicked keyword
  const handleSearchKeyword = useCallback(
    (keyword: string) => {
      handleInputChange(keyword);
      executeSearch(keyword);
      addSearch(keyword, marketplace);
    },
    [handleInputChange, executeSearch, addSearch, marketplace],
  );

  // Client-side filtering
  const filteredResults = useMemo(() => {
    let filtered: KeywordSearchResult[] = results;

    // Source filter
    if (sourceFilter !== 'all') {
      filtered = filtered.filter((r) => r.source === sourceFilter);
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

      {/* Chip Cloud */}
      <KeywordChipCloud
        results={results}
        activeFilter={chipFilter}
        onFilterChange={setChipFilter}
      />

      {/* Source Tabs */}
      {hasResults && (
        <SuggestionTabs
          counts={suggestionCounts}
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
            onSearchKeyword={handleSearchKeyword}
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
