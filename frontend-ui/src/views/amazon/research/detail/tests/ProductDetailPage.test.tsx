import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../../utils/test-utils';
import ProductDetailPage from '../ProductDetailPage';

const mockProduct = {
  id: 'prod-test-123',
  asin: 'B09TEST123',
  title: 'Funny Hiking T-Shirt',
  brand: 'TrailBrand',
  bsr: 5000,
  rating: 4.5,
  reviews_count: 120,
  price: 19.99,
  product_type: 't_shirt',
  subcategory: 'Novelty',
  listed_date: '2025-01-15',
  thumbnail_url: 'https://example.com/img.jpg',
  bullet_1: 'Bullet one',
  bullet_2: 'Bullet two',
  description: 'A hiking tee for the trail lover.',
  marketplace: 'amazon_com',
  scraped_at: '2026-03-01T00:00:00Z',
  prompt_analysis: null,
  meta_keywords: [
    { id: 1, keyword: 'hiking', type: 'short_tail' as const, frequency: 5 },
    { id: 2, keyword: 'funny shirt', type: 'long_tail' as const, frequency: 3 },
  ],
  bsr_categories: [
    { rank: 73692, category: 'Clothing, Shoes & Jewelry', category_url: '' },
    { rank: 1234, category: 'Novelty T-Shirts', category_url: '' },
  ],
};

const mockBsrHistory = {
  snapshots: [
    { bsr: 6000, rating: 4.5, price: 19.99, recorded_at: '2026-01-01T00:00:00Z' },
    { bsr: 5000, rating: 4.5, price: 19.99, recorded_at: '2026-03-01T00:00:00Z' },
  ],
  summary: { overall_trend: 'up' as const, current_trend: 'up' as const, average: 5500, median: 5500 },
};

const mockRescrapeMutation = vi.fn().mockReturnValue({
  unwrap: () => Promise.resolve({ job_id: 'job-1', rq_job_id: 'rq-1' }),
});

// Mock RTK Query hooks
vi.mock('../../../../../store/researchSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../store/researchSlice')>();
  return {
    ...actual,
    useGetProductDetailQuery: (asin: string) => {
      if (asin === 'NOTFOUND') {
        return { data: undefined, isLoading: false, error: { status: 404 } };
      }
      if (asin === 'LOADING') {
        return { data: undefined, isLoading: true, error: undefined };
      }
      return { data: mockProduct, isLoading: false, error: undefined };
    },
    useGetBSRHistoryFullQuery: () => ({
      data: mockBsrHistory,
      isLoading: false,
    }),
    useGetSimilarProductsQuery: () => ({ data: [], isLoading: false }),
    useGetSameBrandProductsQuery: () => ({ data: [], isLoading: false }),
    useGetPriceHistoryQuery: () => ({ data: [], isLoading: false }),
    useUseAsTemplateMutation: () => [vi.fn(), { isLoading: false }],
    useRescrapeProductMutation: () => [
      mockRescrapeMutation,
      { isLoading: false },
    ],
  };
});

// Mock useParams
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({ asin: 'B09TEST123' }),
  };
});

const enqueueSnackbarMock = vi.fn();
vi.mock('notistack', async (importOriginal) => {
  const actual = await importOriginal<typeof import('notistack')>();
  return {
    ...actual,
    useSnackbar: () => ({ enqueueSnackbar: enqueueSnackbarMock }),
  };
});

describe('ProductDetailPage', () => {
  it('renders product detail with KPI row using broadest-category BSR', () => {
    renderWithProviders(<ProductDetailPage />, {
      initialRoute: '/amazon/research/product/B09TEST123',
    });

    // KPI labels
    expect(screen.getByText('BSR')).toBeInTheDocument();
    expect(screen.getByText('PRICE')).toBeInTheDocument();
    expect(screen.getByText('REVIEWS')).toBeInTheDocument();
    expect(screen.getByText('RATING')).toBeInTheDocument();

    // KPI values — BSR uses broadest category (73692), not product.bsr (5000)
    // 73,692 may appear both in KPI row + subcategory rank list, so getAllBy
    expect(screen.getAllByText('73,692').length).toBeGreaterThan(0);
    expect(screen.getByText('$19.99')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('4.5')).toBeInTheDocument();
  });

  it('renders product title and brand', () => {
    renderWithProviders(<ProductDetailPage />, {
      initialRoute: '/amazon/research/product/B09TEST123',
    });

    expect(screen.getByText('Funny Hiking T-Shirt')).toBeInTheDocument();
    expect(screen.getByText('TrailBrand')).toBeInTheDocument();
  });

  it('renders action icon buttons (Open in Amazon, Use as Template, Analyze, Rescrape)', () => {
    renderWithProviders(<ProductDetailPage />, {
      initialRoute: '/amazon/research/product/B09TEST123',
    });

    expect(
      screen.getByRole('button', { name: 'Open in Amazon' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Use as Listing Template' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Analyze Design' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Refresh product data' }),
    ).toBeInTheDocument();
  });

  it('does not render Save Keywords button (removed)', () => {
    renderWithProviders(<ProductDetailPage />, {
      initialRoute: '/amazon/research/product/B09TEST123',
    });

    expect(
      screen.queryByRole('button', { name: 'Save Keywords' }),
    ).not.toBeInTheDocument();
  });

  it('renders keyword chips', () => {
    renderWithProviders(<ProductDetailPage />, {
      initialRoute: '/amazon/research/product/B09TEST123',
    });

    expect(screen.getByText('hiking')).toBeInTheDocument();
    expect(screen.getByText('funny shirt')).toBeInTheDocument();
  });

  it('renders breadcrumb with ASIN', () => {
    renderWithProviders(<ProductDetailPage />, {
      initialRoute: '/amazon/research/product/B09TEST123',
    });

    expect(screen.getByText('Amazon Research')).toBeInTheDocument();
    expect(screen.getByText('B09TEST123')).toBeInTheDocument();
  });

  it('renders BSR chart section title', () => {
    renderWithProviders(<ProductDetailPage />, {
      initialRoute: '/amazon/research/product/B09TEST123',
    });

    expect(screen.getByText('BSR History (90 days)')).toBeInTheDocument();
  });

  it('clicks Reload button → calls rescrape mutation with asin + marketplace and shows snackbar', async () => {
    mockRescrapeMutation.mockClear();
    enqueueSnackbarMock.mockClear();

    renderWithProviders(<ProductDetailPage />, {
      initialRoute: '/amazon/research/product/B09TEST123',
    });

    const reloadBtn = screen.getByRole('button', {
      name: 'Refresh product data',
    });
    await userEvent.click(reloadBtn);

    expect(mockRescrapeMutation).toHaveBeenCalledWith({
      asin: 'B09TEST123',
      marketplace: 'amazon_com',
    });
    expect(enqueueSnackbarMock).toHaveBeenCalledWith(
      'Scrape started — data will refresh automatically in ~30s.',
      { variant: 'info' },
    );
  });
});
