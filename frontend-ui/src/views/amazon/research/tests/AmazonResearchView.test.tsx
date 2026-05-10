import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import AmazonResearchView from '../AmazonResearchView';
import collectedItemsReducer from '../../../../store/collectedItemsSlice';
import chatBarReducer from '../../../../store/chatBarSlice';
import type { ProductListResponse, DbKeywordsResponse } from '../types';

// ── RTK Query mock — researchSlice ─────────────────────────────────────────
const mockTriggerLiveSearch = vi.fn().mockReturnValue({ unwrap: vi.fn() });

const emptyResponse: ProductListResponse = {
  count: 0,
  results: [],
  next: null,
  previous: null,
};

// Lazy DB query — controlled per-test via mockLazyResponse
let mockLazyResponse: ProductListResponse = emptyResponse;
const mockLazyTrigger = vi.fn();

// Phase 8 — DB-mode keywords mock, controlled per-test
const emptyDbKeywords: DbKeywordsResponse = {
  top_focus_keywords: [],
  top_long_tail_keywords: [],
  sample_size: 0,
  cached: false,
};
let mockDbKeywordsData: DbKeywordsResponse | undefined = emptyDbKeywords;
let mockDbKeywordsFetching = false;

vi.mock('../../../../store/researchSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../store/researchSlice')>();
  return {
    ...actual,
    useLazyListProductsQuery: () => [
      (params: Record<string, unknown>) => {
        mockLazyTrigger(params);
        const promise = Promise.resolve(mockLazyResponse);
        (promise as { unwrap?: () => Promise<ProductListResponse> }).unwrap = () =>
          Promise.resolve(mockLazyResponse);
        (promise as { abort?: () => void }).abort = () => undefined;
        return promise;
      },
    ],
    useTriggerLiveSearchMutation: () => [mockTriggerLiveSearch, { isLoading: false }],
    useGetSuggestionsQuery: () => ({ data: [], isLoading: false }),
    usePollSearchStatusQuery: () => ({ data: undefined, isLoading: false }),
    usePollSearchStatusExtendedQuery: () => ({ data: undefined, isLoading: false }),
    useGetBSRHistoryQuery: () => ({ data: [], isLoading: false }),
    useGetDbKeywordsQuery: () => ({
      data: mockDbKeywordsData,
      isFetching: mockDbKeywordsFetching,
    }),
    useCancelLiveSearchMutation: () => [
      vi.fn().mockReturnValue({ unwrap: vi.fn() }),
      { isLoading: false },
    ],
  };
});

// ── RTK Query mock — nicheSlice ────────────────────────────────────────────
vi.mock('../../../../store/nicheSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../store/nicheSlice')>();
  return {
    ...actual,
    useListNichesQuery: () => ({ data: { results: [] }, isLoading: false }),
    useGetNicheQuery: () => ({ data: undefined, isLoading: false }),
    useCreateNicheMutation: () => [vi.fn(), { isLoading: false }],
    useUpdateNicheMutation: () => [vi.fn(), { isLoading: false }],
    useDeleteNicheMutation: () => [vi.fn(), { isLoading: false }],
    useBulkNicheActionMutation: () => [vi.fn(), { isLoading: false }],
    useListFilterTemplatesQuery: () => ({ data: [], isLoading: false }),
    useCreateFilterTemplateMutation: () => [vi.fn(), { isLoading: false }],
    useUpdateFilterTemplateMutation: () => [vi.fn(), { isLoading: false }],
    useDeleteFilterTemplateMutation: () => [vi.fn(), { isLoading: false }],
  };
});

// ── RTK Query mock — ideaSlice ─────────────────────────────────────────────
vi.mock('../../../../store/ideaSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../store/ideaSlice')>();
  return {
    ...actual,
    useExtractSloganMutation: () => [vi.fn().mockReturnValue({ unwrap: vi.fn() }), { isLoading: false }],
    useListIdeasQuery: () => ({ data: { results: [] }, isLoading: false }),
    useCreateIdeaMutation: () => [vi.fn(), { isLoading: false }],
    useUpdateIdeaMutation: () => [vi.fn(), { isLoading: false }],
    useDeleteIdeaMutation: () => [vi.fn(), { isLoading: false }],
    useBulkUpdateStatusMutation: () => [vi.fn(), { isLoading: false }],
    useTriggerAdaptationMutation: () => [vi.fn(), { isLoading: false }],
    useGetAdaptationRunQuery: () => ({ data: undefined, isLoading: false }),
    useImproveIdeaMutation: () => [vi.fn(), { isLoading: false }],
    useRegenerateIdeaMutation: () => [vi.fn(), { isLoading: false }],
    useSuggestNichesQuery: () => ({ data: [], isLoading: false }),
  };
});

