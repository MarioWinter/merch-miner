import { useState, useCallback, useEffect } from 'react';
import { Box, Skeleton, Stack, TablePagination, Typography } from '@mui/material';
import {
  useListProductsQuery,
  useTriggerLiveSearchMutation,
} from '../../../store/researchSlice';
import useResearchMode from './hooks/useResearchMode';
import useFilterState from './hooks/useFilterState';
import useRecentSearches from './hooks/useRecentSearches';
import usePolling from './hooks/usePolling';
import type { ResearchFilters } from './types';
import SearchBar from './partials/SearchBar';
import ControlsRow from './partials/ControlsRow';
import AdvancedOptionsPanel from './partials/AdvancedOptionsPanel';
import ResultsToolbar from './partials/ResultsToolbar';
import ProductGrid from './partials/ProductGrid';
import ProductTable from './partials/ProductTable';
import LiveProgressBanner from './partials/LiveProgressBanner';
import EmptyState from './partials/EmptyState';

const STORAGE_MARKETPLACE_KEY = 'mm-research-marketplace';

const getInitialMarketplace = (): string =>
  localStorage.getItem(STORAGE_MARKETPLACE_KEY) ?? 'amazon_com';

const AmazonResearchView = () => {
  const { filters, enabled, setFilter, setEnabled, resetFilters, activeFilterCount } =
    useFilterState();
  const { mode, isLive, toggleMode } = useResearchMode(resetFilters);
  const { searches, addSearch, removeSearch } = useRecentSearches();

  const [keyword, setKeyword] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(0);
  const [cacheId, setCacheId] = useState<string | null>(null);

  // Init marketplace from localStorage
  useEffect(() => {
    const saved = getInitialMarketplace();
    if (saved !== filters.marketplace) setFilter('marketplace', saved);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist marketplace
  useEffect(() => {
    localStorage.setItem(STORAGE_MARKETPLACE_KEY, filters.marketplace);
  }, [filters.marketplace]);

  // DB mode query params
  const buildQueryParams = useCallback(() => {
    const params: Record<string, unknown> = {
      keyword,
      marketplace: filters.marketplace,
      sort_by: filters.sort_by,
      page: page + 1,
      page_size: 50,
    };
    if (filters.product_type) params.product_type = filters.product_type;
    if (enabled.bsr_min) {
      params.bsr_min = filters.bsr_min;
      params.bsr_max = filters.bsr_max;
    }
    if (enabled.reviews_min) {
      params.reviews_min = filters.reviews_min;
      params.reviews_max = filters.reviews_max;
    }
    if (enabled.price_min) {
      params.price_min = filters.price_min;
      params.price_max = filters.price_max;
    }
    if (enabled.rating_min) params.rating_min = filters.rating_min;
    if (filters.hide_official_brands) params.hide_official_brands = true;
    if (enabled.subcategory && filters.subcategory)
      params.subcategory = filters.subcategory;
    if (enabled.exclude_words && filters.exclude_words)
      params.exclude_words = filters.exclude_words;
    if (enabled.date_from && filters.date_from) params.date_from = filters.date_from;
    if (enabled.date_to && filters.date_to) params.date_to = filters.date_to;
    return params;
  }, [keyword, filters, enabled, page]);

  const dbQueryParams = buildQueryParams();
  const shouldQueryDb = !isLive && hasSearched && !!keyword;

  const {
    data: dbData,
    isLoading: dbLoading,
    isFetching: dbFetching,
  } = useListProductsQuery(dbQueryParams, { skip: !shouldQueryDb });

  // Live mode
  const [triggerLiveSearch] = useTriggerLiveSearchMutation();
  const { status, pagesDone, productsScraped, products: liveProducts, errorLog, isPolling } =
    usePolling(isLive ? cacheId : null);

  const handleSearch = useCallback(
    async (kw: string) => {
      setKeyword(kw);
      setHasSearched(true);
      setPage(0);
      addSearch(kw, filters.marketplace);

      if (isLive) {
        try {
          const result = await triggerLiveSearch({
            keyword: kw,
            marketplace: filters.marketplace,
            product_type: filters.product_type || undefined,
            hide_official_brands: filters.hide_official_brands || undefined,
          }).unwrap();
          setCacheId(result.data.cache_id);
        } catch {
          // Error handled by RTK Query
        }
      }
    },
    [isLive, filters, addSearch, triggerLiveSearch],
  );

  const handleRecentClick = useCallback(
    (kw: string, mp: string) => {
      setFilter('marketplace', mp);
      handleSearch(kw);
    },
    [setFilter, handleSearch],
  );

  const handleRetry = useCallback(() => {
    if (keyword) handleSearch(keyword);
  }, [keyword, handleSearch]);

  const handleSortChange = useCallback(
    (sortBy: string) => {
      setFilter('sort_by', sortBy);
      setPage(0);
    },
    [setFilter],
  );

  const handleFilterChange = useCallback(
    <K extends keyof ResearchFilters>(key: K, value: ResearchFilters[K]) => {
      setFilter(key, value);
      if (key !== 'sort_by') setPage(0);
    },
    [setFilter],
  );

  // Determine displayed products
  const products = isLive
    ? liveProducts
    : dbData?.results ?? [];
  const totalCount = isLive ? liveProducts.length : (dbData?.count ?? 0);
  const loading = isLive ? isPolling : dbLoading || dbFetching;

  return (
    <Box>
      <Stack direction="row" alignItems="baseline" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4">Amazon Research</Typography>
        <Typography variant="body2" color="text.secondary">
          {isLive ? 'Live Research' : 'DB Research'}
        </Typography>
      </Stack>

      <SearchBar
        isLive={isLive}
        onToggleMode={toggleMode}
        keyword={keyword}
        marketplace={filters.marketplace}
        onKeywordChange={setKeyword}
        onSearch={handleSearch}
        recentSearches={searches}
        onRecentClick={handleRecentClick}
        onRecentRemove={removeSearch}
      />

      <ControlsRow
        isLive={isLive}
        filters={filters}
        onFilterChange={handleFilterChange}
        advancedOpen={advancedOpen}
        onToggleAdvanced={() => setAdvancedOpen(!advancedOpen)}
        activeFilterCount={activeFilterCount}
      />

      <AdvancedOptionsPanel
        open={advancedOpen}
        isLive={isLive}
        filters={filters}
        enabled={enabled}
        onFilterChange={handleFilterChange}
        onEnabledChange={setEnabled}
      />

      {isLive && (
        <LiveProgressBanner
          status={status}
          pagesDone={pagesDone}
          productsScraped={productsScraped}
          errorLog={errorLog}
          onRetry={handleRetry}
        />
      )}

      {hasSearched && (
        <ResultsToolbar
          count={totalCount}
          keyword={keyword}
          isLive={isLive}
          layout={layout}
          onLayoutChange={setLayout}
          products={products}
          filters={filters}
        />
      )}

      {loading && !hasSearched && (
        <Stack spacing={2} sx={{ mt: 2 }}>
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
          ))}
        </Stack>
      )}

      {!hasSearched && <EmptyState mode={mode} hasSearched={false} />}

      {hasSearched && !loading && products.length === 0 && (
        <EmptyState
          mode={mode}
          hasSearched={true}
          onSwitchToLive={!isLive ? toggleMode : undefined}
        />
      )}

      {hasSearched && products.length > 0 && (
        <>
          {layout === 'grid' ? (
            <ProductGrid products={products} keyword={keyword} />
          ) : (
            <ProductTable
              products={products}
              keyword={keyword}
              count={totalCount}
              page={page}
              pageSize={50}
              onPageChange={setPage}
              onSortChange={handleSortChange}
              loading={loading}
            />
          )}

          {!isLive && totalCount > 50 && (
            <TablePagination
              component="div"
              count={totalCount}
              page={page}
              rowsPerPage={50}
              rowsPerPageOptions={[50]}
              onPageChange={(_, newPage) => setPage(newPage)}
              sx={{ mt: 2 }}
            />
          )}
        </>
      )}
    </Box>
  );
};

export default AmazonResearchView;
