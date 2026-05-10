import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
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
import { useCreateNicheMutation, useGetNicheQuery } from '../../../store/nicheSlice';
import {
  useGetCollectedProductsQuery,
  useCollectProductMutation,
  useRemoveCollectedProductMutation,
} from '../../../store/collectedProductsSlice';
import { useAddKeywordMutation } from '../../../store/keywordSlice';
import useResearchMode from './hooks/useResearchMode';
import useFilterState from './hooks/useFilterState';
import useUserSearchHistory from '@/hooks/useUserSearchHistory';
import { SearchHistoryChips } from '@/components/SearchHistory/SearchHistoryChips';
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
  const [searchParams, setSearchParams] = useSearchParams();

  const { filters, enabled, setFilter, setEnabled, resetFilters, activeFilterCount } =
    useFilterState();
  const { mode, isLive, toggleMode } = useResearchMode(resetFilters);
  const { searches, addSearch, removeSearch, clearAll: clearRecentSearches } =
    useUserSearchHistory('amazon_research');

  const [keyword, setKeyword] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [cacheId, setCacheId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ResultsTab>('products');

  // "Save as Niche" dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // Track extracted slogans per session
  const [extractedAsins, setExtractedAsins] = useState<Set<string>>(new Set());
  const [extractingAsin, setExtractingAsin] = useState<string | null>(null);
  const [extractSlogan] = useExtractSloganMutation();
  const [createNiche, { isLoading: creatingNiche }] = useCreateNicheMutation();

  // Add-to-niche-list state — keyword is added to the active pipeline niche
  // (chatBar.activeNicheId), NOT the auto-matched niche from the search keyword.
  const [addKeywordMutation] = useAddKeywordMutation();
  const [addedToNicheKeywords, setAddedToNicheKeywords] = useState<Set<string>>(new Set());
  const pipelineNicheId = useAppSelector((state) => state.chatBar.activeNicheId);
  const { data: pipelineNiche } = useGetNicheQuery(pipelineNicheId ?? '', {
    skip: !pipelineNicheId,
  });
  const pipelineNicheName = pipelineNiche?.name ?? '';

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

  // Pre-fill keyword from URL param (?keyword=...) on mount.
  // Does NOT auto-trigger search — only fills the input. Param is consumed
  // (removed from URL) so a refresh doesn't re-apply the keyword.
  useEffect(() => {
    const kw = searchParams.get('keyword');
    if (kw) {
      setKeyword(kw);
      setSearchParams({}, { replace: true });
    }
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

  // AC-64/AC-66 (filter-only search): keyword is optional. marketplace +
  // product_type + sort are always-applied parameters — sufficient on their own.
  // Both LIVE and DB modes feed the DB list endpoint; the live scrape merely
  // populates the same DB rows in the background.
  const shouldQueryDb = hasSearched;

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
    refreshFirstPage: refreshDbFirstPage,
  } = useDbInfiniteScroll({
    buildBaseParams: buildQueryParams,
    enabled: shouldQueryDb,
    resetKey: dbResetKey,
  });

  // Live mode — single backend ScrapeJob (up to 10 pages) per Search click.
  const [triggerLiveSearch] = useTriggerLiveSearchMutation();
  const [cancelLiveSearch] = useCancelLiveSearchMutation();
  const { status, productsScraped, errorLog, isPolling } = usePolling(
    isLive ? cacheId : null,
  );

  // Fetch extended status for keyword results (statistics)
  const { data: extendedStatus } = usePollSearchStatusExtendedQuery(cacheId ?? '', {
    skip: !cacheId || isPolling,
  });

  const keywordResults: SearchKeywordResult | undefined =
    extendedStatus?.keyword_result ?? undefined;

  // While the live scrape is running, periodically pull page-1 of the DB list
  // in additive mode so freshly-stored products surface in real time without
  // resetting the user's scroll position. Backend writes products to DB as
  // each page is parsed, so this picks them up incrementally.
  const REFRESH_INTERVAL_MS = 3000;
  useEffect(() => {
    if (!isLive || !isPolling) return;
    const interval = setInterval(() => {
      refreshDbFirstPage();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isLive, isPolling, refreshDbFirstPage]);

  // One last refresh when the scrape transitions to a terminal state so the
  // grid reflects the final batch of products written by the spider.
  useEffect(() => {
    if (!isLive) return;
    if (status === 'completed' || status === 'cancelled') {
      refreshDbFirstPage();
    }
  }, [isLive, status, refreshDbFirstPage]);

  const handleSearch = useCallback(
    async (kw: string) => {
      setKeyword(kw);
      setHasSearched(true);
      addSearch(kw, filters.marketplace);

      if (isLive) {
        try {
          const result = await triggerLiveSearch({
            keyword: kw,
            marketplace: filters.marketplace,
            product_type: filters.product_type || undefined,
            hide_official_brands: filters.hide_official_brands || undefined,
            sort_by: filters.live_sort_by || undefined,
            price_min: 13,
            price_max: 100,
            browse_node: PRODUCT_TYPE_BROWSE_NODES[filters.product_type] || undefined,
          }).unwrap();
          setCacheId(result.cache_id);
        } catch {
          // RTK Query handles error toasts via base query
        }
      }
    },
    [isLive, filters, addSearch, triggerLiveSearch],
  );

  // Recent chip click: fill input (via parent keyword prop) + set marketplace,
  // do NOT trigger search. SearchBar's local inputValue mirrors the keyword prop
  // via useEffect, so the parent must update keyword for the chip text to appear.
  const handleRecentClick = useCallback(
    (kw: string, mp: string) => {
      setFilter('marketplace', mp);
      setKeyword(kw);
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

  // Copy suggestion keyword to clipboard
  const handleCopyKeyword = useCallback(
    (kw: string) => {
      navigator.clipboard.writeText(kw).then(
        () =>
          enqueueSnackbar(t('amazonResearch.searchBar.copied'), {
            variant: 'success',
          }),
        () =>
          enqueueSnackbar(t('amazonResearch.searchBar.copyFailed'), {
            variant: 'error',
          }),
      );
    },
    [enqueueSnackbar, t],
  );

  // Add suggestion keyword as a keyword to the active pipeline niche
  // (chatBar.activeNicheId). When no pipeline niche is active, warn the user.
  const handleAddToNicheList = useCallback(
    async (kw: string) => {
      if (!pipelineNicheId) {
        enqueueSnackbar(t('amazonResearch.searchBar.noActiveNiche'), {
          variant: 'warning',
        });
        return;
      }
      try {
        await addKeywordMutation({
          nicheId: pipelineNicheId,
          body: { keyword: kw, source: 'amazon_search' },
        }).unwrap();
        setAddedToNicheKeywords((prev) => new Set(prev).add(kw));
        enqueueSnackbar(
          t('amazonResearch.searchBar.addedToNicheList', {
            keyword: kw,
            niche: pipelineNicheName,
          }),
          { variant: 'success' },
        );
      } catch (err) {
        const e = err as { status?: number };
        if (e?.status === 409) {
          setAddedToNicheKeywords((prev) => new Set(prev).add(kw));
          enqueueSnackbar(
            t('amazonResearch.searchBar.alreadyInNicheList', {
              keyword: kw,
              niche: pipelineNicheName,
            }),
            { variant: 'info' },
          );
        } else {
          enqueueSnackbar(
            t('amazonResearch.searchBar.addToNicheListFailed'),
            { variant: 'error' },
          );
        }
      }
    },
    [pipelineNicheId, pipelineNicheName, addKeywordMutation, enqueueSnackbar, t],
  );

  // Create a new niche row from a suggestion keyword (separate from the
  // keyword-bank flow above — this adds a niche, not a keyword).
  const handleCreateNicheFromKeyword = useCallback(
    async (kw: string) => {
      try {
        await createNiche({ name: kw }).unwrap();
        enqueueSnackbar(
          t('amazonResearch.searchBar.nicheCreated', { keyword: kw }),
          { variant: 'success' },
        );
      } catch (err) {
        const e = err as { status?: number };
        if (e?.status === 409) {
          enqueueSnackbar(
            t('amazonResearch.searchBar.nicheAlreadyExists', { keyword: kw }),
            { variant: 'info' },
          );
        } else {
          enqueueSnackbar(t('amazonResearch.searchBar.nicheCreateFailed'), {
            variant: 'error',
          });
        }
      }
    },
    [createNiche, enqueueSnackbar, t],
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

  // Both modes display DB-stored products. Live scrapes populate the same
  // table in the background; the periodic page-1 refresh above keeps the grid
  // in sync.
  const products = dbProducts;
  const totalCount = dbTotalCount;
  const loading = dbLoading;

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
        matchedNiche={matchedNiche}
        hasSearched={hasSearched}
        onNicheIndicatorClick={handleNicheIndicatorClick}
        isSearching={isLive && (status === 'pending' || status === 'running')}
        onCancel={handleCancel}
        onCopyKeyword={handleCopyKeyword}
        onAddToNicheList={handleAddToNicheList}
        onCreateNicheFromKeyword={handleCreateNicheFromKeyword}
        addedKeywords={addedToNicheKeywords}
        allowEmptyKeyword={!isLive}
      />

      <SearchHistoryChips
        searches={searches}
        onSelect={handleRecentClick}
        onRemove={removeSearch}
        onClearAll={clearRecentSearches}
        i18nNamespace="amazonResearch.searchHistory"
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

      {hasSearched && (
        <ResultsToolbar
          count={totalCount}
          keyword={keyword}
          layout={layout}
          onLayoutChange={setLayout}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          activeFilterSummary={activeFilterSummary}
        />
      )}

      {isLive && (
        <LiveProgressBanner
          status={status}
          productsScraped={productsScraped}
          errorLog={errorLog}
          onRetry={handleRetry}
          loadedCount={dbProducts.length}
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
              onEndReached={loadNextDbPage}
              isFetchingNext={dbFetchingNext}
              hasMore={dbHasMore}
            />
          ) : (
            <ProductTable
              products={products}
              count={totalCount}
              onSortChange={handleSortChange}
              loading={loading}
              onEndReached={loadNextDbPage}
            />
          )}

          {/* List-view skeleton footer while the next DB page loads */}
          {layout === 'list' && dbFetchingNext && (
            <Stack alignItems="center" sx={{ py: 3 }}>
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('amazonResearch.infiniteScroll.loadingMore', 'Loading more products...')}
              </Typography>
            </Stack>
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