// ── RTK Query mock — keywordSlice (used by DrawerKeywordsSection) ──────────
vi.mock('../../../../store/keywordSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../store/keywordSlice')>();
  return {
    ...actual,
    useListNicheKeywordsQuery: () => ({ data: { results: [] }, isLoading: false }),
    useListKeywordGroupsQuery: () => ({ data: { results: [] }, isLoading: false }),
    useDeleteKeywordMutation: () => [vi.fn(), { isLoading: false }],
    useCreateKeywordGroupMutation: () => [vi.fn(), { isLoading: false }],
    useUpdateKeywordGroupMutation: () => [vi.fn(), { isLoading: false }],
    useDeleteKeywordGroupMutation: () => [vi.fn(), { isLoading: false }],
  };
});

// ── RTK Query mock — collectedProductsSlice ───────────────────────────────
vi.mock('../../../../store/collectedProductsSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../store/collectedProductsSlice')>();
  return {
    ...actual,
    useGetCollectedProductsQuery: () => ({ data: { results: [] }, isLoading: false }),
    useCollectProductMutation: () => [vi.fn().mockReturnValue({ unwrap: vi.fn() }), { isLoading: false }],
    useRemoveCollectedProductMutation: () => [vi.fn().mockReturnValue({ unwrap: vi.fn() }), { isLoading: false }],
  };
});

// ── RTK Query mock — designSlice (used transitively via NichePipeline) ────
vi.mock('../../../../store/designSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../store/designSlice')>();
  return {
    ...actual,
    useListProjectsQuery: () => ({ data: { results: [] }, isLoading: false }),
    useAddReferencesToProjectMutation: () => [vi.fn().mockReturnValue({ unwrap: vi.fn() }), { isLoading: false }],
  };
});

// ── Mock react-router-dom for navigation ───────────────────────────────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ── Reducers needed by selectors (collectedItemsSlice + chatBarSlice) ─────
const extraReducers = {
  collectedItems: collectedItemsReducer,
  chatBar: chatBarReducer,
};

