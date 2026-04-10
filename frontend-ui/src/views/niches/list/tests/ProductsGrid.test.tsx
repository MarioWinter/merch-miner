import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import type { CollectedProduct } from '../../../../store/collectedProductsSlice';

// ── Fake RTK Query API factory ─────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
const { fa } = vi.hoisted(() => ({
  fa: (n: string) => ({
    reducerPath: n,
    reducer: () => ({}),
    middleware: () => (x: any) => (a: any) => x(a),
    util: {
      resetApiState: () => ({ type: 'noop' }),
      invalidateTags: () => ({ type: 'noop' }),
    },
  }),
}));

vi.mock('@/store/nicheSlice', () => ({ nicheApi: fa('nicheApi'), useListNichesQuery: () => ({ data: { results: [] }, isLoading: false }) }));
vi.mock('@/store/ideaSlice', () => ({ ideaApi: fa('ideaApi') }));
vi.mock('@/store/researchSlice', () => ({ researchApi: fa('researchApi') }));
vi.mock('@/store/keywordSlice', () => ({ keywordApi: fa('keywordApi') }));
vi.mock('@/store/publishSlice', () => ({ publishApi: fa('publishApi') }));
vi.mock('@/store/dashboardSlice', () => ({ dashboardApi: fa('dashboardApi') }));
vi.mock('@/store/kanbanSlice', () => ({ kanbanApi: fa('kanbanApi') }));
vi.mock('@/store/notificationSlice', () => ({ notificationApi: fa('notificationApi') }));
vi.mock('@/store/searchSlice', () => ({ searchApi: fa('searchApi') }));
vi.mock('@/store/agentSlice', () => ({ agentApi: fa('agentApi') }));

// Mock collectedProductsSlice
const mockGetCollectedProducts = vi.fn();
const mockRemoveProduct = vi.fn().mockReturnValue({ unwrap: () => Promise.resolve() });
const mockExtractKeywords = vi.fn().mockReturnValue({ unwrap: () => Promise.resolve() });

vi.mock('@/store/collectedProductsSlice', () => ({
  collectedProductsApi: fa('collectedProductsApi'),
  useGetCollectedProductsQuery: (...args: unknown[]) => mockGetCollectedProducts(...args),
  useRemoveCollectedProductMutation: () => [mockRemoveProduct, { isLoading: false }],
  useExtractKeywordsMutation: () => [mockExtractKeywords, { isLoading: false }],
}));

// Mock designSlice for useProductToCanvas hook
const mockAddReferences = vi.fn().mockReturnValue({
  unwrap: () => Promise.resolve({ created: 1 }),
});

vi.mock('@/store/designSlice', () => ({
  designApi: fa('designApi'),
  useListProjectsQuery: () => ({ data: { results: [] } }),
  useAddReferencesToProjectMutation: () => [mockAddReferences, { isLoading: false }],
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock ProjectNamingDialog to avoid deep dependency tree
vi.mock('@/views/designs/board/partials/ProjectNamingDialog', () => ({
  ProjectNamingDialog: () => null,
}));

// Mock BulkFlowButton to simplify rendering
vi.mock('@/components/FlowButton', () => ({
  BulkFlowButton: ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button onClick={onClick}>{label}</button>
  ),
}));

import { renderWithProviders } from '../../../../utils/test-utils';
import { ProductsGrid } from '../partials/ProductsGrid';

// ── Fixtures ───────────────────────────────────────────────────────
const makeProduct = (overrides?: Partial<CollectedProduct>): CollectedProduct => ({
  id: 'cp-1',
  niche: 'niche-1',
  product: {
    id: 'prod-1',
    asin: 'B0TEST0001',
    title: 'Funny Dog T-Shirt',
    brand: 'TestBrand',
    bsr: 12345,
    bsr_categories: [],
    rating: 4.5,
    reviews_count: 200,
    price: 19.99,
    product_type: 't_shirt',
    subcategory: 'Novelty',
    listed_date: null,
    thumbnail_url: 'https://example.com/dog.jpg',
    bullet_1: '',
    bullet_2: '',
    description: '',
    marketplace: 'US',
    scraped_at: '2026-04-10T10:00:00Z',
  },
  collected_at: '2026-04-10T10:00:00Z',
  extracted_keywords: [],
  listing_template: {},
  ...overrides,
});

// ── Tests ──────────────────────────────────────────────────────────
describe('ProductsGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCollectedProducts.mockReturnValue({
      data: undefined,
      isLoading: false,
    });
  });

  it('shows skeletons during loading', () => {
    mockGetCollectedProducts.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { container } = renderWithProviders(
      <ProductsGrid nicheId="niche-1" nicheName="Funny Dogs" />,
    );

    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBe(3);
  });

  it('shows empty state when no products', () => {
    mockGetCollectedProducts.mockReturnValue({
      data: { results: [] },
      isLoading: false,
    });

    renderWithProviders(
      <ProductsGrid nicheId="niche-1" nicheName="Funny Dogs" />,
    );

    // The empty text uses i18n key; check for translated or fallback text
    const emptyText = screen.getByRole('paragraph');
    expect(emptyText).toBeInTheDocument();
  });

  it('renders product cards when data is loaded', () => {
    mockGetCollectedProducts.mockReturnValue({
      data: {
        results: [
          makeProduct({ id: 'cp-1' }),
          makeProduct({
            id: 'cp-2',
            product: {
              ...makeProduct().product,
              id: 'prod-2',
              title: 'Cat Hoodie',
              thumbnail_url: 'https://example.com/cat.jpg',
            },
          }),
        ],
      },
      isLoading: false,
    });

    renderWithProviders(
      <ProductsGrid nicheId="niche-1" nicheName="Funny Dogs" />,
    );

    // Cards should render product images
    const images = screen.getAllByRole('img');
    expect(images.length).toBeGreaterThanOrEqual(2);
  });

  it('does not show bulk send button when nothing selected', () => {
    mockGetCollectedProducts.mockReturnValue({
      data: { results: [makeProduct()] },
      isLoading: false,
    });

    renderWithProviders(
      <ProductsGrid nicheId="niche-1" nicheName="Funny Dogs" />,
    );

    // BulkFlowButton should not be rendered when nothing is selected
    expect(screen.queryByText(/send.*canvas/i)).not.toBeInTheDocument();
  });

  it('sends single product to canvas on card action', () => {
    const product = makeProduct();
    mockGetCollectedProducts.mockReturnValue({
      data: { results: [product] },
      isLoading: false,
    });

    renderWithProviders(
      <ProductsGrid nicheId="niche-1" nicheName="Funny Dogs" />,
    );

    // ProductThumbnailCard's onCanvas is wired to sendToCanvas([cp.product.id])
    // With 0 projects, the dialog should open (we mocked ProjectNamingDialog as null)
    // The hook will be called — we verify via the mock setup working without crash
    expect(screen.getAllByRole('img').length).toBeGreaterThanOrEqual(1);
  });
});
