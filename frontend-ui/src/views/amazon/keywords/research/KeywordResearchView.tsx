import { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Stack,
  Typography,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { useTranslation } from 'react-i18next';
import MarketplaceSelect from '@/components/MarketplaceSelect';
import { useKeywordSearch } from './hooks/useKeywordSearch';
import { useJSEnrich } from './hooks/useJSEnrich';
import { useKeywordExport } from './hooks/useKeywordExport';
import { KeywordSearchBar } from './partials/KeywordSearchBar';
import { KeywordTable } from './partials/KeywordTable';
import { ColumnPicker } from './partials/ColumnPicker';
import { loadColumnVisibility } from './utils/columnStorage';
import { AddToNicheButton } from './partials/AddToNicheButton';
import { EnrichButton } from './partials/EnrichButton';
import { TrendChart } from './partials/TrendChart';
import { EmptyState } from './partials/EmptyState';
import { DEFAULT_COLUMN_VISIBILITY } from './types';
import type { KeywordColumnVisibility } from './types';

const KeywordResearchView = () => {
  const { t } = useTranslation();

  // Search state — fires only on Enter/button click
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

  // Enrich (always disabled for now)
  const { enrichSingle, enrichBulk, isBulkEnriching, isEnriching } = useJSEnrich(marketplace);

  // Export
  const { exportCSV, isExporting } = useKeywordExport();

  // Column visibility
  const [columnVisibility, setColumnVisibility] = useState<KeywordColumnVisibility>(
    () => loadColumnVisibility() ?? DEFAULT_COLUMN_VISIBILITY,
  );

  // Selection
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);

  // Trend chart
  const [trendKeyword, setTrendKeyword] = useState<string | null>(null);

  const handleKeywordClick = useCallback((keyword: string) => {
    setTrendKeyword(keyword);
  }, []);

  const handleEnrichSelected = useCallback(() => {
    if (selectedKeywords.length > 0) {
      enrichBulk(selectedKeywords);
    }
  }, [selectedKeywords, enrichBulk]);

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
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <KeywordSearchBar
          value={inputValue}
          suggestions={suggestions}
          onChange={handleInputChange}
          onSearch={executeSearch}
          isSearching={isSearching || isSearchFetching}
        />

        <MarketplaceSelect value={marketplace} onChange={setMarketplace} />

        <ColumnPicker visibility={columnVisibility} onChange={setColumnVisibility} />
      </Stack>

      {/* Action Bar */}
      {selectedKeywords.length > 0 && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {t('keywords.table.selected', { count: selectedKeywords.length })}
          </Typography>
          <EnrichButton
            keywords={selectedKeywords}
            isEnriching={isBulkEnriching}
            onEnrich={handleEnrichSelected}
            variant="button"
          />
          <AddToNicheButton
            selectedKeywords={selectedKeywords}
            activeNicheId={null}
            activeNicheName={null}
            onClearSelection={() => setSelectedKeywords([])}
          />
        </Stack>
      )}

      {/* Results or Empty State */}
      {showEmptyState ? (
        <EmptyState hasQuery={!!committedQuery} />
      ) : (
        (hasResults || isSearching || isSearchFetching) && (
          <KeywordTable
            rows={results}
            totalCount={totalCount}
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
          />
        )
      )}

      {/* Initial state — no search yet */}
      {!committedQuery && !isSearching && <EmptyState hasQuery={false} />}

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