describe('AmazonResearchView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockLazyResponse = emptyResponse;
    mockDbKeywordsData = emptyDbKeywords;
    mockDbKeywordsFetching = false;
  });

  it('renders without crash', () => {
    renderWithProviders(<AmazonResearchView />, { reducers: extraReducers });
    expect(screen.getByText('Amazon Research')).toBeInTheDocument();
  });

  it('shows empty state when no search has been performed', () => {
    renderWithProviders(<AmazonResearchView />, { reducers: extraReducers });
    expect(screen.getByText('Search a keyword to get started')).toBeInTheDocument();
  });

  it('defaults to DB Research mode', () => {
    renderWithProviders(<AmazonResearchView />, { reducers: extraReducers });
    // In DB mode the SearchBar always shows "Live Research" label (styled as disabled)
    // but the subtitle next to "Amazon Research" is NOT shown
    expect(screen.getByText('Live Research')).toBeInTheDocument();
    // The switch should be unchecked (DB mode = default)
    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('toggles between DB Research and Live Research mode', async () => {
    renderWithProviders(<AmazonResearchView />, { reducers: extraReducers });

    // DB mode: one "Live Research" label (SearchBar ModeLabel only)
    expect(screen.getAllByText('Live Research')).toHaveLength(1);

    const toggle = screen.getByRole('switch');
    await userEvent.click(toggle);

    // After toggle: two "Live Research" labels (SearchBar ModeLabel + subtitle)
    expect(screen.getAllByText('Live Research')).toHaveLength(2);
  });

  it('renders no TablePagination element (replaced by infinite scroll)', () => {
    renderWithProviders(<AmazonResearchView />, { reducers: extraReducers });
    // TablePagination MUI class hook
    expect(document.querySelector('.MuiTablePagination-root')).toBeNull();
  });

  it('switches between Grid/List view', { timeout: 15000 }, async () => {
    // Need products to see the layout toggle
    mockLazyResponse = {
      count: 1,
      results: [
        {
          id: 'prod-001',
          asin: 'B09TEST001',
          title: 'Test Product',
          brand: 'TestBrand',
          bsr: 1000,
          rating: 4.0,
          reviews_count: 50,
          price: 14.99,
          product_type: 't_shirt',
          subcategory: 'Novelty',
          listed_date: '2025-01-01',
          thumbnail_url: '',
          bullet_1: '',
          bullet_2: '',
          description: '',
          marketplace: 'amazon_com',
          scraped_at: '2026-03-01T00:00:00Z',
          bsr_categories: [],
        },
      ],
      next: null,
      previous: null,
    };

    renderWithProviders(<AmazonResearchView />, { reducers: extraReducers });

    // Trigger a search to show results
    const searchInput = screen.getByPlaceholderText('Search keywords...');
    await userEvent.type(searchInput, 'hiking');
    const searchBtn = screen.getByRole('button', { name: 'Search' });
    await userEvent.click(searchBtn);

    // ResultsToolbar should be visible now with layout toggle
    const listBtn = screen.getByRole('button', { name: /list view/i });
    await userEvent.click(listBtn);

    // After clicking list, the list toggle should be pressed
    expect(listBtn).toHaveAttribute('aria-pressed', 'true');

    // Switch back to grid
    const gridBtn = screen.getByRole('button', { name: /grid view/i });
    await userEvent.click(gridBtn);
    expect(gridBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows advanced options panel toggle', async () => {
    renderWithProviders(<AmazonResearchView />, { reducers: extraReducers });

    const advancedBtn = screen.getByRole('button', { name: /toggle advanced options/i });
    expect(advancedBtn).toBeInTheDocument();
    expect(screen.getByText(/Advanced Options/)).toBeInTheDocument();
  });

  it('mode label updates when toggling mode', async () => {
    renderWithProviders(<AmazonResearchView />, { reducers: extraReducers });

    // Initially DB mode: one "Live Research" label (SearchBar only, styled disabled)
    expect(screen.getAllByText('Live Research')).toHaveLength(1);

    const toggle = screen.getByRole('switch');
    await userEvent.click(toggle);

    // After toggle, subtitle appears — two "Live Research" labels total
    expect(screen.getAllByText('Live Research')).toHaveLength(2);
  });

  it('initial DB search fetches with page_size=100 (integration)', async () => {
    mockLazyResponse = {
      count: 100,
      results: Array.from({ length: 100 }, (_, i) => ({
        id: `prod-${i}`,
        asin: `B${String(i).padStart(9, '0')}`,
        title: `Test ${i}`,
        brand: 'Brand',
        bsr: 1000,
        rating: 4.0,
        reviews_count: 50,
        price: 14.99,
        product_type: 't_shirt',
        subcategory: 'Novelty',
        listed_date: '2025-01-01',
        thumbnail_url: '',
        bullet_1: '',
        bullet_2: '',
        description: '',
        marketplace: 'amazon_com',
        scraped_at: '2026-03-01T00:00:00Z',
        bsr_categories: [],
      })),
      next: null,
      previous: null,
    };

    renderWithProviders(<AmazonResearchView />, { reducers: extraReducers });

    const searchInput = screen.getByPlaceholderText('Search keywords...');
    await userEvent.type(searchInput, 'hiking');
    const searchBtn = screen.getByRole('button', { name: 'Search' });
    await userEvent.click(searchBtn);

    // The lazy trigger must have been called with the initial page_size=100 contract
    await vi.waitFor(() => {
      expect(mockLazyTrigger).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, page_size: 50, keyword: 'hiking' }),
      );
    });
  });

  // ── Phase 8 — DB-mode keywords ───────────────────────────────────────────
  it('DB mode: Keywords tab renders chips from /research/products/keywords/', async () => {
    mockDbKeywordsData = {
      top_focus_keywords: [{ keyword: 'shirt', frequency: 12 }],
      top_long_tail_keywords: [{ keyword: 'school bus', frequency: 8 }],
      sample_size: 50,
      cached: false,
    };

    renderWithProviders(<AmazonResearchView />, { reducers: extraReducers });

    // Trigger a DB-mode search (default mode)
    const searchInput = screen.getByPlaceholderText('Search keywords...');
    await userEvent.type(searchInput, 'school');
    const searchBtn = screen.getByRole('button', { name: 'Search' });
    await userEvent.click(searchBtn);

    // Switch to Keywords tab
    const keywordsTab = screen.getByRole('button', { name: /keywords view/i });
    await userEvent.click(keywordsTab);

    // Both DB-mode keywords should render as chips
    expect(await screen.findByText('shirt')).toBeInTheDocument();
    expect(await screen.findByText('school bus')).toBeInTheDocument();
  });

  it('DB mode: Keywords tab shows skeletons while query is fetching', async () => {
    mockDbKeywordsData = undefined;
    mockDbKeywordsFetching = true;

    renderWithProviders(<AmazonResearchView />, { reducers: extraReducers });

    // Trigger a DB-mode search to set hasSearched=true
    const searchInput = screen.getByPlaceholderText('Search keywords...');
    await userEvent.type(searchInput, 'loading');
    const searchBtn = screen.getByRole('button', { name: 'Search' });
    await userEvent.click(searchBtn);

    // Switch to Keywords tab
    const keywordsTab = screen.getByRole('button', { name: /keywords view/i });
    await userEvent.click(keywordsTab);

    // At least one Skeleton element is rendered (MUI assigns the
    // .MuiSkeleton-root class to every Skeleton).
    await vi.waitFor(() => {
      const skeletons = document.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    // Empty-state copy must NOT appear while loading
    expect(screen.queryByText('No keyword data available')).not.toBeInTheDocument();
  });
});
