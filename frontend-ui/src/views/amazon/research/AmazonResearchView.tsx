import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Skeleton,
  Stack,
  TablePagination,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useListProductsQuery,
  useTriggerLiveSearchMutation,
  usePollSearchStatusExtendedQuery,
} from '../../../store/researchSlice';
import { useExtractSloganMutation } from '../../../store/ideaSlice';
import { useCreateNicheMutation } from '../../../store/nicheSlice';
import {
  useGetCollectedProductsQuery,
  useCollectProductMutation,
  useRemoveCollectedProductMutation,
} from '../../../store/collectedProductsSlice';
import useResearchMode from './hooks/useResearchMode';
import useFilterState from './hooks/useFilterState';
import useRecentSearches from './hooks/useRecentSearches';
import usePolling from './hooks/usePolling';
import useActiveNiche from './hooks/useActiveNiche';
import type { ResearchFilters, SearchKeywordResult, AmazonProduct } from './types';
import type { ResultsTab } from './partials/ResultsToolbar';
import SearchBar from './partials/SearchBar';
import ControlsRow from './partials/ControlsRow';
import AdvancedOptionsPanel from './partials/AdvancedOptionsPanel';
import ResultsToolbar from './partials/ResultsToolbar';
import ProductGrid from './partials/ProductGrid';
import ProductTable from './partials/ProductTable';
import LiveProgressBanner from './partials/LiveProgressBanner';
import EmptyState from './partials/EmptyState';
import StatisticsView from './partials/StatisticsView';
import { NicheDetailDrawer } from '../../niches/list/partials/NicheDetailDrawer';

const STORAGE_MARKETPLACE_KEY = 'mm-research-marketplace';

const getInitialMarketplace = (): string =>
  localStorage.getItem(STORAGE_MARKETPLACE_KEY) ?? 'amazon_com';

