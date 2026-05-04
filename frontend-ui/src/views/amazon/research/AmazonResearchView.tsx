import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { openNicheEdit } from '@/store/chatBarSlice';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useTriggerLiveSearchMutation,
  usePollSearchStatusExtendedQuery,
  useCancelLiveSearchMutation,
} from '../../../store/researchSlice';
import { useExtractSloganMutation } from '../../../store/ideaSlice';
import { useCreateNicheMutation } from '../../../store/nicheSlice';
import {
  useGetCollectedProductsQuery,
  useCollectProductMutation,
  useRemoveCollectedProductMutation,
} from '../../../store/collectedProductsSlice';
import { useAddKeywordMutation } from '../../../store/keywordSlice';
import useResearchMode from './hooks/useResearchMode';
import useFilterState from './hooks/useFilterState';
import useRecentSearches from './hooks/useRecentSearches';
import usePolling from './hooks/usePolling';
import useActiveNiche from './hooks/useActiveNiche';
import useDbInfiniteScroll from './hooks/useDbInfiniteScroll';
import { LIVE_SORT_OPTIONS, PRODUCT_TYPE_BROWSE_NODES } from './types';
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

const STORAGE_MARKETPLACE_KEY = 'mm-research-marketplace';

const getInitialMarketplace = (): string =>
  localStorage.getItem(STORAGE_MARKETPLACE_KEY) ?? 'amazon_com';

