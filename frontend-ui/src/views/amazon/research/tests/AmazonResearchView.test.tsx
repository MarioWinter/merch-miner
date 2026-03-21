import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import AmazonResearchView from '../AmazonResearchView';
import type { ProductListResponse } from '../types';

// ── RTK Query mock ──────────────────────────────────────────────────────────
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
  };
});

// Mock niche slice used by ProductGrid
vi.mock('../../../../store/nicheSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../store/nicheSlice')>();
  return {
    ...actual,
    useCreateNicheMutation: () => [vi.fn(), { isLoading: false }],
  };
});

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
    renderWithProviders(<AmazonResearchView />);
    expect(screen.getByText('Amazon Research')).toBeInTheDocument();
  });

  it('shows empty state when no search has been performed', () => {
    renderWithProviders(<AmazonResearchView />);
    expect(screen.getByText('Search a keyword to get started')).toBeInTheDocument();
  });

  it('defaults to DB Research mode', () => {
    renderWithProviders(<AmazonResearchView />);
    expect(screen.getAllByText('DB Research').length).toBeGreaterThanOrEqual(1);
  });

  it('toggles between DB Research and Live Research mode', async () => {
    renderWithProviders(<AmazonResearchView />);

    // "DB Research" appears in both ModeLabel and subtitle; just check presence
    expect(screen.getAllByText('DB Research').length).toBeGreaterThanOrEqual(1);

    const toggle = screen.getByRole('switch');
    await userEvent.click(toggle);

    expect(screen.getAllByText('Live Research').length).toBeGreaterThanOrEqual(1);
  });

  it('shows loading skeleton while fetching (loading state)', () => {
    mockListProductsResult = { isLoading: true, isFetching: true, data: undefined };
    renderWithProviders(<AmazonResearchView />);

    // The view shows skeletons when loading && !hasSearched
    // Since hasSearched is initially false and loading is true, skeletons render
    // Actually the condition is `loading && !hasSearched` which is true
    // Skeletons render as rectangular spans
    const skeletons = document.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('switches between Grid/List view', async () => {
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

    renderWithProviders(<AmazonResearchView />);

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
    renderWithProviders(<AmazonResearchView />);

    const advancedBtn = screen.getByRole('button', { name: /toggle advanced options/i });
    expect(advancedBtn).toBeInTheDocument();
    expect(screen.getByText(/Advanced Options/)).toBeInTheDocument();
  });

  it('mode label updates when toggling mode', async () => {
    renderWithProviders(<AmazonResearchView />);

    // Initially DB mode
    expect(screen.getAllByText('DB Research').length).toBeGreaterThanOrEqual(1);

    const toggle = screen.getByRole('switch');
    await userEvent.click(toggle);

    // After toggle, "DB Research" should be gone and "Live Research" present
    expect(screen.queryByText('DB Research')).not.toBeInTheDocument();
    expect(screen.getAllByText('Live Research').length).toBeGreaterThanOrEqual(1);
  });
});