const AmazonResearchView = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

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
  const [activeTab, setActiveTab] = useState<ResultsTab>('products');

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);

  // "Save as Niche" dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // Track extracted slogans per session
  const [extractedAsins, setExtractedAsins] = useState<Set<string>>(new Set());
  const [extractingAsin, setExtractingAsin] = useState<string | null>(null);
  const [extractSlogan] = useExtractSloganMutation();
  const [createNiche, { isLoading: creatingNiche }] = useCreateNicheMutation();

  // Auto-detect niche from searched keyword
  const { matchedNiche } = useActiveNiche(keyword);
  const activeNicheId = matchedNiche?.id ?? null;

  // Backend-persisted collected products for active niche
  const { data: collectedData } = useGetCollectedProductsQuery(activeNicheId ?? '', {
    skip: !activeNicheId,
  });
  const [collectProductMutation] = useCollectProductMutation();
  const [removeCollectedProductMutation] = useRemoveCollectedProductMutation();

  // Build favorite ASINs set from collected products (backend data)
  const favoriteAsins = useMemo(() => {
    const results = collectedData?.results;
    if (!activeNicheId || !results || results.length === 0) return new Set<string>();
    return new Set(results.map((cp: { product: { asin: string } }) => cp.product.asin));
  }, [activeNicheId, collectedData]);

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

  // Fetch extended status for keyword results (statistics)
  const { data: extendedStatus } = usePollSearchStatusExtendedQuery(cacheId ?? '', {
    skip: !cacheId || isPolling,
  });

  const keywordResults: SearchKeywordResult | undefined =
    extendedStatus?.keyword_result ?? undefined;

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
          setCacheId(result.cache_id);
        } catch {
          // Error handled by RTK Query
        }
      }
    },
    [isLive, filters, addSearch, triggerLiveSearch],
  );

  // Recent chip click: only fill input + set marketplace, do NOT trigger search
  const handleRecentClick = useCallback(
    (kw: string, mp: string) => {
      setFilter('marketplace', mp);
      // keyword state is set by SearchBar via setInputValue;
      // we only sync the marketplace here
    },
    [setFilter],
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

  const handleKeywordClick = useCallback(
    (kw: string) => {
      setActiveTab('products');
      setKeyword(kw);
      handleSearch(kw);
    },
    [handleSearch],
  );

  // Niche indicator click handler
  const handleNicheIndicatorClick = useCallback(() => {
    if (matchedNiche) {
      setDrawerOpen(true);
    } else {
      setSaveDialogOpen(true);
    }
  }, [matchedNiche]);

  // Save keyword as new niche
  const handleSaveAsNiche = useCallback(async () => {
    if (!keyword) return;
    try {
      await createNiche({ name: keyword }).unwrap();
      enqueueSnackbar(
        t('amazonResearch.niche.created', { name: keyword }),
        { variant: 'success' },
      );
      setSaveDialogOpen(false);
    } catch {
      enqueueSnackbar(t('amazonResearch.niche.createError'), { variant: 'error' });
    }
  }, [keyword, createNiche, enqueueSnackbar, t]);

  // Double-click on card opens drawer
  const handleCardDoubleClick = useCallback(() => {
    if (!activeNicheId) {
      enqueueSnackbar(t('amazonResearch.niche.notSaved'), { variant: 'warning' });
      return;
    }
    setDrawerOpen(true);
  }, [activeNicheId, enqueueSnackbar, t]);

  // Toggle favorite (collect/remove product via backend API)
  const handleToggleFavorite = useCallback(
    async (product: AmazonProduct) => {
      if (!activeNicheId) {
        enqueueSnackbar(t('amazonResearch.niche.notSaved'), { variant: 'warning' });
        return;
      }
      const isCurrentlyFavorite = favoriteAsins.has(product.asin);
      if (isCurrentlyFavorite) {
        // Find the collected product ID to remove
        const collectedProduct = collectedData?.results?.find(
          (cp: { product: { asin: string } }) => cp.product.asin === product.asin,
        );
        if (collectedProduct) {
          try {
            await removeCollectedProductMutation({
              nicheId: activeNicheId,
              collectedProductId: collectedProduct.id,
            }).unwrap();
          } catch {
            enqueueSnackbar(t('amazonResearch.favorite.removeError'), { variant: 'error' });
          }
        }
      } else {
        try {
          await collectProductMutation({
            nicheId: activeNicheId,
            asin: product.asin,
            marketplace: product.marketplace,
          }).unwrap();
          enqueueSnackbar(
            t('amazonResearch.favorite.added', { niche: matchedNiche?.name ?? '' }),
            { variant: 'success' },
          );
        } catch {
          enqueueSnackbar(t('amazonResearch.favorite.addError'), { variant: 'error' });
        }
      }
    },
    [
      activeNicheId,
      matchedNiche,
      favoriteAsins,
      collectedData,
      collectProductMutation,
      removeCollectedProductMutation,
      enqueueSnackbar,
      t,
    ],
  );

  // AI extract slogan
  const handleExtractSlogan = useCallback(
    async (product: AmazonProduct) => {
      if (!activeNicheId) {
        enqueueSnackbar(t('amazonResearch.niche.notSaved'), { variant: 'warning' });
        return;
      }
      if (!product.thumbnail_url) {
        enqueueSnackbar(t('amazonResearch.extract.noImage'), { variant: 'warning' });
        return;
      }
      setExtractingAsin(product.asin);
      try {
        const result = await extractSlogan({
          product_image_url: product.thumbnail_url,
          product_title: product.title,
          product_brand: product.brand,
        }).unwrap();
        setExtractedAsins((prev) => new Set(prev).add(product.asin));
        enqueueSnackbar(
          t('amazonResearch.extract.success', { slogan: result.slogan_text }),
          { variant: 'success' },
        );
      } catch {
        enqueueSnackbar(t('amazonResearch.extract.error'), { variant: 'error' });
      } finally {
        setExtractingAsin(null);
      }
    },
    [activeNicheId, extractSlogan, enqueueSnackbar, t],
  );

  // Determine displayed products
  const products = isLive ? liveProducts : dbData?.results ?? [];
  const totalCount = isLive ? liveProducts.length : (dbData?.count ?? 0);
  const loading = isLive ? isPolling : dbLoading || dbFetching;

  return (
    <Box>
      <Stack direction="row" alignItems="baseline" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4">Amazon Research</Typography>
        {isLive && (
          <Typography variant="body2" color="text.secondary">
            Live Research
          </Typography>
        )}
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
        matchedNiche={matchedNiche}
        hasSearched={hasSearched}
        onNicheIndicatorClick={handleNicheIndicatorClick}
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
          showSkeletons={true}
          loadedCount={liveProducts.length}
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
          buildQueryParams={buildQueryParams}
          activeTab={activeTab}
          onTabChange={setActiveTab}
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

      {/* Statistics/Keywords tab */}
      {hasSearched && activeTab === 'keywords' && (
        <StatisticsView
          keywordResults={keywordResults}
          hasSearched={hasSearched}
          onKeywordClick={handleKeywordClick}
        />
      )}

      {/* Products tab */}
      {hasSearched && activeTab === 'products' && !loading && products.length === 0 && (
        <EmptyState
          mode={mode}
          hasSearched={true}
          onSwitchToLive={!isLive ? toggleMode : undefined}
        />
      )}

      {hasSearched && activeTab === 'products' && products.length > 0 && (
        <>
          {layout === 'grid' ? (
            <ProductGrid
              products={products}
              favoriteAsins={favoriteAsins}
              extractedAsins={extractedAsins}
              extractingAsin={extractingAsin}
              onToggleFavorite={handleToggleFavorite}
              onExtractSlogan={handleExtractSlogan}
              onDoubleClick={handleCardDoubleClick}
            />
          ) : (
            <ProductTable
              products={products}
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

      {/* Niche Detail Drawer */}
      <NicheDetailDrawer
        open={drawerOpen && !!activeNicheId}
        mode="edit"
        selectedId={activeNicheId}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Save as Niche Dialog */}
      <Dialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('amazonResearch.niche.saveDialogTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('amazonResearch.niche.saveDialogText', { keyword })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>
            {t('amazonResearch.niche.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveAsNiche}
            disabled={creatingNiche}
          >
            {t('amazonResearch.niche.saveAsNiche')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AmazonResearchView;
