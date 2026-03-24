import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../../../utils/test-utils';
import ProductTable from '../partials/ProductTable';
import type { AmazonProduct } from '../types';

// ── RTK Query mocks (ProductDetailPanel dependencies) ────────────────────────
vi.mock('../../../../store/researchSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../store/researchSlice')>();
  return {
    ...actual,
    useGetBSRHistoryQuery: () => ({ data: [], isLoading: false }),
  };
});

vi.mock('../../../../store/nicheSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../store/nicheSlice')>();
  return {
    ...actual,
    useCreateNicheMutation: () => [vi.fn(), { isLoading: false }],
  };
});

const buildProduct = (overrides?: Partial<AmazonProduct>): AmazonProduct => ({
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
  description: 'A hiking tee',
  marketplace: 'amazon_com',
  scraped_at: '2026-03-01T00:00:00Z',
  ...overrides,
});

const baseProps = {
  products: [] as AmazonProduct[],
  keyword: 'hiking',
  count: 0,
  page: 0,
  pageSize: 50,
  onPageChange: vi.fn(),
  onSortChange: vi.fn(),
  loading: false,
};

describe('ProductTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders table headers correctly', () => {
    renderWithProviders(<ProductTable {...baseProps} />);

    const grid = screen.getByRole('grid', { name: 'Product research results' });
    expect(grid).toBeInTheDocument();

    // Check column headers
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Brand')).toBeInTheDocument();
    expect(screen.getByText('BSR')).toBeInTheDocument();
    expect(screen.getByText('Rating')).toBeInTheDocument();
    expect(screen.getByText('Reviews')).toBeInTheDocument();
    expect(screen.getByText('Price')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Listed')).toBeInTheDocument();
    expect(screen.getByText('ASIN')).toBeInTheDocument();
  });

  it('shows "No rows" when products array is empty', () => {
    renderWithProviders(<ProductTable {...baseProps} products={[]} count={0} />);

    expect(screen.getByText('No rows')).toBeInTheDocument();
  });

  it('renders product rows with correct data', () => {
    const products = [
      buildProduct({ asin: 'B09AAA111', title: 'Cool Shirt', brand: 'CoolBrand', price: 24.99, reviews_count: 300 }),
      buildProduct({ asin: 'B09BBB222', title: 'Funny Hat', brand: 'HatBrand', price: 12.50, reviews_count: 50 }),
    ];

    renderWithProviders(
      <ProductTable {...baseProps} products={products} count={2} />,
    );

    // Verify both product titles
    expect(screen.getByText('Cool Shirt')).toBeInTheDocument();
    expect(screen.getByText('Funny Hat')).toBeInTheDocument();

    // Verify brands
    expect(screen.getByText('CoolBrand')).toBeInTheDocument();
    expect(screen.getByText('HatBrand')).toBeInTheDocument();

    // Verify ASINs
    expect(screen.getByText('B09AAA111')).toBeInTheDocument();
    expect(screen.getByText('B09BBB222')).toBeInTheDocument();
  });

  it('renders price formatted as currency', () => {
    const products = [buildProduct({ asin: 'B09PRICE', price: 19.99 })];
    renderWithProviders(
      <ProductTable {...baseProps} products={products} count={1} />,
    );

    expect(screen.getByText('$19.99')).toBeInTheDocument();
  });

  it('renders BSR as a chip with locale-formatted number', () => {
    const products = [buildProduct({ asin: 'B09BSR', bsr: 5000 })];
    renderWithProviders(
      <ProductTable {...baseProps} products={products} count={1} />,
    );

    // BSR 5000 => "5,000" in locale format inside a Chip
    const chip = screen.getByText('5,000');
    expect(chip.closest('.MuiChip-root')).toBeInTheDocument();
  });

  it('renders dash when bsr is null', () => {
    const products = [buildProduct({ asin: 'B09NULLBSR', bsr: null })];
    renderWithProviders(
      <ProductTable {...baseProps} products={products} count={1} />,
    );

    // The cell should show "-" for null BSR
    const row = screen.getByText('B09NULLBSR').closest('.MuiDataGrid-row');
    expect(row).toBeInTheDocument();
    expect(within(row! as HTMLElement).getByText('-')).toBeInTheDocument();
  });

  it('renders dash when rating is null', () => {
    const products = [buildProduct({ asin: 'B09NULLRAT', rating: null })];
    renderWithProviders(
      <ProductTable {...baseProps} products={products} count={1} />,
    );

    const row = screen.getByText('B09NULLRAT').closest('.MuiDataGrid-row');
    expect(row).toBeInTheDocument();
    // "-" appears for null rating
    const dashes = within(row! as HTMLElement).getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders dash when price is null', () => {
    const products = [buildProduct({ asin: 'B09NULLPRC', price: null })];
    renderWithProviders(
      <ProductTable {...baseProps} products={products} count={1} />,
    );

    const row = screen.getByText('B09NULLPRC').closest('.MuiDataGrid-row');
    expect(row).toBeInTheDocument();
    const dashes = within(row! as HTMLElement).getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders dash when reviews_count is null', () => {
    const products = [buildProduct({ asin: 'B09NULLREV', reviews_count: null })];
    renderWithProviders(
      <ProductTable {...baseProps} products={products} count={1} />,
    );

    const row = screen.getByText('B09NULLREV').closest('.MuiDataGrid-row');
    expect(row).toBeInTheDocument();
    const dashes = within(row! as HTMLElement).getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders listed_date formatted as locale date string', () => {
    const products = [buildProduct({ asin: 'B09DATE', listed_date: '2025-06-15' })];
    renderWithProviders(
      <ProductTable {...baseProps} products={products} count={1} />,
    );

    // toLocaleDateString output varies by locale; just check a date-like pattern exists
    const row = screen.getByText('B09DATE').closest('.MuiDataGrid-row');
    expect(row).toBeInTheDocument();
    // At minimum, should not show "-" for a valid date
    expect(within(row! as HTMLElement).queryByText('-')).not.toBeInTheDocument();
  });

  it('renders dash when listed_date is null', () => {
    const products = [buildProduct({ asin: 'B09NULLDATE', listed_date: null })];
    renderWithProviders(
      <ProductTable {...baseProps} products={products} count={1} />,
    );

    const row = screen.getByText('B09NULLDATE').closest('.MuiDataGrid-row');
    expect(row).toBeInTheDocument();
    const dashes = within(row! as HTMLElement).getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('Amazon link has correct href for amazon_com marketplace', () => {
    const products = [buildProduct({ asin: 'B09LINK', marketplace: 'amazon_com' })];
    renderWithProviders(
      <ProductTable {...baseProps} products={products} count={1} />,
    );

    const link = screen.getByLabelText('Open on Amazon');
    expect(link).toHaveAttribute('href', 'https://www.amazon.com/dp/B09LINK');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('Amazon link uses correct domain for amazon_de marketplace', () => {
    const products = [buildProduct({ asin: 'B09LINKDE', marketplace: 'amazon_de' })];
    renderWithProviders(
      <ProductTable {...baseProps} products={products} count={1} />,
    );

    const link = screen.getByLabelText('Open on Amazon');
    expect(link).toHaveAttribute('href', 'https://www.amazon.de/dp/B09LINKDE');
  });

  it('has aria-label on the DataGrid', () => {
    renderWithProviders(<ProductTable {...baseProps} />);

    expect(
      screen.getByRole('grid', { name: 'Product research results' }),
    ).toBeInTheDocument();
  });
});
