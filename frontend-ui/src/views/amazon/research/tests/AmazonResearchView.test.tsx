import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import AmazonResearchView from '../AmazonResearchView';
import collectedItemsReducer from '../../../../store/collectedItemsSlice';
import type { ProductListResponse } from '../types';

// ── RTK Query mock — researchSlice ─────────────────────────────────────────
const mockTriggerLiveSearch = vi.fn().mockReturnValue({ unwrap: vi.fn() });

const emptyResponse: ProductListResponse = {
  count: 0,
  results: [],
  next: null,
  previous: null,
};

let mockListProductsResult: {
  data?: ProductListResponse;
  isLoading: boolean;
  isFetching: boolean;
} = { isLoading: false, isFetching: false, data: emptyResponse };

vi.mock('../../../../store/researchSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../store/researchSlice')>();
  return {
    ...actual,
    useListProductsQuery: () => mockListProductsResult,
    useTriggerLiveSearchMutation: () => [mockTriggerLiveSearch, { isLoading: false }],
    useGetSuggestionsQuery: () => ({ data: [], isLoading: false }),
    usePollSearchStatusQuery: () => ({ data: undefined, isLoading: false }),
    usePollSearchStatusExtendedQuery: () => ({ data: undefined, isLoading: false }),
    useGetBSRHistoryQuery: () => ({ data: [], isLoading: false }),
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

// ── Mock react-router-dom for navigation ───────────────────────────────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ── Reducers needed by selectors (collectedItemsSlice) ─────────────────────
const extraReducers = {
  collectedItems: collectedItemsReducer,
};

describe('AmazonResearchView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockListProductsResult = {
      isLoading: false,
      isFetching: false,
      data: emptyResponse,
    };
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
    // In DB mode the "Live Research" label is not shown
    expect(screen.queryByText('Live Research')).not.toBeInTheDocument();
    // The switch should be unchecked (DB mode = default)
    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('toggles between DB Research and Live Research mode', async () => {
    renderWithProviders(<AmazonResearchView />, { reducers: extraReducers });

    // DB mode: no "Live Research" label visible, switch unchecked
    expect(screen.queryByText('Live Research')).not.toBeInTheDocument();

    const toggle = screen.getByRole('switch');
    await userEvent.click(toggle);

    // After toggle: "Live Research" label appears (SearchBar ModeLabel + subtitle)
    expect(screen.getAllByText('Live Research').length).toBeGreaterThanOrEqual(1);
  });

  it('shows loading skeleton while fetching (loading state)', () => {
    mockListProductsResult = { isLoading: true, isFetching: true, data: undefined };
    renderWithProviders(<AmazonResearchView />, { reducers: extraReducers });

    // The view shows skeletons when loading && !hasSearched
    const skeletons = document.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('switches between Grid/List view', { timeout: 15000 }, async () => {
    // Need products to see the layout toggle
    mockListProductsResult = {
      isLoading: false,
      isFetching: false,
      data: {
        count: 1,
        results: [
          {
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
          },
        ],
        next: null,
        previous: null,
      },
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

    // Initially DB mode: no mode label text rendered
    expect(screen.queryByText('Live Research')).not.toBeInTheDocument();

    const toggle = screen.getByRole('switch');
    await userEvent.click(toggle);

    // After toggle, "Live Research" label present
    expect(screen.getAllByText('Live Research').length).toBeGreaterThanOrEqual(1);
  });
});