const AmazonResearchView = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();

  const { filters, enabled, setFilter, setEnabled, resetFilters, activeFilterCount } =
    useFilterState();
  const { mode, isLive, toggleMode } = useResearchMode(resetFilters);
  const { searches, addSearch, removeSearch } = useRecentSearches();

  const [keyword, setKeyword] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [cacheId, setCacheId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ResultsTab>('products');

  // Infinite scroll state (live mode)
  const [currentPage, setCurrentPage] = useState(1);
  const [allLiveProducts, setAllLiveProducts] = useState<AmazonProduct[]>([]);
  const [canLoadMore, setCanLoadMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // "Save as Niche" dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // Track extracted slogans per session
  const [extractedAsins, setExtractedAsins] = useState<Set<string>>(new Set());
  const [extractingAsin, setExtractingAsin] = useState<string | null>(null);
  const [extractSlogan] = useExtractSloganMutation();
  const [createNiche, { isLoading: creatingNiche }] = useCreateNicheMutation();

  // Keyword save state (AC-21)
  const [addKeywordMutation] = useAddKeywordMutation();
  const [savingKeywords, setSavingKeywords] = useState<Set<string>>(new Set());
  const [savedKeywords, setSavedKeywords] = useState<Set<string>>(new Set());

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

  // DB mode query params (paginated fields owned by useDbInfiniteScroll)
  const buildQueryParams = useCallback(() => {
    const params: Record<string, unknown> = {
      keyword,
      marketplace: filters.marketplace,
      sort_by: filters.sort_by,
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
  }, [keyword, filters, enabled]);

  // AC-64/AC-66 (filter-only search): in DB mode the keyword is optional.
  // marketplace + product_type + sort are always-applied parameters — sufficient on their own.
  const shouldQueryDb = !isLive && hasSearched;

  // Stable signature: any change here resets the infinite scroll + triggers page-1 fetch.
  const dbResetKey = useMemo(
    () => JSON.stringify(buildQueryParams()),
    [buildQueryParams],
  );

  const {
    products: dbProducts,
    totalCount: dbTotalCount,
    isLoadingInitial: dbLoading,
    isFetchingNext: dbFetchingNext,
    hasMore: dbHasMore,
    loadNextPage: loadNextDbPage,
  } = useDbInfiniteScroll({
    buildBaseParams: buildQueryParams,
    enabled: shouldQueryDb,
    resetKey: dbResetKey,
  });

  // Live mode
  const [triggerLiveSearch] = useTriggerLiveSearchMutation();
  const [cancelLiveSearch] = useCancelLiveSearchMutation();
  const { status, productsScraped, products: liveProducts, errorLog, isPolling } =
    usePolling(isLive ? cacheId : null);

  // Fetch extended status for keyword results (statistics)
  const { data: extendedStatus } = usePollSearchStatusExtendedQuery(cacheId ?? '', {
    skip: !cacheId || isPolling,
  });

  const keywordResults: SearchKeywordResult | undefined =
    extendedStatus?.keyword_result ?? undefined;

  // Accumulate live products when a page completes
  useEffect(() => {
    if (status === 'completed' && liveProducts.length > 0) {
      setAllLiveProducts((prev) => {
        // Deduplicate by ASIN
        const existingAsins = new Set(prev.map((p) => p.asin));
        const newProducts = liveProducts.filter((p) => !existingAsins.has(p.asin));
        if (newProducts.length === 0) {
          setCanLoadMore(false);
          return prev;
        }
        setCanLoadMore(true);
        return [...prev, ...newProducts];
      });
    } else if (status === 'completed' && liveProducts.length === 0) {
      setCanLoadMore(false);
    }
  }, [status, liveProducts]);

  // Trigger a live search for a given page
  const triggerLivePage = useCallback(
    async (kw: string, startPage: number) => {
      const browseNode = PRODUCT_TYPE_BROWSE_NODES[filters.product_type] || undefined;
      try {
        const result = await triggerLiveSearch({
          keyword: kw,
          marketplace: filters.marketplace,
          product_type: filters.product_type || undefined,
          hide_official_brands: filters.hide_official_brands || undefined,
          sort_by: filters.live_sort_by || undefined,
          price_min: 13,
          price_max: 100,
          browse_node: browseNode,
          pages_total: 1,
          start_page: startPage,
        }).unwrap();
        setCacheId(result.cache_id);
      } catch {
        // Error handled by RTK Query
      }
    },
    [filters, triggerLiveSearch],
  );

  // IntersectionObserver for infinite scroll sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          entry.isIntersecting &&
          isLive &&
          status === 'completed' &&
          canLoadMore &&
          !isPolling
        ) {
          const nextPage = currentPage + 1;
          setCurrentPage(nextPage);
          setCanLoadMore(false);
          triggerLivePage(keyword, nextPage);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isLive, status, canLoadMore, isPolling, currentPage, keyword, triggerLivePage]);

  const handleSearch = useCallback(
    async (kw: string) => {
      setKeyword(kw);
      setHasSearched(true);
      addSearch(kw, filters.marketplace);

      if (isLive) {
        // Reset infinite scroll state for new keyword
        setCurrentPage(1);
        setAllLiveProducts([]);
        setCanLoadMore(false);
        await triggerLivePage(kw, 1);
      }
    },
    [isLive, filters.marketplace, addSearch, triggerLivePage],
  );

  // Recent chip click: only fill input + set marketplace, do NOT trigger search
  const handleRecentClick = useCallback(
    (_kw: string, mp: string) => {
      setFilter('marketplace', mp);
      // keyword state is set by SearchBar via setInputValue;
      // we only sync the marketplace here
    },
    [setFilter],
  );

  const handleRetry = useCallback(() => {
    if (keyword) handleSearch(keyword);
  }, [keyword, handleSearch]);

  const handleCancel = useCallback(async () => {
    if (!cacheId) return;
    try {
      await cancelLiveSearch(cacheId).unwrap();
    } catch {
      // Best-effort cancel
    }
    setCacheId(null);
    setCanLoadMore(false);
    enqueueSnackbar(t('amazonResearch.searchCancelled', 'Search cancelled'), {
      variant: 'info',
    });
  }, [cacheId, cancelLiveSearch, enqueueSnackbar, t]);

  const handleSortChange = useCallback(
    (sortBy: string) => {
      setFilter('sort_by', sortBy);
    },
    [setFilter],
  );

  const handleFilterChange = useCallback(
    <K extends keyof ResearchFilters>(key: K, value: ResearchFilters[K]) => {
      setFilter(key, value);
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

  // Save autocomplete suggestion to keyword bank (AC-21)
  const handleSaveKeyword = useCallback(
    async (kw: string) => {
      if (!activeNicheId) return;
      setSavingKeywords((prev) => new Set(prev).add(kw));
      try {
        await addKeywordMutation({
          nicheId: activeNicheId,
          body: { keyword: kw, source: 'amazon_search' },
        }).unwrap();
        setSavedKeywords((prev) => new Set(prev).add(kw));
        enqueueSnackbar(
          t('amazonResearch.keyword.saved', { keyword: kw, niche: matchedNiche?.name ?? '' }),
          { variant: 'success' },
        );
      } catch (err) {
        const error = err as { status?: number };
        if (error?.status === 409) {
          setSavedKeywords((prev) => new Set(prev).add(kw));
          enqueueSnackbar(
            t('amazonResearch.keyword.duplicate', { keyword: kw }),
            { variant: 'info' },
          );
        } else {
          enqueueSnackbar(
            t('amazonResearch.keyword.saveFailed'),
            { variant: 'error' },
          );
        }
      } finally {
        setSavingKeywords((prev) => {
          const next = new Set(prev);
          next.delete(kw);
          return next;
        });
      }
    },
    [activeNicheId, matchedNiche, addKeywordMutation, enqueueSnackbar, t],
  );

  // Niche indicator click handler
  const handleNicheIndicatorClick = useCallback(() => {
    if (matchedNiche) {
      dispatch(openNicheEdit(matchedNiche.id));
    } else {
      setSaveDialogOpen(true);
    }
  }, [dispatch, matchedNiche]);

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
    dispatch(openNicheEdit(activeNicheId));
  }, [activeNicheId, dispatch, enqueueSnackbar, t]);

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
  const products = isLive ? allLiveProducts : dbProducts;
  const totalCount = isLive ? allLiveProducts.length : dbTotalCount;
  const loading = isLive ? (isPolling && allLiveProducts.length === 0) : dbLoading;

  // Build active filter summary for results header
  const activeFilterSummary = useMemo(() => {
    if (!isLive) return '';
    const parts: string[] = [];
    if (filters.live_sort_by) {
      const sortOpt = LIVE_SORT_OPTIONS.find((o) => o.value === filters.live_sort_by);
      if (sortOpt) parts.push(sortOpt.label);
    }
    return parts.length > 0 ? `· ${parts.join(' · ')}` : '';
  }, [isLive, filters.live_sort_by]);

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
        isSearching={isLive && (status === 'pending' || status === 'running')}
        onCancel={handleCancel}
        onSaveKeyword={activeNicheId ? handleSaveKeyword : undefined}
        savingKeywords={savingKeywords}
        savedKeywords={savedKeywords}
        allowEmptyKeyword={!isLive}
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
        onFilterChange={handleFilterChange}
        onEnabledChange={setEnabled}
      />

      {isLive && (
        <LiveProgressBanner
          status={status}
          productsScraped={productsScraped}
          errorLog={errorLog}
          onRetry={handleRetry}
          loadedCount={allLiveProducts.length}
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
          activeFilterSummary={activeFilterSummary}
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
              onEndReached={!isLive ? loadNextDbPage : undefined}
              isFetchingNext={!isLive && dbFetchingNext}
              hasMore={!isLive && dbHasMore}
            />
          ) : (
            <ProductTable
              products={products}
              count={totalCount}
              onSortChange={handleSortChange}
              loading={loading}
              onEndReached={!isLive ? loadNextDbPage : undefined}
            />
          )}

          {/* DB-mode list-view skeleton footer while next page loads */}
          {!isLive && layout === 'list' && dbFetchingNext && (
            <Stack alignItems="center" sx={{ py: 3 }}>
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('amazonResearch.infiniteScroll.loadingMore', 'Loading more products...')}
              </Typography>
            </Stack>
          )}

          {/* Infinite scroll sentinel + loading indicator (live mode) */}
          {isLive && (
            <>
              {isPolling && allLiveProducts.length > 0 && (
                <Stack alignItems="center" sx={{ py: 3 }}>
                  <CircularProgress size={28} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Loading more products (page {currentPage})...
                  </Typography>
                </Stack>
              )}
              <Box
                ref={sentinelRef}
                data-testid="infinite-scroll-sentinel"
                sx={{ height: 1, width: '100%' }}
                aria-hidden="true"
              />
            </>
          )}
        </>
      )}

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
